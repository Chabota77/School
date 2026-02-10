document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') {
        window.location.href = '../login.html';
        return;
    }

    const { SchoolData } = window;

    let allTeachers = []; // Store for filtering
    let allAdmissions = []; // Store for filtering

    // --- LOADERS ---


    // --- API LOADERS ---

    const loadHelpers = async () => {
        try {
            // Wait for DB data to be ensured via data.js (or fetch from API if we had endpoints for classes)
            // For now, classes/subjects are static in SchoolData or API?
            // Let's assume SchoolData still holds 'metadata' like classes/subjects which are rarely changed.
            const classes = SchoolData.getClasses();
            const subjects = SchoolData.getSubjects();

            const populateSelects = (selector, data, defaultText) => {
                const selects = document.querySelectorAll(selector);
                selects.forEach(s => {
                    if (s.id.includes('filter')) {
                        s.innerHTML = `<option value="">All ${defaultText}</option>` + data.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
                    } else {
                        s.innerHTML = `<option value="">Select ${defaultText}</option>` + data.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
                    }
                });
            };

            // Specific targeting for Add Teacher Modal
            const form = document.querySelector('#addTeacherModal + .modal form');
            if (form) {
                const selects = form.querySelectorAll('select');
                // selects[0] is Subject, selects[1] is Class, selects[2] is Status
                if (selects[0]) selects[0].innerHTML = `<option value="">Select Subject</option>` + subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
                if (selects[1]) selects[1].innerHTML = `<option value="">Select Class</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            }

            // Filters
            const teacherFilter = document.getElementById('filter-teacher-class');
            if (teacherFilter) teacherFilter.innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

            const admissionFilter = document.getElementById('filter-admission-class');
            if (admissionFilter) admissionFilter.innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        } catch (e) {
            console.error("Error loading helpers", e);
        }
    };

    const loadStats = async () => {
        try {
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
            // Parallel Fetch
            const [teachersVs, studentsVs, admissionsVs] = await Promise.all([
                fetch('/api/teachers', { headers }).then(res => {
                    if (!res.ok) throw new Error(`Teachers: ${res.statusText}`);
                    return res.json();
                }),
                fetch('/api/students', { headers }).then(res => {
                    if (!res.ok) throw new Error(`Students: ${res.statusText}`);
                    return res.json();
                }),
                Promise.resolve(SchoolData.getCollection('admissions'))
            ]);

            // If /api/students doesn't exist yet, fallback to SchoolData
            const studentCount = (Array.isArray(studentsVs) ? studentsVs.length : SchoolData.getCollection('students').length);
            const teacherCount = (Array.isArray(teachersVs) ? teachersVs.length : 0);
            const admissionCount = admissionsVs.filter(a => a.status === 'Pending').length;

            const cards = Array.from(document.querySelectorAll('.card'));
            cards.forEach(card => {
                const title = card.querySelector('h3').textContent;
                const val = card.querySelector('p');
                if (title.includes('Students')) val.textContent = studentCount;
                if (title.includes('Teachers')) val.textContent = teacherCount;
                if (title.includes('Admissions')) val.textContent = admissionCount;
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
            // Ensure properties match API response (snake_case from DB usually, but our API might return mixed?)
            // Check server.js /api/teachers response format. It does `SELECT * FROM teachers`, so snake_case keys or sqlite default.
            // sqlite default is usually col name.

            tr.innerHTML = `
                <td>${t.name}</td>
                 <!-- We need to resolve IDs to Names if the DB returns IDs -->
                <td>${t.email}</td> 
                <td>${t.phone || 'N/A'}</td>
                <td><span class="status ${t.status === 'Active' ? 'active' : 'leave'}">${t.status}</span></td>
                <td class="actions">
                    <button class="btn edit" onclick='editTeacher(${JSON.stringify(t)})'>Edit</button>
                    <button class="btn delete" onclick="deleteTeacher('${t.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };




    const loadAdmissions = () => {
        allAdmissions = SchoolData.getCollection('admissions');
        renderAdmissions(allAdmissions);
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
                <td>${a.class_name}</td>
                <td>${a.gender || 'N/A'}</td>  <!-- CHANGED TO GENDER -->
                <td>${a.date_applied}</td>
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
        if (confirm('Are you sure you want to CLEAR ALL admissions? This cannot be undone.')) {
            const db = SchoolData.getDB();
            db.admissions = [];
            SchoolData.saveDB(db);
            loadAdmissions();
            loadStats();
        }
    };

    const loadAnnouncements = () => {
        const announcements = SchoolData.getCollection('announcements');
        const list = document.getElementById('announcement-list-container');
        if (!list) return;

        list.innerHTML = '';

        if (announcements.length === 0) {
            list.innerHTML = '<p style="color:#64748b; font-style:italic;">No announcements posted.</p>';
            return;
        }

        announcements.forEach(a => {
            const div = document.createElement('div');
            // Determine audience class
            let audClass = 'audience-everyone';
            if (a.audience === 'Teachers' || a.audience === 'Teachers only') audClass = 'audience-teachers';
            else if (a.audience === 'Pupils' || a.audience === 'Pupils only') audClass = 'audience-pupils';

            div.className = `announcement-card ${audClass}`;
            div.innerHTML = `
                <div class="announcement-header">
                    <h4>${a.title}</h4>
                    <button class="delete-btn-icon" onclick="deleteAnnouncement('${a.id}')" title="Delete">
                        <i class="fas fa-trash"></i> &#128465;
                    </button>
                </div>
                <div class="announcement-body">
                    <p>${a.content}</p>
                </div>
                <div class="announcement-meta">
                    <div class="meta-badges">
                        <span class="badge audience">${a.audience || 'Everyone'}</span>
                    </div>
                    <span>${a.date}</span>
                </div>
            `;
            list.appendChild(div);
        });
    };

    // --- ACTIONS ---

    // Expose to window for inline onclicks
    window.deleteTeacher = async (id) => {
        if (confirm('Delete this teacher? This will also remove their access.')) {
            try {
                const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
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
        // Teacher object is passed directly or we fetch it. 
        // Note: The previous code passed "id" but we injected object in render.
        // If passed as object from render: onclick='editTeacher(${JSON.stringify(t)})'

        // Populate Modal
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
        if (selects[0]) selects[0].value = t.subject || ''; // Assuming text match
        if (selects[1]) selects[1].value = t.class || '';
        if (selects[2]) selects[2].value = t.status || 'Active';

        // Attach ID
        form.dataset.updateId = t.id;

        modalToCheck.checked = true;
    };

    // --- LEGACY/LOCAL STORAGE ADAPTERS (Announcements, etc - keep local for now as per instructions to only fix specific things) ---

    // Helper: Download Acceptance Letter
    window.downloadAdmissionLetter = (id) => {
        const admissions = SchoolData.getCollection('admissions');
        const adm = admissions.find(a => a.id == id);
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

    window.updateAdmission = (id, status) => {
        // Find admission
        const admissions = SchoolData.getCollection('admissions');
        const adm = admissions.find(a => a.id == id);
        if (adm) {
            // FIX: Use correctly persisted update
            if (adm.status !== 'Pending' && status === 'Approved') {
                // allow re-download if approved?
                if (adm.status === 'Approved') {
                    downloadAdmissionLetter(id);
                    return;
                }
            }

            SchoolData.updateItem('admissions', id, { status: status });
            // adm.status = status; 
            // SchoolData.saveDB(SchoolData.getDB()); // persist - using updateItem is safer as per previous fix

            // loadAdmissions(); // Don't reload entire table, update UI locally
            loadStats();

            // UI UPDATE: Replace buttons with Status AND Button
            const btnFn = document.querySelector(`button[onclick*="updateAdmission('${id}', 'Approved')"]`);
            if (btnFn) {
                const td = btnFn.parentElement;
                if (status === 'Approved') {
                    td.innerHTML = `
                        <span style="font-weight:bold; color:green; display:block; margin-bottom:5px;">Approved</span>
                        <button class="btn secondary" onclick="downloadAdmissionLetter('${id}')" style="font-size:0.8em; padding:5px 10px; background-color: #2b6cb0; color: white; border: none;">Download Letter</button>
                    `;
                } else {
                    td.innerHTML = `<span style="font-weight:bold; color:red;">Rejected</span>`;
                }
            }

            // If approved, create Student AND User Account
            if (status === 'Approved') {
                // 1. Resolve Class ID (Simplified Mapping)
                const classes = SchoolData.getClasses();
                const cls = classes.find(c => c.name === adm.class_name) || classes[0];

                // 2. Create User (Local - kept for compatibility)
                const newUser = {
                    username: adm.student_name.toLowerCase().replace(/\s+/g, ''),
                    password: 'password', // Default
                    role: 'student',
                    name: adm.student_name
                };
                const createdUser = SchoolData.addItem('users', newUser);

                // 3. Create Student linked to User (Local)
                SchoolData.addStudent({
                    userId: createdUser.id, // LINKED
                    name: adm.student_name,
                    classId: cls.id,
                    status: 'Enrolled',
                    guardian: adm.parent_name,
                    phone: adm.phone,
                    email: adm.email
                });

                // 4. SYNC TO BACKEND (Fix for Stats/Payments)
                // We send this to the API so it appears in SQLite-based views (Payments, Stats)
                // FIRST: Fetch classes from backend to get the real Integer ID, not the string ID
                fetch('/api/classes')
                    .then(res => res.json())
                    .then(backendClasses => {
                        const backendClass = backendClasses.find(c => c.name === adm.class_name);
                        const realClassId = backendClass ? backendClass.id : null;

                        const apiPayload = {
                            name: adm.student_name,
                            age: adm.age || 0, // Fallback
                            gender: adm.gender || 'Not Specified',
                            class_id: realClassId || cls.id, // Prefer backend ID, fallback to local (though local is likely string)
                            status: 'Enrolled'
                        };

                        return fetch('/api/students', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify(apiPayload)
                        });
                    })
                    .then(res => res.json())
                    .then(data => {
                        console.log('Student synced to backend:', data);
                        loadStats(); // Reload stats after backend sync
                    })
                    .catch(err => console.error('Failed to sync student to backend:', err));

                // 5. Auto-Download Letter
                downloadAdmissionLetter(id);

                if (window.SchoolUtils) window.SchoolUtils.showToast('Admission Approved & Letter Generated', 'success');
            }
        }
    };

    window.deleteAnnouncement = (id) => {
        console.log('Attempting to delete announcement with ID:', id);
        if (confirm('Delete announcement?')) {
            SchoolData.deleteItem('announcements', id);
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
            const password = inputs[2].value; // New teacher password
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
                    // subject_id: selects[0].value, // If we were using IDs
                    // class_id: selects[1].value,
                    status: selects[2].value,
                    password: password || undefined // Only send if provided
                };

                let url = '/api/teachers';
                let method = 'POST';

                if (form.dataset.updateId) {
                    url = `/api/teachers/${form.dataset.updateId}`;
                    method = 'PUT';
                }

                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
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
                    alert('Error: ' + (err.error || 'Failed to save teacher'));
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
        postAnnounceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('ann-title');
            const audienceInput = document.getElementById('ann-audience');
            const contentInput = document.getElementById('ann-content');

            const title = titleInput.value;
            const audience = audienceInput.value;
            const content = contentInput.value;

            if (title && content) {
                // Post to API if available, else local
                // Assuming local for now as per previous code
                SchoolData.addItem('announcements', {
                    title, audience, content, date: new Date().toISOString().split('T')[0]
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
        renderTeachers(val ? allTeachers.filter(t => t.class === val) : allTeachers);
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
        const reportCards = document.getElementById('reportCards');
        if (!reportCards) return;
        reportCards.innerHTML = '';

        const classes = SchoolData.getClasses();
        classes.forEach(c => {
            const stats = window.SchoolReports.getClassStats(c.id);
            if (stats) {
                const div = document.createElement('div');
                div.className = 'card';
                div.innerHTML = `
                    <h3>${c.name} Performance</h3>
                    <p>Avg: ${stats.averageScore}%</p>
                    <small>Students: ${stats.totalStudents} | Pass Rate: ${stats.passRate}%</small>
                `;
                reportCards.appendChild(div);
            }
        });
    };

    const renderLogs = () => {
        const logs = window.SchoolUtils.getLogs();
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No system logs found.</td></tr>';
            return;
        }

        logs.forEach(log => {
            tbody.innerHTML += `
                <tr>
                    <td>${log.timestamp}</td>
                    <td>${log.action}</td>
                    <td>${log.details}</td>
                </tr>
            `;
        });
    };

    // --- NAVIGATION LOGIC ---
    // Simple hash-based router for admin dashboard sections
    const handleHashChange = () => {
        const hash = window.location.hash || '#dashboard';

        // Hide all sections first
        // Hide all sections first
        const sections = ['reports', 'logs', 'results-mgmt', 'teachers', 'gallery-mgmt', 'admissions', 'announcement'];

        sections.forEach(id => {

            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Toggle requested section
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
            initGalleryManagement();
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

    // --- RESULTS MANAGEMENT ---
    const initResultsManagement = () => {
        try {
            const pubYear = document.getElementById('pub-year');
            const pubTerm = document.getElementById('pub-term');
            const pubBtn = document.getElementById('btn-publish-toggle');
            const statusText = document.getElementById('pub-status-text');

            if (!pubYear || !pubTerm) return;

            // Populate Years (Current & Past ONLY)
            const db = SchoolData.getDB();
            const allYears = db.academicYears || [];
            const currentSystemYear = new Date().getFullYear();

            // Filter: Allow years <= currentSystemYear
            let visibleYears = allYears.filter(y => parseInt(y.id) <= currentSystemYear);

            // Fallback: If no years found (e.g. data only has future years?), Just show all or default
            if (visibleYears.length === 0) {
                console.warn('No past/current years found. Showing all.');
                visibleYears = allYears;
            }

            pubYear.innerHTML = visibleYears.map(y => `<option value="${y.id}">${y.name}</option>`).join('');

            // Auto-select Current Year
            const currentYearObj = visibleYears.find(y => parseInt(y.id) === currentSystemYear);
            if (currentYearObj) {
                pubYear.value = currentYearObj.id;
            } else if (visibleYears.length > 0) {
                pubYear.value = visibleYears[0].id; // Default to first available
            }

            // Populate Terms
            const terms = SchoolData.getTerms();
            pubTerm.innerHTML = terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

            const statusContainer = document.getElementById('pub-status-container');

            const checkStatus = () => {
                const y = pubYear.value;
                const t = pubTerm.value;
                if (!y || !t) return; // Guard

                const isPub = SchoolData.isPublished(y, t);

                if (isPub) {
                    pubBtn.textContent = 'Unpublish Results';
                    pubBtn.className = 'btn reject'; // Red for danger
                    pubBtn.style.backgroundColor = '#e53e3e';

                    statusContainer.style.backgroundColor = '#def7ec';
                    statusContainer.style.border = '1px solid #38a169';
                    statusText.innerHTML = `✅ Results for ${y} ${t} are <strong>PUBLISHED</strong>.`;
                    statusText.style.color = '#047857';
                } else {
                    pubBtn.textContent = 'Publish Results';
                    pubBtn.className = 'btn primary';
                    pubBtn.style.backgroundColor = ''; // Reset

                    statusContainer.style.backgroundColor = '#f3f4f6';
                    statusContainer.style.border = '1px dashed #9ca3af';
                    statusText.innerHTML = `🔒 Results for ${y} ${t} are <strong>PRIVATE</strong>.`;
                    statusText.style.color = '#4b5563';
                }
            };

            pubBtn.onclick = () => {
                const y = pubYear.value;
                const t = pubTerm.value;
                const isPub = SchoolData.isPublished(y, t);

                if (isPub) {
                    if (confirm('Are you sure you want to HIDE results?')) {
                        SchoolData.unpublishResults(y, t);
                        checkStatus();
                    }
                } else {
                    if (confirm('Are you sure you want to PUBLISH results?')) {
                        SchoolData.publishResults(y, t);
                        checkStatus();
                    }
                }
            };

            pubYear.onchange = checkStatus;
            pubTerm.onchange = checkStatus;

            // Initial check
            checkStatus();

        } catch (e) {
            console.error('Error in initResultsManagement:', e);
            alert('Error loading Results Management: ' + e.message);
        }
    };

    // Logging Hooks
    // We hook into the exposed global functions to log actions
    const originalAddTeacher = window.SchoolData.addItem; // Warning: this is low level. 


    // --- GALLERY MANAGEMENT ---
    function initGalleryManagement() {
        const grid = document.getElementById('adminGalleryGrid');
        const form = document.getElementById('addGalleryForm');

        if (!grid || !form) return;

        // Render Admin Gallery Grid
        function renderAdminGallery() {
            const images = window.SchoolData.getGallery();
            grid.innerHTML = images.map(img => `
                <div class="gallery-item" style="background:white; padding:10px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); position:relative;">
                    <img src="${img.url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">
                    <div style="font-size:12px; font-weight:600; margin-top:8px; color:#333;">${img.caption}</div>
                    <div style="font-size:10px; color:#666;">${img.category}</div>
                    <button onclick="deleteGalleryImage(${img.id})" style="background:#dc2626; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:10px; cursor:pointer; margin-top:8px; width:100%;">Delete</button>
                </div>
            `).join('');
        }

        // Add Image
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('imgUpload');
            const urlInput = document.getElementById('imgUrl');
            const caption = document.getElementById('imgCaption').value;
            const category = document.getElementById('imgCategory').value;

            let finalImageUrl = '';

            // Helper to read file
            const readFile = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            const btn = form.querySelector('button');
            const originalBtnText = btn.textContent;
            btn.textContent = 'Processing...';
            btn.disabled = true;

            try {
                if (fileInput.files && fileInput.files[0]) {
                    const file = fileInput.files[0];
                    if (file.size > 2 * 1024 * 1024) { // 2MB Limit
                        alert('File is too large! Please upload images under 2MB.');
                        throw new Error('File too large');
                    }
                    finalImageUrl = await readFile(file);
                } else if (urlInput.value.trim() !== '') {
                    finalImageUrl = urlInput.value.trim();
                } else {
                    alert('Please provide either an Image File or an Image URL.');
                    throw new Error('No image source');
                }

                const db = window.SchoolData.getDB();
                if (!db.galleryImages) db.galleryImages = [];

                const newId = db.galleryImages.length > 0 ? Math.max(...db.galleryImages.map(i => i.id)) + 1 : 1;

                db.galleryImages.push({
                    id: newId,
                    url: finalImageUrl,
                    caption,
                    category
                });

                window.SchoolData.saveDB(db);
                form.reset();
                renderAdminGallery();
                alert('Image added to gallery!');

            } catch (err) {
                console.error(err);
            } finally {
                btn.textContent = originalBtnText;
                btn.disabled = false;
            }
        });

        // Delete Image (Exposed Globally)
        window.deleteGalleryImage = (id) => {
            if (confirm('Are you sure you want to remove this image?')) {
                const db = window.SchoolData.getDB();
                db.galleryImages = db.galleryImages.filter(img => img.id !== id);
                window.SchoolData.saveDB(db);
                renderAdminGallery();
            }
        };

        renderAdminGallery();
    }

    // Init Gallery if we are already on the text
    if (window.location.hash === '#gallery-mgmt') initGalleryManagement();

});
