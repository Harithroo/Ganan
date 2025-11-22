// Storage management
const STORAGE_KEY = 'salli_data';

function getDefaultData() {
    return {
        entries: {
            accounts: {}
        },
        settings: {
            theme: 'light',
            lastBackup: null,
            lastRestore: null
        }
    };
}

export function initStorage() {
    // Initialize if not exists
    try {
        if (!localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(getDefaultData()));
        }
    } catch (err) {
        console.error('Error initializing storage:', err);
    }
}

export function clearStorage() {
    localStorage.removeItem(STORAGE_KEY);
    initStorage();
}

export function getData() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefaultData();
}

export function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getAllEntries() {
    const data = getData();
    return Object.values(data.entries.accounts).flat();
}

export function getEntriesByAccount(account) {
    const data = getData();
    return data.entries.accounts[account] || [];
}

export function getAccounts() {
    const data = getData();
    return Object.keys(data.entries.accounts);
}

export function addEntry(entry) {
    const data = getData();
    if (!data.entries.accounts[entry.Account]) {
        data.entries.accounts[entry.Account] = [];
    }
    data.entries.accounts[entry.Account].push(entry);
    saveData(data);
}

export function updateEntry(index, entry, account) {
    const data = getData();
    
    // Remove the entry from its current account
    data.entries.accounts[account].splice(index, 1);
    if (data.entries.accounts[account].length === 0) {
        delete data.entries.accounts[account];
    }

    // Add the entry to its new (or same) account
    if (!data.entries.accounts[entry.Account]) {
        data.entries.accounts[entry.Account] = [];
    }
    data.entries.accounts[entry.Account].push(entry);
    
    saveData(data);
}

export function deleteEntry(account, index) {
    const data = getData();
    data.entries.accounts[account].splice(index, 1);
    if (data.entries.accounts[account].length === 0) {
        delete data.entries.accounts[account];
    }
    saveData(data);
}

export function getSetting(key) {
    const data = getData();
    return data.settings[key];
}

export function setSetting(key, value) {
    const data = getData();
    data.settings[key] = value;
    saveData(data);
}