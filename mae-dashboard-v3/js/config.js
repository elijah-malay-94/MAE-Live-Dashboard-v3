// ╔══════════════════════════════════════════════════════════════╗
// ║  config.js — Device Type Configuration                      ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • DEVICE_TYPE_CONFIG  static config for DL / VMR / SISMALOG ║
// ║  • CHANNEL_COLORS      colour palette for dynamic channels   ║
// ║  • buildConfigFromHeaders()  builds runtime config from API  ║
// ║  • getDeviceConfig()   returns active config (live or static) ║
// ║  • getTypeKey()        maps tipologia string → config key    ║
// ║                                                              ║
// ║  Dependencies: state.js (reads activeDevice,                 ║
// ║                activeChannelHeaders)                         ║
// ║  Load order:   1st                                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ═══════════════════════ DEVICE TYPE CONFIG ═══════════════════════
// One entry per device family. Add new types here — everything else adapts automatically.
const DEVICE_TYPE_CONFIG = {
  DL: {
    channels: [
      { key:'pt50',  label:'PT-50 fs1', unit:'mm', color:'var(--accent)',  sub:'Channel 1 · Displacement' },
      { key:'isbcX', label:'ISBC-10 X', unit:'?',  color:'var(--accent2)', sub:'Channel 2 · Tilt X'       },
      { key:'isbcY', label:'ISBC-10 Y', unit:'gr', color:'var(--accent3)', sub:'Channel 3 · Tilt Y'       },
    ],
    chartMeta: {
      pt50:  { label:'PT-50 fs1 — Time Series', badge:'Ch1 · mm', key:'pt50',  color:'#3b82f6', unit:'mm' },
      isbcX: { label:'ISBC-10 X — Time Series', badge:'Ch2 · ?',  key:'isbcX', color:'#06b6d4', unit:'?'  },
      isbcY: { label:'ISBC-10 Y — Time Series', badge:'Ch3 · gr', key:'isbcY', color:'#f59e0b', unit:'gr' },
    },
    miniCharts: [
      { key:'isbcX', label:'ISBC-10 X (?)',  color:'#06b6d4', gradId:'cyanG'  },
      { key:'isbcY', label:'ISBC-10 Y (gr)', color:'#f59e0b', gradId:'amberG' },
    ],
    tableHeaders: ['Date','Time','PT-50 mm','ISBC X','ISBC Y','Status'],
    tableColumns: '100px 90px 1fr 90px 90px 90px',
    tableRow: (r, states) => [
      `<span class="td" style="font-size:10px;color:var(--muted)">${r.date}</span>`,
      `<span class="td" style="color:var(--text)">${r.time}</span>`,
      `<span class="td ${states[0]==='alert'?'alert-val':states[0]==='warn'?'warn-val':'hi'}">${(r.pt50??0).toFixed(2)}</span>`,
      `<span class="td ${states[1]==='alert'?'alert-val':states[1]==='warn'?'warn-val':''}">${(r.isbcX??0).toFixed(2)}</span>`,
      `<span class="td ${states[2]==='alert'?'alert-val':states[2]==='warn'?'warn-val':''}">${(r.isbcY??0).toFixed(2)}</span>`,
    ],
    alertChecks: (row, th) => [
      { val: row.pt50,  label:'PT-50 fs1', unit:'mm', th: th.pt50 },
      { val: row.isbcX, label:'ISBC-10 X', unit:'?',  th: th.x    },
      { val: row.isbcY, label:'ISBC-10 Y', unit:'gr', th: th.y    },
    ],
    mapRow: (item) => ({
      date:  formatApiDate(item.date),
      time:  item.time || '',
      pt50:  parseFloat(item.pt50  ?? item['pt-50']  ?? item.pt_50  ?? 0),
      isbcX: parseFloat(item.isbcX ?? item['isbc-x'] ?? item.isbc_x ?? 0),
      isbcY: parseFloat(item.isbcY ?? item['isbc-y'] ?? item.isbc_y ?? 0),
    }),
  },

  VMR: {
    channels: [
      { key:'displacement', label:'Displacement', unit:'mm', color:'var(--accent)',  sub:'Channel 1 · Vibration'   },
      { key:'frequency',    label:'Frequency',    unit:'Hz', color:'var(--accent2)', sub:'Channel 2 · Frequency'   },
      { key:'temperature',  label:'Temperature',  unit:'°C', color:'var(--orange)',  sub:'Channel 3 · Temperature' },
      { key:'voltage',      label:'Voltage',      unit:'V',  color:'var(--green)',   sub:'Channel 4 · Voltage'     },
    ],
    chartMeta: {
      displacement: { label:'Displacement — Time Series', badge:'Ch1 · mm', key:'displacement', color:'#3b82f6', unit:'mm' },
      frequency:    { label:'Frequency — Time Series',    badge:'Ch2 · Hz', key:'frequency',    color:'#06b6d4', unit:'Hz' },
      temperature:  { label:'Temperature — Time Series',  badge:'Ch3 · °C', key:'temperature',  color:'#f59e0b', unit:'°C' },
      voltage:      { label:'Voltage — Time Series',      badge:'Ch4 · V',  key:'voltage',      color:'#10b981', unit:'V'  },
    },
    miniCharts: [
      { key:'frequency',   label:'Frequency (Hz)',  color:'#06b6d4', gradId:'freqG' },
      { key:'temperature', label:'Temperature (°C)', color:'#f59e0b', gradId:'tempG' },
      { key:'voltage',     label:'Voltage (V)',      color:'#10b981', gradId:'voltG' },
    ],
    tableHeaders: ['Date','Time','Displ. mm','Freq. Hz','Temp. °C','Volt. V','Status'],
    tableColumns: '100px 80px 1fr 80px 80px 80px 80px',
    tableRow: (r, states) => [
      `<span class="td" style="font-size:10px;color:var(--muted)">${r.date}</span>`,
      `<span class="td" style="color:var(--text)">${r.time}</span>`,
      `<span class="td hi">${(r.displacement??0).toFixed(2)}</span>`,
      `<span class="td">${(r.frequency??0).toFixed(2)}</span>`,
      `<span class="td">${(r.temperature??0).toFixed(1)}</span>`,
      `<span class="td">${(r.voltage??0).toFixed(1)}</span>`,
    ],
    alertChecks: (row, th) => [
      { val: row.displacement, label:'Displacement', unit:'mm', th: th.pt50 },
      { val: row.frequency,    label:'Frequency',    unit:'Hz', th: th.x    },
      { val: row.temperature,  label:'Temperature',  unit:'°C', th: th.y    },
    ],
    mapRow: (item) => ({
      date:         formatApiDate(item.date),
      time:         item.time || '',
      displacement: parseFloat(item.displacement ?? item.displ ?? 0),
      frequency:    parseFloat(item.frequency    ?? item.freq  ?? 0),
      temperature:  parseFloat(item.temperature  ?? item.temp  ?? 0),
      voltage:      parseFloat(item.voltage      ?? item.volt  ?? 0),
    }),
  },

  SISMALOG: {
    channels: [
      { key:'ch1', label:'CH1', unit:'', color:'var(--accent)',  sub:'Channel 1' },
      { key:'ch2', label:'CH2', unit:'', color:'var(--accent2)', sub:'Channel 2' },
      { key:'ch3', label:'CH3', unit:'', color:'var(--accent3)', sub:'Channel 3' },
    ],
    chartMeta: {
      ch1: { label:'CH1 — Time Series', badge:'Ch1', key:'ch1', color:'#3b82f6', unit:'' },
      ch2: { label:'CH2 — Time Series', badge:'Ch2', key:'ch2', color:'#06b6d4', unit:'' },
      ch3: { label:'CH3 — Time Series', badge:'Ch3', key:'ch3', color:'#f59e0b', unit:'' },
    },
    miniCharts: [
      { key:'ch2', label:'CH2', color:'#06b6d4', gradId:'sCyanG'  },
      { key:'ch3', label:'CH3', color:'#f59e0b', gradId:'sAmberG' },
    ],
    tableHeaders: ['Date','Time','CH1','CH2','CH3','Status'],
    tableColumns: '100px 90px 1fr 90px 90px 90px',
    tableRow: (r, states) => [
      `<span class="td" style="font-size:10px;color:var(--muted)">${r.date}</span>`,
      `<span class="td" style="color:var(--text)">${r.time}</span>`,
      `<span class="td hi">${(r.ch1??0).toFixed(2)}</span>`,
      `<span class="td">${(r.ch2??0).toFixed(2)}</span>`,
      `<span class="td">${(r.ch3??0).toFixed(2)}</span>`,
    ],
    alertChecks: (row, th) => [
      { val: row.ch1, label:'CH1', unit:'', th: th.pt50 },
      { val: row.ch2, label:'CH2', unit:'', th: th.x    },
      { val: row.ch3, label:'CH3', unit:'', th: th.y    },
    ],
    // ⚠️  Update field names here once Claudio confirms the Sismalog API response shape
    mapRow: (item) => ({
      date: formatApiDate(item.date),
      time: item.time || '',
      ch1:  parseFloat(item.ch1 ?? item.pt50  ?? item['pt-50']  ?? 0),
      ch2:  parseFloat(item.ch2 ?? item.isbcX ?? item['isbc-x'] ?? 0),
      ch3:  parseFloat(item.ch3 ?? item.isbcY ?? item['isbc-y'] ?? 0),
    }),
  },
};

