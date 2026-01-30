document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const teacherForm = document.querySelector('#addTeacherModal + .modal form');
    const teacherModalToggle = document.getElementById('addTeacherModal');
    const classSelect = document.querySelector('#addTeacherModal + .modal select:nth-of-type(2)');
    const subjectSelect = document.querySelector('#addTeacherModal + .modal select:nth-of-type(1)');

    let allTeachers = []; // Store for filtering
    let allAdmissions = []; // Store for filtering

    // Load Classes and Subjects
    const loadHelpers = () => {
        fetch('/api/classes').then(res => res.json()).then(data => {
            const selects = document.querySelectorAll('select');
            const classOptions = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            const filterOptions = '<option value="">All Classes</option>' + data.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

            selects.forEach(s => {
                if (s.id === 'filter-teacher-class' || s.id === 'filter-admission-class') {
                    s.innerHTML = filterOptions;
                } else if (s.innerHTML.includes('Select class') || s.innerText.includes('Grade 7A')) {
                    s.innerHTML = '<option value="">Select class</option>' + classOptions;
                }
            });
        });
        fetch('/api/subjects').then(res => res.json()).then(data => {
            const selects = document.querySelectorAll('select');
            selects.forEach(s => {
                if (s.innerHTML.includes('Select subject') || s.innerText.includes('Mathematics')) {
                    s.innerHTML = '<option value="">Select subject</option>' +
                        data.map(sb => `<option value="${sb.id}">${sb.name}</option>`).join('');
                }
            });
        });
    };

    // Load Stats
    const loadStats = () => {
        fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(stats => {
                const cards = document.querySelectorAll('.stats-cards .card p');
                if (cards.length >= 4) {
                    cards[0].textContent = stats.totalStudents;
                    cards[1].textContent = stats.totalTeachers;
                    cards[2].textContent = stats.newAdmissions;
                    cards[3].textContent = stats.pendingMessages;
                }
            });
    };

    // Load Teachers
    const loadTeachers = () => {
        fetch('/api/teachers', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(teachers => {
                allTeachers = teachers; // Save for filtering
                renderTeachers(teachers);
            })
            .catch(err => console.error('Error loading teachers:', err));
    };

    const renderTeachers = (data) => {
        const tbody = document.querySelector('.teachers-table tbody');
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No teachers found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(t => `
            <tr>
                <td>${t.name}</td>
                <td>${t.subject_name || 'N/A'}</td>
                <td>${t.class_name || 'N/A'}</td>
                <td><span class="status ${t.status === 'Active' ? 'active' : 'leave'}">${t.status}</span></td>
                <td class="actions">
                    <label onclick="openMessageModal(${t.id})" class="btn message">✉</label>
                    <label onclick="prepareEditTeacher(${JSON.stringify(t).replace(/"/g, '&quot;')})" class="btn edit">✎</label>
                    <button onclick="deleteTeacher(${t.id})" class="btn delete">🗑</button>
                </td>
            </tr>
        `).join('');
    };

    const filterTeachers = () => {
        const classFilter = document.getElementById('filter-teacher-class').value;
        const searchTerm = document.getElementById('search-teacher').value.toLowerCase();

        const filtered = allTeachers.filter(t => {
            const matchesClass = classFilter ? t.class_name === classFilter : true;
            const matchesSearch = t.name.toLowerCase().includes(searchTerm) || (t.subject_name && t.subject_name.toLowerCase().includes(searchTerm));
            return matchesClass && matchesSearch;
        });
        renderTeachers(filtered);
    };

    // Teacher Listeners
    document.getElementById('filter-teacher-class')?.addEventListener('change', filterTeachers);
    document.getElementById('search-teacher')?.addEventListener('input', filterTeachers);


    // Teacher CRUD (omitted/unchanged logic kept below)
    window.prepareEditTeacher = (teacher) => {
        const form = document.querySelector('#addTeacherModal + .modal form');
        form.querySelector('input[type="text"]').value = teacher.name;
        form.querySelector('input[type="email"]').value = teacher.email;
        form.querySelector('input[type="tel"]').value = teacher.phone || '';
        const selects = form.querySelectorAll('select');
        selects[0].value = teacher.subject_id || '';
        selects[1].value = teacher.class_id || '';
        selects[2].value = teacher.status || 'Active';

        form.dataset.editId = teacher.id;
        document.querySelector('#addTeacherModal + .modal h3').innerText = 'Edit Teacher';
        teacherModalToggle.checked = true;
    };

    if (teacherForm) {
        teacherForm.querySelector('.btn.save').addEventListener('click', (e) => {
            e.preventDefault();
            const id = teacherForm.dataset.editId;
            const data = {
                name: teacherForm.querySelector('input[type="text"]').value,
                email: teacherForm.querySelector('input[type="email"]').value,
                password: teacherForm.querySelector('input[type="password"]').value,
                phone: teacherForm.querySelector('input[type="tel"]').value,
                subject_id: teacherForm.querySelectorAll('select')[0].value,
                class_id: teacherForm.querySelectorAll('select')[1].value,
                status: teacherForm.querySelectorAll('select')[2].value
            };

            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/teachers/${id}` : '/api/teachers';

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            })
                .then(res => res.json())
                .then(resData => {
                    alert(resData.message);
                    teacherModalToggle.checked = false;
                    teacherForm.reset();
                    delete teacherForm.dataset.editId;
                    document.querySelector('#addTeacherModal + .modal h3').innerText = 'Add New Teacher';
                    loadTeachers();
                    loadStats();
                });
        });
    }

    // Load Admissions
    const loadAdmissions = () => {
        fetch('/api/admissions', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(admissions => {
                allAdmissions = admissions;
                renderAdmissions(admissions);
            });
    };

    const renderAdmissions = (data) => {
        const tbody = document.querySelector('#admissions table tbody');
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No admissions found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(a => `
            <tr>
                <td>${a.student_name}</td>
                <td>${a.class_name || 'N/A'}</td>
                <td>${new Date(a.date_applied).toLocaleDateString()}</td>
                <td>${a.phone || a.email || 'N/A'}</td>
                <td class="actions">
                    ${a.status === 'Pending' ? `
                        <button onclick="updateAdmission(${a.id}, 'Approved')" class="btn accept">Accept</button>
                        <button onclick="updateAdmission(${a.id}, 'Rejected')" class="btn reject" style="background:#dc2626; color:#fff;">Reject</button>
                    ` : `
                        <span class="status ${a.status.toLowerCase()}">${a.status}</span>
                        ${a.status === 'Approved' ? `
                            <a href="/admin/acceptance-letter.html?student=${encodeURIComponent(a.student_name)}&parent=${encodeURIComponent(a.parent_name)}&class=${encodeURIComponent(a.class_name)}" 
                               target="_blank" class="btn message" style="text-decoration:none; font-size:0.8em;">Letter</a>
                        ` : ''}
                    `}
                </td>
            </tr>
        `).join('');
    };

    const filterAdmissions = () => {
        const classFilter = document.getElementById('filter-admission-class').value;
        const searchTerm = document.getElementById('search-admission').value.toLowerCase();

        const filtered = allAdmissions.filter(a => {
            const matchesClass = classFilter ? a.class_name === classFilter : true;
            const matchesSearch = a.student_name.toLowerCase().includes(searchTerm) || a.parent_name.toLowerCase().includes(searchTerm);
            return matchesClass && matchesSearch;
        });
        renderAdmissions(filtered);
    };

    // Admission Listeners
    document.getElementById('filter-admission-class')?.addEventListener('change', filterAdmissions);
    document.getElementById('search-admission')?.addEventListener('input', filterAdmissions);

    // Announcements
    const announcementForm = document.querySelector('.announcement-form');
    if (announcementForm) {
        announcementForm.querySelector('button').addEventListener('click', (e) => {
            e.preventDefault();
            const title = announcementForm.querySelector('input').value;
            const audience = announcementForm.querySelector('select').value.split(':')[1]?.trim() || 'Everyone';
            const content = announcementForm.querySelector('textarea').value;

            fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title, audience, content })
            })
                .then(res => res.json())
                .then(data => {
                    alert(data.message);
                    announcementForm.querySelector('input').value = '';
                    announcementForm.querySelector('textarea').value = '';
                    loadAnnouncements();
                });
        });
    }

    const loadAnnouncements = () => {
        fetch('/api/announcements')
            .then(res => res.json())
            .then(announcements => {
                const list = document.getElementById('announcement');
                list.innerHTML = '<h3>Recent Announcements</h3>' + announcements.map(a => `
                <div class="announcement-card">
                    <div class="announcement-header">
                        <h4>${a.title}</h4>
                        <div class="announcement-actions">
                            <button class="delete-btn" onclick="deleteAnnouncement(${a.id})">Delete</button>
                        </div>
                    </div>
                    <p>${a.content}</p>
                    <span>Audience: ${a.audience} • ${new Date(a.created_at).toLocaleDateString()}</span>
                </div>
            `).join('');
            });
    };

    // Actions
    window.updateAdmission = (id, status) => {
        fetch(`/api/admissions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status })
        })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                loadAdmissions();
                loadStats();
            });
    };

    window.deleteAnnouncement = (id) => {
        if (confirm('Delete announcement?')) {
            fetch(`/api/announcements/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => { alert(data.message); loadAnnouncements(); });
        }
    };

    window.deleteTeacher = (id) => {
        if (confirm('Delete teacher?')) {
            fetch(`/api/teachers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => { alert(data.message); loadTeachers(); loadStats(); });
        }
    };

    // Initial Load
    loadHelpers();
    loadStats();
    loadTeachers();
    loadAdmissions();
    loadAnnouncements();
});
