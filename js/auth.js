/**
 * Authentication Logic
 * Handles Login, Logout, and Role Verification.
 */

window.SchoolAuth = {
    login: async (username, password, role) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });

            const data = await response.json();

            if (response.ok) {
                window.SchoolUtils.showToast('Login Successful! Redirecting...', 'success');

                // Store Token and User Details
                localStorage.setItem('token', data.token);
                localStorage.setItem('currentUser', JSON.stringify(data.user));

                setTimeout(() => {
                    const targetRole = data.user.role || role; // Use returned role or requested role
                    if (targetRole === 'admin') window.location.href = 'admin/dashboard.html';
                    else if (targetRole === 'teacher') window.location.href = 'teacher/dashboard.html';
                    else if (targetRole === 'student') window.location.href = 'student/dashboard.html';
                    else if (targetRole === 'accountant') window.location.href = 'accountant-dashboard.html';
                    else if (targetRole === 'info_officer') window.location.href = 'info-dashboard.html';
                    else window.location.href = 'index.html';
                }, 1000);
                return true;
            } else {
                window.SchoolUtils.showToast(data.message || 'Login failed', 'error');
                return false;
            }
        } catch (err) {
            console.error('Login Error:', err);
            window.SchoolUtils.showToast('Network error during login', 'error');
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
