// ╔══════════════════════════════════════════════════════════════╗
// ║  modals.js — Modals, Auto-Refresh, Export & App Start        ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • startAutoRefresh() / toggleAutoRefresh()                  ║
// ║  • openExport() / closeExport() / doExport() / downloadFile()║
// ║  • openThresholds() / closeThresholds()                      ║
// ║  • Map modal: openMapModal(), buildMapUrl(), loadMapForDevice ║
// ║    renderMapSidebar(), switchMapDevice(), jumpToCity()        ║
// ║    renderMiniMapPreview(), zoom/style controls               ║
// ║  • Power modal: openPowerModal(), closePowerModal()           ║
// ║    tickPowerModal(), renderPowerModal()                       ║
// ║    renderPowerCombinedChart(), renderPowerSparklines()        ║
// ║    showPowerTooltip(), hidePowerTooltip(), togglePowerLine()  ║
// ║  • init() call — starts the application                      ║
// ║                                                              ║
// ║  Dependencies: config.js, api.js, state.js, render.js       ║
// ║  Load order:   5th (last)                                    ║
// ╚══════════════════════════════════════════════════════════════╝


// ═══════════════════════ AUTO-REFRESH ═══════════════════════
function startAutoRefresh() {
  countdown = 30;
  clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    countdown--;
    document.getElementById('refreshCountdown').textContent  = `${countdown}s`;
    document.getElementById('refreshCountdown2').textContent = `${countdown}s`;
    if (countdown <= 0) {
      countdown = 30;
      if (!activeDevice) return;
      await loadData();
    }
  }, 1000);
}

function toggleAutoRefresh() {
  liveMode = !liveMode;
  const btn   = document.getElementById('refreshBtn');
  const label = document.getElementById('statusLabel');
  if (liveMode) {
    startAutoRefresh();
    btn.classList.remove('active');
    label.textContent = 'LIVE';
    document.getElementById('pageSubtitle').textContent =
      `DEVICE: ${activeDevice?.type} · ${activeDevice?.serial || activeDevice?.id} · AUTO-REFRESH ON`;
  } else {
    clearInterval(refreshTimer);
    btn.classList.add('active');
    label.textContent = 'PAUSED';
    document.getElementById('refreshCountdown').textContent  = 'paused';
    document.getElementById('refreshCountdown2').textContent = 'paused';
    document.getElementById('pageSubtitle').textContent =
      `DEVICE: ${activeDevice?.type} · ${activeDevice?.serial || activeDevice?.id} · AUTO-REFRESH PAUSED`;
  }
}

// ═══════════════════════ EXPORT ═══════════════════════
function openExport()  { document.getElementById('exportModal').classList.add('open'); }
function closeExport() { document.getElementById('exportModal').classList.remove('open'); }

let currentDeviceFiles = [];
let filesPagination = {
  offset: 0,
  limit: 50,
  total: 0,
  hasMore: false,
};

function openFilesModal() {
  closeExport();
  const today = new Date().toISOString().slice(0, 10);
  const fromEl = document.getElementById('filesFrom');
  const toEl = document.getElementById('filesTo');
  if (fromEl && !fromEl.value) fromEl.value = today;
  if (toEl && !toEl.value) toEl.value = today;
  filesPagination.offset = 0;
  filesPagination.total = 0;
  filesPagination.hasMore = false;
  updateFilesPaginationUI();
  document.getElementById('filesModal').classList.add('open');
}

function closeFilesModal() {
  document.getElementById('filesModal').classList.remove('open');
}

function renderFilesTable(records) {
  const list = document.getElementById('filesList');
  if (!list) return;
  if (!records || records.length === 0) {
    list.innerHTML = '<div class="files-row"><div class="files-cell">No files found for current filters.</div></div>';
    return;
  }

  list.innerHTML = `
    <div class="files-row files-head">
      <div class="files-cell"><strong>Name</strong></div>
      <div class="files-cell"><strong>Timestamp</strong></div>
      <div class="files-cell"><strong>Type</strong></div>
      <div class="files-cell"><strong>Action</strong></div>
    </div>
    ${records.map((r, idx) => `
      <div class="files-row">
        <div class="files-cell">${r.name || '—'}</div>
        <div class="files-cell">${r.timestamp || '—'}</div>
        <div class="files-cell">${r.type || '—'}</div>
        <div class="files-cell">
          <button class="btn" style="padding:5px 10px;font-size:10px;" onclick="downloadDeviceFileByIndex(${idx})">Download</button>
          ${String(r.type || '').toLowerCase() === 'evt'
            ? `<button class="btn" style="padding:5px 10px;font-size:10px;margin-left:6px;" onclick="loadEventDetailsFromFileIndex(${idx})">Event</button>`
            : ''
          }
        </div>
      </div>
    `).join('')}
  `;
}

function updateFilesPaginationUI() {
  const prev = document.getElementById('filesPrevBtn');
  const next = document.getElementById('filesNextBtn');
  const pageInfo = document.getElementById('filesPageInfo');
  const page = Math.floor(filesPagination.offset / filesPagination.limit) + 1;
  const pages = Math.max(1, Math.ceil((filesPagination.total || 0) / filesPagination.limit));
  if (pageInfo) pageInfo.textContent = `Page ${page} / ${pages}`;
  if (prev) prev.disabled = filesPagination.offset <= 0;
  if (next) next.disabled = !filesPagination.hasMore;
}

async function loadDeviceFiles() {
  filesPagination.offset = 0;
  await loadDeviceFilesPage('current');
}

