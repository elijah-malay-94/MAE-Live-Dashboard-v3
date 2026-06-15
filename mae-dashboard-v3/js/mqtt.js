// ╔══════════════════════════════════════════════════════════════╗
// ║  mqtt.js — MQTT/Remote Control Device Dashboard             ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • deviceIsRemoteControl()   detect ETWEB/remote devices    ║
// ║  • initMqttDashboard()       entry point                    ║
// ║  • loadMqttStatus()          fetch + render device status   ║
// ║  • loadMqttDiagnostics()     fetch + render power supply    ║
// ║  • loadMqttSchedules()       fetch + render schedule list   ║
// ║  • setMqttMonitoring()       enable/disable monitoring      ║
// ║                                                              ║
// ║  Dependencies: config.js, api.js, state.js, render.js       ║
// ║  Load order:   after modals.js                              ║
// ╚══════════════════════════════════════════════════════════════╝

let mqttStatus = null;
let mqttDiagnostics = null;
let mqttSchedules = [];
let _mqttSchedulesLoaded = false;

function deviceIsRemoteControl(d) {
  if (!d) return false;
  const t = String(d.type || '').toUpperCase();
  if (t.includes('ETWEB')) return true;
  const rc = d.HasRemoteControl ?? d.has_remote_control ?? d.hasRemoteControl ?? d.remote_control;
  if (rc === true || rc === '1' || rc === 1 || String(rc).toLowerCase() === 'true') return true;
  return false;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initMqttDashboard() {
  const customerId = getUserId();
  if (!String(customerId || '').trim()) {
    window.location.href = 'index.html?page=works';
    return;
  }

  allDevices = await fetchDevicesData(customerId);
  if (!Array.isArray(allDevices)) allDevices = [];

  if (allDevices.length === 0) {
    showMqttHint('error', 'No devices found. Check customer ID and API connection.');
    return;
  }

  const savedId = (() => {
    try { return localStorage.getItem('mae_dashboard_active_device'); } catch (e) { return null; }
  })();

  activeDevice =
    allDevices.find(d => d.id === savedId && deviceIsRemoteControl(d)) ||
    allDevices.find(d => deviceIsRemoteControl(d)) ||
    allDevices[0];

  await fetchDevicesInfo(activeDevice.id);

  if (typeof renderDeviceList === 'function') renderDeviceList();
  if (typeof updateWorkSubtitle === 'function') updateWorkSubtitle();

  const footerDate = document.getElementById('mqttFooterDate');
  if (footerDate) {
    const lang = (window.MAE_I18N?.getLanguage && typeof window.MAE_I18N.getLanguage === 'function')
      ? window.MAE_I18N.getLanguage() : 'en';
    footerDate.textContent = new Date().toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB');
  }

  renderMqttDeviceInfo();
  _mqttSchedulesLoaded = false;
  mqttSchedules = [];
  await loadMqttDiagnostics();
  await loadMqttStatus();
}

async function mqttSwitchDevice(id) {
  activeDevice = allDevices.find(d => d.id === id);
  if (!activeDevice) return;
  try { localStorage.setItem('mae_dashboard_active_device', id); } catch (e) {}

  if (typeof renderDeviceList === 'function') renderDeviceList();
  await fetchDevicesInfo(activeDevice.id);
  renderMqttDeviceInfo();

  _mqttSchedulesLoaded = false;
  mqttSchedules = [];

  const statusEl = document.getElementById('mqttStatusContent');
  if (statusEl) statusEl.innerHTML = '<div style="color:var(--muted);font-size:12px;">Loading…</div>';
  const schedEl = document.getElementById('mqttSchedulesList');
  if (schedEl) schedEl.innerHTML = '<div style="color:var(--muted);font-size:12px;">Loading…</div>';
  const monWrap = document.getElementById('mqttMonitoringBtnWrap');
  if (monWrap) monWrap.style.display = 'none';

  await loadMqttDiagnostics();
  await loadMqttStatus();
}

// ── Device Info ───────────────────────────────────────────────────────────────

function renderMqttDeviceInfo() {
  const d = activeDevice;
  if (!d) return;
  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;

  const signalVal = Number(d.signal);
  const signalColor =
    signalVal === 0 ? 'var(--red)' :
    signalVal === 1 ? '#f97316' :
    'var(--green)';

  const sdFreeVal = Number(d.sdFree);
  const memColor =
    !Number.isFinite(sdFreeVal) ? 'var(--muted)' :
    sdFreeVal <= 100 ? 'var(--red)' :
    sdFreeVal <= 1000 ? '#f97316' :
    'var(--green)';

  const ledColor = (raw) => {
    if (!raw) return 'var(--muted)';
    const t = new Date(String(raw).replace(' ', 'T')).getTime();
    if (!Number.isFinite(t)) return 'var(--muted)';
    const mins = (Date.now() - t) / 60000;
    if (mins <= 15) return 'var(--green)';
    if (mins <= 30) return '#f97316';
    return 'var(--red)';
  };

  const fmtIpPort = (ip, port) => {
    const a = ip == null ? '' : String(ip).trim();
    const b = port == null ? '' : String(port).trim();
    if (!a && !b) return '—';
    return (a && b) ? `${a}:${b}` : (a || b);
  };

  const dotEl = document.getElementById('mqttDeviceInfoStatus');
  if (dotEl) dotEl.style.background = ledColor(d.last_connection);

  const listEl = document.getElementById('mqttDeviceInfoList');
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="info-row"><span class="info-key">${tr('deviceInfo.position','Position')}</span><span class="info-val info-val--upper">${d.device_place || '—'}</span></div>
    <div class="info-row"><span class="info-key">${tr('deviceInfo.serialNo','Serial No.')}</span><span class="info-val">${d.serial || '—'}</span></div>
    <div class="info-row"><span class="info-key">${tr('deviceInfo.typology','Typology')}</span><span class="info-val info-val--upper">${d.type || '—'}</span></div>
    <div class="info-row"><span class="info-key">${tr('deviceInfo.lastConnection','Last connection')}</span><span class="info-val">${d.lastConnection || '—'}</span></div>
    <div class="info-row"><span class="info-key">${tr('deviceInfo.signal','Signal')}</span><span class="info-val">
      <span class="badge" style="background:color-mix(in srgb,${signalColor} 16%,transparent);border:1px solid color-mix(in srgb,${signalColor} 38%,transparent);color:${signalColor};">● ${d.signal !== undefined ? d.signal : '—'} / 4</span>
    </span></div>
    <div class="info-row"><span class="info-key">${tr('deviceInfo.memory','Memory')}</span><span class="info-val">
      <span class="badge" style="background:color-mix(in srgb,${memColor} 16%,transparent);border:1px solid color-mix(in srgb,${memColor} 38%,transparent);color:${memColor};">${d.memory !== undefined ? `● ${d.memory}` : d.sdFree !== undefined ? `● ${sdFreeVal} MB` : '—'}</span>
    </span></div>
    <div class="info-row"><span class="info-key">${tr('deviceInfo.ip','IP')}</span><span class="info-val">${fmtIpPort(d.ip, d.port)}</span></div>
    <div class="info-row"><span class="info-key">${tr('deviceInfo.publicIp','Public IP')}</span><span class="info-val">${fmtIpPort(d.ip_public, d.port_public)}</span></div>
  `;
}

// ── Power Supply ──────────────────────────────────────────────────────────────

async function loadMqttDiagnostics() {
  try {
    mqttDiagnostics = await fetchMqttDiagnostics(activeDevice.id);
    renderMqttPowerSupply();
  } catch (err) {
    console.warn('[loadMqttDiagnostics]', err?.message || err);
    renderMqttPowerSupply();
  }
}

function renderMqttPowerSupply() {
  const d = mqttDiagnostics;
  const listEl = document.getElementById('mqttPowerInfoList');
  if (!listEl) return;

  const fmtV = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? `${n.toFixed(2)} V` : '—'; };
  const fmtC = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? `${n.toFixed(1)} °C` : '—'; };

  const inputOk = d?.input_status === true || d?.input_status === 1 || String(d?.input_status).toLowerCase() === 'true' || d?.input_status === '1';
  const inputColor = inputOk ? 'var(--green)' : 'var(--red)';
  const inputLabel = inputOk ? 'ON' : 'OFF';

  const dotEl = document.getElementById('mqttPowerStatusDot');
  if (dotEl) dotEl.style.background = d ? 'var(--green)' : 'var(--muted)';

  listEl.innerHTML = d ? `
    <div class="info-row"><span class="info-key">Battery Int (V)</span><span class="info-val">${fmtV(d.battery_int)}</span></div>
    <div class="info-row"><span class="info-key">Battery Ext (V)</span><span class="info-val">${fmtV(d.battery_ext)}</span></div>
    <div class="info-row"><span class="info-key">Temperature (°C)</span><span class="info-val">${fmtC(d.temperature)}</span></div>
    <div class="info-row"><span class="info-key">Input Voltage (V)</span><span class="info-val">${fmtV(d.input)}</span></div>
    <div class="info-row"><span class="info-key">Input Status</span><span class="info-val">
      <span class="badge" style="background:color-mix(in srgb,${inputColor} 16%,transparent);border:1px solid color-mix(in srgb,${inputColor} 38%,transparent);color:${inputColor};">● ${inputLabel}</span>
    </span></div>
  ` : '<div class="info-row"><span class="info-key" style="color:var(--muted)">No diagnostics data</span></div>';
}

// ── Device Status ─────────────────────────────────────────────────────────────

async function loadMqttStatus() {
  const btn = document.getElementById('mqttStatusRefreshBtn');
  if (btn) {
    btn.disabled = true;
    const lbl = btn.querySelector('.mqtt-btn-label');
    if (lbl) lbl.textContent = 'Loading…';
  }
  try {
    mqttStatus = await fetchMqttStatus(activeDevice.id);
    renderMqttStatus();
    if (!_mqttSchedulesLoaded) {
      _mqttSchedulesLoaded = true;
      await loadMqttSchedules();
    }
  } catch (err) {
    console.warn('[loadMqttStatus]', err?.message || err);
    const el = document.getElementById('mqttStatusContent');
    if (el) el.innerHTML = '<div style="color:var(--muted);font-size:12px;">Status unavailable</div>';
  } finally {
    if (btn) {
      btn.disabled = false;
      const lbl = btn.querySelector('.mqtt-btn-label');
      if (lbl) lbl.textContent = 'Refresh';
    }
  }
}

function renderMqttStatus() {
  const s = mqttStatus;
  const el = document.getElementById('mqttStatusContent');
  if (!el) return;

  const BOOL_FIELDS = [
    { key: 'gps_lock',          label: 'GPS Lock' },
    { key: 'sd_card_ok',        label: 'SD Card' },
    { key: 'network_connected', label: 'Network' },
    { key: 'accelerometer_ok',  label: 'Accelerometer' },
    { key: 'rtc_sync',          label: 'RTC Sync' },
    { key: 'data_upload_ok',    label: 'Data Upload' },
  ];

  if (!s) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;">No status data</div>';
    _updateMonitoringBtn(null);
    return;
  }

  const isBoolTrue = (v) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';

  const boolCards = BOOL_FIELDS.map(f => {
    const val = isBoolTrue(s[f.key]);
    const color = val ? 'var(--green)' : 'var(--red)';
    const label = val ? 'OK' : 'FAIL';
    return `<div class="mqtt-bool-card" style="border-color:color-mix(in srgb,${color} 35%,transparent);">
      <div class="mqtt-bool-label">${f.label}</div>
      <div class="mqtt-bool-value"><span class="badge" style="background:color-mix(in srgb,${color} 16%,transparent);border:1px solid color-mix(in srgb,${color} 38%,transparent);color:${color};">● ${label}</span></div>
    </div>`;
  }).join('');

  const progress = Math.min(100, Math.max(0, Number(s.acquisition_progress) || 0));

  el.innerHTML = `
    <div class="mqtt-bool-grid">${boolCards}</div>
    <div class="mqtt-progress-section">
      <div class="mqtt-progress-label">
        <span>Acquisition Progress</span>
        <span>${progress}%</span>
      </div>
      <div class="mqtt-progress-track">
        <div class="mqtt-progress-fill" style="width:${progress}%"></div>
      </div>
    </div>
  `;

  _updateMonitoringBtn(s.monitoring_active);
}

function _updateMonitoringBtn(isActive) {
  const wrap = document.getElementById('mqttMonitoringBtnWrap');
  const btn = document.getElementById('mqttMonitoringBtn');
  if (!wrap || !btn) return;

  if (isActive === null || isActive === undefined) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  const active = isActive === true || isActive === 1 || isActive === '1' || String(isActive).toLowerCase() === 'true';
  btn.textContent = active ? 'Disable Monitoring' : 'Enable Monitoring';
  btn.className = active ? 'btn btn-danger' : 'btn btn-primary';
  btn.onclick = () => _setMqttMonitoring(!active);
}

async function _setMqttMonitoring(enable) {
  const btn = document.getElementById('mqttMonitoringBtn');
  if (btn) { btn.disabled = true; btn.textContent = enable ? 'Enabling…' : 'Disabling…'; }
  try {
    await setDeviceMqttMonitoring(activeDevice.id, enable);
    showMqttHint('success', enable ? 'Monitoring enabled.' : 'Monitoring disabled.');
    await loadMqttStatus();
  } catch (err) {
    showMqttHint('error', `Failed to ${enable ? 'enable' : 'disable'} monitoring: ${err?.message || err}`);
    if (btn) btn.disabled = false;
  }
}

// ── Schedules ─────────────────────────────────────────────────────────────────

async function loadMqttSchedules() {
  const btn = document.getElementById('mqttSchedulesRefreshBtn');
  if (btn) {
    btn.disabled = true;
    const lbl = btn.querySelector('.mqtt-btn-label');
    if (lbl) lbl.textContent = 'Loading…';
  }
  try {
    const result = await fetchMqttSchedules(activeDevice.id);
    mqttSchedules = Array.isArray(result?.records) ? result.records : [];
    renderMqttSchedules();
  } catch (err) {
    console.warn('[loadMqttSchedules]', err?.message || err);
    const el = document.getElementById('mqttSchedulesList');
    if (el) el.innerHTML = '<div style="color:var(--muted);font-size:12px;">Schedules unavailable</div>';
  } finally {
    if (btn) {
      btn.disabled = false;
      const lbl = btn.querySelector('.mqtt-btn-label');
      if (lbl) lbl.textContent = 'Refresh';
    }
  }
}

function renderMqttSchedules() {
  const el = document.getElementById('mqttSchedulesList');
  if (!el) return;

  if (!mqttSchedules.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">No schedules found.</div>';
    return;
  }

  const typeLabel = raw => {
    const k = String(raw || '').trim().toLowerCase();
    if (k === 'sch') return 'Schedule';
    if (k === 'cir') return 'Circular';
    if (k === 'evt') return 'Event';
    if (k === 'day') return 'Daily';
    return raw || '—';
  };

  const rows = mqttSchedules.map(s => {
    const safeName = _mqttEscHtml(s.name || '—');
    const safeTs   = _mqttEscHtml(s.timestamp || '—');
    const safeType = _mqttEscHtml(typeLabel(s.type));
    const nameAttr = _mqttEscHtml(s.name || '');
    return `<div class="mqtt-sched-row">
      <span class="td" style="font-size:11px;">${safeName}</span>
      <span class="td" style="font-size:10px;color:var(--muted2);">${safeTs}</span>
      <span class="td" style="font-size:10px;color:var(--muted2);">${safeType}</span>
      <span class="td" style="gap:6px;">
        <button class="btn" style="padding:3px 8px;font-size:10px;" onclick="viewMqttSchedule('${nameAttr}')">View</button>
        <button class="btn" style="padding:3px 8px;font-size:10px;" onclick="downloadMqttSchedule('${nameAttr}')">Download</button>
      </span>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="mqtt-sched-table">
    <div class="mqtt-sched-head">
      <span class="th">Name</span>
      <span class="th">Timestamp</span>
      <span class="th">Type</span>
      <span class="th">Actions</span>
    </div>
    ${rows}
  </div>`;
}

function _mqttEscHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

async function viewMqttSchedule(name) {
  try {
    const result = await fetchDeviceFile(activeDevice.id, name);
    const b64 = result?.base64 || result?.data || '';
    if (!b64) { showMqttHint('error', 'File content not available.'); return; }
    const text = decodeURIComponent(escape(atob(b64)));
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<pre style="font-family:monospace;padding:16px;background:#0f172a;color:#e2e8f0;min-height:100vh;">${_mqttEscHtml(text)}</pre>`);
      win.document.close();
    }
  } catch (err) {
    showMqttHint('error', `Could not view file: ${err?.message || err}`);
  }
}

async function downloadMqttSchedule(name) {
  try {
    const result = await fetchDeviceFile(activeDevice.id, name);
    const b64 = result?.base64 || result?.data || '';
    if (!b64) { showMqttHint('error', 'File content not available.'); return; }
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showMqttHint('error', `Could not download file: ${err?.message || err}`);
  }
}

// ── Hint / messages ───────────────────────────────────────────────────────────

function showMqttHint(type, msg) {
  const el = document.getElementById('apiHintMqtt');
  if (!el) return;
  el.style.display = 'block';
  if (type === 'error') {
    el.style.background = 'rgba(239,68,68,0.08)';
    el.style.borderColor = 'rgba(239,68,68,0.25)';
    el.innerHTML = `<strong>⚠️ ${msg}</strong>`;
  } else if (type === 'success') {
    el.style.background = 'rgba(16,185,129,0.08)';
    el.style.borderColor = 'rgba(16,185,129,0.25)';
    el.innerHTML = `<strong>✅ ${msg}</strong>`;
    setTimeout(() => { el.style.display = 'none'; el.innerHTML = ''; }, 3000);
  } else {
    el.style.background = '';
    el.style.borderColor = '';
    el.innerHTML = `<strong>${msg}</strong>`;
  }
}
