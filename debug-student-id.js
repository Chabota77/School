const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) throw err;

    // Get a student with results (or just a student)
    db.query('SELECT * FROM students LIMIT 1', (err, students) => {
        if (err) throw err;
        if (students.length > 0) {
            console.log('Test Student Credentials:');
            console.log(`ID: ${students[0].id}`);
            console.log(`Name: ${students[0].name}`);
        } else {
            console.log('No students found.');
        }
        db.end();
    });
});
