document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Elements
    const tableBody = document.querySelector('.payments-table tbody');
    const searchInput = document.querySelector('.payment-filters input');
    const classFilter = document.querySelectorAll('.payment-filters select')[0];
    const statusFilter = document.querySelectorAll('.payment-filters select')[1];
    const monthSelect = document.getElementById('month');
    const yearSpan = document.querySelector('.month-right .year'); // Assuming static 2026 for now or make editable 

    // Stats Elements
    const totalCollectedEl = document.querySelector('.summary-card h3');

    // Modals
    const addPaymentModal = document.getElementById('addPaymentModal');
    const paymentForm = document.getElementById('paymentForm');
    const historyModal = document.getElementById('historyModal');
    const historyTableBody = document.querySelector('#historyTable tbody');
    const historyStudentName = document.getElementById('historyStudentName');

    let allPaymentsData = []; // Store fetched data for filtering

    // Load Payments Summary
    const loadPayments = () => {
        fetch('/api/payments', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                allPaymentsData = data;
                populateClassFilter(data);
                filterAndRender();
                updateDashboardStats(data);
            })
            .catch(err => console.error('Error loading payments:', err));
    };

    const updateDashboardStats = (data) => {
        const totalOutstanding = data.reduce((sum, s) => sum + Number(s.balance), 0);
        const fullyPaidCount = data.filter(s => s.status === 'Paid').length;
        const unpaidCount = data.filter(s => s.status !== 'Paid').length;

        // stats elements (index 0 is Monthly Collected handled by other func)
        const statsCards = document.querySelectorAll('.summary-card h3');
        if (statsCards[1]) statsCards[1].innerText = `ZMW ${formatMoney(totalOutstanding)}`;
        if (statsCards[2]) statsCards[2].innerText = fullyPaidCount;
        if (statsCards[3]) statsCards[3].innerText = unpaidCount;
    };

    const populateClassFilter = (data) => {
        // Extract unique class names
        const classes = [...new Set(data.map(d => d.class_name).filter(Boolean))].sort();
        classFilter.innerHTML = '<option value="">All Classes</option>' +
            classes.map(c => `<option value="${c}">${c}</option>`).join('');
    };

    const filterAndRender = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedClass = classFilter.value;
        const selectedStatus = statusFilter.value;

        const filtered = allPaymentsData.filter(student => {
            const matchesSearch = student.name.toLowerCase().includes(searchTerm);
            const matchesClass = selectedClass ? student.class_name === selectedClass : true;
            const matchesStatus = selectedStatus && selectedStatus !== 'All Status' ? student.status === selectedStatus : true;
            return matchesSearch && matchesClass && matchesStatus;
        });

        renderTable(filtered);
    };

    const renderTable = (data) => {
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No students found matching filters.</td></tr>';
            return;
        }

        tableBody.innerHTML = data.map(student => `
            <tr>
                <td>${student.name}</td>
                <td>${student.class_name || '-'}</td>
                <td>ZMW ${formatMoney(student.total_fees)}</td>
                <td>ZMW ${formatMoney(student.paid)}</td>
                <td style="color: ${student.balance > 0 ? '#dc2626' : '#16a34a'}">
                    ZMW ${formatMoney(student.balance)}
                </td>
                <td><span class="status ${student.status.toLowerCase()}">${student.status}</span></td>
                <td>
                    <button class="btn edit" onclick="openAddPayment(${student.id}, '${student.name.replace(/'/g, "\\'")}')">Pay</button>
                    <button class="btn message" onclick="viewHistory(${student.id}, '${student.name.replace(/'/g, "\\'")}')" style="background-color: #3b82f6;">View</button>
                </td>
            </tr>
        `).join('');
    };

    // Stats Logic
    const updateMonthlyStats = () => {
        const month = monthSelect.value;
        const year = yearSpan.innerText; // or new Date().getFullYear()

        fetch(`/api/payments/stats/monthly?month=${month}&year=${year}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                totalCollectedEl.innerHTML = `ZMW ${formatMoney(data.total)}<br><span style="font-size:0.6em; font-weight:normal;">Collected in ${month}</span>`;
            });
    };

    // Add Payment Logic
    window.openAddPayment = (studentId, studentName) => {
        document.getElementById('payStudentId').value = studentId;
        document.getElementById('payStudentName').value = studentName;
        addPaymentModal.style.display = 'flex';
    };

    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentId = document.getElementById('payStudentId').value;
        const amount = document.getElementById('payAmount').value;
        const date = document.getElementById('payDate').value;
        const method = document.getElementById('payMethod').value;

        // Disable button to prevent double submit
        const btn = paymentForm.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Saving...';

        fetch('/api/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                student_id: studentId,
                amount,
                date,
                method,
                term: 'Term 1', // Default checking
                year: 2026
            })
        })
            .then(res => res.json())
            .then(data => {
                alert('Payment recorded successfully!');
                addPaymentModal.style.display = 'none';
                paymentForm.reset();
                loadPayments();
                updateMonthlyStats();
            })
            .catch(err => alert('Error recording payment'))
            .finally(() => {
                btn.disabled = false;
                btn.innerText = originalText;
            });
    });

    // View History Logic
    window.viewHistory = (studentId, studentName) => {
        historyStudentName.textContent = `Payment History - ${studentName}`;
        historyModal.style.display = 'flex';
        historyTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

        fetch(`/api/payments/${studentId}`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(transactions => {
                if (transactions.length === 0) {
                    historyTableBody.innerHTML = '<tr><td colspan="5">No payment history found.</td></tr>';
                    return;
                }
                historyTableBody.innerHTML = transactions.map(t => `
                    <tr id="row-${t.id}">
                        <td>
                            <span class="view-mode">${new Date(t.date).toLocaleDateString()}</span>
                            <input type="date" class="edit-mode" value="${t.date.split('T')[0]}" style="display:none; width: 100%;">
                        </td>
                        <td>
                            <span class="view-mode">ZMW ${formatMoney(t.amount)}</span>
                            <input type="number" class="edit-mode" value="${t.amount}" style="display:none; width: 80px;">
                        </td>
                        <td>
                            <span class="view-mode">${t.method}</span>
                             <select class="edit-mode" style="display:none;">
                                <option ${t.method === 'Cash' ? 'selected' : ''}>Cash</option>
                                <option ${t.method === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                                <option ${t.method === 'Mobile Money' ? 'selected' : ''}>Mobile Money</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn edit view-mode" onclick="toggleEdit(${t.id})" style="padding: 2px 5px; font-size: 0.8em;">Edit</button>
                            <button class="btn delete view-mode" onclick="deletePayment(${t.id})" style="padding: 2px 5px; font-size: 0.8em; background:#ef4444; color:white;">Delete</button>
                            
                            <button class="btn save edit-mode" onclick="saveEdit(${t.id})" style="display:none; padding: 2px 5px; background:#10b981; color:white;">Save</button>
                            <button class="btn cancel edit-mode" onclick="toggleEdit(${t.id})" style="display:none; padding: 2px 5px; background:#6b7280; color:white;">Cancel</button>
                        </td>
                    </tr>
                `).join('');
            });
    };

    // Edit History Item
    window.toggleEdit = (id) => {
        const row = document.getElementById(`row-${id}`);
        const viewModes = row.querySelectorAll('.view-mode');
        const editModes = row.querySelectorAll('.edit-mode');

        // Toggle visibility
        const isEditing = viewModes[0].style.display === 'none';

        viewModes.forEach(el => el.style.display = isEditing ? 'inline-block' : 'none');
        editModes.forEach(el => el.style.display = isEditing ? 'none' : 'inline-block');
    };

    window.saveEdit = (id) => {
        const row = document.getElementById(`row-${id}`);
        const inputs = row.querySelectorAll('.edit-mode');
        const newDate = inputs[0].value;
        const newAmount = inputs[1].value;
        const newMethod = inputs[2].value;

        fetch(`/api/payments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount: newAmount, date: newDate, method: newMethod })
        })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                // Refresh history (hacky: close and reopen or just reload payments to update balance)
                loadPayments(); // Update main table balances
                // Ideally fetch history again, but for now just update the row text
                const viewModes = row.querySelectorAll('.view-mode');
                viewModes[0].textContent = new Date(newDate).toLocaleDateString();
                viewModes[1].textContent = `ZMW ${formatMoney(newAmount)}`;
                viewModes[2].textContent = newMethod;
                toggleEdit(id);
            });
    };

    window.deletePayment = (id) => {
        if (confirm('Are you sure you want to delete this payment transaction? This will affect the student balance.')) {
            fetch(`/api/payments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    alert(data.message);
                    document.getElementById(`row-${id}`).remove();
                    loadPayments(); // Update main table
                });
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

    // Close on click outside
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
