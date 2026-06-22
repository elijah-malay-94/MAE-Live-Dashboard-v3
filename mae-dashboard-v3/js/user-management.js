// ╔══════════════════════════════════════════════════════════════╗
// ║  user-management.js — Authorization Management Page         ║
// ║                                                              ║
// ║  Implements all user-facing functions described in the       ║
// ║  User Management specification:                              ║
// ║                                                              ║
// ║  1) Create a User Authorization                              ║
// ║     work + profile (dropdown) + email + start/end dates      ║
// ║                                                              ║
// ║  2) Create a Token Authorization                             ║
// ║     work + tokenName (text) + start/end dates                ║
// ║                                                              ║
// ║  3) View the list of created Authorizations                  ║
// ║     filterable by type / status / keyword, paginated         ║
// ║                                                              ║
// ║  4) Edit User Authorization                                  ║
// ║     change Enabled status and start/end dates                ║
// ║                                                              ║
// ║  5) Edit Token Authorization                                 ║
// ║     change TokenName, Enabled status and start/end dates     ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • initUserManagement()      loads data, renders page        ║
// ║  • umSwitchTab(tab)          switches create / manage tabs   ║
// ║  • renderUmStats()           updates 4 stat cards            ║
// ║  • umPopulateJobDropdowns()  fills Work selects from works   ║
// ║  • umCreateUserAuth()        validates + creates user auth   ║
// ║  • umCreateTokenAuth()       validates + creates token auth  ║
// ║  • renderUmList()            filtered + paginated table      ║
// ║  • umGoPage(n)               pagination navigation           ║
// ║  • umSetFilterType(v)        filter by user / token          ║
// ║  • umSetFilterStatus(v)      filter by enabled / disabled    ║
// ║  • umSetFilterSearch(v)      keyword search across fields    ║
// ║  • umOpenEdit(id)            opens edit modal pre-filled     ║
// ║  • umCloseEdit()             closes edit modal               ║
// ║  • umSaveEdit()              saves changes, refreshes list   ║
// ║  • umDeleteAuth(id)          confirm + delete authorization  ║
// ║  • umToggleEnabled(id, v)    inline enabled toggle in table  ║
// ║                                                              ║
// ║  Dependencies: api.js (fetchAuthorizations, createAuthorization,
// ║                updateAuthorization, deleteAuthorization)     ║
// ║                state.js (getUserId, getUserName)             ║
// ║  Load order:   before modals.js                              ║
// ╚══════════════════════════════════════════════════════════════╝

// ── Module state ──────────────────────────────────────────────────────────────

let umAuthorizations  = [];          // full list loaded from API / mock
const umProfiles      = ['Viewer', 'Operator', 'Read-Only', 'Administrator'];
let umCurrentPage     = 1;
const UM_PAGE_SIZE    = 6;           // rows shown per page in the list table
let umEditingId       = null;        // id of the record currently open in edit modal
let umFilterType      = '';          // '' | 'user' | 'token'
let umFilterStatus    = '';          // '' | 'enabled' | 'disabled'
let umFilterSearch    = '';          // keyword applied across job / user / token / profile

// ── Init ──────────────────────────────────────────────────────────────────────

async function initUserManagement() {
  console.log('%c[UserManagement] init', 'color:#38bdf8;font-weight:700');

  // Populate Work dropdowns from allWorks (loaded by state.js before this runs)
  umPopulateJobDropdowns();

  // Fetch authorizations for the current logged-in user
  const userId = (typeof getUserId === 'function') ? getUserId() : '';
  umAuthorizations = await fetchAuthorizations(userId);
  if (!Array.isArray(umAuthorizations)) umAuthorizations = [];

  renderUmStats();
  renderUmList();

  // Footer date — matches locale of the rest of the dashboard
  const footerEl = document.getElementById('umFooterDate');
  if (footerEl) {
    const lang = (window.MAE_I18N?.getLanguage && typeof window.MAE_I18N.getLanguage === 'function')
      ? window.MAE_I18N.getLanguage()
      : 'en';
    footerEl.textContent = new Date().toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB');
  }
}

