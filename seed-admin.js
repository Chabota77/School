const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Connected to school.db');
});

db.serialize(() => {
    const username = 'admin';
    const password = 'password'; // Plain text for dev/legacy check support in server.js
    const email = 'admin@school.com';

    db.get("SELECT * FROM admins WHERE username = ?", [username], (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }

        if (row) {
            console.log(`Admin user '${username}' found. Updating password...`);
            db.run("UPDATE admins SET password = ? WHERE username = ?", [password, username], (err) => {
                if (err) console.error(err.message);
                else console.log("Password updated successfully to 'password'.");
            });
        } else {
            console.log(`Admin user '${username}' not found. Creating...`);
            db.run("INSERT INTO admins (username, password, email) VALUES (?, ?, ?)", [username, password, email], (err) => {
                if (err) console.error(err.message);
                else console.log("Admin user created successfully.");
            });
        }
    });
});
