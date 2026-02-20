const express = require('express');
const { Pool } = require('pg');
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

// --- DATABASE CONNECTION (PostgreSQL) ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.connect((err) => {
    if (err) {
        console.error('DB Connection Error:', err.message);
        console.log('HINT: Set DATABASE_URL in .env to a valid PostgreSQL connection.');
    } else {
        console.log('Connected to PostgreSQL (Normalized Schema)');
    }
});

// Helper for Transactions
const db = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect()
};

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'school', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- API ROUTES ---

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        // Find user by email (username) OR roll_number (if student)
        let result = await db.query('SELECT * FROM users WHERE email = $1', [username]);

        if (result.rows.length === 0) {
            // If email not found, check if it's a Roll Number (for students)
            // Join users and students where roll_number matches
            const rollQuery = `
                SELECT u.* 
                FROM users u
                JOIN students s ON u.id = s.user_id
                WHERE s.roll_number = $1
            `;
            result = await db.query(rollQuery, [username]);
        }

        if (result.rows.length === 0) return res.status(401).json({ message: 'User not found' });

        const user = result.rows[0];

        // Verify Password
        if (!await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify Role (Optional strict check)
        if (role && user.role !== role) {
            // Allow admin to bypass strict role check? 
            // For now, enforce strict role unless admin logging into related portal?
            // Let's stick to strict to match "Prevent logging into other role dashboards"
            // EXCEPT: Admin might use 'account' or 'info' pseudo-users. 
            // Schema has specific users for 'admin' role. 
            // If the user in DB is 'admin', allow.
            if (user.role !== role && !(user.role === 'admin')) {
                return res.status(403).json({ message: `Access denied. Role mismatch (${role} vs ${user.role})` });
            }
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            process.env.JWT_SECRET || 'school',
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. TEACHERS
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT t.id, u.name, u.email, t.phone, u.status, u.role, t.user_id,
                   t.address, t.created_at,
                   string_agg(DISTINCT c.name, ', ') as class_names,
                   string_agg(DISTINCT s.name, ', ') as subject_names
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN teacher_assignments ta ON t.id = ta.teacher_id
            LEFT JOIN classes c ON ta.class_id = c.id
            LEFT JOIN subjects s ON ta.subject_id = s.id
            GROUP BY t.id, u.id
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/teachers/:id', authenticateToken, async (req, res) => {
    try {
        // Support querying by Teacher ID or User ID? 
        // Frontend sends User ID usually?? No, frontend sends Teacher ID usually for details.
        // But dashboard uses User ID.
        // Let's try matching Teacher ID first.
        const query = `
            SELECT t.id, u.name, u.email, t.phone, u.status, u.role, t.user_id,
                   t.address, t.created_at
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            WHERE t.user_id = $1 OR t.id = $1
        `;
        const { rows } = await db.query(query, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Teacher not found' });

        // Fetch arrays (Classes/Subjects)
        const assignmentQuery = `
            SELECT c.id as class_id, c.name as class_name, s.id as subject_id, s.name as subject_name
            FROM teacher_assignments ta
            LEFT JOIN classes c ON ta.class_id = c.id
            LEFT JOIN subjects s ON ta.subject_id = s.id
            WHERE ta.teacher_id = $1
        `;
        const assignments = await db.query(assignmentQuery, [rows[0].id]);

        const teacher = rows[0];
        teacher.classIds = assignments.rows.map(a => a.class_id).filter(Boolean);
        teacher.subjectIds = assignments.rows.map(a => a.subject_id).filter(Boolean);
        teacher.className = assignments.rows[0]?.class_name; // Legacy support

        res.json(teacher);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/teacher/students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.sendStatus(403);
    try {
        const query = `
            SELECT s.id, s.roll_number, u.name, s.gender, c.name as class_name, s.class_id
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN teacher_assignments ta ON s.class_id = ta.class_id
            JOIN teachers t ON ta.teacher_id = t.id
            WHERE t.user_id = $1
            ORDER BY c.name, u.name
        `;
        const { rows } = await db.query(query, [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 14. PAYMENTS
app.get('/api/payments', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, u.name as student_name, s.roll_number 
            FROM payments p
            JOIN students s ON p.student_id = s.id
            JOIN users u ON s.user_id = u.id
            ORDER BY p.date DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
    // Destructure student_id (snake_case from frontend) or studentId (camelCase fallback)
    const { student_id, studentId, amount, date, method, year, term } = req.body;
    // Use the one that is defined
    const sid = student_id || studentId;

    try {
        // We need 'term' and 'year' in schema. 
        // Schema: student_id, amount, term, year, method, date

        // Frontend 'studentId' is likely the UUID/Integer ID from the student object.
        // Let's ensure it matches the 'students' table ID.

        const { rows } = await db.query(
            'INSERT INTO payments (student_id, amount, date, method, year, term) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [sid, amount, date, method, year || new Date().getFullYear(), term || 'Term 1']
        );
        res.json({ message: 'Payment recorded', id: rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/payments/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { amount, date, method, term, year } = req.body;
    try {
        await db.query(
            'UPDATE payments SET amount = $1, date = $2, method = $3, term = $4, year = $5 WHERE id = $6',
            [amount, date, method, term || 'Term 1', year || new Date().getFullYear(), id]
        );
        res.json({ message: 'Payment updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
    const { name, email, password, phone, status, class_id, subject_id } = req.body;
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // 1. Create User
        // Check for existing email (Duplication Check)
        // Check for existing email (Duplication Check)
        const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        let teacherEmail = email;
        if (emailCheck.rows.length > 0) {
            // Auto-resolve: Append timestamp
            const prefix = email.split('@')[0];
            const domain = email.split('@')[1] || 'school.com';
            teacherEmail = `${prefix}_${Date.now()}@${domain}`;
        }

        const passwordHash = await bcrypt.hash(password || 'teacher123', 10);
        const userRes = await client.query(
            'INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, teacherEmail, passwordHash, 'teacher', status || 'Active']
        );
        const userId = userRes.rows[0].id;

        // 2. Create Profile
        const teacherRes = await client.query(
            'INSERT INTO teachers (user_id, phone) VALUES ($1, $2) RETURNING id',
            [userId, phone]
        );
        const teacherId = teacherRes.rows[0].id;

        // 3. Assign
        if (class_id && subject_id) {
            await client.query(
                'INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES ($1, $2, $3)',
                [teacherId, class_id, subject_id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Teacher created successfully', id: teacherId, userId });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 3. STUDENTS
app.get('/api/student/profile', authenticateToken, async (req, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    try {
        const query = `
            SELECT s.id, s.roll_number, s.age, s.gender, s.class_id, u.name, u.email, u.status, c.name as class_name
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.user_id = $1
        `;
        const { rows } = await db.query(query, [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Profile not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT s.*, u.name, u.email, u.status, c.name as class_name
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN classes c ON s.class_id = c.id
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/students', authenticateToken, async (req, res) => {
    const { name, email, password, age, gender, class_id, status } = req.body;
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // Email is tricky for students without email? Generate mock?
        // Schema says email UNIQUE NOT NULL.
        // If not provided, generate logic: studentID@school.com?
        // Logic: Check if email exists or mock it.
        const studentEmail = email || `student${Date.now()}@school.com`;

        // Check for existing email (Duplication Check)
        const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [studentEmail]);
        if (emailCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Email already exists' });
        }

        const passwordHash = await bcrypt.hash(password || 'student123', 10);

        const userRes = await client.query(
            'INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, studentEmail, passwordHash, 'student', status || 'Enrolled']
        );
        const userId = userRes.rows[0].id;

        // Generate Roll Number (260001 format)
        const maxRes = await client.query("SELECT MAX(roll_number) as max_roll FROM students WHERE roll_number LIKE '26%'");
        let nextNum = 1;
        if (maxRes.rows[0].max_roll) {
            const lastNum = parseInt(maxRes.rows[0].max_roll.replace(/^26/, '')) || 0;
            nextNum = lastNum + 1;
        }
        const rollNumber = `26${nextNum.toString().padStart(4, '0')}`;

        const studentRes = await client.query(
            'INSERT INTO students (user_id, age, gender, class_id, roll_number, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [userId, age, gender, class_id, rollNumber, status || 'Enrolled']
        );

        await client.query('COMMIT');
        res.json({ message: 'Student created', id: studentRes.rows[0].id });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 3. STUDENTS (continued)
app.put('/api/students/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, age, gender, class_id, status } = req.body;
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // Check exists
        const sRes = await client.query('SELECT user_id FROM students WHERE id = $1', [id]);
        if (sRes.rows.length === 0) return res.status(404).json({ message: 'Student not found' });
        const userId = sRes.rows[0].user_id;

        // Update User (Name, Status)
        if (req.body.password && req.body.password.trim() !== '') {
            const passwordHash = await bcrypt.hash(req.body.password, 10);
            await client.query('UPDATE users SET name = $1, status = $2, password_hash = $3 WHERE id = $4', [name, status, passwordHash, userId]);
        } else {
            await client.query('UPDATE users SET name = $1, status = $2 WHERE id = $3', [name, status, userId]);
        }

        // Update Student (Age, Gender, Class)
        await client.query(
            'UPDATE students SET age = $1, gender = $2, class_id = $3, status = $4 WHERE id = $5',
            [age, gender, class_id, status, id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Student updated' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Get User ID
        const sRes = await client.query('SELECT user_id FROM students WHERE id = $1', [id]);
        if (sRes.rows.length > 0) {
            const userId = sRes.rows[0].user_id;

            // Delete payments first (FK constraint)
            await client.query('DELETE FROM payments WHERE student_id = $1', [id]);

            // Delete Student (Cascades usually, but explicit is safer if no cascade on user delete)
            await client.query('DELETE FROM students WHERE id = $1', [id]);

            // Delete User
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Student deleted' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});
app.get('/api/admissions', authenticateToken, async (req, res) => {
    try {
        // Admissions is a standalone table until approved
        const query = `
            SELECT a.*, c.name as class_name
            FROM admissions a
            LEFT JOIN classes c ON a.class_applied_id = c.id
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admissions', async (req, res) => {
    const { student_name, age, gender, class_applied_id, parent_name, phone, email } = req.body;
    try {
        // Check for duplicate pending admission
        const dupCheck = await db.query(
            "SELECT id FROM admissions WHERE student_name = $1 AND class_applied_id = $2 AND status = 'Pending'",
            [student_name, class_applied_id]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Application already exists for this student and class' });
        }

        await db.query(
            'INSERT INTO admissions (student_name, age, gender, class_applied_id, parent_name, phone, email) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [student_name, age, gender, class_applied_id, parent_name, phone, email]
        );
        res.json({ message: 'Application submitted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admissions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // Update Status
        await client.query('UPDATE admissions SET status = $1 WHERE id = $2', [status, id]);

        if (status === 'Approved') {
            const admRes = await client.query('SELECT * FROM admissions WHERE id = $1', [id]);
            const admission = admRes.rows[0];

            // Create Student User
            let email = admission.email || `student${admission.id}@school.com`;

            // Check if email exists
            const existingUser = await client.query("SELECT id FROM users WHERE email = $1", [email]);
            if (existingUser.rows.length > 0) {
                // Email collision: Append timestamp to make unique
                const prefix = email.split('@')[0];
                const domain = email.split('@')[1] || 'school.com';
                email = `${prefix}_${Date.now()}@${domain}`;
            }

            const passwordHash = await bcrypt.hash('student123', 10);

            const userRes = await client.query(
                'INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [admission.student_name, email, passwordHash, 'student', 'Enrolled']
            );

            // Generate Roll Number (260001 format)
            const maxRes = await client.query("SELECT MAX(roll_number) as max_roll FROM students WHERE roll_number LIKE '26%'");
            let nextNum = 1;
            if (maxRes.rows[0].max_roll) {
                const lastNum = parseInt(maxRes.rows[0].max_roll.replace(/^26/, '')) || 0;
                nextNum = lastNum + 1;
            }
            const rollNumber = `26${nextNum.toString().padStart(4, '0')}`;

            // Create Student Profile
            await client.query(
                'INSERT INTO students (user_id, age, gender, class_id, roll_number, status) VALUES ($1, $2, $3, $4, $5, $6)',
                [userRes.rows[0].id, admission.age, admission.gender, admission.class_applied_id, rollNumber, 'Enrolled']
            );
        }

        await client.query('COMMIT');
        res.json({ message: `Admission ${status}` });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 5. ANNOUNCEMENTS
app.get('/api/announcements', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM announcements ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/announcements', authenticateToken, async (req, res) => {
    const { title, content, audience } = req.body;
    try {
        const { rows } = await db.query(
            'INSERT INTO announcements (title, content, audience) VALUES ($1, $2, $3) RETURNING id',
            [title, content, audience]
        );
        res.json({ message: 'Posted', id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. CLASSES & SUBJECTS
app.get('/api/classes', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM classes');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/subjects', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM subjects');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. STATS
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const r1 = await db.query("SELECT COUNT(*) as c FROM users WHERE role='student'");
        const r2 = await db.query("SELECT COUNT(*) as c FROM users WHERE role='teacher'");
        const r3 = await db.query("SELECT COUNT(*) as c FROM admissions WHERE status='Pending'");

        res.json({
            totalStudents: parseInt(r1.rows[0].c),
            totalTeachers: parseInt(r2.rows[0].c),
            newAdmissions: parseInt(r3.rows[0].c),
            pendingMessages: 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 14. PAYMENTS (continued)
// 14. PAYMENTS (continued)
// Get Payments for a specific student (History)
app.get('/api/payments/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const result = await db.query(`
            SELECT p.*, u.name as student_name 
            FROM payments p
            JOIN students s ON p.student_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE p.student_id = $1
            ORDER BY p.date DESC
        `, [studentId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
});

app.delete('/api/payments/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
        res.json({ message: 'Payment deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REPORTS ---
app.get('/api/reports/summary', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const studentCount = await db.query('SELECT COUNT(*) FROM students');
        const teacherCount = await db.query('SELECT COUNT(*) FROM teachers');
        const admissionCount = await db.query("SELECT COUNT(*) FROM admissions WHERE status = 'Pending'");

        const classCounts = await db.query(`
            SELECT c.name, COUNT(s.id) as count
            FROM classes c
            LEFT JOIN students s ON c.id = s.class_id
            GROUP BY c.id, c.name
            ORDER BY c.name
        `);

        res.json({
            totalStudents: parseInt(studentCount.rows[0].count),
            totalTeachers: parseInt(teacherCount.rows[0].count),
            pendingAdmissions: parseInt(admissionCount.rows[0].count),
            classCounts: classCounts.rows.map(r => ({ name: r.name, count: parseInt(r.count) }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RESULTS MANAGEMENT ---
app.get('/api/results/publish', authenticateToken, async (req, res) => {
    // Both admins and students need to check if published
    const { year, term } = req.query;
    try {
        const { rows } = await db.query(
            'SELECT is_published FROM published_results WHERE year = $1 AND term = $2',
            [year, term]
        );
        res.json({ isPublished: rows.length > 0 ? rows[0].is_published : false });
    } catch (err) {
        if (err.code === '42P01') {
            // Table doesn't exist yet, we handle gracefully
            res.json({ isPublished: false });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/api/results/publish', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { year, term, isPublished } = req.body;
    try {
        // Ensure table exists (simple migration for this fix without needing separate script run)
        await db.query(`
            CREATE TABLE IF NOT EXISTS published_results (
                id SERIAL PRIMARY KEY,
                year INTEGER NOT NULL,
                term VARCHAR(50) NOT NULL,
                is_published BOOLEAN DEFAULT false,
                UNIQUE(year, term)
            )
        `);

        await db.query(`
            INSERT INTO published_results (year, term, is_published) 
            VALUES ($1, $2, $3)
            ON CONFLICT (year, term) 
            DO UPDATE SET is_published = EXCLUDED.is_published
        `, [year, term, isPublished]);

        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RESULTS ---
app.get('/api/results', authenticateToken, async (req, res) => {
    const { year, term } = req.query;
    try {
        let query = `
            SELECT r.*, s.name as subject_name 
            FROM results r
            LEFT JOIN subjects s ON r.subject_id = s.id
        `;
        const params = [];
        let whereClauses = [];

        if (year && term) {
            whereClauses.push(`r.year = $${params.length + 1} AND r.term = $${params.length + 2}`);
            params.push(year, term);
        }

        if (req.user.role === 'student') {
            const studentRes = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
            if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student record not found' });

            whereClauses.push(`r.student_id = $${params.length + 1}`);
            params.push(studentRes.rows[0].id);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/results', authenticateToken, async (req, res) => {
    const { results } = req.body; // Array of { studentId, subjectId, marks, comments, year, term }
    if (!results || !Array.isArray(results)) return res.status(400).json({ message: 'Invalid payload' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        for (const r of results) {
            // Check if exists
            const existing = await client.query(
                'SELECT id FROM results WHERE student_id = $1 AND subject_id = $2 AND year = $3 AND term = $4',
                [r.studentId, r.subjectId, r.year, r.term]
            );

            if (existing.rows.length > 0) {
                // Update
                await client.query(
                    'UPDATE results SET marks = $1, comments = $2, updated_at = NOW() WHERE id = $3',
                    [r.marks, r.comments || '', existing.rows[0].id]
                );
            } else {
                // Insert
                await client.query(
                    'INSERT INTO results (student_id, subject_id, marks, comments, term, year) VALUES ($1, $2, $3, $4, $5, $6)',
                    [r.studentId, r.subjectId, r.marks, r.comments || '', r.term, r.year]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Results saved successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 5. ANNOUNCEMENTS (continued)
app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
        res.json({ message: 'Announcement deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. TEACHERS (continued)
app.put('/api/teachers/:id', authenticateToken, async (req, res) => {
    // ... (Existing PUT code) ...
    const { id } = req.params;
    const { name, email, phone, status, class_id, subject_id, password } = req.body;
    const client = await db.getClient();

    try {
        await client.query('BEGIN');
        const tRes = await client.query('SELECT user_id FROM teachers WHERE id = $1', [id]);
        if (tRes.rows.length === 0) return res.status(404).json({ message: 'Teacher not found' });
        const userId = tRes.rows[0].user_id;

        // Update User (Optionally Update Password)
        if (password && password.trim() !== '') {
            const passwordHash = await bcrypt.hash(password, 10);
            await client.query('UPDATE users SET name = $1, email = $2, status = $3, password_hash = $4 WHERE id = $5', [name, email, status, passwordHash, userId]);
        } else {
            await client.query('UPDATE users SET name = $1, email = $2, status = $3 WHERE id = $4', [name, email, status, userId]);
        }

        // Update Teacher Info
        await client.query('UPDATE teachers SET phone = $1 WHERE id = $2', [phone, id]);

        // Update Assignments
        // First delete existing assignments for THIS teacher
        await client.query('DELETE FROM teacher_assignments WHERE teacher_id = $1', [id]);

        // Insert new assignment if provided
        if (class_id && subject_id) {
            await client.query(
                'INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES ($1, $2, $3)',
                [id, class_id, subject_id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Teacher updated' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/teachers/:id', authenticateToken, async (req, res) => {
    // ... (Existing DELETE code) ...
    const { id } = req.params;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const tRes = await client.query('SELECT user_id FROM teachers WHERE id = $1', [id]);
        if (tRes.rows.length > 0) {
            const userId = tRes.rows[0].user_id;
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
        }
        await client.query('COMMIT');
        res.json({ message: 'Teacher deleted' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// --- PUBLIC ROUTES (No Auth Required) ---
app.get('/api/public/stats', async (req, res) => {
    try {
        const studentCount = await db.query('SELECT COUNT(*) FROM students');
        const teacherCount = await db.query('SELECT COUNT(*) FROM teachers');
        res.json({
            totalStudents: parseInt(studentCount.rows[0].count),
            totalTeachers: parseInt(teacherCount.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/public/results', async (req, res) => {
    const { studentId, name, termStr } = req.body;
    // year is hardcoded to 2026 for now in app.js
    const year = 2026;
    try {
        // check publish status
        const pubRes = await db.query('SELECT is_published FROM published_results WHERE year = $1 AND term = $2', [year, termStr]);
        if (pubRes.rows.length === 0 || !pubRes.rows[0].is_published) {
            return res.status(403).json({ isPublished: false });
        }

        // Find student
        let studentQuery = 'SELECT s.id, s.roll_number, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE ';
        let params = [];
        if (studentId) {
            studentQuery += 's.id = $1 OR s.roll_number = $1';
            params.push(studentId);
        } else if (name) {
            studentQuery += 'LOWER(u.name) LIKE $1';
            params.push(`%${name.toLowerCase()}%`);
        } else {
            return res.status(400).json({ error: "No search criteria" });
        }

        const studentRes = await db.query(studentQuery, params);
        if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

        const student = studentRes.rows[0];

        // Find results
        const resultsRes = await db.query(`
            SELECT r.*, sub.name as subject_name 
            FROM results r
            LEFT JOIN subjects sub ON r.subject_id = sub.id
            WHERE r.student_id = $1 AND r.year = $2 AND r.term = $3
        `, [student.id, year, termStr]);

        const resultsMap = {};
        resultsRes.rows.forEach(r => {
            resultsMap[r.subject_name || 'Unknown'] = r.marks;
        });

        res.json({
            isPublished: true,
            student: { id: student.id, name: student.name, roll_number: student.roll_number },
            results: resultsMap
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STARTUP MIGRATION: Ensure 'gender' column exists in admissions
(async () => {
    try {
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admissions' AND column_name='gender') THEN 
                    ALTER TABLE admissions ADD COLUMN gender VARCHAR(20); 
                END IF; 
            END $$;
        `);
        console.log("Migration: Checked 'gender' column in admissions.");
    } catch (e) { console.error("Migration Error:", e.message); }
})();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
