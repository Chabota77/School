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
    console.log('--- ADMINS ---');
    db.all("SELECT id, username, role FROM admins", (err, rows) => {
        if (err) console.log(err.message);
        else console.log(rows);
    });

    console.log('\n--- TEACHERS ---');
    db.all("SELECT id, email FROM teachers", (err, rows) => {
        if (err) console.log(err.message);
        else console.log(rows);
    });
});
