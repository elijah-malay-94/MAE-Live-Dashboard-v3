// ╔══════════════════════════════════════════════════════════════╗
// ║  api.js — API Layer, Helpers & Mock Data                     ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • formatApiDate()       date string normaliser              ║
// ║  • apiUrl() / apiFetch() / apiFetchWithHeaders()             ║
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

// Builds the correct URL — direct call in production.
const API_BASE = 'https://www.maeservice.it';
// Enable proxy automatically on localhost / file:// to avoid browser CORS "Failed to fetch".
// You can override explicitly with: window.API_USE_CORS_PROXY = true/false
const USE_CORS_PROXY = (globalThis.API_USE_CORS_PROXY !== undefined)
  ? Boolean(globalThis.API_USE_CORS_PROXY)
  : (window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1'
    || window.location.protocol === 'file:');
const CORS_PROXY = 'https://corsproxy.io/?url=';

// ═══════════════════════ AUTH (localStorage token + user_id) ═══════════════════════
const AUTH_TOKEN_STORAGE_KEY  = 'mae_dashboard_auth_token';
const AUTH_USER_ID_STORAGE_KEY = 'mae_dashboard_user_id';
const AUTH_USER_NAME_STORAGE_KEY = 'mae_dashboard_user_name';
let authToken = '';
let authUserId = '';
let authUserName = '';

