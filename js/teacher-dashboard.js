document.addEventListener('DOMContentLoaded', () => {
    const { SchoolData } = window;
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (!user || user.role !== 'teacher') {
        window.location.href = '../login.html';
        return;
    }

    // Find the Teacher Profile linked to this User
    const teachers = SchoolData.getCollection('teachers');
    const teacherProfile = teachers.find(t => t.userId === user.id) || teachers.find(t => t.email === user.username);
    // ^ Fallback if userId not set but username matches email, just for safety in mock data

    if (!teacherProfile) {
        alert('Teacher profile not found for this user.');
        return;
    }

    // Set Welcome Name
    const headerName = document.querySelector('.teacher-header h1');
    if (headerName) headerName.textContent = `Welcome, ${teacherProfile.name}`;

    // Get Classes
    const myClassIds = teacherProfile.classIds || [];
    const myClasses = SchoolData.getClasses().filter(c => myClassIds.includes(c.id));

    // Get Students
    const allStudents = SchoolData.getCollection('students');
    const myStudents = allStudents.filter(s => myClassIds.includes(s.classId));

    // Load Stats
    const loadStats = () => {
        const cards = document.querySelectorAll('.stats-cards .card p');
        if (cards.length >= 3) {
            cards[0].textContent = myStudents.length;
            cards[1].textContent = '0'; // Assignments Pending (Mock)
            cards[2].textContent = '0'; // New Messages (Mock)
        }
    };

    // Load Pupils
    const loadPupils = () => {
        const tbody = document.querySelector('.teacher-table tbody');
        if (!tbody) return;

        if (myStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No pupils assigned to your classes.</td></tr>';
            return;
        }

        tbody.innerHTML = myStudents.map(s => {
            const cls = myClasses.find(c => c.id === s.classId);
            return `
            <tr>
                <td>${s.id}</td>
                <td>${s.name}</td>
                <td>${s.gender || 'N/A'}</td>
                <td>${cls ? cls.name : s.classId}</td>
            </tr>
            `;
        }).join('');
    };

    // Load Announcements
    const loadAnnouncements = () => {
        const announcementSection = document.getElementById('announcements');
        const listDiv = announcementSection.querySelector('.announcement-list');
        if (!listDiv) return;

        const allAnnouncements = SchoolData.getCollection('announcements');

        // Filter: Everyone OR Teachers only
        const myAnnouncements = allAnnouncements.filter(a =>
            a.audience === 'Everyone' || a.audience === 'Teachers only'
        );

        if (myAnnouncements.length === 0) {
            listDiv.innerHTML = '<p>No new announcements.</p>';
            return;
        }

        listDiv.innerHTML = myAnnouncements.map(a => `
            <div class="announcement-card" style="background:white; padding:15px; margin-bottom:15px; border-radius:8px; border-left: 4px solid #2b6cb0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h4 style="margin:0; font-size:1.1em; color:#2d3748;">${a.title}</h4>
                    <span style="font-size:0.85em; color:#718096;">${a.date}</span>
                </div>
                <p style="color:#4a5568; line-height:1.5;">${a.content}</p>
                <div style="margin-top:10px; font-size:0.8em; color:#718096; font-weight:600;">
                    Audience: ${a.audience}
                </div>
            </div>
        `).join('');
    };

    // Navigation Logic
    const linkAnnouncements = document.getElementById('link-announcements');
    if (linkAnnouncements) {
        linkAnnouncements.addEventListener('click', (e) => {
            e.preventDefault();
            // Simple Toggle for now, or hide others
            document.getElementById('pupils-table').style.display = 'none';
            document.getElementById('announcements').style.display = 'block';
            loadAnnouncements();
        });
    }

    // Default View (Pupils) - Ensure Pupils tab resets view if needed
    const linkPupils = document.querySelector('a[href="#pupils-table"]');
    if (linkPupils) {
        linkPupils.addEventListener('click', (e) => {
            // e.preventDefault(); // Let hash work, but ensure visibility
            document.getElementById('announcements').style.display = 'none';
            document.getElementById('pupils-table').style.display = 'block';
        });
    }

    // INIT
    loadStats();
    loadPupils();
    loadAnnouncements(); // Preload or load on click? Load on init is fine.
});
