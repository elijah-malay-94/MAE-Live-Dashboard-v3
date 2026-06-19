// ╔══════════════════════════════════════════════════════════════╗
// ║  user-management.js — User Management Page                  ║
// ║                                                              ║
// ║  Contains:                                                   ║
// ║  • initUserManagement()   loads data, renders page           ║
// ║  • umSwitchTab(tab)       switches between create/manage     ║
// ║  • renderUmStats()        updates 4 stat cards               ║
// ║  • umCreateUserAuth()     validates + creates user auth      ║
// ║  • umCreateTokenAuth()    validates + creates token auth     ║
// ║  • renderUmList()         renders filtered + paginated table ║
// ║  • umOpenEdit(id)         opens edit modal pre-filled        ║
// ║  • umCloseEdit()          closes edit modal                  ║
// ║  • umSaveEdit()           saves changes, refreshes           ║
// ║  • umDeleteAuth(id)       confirm + delete                   ║
// ║  • umToggleEnabled(id, v) inline toggle in table             ║
// ║                                                              ║
// ║  Dependencies: api.js, state.js                              ║
// ╚══════════════════════════════════════════════════════════════╝

// ═══════════════════════ STATE ═══════════════════════
let umAuthorizations  = [];
const umProfiles      = ['Viewer', 'Operator', 'Read-Only', 'Administrator'];
let umCurrentPage     = 1;
const UM_PAGE_SIZE    = 6;
let umEditingId       = null;
let umFilterType      = '';   // '' | 'user' | 'token'
let umFilterStatus    = '';   // '' | 'enabled' | 'disabled'
let umFilterSearch    = '';

// ═══════════════════════ INIT ═══════════════════════
async function initUserManagement() {
  console.log('%c[UserManagement] init', 'color:#38bdf8;font-weight:700');

  // Populate job dropdowns from allWorks if available
  umPopulateJobDropdowns();

  // Load authorizations
  const userId = (typeof getUserId === 'function') ? getUserId() : '';
  umAuthorizations = await fetchAuthorizations(userId);
  if (!Array.isArray(umAuthorizations)) umAuthorizations = [];

  renderUmStats();
  renderUmList();

  // Set footer date
  const footerEl = document.getElementById('umFooterDate');
  if (footerEl) {
    const lang = (window.MAE_I18N?.getLanguage && typeof window.MAE_I18N.getLanguage === 'function')
      ? window.MAE_I18N.getLanguage()
      : 'en';
    const locale = (lang === 'it') ? 'it-IT' : 'en-GB';
    footerEl.textContent = new Date().toLocaleDateString(locale);
  }
}

// ═══════════════════════ JOB DROPDOWNS ═══════════════════════
function umPopulateJobDropdowns() {
  const selectors = [
    document.getElementById('umUserAuthJob'),
    document.getElementById('umTokenAuthJob'),
  ];
  const works = (typeof allWorks !== 'undefined' && Array.isArray(allWorks)) ? allWorks : [];

  selectors.forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select Job —</option>' +
      works.map(w => `<option value="${_umEsc(String(w.id))}">${_umEsc(String(w.description || w.id))}</option>`).join('');
    if (current) sel.value = current;
  });
}

// ═══════════════════════ TAB SWITCH ═══════════════════════
function umSwitchTab(tab) {
  // tab: 'create' | 'manage'
  document.querySelectorAll('.um-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.um-tab-panel').forEach(el => {
    el.classList.toggle('active', el.dataset.tabPanel === tab);
  });
}

// ═══════════════════════ STATS ═══════════════════════
function renderUmStats() {
  const total   = umAuthorizations.length;
  const users   = umAuthorizations.filter(a => a.type === 'user').length;
  const tokens  = umAuthorizations.filter(a => a.type === 'token').length;
  const enabled = umAuthorizations.filter(a => a.enabled).length;
  const disabled = total - enabled;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set('umStatTotal',        total);
  set('umStatTotalSub',     `${total} created by this account`);
  set('umStatUsers',        users);
  set('umStatUsersSub',     `${users} users linked to profiles`);
  set('umStatTokens',       tokens);
  set('umStatTokensSub',    `${tokens} tokens API access keys`);
  set('umStatEnabled',      enabled);
  set('umStatEnabledSub',   `${enabled} active / ${disabled} disabled`);
}

