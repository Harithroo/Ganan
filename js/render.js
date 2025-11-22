// Load existing entries from localStorage
import { getAccounts, getEntriesByAccount, deleteEntry, getSetting } from './storage.js';

let editingIndex = null;
let editingAccount = null;

export function getEditingIndex() {
    return editingIndex;
}

export function setEditingIndex(val) {
    editingIndex = val;
}

export function getEditingAccount() {
    return editingAccount;
}

export function setEditingAccount(val) {
    editingAccount = val;
}

export function render() {
    u('#entries').html('');
    const accounts = getAccounts();
    
    // Get all entries and sort by date/time
    let allEntries = [];
    accounts.forEach(account => {
        const entries = getEntriesByAccount(account);
        entries.forEach((entry, index) => {
            allEntries.push({
                entry: entry,
                account: account,
                index: index
            });
        });
    });
    
    // Sort by date and time (descending - newest first)
    allEntries.sort((a, b) => {
        const dateA = new Date(a.entry["Date and time"]);
        const dateB = new Date(b.entry["Date and time"]);
        return dateB - dateA;
    });

    // Render sorted entries
    allEntries.forEach((item, displayIndex) => {
        const e = item.entry;
        const account = item.account;
        const i = item.index;
        
        const li = document.createElement('li');
        li.innerHTML = `
        <div class="info">
            <span>${e["Date and time"]}</span>
            <span>${e["Account"]} • ${e["Income/Expense"]}</span>
            <span>${e["Description"]}: Rs${parseFloat(e["Amount"]).toFixed(2)}</span>
        </div>
        <div class="controls">
            <button data-edit="${i}" data-account="${account}">✏️</button>
            <button data-delete="${i}" data-account="${account}">🗑️</button>
        </div>
        `;
        u('#entries').append(li);
    });

    // Attach handlers
    u('[data-delete]').on('click', e => {
        const i = +e.target.getAttribute('data-delete');
        const account = e.target.getAttribute('data-account');
        deleteEntry(account, i);
        render();
    });

    u('[data-edit]').on('click', e => {
        const i = +e.target.getAttribute('data-edit');
        const account = e.target.getAttribute('data-account');
        const entries = getEntriesByAccount(account);
        fillFormForEdit(entries[i], i, account);
    });
}

export function initRender() {
    render();
    u('#lastBackupDate').text(getSetting('lastBackup') || 'Never');
    u('#lastRestoreDate').text(getSetting('lastRestore') || 'Never');
}

function fillFormForEdit(entry, index, account) {
    setEditingIndex(index);
    setEditingAccount(account);

    u('#datetime').first().value = entry["Date and time"];
    u('#account').first().value = entry["Account"];
    u('#category').first().value = entry["Category"];
    u('#subcategory').first().value = entry["Subcategory"];
    u('#note').first().value = entry["Note"];
    u('#type').first().value = entry["Income/Expense"];
    u('#description').first().value = entry["Description"];
    u('#amount').first().value = entry["Amount"];

    u('#submitBtn').text('Update');
}