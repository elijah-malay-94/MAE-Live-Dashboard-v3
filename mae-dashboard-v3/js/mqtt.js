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

  const dotEl = document.getElementById('mqttPowerStatusDot');
  if (dotEl) dotEl.style.background = d ? 'var(--green)' : 'var(--muted)';

  if (!d) {
    listEl.innerHTML = '<div class="info-row"><span class="info-key" style="color:var(--muted)">No diagnostics data</span></div>';
    return;
  }

  const fmtV = v => { const n = parseFloat(v); return Number.isFinite(n) ? `${n.toFixed(2)} V` : '—'; };
  const fmtC = v => { const n = parseFloat(v); return Number.isFinite(n) ? `${n.toFixed(1)} °C` : '—'; };
  const inputOk = d.input_status === true || d.input_status === 1 || String(d.input_status).toLowerCase() === 'true' || d.input_status === '1';
  const inputColor = inputOk ? 'var(--green)' : 'var(--red)';

  listEl.innerHTML = `
    <div class="mqtt-diag-grid">
      <div class="mqtt-diag-col">
        <div class="mqtt-diag-head">PARAMETRI</div>
        <div class="info-row"><span class="info-key">Battery int</span><span class="info-val">${fmtV(d.battery_int)}</span></div>
        <div class="info-row"><span class="info-key">Battery ext</span><span class="info-val">${fmtV(d.battery_ext)}</span></div>
        <div class="info-row"><span class="info-key">Temperature</span><span class="info-val">${fmtC(d.temperature)}</span></div>
        <div class="info-row"><span class="info-key">Input</span><span class="info-val">${fmtV(d.input)}</span></div>
        <div class="info-row"><span class="info-key">Input status</span><span class="info-val" style="font-weight:600;color:${inputColor};">${inputOk ? 'true' : 'false'}</span></div>
      </div>
      <div class="mqtt-diag-col">
        <div class="mqtt-diag-head">DETTAGLI</div>
        <div class="info-row"><span class="info-key">Last update</span><span class="info-val">${_mqttEscHtml(d.last_update || '—')}</span></div>
        <div class="info-row"><span class="info-key">Topic</span><span class="info-val" style="font-size:10px;word-break:break-all;">${_mqttEscHtml(d.topic || '—')}</span></div>
        <div class="info-row"><span class="info-key">Result</span><span class="info-val">${d.result ?? '—'}</span></div>
        <div class="info-row"><span class="info-key">Message</span><span class="info-val">${_mqttEscHtml(d.message || '—')}</span></div>
      </div>
    </div>
  `;
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

  if (!s) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;">No status data</div>';
    _updateMonitoringBtn(null);
    return;
  }

  const isBool = v => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
  const boolVal   = v => isBool(v) ? 'true' : 'false';
  const boolColor = v => isBool(v) ? 'var(--green)' : 'var(--red)';
  const progress  = Math.min(100, Math.max(0, Number(s.acquisition_progress) || 0));

  el.innerHTML = `
    <div class="mqtt-diag-grid">
      <div class="mqtt-diag-col">
        <div class="mqtt-diag-head">STATUS</div>
        <div class="info-row"><span class="info-key">Device online</span><span class="info-val" style="font-weight:600;color:${boolColor(s.device_online)};">${boolVal(s.device_online)}</span></div>
        <div class="info-row"><span class="info-key">Monitoring active</span><span class="info-val" style="font-weight:600;color:${boolColor(s.monitoring_active)};">${boolVal(s.monitoring_active)}</span></div>
        <div class="info-row"><span class="info-key">Acquisition running</span><span class="info-val" style="font-weight:600;color:${boolColor(s.acquisition_running)};">${boolVal(s.acquisition_running)}</span></div>
        <div class="info-row"><span class="info-key">Acquisition progress</span><span class="info-val">${progress}%</span></div>
        <div class="info-row"><span class="info-key">Estimated end</span><span class="info-val">${_mqttEscHtml(s.estimated_end || '—')}</span></div>
      </div>
      <div class="mqtt-diag-col">
        <div class="mqtt-diag-head">RESULT</div>
        <div class="info-row"><span class="info-key">Result</span><span class="info-val">${s.result ?? '—'}</span></div>
        <div class="info-row"><span class="info-key">Message</span><span class="info-val">${_mqttEscHtml(s.message || '—')}</span></div>
        <div class="info-row"><span class="info-key">Last update</span><span class="info-val">${_mqttEscHtml(s.last_update || '—')}</span></div>
        <div class="info-row"><span class="info-key">Topic</span><span class="info-val" style="font-size:10px;word-break:break-all;">${_mqttEscHtml(s.topic || '—')}</span></div>
      </div>
    </div>
  `;

  _updateMonitoringBtn(s.monitoring_active);
}

