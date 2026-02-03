/**
 * Reporting & Analytics Module
 * Generates statistics for the Admin Dashboard.
 */

window.SchoolReports = {
    getClassStats: (classId) => {
        const students = window.SchoolData.getStudentByClass(classId);
        const results = window.SchoolData.getDB().results.filter(r => students.some(s => s.id === r.studentId));

        if (students.length === 0) return null;

        const totalStudents = students.length;
        const totalScores = results.reduce((sum, r) => sum + parseInt(r.score), 0);
        const averageScore = results.length ? (totalScores / results.length).toFixed(1) : 0;

        // Pass rate (assume 50% pass)
        // Group by student to see if they passed overall? Or just average?
        // Let's do simple subject pass rate
        const passes = results.filter(r => parseInt(r.score) >= 50).length;
        const passRate = results.length ? ((passes / results.length) * 100).toFixed(1) : 0;

        return {
            totalStudents,
            averageScore,
            passRate
        };
    },

    exportData: (type) => {
        const students = window.SchoolData.getCollection('students');
        const teachers = window.SchoolData.getCollection('teachers');
        const admissions = window.SchoolData.getCollection('admissions');

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Category,Count\n";
        csvContent += `Total Students,${students.length}\n`;
        csvContent += `Total Teachers,${teachers.length}\n`;
        csvContent += `Pending Admissions,${admissions.filter(a => a.status === 'Pending').length}\n`;

        // Add breakdown by class
        csvContent += "\nClass,Student Count\n";
        const classes = window.SchoolData.getClasses();
        classes.forEach(c => {
            const count = students.filter(s => s.classId === c.id).length;
            csvContent += `${c.name},${count}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `school_summary_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.SchoolUtils.showToast('Export successful!', 'success');
        window.SchoolUtils.logAction('Export', `Downloaded ${type} report`);
    }
};
