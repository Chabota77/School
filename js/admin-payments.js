document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    const userString = localStorage.getItem('currentUser');
    const user = JSON.parse(userString);
    console.log('Admin Auth Check:', user);
    if (!user || user.role !== 'admin') {
        console.warn('Auth Failed. Redirecting to Admin Login.');
        window.location.href = '../admin-login.html';
        return;
    }

    const { SchoolData } = window;

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

    let allStudentsPayments = []; // Store combined data

    // Load Payments Summary
    const loadPayments = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [studentsRes, paymentsRes] = await Promise.all([
                fetch('/api/students', { headers }),
                fetch('/api/payments', { headers })
            ]);

            if (!studentsRes.ok || !paymentsRes.ok) throw new Error('Failed to fetch data');

            const students = await studentsRes.json();
            const payments = await paymentsRes.json();
            const classes = SchoolData.getClasses(); // Keep classes local for now or fetch if available

            // Calculate Student Balances
            const FEES = 5000;

            allStudentsPayments = students.map(s => {
                // API returns snake_case for students (s.id is consistent)
                // Payments API returns snake_case (student_id)
                const studentPayments = payments.filter(p => p.student_id === s.id);
                const paid = studentPayments.reduce((acc, curr) => acc + Number(curr.amount), 0);
                const balance = FEES - paid;

                // Determine Status
                let status = 'Unpaid';
                if (paid >= FEES) status = 'Paid';
                else if (paid > 0) status = 'Partial';

                const cls = classes.find(c => c.id == s.class_id) || { name: s.class_name || 'Unknown' };

                return {
                    id: s.id,
                    name: s.name, // users.name joined
                    class_name: cls.name,
                    total_fees: FEES,
                    paid: paid,
                    balance: balance,
                    status: status
                };
            });

            populateClassFilter(allStudentsPayments);
            filterAndRender();
            updateDashboardStats(allStudentsPayments);
            // updateMonthlyStats(payments); // Pass payments explicitly if needed or use global
            // For now, let's just re-implement monthly stats logic inside or pass data
            // But updateMonthlyStats relies on SchoolData or we need to pass 'payments' to it.
            // Let's refactor updateMonthlyStats to accept data.
            window.currentPaymentsData = payments; // Store for other functions
            updateMonthlyStats();

        } catch (err) {
            console.error(err);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading payments data.</td></tr>';
        }
    };

    const updateDashboardStats = (data) => {
        const totalOutstanding = data.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
        const fullyPaidCount = data.filter(s => s.status === 'Paid').length;
        const unpaidCount = data.filter(s => s.status !== 'Paid').length;

        const statsCards = document.querySelectorAll('.summary-card h3');
        // Index 0 is Monthly Collected
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

        const filtered = allStudentsPayments.filter(s => {
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
                <td>ZMW ${formatMoney(s.total_fees)}</td>
                <td>ZMW ${formatMoney(s.paid)}</td>
                <td style="color: ${s.balance > 0 ? '#dc2626' : '#16a34a'}">
                    ZMW ${formatMoney(s.balance)}
                </td>
                <td><span class="status ${s.status.toLowerCase()}">${s.status}</span></td>
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

        // Use global variable set in loadPayments
        const payments = window.currentPaymentsData || [];

        const monthlyTotal = payments.filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === monthIndex && d.getFullYear() === year;
        }).reduce((sum, p) => sum + Number(p.amount), 0);

        totalCollectedEl.innerHTML = `ZMW ${formatMoney(monthlyTotal)}<br><span style="font-size:0.6em; font-weight:normal;">Collected in ${monthSelect.value}</span>`;
    };

    // Add Payment Logic
    window.openAddPayment = (studentId, studentName) => {
        document.getElementById('payStudentId').value = studentId;
        document.getElementById('payStudentName').value = studentName;
        addPaymentModal.style.display = 'flex';
    };

    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = document.getElementById('payStudentId').value;
        const amount = document.getElementById('payAmount').value;
        const date = document.getElementById('payDate').value;
        const method = document.getElementById('payMethod').value;
        const btn = paymentForm.querySelector('button[type="submit"]');

        btn.textContent = 'Processing...';
        btn.disabled = true;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentId,
                    amount,
                    date,
                    method,
                    year: new Date().getFullYear(),
                    term: 'Term 1'
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Payment failed');
            }

            alert('Payment recorded successfully!');
            addPaymentModal.style.display = 'none';
            paymentForm.reset();
            loadPayments(); // Reload data
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            btn.textContent = 'Save Payment';
            btn.disabled = false;
        }
    });

    // View History Logic
    window.viewHistory = (studentId, studentName) => {
        historyStudentName.textContent = `Payment History - ${studentName}`;
        historyModal.style.display = 'flex';
        historyTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

        // Use global API data
        const payments = (window.currentPaymentsData || []).filter(p => p.student_id == studentId);

        if (payments.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="5">No payment history found.</td></tr>';
            return;
        }

        historyTableBody.innerHTML = payments.map(t => `
            <tr id="row-${t.id}">
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>ZMW ${formatMoney(t.amount)}</td>
                <td>${t.method}</td>
                <td>
                    <button class="btn delete view-mode" onclick="deletePayment('${t.id}')" style="padding: 2px 5px; font-size: 0.8em; background:#ef4444; color:white;">Delete</button>
                </td>
            </tr>
        `).join('');
    };

    window.deletePayment = (id) => {
        if (confirm('Are you sure you want to delete this payment transaction? This will affect the student balance.')) {
            SchoolData.deleteItem('payments', id);
            historyModal.style.display = 'none'; // Close logic handling is simple for now
            loadPayments();
            alert('Payment deleted.');
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
    updateMonthlyStats();
});
