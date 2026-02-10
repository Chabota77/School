const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        return;
    }
    console.log('Connected to SQLite database.');
});

const cleanDuplicates = () => {
    const sql = `
        DELETE FROM students 
        WHERE id NOT IN (
            SELECT MIN(id) 
            FROM students 
            GROUP BY name
        )
    `;

    db.run(sql, function (err) {
        if (err) {
            console.error('Error cleaning duplicates:', err.message);
        } else {
            console.log(`Cleanup complete. Removed ${this.changes} duplicate student records.`);
        }
        db.close();
    });
};

cleanDuplicates();