// Maps API tipologia string → config key
function getTypeKey(tipologia) {
  if (!tipologia) return 'DL';
  const t = tipologia.toLowerCase();
  if (t.includes('vmr'))      return 'VMR';
  if (t.includes('sismalog')) return 'SISMALOG';
  return 'DL'; // DL8, DL6, anything else
}

// ─── Palette used when building a dynamic config from API headers ───
const CHANNEL_COLORS = [
  { line:'var(--accent)',  chart:'#3b82f6', grad:'dynGrad0' },
  { line:'var(--accent2)', chart:'#06b6d4', grad:'dynGrad1' },
  { line:'var(--accent3)', chart:'#f59e0b', grad:'dynGrad2' },
  { line:'var(--orange)',  chart:'#f97316', grad:'dynGrad3' },
  { line:'var(--green)',   chart:'#10b981', grad:'dynGrad4' },
];

// Tries to build a runtime config from the header object returned by the API.
// Expected shape:  { ch1:{ name:"PT-50 fs1", unit:"mm" }, ch2:{...}, ... }
// Also handles flat arrays: [ { key:"ch1", name:"...", unit:"..." }, ... ]
function buildConfigFromHeaders(header) {
  // Normalise to array of { key, name, unit }
  let entries = [];
  if (Array.isArray(header)) {
    entries = header.map((h, i) => ({
      key:  h.key  || h.id    || `ch${i + 1}`,
      name: h.name || h.label || h.key || `CH${i + 1}`,
      unit: h.unit || '',
    }));
  } else if (header && typeof header === 'object') {
    entries = Object.entries(header).map(([k, v]) => ({
      key:  k,
      name: (typeof v === 'object' ? (v.name || v.label || k) : String(v)),
      unit: (typeof v === 'object' ? (v.unit || '')           : ''),
    }));
  }

  if (entries.length === 0) return null; // nothing useful — fall back to static

  const palette = (i) => CHANNEL_COLORS[i % CHANNEL_COLORS.length];

  const channels = entries.map((e, i) => ({
    key:   e.key,
    label: e.name,
    unit:  e.unit,
    color: palette(i).line,
    sub:   `Channel ${i + 1} · ${e.name}`,
  }));

  const chartMeta = {};
  entries.forEach((e, i) => {
    chartMeta[e.key] = {
      label:  `${e.name} — Time Series`,
      badge:  `Ch${i + 1}${e.unit ? ' · ' + e.unit : ''}`,
      key:    e.key,
      color:  palette(i).chart,
      unit:   e.unit,
    };
  });

  // Mini charts = every channel except the first (mirrors the static DL pattern)
  const miniCharts = entries.slice(1).map((e, i) => ({
    key:    e.key,
    label:  `${e.name}${e.unit ? ' (' + e.unit + ')' : ''}`,
    color:  palette(i + 1).chart,
    gradId: palette(i + 1).grad,
  }));

  // Table: Date + Time + one column per channel + Status
  const tableHeaders  = ['Date', 'Time', ...entries.map(e => `${e.name}${e.unit ? ' ' + e.unit : ''}`), 'Status'];
  const colCount      = entries.length;
  // Use fixed-width channel cells so the table remains readable with many channels (e.g. 8),
  // and the UI can scroll horizontally when it exceeds the available width.
  const channelColW   = 90;
  const tableColumns  = `100px 90px ${Array(colCount).fill(`${channelColW}px`).join(' ')} 90px`;

  const tableRow = (r, states) => [
    `<span class="td" style="font-size:10px;color:var(--muted)">${r.date}</span>`,
    `<span class="td" style="color:var(--text)">${r.time}</span>`,
    ...entries.map((e, i) => {
      const val = r[e.key] ?? 0;
      const cls = states[i] === 'alert' ? 'alert-val' : states[i] === 'warn' ? 'warn-val' : (i === 0 ? 'hi' : '');
      return `<span class="td ${cls}">${val.toFixed(2)}</span>`;
    }),
  ];

  const alertChecks = (row, th) => {
    const thKeys = ['pt50', 'x', 'y']; // reuse the existing threshold inputs
    return entries.map((e, i) => ({
      val:   row[e.key],
      label: e.name,
      unit:  e.unit,
      th:    th[thKeys[i]] || th.pt50,
    }));
  };

  const mapRow = (item) => {
    const out = { date: formatApiDate(item.date), time: item.time || '' };
    entries.forEach(e => { out[e.key] = parseFloat(item[e.key] ?? 0); });
    return out;
  };

  return { channels, chartMeta, miniCharts, tableHeaders, tableColumns, tableRow, alertChecks, mapRow };
}

// Returns the active device config.
// Priority: 1) dynamic config built from last API header  2) static DEVICE_TYPE_CONFIG fallback
function getDeviceConfig() {
  if (activeChannelHeaders) {
    const dynamic = buildConfigFromHeaders(activeChannelHeaders);
    if (dynamic) return dynamic;
  }
  return DEVICE_TYPE_CONFIG[getTypeKey(activeDevice?.type)] || DEVICE_TYPE_CONFIG.DL;
}

