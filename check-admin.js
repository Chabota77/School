const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) throw err;
    db.query('SELECT * FROM admins', (err, results) => {
        if (err) throw err;
        console.log('Admins:', results);
        db.end();
    });
});