async function loadDeviceFilesPage(direction = 'current') {
  if (!activeDevice?.id) return;
  if (direction === 'next' && filesPagination.hasMore) {
    filesPagination.offset += filesPagination.limit;
  } else if (direction === 'prev') {
    filesPagination.offset = Math.max(0, filesPagination.offset - filesPagination.limit);
  }

  const from = document.getElementById('filesFrom')?.value;
  const to = document.getElementById('filesTo')?.value;
  const type = document.getElementById('filesType')?.value || '';
  const summaryEl = document.getElementById('filesSummary');
  const prev = document.getElementById('filesPrevBtn');
  const next = document.getElementById('filesNextBtn');
  if (prev) prev.disabled = true;
  if (next) next.disabled = true;
  if (summaryEl) summaryEl.textContent = 'Loading files...';

  try {
    const res = await fetchDeviceFiles(activeDevice.id, {
      from,
      to,
      type,
      limit: filesPagination.limit,
      offset: filesPagination.offset,
    });
    currentDeviceFiles = Array.isArray(res.records) ? res.records : [];
    filesPagination.total = Number(res.total || 0);
    filesPagination.offset = Number(res.offset || 0);
    filesPagination.limit = Number(res.limit || filesPagination.limit);
    filesPagination.hasMore = Boolean(res.has_more);
    renderFilesTable(currentDeviceFiles);
    if (summaryEl) {
      summaryEl.textContent = `Loaded ${res.count} / ${res.total} files (offset ${res.offset}, limit ${res.limit})${res.has_more ? ' — more available' : ''}.`;
    }
    updateFilesPaginationUI();
  } catch (err) {
    currentDeviceFiles = [];
    filesPagination.hasMore = false;
    renderFilesTable([]);
    if (summaryEl) summaryEl.textContent = `Error loading files: ${err.message}`;
    updateFilesPaginationUI();
  }
}

function decodeBase64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function downloadDeviceFileByIndex(index) {
  const item = currentDeviceFiles[index];
  if (!item?.name || !activeDevice?.id) return;
  try {
    const res = await fetchDeviceFile(activeDevice.id, item.name);
    if (!res.base64) throw new Error('Missing base64 payload in API response.');
    const bytes = decodeBase64ToUint8Array(res.base64);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: item.name,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    alert(`Download failed: ${err.message}`);
  }
}

async function loadEventDetails() {
  const eventId = document.getElementById('eventIdInput')?.value?.trim();
  const pre = document.getElementById('eventDetailsPre');
  if (!pre) return;
  if (!activeDevice?.id) {
    pre.textContent = 'No active device selected.';
    return;
  }
  if (!eventId) {
    pre.textContent = 'Please insert an event ID.';
    return;
  }
  pre.textContent = 'Loading event details...';
  try {
    const details = await fetchEventDetails(activeDevice.id, eventId);
    pre.textContent = JSON.stringify(details, null, 2);
  } catch (err) {
    pre.textContent = `Error loading event details: ${err.message}`;
  }
}

function extractEventIdFromFileName(fileName) {
  const name = String(fileName || '').trim();
  if (!name) return '';

  // Common pattern: "..._<evt_id>.<ext>" => e.g. acquisition1_ch1_1234.dat
  const trailing = name.match(/_(\d+)(?:\.[^.]+)?$/);
  if (trailing?.[1]) return trailing[1];

  // Fallback: last numeric token anywhere in the name
  const allNumbers = name.match(/\d+/g);
  if (allNumbers && allNumbers.length > 0) return allNumbers[allNumbers.length - 1];

  return '';
}

async function loadEventDetailsFromFileIndex(index) {
  const item = currentDeviceFiles[index];
  const eventId = extractEventIdFromFileName(item?.name);
  if (!eventId) {
    alert('Could not extract event ID from filename.');
    return;
  }
  const input = document.getElementById('eventIdInput');
  if (input) input.value = eventId;
  await loadEventDetails();
}

function doExport(fmt) {
  closeExport();
  const cfg  = getDeviceConfig();
  const data = filteredData;
  const id   = activeDevice?.serial || activeDevice?.id || 'device';
  if (fmt === 'csv') {
    const header = cfg.tableHeaders.slice(0, -1).join(',') + '\n';
    const rows   = data.map(r => [r.date, r.time, ...cfg.channels.map(ch => r[ch.key] ?? '')].join(',')).join('\n');
    downloadFile(`datalogger_${id}_export.csv`, 'text/csv', header + rows);
  } else if (fmt === 'json') {
    downloadFile(`datalogger_${id}_export.json`, 'application/json',
      JSON.stringify({ device: id, exported: new Date().toISOString(), records: data }, null, 2));
  }
}

function previewReportSample() {
  closeExport();
  const cfg = getDeviceConfig();
  const keys = cfg.channels.map(c => c.key);

  // Generate 60 realistic sample records (sine waves + noise per channel)
  const sampleData = [];
  const baseDate = new Date(); baseDate.setDate(baseDate.getDate() - 30);
  // Per-channel wave params: [center, amplitude, period, phase]
  const waveParams = keys.map((_, i) => {
    const presets = [
      [120, 45, 20, 0],
      [2.1, 3.8, 14, 1.2],
      [-0.8, 2.5, 18, 2.5],
      [55, 5, 10, 0.8],
      [3.9, 0.3, 25, 1.5],
    ];
    return presets[i % presets.length];
  });

  for (let i = 0; i < 60; i++) {
    const d = new Date(baseDate.getTime() + i * 12 * 3600 * 1000);
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    const row = { date: dateStr, time: timeStr };
    keys.forEach((k, ki) => {
      const [center, amp, period, phase] = waveParams[ki];
      const noise = (Math.random() - 0.5) * amp * 0.3;
      row[k] = parseFloat((center + amp * Math.sin((i / period) * Math.PI * 2 + phase) + noise).toFixed(3));
    });
    sampleData.push(row);
  }

  const mockDev = {
    name: 'Sample Device', serial: 'DEMO-0001', type: activeDevice?.type || 'DL',
    status: 'Online', lastConnection: new Date().toLocaleString('en-GB'),
    memory: '512 KB', battery: '3.85', ip: '192.168.1.100', port: '8080',
    ip_public: '85.12.34.56', port_public: '8080',
  };
  _buildAndOpenReport(cfg, sampleData, mockDev, '2026-03-02', '2026-04-02');
}

