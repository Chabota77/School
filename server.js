const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});

app.use(express.static(path.join(__dirname, '/')));

// Initialize Database
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database.');

    const initialFees = `
        CREATE TABLE IF NOT EXISTS payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT,
            amount DECIMAL(10,2),
            date DATE,
            term VARCHAR(50),
            year INT,
            method VARCHAR(50) DEFAULT 'Cash',
            received_by VARCHAR(100) DEFAULT 'Admin',
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );
    `;

    db.query(initialFees, (err) => {
        if (err) console.error('Error creating payments table:', err);
    });

    // Check if term_fee column exists in classes, if not add it
    const checkFeeColumn = "SHOW COLUMNS FROM classes LIKE 'term_fee'";
    db.query(checkFeeColumn, (err, results) => {
        if (results.length === 0) {
            db.query("ALTER TABLE classes ADD COLUMN term_fee DECIMAL(10,2) DEFAULT 3000.00", (err) => {
                if (err) console.error('Error adding term_fee column:', err);
                else console.log('Added term_fee column to classes table');
            });
        }
    });
});

// Middleware for authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---

// Unified Login Route
app.post('/api/auth/login', (req, res) => {
    const { username, password, role } = req.body;

    let table = 'admins';
    let queryCol = 'username';

    if (role === 'teacher') {
        table = 'teachers';
        queryCol = 'email'; // Teachers log in with email
    } else if (role === 'student') {
        // Future implementation
    }

    const query = `SELECT * FROM ${table} WHERE ${queryCol} = ?`;
    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Login DB Error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            console.log(`Login failed: User not found in ${table} for ${queryCol}=${username}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = results[0];
        console.log('Login: User found:', user.id, user[queryCol]);

        // Check password
        if (!user.password) {
            console.log('Login failed: User has no password set');
            return res.status(401).json({ message: 'Invalid credentials (no password set)' });
        }

        const isMatch = await bcrypt.compare(password, user.password).catch(e => {
            console.error('Bcrypt error:', e);
            return false;
        });

        console.log('Login: Password match result:', isMatch);

        // For admins (legacy check for plain text dev passwords)
        const passwordMatch = user.password.startsWith('$2b$') ? isMatch : (password === user.password);

        if (!passwordMatch) {
            console.log('Login failed: Password mismatch');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user[queryCol], role: role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, username: user[queryCol], role: role, name: user.name } });
    });
});

// --- TEACHER ROUTES ---

// Get all teachers
app.get('/api/teachers', authenticateToken, (req, res) => {
    const query = `
        SELECT t.*, c.name as class_name, s.name as subject_name 
        FROM teachers t
        LEFT JOIN teacher_assignments ta ON t.id = ta.teacher_id
        LEFT JOIN classes c ON ta.class_id = c.id
        LEFT JOIN subjects s ON ta.subject_id = s.id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add new teacher
app.post('/api/teachers', authenticateToken, async (req, res) => {
    const { name, email, password, phone, status, class_id, subject_id } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.beginTransaction((err) => {
            if (err) return res.status(500).json({ error: err.message });

            const query = 'INSERT INTO teachers (name, email, password, phone, status) VALUES (?, ?, ?, ?, ?)';
            db.query(query, [name, email, hashedPassword, phone, status], (err, results) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ error: err.message });
                    });
                }

                const teacherId = results.insertId;
                if (class_id && subject_id) {
                    const assignQuery = 'INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (?, ?, ?)';
                    db.query(assignQuery, [teacherId, class_id, subject_id], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: err.message });
                            });
                        }
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ error: err.message });
                                });
                            }
                            res.status(201).json({ message: 'Teacher added and assigned successfully', id: teacherId });
                        });
                    });
                } else {
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: err.message });
                            });
                        }
                        res.status(201).json({ message: 'Teacher added successfully', id: teacherId });
                    });
                }
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update teacher
app.put('/api/teachers/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, email, phone, status, class_id, subject_id } = req.body;

    const query = 'UPDATE teachers SET name = ?, email = ?, phone = ?, status = ? WHERE id = ?';
    db.query(query, [name, email, phone, status, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // Update assignment (simple version: delete and re-insert)
        db.query('DELETE FROM teacher_assignments WHERE teacher_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            if (class_id && subject_id) {
                const assignQuery = 'INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (?, ?, ?)';
                db.query(assignQuery, [id, class_id, subject_id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Teacher updated successfully' });
                });
            } else {
                res.json({ message: 'Teacher updated successfully' });
            }
        });
    });
});

