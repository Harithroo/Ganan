import { loadAllPartials } from './js/partials-loader.js';
import { initTheme } from './js/theme-toggle.js';
import { initRender } from './js/render.js';
import { initNav } from './js/nav.js';
import { initEntries } from './js/entries.js';
import { exportEntries } from './js/export.js';
import { importEntries } from './js/import.js';
import { initDriveAuth, backupToDrive, restoreFromDrive } from './js/drive.js';
import { initStorage, clearStorage } from './js/storage.js';

const CLIENT_ID = '582559971955-4qancoqkve8od8ji73hefkssqj8725ic.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_KEY = 'budgetDriveFileId';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize storage first
    initStorage();
    
    loadAllPartials([
        { id: 'home-container', file: 'partials/home.html' },
        { id: 'entries-container', file: 'partials/entries.html' },
        { id: 'entryform-container', file: 'partials/entryform.html' },
        { id: 'stats-container', file: 'partials/stats.html' },
        { id: 'settings-container', file: 'partials/settings.html' },
        { id: 'nav-container', file: 'partials/nav.html' }
    ], () => {
        initRender();
        initTheme();
        initNav();
        initEntries();
        initDriveAuth(CLIENT_ID, SCOPES);
        u('#exportCsvBtn').on('click', () => exportEntries('csv'));
        u('#exportTsvBtn').on('click', () => exportEntries('tsv'));
        u('#importFile').on('change', e => {
            const file = e.target.files[0];
            if (file) {
                const isTSV = file.name.endsWith('.tsv');
                importEntries(file, isTSV ? 'tsv' : 'csv');
            }
        });
        u('#backupBtn').on('click', () => backupToDrive());
        u('#restoreBtn').on('click', () => restoreFromDrive());
        u('#clearDataBtn').on('click', () => {
            if (confirm('Are you sure you want to clear all local data? This cannot be undone. Make sure you have backed up your data first!')) {
                clearStorage();
                location.reload();
            }
        });
    });
});