// ── Work dropdowns ────────────────────────────────────────────────────────────

// Fills both "Work" <select> elements (User Auth form + Token Auth form)
// from the global allWorks array populated by state.js / works.js.
function umPopulateJobDropdowns() {
  const selectors = [
    document.getElementById('umUserAuthJob'),
    document.getElementById('umTokenAuthJob'),
  ];
  const works = (typeof allWorks !== 'undefined' && Array.isArray(allWorks)) ? allWorks : [];

  selectors.forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${window.t ? window.t('um.selectWork') : '— Select Work —'}</option>` +
      works.map(w => `<option value="${_umEsc(String(w.id))}">${_umEsc(String(w.description || w.id))}</option>`).join('');
    // Preserve previously selected value if the dropdown is rebuilt
    if (current) sel.value = current;
  });
}

// ── Tab switching ─────────────────────────────────────────────────────────────

// tab: 'create' | 'manage'
// Toggles .active on both the tab button and its corresponding panel.
function umSwitchTab(tab) {
  document.querySelectorAll('.um-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.um-tab-panel').forEach(el => {
    el.classList.toggle('active', el.dataset.tabPanel === tab);
  });
}

// ── Stat cards ────────────────────────────────────────────────────────────────

// Recomputes the 4 headline numbers from the in-memory array and updates the DOM.
// Called after every create / delete / toggle operation.
function renderUmStats() {
  const total    = umAuthorizations.length;
  const users    = umAuthorizations.filter(a => a.type === 'user').length;
  const tokens   = umAuthorizations.filter(a => a.type === 'token').length;
  const enabled  = umAuthorizations.filter(a => a.enabled).length;
  const disabled = total - enabled;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const tr  = (key, vars) => (window.tf ? window.tf(key, vars) : key);

  set('umStatTotal',      total);
  set('umStatTotalSub',   tr('um.statTotalSub',   { total }));
  set('umStatUsers',      users);
  set('umStatUsersSub',   tr('um.statUsersSub',   { users }));
  set('umStatTokens',     tokens);
  set('umStatTokensSub',  tr('um.statTokensSub',  { tokens }));
  set('umStatEnabled',    enabled);
  set('umStatEnabledSub', tr('um.statEnabledSub', { enabled, disabled }));
}

// ── Create User Authorization (requirement 1) ─────────────────────────────────

// Validates the "New User Authorization" form, calls createAuthorization(),
// appends the result to the local array, and switches to the Manage tab.
async function umCreateUserAuth() {
  const jobEl     = document.getElementById('umUserAuthJob');
  const profileEl = document.getElementById('umUserAuthProfile');
  const emailEl   = document.getElementById('umUserAuthEmail');
  const startEl   = document.getElementById('umUserAuthStart');
  const endEl     = document.getElementById('umUserAuthEnd');

  const job     = jobEl?.value?.trim()     || '';
  const profile = profileEl?.value?.trim() || '';
  const email   = emailEl?.value?.trim()   || '';
  const start   = startEl?.value           || '';
  const end     = endEl?.value             || '';

  // All fields are required — validate before calling the API
  if (!job)     { _umMsg('error', window.t ? window.t('um.errSelectWork')    : 'Please select a work.');    return; }
  if (!profile) { _umMsg('error', window.t ? window.t('um.errSelectProfile') : 'Please select a profile.'); return; }
  if (!email)   { _umMsg('error', window.t ? window.t('um.errEnterEmail')    : 'Please enter a user email.'); return; }
  if (!start)   { _umMsg('error', window.t ? window.t('um.errSelectStart')   : 'Please select a start date.'); return; }
  if (!end)     { _umMsg('error', window.t ? window.t('um.errSelectEnd')     : 'Please select an end date.'); return; }
  if (start > end) { _umMsg('error', window.t ? window.t('um.errEndAfterStart') : 'End date must be after start date.'); return; }

  // Resolve the human-readable work description from the selected id
  const works = (typeof allWorks !== 'undefined' && Array.isArray(allWorks)) ? allWorks : [];
  const work  = works.find(w => String(w.id) === job);

  const payload = {
    type:    'user',
    job:     work ? String(work.description || work.id) : job,
    jobId:   job,
    user:    email,
    profile: profile,
    start:   start,
    end:     end,
    enabled: true,   // new authorizations are enabled by default
  };

  try {
    const result = await createAuthorization(payload);
    // Merge returned id with local payload to keep the array in sync
    const newEntry = { id: result.id ?? Date.now(), ...payload };
    umAuthorizations.push(newEntry);

    // Reset form fields
    if (jobEl)     jobEl.value     = '';
    if (profileEl) profileEl.value = '';
    if (emailEl)   emailEl.value   = '';
    if (startEl)   startEl.value   = '';
    if (endEl)     endEl.value     = '';

    renderUmStats();
    renderUmList();
    _umMsg('success', window.t ? window.t('um.successCreatedUser') : 'User authorization created successfully.');
    umSwitchTab('manage');   // take the user straight to the list
  } catch (e) {
    _umMsg('error', window.tf ? window.tf('um.errCreateFailed', { msg: e?.message || e }) : `Failed to create authorization: ${e?.message || e}`);
  }
}

// ── Create Token Authorization (requirement 2) ────────────────────────────────

// Validates the "New Token Authorization" form, calls createAuthorization(),
// appends the result to the local array, and switches to the Manage tab.
async function umCreateTokenAuth() {
  const jobEl   = document.getElementById('umTokenAuthJob');
  const nameEl  = document.getElementById('umTokenAuthName');
  const startEl = document.getElementById('umTokenAuthStart');
  const endEl   = document.getElementById('umTokenAuthEnd');

  const job   = jobEl?.value?.trim()   || '';
  const name  = nameEl?.value?.trim()  || '';
  const start = startEl?.value         || '';
  const end   = endEl?.value           || '';

  if (!job)   { _umMsg('error', window.t ? window.t('um.errSelectWork')    : 'Please select a work.');    return; }
  if (!name)  { _umMsg('error', window.t ? window.t('um.errEnterToken')    : 'Please enter a token name.'); return; }
  if (!start) { _umMsg('error', window.t ? window.t('um.errSelectStart')   : 'Please select a start date.'); return; }
  if (!end)   { _umMsg('error', window.t ? window.t('um.errSelectEnd')     : 'Please select an end date.'); return; }
  if (start > end) { _umMsg('error', window.t ? window.t('um.errEndAfterStart') : 'End date must be after start date.'); return; }

  const works = (typeof allWorks !== 'undefined' && Array.isArray(allWorks)) ? allWorks : [];
  const work  = works.find(w => String(w.id) === job);

  const payload = {
    type:    'token',
    job:     work ? String(work.description || work.id) : job,
    jobId:   job,
    token:   name,
    profile: null,   // token authorizations have no profile
    start:   start,
    end:     end,
    enabled: true,
  };

  try {
    const result = await createAuthorization(payload);
    const newEntry = { id: result.id ?? Date.now(), ...payload };
    umAuthorizations.push(newEntry);

    if (jobEl)   jobEl.value   = '';
    if (nameEl)  nameEl.value  = '';
    if (startEl) startEl.value = '';
    if (endEl)   endEl.value   = '';

    renderUmStats();
    renderUmList();
    _umMsg('success', window.t ? window.t('um.successCreatedToken') : 'Token authorization created successfully.');
    umSwitchTab('manage');
  } catch (e) {
    _umMsg('error', window.tf ? window.tf('um.errCreateFailed', { msg: e?.message || e }) : `Failed to create authorization: ${e?.message || e}`);
  }
}

// ── Authorization list (requirement 3) ───────────────────────────────────────

// Applies active filters, paginates, and re-renders the table body + pagination bar.
// Called after every data change or filter change.
function renderUmList() {
  const filtered   = _umFiltered();
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / UM_PAGE_SIZE));

  // Clamp current page after deletions that shrink the total
  if (umCurrentPage > totalPages) umCurrentPage = totalPages;

  const start = (umCurrentPage - 1) * UM_PAGE_SIZE;
  const page  = filtered.slice(start, start + UM_PAGE_SIZE);

  const tbody = document.getElementById('umTableBody');
  if (!tbody) return;

  tbody.innerHTML = page.length === 0
    ? `<tr><td colspan="8" class="um-empty">${window.t ? window.t('um.empty') : 'No authorizations found.'}</td></tr>`
    : page.map(a => _umRenderRow(a)).join('');

  // Pagination info
  const infoEl = document.getElementById('umPaginationInfo');
  if (infoEl) infoEl.textContent = window.tf
    ? window.tf('um.paginationInfo', { count: page.length, total })
    : `${page.length} records shown · ${total} total`;

  // Pagination buttons
  const pagesEl = document.getElementById('umPaginationPages');
  if (pagesEl) {
    let html = `<button class="um-page-btn" onclick="umGoPage(${umCurrentPage - 1})" ${umCurrentPage <= 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="um-page-btn ${i === umCurrentPage ? 'active' : ''}" onclick="umGoPage(${i})">${i}</button>`;
    }
    html += `<button class="um-page-btn" onclick="umGoPage(${umCurrentPage + 1})" ${umCurrentPage >= totalPages ? 'disabled' : ''}>›</button>`;
    pagesEl.innerHTML = html;
  }
}

// Navigate to a specific page number (clamped to valid range).
function umGoPage(n) {
  const totalPages = Math.max(1, Math.ceil(_umFiltered().length / UM_PAGE_SIZE));
  umCurrentPage = Math.max(1, Math.min(n, totalPages));
  renderUmList();
}

// ── Filters ───────────────────────────────────────────────────────────────────

// Returns the subset of umAuthorizations that passes all active filters.
function _umFiltered() {
  return umAuthorizations.filter(a => {
    if (umFilterType   && a.type !== umFilterType)              return false;
    if (umFilterStatus === 'enabled'  && !a.enabled)            return false;
    if (umFilterStatus === 'disabled' &&  a.enabled)            return false;
    if (umFilterSearch) {
      const q   = umFilterSearch.toLowerCase();
      const hay = [a.job, a.user, a.token, a.profile].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// Each filter setter resets to page 1 so the user sees results immediately.
function umSetFilterType(v)   { umFilterType   = v; umCurrentPage = 1; renderUmList(); }
function umSetFilterStatus(v) { umFilterStatus = v; umCurrentPage = 1; renderUmList(); }
function umSetFilterSearch(v) { umFilterSearch = v; umCurrentPage = 1; renderUmList(); }

// ── Table row rendering ───────────────────────────────────────────────────────

// Builds a single <tr> for the authorization list table.
// The type badge and user/token column adapt to a.type automatically.
function _umRenderRow(a) {
  const typeBadge = a.type === 'user'
    ? `<span class="um-type-badge um-type-badge--user"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> User</span>`
    : `<span class="um-type-badge um-type-badge--token"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Token</span>`;

  const jobBadge  = `<span class="um-job-badge">${_umEsc(a.job || '—')}</span>`;
  const userToken = a.type === 'user' ? _umEsc(a.user || '—') : _umEsc(a.token || '—');
  const profile   = a.type === 'user' ? _umEsc(a.profile || '—') : '<span style="color:var(--muted)">—</span>';
  const start     = _umEsc(a.start || '—');
  const end       = _umEsc(a.end   || '—');

  // Inline toggle — calls umToggleEnabled on change without a page reload
  const toggleId = `umToggle_${a.id}`;
  const toggle   = `
    <label class="um-toggle" title="${a.enabled ? 'Enabled' : 'Disabled'}">
      <input type="checkbox" id="${toggleId}" ${a.enabled ? 'checked' : ''} onchange="umToggleEnabled(${a.id}, this.checked)"/>
      <span class="um-toggle-track"></span>
      <span class="um-toggle-thumb"></span>
    </label>`;

  const actions = `
    <div class="um-actions">
      <button class="um-btn-icon" onclick="umOpenEdit(${a.id})" title="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="um-btn-icon um-btn-icon--danger" onclick="umDeleteAuth(${a.id})" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`;

  return `<tr>
    <td>${typeBadge}</td>
    <td>${jobBadge}</td>
    <td style="color:var(--text)">${userToken}</td>
    <td>${profile}</td>
    <td>${start}</td>
    <td>${end}</td>
    <td>${toggle}</td>
    <td>${actions}</td>
  </tr>`;
}

// ── Inline enabled toggle ──────────────────────────────────────────────────────

// Optimistically updates the local record, then calls the API.
// Reverts and re-renders if the API call fails.
async function umToggleEnabled(id, val) {
  const auth = umAuthorizations.find(a => a.id === id);
  if (!auth) return;
  const prev = auth.enabled;
  auth.enabled = Boolean(val);
  renderUmStats();
  try {
    await updateAuthorization(id, { enabled: Boolean(val) });
  } catch (e) {
    auth.enabled = prev;  // revert optimistic update on failure
    renderUmStats();
    renderUmList();
    _umMsg('error', window.tf ? window.tf('um.errUpdateFailed', { msg: e?.message || e }) : `Failed to update: ${e?.message || e}`);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function umDeleteAuth(id) {
  const auth = umAuthorizations.find(a => a.id === id);
  if (!auth) return;
  const label = auth.type === 'user' ? auth.user : auth.token;
  const confirmMsg = window.tf
    ? window.tf('um.confirmDelete', { label })
    : `Delete authorization for "${label}"? This cannot be undone.`;
  if (!confirm(confirmMsg)) return;
  try {
    await deleteAuthorization(id);
    umAuthorizations = umAuthorizations.filter(a => a.id !== id);
    renderUmStats();
    renderUmList();
    _umMsg('success', window.t ? window.t('um.successDeleted') : 'Authorization deleted.');
  } catch (e) {
    _umMsg('error', window.tf ? window.tf('um.errDeleteFailed', { msg: e?.message || e }) : `Failed to delete: ${e?.message || e}`);
  }
}

// ── Edit modal (requirements 4 & 5) ──────────────────────────────────────────

// Opens the edit modal pre-filled for the given authorization id.
// Shows the User panel for type='user', the Token panel for type='token'.
function umOpenEdit(id) {
  const auth = umAuthorizations.find(a => a.id === id);
  if (!auth) return;
  umEditingId = id;

  const overlay = document.getElementById('umEditOverlay');
  if (!overlay) return;

  if (auth.type === 'user') {
    // Requirement 4: edit Enabled + start date + end date
    document.getElementById('umEditUserPanel').style.display  = 'block';
    document.getElementById('umEditTokenPanel').style.display = 'none';
    document.getElementById('umEditTitle').textContent        = window.t ? window.t('um.editTitleUser') : 'Edit Authorization — User';
    document.getElementById('umEditInfo').innerHTML =
      (window.tf ? window.tf('um.editInfo', { label: '', work: '' }) : 'Editing: {label} · Work: {work}')
        .replace('{label}', `<strong>${_umEsc(auth.user || '—')}</strong>`)
        .replace('{work}',  `<strong>${_umEsc(auth.job  || '—')}</strong>`);
    document.getElementById('umEditEnabled').checked          = Boolean(auth.enabled);
    document.getElementById('umEditStart').value              = auth.start || '';
    document.getElementById('umEditEnd').value                = auth.end   || '';

  } else {
    // Requirement 5: edit TokenName + Enabled + start date + end date
    document.getElementById('umEditUserPanel').style.display  = 'none';
    document.getElementById('umEditTokenPanel').style.display = 'block';
    document.getElementById('umEditTitle').textContent        = window.t ? window.t('um.editTitleToken') : 'Edit Authorization — Token';
    document.getElementById('umEditInfo').innerHTML =
      (window.tf ? window.tf('um.editInfo', { label: '', work: '' }) : 'Editing: {label} · Work: {work}')
        .replace('{label}', `<strong>${_umEsc(auth.token || '—')}</strong>`)
        .replace('{work}',  `<strong>${_umEsc(auth.job   || '—')}</strong>`);
    document.getElementById('umEditTokenName').value          = auth.token || '';
    document.getElementById('umEditTokenEnabled').checked     = Boolean(auth.enabled);
    document.getElementById('umEditTokenStart').value         = auth.start || '';
    document.getElementById('umEditTokenEnd').value           = auth.end   || '';
  }

  overlay.classList.add('open');
}

function umCloseEdit() {
  umEditingId = null;
  const overlay = document.getElementById('umEditOverlay');
  if (overlay) overlay.classList.remove('open');
}

// Reads the active panel's fields, validates, calls updateAuthorization(),
// then merges the changes into the local record.
async function umSaveEdit() {
  if (!umEditingId) return;
  const auth = umAuthorizations.find(a => a.id === umEditingId);
  if (!auth) return;

  let payload = {};

  if (auth.type === 'user') {
    const enabled = document.getElementById('umEditEnabled')?.checked ?? auth.enabled;
    const start   = document.getElementById('umEditStart')?.value   || auth.start;
    const end     = document.getElementById('umEditEnd')?.value     || auth.end;
    if (start > end) { _umMsg('error', window.t ? window.t('um.errEndAfterStart') : 'End date must be after start date.'); return; }
    payload = { enabled, start, end };

  } else {
    const tokenName = document.getElementById('umEditTokenName')?.value?.trim() || auth.token;
    const enabled   = document.getElementById('umEditTokenEnabled')?.checked ?? auth.enabled;
    const start     = document.getElementById('umEditTokenStart')?.value || auth.start;
    const end       = document.getElementById('umEditTokenEnd')?.value   || auth.end;
    if (!tokenName) { _umMsg('error', window.t ? window.t('um.errTokenEmpty') : 'Token name cannot be empty.'); return; }
    if (start > end) { _umMsg('error', window.t ? window.t('um.errEndAfterStart') : 'End date must be after start date.'); return; }
    payload = { token: tokenName, enabled, start, end };
  }

  try {
    await updateAuthorization(umEditingId, payload);
    Object.assign(auth, payload);  // update local record without a re-fetch
    umCloseEdit();
    renderUmStats();
    renderUmList();
    _umMsg('success', window.t ? window.t('um.successUpdated') : 'Authorization updated successfully.');
  } catch (e) {
    _umMsg('error', window.tf ? window.tf('um.errSaveFailed', { msg: e?.message || e }) : `Failed to save: ${e?.message || e}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// HTML-escapes a value before injecting it into innerHTML.
function _umEsc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Displays a temporary success / error message in the page's hint slot.
// Auto-hides after 4 seconds.
function _umMsg(type, msg) {
  const hint = document.getElementById('apiHintUserMgmt');
  if (!hint) return;
  hint.style.display     = 'block';
  hint.style.background  = type === 'error'   ? 'rgba(239,68,68,0.08)'  :
                            type === 'success' ? 'rgba(16,185,129,0.08)' : '';
  hint.style.borderColor = type === 'error'   ? 'rgba(239,68,68,0.25)'  :
                            type === 'success' ? 'rgba(16,185,129,0.25)' : 'var(--border)';
  hint.innerHTML = `<strong>${type === 'error' ? '⚠️' : '✓'} ${_umEsc(msg)}</strong>`;
  setTimeout(() => { if (hint) { hint.style.display = 'none'; hint.innerHTML = ''; } }, 4000);
}
