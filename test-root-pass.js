const mysql = require('mysql2');

const passwords = ['Chabota77', 'chabota77'];
const user = 'root';

function tryConnect(index) {
    if (index >= passwords.length) {
        console.log('All attempts failed.');
        process.exit(1);
    }

    const password = passwords[index];
    console.log(`Trying root with password: ${password}...`);

    const connection = mysql.createConnection({
        host: 'localhost',
        user: user,
        password: password
    });

    connection.connect((err) => {
        if (err) {
            console.log(`Failed: ${err.message}`);
            connection.end();
            tryConnect(index + 1);
        } else {
            console.log(`SUCCESS! Connected with root/${password}`);
            connection.end();
            process.exit(0);
        }
    });
}

tryConnect(0);