function doPrintReport() {
  closeExport();
  const cfg  = getDeviceConfig();
  // Export what the user is currently looking at (filtered dataset).
  // Fall back to allData only if filtering produced an empty view.
  const data = (filteredData && filteredData.length > 0)
    ? filteredData
    : allData;
  const dev  = activeDevice || {};
  const from = document.getElementById('dateFrom')?.value || '—';
  const to   = document.getElementById('dateTo')?.value   || '—';
  _buildAndOpenReport(cfg, data, dev, from, to);
}

function _buildAndOpenReport(cfg, data, dev, from, to) {
  const serial = dev.serial || dev.id || '—';
  const now    = new Date().toLocaleString('en-GB');

  // Build channel headers using dynamic names if available, fallback to config
  const channelKeys = cfg.channels.map(c => c.key);
  const channelHeaders = cfg.channels.map(ch => {
    const unit = ch.unit ? ` (${ch.unit})` : '';
    return `${ch.label}${unit}`;
  });
  const headers = ['Date', 'Time', ...channelHeaders];

  const rows = data.map(r =>
    `<tr><td>${r.date ?? '—'}</td><td>${r.time ?? '—'}</td>${channelKeys.map(k =>
      `<td>${r[k] !== undefined && r[k] !== null ? r[k] : '—'}</td>`).join('')}</tr>`
  ).join('');

  const ip       = [dev.ip, dev.port].filter(Boolean).join(':')             || '—';
  const pubIp    = [dev.ip_public, dev.port_public].filter(Boolean).join(':') || '—';
  const lastConn = dev.lastConnection || '—';
  const memory   = dev.memory   || '—';
  const battery  = dev.battery  ? `${dev.battery} V`  : '—';
  const status   = dev.status   || '—';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Device Report — ${serial}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #0f172a; margin: 0; }
    .report-header { background: linear-gradient(120deg, #0f172a 0%, #1e3a5f 50%, #0e7490 100%); padding: 28px 36px 24px; margin-bottom: 28px; position: relative; overflow: hidden; }
    .report-header::after { content:''; position:absolute; right:-60px; top:-60px; width:220px; height:220px; border-radius:50%; background:rgba(255,255,255,0.04); }
    .report-header::before { content:''; position:absolute; right:80px; bottom:-40px; width:130px; height:130px; border-radius:50%; background:rgba(14,116,144,0.25); }
    .report-header h1 { font-size: 24px; color: #fff; margin: 0 0 4px; font-weight: 700; letter-spacing: -0.3px; }
    .report-header .sub { color: rgba(255,255,255,0.55); font-size: 11px; margin: 0; }
    .report-header .badge { display:inline-block; margin-top:12px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.18); border-radius:20px; padding:3px 12px; font-size:10px; color:rgba(255,255,255,0.8); letter-spacing:0.5px; }
    .page-body { padding: 0 30px 30px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 20px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
    .info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .info-val { font-size: 13px; font-weight: bold; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
    th { background: #f1f5f9; padding: 7px 10px; text-align: left; border: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 6px 10px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 8px; }
    .ch-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px 8px; background: #fafbfc; }
    .ch-card-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .ch-card-range { font-size: 9px; color: #94a3b8; font-weight: 400; font-family: monospace; }
    .ch-card canvas { display: block; width: 100%; border-radius: 4px; }
    .overview-card { border: none; border-radius: 10px; padding: 14px 16px 12px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0e7490 100%); margin-top: 8px; box-shadow: 0 4px 18px rgba(14,116,144,0.18); }
    .overview-card h2-label { color: rgba(255,255,255,0.55); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .overview-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 9px; }
    .overview-legend-item { display: flex; align-items: center; gap: 5px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; color: rgba(255,255,255,0.85); }
    .overview-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 4px currentColor; }
    @media print { body { margin: 0; } .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .overview-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
  <div class="report-header">
    <h1>Device Export Report</h1>
    <div class="sub">Generated: ${now}</div>
    <div class="badge">&#9679;&nbsp; ${serial} &nbsp;·&nbsp; ${dev.type || 'MAE DataLogger'} &nbsp;·&nbsp; ${from} → ${to}</div>
  </div>
  <div class="page-body">

  <h2>Device Information</h2>
  <div class="info-grid">
    <div class="info-box"><div class="info-label">Device Name</div><div class="info-val">${dev.name || '—'}</div></div>
    <div class="info-box"><div class="info-label">Serial No.</div><div class="info-val">${serial}</div></div>
    <div class="info-box"><div class="info-label">Type</div><div class="info-val">${dev.type || '—'}</div></div>
    <div class="info-box"><div class="info-label">Status</div><div class="info-val">${status}</div></div>
    <div class="info-box"><div class="info-label">Last Connection</div><div class="info-val">${lastConn}</div></div>
    <div class="info-box"><div class="info-label">Memory Free</div><div class="info-val">${memory}</div></div>
    <div class="info-box"><div class="info-label">Battery</div><div class="info-val">${battery}</div></div>
    <div class="info-box"><div class="info-label">IP Address</div><div class="info-val">${ip}</div></div>
    <div class="info-box"><div class="info-label">Public IP</div><div class="info-val">${pubIp}</div></div>
  </div>

  <h2>Data Records — ${from} → ${to} &nbsp;·&nbsp; ${data.length} records</h2>
  <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows || '<tr><td colspan="' + headers.length + '" style="text-align:center;color:#94a3b8;padding:16px;">No data available for this period</td></tr>'}</tbody>
  </table>
  <h2>Data Visualization</h2>
  <div class="charts-grid" id="chartsGrid"></div>
  <script>
  (function(){
    var raw    = ${JSON.stringify(data.map(r => { const o = {date: r.date, time: r.time}; channelKeys.forEach(k => { o[k] = r[k]; }); return o; }))};
    var keys   = ${JSON.stringify(channelKeys)};
    var labels = ${JSON.stringify(cfg.channels.map(ch => ch.label + (ch.unit ? ' (' + ch.unit + ')' : '')))};
    var colors = ${JSON.stringify(channelKeys.map(k => (cfg.chartMeta && cfg.chartMeta[k]) ? cfg.chartMeta[k].color : '#3b82f6'))};
    var grid   = document.getElementById('chartsGrid');

    function drawMiniChart(canvas, vals, color) {
      var W = canvas.parentElement.clientWidth - 28;
      var H = 70;
      canvas.width  = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);

      if (vals.length < 2) {
        // grid placeholder
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
        for (var gi = 0; gi <= 3; gi++) {
          var gy = (H / 3) * gi;
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }
        ctx.fillStyle = '#cbd5e1'; ctx.font = '9px Arial'; ctx.textAlign = 'center';
        ctx.fillText('No data', W / 2, H / 2 + 3);
        return { min: 0, max: 0 };
      }

      var minV = Math.min.apply(null, vals);
      var maxV = Math.max.apply(null, vals);
      var range = maxV - minV || 0.02;
      var yMin  = minV - range * 0.4;
      var yMax  = maxV + range * 0.4;
      var toY   = function(v) { return H - ((v - yMin) / (yMax - yMin)) * H; };
      var toX   = function(i) { return (i / (vals.length - 1 || 1)) * W; };

      // grid lines
      ctx.strokeStyle = 'rgba(100,116,139,0.1)'; ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(function(f) {
        ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke();
      });

      // area fill
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   color + '55');
      grad.addColorStop(0.6, color + '18');
      grad.addColorStop(1,   color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(vals[0]));
      for (var i = 1; i < vals.length; i++) ctx.lineTo(toX(i), toY(vals[i]));
      ctx.lineTo(toX(vals.length - 1), H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // line with glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 5;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(vals[0]));
      for (var j = 1; j < vals.length; j++) ctx.lineTo(toX(j), toY(vals[j]));
      ctx.stroke();
      ctx.restore();

      // end dot
      var lx = toX(vals.length - 1), ly = toY(vals[vals.length - 1]);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.stroke();

      return { min: minV, max: maxV };
    }

    keys.forEach(function(k, ki) {
      var color  = colors[ki] || '#3b82f6';
      var label  = labels[ki] || k;
      var vals   = raw.map(function(r) { return parseFloat(r[k]); }).filter(function(v) { return !isNaN(v); });

      var card = document.createElement('div');
      card.className = 'ch-card';

      var titleBar = document.createElement('div');
      titleBar.className = 'ch-card-title';
      titleBar.style.color = color;

      var titleSpan = document.createElement('span'); titleSpan.textContent = label;
      var rangeSpan = document.createElement('span'); rangeSpan.className = 'ch-card-range';

      titleBar.appendChild(titleSpan);
      titleBar.appendChild(rangeSpan);
      card.appendChild(titleBar);

      var canvas = document.createElement('canvas');
      canvas.height = 70;
      card.appendChild(canvas);
      grid.appendChild(card);

      var result = drawMiniChart(canvas, vals, color);
      if (vals.length >= 2) {
        rangeSpan.textContent = result.min.toFixed(2) + ' → ' + result.max.toFixed(2);
      }
    });
  })();
  </script>

  <h2>Combined Overview</h2>
  <div class="overview-card">
    <canvas id="overviewCanvas" height="130" style="display:block;width:100%;border-radius:4px;"></canvas>
    <div class="overview-legend" id="overviewLegend"></div>
  </div>
  <script>
  (function(){
    var raw    = ${JSON.stringify(data.map(r => { const o = {date: r.date, time: r.time}; channelKeys.forEach(k => { o[k] = r[k]; }); return o; }))};
    var keys   = ${JSON.stringify(channelKeys)};
    var labels = ${JSON.stringify(cfg.channels.map(ch => ch.label + (ch.unit ? ' (' + ch.unit + ')' : '')))};
    var colors = ${JSON.stringify(channelKeys.map(k => (cfg.chartMeta && cfg.chartMeta[k]) ? cfg.chartMeta[k].color : '#3b82f6'))};

    var canvas  = document.getElementById('overviewCanvas');
    var legend  = document.getElementById('overviewLegend');
    var W = canvas.parentElement.clientWidth - 28;
    var H = 130;
    canvas.width  = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    // 3-color background gradient matching the card
    var bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,    '#0f172a');
    bgGrad.addColorStop(0.55, '#1e3a5f');
    bgGrad.addColorStop(1,    '#0e7490');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // subtle grid lines on dark bg
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(function(f) {
      ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke();
    });

    var n = raw.length;
    if (n < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
      ctx.fillText('No data', W / 2, H / 2 + 4);
      return;
    }

    var toX = function(i) { return (i / (n - 1)) * W; };

    // collect per-channel series with per-channel normalisation (0→1) so all fit in view
    keys.forEach(function(k, ki) {
      var color = colors[ki] || '#3b82f6';
      var vals  = raw.map(function(r) { return parseFloat(r[k]); });
      var clean = vals.filter(function(v) { return !isNaN(v); });
      if (clean.length < 2) return;

      var minV = Math.min.apply(null, clean);
      var maxV = Math.max.apply(null, clean);
      var range = maxV - minV || 0.02;
      var yMin  = minV - range * 0.1;
      var yMax  = maxV + range * 0.1;
      var toY   = function(v) { return H - ((v - yMin) / (yMax - yMin)) * H; };

      // filled area — brighter fill on dark background
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   color + 'aa');
      grad.addColorStop(0.6, color + '33');
      grad.addColorStop(1,   color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      var started = false;
      var firstX = 0, firstY = H;
      for (var i = 0; i < n; i++) {
        var v = vals[i];
        if (isNaN(v)) continue;
        var x = toX(i), y = toY(v);
        if (!started) { ctx.moveTo(x, y); firstX = x; started = true; } else { ctx.lineTo(x, y); }
      }
      ctx.lineTo(toX(n - 1), H);
      ctx.lineTo(firstX, H);
      ctx.closePath();
      ctx.fill();

      // line
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 4;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.beginPath();
      started = false;
      for (var j = 0; j < n; j++) {
        var vj = vals[j];
        if (isNaN(vj)) { started = false; continue; }
        var xj = toX(j), yj = toY(vj);
        if (!started) { ctx.moveTo(xj, yj); started = true; } else { ctx.lineTo(xj, yj); }
      }
      ctx.stroke();
      ctx.restore();

      // end dot
      var lastIdx = n - 1;
      while (lastIdx > 0 && isNaN(vals[lastIdx])) lastIdx--;
      if (!isNaN(vals[lastIdx])) {
        var ex = toX(lastIdx), ey = toY(vals[lastIdx]);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.stroke();
      }

      // legend item
      var item = document.createElement('div');
      item.className = 'overview-legend-item';
      var dot = document.createElement('div');
      dot.className = 'overview-legend-dot';
      dot.style.background = color;
      dot.style.boxShadow = '0 0 5px ' + color;
      var txt = document.createElement('span');
      txt.textContent = labels[ki] || k;
      txt.style.color = 'rgba(255,255,255,0.85)';
      item.appendChild(dot); item.appendChild(txt);
      legend.appendChild(item);
    });

    // x-axis date labels (first, middle, last)
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '8px Arial';
    ctx.textAlign = 'left';
    var fmt = function(r) { return (r.date || '') + (r.time ? ' ' + r.time : ''); };
    ctx.fillText(fmt(raw[0]), 2, H - 2);
    ctx.textAlign = 'center';
    ctx.fillText(fmt(raw[Math.floor((n-1)/2)]), W/2, H - 2);
    ctx.textAlign = 'right';
    ctx.fillText(fmt(raw[n-1]), W - 2, H - 2);
  })();
  </script>

  <div class="footer">MAE DataLogger Dashboard &nbsp;·&nbsp; ${serial} &nbsp;·&nbsp; ${from} → ${to} &nbsp;·&nbsp; Generated ${now}</div>
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function downloadFile(name, type, content) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], {type})), download: name,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ═══════════════════════ THRESHOLD PANEL ═══════════════════════
function openThresholds()  { document.getElementById('thresholdPanel').classList.add('open'); }
function closeThresholds() { document.getElementById('thresholdPanel').classList.remove('open'); }

