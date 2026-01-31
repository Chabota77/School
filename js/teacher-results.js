document.addEventListener('DOMContentLoaded', () => {
    const { SchoolData } = window;
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (!user || user.role !== 'teacher') {
        window.location.href = '../login.html';
        return;
    }

    const teachers = SchoolData.getCollection('teachers');
    const teacherProfile = teachers.find(t => t.userId === user.id) || teachers.find(t => t.email === user.username);

    if (!teacherProfile) {
        alert('Teacher profile not found.');
        return;
    }

    // Context: Selectors
    const selectYear = document.getElementById('selectYear');
    const selectTerm = document.getElementById('selectTerm');

    // Populate Selectors
    const initSelectors = () => {
        const years = SchoolData.getDB().academicYears || [{ id: '2026', name: '2026' }];
        const terms = SchoolData.getTerms();

        selectYear.innerHTML = years.map(y => `<option value="${y.id}" ${y.current ? 'selected' : ''}>${y.name}</option>`).join('');
        selectTerm.innerHTML = terms.map(t => `<option value="${t.id}" ${t.current ? 'selected' : ''}>${t.name}</option>`).join('');

        // Listeners to reload data
        selectYear.addEventListener('change', loadStudents);
        selectTerm.addEventListener('change', loadStudents);
    };

    // Load Students and their results for SELECTED context
    const myClasses = teacherProfile.classIds || [];
    const myStudents = SchoolData.getCollection('students').filter(s => myClasses.includes(s.classId));

    // Subjects Map (Name -> ID)
    const subjects = SchoolData.getSubjects();
    const subjectsMap = {};
    const subjectsMapInv = {};
    subjects.forEach(s => {
        subjectsMap[s.name] = s.id;
        subjectsMapInv[s.id] = s.name;
    });

    const loadStudents = () => {
        const currentYear = selectYear.value;
        const currentTermId = selectTerm.value;

        const thead = document.getElementById('resultsTableHead');
        const tbody = document.getElementById('resultsTableBody');

        if (!thead || !tbody) return;

        // Determine Assigned Subjects
        // If teacherProfile.subjectIds is empty or undefined, defaults to empty array
        const mySubjectIds = teacherProfile.subjectIds || [];
        // Map to Objects
        const mySubjects = SchoolData.getSubjects().filter(s => mySubjectIds.includes(s.id));

        if (mySubjects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100%">You have no subjects assigned. Please contact Admin.</td></tr>';
            thead.innerHTML = '';
            return;
        }

        // BUILD DYNAMIC HEADER
        let headerHTML = '<tr><th>Student Name</th>';
        mySubjects.forEach(sub => {
            headerHTML += `<th>${sub.name}</th>`;
        });
        headerHTML += '<th>Comments</th></tr>';
        thead.innerHTML = headerHTML;

        if (myStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100%">No students assigned to your classes.</td></tr>';
            return;
        }

        // BUILD DYNAMIC ROWS
        tbody.innerHTML = myStudents.map(s => {
            let rowHTML = `<tr data-student-id="${s.id}"><td>${s.name}</td>`;

            mySubjects.forEach(sub => {
                rowHTML += `<td><input type="number" class="grade-input" data-subject-id="${sub.id}" data-subject-name="${sub.name}" min="0" max="100" placeholder="-"></td>`;
            });

            rowHTML += `<td><input type="text" class="comment-input" placeholder="Comment"></td></tr>`;
            return rowHTML;
        }).join('');

        loadExistingResults(currentYear, currentTermId);
    };

    const loadExistingResults = (year, term) => {
        const allResults = SchoolData.getCollection('results');

        // Filter results for my students and SELECTED context
        const relevantResults = allResults.filter(r =>
            r.termId === term &&
            r.yearId === year &&
            myStudents.some(s => s.id === r.studentId)
        );

        relevantResults.forEach(r => {
            const row = document.querySelector(`tr[data-student-id="${r.studentId}"]`);
            if (row) {
                // Find input via Subject ID now, more robust
                const input = row.querySelector(`input[data-subject-id="${r.subjectId}"]`);
                if (input) input.value = r.score;
            }
        });
    };

    // Save Results
    document.querySelector('.btn.primary').addEventListener('click', (e) => {
        e.preventDefault();
        const btn = e.target;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        const currentYear = selectYear.value;
        const currentTermId = selectTerm.value;

        const rows = document.querySelectorAll('#resultsTableBody tr');
        let updateCount = 0;

        rows.forEach(row => {
            const studentId = row.dataset.studentId;
            const inputs = row.querySelectorAll('.grade-input');

            inputs.forEach(input => {
                const score = input.value;
                if (score !== '') {
                    const subjectId = input.dataset.subjectId;

                    if (subjectId) {
                        // Check if exists
                        const allResults = SchoolData.getCollection('results');
                        const existingIndex = allResults.findIndex(r =>
                            r.studentId === studentId &&
                            r.subjectId === subjectId &&
                            r.termId === currentTermId &&
                            r.yearId === currentYear
                        );

                        if (existingIndex > -1) {
                            // Update
                            allResults[existingIndex].score = parseInt(score);
                            SchoolData.saveDB(SchoolData.getDB());
                        } else {
                            // Add
                            SchoolData.addItem('results', {
                                studentId,
                                subjectId,
                                termId: currentTermId,
                                yearId: currentYear,
                                score: parseInt(score)
                            });
                        }
                        updateCount++;
                    }
                }
            });
        });

        setTimeout(() => {
            alert(`Saved ${updateCount} grade entries for ${currentYear} Term ${currentTermId}.`);
            btn.textContent = 'Save Results';
            btn.disabled = false;
        }, 500);
    });

    initSelectors();
    loadStudents(); // Initial load

    // Download CSV
    document.getElementById('downloadBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const rows = document.querySelectorAll('#resultsTableBody tr');
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Student Name,Mathematics,English,Science,Social Studies\n";

        rows.forEach(row => {
            const name = row.cells[0].innerText;
            const math = row.querySelector('input[data-subject="Mathematics"]').value;
            const eng = row.querySelector('input[data-subject="English"]').value;
            const sci = row.querySelector('input[data-subject="Science"]').value;
            const ssd = row.querySelector('input[data-subject="Social Studies"]').value;

            csvContent += `${name},${math},${eng},${sci},${ssd}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Run
    loadStudents();
});
