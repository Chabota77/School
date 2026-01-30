document.getElementById('resultsForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const studentId = document.getElementById('studentId').value;
    const studentName = document.getElementById('studentName').value;
    const term = document.getElementById('termSelect').value;
    const tableBody = document.getElementById('resultsTableBody');
    const statusMsg = document.getElementById('statusMessage');
    const downloadBtn = document.getElementById('downloadResultsBtn');

    tableBody.innerHTML = '';
    statusMsg.textContent = 'Searching...';
    downloadBtn.style.display = 'none';

    fetch(`/api/public/results?student_id=${studentId}&name=${encodeURIComponent(studentName)}&term=${encodeURIComponent(term)}`)
        .then(res => {
            if (!res.ok) throw new Error('Student not found or no results for this term.');
            return res.json();
        })
        .then(results => {
            if (results.length === 0) {
                statusMsg.textContent = 'No results found for the provided details.';
                return;
            }

            statusMsg.textContent = '';
            downloadBtn.style.display = 'inline-block';
            downloadBtn.innerText = 'Download Result (PDF)';

            const calculateGrade = (score) => {
                if (score >= 86) return 'A+';
                if (score >= 75) return 'A';
                if (score >= 65) return 'B+';
                if (score >= 60) return 'B';
                if (score >= 55) return 'C+';
                if (score >= 50) return 'C';
                if (score >= 45) return 'D+';
                if (score >= 0) return 'D';
                return '-';
            };

            // Calculate Grade and assume comment is same for all (or take first non-empty)
            const teacherComment = results.find(r => r.comments)?.comments || '-';

            tableBody.innerHTML = results.map(r => `
            <tr>
                <td>${r.subject_name}</td>
                <td>${r.marks}</td>
                <td>${calculateGrade(r.marks)}</td>
            </tr>
        `).join('') + `
            <tr style="background-color: #f9f9f9; font-weight: bold;">
                <td colspan="3" style="padding: 15px; border-top: 2px solid #ddd;">
                    Teacher's Comment: <span style="color: #2c3e50; margin-left: 10px;">${teacherComment}</span>
                </td>
            </tr>
        `;

            // Download PDF (Print) Logic
            downloadBtn.onclick = () => {
                const printWindow = window.open('', '', 'height=600,width=800');
                printWindow.document.write('<html><head><title>Student Result</title>');
                printWindow.document.write('<style>');
                printWindow.document.write('body { font-family: "Poppins", sans-serif; padding: 20px; }');
                printWindow.document.write('h1 { text-align: center; color: #2c3e50; }');
                printWindow.document.write('.header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }');
                printWindow.document.write('.student-details { margin-bottom: 20px; font-size: 1.1em; }');
                printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
                printWindow.document.write('th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }');
                printWindow.document.write('th { background-color: #f2f2f2; }');
                printWindow.document.write('.comment-section { margin-top: 20px; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9; }');
                printWindow.document.write('</style>');
                printWindow.document.write('</head><body>');

                printWindow.document.write('<div class="header"><h1>K-Lombe School</h1><p>End of Term Student Report</p></div>');

                printWindow.document.write('<div class="student-details">');
                printWindow.document.write(`<p><strong>Student Name:</strong> ${studentName}</p>`);
                printWindow.document.write(`<p><strong>Student ID:</strong> ${studentId}</p>`);
                printWindow.document.write(`<p><strong>Term:</strong> ${term}</p>`);
                printWindow.document.write('</div>');

                printWindow.document.write('<table><thead><tr><th>Subject</th><th>Score</th><th>Grade</th></tr></thead><tbody>');
                results.forEach(r => {
                    printWindow.document.write(`<tr><td>${r.subject_name}</td><td>${r.marks}</td><td>${calculateGrade(r.marks)}</td></tr>`);
                });
                printWindow.document.write('</tbody></table>');

                printWindow.document.write(`<div class="comment-section"><strong>Teacher's Comment:</strong> ${teacherComment}</div>`);

                printWindow.document.write('<div style="margin-top: 50px; text-align: right;"><p>_________________________</p><p>Head Teacher\'s Signature</p></div>');

                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.print();
            };
        })
        .catch(err => {
            console.error(err);
            statusMsg.textContent = err.message;
            statusMsg.style.color = 'red';
        });
});
