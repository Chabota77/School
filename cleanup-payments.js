const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function cleanup() {
    try {
        console.log('Cleaning up payments with NULL student_id...');
        const res = await pool.query('DELETE FROM payments WHERE student_id IS NULL');
        console.log(`Deleted ${res.rowCount} invalid payments.`);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

cleanup();
