const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const fs = require('fs');

async function debugData() {
    try {
        const data = {};

        const students = await pool.query('SELECT id, user_id, class_id, roll_number FROM students');
        data.students = students.rows;

        const payments = await pool.query('SELECT * FROM payments');
        data.payments = payments.rows;

        const users = await pool.query('SELECT id, name, email, role FROM users WHERE role = \'student\'');
        data.users = users.rows;

        fs.writeFileSync('db_dump.json', JSON.stringify(data, null, 2));
        console.log('Data dumped to db_dump.json');

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

debugData();