function setAuthToken(token) {
  authToken = String(token || '').trim();
  if (/^bearer\s+/i.test(authToken)) authToken = authToken.replace(/^bearer\s+/i, '').trim();
  try {
    if (authToken) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
    else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

function setUserId(id) {
  authUserId = String(id || '').trim();  
  try {
    if (authUserId) localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, authUserId);
    else localStorage.removeItem(AUTH_USER_ID_STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

function getUserId() {
  if (authUserId) return authUserId;
  try {
    const id = localStorage.getItem(AUTH_USER_ID_STORAGE_KEY);
    if (id) { authUserId = String(id).trim(); return authUserId; }
  } catch (e) { /* ignore */ }
  return '';
}

function setUserName(name) {
  authUserName = String(name || '').trim();  
  try {
    if (authUserName) localStorage.setItem(AUTH_USER_NAME_STORAGE_KEY, authUserName);
    else localStorage.removeItem(AUTH_USER_NAME_STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

function getUserName() {
  if (authUserName) return authUserName;
  try {
    const name = localStorage.getItem(AUTH_USER_NAME_STORAGE_KEY);
    if (name) { authUserName = String(name).trim(); return authUserName; }
  } catch (e) { /* ignore */ }
  return '';
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch (e) { return null; }
}

function loadAuthTokenFromStorage() {
  try {
    const t = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (t) authToken = String(t).trim();
    const id = localStorage.getItem(AUTH_USER_ID_STORAGE_KEY);
    if (id) {
      authUserId = String(id).trim();
    } else if (authToken) {
      // Recover user_id from JWT payload if not stored (old session)
      const payload = decodeJwtPayload(authToken);
      const uid = payload?.user_id || payload?.userId || payload?.sub || '';
      if (uid) setUserId(uid);
    }
  } catch (e) { /* ignore */ }
  return authToken;
}

function getAuthHeader() {
  const t = authToken || loadAuthTokenFromStorage();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function authLogout() {
  setAuthToken('');
  setUserId('');
  setUserName('');
}

async function authLogin(username, password) {
  let res;
  try {
    const md5 = (str) => {
      // Minimal MD5 implementation (public domain style). Used only for client-side compatibility with APIs expecting MD5-hashed passwords.
      function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
      }
      function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
      function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
      function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
      function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
      function md5cycle(x, k) {
        let a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17,  606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12,  1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7,  1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7,  1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22,  1236535329);

        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14,  643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9,  38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5,  568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20,  1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14,  1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);

        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16,  1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11,  1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4,  681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23,  76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16,  530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);

        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10,  1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6,  1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6,  1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21,  1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15,  718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);

        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);
      }
      function md5blk(s) {
        const md5blks = [];
        for (let i = 0; i < 64; i += 4) {
          md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
      }
      function md51(s) {
        let n = s.length;
        let state = [1732584193, -271733879, -1732584194, 271733878];
        let i;
        for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
        s = s.substring(i - 64);
        const tail = new Array(16).fill(0);
        for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
      }
      function rhex(n) {
        const s = '0123456789abcdef';
        let j, out = '';
        for (j = 0; j < 4; j++) out += s.charAt((n >> (j * 8 + 4)) & 0x0F) + s.charAt((n >> (j * 8)) & 0x0F);
        return out;
      }
      function hex(x) { return x.map(rhex).join(''); }
      function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
      return hex(md51(String(str)));
    };

    const pwd = String(password || '').trim();
    const passwordToSend = /^[a-f0-9]{32}$/i.test(pwd) ? pwd : md5(pwd);
    console.log('%c[auth] Logging in…', 'color:#2563eb;font-weight:700', { user: username });
    res = await apiFetchWithHeaders('/api/v1/auth/login', {
      method: 'POST',
      body: { username, password: passwordToSend },
    });
  } catch (err) {
    // Browser "Failed to fetch" is almost always CORS/network; make it actionable.
    if (String(err?.message || '').toLowerCase().includes('failed to fetch')) {
      throw new Error('Failed to fetch (likely CORS blocked). Try running via START_SERVER.bat or enable the CORS proxy.');
    }
    throw err;
  }

  const data = res?.data || {};
  const nested = (data && typeof data === 'object')
    ? (data.data || data.result || data.payload || null)
    : null;

  const headerAuth =
    res?.headers?.get?.('authorization')
    || res?.headers?.get?.('Authorization')
    || '';

  const token =
    data.token ||
    data.access_token ||
    data.accessToken ||
    data.jwt ||
    data.bearer ||
    nested?.token ||
    nested?.access_token ||
    nested?.accessToken ||
    nested?.jwt ||
    nested?.bearer ||
    headerAuth ||
    '';

  if (!token) throw new Error('Login succeeded but no token was returned by the API response.');
  setAuthToken(token);
  setUserName(username);

  // Extract user_id from JWT payload and persist it
  const payload = decodeJwtPayload(token);
  const uid = payload?.user_id || payload?.userId || payload?.sub || '';
  if (uid) {
    setUserId(uid);
    console.log('%c[auth] Login OK — token + user_id saved to localStorage', 'color:#16a34a;font-weight:700', { user_id: uid });
  } else {
    console.log('%c[auth] Login OK — token saved (no user_id in JWT payload)', 'color:#16a34a;font-weight:700');
  }
  return token;
}

async function ensureAuth() {
  const existing = loadAuthTokenFromStorage();
  if (existing) {
    console.log('%c[auth] Using token from localStorage', 'color:#16a34a;font-weight:700');
    return existing;
  }
 return "";
}

function apiUrl(path) {
  const full = `${API_BASE}${path}`;
  return USE_CORS_PROXY ? `${CORS_PROXY}${full}` : full;
}

// ─── FIX 1: timeout increased to 30s ───────────────────────────
async function apiFetch(path, timeoutMs = 30000, _retried = false) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    console.log('%c[apiFetch] GET', 'color:#2563eb', path);
    const res = await fetch(apiUrl(path), {
      method: 'GET',
      headers: { 'Accept': 'application/json', ...getAuthHeader() },
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
async function apiFetchWithHeaders(path, options = {}, timeoutMs = 30000, _retried = false) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    console.log('%c[apiFetch] ' + String(options.method || 'GET'), 'color:#2563eb', path);
    const defaultHeaders = { 'Accept': 'application/json' };
    if (options.body && typeof options.body === 'object') {
      defaultHeaders['Content-Type'] = 'application/json';
    }
    const res = await fetch(apiUrl(path), {
      method:  options.method || 'GET',
      headers: { ...defaultHeaders, ...getAuthHeader(), ...(options.headers || {}) },
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
      // Format the `updated` field (e.g. "2024-04-17 11:51:13") as dd/MM/yyyy HH:mm:ss
      let lastConn = '—';
      if (item.updated) {
        const dt = new Date(String(item.updated).replace(' ', 'T'));
        if (!isNaN(dt.getTime())) {
          const dd   = String(dt.getDate()).padStart(2, '0');
          const mm   = String(dt.getMonth() + 1).padStart(2, '0');
          const yyyy = dt.getFullYear();
          const HH   = String(dt.getHours()).padStart(2, '0');
          const MM   = String(dt.getMinutes()).padStart(2, '0');
          const SS   = String(dt.getSeconds()).padStart(2, '0');
          lastConn = `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
        }
      }
      return {
        id:             String(item.id),
        serial:         item.matricola   || '',
        name:           item.descrizione || item.matricola || `Device ${item.id}`,
        type:           item.tipologia   || 'DL8',
        status:         item.enabled === '1' ? 'online' : 'offline',
        signal:         0,
        memory:         '',
        battery:        0,
        usb:            0,
        aux:            0,
        city:           '',
        position:       '',
        lat:            parseFloat(coords[0]) || 0,
        lng:            parseFloat(coords[1]) || 0,
        lastConnection: lastConn,
        // Network info (if provided by /devices endpoint)
        ip:          item.ip         ?? '',
        port:        item.port       ?? '',
        ip_public:   item.ip_public  ?? '',
        port_public: item.port_public ?? '',
      };
    });
  } catch (err) {
    showLoadingState(false);
    const label = err.name === 'AbortError' ? 'Request timed out.' : err.message;
    showErrorMessage(`Could not load device list: ${label}.`);
  }
}

// ═══════════════════════ API: DEVICE INFO ═══════════════════════
// GET /api/v1/devices/:id/info
async function fetchDevicesInfo(deviceId) {
  try {
    const data = await apiFetch(`/api/v1/devices/${deviceId}/info`);
    if (!data || typeof data !== 'object') return null;

    const formatLastConnection = (datePart, timePart, tsPart) => {
      const rawDate = String(datePart ?? '').trim();
      let rawTime = String(timePart ?? '').trim();
      const rawTs = String(tsPart ?? '').trim();

      if (rawTime && /^\d{2}:\d{2}$/.test(rawTime)) rawTime = `${rawTime}:00`;

      const normalizeDate = (v) => {
        if (!v) return '';
        // yyyy-MM-dd or yyyy/MM/dd -> dd/MM/yyyy
        if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(v)) {
          const [y, m, d] = v.split(/[-/]/);
          return `${d}/${m}/${y}`;
        }
        // dd-MM-yyyy or dd/MM/yyyy -> dd/MM/yyyy
        if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(v)) {
          const [d, m, y] = v.split(/[-/]/);
          return `${d}/${m}/${y}`;
        }
        return '';
      };

      const dateFmt = normalizeDate(rawDate);
      if (dateFmt && rawTime) return `${dateFmt} ${rawTime}`;

      // Fallback: parse single timestamp field if present.
      if (rawTs) {
        const dt = new Date(rawTs.replace(' ', 'T'));
        if (!isNaN(dt.getTime())) {
          const dd = String(dt.getDate()).padStart(2, '0');
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const yyyy = dt.getFullYear();
          const HH = String(dt.getHours()).padStart(2, '0');
          const MM = String(dt.getMinutes()).padStart(2, '0');
          const SS = String(dt.getSeconds()).padStart(2, '0');
          return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
        }
      }

      return '—';
    };

    const batt   = parseFloat(data['battery-voltage'] ?? data.batteryVoltage ?? 0);
    const usb    = parseFloat(data['usb-voltage']     ?? data.usbVoltage     ?? 0);
    const aux    = parseFloat(data['aux-voltage']     ?? data.auxVoltage     ?? 0);
    const sdFree = parseFloat(data['sd-free']         ?? data.sdFree         ?? 0);
    const sdSize = parseFloat(data['sd-size']         ?? data.sdSize         ?? 0);
    const gps    = data['gps-position'] ?? data.gpsPosition ?? '';
    const lastConn = formatLastConnection(
      data.date ?? data['connection-date'] ?? data.last_date,
      data.time ?? data['connection-time'] ?? data.last_time,
      data.timestamp ?? data['last-connection'] ?? data.last_connection
    );

    if (batt  > 0) activeDevice.battery = batt;
    if (usb   > 0) activeDevice.usb     = usb;
    if (aux   > 0) activeDevice.aux     = aux;
    if (sdFree > 0) activeDevice.memory = `${(sdFree / 1024).toFixed(1)} Gb`;
    activeDevice.lastConnection = lastConn;

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
      if (firstErr.message && firstErr.message.includes('500')) throw firstErr;
      console.warn('[fetchData] API call failed:', firstErr.message);
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
      // Skip "date" and "time" columns — those are handled separately in the row object
      const dataHeaders = headerArray.filter(h => {
        const s = String(h).toLowerCase().trim();
        return !s.startsWith('date') && !s.startsWith('time');
      });
      parsedHeaders = [];
      for (let i = 0; i < dataHeaders.length; i++) {
        const str   = String(dataHeaders[i]);
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
      showErrorMessage('No data available for the selected date range. Try a different period.');
      return [];
    }

    const cfg    = getDeviceConfig();
    const mapped = rows.map(item => cfg.mapRow(item));
    console.log('[fetchData]', mapped.length, 'records | channels:', cfg.channels.map(c => c.label));
    showSuccessMessage(`✅ ${mapped.length} records loaded${activeChannelHeaders ? ' (live channels)' : ''}`);
    return mapped;

  } catch (err) {
    showLoadingState(false);
    if (err.message && err.message.includes('500')) {
      showErrorMessage('No data available for the selected date range. Try a different period.');
      return [];
    }
    console.warn('[fetchData] error:', err.message);
    const label = err.name === 'AbortError' ? 'Request timed out' : err.message;
    showErrorMessage(`API error: ${label}`);
    return [];
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
  const base64 = data?.content ?? data?.data ?? data?.base64 ?? data?.file ?? '';
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