// ╔══════════════════════════════════════════════════════════════╗
// ║  state.js — Global State & Initialisation                    ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • State variables: allDevices, allData, filteredData,       ║
// ║    activeDevice, liveMode, refreshTimer, countdown,          ║
// ║    activeAlerts, activeChannelHeaders                        ║
// ║  • init()            page entry point                        ║
// ║  • loadData()        fetches + stores measurement data       ║
// ║  • applyFilters()    slices data by interval                 ║
// ║  • applyDateFilter() called by Apply button                  ║
// ║  • renderAll()       triggers all render functions           ║
// ║                                                              ║
// ║  Dependencies: config.js, api.js                            ║
// ║  Load order:   3rd                                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ═══════════════════════ STATE ═══════════════════════
let allDevices          = [];
let allData             = [];
let filteredData        = [];
let activeDevice        = null;
let liveMode            = true;
let refreshTimer        = null;
const AUTO_REFRESH_SECONDS = 120;
let countdown           = AUTO_REFRESH_SECONDS;
let activeAlerts        = [];
let activeEvents        = []; // event files loaded from API (type=evt)
let alarmedChannels     = []; // channel keys currently in alarm (derived from event file names)
let activeEventDetails  = {}; // cached event detail data keyed by file name
let activeChannelHeaders = null; // populated from data.header on each fetchData() call

function updateWorkSubtitle() {
  const sub = document.getElementById('pageSubtitle');
  if (!sub) return;
  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  const localizeWorkDesc = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    const word = tr('works.workWord', 'Work');
    // Normalize the leading "Work/Lavoro <N>" portion to the current language.
    // Keeps the rest of the description intact (e.g. "— Demo Site A").
    const m = s.match(/^(work|lavoro)\s+(\d+)\b/i);
    if (!m) return s;
    const num = m[2];
    return s.replace(m[0], `${word} ${num}`);
  };
  try {
    const desc = (localStorage.getItem('mae_dashboard_active_work_desc') || '').trim();
    const place = (localStorage.getItem('mae_dashboard_active_work_place') || '').trim();
    const devCnt = (localStorage.getItem('mae_dashboard_active_work_device_count') || '').trim();
    if (desc || place || devCnt) {
      sub.textContent = `${tr('works.workLabel', 'WORK')}: ${localizeWorkDesc(desc) || '—'} - ${tr('works.placeLabel', 'PLACE')}: ${place || '—'} - ${tr('works.devicesLabel2', 'DEVICES')}: ${devCnt || '—'}`;
      return;
    }
  } catch (e) { /* ignore */ }
  sub.textContent = `${tr('works.workLabel', 'WORK')}: — - ${tr('works.placeLabel', 'PLACE')}: — - ${tr('works.devicesLabel2', 'DEVICES')}: —`;
}

function navigateToWorks(event) {
  if (event) event.preventDefault();
  try {
    const qp = new URLSearchParams(window.location.search || "");
    const next = new URLSearchParams();
    next.set("page", "works");
    const mock = qp.get("mock");
    const proxy = qp.get("proxy");
    if (mock) next.set("mock", mock);
    if (proxy) next.set("proxy", proxy);
    window.location.href = `index.html?${next.toString()}`;
  } catch (e) {
    window.location.href = "index.html?page=works";
  }
}

function updateDashboardAuthButton() {
  const btn = document.getElementById('authBtn');
  if (!btn) return;

  const getCurrentPage = () => {
    try {
      const qp = new URLSearchParams(window.location.search || '');
      const p = (qp.get('page') || '').toLowerCase().trim();
      return (p === 'works' || p === 'dashboard') ? p : 'dashboard';
    } catch (e) { return 'dashboard'; }
  };

  const page = getCurrentPage();
  const token = loadAuthTokenFromStorage();
  const loggedIn = Boolean(token);

  // UX rule:
  // - If logged in: show "Logout" everywhere
  // - If logged out: show "Login"
  const shouldShowLogout = loggedIn;

  // Update label + action
  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  btn.title = shouldShowLogout ? tr('auth.logout', 'Logout') : tr('auth.login', 'Login');
  btn.onclick = shouldShowLogout
    ? doLogout
    : showLoginModal;

  // Swap text node while keeping the icon SVG
  const label = shouldShowLogout ? tr('auth.logout', 'Logout') : tr('auth.login', 'Login');
  const svg = btn.querySelector('svg');
  btn.innerHTML = '';
  if (svg) btn.appendChild(svg);
  btn.appendChild(document.createTextNode('\n          ' + label + '\n        '));
}

