const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function applySchema() {
    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        const sql = fs.readFileSync(path.join(__dirname, 'postgres-normalized.sql'), 'utf8');
        console.log('Applying schema...');

        await client.query(sql);
        console.log('Schema applied successfully!');
    } catch (err) {
        console.error('Error applying schema:', err);
    } finally {
        await client.end();
    }
}

applySchema();
