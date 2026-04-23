// ╔══════════════════════════════════════════════════════════════╗
// ║  render.js — All Rendering Functions                         ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • renderDeviceList()    sidebar device list                 ║
// ║  • switchDevice()        device switching logic              ║
// ║  • renderDeviceInfo()    device info card + mini map         ║
// ║  • renderKPIs()          KPI cards                           ║
// ║  • getThresholds() / getValueState() / checkAlerts()         ║
// ║  • updateChannelSelect() / renderChart()  main SVG chart     ║
// ║  • renderChannelsCharts()    secondary mini charts           ║
// ║  • renderPowerChart()    sidebar power SVG                   ║
// ║  • renderTable()         measurement log table               ║
// ║                                                              ║
// ║  Dependencies: config.js, api.js, state.js                   ║
// ║  Load order:   4th                                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ═══════════════════════ DEVICE LIST ═══════════════════════
function renderDeviceList() {
  const ledColorFromLastConnection = (lastConnectionRaw) => {
    if (!lastConnectionRaw) return 'var(--muted)'; // grey
    const t = new Date(String(lastConnectionRaw).replace(' ', 'T')).getTime();
    if (!Number.isFinite(t)) return 'var(--muted)';
    const mins = (Date.now() - t) / 60000;
    if (mins <= 15) return 'var(--green)'; // green
    if (mins <= 30) return '#f97316';      // orange
    return 'var(--red)';                   // red
  };

  const safe = (v) => {
    const s = (v === undefined || v === null) ? '' : String(v).trim();
    return s || '—';
  };

  document.getElementById('deviceList').innerHTML = allDevices.map(d => `
    <div class="device-item ${d.id === activeDevice.id ? 'active' : ''}" onclick="switchDevice('${d.id}')">
      <div class="device-dot" style="background:${ledColorFromLastConnection(d.last_connection)}"></div>
      <div class="device-info">
        <div class="device-serial">${safe(d.type)}</div>
        <div class="device-name">${safe(d.position || d.devicePlace || d.position_name || d.serial)}</div>
        <div class="device-serial">${safe(d.serial || d.id)}</div>
      </div>
    </div>
  `).join('');
}

// Clears all data-driven UI so we never show stale data when switching devices or date ranges.
function clearDataViews(message = 'No data') {
  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  const msg = message === 'No data' ? tr('common.noData', 'No data') : message;
  // KPIs
  const kpi = document.getElementById('kpiGrid');
  if (kpi) {
    // Keep it clean: when there is no data we hide the KPI row entirely (avoids huge empty blocks).
    kpi.innerHTML = '';
    kpi.style.display = 'none';
  }

  // Main chart
  const title = document.getElementById('chartTitle');
  const badge = document.getElementById('chartBadge');
  const svg   = document.getElementById('mainChartSvg');
  const svgWrap = document.querySelector('.chart-svg-area');
  const ylabs = document.getElementById('chartYLabels');
  const xlabs = document.getElementById('chartXLabels');
  const stats = document.getElementById('chartStats');
  if (title) title.textContent = '—';
  if (badge) badge.textContent = '';
  if (svg)   svg.innerHTML = `<text x="12" y="24" fill="rgba(100,116,139,0.7)" font-size="12">${msg}</text>`;
  if (svgWrap) svgWrap.style.height = '48px';
  if (ylabs) ylabs.innerHTML = '';
  if (xlabs) xlabs.innerHTML = '';
  if (stats) stats.innerHTML = '';
  const chartX = document.getElementById('chartXLabels');
  const chartY = document.getElementById('chartYLabels');
  if (chartX) chartX.style.display = 'none';
  if (chartY) chartY.style.display = 'none';

  // Mini charts (secondary channels)
  const mini = document.getElementById('channelsCharts');
  if (mini) mini.innerHTML = '';

  // Table
  const body = document.getElementById('tableBody');
  if (body) body.innerHTML = '';
  const count = document.getElementById('tableCount');
  if (count) count.textContent = `0 ${tr('common.records', 'records')}`;
}

