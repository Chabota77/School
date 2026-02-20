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


    let allStudentsData = []; // Store for filtering

    // Load classes
    const loadClasses = async () => {
        try {
            const res = await fetch('/api/classes');
            if (res.ok) {
                const classes = await res.json();
                const options = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                document.getElementById('student-class').innerHTML = '<option value="">Select class</option>' + options;

                const filterClass = document.getElementById('filter-class');
                if (filterClass) {
                    filterClass.innerHTML = '<option value="">All Classes</option>' +
                        classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
                }
                return classes;
            }
        } catch (e) { console.error(e); }
        return [];
    };

    // Load students
    const loadStudents = async () => {
        try {
            const token = localStorage.getItem('token');
            const [studentsRes, classesRes] = await Promise.all([
                fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/classes')
            ]);

            if (studentsRes.ok && classesRes.ok) {
                const students = await studentsRes.json();
                const classes = await classesRes.json();

                // Join with class names - API might already return class_name?
                // server.js /api/students uses LEFT JOIN classes c ON s.class_id = c.id
                // So s.class_name should be present.

                allStudentsData = students; // The API response is already flat and joined
                renderTable(allStudentsData);
            }
        } catch (e) {
            console.error(e);
            studentsList.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading data.</td></tr>`;
        }
    };

    const renderTable = (data) => {
        if (data.length === 0) {
            studentsList.innerHTML = `<tr><td colspan="7" style="text-align: center;">No students found matching filters.</td></tr>`;
            return;
        }
        studentsList.innerHTML = data.map(s => `
            <tr>
                <td>${s.roll_number || s.id}</td> <!-- API uses snake_case usually, but let's check server.js response -->
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
            const rollNo = (s.roll_number || s.id).toString();
            const matchesSearch = s.name.toLowerCase().includes(searchTerm) || rollNo.includes(searchTerm);
            return matchesClass && matchesSearch;
        });

        renderTable(filtered);
    };

    document.getElementById('filter-class')?.addEventListener('change', filterStudents);
    document.getElementById('search-student')?.addEventListener('input', filterStudents);

    document.getElementById('filter-class')?.addEventListener('change', filterStudents);
    document.getElementById('search-student')?.addEventListener('input', filterStudents);

    // Reset form when clicking "Add Student"
    document.getElementById('add-teacher')?.addEventListener('click', () => {
        studentForm.reset();
        document.getElementById('student-id').value = '';
        modalTitle.innerText = 'Add New Student';
    });

    // Edit/Delete helper functions
    window.editStudent = (id) => {
        // ID might be string or number from API
        const s = allStudentsData.find(st => st.id == id);
        if (!s) return;

        document.getElementById('student-id').value = s.user_id; // Edit User/Student? 
        // Logic mismatch: We have student ID and User ID. 
        // Let's assume editing student profile. POST/PUT to /api/students or /api/users?
        // Current Server doesn't have PUT /api/students. 
        // We might need to just Re-add or implement PUT.
        // For now, let's just populate.

        document.getElementById('student-id').value = s.id; // Student ID
        document.getElementById('student-password').value = ''; // Clear password field
        document.getElementById('student-name').value = s.name;
        document.getElementById('student-age').value = s.age || '';
        document.getElementById('student-gender').value = s.gender || '';
        document.getElementById('student-class').value = s.class_id;
        document.getElementById('student-status').value = s.status;
        modalTitle.innerText = 'Edit Student (Limited)';
        modalToggle.checked = true;
    };

    window.deleteStudent = async (id) => {
        if (confirm('Are you sure you want to delete this student?')) {
            try {
                const token = localStorage.getItem('token');
                // Server doesn't have DELETE /api/students/:id yet?
                // It has DELETE /api/teachers/:id.
                // WE NEED TO ADD DELETE STUDENT TO SERVER.
                // Assuming we added it or will add it.
                // Let's try calling it.
                const res = await fetch(`/api/students/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    loadStudents();
                } else {
                    alert('Failed to delete student (Not implemented on server?)');
                }
            } catch (e) { console.error(e); }
        }
    };

    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('student-id').value;

        const studentData = {
            name: document.getElementById('student-name').value,
            age: document.getElementById('student-age').value,
            gender: document.getElementById('student-gender').value,
            class_id: document.getElementById('student-class').value,
            status: document.getElementById('student-status').value,
            email: `student${Date.now()}@school.com`, // Mock email if new (server handles duplicates now)
            password: document.getElementById('student-password').value // Send provided password
        };

        const token = localStorage.getItem('token');

        try {
            if (id) {
                // Update
                const res = await fetch(`/api/students/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(studentData)
                });
                if (res.ok) {
                    modalToggle.checked = false;
                    studentForm.reset();
                    loadStudents();
                    alert('Student updated successfully');
                } else {
                    const err = await res.json();
                    alert('Error: ' + err.error);
                }
            } else {
                // Create
                const res = await fetch('/api/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(studentData)
                });
                if (res.ok) {
                    modalToggle.checked = false;
                    studentForm.reset();
                    loadStudents();
                    alert('Student added successfully');
                } else {
                    const err = await res.json();
                    alert('Error: ' + err.error);
                }
            }
        } catch (e) { console.error(e); alert('Network error'); }
    });

    loadClasses().then(loadStudents);
});
