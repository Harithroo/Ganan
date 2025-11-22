// Handle new entries/updates/deletes
import { render, setEditingIndex, getEditingIndex, getEditingAccount } from './render.js';
import { addEntry, updateEntry } from './storage.js';

export function initEntries() {
    u('#entryForm').on('submit', ev => {
        ev.preventDefault();

        const entry = {
            "Date and time": u('#datetime').first().value,
            "Account": u('#account').first().value,
            "Category": u('#category').first().value,
            "Subcategory": u('#subcategory').first().value,
            "Note": u('#note').first().value,
            "Income/Expense": u('#type').first().value,
            "Description": u('#description').first().value,
            "Currency": "LKR",
            "Amount": parseFloat(u('#amount').first().value)
        };

        if (getEditingIndex() !== null) {
            updateEntry(getEditingIndex(), entry, getEditingAccount());
            setEditingIndex(null);
            u('#submitBtn').text('Add');
            alert('Entry updated!');
        } else {
            addEntry(entry);
            alert('Entry added!');
        }

        render();
        ev.target.reset();
    });
}