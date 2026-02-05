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
        const downloadBtn = document.getElementById('downloadResultsBtn');
        let currentStudent = null;
        let currentResults = null;
        let currentTerm = null;

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
                const termName = termSelect.value;

                if ((!name && !studentId) || !termName) {
                    window.SchoolUtils.showToast('Enter name/ID and select term', 'error');
                    return;
                }

                const db = window.SchoolData.getDB();
                currentStudent = null;

                const termId = termName.replace('Term ', 'T');
                const year = '2026';

                if (!window.SchoolData.isPublished(year, termId)) {
                    window.SchoolUtils.showToast(`Results for ${termName} ${year} have not been released yet.`, 'error');
                    resultsSection.style.display = 'none';
                    if (downloadBtn) downloadBtn.style.display = 'none';
                    return;
                }

                if (studentId) {
                    currentStudent = db.students.find(s => s.id == studentId);
                } else if (name) {
                    currentStudent = db.students.find(s => s.name.toLowerCase().includes(name));
                }

                if (currentStudent) {
                    currentTerm = termName;
                    currentResults = window.SchoolData.getStudentResults(currentStudent.id, termId);

                    if (Object.keys(currentResults).length > 0) {
                        window.SchoolUtils.showToast('Results found', 'success');
                        resultsSection.style.display = 'block';
                        resultsBody.innerHTML = '';
                        Object.entries(currentResults).forEach(([sub, score]) => {
                            resultsBody.innerHTML += `<tr><td>${sub}</td><td>${score}</td><td>${window.SchoolUtils.calculateGrade ? window.SchoolUtils.calculateGrade(score) : '-'}</td></tr>`;
                        });

                        // Show Download Button
                        if (downloadBtn) {
                            downloadBtn.style.display = 'flex';
                            downloadBtn.onclick = () => downloadPDF(currentStudent, currentResults, currentTerm);
                        }

                    } else {
                        window.SchoolUtils.showToast('No results for this term', 'error');
                        resultsSection.style.display = 'none';
                        if (downloadBtn) downloadBtn.style.display = 'none';
                    }
                } else {
                    window.SchoolUtils.showToast('Student not found', 'error');
                    resultsSection.style.display = 'none';
                    if (downloadBtn) downloadBtn.style.display = 'none';
                }
            });
        }

        const downloadPDF = (student, results, term) => {
            if (!window.jspdf) {
                alert('PDF Library not loaded');
                return;
            }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Header
            doc.setFillColor(10, 61, 98); // Primary Blue
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text("K-Lombe School", 105, 20, null, null, "center");
            doc.setFontSize(12);
            doc.text("Termly Report Card", 105, 30, null, null, "center");

            // Student Info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.text(`Student: ${student.name}`, 15, 55);
            doc.text(`Student ID: ${student.id}`, 15, 62);
            doc.text(`Term: ${term}`, 150, 55);
            doc.text(`Year: 2026`, 150, 62);

            // Table
            const tableBody = Object.entries(results).map(([sub, score]) => {
                const grade = window.SchoolUtils.calculateGrade ? window.SchoolUtils.calculateGrade(score) : '-';
                return [sub, score, grade];
            });

            doc.autoTable({
                startY: 70,
                head: [['Subject', 'Score', 'Grade']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [10, 61, 98], textColor: [255, 255, 255] },
                styles: { fontSize: 11, cellPadding: 5 }
            });

            // Footer
            const finalY = doc.lastAutoTable.finalY + 20;
            doc.setFontSize(10);
            doc.text("This is a computer-generated document.", 105, finalY, null, null, "center");

            doc.save(`${student.name}_${term}_Results.pdf`);
        };
    }

    // 4. Attach Global Logout Listeners
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.SchoolAuth) window.SchoolAuth.logout();
        });
    });

    // 5. Load Home Stats (if on home page)
    const loadHomeStats = () => {
        const studentCountEl = document.getElementById('stat-students');
        const teacherCountEl = document.getElementById('stat-teachers');

        if (studentCountEl && teacherCountEl && window.SchoolData) {
            const students = window.SchoolData.getCollection('students');
            const teachers = window.SchoolData.getCollection('teachers');

            // Animated counts (simple implementation)
            studentCountEl.textContent = students.length || '0';
            teacherCountEl.textContent = teachers.length || '0';
        }
    };
    loadHomeStats();
});
