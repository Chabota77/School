document.addEventListener('DOMContentLoaded', () => {
    const studentsList = document.getElementById('students-list');
    const studentForm = document.getElementById('student-form');
    const studentClassSelect = document.getElementById('student-class');
    const modalToggle = document.getElementById('addStudentModal');
    const modalTitle = document.getElementById('modal-title');

    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/login.html';
    }

    let allStudentsData = []; // Store for filtering

    // Load classes for the select dropdown
    fetch('/api/classes')
        .then(res => res.json())
        .then(classes => {
            const options = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            studentClassSelect.innerHTML = '<option value="">Select class</option>' + options;
            document.getElementById('filter-class').innerHTML = '<option value="">All Classes</option>' + 
                 classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        });

    // Load students
    const loadStudents = () => {
        fetch('/api/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(students => {
                if (students.error) {
                    studentsList.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">${students.error}</td></tr>`;
                    return;
                }
                allStudentsData = students; // Save for filtering
                renderTable(students);
            });
    };

    const renderTable = (data) => {
        if (data.length === 0) {
            studentsList.innerHTML = `<tr><td colspan="7" style="text-align: center;">No students found matching filters.</td></tr>`;
            return;
        }
        studentsList.innerHTML = data.map(s => `
            <tr>
                <td>${2500000 + s.id}</td>
                <td>${s.name}</td>
                <td>${s.gender || '-'}</td>
                <td>${s.age}</td>
                <td>${s.class_name || 'N/A'}</td>
                <td><span class="status ${s.status === 'Enrolled' ? 'active' : 'leave'}">${s.status}</span></td>
                <td class="actions">
                    <button class="btn edit" onclick="editStudent(${s.id}, '${s.name}', ${s.age}, '${s.gender || ''}', ${s.class_id}, '${s.status}')">Edit</button>
                    <button class="btn delete" onclick="deleteStudent(${s.id})">Delete</button>
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
            const rollNo = (2500000 + s.id).toString();
            const matchesSearch = s.name.toLowerCase().includes(searchTerm) || rollNo.includes(searchTerm);
            return matchesClass && matchesSearch;
        });

        renderTable(filtered);
    };

    document.getElementById('filter-class').addEventListener('change', filterStudents);
    document.getElementById('search-student').addEventListener('input', filterStudents);

    // Edit/Delete helper functions...
    window.editStudent = (id, name, age, gender, classId, status) => {
        document.getElementById('student-id').value = id;
        document.getElementById('student-name').value = name;
        document.getElementById('student-age').value = age;
        document.getElementById('student-gender').value = gender;
        document.getElementById('student-class').value = classId;
        document.getElementById('student-status').value = status;
        modalTitle.innerText = 'Edit Student';
        modalToggle.checked = true;
    };

    window.deleteStudent = (id) => {
        if (confirm('Are you sure you want to delete this student?')) {
            fetch(`/api/students/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    alert(data.message);
                    loadStudents();
                });
        }
    };

    studentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('student-id').value;
        const studentData = {
            name: document.getElementById('student-name').value,
            age: document.getElementById('student-age').value,
            gender: document.getElementById('student-gender').value,
            class_id: document.getElementById('student-class').value,
            status: document.getElementById('student-status').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/students/${id}` : '/api/students';

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(studentData)
        })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                modalToggle.checked = false;
                studentForm.reset();
                document.getElementById('student-id').value = '';
                document.getElementById('student-gender').value = '';
                modalTitle.innerText = 'Add New Student';
                loadStudents();
            });
    });

    loadStudents();
});
