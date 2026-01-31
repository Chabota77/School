document.addEventListener('DOMContentLoaded', () => {
    const { SchoolData } = window;
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (!user || user.role !== 'teacher') {
        window.location.href = '../login.html';
        return;
    }

    // Find the Teacher Profile linked to this User
    const teachers = SchoolData.getCollection('teachers');
    const teacherProfile = teachers.find(t => t.userId === user.id) || teachers.find(t => t.email === user.username);
    // ^ Fallback if userId not set but username matches email, just for safety in mock data

    if (!teacherProfile) {
        alert('Teacher profile not found for this user.');
        return;
    }

    // Set Welcome Name
    const headerName = document.querySelector('.teacher-header h1');
    if (headerName) headerName.textContent = `Welcome, ${teacherProfile.name}`;

    // Get Classes
    const myClassIds = teacherProfile.classIds || [];
    const myClasses = SchoolData.getClasses().filter(c => myClassIds.includes(c.id));

    // Get Students
    const allStudents = SchoolData.getCollection('students');
    const myStudents = allStudents.filter(s => myClassIds.includes(s.classId));

    // Load Stats
    const loadStats = () => {
        const cards = document.querySelectorAll('.stats-cards .card p');
        if (cards.length >= 3) {
            cards[0].textContent = myStudents.length;
            cards[1].textContent = '0'; // Assignments Pending (Mock)
            cards[2].textContent = '0'; // New Messages (Mock)
        }
    };

    // Load Pupils
    const loadPupils = () => {
        const tbody = document.querySelector('.teacher-table tbody');
        if (!tbody) return;

        if (myStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No pupils assigned to your classes.</td></tr>';
            return;
        }

        tbody.innerHTML = myStudents.map(s => {
            const cls = myClasses.find(c => c.id === s.classId);
            return `
            <tr>
                <td>${s.id}</td>
                <td>${s.name}</td>
                <td>${s.gender || 'N/A'}</td>
                <td>${cls ? cls.name : s.classId}</td>
                <td>${s.age || 'N/A'}</td>
                <td>
                    <button class="btn view" onclick="alert('View Student Details')">View</button>
                    <button class="btn message" onclick="alert('Message Student')">✉</button>
                </td>
            </tr>
            `;
        }).join('');
    };

    // INIT
    loadStats();
    loadPupils();
});
