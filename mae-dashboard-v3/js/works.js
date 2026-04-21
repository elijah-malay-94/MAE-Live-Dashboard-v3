// works.js — "User home" works list page
//
// Dependencies: api.js (auth + apiFetch + fetchWorks helpers)

let allWorks = [];
let worksSearch = '';
let worksFilter = 'all'; // all | active | inactive

function $(id) { return document.getElementById(id); }
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

  const list = getFilteredWorks();
  if (list.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column:1/-1;padding:16px;">
        <div class="card-label" style="margin-bottom:8px;">No works found</div>
        <div style="color:var(--muted);font-size:12px;">Try changing the filter or search term.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(w => {
    const ledClass = w.active ? 'active' : 'inactive';
    const ledTitle = w.active ? 'Active' : 'Inactive';
    const loc = w.location || '—';
    const desc = w.description || `Work ${w.id || ''}`.trim() || '—';
    const wid = w.id || '';

    return `
      <button class="work-card" data-work-id="${escapeHtml(wid)}" type="button" style="text-align:left;cursor:pointer;">
        <div class="work-top">
          <div>
            <p class="work-title">${escapeHtml(desc)}</p>
            <div class="work-meta">
              <div class="meta-row"><span class="meta-key">Place</span><span class="meta-val">${escapeHtml(loc)}</span></div>
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
      try { localStorage.setItem(ACTIVE_WORK_STORAGE_KEY, workId); } catch (e) { /* ignore */ }
      const qp = new URLSearchParams(window.location.search || '');
      const mock = qp.get('mock');
      const proxy = qp.get('proxy');
      const next = new URLSearchParams();
      next.set('page', 'dashboard');
      next.set('work_id', workId);
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

  const withDeviceCount = allWorks.filter(w => Number.isFinite(Number(w.deviceCount)));
  const totalDevices = withDeviceCount.reduce((sum, w) => sum + Number(w.deviceCount || 0), 0);

  const sumSub = $('summarySub');
  if (sumSub) {
    sumSub.textContent = total
      ? `Active ${active}/${total} · Devices ${withDeviceCount.length ? totalDevices : '—'}`
      : 'No works yet';
  }

  const setText = (id, v) => { const el = $(id); if (el) el.textContent = String(v); };
  setText('sumTotal', total);
  setText('sumActive', active);
  setText('sumInactive', inactive);
  setText('sumDevices', withDeviceCount.length ? totalDevices : '—');

  const pct = total ? Math.round((active / total) * 100) : 0;
  const totalHint = withDeviceCount.length ? `${withDeviceCount.length} works with device counts` : 'Device counts not provided';
  setText('sumTotalHint', totalHint);
  setText('sumActiveHint', total ? `${pct}% active` : '—');
  setText('sumInactiveHint', total ? `${100 - pct}% inactive` : '—');
  setText('sumDevicesHint', withDeviceCount.length ? `Avg ${(totalDevices / Math.max(withDeviceCount.length, 1)).toFixed(1)}/work` : '—');

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

  const logoutBtn = $('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doWorksLogout);

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

