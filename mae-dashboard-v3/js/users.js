// ╔══════════════════════════════════════════════════════════════╗
// ║  users.js — Users page controller                           ║
// ║                                                              ║
// ║  Manages system user accounts (registry/admin page).        ║
// ║  Routes: ?page=users                                         ║
// ║                                                              ║
// ║  Dependencies: api.js (fetchUsers, fetchUser, apiCreateUser, ║
// ║    apiUpdateUserEmail, apiToggleUserEnabled, fetchUserDevices,║
// ║    apiCreateDevice), i18n.js (window.t, window.tf)           ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

// ═══════════════════════ STATE ═══════════════════════

/** Full list of users loaded from API / mock */
let usUsers = [];

/** ID of the user currently being edited (email edit modal) */
let _usEditId = null;

/** ID of the user whose devices are being viewed */
let _usDevicesUserId = null;

// ═══════════════════════ HELPERS ═══════════════════════

/**
 * HTML-escape a string to prevent XSS in innerHTML templates.
 * @param {string} s
 * @returns {string}
 */
function _usEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Show or hide the page-level message bar (#usMsg).
 * @param {'error'|'success'|null} type  Pass null/'' to hide.
 * @param {string} msg
 */
function _usMsg(type, msg) {
  const el = document.getElementById('usMsg');
  if (!el) return;
  if (!type || !msg) {
    el.className = 'us-msg';
    el.textContent = '';
    return;
  }
  el.className = 'us-msg us-msg--' + type;
  el.textContent = msg;
}

/**
 * Show or hide the device modal message bar (#usDeviceMsg).
 * @param {'error'|'success'|null} type
 * @param {string} msg
 */
function _usDeviceMsg(type, msg) {
  const el = document.getElementById('usDeviceMsg');
  if (!el) return;
  if (!type || !msg) {
    el.className = 'us-msg';
    el.textContent = '';
    return;
  }
  el.className = 'us-msg us-msg--' + type;
  el.textContent = msg;
}

/**
 * Format a datetime string to a localized date + time.
 * Returns '—' for null / empty values.
 * @param {string|null} dt
 * @returns {string}
 */
function _usFmtDate(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return String(dt);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(dt);
  }
}

/**
 * Returns a green checkmark span for truthy values, muted dash for falsy.
 * @param {boolean} val
 * @returns {string} HTML snippet
 */
function _usBoolIcon(val) {
  if (val) {
    return '<span class="us-bool-yes">&#10003;</span>';
  }
  return '<span class="us-bool-no">—</span>';
}

// ═══════════════════════ INIT ═══════════════════════

/**
 * Entry point for the Users page.
 * Fetches users, renders stats + table, wires search input.
 */
async function initUsers() {
  _usMsg(null, '');
  const tbody = document.getElementById('usTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="us-table-empty">${window.t('users.loading') || 'Loading…'}</td></tr>`;
  }
  try {
    usUsers = await fetchUsers();
  } catch (e) {
    usUsers = [];
    _usMsg('error', window.t('users.errLoadFailed') || 'Failed to load users.');
  }
  renderUsersStats();
  renderUsersTable();

  // Wire search
  const searchEl = document.getElementById('usSearch');
  if (searchEl) {
    searchEl.addEventListener('input', renderUsersTable);
  }
}
window.initUsers = initUsers;

// ═══════════════════════ RENDER: STATS ═══════════════════════

/**
 * Update the three KPI stat cards with current usUsers data.
 */
function renderUsersStats() {
  const total   = usUsers.length;
  const enabled = usUsers.filter(u => u.enabled).length;
  const locked  = usUsers.filter(u => u.locked).length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('usStatTotal',   total);
  set('usStatEnabled', enabled);
  set('usStatLocked',  locked);

  set('usStatTotalSub',   window.tf('users.statTotalSub',   { total })   || `${total} total`);
  set('usStatEnabledSub', window.tf('users.statEnabledSub', { enabled }) || `${enabled} enabled`);
  set('usStatLockedSub',  window.tf('users.statLockedSub',  { locked })  || `${locked} locked`);
}
window.renderUsersStats = renderUsersStats;

