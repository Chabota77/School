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
        // Find user by email (username)
        const result = await db.query('SELECT * FROM users WHERE email = $1', [username]);
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
                   t.address, t.created_at
            FROM teachers t
            JOIN users u ON t.user_id = u.id
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
    const { studentId, amount, date, method, year, term } = req.body;
    try {
        // We need 'term' and 'year' in schema. 
        // Schema: student_id, amount, term, year, method, date

        // Frontend 'studentId' is likely the UUID/Integer ID from the student object.
        // Let's ensure it matches the 'students' table ID.

        const { rows } = await db.query(
            'INSERT INTO payments (student_id, amount, date, method, year, term) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [studentId, amount, date, method, year || new Date().getFullYear(), term || 'Term 1']
        );
        res.json({ message: 'Payment recorded', id: rows[0].id });
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
        const passwordHash = await bcrypt.hash(password || 'teacher123', 10);
        const userRes = await client.query(
            'INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, email, passwordHash, 'teacher', status || 'Active']
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

        const passwordHash = await bcrypt.hash(password || 'student123', 10);

        const userRes = await client.query(
            'INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, studentEmail, passwordHash, 'student', status || 'Enrolled']
        );
        const userId = userRes.rows[0].id;

        const studentRes = await client.query(
            'INSERT INTO students (user_id, age, gender, class_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [userId, age, gender, class_id, status || 'Enrolled']
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

// 4. ADMISSIONS
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
    const { student_name, age, class_applied_id, parent_name, phone, email } = req.body;
    try {
        await db.query(
            'INSERT INTO admissions (student_name, age, class_applied_id, parent_name, phone, email) VALUES ($1, $2, $3, $4, $5, $6)',
            [student_name, age, class_applied_id, parent_name, phone, email]
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
            const ALLOWED_ROLES = ['admin', 'teacher', 'student', 'parent', 'accountant', 'info_officer'];
            const email = admission.email || `student${admission.id}@school.com`;
            const passwordHash = await bcrypt.hash('student123', 10);

            const userRes = await client.query(
                'INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [admission.student_name, email, passwordHash, 'student', 'Enrolled']
            );

            // Create Student Profile
            await client.query(
                'INSERT INTO students (user_id, age, class_id, status) VALUES ($1, $2, $3, $4)',
                [userRes.rows[0].id, admission.age, admission.class_applied_id, 'Enrolled']
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
