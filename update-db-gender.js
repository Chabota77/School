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
    console.log('Connected to DB');

    // Add gender column if it doesn't exist
    const query = "ALTER TABLE students ADD COLUMN gender ENUM('Male', 'Female') DEFAULT NULL AFTER age";

    db.query(query, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column "gender" already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Column "gender" added successfully.');
        }
        db.end();
    });
});
