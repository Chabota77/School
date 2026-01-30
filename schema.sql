CREATE DATABASE IF NOT EXISTS school_db;
USE school_db;
-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);
-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);
-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT 'teacher123',
    -- Default password for existing teachers
    phone VARCHAR(20),
    status ENUM('Active', 'On Leave') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Teacher Assignments (Mapping Teachers to Classes and Subjects)
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT,
    class_id INT,
    subject_id INT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE
    SET NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE
    SET NULL
);
-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    class_id INT,
    status ENUM('Enrolled', 'Graduated', 'Withdrawn') DEFAULT 'Enrolled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE
    SET NULL
);
-- Admissions Table
CREATE TABLE IF NOT EXISTS admissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL,
    age INT,
    class_applied_id INT,
    parent_name VARCHAR(100),
    email VARCHAR(100),
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    date_applied TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_applied_id) REFERENCES classes(id) ON DELETE
    SET NULL
);
-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    audience ENUM('Everyone', 'Teachers', 'Students') DEFAULT 'Everyone',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_type ENUM('Admin', 'Teacher', 'Student'),
    sender_id INT,
    receiver_type ENUM('Admin', 'Teacher', 'Student'),
    receiver_id INT,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Sample Data
INSERT INTO classes (name)
VALUES ('Grade 7A'),
    ('Grade 7B'),
    ('Grade 8A'),
    ('Grade 9B');
INSERT INTO subjects (name)
VALUES ('Mathematics'),
    ('English'),
    ('Science'),
    ('Social Studies');
-- Sample Admin (password: admin123 - hashed would be better but for sample data we can use plain or hash later)
-- For now, let's assume we'll hash it in the server.
INSERT INTO admins (username, password, email)
VALUES (
        'admin',
        '$2b$10$YourHashedPasswordHere',
        'admin@school.com'
    );
-- Sample Teachers
INSERT INTO teachers (name, email, phone, status)
VALUES (
        'Mr. John Banda',
        'john.banda@school.com',
        '+260123456789',
        'Active'
    );
INSERT INTO teachers (name, email, phone, status)
VALUES (
        'Ms. Ruth Mwila',
        'ruth.mwila@school.com',
        '+260987654321',
        'On Leave'
    );
-- Sample Assignments
INSERT INTO teacher_assignments (teacher_id, class_id, subject_id)
VALUES (1, 1, 1);
INSERT INTO teacher_assignments (teacher_id, class_id, subject_id)
VALUES (2, 4, 2);
-- Sample Admissions
INSERT INTO admissions (
        student_name,
        age,
        class_applied_id,
        parent_name,
        email
    )
VALUES (
        'John Doe',
        12,
        1,
        'Mary Doe',
        'mary.doe@example.com'
    );
INSERT INTO admissions (
        student_name,
        age,
        class_applied_id,
        parent_name,
        email
    )
VALUES (
        'Jane Smith',
        10,
        2,
        'Robert Smith',
        'robert.smith@example.com'
    );