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

function renderWorks() {
  const grid = $('worksGrid');
  if (!grid) return;

  const tr = (k, fallback) => (typeof window.t === 'function') ? window.t(k) : fallback;
  const localizeWorkDesc = (raw, id) => {
    const s = String(raw || '').trim();
    const word = tr('works.workWord', 'Work');
    // If API already provides a description, only normalize the leading "Work/Lavoro <N>" prefix.
    if (s) {
      const m = s.match(/^(work|lavoro)\s+(\d+)\b/i);
      if (m) {
        const num = m[2];
        return s.replace(m[0], `${word} ${num}`);
      }
      return s;
    }
    // Fallback if API description missing.
    const wid = String(id || '').trim();
    return wid ? `${word} ${wid}` : word;
  };

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

    return `
      <button class="work-card" data-work-id="${escapeHtml(wid)}" type="button" style="text-align:left;cursor:pointer;">
        <div class="work-top">
          <div>
            <p class="work-title">${escapeHtml(desc)}</p>
            <div class="work-meta">
              <div class="meta-row"><span class="meta-key">${tr('works.place', 'Place')}</span><span class="meta-val">${escapeHtml(loc)}</span></div>
              <div class="meta-row"><span class="meta-key">${tr('works.devicesLabel', 'Devices')}</span><span class="meta-val">${devCount === null ? '—' : devCount}</span></div>
            </div>
          </div>
          <div class="work-badges">
            <button class="work-edit-button" type="button" onclick="navigateToJob('${escapeHtml(wid)}'); event.stopPropagation();" title="Edit work">
              <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              Edit
            </button>
            <span class="led ${ledClass}" title="${ledTitle}"></span>
          </div>
        </div>
      </button>
    `;
  }).join('');

  grid.querySelectorAll('[data-work-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const workId = btn.getAttribute('data-work-id') || '';
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
    newWorkBtn.addEventListener('click', () => openWorkEditor('0'));
  }

  const locationSearch = $('jobLocationSearch');
  if (locationSearch) {
    locationSearch.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await searchJobLocation();
      }
    });
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
  const error = document.getElementById('jobEditorError');
  if (!error) return;
  error.textContent = message ? String(message) : '';
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

  if (title) title.textContent = isNew ? 'Create new job' : 'Edit job';
  if (hint) hint.textContent = isNew ? 'Create a new job and save it to manage devices.' : 'Edit the job details and manage associated devices.';
  if (saveBtn) saveBtn.textContent = 'Save';
  if (enableBtn) enableBtn.style.display = isNew ? 'none' : (isActive ? 'none' : 'inline-flex');
  if (disableBtn) disableBtn.style.display = isNew ? 'none' : (isActive ? 'inline-flex' : 'none');
}

function fillJobEditorFields(work = {}) {
  getJobEditorField('jobName').value = String(work.description || work.name || '').trim();
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

function renderDeviceCards(list, targetId, connectAction) {
  const container = document.getElementById(targetId);
  if (!container) return;
  if (!Array.isArray(list) || list.length === 0) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;">No devices</div>`;
    return;
  }
  container.innerHTML = list.map(d => {
    const deviceId = JSON.stringify(String(d.id || ''));
    return `
    <div class="job-device-card">
      <div class="job-device-meta">
        <strong>${escapeHtml(String(d.name || d.serial || d.id))}</strong>
        <span>${escapeHtml(String(d.type || '').toUpperCase())} · ${escapeHtml(String(d.position || ''))}</span>
        <span>${escapeHtml(String(d.status || 'offline'))}</span>
      </div>
      <button class="job-device-card-action" type="button" onclick="${connectAction}(${deviceId})">
        ${targetId === 'availableDevicesList' ? '➜ Add' : '← Remove'}
      </button>
    </div>
  `;
  }).join('');
}

