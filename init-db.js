const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'school.db');
const schemaPath = path.join(__dirname, 'sqlite-schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database.');
});

fs.readFile(schemaPath, 'utf8', (err, sql) => {
    if (err) {
        console.error('Error reading schema file:', err);
        process.exit(1);
    }

    // Split statements by semicolon, but be careful with triggers/procedures if any.
    // Simple split works for this simple schema.
    const statements = sql.split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

    db.serialize(() => {
        console.log('Running schema...');
        statements.forEach((stmt) => {
            db.run(stmt, (err) => {
                if (err) {
                    console.error('Error running statement:', err.message);
                    console.error('Statement:', stmt);
                }
            });
        });
        console.log('Database initialized successfully!');
        db.close((err) => {
            if (err) console.error(err.message);
            console.log('Closed the database connection.');
        });
    });
});