// ═══════════════════════ RENDER: TABLE ═══════════════════════

/**
 * Re-render the user table, filtered by the current search query.
 */
function renderUsersTable() {
  const tbody = document.getElementById('usTableBody');
  if (!tbody) return;

  const q = (document.getElementById('usSearch')?.value || '').toLowerCase().trim();
  const filtered = q
    ? usUsers.filter(u =>
        String(u.id   || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q)
      )
    : usUsers;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="us-table-empty">${_usEsc(window.t('users.empty') || 'No users found.')}</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(_usRenderRow).join('');
  }

  const info = document.getElementById('usPaginationInfo');
  if (info) {
    info.textContent = window.tf('users.paginationInfo', { count: filtered.length, total: usUsers.length })
      || `${filtered.length} / ${usUsers.length}`;
  }
}
window.renderUsersTable = renderUsersTable;

/**
 * Build the HTML for a single user row.
 * @param {Object} u  User object
 * @returns {string}
 */
function _usRenderRow(u) {
  const editTitle    = _usEsc(window.t('users.editEmail')      || 'Edit Email');
  const detailTitle  = _usEsc(window.t('users.viewDetails')    || 'Details');
  const devTitle     = _usEsc(window.t('users.manageDevices')  || 'Devices');

  // Enabled toggle reuses .um-toggle from user-management.css
  const toggleHtml = `
    <label class="um-toggle">
      <input type="checkbox" ${u.enabled ? 'checked' : ''} onchange="usToggleEnabled(${Number(u.id)}, this.checked)">
      <span class="um-toggle-track"></span>
      <span class="um-toggle-thumb"></span>
    </label>`;

  const lockedHtml = u.locked
    ? `<span class="us-locked">&#9679; ${_usEsc(window.t('common.yes') || 'yes')}</span>`
    : `<span class="us-bool-no">—</span>`;

  return `<tr>
    <td>${_usEsc(u.id)}</td>
    <td>
      <div class="us-email-cell">
        <span>${_usEsc(u.email || '—')}</span>
        <button class="us-btn-edit-email" title="${editTitle}" onclick="usOpenEditEmail(${Number(u.id)}, ${_usEsc(JSON.stringify(_usEsc(u.email || '')))})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
    </td>
    <td>${toggleHtml}</td>
    <td>${lockedHtml}</td>
    <td>${_usBoolIcon(u.email_verified)}</td>
    <td>${_usEsc(_usFmtDate(u.last_login))}</td>
    <td>
      <div class="us-actions-cell">
        <button class="us-btn-icon" title="${detailTitle}" onclick="usOpenDetails(${Number(u.id)})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </button>
        <button class="us-btn-icon us-btn-icon--devices" title="${devTitle}" onclick="usOpenDevices(${Number(u.id)}, ${_usEsc(JSON.stringify(_usEsc(u.email || '')))})">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </button>
      </div>
    </td>
  </tr>`;
}

// ═══════════════════════ CREATE USER MODAL ═══════════════════════

/** Open the Create User modal. */
function usOpenCreateModal() {
  const el = document.getElementById('usCreateEmail');
  if (el) el.value = '';
  const msg = document.getElementById('usCreateMsg');
  if (msg) { msg.className = 'us-msg'; msg.textContent = ''; }
  const modal = document.getElementById('usCreateModal');
  if (modal) modal.classList.add('open');
}
window.usOpenCreateModal = usOpenCreateModal;

/** Close the Create User modal. */
function usCloseCreateModal() {
  const modal = document.getElementById('usCreateModal');
  if (modal) modal.classList.remove('open');
}
window.usCloseCreateModal = usCloseCreateModal;

/**
 * Read form inputs, call API, prepend new user to list, re-render.
 */