function _updateMonitoringBtn(isActive) {
  const btn = document.getElementById('mqttMonitoringBtn');
  if (!btn) return;
  if (isActive === null || isActive === undefined) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  const active = isActive === true || isActive === 1 || isActive === '1' || String(isActive).toLowerCase() === 'true';
  btn.textContent = active ? 'Set Status Disattivo' : 'Set Status Attivo';
  btn.className   = active ? 'btn btn-danger' : 'btn btn-primary';
  btn.onclick     = () => _setMqttMonitoring(!active);
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

  const isActive = s => s.active === true || s.active === 1 || s.active === '1' || String(s.active).toLowerCase() === 'true';

  const rows = mqttSchedules.map(s => {
    const active       = isActive(s);
    const statusColor  = active ? 'var(--green)' : 'var(--red)';
    const statusLabel  = active ? 'Disattiva' : 'Attiva';
    const nameAttr     = JSON.stringify(s.name || '').replace(/"/g, '&quot;');
    return `<div class="mqtt-sched-row">
      <span class="td" style="font-size:11px;color:var(--accent);">${_mqttEscHtml(s.name || '—')}</span>
      <span class="td" style="font-size:10px;color:var(--muted2);">${_mqttEscHtml(s.start || '—')}</span>
      <span class="td" style="font-size:10px;color:var(--muted2);">${_mqttEscHtml(s.end || '—')}</span>
      <span class="td" style="font-size:10px;color:var(--muted2);">${_mqttEscHtml(s.time || '—')}</span>
      <span class="td" style="font-size:10px;color:var(--muted2);">${_mqttEscHtml(s.days || '—')}</span>
      <span class="td" style="font-size:10px;color:var(--muted2);">${_mqttEscHtml(s.next_event || '—')}</span>
      <span class="td">
        <button class="btn" style="padding:3px 10px;font-size:10px;background:color-mix(in srgb,${statusColor} 16%,transparent);border:1px solid color-mix(in srgb,${statusColor} 38%,transparent);color:${statusColor};"
          onclick="mqttToggleSchedule(${nameAttr}, ${!active})">${statusLabel}</button>
      </span>
      <span class="td" style="gap:4px;">
        <button class="btn" style="padding:3px 8px;font-size:10px;" onclick="viewMqttSchedule(${nameAttr})">Lista file</button>
        <button class="btn" style="padding:3px 7px;font-size:10px;" title="Edit schedule" onclick="openMqttScheduleEdit(${nameAttr})">
          <svg fill="none" height="11" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="11"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </button>
      </span>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="mqtt-sched-table">
    <div class="mqtt-sched-head">
      <span class="th">Nome</span>
      <span class="th">Start</span>
      <span class="th">End</span>
      <span class="th">Time</span>
      <span class="th">Giorni</span>
      <span class="th">Prossimo evento</span>
      <span class="th">Stato</span>
      <span class="th"></span>
    </div>
    ${rows}
  </div>`;
}

async function mqttToggleSchedule(name, activate) {
  if (typeof isMockMode === 'function' && isMockMode()) {
    const idx = mqttSchedules.findIndex(s => s.name === name);
    if (idx >= 0) { mqttSchedules[idx].active = activate; renderMqttSchedules(); }
    return;
  }
  try {
    await apiFetch(`/api/v1/devices/${encodeURIComponent(activeDevice.id)}/schedules/${encodeURIComponent(name)}`, {
      method: 'PUT', body: JSON.stringify({ active: activate }),
    });
    showMqttHint('success', `Schedule ${activate ? 'activated' : 'deactivated'}.`);
    await loadMqttSchedules();
  } catch (err) {
    showMqttHint('error', `Could not update schedule: ${err?.message || err}`);
  }
}

// ── Schedule edit modal ───────────────────────────────────────────────────────

let _mqttSchedEditName = null;

function openMqttScheduleEdit(name) {
  const sched = mqttSchedules.find(s => s.name === name);
  if (!sched) return;
  _mqttSchedEditName = name;

  const toInputDate = str => {
    if (!str || str === '—') return '';
    const p = str.split('/');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : str;
  };

  document.getElementById('mqttSchedStart').value = toInputDate(sched.start);
  document.getElementById('mqttSchedEnd').value   = toInputDate(sched.end);
  document.getElementById('mqttSchedTime').value  = sched.time || '';
  document.getElementById('mqttSchedDays').value  = sched.days || '';

  document.getElementById('mqttSchedEditOverlay').classList.add('open');
}

function closeMqttScheduleEdit() {
  document.getElementById('mqttSchedEditOverlay').classList.remove('open');
  _mqttSchedEditName = null;
}

async function saveMqttScheduleEdit() {
  const sched = mqttSchedules.find(s => s.name === _mqttSchedEditName);
  if (!sched) return;

  const startVal = document.getElementById('mqttSchedStart').value;
  const endVal   = document.getElementById('mqttSchedEnd').value;
  const timeVal  = document.getElementById('mqttSchedTime').value;
  const daysVal  = document.getElementById('mqttSchedDays').value;

  const toDisplay = str => {
    if (!str) return '';
    const p = str.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : str;
  };

  const payload = {
    name:    sched.name,
    enabled: sched.active,
    start:   startVal,
    end:     endVal,
    time:    timeVal,
    days:    daysVal,
  };

  if (typeof isMockMode === 'function' && isMockMode()) {
    sched.start = toDisplay(startVal);
    sched.end   = toDisplay(endVal);
    sched.time  = timeVal;
    sched.days  = daysVal;
    renderMqttSchedules();
    closeMqttScheduleEdit();
    showMqttHint('success', 'Schedule updated.');
    return;
  }

  try {
    await apiFetch(`/api/v1/devices/${encodeURIComponent(activeDevice.id)}/schedules/${encodeURIComponent(sched.name)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    showMqttHint('success', 'Schedule updated.');
    closeMqttScheduleEdit();
    await loadMqttSchedules();
  } catch (err) {
    showMqttHint('error', `Could not update schedule: ${err?.message || err}`);
  }
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
