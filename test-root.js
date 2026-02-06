const mysql = require('mysql2');

const configs = [
    { user: 'root', password: '', name: 'root/empty' },
    { user: 'root', password: 'password', name: 'root/password' },
    { user: 'root', password: 'root', name: 'root/root' },
    { user: 'admin', password: 'password', name: 'admin/password' },
];

function tryConnect(index) {
    if (index >= configs.length) {
        console.log('All attempts failed.');
        process.exit(1);
    }

    const config = configs[index];
    console.log(`Trying ${config.name}...`);
    
    const connection = mysql.createConnection({
        host: 'localhost',
        user: config.user,
        password: config.password
    });

    connection.connect((err) => {
        if (err) {
            console.log(`Failed ${config.name}: ${err.message}`);
            connection.end();
            tryConnect(index + 1);
        } else {
            console.log(`SUCCESS! Connected with ${config.name}`);
            connection.end();
            process.exit(0);
        }
    });
}

tryConnect(0);
