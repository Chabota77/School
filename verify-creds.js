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
                    console.log(`[PASS] Role: ${role}, User: ${user} -> Success`);
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
    console.log("Verifying credentials.html matches...");

    // 1. Admin
    await postLogin('admin', 'password', 'admin');

    // 2. Teacher (user: teacher)
    await postLogin('teacher', 'password', 'teacher');

    // 3. Student (user: student)
    await postLogin('Student', 'password', 'student');
    // Note: My script created 'Student' (Capitalized). credentials.html says 'student'.
    // My server.js query: SELECT * FROM ... WHERE name = ? . SQLite case sensitivity depends.
    // Usually comparisons are case-sensitive for TEXT unless COLLATE NOCASE.

    await postLogin('student', 'password', 'student'); // Testing lower case too

    // 4. Accountant
    await postLogin('accountant', 'password', 'accountant');

    // 5. Info Officer
    await postLogin('info', 'password', 'info_officer');
};

setTimeout(runTests, 1000);
