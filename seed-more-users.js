const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath);

const users = [
    { username: 'account', password: 'password', email: 'account@school.com' },
    { username: 'info', password: 'password', email: 'info@school.com' }
];

db.serialize(() => {
    users.forEach(async (u) => {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        
        db.run("INSERT OR IGNORE INTO admins (username, password, email) VALUES (?, ?, ?)", 
            [u.username, hashedPassword, u.email], 
            (err) => {
                if (err) console.error(`Error adding ${u.username}:`, err.message);
                else console.log(`Added/Ensured user: ${u.username}`);
            }
        );
        
        // Also update password if exists (to ensure 'password' works)
        db.run("UPDATE admins SET password = ? WHERE username = ?", [hashedPassword, u.username], (err) => {
             if (!err) console.log(`Updated password for ${u.username}`);
        });
    });
});

// Wait a bit then close
setTimeout(() => {
    db.close();
    console.log("Database connection closed.");
}, 2000);
