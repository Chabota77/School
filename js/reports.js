/**
 * Reporting & Analytics Module
 * Generates statistics for the Admin Dashboard.
 */

/**
 * Reporting & Analytics Module
 * Generates statistics for the Admin Dashboard.
 */

window.SchoolReports = {
    exportData: async (type) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error("Not authenticated");

            window.SchoolUtils.showToast('Generating report...', 'info');

            const res = await fetch('/api/reports/summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to fetch report data");
            const data = await res.json();

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Category,Count\n";
            csvContent += `Total Students,${data.totalStudents}\n`;
            csvContent += `Total Teachers,${data.totalTeachers}\n`;
            csvContent += `Pending Admissions,${data.pendingAdmissions}\n`;

            // Add breakdown by class
            csvContent += "\nClass,Student Count\n";
            data.classCounts.forEach(c => {
                csvContent += `${c.name},${c.count}\n`;
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `school_summary_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.SchoolUtils.showToast('Export successful!', 'success');
            if (window.SchoolUtils.logAction) {
                window.SchoolUtils.logAction('Export', `Downloaded ${type} report`);
            }
        } catch (error) {
            console.error(error);
            window.SchoolUtils.showToast('Error generating report', 'error');
        }
    }
};
