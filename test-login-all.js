const http = require('http');

const postLogin = (user, pass, role) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ username: user, password: pass, role: role });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const json = JSON.parse(body);
                    console.log(`[PASS] Role: ${role}, User: ${user} -> Token received. ID: ${json.user.id}`);
                } else {
                    console.error(`[FAIL] Role: ${role}, User: ${user} -> Status: ${res.statusCode}, Body: ${body}`);
                }
                resolve();
            });
        });

        req.on('error', error => {
            console.error(`[ERROR] Role: ${role}, User: ${user} -> ${error.message}`);
            resolve();
        });

        req.write(data);
        req.end();
    });
};

const runTests = async () => {
    console.log("Testing Logins...");
    // Admin
    await postLogin('admin', 'password', 'admin');

    // Accountant (New)
    await postLogin('accountant', 'password', 'accountant');

    // Info Officer (New)
    await postLogin('info', 'password', 'info_officer');

    // Teacher (by Email)
    await postLogin('john.banda@school.com', 'teacher123', 'teacher'); // Check schema
    await postLogin('john.banda@school.com', 'password', 'teacher'); // Try password too

    // Student (by Name)
    await postLogin('John Doe', 'password', 'student');

    // Student (by ID - Mocking logic: DB ID 1 -> 2500001)
    await postLogin('2500001', 'password', 'student');
};

setTimeout(runTests, 1000);
