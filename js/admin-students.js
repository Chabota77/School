document.addEventListener('DOMContentLoaded', () => {
    const studentsList = document.getElementById('students-list');
    const studentForm = document.getElementById('student-form');
    const studentClassSelect = document.getElementById('student-class');
    const modalToggle = document.getElementById('addStudentModal');
    const modalTitle = document.getElementById('modal-title');

    // Check Auth
    const userString = localStorage.getItem('currentUser');
    const user = JSON.parse(userString);
    console.log('Admin Auth Check:', user);
    if (!user || user.role !== 'admin') {
        console.warn('Auth Failed. Redirecting to Admin Login.');
        window.location.href = '../admin-login.html';
        return;
    }

    const { SchoolData } = window;
    let allStudentsData = []; // Store for filtering

    // Load classes from API
    const loadClasses = async () => {
        try {
            // Fetch from API to get real Integer IDs
            const res = await fetch('/api/classes');
            if (res.ok) {
                const classes = await res.json();

                // Populate Add Student Modal
                const options = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                studentClassSelect.innerHTML = '<option value="">Select class</option>' + options;

                // Populate Filter
                const filterClass = document.getElementById('filter-class');
                if (filterClass) {
                    filterClass.innerHTML = '<option value="">All Classes</option>' +
                        classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
                }

                return classes;
            }
        } catch (e) {
            console.error('Failed to load classes', e);
        }
    };

    loadClasses();

    // Load students
    const loadStudents = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/students', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load students');

            const students = await res.json();

            // Map API data to UI structure
            allStudentsData = students.map(s => ({
                id: s.id,
                rollNo: s.roll_number || s.id,
                name: s.name, // joined from users
                age: s.age,
                gender: s.gender,
                status: s.status,
                classId: s.class_id,
                class_name: s.class_name // joined from classes
            }));

            renderTable(allStudentsData);
        } catch (err) {
            console.error(err);
            studentsList.innerHTML = '<tr><td colspan="7">Error loading students from database.</td></tr>';
        }
    };

    const renderTable = (data) => {
        if (data.length === 0) {
            studentsList.innerHTML = `<tr><td colspan="7" style="text-align: center;">No students found matching filters.</td></tr>`;
            return;
        }
        studentsList.innerHTML = data.map(s => `
            <tr>
                <td>${s.rollNo || s.id}</td>
                <td>${s.name}</td>
                <td>${s.gender || '-'}</td>
                <td>${s.age || '-'}</td>
                <td>${s.class_name || 'N/A'}</td>
                <td><span class="status ${s.status === 'Enrolled' ? 'active' : 'leave'}">${s.status}</span></td>
                <td class="actions">
                    <button class="btn edit" onclick="editStudent('${s.id}')">Edit</button>
                    <button class="btn delete" onclick="deleteStudent('${s.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    };

    // Filter Logic
    const filterStudents = () => {
        const classFilter = document.getElementById('filter-class').value;
        const searchTerm = document.getElementById('search-student').value.toLowerCase();

        const filtered = allStudentsData.filter(s => {
            const matchesClass = classFilter ? s.class_name === classFilter : true;
            const rollNo = (s.rollNo || s.id).toString();
            const matchesSearch = s.name.toLowerCase().includes(searchTerm) || rollNo.includes(searchTerm);
            return matchesClass && matchesSearch;
        });

        renderTable(filtered);
    };

    document.getElementById('filter-class')?.addEventListener('change', filterStudents);
    document.getElementById('search-student')?.addEventListener('input', filterStudents);

    // Edit/Delete helper functions
    window.editStudent = (id) => {
        const s = allStudentsData.find(st => st.id === id);
        if (!s) return;

        document.getElementById('student-id').value = s.id;
        document.getElementById('student-name').value = s.name;
        document.getElementById('student-age').value = s.age || '';
        document.getElementById('student-gender').value = s.gender || '';
        document.getElementById('student-class').value = s.classId;
        document.getElementById('student-status').value = s.status;
        modalTitle.innerText = 'Edit Student';
        modalToggle.checked = true;
    };

    window.deleteStudent = (id) => {
        if (confirm('Are you sure you want to delete this student?')) {
            SchoolData.deleteItem('students', id);
            loadStudents();
        }
    };

    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('student-id').value;
        const btn = studentForm.querySelector('button[type="submit"]');

        const studentData = {
            name: document.getElementById('student-name').value,
            age: document.getElementById('student-age').value,
            gender: document.getElementById('student-gender').value,
            class_id: document.getElementById('student-class').value,
            status: document.getElementById('student-status').value,
            password: document.getElementById('student-password').value // Capture password
        };

        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Not authenticated');

            if (id) {
                // UPDATE logic (To be implemented in server.js if needed, for now alert)
                alert("Editing not yet fully linked to DB. Please delete and re-add if needed for now.");
                // SchoolData.updateItem('students', id, studentData); 
            } else {
                // CREATE
                const res = await fetch('/api/students', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(studentData)
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to add student');
                }

                alert('Student added successfully!');
            }

            modalToggle.checked = false;
            studentForm.reset();
            document.getElementById('student-id').value = '';
            document.getElementById('student-password').value = '';
            modalTitle.innerText = 'Add New Student';

            // Reload from API
            // We need to implement loadStudents using API in this file too!
            // Currently loadStudents uses SchoolData.
            window.location.reload(); // Quick fix to fetch fresh data

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            btn.textContent = 'Save Student';
            btn.disabled = false;
        }
    });

    loadStudents();
});