async function switchDevice(id) {
  activeDevice = allDevices.find(d => d.id === id);
  if (!activeDevice) return;
  try { localStorage.setItem('mae_dashboard_active_device', id); } catch(e) { /* ignore */ }
  activeChannelHeaders = null; // reset — will be populated by the next fetchData() call

  // Prevent stale UI: clear all previous device data immediately.
  allData = [];
  filteredData = [];
  activeAlerts = [];
  clearDataViews('Loading…');

  renderDeviceList();

  /*
  VENGONO FATTI IN loadData() subito dopo
  await fetchDevicesInfo(activeDevice.id);
  renderDeviceList();
  renderDeviceInfo();
  renderPowerChart();
  if (typeof updateWorkSubtitle === 'function') updateWorkSubtitle();
*/

  document.getElementById('footerDevice').textContent = activeDevice.serial || activeDevice.id;

  // Set the period to the last diagnostic date, in order to have some data to view
  if(activeDevice.last_diagnostic){
    const datetoset = activeDevice.last_diagnostic.slice(0, 10);
    const fromEl = document.getElementById('dateFrom');
    const toEl = document.getElementById('dateTo');
    if (fromEl) fromEl.value = datetoset;
    if (toEl) toEl.value = datetoset;
  }  

  //LIVE MODE OFF if the device is not sending data today
  if(activeDevice.last_diagnostic){
    const date1 = new Date().toISOString().slice(0, 10);
    const date2 = activeDevice.last_diagnostic.slice(0, 10);

   if(date1 != date2)
    //liveMode = false;
   setLiveMode(false);
  }

  clearInterval(refreshTimer);
  await loadData();
  if (allData.length > 0) startAutoRefresh();
  else showErrorMessage('No data for this device in the selected period — try a different date range.');
}

function renderDeviceInfo() {
  const d = activeDevice;
  if (!d) return;
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
  const fmtIpPort = (ip, port) => {
    const a = (ip === undefined || ip === null) ? '' : String(ip).trim();
    const b = (port === undefined || port === null) ? '' : String(port).trim();
    if (!a && !b) return '—';
    if (a && b) return `${a}:${b}`;
    return a || b || '—';
  };
  document.getElementById('deviceInfoList').innerHTML = `
    <div class="info-row"><span class="info-key">Name</span><span class="info-val">${d.name}</span></div>
    <div class="info-row"><span class="info-key">Serial No.</span><span class="info-val">${d.serial || d.id}</span></div>
    <div class="info-row"><span class="info-key">Typology</span><span class="info-val">${d.type}</span></div>
    <div class="info-row"><span class="info-key">Last connection</span><span class="info-val">${d.lastConnection || '—'}</span></div>
    <div class="info-row"><span class="info-key">Signal</span><span class="info-val"><span class="badge" style="background:color-mix(in srgb, ${signalColor} 16%, transparent); border:1px solid color-mix(in srgb, ${signalColor} 38%, transparent); color:${signalColor};">● ${d.signal} / 4</span></span></div>
    <div class="info-row"><span class="info-key">Memory</span><span class="info-val"><span class="badge" style="background:color-mix(in srgb, ${memColor} 16%, transparent); border:1px solid color-mix(in srgb, ${memColor} 38%, transparent); color:${memColor};">${d.memory !== undefined ? `● ${d.memory}` : d.sdFree !== undefined ? `● ${sdFreeVal} MB` : (d.memory || '—')}</span></span></div>
    <div class="info-row"><span class="info-key">IP</span><span class="info-val">${fmtIpPort(d.ip, d.port)}</span></div>
    <div class="info-row"><span class="info-key">Public IP</span><span class="info-val">${fmtIpPort(d.ip_public, d.port_public)}</span></div>
    <div class="info-row">
      <span class="info-key">Location</span>
      <span class="info-val">${d.location || d.city || '—'}</span>
    </div>
    <div class="info-row"><span class="info-key">Position</span><span class="info-val">${d.position || '—'}</span></div>
    <div class="info-row"><span class="info-key">Coordinates</span><span class="info-val" style="font-size:10px;color:var(--muted2);">${(d.lat||0).toFixed(4)}°, ${(d.lng||0).toFixed(4)}°</span></div>
  `;
  renderMiniMapPreview();
  document.getElementById('footerSignal').textContent   = `Signal ${d.signal}/4`;
  document.getElementById('footerMemory').textContent   = `Memory ${d.memory || '—'}`;
  document.getElementById('footerPlatform').textContent = `${d.type} Platform`;
}

