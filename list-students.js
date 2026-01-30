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

    console.log('--- ALL STUDENTS ---');
    db.query('SELECT id, name, class_id FROM students', (err, students) => {
        if (err) throw err;
        students.forEach(s => {
            console.log(`ID: ${s.id} | Name: ${s.name} | Class ID: ${s.class_id}`);
        });
        db.end();
    });
});
