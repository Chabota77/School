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

        const hash = await bcrypt.hash('password', 10);

        // Accountant
        await client.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Accountant', 'accountant', $1, 'admin') ON CONFLICT (email) DO UPDATE SET password_hash = $1", [hash]);

        // Info Officer
        await client.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Info Officer', 'info_officer', $1, 'admin') ON CONFLICT (email) DO UPDATE SET password_hash = $1", [hash]);

        // Also insert 'account' and 'info' just in case the frontend uses those specific usernames
        // Actually, let's check admin-login.html: values are "accountant" and "info_officer".
        // BUT the user request said "account, info are not able to login".
        // Maybe the user is typing 'account' into the username field? 
        // The frontend sends the VALUE of the select box as 'role', but the 'username' input as 'username'.
        // So we need users with email='account' and email='info' probably.

        await client.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Accountant User', 'account', $1, 'admin') ON CONFLICT (email) DO UPDATE SET password_hash = $1", [hash]);
        await client.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Info User', 'info', $1, 'admin') ON CONFLICT (email) DO UPDATE SET password_hash = $1", [hash]);

        console.log('seeded sub-admins');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