function showLoginModal() {
  const el = document.getElementById('loginOverlay');
  if (!el) return;
  el.classList.add('open');
  const u = document.getElementById('loginUsername');
  if (u) u.focus();
}

function hideLoginModal() {
  const el = document.getElementById('loginOverlay');
  if (!el) return;
  el.classList.remove('open');
  const err = document.getElementById('loginError');
  if (err) err.textContent = '';
}

// ═══════════════════════ INIT ═══════════════════════
async function init() {
  const getCurrentPage = () => {
    try {
      const qp = new URLSearchParams(window.location.search || '');
      const p = (qp.get('page') || '').toLowerCase().trim();
      return (p === 'works' || p === 'dashboard') ? p : 'dashboard';
    } catch (e) { return 'dashboard'; }
  };

  const page = getCurrentPage();
  console.log('%c[init] Starting app init()', 'color:#2563eb;font-weight:700', { page });
  // If on works page, let works.js handle it
  if (page === 'works') {
    return;
  }

  const today   = new Date();
  const dateFromEl = document.getElementById('dateFrom');
  const dateToEl = document.getElementById('dateTo');
  if (dateFromEl) dateFromEl.value = today.toISOString().slice(0, 10);
  if (dateToEl) dateToEl.value   = today.toISOString().slice(0, 10);

  await ensureAuth();
  console.log('%c[init] Auth step completed', 'color:#16a34a;font-weight:700');

  const name = getUserName();
  const usernameEl = document.getElementById('topbarUsername');
  if (usernameEl) usernameEl.textContent = name ? name : '';

  // If the user is logged out (no token), redirect to the login form.
  const token = loadAuthTokenFromStorage();
  updateDashboardAuthButton();
  if (!token) {
    // If not logged in (or after logout), redirect to the login form (works page),
    // not to the dashboard.
    window.location.href = 'index.html?page=works';
    return;
  }

  // Work-scoped dashboard: if logged in but no work selected, send user to Works.
  const workId = (typeof getActiveWorkId === 'function') ? getActiveWorkId() : '';
  if (token && !String(workId || '').trim()) {
    window.location.href = 'index.html?page=works';
    return;
  }

  await initDashboard();
}

async function initDashboard() {
  const customerId = getUserId();
  if (!String(customerId || '').trim()) {
    // Without a customer/user id we cannot load devices; route to Works/login.
    window.location.href = 'index.html?page=works';
    return;
  }

  allDevices = await fetchDevicesData(customerId);
  if (!Array.isArray(allDevices)) allDevices = [];

  if (allDevices.length > 0) {
    /*
    const savedId = (() => {
      try { return localStorage.getItem('mae_dashboard_active_device'); } catch (e) { return null; }
    })();

    activeDevice = allDevices.find(d => d.id === savedId) || allDevices[0];
    */
    activeDevice = allDevices[0];
    await fetchDevicesInfo(activeDevice.id);
    if (typeof renderDeviceList === 'function') renderDeviceList();
    if (typeof renderDeviceInfo === 'function') renderDeviceInfo();
    if (typeof renderPowerChart === 'function') renderPowerChart();
    updateWorkSubtitle();

    var isOnline = true;
    // Set the period to the last diagnostic date, in order to have some data to view
    if(activeDevice.last_diagnostic){
      const datetoset = activeDevice.last_diagnostic.slice(0, 10);
      const fromEl = document.getElementById('dateFrom');
      const toEl = document.getElementById('dateTo');
      if (fromEl) fromEl.value = datetoset;
      if (toEl) toEl.value = datetoset;
    }  

    //Check if the device isOnline (and sending data today)
    if(activeDevice.last_diagnostic){
      const date1 = new Date().toISOString().slice(0, 10);
      const date2 = activeDevice.last_diagnostic.slice(0, 10);

    if(date1 != date2)
      isOnline = false;
    }

    await loadData();

    if(!isOnline){
      //LIVE MODE OFF if the device is not online
      setLiveMode(false);
    }
    else if (allData.length > 0 && typeof startAutoRefresh === 'function') {
      startAutoRefresh();
    } else if (!allData.length) {
      const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
      showErrorMessage(tr('error.noDataDevicePeriodOrDevice', 'No data for this device in the selected period — try a different date range or select another device.'));
    }
  } else {
    const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
    showErrorMessage(tr('error.noDevicesFound', 'No devices found. Check customer ID and API connection.'));
  }

  const footerDate = document.getElementById('footerDate');
  if (footerDate) {
    const lang = (window.MAE_I18N?.getLanguage && typeof window.MAE_I18N.getLanguage === 'function')
      ? window.MAE_I18N.getLanguage()
      : 'en';
    const locale = (lang === 'it') ? 'it-IT' : 'en-GB';
    footerDate.textContent = new Date().toLocaleDateString(locale);
  }
}

