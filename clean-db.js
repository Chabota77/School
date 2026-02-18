const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        console.log('Cleaning up database...');

        // 1. Delete Admissions (Independent)
        await client.query("DELETE FROM admissions");
        console.log('- Admissions cleared.');

        // 2. Delete Users (Cascades to Students, Teachers, Parents, Results, Payments)
        // We preserve 'admin', 'accountant', 'info_officer'
        const res = await client.query("DELETE FROM users WHERE role NOT IN ('admin', 'accountant', 'info_officer')");
        console.log(`- Deleted ${res.rowCount} users (Students/Teachers/Parents).`);

        console.log('Database cleanup complete.');

    } catch (err) {
        console.error('Error cleaning database:', err);
    } finally {
        await client.end();
    }
}

run();
