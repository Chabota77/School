document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken'); // We can reuse the same token key or rename it to 'authToken'
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = '/login.html';
        return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== 'teacher') {
        alert('Access denied. Teachers only.');
        window.location.href = '/login.html';
        return;
    }

    // Set Welcome Name
    const headerName = document.querySelector('.teacher-header h1');
    if (headerName) headerName.textContent = `Welcome, ${user.name || user.username}`;

    // Load Stats
    fetch('/api/teacher/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(stats => {
            const cards = document.querySelectorAll('.stats-cards .card p');
            if (cards.length >= 3) {
                cards[0].textContent = stats.students || 0;
                cards[1].textContent = stats.pendingResults || 0;
                cards[2].textContent = stats.messages || 0;
            }
        })
        .catch(err => console.error('Error loading stats:', err));

    // Load Pupils
    const loadPupils = () => {
        fetch('/api/teacher/pupils', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(pupils => {
                console.log('Pupils loaded:', pupils);
                const tbody = document.querySelector('.teacher-table tbody');
                if (!tbody) {
                    console.error('Table body validation failed. Selector: .teacher-table tbody');
                    return;
                }

                if (pupils.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6">No pupils assigned or found.</td></tr>';
                    return;
                }

                const rows = pupils.map(p => `
                <tr>
                    <td>${2500000 + p.id}</td>
                    <td>${p.name}</td>
                    <td>${p.gender || '-'}</td>
                    <td>${p.class_name || 'N/A'}</td>
                    <td>${p.age}</td>
                    <td>
                        <button class="btn view">View</button>
                        <button class="btn message">✉</button>
                    </td>
                </tr>
            `).join('');

                console.log('Rendering rows:', rows);
                tbody.innerHTML = rows;
            })
            .catch(err => console.error('Error loading pupils:', err));
    };

    loadPupils();
});