async function loadData() {
  if (!activeDevice) {
    const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
    showErrorMessage(tr('error.noActiveDeviceYet', 'No active device selected yet. Please wait for devices to load.'));
    return;
  }
  // Keep device info + power supply in sync with dashboard refresh cadence.
  try {
    await fetchDevicesInfo(activeDevice.id);
    if (typeof renderDeviceInfo === 'function') renderDeviceInfo();
    if (typeof updatePowerSupplyData === 'function') {
      // Use diagnostics history limits: 10 points closed, 100 points open.
      updatePowerSupplyData();
    } else if (typeof renderPowerChart === 'function') {
      renderPowerChart();
    }
  } catch (e) { /* ignore power/info refresh failures */ }
  // Ensure we never show stale data while a new device/date range is loading.
  allData = [];
  filteredData = [];
  activeAlerts = [];
  activeEvents = [];
  alarmedChannels = [];
  activeEventDetails = {};
  if (typeof updateEventsBadge === 'function') updateEventsBadge(0);
  if (typeof clearDataViews === 'function') clearDataViews('Loading…');

  /*
  Now the range is set based on last_connection
  // Live mode always references "today → today" and auto-refreshes the last readings.
  if (liveMode) {
    const today = new Date().toISOString().slice(0, 10);
    const fromEl = document.getElementById('dateFrom');
    const toEl = document.getElementById('dateTo');
    if (fromEl) fromEl.value = today;
    if (toEl) toEl.value = today;
  }
  */
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  try {
    allData = await fetchData(activeDevice.id, from, to);
  } catch (err) {
    allData = [];
    const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
    const tf = (k, vars) => (typeof window.tf === 'function') ? window.tf(k, vars) : tr(k, k);
    const detail = err?.message || tr('error.serverErrorTryDifferentRange', 'Server error. Try a different date range.');
    showErrorMessage(tf('error.couldNotLoadData', { detail }));
  }
  // Always operate on the last 50 readings (both Live and Previous data mode).
  if (Array.isArray(allData)) allData = allData.slice(0, 50);
  applyFilters();
  loadEvents().catch(() => {});
}

