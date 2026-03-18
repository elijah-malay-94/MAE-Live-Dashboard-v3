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
  // ── Default date pickers to today ──────────────────
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  document.getElementById('dateFrom').value = today;
  document.getElementById('dateTo').value   = today;

  allDevices = await fetchDevicesData(48); // TODO: make customerId dynamic
  if (allDevices.length > 0) {
    activeDevice = allDevices[0];
    await fetchDevicesInfo(activeDevice.id);
    renderDeviceList();
    renderDeviceInfo();
    renderPowerChart();
    await loadData();
    startAutoRefresh();
  } else {
    showErrorMessage('No devices found. Check customer ID and API connection.');
  }
  document.getElementById('footerDate').textContent = new Date().toLocaleDateString('en-GB');
}

async function loadData() {
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  allData = await fetchData(activeDevice.id, from, to);
  applyFilters();
}

const MAX_DISPLAY_RECORDS = 500;   // cap for "all data" view
const TRIM_FRACTION       = 0.05;  // trim 5% from each end before capping

function applyFilters() {
  const interval = document.getElementById('intervalSelect').value;
  let data = [...allData];
  if (interval === 'hour') data = data.slice(0, 6);
  else if (interval === 'day') data = data.slice(0, 10);
  else {
    // Trim 5% from the oldest end, then cap newest end at MAX_DISPLAY_RECORDS
    const trimEnd = Math.floor(data.length * TRIM_FRACTION);
    if (trimEnd > 0) data = data.slice(0, data.length - trimEnd); // drop oldest 5%
    data = data.slice(0, MAX_DISPLAY_RECORDS);                    // keep newest 500
  }
  filteredData = data;
  renderAll();
}

function applyDateFilter() { loadData(); }

function renderAll() {
  updateChannelSelect(); // rebuild dropdown for current device type
  checkAlerts();
  renderKPIs();
  renderChart();
  renderIsbcCharts();
  renderTable();
  document.getElementById('footerRecords').textContent = `${filteredData.length} records`;
}

