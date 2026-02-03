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
        let headerHTML = '<tr><th>Roll No</th><th>Student Name</th>';
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
            // Display Logic for ID
            const displayId = s.rollNo || (2500000 + (parseInt(s.id.replace(/\D/g, '')) || 0));

            let rowHTML = `<tr data-student-id="${s.id}">
                <td><strong>${displayId}</strong></td>
                <td>${s.name}</td>`;

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

    // Save Results with Custom Modal
    const saveBtn = document.getElementById('saveResultsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();

            const currentYear = selectYear.value;
            const currentTermId = selectTerm.value;
            const rows = document.querySelectorAll('#resultsTableBody tr');

            // Check if any data to save
            const hasData = Array.from(rows).some(r =>
                Array.from(r.querySelectorAll('.grade-input')).some(i => i.value !== '')
            );

            if (!hasData) {
                if (window.SchoolUtils) window.SchoolUtils.showToast('No grades entered to save.', 'warning');
                return;
            }

            // Show Confirmation Modal
            const modal = document.getElementById('confirmModal');
            const title = document.getElementById('confirm-title');
            const msg = document.getElementById('confirm-msg');
            const yesBtn = document.getElementById('confirm-yes');
            const cancelBtn = document.getElementById('confirm-cancel');

            if (modal && title && msg && yesBtn) {
                title.textContent = 'Save Results?';
                msg.textContent = `You are about to save results for ${currentYear} ${selectTerm.options[selectTerm.selectedIndex].text}.`;
                yesBtn.textContent = 'Save Now';
                yesBtn.className = 'btn primary';

                modal.checked = true;

                yesBtn.onclick = () => {
                    const btn = saveBtn; // safe ref
                    btn.textContent = 'Saving...';
                    btn.disabled = true;

                    let updateCount = 0;

                    rows.forEach(row => {
                        const studentId = row.dataset.studentId;
                        const inputs = row.querySelectorAll('.grade-input');

                        inputs.forEach(input => {
                            const score = input.value;
                            // Explicitly check for empty string to allow 0
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
                        modal.checked = false;
                        if (window.SchoolUtils) window.SchoolUtils.showToast(`Successfully saved ${updateCount} grades!`, 'success');
                        btn.textContent = 'Save Results';
                        btn.disabled = false;
                    }, 500);
                };

                cancelBtn.onclick = () => {
                    modal.checked = false;
                };
            }
        });
    }

    initSelectors();
    loadStudents(); // Initial load

    // Download CSV (Dynamic)
    document.getElementById('downloadBtn').addEventListener('click', (e) => {
        e.preventDefault();

        const thead = document.getElementById('resultsTableHead');
        const rows = document.querySelectorAll('#resultsTableBody tr');

        if (!thead || rows.length === 0) {
            alert("No data to download.");
            return;
        }

        // 1. Get Headers
        const headerCells = thead.querySelectorAll('th');
        const headers = Array.from(headerCells).map(th => th.innerText);
        // Exclude last header if it is "Comments" or similar actions, if needed
        // For now, keep all.

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\n";

        // 2. Get Rows
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = [];

            // Name is text in first cell
            rowData.push(cells[0].innerText);

            // Inputs are in subsequent cells (except last maybe)
            // We can just iterate the cells to be safe
            for (let i = 1; i < cells.length; i++) {
                const input = cells[i].querySelector('input');
                if (input) {
                    rowData.push(input.value); // Grade or Comment
                } else {
                    rowData.push(cells[i].innerText); // Just text
                }
            }

            csvContent += rowData.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `student_results_${selectYear.value}_${selectTerm.value}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Run
    loadStudents();
});
