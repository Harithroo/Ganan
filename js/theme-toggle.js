// --- Theme Switcher ---
import { getSetting, setSetting } from './storage.js';

export function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = getSetting('theme');

    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
        // Set initial theme
        if (savedTheme) {
            setTheme(savedTheme, themeToggle);
        } else {
            setTheme(prefersDark ? 'dark' : 'light', themeToggle);
        }
    }
}

function setTheme(theme, themeToggle) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
        themeToggle.title = 'Switch to light mode';
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.checked = false;
        themeToggle.title = 'Switch to dark mode';
    }
}

function toggleTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const newTheme = themeToggle.checked ? 'dark' : 'light';
    setTheme(newTheme, themeToggle);
    setSetting('theme', newTheme);
}