// ═══════════════════════ KPI CARDS ═══════════════════════
function renderKPIs() {
  if (!filteredData.length) {
    const kpi = document.getElementById('kpiGrid');
    if (kpi) {
      kpi.innerHTML = '';
      kpi.style.display = 'none';
    }
    return;
  }
  // Ensure visible when we have data.
  const kpiGrid = document.getElementById('kpiGrid');
  if (kpiGrid) kpiGrid.style.display = 'grid';
  const latest = filteredData[0];
  const prev   = filteredData[1] || latest;
  const cfg    = getDeviceConfig();

  // Trend indicator rules:
  // - latest > previous: orange up arrow
  // - latest < previous: orange down arrow
  // - latest = previous: green dot
  const trendClass = (a, b) => (a === b ? 'trend-stable' : 'trend-change');
  const trendLabel = (a, b) => a > b ? '▲' : a < b ? '▼' : '●';
  const colors = { ok:'var(--accent)', warn:'var(--orange)', alert:'var(--red)' };

  const cards = cfg.channels.map(ch => {
    const val  = latest[ch.key] ?? 0;
    const pval = prev[ch.key]   ?? val;
    const dec  = ['°C','V','Hz'].includes(ch.unit) ? 1 : 3;
    return {
      label: ch.label, dot: ch.color,
      value: val.toFixed(dec), unit: ' ' + ch.unit,
      sub: ch.sub, state: 'ok',
      trend: trendClass(val, pval), trendVal: trendLabel(val, pval),
    };
  });

  document.getElementById('kpiGrid').innerHTML = cards.map(c => `
    <div class="kpi-card ${c.state==='alert'?'alert-state':c.state==='warn'?'warn-state':''}">
      <div class="kpi-label"><!--span class="kpi-dot" style="background:${c.dot}"></span-->${c.label}</div>
      <div class="kpi-value" style="color:${colors[c.state]||'var(--accent)'}">
        ${c.value}<span style="font-size:14px;font-weight:400;color:var(--muted)">${c.unit}</span>
      </div>
      <div class="kpi-sub">${c.sub}</div>
      <div class="kpi-trend ${c.trend}">${c.trendVal}</div>
    </div>
  `).join('');
}

