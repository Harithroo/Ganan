// Export
import { getAllEntries } from './storage.js';

export function exportEntries(type = 'csv') {
    const entries = getAllEntries();
    if (!entries.length) {
        alert('No entries to export.');
        return;
    }

    const delimiter = type === 'tsv' ? '\t' : ',';
    const headers = [
        "Date and time", "Account", "Category", "Subcategory", "Note",
        "Income/Expense", "Description", "Currency", "Amount"
    ];

    const rows = entries.map(entry => headers.map(h => `"${(entry[h] || '').toString().replace(/"/g, '""')}"`).join(delimiter));
    const content = [headers.join(delimiter), ...rows].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `entries-${Date.now()}.${type}`;
    a.click();
}