document.addEventListener('click', e => {
  const panel = document.getElementById('thresholdPanel');
  if (panel.classList.contains('open')
    && !panel.contains(e.target)
    && !e.target.closest('[onclick*="openThresholds"]')
    && !e.target.closest('[onclick*="Alerts"]')) closeThresholds();

  const modal = document.getElementById('exportModal');
  if (modal.classList.contains('open') && e.target === modal) closeExport();

  const filesModal = document.getElementById('filesModal');
  if (filesModal.classList.contains('open') && e.target === filesModal) closeFilesModal();
});

// ═══════════════════════ MAP MODAL ═══════════════════════
let mapZoom = 15;
let mapDevice = null;
let currentMapStyle = 'streets';

const MAP_TILE_STYLES = {
  streets:   'https://www.openstreetmap.org/export/embed.html?bbox={W},{S},{E},{N}&layer=mapnik&marker={LAT},{LNG}',
  satellite: 'https://www.openstreetmap.org/export/embed.html?bbox={W},{S},{E},{N}&layer=cyclemap&marker={LAT},{LNG}',
  topo:      'https://www.openstreetmap.org/export/embed.html?bbox={W},{S},{E},{N}&layer=transportmap&marker={LAT},{LNG}',
};

function buildMapUrl(lat, lng, zoom, style) {
  const delta    = 360 / Math.pow(2, zoom) * 0.5;
  const latDelta = delta * 0.5;
  const W = (lng - delta).toFixed(6), E = (lng + delta).toFixed(6);
  const S = (lat - latDelta).toFixed(6), N = (lat + latDelta).toFixed(6);
  return (MAP_TILE_STYLES[style] || MAP_TILE_STYLES.streets)
    .replace('{W}',W).replace('{E}',E).replace('{S}',S).replace('{N}',N)
    .replace('{LAT}',lat).replace('{LNG}',lng);
}

