const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to school.db');
});

db.serialize(() => {
    // 1. Update all teachers to password 'password'
    db.run("UPDATE teachers SET password = 'password'", (err) => {
        if (err) console.error("Error updating teachers:", err.message);
        else console.log("All teachers passwords set to 'password'.");
    });

    // 2. Ensuring 'student' username works by creating a student named 'Student'
    // First check if exists
    db.get("SELECT id FROM students WHERE name = 'Student'", (err, row) => {
        if (!row) {
            // Create 'Student' user
            // Class ID 1 is 'Grade 7A' from schema
            const query = "INSERT INTO students (name, age, gender, class_id, status, password) VALUES (?, ?, ?, ?, ?, ?)";
            db.run(query, ['Student', 14, 'Male', 1, 'Enrolled', 'password'], function (err) {
                if (err) console.error("Error creating Student user:", err.message);
                else console.log("Created student named 'Student' with password 'password' (ID: " + this.lastID + ")");
            });
        } else {
            // Update password just in case
            db.run("UPDATE students SET password = 'password' WHERE id = ?", [row.id], (err) => {
                if (err) console.error("Error updating Student user:", err.message);
                else console.log("Updated 'Student' user password.");
            });
        }
    });

    // 3. Just to be safe, creating 'teacher' user in teachers table?
    // Credentials.html says: username `teacher` ... (or john.banda@school.com)
    // Server.js expects Email. 
    // If I add a teacher with email 'teacher', it might work? Or 'teacher@school.com' mapped to 'teacher'?
    // Server login query: SELECT * FROM teachers WHERE email = ? (input username)
    // So if users types 'teacher', query is WHERE email = 'teacher'. 
    // I should add a teacher with email 'teacher' to match the simple username login!
    db.get("SELECT id FROM teachers WHERE email = 'teacher'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO teachers (name, email, password, phone, status) VALUES (?, ?, ?, ?, ?)",
                ['Test Teacher', 'teacher', 'password', '0000', 'Active'], (err) => {
                    if (err) console.error("Error creating 'teacher' username support:", err.message);
                    else console.log("Created teacher with email 'teacher' to support simple username login.");
                });
        } else {
            db.run("UPDATE teachers SET password = 'password' WHERE email = 'teacher'", (err) => {
                if (err) console.error("Error updating 'teacher' user:", err.message);
                else console.log("Updated 'teacher' user password.");
            });
        }
    });

});
