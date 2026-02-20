const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function verify() {
    try {
        console.log('\n--- Checking Database Records ---');

        // Check recent payments
        const res = await pool.query(`
            SELECT p.id, p.amount, p.date, p.method, u.name as student_name 
            FROM payments p
            JOIN students s ON p.student_id = s.id
            JOIN users u ON s.user_id = u.id
            ORDER BY p.id DESC 
            LIMIT 5
        `);

        if (res.rows.length === 0) {
            console.log('No payments found in database.');
        } else {
            console.log(`Found ${res.rows.length} recent payments:`);
            console.table(res.rows);
        }

        // Verify ID 26 specifically if it exists
        const p26 = await pool.query('SELECT * FROM payments WHERE id = 26');
        if (p26.rows.length > 0) {
            console.log('\nPayment ID 26 (Updated):');
            console.log(p26.rows[0]);
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

verify();
