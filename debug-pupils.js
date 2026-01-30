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
    console.log('Connected to DB');

    const email = 'john.banda@school.com';

    // 1. Get Teacher ID
    db.query('SELECT * FROM teachers WHERE email = ?', [email], (err, teachers) => {
        if (err) return console.error(err);
        if (teachers.length === 0) return console.log('Teacher not found');

        const teacher = teachers[0];
        console.log(`Teacher: ${teacher.name} (ID: ${teacher.id})`);

        // 2. Get Assignments
        db.query(`
            SELECT ta.*, c.name as class_name 
            FROM teacher_assignments ta
            JOIN classes c ON ta.class_id = c.id
            WHERE ta.teacher_id = ?
        `, [teacher.id], (err, assignments) => {
            if (err) return console.error(err);
            console.log(`Assignments: ${assignments.length}`);
            assignments.forEach(a => console.log(` - Class: ${a.class_name} (ID: ${a.class_id})`));

            // 3. Get Students in those classes
            const classIds = assignments.map(a => a.class_id);
            if (classIds.length > 0) {
                db.query(`SELECT * FROM students WHERE class_id IN (?)`, [classIds], (err, students) => {
                    if (err) return console.error(err);
                    console.log(`Students found: ${students.length}`);
                    students.forEach(s => console.log(` - ${s.name} (Class ID: ${s.class_id})`));
                    db.end();
                });
            } else {
                console.log('No classes assigned.');
                db.end();
            }
        });
    });
});
