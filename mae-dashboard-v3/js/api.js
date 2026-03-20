// ╔══════════════════════════════════════════════════════════════╗
// ║  api.js — API Layer, Helpers & Mock Data                     ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • formatApiDate()       date string normaliser              ║
// ║  • apiUrl() / apiFetch() / apiFetchWithHeaders()             ║
// ║  • MOCK_DATA + getMockFallback()                             ║
// ║  • showLoadingState() / showErrorMessage() / showSuccess()   ║
// ║  • fetchDevicesData()    GET /api/v1/customers/:id/devices   ║
// ║  • fetchDevicesInfo()    GET /api/v1/devices/:id/info        ║
// ║  • fetchData()           GET /api/v1/devices/:id/data        ║
// ║  • fetchDeviceFiles()    GET /api/v1/devices/:id/files/...   ║
// ║  • fetchDeviceFile()     GET /api/v1/devices/:id/file/:name  ║
// ║  • fetchEventDetails()   GET /api/v1/devices/:id/event/:id   ║
// ║                                                              ║
// ║  Dependencies: config.js, state.js                          ║
// ║  Load order:   2nd                                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ═══════════════════════ HELPERS ═══════════════════════
function formatApiDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('en-GB');
  return dateStr.replace(/-/g, '/');
}

// Builds the correct URL — direct call in production, CORS proxy on localhost
const API_BASE = 'https://www.maeservice.it';
//const USE_CORS_PROXY = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const USE_CORS_PROXY = false; // Calling API directly — ask Claudio to enable CORS on the server
const CORS_PROXY = 'https://corsproxy.io/?url=';

function apiUrl(path) {
  const full = `${API_BASE}${path}`;
  // corsproxy.io expects the URL NOT encoded — it handles encoding internally
  return USE_CORS_PROXY ? `${CORS_PROXY}${full}` : full;
}