// ═══════════════════════ ALERTS ═══════════════════════
function renderThresholdChannels() {
  const host = document.getElementById('thresholdChannels');
  if (!host) return;
  const cfg = getDeviceConfig();
  const channels = Array.isArray(cfg?.channels) ? cfg.channels : [];

  const storeKey = () => {
    try {
      const type = String(activeDevice?.type || '').trim() || 'default';
      return `mae_thresholds_${type}`;
    } catch (e) { return 'mae_thresholds_default'; }
  };

  const loadStored = () => {
    try { return JSON.parse(localStorage.getItem(storeKey()) || '{}') || {}; } catch (e) { return {}; }
  };
  const stored = loadStored();

  const mkRow = (label, inputId, value, unit, step) => `
    <div class="threshold-row">
      <span class="threshold-label">${label}</span>
      <input type="number" class="threshold-input" id="${inputId}" value="${value}" step="${step}">
      <span class="threshold-unit">${unit || ''}</span>
    </div>
  `;

  host.innerHTML = channels.map((ch) => {
    const key = String(ch.key || '').trim();
    const unit = ch.unit || '';
    const cur = stored[key] || {};
    const warnMin = cur.warnMin ?? '';
    const warnMax = cur.warnMax ?? '';
    const alertMin = cur.alertMin ?? '';
    const alertMax = cur.alertMax ?? '';
    const step = ['°C','V','Hz'].includes(unit) ? '0.1' : '0.001';
    return `
      <div class="threshold-group" data-th-channel="${key}">
        <div class="threshold-group-title">${ch.label}${unit ? ` (${unit})` : ''}</div>
        ${mkRow('Min warn',  `th_${key}_warnMin`,  warnMin,  unit, step)}
        ${mkRow('Max warn',  `th_${key}_warnMax`,  warnMax,  unit, step)}
        ${mkRow('Min alert', `th_${key}_alertMin`, alertMin, unit, step)}
        ${mkRow('Max alert', `th_${key}_alertMax`, alertMax, unit, step)}
      </div>
    `;
  }).join('');
}

function getThresholds() {
  const out = {};
  const cfg = getDeviceConfig();
  const channels = Array.isArray(cfg?.channels) ? cfg.channels : [];

  const storeKey = () => {
    try {
      const type = String(activeDevice?.type || '').trim() || 'default';
      return `mae_thresholds_${type}`;
    } catch (e) { return 'mae_thresholds_default'; }
  };

  channels.forEach((ch) => {
    const key = String(ch.key || '').trim();
    if (!key) return;
    const read = (id) => {
      const el = document.getElementById(id);
      const v = el ? Number(el.value) : NaN;
      return Number.isFinite(v) ? v : undefined;
    };
    out[key] = {
      warnMin:  read(`th_${key}_warnMin`),
      warnMax:  read(`th_${key}_warnMax`),
      alertMin: read(`th_${key}_alertMin`),
      alertMax: read(`th_${key}_alertMax`),
    };
  });

  // Persist thresholds (best effort)
  try { localStorage.setItem(storeKey(), JSON.stringify(out)); } catch (e) { /* ignore */ }
  return out;
}

function getValueState(val, th) {
  if (!document.getElementById('alertsEnabled').checked) return 'ok';
  if (val === undefined || val === null || !th) return 'ok';
  if (th.alertMin !== undefined && (val < th.alertMin || val > th.alertMax)) return 'alert';
  if (val < th.warnMin || val > th.warnMax) return 'warn';
  return 'ok';
}

function checkAlerts() {
  if (!filteredData.length) return;
  const latest = filteredData[0];
  const th  = getThresholds();
  const cfg = getDeviceConfig();
  activeAlerts = [];

  cfg.alertChecks(latest, th).forEach(c => {
    if (c.val === undefined || c.val === null) return;
    const state = getValueState(c.val, c.th);
    if (state !== 'ok') activeAlerts.push({
      ...c, state,
      msg: `${c.label} = ${c.val} ${c.unit} — ${state === 'alert' ? 'CRITICAL' : 'Warning'} threshold exceeded`,
    });
  });

  const banner = document.getElementById('alertBanner');
  const badge  = document.getElementById('alertCount');
  if (activeAlerts.length && document.getElementById('alertsEnabled').checked) {
    banner.innerHTML = activeAlerts.map(a => `
      <div class="alert-item ${a.state==='warn'?'warn':''}">
        <span class="alert-icon">${a.state==='alert'?'🚨':'⚠️'}</span>
        <span class="alert-text"><strong>${a.msg}</strong> — recorded at ${filteredData[0].time}</span>
        <span class="alert-close" onclick="this.parentElement.remove()">✕</span>
      </div>
    `).join('');
    banner.style.marginBottom = '16px';
    badge.textContent   = activeAlerts.length;
    badge.style.display = 'inline';
  } else {
    banner.innerHTML          = '';
    banner.style.marginBottom = '0';
    badge.style.display       = 'none';
  }
}

