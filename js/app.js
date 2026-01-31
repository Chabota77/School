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

    // 3. Public Check Results Logic (Legacy/Public Access)
    if (path.includes('check-results.html')) {
        const resultsForm = document.getElementById('resultsForm');
        if (resultsForm) {
            resultsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (typeof handleCheckResults === 'function') {
                    // Start of inline logic migrated from old app.js if complex, 
                    // but for now keeping the "handler" if it was external, 
                    // OR re-implementing briefly here using Utils.

                    const nameInput = document.getElementById('studentName');
                    const termSelect = document.getElementById('termSelect');
                    const resultsSection = document.querySelector('.results-display');
                    const resultsBody = document.getElementById('resultsTableBody');

                    const name = nameInput.value.trim().toLowerCase();
                    const termName = termSelect.value; // "Term 1"

                    if (!name || !termName) {
                        window.SchoolUtils.showToast('Enter name and term', 'error');
                        return;
                    }

                    const db = window.SchoolData.getDB();
                    const student = db.students.find(s => s.name.toLowerCase().includes(name));

                    if (student) {
                        const termId = termName.replace('Term ', 'T');
                        const results = window.SchoolData.getStudentResults(student.id, termId);

                        if (Object.keys(results).length > 0) {
                            window.SchoolUtils.showToast('Results found', 'success');
                            resultsSection.style.display = 'block';
                            resultsBody.innerHTML = '';
                            Object.entries(results).forEach(([sub, score]) => {
                                resultsBody.innerHTML += `<tr><td>${sub}</td><td>${score}</td></tr>`;
                            });
                        } else {
                            window.SchoolUtils.showToast('No results for this term', 'error');
                            resultsSection.style.display = 'none';
                        }
                    } else {
                        window.SchoolUtils.showToast('Student not found', 'error');
                        resultsSection.style.display = 'none';
                    }
                }
            });
        }
    }

    // 4. Attach Global Logout Listeners (if any generic ones exist)
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.SchoolAuth) window.SchoolAuth.logout();
        });
    });
});
