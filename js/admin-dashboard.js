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
                    ` : `<span>${a.status}</span>`}
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

    window.updateAdmission = (id, status) => {
        // Find admission
        const admissions = SchoolData.getCollection('admissions');
        const adm = admissions.find(a => a.id == id);
        if (adm) {
            adm.status = status;
            SchoolData.saveDB(SchoolData.getDB()); // persist
            loadAdmissions();
            loadStats();

            // If approved, create Student AND User Account
            if (status === 'Approved') {
                // 1. Resolve Class ID (Simplified Mapping)
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
                SchoolData.addItem('students', {
                    userId: createdUser.id, // LINKED
                    name: adm.student_name,
                    classId: cls.id,
                    status: 'Enrolled',
                    guardian: adm.parent_name,
                    phone: adm.phone,
                    email: adm.email
                });

                alert(`Student enrolled! Login: ${newUser.username} / password`);
            }
        }
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

            const teacherData = {
                name: inputs[0].value,
                email: inputs[1].value,
                password: inputs[2].value || 'password',
                phone: inputs[3].value,
                subject: selects[0].value,
                class: selects[1].value,
                status: selects[2].value
            };

            if (form.dataset.updateId) {
                SchoolData.updateItem('teachers', form.dataset.updateId, teacherData);
                delete form.dataset.updateId;
            } else {
                SchoolData.addItem('teachers', teacherData);
            }

            document.getElementById('addTeacherModal').checked = false;
            form.reset();
            loadTeachers();
            loadStats();
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
                document.getElementById('teachers').style.display = 'block'; // Keep teachers on dashboard? User wants to see them.
                // Wait, if users want Teachers to be a separate tab, we should hide it on dashboard?
                // The previous code had it inline.
                // Let's hide it on default dashboard to make it a true tab.
                document.getElementById('teachers').style.display = 'none';
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

        if (!pubYear || !pubTerm) return;

        // Populate Years (Dynamic + Future)
        const years = SchoolData.getDB().academicYears || [];
        // Ensure we have a range just in case
        pubYear.innerHTML = years.map(y => `<option value="${y.id}">${y.name}</option>`).join('');

        // Populate Terms
        const terms = SchoolData.getTerms();
        pubTerm.innerHTML = terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        const checkStatus = () => {
            const y = pubYear.value;
            const t = pubTerm.value;
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

        pubBtn.onclick = () => {
            const y = pubYear.value;
            const t = pubTerm.value;
            const isPub = SchoolData.isPublished(y, t);

            if (isPub) {
                if (confirm('Are you sure you want to hide these results from students?')) {
                    SchoolData.unpublishResults(y, t);
                    checkStatus();
                }
            } else {
                if (confirm('Are you sure you want to publish these results? Students will be able to view them immediately.')) {
                    SchoolData.publishResults(y, t);
                    checkStatus();
                }
            }
        };

        pubYear.onchange = checkStatus;
        pubTerm.onchange = checkStatus;

        // Initial check
        checkStatus();
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
