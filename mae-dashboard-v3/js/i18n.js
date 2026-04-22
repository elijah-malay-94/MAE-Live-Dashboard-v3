// i18n.js — very small EN/IT language switcher
// Stores language in localStorage and updates DOM elements marked with data-i18n attributes.

(function () {
  const STORAGE_KEY = 'mae_dashboard_lang';
  const SUPPORTED = ['en', 'it'];

  const dict = {
    en: {
      'lang.english': 'English',
      'lang.italian': 'Italian',
      'settings.language': 'Language',

      'nav.navigation': 'Navigation',
      'nav.dashboard': 'Dashboard',
      'nav.works': 'Works',
      'nav.alerts': 'Alerts',
      'nav.export': 'Export',
      'nav.settings': 'Settings',
      'nav.devices': 'Devices',

      'page.liveDashboard': 'Live Dashboard',
      'page.userPage': 'User Page',
      'works.subtitle': 'Select a work to view measures',

      'works.search.placeholder': 'Search works…',
      'works.filter.all': 'All',
      'works.filter.active': 'Active',
      'works.filter.inactive': 'Inactive',
      'works.summary': 'Summary',
      'works.totalWorks': 'Total works',
      'works.activeWorks': 'Active works',
      'works.inactiveWorks': 'Inactive works',
      'common.devices': 'Devices',
      'works.footerHint': 'Click a work to open measures',

      'controls.period': 'Period',
      'controls.apply': 'Apply',
      'controls.channel': 'Channel',
      'controls.interval': 'Interval',
      'controls.interval.all': 'All',
      'controls.interval.hour': 'Last hour',
      'controls.interval.day': 'Last 24h',
      'controls.autoRefresh': 'Auto-refresh',

      'dashboard.selectedChannel': 'Selected channel',
      'dashboard.allChannels': 'All Channels',
      'dashboard.deviceInfo': 'Device Info',
      'dashboard.powerSupply': 'Power Supply',
      'dashboard.measurementLog': 'Measurement Log',
      'dashboard.search.placeholder': 'Search...',

      'auth.login': 'Login',
      'auth.logout': 'Logout',
      'auth.signIn': 'Sign In',
      'auth.signingIn': 'Signing in…',
      'auth.missingCreds': 'Please enter username and password.',
      'auth.loginFailed': 'Login failed. Check your credentials.',

      'common.noData': 'No data',
      'common.records': 'records',
    },
    it: {
      'lang.english': 'Inglese',
      'lang.italian': 'Italiano',
      'settings.language': 'Lingua',

      'nav.navigation': 'Navigazione',
      'nav.dashboard': 'Cruscotto',
      'nav.works': 'Lavori',
      'nav.alerts': 'Allarmi',
      'nav.export': 'Esporta',
      'nav.settings': 'Impostazioni',
      'nav.devices': 'Dispositivi',

      'page.liveDashboard': 'Cruscotto Live',
      'page.userPage': 'Pagina Utente',
      'works.subtitle': 'Seleziona un lavoro per vedere le misure',

      'works.search.placeholder': 'Cerca lavori…',
      'works.filter.all': 'Tutti',
      'works.filter.active': 'Attivi',
      'works.filter.inactive': 'Inattivi',
      'works.summary': 'Riepilogo',
      'works.totalWorks': 'Totale lavori',
      'works.activeWorks': 'Lavori attivi',
      'works.inactiveWorks': 'Lavori inattivi',
      'common.devices': 'Dispositivi',
      'works.footerHint': 'Clicca un lavoro per aprire le misure',

      'controls.period': 'Periodo',
      'controls.apply': 'Applica',
      'controls.channel': 'Canale',
      'controls.interval': 'Intervallo',
      'controls.interval.all': 'Tutti',
      'controls.interval.hour': 'Ultima ora',
      'controls.interval.day': 'Ultime 24h',
      'controls.autoRefresh': 'Auto-aggiornamento',

      'dashboard.selectedChannel': 'Canale selezionato',
      'dashboard.allChannels': 'Tutti i canali',
      'dashboard.deviceInfo': 'Info dispositivo',
      'dashboard.powerSupply': 'Alimentazione',
      'dashboard.measurementLog': 'Registro misure',
      'dashboard.search.placeholder': 'Cerca...',

      'auth.login': 'Login',
      'auth.logout': 'Logout',
      'auth.signIn': 'Accedi',
      'auth.signingIn': 'Accesso…',
      'auth.missingCreds': 'Inserisci username e password.',
      'auth.loginFailed': 'Accesso fallito. Controlla le credenziali.',

      'common.noData': 'Nessun dato',
      'common.records': 'record',
    },
  };

  function getLanguage() {
    try {
      const raw = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase().trim();
      return SUPPORTED.includes(raw) ? raw : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function setLanguage(lang) {
    const next = SUPPORTED.includes(lang) ? lang : 'en';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) { /* ignore */ }
    applyLanguage(next);
  }

  function t(key) {
    const lang = getLanguage();
    return dict?.[lang]?.[key] ?? dict?.en?.[key] ?? key;
  }

  function applyLanguage(lang = getLanguage()) {
    // Update text nodes
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = dict?.[lang]?.[key] ?? dict?.en?.[key] ?? el.textContent;
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const txt = dict?.[lang]?.[key] ?? dict?.en?.[key];
      if (txt !== undefined && txt !== null) el.setAttribute('placeholder', String(txt));
    });

    // Update option labels
    document.querySelectorAll('option[data-i18n]').forEach((opt) => {
      const key = opt.getAttribute('data-i18n');
      if (!key) return;
      opt.textContent = dict?.[lang]?.[key] ?? dict?.en?.[key] ?? opt.textContent;
    });

    // Keep auth button label in sync (state/works wire the handler, we just refresh labels)
    if (typeof window.updateDashboardAuthButton === 'function') {
      try { window.updateDashboardAuthButton(); } catch (e) { /* ignore */ }
    }

    // Update language button active state
    const enBtn = document.getElementById('langBtnEn');
    const itBtn = document.getElementById('langBtnIt');
    if (enBtn) enBtn.classList.toggle('active', lang === 'en');
    if (itBtn) itBtn.classList.toggle('active', lang === 'it');
  }

  // Expose API
  window.MAE_I18N = { getLanguage, setLanguage, t, applyLanguage };
  window.t = t;
  window.setLanguage = setLanguage;

  document.addEventListener('DOMContentLoaded', () => applyLanguage(getLanguage()));
})();