// Delete teacher
app.delete('/api/teachers/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM teachers WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Teacher deleted successfully' });
    });
});

// --- STUDENT ROUTES ---

// Get all students
app.get('/api/students', authenticateToken, (req, res) => {
    const query = `
        SELECT s.*, c.name as class_name 
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add new student
app.post('/api/students', authenticateToken, (req, res) => {
    const { name, age, gender, class_id, status } = req.body; // Added gender
    const query = 'INSERT INTO students (name, age, gender, class_id, status) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [name, age, gender, class_id, status || 'Enrolled'], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Student added successfully', id: results.insertId });
    });
});

// Update student
app.put('/api/students/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, age, gender, class_id, status } = req.body; // Added gender
    const query = 'UPDATE students SET name = ?, age = ?, gender = ?, class_id = ?, status = ? WHERE id = ?';
    db.query(query, [name, age, gender, class_id, status, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Student updated successfully' });
    });
});

// Delete student
app.delete('/api/students/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM students WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Student deleted successfully' });
    });
});

// --- ADMISSIONS ROUTES ---

// Get all admissions
app.get('/api/admissions', authenticateToken, (req, res) => {
    const query = `
        SELECT a.*, c.name as class_name 
        FROM admissions a
        LEFT JOIN classes c ON a.class_applied_id = c.id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Check if phone column exists in admissions
const checkPhoneColumn = "SHOW COLUMNS FROM admissions LIKE 'phone'";
db.query(checkPhoneColumn, (err, results) => {
    if (results.length === 0) {
        db.query("ALTER TABLE admissions ADD COLUMN phone VARCHAR(20) AFTER parent_name", (err) => {
            if (err) console.error('Error adding phone column:', err);
            else console.log('Added phone column to admissions table');
        });
    }
});


// Post Results
// ... (omitted)

// --- ADMISSIONS ROUTES ---

// Get all admissions
app.get('/api/admissions', authenticateToken, (req, res) => {
    const query = `
        SELECT a.*, c.name as class_name 
        FROM admissions a
        LEFT JOIN classes c ON a.class_applied_id = c.id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Public Admission Submission
app.post('/api/admissions', (req, res) => {
    const { student_name, age, class_applied_id, parent_name, phone } = req.body;
    // We are replacing email with phone, but table might still have email column. 
    // We'll treat 'phone' as the main contact.
    const query = 'INSERT INTO admissions (student_name, age, class_applied_id, parent_name, phone, status) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [student_name, age, class_applied_id, parent_name, phone, 'Pending'], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Application submitted', id: results.insertId });
    });
});

// Update admission status (Approve/Reject)
app.patch('/api/admissions/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'Approved' or 'Rejected'

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: err.message });

        const query = 'UPDATE admissions SET status = ? WHERE id = ?';
        db.query(query, [status, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

            if (status === 'Approved') {
                // If approved, add to students table
                db.query('SELECT * FROM admissions WHERE id = ?', [id], (err, results) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                    const admission = results[0];
                    const studentQuery = 'INSERT INTO students (name, age, class_id, status) VALUES (?, ?, ?, ?)';
                    db.query(studentQuery, [admission.student_name, admission.age, admission.class_applied_id, 'Enrolled'], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                        db.commit((err) => {
                            if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                            res.json({ message: 'Admission approved and student enrolled' });
                        });
                    });
                });
            } else {
                db.commit((err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                    res.json({ message: `Admission ${status.toLowerCase()}` });
                });
            }
        });
    });
});

// --- ANNOUNCEMENTS ---

app.get('/api/announcements', (req, res) => {
    db.query('SELECT * FROM announcements ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/announcements', authenticateToken, (req, res) => {
    const { title, content, audience } = req.body;
    const query = 'INSERT INTO announcements (title, content, audience) VALUES (?, ?, ?)';
    db.query(query, [title, content, audience], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Announcement posted', id: results.insertId });
    });
});

app.delete('/api/announcements/:id', authenticateToken, (req, res) => {
    db.query('DELETE FROM announcements WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Announcement deleted' });
    });
});

// --- HELPERS (Classes & Subjects) ---

app.get('/api/classes', (req, res) => {
    db.query('SELECT * FROM classes', (err, results) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(results);
    });
});

app.get('/api/subjects', (req, res) => {
    db.query('SELECT * FROM subjects', (err, results) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(results);
    });
});

// Dashboard stats
app.get('/api/stats', authenticateToken, (req, res) => {
    const stats = {};
    db.query('SELECT COUNT(*) as count FROM students', (err, results) => {
        stats.totalStudents = results[0].count;
        db.query('SELECT COUNT(*) as count FROM teachers', (err, results) => {
            stats.totalTeachers = results[0].count;
            db.query('SELECT COUNT(*) as count FROM admissions WHERE status = "Pending"', (err, results) => {
                stats.newAdmissions = results[0].count;
                db.query('SELECT COUNT(*) as count FROM messages', (err, results) => {
                    stats.pendingMessages = results[0].count;
                    res.json(stats);
                });
            });
        });
    });
});

// --- TEACHER DASHBOARD ROUTES ---

// Get Teacher Stats
app.get('/api/teacher/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'teacher') return res.sendStatus(403);

    const teacherId = req.user.id;
    const stats = {};

    // Count students in classes assigned to this teacher
    const studentQuery = `
        SELECT COUNT(DISTINCT s.id) as count 
        FROM students s
        JOIN teacher_assignments ta ON s.class_id = ta.class_id
        WHERE ta.teacher_id = ?
    `;

    db.query(studentQuery, [teacherId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.students = results[0].count;

        // Messages count
        db.query('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND receiver_type = "Teacher"', [teacherId], (err, results) => {
            stats.messages = results[0].count;

            // Pending Results (Mock logic for now, or count students needing grades)
            stats.pendingResults = 0;

            res.json(stats);
        });
    });
});

// Get Assigned Pupils
app.get('/api/teacher/pupils', authenticateToken, (req, res) => {
    if (req.user.role !== 'teacher') return res.sendStatus(403);

    const teacherId = req.user.id;
    const query = `
        SELECT s.*, c.name as class_name 
        FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN teacher_assignments ta ON c.id = ta.class_id
        WHERE ta.teacher_id = ?
    `;

    db.query(query, [teacherId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// --- RESULTS ROUTES ---

// Create Results Table if not exists (Lazy migration for now)
db.query(`
    CREATE TABLE IF NOT EXISTS results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT,
        subject_id INT,
        marks INT,
        comments TEXT,
        term VARCHAR(20) DEFAULT 'Term 1',
        year INT DEFAULT 2026,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )
`, (err) => { if (err) console.error('Error creating results table:', err); });

// Post Results
app.post('/api/results', authenticateToken, (req, res) => {
    if (req.user.role !== 'teacher') return res.sendStatus(403);

    const { student_id, subject_id, marks, comments } = req.body;

    // Check if result exists for this term/year (Default Term 1 / 2026 for now)
    const checkQuery = 'SELECT id FROM results WHERE student_id = ? AND subject_id = ? AND term = ? AND year = ?';
    const term = 'Term 1';
    const year = 2026;

    db.query(checkQuery, [student_id, subject_id, term, year], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existing.length > 0) {
            // Update existing
            const updateQuery = 'UPDATE results SET marks = ?, comments = ? WHERE id = ?';
            db.query(updateQuery, [marks, comments, existing[0].id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(200).json({ message: 'Result updated successfully' });
            });
        } else {
            // Insert new
            const insertQuery = 'INSERT INTO results (student_id, subject_id, marks, comments, term, year) VALUES (?, ?, ?, ?, ?, ?)';
            db.query(insertQuery, [student_id, subject_id, marks, comments, term, year], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Result saved successfully' });
            });
        }
    });
});

// Get Results (for Teacher's Students)
app.get('/api/results', authenticateToken, (req, res) => {
    if (req.user.role !== 'teacher') return res.sendStatus(403);
    const teacherId = req.user.id;

    const query = `
        SELECT r.*, s.name as student_name, sub.name as subject_name
        FROM results r
        JOIN students s ON r.student_id = s.id
        JOIN subjects sub ON r.subject_id = sub.id
        JOIN teacher_assignments ta ON s.class_id = ta.class_id
        WHERE ta.teacher_id = ?
    `;

    db.query(query, [teacherId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Public Results Check
app.get('/api/public/results', (req, res) => {
    const { student_id, name, term } = req.query;

    if (!student_id || !name || !term) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let dbId = parseInt(student_id);
    if (dbId > 2500000) {
        dbId = dbId - 2500000;
    }

    const query = `
        SELECT r.*, s.name as student_name, sub.name as subject_name 
        FROM results r
        JOIN students s ON r.student_id = s.id
        JOIN subjects sub ON r.subject_id = sub.id
        WHERE s.id = ? AND LOWER(TRIM(s.name)) = LOWER(TRIM(?)) AND r.term = ?
    `;

    db.query(query, [dbId, name, term], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        // Deduplicate results based on subject_id (keep latest)
        const uniqueResults = [];
        const seenSubjects = new Set();

        // Iterate in reverse to keep the "last" occurrence if there are duplicates
        // Or better yet, just use a map
        const subjectMap = new Map();
        results.forEach(r => {
            subjectMap.set(r.subject_id, r);
        });

        res.json(Array.from(subjectMap.values()));
    });
});

// --- PAYMENT ROUTES ---

// Get Payment Summary (All Students)
app.get('/api/payments', authenticateToken, (req, res) => {
    const query = `
        SELECT 
            s.id, s.name, 
            c.name as class_name, c.term_fee,
            COALESCE(SUM(p.amount), 0) as total_paid
        FROM students s
        JOIN classes c ON s.class_id = c.id
        LEFT JOIN payments p ON s.id = p.student_id
        GROUP BY s.id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const summary = results.map(row => ({
            id: row.id,
            name: row.name,
            roll_no: (row.roll_no || row.id) + 2500000,
            class_name: row.class_name,
            total_fees: row.term_fee,
            paid: row.total_paid,
            balance: row.term_fee - row.total_paid,
            status: (row.term_fee - row.total_paid) <= 0 ? 'Paid' : (row.total_paid > 0 ? 'Partial' : 'Unpaid')
        }));
        res.json(summary);
    });
});

