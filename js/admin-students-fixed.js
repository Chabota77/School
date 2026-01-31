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

    // Load classes
    const classes = SchoolData.getClasses();
    const options = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    studentClassSelect.innerHTML = '<option value="">Select class</option>' + options;
    const filterClass = document.getElementById('filter-class');
    if (filterClass) {
        filterClass.innerHTML = '<option value="">All Classes</option>' +
            classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }

    // Load students
    const loadStudents = () => {
        const students = SchoolData.getCollection('students');
        // Join with class names
        allStudentsData = students.map(s => {
            const cls = classes.find(c => c.id === s.classId);
            return {
                ...s,
                class_name: cls ? cls.name : 'Unknown',
                class_id: s.classId // ensure consistency
            };
        });
        renderTable(allStudentsData);
    };

    const renderTable = (data) => {
        if (data.length === 0) {
            studentsList.innerHTML = `<tr><td colspan="7" style="text-align: center;">No students found matching filters.</td></tr>`;
            return;
        }
        studentsList.innerHTML = data.map(s => `
            <tr>
                <td>${2500000 + (s.rollNo || 0)}</td>
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
            const rollNo = (2500000 + (s.rollNo || 0)).toString();
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

    studentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('student-id').value;

        const studentData = {
            name: document.getElementById('student-name').value,
            age: document.getElementById('student-age').value,
            gender: document.getElementById('student-gender').value,
            classId: document.getElementById('student-class').value,
            status: document.getElementById('student-status').value,
            rollNo: id ? undefined : Math.floor(Math.random() * 1000) // Mock roll no gen
        };

        if (id) {
            SchoolData.updateItem('students', id, studentData);
        } else {
            SchoolData.addItem('students', studentData);
        }

        modalToggle.checked = false;
        studentForm.reset();
        document.getElementById('student-id').value = '';
        modalTitle.innerText = 'Add New Student';
        loadStudents();
    });

    loadStudents();
});
