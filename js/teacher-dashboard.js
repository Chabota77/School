document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // Verify User Role
    if (!user || user.role !== 'teacher') {
        window.location.href = '../login.html';
        return;
    }

    const token = localStorage.getItem('token');

    // FETCH REAL TEACHER PROFILE
    let teacherProfile = null;

    try {
        const res = await fetch(`/api/teachers/${user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch profile');
        teacherProfile = await res.json();
    } catch (err) {
        console.error(err);
        alert('Could not load teacher profile. Please relogin.');
        // window.location.href = '../login.html';
        return;
    }


    if (!teacherProfile) {
        alert('Teacher profile not found for this user.');
        return;
    }

    // Set Welcome Name
    const headerName = document.querySelector('.teacher-header h1');
    if (headerName) {
        // Use profile name OR fallback to user.name from auth
        headerName.textContent = `Welcome, ${teacherProfile.name || user.name}`;
    }

    // Load Data from API
    let myClasses = [];
    let myStudents = [];

    // Fetch Classes and Students
    try {
        const [classesRes, studentsRes] = await Promise.all([
            fetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/teacher/students', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (classesRes.ok) {
            const allClasses = await classesRes.json();
            // Filter classes assigned to this teacher
            myClasses = allClasses.filter(c => teacherProfile.classIds.includes(c.id));
        }

        if (studentsRes.ok) {
            myStudents = await studentsRes.json();
        }

    } catch (e) {
        console.error('Error loading dashboard data:', e);
    }

    // Load Stats
    const loadStats = () => {
        const cards = document.querySelectorAll('.stats-cards .card p');
        if (cards.length >= 3) {
            cards[0].textContent = myStudents.length;
            cards[1].textContent = teacherProfile.classIds.length; // Classes count
            cards[2].textContent = '0'; // New Messages (Mock)
        }
    };

    // Load Pupils
    const loadPupils = () => {
        const tbody = document.querySelector('.teacher-table tbody');
        if (!tbody) return;

        if (myStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center;">No pupils assigned to your classes.</td></tr>';
            return;
        }

        tbody.innerHTML = myStudents.map(s => {
            const cls = myClasses.find(c => c.id === s.class_id);
            return `
            <tr>
                <td>${s.roll_number || s.id}</td>
                <td>${s.name}</td>
                <td>${s.gender || 'N/A'}</td>
                <td>${s.class_name || (cls ? cls.name : s.class_id)}</td>
            </tr>
            `;
        }).join('');
    };

    // Load Announcements
    const loadAnnouncements = async () => {
        const announcementSection = document.getElementById('announcements');
        const listDiv = announcementSection.querySelector('.announcement-list');
        if (!listDiv) return;

        try {
            const res = await fetch('/api/announcements', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const allAnnouncements = await res.json();
                // Filter: Everyone OR Teachers only
                const myAnnouncements = allAnnouncements.filter(a =>
                    a.audience === 'Everyone' || a.audience === 'Teachers' || a.audience === 'Teachers only'
                );

                if (myAnnouncements.length === 0) {
                    listDiv.innerHTML = '<p>No new announcements.</p>';
                    return;
                }

                listDiv.innerHTML = myAnnouncements.map(a => `
                    <div class="announcement-card" style="background:white; padding:15px; margin-bottom:15px; border-radius:8px; border-left: 4px solid #2b6cb0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <h4 style="margin:0; font-size:1.1em; color:#2d3748;">${a.title}</h4>
                            <span style="font-size:0.85em; color:#718096;">${new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style="color:#4a5568; line-height:1.5;">${a.content}</p>
                        <div style="margin-top:10px; font-size:0.8em; color:#718096; font-weight:600;">
                            Audience: ${a.audience}
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Error loading announcements:', e);
            listDiv.innerHTML = '<p>Error loading announcements.</p>';
        }
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
