/**
 * Main Application Entry Point
 * Initializes Utils, Data, and handles Page Routing/Listeners.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Data & Theme
    if (window.SchoolData) window.SchoolData.initData();
    if (window.SchoolUtils) window.SchoolUtils.initTheme();

    const path = window.location.pathname;

    // 2. Login Page Logic
    if (path.includes('login.html')) {
        const loginForm = document.querySelector('form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('user').value;
                const password = document.getElementById('pass').value;
                const role = document.getElementById('role').value;

                if (window.SchoolAuth) {
                    window.SchoolAuth.login(username, password, role);
                }
            });
        }
    }

    // 3. Public Check Results Logic (Backend Integration)
    if (path.includes('check-results.html')) {
        const resultsForm = document.getElementById('resultsForm');
        if (resultsForm) {
            resultsForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const studentId = document.getElementById('studentId').value.trim();
                const name = document.getElementById('studentName').value.trim();
                const term = document.getElementById('termSelect').value;
                const resultsSection = document.querySelector('.results-display');
                const resultsBody = document.getElementById('resultsTableBody');
                const statusMessage = document.getElementById('statusMessage');

                if (!studentId || !name || !term) {
                    if (window.SchoolUtils) window.SchoolUtils.showToast('Please fill in all fields', 'error');
                    else alert('Please fill in all fields');
                    return;
                }

                const btn = resultsForm.querySelector('button');
                const originalText = btn.textContent;
                btn.textContent = 'Checking...';
                btn.disabled = true;
                resultsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Searching...</td></tr>';
                resultsSection.style.display = 'block';

                try {
                    // LocalStorage Fix for Check Results
                    const db = window.SchoolData.getDB();
                    const students = db.students || [];

                    // 1. Find Student Debugging
                    console.log(`Searching for: Roll=${studentId}, Name=${name.toLowerCase()}`);
                    console.log(`Total Students in DB: ${students.length}`);

                    const student = students.find(s => {
                        // Normalize DB ID (e.g. "S001" -> 1, or "2500001" -> 1 if needed, but best to stick to raw ID)
                        // Our system seems to store "id": "1", "rollNo": "2500001"

                        const rawId = s.id;
                        const dbRoll = s.rollNo || (2500000 + parseInt(rawId) || 0).toString();

                        // Normalize Input
                        const inputId = studentId.toString().trim();

                        // Check match on either ID, RollNo, or Constructed RollNo
                        const idMatch = (rawId == inputId) || (dbRoll == inputId);

                        const nameMatch = s.name.toLowerCase().includes(name.toLowerCase());

                        return idMatch && nameMatch;
                    });

                    if (student) {
                        // 2. Check if Published
                        // Map "Term 1" -> "T1" logic
                        const termId = term.includes('Term') ? term.replace('Term ', 'T') : term;
                        const currentYear = '2026';

                        const isPublished = window.SchoolData.isPublished(currentYear, termId);

                        if (!isPublished) {
                            resultsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Results not yet published for this term.</td></tr>';
                            statusMessage.innerHTML = `<span style="color:orange;">Results are not yet available.</span>`;
                            if (window.SchoolUtils) window.SchoolUtils.showToast('Results not published', 'warning');
                        } else {
                            // 3. Get Results
                            // Use the normalized termId
                            const results = window.SchoolData.getStudentResults(student.id, termId);

                            if (Object.keys(results).length > 0) {
                                resultsBody.innerHTML = '';
                                Object.entries(results).forEach(([subject, score]) => {
                                    resultsBody.innerHTML += `
                                        <tr>
                                            <td>${subject}</td>
                                            <td>${score}</td>
                                            <td>${getGrade(score)}</td>
                                        </tr>
                                    `;
                                });
                                statusMessage.innerHTML = `<span style="color:green;">Results found for ${name} (${term}).</span>`;
                                if (window.SchoolUtils) window.SchoolUtils.showToast('Results found!', 'success');
                            } else {
                                resultsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No grades recorded.</td></tr>';
                                statusMessage.innerHTML = `<span style="color:orange;">No grades found.</span>`;
                            }
                        }
                    } else {
                        resultsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No student found.</td></tr>';
                        statusMessage.innerHTML = `<span style="color:red;">No results found. Please check your details.</span>`;
                        if (window.SchoolUtils) window.SchoolUtils.showToast('No results found', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    resultsBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Error loading results.</td></tr>';
                } finally {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        }
    }

    function getGrade(marks) {
        if (marks >= 80) return 'A (Distinction)';
        if (marks >= 70) return 'B (Merit)';
        if (marks >= 60) return 'C (Credit)';
        if (marks >= 50) return 'D (Pass)';
        return 'F (Fail)';
    }

    // 4. Attach Global Logout Listeners (if any generic ones exist)
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.SchoolAuth) window.SchoolAuth.logout();
        });
    });
});
