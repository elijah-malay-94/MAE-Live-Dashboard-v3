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
  document.getElementById('deviceList').innerHTML = allDevices.map(d => `
    <div class="device-item ${d.id === activeDevice.id ? 'active' : ''}" onclick="switchDevice('${d.id}')">
      <div class="device-dot" style="background:${d.status==='online'?'var(--green)':'var(--muted)'}"></div>
      <div class="device-info">
        <div class="device-name">${d.name}</div>
        <div class="device-serial">${d.serial || d.id}</div>
      </div>
      <div class="device-status" style="color:${d.status==='online'?'var(--green)':'var(--muted)'}">
        ${d.status==='online'?'●':'○'}
      </div>
    </div>
  `).join('');
}

async function switchDevice(id) {
  activeDevice = allDevices.find(d => d.id === id);
  if (!activeDevice) return;
  try { localStorage.setItem('mae_dashboard_active_device', id); } catch(e) { /* ignore */ }
  activeChannelHeaders = null; // reset — will be populated by the next fetchData() call
  await fetchDevicesInfo(activeDevice.id);
  renderDeviceList();
  renderDeviceInfo();
  renderPowerChart();
  document.getElementById('pageSubtitle').textContent =
    `DEVICE: ${activeDevice.type} · ${activeDevice.serial || activeDevice.id} · ${activeDevice.name} · ${liveMode ? 'AUTO-REFRESH ON' : 'PAUSED'}`;
  document.getElementById('footerDevice').textContent = activeDevice.serial || activeDevice.id;
  clearInterval(refreshTimer);
  await loadData();
  if (allData.length > 0) startAutoRefresh();
  else showErrorMessage('No data for this device in the selected period — try a different date range.');
}

