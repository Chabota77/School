document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const token = localStorage.getItem('token');

    if (!user || user.role !== 'teacher' || !token) {
        window.location.href = '../login.html';
        return;
    }

    // Context: Selectors
    const selectYear = document.getElementById('selectYear');
    const selectTerm = document.getElementById('selectTerm');
    let myStudents = [];
    let allSubjects = [];
    let mySubjectIds = [];

    // Populate Selectors - Keeping static for now, ideally fetch from backend config
    const initSelectors = () => {
        const years = [{ id: '2026', name: '2026', current: true }, { id: '2025', name: '2025' }];
        const terms = [
            { id: '1', name: 'Term 1', current: true },
            { id: '2', name: 'Term 2' },
            { id: '3', name: 'Term 3' }
        ];

        selectYear.innerHTML = years.map(y => `<option value="${y.id}" ${y.current ? 'selected' : ''}>${y.name}</option>`).join('');
        selectTerm.innerHTML = terms.map(t => `<option value="${t.id}" ${t.current ? 'selected' : ''}>${t.name}</option>`).join('');

        // Listeners to reload data
        selectYear.addEventListener('change', renderTable);
        selectTerm.addEventListener('change', renderTable);
    };

    const fetchInitialData = async () => {
        try {
            // 1. Fetch Students (Includes my subject assignments indirectly, or we fetch subjects separately)
            const stuRes = await fetch('/api/teacher/students', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!stuRes.ok) throw new Error('Failed to fetch students');
            myStudents = await stuRes.json();

            // 2. Fetch All Subjects to map names
            const subRes = await fetch('/api/subjects');
            if (!subRes.ok) throw new Error('Failed to fetch subjects');
            allSubjects = await subRes.json();

            // 3. Determine My Assigned Subjects from the students list (which is based on classes I teach)
            // Or better, fetch teacher profile to get explicit subjects.
            const tRes = await fetch(`/api/teachers/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (tRes.ok) {
                const tData = await tRes.json();
                // Assuming the endpoint returns subjectIds array. If not, we extract from assignments.
                // Let's fetch my profile from the main teachers list for now to get classes/subjects
            }

            // Workaround: Get subjects I teach by fetching all teachers and finding myself
            const allTRes = await fetch('/api/teachers', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (allTRes.ok) {
                const allTData = await allTRes.json();
                const me = allTData.find(t => t.user_id === user.id);
                if (me && me.subject_names) {
                    const mySubNames = me.subject_names.split(', ');
                    mySubjectIds = allSubjects.filter(s => mySubNames.includes(s.name)).map(s => s.id);
                }
            }


            renderTable();

        } catch (e) {
            console.error('Initialization error:', e);
            document.getElementById('resultsTableBody').innerHTML = '<tr><td colspan="100%">Error loading data.</td></tr>';
        }
    };

    const renderTable = async () => {
        const currentYear = selectYear.value;
        const currentTermId = selectTerm.value;

        const thead = document.getElementById('resultsTableHead');
        const tbody = document.getElementById('resultsTableBody');

        if (!thead || !tbody) return;

        // Map to Objects
        const mySubjects = allSubjects.filter(s => mySubjectIds.includes(s.id));

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

        // Filter students to unique set (might be duplicates if we joined with multiple assignments)
        const uniqueStudents = [];
        const map = new Map();
        for (const item of myStudents) {
            if (!map.has(item.id)) {
                map.set(item.id, true);    // set any value to Map
                uniqueStudents.push({
                    id: item.id,
                    name: item.name,
                    rollNo: item.roll_number || item.id
                });
            }
        }

        if (uniqueStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100%">No students assigned to your classes.</td></tr>';
            return;
        }

        // BUILD DYNAMIC ROWS
        tbody.innerHTML = uniqueStudents.map(s => {
            const displayId = s.rollNo;

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

    const loadExistingResults = async (year, term) => {
        try {
            const res = await fetch(`/api/results?year=${year}&term=${term}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch existing results');
            const relevantResults = await res.json();

            // Our unique students IDs
            const stuIds = myStudents.map(s => s.id);

            relevantResults.forEach(r => {
                if (stuIds.includes(r.student_id)) {
                    const row = document.querySelector(`tr[data-student-id="${r.student_id}"]`);
                    if (row) {
                        const input = row.querySelector(`input[data-subject-id="${r.subject_id}"]`);
                        if (input) input.value = r.marks;

                        // Put comment in the last box (simplistic assumption that 1 comment per student row is enough for UI)
                        if (r.comments) {
                            const commentInput = row.querySelector('.comment-input');
                            if (commentInput && !commentInput.value) commentInput.value = r.comments;
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Error loading existing results:', e);
        }
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
                Array.from(r.querySelectorAll('.grade-input')).some(i => i.value !== '') ||
                (r.querySelector('.comment-input') && r.querySelector('.comment-input').value !== '')

            );

            if (!hasData) {
                alert('No grades or comments entered to save.');
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

                yesBtn.onclick = async () => {
                    const btn = saveBtn; // safe ref
                    btn.textContent = 'Saving...';
                    btn.disabled = true;

                    const payload = [];

                    rows.forEach(row => {
                        const studentId = row.dataset.studentId;
                        const inputs = row.querySelectorAll('.grade-input');
                        const commentInput = row.querySelector('.comment-input');
                        const comments = commentInput && commentInput.value ? commentInput.value : '';

                        inputs.forEach(input => {
                            const score = input.value;
                            // Explicitly check for empty string to allow 0
                            if (score !== '') {
                                const subjectId = input.dataset.subjectId;
                                if (subjectId) {
                                    payload.push({
                                        studentId: parseInt(studentId),
                                        subjectId: parseInt(subjectId),
                                        marks: parseInt(score),
                                        comments: comments,
                                        year: parseInt(currentYear),
                                        term: currentTermId
                                    });
                                }
                            }
                        });
                    });

                    try {
                        const res = await fetch('/api/results', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ results: payload })
                        });

                        if (res.ok) {
                            setTimeout(() => {
                                modal.checked = false;
                                alert(`Successfully saved grades!`);
                                btn.textContent = 'Save Results';
                                btn.disabled = false;
                            }, 500);
                        } else {
                            const err = await res.json();
                            throw new Error(err.error || 'Failed to save');
                        }

                    } catch (e) {
                        alert('Error saving results: ' + e.message);
                        modal.checked = false;
                        btn.textContent = 'Save Results';
                        btn.disabled = false;
                    }
                };

                cancelBtn.onclick = () => {
                    modal.checked = false;
                };
            }
        });
    }

    initSelectors();
    fetchInitialData(); // Initial load

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

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\n";

        // 2. Get Rows
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = [];

            // Name is text in first cell
            rowData.push(cells[0].innerText);

            // Inputs are in subsequent cells
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

});