// ═══════════════════════ MAIN CHART ═══════════════════════
function updateChannelSelect() {
  const cfg  = getDeviceConfig();
  const sel  = document.getElementById('channelSelect');
  const cur  = sel.value;
  const data = filteredData.length > 0 ? filteredData : allData;

  // Only show channels that have at least one non-zero, non-null value
  const activeChannels = cfg.channels.filter(ch =>
    data.some(r => r[ch.key] !== undefined && r[ch.key] !== null && r[ch.key] !== 0)
  );

  if (activeChannels.length === 0) {
    sel.innerHTML = `<option value="">—</option>`;
    return;
  }

  sel.innerHTML = activeChannels.map(ch =>
    `<option value="${ch.key}">${ch.label}${ch.unit ? ' (' + ch.unit + ')' : ''}</option>`
  ).join('');

  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function renderChart() {
  const cfg  = getDeviceConfig();
  const ch   = document.getElementById('channelSelect').value;
  if (!ch) {
    clearDataViews('No data');
    return;
  }
  const meta = cfg.chartMeta[ch] || Object.values(cfg.chartMeta)[0];
  const data = [...filteredData].reverse();
  if (!data.length) {
    const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
    // Clear chart-specific areas so we don't keep the previous device/date range rendering.
    const title = document.getElementById('chartTitle');
    const badge = document.getElementById('chartBadge');
    const svg   = document.getElementById('mainChartSvg');
    const svgWrap = document.querySelector('.chart-svg-area');
    const ylabs = document.getElementById('chartYLabels');
    const xlabs = document.getElementById('chartXLabels');
    const stats = document.getElementById('chartStats');
    if (title) title.textContent = '—';
    if (badge) badge.textContent = '';
    if (svg)   svg.innerHTML = `<text x="12" y="24" fill="rgba(100,116,139,0.7)" font-size="12">${tr('common.noData', 'No data')}</text>`;
    if (svgWrap) svgWrap.style.height = '48px';
    if (ylabs) ylabs.innerHTML = '';
    if (xlabs) xlabs.innerHTML = '';
    if (stats) stats.innerHTML = '';
    const chartX = document.getElementById('chartXLabels');
    const chartY = document.getElementById('chartYLabels');
    if (chartX) chartX.style.display = 'none';
    if (chartY) chartY.style.display = 'none';
    return;
  }
  // We have data: restore standard sizes and axes visibility.
  const svgWrap = document.querySelector('.chart-svg-area');
  if (svgWrap) svgWrap.style.height = '160px';
  const chartX = document.getElementById('chartXLabels');
  const chartY = document.getElementById('chartYLabels');
  if (chartX) chartX.style.display = 'flex';
  if (chartY) chartY.style.display = 'flex';

  document.getElementById('chartTitle').textContent = meta.label;
  document.getElementById('chartBadge').textContent = meta.badge;

  const vals = data.map(d => d[meta.key] ?? 0);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 0.02;
  const pad   = range * 0.3;
  const yMin  = minV - pad, yMax = maxV + pad;
  const W = 700, H = 160;
  const toY = v => H - ((v - yMin) / (yMax - yMin)) * H;
  const toX = i => (i / (data.length - 1 || 1)) * W;

  // Build smooth bezier path through data points
  function smoothPath(pts) {
    if (pts.length < 2) return pts.map(p=>`${p[0]},${p[1]}`).join(' ');
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i-1], curr = pts[i];
      const cpx = (prev[0] + curr[0]) / 2;
      d += ` C${cpx},${prev[1]} ${cpx},${curr[1]} ${curr[0]},${curr[1]}`;
    }
    return d;
  }

  const points = data.map((d,i) => [toX(i), toY(d[meta.key]??0)]);
  const linePath = smoothPath(points);
  const areaPath = linePath
    + ` L${toX(data.length-1)},${H} L0,${H} Z`;

  const gradId = `grad_${ch}`;
  const gridLines = [0.2, 0.4, 0.6, 0.8].map(f =>
    `<line x1="0" y1="${H*f}" x2="${W}" y2="${H*f}" stroke="rgba(100,116,139,0.12)" stroke-width="1"/>`
  ).join('');

  document.getElementById('mainChartSvg').innerHTML = `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${meta.color}" stop-opacity="0.22"/>
        <stop offset="60%"  stop-color="${meta.color}" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="${meta.color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#${gradId})"/>
    <path d="${linePath}" fill="none" stroke="${meta.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <circle cx="${points[points.length-1][0]}" cy="${points[points.length-1][1]}" r="3.5" fill="${meta.color}" stroke="#fff" stroke-width="1.5" opacity="0.95"/>
  `;

  const steps = [yMin, (yMin+yMax)/2, yMax];
  document.getElementById('chartYLabels').innerHTML = [...steps].reverse().map(v=>`<span>${v.toFixed(3)}</span>`).join('');

  const step = Math.max(1, Math.ceil(data.length / 8));
  document.getElementById('chartXLabels').innerHTML = data.filter((_,i)=>i%step===0).map(d=>`<span>${d.time.slice(0,5)}</span>`).join('');

  const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3);
  document.getElementById('chartStats').innerHTML = `
    <div class="chart-stat-item"><div class="chart-stat-label">MIN</div><div class="chart-stat-value">${minV.toFixed(3)} ${meta.unit}</div></div>
    <div class="chart-stat-item"><div class="chart-stat-label">MAX</div><div class="chart-stat-value" style="color:${meta.color}">${maxV.toFixed(3)} ${meta.unit}</div></div>
    <div class="chart-stat-item"><div class="chart-stat-label">AVG</div><div class="chart-stat-value">${avg} ${meta.unit}</div></div>
    <div class="chart-stat-item"><div class="chart-stat-label">RANGE</div><div class="chart-stat-value">${range.toFixed(3)} ${meta.unit}</div></div>
    <div class="chart-stat-item"><div class="chart-stat-label">SAMPLES</div><div class="chart-stat-value">${data.length}</div></div>
  `;
}