async function loadJobDevices(workId) {
  if (!workId) return;
  const customerId = getUserId();
  const [available, associated] = await Promise.all([
    fetchAvailableDevices(customerId, 'free'),
    fetchWorkDevices(workId),
  ]);
  window._jobAvailableDevices = available;
  window._jobAssociatedDevices = associated;
  renderDeviceCards(available.filter(d => !associated.some(a => String(a.id) === String(d.id))), 'availableDevicesList', 'connectDeviceToJob');
  renderDeviceCards(associated, 'associatedDevicesList', 'disconnectDeviceFromJob');
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
      setJobEditorError('Job created successfully.');
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
      await modifyWork({ id_work: jobId, ...values });
      setJobEditorError('Job updated successfully.');
      await loadAndRenderWorks();
      openWorkEditor(jobId);
    }
  } catch (err) {
    setJobEditorError(err?.message || 'Could not save job.');
  }
}

async function handleJobStatus(active) {
  const jobId = String(window._jobEditorWorkId || '').trim();
  if (!jobId || jobId === '0') {
    setJobEditorError('Save the job before changing its status.');
    return;
  }
  if (active) {
    const assoc = Array.isArray(window._jobAssociatedDevices) ? window._jobAssociatedDevices.length : 0;
    if (assoc === 0) {
      setJobEditorError('Enable only when at least one device is associated.');
      return;
    }
  }
  try {
    await changeWorkStatus(jobId, active);
    await loadAndRenderWorks();
    openWorkEditor(jobId);
  } catch (err) {
    setJobEditorError(err?.message || 'Could not update job status.');
  }
}

async function connectDeviceToJob(deviceId) {
  const jobId = String(window._jobEditorWorkId || '').trim();
  if (!jobId || jobId === '0') {
    setJobEditorError('Save the job before associating devices.');
    return;
  }
  try {
    await connectWorkDevice(jobId, deviceId, true);
    await loadJobDevices(jobId);
  } catch (err) {
    setJobEditorError(err?.message || 'Could not connect device to job.');
  }
}

async function disconnectDeviceFromJob(deviceId) {
  const jobId = String(window._jobEditorWorkId || '').trim();
  if (!jobId || jobId === '0') {
    setJobEditorError('Job not loaded.');
    return;
  }
  try {
    await connectWorkDevice(jobId, deviceId, false);
    await loadJobDevices(jobId);
  } catch (err) {
    setJobEditorError(err?.message || 'Could not disconnect device.');
  }
}

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
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      results.innerHTML = '<div style="color:var(--muted);font-size:13px;">No results found.</div>';
      return;
    }
    results.innerHTML = data.map(item => {
      const displayName = String(item.display_name || '');
      const latValue = String(item.lat || '');
      const lonValue = String(item.lon || '');
      return `
      <div class="job-location-item" onclick="selectJobLocation(${JSON.stringify(displayName)}, ${JSON.stringify(latValue)}, ${JSON.stringify(lonValue)})">
        <strong>${escapeHtml(displayName)}</strong>
        <div style="font-size:12px;color:var(--muted);">Lat ${escapeHtml(latValue)} · Lon ${escapeHtml(lonValue)}</div>
      </div>
    `;
    }).join('');
  } catch (err) {
    results.innerHTML = '<div style="color:#f87171;font-size:13px;">Location search failed.</div>';
  }
}

async function selectJobLocation(displayName, lat, lon) {
  getJobEditorField('jobLocation').value = String(displayName || '').trim();
  getJobEditorField('jobLatitude').value = String(lat || '').trim();
  getJobEditorField('jobLongitude').value = String(lon || '').trim();
  getJobEditorField('jobLocationResults').innerHTML = '';
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

  const locationSearch = $('jobLocationSearch');
  if (locationSearch) {
    locationSearch.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await searchJobLocation();
      }
    });
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

document.addEventListener('DOMContentLoaded', () => {
  initWorksPage();
  initJobPage();
});

// Fallback: if this script is loaded after DOMContentLoaded already fired,
// ensure the page still initializes.
if (document.readyState !== 'loading') {
  try { initWorksPage(); initJobPage(); } catch (e) { /* ignore */ }
}

