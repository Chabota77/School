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
    console.log('Connected to DB. Starting cleanup...');

    const query = "SELECT * FROM results ORDER BY id DESC"; // Newest first

    db.query(query, (err, results) => {
        if (err) throw err;

        const seen = new Set();
        const toDelete = [];

        results.forEach(r => {
            const key = `${r.student_id}-${r.subject_id}-${r.term}-${r.year}`;
            if (seen.has(key)) {
                // This is a duplicate (older or same age but processed later because distinct ID)
                // Since we sort by ID DESC, the first one we see is the LATEST.
                // Subsequent ones with same key are older duplicates.
                toDelete.push(r.id);
            } else {
                seen.add(key);
            }
        });

        console.log(`Found ${results.length} total results.`);
        console.log(`Found ${toDelete.length} duplicates to delete.`);

        if (toDelete.length > 0) {
            const deleteQuery = `DELETE FROM results WHERE id IN (${toDelete.join(',')})`;
            db.query(deleteQuery, (err, res) => {
                if (err) throw err;
                console.log(`Deleted ${res.affectedRows} duplicates.`);
                db.end();
            });
        } else {
            console.log('No duplicates found.');
            db.end();
        }
    });
});