function openMapModal(deviceId) {
  mapDevice = (deviceId ? allDevices.find(d => d.id === deviceId) : null) || activeDevice;
  if (!mapDevice) return;
  document.getElementById('mapModal').classList.add('open');
  document.getElementById('mapIframe').onload = onMapLoad; // assigned in JS, never as HTML attribute
  renderMapSidebar();
  loadMapForDevice(mapDevice);
}

function closeMapModal() { document.getElementById('mapModal').classList.remove('open'); }

function loadMapForDevice(device) {
  if (!device) return;
  document.getElementById('mapLoading').classList.remove('hidden');
  document.getElementById('mapIframe').src = buildMapUrl(device.lat||0, device.lng||0, mapZoom, currentMapStyle);

  document.getElementById('mapBadgeName').textContent  = `${device.name} — ${device.city||''}`;
  document.getElementById('mapBadgeCoord').textContent = `${(device.lat||0).toFixed(4)}°N, ${(device.lng||0).toFixed(4)}°E`;
  const online   = device.status === 'online';
  const statusEl = document.getElementById('mapBadgeStatus');
  statusEl.textContent = online ? 'Online' : 'Offline';
  statusEl.style.color = online ? 'var(--green)' : 'var(--muted)';
  statusEl.previousElementSibling.style.background = online ? 'var(--green)' : 'var(--muted)';

  document.getElementById('mapModalSub').textContent  = `DEVICE: ${device.id} · ${device.city||''} · ${(device.lat||0).toFixed(4)}°, ${(device.lng||0).toFixed(4)}°`;
  document.getElementById('mapInfoId').textContent    = device.id;
  document.getElementById('mapInfoCity').textContent  = device.city    || '—';
  document.getElementById('mapInfoPos').textContent   = device.position || '—';
  document.getElementById('mapInfoLat').textContent   = (device.lat||0).toFixed(6) + '°';
  document.getElementById('mapInfoLng').textContent   = (device.lng||0).toFixed(6) + '°';
  document.getElementById('mapInfoStatus').innerHTML  = `<span style="color:${online?'var(--green)':'var(--muted)'}">${online?'● Online':'○ Offline'}</span>`;
  document.getElementById('mapInfoSignal').textContent = `${device.signal||0} / 4`;
}