async function loadEvents() {
  if (!activeDevice) return;
  const cfg = getDeviceConfig();
  if (!cfg.supportsEvents) {
    if (typeof setAlertsButtonsEnabled === 'function') setAlertsButtonsEnabled(false);
    if (typeof updateEventsBadge === 'function') updateEventsBadge(0);
    return;
  }
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;

  try {
    const result = await fetchDeviceFiles(activeDevice.id, { from, to, type: 'evt', limit: 100, offset: 0 });
    activeEvents = Array.isArray(result.records) ? result.records : [];

    // Map chN_ prefix → cfg.channels[N-1].key  (position-based, works for all device types)
    const alarmedSet = new Set();
    const channels = cfg.channels || [];
    activeEvents.forEach(evt => {
      const m = (evt.name || '').match(/^ch(\d+)_/i);
      if (m) {
        const idx = parseInt(m[1]) - 1;
        if (idx >= 0 && idx < channels.length) alarmedSet.add(channels[idx].key);
      }
    });
    alarmedChannels = [...alarmedSet];

    const total = Number(result.total) || activeEvents.length;
    if (typeof setAlertsButtonsEnabled === 'function') setAlertsButtonsEnabled(activeEvents.length > 0);
    if (typeof updateEventsBadge === 'function') updateEventsBadge(activeEvents.length > 0 ? total : 0);
    if (typeof renderKPIs === 'function') renderKPIs();
    // Pre-fetch event details in the background so measured values appear in the alarms panel.
    loadAllEventDetails().catch(() => {});
  } catch (err) {
    console.warn('[loadEvents] error:', err.message);
    activeEvents = [];
    alarmedChannels = [];
    if (typeof setAlertsButtonsEnabled === 'function') setAlertsButtonsEnabled(false);
    if (typeof updateEventsBadge === 'function') updateEventsBadge(0);
  }
}

async function loadAllEventDetails() {
  if (!activeDevice || !Array.isArray(activeEvents) || !activeEvents.length) return;
  const BATCH_SIZE = 5;
  for (let i = 0; i < activeEvents.length; i += BATCH_SIZE) {
    const batch = activeEvents.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (evt) => {
      if (!evt.name || activeEventDetails[evt.name]) return;
      try {
        const detail = await fetchEventDetails(activeDevice.id, evt.name);
        if (detail) {
          activeEventDetails[evt.name] = detail;
          // Update the already-rendered alarm panel row if the panel is open
          const safeId = evt.name.replace(/[^a-zA-Z0-9]/g, '_');
          const el = document.getElementById(`alarm-val-${safeId}`);
          if (el && detail.Peak != null) {
            const unit = detail.Unit || '';
            el.innerHTML = `${detail.Peak}${unit ? ` <em>${unit}</em>` : ''}`;
          }
        }
      } catch (e) { /* ignore per-event failures */ }
    }));
  }
}

const MAX_DISPLAY_RECORDS = 50;   // always show last 50 readings

function applyFilters() {
  const interval = document.getElementById('intervalSelect').value;
  let data = [...allData];

  const hasTs = data.some(r => Number.isFinite(Number(r?.ts)) && Number(r.ts) > 0);
  // Preserve original ordering (API order) — do not sort here.

  if (interval === 'hour' || interval === 'day') {
    if (hasTs) {
      // Filter relative to the newest reading we currently have, not the PC clock.
      // This makes "Last hour / Last 24h" work even when viewing historical ranges.
      const newestTs = data.reduce((max, r) => {
        const t = Number(r?.ts) || 0;
        return t > max ? t : max;
      }, 0);
      const now = newestTs || Date.now();
      const windowMs = interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const cutoff = now - windowMs;
      data = data.filter(r => Number(r?.ts) >= cutoff);
    } else {
      // Fallback if timestamps are unavailable
      data = interval === 'hour' ? data.slice(0, 6) : data.slice(0, 10);
    }
  } else {
    data = data.slice(0, MAX_DISPLAY_RECORDS);
  }

  filteredData = data;
  renderAll();
}

async function applyDateFilter() {
  try {
    // Previous data mode: applying a period pauses Live mode.
    if (typeof setLiveMode === 'function') setLiveMode(false);
    await loadData();
  } catch (err) {
    const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
    showErrorMessage(err?.message || tr('error.failedToLoadData', 'Failed to load data.'));
  }
}

function renderAll() {
  updateChannelSelect(); // rebuild dropdown for current device type
  checkAlerts();
  renderKPIs();
  renderChart();
  renderChannelsCharts();
  renderTable();
  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  document.getElementById('footerRecords').textContent = `${filteredData.length} ${tr('common.records', 'records')}`;
}

