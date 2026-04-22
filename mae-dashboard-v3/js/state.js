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
let activeChannelHeaders = null; // populated from data.header on each fetchData() call

function updateWorkSubtitle() {
  const sub = document.getElementById('pageSubtitle');
  if (!sub) return;
  try {
    const desc = (localStorage.getItem('mae_dashboard_active_work_desc') || '').trim();
    const place = (localStorage.getItem('mae_dashboard_active_work_place') || '').trim();
    const devCnt = (localStorage.getItem('mae_dashboard_active_work_device_count') || '').trim();
    if (desc || place || devCnt) {
      sub.textContent = `WORK: ${desc || '—'} - PLACE: ${place || '—'} - DEVICES: ${devCnt || '—'}`;
      return;
    }
  } catch (e) { /* ignore */ }
  sub.textContent = 'WORK: — - PLACE: — - DEVICES: —';
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
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const dateFromEl = document.getElementById('dateFrom');
  const dateToEl = document.getElementById('dateTo');
  if (dateFromEl) dateFromEl.value = sevenDaysAgo.toISOString().slice(0, 10);
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
    const savedId = (() => {
      try { return localStorage.getItem('mae_dashboard_active_device'); } catch (e) { return null; }
    })();

    activeDevice = allDevices.find(d => d.id === savedId) || allDevices[0];
    await fetchDevicesInfo(activeDevice.id);
    if (typeof renderDeviceList === 'function') renderDeviceList();
    if (typeof renderDeviceInfo === 'function') renderDeviceInfo();
    if (typeof renderPowerChart === 'function') renderPowerChart();
    updateWorkSubtitle();
    await loadData();

    if (allData.length > 0 && typeof startAutoRefresh === 'function') {
      startAutoRefresh();
    } else if (!allData.length) {
      showErrorMessage('No data for this device in the selected period — try a different date range or select another device.');
    }
  } else {
    showErrorMessage('No devices found. Check customer ID and API connection.');
  }

  const footerDate = document.getElementById('footerDate');
  if (footerDate) footerDate.textContent = new Date().toLocaleDateString('en-GB');
}

async function loadData() {
  if (!activeDevice) {
    showErrorMessage('No active device selected yet. Please wait for devices to load.');
    return;
  }
  // Keep device info + power supply in sync with dashboard refresh cadence.
  try {
    await fetchDevicesInfo(activeDevice.id);
    if (typeof renderDeviceInfo === 'function') renderDeviceInfo();
    if (typeof renderPowerChart === 'function') renderPowerChart();
  } catch (e) { /* ignore power/info refresh failures */ }
  // Ensure we never show stale data while a new device/date range is loading.
  allData = [];
  filteredData = [];
  activeAlerts = [];
  if (typeof clearDataViews === 'function') clearDataViews('Loading…');

  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  try {
    allData = await fetchData(activeDevice.id, from, to);
  } catch (err) {
    allData = [];
    showErrorMessage('Could not load data: ' + (err.message || 'Server error. Try a different date range.'));
  }
  applyFilters();
}

const MAX_DISPLAY_RECORDS = 500;   // cap for "all data" view
const TRIM_FRACTION       = 0.05;  // trim 5% from each end before capping

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
    // Trim 5% from the oldest end, then cap newest end at MAX_DISPLAY_RECORDS
    const trimEnd = Math.floor(data.length * TRIM_FRACTION);
    if (trimEnd > 0) data = data.slice(0, data.length - trimEnd); // drop oldest 5%
    data = data.slice(0, MAX_DISPLAY_RECORDS);                    // keep newest 500
  }

  filteredData = data;
  renderAll();
}

async function applyDateFilter() {
  try {
    await loadData();
  } catch (err) {
    showErrorMessage(err?.message || 'Failed to load data.');
  }
}

function renderAll() {
  updateChannelSelect(); // rebuild dropdown for current device type
  checkAlerts();
  renderKPIs();
  renderChart();
  renderChannelsCharts();
  renderTable();
  document.getElementById('footerRecords').textContent = `${filteredData.length} records`;
}

