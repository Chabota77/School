const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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
const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error connecting to database:', err.message);
    else {
        console.log('Connected to SQLite database.');
        // Seed Classes if empty
        db.get("SELECT COUNT(*) as count FROM classes", (err, row) => {
            if (!err && row.count === 0) {
                console.log("Seeding classes...");
                const stmt = db.prepare("INSERT INTO classes (name) VALUES (?)");
                stmt.run("Grade 7A");
                stmt.run("Grade 7B");
                stmt.run("Grade 8A");
                stmt.run("Grade 9B");
                stmt.finalize();
            }
        });
    }
});

// Helper to mimic mysql db.query style
// This allows us to keep most of the code logic same
db.query = function (sql, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    const lowerSql = sql.trim().toLowerCase();
    if (lowerSql.startsWith('select') || lowerSql.startsWith('show')) {
        db.all(sql, params, (err, rows) => {
            if (callback) callback(err, rows);
        });
    } else {
        db.run(sql, params, function (err) {
            if (callback) {
                // Mimic MySQL result object
                // this.lastID is equivalent to insertId
                // this.changes is equivalent to affectedRows
                const result = {
                    insertId: this.lastID,
                    affectedRows: this.changes
                };
                callback(err, result);
            }
        });
    }
};

// Also we need to mimic db.beginTransaction etc.
// SQLite transactions are serialized, but we can wrap them.
db.beginTransaction = function (callback) {
    db.run('BEGIN TRANSACTION', (err) => {
        if (callback) callback(err);
    });
};

db.commit = function (callback) {
    db.run('COMMIT', (err) => {
        if (callback) callback(err);
    });
};

db.rollback = function (callback) {
    db.run('ROLLBACK', (err) => {
        if (callback) callback(err);
    });
};


// Middleware for authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'school', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---

// Unified Login Route
app.post('/api/auth/login', (req, res) => {
    const { username, password, role } = req.body;

    // 1. Determine Table and Query Strategy based on Role
    let table = 'admins';
    let query = `SELECT * FROM admins WHERE LOWER(username) = LOWER(?)`;
    let queryParams = [username];

    if (role === 'teacher') {
        table = 'teachers';
        query = `SELECT * FROM teachers WHERE LOWER(email) = LOWER(?)`;
        queryParams = [username];
    } else if (role === 'student') {
        table = 'students';
        let dbId = parseInt(username);
        if (!isNaN(dbId) && dbId > 2500000) {
            dbId = dbId - 2500000;
        }

        if (isNaN(dbId)) {
            query = `SELECT * FROM students WHERE LOWER(name) = LOWER(?)`;
            queryParams = [username];
        } else {
            query = `SELECT * FROM students WHERE id = ?`;
            queryParams = [dbId];
        }
    }

    db.query(query, queryParams, async (err, results) => {
        if (err) {
            console.error('Login DB Error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            console.log(`Login failed: User not found in ${table} for input=${username}`);
            return res.status(401).json({ message: 'Invalid credentials. User not found.' });
        }

        const user = results[0];
        console.log(`Login: ${role} found:`, user.id);

        if (!user.password) {
            console.log('Login failed: User has no password set');
            return res.status(401).json({ message: 'Access denied. Account not set up.' });
        }

        // --- NEW STRICT CHECK ---
        if (table === 'admins') {
            let dbRole = 'admin'; // Default

            // Explicit Mapping
            if (user.username === 'account') dbRole = 'accountant';
            else if (user.username === 'info') dbRole = 'info_officer';

            if (role !== dbRole) {
                console.log(`Login failed: Role mismatch. User is ${dbRole} but requested ${role}`);
                return res.status(403).json({ message: `Access denied. You are not a ${role}.` });
            }
        }

        let isMatch = false;
        try {
            if (user.password.startsWith('$2b$')) {
                isMatch = await bcrypt.compare(password, user.password);
            } else {
                isMatch = (password === user.password);
            }
        } catch (e) {
            console.error('Bcrypt error:', e);
            return res.status(500).json({ error: 'Authentication error' });
        }

        if (!isMatch) {
            console.log('Login failed: Password mismatch');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username || user.name || user.email, role: role },
            process.env.JWT_SECRET || 'school',
            { expiresIn: '1h' }
        );

        res.json({ token, user: { id: user.id, role: role, name: user.name, username: user.username } });
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
    const { name, age, gender, class_id, status } = req.body;

    // Check for duplicates first
    const checkQuery = 'SELECT id FROM students WHERE name = ? AND class_id = ?';
    db.query(checkQuery, [name, class_id || null], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existing.length > 0) {
            // Already exists, return the existing ID (idempotent)
            return res.json({ message: 'Student already exists', id: existing[0].id });
        }

        const query = 'INSERT INTO students (name, age, gender, class_id, status) VALUES (?, ?, ?, ?, ?)';
        db.query(query, [name, age, gender, class_id, status || 'Enrolled'], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Student added successfully', id: results.insertId });
        });
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

// Check if phone column exists (SQLite handled via schema update usually, skipping dynamic alter for now as schema handles it)


// Public Admission Submission
app.post('/api/admissions', (req, res) => {
    const { student_name, age, class_applied_id, parent_name, phone } = req.body;

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

// Create Results Table if not exists (Handled by schema)

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
        const subjectMap = new Map();
        results.forEach(r => {
            subjectMap.set(r.subject_id, r);
        });

        res.json(Array.from(subjectMap.values()));
    });
});

// --- PAYMENT ROUTES ---

// Get All Payment Transactions (For Monthly Stats)
app.get('/api/payments/transactions', authenticateToken, (req, res) => {
    const query = 'SELECT * FROM payments ORDER BY date DESC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});


// Get Payment Summary (All Students)
app.get('/api/payments', authenticateToken, (req, res) => {
    const query = `
        SELECT 
            s.id, s.name, 
            c.name as class_name, c.term_fee,
            COALESCE(SUM(p.amount), 0) as total_paid
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN payments p ON s.id = p.student_id
        GROUP BY s.id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const summary = results.map(row => {
            const termFee = row.term_fee || 3000; // Default to 3000 if class fee missing
            const paid = row.total_paid || 0;
            const balance = termFee - paid;

            return {
                id: row.id,
                name: row.name,
                roll_no: (row.roll_no || row.id) + 2500000,
                class_name: row.class_name || '-',
                total_fees: termFee,
                paid: paid,
                balance: balance,
                status: balance <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid')
            };
        });
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

    // SQLite doesn't have MONTH() and YEAR() functions by default like MySQL
    // We need to use strftime
    if (monthIndex === 0) return res.json({ total: 0 });

    const monthStr = monthIndex.toString().padStart(2, '0');
    // Date format in DB is YYYY-MM-DD usually

    const query = `
        SELECT SUM(amount) as total 
        FROM payments 
        WHERE strftime('%m', date) = ? AND strftime('%Y', date) = ?
    `;
    db.query(query, [monthStr, year.toString()], (err, results) => {
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Network access: http://192.168.1.109:${PORT}`);
});