// ═══════════════════════ CREATE USER AUTH ═══════════════════════
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

  if (!job)     { _umMsg('error', 'Please select a job.'); return; }
  if (!profile) { _umMsg('error', 'Please select a profile.'); return; }
  if (!email)   { _umMsg('error', 'Please enter a user email.'); return; }
  if (!start)   { _umMsg('error', 'Please select a start date.'); return; }
  if (!end)     { _umMsg('error', 'Please select an end date.'); return; }
  if (start > end) { _umMsg('error', 'End date must be after start date.'); return; }

  // Find job description from allWorks
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
    enabled: true,
  };

  try {
    const result = await createAuthorization(payload);
    const newEntry = { id: result.id ?? Date.now(), ...payload };
    umAuthorizations.push(newEntry);

    // Reset form
    if (jobEl)     jobEl.value     = '';
    if (profileEl) profileEl.value = '';
    if (emailEl)   emailEl.value   = '';
    if (startEl)   startEl.value   = '';
    if (endEl)     endEl.value     = '';

    renderUmStats();
    renderUmList();
    _umMsg('success', 'User authorization created successfully.');
    umSwitchTab('manage');
  } catch (e) {
    _umMsg('error', `Failed to create authorization: ${e?.message || e}`);
  }
}

// ═══════════════════════ CREATE TOKEN AUTH ═══════════════════════
async function umCreateTokenAuth() {
  const jobEl   = document.getElementById('umTokenAuthJob');
  const nameEl  = document.getElementById('umTokenAuthName');
  const startEl = document.getElementById('umTokenAuthStart');
  const endEl   = document.getElementById('umTokenAuthEnd');

  const job   = jobEl?.value?.trim()   || '';
  const name  = nameEl?.value?.trim()  || '';
  const start = startEl?.value         || '';
  const end   = endEl?.value           || '';

  if (!job)   { _umMsg('error', 'Please select a job.'); return; }
  if (!name)  { _umMsg('error', 'Please enter a token name.'); return; }
  if (!start) { _umMsg('error', 'Please select a start date.'); return; }
  if (!end)   { _umMsg('error', 'Please select an end date.'); return; }
  if (start > end) { _umMsg('error', 'End date must be after start date.'); return; }

  const works = (typeof allWorks !== 'undefined' && Array.isArray(allWorks)) ? allWorks : [];
  const work  = works.find(w => String(w.id) === job);

  const payload = {
    type:    'token',
    job:     work ? String(work.description || work.id) : job,
    jobId:   job,
    token:   name,
    profile: null,
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
    _umMsg('success', 'Token authorization created successfully.');
    umSwitchTab('manage');
  } catch (e) {
    _umMsg('error', `Failed to create authorization: ${e?.message || e}`);
  }
}

