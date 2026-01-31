document.addEventListener('DOMContentLoaded', () => {
    const { SchoolData } = window;
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // 1. Auth Guard
    if (!user || user.role !== 'student') {
        window.location.href = '../login.html';
        return;
    }

    // 2. Resolve Student Entity
    const students = SchoolData.getCollection('students'); // Assuming collection name
    // Try by userId mapping OR name fallback (mock data consistency)
    let student = students.find(s => s.userId === user.id);

    // Fallback: If mock data doesn't link userId U3 to S001 explicitly in code, find by name?
    // In data.js, S001 has userId: 'U3'. So this should work.
    if (!student) {
        // Fallback for demo if users aren't perfectly mapped
        console.warn('Student not explicitly mapped to user. Attempting name match or default.');
        student = students.find(s => s.name === user.name) || students[0];
    }

    if (!student) {
        alert('Student record not found.');
        return;
    }

    // 3. UI Initialization
    const updateProfile = () => {
        document.getElementById('studentName').textContent = student.name;
        // Sidebar Initials
        const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        document.querySelector('.avatar').textContent = initials;

        // Class Name
        const classObj = SchoolData.getClasses().find(c => c.id === student.classId);
        document.getElementById('studentClassDisplay').textContent = classObj ? classObj.name : student.classId;
    };

    const updateStats = (results) => {
        if (results.length === 0) {
            document.getElementById('averageScoreDisplay').textContent = '-';
            return;
        }
        const total = results.reduce((acc, r) => acc + parseInt(r.score), 0);
        const avg = (total / results.length).toFixed(1);
        document.getElementById('averageScoreDisplay').textContent = avg + '%';
    };

    const loadGrades = () => {
        const terms = SchoolData.getTerms();
        const currentTerm = terms.find(t => t.current) || terms[0];

        // Populate Select
        const termSelect = document.getElementById('termSelect');
        termSelect.innerHTML = terms.map(t => `<option value="${t.id}" ${t.current ? 'selected' : ''}>${t.name}</option>`).join('');
        document.getElementById('currentTermDisplay').textContent = currentTerm.name;

        // Fetch Results Function
        const fetchAndRender = (termId) => {
            const tbody = document.getElementById('resultsTableBody');
            tbody.innerHTML = '';

            // 1. Check if Results are Published
            // We need the Year Logic. Assuming Terms have a yearId or we pick from current setup.
            // In data.js, Terms have yearId.
            const terms = SchoolData.getTerms();
            const selectedTermObj = terms.find(t => t.id === termId);
            const yearId = selectedTermObj ? selectedTermObj.yearId : '2026'; // Default fallback

            const isPub = SchoolData.isPublished(yearId, termId);

            if (!isPub) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">🔒 Results for this term have not been published yet.</td></tr>';
                document.getElementById('averageScoreDisplay').innerHTML = '<span style="font-size:0.6em; color:#888;">Pending</span>';
                return;
            }

            // Use API
            const resultsMap = SchoolData.getStudentResults(student.id, termId);
            // API returns { SubjectName: Score }

            const entries = Object.entries(resultsMap);
            if (entries.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No results found for this term.</td></tr>';
                updateStats([]);
                return;
            }

            // For stats, we need array of scores
            const scores = [];

            entries.forEach(([subject, score]) => {
                scores.push({ score }); // minimal obj for stats calc logic
                const numScore = parseInt(score);
                let grade = 'F';
                let status = 'Fail';
                let statusClass = 'status-fail';

                if (numScore >= 75) { grade = 'A'; status = 'Pass'; statusClass = 'status-pass'; }
                else if (numScore >= 60) { grade = 'B'; status = 'Pass'; statusClass = 'status-pass'; }
                else if (numScore >= 50) { grade = 'C'; status = 'Pass'; statusClass = 'status-pass'; }
                else if (numScore >= 40) { grade = 'D'; status = 'Pending'; statusClass = 'status-fail'; } // Grading scale approx

                tbody.innerHTML += `
                    <tr>
                        <td>${subject}</td>
                        <td>${score}%</td>
                        <td>${grade}</td>
                        <td><span class="status-badge ${statusClass}">${status}</span></td>
                    </tr>
                `;
            });

            updateStats(scores);
        };

        // Initial Load
        fetchAndRender(termSelect.value);

        // Change Listener
        termSelect.addEventListener('change', (e) => fetchAndRender(e.target.value));
    };

    const loadAnnouncements = () => {
        const list = document.getElementById('announcementList');
        const anns = SchoolData.getCollection('announcements');
        if (anns.length === 0) {
            list.innerHTML = '<p>No announcements.</p>';
            return;
        }
        list.innerHTML = anns.map(a => `
            <div class="announcement-item">
                <h4>${a.title}</h4>
                <p>${a.content}</p>
                <small>${a.date} • ${a.audience}</small>
            </div>
        `).join('');
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        window.location.href = '../login.html';
    };

    // Run
    updateProfile();
    loadGrades();
    loadAnnouncements();

    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString();
});
