const http = require('http');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

// Helper to make requests
function makeRequest(path, method, token = null, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function debugAdmin() {
    console.log('1. Generating Admin Token...');
    // Manually sign token to bypass password check
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Token acquired.');

    console.log('\n2. Fetching Teachers...');
    const teachers = await makeRequest('/api/teachers', 'GET', token);
    if (Array.isArray(teachers)) {
        console.log(`Found ${teachers.length} teachers.`);
        teachers.forEach(t => console.log(` - ID: ${t.id}, Name: "${t.name}", Email: ${t.email}`));
    } else {
        console.error('Failed to get teachers:', teachers);
    }

    console.log('\n3. Fetching Students...');
    const students = await makeRequest('/api/students', 'GET', token);
    if (Array.isArray(students)) {
        console.log(`Found ${students.length} students.`);
        students.forEach(s => console.log(` - ID: ${s.id}, Name: "${s.name}", Class: ${s.class_name}`));
    } else {
        console.error('Failed to get students:', students);
    }
}

debugAdmin();
