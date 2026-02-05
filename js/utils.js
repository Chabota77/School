/**
 * Utility Functions
 * Shared helpers for UI feedback and theming.
 */

window.SchoolUtils = {
    // --- TOAST NOTIFICATIONS ---
    showToast: (message, type = 'success') => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed; bottom: 20px; right: 20px; z-index: 1000;
                display: flex; flex-direction: column; gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `toast ${type}`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // --- THEME TOGGLE ---
    initTheme: () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'theme-toggle';
        toggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        toggleBtn.onclick = () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            toggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            window.SchoolUtils.showToast(`Theme switched to ${newTheme} mode`);
        };
        document.body.appendChild(toggleBtn);
    },

    // --- LOGGING ---
    logAction: (action, details) => {
        const logs = JSON.parse(localStorage.getItem('system_logs') || '[]');
        const newLog = {
            id: Date.now(),
            action,
            details,
            timestamp: new Date().toLocaleString()
        };
        logs.unshift(newLog); // Newest first
        if (logs.length > 50) logs.pop(); // Limit size
        localStorage.setItem('system_logs', JSON.stringify(logs));
    },

    // --- GRADE CALCULATION ---
    calculateGrade: (score) => {
        score = parseInt(score);
        if (isNaN(score)) return '-';
        if (score >= 86) return 'A+';
        if (score >= 75) return 'A';
        if (score >= 65) return 'B+';
        if (score >= 60) return 'B';
        if (score >= 55) return 'C+';
        if (score >= 50) return 'C';
        if (score >= 45) return 'D+';
        return 'D'; // 0 - 44
    },

    getLogs: () => JSON.parse(localStorage.getItem('system_logs') || '[]')
};