// ═══════════════════════ RENDER LIST ═══════════════════════
function renderUmList() {
  // Apply filters
  let filtered = umAuthorizations.filter(a => {
    if (umFilterType   && a.type !== umFilterType) return false;
    if (umFilterStatus === 'enabled'  && !a.enabled)  return false;
    if (umFilterStatus === 'disabled' &&  a.enabled)  return false;
    if (umFilterSearch) {
      const q = umFilterSearch.toLowerCase();
      const hay = [a.job, a.user, a.token, a.profile].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const total     = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / UM_PAGE_SIZE));
  if (umCurrentPage > totalPages) umCurrentPage = totalPages;

  const start = (umCurrentPage - 1) * UM_PAGE_SIZE;
  const page  = filtered.slice(start, start + UM_PAGE_SIZE);

  const tbody = document.getElementById('umTableBody');
  if (!tbody) return;

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="um-empty">No authorizations found.</td></tr>`;
  } else {
    tbody.innerHTML = page.map(a => _umRenderRow(a)).join('');
  }

  // Pagination
  const infoEl = document.getElementById('umPaginationInfo');
  if (infoEl) {
    infoEl.textContent = `${page.length} records shown · ${total} total`;
  }

  const pagesEl = document.getElementById('umPaginationPages');
  if (pagesEl) {
    let html = `<button class="um-page-btn" onclick="umGoPage(${umCurrentPage-1})" ${umCurrentPage<=1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="um-page-btn ${i===umCurrentPage?'active':''}" onclick="umGoPage(${i})">${i}</button>`;
    }
    html += `<button class="um-page-btn" onclick="umGoPage(${umCurrentPage+1})" ${umCurrentPage>=totalPages?'disabled':''}>›</button>`;
    pagesEl.innerHTML = html;
  }
}

function umGoPage(n) {
  const filtered = _umFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / UM_PAGE_SIZE));
  umCurrentPage = Math.max(1, Math.min(n, totalPages));
  renderUmList();
}

function _umFiltered() {
  return umAuthorizations.filter(a => {
    if (umFilterType   && a.type !== umFilterType) return false;
    if (umFilterStatus === 'enabled'  && !a.enabled)  return false;
    if (umFilterStatus === 'disabled' &&  a.enabled)  return false;
    if (umFilterSearch) {
      const q = umFilterSearch.toLowerCase();
      const hay = [a.job, a.user, a.token, a.profile].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function _umRenderRow(a) {
  const typeBadge = a.type === 'user'
    ? `<span class="um-type-badge um-type-badge--user"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> User</span>`
    : `<span class="um-type-badge um-type-badge--token"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Token</span>`;

  const jobBadge = `<span class="um-job-badge">${_umEsc(a.job || '—')}</span>`;
  const userToken = a.type === 'user' ? _umEsc(a.user || '—') : _umEsc(a.token || '—');
  const profile   = a.type === 'user' ? _umEsc(a.profile || '—') : '<span style="color:var(--muted)">—</span>';
  const start     = _umEsc(a.start || '—');
  const end       = _umEsc(a.end   || '—');

  const toggleId  = `umToggle_${a.id}`;
  const toggle    = `
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

// ═══════════════════════ FILTERS ═══════════════════════
function umSetFilterType(v)   { umFilterType   = v; umCurrentPage = 1; renderUmList(); }
function umSetFilterStatus(v) { umFilterStatus = v; umCurrentPage = 1; renderUmList(); }
function umSetFilterSearch(v) { umFilterSearch = v; umCurrentPage = 1; renderUmList(); }

// ═══════════════════════ TOGGLE ENABLED ═══════════════════════
async function umToggleEnabled(id, val) {
  const auth = umAuthorizations.find(a => a.id === id);
  if (!auth) return;
  const prev = auth.enabled;
  auth.enabled = Boolean(val);
  renderUmStats();
  try {
    await updateAuthorization(id, { enabled: Boolean(val) });
  } catch (e) {
    auth.enabled = prev; // revert
    renderUmStats();
    renderUmList();
    _umMsg('error', `Failed to update: ${e?.message || e}`);
  }
}

// ═══════════════════════ DELETE ═══════════════════════
async function umDeleteAuth(id) {
  const auth = umAuthorizations.find(a => a.id === id);
  if (!auth) return;
  const label = auth.type === 'user' ? auth.user : auth.token;
  if (!confirm(`Delete authorization for "${label}"? This cannot be undone.`)) return;
  try {
    await deleteAuthorization(id);
    umAuthorizations = umAuthorizations.filter(a => a.id !== id);
    renderUmStats();
    renderUmList();
    _umMsg('success', 'Authorization deleted.');
  } catch (e) {
    _umMsg('error', `Failed to delete: ${e?.message || e}`);
  }
}

// ═══════════════════════ EDIT MODAL ═══════════════════════
function umOpenEdit(id) {
  const auth = umAuthorizations.find(a => a.id === id);
  if (!auth) return;
  umEditingId = id;

  const overlay = document.getElementById('umEditOverlay');
  if (!overlay) return;

  if (auth.type === 'user') {
    // Show user panel, hide token panel
    const userPanel  = document.getElementById('umEditUserPanel');
    const tokenPanel = document.getElementById('umEditTokenPanel');
    if (userPanel)  userPanel.style.display  = 'block';
    if (tokenPanel) tokenPanel.style.display = 'none';

    // Title
    const title = document.getElementById('umEditTitle');
    if (title) title.textContent = 'Edit Authorization — User';

    // Info bar
    const info = document.getElementById('umEditInfo');
    if (info) info.innerHTML = `Editing: <strong>${_umEsc(auth.user || '—')}</strong> · Job: <strong>${_umEsc(auth.job || '—')}</strong>`;

    // Enabled
    const tog = document.getElementById('umEditEnabled');
    if (tog) tog.checked = Boolean(auth.enabled);

    // Dates
    const s = document.getElementById('umEditStart');
    const e = document.getElementById('umEditEnd');
    if (s) s.value = auth.start || '';
    if (e) e.value = auth.end   || '';

  } else {
    // Token
    const userPanel  = document.getElementById('umEditUserPanel');
    const tokenPanel = document.getElementById('umEditTokenPanel');
    if (userPanel)  userPanel.style.display  = 'none';
    if (tokenPanel) tokenPanel.style.display = 'block';

    const title = document.getElementById('umEditTitle');
    if (title) title.textContent = 'Edit Authorization — Token';

    const info = document.getElementById('umEditInfo');
    if (info) info.innerHTML = `Editing: <strong>${_umEsc(auth.token || '—')}</strong> · Job: <strong>${_umEsc(auth.job || '—')}</strong>`;

    // Token name field
    const nameEl = document.getElementById('umEditTokenName');
    if (nameEl) nameEl.value = auth.token || '';

    // Enabled
    const tog = document.getElementById('umEditTokenEnabled');
    if (tog) tog.checked = Boolean(auth.enabled);

    // Dates
    const s = document.getElementById('umEditTokenStart');
    const e = document.getElementById('umEditTokenEnd');
    if (s) s.value = auth.start || '';
    if (e) e.value = auth.end   || '';
  }

  overlay.classList.add('open');
}

function umCloseEdit() {
  umEditingId = null;
  const overlay = document.getElementById('umEditOverlay');
  if (overlay) overlay.classList.remove('open');
}

async function umSaveEdit() {
  if (!umEditingId) return;
  const auth = umAuthorizations.find(a => a.id === umEditingId);
  if (!auth) return;

  let payload = {};

  if (auth.type === 'user') {
    const enabled = document.getElementById('umEditEnabled')?.checked ?? auth.enabled;
    const start   = document.getElementById('umEditStart')?.value   || auth.start;
    const end     = document.getElementById('umEditEnd')?.value     || auth.end;
    if (start > end) { _umMsg('error', 'End date must be after start date.'); return; }
    payload = { enabled, start, end };
  } else {
    const tokenName = document.getElementById('umEditTokenName')?.value?.trim() || auth.token;
    const enabled   = document.getElementById('umEditTokenEnabled')?.checked ?? auth.enabled;
    const start     = document.getElementById('umEditTokenStart')?.value || auth.start;
    const end       = document.getElementById('umEditTokenEnd')?.value   || auth.end;
    if (!tokenName) { _umMsg('error', 'Token name cannot be empty.'); return; }
    if (start > end) { _umMsg('error', 'End date must be after start date.'); return; }
    payload = { token: tokenName, enabled, start, end };
  }

  try {
    await updateAuthorization(umEditingId, payload);
    Object.assign(auth, payload);
    umCloseEdit();
    renderUmStats();
    renderUmList();
    _umMsg('success', 'Authorization updated successfully.');
  } catch (e) {
    _umMsg('error', `Failed to save: ${e?.message || e}`);
  }
}

// ═══════════════════════ HELPERS ═══════════════════════
function _umEsc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _umMsg(type, msg) {
  const hint = document.getElementById('apiHintUserMgmt');
  if (!hint) return;
  hint.style.display     = 'block';
  hint.style.background  = type === 'error'   ? 'rgba(239,68,68,0.08)'   :
                            type === 'success' ? 'rgba(16,185,129,0.08)'  : '';
  hint.style.borderColor = type === 'error'   ? 'rgba(239,68,68,0.25)'   :
                            type === 'success' ? 'rgba(16,185,129,0.25)'  : 'var(--border)';
  hint.innerHTML = `<strong>${type === 'error' ? '⚠️' : '✓'} ${_umEsc(msg)}</strong>`;
  setTimeout(() => { if (hint) { hint.style.display = 'none'; hint.innerHTML = ''; } }, 4000);
}
