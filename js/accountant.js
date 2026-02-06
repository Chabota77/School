document.addEventListener('DOMContentLoaded', () => {
    // 1. AUTH CHECK
    const user = window.SchoolAuth.requireAuth('accountant');
    if (!user) return; // Auth redirects if fail

    const { SchoolData, SchoolUtils } = window;

    // --- STATE ---
    let allPayments = [];

    // --- INIT ---
    function init() {
        populateDropdowns();
        loadPayments();
        loadReports();
        loadStudents(); // Added missing call
        // setupNavigation(); // Removed undefined function call
        setupEventListeners();
    }

    // --- LOADERS ---
    function populateDropdowns() {
        // Years & Terms
        const years = SchoolData.getDB().academicYears || [];
        const terms = SchoolData.getTerms();

        const yearSelect = document.getElementById('payYear');
        const termSelect = document.getElementById('payTerm');
        const filterTerm = document.getElementById('filter-term');

        if (yearSelect) yearSelect.innerHTML = years.map(y => `<option value="${y.id}" ${y.current ? 'selected' : ''}>${y.name}</option>`).join('');
        if (termSelect) termSelect.innerHTML = terms.map(t => `<option value="${t.id}" ${t.current ? 'selected' : ''}>${t.name}</option>`).join('');

        // Filter dropdown
        if (filterTerm) {
            filterTerm.innerHTML = '<option value="">All Terms</option>' + terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
    }




    async function loadStudents() {
        const tbody = document.getElementById('studentsTableBody');
        const searchInput = document.getElementById('search-student-list');
        const token = localStorage.getItem('token');

        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

        try {
            const response = await fetch('/api/students', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const list = await response.json();

            const render = (data) => {
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5">No active students found.</td></tr>';
                    return;
                }

                tbody.innerHTML = data.map(s => `
                    <tr>
                        <td>${s.id}</td> <!-- Using DB ID or Roll No -->
                        <td>${s.name}</td>
                        <td>${s.class_name || 'N/A'}</td>
                        <td><span class="status active">${s.status}</span></td>
                        <td><span class="status pending">Check Balance</span></td> 
                    </tr>
                `).join('');
            };

            render(list);

            if (searchInput) {
                searchInput.oninput = (e) => {
                    const term = e.target.value.toLowerCase();
                    render(list.filter(s =>
                        s.name.toLowerCase().includes(term) ||
                        (s.id && String(s.id).includes(term))
                    ));
                };
            }
        } catch (err) {
            console.error('Error loading students:', err);
            tbody.innerHTML = '<tr><td colspan="5" style="color:red;">Error loading students</td></tr>';
        }
    }

    async function loadPayments() {
        const token = localStorage.getItem('token');
        try {
            // Fetch Student Summary (Matches Admin View)
            const summaryRes = await fetch('/api/payments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (summaryRes.ok) {
                allSummaries = await summaryRes.json();
                renderPayments(allSummaries);
                updateStats(allSummaries);

                // Populate Class Filter if empty
                populateClassFilter(allSummaries);
            }

        } catch (err) {
            console.error('Error loading payments:', err);
        }
    }

    function renderPayments(data) {
        const tbody = document.getElementById('paymentsTableBody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No students found.</td></tr>';
            return;
        }

        data.forEach(s => {
            const tr = document.createElement('tr');
            // Admin Style Columns: Name, Class, Total, Paid, Balance, Status, Actions
            tr.innerHTML = `
                <td>${s.name}</td>
                <td>${s.class_name || '-'}</td>
                <td>ZMW ${Number(s.total_fees || 0).toLocaleString()}</td>
                <td>ZMW ${Number(s.paid || 0).toLocaleString()}</td>
                <td style="color: ${s.balance > 0 ? 'red' : 'green'}; font-weight:bold;">
                    ZMW ${Number(s.balance || 0).toLocaleString()}
                </td>
                <td><span class="status ${s.status === 'Paid' ? 'active' : 'pending'}">${s.status}</span></td>
                <td>
                    <button class="btn small" onclick="openAddPaymentForStudent('${s.id}', '${s.name.replace(/'/g, "\\'")}', '${s.class_name}')" style="background:#10b981; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">Pay</button>
                    <button class="btn small" onclick="viewHistory('${s.id}', '${s.name.replace(/'/g, "\\'")}')" style="background:#3b82f6; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">View</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function populateClassFilter(data) {
        const filter = document.getElementById('filter-class');
        if (!filter || filter.options.length > 1) return; // Already populated

        const classes = [...new Set(data.map(d => d.class_name).filter(Boolean))].sort();
        filter.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');

        filter.onchange = (e) => {
            const val = e.target.value;
            const search = document.getElementById('search-student').value.toLowerCase();
            filterAndRender(val, search);
        };
    }

    function filterAndRender(cls, search) {
        let filtered = allSummaries;
        if (cls) filtered = filtered.filter(s => s.class_name === cls);
        if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search));
        renderPayments(filtered);
    }

    // Exposed Actions
    window.openAddPaymentForStudent = (id, name, cls) => {
        document.getElementById('paymentModal').checked = true;
        document.getElementById('payStudentId').value = Number(id) + 2500000; // Display Roll No
    };

    window.viewHistory = async (id, name) => {
        const modal = document.getElementById('historyModalToggle');
        const title = document.getElementById('historyStudentName');
        const tbody = document.getElementById('historyTableBody');

        title.textContent = `Payment History - ${name}`;
        tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
        modal.checked = true;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/payments/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const txs = await res.json();
                if (txs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4">No transactions found.</td></tr>';
                    return;
                }
                tbody.innerHTML = txs.map(t => `
                    <tr>
                        <td>${t.date}</td>
                        <td>ZMW ${t.amount}</td>
                        <td>${t.method}</td>
                        <td>${t.term || '-'}</td>
                        <td>
                            <button onclick="deletePayment(${t.id}, '${name}')" style="background:#dc2626; color:white; border:none; padding:2px 6px; border-radius:4px; font-size:11px; cursor:pointer;">Delete</button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="5" style="color:red">Error loading history</td></tr>';
        }
    };

    window.deletePayment = async (id, studentName) => {
        if (!confirm('Are you sure you want to delete this payment transaction?')) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/payments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                // Refresh History
                // We need the student ID to refresh viewHistory properly? 
                // But viewHistory accepts (id, name). We have name. 
                // We don't have student ID easily unless we parse it or pass it.
                // Ideally, just reload the page or close modal.
                // Let's close modal and reload payments summary.
                document.getElementById('historyModalToggle').checked = false;
                loadPayments();
                // Optionally Show Toast
            } else {
                alert('Failed to delete payment');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting payment');
        }
    };

    function updateStats(data) {
        // data here is the summary list from /api/payments
        // { id, name, roll_no, class_name, total_fees, paid, balance, status }

        const total = data.reduce((sum, p) => sum + Number(p.paid || 0), 0);
        document.getElementById('total-collections').textContent = `ZMW ${total.toLocaleString()}`;

        // Todays receipts - We don't have this in summary. 
        // We can't calculate it accurately from summary.
        // Set to '-' or 0 for now.
        document.getElementById('todays-receipts').textContent = '-';

        const pending = data.reduce((sum, p) => sum + Number(p.balance || 0), 0);
        document.getElementById('pending-fees').textContent = `ZMW ${pending.toLocaleString()}`;
    }

    function loadReports() {
        const tbody = document.getElementById('classReportBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Aggregate allPayments (summary) by Class
        // allPayments items: { class_name, total_fees, paid, balance ... }

        const classStats = {};

        allPayments.forEach(p => {
            const cls = p.class_name || 'Unknown';
            if (!classStats[cls]) classStats[cls] = { expected: 0, collected: 0, balance: 0 };

            classStats[cls].expected += Number(p.total_fees || 0);
            classStats[cls].collected += Number(p.paid || 0);
            classStats[cls].balance += Number(p.balance || 0);
        });

        Object.keys(classStats).sort().forEach(cls => {
            const stat = classStats[cls];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cls}</td>
                <td>${stat.expected.toLocaleString()}</td>
                <td>${stat.collected.toLocaleString()}</td>
                <td>${stat.balance.toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- ACTIONS ---
    window.openAddPaymentModal = () => {
        document.getElementById('paymentModal').checked = true;
    };

    window.printReceipt = (id) => {
        // We don't have full receipt details in summary.
        // Alert user or fetch details (not implemented yet).
        alert("Receipt printing requires transaction history (Coming Soon).");
    };

    // --- EVENTS ---
    function setupEventListeners() {
        // Auto-fill Student Name
        const idInput = document.getElementById('payStudentId');
        if (idInput) {
            idInput.addEventListener('blur', (e) => {
                // We can check against loaded students list if we stored it?
                // Or just clear validity. 
                // Currently loadStudents renders but doesn't store globally.
                // Let's rely on backend validation for now or simple check.
            });
        }

        // Form Submit
        const form = document.getElementById('paymentForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const studentId = document.getElementById('payStudentId').value;
                const amount = document.getElementById('payAmount').value;
                const year = document.getElementById('payYear').options[document.getElementById('payYear').selectedIndex]?.text || 2026;
                const term = document.getElementById('payTerm').options[document.getElementById('payTerm').selectedIndex]?.text || 'Term 1';
                const method = document.getElementById('payMethod').value;
                const token = localStorage.getItem('token');

                try {
                    const response = await fetch('/api/payments', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            student_id: studentId,
                            amount: amount,
                            date: new Date().toISOString().split('T')[0],
                            term: term,
                            year: year,
                            method: method
                        })
                    });

                    if (response.ok) {
                        SchoolUtils.showToast('Payment Record Saved', 'success');
                        document.getElementById('paymentModal').checked = false;
                        form.reset();
                        loadPayments(); // Reload
                    } else {
                        const err = await response.json();
                        SchoolUtils.showToast(err.error || 'Failed to save payment', 'error');
                    }
                } catch (err) {
                    console.error('Payment Error:', err);
                    SchoolUtils.showToast('Network error', 'error');
                }
            });
        }

        // Search Filter
        document.getElementById('search-student')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            // Filter allPayments
            const filtered = allPayments.filter(p =>
                (p.name && p.name.toLowerCase().includes(term)) ||
                (p.id && String(p.id).includes(term)) ||
                (p.class_name && p.class_name.toLowerCase().includes(term))
            );
            renderPayments(filtered);
        });
    }

    // --- NAVIGATION ---
    const handleHashChange = () => {
        const hash = window.location.hash || '#dashboard';

        // Hide all sections
        const sections = ['students', 'payments', 'reports'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Dashboard/Stats handling
        document.getElementById('dashboard').style.display = 'block'; // Ensure container is visible

        if (hash === '#dashboard' || hash === '') {
            document.querySelector('.stats-cards').style.display = 'grid';
        } else {
            document.querySelector('.stats-cards').style.display = 'none';
            // Show target
            const targetId = hash.replace('#', '');
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.style.display = 'block';
        }

        // Active Link
        document.querySelectorAll('.admin-sidebar nav a').forEach(a => {
            a.classList.remove('active');
            if (a.getAttribute('href') === hash) a.classList.add('active');
        });
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Init

    init();
});
