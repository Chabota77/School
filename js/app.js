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

                const nameInput = document.getElementById('studentName');
                const idInput = document.getElementById('studentId');
                const termSelect = document.getElementById('termSelect');
                const resultsSection = document.querySelector('.results-display');
                const resultsBody = document.getElementById('resultsTableBody');

                const name = nameInput.value.trim().toLowerCase();
                const studentId = idInput.value.trim();
                const termName = termSelect.value; // "Term 1"

                if ((!name && !studentId) || !termName) {
                    window.SchoolUtils.showToast('Enter name/ID and select term', 'error');
                    return;
                }

                const db = window.SchoolData.getDB();
                let student = null;

                // 1. Check Publication Status First
                const termId = termName.replace('Term ', 'T');
                // Assuming Year is 2026 for now, or we could fetch current year from data
                // Ideally: const year = document.getElementById('yearSelect').value || '2026';
                const year = '2026';

                if (!window.SchoolData.isPublished(year, termId)) {
                    window.SchoolUtils.showToast(`Results for ${termName} ${year} have not been released yet.`, 'error');
                    resultsSection.style.display = 'none';
                    return;
                }

                if (studentId) {
                    student = db.students.find(s => s.id == studentId);
                } else if (name) {
                    student = db.students.find(s => s.name.toLowerCase().includes(name));
                }

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