// ─── FIX 1: timeout increased to 30s ───────────────────────────
async function apiFetch(path, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(path), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

// ─── FIX 1: timeout increased to 30s ───────────────────────────
async function apiFetchWithHeaders(path, options = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const defaultHeaders = { 'Accept': 'application/json' };
    if (options.body && typeof options.body === 'object') {
      defaultHeaders['Content-Type'] = 'application/json';
    }
    const res = await fetch(apiUrl(path), {
      method:  options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      body:    options.body
        ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
        : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    return { data, headers: res.headers };
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

// ═══════════════════════ MOCK FALLBACK DATA ═══════════════════════
// Used whenever the API is unreachable. Remove or empty these once the backend is stable.
const MOCK_DATA = {
  DL: [
    { "timestamp": "2026-02-12 17:02:06", "data": [ 36.14, -0.60, -1.60 ] },
    { "timestamp": "2026-02-12 16:59:36", "data": [ 36.13, -0.61, -1.61 ] },
    { "timestamp": "2026-02-12 16:57:06", "data": [ 36.14, -0.60, -1.60 ] },
    { "timestamp": "2026-02-12 16:54:36", "data": [ 36.14, -0.60, -1.61 ] },
    { "timestamp": "2026-02-12 16:52:06", "data": [ 36.14, -0.60, -1.60 ] },
    { "timestamp": "2026-02-12 16:49:36", "data": [ 36.14, -0.60, -1.60 ] },
    { "timestamp": "2026-02-12 16:47:06", "data": [ 36.13, -0.60, -1.61 ] },
    { "timestamp": "2026-02-12 16:44:36", "data": [ 36.14, -0.60, -1.60 ] },
    { "timestamp": "2026-02-12 16:24:36", "data": [ 36.14, -0.60, -1.61 ] },
    { "timestamp": "2026-02-12 16:22:06", "data": [ 36.14, -0.60, -1.61 ] },
    { "timestamp": "2026-02-12 16:19:36", "data": [ 36.14, -0.60, -1.60 ] },
    { "timestamp": "2026-02-12 16:17:06", "data": [ 36.14, -0.60, -1.61 ] },
    { "timestamp": "2026-02-12 16:14:36", "data": [ 36.14, -0.60, -1.60 ] },
    { "timestamp": "2026-02-12 16:12:06", "data": [ 36.13, -0.60, -1.61 ] },
    { "timestamp": "2026-02-12 16:09:36", "data": [ 36.13, -0.60, -1.61 ] },
  ],
  VMR: [
    { "timestamp": "2026-02-12 17:02:06", "data": [ 1.24, 49.98, 22.4, 230.1 ] },
    { "timestamp": "2026-02-12 16:59:36", "data": [ 1.25, 49.97, 22.5, 229.8 ] },
    { "timestamp": "2026-02-12 16:57:06", "data": [ 1.23, 50.01, 22.4, 230.3 ] },
    { "timestamp": "2026-02-12 16:54:36", "data": [ 1.26, 49.99, 22.6, 230.0 ] },
    { "timestamp": "2026-02-12 16:52:06", "data": [ 1.24, 50.00, 22.5, 229.9 ] },
    { "timestamp": "2026-02-12 16:49:36", "data": [ 1.22, 50.02, 22.3, 230.2 ] },
    { "timestamp": "2026-02-12 16:47:06", "data": [ 1.25, 49.98, 22.5, 230.1 ] },
    { "timestamp": "2026-02-12 16:44:36", "data": [ 1.23, 49.97, 22.4, 229.7 ] },
    { "timestamp": "2026-02-12 16:24:36", "data": [ 1.27, 50.01, 22.6, 230.4 ] },
    { "timestamp": "2026-02-12 16:22:06", "data": [ 1.24, 50.00, 22.5, 230.0 ] },
    { "timestamp": "2026-02-12 16:19:36", "data": [ 1.23, 49.99, 22.4, 229.9 ] },
    { "timestamp": "2026-02-12 16:17:06", "data": [ 1.25, 50.02, 22.5, 230.2 ] },
    { "timestamp": "2026-02-12 16:14:36", "data": [ 1.22, 49.98, 22.3, 229.8 ] },
    { "timestamp": "2026-02-12 16:12:06", "data": [ 1.26, 50.00, 22.6, 230.1 ] },
    { "timestamp": "2026-02-12 16:09:36", "data": [ 1.24, 49.97, 22.4, 229.6 ] },
  ],
};
MOCK_DATA.SISMALOG = MOCK_DATA.DL.map(r => ({...r}));

function getMockFallback() {
  const key  = getTypeKey(activeDevice?.type);
  const raw  = MOCK_DATA[key] || MOCK_DATA.DL;
  const rows = raw.map(record => {
    const ts   = record.timestamp || '';
    const dt   = ts ? new Date(ts) : null;
    const date = dt ? dt.toLocaleDateString('en-GB').replace(/\//g, '/') : '';
    const time = dt ? dt.toTimeString().slice(0, 8) : '';
    const obj  = { date, time };
    if (Array.isArray(record.data)) {
      record.data.forEach((val, i) => { obj[`ch${i + 1}`] = parseFloat(val) || 0; });
    }
    return obj;
  });
  const cfg = getDeviceConfig();
  return rows.map(item => cfg.mapRow(item));
}

// ═══════════════════════ STATUS BAR HELPERS ═══════════════════════
function showLoadingState(show) {
  const hint = document.getElementById('apiHint');
  if (!hint) return;
  hint.style.display     = 'block';
  hint.style.background  = '';
  hint.style.borderColor = '';
  hint.innerHTML = show
    ? '<strong>⏳ Loading data from API…</strong>'
    : `<strong>✅ API Connected</strong> — data from <code>${API_BASE}</code>`;
}

function showErrorMessage(msg) {
  const hint = document.getElementById('apiHint');
  if (!hint) return;
  hint.style.display     = 'block';
  hint.style.background  = 'rgba(239,68,68,0.08)';
  hint.style.borderColor = 'rgba(239,68,68,0.25)';
  hint.innerHTML = `<strong>⚠️ ${msg}</strong>`;
}

function showSuccessMessage(msg) {
  const hint = document.getElementById('apiHint');
  if (!hint) return;
  hint.style.display     = 'block';
  hint.style.background  = 'rgba(16,185,129,0.08)';
  hint.style.borderColor = 'rgba(16,185,129,0.25)';
  hint.innerHTML = `<strong>${msg}</strong>`;
}

// ═══════════════════════ API: DEVICE LIST ═══════════════════════
// GET /api/v1/customers/:id/devices
async function fetchDevicesData(customerId) {
  showLoadingState(true);
  try {
    const data = await apiFetch(`/api/v1/customers/${customerId}/devices`);
    showLoadingState(false);

    if (!Array.isArray(data) || data.length === 0) {
      showErrorMessage('No devices returned by API.');
      return [];
    }

    return data.map(item => {
      const coords = (item.posizione || '0;0').split(';');
      return {
        id:       String(item.id),
        serial:   item.matricola   || '',
        name:     item.descrizione || item.matricola || `Device ${item.id}`,
        type:     item.tipologia   || 'DL8',
        status:   item.enabled === '1' ? 'online' : 'offline',
        signal:   0,
        memory:   '',
        battery:  0,
        usb:      0,
        aux:      0,
        city:     '',
        position: '',
        lat:      parseFloat(coords[0]) || 0,
        lng:      parseFloat(coords[1]) || 0,
        // Network info (if provided by /devices endpoint)
        ip:        item.ip ?? item.ipPublic ?? item['ip_public'] ?? '',
        port:      item.port ?? item.portPublic ?? item['port_public'] ?? '',
        ip_public: item.ip_public ?? item.ipPublic ?? item['ip_public'] ?? '',
        port_public: item.port_public ?? item.portPublic ?? item['port_public'] ?? '',
      };
    });
  } catch (err) {
    showLoadingState(false);
    const label = err.name === 'AbortError' ? 'Request timed out.' : err.message;
    showErrorMessage(`Could not load device list: ${label}`);
    return [];
  }
}

// ═══════════════════════ API: DEVICE INFO ═══════════════════════
// GET /api/v1/devices/:id/info
async function fetchDevicesInfo(deviceId) {
  try {
    const data = await apiFetch(`/api/v1/devices/${deviceId}/info`);
    if (!data || typeof data !== 'object') return null;

    const batt   = parseFloat(data['battery-voltage'] ?? data.batteryVoltage ?? 0);
    const usb    = parseFloat(data['usb-voltage']     ?? data.usbVoltage     ?? 0);
    const aux    = parseFloat(data['aux-voltage']     ?? data.auxVoltage     ?? 0);
    const sdFree = parseFloat(data['sd-free']         ?? data.sdFree         ?? 0);
    const sdSize = parseFloat(data['sd-size']         ?? data.sdSize         ?? 0);
    const gps    = data['gps-position'] ?? data.gpsPosition ?? '';

    if (batt  > 0) activeDevice.battery = batt;
    if (usb   > 0) activeDevice.usb     = usb;
    if (aux   > 0) activeDevice.aux     = aux;
    if (sdFree > 0) activeDevice.memory = `${(sdFree / 1024).toFixed(1)} Gb`;

    if (gps && gps !== '-;-') {
      const [lat, lng] = gps.split(';').map(Number);
      if (!isNaN(lat) && lat !== 0) activeDevice.lat = lat;
      if (!isNaN(lng) && lng !== 0) activeDevice.lng = lng;
    }

    // Network info (if provided by /info endpoint)
    if (data.ip !== undefined || data.port !== undefined) {
      activeDevice.ip = data.ip ?? activeDevice.ip ?? '';
      activeDevice.port = data.port ?? activeDevice.port ?? '';
    }
    if (data.ip_public !== undefined || data.port_public !== undefined) {
      activeDevice.ip_public = data.ip_public ?? activeDevice.ip_public ?? '';
      activeDevice.port_public = data.port_public ?? activeDevice.port_public ?? '';
    }
    if (data.ipPublic !== undefined || data.portPublic !== undefined) {
      activeDevice.ip_public = data.ipPublic ?? activeDevice.ip_public ?? '';
      activeDevice.port_public = data.portPublic ?? activeDevice.port_public ?? '';
    }

    return data;
  } catch (err) {
    console.warn('[fetchDevicesInfo]', err.message);
    return null;
  }
}

// ═══════════════════════ API: MEASUREMENT DATA ═══════════════════════
// GET /api/v1/devices/:id/data/from/:start/to/:end/limit/50/offset/0
//
// Expected response shape:
//   {
//     "header":  ["date","time","PT-50 fs1(mm)","ISBC-10 X(?)","ISBC-10 Y(gr)"],
//     "records": [
//       { "timestamp": "2026-02-12T17:02:06", "data": [36.14, -0.60, -1.60] },
//       ...
//     ]
//   }
//
// Only the first 100 records are processed (data.records.slice(0, 100)).
// Falls back to mock data if unreachable.
async function fetchData(deviceId, dateFrom, dateTo) {
  showLoadingState(true);

  try {
    // ── Build date range ──────────────────────────────────────────────
    // Use short YYYY-MM-DD format to keep URL short (avoids 413 Too Large)
    const today = new Date().toISOString().slice(0, 10);
    const startDate = dateFrom || today;
    const endDate   = dateTo   || today;

    // ── Call API ──────────────────────────────────────────────────────
    const dataPath = `/api/v1/devices/${deviceId}/data/from/${startDate}/to/${endDate}/limit/50/offset/0`;
    const fullUrl  = `${API_BASE}${dataPath}`;
    console.log('%c[fetchData] Calling API', 'color:blue;font-weight:bold');
    console.log('  URL:', fullUrl);
    console.log('  Via proxy:', USE_CORS_PROXY);
    console.log('  Range:', startDate, '→', endDate);

    // ── FIX 4: auto-retry with 30 min window on 408 / timeout ─────────
    let data, headers;
    try {
      ({ data, headers } = await apiFetchWithHeaders(
        dataPath,
        { method: 'GET' },
        30000   // FIX 1: 30s timeout
      ));
      console.log('%c[fetchData] API call succeeded', 'color:green;font-weight:bold');
      console.log('  Raw response:', data);
      console.log('  Has records?', Array.isArray(data?.records), '— count:', data?.records?.length ?? 'n/a');
      console.log('  Has header?', !!data?.header);
    } catch (firstErr) {
      console.error('%c[fetchData] API call failed', 'color:red;font-weight:bold', firstErr.message);
      if (firstErr.message.includes('408') || firstErr.message.includes('413') || firstErr.name === 'AbortError') {
        console.warn('[fetchData] Retrying with just today…');
        showLoadingState(true);
        const retryPath = `/api/v1/devices/${deviceId}/data/from/${today}/to/${today}/limit/50/offset/0`;
        try {
          ({ data, headers } = await apiFetchWithHeaders(
            retryPath,
            { method: 'GET' },
            30000
          ));
          console.log('%c[fetchData] Retry succeeded', 'color:green;font-weight:bold');
          console.log('  Raw response:', data);
        } catch (retryErr) {
          console.error('[fetchData] Retry also failed:', retryErr.message);
          throw retryErr;
        }
      } else {
        throw firstErr;
      }
    }

    // ── Extract channel header ────────────────────────────────────────
    let parsedHeaders = null;
    const httpChannelHeader = headers.get('X-Channel-Info') || headers.get('Channel-Info');
    if (httpChannelHeader) {
      try { parsedHeaders = JSON.parse(httpChannelHeader); } catch(e) { /* ignore */ }
    }

    let headerArray = null;
    if (!parsedHeaders && data && Array.isArray(data.header)) {
      headerArray = data.header;
      parsedHeaders = [];
      for (let i = 0; i < headerArray.length; i++) {
        const str   = String(headerArray[i]);
        const match = str.match(/^(.+?)(?:\(([^)]*)\))?$/);
        const name  = match ? match[1].trim() : str;
        const unit  = match && match[2] ? match[2].trim() : '';
        parsedHeaders.push({ key: `ch${i + 1}`, name, unit });
      }
      console.log('[fetchData] parsed header:', parsedHeaders);
    }

    if (!parsedHeaders && data?.header && typeof data.header === 'object' && !Array.isArray(data.header)) {
      parsedHeaders = Object.entries(data.header).map(([k, v]) => ({
        key:  k,
        name: typeof v === 'object' ? (v.name || v.label || k) : String(v),
        unit: typeof v === 'object' ? (v.unit || '') : '',
      }));
    }

    if (parsedHeaders && parsedHeaders.length > 0) {
      activeChannelHeaders = {};
      parsedHeaders.forEach(ch => {
        activeChannelHeaders[ch.key] = { name: ch.name, unit: ch.unit };
      });
    }

    // ── Extract and map records ───────────────────────────────────────
    let rows = [];

    const rawRecords = Array.isArray(data?.records)
      ? data.records
      : null;

    if (rawRecords) {
      rows = rawRecords.map(record => {
        const ts   = record.timestamp || '';
        const dt   = ts ? new Date(ts) : null;
        const date = dt ? dt.toLocaleDateString('en-GB').replace(/\//g, '/') : '';
        const time = dt ? dt.toTimeString().slice(0, 8) : '';
        const obj  = { date, time };
        if (Array.isArray(record.data)) {
          record.data.forEach((val, i) => {
            obj[`ch${i + 1}`] = parseFloat(val) || 0;
          });
        }
        return obj;
      });

    } else if (Array.isArray(data)) {
      rows = data;

    } else if (Array.isArray(data?.data) || Array.isArray(data?.rows)) {
      const legacy = data.data || data.rows;
      if (legacy.length > 0 && Array.isArray(legacy[0])) {
        rows = legacy.map(rowArr => {
          const obj = { date: rowArr[0] || '', time: rowArr[1] || '' };
          for (let i = 2; i < rowArr.length; i++) {
            obj[`ch${i - 1}`] = parseFloat(rowArr[i]) || 0;
          }
          return obj;
        });
      } else {
        rows = legacy;
      }
    }

    showLoadingState(false);

    if (rows.length === 0) {
      showErrorMessage('No measurement data from API — showing mock data.');
      return getMockFallback();
    }

    const cfg    = getDeviceConfig();
    const mapped = rows.map(item => cfg.mapRow(item));
    console.log('[fetchData]', mapped.length, 'records | channels:', cfg.channels.map(c => c.label));
    showSuccessMessage(`✅ ${mapped.length} records loaded${activeChannelHeaders ? ' (live channels)' : ''}`);
    return mapped;

  } catch (err) {
    showLoadingState(false);
    const label = err.name === 'AbortError' ? 'Request timed out' : err.message;
    showErrorMessage(`API error: ${label} — showing mock data.`);
    console.error('[fetchData] fatal error:', err);
    return getMockFallback();
  }
}

// ═══════════════════════ API: DEVICE FILE LIST ═══════════════════════
// GET /api/v1/devices/:id/files/from/:start/to/:end/type/:type/limit/:limit/offset/:offset
//
// Response example:
// {
//   "header": [],
//   "total": 65,
//   "offset": 0,
//   "limit": 50,
//   "count": 50,
//   "has_more": true,
//   "records": [{ "timestamp":"...", "name":"...", "type":"evt|cir|day" }]
// }
function normalizeDeviceFilesResponse(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const records = Array.isArray(data.records) ? data.records : [];
  return {
    header: Array.isArray(data.header) ? data.header : [],
    total: Number.isFinite(Number(data.total)) ? Number(data.total) : records.length,
    offset: Number.isFinite(Number(data.offset)) ? Number(data.offset) : 0,
    limit: Number.isFinite(Number(data.limit)) ? Number(data.limit) : records.length,
    count: Number.isFinite(Number(data.count)) ? Number(data.count) : records.length,
    has_more: Boolean(data.has_more),
    records: records.map(r => ({
      timestamp: r?.timestamp || '',
      name: r?.name || '',
      type: r?.type || '',
    })),
  };
}

async function fetchDeviceFiles(deviceId, filters = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const from = filters.from || filters.dateFrom || today;
  const to = filters.to || filters.dateTo || today;
  const limit = Number.isFinite(Number(filters.limit)) ? Number(filters.limit) : 50;
  const offset = Number.isFinite(Number(filters.offset)) ? Number(filters.offset) : 0;
  const type = typeof filters.type === 'string' ? filters.type.toLowerCase().trim() : '';
  const validType = ['evt', 'cir', 'day'].includes(type) ? type : null;

  const typeSegment = validType ? `/type/${encodeURIComponent(validType)}` : '';
  const path = `/api/v1/devices/${encodeURIComponent(deviceId)}/files/from/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}${typeSegment}/limit/${limit}/offset/${offset}`;
  const data = await apiFetch(path);
  return normalizeDeviceFilesResponse(data);
}

// ═══════════════════════ API: FILE DOWNLOAD ═══════════════════════
// GET /api/v1/devices/:id/file/:name
//
// Expected response shape:
// { "data": "<base64 string>" } or { "base64": "<base64 string>" }
async function fetchDeviceFile(deviceId, fileName) {
  const safeName = String(fileName || '').trim();
  if (!safeName) {
    throw new Error('File name is required.');
  }

  const path = `/api/v1/devices/${encodeURIComponent(deviceId)}/file/${encodeURIComponent(safeName)}`;
  const data = await apiFetch(path);
  const base64 = data?.data ?? data?.base64 ?? data?.file ?? '';
  return {
    ...data,
    base64: typeof base64 === 'string' ? base64 : '',
  };
}

// ═══════════════════════ API: EVENT DETAILS ═══════════════════════
// GET /api/v1/devices/:id/event/:evt_id
async function fetchEventDetails(deviceId, eventId) {
  const safeEventId = String(eventId || '').trim();
  if (!safeEventId) {
    throw new Error('Event ID is required.');
  }

  const path = `/api/v1/devices/${encodeURIComponent(deviceId)}/event/${encodeURIComponent(safeEventId)}`;
  return await apiFetch(path);
}