function renderDeviceInfo() {
  const d = activeDevice;
  if (!d) return;
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
    <div class="info-row"><span class="info-key">Signal</span><span class="info-val"><span class="badge badge-green">● ${d.signal} / 4</span></span></div>
    <div class="info-row"><span class="info-key">Memory</span><span class="info-val">${d.memory || '—'}</span></div>
    <div class="info-row"><span class="info-key">IP</span><span class="info-val">${fmtIpPort(d.ip, d.port)}</span></div>
    <div class="info-row"><span class="info-key">Public IP</span><span class="info-val">${fmtIpPort(d.ip_public, d.port_public)}</span></div>
    <div class="info-row">
      <span class="info-key">City</span>
      <span class="info-val" style="display:flex;align-items:center;gap:8px;">
        ${d.city || '—'}
        <span onclick="openMapModal()" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);font-size:9px;color:var(--accent);font-family:'DM Mono',monospace;letter-spacing:0.5px;transition:all 0.15s;" onmouseover="this.style.background='rgba(59,130,246,0.2)'" onmouseout="this.style.background='rgba(59,130,246,0.1)'">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="10" height="10"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          MAP
        </span>
      </span>
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
  if (!filteredData.length) return;
  const latest = filteredData[0];
  const prev   = filteredData[1] || latest;
  const cfg    = getDeviceConfig();

  const trendClass = (a, b) => a > b ? 'trend-up' : a < b ? 'trend-down' : 'trend-stable';
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
      <div class="kpi-label"><span class="kpi-dot" style="background:${c.dot}"></span>${c.label}</div>
      <div class="kpi-value" style="color:${colors[c.state]||'var(--accent)'}">
        ${c.value}<span style="font-size:14px;font-weight:400;color:var(--muted)">${c.unit}</span>
      </div>
      <div class="kpi-sub">${c.sub}</div>
      <div class="kpi-trend ${c.trend}">${c.trendVal}</div>
    </div>
  `).join('');
}

// ═══════════════════════ ALERTS ═══════════════════════
function getThresholds() {
  return {
    pt50: {
      warnMin:  +document.getElementById('th_pt50_warnMin').value,
      warnMax:  +document.getElementById('th_pt50_warnMax').value,
      alertMin: +document.getElementById('th_pt50_alertMin').value,
      alertMax: +document.getElementById('th_pt50_alertMax').value,
    },
    x: { warnMin: +document.getElementById('th_x_warnMin').value, warnMax: +document.getElementById('th_x_warnMax').value },
    y: { warnMin: +document.getElementById('th_y_warnMin').value, warnMax: +document.getElementById('th_y_warnMax').value },
  };
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
  const cfg = getDeviceConfig();
  const sel = document.getElementById('channelSelect');
  const cur = sel.value;
  sel.innerHTML = cfg.channels.map(ch =>
    `<option value="${ch.key}">${ch.label}${ch.unit ? ' (' + ch.unit + ')' : ''}</option>`
  ).join('');
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function renderChart() {
  const cfg  = getDeviceConfig();
  const ch   = document.getElementById('channelSelect').value;
  const meta = cfg.chartMeta[ch] || Object.values(cfg.chartMeta)[0];
  const data = [...filteredData].reverse();
  if (!data.length) return;

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
  document.getElementById('legBatt').textContent = `${d.battery||0}V`;
  document.getElementById('legUsb').textContent  = `${d.usb||0}V`;
  document.getElementById('legAux').textContent  = `${d.aux||0}V`;
  const bY = 80 - ((d.battery||0) / 6) * 80;
  const uY = 80 - ((d.usb||0)     / 6) * 80;
  const aY = 80 - ((d.aux||0)     / 6) * 80;
  function flatLine(y) {
    return Array.from({length:10},(_,i)=>`${i*33},${y}`).join(' ');
  }
  document.getElementById('powerSvg').innerHTML = `
    <text x="4" y="${uY-2}" fill="#64748b" font-size="7" font-family="monospace">${d.usb||0}V</text>
    <text x="4" y="${bY-2}" fill="#64748b" font-size="7" font-family="monospace">${d.battery||0}V</text>
    <polyline points="${flatLine(uY)}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>
    <polyline points="${flatLine(bY)}" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" style="filter:drop-shadow(0 0 4px rgba(239,68,68,0.5))"/>
    <polyline points="${flatLine(aY)}" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="2,4" opacity="0.4"/>
  `;
}

// ═══════════════════════ TABLE ═══════════════════════
function renderTable() {
  const cfg  = getDeviceConfig();
  const q    = document.getElementById('tableSearch').value.toLowerCase();
  const th   = getThresholds();
  const rows = filteredData.filter(r =>
    !q || Object.values(r).some(v => String(v).toLowerCase().includes(q))
  );

  // Rebuild column headers dynamically
  const tableHead = document.querySelector('.table-head');
  if (tableHead) {
    tableHead.style.gridTemplateColumns = cfg.tableColumns;
    tableHead.innerHTML = cfg.tableHeaders.map(h => `<span class="th">${h}</span>`).join('');
  }

  document.getElementById('tableBody').innerHTML = rows.map((r, i) => {
    const states = cfg.alertChecks(r, th).map(c =>
      (c.val !== undefined && c.val !== null) ? getValueState(c.val, c.th) : 'ok'
    );
    const anyBad = states.find(s => s !== 'ok');
    const badge  = anyBad === 'alert'
      ? `<span style="color:var(--red);font-size:10px;">● ALERT</span>`
      : anyBad === 'warn'
      ? `<span style="color:var(--orange);font-size:10px;">● WARN</span>`
      : `<span style="color:var(--green);font-size:10px;">● OK</span>`;
    const cells = cfg.tableRow(r, states);
    cells.push(`<span class="td">${badge}</span>`);
    const cls = i===0 && liveMode ? 'table-row new-row' : 'table-row';
    return `<div class="${cls}" style="grid-template-columns:${cfg.tableColumns}">${cells.join('')}</div>`;
  }).join('');

  document.getElementById('tableCount').textContent = `${rows.length} record${rows.length!==1?'s':''}`;
}
