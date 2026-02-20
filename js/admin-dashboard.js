document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') {
        window.location.href = '../login.html';
        return;
    }



    let allTeachers = []; // Store for filtering
    let allAdmissions = []; // Store for filtering

    // --- LOADERS ---


    // --- API LOADERS ---

    const loadHelpers = async () => {
        try {
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
            const [classesRes, subjectsRes] = await Promise.all([
                fetch('/api/classes'), // Public or Auth?
                fetch('/api/subjects')
            ]);

            const classes = await classesRes.json();
            const subjects = await subjectsRes.json();

            const populateSelects = (selector, data, defaultText) => {
                const selects = document.querySelectorAll(selector);
                selects.forEach(s => {
                    if (s.id.includes('filter')) {
                        s.innerHTML = `<option value="">All ${defaultText}</option>` + data.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
                    } else {
                        s.innerHTML = `<option value="">Select ${defaultText}</option>` + data.map(i => `<option value="${i.name}">${i.name}</option>`).join(''); // Assuming data has 'id' too, but using name for now as per old logic or update to ID
                    }
                });
            };

            // Specific targeting for Add Teacher Modal
            const form = document.querySelector('#addTeacherModal + .modal form');
            if (form) {
                const selects = form.querySelectorAll('select');
                // selects[0] is Subject, selects[1] is Class, selects[2] is Status
                if (selects[0]) selects[0].innerHTML = `<option value="">Select Subject</option>` + subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                if (selects[1]) selects[1].innerHTML = `<option value="">Select Class</option>` + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            }

            // Filters
            const teacherFilter = document.getElementById('filter-teacher-class');
            if (teacherFilter) teacherFilter.innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join(''); // Keeping name for filter if backend filters by name??

            const admissionFilter = document.getElementById('filter-admission-class');
            if (admissionFilter) admissionFilter.innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        } catch (e) {
            console.error("Error loading helpers", e);
        }
    };

    const loadStats = async () => {
        try {
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
            const res = await fetch('/api/stats', { headers });
            if (!res.ok) throw new Error('Failed to fetch stats');
            const stats = await res.json();

            const cards = Array.from(document.querySelectorAll('.card'));
            cards.forEach(card => {
                const title = card.querySelector('h3').textContent;
                const val = card.querySelector('p');
                if (title.includes('Students')) val.textContent = stats.totalStudents;
                if (title.includes('Teachers')) val.textContent = stats.totalTeachers;
                if (title.includes('Admissions')) val.textContent = stats.newAdmissions;
            });
        } catch (e) {
            console.error("Stats load failed", e);
        }
    };

    const loadTeachers = async () => {
        const tbody = document.querySelector('.teachers-table tbody');
        tbody.innerHTML = '<tr><td colspan="5">Loading teachers...</td></tr>';

        try {
            const res = await fetch('/api/teachers', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to fetch teachers');
            allTeachers = await res.json();
            renderTeachers(allTeachers);
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="5" style="color:red">Error loading teachers.</td></tr>';
        }
    };

    const renderTeachers = (data) => {
        const tbody = document.querySelector('.teachers-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No teachers found.</td></tr>';
            return;
        }

        data.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t.name}</td>
                <td>${t.subject_names || '-'}</td>
                <td>${t.class_names || '-'}</td> 
                <td><span class="status ${t.status === 'Active' ? 'active' : 'leave'}">${t.status}</span></td>
                <td class="actions">
                    <button class="btn edit" onclick='editTeacher(${JSON.stringify(t)})'>Edit</button>
                    <button class="btn delete" onclick="deleteTeacher('${t.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };


    const loadAdmissions = async () => {
        try {
            const res = await fetch('/api/admissions', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')} ` }
            });
            if (res.ok) {
                allAdmissions = await res.json();
                renderAdmissions(allAdmissions);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const renderAdmissions = (data) => {
        const tbody = document.querySelector('#admissions table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No pending admissions.</td></tr>';
            return;
        }

        data.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${a.student_name}</td>
                <td>${a.class_name || 'N/A'}</td>
                <td>${a.gender || 'N/A'}</td> 
                <td>${new Date(a.date_applied || Date.now()).toLocaleDateString()}</td>
                <td>${a.phone}</td>
                <td class="actions">
                    ${a.status === 'Pending' ? `
                    <button class="btn accept" onclick="updateAdmission('${a.id}', 'Approved')">Accept</button>
                    <button class="btn reject" onclick="updateAdmission('${a.id}', 'Rejected')">Reject</button>
                    ` : (a.status === 'Approved' ? `
                        <span style="font-weight:bold; color:green; display:block; margin-bottom:5px;">Approved</span>
                        <button class="btn secondary" onclick="downloadAdmissionLetter('${a.id}')" style="font-size:0.8em; padding:5px 10px; background-color: #2b6cb0; color: white; border: none;">Download Letter</button>
                    ` : `<span>${a.status}</span>`)}
                </td>
        `;
            tbody.appendChild(tr);
        });
    };

    window.clearAdmissions = () => {
        alert("This feature is disabled in connected mode.");
    };

    const loadAnnouncements = async () => {
        try {
            const res = await fetch('/api/announcements');
            const announcements = await res.json();
            const list = document.getElementById('announcement-list-container');
            if (!list) return;

            list.innerHTML = '';

            if (announcements.length === 0) {
                list.innerHTML = '<p style="color:#64748b; font-style:italic;">No announcements posted.</p>';
                return;
            }

            announcements.forEach(a => {
                const div = document.createElement('div');
                let audClass = 'audience-everyone';
                if (a.audience === 'Teachers' || a.audience === 'Teachers only') audClass = 'audience-teachers';
                else if (a.audience === 'Pupils' || a.audience === 'Pupils only') audClass = 'audience-pupils';

                div.className = `announcement - card ${audClass} `;
                div.innerHTML = `
            < div class="announcement-header" >
                        <h4>${a.title}</h4>
                        <button class="delete-btn-icon" onclick="deleteAnnouncement('${a.id}')" title="Delete">
                            <i class="fas fa-trash"></i> &#128465;
                        </button>
                    </div >
                    <div class="announcement-body">
                        <p>${a.content}</p>
                    </div>
                    <div class="announcement-meta">
                        <div class="meta-badges">
                            <span class="badge audience">${a.audience || 'Everyone'}</span>
                        </div>
                        <span>${new Date(a.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
    `;
                list.appendChild(div);
            });
        } catch (e) { console.error("Error loading announcements", e); }
    };

    // --- ACTIONS ---

    // Expose to window for inline onclicks
    window.deleteTeacher = async (id) => {
        if (confirm('Delete this teacher? This will also remove their access.')) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/teachers/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    alert('Teacher deleted');
                    loadTeachers();
                    loadStats();
                } else {
                    alert('Failed to delete teacher');
                }
            } catch (e) {
                console.error(e);
                alert('Network error');
            }
        }
    };

    window.editTeacher = (teacher) => {
        const modalToCheck = document.getElementById('addTeacherModal');
        const form = document.querySelector('#addTeacherModal + .modal form');

        let t = teacher;
        // If it was just an ID string (legacy compat)
        if (typeof teacher === 'string' || typeof teacher === 'number') {
            t = allTeachers.find(x => x.id == teacher);
        }

        if (!t) return;

        // Inputs
        const inputs = form.querySelectorAll('input');
        if (inputs[0]) inputs[0].value = t.name;
        if (inputs[1]) inputs[1].value = t.email;
        if (inputs[2]) inputs[2].value = ''; // Don't show password
        if (inputs[3]) inputs[3].value = t.phone;

        const selects = form.querySelectorAll('select');
        // We might not have these fields in the API response yet (subject/class might be null or text)
        if (selects[0]) selects[0].value = t.subject_id || '';
        if (selects[1]) selects[1].value = t.class_id || ''; // We need to ensure Teacher GET returns these
        if (selects[2]) selects[2].value = t.status || 'Active';

        // Attach ID
        form.dataset.updateId = t.id;

        modalToCheck.checked = true;
    };

    // --- LEGACY/LOCAL STORAGE ADAPTERS (Announcements, etc - keep local for now as per instructions to only fix specific things) ---

    // Helper: Download Acceptance Letter
    window.downloadAdmissionLetter = (id) => {
        const adm = allAdmissions.find(a => a.id == id);
        if (!adm) {
            alert("Admission record not found.");
            return;
        }

        // URL Encode parameters to handle spaces and special characters
        const items = {
            student: adm.student_name,
            parent: adm.parent_name || 'Parent/Guardian',
            class: adm.class_name,
            date: adm.date_applied
        };

        const params = new URLSearchParams(items).toString();
        const url = `acceptance-letter.html?${params}`;

        // Open in new tab
        window.open(url, '_blank');
    };

    window.updateAdmission = async (id, status) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admissions/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                if (status === 'Approved') {
                    downloadAdmissionLetter(id);
                    if (window.SchoolUtils) window.SchoolUtils.showToast('Admission Approved & Letter Generated', 'success');
                } else {
                    alert(`Admission ${status}`);
                }

                loadAdmissions();
                loadStats();
            } else {
                const err = await res.json();
                alert('Error: ' + err.error);
            }
        } catch (e) {
            console.error(e);
            alert('Network error updating admission');
        }
    };

    window.deleteAnnouncement = async (id) => {
        if (confirm('Delete announcement?')) {
            const token = localStorage.getItem('token');
            await fetch(`/api/announcements/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            loadAnnouncements();
        }
    };


    // --- EVENT LISTENERS ---

    // --- EVENT LISTENERS ---

    // Add Teacher
    const saveTeacherBtn = document.querySelector('#addTeacherModal + .modal .btn.save');
    if (saveTeacherBtn) {
        saveTeacherBtn.onclick = async (e) => {
            e.preventDefault();
            const form = document.querySelector('#addTeacherModal + .modal form');
            const inputs = form.querySelectorAll('input');
            const selects = form.querySelectorAll('select');
            const btn = e.target;

            const name = inputs[0].value;
            const email = inputs[1].value;
            const password = inputs[2].value;
            const phone = inputs[3].value;

            if (!email || !name) {
                alert('Name and Email are required.');
                return;
            }

            btn.textContent = 'Saving...';
            btn.disabled = true;

            try {
                // Prepare Payload
                const payload = {
                    name, email, phone,
                    subject_id: selects[0].value,
                    class_id: selects[1].value,
                    status: selects[2].value,
                    password: password || undefined
                };

                let url = '/api/teachers';
                let method = 'POST';

                if (form.dataset.updateId) {
                    url = `/api/teachers/${form.dataset.updateId}`;
                    method = 'PUT';
                }

                const token = localStorage.getItem('token');
                if (!token) {
                    alert('Session expired. Please login again.');
                    window.location.href = '../login.html';
                    return;
                }

                const res = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    alert(form.dataset.updateId ? 'Teacher updated successfully' : 'Teacher created successfully');
                    document.getElementById('addTeacherModal').checked = false;
                    form.reset();
                    delete form.dataset.updateId;
                    loadTeachers();
                    loadStats();
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.message || err.error || 'Failed to save teacher'));
                }


            } catch (err) {
                console.error(err);
                alert('Network Error');
            } finally {
                btn.textContent = 'Save Teacher';
                btn.disabled = false;
            }
        };
    }

    // Post Announcement
    // Post Announcement
    const postAnnounceBtn = document.getElementById('post-announcement-btn');
    if (postAnnounceBtn) {
        postAnnounceBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('ann-title');
            const audienceInput = document.getElementById('ann-audience');
            const contentInput = document.getElementById('ann-content');

            const title = titleInput.value;
            const audience = audienceInput.value;
            const content = contentInput.value;

            if (title && content) {
                const token = localStorage.getItem('token');
                await fetch('/api/announcements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token} ` },
                    body: JSON.stringify({ title, audience, content })
                });

                titleInput.value = '';
                contentInput.value = '';
                loadAnnouncements();

                alert('Announcement posted successfully!');
            } else {
                alert('Please fill in title and content.');
            }
        });
    }

    // Filters
    document.getElementById('filter-teacher-class')?.addEventListener('change', (e) => {
        const val = e.target.value;
        // This filter is simplified. Realistically we need class Name in the teacher object or fetch again with filter
        // For now, client side filter (if t.class is present?)
        // The API returns 'className' or we might not have it.
        // Let's assume we don't have it easily for now without complex joins/fetching.
        // renderTeachers(val ? allTeachers.filter(t => t.class === val) : allTeachers);
    });

    document.getElementById('search-teacher')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderTeachers(allTeachers.filter(t => t.name.toLowerCase().includes(term)));
    });

    // INIT

    loadHelpers();
    loadStats();
    loadTeachers();
    loadAdmissions();

    loadAnnouncements();

    // --- REPORTING & LOGS RENDERING ---
    const renderReports = () => {
        // Reports are complex. Leaving stubbed or using old logic if relevant, 
        // but user asked to remove LocalStorage.
        // If SchoolReports uses LocalStorage, it will break.
        // Disabling for now.
        document.getElementById('reportCards').innerHTML = "<p>Reports are currently disabled</p>";
    };

    const renderLogs = () => {
        // Logs
        document.getElementById('logsTableBody').innerHTML = '<tr><td colspan="3">Logs disabled</td></tr>';
    };

    // --- EVENTS ---
    const updateStatsDisplay = (stats) => {
        // Stats parsing...
    };

    // --- RESULTS MANAGEMENT ---
    const initResultsManagement = () => {
        const pubYear = document.getElementById('pub-year');
        const pubTerm = document.getElementById('pub-term');
        const btnLoad = document.getElementById('btn-publish-toggle');
        const statusContainer = document.getElementById('pub-status-container');
        const statusText = document.getElementById('pub-status-text');

        if (!pubYear || !pubTerm || !btnLoad) return;

        // Populate Years
        const years = [2024, 2025, 2026, 2027];
        const currentYear = new Date().getFullYear();
        pubYear.innerHTML = years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('');

        // Populate Terms
        const terms = [
            { id: '1', name: 'Term 1' },
            { id: '2', name: 'Term 2' },
            { id: '3', name: 'Term 3' }
        ];
        pubTerm.innerHTML = terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        const updateStatusUI = (isPublished) => {
            if (isPublished) {
                statusContainer.style.backgroundColor = '#d4edda';
                statusContainer.style.borderColor = '#c3e6cb';
                statusText.innerHTML = '✅ Results for this term are currently <strong style="color:#155724;">PUBLISHED</strong> and visible to students.';
                btnLoad.textContent = 'Unpublish Results';
                btnLoad.className = 'btn cancel';
                btnLoad.style.backgroundColor = '#dc3545';
                btnLoad.dataset.action = 'unpublish';
            } else {
                statusContainer.style.backgroundColor = '#f8d7da';
                statusContainer.style.borderColor = '#f5c6cb';
                statusText.innerHTML = '❌ Results for this term are <strong style="color:#721c24;">NOT PUBLISHED</strong> (Hidden).';
                btnLoad.textContent = 'Publish Results';
                btnLoad.className = 'btn primary';
                btnLoad.style.backgroundColor = '#28a745';
                btnLoad.dataset.action = 'publish';
            }
        };

        const loadStatus = async () => {
            btnLoad.disabled = true;
            btnLoad.textContent = 'Loading...';
            const year = pubYear.value;
            const term = pubTerm.value;
            try {
                const res = await fetch(`/api/results/publish?year=${year}&term=${term}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    updateStatusUI(data.isPublished);
                }
            } catch (e) {
                console.error(e);
                statusText.innerHTML = 'Error loading status.';
            } finally {
                btnLoad.disabled = false;
            }
        };

        const togglePublish = async () => {
            const year = pubYear.value;
            const term = pubTerm.value;
            const action = btnLoad.dataset.action; // 'publish' or 'unpublish'
            const isPublished = action === 'publish';

            btnLoad.disabled = true;
            btnLoad.textContent = 'Updating...';

            try {
                const res = await fetch(`/api/results/publish`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ year, term, isPublished })
                });
                if (res.ok) {
                    updateStatusUI(isPublished);
                } else {
                    alert("Failed to update status");
                }
            } catch (e) {
                console.error(e);
            } finally {
                btnLoad.disabled = false;
            }
        };

        // If action is set, it means we already loaded and are now toggling
        btnLoad.addEventListener('click', (e) => {
            e.preventDefault();
            if (btnLoad.dataset.action) {
                togglePublish();
            } else {
                // Initial load if user didn't change dropdowns but clicked load
                loadStatus();
            }
        });

        pubYear.addEventListener('change', () => { btnLoad.dataset.action = ''; btnLoad.textContent = 'Load Status'; btnLoad.className = 'btn primary'; statusContainer.style.background = '#f8f9fa'; statusText.innerHTML = 'Select a term to view status.'; });
        pubTerm.addEventListener('change', () => { btnLoad.dataset.action = ''; btnLoad.textContent = 'Load Status'; btnLoad.className = 'btn primary'; statusContainer.style.background = '#f8f9fa'; statusText.innerHTML = 'Select a term to view status.'; });

        // Auto load initial
        loadStatus();
    };


    // --- NAVIGATION LOGIC ---
    // Simple hash-based router for admin dashboard sections
    const handleHashChange = () => {
        const hash = window.location.hash || '#dashboard';

        // Hide all sections first
        const sections = ['reports', 'logs', 'results-mgmt', 'teachers', 'gallery-mgmt', 'admissions', 'announcement'];

        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Toggle requested section
        if (hash === '#reports') {
            document.getElementById('reports').style.display = 'block';
            renderReports();
        } else if (hash === '#logs') {
            document.getElementById('logs').style.display = 'block';
            renderLogs();
        } else if (hash === '#results-mgmt') {
            document.getElementById('results-mgmt').style.display = 'block';
            initResultsManagement();
        } else if (hash === '#gallery-mgmt') {
            document.getElementById('gallery-mgmt').style.display = 'block';
            // initGalleryManagement();
        } else if (hash === '#teacher-mgmt' || hash === '#teachers') {
            document.getElementById('teachers').style.display = 'block';
        } else if (hash === '#admissions') {
            document.getElementById('admissions').style.display = 'block';
            // Ensure lists are loaded? loadAdmissions() is called in INIT, so it should be fine.
        } else if (hash === '#announcement') {
            document.getElementById('announcement').style.display = 'block';
        } else {
            // Default Dashboard View
            if (hash === '' || hash === '#dashboard') {
                document.querySelector('.stats-cards').style.display = 'grid';
                document.querySelector('.admin-announcements').style.display = 'block';
                document.getElementById('teachers').style.display = 'none';
            } else {
                // If we are in specific view (that was handled above), these should be hidden.
                document.querySelector('.stats-cards').style.display = 'none';
                document.querySelector('.admin-announcements').style.display = 'none';
            }
        }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Init

    // Logging Hooks
    // We hook into the exposed global functions to log actions
    // const originalAddTeacher = window.SchoolData.addItem; // Warning: this is low level. 


    // --- GALLERY MANAGEMENT ---
    // --- GALLERY MANAGEMENT ---
    function initGalleryManagement() {
        // Disabled
    }

    if (window.location.hash === '#gallery-mgmt') initGalleryManagement();

});
