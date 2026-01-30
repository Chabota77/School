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
    if (err) {
        console.error('Connection failed:', err);
        return;
    }
    console.log('Connected to MySQL.');

    // Check if students already exist
    db.query('SELECT COUNT(*) as count FROM students', (err, results) => {
        if (err) {
            console.error(err);
            db.end();
            return;
        }

        if (results[0].count > 0) {
            console.log('Students already exist. Skipping seed.');
            db.end();
            return;
        }

        console.log('Seeding students...');
        const query = 'INSERT INTO students (name, age, class_id, status) VALUES ?';
        const values = [
            ['John Banda', 13, 1, 'Enrolled'],
            ['Mary Mwila', 12, 1, 'Enrolled'],
            ['Peter Phiri', 14, 2, 'Enrolled']
        ];

        db.query(query, [values], (err, res) => {
            if (err) console.error(err);
            else console.log(`Added ${res.affectedRows} students.`);
            db.end();
        });
    });
});
