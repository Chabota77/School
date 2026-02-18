/**
 * Authentication Logic
 * Handles Login, Logout, and Role Verification.
 */

window.SchoolAuth = {
    login: async (username, password, role) => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });

            const data = await response.json();

            if (response.ok) {
                // Strict Role Check - User requested specific role login
                const targetRole = data.user.role;

                if (role && role !== targetRole) {
                    window.SchoolUtils.showToast(`Login failed: You are a ${targetRole}, not a ${role}`, 'error');
                    return false;
                }

                window.SchoolUtils.showToast('Login Successful! Redirecting...', 'success');

                // Store Token and User Details
                localStorage.setItem('token', data.token);
                localStorage.setItem('currentUser', JSON.stringify(data.user));

                // Prioritize requested role if allowed (for sub-admins)
                if (targetRole === 'admin' && role === 'admin') {
                    window.location.href = '/admin/dashboard.html';
                } else if (targetRole === 'teacher') {
                    window.location.href = '/teacher/dashboard.html';
                } else if (targetRole === 'student') {
                    window.location.href = '/student/dashboard.html';
                } else if (targetRole === 'accountant') {
                    window.location.href = '/accountant-dashboard.html';
                } else if (targetRole === 'info_officer') {
                    window.location.href = '/info-dashboard.html';
                } else {
                    window.location.href = '/index.html';
                }

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
        const user = JSON.parse(localStorage.getItem('currentUser'));
        let redirectUrl = '/login.html'; // Default fallback

        if (user) {
            if (['admin', 'accountant', 'info_officer'].includes(user.role)) {
                redirectUrl = '/admin-login.html';
            } else if (user.role === 'teacher') {
                redirectUrl = '/teacher-login.html';
            } else if (user.role === 'student') {
                redirectUrl = '/student-login.html';
            }
        } else {
            // If checking URL context if user object is gone
            if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('admin')) {
                redirectUrl = '/admin-login.html';
            } else if (window.location.pathname.includes('/teacher/') || window.location.pathname.includes('teacher')) {
                redirectUrl = '/teacher-login.html';
            } else if (window.location.pathname.includes('/student/') || window.location.pathname.includes('student')) {
                redirectUrl = '/student-login.html';
            }
        }

        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        window.location.href = redirectUrl;
    },

    requireAuth: (requiredRole) => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || (requiredRole && user.role !== requiredRole)) {
            console.log(`Access Denied: User is ${user?.role}, Page requires ${requiredRole}`);
            window.SchoolAuth.logout();
            return null;
        }
        return user;
    }
};
