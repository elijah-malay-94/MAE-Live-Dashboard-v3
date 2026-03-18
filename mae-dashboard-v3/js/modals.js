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
    if (countdown <= 0) { countdown = 30; await loadData(); }
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
  document.getElementById('powerModal').classList.add('open');
  document.getElementById('pmDeviceId').textContent = activeDevice?.serial || activeDevice?.id || '—';
  powerHistory = buildInitialPowerHistory(activeDevice);
  renderPowerModal();
  powerModalTimer = setInterval(tickPowerModal, 2000);
}

function closePowerModal() {
  document.getElementById('powerModal').classList.remove('open');
  clearInterval(powerModalTimer);
  powerModalTimer = null;
}

function tickPowerModal() {
  const d = activeDevice;
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
  document.getElementById('pm_ch_batt').textContent   = latest.batt.toFixed(2) + 'V';
  document.getElementById('pm_ch_usb').textContent    = latest.usb.toFixed(2)  + 'V';
  document.getElementById('pm_ch_aux').textContent    = latest.aux.toFixed(2)  + 'V';

  renderPowerCombinedChart();
  renderPowerSparklines();
}

function renderPowerCombinedChart() {
  const svg = document.getElementById('powerModalSvg');
  const W=720,H=220,PAD_L=44,PAD_R=12,PAD_T=12,PAD_B=28;
  const cW=W-PAD_L-PAD_R, cH=H-PAD_T-PAD_B;
  const n = powerHistory.length;
  const allVals = powerHistory.flatMap(p=>[p.batt,p.usb,p.aux]);
  const rawMin=Math.min(...allVals), rawMax=Math.max(...allVals);
  const pad=(rawMax-rawMin)*0.3||0.5;
  const yMin=Math.max(0,rawMin-pad), yMax=rawMax+pad;
  const toX = i => PAD_L+(i/(n-1||1))*cW;
  const toY = v => PAD_T+cH-((v-yMin)/(yMax-yMin||1))*cH;
  const channels=[
    {key:'batt',color:'#ef4444',gradId:'pmBattGrad',visible:powerLineVisibility.batt},
    {key:'usb', color:'#3b82f6',gradId:'pmUsbGrad', visible:powerLineVisibility.usb},
    {key:'aux', color:'#10b981',gradId:'pmAuxGrad', visible:powerLineVisibility.aux},
  ];
  let gridLines='',yLabels='';
  for(let i=0;i<=5;i++){
    const v=yMin+(yMax-yMin)*(i/5), y=toY(v);
    gridLines+=`<line x1="${PAD_L}" y1="${y}" x2="${W-PAD_R}" y2="${y}" stroke="rgba(15,30,60,0.05)" stroke-width="1"/>`;
    yLabels  +=`<text x="${PAD_L-6}" y="${y+4}" fill="#64748b" font-size="9" font-family="monospace" text-anchor="end">${v.toFixed(1)}</text>`;
  }
  const xStep=Math.max(1,Math.ceil(n/8));
  let xLabels='';
  powerHistory.forEach((p,i)=>{ if(i%xStep===0) xLabels+=`<text x="${toX(i)}" y="${H-4}" fill="#64748b" font-size="8" font-family="monospace" text-anchor="middle">${p.label.slice(0,5)}</text>`; });
  let defs='<defs>';
  channels.forEach(ch=>{ defs+=`<linearGradient id="${ch.gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${ch.color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${ch.color}" stop-opacity="0"/></linearGradient>`; });
  defs+='</defs>';
  let areas='',lines='',dots='';
  channels.forEach(ch=>{
    if(!ch.visible) return;
    const pts=powerHistory.map((p,i)=>`${toX(i)},${toY(p[ch.key])}`);
    const areaD=`M${toX(0)},${toY(powerHistory[0][ch.key])} `+powerHistory.slice(1).map((p,i)=>`L${toX(i+1)},${toY(p[ch.key])}`).join(' ')+` L${toX(n-1)},${PAD_T+cH} L${PAD_L},${PAD_T+cH} Z`;
    areas+=`<path d="${areaD}" fill="url(#${ch.gradId})"/>`;
    lines+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${ch.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px ${ch.color}88)"/>`;
    const last=powerHistory[n-1];
    dots+=`<circle cx="${toX(n-1)}" cy="${toY(last[ch.key])}" r="4" fill="${ch.color}" style="filter:drop-shadow(0 0 6px ${ch.color})"/>`;
    dots+=`<circle cx="${toX(n-1)}" cy="${toY(last[ch.key])}" r="7" fill="${ch.color}" opacity="0.15"/>`;
  });
  let hoverRects='';
  powerHistory.forEach((p,i)=>{ const x=toX(i)-(cW/n/2),w=cW/n; hoverRects+=`<rect x="${x}" y="${PAD_T}" width="${w}" height="${cH}" fill="transparent" onmouseover="showPowerTooltip(event,${i})" onmouseout="hidePowerTooltip()"/>`; });
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
  if(pm.classList.contains('open') && e.target===pm) closePowerModal();
});

// ═══════════════════════ START ═══════════════════════
init();