// ═══════════════════════ MINI CHARTS ═══════════════════════
function renderChannelsCharts() {
  const cfg = getDeviceConfig();
  document.getElementById('channelsCharts').innerHTML = cfg.miniCharts.map(ch => {
    const data = [...filteredData].reverse();
    if (!data.length) return '';
    const vals = data.map(d => d[ch.key] ?? 0);
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const range = maxV - minV || 0.02;
    const yMin  = minV - range*0.4, yMax = maxV + range*0.4;
    const W=400, H=50;
    const toY = v => H - ((v-yMin)/(yMax-yMin))*H;
    const toX = i => (i/(data.length-1||1))*W;
    const pts      = data.map((d,i)=>`${toX(i)},${toY(d[ch.key]??0)}`).join(' ');
    const areaPath = `M${toX(0)},${toY(data[0][ch.key]??0)} `
      + data.slice(1).map((d,i)=>`L${toX(i+1)},${toY(d[ch.key]??0)}`).join(' ')
      + ` L${toX(data.length-1)},${H} L0,${H} Z`;
    return `
      <div class="mini-chart-block">
        <div class="mini-chart-title">${ch.label} <span>${minV.toFixed(2)} → ${maxV.toFixed(2)}</span></div>
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
          <defs><linearGradient id="${ch.gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${ch.color}" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="${ch.color}" stop-opacity="0"/>
          </linearGradient></defs>
          <path d="${areaPath}" fill="url(#${ch.gradId})"/>
          <polyline points="${pts}" fill="none" stroke="${ch.color}" stroke-width="2" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${ch.color}88)"/>
        </svg>
      </div>`;
  }).join('');
}

