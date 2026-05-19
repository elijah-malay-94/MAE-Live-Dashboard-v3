// works.js — "User home" works list page
//
// Dependencies: api.js (auth + apiFetch + fetchWorks helpers)

let allWorks = [];
let worksSearch = '';
let worksFilter = 'all'; // all | active | inactive

function $(id) { return document.getElementById(id); }

const ACTIVE_WORK_DESC_STORAGE_KEY = 'mae_dashboard_active_work_desc';
const ACTIVE_WORK_PLACE_STORAGE_KEY = 'mae_dashboard_active_work_place';
const ACTIVE_WORK_DEVCOUNT_STORAGE_KEY = 'mae_dashboard_active_work_device_count';
function getCurrentPage() {
  try {
    const qp = new URLSearchParams(window.location.search || '');
    const p = (qp.get('page') || '').toLowerCase().trim();
    return (p === 'works' || p === 'dashboard' || p === 'job') ? p : 'dashboard';
  } catch (e) {
    return 'dashboard';
  }
}

function showLoginOverlay() {
  const el = $('loginOverlay');
  if (!el) return;
  el.classList.add('open');
  const u = $('loginUsername');
  if (u) u.focus();
}

function hideLoginOverlay() {
  const el = $('loginOverlay');
  if (!el) return;
  el.classList.remove('open');
  const err = $('loginError');
  if (err) err.textContent = '';
}

async function submitWorksLogin() {
  const username = $('loginUsername')?.value?.trim() || '';
  const password = $('loginPassword')?.value?.trim() || '';
  const errEl = $('loginError');
  const btn = $('loginBtn');

  if (!username || !password) {
    if (errEl) errEl.textContent = 'Please enter username and password.';
    return;
  }

  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
  if (errEl) errEl.textContent = '';

  try {
    await authLogin(username, password);
    hideLoginOverlay();
    const topbarUser = $('topbarUsername');
    if (topbarUser) topbarUser.textContent = getUserName() || username;
    await loadAndRenderWorks();
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || 'Login failed. Check your credentials.';
  } finally {
    if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
  }
}

function doWorksLogout() {
  authLogout();
  try { localStorage.removeItem(ACTIVE_WORK_STORAGE_KEY); } catch (e) { /* ignore */ }
  window.location.href = 'index.html?page=works';
}

function navigateToJob(workId) {
  try {
    const qp = new URLSearchParams(window.location.search || '');
    const next = new URLSearchParams();
    next.set('page', 'job');
    const safeId = String(workId || '0').trim();
    if (safeId && safeId !== '0') next.set('work_id', safeId);
    const mock = qp.get('mock');
    const proxy = qp.get('proxy');
    if (mock) next.set('mock', mock);
    if (proxy) next.set('proxy', proxy);
    window.location.href = `index.html?${next.toString()}`;
  } catch (e) {
    const safeId = encodeURIComponent(String(workId || '0').trim());
    window.location.href = `index.html?page=job${safeId && safeId !== '0' ? `&work_id=${safeId}` : ''}`;
  }
}

function setWorksFilter(next) {
  worksFilter = next;
  document.querySelectorAll('[data-work-filter]').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-work-filter') === next);
  });
  renderWorks();
}

function setWorksSearch(value) {
  worksSearch = String(value || '').trim().toLowerCase();
  renderWorks();
}

function normalizeForSearch(s) {
  return String(s || '').toLowerCase();
}

function getFilteredWorks() {
  return allWorks.filter(w => {
    if (worksFilter === 'active' && !w.active) return false;
    if (worksFilter === 'inactive' && w.active) return false;
    if (!worksSearch) return true;
    const hay = `${normalizeForSearch(w.description)} ${normalizeForSearch(w.location)} ${normalizeForSearch(w.id)}`;
    return hay.includes(worksSearch);
  });
}

function localizeWorkDesc(raw, id) {
  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  const s = String(raw || '').trim();
  const word = tr('works.workWord', 'Work');
  if (s) {
    const m = s.match(/^(work|lavoro)\s+(\d+)\b/i);
    if (m) return s.replace(m[0], `${word} ${m[2]}`);
    return s;
  }
  const wid = String(id || '').trim();
  return wid ? `${word} ${wid}` : word;
}

