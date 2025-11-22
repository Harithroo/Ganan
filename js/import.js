// import
import { getData, saveData } from './storage.js';

export function importEntries(file, type = 'csv') {
    const reader = new FileReader();
    const delimiter = type === 'tsv' ? '\t' : ',';

    reader.onload = function (e) {
        const lines = e.target.result.split('\n').filter(Boolean);
        const headers = lines[0].split(delimiter).map(h => h.replace(/(^"|"$)/g, '').trim());

        const newEntries = lines.slice(1).map(line => {
            const values = line.split(delimiter).map(v => v.replace(/(^"|"$)/g, '').trim());
            const entry = {};
            headers.forEach((h, i) => entry[h] = values[i]);
            entry["Amount"] = parseFloat(entry["Amount"]);
            return entry;
        });

        const data = getData();
        
        // Group new entries by account
        newEntries.forEach(entry => {
            const account = entry.Account;
            if (!data.entries.accounts[account]) {
                data.entries.accounts[account] = [];
            }
            data.entries.accounts[account].push(entry);
        });

        saveData(data);
        alert('Entries imported!');
    };

    reader.readAsText(file);
}