async function usCreateUser() {
  const emailEl = document.getElementById('usCreateEmail');
  const msgEl   = document.getElementById('usCreateMsg');
  const setMsg  = (type, text) => {
    if (!msgEl) return;
    msgEl.className = 'us-msg' + (type ? ' us-msg--' + type : '');
    msgEl.textContent = text;
  };

  const email = (emailEl?.value || '').trim();
  if (!email) {
    setMsg('error', window.t('users.errEnterEmail') || 'Please enter an email address.');
    return;
  }

  try {
    const result = await apiCreateUser(email);
    const newUser = {
      id: result.id,
      email,
      enabled: true,
      locked: false,
      email_verified: false,
      last_login: null,
      last_attempt: null,
      failed_attempts: 0,
      reset_token: null,
      reset_token_expires: null,
      verify_token: null,
      verify_token_expires: null,
      refresh_token: null,
      refresh_token_expires: null,
      created_by_id: null,
      created_at: new Date().toISOString(),
      updated_by_id: null,
      updated_at: new Date().toISOString(),
    };
    usUsers.unshift(newUser);
    renderUsersStats();
    renderUsersTable();
    setMsg('success', window.t('users.successCreated') || 'User created successfully.');
    setTimeout(usCloseCreateModal, 1200);
  } catch (e) {
    setMsg('error', window.t('users.errCreateFailed') || 'Failed to create user.');
  }
}
window.usCreateUser = usCreateUser;

// ═══════════════════════ DETAILS MODAL ═══════════════════════

/**
 * Fetch full user object and show the details modal.
 * @param {number} id
 */
async function usOpenDetails(id) {
  const body  = document.getElementById('usDetailsBody');
  const modal = document.getElementById('usDetailsModal');
  if (body)  body.innerHTML = `<p style="color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;">${window.t('users.loading') || 'Loading…'}</p>`;
  if (modal) modal.classList.add('open');
  try {
    const u = await fetchUser(id);
    if (body) body.innerHTML = _usRenderDetailsGrid(u);
  } catch (e) {
    if (body) body.innerHTML = `<p style="color:var(--red);font-family:'DM Mono',monospace;font-size:12px;">${window.t('users.errLoadFailed') || 'Failed to load user.'}</p>`;
  }
}
window.usOpenDetails = usOpenDetails;

/** Close the details modal. */
function usCloseDetailsModal() {
  const modal = document.getElementById('usDetailsModal');
  if (modal) modal.classList.remove('open');
}
window.usCloseDetailsModal = usCloseDetailsModal;

/**
 * Build the 2-column detail grid HTML showing all 18 user fields.
 * @param {Object} u
 * @returns {string}
 */
function _usRenderDetailsGrid(u) {
  const field = (labelKey, val) => {
    const label = window.t(labelKey) || labelKey;
    const display = (val === null || val === undefined || val === '') ? '—' : String(val);
    const isMuted = (display === '—');
    return `<div class="us-detail-field">
      <div class="us-detail-label">${_usEsc(label)}</div>
      <div class="us-detail-value${isMuted ? ' us-detail-value--muted' : ''}">${_usEsc(display)}</div>
    </div>`;
  };

  const boolField = (labelKey, val) => {
    const label = window.t(labelKey) || labelKey;
    return `<div class="us-detail-field">
      <div class="us-detail-label">${_usEsc(label)}</div>
      <div class="us-detail-value">${val ? _usBoolIcon(true) : _usBoolIcon(false)}</div>
    </div>`;
  };

  return `<div class="us-detail-grid">
    ${field('users.fieldId',                 u.id)}
    ${field('users.fieldEmail',              u.email)}
    ${boolField('users.fieldEnabled',        u.enabled)}
    ${boolField('users.fieldLocked',         u.locked)}
    ${boolField('users.fieldEmailVerified',  u.email_verified)}
    ${field('users.fieldLastLogin',          _usFmtDate(u.last_login))}
    ${field('users.fieldLastAttempt',        _usFmtDate(u.last_attempt))}
    ${field('users.fieldFailedAttempts',     u.failed_attempts ?? 0)}
    ${field('users.fieldResetToken',         u.reset_token)}
    ${field('users.fieldResetTokenExpires',  _usFmtDate(u.reset_token_expires))}
    ${field('users.fieldVerifyToken',        u.verify_token)}
    ${field('users.fieldVerifyTokenExpires', _usFmtDate(u.verify_token_expires))}
    ${field('users.fieldRefreshToken',       u.refresh_token)}
    ${field('users.fieldRefreshTokenExpires',_usFmtDate(u.refresh_token_expires))}
    ${field('users.fieldCreatedById',        u.created_by_id)}
    ${field('users.fieldCreatedAt',          _usFmtDate(u.created_at))}
    ${field('users.fieldUpdatedById',        u.updated_by_id)}
    ${field('users.fieldUpdatedAt',          _usFmtDate(u.updated_at))}
  </div>`;
}