// ═══════════════════════ POWER CHART ═══════════════════════
function renderPowerChart() {
  const d = activeDevice;
  if (!d) return;
  const hist = Array.isArray(window.powerSupplySmallHistory) && window.powerSupplySmallHistory.length
    ? window.powerSupplySmallHistory
    : [{ batt: Number(d.battery || 0), usb: Number(d.usb || 0), aux: Number(d.aux || 0) }];

  const latest = hist[hist.length - 1] || {};
  document.getElementById('legBatt').textContent = `${Number(latest.batt ?? d.battery ?? 0).toFixed(2)}V`;
  document.getElementById('legUsb').textContent  = `${Number(latest.usb ?? d.usb ?? 0).toFixed(2)}V`;
  document.getElementById('legAux').textContent  = `${Number(latest.aux ?? d.aux ?? 0).toFixed(2)}V`;

  const W = 300, H = 80;
  const toX = (i) => (i / (hist.length - 1 || 1)) * W;
  const allVals = hist.flatMap(p => [Number(p.batt||0), Number(p.usb||0), Number(p.aux||0)]);
  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 6);
  const pad = (maxV - minV) * 0.15 || 0.5;
  const yMin = Math.max(0, minV - pad);
  const yMax = Math.max(yMin + 1, maxV + pad);
  const toY = (v) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const pts = (key) => hist.map((p, i) => `${toX(i)},${toY(Number(p[key]||0))}`).join(' ');

  document.getElementById('powerSvg').innerHTML = `
    <polyline points="${pts('usb')}" fill="none" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>
    <polyline points="${pts('batt')}" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" style="filter:drop-shadow(0 0 4px rgba(239,68,68,0.5))" opacity="0.95"/>
    <polyline points="${pts('aux')}" fill="none" stroke="#10b981" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>
  `;
}

// ═══════════════════════ TABLE ═══════════════════════
function renderTable() {
  const cfg  = getDeviceConfig();
  const q    = document.getElementById('tableSearch').value.toLowerCase();
  const th   = getThresholds();
  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  const rows = filteredData.filter(r =>
    !q || Object.values(r).some(v => String(v).toLowerCase().includes(q))
  );

  // Rebuild column headers dynamically
  const tableHead = document.querySelector('.table-head');
  if (tableHead) {
    tableHead.style.gridTemplateColumns = cfg.tableColumns;
    const thLabel = (h) => {
      const key = String(h || '').trim().toLowerCase();
      if (key === 'date') return tr('table.date', h);
      if (key === 'time') return tr('table.time', h);
      if (key === 'status') return tr('table.status', h);
      return h;
    };
    tableHead.innerHTML = cfg.tableHeaders.map(h => `<span class="th">${thLabel(h)}</span>`).join('');
  }

  document.getElementById('tableBody').innerHTML = rows.map((r, i) => {
    const states = cfg.alertChecks(r, th).map(c =>
      (c.val !== undefined && c.val !== null) ? getValueState(c.val, c.th) : 'ok'
    );
    const anyBad = states.find(s => s !== 'ok');
    const okTxt = tr('status.ok', 'OK');
    const warnTxt = tr('status.warn', 'WARN');
    const alertTxt = tr('status.alert', 'ALERT');
    const badge  = anyBad === 'alert'
      ? `<span style="color:var(--red);font-size:10px;">● ${alertTxt}</span>`
      : anyBad === 'warn'
      ? `<span style="color:var(--orange);font-size:10px;">● ${warnTxt}</span>`
      : `<span style="color:var(--green);font-size:10px;">● ${okTxt}</span>`;
    const cells = cfg.tableRow(r, states);
    cells.push(`<span class="td">${badge}</span>`);
    const cls = i===0 && liveMode ? 'table-row new-row' : 'table-row';
    return `<div class="${cls}" style="grid-template-columns:${cfg.tableColumns}">${cells.join('')}</div>`;
  }).join('');

  document.getElementById('tableCount').textContent = `${rows.length} ${tr('common.records', 'records')}`;
}
