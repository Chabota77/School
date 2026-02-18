-- PostgreSQL Schema

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    term_fee DECIMAL(10,2) DEFAULT 3000.00
);

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT 'teacher123',
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher Assignments
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER,
    class_id INTEGER,
    subject_id INTEGER,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    gender VARCHAR(50),
    class_id INTEGER,
    status VARCHAR(50) DEFAULT 'Enrolled',
    password VARCHAR(255) DEFAULT '$2b$10$98MznwcuzPKhZCSSut7EWe6/dVL2RyCgFgusKsqMWYHgh/q2co9YW', -- default: student123
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- Admissions Table
CREATE TABLE IF NOT EXISTS admissions (
    id SERIAL PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    age INTEGER,
    class_applied_id INTEGER,
    parent_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Pending',
    date_applied TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_applied_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    audience VARCHAR(50) DEFAULT 'Everyone',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_type VARCHAR(50),
    sender_id INTEGER,
    receiver_type VARCHAR(50),
    receiver_id INTEGER,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Results Table
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    student_id INTEGER,
    subject_id INTEGER,
    marks INTEGER,
    comments TEXT,
    term VARCHAR(50) DEFAULT 'Term 1',
    year INTEGER DEFAULT 2026,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER,
    amount DECIMAL(10,2),
    date DATE,
    term VARCHAR(50),
    year INTEGER,
    method VARCHAR(50) DEFAULT 'Cash',
    received_by VARCHAR(255) DEFAULT 'Admin',
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- SEED DATA -------------------------------------------------------------

-- Classes
INSERT INTO classes (name) VALUES ('Grade 7A') ON CONFLICT DO NOTHING;
INSERT INTO classes (name) VALUES ('Grade 7B') ON CONFLICT DO NOTHING;
INSERT INTO classes (name) VALUES ('Grade 8A') ON CONFLICT DO NOTHING;
INSERT INTO classes (name) VALUES ('Grade 9B') ON CONFLICT DO NOTHING;

-- Subjects
INSERT INTO subjects (name) VALUES ('Mathematics') ON CONFLICT DO NOTHING;
INSERT INTO subjects (name) VALUES ('English') ON CONFLICT DO NOTHING;
INSERT INTO subjects (name) VALUES ('Science') ON CONFLICT DO NOTHING;
INSERT INTO subjects (name) VALUES ('Social Studies') ON CONFLICT DO NOTHING;

-- Admin (password: admin123 hashed)
    'admin',
    '$2b$10$1Cjxd/hYi0C1at6HQkFCP.TO8nENMJF6Rh21VSmRel41Wa7mrfI2O', 
    'admin@school.com'
) ON CONFLICT DO NOTHING;

-- Accountant (password: password)
INSERT INTO admins (username, password, email) VALUES (
    'account',
    '$2b$10$1Cjxd/hYi0C1at6HQkFCP.TO8nENMJF6Rh21VSmRel41Wa7mrfI2O', 
    'account@school.com'
) ON CONFLICT DO NOTHING;

-- Information Officer (password: password)
INSERT INTO admins (username, password, email) VALUES (
    'info',
    '$2b$10$1Cjxd/hYi0C1at6HQkFCP.TO8nENMJF6Rh21VSmRel41Wa7mrfI2O', 
    'info@school.com'
) ON CONFLICT DO NOTHING;

-- Teachers
INSERT INTO teachers (name, email, phone, status, password) VALUES (
    'Mr. John Banda', 'john.banda@school.com', '+260123456789', 'Active',
    '$2b$10$NEmd5A13ZoHXS6EzyBV/fe1r.AZlCamKyqawSO.ke1.8ey9FNx7GW'
) ON CONFLICT DO NOTHING;

INSERT INTO teachers (name, email, phone, status, password) VALUES (
    'Ms. Ruth Mwila', 'ruth.mwila@school.com', '+260987654321', 'On Leave',
    '$2b$10$NEmd5A13ZoHXS6EzyBV/fe1r.AZlCamKyqawSO.ke1.8ey9FNx7GW'
) ON CONFLICT DO NOTHING;

-- Teacher Assignments
INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (2, 4, 2) ON CONFLICT DO NOTHING;

-- Admissions
INSERT INTO admissions (student_name, age, class_applied_id, parent_name, email) VALUES (
    'John Doe', 12, 1, 'Mary Doe', 'mary.doe@example.com'
) ON CONFLICT DO NOTHING;
