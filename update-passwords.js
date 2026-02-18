const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to DB');

        const hash = await bcrypt.hash('password', 10);
        console.log('Generated Hash for "password":', hash);

        // Update all users
        const res = await client.query('UPDATE users SET password_hash = $1', [hash]);
        console.log(`Updated ${res.rowCount} users to password: 'password'`);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
