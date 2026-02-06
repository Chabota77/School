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

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const fixLogins = async () => {
    try {
        db.serialize(async () => {
            // 1. Add Accountant and Info Officer
            const admins = [
                { user: 'accountant', pass: 'password', email: 'accountant@school.com' },
                { user: 'info', pass: 'password', email: 'info@school.com' }
            ];

            for (const admin of admins) {
                try {
                    const exists = await getQuery("SELECT id FROM admins WHERE username = ?", [admin.user]);
                    if (!exists) {
                        await runQuery("INSERT INTO admins (username, password, email) VALUES (?, ?, ?)", [admin.user, admin.pass, admin.email]);
                        console.log(`Added admin user: ${admin.user}`);
                    } else {
                        // Reset password just in case
                        await runQuery("UPDATE admins SET password = ? WHERE username = ?", [admin.pass, admin.user]);
                        console.log(`Updated password for: ${admin.user}`);
                    }
                } catch (e) {
                    console.error(`Error processing ${admin.user}:`, e.message);
                }
            }

            // 2. Add properties to Students table (password)
            // Check if column exists first to avoid error? SQLite doesn't have easy "IF NOT EXISTS" for columns in ALTER
            // simplified: Try to add, if error saying duplicate column, ignore.
            try {
                await runQuery("ALTER TABLE students ADD COLUMN password TEXT DEFAULT 'password'");
                console.log("Added password column to students table.");
            } catch (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log("Password column already exists in students table.");
                } else {
                    console.error("Error adding password column:", err.message);
                }
            }

            // 3. Ensure all students have a password
            await runQuery("UPDATE students SET password = 'password' WHERE password IS NULL OR password = ''");
            console.log("Updated all students with default password.");

            console.log("Database Fixes Completed.");
        });

    } catch (err) {
        console.error("Main Error:", err);
    }
};

fixLogins();
