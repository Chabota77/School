document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    const userString = localStorage.getItem('currentUser');
    const user = JSON.parse(userString);
    if (!user || user.role !== 'admin') {
        window.location.href = '../admin-login.html';
        return;
    }

    // Elements
    const tableBody = document.querySelector('.payments-table tbody');
    const searchInput = document.querySelector('.payment-filters input');
    const classFilter = document.querySelectorAll('.payment-filters select')[0];
    const statusFilter = document.querySelectorAll('.payment-filters select')[1];
    const monthSelect = document.getElementById('month');
    const yearSpan = document.querySelector('.month-right .year');

    // Stats Elements
    const totalCollectedEl = document.querySelector('.summary-card h3');

    // Modals
    const addPaymentModal = document.getElementById('addPaymentModal');
    const paymentForm = document.getElementById('paymentForm');
    const historyModal = document.getElementById('historyModal');
    const historyTableBody = document.querySelector('#historyTable tbody');
    const historyStudentName = document.getElementById('historyStudentName');

    let allSummaries = [];
    let allTransactions = []; // For stats or drill down if needed, but we use summaries.

    // Load Payments Summary (API)
    const loadPayments = async () => {
        const token = localStorage.getItem('token');
        try {
            const tableBody = document.querySelector('.payments-table tbody');
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';

            // Fetch Summary
            const res = await fetch('/api/payments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                allSummaries = await res.json();
                populateClassFilter(allSummaries);
                filterAndRender();
                updateDashboardStats(allSummaries);

                // For Monthly Stats, we need transactions.
                // Summary doesn't have dates. 
                // We'll fetch transactions separately for the stats if robust, or skip for now.
                // The original code filtered 'payments' collection by date.
                // Let's implement /api/payments/transactions fetch for stats.
                fetchTransactionsForStats();
            } else {
                tableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Failed to load data.</td></tr>';
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Fetch transactions solely for monthly stats calculation
    const fetchTransactionsForStats = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/payments/transactions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                allTransactions = await res.json();
                updateMonthlyStats();
            }
        } catch (e) { console.error(e); }
    };

    const updateDashboardStats = (data) => {
        const totalOutstanding = data.reduce((sum, s) => sum + (s.balance > 0 ? Number(s.balance) : 0), 0);
        const fullyPaidCount = data.filter(s => s.status === 'Paid').length;
        const unpaidCount = data.filter(s => s.status !== 'Paid').length;

        const statsCards = document.querySelectorAll('.summary-card h3');
        // Index 0 is Monthly Collected - Handled by updateMonthlyStats
        // Index 1: Outstanding
        if (statsCards[1]) statsCards[1].innerText = `ZMW ${formatMoney(totalOutstanding)}`;
        // Index 2: Fully Paid
        if (statsCards[2]) statsCards[2].innerText = fullyPaidCount;
        // Index 3: Unpaid/Partial
        if (statsCards[3]) statsCards[3].innerText = unpaidCount;
    };

    const populateClassFilter = (data) => {
        const uniqueClasses = [...new Set(data.map(d => d.class_name).filter(Boolean))].sort();
        classFilter.innerHTML = '<option value="">All Classes</option>' +
            uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    };

    const filterAndRender = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedClass = classFilter.value;
        const selectedStatus = statusFilter.value;

        const filtered = allSummaries.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm);
            const matchesClass = selectedClass ? s.class_name === selectedClass : true;
            const matchesStatus = selectedStatus && selectedStatus !== 'All Status' ? s.status === selectedStatus : true;
            return matchesSearch && matchesClass && matchesStatus;
        });

        renderTable(filtered);
    };

    const renderTable = (data) => {
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No students found matching filters.</td></tr>';
            return;
        }

        tableBody.innerHTML = data.map(s => `
            <tr>
                <td>${s.name}</td>
                <td>${s.class_name || '-'}</td>
                <td>ZMW ${formatMoney(s.total_fees || 0)}</td>
                <td>ZMW ${formatMoney(s.paid || 0)}</td>
                <td style="color: ${s.balance > 0 ? '#dc2626' : '#16a34a'}">
                    ZMW ${formatMoney(s.balance || 0)}
                </td>
                <td><span class="status ${s.status === 'Paid' ? 'active' : 'pending'}">${s.status}</span></td>
                <td>
                    <button class="btn edit" onclick="openAddPayment('${s.id}', '${s.name.replace(/'/g, "\\'")}')">Pay</button>
                    <button class="btn message" onclick="viewHistory('${s.id}', '${s.name.replace(/'/g, "\\'")}')" style="background-color: #3b82f6;">View</button>
                </td>
            </tr>
        `).join('');
    };

    // Stats Logic
    const updateMonthlyStats = () => {
        const monthIndex = monthSelect.selectedIndex; // 0 = Jan
        const year = parseInt(yearSpan.innerText);

        const monthlyTotal = allTransactions.filter(p => {
            // p.date format YYYY-MM-DD
            if (!p.date) return false;
            const d = new Date(p.date);
            return d.getMonth() === monthIndex && d.getFullYear() === year;
        }).reduce((sum, p) => sum + Number(p.amount), 0);

        totalCollectedEl.innerHTML = `ZMW ${formatMoney(monthlyTotal)}<br><span style="font-size:0.6em; font-weight:normal;">Collected in ${monthSelect.value}</span>`;
    };

    // Add Payment Logic
    window.openAddPayment = (studentId, studentName) => {
        // studentId here is the DB ID (from summary)
        // We might want to show Roll No?
        // Logic requires DB ID for POST.

        document.getElementById('payStudentId').value = Number(studentId) + 2500000; // Show readable ID
        document.getElementById('payStudentId').dataset.realId = studentId; // Store real ID

        document.getElementById('payStudentName').value = studentName;
        addPaymentModal.style.display = 'flex';
    };

    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayId = document.getElementById('payStudentId').value;
        const realId = document.getElementById('payStudentId').dataset.realId || (Number(displayId) - 2500000);
        // Fallback calculation if edited? Ideally user shouldn't edit.

        const amount = document.getElementById('payAmount').value;
        const date = document.getElementById('payDate').value;
        const method = document.getElementById('payMethod').value;
        const token = localStorage.getItem('token');

        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    student_id: realId,
                    amount, date, method,
                    year: '2026', term: 'Term 1' // Defaulting for now
                })
            });

            if (res.ok) {
                alert('Payment recorded successfully!');
                addPaymentModal.style.display = 'none';
                paymentForm.reset();
                loadPayments();
            } else {
                const err = await res.json();
                alert('Error: ' + (err.error || 'Failed'));
            }
        } catch (e) { console.error(e); alert('Network error'); }
    });

    // View History Logic
    window.viewHistory = async (studentId, studentName) => {
        historyStudentName.textContent = `Payment History - ${studentName}`;
        historyModal.style.display = 'flex';
        historyTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/payments/${studentId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const txs = await res.json();
                if (txs.length === 0) {
                    historyTableBody.innerHTML = '<tr><td colspan="5">No payment history found.</td></tr>';
                    return;
                }

                historyTableBody.innerHTML = txs.map(t => `
                    <tr id="row-${t.id}">
                        <td>${new Date(t.date).toLocaleDateString()}</td>
                        <td>ZMW ${formatMoney(t.amount)}</td>
                        <td>${t.method}</td>
                        <td>
                            <button class="btn delete view-mode" onclick="deletePayment('${t.id}')" style="padding: 2px 5px; font-size: 0.8em; background:#ef4444; color:white;">Delete</button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            historyTableBody.innerHTML = '<tr><td colspan="5" style="color:red">Error loading history</td></tr>';
        }
    };

    window.deletePayment = async (id) => {
        if (confirm('Are you sure you want to delete this payment transaction? This will affect the student balance.')) {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`/api/payments/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    alert('Payment deleted.');
                    historyModal.style.display = 'none';
                    loadPayments();
                } else { alert('Failed to delete'); }
            } catch (e) { alert('Request failed'); }
        }
    }

    // Event Listeners
    searchInput.addEventListener('input', filterAndRender);
    classFilter.addEventListener('change', filterAndRender);
    statusFilter.addEventListener('change', filterAndRender);
    monthSelect.addEventListener('change', updateMonthlyStats);

    // Close Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            addPaymentModal.style.display = 'none';
            historyModal.style.display = 'none';
        });
    });

    window.onclick = (e) => {
        if (e.target == addPaymentModal) addPaymentModal.style.display = 'none';
        if (e.target == historyModal) historyModal.style.display = 'none';
    };

    const formatMoney = (amount) => {
        return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Initial Load
    loadPayments();

});
