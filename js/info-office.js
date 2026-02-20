document.addEventListener('DOMContentLoaded', () => {
    // AUTH
    const user = window.SchoolAuth.requireAuth('info_officer');
    if (!user) return;

    const { SchoolUtils } = window;

    // --- NAVIGATION ---
    const handleHashChange = () => {
        const hash = window.location.hash || '#dashboard';

        // Hide all sections
        const sections = ['students', 'admissions', 'announcements'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Dashboard/Stats handling
        if (hash === '#dashboard' || hash === '') {
            document.querySelector('.stats-cards').style.display = 'grid';
            document.getElementById('dashboard').style.display = 'block'; // Main container
        } else {
            document.querySelector('.stats-cards').style.display = 'none';
            // Show target
            const targetId = hash.replace('#', '');
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.style.display = 'block';
        }

        // Active Link
        document.querySelectorAll('.admin-sidebar nav a').forEach(a => {
            a.classList.remove('active');
            if (a.getAttribute('href') === hash) a.classList.add('active');
        });
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Init

    // --- LOADERS ---

    async function loadStats() {
        const token = localStorage.getItem('token');
        try {
            // We can reuse /api/stats which returns { totalStudents, totalTeachers, newAdmissions, pendingMessages }
            // Or fetch individually if needed. Using /api/stats is efficient.
            const response = await fetch('/api/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const stats = await response.json();

            document.getElementById('total-students').textContent = stats.totalStudents || 0;
            document.getElementById('pending-admissions').textContent = stats.newAdmissions || 0;
            document.getElementById('total-teachers').textContent = stats.totalTeachers || 0;
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    }

    async function loadStudents() {
        const tbody = document.getElementById('studentsTableBody');
        const filterInput = document.getElementById('search-student');
        const token = localStorage.getItem('token');

        try {
            const response = await fetch('/api/students', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const list = await response.json();

            // Render Function
            const render = (data) => {
                if (!tbody) return;
                tbody.innerHTML = '';
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5">No students found.</td></tr>';
                    return;
                }

                tbody.innerHTML = data.map(s => `
                    <tr>
                        <td>${s.id}</td>
                        <td>${s.name}</td>
                        <td>${s.class_name || 'N/A'}</td>
                        <td>${s.gender || '-'}</td>
                        <td><span class="status active">${s.status}</span></td>
                    </tr>
                `).join('');
            };

            render(list);

            // Filter Logic
            if (filterInput) {
                filterInput.oninput = (e) => {
                    const term = e.target.value.toLowerCase();
                    render(list.filter(s =>
                        s.name.toLowerCase().includes(term) ||
                        (s.id && String(s.id).includes(term))
                    ));
                };
            }
        } catch (err) {
            console.error('Error loading students:', err);
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="color:red">Error loading students</td></tr>';
        }
    }

    async function loadAdmissions() {
        const tbody = document.getElementById('admissionsTableBody');
        const token = localStorage.getItem('token');

        if (!tbody) return;

        try {
            const response = await fetch('/api/admissions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const admissions = await response.json();

            if (admissions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No pending admissions.</td></tr>';
                return;
            }

            tbody.innerHTML = admissions.map(a => `
                <tr>
                    <td>${a.student_name}</td>
                     <td>${a.class_name || 'N/A'}</td>
                    <td>${a.date_applied || 'N/A'}</td>
                    <td><span class="status ${a.status === 'Pending' ? 'pending' : (a.status === 'Approved' ? 'active' : 'unpaid')}">${a.status}</span></td>
                    <td>
                        ${a.status === 'Pending' ? `
                            <button class="btn accept" onclick="window.approveAdmission('${a.id}')">Approve</button>
                        ` : ''}
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Error loading admissions:', err);
            tbody.innerHTML = '<tr><td colspan="5" style="color:red">Error loading admissions</td></tr>';
        }
    }

    // --- ACTIONS ---

    // Mimic Admin's updateAdmission logic
    // Mimic Admin's updateAdmission logic
    window.approveAdmission = async (id) => {
        if (!confirm('Approve this admission? This will automatically enroll the student.')) return;
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`/api/admissions/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'Approved' })
            });

            if (response.ok) {
                SchoolUtils.showToast('Admission Approved & Student Enrolled', 'success');
                // Refresh data
                loadAdmissions();
                loadStats();
                loadStudents(); // To show the new student
            } else {
                const err = await response.json();
                SchoolUtils.showToast(err.error || 'Failed to approve', 'error');
            }
        } catch (err) {
            console.error('Approval Error:', err);
            SchoolUtils.showToast('Network error', 'error');
        }
    };
});
