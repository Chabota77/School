const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath);

console.log('Seeding students...');

// Check if students exist
db.get("SELECT COUNT(*) as count FROM students", (err, row) => {
    if (err) {
        console.error(err.message);
        return;
    }

    if (row.count > 0) {
        console.log('Students already exist. Skipping seed.');
    } else {
        const insert = db.prepare("INSERT INTO students (name, age, class_id, status) VALUES (?, ?, ?, ?)");

        insert.run('John Banda', 13, 1, 'Enrolled');
        insert.run('Mary Mwila', 12, 1, 'Enrolled');
        insert.run('Peter Phiri', 14, 2, 'Enrolled');

        insert.finalize((err) => {
            if (err) console.error(err);
            else console.log('Students seeded.');
        });
    }
    // Don't close immediately if async work is pending, but here it's fine or we wait.
    // With sqlite3, operations are serialized by default.
});