function onMapLoad() { document.getElementById('mapLoading').classList.add('hidden'); }

function renderMapSidebar() {
  document.getElementById('mapDeviceList').innerHTML = allDevices.map(d => `
    <div class="map-device-card ${d.id===(mapDevice||activeDevice).id?'active':''}" onclick="switchMapDevice('${d.id}')">
      <div class="map-device-card-top">
        <div class="map-device-dot" style="background:${d.status==='online'?'var(--green)':'var(--muted)'}"></div>
        <div>
          <div class="map-device-name">${d.name}</div>
          <div class="map-device-id">${d.serial||d.id} · ${d.type}</div>
        </div>
      </div>
      <div class="map-device-coords">📍 ${d.city||'—'} — ${(d.lat||0).toFixed(3)}°, ${(d.lng||0).toFixed(3)}°</div>
    </div>
  `).join('');
}

function switchMapDevice(id) {
  const found = allDevices.find(d => d.id === id);
  if (!found) return;
  mapDevice = found; mapZoom = 15;
  renderMapSidebar(); loadMapForDevice(mapDevice);
}

function setMapStyle(style)   { currentMapStyle = style; loadMapForDevice(mapDevice || activeDevice); }
function zoomMapIn()          { mapZoom = Math.min(18, mapZoom + 1); loadMapForDevice(mapDevice || activeDevice); }
function zoomMapOut()         { mapZoom = Math.max(5,  mapZoom - 1); loadMapForDevice(mapDevice || activeDevice); }
function centerOnDevice()     { mapZoom = 15; loadMapForDevice(mapDevice || activeDevice); }

async function jumpToCity() {
  const q = document.getElementById('mapSearchInput').value.trim();
  if (!q) return;
  try {
    document.getElementById('mapLoading').classList.remove('hidden');
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
    const data = await res.json();
    if (data?.[0]) {
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      document.getElementById('mapIframe').src = buildMapUrl(lat, lng, 14, currentMapStyle);
      document.getElementById('mapBadgeName').textContent  = data[0].display_name.split(',')[0];
      document.getElementById('mapBadgeCoord').textContent = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
    } else {
      alert('Location not found.');
      document.getElementById('mapLoading').classList.add('hidden');
    }
  } catch(e) { document.getElementById('mapLoading').classList.add('hidden'); }
}

function renderMiniMapPreview() {
  const d = activeDevice;
  if (!d) return;
  const existing = document.getElementById('miniMapPreviewWrap');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'miniMapPreviewWrap';
  wrap.className = 'mini-map-preview';
  wrap.onclick = openMapModal;
  wrap.innerHTML = `
    <iframe src="${buildMapUrl(d.lat||0, d.lng||0, 13, 'streets')}" scrolling="no" style="width:100%;height:110px;border:none;display:block;pointer-events:none;"></iframe>
    <div class="mini-map-preview-overlay">
      <div class="mini-map-preview-btn">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="12" height="12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Open Full Map
      </div>
    </div>
  `;
  document.getElementById('deviceInfoList').appendChild(wrap);
}

document.addEventListener('click', e => {
  const mm = document.getElementById('mapModal');
  if (mm.classList.contains('open') && e.target === mm) closeMapModal();
});

// ═══════════════════════ POWER MODAL ═══════════════════════
const MAX_POWER_POINTS = 40;
let powerHistory = [];
let powerModalTimer = null;
let powerLineVisibility = { batt:true, usb:true, aux:true };

function buildInitialPowerHistory(device) {
  const now = Date.now();
  return Array.from({ length: MAX_POWER_POINTS }, (_, i) => {
    const t = new Date(now - (MAX_POWER_POINTS - 1 - i) * 2000);
    const jitter = (base, amp) => Math.round((base + (Math.random()-0.5)*amp)*100)/100;
    return {
      ts: t,
      label: t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      batt: jitter(device.battery||0, 0.06),
      usb:  jitter(device.usb||0,  0.04),
      aux:  jitter(device.aux||0,  0.03),
    };
  });
}

function openPowerModal() {
  const modal = document.getElementById('powerModal');
  if (modal) modal.classList.add('open');
  initInlinePowerLive();
}

function closePowerModal() {
  const modal = document.getElementById('powerModal');
  if (modal) modal.classList.remove('open');
}

function tickPowerModal() {
  const d = activeDevice;
  if (!d) return;
  const jitter = (base, amp) => Math.round((base + (Math.random()-0.5)*amp)*100)/100;
  const now = new Date();
  powerHistory.push({
    ts: now,
    label: now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    batt: jitter(d.battery||0, 0.08),
    usb:  jitter(d.usb||0,  0.05),
    aux:  jitter(d.aux||0,  0.04),
  });
  if (powerHistory.length > MAX_POWER_POINTS) powerHistory.shift();
  renderPowerModal();
}

function initInlinePowerLive() {
  const deviceIdEl = document.getElementById('pmDeviceId');
  if (!deviceIdEl || !activeDevice) return;
  deviceIdEl.textContent = activeDevice?.serial || activeDevice?.id || '—';
  // Always start inline view with all traces visible for readability.
  powerLineVisibility = { batt:true, usb:true, aux:true };
  powerHistory = buildInitialPowerHistory(activeDevice);
  renderPowerModal();
  clearInterval(powerModalTimer);
  powerModalTimer = setInterval(() => {
    const idEl = document.getElementById('pmDeviceId');
    if (idEl) idEl.textContent = activeDevice?.serial || activeDevice?.id || '—';
    tickPowerModal();
  }, 2000);
}