function renderWorks() {
  const grid = $('worksGrid');
  if (!grid) return;

  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;

  const list = getFilteredWorks();
  if (list.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column:1/-1;padding:16px;">
        <div class="card-label" style="margin-bottom:8px;">${tr('works.emptyTitle', 'No works found')}</div>
        <div style="color:var(--muted);font-size:12px;">${tr('works.emptyHint', 'Try changing the filter or search term.')}</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(w => {
    const ledClass = w.active ? 'active' : 'inactive';
    const ledTitle = w.active ? tr('works.active', 'Active') : tr('works.inactive', 'Inactive');
    const loc = w.location || '—';
    const desc = localizeWorkDesc(w.description, w.id) || '—';
    const wid = w.id || '';
    const devCountRaw = Number(w.deviceCount);
    const devCount = (Number.isFinite(devCountRaw) && devCountRaw > 0) ? devCountRaw : null;

    const editLabel = tr('works.edit', 'Edit');
    const editTitle = tr('works.editWork', 'Edit work');
    return `
      <div class="work-card" data-work-id="${escapeHtml(wid)}" role="button" tabindex="0" aria-label="${escapeHtml(desc)}">
        <div class="work-top">
          <div class="work-main">
            <p class="work-title">${escapeHtml(desc)}</p>
            <div class="work-meta">
              <div class="meta-row"><span class="meta-key">${tr('works.place', 'Place')}</span><span class="meta-val">${escapeHtml(loc)}</span></div>
              <div class="meta-row">
                <span class="meta-key">${tr('works.devicesLabel', 'Devices')}</span><span class="meta-val">${devCount === null ? '—' : devCount}</span>
                <button class="work-edit-button" type="button" title="${escapeHtml(editTitle)}">
                  <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                  ${escapeHtml(editLabel)}
                </button>
              </div>
            </div>
          </div>
          <div class="work-badges">
            <span class="led ${ledClass}" title="${escapeHtml(ledTitle)}" role="img" aria-label="${escapeHtml(ledTitle)}"></span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const openWorkDashboard = (workId) => {
    if (!workId) return;
    try {
      localStorage.setItem(ACTIVE_WORK_STORAGE_KEY, workId);
      const w = allWorks.find(x => String(x?.id || '') === String(workId));
      if (w) {
        localStorage.setItem(ACTIVE_WORK_DESC_STORAGE_KEY, String(w.description || ''));
        localStorage.setItem(ACTIVE_WORK_PLACE_STORAGE_KEY, String(w.location || ''));
        const n = Number(w.deviceCount);
        localStorage.setItem(ACTIVE_WORK_DEVCOUNT_STORAGE_KEY, Number.isFinite(n) ? String(n) : '');
      }
    } catch (e) { /* ignore */ }
    const qp = new URLSearchParams(window.location.search || '');
    const mock = qp.get('mock');
    const proxy = qp.get('proxy');
    const customerId = qp.get('customer_id') || qp.get('customerId') || qp.get('customer');
    const next = new URLSearchParams();
    next.set('page', 'dashboard');
    next.set('work_id', workId);
    if (customerId) next.set('customer_id', customerId);
    if (mock) next.set('mock', mock);
    if (proxy) next.set('proxy', proxy);
    window.location.href = `index.html?${next.toString()}`;
  };

  grid.querySelectorAll('.work-card[data-work-id]').forEach(card => {
    const workId = card.getAttribute('data-work-id') || '';
    const editBtn = card.querySelector('.work-edit-button');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof navigateToJob === 'function') navigateToJob(workId);
      });
    }
    card.addEventListener('click', (e) => {
      if (e.target.closest('.work-edit-button')) return;
      openWorkDashboard(workId);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('.work-edit-button')) return;
      e.preventDefault();
      openWorkDashboard(workId);
    });
  });
}

function renderOverview() {
  const total = allWorks.length;
  const active = allWorks.filter(w => Boolean(w.active)).length;
  const inactive = Math.max(0, total - active);

  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  const tf = (k, vars) => (typeof window.tf === 'function') ? window.tf(k, vars) : tr(k, k);

  const hasMeaningfulDeviceCount = (w) => {
    const n = Number(w?.deviceCount);
    return Number.isFinite(n) && n > 0;
  };

  // Exclude works that have device_count = 0 (no meaningful count).
  const withDeviceCount = allWorks.filter(hasMeaningfulDeviceCount);
  const activeWithCount = allWorks.filter(w => Boolean(w.active) && hasMeaningfulDeviceCount(w));
  const inactiveWithCount = allWorks.filter(w => !Boolean(w.active) && hasMeaningfulDeviceCount(w));

  const activeDevices = activeWithCount.reduce((sum, w) => sum + Number(w.deviceCount || 0), 0);
  const inactiveDevices = inactiveWithCount.reduce((sum, w) => sum + Number(w.deviceCount || 0), 0);
  const totalDevices = activeDevices + inactiveDevices;

  const sumSub = $('summarySub');
  if (sumSub) {
    sumSub.textContent = total
      ? tf('works.summarySub', { active, total, devices: (withDeviceCount.length ? totalDevices : '—') })
      : tr('works.noWorksYet', 'No works yet');
  }

  const setText = (id, v) => { const el = $(id); if (el) el.textContent = String(v); };
  setText('sumTotal', total);
  setText('sumActive', active);
  setText('sumInactive', inactive);
  setText('sumDevices', withDeviceCount.length ? totalDevices : '—');

  const pct = total ? Math.round((active / total) * 100) : 0;
  const totalHint = withDeviceCount.length
    ? tf('works.deviceCountsHint', { with: withDeviceCount.length, total })
    : tr('works.deviceCountsMissing', 'Device counts not provided');
  setText('sumTotalHint', totalHint);
  setText(
    'sumActiveHint',
    total
      ? tf('works.activeHint', { pct, devices: (activeWithCount.length ? activeDevices : '—') })
      : '—'
  );
  setText(
    'sumInactiveHint',
    total
      ? tf('works.inactiveHint', { pct: (100 - pct), devices: (inactiveWithCount.length ? inactiveDevices : '—') })
      : '—'
  );
  setText('sumDevicesHint', withDeviceCount.length ? tf('works.avgPerWork', { avg: (totalDevices / Math.max(withDeviceCount.length, 1)).toFixed(1) }) : '—');

  // Summary section is numbers-only (no charts).
}


function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadAndRenderWorks() {
  const userId = getUserId();
  if (!String(userId || '').trim()) {
    showLoginOverlay();
    return;
  }
  allWorks = await fetchWorks(userId);
  renderOverview();
  renderWorks();
}

async function initWorksPage() {
  // This script is loaded on the single-page `index.html` for both routes.
  // Only initialize the Works UI when we're actually on the works route.
  if (getCurrentPage() !== 'works') return;
  document.body.dataset.page = 'works';

  // Wire the shared top-right auth button on the Works page.
  // (state.js only wires it during dashboard init, which is skipped on ?page=works)
  const authBtn = $('authBtn');
  const token = loadAuthTokenFromStorage?.();
  const loggedIn = Boolean(token);
  if (authBtn) {
    const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
    authBtn.title = loggedIn ? tr('auth.logout', 'Logout') : tr('auth.login', 'Login');
    authBtn.onclick = loggedIn ? doWorksLogout : showLoginOverlay;
    // Keep the existing SVG icon (if any) and only swap the label text.
    const svg = authBtn.querySelector('svg');
    authBtn.innerHTML = '';
    if (svg) authBtn.appendChild(svg);
    authBtn.appendChild(document.createTextNode('\n          ' + (loggedIn ? tr('auth.logout', 'Logout') : tr('auth.login', 'Login')) + '\n        '));
  }

  const name = getUserName();
  const topbarUser = $('topbarUsername');
  if (topbarUser) topbarUser.textContent = name || '';

  const search = $('worksSearch');
  if (search) {
    search.addEventListener('input', (e) => setWorksSearch(e.target.value));
  }

  document.querySelectorAll('[data-work-filter]').forEach(chip => {
    chip.addEventListener('click', () => setWorksFilter(chip.getAttribute('data-work-filter')));
  });

  const newWorkBtn = $('newWorkBtn');
  if (newWorkBtn) {
    newWorkBtn.addEventListener('click', () => navigateToJob('0'));
  }

  // (legacy) there is no dedicated logout button on the works page anymore;
  // logout is done via the shared `#authBtn` in the top bar.

  // Login is handled by the shared dashboard modal flow (submitLogin in modals.js),
  // which redirects to `index.html?page=works` after success.

  try {
    await ensureAuth();
    await loadAndRenderWorks();
  } catch (e) {
    // ensureAuth() currently does not throw; this is just defensive.
  }

  // If no token present, show login.
  if (!loadAuthTokenFromStorage()) {
    showLoginOverlay();
  }
}

function getJobEditorField(id) {
  return document.getElementById(id);
}

function setJobEditorError(message) {
  const hint = document.getElementById('apiHintJob');
  if (!hint) return;
  const text = message ? String(message).trim() : '';
  if (!text) {
    hint.style.display = 'none';
    hint.innerHTML = '';
    hint.style.background = '';
    hint.style.borderColor = '';
    return;
  }
  const isSuccess = /\b(successfully|saved)\b/i.test(text) || /^Job (created|updated)\b/i.test(text);
  hint.style.display = 'block';
  if (isSuccess) {
    hint.style.background = 'rgba(16,185,129,0.08)';
    hint.style.borderColor = 'rgba(16,185,129,0.25)';
    hint.innerHTML = `<strong>${escapeHtml(text)}</strong>`;
  } else {
    hint.style.background = 'rgba(239,68,68,0.08)';
    hint.style.borderColor = 'rgba(239,68,68,0.25)';
    hint.innerHTML = `<strong>⚠️ ${escapeHtml(text)}</strong>`;
  }
}

function showJobEditor(show) {
  const panel = document.getElementById('jobEditorPanel');
  if (!panel) return;
  panel.style.display = show ? 'block' : 'none';
}

function setJobEditorControls(isNew, isActive) {
  const saveBtn = document.getElementById('jobSaveBtn');
  const enableBtn = document.getElementById('jobEnableBtn');
  const disableBtn = document.getElementById('jobDisableBtn');
  const title = document.getElementById('jobEditorTitle');
  const hint = document.getElementById('jobEditorModeHint');

  window._jobEditorIsNew = isNew;
  window._jobEditorIsActive = isActive;
  if (title) title.textContent = isNew ? t('job.createNew') : t('job.editExisting');
  if (hint) hint.textContent = isNew ? t('job.createHint') : t('job.editHint');
  if (saveBtn) saveBtn.textContent = t('job.save');
  if (enableBtn) enableBtn.style.display = isNew ? 'none' : (isActive ? 'none' : 'inline-flex');
  if (disableBtn) disableBtn.style.display = isNew ? 'none' : (isActive ? 'inline-flex' : 'none');
}

function fillJobEditorFields(work = {}) {
  window._jobEditorCurrentWork = work;
  getJobEditorField('jobName').value = localizeWorkDesc(work.description || work.name || '', work.id);
  getJobEditorField('jobLocation').value = String(work.place || work.location || '').trim();
  getJobEditorField('jobLatitude').value = String(work.latitude ?? work.lat ?? work.raw?.latitude ?? work.raw?.lat ?? '').trim();
  getJobEditorField('jobLongitude').value = String(work.longitude ?? work.lng ?? work.raw?.longitude ?? work.raw?.lng ?? '').trim();
  getJobEditorField('jobAltitude').value = String(work.altitude ?? work.raw?.altitude ?? work.raw?.alt ?? '').trim();
}

function getJobEditorValues() {
  return {
    description: String(getJobEditorField('jobName').value || '').trim(),
    place: String(getJobEditorField('jobLocation').value || '').trim(),
    latitude: Number(getJobEditorField('jobLatitude').value) || 0,
    longitude: Number(getJobEditorField('jobLongitude').value) || 0,
    altitude: Number(getJobEditorField('jobAltitude').value) || 0,
  };
}

function jobDeviceLedColor(lastConnectionRaw) {
  const raw = lastConnectionRaw ?? '';
  const t = new Date(String(raw).replace(' ', 'T')).getTime();
  if (!Number.isFinite(t)) return 'var(--muted)';
  const mins = (Date.now() - t) / 60000;
  if (mins <= 15) return 'var(--green)';
  if (mins <= 30) return '#f97316';
  return 'var(--red)';
}

function renderJobDashboardDeviceRows(list, listKey) {
  const safe = (v) => {
    const s = (v === undefined || v === null) ? '' : String(v).trim();
    return s || '—';
  };
  if (!Array.isArray(list) || list.length === 0) {
    return `<div class="job-device-empty">${t('job.noDevices')}</div>`;
  }
  return list.map((d) => {
    const id = String(d.id || '').trim();
    const dot = jobDeviceLedColor(d.last_connection ?? d.lastConnection);
    const line1 = safe(d.type);
    const line2 = safe(d.device_place || d.description || d.serial);
    const line3 = safe(d.serial || id);
    const editBtn = listKey === 'associated' ? `
      <button class="work-edit-button" type="button" title="Rename" onclick="event.stopPropagation();openDeviceRenamePopup('${escapeHtml(id)}','${escapeHtml(line2)}')">
        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      </button>` : '';
    return `
    <div class="device-item" data-job-device-list="${listKey}" data-device-id="${escapeHtml(id)}" role="button" tabindex="0"
      onclick="selectJobDeviceForTransfer('${escapeHtml(id)}', '${escapeHtml(listKey)}')">
      <div class="device-dot" style="background:${dot}"></div>
      <div class="device-info">
        <div class="device-serial">${escapeHtml(line1)}</div>
        <div class="device-name">${escapeHtml(line2)}</div>
        <div class="device-serial">${escapeHtml(line3)}</div>
      </div>
      ${editBtn}
    </div>`;
  }).join('');
}

function selectJobDeviceForTransfer(id, listKey) {
  window._jobSelectedDeviceId = String(id || '');
  window._jobSelectedDeviceList = String(listKey || '');
  applyJobDeviceSelectionHighlight();
}

function applyJobDeviceSelectionHighlight() {
  const selId = window._jobSelectedDeviceId || '';
  const selList = window._jobSelectedDeviceList || '';
  document.querySelectorAll('#jobDevicesSection .device-item[data-device-id]').forEach((el) => {
    const match = el.getAttribute('data-device-id') === selId && el.getAttribute('data-job-device-list') === selList;
    el.classList.toggle('active', Boolean(match));
  });
}

async function onJobTransferToAssociated() {
  const filtered = Array.isArray(window._jobFilteredAvailable) ? window._jobFilteredAvailable : [];
  if (filtered.length === 0) {
    setJobEditorError(t('job.noAvailableDevices'));
    return;
  }
  const id = window._jobSelectedDeviceId || '';
  const list = window._jobSelectedDeviceList || '';
  if (list === 'associated' && id) {
    setJobEditorError('To add a device, select a row under Available devices, then press → (right).');
    return;
  }
  if (!id || list !== 'available') {
    setJobEditorError('Select a device in Available devices, then press → (right).');
    return;
  }
  setJobEditorError('');
  await connectDeviceToJob(id);
}

async function onJobTransferToAvailable() {
  const associated = Array.isArray(window._jobAssociatedDevices) ? window._jobAssociatedDevices : [];
  if (associated.length === 0) {
    setJobEditorError(t('job.noAssociatedDevices'));
    return;
  }
  const id = window._jobSelectedDeviceId || '';
  const list = window._jobSelectedDeviceList || '';
  if (list === 'available' && id) {
    setJobEditorError('To remove a device, select a row under Associated devices, then press ← (left).');
    return;
  }
  if (!id || list !== 'associated') {
    setJobEditorError('Select a device in Associated devices, then press ← (left).');
    return;
  }
  setJobEditorError('');
  await disconnectDeviceFromJob(id);
}

async function loadJobDevices(workId) {
  if (!workId) return;
  window._jobSelectedDeviceId = '';
  window._jobSelectedDeviceList = '';
  const customerId = getUserId();
  const [available, associated] = await Promise.all([
    fetchAvailableDevices(customerId, 'free'),
    fetchWorkDevices(workId),
  ]);
  window._jobAvailableDevices = available;
  window._jobAssociatedDevices = associated;
  const availableFiltered = available.filter(d => !associated.some(a => String(a.id) === String(d.id)));
  window._jobFilteredAvailable = availableFiltered;
  const availEl = document.getElementById('availableDevicesList');
  const assocEl = document.getElementById('associatedDevicesList');
  if (availEl) availEl.innerHTML = renderJobDashboardDeviceRows(availableFiltered, 'available');
  if (assocEl) assocEl.innerHTML = renderJobDashboardDeviceRows(associated, 'associated');
}

function openWorkEditor(workId) {
  const isNew = !workId || String(workId).trim() === '0';
  window._jobEditorWorkId = isNew ? '0' : String(workId);
  setJobEditorError('');
  if (isNew) {
    fillJobEditorFields({});
    setJobEditorControls(true, false);
    document.getElementById('jobDevicesSection').style.display = 'none';
    showJobEditor(true);
    return;
  }
  const work = allWorks.find(w => String(w.id) === String(workId)) || null;
  if (work) {
    fillJobEditorFields({
      description: work.description,
      place: work.location,
      latitude: work.raw?.latitude || work.raw?.lat || 0,
      longitude: work.raw?.longitude || work.raw?.lng || 0,
      altitude: work.raw?.altitude || work.raw?.alt || 0,
    });
    setJobEditorControls(false, Boolean(work.active));
    document.getElementById('jobDevicesSection').style.display = '';
    showJobEditor(true);
    loadJobDevices(workId);
  } else {
    setJobEditorError('Work not found. Please reload the works list.');
  }
}

function closeWorkEditor() {
  setJobEditorError('');
  showJobEditor(false);
}

async function handleJobSave() {
  const jobId = String(window._jobEditorWorkId || '0');
  const values = getJobEditorValues();
  if (!values.description) {
    setJobEditorError('Description is required.');
    return;
  }
  try {
    setJobEditorError('');
    if (jobId === '0') {
      const result = await createWork(values);
      setJobEditorError(t('job.createdOk'));
      const newId = String(result?.id || result?.id_work || '0');
      if (isMockMode()) {
        allWorks.unshift({ id: newId, description: values.description, location: values.place, active: false, deviceCount: 0, raw: {} });
        renderOverview();
        renderWorks();
        openWorkEditor(newId);
      } else {
        await loadAndRenderWorks();
        openWorkEditor(newId);
      }
    } else {
      await modifyWork(jobId, values);
      setJobEditorError('Job updated successfully.');
      await loadAndRenderWorks();
      openWorkEditor(jobId);
    }
  } catch (err) {
    setJobEditorError(err?.message || t('job.couldNotSave'));
  }
}

async function handleJobStatus(active) {
  const jobId = String(window._jobEditorWorkId || '').trim();
  if (!jobId || jobId === '0') {
    setJobEditorError(t('job.saveBeforeStatus'));
    return;
  }
  try {
    setJobEditorError('');
    await changeWorkStatus(jobId, active);
    await loadAndRenderWorks();
    openWorkEditor(jobId);
  } catch (err) {
    setJobEditorError(err?.message || t('job.couldNotUpdateStatus'));
  }
}

async function connectDeviceToJob(deviceId) {
  const jobId = String(window._jobEditorWorkId || '').trim();
  if (!jobId || jobId === '0') {
    setJobEditorError(t('job.saveBeforeDevices'));
    return;
  }
  try {
    await connectWorkDevice(jobId, deviceId, true);
    await loadJobDevices(jobId);
  } catch (err) {
    setJobEditorError(err?.message || t('job.couldNotConnect'));
  }
}

async function disconnectDeviceFromJob(deviceId) {
  const jobId = String(window._jobEditorWorkId || '').trim();
  if (!jobId || jobId === '0') {
    setJobEditorError(t('job.notLoaded'));
    return;
  }
  try {
    await connectWorkDevice(jobId, deviceId, false);
    await loadJobDevices(jobId);
  } catch (err) {
    setJobEditorError(err?.message || t('job.couldNotDisconnect'));
  }
}

function formatPhotonPlaceName(p) {
  const raw = [
    p.name,
    p.street && (p.housenumber ? `${p.street} ${p.housenumber}` : p.street),
    p.city || p.town || p.village || p.district || (p.county && String(p.county) !== String(p.name) ? p.county : ''),
    p.state,
    p.country,
  ].map((s) => String(s || '').trim()).filter(Boolean);
  const deduped = [];
  for (const part of raw) {
    if (!deduped.length || deduped[deduped.length - 1] !== part) deduped.push(part);
  }
  return deduped.join(', ');
}

/**
 * Geocode for in-browser use. Photon is primary (CORS-friendly); Nominatim is a best-effort fallback
 * (public instance may reject some browser requests per OSM usage policy).
 * @returns {Promise<Array<{display_name:string,lat:string,lon:string}>>}
 */
async function maeGeocodeQuery(query, limit = 6) {
  const q = String(query || '').trim();
  const lim = Math.min(10, Math.max(1, Number(limit) || 6));
  if (!q) return [];

  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${lim}`);
    if (res.ok) {
      const json = await res.json();
      const feats = Array.isArray(json?.features) ? json.features : [];
      if (feats.length) {
        return feats.map((f) => {
          const coords = f.geometry?.coordinates || [];
          const lon = coords[0];
          const lat = coords[1];
          const p = f.properties || {};
          const display_name = formatPhotonPlaceName(p) || p.name || q;
          return { display_name, lat: String(lat), lon: String(lon) };
        });
      }
    }
  } catch (_) { /* fall through */ }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${lim}&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) return [];
    return data.map((item) => ({
      display_name: String(item.display_name || ''),
      lat: String(item.lat || ''),
      lon: String(item.lon || ''),
    }));
  } catch (_) {
    return [];
  }
}

window.maeGeocodeQuery = maeGeocodeQuery;

async function searchJobLocation() {
  const query = String(getJobEditorField('jobLocationSearch')?.value || '').trim();
  const results = document.getElementById('jobLocationResults');
  if (!results) return;
  if (!query) {
    results.innerHTML = '<div style="color:var(--muted);font-size:13px;">Enter a search query.</div>';
    return;
  }
  results.innerHTML = '<div style="color:var(--muted);font-size:13px;">Searching…</div>';
  try {
    const data = await maeGeocodeQuery(query, 6);
    if (!data.length) {
      results.innerHTML = '<div style="color:var(--muted);font-size:13px;">No results found.</div>';
      return;
    }
    results.innerHTML = data.map((item) => {
      const displayName = String(item.display_name || '');
      const latValue = String(item.lat || '');
      const lonValue = String(item.lon || '');
      return `
      <div class="job-location-item" data-display-name="${escapeHtml(displayName)}" data-lat="${escapeHtml(latValue)}" data-lon="${escapeHtml(lonValue)}" onclick="selectJobLocation(this.dataset.displayName, this.dataset.lat, this.dataset.lon)">
        <strong>${escapeHtml(displayName)}</strong>
        <div style="font-size:12px;color:var(--muted);">Lat ${escapeHtml(latValue)} · Lon ${escapeHtml(lonValue)}</div>
      </div>
    `;
    }).join('');
  } catch (err) {
    results.innerHTML = `<div style="color:#f87171;font-size:13px;">${t('job.locationSearchFailed')}</div>`;
  }
}

async function selectJobLocation(displayName, lat, lon) {
  getJobEditorField('jobLocation').value = String(displayName || '').trim();
  getJobEditorField('jobLatitude').value = String(lat || '').trim();
  getJobEditorField('jobLongitude').value = String(lon || '').trim();
  const locResults = document.getElementById('jobLocationResults');
  if (locResults) locResults.innerHTML = '';
  try {
    const elevationUrl = `https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
    const response = await fetch(elevationUrl);
    const json = await response.json();
    if (Array.isArray(json?.results) && json.results.length > 0) {
      getJobEditorField('jobAltitude').value = String(json.results[0].elevation || '');
    }
  } catch (e) {
    // ignore altitude fetch failures
  }
}

async function initJobPage() {
  if (getCurrentPage() !== 'job') return;
  document.body.dataset.page = 'job';

  const authToken = loadAuthTokenFromStorage();
  if (!authToken) {
    showLoginOverlay();
    return;
  }

  const name = getUserName();
  const topbarUser = $('topbarUsername');
  if (topbarUser) topbarUser.textContent = name || '';

  const authBtn = $('authBtn');
  if (authBtn) {
    const loggedIn = Boolean(loadAuthTokenFromStorage?.());
    const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
    authBtn.title = loggedIn ? tr('auth.logout', 'Logout') : tr('auth.login', 'Login');
    authBtn.onclick = loggedIn ? doWorksLogout : showLoginOverlay;
    const svg = authBtn.querySelector('svg');
    authBtn.innerHTML = '';
    if (svg) authBtn.appendChild(svg);
    authBtn.appendChild(document.createTextNode('\n          ' + (loggedIn ? tr('auth.logout', 'Logout') : tr('auth.login', 'Login')) + '\n        '));
  }

  const workId = new URLSearchParams(window.location.search || '').get('work_id') || '0';
  const userId = getUserId();
  if (!userId) {
    showLoginOverlay();
    return;
  }

  try {
    allWorks = await fetchWorks(userId);
  } catch (e) {
    // ignore fetch errors, job editor may still work in mock mode
  }

  openWorkEditor(workId);
}

function wireJobLocationSearchControls() {
  const input = $('jobLocationSearch');
  if (input && input.dataset.maeLocationSearchWired !== '1') {
    input.dataset.maeLocationSearchWired = '1';
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await searchJobLocation();
      }
    });
  }
  const btn = $('jobLocationSearchBtn');
  if (btn && btn.dataset.maeLocationSearchWired !== '1') {
    btn.dataset.maeLocationSearchWired = '1';
    btn.addEventListener('click', () => searchJobLocation());
  }
}

