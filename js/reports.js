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
        // Mock Export
        window.SchoolUtils.showToast(`Exporting ${type} report...`);
        window.SchoolUtils.logAction('Export', `Downloaded ${type} report`);

        setTimeout(() => {
            const blob = new Blob(["Mock CSV Content\nID,Name,Score"], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `school_report_${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, 1000);
    }
};