// Record a Payment
app.post('/api/payments', authenticateToken, (req, res) => {
    const { student_id, amount, date, term, year, method } = req.body;
    const query = 'INSERT INTO payments (student_id, amount, date, term, year, method) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [student_id, amount, date, term, year, method], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Payment recorded successfully', id: result.insertId });
    });
});

// Get Payment Stats (Monthly)
app.get('/api/payments/stats/monthly', authenticateToken, (req, res) => {
    const { month, year } = req.query;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = months.indexOf(month) + 1;

    if (monthIndex === 0) return res.json({ total: 0 });

    const query = `
        SELECT SUM(amount) as total 
        FROM payments 
        WHERE MONTH(date) = ? AND YEAR(date) = ?
    `;
    db.query(query, [monthIndex, year], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: results[0].total || 0 });
    });
});

// Get Student Payment History
app.get('/api/payments/:id', authenticateToken, (req, res) => {
    const query = 'SELECT * FROM payments WHERE student_id = ? ORDER BY date DESC';
    db.query(query, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Edit Payment
app.put('/api/payments/:id', authenticateToken, (req, res) => {
    const { amount, date, method } = req.body;
    const query = 'UPDATE payments SET amount = ?, date = ?, method = ? WHERE id = ?';
    db.query(query, [amount, date, method, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Payment updated successfully' });
    });
});

// Delete Payment
app.delete('/api/payments/:id', authenticateToken, (req, res) => {
    db.query('DELETE FROM payments WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Payment deleted successfully' });
    });
});

// Get Payment Stats (Monthly)
app.get('/api/payments/stats/monthly', authenticateToken, (req, res) => {
    const { month, year } = req.query;
    // month is string (e.g. "January"), year is int (e.g. 2026)
    // We need to convert Month name to number or parse dateStr
    // Since default date format is YYYY-MM-DD

    // Quick helper for month index
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = months.indexOf(month) + 1;

    if (monthIndex === 0) return res.json({ total: 0 });

    const query = `
        SELECT SUM(amount) as total 
        FROM payments 
        WHERE MONTH(date) = ? AND YEAR(date) = ?
    `;
    db.query(query, [monthIndex, year], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: results[0].total || 0 });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
