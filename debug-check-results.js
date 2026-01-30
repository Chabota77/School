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

    console.log('--- CHECKING RESULTS ---');
    // Check results for Student ID 1
    db.query('SELECT * FROM results WHERE student_id = 1', (err, results) => {
        if (err) throw err;
        console.log(`Results found for Student ID 1: ${results.length}`);
        results.forEach(r => {
            console.log(r);
        });

        // Also check student details to ensure name match
        db.query('SELECT * FROM students WHERE id = 1', (err, students) => {
            if (students.length > 0) {
                console.log('Student Database Record:', students[0]);
            }
            db.end();
        });
    });
});
