document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    let subjectsMap = {};

    // 1. Load Subjects Mapping
    fetch('/api/subjects')
        .then(res => res.json())
        .then(subjects => {
            subjects.forEach(s => {
                subjectsMap[s.name] = s.id;
            });
            loadStudents();
        });

    // 2. Load Students
    const loadStudents = () => {
        fetch('/api/teacher/pupils', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(students => {
                const tbody = document.getElementById('resultsTableBody');
                if (students.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6">No students assigned.</td></tr>';
                    return;
                }

                tbody.innerHTML = students.map(s => `
                <tr data-student-id="${s.id}">
                    <td>${s.name}</td>
                    <td><input type="number" class="grade-input" data-subject="Mathematics" min="0" max="100" placeholder="-"></td>
                    <td><input type="number" class="grade-input" data-subject="English" min="0" max="100" placeholder="-"></td>
                    <td><input type="number" class="grade-input" data-subject="Science" min="0" max="100" placeholder="-"></td>
                    <td><input type="number" class="grade-input" data-subject="Social Studies" min="0" max="100" placeholder="-"></td>
                    <td><input type="text" class="comment-input" placeholder="Comment"></td>
                </tr>
            `).join('');

                loadExistingResults();
            });
    };

    // Load Existing Results
    const loadExistingResults = () => {
        fetch('/api/results', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(results => {
                results.forEach(r => {
                    const row = document.querySelector(`tr[data-student-id="${r.student_id}"]`);
                    if (row) {
                        const input = row.querySelector(`input[data-subject="${r.subject_name}"]`);
                        if (input) input.value = r.marks;

                        if (r.comments) {
                            const commentInput = row.querySelector('.comment-input');
                            if (commentInput) commentInput.value = r.comments;
                        }
                    }
                });
            });
    };

    // 3. Save Results
    document.querySelector('.btn.primary').addEventListener('click', async (e) => {
        e.preventDefault();
        const btn = e.target;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        const rows = document.querySelectorAll('#resultsTableBody tr');
        const promises = [];

        rows.forEach(row => {
            const studentId = row.dataset.studentId;
            const inputs = row.querySelectorAll('.grade-input');
            const comment = row.querySelector('.comment-input').value;

            inputs.forEach(input => {
                const marks = input.value;
                if (marks !== '') { // Only submit if a grade is entered
                    const subjectName = input.dataset.subject;
                    const subjectId = subjectsMap[subjectName];

                    if (subjectId) {
                        const p = fetch('/api/results', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                student_id: studentId,
                                subject_id: subjectId,
                                marks: marks,
                                comments: comment
                            })
                        });
                        promises.push(p);
                    }
                }
            });
        });

        try {
            await Promise.all(promises);
            alert('Results saved successfully!');
        } catch (error) {
            console.error(error);
            alert('Some errors occurred while saving.');
        } finally {
            btn.textContent = 'Save Results';
            btn.disabled = false;
        }
    });

    // 4. Download CSV
    document.getElementById('downloadBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const rows = document.querySelectorAll('#resultsTableBody tr');
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Student Name,Mathematics,English,Science,Social Studies,Comments\n";

        rows.forEach(row => {
            const name = row.cells[0].innerText;
            const math = row.querySelector('input[data-subject="Mathematics"]').value;
            const eng = row.querySelector('input[data-subject="English"]').value;
            const sci = row.querySelector('input[data-subject="Science"]').value;
            const ssd = row.querySelector('input[data-subject="Social Studies"]').value;
            const comment = row.querySelector('.comment-input').value;

            const rowData = `${name},${math},${eng},${sci},${ssd},"${comment}"`;
            csvContent += rowData + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