// ═══════════════════════ EDIT EMAIL MODAL ═══════════════════════

/**
 * Open the Edit Email modal, pre-filling the current email.
 * @param {number} id
 * @param {string} currentEmail
 */
function usOpenEditEmail(id, currentEmail) {
  _usEditId = id;
  const emailEl = document.getElementById('usEditEmailInput');
  const passEl  = document.getElementById('usEditEmailPassword');
  const msgEl   = document.getElementById('usEditEmailMsg');
  if (emailEl) emailEl.value = currentEmail || '';
  if (passEl)  passEl.value  = '';
  if (msgEl)   { msgEl.className = 'us-msg'; msgEl.textContent = ''; }
  const modal = document.getElementById('usEditEmailModal');
  if (modal) modal.classList.add('open');
}
window.usOpenEditEmail = usOpenEditEmail;

/** Close the Edit Email modal. */
function usCloseEditEmailModal() {
  const modal = document.getElementById('usEditEmailModal');
  if (modal) modal.classList.remove('open');
  _usEditId = null;
}
window.usCloseEditEmailModal = usCloseEditEmailModal;

/**
 * Read email + password fields, call API, update local state, re-render.
 */
async function usSaveEditEmail() {
  const emailEl = document.getElementById('usEditEmailInput');
  const passEl  = document.getElementById('usEditEmailPassword');
  const msgEl   = document.getElementById('usEditEmailMsg');
  const setMsg  = (type, text) => {
    if (!msgEl) return;
    msgEl.className = 'us-msg' + (type ? ' us-msg--' + type : '');
    msgEl.textContent = text;
  };

  const email    = (emailEl?.value || '').trim();
  const password = (passEl?.value  || '').trim();

  if (!email) {
    setMsg('error', window.t('users.errEnterEmail') || 'Please enter an email address.');
    return;
  }
  if (!password) {
    setMsg('error', window.t('users.errEnterPassword') || 'Please enter your password.');
    return;
  }

  try {
    const result = await apiUpdateUserEmail(_usEditId, email, password);
    // Update local cache
    const idx = usUsers.findIndex(u => Number(u.id) === Number(_usEditId));
    if (idx !== -1) usUsers[idx].email = result.email || email;
    renderUsersTable();
    setMsg('success', window.t('users.successEmailUpdated') || 'Email updated successfully.');
    setTimeout(usCloseEditEmailModal, 1200);
  } catch (e) {
    setMsg('error', window.t('users.errUpdateFailed') || 'Failed to update email.');
  }
}
window.usSaveEditEmail = usSaveEditEmail;

// ═══════════════════════ TOGGLE ENABLED ═══════════════════════

/**
 * Toggle enabled status of a user; revert and show error on failure.
 * @param {number} id
 * @param {boolean} enabled
 */
