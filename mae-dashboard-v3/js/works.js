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
    return (p === 'works' || p === 'dashboard') ? p : 'dashboard';
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
    const desc = w.description || `Work ${w.id || ''}`.trim() || '—';
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

document.addEventListener('DOMContentLoaded', () => {
  initWorksPage();
});

// Fallback: if this script is loaded after DOMContentLoaded already fired,
// ensure the page still initializes.
if (document.readyState !== 'loading') {
  try { initWorksPage(); } catch (e) { /* ignore */ }
}

