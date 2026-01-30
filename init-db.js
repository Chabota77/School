require('dotenv').config();
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
});

connection.connect((err) => {
    if (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL server.');

    const schemaPath = path.join(__dirname, 'schema.sql');
    fs.readFile(schemaPath, 'utf8', (err, sql) => {
        if (err) {
            console.error('Error reading schema.sql:', err);
            connection.end();
            return;
        }

        console.log('Running schema...');
        connection.query(sql, (err, results) => {
            if (err) {
                console.error('Error running schema:', err);
            } else {
                console.log('Database initialized successfully!');
            }
            connection.end();
        });
    });
});
