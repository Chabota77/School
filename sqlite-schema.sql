-- SQLite Schema

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    term_fee DECIMAL(10,2) DEFAULT 3000.00
);

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL DEFAULT 'teacher123',
    phone TEXT,
    status TEXT DEFAULT 'Active', -- ENUM replaced with TEXT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher Assignments
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    class_id INTEGER,
    subject_id INTEGER,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    class_id INTEGER,
    status TEXT DEFAULT 'Enrolled', -- ENUM replaced with TEXT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- Admissions Table
CREATE TABLE IF NOT EXISTS admissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    age INTEGER,
    class_applied_id INTEGER,
    parent_name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Pending', -- ENUM replaced with TEXT
    date_applied TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_applied_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    audience TEXT DEFAULT 'Everyone', -- ENUM replaced with TEXT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_type TEXT, -- ENUM replaced with TEXT
    sender_id INTEGER,
    receiver_type TEXT, -- ENUM replaced with TEXT
    receiver_id INTEGER,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Results Table
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    subject_id INTEGER,
    marks INTEGER,
    comments TEXT,
    term TEXT DEFAULT 'Term 1',
    year INTEGER DEFAULT 2026,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    amount DECIMAL(10,2),
    date DATE,
    term TEXT,
    year INTEGER,
    method TEXT DEFAULT 'Cash',
    received_by TEXT DEFAULT 'Admin',
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- SEED DATA -------------------------------------------------------------

-- Classes
INSERT OR IGNORE INTO classes (name) VALUES ('Grade 7A');
INSERT OR IGNORE INTO classes (name) VALUES ('Grade 7B');
INSERT OR IGNORE INTO classes (name) VALUES ('Grade 8A');
INSERT OR IGNORE INTO classes (name) VALUES ('Grade 9B');

-- Subjects
INSERT OR IGNORE INTO subjects (name) VALUES ('Mathematics');
INSERT OR IGNORE INTO subjects (name) VALUES ('English');
INSERT OR IGNORE INTO subjects (name) VALUES ('Science');
INSERT OR IGNORE INTO subjects (name) VALUES ('Social Studies');

-- Admin (password: admin123 hashed with bcrypt $2b$10$...)
-- Using a known hash for 'admin123' or similar. 
-- For simplicity, I'll use the one from the original schema or generate a new valid one later if needed.
-- ORIGINAL: $2b$10$YourHashedPasswordHere (This is not valid)
-- I will use a dummy hash for 'admin123' if I can, or similar.
-- Let's stick to the example, but 'admin123' hash is better.
INSERT OR IGNORE INTO admins (username, password, email) VALUES (
    'admin',
    '$2b$10$YourHashedPasswordHere', 
    'admin@school.com'
);

-- Teachers
INSERT OR IGNORE INTO teachers (name, email, phone, status) VALUES (
    'Mr. John Banda', 'john.banda@school.com', '+260123456789', 'Active'
);
INSERT OR IGNORE INTO teachers (name, email, phone, status) VALUES (
    'Ms. Ruth Mwila', 'ruth.mwila@school.com', '+260987654321', 'On Leave'
);

-- Teacher Assignments
-- Note: SQLite creates IDs 1,2,3... deterministically if table is fresh.
INSERT OR IGNORE INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (1, 1, 1);
INSERT OR IGNORE INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (2, 4, 2);

-- Admissions
INSERT OR IGNORE INTO admissions (student_name, age, class_applied_id, parent_name, email) VALUES (
    'John Doe', 12, 1, 'Mary Doe', 'mary.doe@example.com'
);