async function usToggleEnabled(id, enabled) {
  const prevUser = usUsers.find(u => Number(u.id) === Number(id));
  const prevState = prevUser ? prevUser.enabled : !enabled;
  try {
    await apiToggleUserEnabled(id, enabled);
    const idx = usUsers.findIndex(u => Number(u.id) === Number(id));
    if (idx !== -1) usUsers[idx].enabled = enabled;
    renderUsersStats();
  } catch (e) {
    // Revert
    const idx = usUsers.findIndex(u => Number(u.id) === Number(id));
    if (idx !== -1) usUsers[idx].enabled = prevState;
    renderUsersTable();
    _usMsg('error', window.t('users.errUpdateFailed') || 'Failed to update user.');
    setTimeout(() => _usMsg(null, ''), 3000);
  }
}
window.usToggleEnabled = usToggleEnabled;

// ═══════════════════════ DEVICES MODAL ═══════════════════════

/**
 * Open the Devices modal, set the title and fetch devices for the given user.
 * @param {number} userId
 * @param {string} email
 */
async function usOpenDevices(userId, email) {
  _usDevicesUserId = userId;
  _usDeviceMsg(null, '');

  const titleEl = document.getElementById('usDevicesTitle');
  if (titleEl) titleEl.textContent = email || String(userId);

  const modal = document.getElementById('usDevicesModal');
  if (modal) modal.classList.add('open');

  const tbody = document.getElementById('usDevicesTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="us-devices-empty">${window.t('users.loading') || 'Loading…'}</td></tr>`;
  }

  // Clear add-device form
  const typeEl   = document.getElementById('usDeviceType');
  const serialEl = document.getElementById('usDeviceSerial');
  if (typeEl)   typeEl.value   = '';
  if (serialEl) serialEl.value = '';

  try {
    const devices = await fetchUserDevices(userId);
    _usRenderDevicesTable(devices);
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="us-devices-empty">${window.t('users.errLoadFailed') || 'Failed to load devices.'}</td></tr>`;
    }
  }
}
window.usOpenDevices = usOpenDevices;

/** Close the Devices modal. */
function usCloseDevicesModal() {
  const modal = document.getElementById('usDevicesModal');
  if (modal) modal.classList.remove('open');
  _usDevicesUserId = null;
}
window.usCloseDevicesModal = usCloseDevicesModal;

/**
 * Render the devices table body.
 * @param {Array} devices
 */
function _usRenderDevicesTable(devices) {
  const tbody = document.getElementById('usDevicesTableBody');
  if (!tbody) return;

  if (!Array.isArray(devices) || devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="us-devices-empty">${window.t('users.devicesEmpty') || 'No devices found.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = devices.map(d => `<tr>
    <td>${_usEsc(d.id)}</td>
    <td>${_usEsc(d.device_type || '—')}</td>
    <td>${_usEsc(d.serial_number || '—')}</td>
    <td>${_usEsc(d.ip || '—')}</td>
    <td>${_usBoolIcon(d.enabled)}</td>
  </tr>`).join('');
}

/**
 * Add a new device to the current user; re-fetch and re-render the table.
 */
async function usAddDevice() {
  const typeEl   = document.getElementById('usDeviceType');
  const serialEl = document.getElementById('usDeviceSerial');
  const typeVal   = (typeEl?.value   || '').trim();
  const serialVal = (serialEl?.value || '').trim();

  if (!typeVal) {
    _usDeviceMsg('error', window.t('users.errEnterDeviceType') || 'Please enter a device type.');
    return;
  }
  if (!serialVal) {
    _usDeviceMsg('error', window.t('users.errEnterSerial') || 'Please enter a serial number.');
    return;
  }

  try {
    await apiCreateDevice(typeVal, serialVal);
    if (typeEl)   typeEl.value   = '';
    if (serialEl) serialEl.value = '';
    _usDeviceMsg('success', window.t('users.successDeviceAdded') || 'Device added successfully.');
    setTimeout(() => _usDeviceMsg(null, ''), 2000);
    // Re-fetch devices
    const devices = await fetchUserDevices(_usDevicesUserId);
    _usRenderDevicesTable(devices);
  } catch (e) {
    _usDeviceMsg('error', window.t('users.errDeviceFailed') || 'Failed to add device.');
  }
}
window.usAddDevice = usAddDevice;
