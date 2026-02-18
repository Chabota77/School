document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // Verify User Role
    if (!user || user.role !== 'teacher') {
        window.location.href = '../login.html';
        return;
    }

    const token = localStorage.getItem('token');

    try {
        // Fetch Teacher Profile
        const res = await fetch(`/api/teachers/${user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch profile');
        const profile = await res.json();

        // Render Profile
        document.getElementById('profile-name').textContent = profile.name;
        document.getElementById('profile-email').textContent = profile.email;
        document.getElementById('profile-phone').textContent = profile.phone || 'N/A';
        document.getElementById('profile-status').textContent = profile.status || 'Active';

        // Avatar
        const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('profile-avatar').textContent = initials;

        // Fetch Classes (to map IDs to Names)
        const classesRes = await fetch('/api/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const classes = await classesRes.json();

        // Render Classes
        const classesList = document.getElementById('profile-classes');
        classesList.innerHTML = '';

        if (profile.classIds && profile.classIds.length > 0) {
            profile.classIds.forEach(classId => {
                const cls = classes.find(c => c.id === classId);
                const li = document.createElement('li');
                // We might not have subject Mapping perfectly in profile yet (subjectIds vs classIds)
                // For now, listing classes is safe.
                li.textContent = `${cls ? cls.name : 'Class ' + classId}`;
                classesList.appendChild(li);
            });
        } else {
            classesList.innerHTML = '<li>No classes assigned.</li>';
        }

    } catch (err) {
        console.error(err);
        alert('Error loading profile.');
    }
});
