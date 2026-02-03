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

    const loadHelpers = () => {
        const classes = SchoolData.getClasses();
        const subjects = SchoolData.getSubjects();

        const populateSelects = (selector, data, defaultText) => {
            const selects = document.querySelectorAll(selector);
            selects.forEach(s => {
                // Determine if filter or assignment
                if (s.id.includes('filter')) {
                    s.innerHTML = `<option value="">All ${defaultText}</option>` + data.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
                } else {
                    s.innerHTML = `<option value="">Select ${defaultText}</option>` + data.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
                }
            });
        };

        // We have to be specific because selects are generic in the HTML
        // Strategy: Attack specific IDs or context
        const subjectSelects = document.querySelectorAll('select');
        subjectSelects.forEach(s => {
            // Heuristics based on existing HTML
            if (s.innerHTML.includes('Select subject') || s.innerHTML.includes('Mathematics')) {
                s.innerHTML = `<option value="">Select subject</option>` + subjects.map(sb => `<option value="${sb.name}">${sb.name}</option>`).join('');
            }
            if (s.innerHTML.includes('Select class') || s.innerHTML.includes('Grade 7A')) {
                s.innerHTML = `<option value="">Select class</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            }
        });

        // Filters
        const teacherFilter = document.getElementById('filter-teacher-class');
        if (teacherFilter) teacherFilter.innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        const admissionFilter = document.getElementById('filter-admission-class');
        if (admissionFilter) admissionFilter.innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    };

    const loadStats = () => {
        const teachers = SchoolData.getCollection('teachers');
        const students = SchoolData.getCollection('students');
        const admissions = SchoolData.getCollection('admissions');

        // Update cards by content since they lack IDs
        const cards = Array.from(document.querySelectorAll('.card'));
        cards.forEach(card => {
            const title = card.querySelector('h3').textContent;
            const val = card.querySelector('p');
            if (title.includes('Students')) val.textContent = students.length;
            if (title.includes('Teachers')) val.textContent = teachers.length;
            if (title.includes('Admissions')) val.textContent = admissions.filter(a => a.status === 'Pending').length;
            if (title.includes('Messages')) val.textContent = '0'; // Mock
        });
    };

    const loadTeachers = () => {
        allTeachers = SchoolData.getCollection('teachers');
        renderTeachers(allTeachers);
    };

    const renderTeachers = (data) => {
        const tbody = document.querySelector('.teachers-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No teachers found.</td></tr>';
            return;
        }

        data.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t.name}</td>
                <td>${t.subject || 'N/A'}</td>
                <td>${t.class || 'N/A'}</td>
                <td><span class="status ${t.status === 'Active' ? 'active' : 'leave'}">${t.status}</span></td>
                <td class="actions">
                    <button class="btn message" onclick="alert('Message feature coming soon')">✉</button>
                    <button class="btn edit" onclick='editTeacher("${t.id}")'>✎</button>
                    <button class="btn delete" onclick="deleteTeacher('${t.id}')">🗑</button>
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
                <td>${a.date_applied}</td>
                <td>${a.phone}</td>
                <td class="actions">
                    ${a.status === 'Pending' ? `
                    <button class="btn accept" onclick="updateAdmission('${a.id}', 'Approved')">Accept</button>
                    <button class="btn reject" onclick="updateAdmission('${a.id}', 'Rejected')">Reject</button>
                    ` : (a.status === 'Approved' ? `
                        <span style="font-weight:bold; color:green; display:block; margin-bottom:5px;">Approved</span>
                        <button class="btn secondary" onclick="downloadAdmissionLetter('${a.id}')" style="font-size:0.8em; padding:5px 10px; background-color: #2b6cb0; color: white; border: none;">Download Letter</button>
                    ` : `
                        <span style="font-weight:bold; color:${a.status === 'Rejected' ? 'red' : '#666'}">${a.status}</span>
                    `)}
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    const loadAnnouncements = () => {
        const announcements = SchoolData.getCollection('announcements');
        const list = document.getElementById('announcement');
        if (!list) return;

        // Keep header
        list.innerHTML = '<h3>Recent Announcements</h3>';

        announcements.forEach(a => {
            const div = document.createElement('div');
            div.className = 'announcement-card';
            div.innerHTML = `
                <div class="announcement-header">
                    <h4>${a.title}</h4>
                    <div class="announcement-actions">
                         <button class="delete-btn" onclick="deleteAnnouncement(${a.id})">Delete</button>
                    </div>
                </div>
                <p>${a.content}</p>
                <span>Audience: ${a.audience || 'Everyone'} • ${a.date}</span>
            `;
            list.appendChild(div);
        });
    };

    // --- ACTIONS ---

    // Expose to window for inline onclicks
    window.deleteTeacher = (id) => {
        if (confirm('Delete this teacher?')) {
            SchoolData.deleteItem('teachers', id);
            loadTeachers();
            loadStats();
        }
    };

    // Helper: Download Acceptance Letter
    window.downloadAdmissionLetter = (id) => {
        const admissions = SchoolData.getCollection('admissions');
        const adm = admissions.find(a => a.id == id);
        if (!adm) {
            alert("Admission record not found.");
            return;
        }

        if (!window.jspdf) {
            alert("PDF Generator not loaded. Please refresh.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(10, 61, 98); // Blue
        doc.text("K-Lombe School", 105, 20, null, null, "center");

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Address: P.O. Box 12345, Lusaka, Zambia", 105, 30, null, null, "center");
        doc.text("Email: admissions@k-lombeschool.com", 105, 36, null, null, "center");

        doc.setLineWidth(0.5);
        doc.line(20, 42, 190, 42);

        // Body
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text("OFFICIAL ADMISSION LETTER", 105, 55, null, null, "center");

        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        const today = new Date().toLocaleDateString();
        doc.text(`Date: ${today}`, 20, 65);

        doc.text(`Dear Parent/Guardian of ${adm.student_name},`, 20, 80);

        // Retrieve generic password or actual if stored
        const username = adm.student_name.toLowerCase().replace(/\s+/g, '');

        const text = `We are pleased to inform you that your child's application for admission into ${adm.class_name} at K-Lombe School has been SUCCESSFUL for the 2026 Academic Year.\n\nYour child has been allocated specific Login Credentials to access the Student Portal:\n\nUsername: ${username}\nPassword: password\n\nPlease ensure you pay the school fees before the term begins to secure this place. We look forward to welcoming you to our family.`;

        const splitText = doc.splitTextToSize(text, 170);
        doc.text(splitText, 20, 90);

        // Signature
        doc.text("Sincerely,", 20, 160);
        doc.text("Admin Admissions", 20, 170);
        doc.text("K-Lombe School Management", 20, 175);

        // Download
        doc.save(`Acceptance_${adm.student_name.replace(/ /g, '_')}.pdf`);
    };

    window.updateAdmission = (id, status) => {
        // 1. Initial Check (Read-only)
        const allAdmissions = SchoolData.getCollection('admissions');
        const existingAdm = allAdmissions.find(a => a.id == id);

        if (!existingAdm) return;
        if (existingAdm.status !== 'Pending') {
            alert('This admission record is already processed.');
            return;
        }

        // 2. Perform Update & Persist
        const adm = SchoolData.updateItem('admissions', id, { status: status });

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

        // Processing Logic
        if (status === 'Approved') {
            // 1. Resolve Class
            const classes = SchoolData.getClasses();
            const cls = classes.find(c => c.name === adm.class_name) || classes[0];

            // 2. Create User
            const newUser = {
                username: adm.student_name.toLowerCase().replace(/\s+/g, ''),
                password: 'password', // Default
                role: 'student',
                name: adm.student_name
            };
            const createdUser = SchoolData.addItem('users', newUser);

            // 3. Create Student linked to User
            const allStudents = SchoolData.getCollection('students');
            const maxRoll = allStudents.reduce((max, s) => Math.max(max, s.rollNo || 0), 2500000);
            const nextRollNo = maxRoll + 1;

            SchoolData.addItem('students', {
                userId: createdUser.id, // LINKED
                name: adm.student_name,
                classId: cls.id,
                status: 'Enrolled',
                guardian: adm.parent_name,
                phone: adm.phone,
                email: adm.email,
                rollNo: nextRollNo
            });

            // 4. Auto-Download Letter
            window.downloadAdmissionLetter(id);

            if (window.SchoolUtils) window.SchoolUtils.showToast('Admission Approved & Letter Generated', 'success');
        } else {
            if (window.SchoolUtils) window.SchoolUtils.showToast('Admission Rejected', 'info');
        }

        loadStats();
    };

    window.deleteAnnouncement = (id) => {
        if (confirm('Delete announcement?')) {
            SchoolData.deleteItem('announcements', id);
            loadAnnouncements();
        }
    };

    window.editTeacher = (id) => {
        const t = allTeachers.find(t => t.id == id);
        if (!t) return;

        // Populate Modal
        const modalToCheck = document.getElementById('addTeacherModal');
        const form = document.querySelector('#addTeacherModal + .modal form');

        // Inputs
        const inputs = form.querySelectorAll('input');
        inputs[0].value = t.name;
        inputs[1].value = t.email;
        inputs[3].value = t.phone; // skipping password [2]

        const selects = form.querySelectorAll('select');
        selects[0].value = t.subject;
        selects[1].value = t.class;
        selects[2].value = t.status;

        // Change button to valid 'Update' state or handle logic
        // For simplicity, we delete old and add new on save, or use updateItem
        // Let's attach the ID to the form
        form.dataset.updateId = id;

        modalToCheck.checked = true;
    };

    // --- EVENT LISTENERS ---

    // Add Teacher
    const saveTeacherBtn = document.querySelector('#addTeacherModal + .modal .btn.save');
    if (saveTeacherBtn) {
        // Remove old listeners (by cloning? No, just replace logic)
        // app.js might have added one. We should prioritize this script.

        saveTeacherBtn.onclick = (e) => {
            e.preventDefault();
            const form = document.querySelector('#addTeacherModal + .modal form');
            const inputs = form.querySelectorAll('input');
            const selects = form.querySelectorAll('select');

            const name = inputs[0].value;
            const email = inputs[1].value;
            const password = inputs[2].value; // validation needed?
            const phone = inputs[3].value;

            if (!email || !name) {
                alert('Name and Email are required.');
                return;
            }

            // 1. Manage User Account (Login)
            let userId = null;
            const users = SchoolData.getCollection('users');

            // Search for existing user by email (username)
            // Note: If editing, we might want to find by ID, but for now email match is safe enough or we find by teacher.userId
            let existingUser = users.find(u => u.username === email || u.username === email.toLowerCase());

            if (form.dataset.updateId) {
                // EDIT MODE
                const teacher = SchoolData.getCollection('teachers').find(t => t.id == form.dataset.updateId);
                if (teacher && teacher.userId) {
                    existingUser = users.find(u => u.id === teacher.userId);
                }

                if (existingUser) {
                    // Update credentials
                    SchoolData.updateItem('users', existingUser.id, {
                        username: email, // sync email change
                        password: password || existingUser.password, // only update if provided
                        name: name
                    });
                    userId = existingUser.id;
                } else {
                    // Create if missing (was legacy?)
                    const newUser = SchoolData.addItem('users', {
                        username: email,
                        password: password || 'password',
                        role: 'teacher',
                        name: name
                    });
                    userId = newUser.id;
                }

                // Update Teacher
                SchoolData.updateItem('teachers', form.dataset.updateId, {
                    name, email, phone,
                    subject: selects[0].value,
                    class: selects[1].value,
                    status: selects[2].value,
                    userId: userId // ensure link
                });
                delete form.dataset.updateId;

            } else {
                // ADD MODE
                if (existingUser) {
                    alert('A user with this email already exists.');
                    return;
                }

                const newUser = SchoolData.addItem('users', {
                    username: email,
                    password: password || 'password',
                    role: 'teacher',
                    name: name
                });
                userId = newUser.id;

                // Create Teacher
                SchoolData.addItem('teachers', {
                    name, email, phone,
                    subject: selects[0].value,
                    class: selects[1].value,
                    status: selects[2].value,
                    userId: userId
                });
            }

            document.getElementById('addTeacherModal').checked = false;
            form.reset();
            loadTeachers();
            loadStats();
            if (window.SchoolUtils) window.SchoolUtils.showToast('Teacher saved with login credentials.', 'success');
        };
    }

    // Post Announcement
    const postAnnounceBtn = document.querySelector('.announcement-form .btn.primary');
    if (postAnnounceBtn) {
        postAnnounceBtn.onclick = (e) => {
            e.preventDefault();
            const pd = document.querySelector('.announcement-form');
            const title = pd.querySelector('input').value;
            const audience = pd.querySelector('select').value;
            const content = pd.querySelector('textarea').value;

            if (title && content) {
                SchoolData.addItem('announcements', {
                    title, audience, content, date: new Date().toISOString().split('T')[0]
                });
                pd.querySelector('input').value = '';
                pd.querySelector('textarea').value = '';
                loadAnnouncements();
            }
        };
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
        const sections = ['reports', 'logs', 'results-mgmt', 'teachers', 'gallery-mgmt', 'admissions'];

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
            initGalleryManagement();
        } else if (hash === '#teacher-mgmt' || hash === '#teachers') {
            document.getElementById('teachers').style.display = 'block';
        } else if (hash === '#admissions') {
            document.getElementById('admissions').style.display = 'block';
            loadAdmissions();
        } else if (hash === '#announcement') {
            document.querySelector('.admin-announcements').style.display = 'block';
            // Hide stats cards for cleaner view? Or show them? 
            // If we treat it as a separate page, hide stats.
        } else {
            // Default Dashboard View
            // If no match, show main dashboard sections if we want to show stats, announcements etc on default "#dashboard"
            // The default view seems to include stats, announcements, etc in the main flow.
            // But we wrapped teachers in a hidden section now.
            // We should ensure that checking hash '#dashboard' or empty shows stats and hides specific overlays?
            // Actually, the structure is:
            // <main>
            //   <header>...</header>
            //   <section class="stats-cards">...</section>
            //   <section class="admin-announcements">...</section>
            //   <section id="teachers" hidden>...</section>
            //   <div id="gallery-mgmt" hidden>...</div>
            // </main>

            // So default means showing stats & announcements.
            // We should toggle those? Or are they always visible?
            // If we hide dashboard content when showing overlays (gallery/results), the dashboard becomes cleaner.

            // Let's implement a clean toggle:
            // If hash is specific, hide MAIN DASHBOARD elements (Stats, Announcements).
            // Show only the target.

            if (hash === '' || hash === '#dashboard') {
                document.querySelector('.stats-cards').style.display = 'grid';
                document.querySelector('.admin-announcements').style.display = 'block';
                document.getElementById('teachers').style.display = 'none';
            } else if (hash === '#announcement') {
                // Standalone Announcement View
                document.querySelector('.stats-cards').style.display = 'none';
                document.querySelector('.admin-announcements').style.display = 'block';
            } else {
                document.querySelector('.stats-cards').style.display = 'none';
                document.querySelector('.admin-announcements').style.display = 'none';
            }
        }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Init

    // --- RESULTS MANAGEMENT ---
    const initResultsManagement = () => {
        const pubYear = document.getElementById('pub-year');
        const pubTerm = document.getElementById('pub-term');
        const pubBtn = document.getElementById('btn-publish-toggle');
        const statusText = document.getElementById('pub-status-text');

        if (!pubYear || !pubTerm || !pubBtn) {
            console.error('Results elements not found in DOM.');
            return;
        }

        // Populate Years (Dynamic + Future) if empty
        if (pubYear.options.length === 0) {
            const years = SchoolData.getDB().academicYears || [];
            pubYear.innerHTML = years.map(y => `<option value="${y.id}">${y.name}</option>`).join('');
        }

        // Populate Terms if empty
        if (pubTerm.options.length === 0) {
            const terms = SchoolData.getTerms() || [];
            pubTerm.innerHTML = terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }

        const checkStatus = () => {
            const y = pubYear.value;
            const t = pubTerm.value;

            if (!y || !t) {
                pubBtn.textContent = 'Setup Required';
                pubBtn.disabled = true;
                return;
            }
            pubBtn.disabled = false;

            const isPub = SchoolData.isPublished(y, t);

            if (isPub) {
                pubBtn.textContent = 'Unpublish Results';
                pubBtn.className = 'btn reject'; // Red for danger/undo
                statusText.innerHTML = `✅ Results for ${y} ${t} are LIVE (Visible to Students).`;
                statusText.style.color = 'green';
            } else {
                pubBtn.textContent = 'Publish Results';
                pubBtn.className = 'btn primary';
                statusText.innerHTML = `🔒 Results for ${y} ${t} are HIDDEN.`;
                statusText.style.color = '#666';
            }
        };

        // Attach Listener (Avoid multiple attachments by assigning onclick)
        pubBtn.onclick = (e) => {
            e.preventDefault();
            const y = pubYear.value;
            const t = pubTerm.value;
            const isPub = SchoolData.isPublished(y, t);

            const modal = document.getElementById('confirmModal');
            const title = document.getElementById('confirm-title');
            const msg = document.getElementById('confirm-msg');
            const yesBtn = document.getElementById('confirm-yes');
            const cancelBtn = document.getElementById('confirm-cancel');

            // Setup Modal
            if (isPub) {
                title.textContent = 'Unpublish Results?';
                msg.textContent = `Are you sure you want to HIDE results for ${y} ${t}? Students will lose access immediately.`;
                yesBtn.className = 'btn reject';
                yesBtn.textContent = 'Unpublish';
            } else {
                title.textContent = 'Publish Results?';
                msg.textContent = `Are you sure you want to PUBLISH results for ${y} ${t}? Students will be able to view them immediately.`;
                yesBtn.className = 'btn primary';
                yesBtn.textContent = 'Publish Now';
            }

            // Show Modal
            modal.checked = true;

            // Handle Confirm
            yesBtn.onclick = () => {
                if (isPub) {
                    SchoolData.unpublishResults(y, t);
                } else {
                    SchoolData.publishResults(y, t);
                }
                checkStatus();
                modal.checked = false;
                window.SchoolUtils.showToast(isPub ? 'Results Unpublished' : 'Results Published', 'success');
            };

            // Handle Cancel (Optional cleanup)
            cancelBtn.onclick = () => {
                modal.checked = false;
            };
        };

        pubYear.onchange = checkStatus;
        pubTerm.onchange = checkStatus;

        // Initial check
        checkStatus();
        console.log('Results Management Initialized with Modal');
    };

    // Logging Hooks
    // We hook into the exposed global functions to log actions
    const originalAddTeacher = window.SchoolData.addItem; // Warning: this is low level. 
    // better to add logs in the specific handlers


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
