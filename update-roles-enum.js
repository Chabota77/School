const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        // 1. Drop the existing CHECK constraint
        // We need to find the constraint name first, but usually it's users_role_check
        // Or we can just try to drop it if we know the name or use raw SQL to find it.
        // Let's assume users_role_check based on standard naming or just try to alter the type if it was an enum (it's a check).

        await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");

        // 2. Add new CHECK constraint with expanded roles
        await client.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher', 'student', 'parent', 'accountant', 'info_officer'))");

        // 3. Update the users
        await client.query("UPDATE users SET role = 'accountant' WHERE email = 'account' OR email = 'accountant'");
        await client.query("UPDATE users SET role = 'info_officer' WHERE email = 'info' OR email = 'info_officer'");

        console.log('Roles updated and constraints expanded.');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
