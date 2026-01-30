const mysql = require('mysql2');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(async (err) => {
    if (err) {
        console.error('Connection failed:', err);
        return;
    }
    console.log('Connected to MySQL.');

    try {
        // Add password column if it doesn't exist
        await new Promise((resolve, reject) => {
            db.query("SHOW COLUMNS FROM teachers LIKE 'password'", (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) {
                    console.log('Adding password column...');
                    const defaultPass = 'teacher123'; // Temporary plain text, will hash for specific users
                    // We'll insert a default, but since we can't easily hash in SQL without a function, 
                    // this migration mainly adds the column. We'll update passwords in the next step.
                    // Actually, let's just add the column first.
                    db.query("ALTER TABLE teachers ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT 'teacher123'", (err) => {
                        if (err) return reject(err);
                        console.log('Password column added.');
                        resolve();
                    });
                } else {
                    console.log('Password column already exists.');
                    resolve();
                }
            });
        });

        // Update all existing teachers with a hashed default password if they have the plain default
        const hashedPassword = await bcrypt.hash('teacher123', 10);
        await new Promise((resolve, reject) => {
            db.query("UPDATE teachers SET password = ? WHERE password = 'teacher123'", [hashedPassword], (err, result) => {
                if (err) return reject(err);
                console.log(`Updated ${result.changedRows} teachers with hashed default password.`);
                resolve();
            });
        });

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        db.end();
    }
});