function renderPowerModal() {
  if (!powerHistory.length) return;
  const latest = powerHistory[powerHistory.length - 1];

  document.getElementById('pm_battVal').textContent = latest.batt.toFixed(2) + 'V';
  document.getElementById('pm_usbVal').textContent  = latest.usb.toFixed(2)  + 'V';
  document.getElementById('pm_auxVal').textContent  = latest.aux.toFixed(2)  + 'V';

  document.getElementById('pm_battBar').style.width = Math.min(100,(latest.batt/4.2)*100) + '%';
  document.getElementById('pm_usbBar').style.width  = Math.min(100,(latest.usb/5.5)*100)  + '%';
  document.getElementById('pm_auxBar').style.width  = Math.min(100,(latest.aux/2.0)*100)  + '%';

  document.getElementById('pm_battSub').textContent = (latest.batt>=3.7?'● Good':latest.batt>=3.3?'⚠ Low':'🔴 Critical') + ' · Range 0–4.2V';
  document.getElementById('pm_usbSub').textContent  = (latest.usb>=4.8?'● Stable':'⚠ Unstable') + ' · Nominal 5.0V';
  document.getElementById('pm_auxSub').textContent  = (latest.aux>0?'● Active':'○ Inactive') + ' · External';

  document.getElementById('leg_batt_cur').textContent = latest.batt.toFixed(2) + 'V';
  document.getElementById('leg_usb_cur').textContent  = latest.usb.toFixed(2)  + 'V';
  document.getElementById('leg_aux_cur').textContent  = latest.aux.toFixed(2)  + 'V';
  const lastTimeEl = document.getElementById('leg_last_time');
  if (lastTimeEl) lastTimeEl.textContent = latest.label;
  document.getElementById('pm_ch_batt').textContent   = latest.batt.toFixed(2) + 'V';
  document.getElementById('pm_ch_usb').textContent    = latest.usb.toFixed(2)  + 'V';
  document.getElementById('pm_ch_aux').textContent    = latest.aux.toFixed(2)  + 'V';

  renderPowerCombinedChart();
  renderPowerSparklines();
}

function renderPowerCombinedChart() {
  const svg = document.getElementById('powerModalSvg');
  if (!svg || !powerHistory.length) return;
  const W=720,H=260,PAD_L=48,PAD_R=12,PAD_T=14,PAD_B=34;
  const cW=W-PAD_L-PAD_R, cH=H-PAD_T-PAD_B;
  const n = powerHistory.length;
  const allVals = powerHistory.flatMap(p=>[p.batt,p.usb,p.aux]);
  const rawMin=Math.min(...allVals), rawMax=Math.max(...allVals);
  const pad=(rawMax-rawMin)*0.35||0.8;
  const yMin=Math.max(0,rawMin-pad);
  const yMax=Math.max(yMin + 3, rawMax + pad);
  const toX = i => PAD_L+(i/(n-1||1))*cW;
  const toY = v => PAD_T+cH-((v-yMin)/(yMax-yMin||1))*cH;
  const channels=[
    {key:'batt',color:'#ef4444',gradId:'pmBattGrad',visible:powerLineVisibility.batt},
    {key:'usb', color:'#3b82f6',gradId:'pmUsbGrad', visible:powerLineVisibility.usb},
    {key:'aux', color:'#10b981',gradId:'pmAuxGrad', visible:powerLineVisibility.aux},
  ];
  if (!channels.some(ch => ch.visible)) {
    powerLineVisibility = { batt:true, usb:true, aux:true };
    channels.forEach(ch => { ch.visible = true; });
  }
  let gridLines='',yLabels='';
  for(let i=0;i<=5;i++){
    const v=yMin+(yMax-yMin)*(i/5), y=toY(v);
    gridLines+=`<line x1="${PAD_L}" y1="${y}" x2="${W-PAD_R}" y2="${y}" stroke="rgba(15,30,60,0.08)" stroke-width="1"/>`;
    yLabels  +=`<text x="${PAD_L-8}" y="${y+4}" fill="#334155" font-size="11" font-family="monospace" text-anchor="end">${v.toFixed(1)}</text>`;
  }
  const xStep=Math.max(1,Math.ceil(n/6));
  let xLabels='';
  powerHistory.forEach((p,i)=>{ if(i%xStep===0) xLabels+=`<text x="${toX(i)}" y="${H-14}" fill="#334155" font-size="10" font-family="monospace" text-anchor="middle">${p.label.slice(0,5)}</text>`; });
  let defs='<defs>';
  channels.forEach(ch=>{ defs+=`<linearGradient id="${ch.gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${ch.color}" stop-opacity="0.32"/><stop offset="100%" stop-color="${ch.color}" stop-opacity="0.02"/></linearGradient>`; });
  defs+='</defs>';
  let areas='',lines='',dots='';
  channels.forEach(ch=>{
    if(!ch.visible) return;
    const pts=powerHistory.map((p,i)=>`${toX(i)},${toY(p[ch.key])}`);
    const areaD=`M${toX(0)},${toY(powerHistory[0][ch.key])} `+powerHistory.slice(1).map((p,i)=>`L${toX(i+1)},${toY(p[ch.key])}`).join(' ')+` L${toX(n-1)},${PAD_T+cH} L${PAD_L},${PAD_T+cH} Z`;
    areas+=`<path d="${areaD}" fill="url(#${ch.gradId})"/>`;
    lines+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${ch.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${ch.color}66)"/>`;
    const last=powerHistory[n-1];
    dots+=`<circle cx="${toX(n-1)}" cy="${toY(last[ch.key])}" r="4.2" fill="${ch.color}" stroke="#ffffff" stroke-width="1.2" style="filter:drop-shadow(0 0 6px ${ch.color})"/>`;
    dots+=`<circle cx="${toX(n-1)}" cy="${toY(last[ch.key])}" r="7" fill="${ch.color}" opacity="0.15"/>`;
  });
  let hoverRects='';
  powerHistory.forEach((_,i)=>{ const x=toX(i)-(cW/n/2),w=cW/n; hoverRects+=`<rect x="${x}" y="${PAD_T}" width="${w}" height="${cH}" fill="transparent" onmouseover="showPowerTooltip(event,${i})" onmouseout="hidePowerTooltip()"/>`; });
  dots+=`<line id="pmHoverLine" x1="0" y1="${PAD_T}" x2="0" y2="${PAD_T+cH}" stroke="rgba(15,30,60,0.2)" stroke-width="1" stroke-dasharray="3,3" display="none"/>`;
  svg.innerHTML = defs+gridLines+yLabels+xLabels+areas+lines+dots+hoverRects;
}

