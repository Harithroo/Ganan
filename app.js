// Register service worker for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// ========== PAGE NAVIGATION ==========
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        // Update nav buttons if needed
        updateNav(pageId);
    }
}

function toggleMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
}

function updateNav(pageId) {
    // Optional: highlight active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.style.borderBottom = 'none';
    });
    // You can extend this to highlight the active nav item
}

// ========== APP STATE ==========
const app = {
    people: [],
    expenses: [],
    balances: {},
    editingIndex: null,
    smartSettlement: true,
    collectorPerson: null,

    addPerson(name) {
        if (name.trim() && !this.people.includes(name.trim())) {
            this.people.push(name.trim());
            this.render();
        }
    },

    removePerson(name) {
        if (confirm(`Are you sure you want to remove "${name}"?`)) {
            this.people = this.people.filter(p => p !== name);
            this.render();
        }
    },

    addExpense(payer, amount, beneficiaries, description) {
        if (!payer || amount <= 0 || beneficiaries.length === 0) return;
        
        if (this.editingIndex !== null) {
            // Update existing expense
            this.expenses[this.editingIndex] = {
                payer,
                amount: parseFloat(amount),
                for: beneficiaries,
                description: description || 'No description'
            };
            this.editingIndex = null;
        } else {
            // Add new expense
            this.expenses.push({
                payer,
                amount: parseFloat(amount),
                for: beneficiaries,
                description: description || 'No description'
            });
        }
        this.render();
    },

    calculateBalances() {
        this.balances = {};

        // Initialize all people with 0 balance
        this.people.forEach(person => {
            this.balances[person] = 0;
        });

        // Process each expense
        this.expenses.forEach(expense => {
            const { payer, amount, for: beneficiaries } = expense;
            const share = amount / beneficiaries.length;

            // Payer gets positive balance (paid)
            this.balances[payer] += amount;

            // Each beneficiary gets negative balance (owes)
            beneficiaries.forEach(beneficiary => {
                this.balances[beneficiary] -= share;
            });
        });
    },

    calculateSettlements() {
        this.calculateBalances();

        const debtors = []; // negative balances (owe money)
        const creditors = []; // positive balances (owed money)

        // Split into debtors and creditors
        Object.entries(this.balances).forEach(([person, balance]) => {
            if (balance < -0.01) { // Use small threshold for floating point
                debtors.push({ person, amount: Math.abs(balance) });
            } else if (balance > 0.01) {
                creditors.push({ person, amount: balance });
            }
        });

        // Sort for greedy matching
        debtors.sort((a, b) => a.amount - b.amount);
        creditors.sort((a, b) => a.amount - b.amount);

        const settlements = [];

        // Greedy algorithm: match lowest debtor with lowest creditor
        let dIdx = 0, cIdx = 0;

        while (dIdx < debtors.length && cIdx < creditors.length) {
            const debtor = debtors[dIdx];
            const creditor = creditors[cIdx];

            const settleAmount = Math.min(debtor.amount, creditor.amount);

            settlements.push({
                from: debtor.person,
                to: creditor.person,
                amount: settleAmount
            });

            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            if (debtor.amount < 0.01) dIdx++;
            if (creditor.amount < 0.01) cIdx++;
        }

        return settlements;
    },

    calculateSimpleSettlements(collector) {
        this.calculateBalances();

        const settlements = [];

        // For each person with negative balance (owes money), they pay the collector
        // For each person with positive balance (owed money), collector pays them
        Object.entries(this.balances).forEach(([person, balance]) => {
            if (person === collector) return; // Skip the collector themselves

            if (balance < -0.01) {
                // This person owes money - they pay the collector
                settlements.push({
                    from: person,
                    to: collector,
                    amount: Math.abs(balance)
                });
            } else if (balance > 0.01) {
                // This person is owed money - collector pays them
                settlements.push({
                    from: collector,
                    to: person,
                    amount: balance
                });
            }
        });

        return settlements;
    },

    save() {
        localStorage.setItem('ganan_people', JSON.stringify(this.people));
        localStorage.setItem('ganan_expenses', JSON.stringify(this.expenses));
        localStorage.setItem('ganan_smartSettlement', JSON.stringify(this.smartSettlement));
        localStorage.setItem('ganan_collectorPerson', this.collectorPerson || '');
    },

    load() {
        const savedPeople = localStorage.getItem('ganan_people');
        const savedExpenses = localStorage.getItem('ganan_expenses');
        const savedSmartSettlement = localStorage.getItem('ganan_smartSettlement');
        const savedCollectorPerson = localStorage.getItem('ganan_collectorPerson');
        
        if (savedPeople) this.people = JSON.parse(savedPeople);
        if (savedExpenses) this.expenses = JSON.parse(savedExpenses);
        if (savedSmartSettlement) this.smartSettlement = JSON.parse(savedSmartSettlement);
        if (savedCollectorPerson) this.collectorPerson = savedCollectorPerson || null;
    },

    clearAll() {
        if (confirm('Are you sure you want to clear all people and expenses? This cannot be undone.')) {
            this.people = [];
            this.expenses = [];
            this.balances = {};
            this.save();
            this.render();
        }
    },

    render() {
        this.renderPeople();
        this.renderExpenseForm();
        this.renderExpenseList();
        this.renderBalances();
        this.renderSettlements();
        this.save();
    },

    renderPeople() {
        const list = document.getElementById('peopleList');
        list.innerHTML = '';

        if (this.people.length === 0) {
            list.innerHTML = '<p class="empty-message">No people added yet</p>';
            return;
        }

        this.people.forEach(person => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `
                <span>${this.escape(person)}</span>
                <button class="btn-remove" data-person="${this.escape(person)}">Remove</button>
            `;
            list.appendChild(li);
        });

        // Attach remove handlers
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const person = e.target.getAttribute('data-person');
                this.removePerson(person);
            });
        });
    },

    renderExpenseForm() {
        const payerSelect = document.getElementById('payerSelect');
        const collectorSelect = document.getElementById('collectorSelect');
        const beneficiariesContainer = document.getElementById('beneficiariesContainer');

        // Update payer dropdown
        payerSelect.innerHTML = '<option value="">Select person</option>';
        this.people.forEach(person => {
            const option = document.createElement('option');
            option.value = person;
            option.textContent = person;
            payerSelect.appendChild(option);
        });

        // Update collector dropdown
        if (collectorSelect) {
            collectorSelect.innerHTML = '<option value="">Select person to collect</option>';
            this.people.forEach(person => {
                const option = document.createElement('option');
                option.value = person;
                option.textContent = person;
                collectorSelect.appendChild(option);
            });
            if (this.collectorPerson) {
                collectorSelect.value = this.collectorPerson;
            }
        }

        // Update beneficiaries checkboxes
        beneficiariesContainer.innerHTML = '';
        this.people.forEach(person => {
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            label.innerHTML = `
                <input 
                    type="checkbox" 
                    value="${this.escape(person)}" 
                    class="beneficiary-checkbox"
                >
                <span>${this.escape(person)}</span>
            `;
            beneficiariesContainer.appendChild(label);
        });
    },

    renderExpenseList() {
        const container = document.getElementById('expenseListContainer');

        if (this.expenses.length === 0) {
            container.innerHTML = '<p class="empty-message">No expenses yet</p>';
            return;
        }

        let html = '<table class="expense-table"><thead><tr><th>Payer</th><th>Amount</th><th>Description</th><th>Beneficiaries</th><th>Action</th></tr></thead><tbody>';

        this.expenses.forEach((expense, idx) => {
            const beneficiaries = expense.for.join(', ');
            html += `
                <tr>
                    <td data-label="Payer:">${this.escape(expense.payer)}</td>
                    <td data-label="Amount:">LKR${expense.amount.toFixed(2)}</td>
                    <td data-label="Description:">${this.escape(expense.description)}</td>
                    <td data-label="Beneficiaries:">${this.escape(beneficiaries)}</td>
                    <td data-label=""><div class="btn-group"><button class="btn-edit" data-idx="${idx}">Edit</button><button class="btn-delete" data-idx="${idx}">Delete</button></div></td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Attach edit handlers
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                this.editExpense(idx);
            });
        });

        // Attach delete handlers
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                const expense = this.expenses[idx];
                if (confirm(`Delete expense: ${this.escape(expense.payer)} - LKR${expense.amount.toFixed(2)}?`)) {
                    this.expenses.splice(idx, 1);
                    this.render();
                }
            });
        });
    },

    editExpense(idx) {
        const expense = this.expenses[idx];
        this.editingIndex = idx;

        // Populate the form with expense data
        document.getElementById('payerSelect').value = expense.payer;
        document.getElementById('amountInput').value = expense.amount;
        document.getElementById('descriptionInput').value = expense.description;

        // Set beneficiaries
        document.querySelectorAll('.beneficiary-checkbox').forEach(checkbox => {
            checkbox.checked = expense.for.includes(checkbox.value);
        });

        // Change button text and show cancel button
        const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
        const cancelBtn = document.getElementById('cancelEditBtn');
        submitBtn.textContent = 'Update Expense';
        if (cancelBtn) cancelBtn.style.display = 'block';
        
        showPage('add-expense');
    },

    cancelEdit() {
        this.editingIndex = null;
        document.getElementById('expenseForm').reset();
        const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
        const cancelBtn = document.getElementById('cancelEditBtn');
        submitBtn.textContent = 'Add Expense';
        cancelBtn.style.display = 'none';
    },

    renderBalances() {
        const container = document.getElementById('balancesContainer');
        this.calculateBalances();

        const hasExpenses = Object.values(this.balances).some(b => Math.abs(b) > 0.01);

        if (!hasExpenses) {
            container.innerHTML = '<p class="empty-message">No balances yet</p>';
            return;
        }

        let html = '<div class="balances-list">';

        Object.entries(this.balances)
            .sort((a, b) => b[1] - a[1])
            .forEach(([person, balance]) => {
                if (Math.abs(balance) < 0.01) return; // Skip zero balances

                const status = balance > 0 ? 'owed' : 'owes';
                const amount = Math.abs(balance).toFixed(2);
                const cssClass = balance > 0 ? 'balance-positive' : 'balance-negative';

                html += `
                    <div class="balance-item ${cssClass}">
                        <span class="balance-person">${this.escape(person)}</span>
                        <span class="balance-amount">${status} LKR${amount}</span>
                    </div>
                `;
            });

        html += '</div>';
        container.innerHTML = html;
    },

    renderSettlements() {
        const container = document.getElementById('settlementsContainer');
        
        let settlements = [];

        if (this.smartSettlement) {
            settlements = this.calculateSettlements();
        } else {
            if (!this.collectorPerson) {
                container.innerHTML = '<p class="empty-message">Please select a collector person</p>';
                return;
            }
            settlements = this.calculateSimpleSettlements(this.collectorPerson);
        }

        if (settlements.length === 0) {
            container.innerHTML = '<p class="empty-message">No settlements needed</p>';
            return;
        }

        let html = '<div class="settlements-list">';

        settlements.forEach((settlement, idx) => {
            html += `
                <div class="settlement-item">
                    <strong>${this.escape(settlement.from)}</strong> pays 
                    <strong>${this.escape(settlement.to)}</strong>: 
                    <span class="settlement-amount">LKR${settlement.amount.toFixed(2)}</span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ========== EVENT HANDLERS ==========

document.addEventListener('DOMContentLoaded', () => {
    // Load saved data
    app.load();

    // Settlement Mode Toggle
    const smartSettlementToggle = document.getElementById('smartSettlementToggle');
    const collectorGroup = document.getElementById('collectorGroup');
    const collectorSelect = document.getElementById('collectorSelect');
    const modeIndicator = document.getElementById('modeIndicator');

    // Set initial state
    smartSettlementToggle.checked = app.smartSettlement;
    collectorGroup.style.display = app.smartSettlement ? 'none' : 'block';
    modeIndicator.textContent = app.smartSettlement ? '(Optimized)' : '(Simple Collection)';

    smartSettlementToggle.addEventListener('change', (e) => {
        app.smartSettlement = e.target.checked;
        collectorGroup.style.display = app.smartSettlement ? 'none' : 'block';
        modeIndicator.textContent = app.smartSettlement ? '(Optimized)' : '(Simple Collection)';
        
        if (!app.smartSettlement && !app.collectorPerson && app.people.length > 0) {
            // Auto-select first person if none is selected
            collectorSelect.value = app.people[0];
            app.collectorPerson = app.people[0];
        }

        app.renderSettlements();
        app.save();
    });

    collectorSelect.addEventListener('change', (e) => {
        app.collectorPerson = e.target.value || null;
        app.renderSettlements();
        app.save();
    });

    // Add Person
    document.getElementById('addPersonBtn').addEventListener('click', () => {
        const input = document.getElementById('personInput');
        const name = input.value.trim();
        if (name) {
            app.addPerson(name);
            input.value = '';
            input.focus();
        }
    });

    document.getElementById('personInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addPersonBtn').click();
        }
    });

    // Select/Deselect All beneficiaries
    document.getElementById('selectAllBtn').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.beneficiary-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
    });

    document.getElementById('deselectAllBtn').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.beneficiary-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
    });

    // Add Expense
    document.getElementById('expenseForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const payer = document.getElementById('payerSelect').value;
        const amount = document.getElementById('amountInput').value;
        const description = document.getElementById('descriptionInput').value;

        const beneficiaries = [];
        document.querySelectorAll('.beneficiary-checkbox:checked').forEach(checkbox => {
            beneficiaries.push(checkbox.value);
        });

        if (!payer) {
            alert('Please select a payer');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        if (beneficiaries.length === 0) {
            alert('Please select at least one beneficiary');
            return;
        }

        app.addExpense(payer, amount, beneficiaries, description);

        // Reset form
        document.getElementById('expenseForm').reset();
        document.getElementById('payerSelect').value = '';
        document.querySelectorAll('.beneficiary-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Reset editing state
        app.editingIndex = null;
        const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (submitBtn) submitBtn.textContent = 'Add Expense';
        if (cancelBtn) cancelBtn.style.display = 'none';
    });

    // Initial render
    app.render();

    // Clear All button
    const clearBtn = document.getElementById('clearAllBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            app.clearAll();
        });
    }
});
