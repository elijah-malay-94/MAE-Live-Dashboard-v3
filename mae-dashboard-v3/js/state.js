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
let countdown           = 30;
let activeAlerts        = [];
let activeChannelHeaders = null; // populated from data.header on each fetchData() call

// ═══════════════════════ INIT ═══════════════════════
async function init() {
  console.log('%c[init] Starting dashboard init()', 'color:#2563eb;font-weight:700');
  const today   = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  document.getElementById('dateFrom').value = sevenDaysAgo.toISOString().slice(0, 10);
  document.getElementById('dateTo').value   = today.toISOString().slice(0, 10);

  try {
    await ensureAuth();
    console.log('%c[init] Auth step completed', 'color:#16a34a;font-weight:700');
    const name = getUserName();
    const usernameEl = document.getElementById('topbarUsername');
    if (usernameEl) usernameEl.textContent = name ? name : '';
    await initDashboard();
  } catch (err) {
    showLoginModal();
  }
}

async function initDashboard() {
  allDevices = await fetchDevicesData(getUserId() || 1);
  if (allDevices.length > 0) {
    const savedId = (() => { try { return localStorage.getItem('mae_dashboard_active_device'); } catch(e) { return null; } })();
    activeDevice = allDevices.find(d => d.id === savedId) || allDevices[0];
    await fetchDevicesInfo(activeDevice.id);
    renderDeviceList();
    renderDeviceInfo();
    renderPowerChart();
    await loadData();
    if (allData.length > 0) {
      startAutoRefresh();
    } else {
      showErrorMessage('No data for this device in the selected period — try a different date range or select another device.');
    }
  } else {
    showErrorMessage('No devices found. Check customer ID and API connection.');
  }
  document.getElementById('footerDate').textContent = new Date().toLocaleDateString('en-GB');
}

async function loadData() {
  if (!activeDevice) {
    showErrorMessage('No active device selected yet. Please wait for devices to load.');
    return;
  }
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

