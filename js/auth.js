/**
 * Authentication Logic
 * Handles Login, Logout, and Role Verification.
 */

window.SchoolAuth = {
    login: (username, password, role) => {
        const db = window.SchoolData.getDB();

        // Normalize role to lowercase for consistency
        const targetRole = role.toLowerCase();

        // Find User
        const user = db.users.find(u =>
            u.username === username &&
            u.password === password &&
            u.role.toLowerCase() === targetRole
        );

        if (user) {
            window.SchoolUtils.showToast('Login Successful! Redirecting...', 'success');
            localStorage.setItem('currentUser', JSON.stringify(user));

            setTimeout(() => {
                if (targetRole === 'admin') window.location.href = 'admin/dashboard.html';
                else if (targetRole === 'teacher') window.location.href = 'teacher/dashboard.html';
                else if (targetRole === 'student') window.location.href = 'student/dashboard.html';
                else window.location.href = 'index.html';
            }, 1000);
            return true;
        } else {
            window.SchoolUtils.showToast('Invalid credentials or role!', 'error');
            return false;
        }
    },

    logout: () => {
        localStorage.removeItem('currentUser');
        // Determine root path relative to current location
        // Simple hack: if we are deep, go up.
        // But for this project structure:
        if (window.location.pathname.includes('/student/')) {
            window.location.href = '../student-login.html';
        } else if (window.location.pathname.includes('/teacher/')) {
            window.location.href = '../teacher-login.html';
        } else if (window.location.pathname.includes('/admin/')) {
            window.location.href = '../teacher-login.html'; // Admin redirects to Teacher/Admin entry
        } else {
            window.location.href = 'student-login.html';
        }
    },

    requireAuth: (requiredRole) => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || (requiredRole && user.role !== requiredRole)) {
            window.SchoolAuth.logout();
            return null;
        }
        return user;
    }
};
