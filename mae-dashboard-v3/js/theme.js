// theme.js — light/dark mode toggle using CSS variables

(function () {
  const STORAGE_KEY = 'mae_dashboard_theme';
  const SUPPORTED = ['light', 'dark'];

  function getTheme() {
    try {
      const raw = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase().trim();
      if (SUPPORTED.includes(raw)) return raw;
    } catch (e) { /* ignore */ }
    return 'light';
  }

  function setTheme(theme) {
    const next = SUPPORTED.includes(theme) ? theme : 'light';
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    applyTheme(next);
  }

  function applyTheme(theme = getTheme()) {
    document.documentElement.setAttribute('data-theme', theme);

    const btn = document.getElementById('themeToggleBtn');
    const label = document.getElementById('themeToggleLabel');
    if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';

    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.title = theme === 'dark' ? 'Dark mode' : 'Light mode';
      const sun = btn.querySelector('[data-theme-icon="sun"]');
      const moon = btn.querySelector('[data-theme-icon="moon"]');
      if (sun) sun.style.display = theme === 'dark' ? 'none' : '';
      if (moon) moon.style.display = theme === 'dark' ? '' : 'none';
    }
  }

  function toggleTheme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }

  window.MAE_THEME = { getTheme, setTheme, applyTheme, toggleTheme };
  window.toggleTheme = toggleTheme;

  document.addEventListener('DOMContentLoaded', () => applyTheme(getTheme()));
})();

