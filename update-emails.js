const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        await client.query("UPDATE users SET email = 'admin' WHERE email = 'admin@school.com'");
        await client.query("UPDATE users SET email = 'teacher' WHERE email = 'teacher@school.com'");
        await client.query("UPDATE users SET email = 'student' WHERE email = 'student@school.com'");
        await client.query("UPDATE users SET email = 'parent' WHERE email = 'parent@school.com'");
        console.log('Emails updated to simplified versions.');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
