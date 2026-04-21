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
// Optional CORS proxy support for development.
// Default is OFF to avoid unexpected third-party proxy behavior.
// Enable explicitly with: `?proxy=cors` (or `?proxy=1`) or `window.API_USE_CORS_PROXY = true`.
let USE_CORS_PROXY = (globalThis.API_USE_CORS_PROXY !== undefined)
  ? Boolean(globalThis.API_USE_CORS_PROXY)
  : false;

// Optional URL override:
// - `?proxy=0` disables the CORS proxy
// - `?proxy=1` forces the CORS proxy
try {
  const qp = new URLSearchParams(window.location.search || '');
  const vRaw = qp.get('proxy');
  const v = String(vRaw || '').trim().toLowerCase();
  if (v === '0') USE_CORS_PROXY = false;
  if (v === '1' || v === 'cors') USE_CORS_PROXY = true;
} catch (e) { /* ignore */ }
// corsproxy.io expects a normal URL value (not encodeURIComponent'd).
// Example: https://corsproxy.io/?url=https://example.com/api
const CORS_PROXY = 'https://corsproxy.io/?url=';
// (Local proxy removed to keep this project static-only.)

function isMockMode() {
  try {
    if (globalThis.MAE_MOCK_MODE === true) return true;
    const qp = new URLSearchParams(window.location.search || '');
    const v = String(qp.get('mock') || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  } catch (e) {
    return false;
  }
}

// ═══════════════════════ MOCK DATA (offline) ═══════════════════════
function _mulberry32(seed) {
  let a = Number(seed) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _seedFromStrings(...parts) {
  const s = parts.map(p => String(p ?? '')).join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function _pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function _clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

function getMockDevicesList(customerId, workId = getActiveWorkId()) {
  const cid = String(customerId || '1');
  const wid = String(workId || '101') || '101';
  const rng = _mulberry32(_seedFromStrings('devices', cid, wid));

  // Some stable-but-varied device IDs per work
  const count = 4 + Math.floor(rng() * 4); // 4..7
  const cities = ['Milano', 'Torino', 'Roma', 'Bologna', 'Genova', 'Verona'];
  const types = ['DL8', 'DL4', 'DL16'];
  const baseLatLng = {
    '101': [45.4642, 9.1900],  // Milano
    '102': [45.0703, 7.6869],  // Torino
    '103': [41.9028, 12.4964], // Roma
  };
  const [baseLat, baseLng] = baseLatLng[wid] || [44.4949, 11.3426]; // Bologna-ish default
  const city = baseLatLng[wid] ? (wid === '101' ? 'Milano' : wid === '102' ? 'Torino' : 'Roma') : _pick(rng, cities);

  const devices = Array.from({ length: count }, (_, i) => {
    const idNum = Number(wid) * 100 + (i + 1);
    const online = rng() > 0.2;
    const jitter = (amp) => (rng() - 0.5) * amp;
    const lat = baseLat + jitter(0.06);
    const lng = baseLng + jitter(0.08);
    const hasValidGps = online ? (rng() > 0.05) : (rng() > 0.15);
    const last = new Date(Date.now() - Math.floor(rng() * 48) * 3600 * 1000);
    const dd = String(last.getDate()).padStart(2, '0');
    const mm = String(last.getMonth() + 1).padStart(2, '0');
    const yyyy = last.getFullYear();
    const HH = String(last.getHours()).padStart(2, '0');
    const MM = String(last.getMinutes()).padStart(2, '0');
    const SS = String(last.getSeconds()).padStart(2, '0');

    return {
      id: String(idNum),
      serial: `M${wid}MOP${String(i + 1).padStart(4, '0')}`,
      name: `Device ${i + 1}`,
      type: _pick(rng, types),
      status: online ? 'online' : 'offline',
      signal: online ? (1 + Math.floor(rng() * 4)) : 0,
      memory: online ? `${(0.2 + rng() * 7.5).toFixed(1)} Gb` : '',
      battery: _clamp(3.25 + rng() * 0.95, 3.0, 4.2),
      usb: _clamp(4.6 + rng() * 0.8, 0, 5.5),
      aux: _clamp(rng() * 2.2, 0, 2.2),
      city,
      location: city,
      position: _pick(rng, ['Roof', 'Basement', 'Site A', 'Site B', 'Warehouse', 'Cabinet 2']),
      lat: hasValidGps ? lat : 0,
      lng: hasValidGps ? lng : 0,
      hasValidGps,
      lastConnection: `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`,
      ip: online ? `192.168.${Number(wid) % 250}.${20 + i}` : '',
      port: online ? String(8000 + i) : '',
      ip_public: online ? `85.12.${(Number(wid) % 250)}.${40 + i}` : '',
      port_public: online ? String(8000 + i) : '',
    };
  });

  console.log('%c[devices] Using mock devices list', 'color:#16a34a;font-weight:700', { customer_id: cid, work_id: wid, count: devices.length });
  return devices;
}

function getMockDevicesInfo(deviceId, workId = getActiveWorkId()) {
  const did = String(deviceId || '0');
  const wid = String(workId || '101');
  const rng = _mulberry32(_seedFromStrings('device-info', wid, did));

  // Return a shape similar to the real API, with the fields we read in fetchDevicesInfo().
  const now = new Date(Date.now() - Math.floor(rng() * 12) * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const gpsValid = rng() > 0.08;
  const base = (wid === '101')
    ? [45.4642, 9.1900]
    : (wid === '102')
      ? [45.0703, 7.6869]
      : (wid === '103')
        ? [41.9028, 12.4964]
        : [44.4949, 11.3426];
  const gps = gpsValid
    ? `${(base[0] + (rng() - 0.5) * 0.05).toFixed(5)};${(base[1] + (rng() - 0.5) * 0.07).toFixed(5)}`
    : '0.00000;0.00000';

  const workPlace = (wid === '101') ? 'Milano' : (wid === '102') ? 'Torino' : (wid === '103') ? 'Roma' : 'Bologna';
  const devicePlace = _pick(rng, ['Roof', 'Basement', 'Plant 1', 'Plant 2', 'Cabinet 3', 'Control room']);

  return {
    id: did,
    date,
    time,
    timestamp: `${date} ${time}`,
    'battery-voltage': (3.25 + rng() * 0.95).toFixed(2),
    'usb-voltage': (4.6 + rng() * 0.8).toFixed(2),
    'aux-voltage': (rng() * 2.2).toFixed(2),
    'sd-free': String(Math.floor((rng() * 7000) + 200)),
    'sd-size': '8192',
    'gps-position': gps,
    'work-place': workPlace,
    'device-place': devicePlace,
    ip: `192.168.${Number(wid) % 250}.${Number(did) % 250}`,
    port: String(8000 + (Number(did) % 30)),
    ip_public: `85.12.${(Number(wid) % 250)}.${(Number(did) % 200) + 20}`,
    port_public: String(8000 + (Number(did) % 30)),
  };
}

function getMockDeviceFiles(deviceId, filters = {}, workId = getActiveWorkId()) {
  const did = String(deviceId || '0');
  const wid = String(workId || '101');
  const from = filters.from || filters.dateFrom || new Date().toISOString().slice(0, 10);
  const to = filters.to || filters.dateTo || from;
  const limit = Number.isFinite(Number(filters.limit)) ? Number(filters.limit) : 50;
  const offset = Number.isFinite(Number(filters.offset)) ? Number(filters.offset) : 0;
  const type = typeof filters.type === 'string' ? filters.type.toLowerCase().trim() : '';
  const validType = ['evt', 'cir', 'day'].includes(type) ? type : null;

  const rng = _mulberry32(_seedFromStrings('files', wid, did, from, to, validType || 'all'));
  const total = 68; // stable-ish
  const count = Math.max(0, Math.min(limit, total - offset));
  const has_more = (offset + count) < total;
  const types = validType ? [validType] : ['evt', 'cir', 'day'];

  const records = Array.from({ length: count }, (_, i) => {
    const idx = offset + i + 1;
    const t = _pick(rng, types);
    const ts = new Date(Date.now() - Math.floor(rng() * 14) * 24 * 3600 * 1000 - Math.floor(rng() * 86400) * 1000);
    const iso = ts.toISOString().replace('T', ' ').slice(0, 19);
    const evtId = 1000 + Math.floor(rng() * 9000);
    const ext = t === 'day' ? 'csv' : 'dat';
    const name =
      t === 'evt'
        ? `acquisition_${wid}_${did}_${evtId}.${ext}`
        : `log_${wid}_${did}_${idx}.${ext}`;
    return { timestamp: iso, name, type: t };
  });

  return { header: [], total, offset, limit, count, has_more, records };
}

function getMockDeviceFile(deviceId, fileName, workId = getActiveWorkId()) {
  const did = String(deviceId || '0');
  const wid = String(workId || '101');
  const name = String(fileName || '').trim() || 'file.dat';
  const payload = `MOCK FILE\nwork_id=${wid}\ndevice_id=${did}\nname=${name}\ncreated=${new Date().toISOString()}\n`;
  return { data: btoa(unescape(encodeURIComponent(payload))) };
}

function getMockEventDetails(deviceId, eventId, workId = getActiveWorkId()) {
  const did = String(deviceId || '0');
  const wid = String(workId || '101');
  const eid = String(eventId || '').trim() || '0';
  const rng = _mulberry32(_seedFromStrings('event', wid, did, eid));
  const ts = new Date(Date.now() - Math.floor(rng() * 10) * 3600 * 1000).toISOString();
  return {
    id: eid,
    device_id: did,
    work_id: wid,
    timestamp: ts,
    type: _pick(rng, ['threshold', 'power', 'gps', 'system']),
    severity: _pick(rng, ['info', 'warning', 'critical']),
    message: _pick(rng, [
      'Threshold exceeded on channel 2',
      'Power input unstable (USB)',
      'GPS signal recovered',
      'Device rebooted after update',
    ]),
    raw: { mock: true },
  };
}

function getMockDeviceData(deviceId, dateFrom, dateTo, workId = getActiveWorkId()) {
  const did = String(deviceId || '0');
  const wid = String(workId || '101');
  const from = String(dateFrom || new Date().toISOString().slice(0, 10));
  const to = String(dateTo || from);
  const rng = _mulberry32(_seedFromStrings('data', wid, did, from, to));

  const header = ['date', 'time', 'PT-50 fs1(mm)', 'ISBC-10 X(gr)', 'ISBC-10 Y(gr)'];
  const points = 50;
  const start = new Date(`${from}T00:00:00`);
  const records = Array.from({ length: points }, (_, i) => {
    const t = new Date(start.getTime() + i * 30 * 60 * 1000); // every 30 min
    const ts = t.toISOString().slice(0, 19);
    const v1 = 35 + Math.sin(i / 7) * 2 + (rng() - 0.5) * 0.6;
    const v2 = -1 + Math.cos(i / 9) * 0.8 + (rng() - 0.5) * 0.4;
    const v3 = -1.5 + Math.sin(i / 11) * 0.9 + (rng() - 0.5) * 0.5;
    return { timestamp: ts, data: [Number(v1.toFixed(2)), Number(v2.toFixed(2)), Number(v3.toFixed(2))] };
  });
  return { header, records };
}

function shouldAutoMockOnNetworkError() {
  try {
    if (globalThis.MAE_AUTO_MOCK_ON_NETWORK_ERROR === false) return false;
    // Default ON for local/static development (API not ready yet).
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'file:';
    return isLocal;
  } catch (e) {
    return false;
  }
}

function doMockLogin(username) {
  const u = String(username || '').trim() || 'demo';
  // Minimal fake token. Not a real JWT (and doesn't need to be).
  const fakeToken = `mock.${btoa(JSON.stringify({ user_id: '1', user: u, iat: Date.now() }))}.sig`;
  setAuthToken(fakeToken);
  setUserId('1');
  setUserName(u);
  console.log('%c[auth] Mock login OK', 'color:#16a34a;font-weight:700', { user: u, user_id: '1' });
  return fakeToken;
}

// ═══════════════════════ AUTH (localStorage token + user_id) ═══════════════════════
const AUTH_TOKEN_STORAGE_KEY  = 'mae_dashboard_auth_token';
const AUTH_USER_ID_STORAGE_KEY = 'mae_dashboard_user_id';
const AUTH_USER_NAME_STORAGE_KEY = 'mae_dashboard_user_name';
const ACTIVE_WORK_STORAGE_KEY = 'mae_dashboard_active_work';
let authToken = '';
let authUserId = '';
let authUserName = '';

function setActiveWorkId(workId) {
  const wid = String(workId || '').trim();
  try {
    if (wid) localStorage.setItem(ACTIVE_WORK_STORAGE_KEY, wid);
    else localStorage.removeItem(ACTIVE_WORK_STORAGE_KEY);
  } catch (e) { /* ignore */ }
  return wid;
}

function getActiveWorkId() {
  // Prefer explicit querystring (?work_id=123) so deep links work.
  try {
    const qp = new URLSearchParams(window.location.search || '');
    const q = (qp.get('work_id') || qp.get('workId') || '').trim();
    if (q) return setActiveWorkId(q);
  } catch (e) { /* ignore */ }

  // Fallback to localStorage (selected from works.html)
  try {
    const s = localStorage.getItem(ACTIVE_WORK_STORAGE_KEY);
    if (s) return String(s).trim();
  } catch (e) { /* ignore */ }
  return '';
}

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
  // Fallback: allow deep links to supply a customer id.
  try {
    const qp = new URLSearchParams(window.location.search || '');
    const q = (qp.get('customer_id') || qp.get('customerId') || qp.get('customer') || '').trim();
    if (q) return q;
  } catch (e) { /* ignore */ }
  return '';
}

function setUserName(name) {
  authUserName = String(name || '').trim();
  // Never persist the old demo username.
  if (authUserName.toLowerCase() === 'demo') authUserName = '';
  try {
    if (authUserName) localStorage.setItem(AUTH_USER_NAME_STORAGE_KEY, authUserName);
    else localStorage.removeItem(AUTH_USER_NAME_STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

function getUserName() {
  if (authUserName) return authUserName;
  try {
    const name = localStorage.getItem(AUTH_USER_NAME_STORAGE_KEY);
    if (name) {
      const cleaned = String(name).trim();
      if (cleaned.toLowerCase() === 'demo') {
        localStorage.removeItem(AUTH_USER_NAME_STORAGE_KEY);
        return '';
      }
      authUserName = cleaned;
      return authUserName;
    }
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
  if (isMockMode()) {
    return doMockLogin(username);
  }

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
    const looksLikeMd5 = /^[a-f0-9]{32}$/i.test(pwd);
    const passwordMd5 = looksLikeMd5 ? pwd : md5(pwd);

    // SECURITY/CONSISTENCY REQUIREMENT:
    // Login must ONLY be attempted using the MD5 password variant.
    console.log('%c[auth] Logging in…', 'color:#2563eb;font-weight:700', { user: username, mode: 'md5-only' });
    res = await apiFetchWithHeaders('/api/v1/auth/login', {
      method: 'POST',
      body: { username, password: passwordMd5 },
    });
  } catch (err) {
    // Browser "Failed to fetch" is almost always CORS/network; make it actionable.
    if (String(err?.message || '').toLowerCase().includes('failed to fetch')) {
      // If the backend isn't reachable yet (common during static dev), fall back to mock mode automatically.
      if (shouldAutoMockOnNetworkError()) {
        return doMockLogin(username);
      }
      const hint = USE_CORS_PROXY
        ? 'Your browser likely blocked the request due to CORS. If you enabled proxying, try `?proxy=cors` (or disable it with `?proxy=0`).'
        : 'Your browser likely blocked the request due to CORS. Try enabling proxying with `?proxy=cors`.';
      throw new Error(`Failed to fetch (network/CORS). ${hint}`);
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
  // Proxy options:
  // - `?proxy=0` disables proxying
  // - `?proxy=1` enables proxying (corsproxy.io)
  // - `?proxy=cors` forces corsproxy.io
  try {
    const qp = new URLSearchParams(window.location.search || '');
    const p = (qp.get('proxy') || '').toLowerCase();
    if (p === 'cors') return `${CORS_PROXY}${full}`;
  } catch (e) { /* ignore */ }

  return USE_CORS_PROXY ? `${CORS_PROXY}${full}` : full;
}

function useWorkScopedEndpoints() {
  // Default OFF: legacy endpoints are more stable on current backend.
  // Enable explicitly with: `?work=1` (or `?work=on`), or `window.MAE_USE_WORK_SCOPED_ENDPOINTS = true`.
  try {
    if (globalThis.MAE_USE_WORK_SCOPED_ENDPOINTS === true) return true;
    const qp = new URLSearchParams(window.location.search || '');
    const v = String(qp.get('work') || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  } catch (e) {
    return false;
  }
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
    if (!res.ok) {
      // Try to read a helpful error payload (json or text) for UI display/debugging.
      let details = '';
      try {
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const j = await res.json();
          details = j?.message || j?.error || j?.detail || '';
          if (!details) {
            try { details = JSON.stringify(j); } catch (e) { /* ignore */ }
          }
        } else {
          details = await res.text();
        }
      } catch (e) { /* ignore */ }
      const suffix = details ? ` — ${String(details).slice(0, 300)}` : '';
      throw new Error(`HTTP ${res.status} ${res.statusText}${suffix}`);
    }
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
// NEW (work-scoped): /api/v1/customers/:customer_id/works/:work_id/devices
// OLD (legacy):      /api/v1/customers/:customer_id/devices
async function fetchDevicesData(customerId, workId = getActiveWorkId()) {
  if (isMockMode()) {
    return getMockDevicesList(customerId, workId);
  }
  showLoadingState(true);
  try {
    const cid = encodeURIComponent(customerId);
    const wid = String(workId || '').trim();
    const path = (wid && useWorkScopedEndpoints())
      ? `/api/v1/works/${encodeURIComponent(wid)}/devices`
      : `/api/v1/customers/${cid}/devices`;
    const data = await apiFetch(path);
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
// NEW (work-scoped): /api/v1/works/:work_id/devices/:device_id/info
// OLD (legacy):      /api/v1/devices/:device_id/info
async function fetchDevicesInfo(deviceId, workId = getActiveWorkId()) {
  try {
    if (isMockMode()) {
      const data = getMockDevicesInfo(deviceId, workId);
      // Reuse the exact mapping behavior below (activeDevice updates etc.)
      // by falling through with the same `data` variable shape.
      // (We keep the rest of the function identical.)
      // eslint-disable-next-line no-unused-vars
      var _mockData = data;
    }
    const wid = String(workId || '').trim();
    const did = encodeURIComponent(deviceId);
    const path = (wid && useWorkScopedEndpoints())
      ? `/api/v1/devices/${did}/info`
      : `/api/v1/devices/${did}/info`;
    const data = isMockMode() ? _mockData : await apiFetch(path);
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
    const workPlace =
      data['work-place'] ??
      data.work_place ??
      data.workPlace ??
      data.location ??
      data.work_location ??
      data.workLocation ??
      '';
    const devicePlace =
      data['device-place'] ??
      data.device_place ??
      data.devicePlace ??
      data.position ??
      data.device_position ??
      data.devicePosition ??
      '';
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

    // Work-scoped mapping (Client req): Location = work-place, Position = device-place
    if (workPlace !== undefined) activeDevice.location = String(workPlace || '').trim();
    if (devicePlace !== undefined) activeDevice.position = String(devicePlace || '').trim();
    // Backward-compat for existing UI pieces still using `.city`
    if (activeDevice.location && !activeDevice.city) activeDevice.city = activeDevice.location;

    // GPS rule: if gps-position is 0.00000;0.00000 do not load maps.
    // Also, avoid carrying over coordinates from previous devices.
    let parsedLat = 0;
    let parsedLng = 0;
    let hasValidGps = false;
    if (gps && gps !== '-;-') {
      const parts = String(gps).split(';');
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
        parsedLat = lat;
        parsedLng = lng;
        hasValidGps = true;
      }
    }
    activeDevice.hasValidGps = hasValidGps;
    activeDevice.lat = hasValidGps ? parsedLat : 0;
    activeDevice.lng = hasValidGps ? parsedLng : 0;

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
// NEW (work-scoped): /api/v1/works/:work_id/devices/:device_id/data/from/:start/to/:end/limit/50/offset/0
// OLD (legacy):      /api/v1/devices/:device_id/data/from/:start/to/:end/limit/50/offset/0
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
async function fetchData(deviceId, dateFrom, dateTo, workId = getActiveWorkId()) {
  showLoadingState(true);

  try {
    if (isMockMode()) {
      const data = getMockDeviceData(deviceId, dateFrom, dateTo, workId);
      // Mimic the same return path (mapped rows) without touching the network.
      let parsedHeaders = null;
      if (data && Array.isArray(data.header)) {
        const dataHeaders = data.header.filter(h => {
          const s = String(h).toLowerCase().trim();
          return !s.startsWith('date') && !s.startsWith('time');
        });
        parsedHeaders = [];
        for (let i = 0; i < dataHeaders.length; i++) {
          const str = String(dataHeaders[i]);
          const match = str.match(/^(.+?)(?:\(([^)]*)\))?$/);
          const name = match ? match[1].trim() : str;
          const unit = match && match[2] ? match[2].trim() : '';
          parsedHeaders.push({ key: `ch${i + 1}`, name, unit });
        }
      }
      if (parsedHeaders && parsedHeaders.length > 0) {
        activeChannelHeaders = {};
        parsedHeaders.forEach(ch => {
          activeChannelHeaders[ch.key] = { name: ch.name, unit: ch.unit };
        });
      }

      const rows = Array.isArray(data?.records)
        ? data.records.map(record => {
          const ts = record.timestamp || '';
          const dt = ts ? new Date(ts.replace(' ', 'T')) : null;
          const date = dt ? dt.toLocaleDateString('en-GB') : '';
          const time = dt ? dt.toTimeString().slice(0, 8) : '';
          const obj = { date, time, ts: dt ? dt.getTime() : 0 };
          if (Array.isArray(record.data)) {
            record.data.forEach((val, i) => {
              obj[`ch${i + 1}`] = parseFloat(val) || 0;
            });
          }
          return obj;
        })
        : [];

      showLoadingState(false);
      const cfg = getDeviceConfig();
      const mapped = rows.map(item => cfg.mapRow(item));
      showSuccessMessage(`✅ ${mapped.length} records loaded (mock)`);
      return mapped;
    }

    // ── Build date range ──────────────────────────────────────────────
    // Use short YYYY-MM-DD format to keep URL short (avoids 413 Too Large)
    const today = new Date().toISOString().slice(0, 10);
    const startDate = dateFrom || today;
    const endDate   = dateTo   || today;

    // ── Call API ──────────────────────────────────────────────────────
    const wid = String(workId || '').trim();
    const did = encodeURIComponent(deviceId);
    const dataPath = (wid && useWorkScopedEndpoints())
      ? `/api/v1/works/${encodeURIComponent(wid)}/devices/${did}/data/from/${startDate}/to/${endDate}/limit/50/offset/0`
      : `/api/v1/devices/${did}/data/from/${startDate}/to/${endDate}/limit/50/offset/0`;
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
        const retryPath = (wid && useWorkScopedEndpoints())
          ? `/api/v1/works/${encodeURIComponent(wid)}/devices/${did}/data/from/${today}/to/${today}/limit/50/offset/0`
          : `/api/v1/devices/${did}/data/from/${today}/to/${today}/limit/50/offset/0`;
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
        const obj  = { date, time, ts: dt ? dt.getTime() : 0 };
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

async function fetchDeviceFiles(deviceId, filters = {}, workId = getActiveWorkId()) {
  if (isMockMode()) {
    const res = getMockDeviceFiles(deviceId, filters, workId);
    return normalizeDeviceFilesResponse(res);
  }
  const today = new Date().toISOString().slice(0, 10);
  const from = filters.from || filters.dateFrom || today;
  const to = filters.to || filters.dateTo || today;
  const limit = Number.isFinite(Number(filters.limit)) ? Number(filters.limit) : 50;
  const offset = Number.isFinite(Number(filters.offset)) ? Number(filters.offset) : 0;
  const type = typeof filters.type === 'string' ? filters.type.toLowerCase().trim() : '';
  const validType = ['evt', 'cir', 'day'].includes(type) ? type : null;

  const typeSegment = validType ? `/type/${encodeURIComponent(validType)}` : '';
  const wid = String(workId || '').trim();
  const did = encodeURIComponent(deviceId);
  const path = (wid && useWorkScopedEndpoints())
    ? `/api/v1/works/${encodeURIComponent(wid)}/devices/${did}/files/from/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}${typeSegment}/limit/${limit}/offset/${offset}`
    : `/api/v1/devices/${did}/files/from/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}${typeSegment}/limit/${limit}/offset/${offset}`;
  const data = await apiFetch(path);
  return normalizeDeviceFilesResponse(data);
}

// ═══════════════════════ API: FILE DOWNLOAD ═══════════════════════
// NEW (work-scoped): /api/v1/works/:work_id/devices/:device_id/file/:name
// OLD (legacy):      /api/v1/devices/:device_id/file/:name
//
// Expected response shape:
// { "data": "<base64 string>" } or { "base64": "<base64 string>" }
async function fetchDeviceFile(deviceId, fileName, workId = getActiveWorkId()) {
  const safeName = String(fileName || '').trim();
  if (!safeName) {
    throw new Error('File name is required.');
  }

  if (isMockMode()) {
    const data = getMockDeviceFile(deviceId, safeName, workId);
    const base64 = data?.content ?? data?.data ?? data?.base64 ?? data?.file ?? '';
    return { ...data, base64: typeof base64 === 'string' ? base64 : '' };
  }

  const wid = String(workId || '').trim();
  const did = encodeURIComponent(deviceId);
  const path = (wid && useWorkScopedEndpoints())
    ? `/api/v1/works/${encodeURIComponent(wid)}/devices/${did}/file/${encodeURIComponent(safeName)}`
    : `/api/v1/devices/${did}/file/${encodeURIComponent(safeName)}`;
  const data = await apiFetch(path);
  const base64 = data?.content ?? data?.data ?? data?.base64 ?? data?.file ?? '';
  return {
    ...data,
    base64: typeof base64 === 'string' ? base64 : '',
  };
}

// ═══════════════════════ API: EVENT DETAILS ═══════════════════════
// NEW (work-scoped): /api/v1/works/:work_id/devices/:device_id/event/:evt_id
// OLD (legacy):      /api/v1/devices/:device_id/event/:evt_id
async function fetchEventDetails(deviceId, eventId, workId = getActiveWorkId()) {
  const safeEventId = String(eventId || '').trim();
  if (!safeEventId) {
    throw new Error('Event ID is required.');
  }

  if (isMockMode()) {
    return getMockEventDetails(deviceId, safeEventId, workId);
  }

  const wid = String(workId || '').trim();
  const did = encodeURIComponent(deviceId);
  const path = (wid && useWorkScopedEndpoints())
    ? `/api/v1/works/${encodeURIComponent(wid)}/devices/${did}/event/${encodeURIComponent(safeEventId)}`
    : `/api/v1/devices/${did}/event/${encodeURIComponent(safeEventId)}`;
  return await apiFetch(path);
}

// ═══════════════════════ API: WORKS LIST ═══════════════════════
// GET /api/v1/customers/:customer_id/works
//
// Expected response: array of works (see API.xlsx). We keep the mapping flexible because
// field names may differ slightly between environments.
function getMockWorksList(customerId) {
  const cid = String(customerId || '1');
  console.log('%c[works] Using mock works list', 'color:#16a34a;font-weight:700', { customer_id: cid });
  return [
    { id: '101', description: 'Work 101 — Demo Site A', location: 'Milano', active: true,  deviceCount: 3, raw: { id: '101' } },
    { id: '102', description: 'Work 102 — Demo Site B', location: 'Torino', active: false, deviceCount: 1, raw: { id: '102' } },
    { id: '103', description: 'Work 103 — Demo Site C', location: 'Roma',   active: true,  deviceCount: 5, raw: { id: '103' } },
  ];
}

async function fetchWorks(customerId) {
  if (isMockMode()) {
    return getMockWorksList(customerId);
  }

  showLoadingState(true);
  try {
    const data = await apiFetch(`/api/v1/works`);
    showLoadingState(false);

    const list = Array.isArray(data)
      ? data
      : (Array.isArray(data?.records) ? data.records : (Array.isArray(data?.data) ? data.data : []));

    if (!Array.isArray(list) || list.length === 0) return [];

    const isTruthy = (v) => {
      if (v === true) return true;
      if (v === false || v == null) return false;
      const s = String(v).trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'active' || s === 'on';
    };

    return list.map((raw) => {
      const id =
        raw?.id ??
        raw?.work_id ??
        raw?.workId ??
        raw?.codice ??
        raw?.code ??
        '';

      const description =
        raw?.description ??
        raw?.descrizione ??
        raw?.name ??
        raw?.titolo ??
        raw?.title ??
        `Work ${id || ''}`.trim();

      const location =
        raw?.location ??
        raw?.place ??
        raw?.work_place ??
        raw?.['work-place'] ??
        raw?.['work_place'] ??
        raw?.citta ??
        raw?.city ??
        '';

      const devices = Array.isArray(raw?.devices) ? raw.devices : null;
      const deviceCount =
        Number.isFinite(Number(raw?.devices_count)) ? Number(raw.devices_count) :
        Number.isFinite(Number(raw?.device_count)) ? Number(raw.device_count) :
        Number.isFinite(Number(raw?.n_devices)) ? Number(raw.n_devices) :
        (devices ? devices.length : null);

      const active =
        isTruthy(raw?.active) ||
        isTruthy(raw?.is_active) ||
        isTruthy(raw?.enabled) ||
        isTruthy(raw?.running) ||
        isTruthy(raw?.acquisition_running) ||
        (String(raw?.status || '').toLowerCase().includes('active'));

      return {
        id: String(id),
        description: String(description || ''),
        location: String(location || ''),
        active: Boolean(active),
        deviceCount: deviceCount == null ? null : Number(deviceCount),
        raw,
      };
    });
  } catch (err) {
    // During static/local development the API is often unreachable due to CORS.
    // Fall back to a mock works list so the UI remains usable.
    const msg = String(err?.message || '').toLowerCase();
    if (shouldAutoMockOnNetworkError() && (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('cors'))) {
      showLoadingState(false);
      console.warn('[works] Falling back to mock works due to network/CORS error:', err?.message || err);
      return getMockWorksList(customerId);
    }
    showLoadingState(false);
    const label = err?.name === 'AbortError' ? 'Request timed out.' : (err?.message || 'Unknown error');
    showErrorMessage(`Could not load works: ${label}. (API not available yet)`);
    return [];
  }
}