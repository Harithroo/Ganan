if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => {
            console.error('Service Worker registration failed:', err);
        });
    });
}

const STORAGE_KEYS = {
    people: 'ganan_people',
    expenses: 'ganan_expenses',
    smartSettlement: 'ganan_smartSettlement',
    collectorPerson: 'ganan_collectorPerson'
};

const EPSILON = 0.01;
const currencyFormatter = new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach((page) => {
        page.classList.toggle('active', page.id === pageId);
    });

    document.querySelectorAll('.nav-btn[data-page]').forEach((button) => {
        const isActive = button.getAttribute('data-page') === pageId;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    closeMenu();
}

function toggleMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const isOpen = navMenu.classList.toggle('active');
    hamburger.classList.toggle('active', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
}

function closeMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.remove('active');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
}

const app = {
    people: [],
    expenses: [],
    balances: {},
    editingIndex: null,
    smartSettlement: true,
    collectorPerson: null,

    elements: {},

    initElements() {
        this.elements = {
            personInput: document.getElementById('personInput'),
            peopleList: document.getElementById('peopleList'),
            payerSelect: document.getElementById('payerSelect'),
            amountInput: document.getElementById('amountInput'),
            descriptionInput: document.getElementById('descriptionInput'),
            beneficiariesContainer: document.getElementById('beneficiariesContainer'),
            expenseForm: document.getElementById('expenseForm'),
            submitExpenseBtn: document.getElementById('submitExpenseBtn'),
            cancelEditBtn: document.getElementById('cancelEditBtn'),
            expenseListContainer: document.getElementById('expenseListContainer'),
            balancesContainer: document.getElementById('balancesContainer'),
            settlementsContainer: document.getElementById('settlementsContainer'),
            smartSettlementToggle: document.getElementById('smartSettlementToggle'),
            collectorGroup: document.getElementById('collectorGroup'),
            collectorSelect: document.getElementById('collectorSelect'),
            modeIndicator: document.getElementById('modeIndicator'),
            statPeople: document.getElementById('statPeople'),
            statExpenses: document.getElementById('statExpenses'),
            statTotal: document.getElementById('statTotal')
        };
    },

    addPerson(name) {
        const normalized = name.trim();
        if (!normalized || this.people.includes(normalized)) return;

        this.people.push(normalized);

        if (!this.collectorPerson) {
            this.collectorPerson = normalized;
        }

        this.render();
    },

    removePerson(name) {
        if (!confirm(`Are you sure you want to remove "${name}"?`)) return;

        this.people = this.people.filter((person) => person !== name);

        // Clean up expenses referencing removed person.
        this.expenses = this.expenses
            .map((expense) => ({
                ...expense,
                for: expense.for.filter((beneficiary) => beneficiary !== name)
            }))
            .filter((expense) => expense.payer !== name && expense.for.length > 0);

        if (this.collectorPerson === name) {
            this.collectorPerson = this.people[0] || null;
        }

        this.render();
    },

    addExpense(payer, amount, beneficiaries, description) {
        const parsedAmount = Number.parseFloat(amount);
        if (!payer || parsedAmount <= 0 || beneficiaries.length === 0) return;

        const payload = {
            payer,
            amount: parsedAmount,
            for: beneficiaries,
            description: description?.trim() || 'No description'
        };

        if (this.editingIndex !== null) {
            this.expenses[this.editingIndex] = payload;
            this.editingIndex = null;
        } else {
            this.expenses.push(payload);
        }

        this.render();
    },

    calculateBalances() {
        const balances = Object.fromEntries(this.people.map((person) => [person, 0]));

        this.expenses.forEach((expense) => {
            const share = expense.amount / expense.for.length;
            balances[expense.payer] = (balances[expense.payer] || 0) + expense.amount;

            expense.for.forEach((beneficiary) => {
                balances[beneficiary] = (balances[beneficiary] || 0) - share;
            });
        });

        this.balances = balances;
        return balances;
    },

    calculateSettlements() {
        const balances = this.calculateBalances();

        const debtors = [];
        const creditors = [];

        Object.entries(balances).forEach(([person, balance]) => {
            if (balance < -EPSILON) {
                debtors.push({ person, amount: Math.abs(balance) });
            } else if (balance > EPSILON) {
                creditors.push({ person, amount: balance });
            }
        });

        debtors.sort((a, b) => a.amount - b.amount);
        creditors.sort((a, b) => a.amount - b.amount);

        const settlements = [];
        let debtorIndex = 0;
        let creditorIndex = 0;

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];
            const settleAmount = Math.min(debtor.amount, creditor.amount);

            settlements.push({
                from: debtor.person,
                to: creditor.person,
                amount: settleAmount
            });

            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            if (debtor.amount < EPSILON) debtorIndex += 1;
            if (creditor.amount < EPSILON) creditorIndex += 1;
        }

        return settlements;
    },

    calculateSimpleSettlements(collector) {
        const balances = this.calculateBalances();

        return Object.entries(balances)
            .filter(([person]) => person !== collector)
            .flatMap(([person, balance]) => {
                if (balance < -EPSILON) {
                    return [{ from: person, to: collector, amount: Math.abs(balance) }];
                }
                if (balance > EPSILON) {
                    return [{ from: collector, to: person, amount: balance }];
                }
                return [];
            });
    },

    save() {
        localStorage.setItem(STORAGE_KEYS.people, JSON.stringify(this.people));
        localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(this.expenses));
        localStorage.setItem(STORAGE_KEYS.smartSettlement, JSON.stringify(this.smartSettlement));
        localStorage.setItem(STORAGE_KEYS.collectorPerson, this.collectorPerson || '');
    },

    load() {
        try {
            this.people = JSON.parse(localStorage.getItem(STORAGE_KEYS.people) || '[]');
            this.expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || '[]');
            this.smartSettlement = JSON.parse(localStorage.getItem(STORAGE_KEYS.smartSettlement) || 'true');
            this.collectorPerson = localStorage.getItem(STORAGE_KEYS.collectorPerson) || null;
        } catch (error) {
            console.error('Failed to load local data:', error);
            this.people = [];
            this.expenses = [];
            this.smartSettlement = true;
            this.collectorPerson = null;
        }
    },

    clearAll() {
        if (!confirm('Are you sure you want to clear all people and expenses? This cannot be undone.')) return;

        this.people = [];
        this.expenses = [];
        this.balances = {};
        this.editingIndex = null;
        this.collectorPerson = null;

        this.resetExpenseForm();
        this.render();
    },

    resetExpenseForm() {
        this.elements.expenseForm.reset();
        this.editingIndex = null;
        this.elements.submitExpenseBtn.textContent = 'Add Expense';
        this.elements.cancelEditBtn.hidden = true;
    },

    render() {
        this.renderPeople();
        this.renderExpenseForm();
        this.renderExpenseList();
        this.renderBalances();
        this.renderSettlements();
        this.renderHomeStats();
        this.save();
    },

    renderHomeStats() {
        const total = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        this.elements.statPeople.textContent = String(this.people.length);
        this.elements.statExpenses.textContent = String(this.expenses.length);
        this.elements.statTotal.textContent = currencyFormatter.format(total);
    },

    renderPeople() {
        if (this.people.length === 0) {
            this.elements.peopleList.innerHTML = '<p class="empty-message">No people added yet</p>';
            return;
        }

        this.elements.peopleList.innerHTML = this.people
            .map(
                (person) => `
                    <li class="list-item">
                        <span>${this.escape(person)}</span>
                        <button class="btn-remove" data-person="${this.escape(person)}" type="button">Remove</button>
                    </li>
                `
            )
            .join('');
    },

    renderExpenseForm() {
        const buildOptions = (placeholder) => [
            `<option value="">${placeholder}</option>`,
            ...this.people.map((person) => `<option value="${this.escape(person)}">${this.escape(person)}</option>`)
        ].join('');

        this.elements.payerSelect.innerHTML = buildOptions('Select person');
        this.elements.collectorSelect.innerHTML = buildOptions('Select person to collect');

        if (this.collectorPerson) {
            this.elements.collectorSelect.value = this.collectorPerson;
        }

        this.elements.beneficiariesContainer.innerHTML = this.people
            .map(
                (person) => `
                    <label class="checkbox-label">
                        <input type="checkbox" value="${this.escape(person)}" class="beneficiary-checkbox">
                        <span>${this.escape(person)}</span>
                    </label>
                `
            )
            .join('');
    },

    renderExpenseList() {
        if (this.expenses.length === 0) {
            this.elements.expenseListContainer.innerHTML = '<p class="empty-message">No expenses yet</p>';
            return;
        }

        const rows = this.expenses
            .map((expense, index) => {
                const beneficiaries = expense.for.join(', ');
                return `
                    <tr>
                        <td data-label="Payer:">${this.escape(expense.payer)}</td>
                        <td data-label="Amount:">${currencyFormatter.format(expense.amount)}</td>
                        <td data-label="Description:">${this.escape(expense.description)}</td>
                        <td data-label="For:">${this.escape(beneficiaries)}</td>
                        <td data-label="">
                            <div class="btn-group">
                                <button class="btn-edit" data-idx="${index}" type="button">Edit</button>
                                <button class="btn-delete" data-idx="${index}" type="button">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join('');

        this.elements.expenseListContainer.innerHTML = `
            <table class="expense-table">
                <thead>
                    <tr>
                        <th>Payer</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Beneficiaries</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    editExpense(index) {
        const expense = this.expenses[index];
        if (!expense) return;

        this.editingIndex = index;
        this.elements.payerSelect.value = expense.payer;
        this.elements.amountInput.value = String(expense.amount);
        this.elements.descriptionInput.value = expense.description;

        document.querySelectorAll('.beneficiary-checkbox').forEach((checkbox) => {
            checkbox.checked = expense.for.includes(checkbox.value);
        });

        this.elements.submitExpenseBtn.textContent = 'Update Expense';
        this.elements.cancelEditBtn.hidden = false;

        showPage('add-expense');
    },

    cancelEdit() {
        this.resetExpenseForm();
    },

    renderBalances() {
        const balances = this.calculateBalances();
        const displayableBalances = Object.entries(balances)
            .filter(([, balance]) => Math.abs(balance) > EPSILON)
            .sort((a, b) => b[1] - a[1]);

        if (displayableBalances.length === 0) {
            this.elements.balancesContainer.innerHTML = '<p class="empty-message">No balances yet</p>';
            return;
        }

        this.elements.balancesContainer.innerHTML = displayableBalances
            .map(([person, balance]) => {
                const status = balance > 0 ? 'owed' : 'owes';
                const cssClass = balance > 0 ? 'balance-positive' : 'balance-negative';
                return `
                    <div class="balance-item ${cssClass}">
                        <span class="balance-person">${this.escape(person)}</span>
                        <span class="balance-amount">${status} ${currencyFormatter.format(Math.abs(balance))}</span>
                    </div>
                `;
            })
            .join('');
    },

    renderSettlements() {
        const container = this.elements.settlementsContainer;
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

        container.innerHTML = settlements
            .map(
                (settlement) => `
                    <div class="settlement-item">
                        <strong>${this.escape(settlement.from)}</strong> pays
                        <strong>${this.escape(settlement.to)}</strong>:
                        <span class="settlement-amount">${currencyFormatter.format(settlement.amount)}</span>
                    </div>
                `
            )
            .join('');
    },

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.initElements();
    app.load();

    app.elements.smartSettlementToggle.checked = app.smartSettlement;
    app.elements.collectorGroup.hidden = app.smartSettlement;
    app.elements.modeIndicator.textContent = app.smartSettlement ? '(Optimized)' : '(Simple Collection)';

    document.querySelector('.navbar').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button) return;
        showPage(button.getAttribute('data-page'));
    });

    document.querySelector('.home-buttons').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-target]');
        if (!button) return;
        showPage(button.getAttribute('data-target'));
    });

    document.getElementById('hamburger').addEventListener('click', toggleMenu);

    app.elements.peopleList.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-remove');
        if (!button) return;
        app.removePerson(button.getAttribute('data-person'));
    });

    app.elements.expenseListContainer.addEventListener('click', (event) => {
        const editBtn = event.target.closest('.btn-edit');
        if (editBtn) {
            app.editExpense(Number.parseInt(editBtn.getAttribute('data-idx'), 10));
            return;
        }

        const deleteBtn = event.target.closest('.btn-delete');
        if (!deleteBtn) return;

        const index = Number.parseInt(deleteBtn.getAttribute('data-idx'), 10);
        const expense = app.expenses[index];
        if (!expense) return;

        if (confirm(`Delete expense: ${expense.payer} - ${currencyFormatter.format(expense.amount)}?`)) {
            app.expenses.splice(index, 1);
            app.render();
        }
    });

    app.elements.cancelEditBtn.addEventListener('click', () => app.cancelEdit());

    document.getElementById('addPersonBtn').addEventListener('click', () => {
        const name = app.elements.personInput.value.trim();
        if (!name) return;

        app.addPerson(name);
        app.elements.personInput.value = '';
        app.elements.personInput.focus();
    });

    app.elements.personInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('addPersonBtn').click();
        }
    });

    document.getElementById('selectAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.beneficiary-checkbox').forEach((checkbox) => {
            checkbox.checked = true;
        });
    });

    document.getElementById('deselectAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.beneficiary-checkbox').forEach((checkbox) => {
            checkbox.checked = false;
        });
    });

    app.elements.expenseForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const payer = app.elements.payerSelect.value;
        const amount = app.elements.amountInput.value;
        const description = app.elements.descriptionInput.value;
        const beneficiaries = Array.from(document.querySelectorAll('.beneficiary-checkbox:checked'), (checkbox) => checkbox.value);

        if (!payer) {
            alert('Please select a payer');
            return;
        }

        if (!amount || Number.parseFloat(amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        if (beneficiaries.length === 0) {
            alert('Please select at least one beneficiary');
            return;
        }

        app.addExpense(payer, amount, beneficiaries, description);
        app.resetExpenseForm();
    });

    app.elements.smartSettlementToggle.addEventListener('change', (event) => {
        app.smartSettlement = event.target.checked;
        app.elements.collectorGroup.hidden = app.smartSettlement;
        app.elements.modeIndicator.textContent = app.smartSettlement ? '(Optimized)' : '(Simple Collection)';

        if (!app.smartSettlement && !app.collectorPerson && app.people.length > 0) {
            app.collectorPerson = app.people[0];
            app.elements.collectorSelect.value = app.collectorPerson;
        }

        app.renderSettlements();
        app.save();
    });

    app.elements.collectorSelect.addEventListener('change', (event) => {
        app.collectorPerson = event.target.value || null;
        app.renderSettlements();
        app.save();
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
        app.clearAll();
    });

    document.addEventListener('click', (event) => {
        const nav = document.getElementById('navMenu');
        const hamburger = document.getElementById('hamburger');

        if (!nav.classList.contains('active')) return;
        if (event.target.closest('#navMenu') || event.target.closest('#hamburger')) return;

        nav.classList.remove('active');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
    });

    app.render();
    showPage('home');
});