function showPowerTooltip(evt,idx) {
  const p=powerHistory[idx]; if(!p) return;
  const tt=document.getElementById('pmTooltip');
  const rect=document.getElementById('powerModalSvg').getBoundingClientRect();
  document.getElementById('pmTTTime').textContent=p.label;
  document.getElementById('pmTTBatt').textContent=p.batt.toFixed(2)+'V';
  document.getElementById('pmTTUsb').textContent =p.usb.toFixed(2)+'V';
  document.getElementById('pmTTAux').textContent =p.aux.toFixed(2)+'V';
  const x=44+(idx/(powerHistory.length-1||1))*(720-44-12);
  const hl=document.getElementById('pmHoverLine');
  if(hl){hl.setAttribute('x1',x);hl.setAttribute('x2',x);hl.setAttribute('display','inline');}
  const ttX=evt.clientX-rect.left+12, ttY=evt.clientY-rect.top-10;
  tt.style.left=(ttX>rect.width-160?ttX-150:ttX)+'px';
  tt.style.top=ttY+'px'; tt.style.display='block';
}

function hidePowerTooltip() {
  document.getElementById('pmTooltip').style.display='none';
  const hl=document.getElementById('pmHoverLine');
  if(hl) hl.setAttribute('display','none');
}

function renderPowerSparklines() {
  [{id:'pm_spark_batt',key:'batt',color:'#ef4444',gradId:'spBatt'},
   {id:'pm_spark_usb', key:'usb', color:'#3b82f6',gradId:'spUsb'},
   {id:'pm_spark_aux', key:'aux', color:'#10b981',gradId:'spAux'}].forEach(sp=>{
    const el=document.getElementById(sp.id); if(!el) return;
    const W=200,H=60;
    const vals=powerHistory.map(p=>p[sp.key]);
    const minV=Math.min(...vals),maxV=Math.max(...vals);
    const range=maxV-minV||0.1;
    const yMin=minV-range*0.3,yMax=maxV+range*0.3;
    const n=vals.length;
    const toX=i=>(i/(n-1||1))*W;
    const toY=v=>H-((v-yMin)/(yMax-yMin||1))*H;
    const pts=vals.map((v,i)=>`${toX(i)},${toY(v)}`).join(' ');
    const areaD=`M${toX(0)},${toY(vals[0])} `+vals.slice(1).map((v,i)=>`L${toX(i+1)},${toY(v)}`).join(' ')+` L${toX(n-1)},${H} L0,${H} Z`;
    el.innerHTML=`<defs><linearGradient id="${sp.gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sp.color}" stop-opacity="0.35"/><stop offset="100%" stop-color="${sp.color}" stop-opacity="0"/></linearGradient></defs><path d="${areaD}" fill="url(#${sp.gradId})"/><polyline points="${pts}" fill="none" stroke="${sp.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${sp.color}88)"/><circle cx="${toX(n-1)}" cy="${toY(vals[n-1])}" r="3" fill="${sp.color}"/>`;
  });
}

function togglePowerLine(key) {
  powerLineVisibility[key]=!powerLineVisibility[key];
  const leg=document.getElementById(`leg_${key}`);
  if(leg) leg.classList.toggle('hidden',!powerLineVisibility[key]);
  renderPowerCombinedChart();
}

document.addEventListener('click', e => {
  const pm=document.getElementById('powerModal');
  if(pm && pm.classList.contains('open') && e.target===pm) closePowerModal();
});

// ═══════════════════════ LOGIN / LOGOUT ═══════════════════════
function showLoginModal() {
  document.getElementById('loginOverlay').classList.add('open');
  document.getElementById('loginUsername').focus();
}

function hideLoginModal() {
  document.getElementById('loginOverlay').classList.remove('open');
  document.getElementById('loginError').textContent = '';
}

async function submitLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  if (!username || !password) {
    errEl.textContent = 'Please enter username and password.';
    return;
  }

  btn.textContent = 'Signing in…';
  btn.disabled    = true;
  errEl.textContent = '';

  try {
    await authLogin(username, password);
    hideLoginModal();
    const topbarUser = document.getElementById('topbarUsername');
    if (topbarUser) topbarUser.textContent = getUserName() || username;
    await initDashboard();
    initInlinePowerLive();
  } catch (err) {
    errEl.textContent = err.message || 'Login failed. Check your credentials.';
  } finally {
    btn.textContent = 'Sign In';
    btn.disabled    = false;
  }
}

function doLogout() {
  clearInterval(refreshTimer);
  clearInterval(powerModalTimer);
  authLogout();
  const topbarUser = document.getElementById('topbarUsername');
  if (topbarUser) topbarUser.textContent = '';
  allDevices        = [];
  allData           = [];
  filteredData      = [];
  activeDevice      = null;
  activeChannelHeaders = null;
  liveMode          = true;
  document.getElementById('deviceList').innerHTML  = '';
  document.getElementById('kpiGrid').innerHTML     = '';
  document.getElementById('tableBody').innerHTML   = '';
  document.getElementById('mainChartSvg').innerHTML = '';
  document.getElementById('chartStats').innerHTML = '';
  document.getElementById('channelsCharts').innerHTML  = '';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  showLoginModal();
}

// ═══════════════════════ START ═══════════════════════
init().then(() => {
  initInlinePowerLive();
});
