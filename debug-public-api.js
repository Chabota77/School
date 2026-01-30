const http = require('http');

const studentId = 1;
const name = encodeURIComponent('Fedness malilwe');
const term = encodeURIComponent('Term 1');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/public/results?student_id=${studentId}&name=${name}&term=${term}`,
    method: 'GET'
};

const req = http.request(options, res => {
    console.log(`StatusCode: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Response:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Raw Response:', data);
        }
    });
});

req.on('error', error => {
    console.error('Error:', error.message);
});

req.end();
