document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // 1. Auth Guard
    if (!user || user.role !== 'student') {
        window.location.href = '../login.html';
        return;
    }

    // 2. Resolve Student Entity & 3. UI Initialization
    const updateProfile = async () => {
        try {
            const response = await fetch('/api/student/profile', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to fetch profile');

            const student = await response.json();
            window.currentStudent = student; // Store for other functions

            document.getElementById('studentName').textContent = student.name;
            document.getElementById('studentIdDisplay').textContent = student.roll_number || student.id;

            // Sidebar Initials
            const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2);
            document.querySelector('.avatar').textContent = initials;

            // Class Name
            document.getElementById('studentClassDisplay').textContent = student.class_name || '-';

            return student;
        } catch (err) {
            console.error(err);
            alert('Could not load student profile. Please login again.');
            window.location.href = '../login.html';
        }
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
        const currentYear = new Date().getFullYear();
        const terms = [
            { id: 'T1', name: 'Term 1' },
            { id: 'T2', name: 'Term 2' },
            { id: 'T3', name: 'Term 3' }
        ];
        const currentTermId = 'T1';

        // Populate Select
        const termSelect = document.getElementById('termSelect');
        termSelect.innerHTML = terms.map(t => `<option value="${t.id}" ${t.id === currentTermId ? 'selected' : ''}>${t.name} (${currentYear})</option>`).join('');

        const updateDisplayTerm = (val) => {
            const t = terms.find(x => x.id === val);
            if (t) document.getElementById('currentTermDisplay').textContent = t.name;
        };
        updateDisplayTerm(currentTermId);

        // Fetch Results Function
        const fetchAndRender = async (termStr) => {
            const tbody = document.getElementById('resultsTableBody');
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading...</td></tr>';

            try {
                // 1. Check if Results are Published
                const pubRes = await fetch(`/api/results/publish?year=${currentYear}&term=${termStr}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const pubData = await pubRes.json();

                if (!pubData.isPublished) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">🔒 Results for this term have not been published yet.</td></tr>';
                    document.getElementById('averageScoreDisplay').innerHTML = '<span style="font-size:0.6em; color:#888;">Pending</span>';
                    return;
                }

                // 2. Fetch Actual Results
                const res = await fetch(`/api/results?year=${currentYear}&term=${termStr}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (!res.ok) throw new Error('Failed to fetch results');
                const results = await res.json();

                if (results.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No results found for this term.</td></tr>';
                    updateStats([]);
                    return;
                }

                tbody.innerHTML = '';
                const scores = [];

                results.forEach(r => {
                    scores.push({ score: r.marks });
                    const numScore = parseInt(r.marks);
                    let grade = 'F';
                    let status = 'Fail';
                    let statusClass = 'status-fail';

                    if (numScore >= 75) { grade = 'A'; status = 'Pass'; statusClass = 'status-pass'; }
                    else if (numScore >= 60) { grade = 'B'; status = 'Pass'; statusClass = 'status-pass'; }
                    else if (numScore >= 50) { grade = 'C'; status = 'Pass'; statusClass = 'status-pass'; }
                    else if (numScore >= 40) { grade = 'D'; status = 'Pending'; statusClass = 'status-fail'; }

                    tbody.innerHTML += `
                        <tr>
                            <td>${r.subject_name || '-'}</td>
                            <td>${r.marks}%</td>
                            <td>${grade}</td>
                            <td><span class="status-badge ${statusClass}">${status}</span></td>
                        </tr>
                    `;
                });

                updateStats(scores);
            } catch (err) {
                console.error(err);
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading results.</td></tr>';
            }
        };

        // Initial Load
        fetchAndRender(termSelect.value);

        // Change Listener
        termSelect.addEventListener('change', (e) => {
            updateDisplayTerm(e.target.value);
            fetchAndRender(e.target.value);
        });
    };

    const loadAnnouncements = async () => {
        const list = document.getElementById('announcementList');
        try {
            const res = await fetch('/api/announcements');
            const anns = await res.json();

            // Filter: Everyone OR Pupils only
            const myAnnouncements = anns.filter(a =>
                a.audience === 'Everyone' || a.audience === 'Pupils only'
            );

            if (myAnnouncements.length === 0) {
                list.innerHTML = '<p>No announcements.</p>';
                return;
            }
            list.innerHTML = myAnnouncements.map(a => `
                <div class="announcement-item">
                    <h4>${a.title}</h4>
                    <p>${a.content}</p>
                    <small>${new Date(a.created_at || Date.now()).toLocaleDateString()} • ${a.audience}</small>
                </div>
            `).join('');
        } catch (e) {
            console.error(e);
            list.innerHTML = '<p>Error loading announcements.</p>';
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        window.location.href = '../login.html';
    };

    // Run
    updateProfile().then(() => {
        loadGrades();
        loadAnnouncements();
    });

    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString();

    // Download Logic (PDF)
    const downloadBtn = document.getElementById('downloadResultsBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                alert("PDF Library not loaded. Please refresh.");
                return;
            }

            const doc = new jsPDF();

            // 1. Header Details
            const studentName = document.getElementById('studentName').textContent.trim() || "Student";
            const studentId = document.getElementById('studentIdDisplay') ? document.getElementById('studentIdDisplay').textContent : '';

            const className = document.getElementById('studentClassDisplay').textContent;
            const termName = document.getElementById('termSelect').options[document.getElementById('termSelect').selectedIndex]?.text || "Term";
            const date = new Date().toLocaleDateString();

            // Title
            doc.setFontSize(18);
            doc.text("K-Lombe School", 14, 20);
            doc.setFontSize(14);
            doc.text("Student Results Slip", 14, 30);

            // Meta Data
            doc.setFontSize(11);
            doc.text(`Name: ${studentName}`, 14, 40);
            doc.text(`ID: ${studentId}`, 150, 46); // Add ID to PDF

            doc.text(`Class: ${className}`, 14, 46);
            doc.text(`Term: ${termName}`, 14, 52);
            doc.text(`Date: ${date}`, 150, 40);

            // 2. Table Data
            const table = document.querySelector('.results-table');
            const rows = Array.from(table.querySelectorAll('tbody tr'));

            if (rows.length === 0 || rows[0].innerText.includes('No results')) {
                alert("No results to download.");
                return;
            }

            const tableData = rows.map(row => {
                const cols = row.querySelectorAll('td');
                return [
                    cols[0].innerText.trim(), // Subject
                    cols[1].innerText.trim(), // Score
                    cols[2].innerText.trim(), // Grade
                    cols[3].innerText.trim()  // Status
                ];
            });

            // 3. AutoTable
            doc.autoTable({
                startY: 60,
                head: [['Subject', 'Score', 'Grade', 'Status']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] },
            });

            // 4. Footer
            const finalY = doc.lastAutoTable.finalY || 60;
            doc.setFontSize(10);
            doc.text("This document is system generated.", 14, finalY + 10);

            // Save Method (Robust)
            const safeName = studentName.replace(/[^a-z0-9]/gi, '_');
            const filename = `Results-${safeName}-${termName}.pdf`;

            try {
                doc.save(filename); // Try native save first (usually most reliable)
            } catch (e) {
                console.error("Native save failed, trying blob method", e);
                // Fallback
                const pdfBlob = doc.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename; // Property assignment
                document.body.appendChild(link); // Required for Firefox
                link.click();

                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 5000); // 5 seconds
            }
        });
    }
});
