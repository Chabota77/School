const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/classes', // Public endpoint (open)
    method: 'GET'
};

const req = http.request(options, res => {
    console.log(`StatusCode: ${res.statusCode}`);
    res.on('data', d => {
        process.stdout.write(d);
    });
});

req.on('error', error => {
    console.error('Error:', error.message);
});

req.end();
