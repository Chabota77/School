const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query('SELECT email, role FROM users');
        console.log('Users in DB:');
        res.rows.forEach(u => console.log(`- ${u.role}: ${u.email}`));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