function openDeviceRenamePopup(deviceId, currentName) {
  window._renameDeviceId = String(deviceId || '');
  const overlay = document.getElementById('deviceRenameOverlay');
  const input = document.getElementById('deviceRenameInput');
  const err = document.getElementById('deviceRenameError');
  if (!overlay || !input) return;
  input.value = currentName === '—' ? '' : currentName;
  if (err) err.textContent = '';
  overlay.style.display = 'flex';
  input.focus();
  input.select();
}

function closeDeviceRenamePopup() {
  const overlay = document.getElementById('deviceRenameOverlay');
  if (overlay) overlay.style.display = 'none';
  window._renameDeviceId = '';
}

async function submitDeviceRename() {
  const deviceId = window._renameDeviceId || '';
  const workId = window._jobEditorWorkId || '';
  const input = document.getElementById('deviceRenameInput');
  const err = document.getElementById('deviceRenameError');
  const newName = String(input?.value || '').trim();

  if (!newName) { if (err) err.textContent = 'Name cannot be empty.'; return; }
  if (newName.length > 30) { if (err) err.textContent = 'Max 30 characters.'; return; }
  if (!deviceId || !workId) { if (err) err.textContent = 'Missing device or work ID.'; return; }

  try {
    await renameDevice(workId, deviceId, newName);
    // Update local cache so re-render shows new name without reload
    if (Array.isArray(window._jobAssociatedDevices)) {
      const d = window._jobAssociatedDevices.find(x => String(x.id) === deviceId);
      if (d) { d.device_place = newName; d.description = newName; }
    }
    closeDeviceRenamePopup();
    await loadJobDevices(workId);
  } catch (e) {
    if (err) err.textContent = e?.message || 'Could not rename device.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireJobLocationSearchControls();
  initWorksPage();
  initJobPage();
});

// Fallback: if this script is loaded after DOMContentLoaded already fired,
// ensure the page still initializes.
if (document.readyState !== 'loading') {
  try {
    wireJobLocationSearchControls();
    initWorksPage();
    initJobPage();
  } catch (e) { /* ignore */ }
}

