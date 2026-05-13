import { computeGraphRange, render } from './graph.js';

const graphEl = document.getElementById('graph');
const statsEl = document.getElementById('stats');
const tooltipEl = document.getElementById('tooltip');
const refreshBtn = document.getElementById('refresh-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsBtnIconGear = settingsBtn.querySelector('.settings-btn-icon--gear');
const settingsBtnIconClose = settingsBtn.querySelector('.settings-btn-icon--close');
const lastUpdatedEl = document.getElementById('last-updated');
const graphView = document.getElementById('graph-view');
const setupView = document.getElementById('setup-view');
const tokenInput = document.getElementById('token-input');
const tokenSave = document.getElementById('token-save');
const tokenLink = document.getElementById('token-link');
const setupError = document.getElementById('setup-error');
const themeSelect = document.getElementById('theme-select');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValueEl = document.getElementById('zoom-value');
const labelsToggle = document.getElementById('labels-toggle');

const closeBtn = document.getElementById('close-btn');

const TOKEN_URL = 'https://app.todoist.com/app/settings/integrations/developer';

const VALID_THEMES = new Set([
  'system',
  'github-light', 'github-dark',
  'claude-light', 'claude-dark',
  'todoist-light', 'todoist-dark',
  'todoist-tangerine', 'todoist-moonstone', 'todoist-kale',
  'todoist-lavender', 'todoist-raspberry', 'todoist-bubblegum',
  'todoist-sunset', 'todoist-bordeaux', 'todoist-teal', 'todoist-pacific'
]);

let currentItems = [];
let completedRange = null;
let lastFetched = 0;
let lastFetchError = null;
let fetching = false;
let refreshQueued = false;
let hasToken = false;
let settings = { theme: 'system', zoom: 1, showLabels: true };
let systemDark = false;

function applyTheme(themeName) {
  let effective = themeName;
  if (themeName === 'system') {
    effective = systemDark ? 'github-dark' : 'github-light';
  }
  document.body.dataset.theme = effective;
}

function applyZoom(factor) {
  if (window.api?.setZoom) window.api.setZoom(factor);
}

function zoomFromSlider() {
  return parseInt(zoomSlider.value, 10) / 100;
}

function syncZoomSlider(z) {
  const pct = Math.min(200, Math.max(80, Math.round(Number(z) * 100 / 5) * 5));
  zoomSlider.value = String(pct);
  zoomSlider.setAttribute('aria-valuenow', String(pct));
  zoomValueEl.textContent = `${pct}%`;
}

function setSettingsButtonMode(inSetup) {
  settingsBtnIconGear.hidden = inSetup;
  settingsBtnIconClose.hidden = !inSetup;
  if (inSetup) {
    settingsBtn.setAttribute('aria-label', 'Close settings');
    settingsBtn.title = 'Close settings';
  } else {
    settingsBtn.setAttribute('aria-label', 'Settings');
    settingsBtn.title = 'Settings';
  }
}

function apiDate(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function visibleRange() {
  const range = computeGraphRange(graphEl, { showLabels: settings.showLabels });
  return {
    since: apiDate(range.start),
    until: apiDate(range.until)
  };
}

function rangeCovers(outer, inner) {
  if (!outer || !inner) return false;
  const outerSince = Date.parse(outer.since);
  const outerUntil = Date.parse(outer.until);
  const innerSince = Date.parse(inner.since);
  const innerUntil = Date.parse(inner.until);
  return [outerSince, outerUntil, innerSince, innerUntil].every(Number.isFinite)
    && outerSince <= innerSince
    && outerUntil >= innerUntil;
}

function itemsForRange(items, range) {
  const since = Date.parse(range.since);
  const until = Date.parse(range.until);
  if (!Number.isFinite(since) || !Number.isFinite(until)) return items;
  return items.filter((item) => {
    const completedAt = Date.parse(item.completed_at);
    return Number.isFinite(completedAt) && completedAt >= since && completedAt < until;
  });
}

function rerender() {
  const range = visibleRange();
  render(graphEl, statsEl, itemsForRange(currentItems, range), tooltipEl, { showLabels: settings.showLabels });
}

function fmtRelative(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'Updated just now';
  if (diff < 60) return `Updated ${diff}s ago`;
  if (diff < 3600) return `Updated ${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `Updated ${Math.floor(diff / 3600)}h ago`;
  return `Updated ${Math.floor(diff / 86400)}d ago`;
}

function updateLastUpdated() {
  if (lastFetchError) {
    lastUpdatedEl.textContent = 'Fetch failed';
    lastUpdatedEl.title = lastFetchError;
    lastUpdatedEl.setAttribute('aria-label', `Fetch failed: ${lastFetchError}`);
    lastUpdatedEl.classList.add('last-updated--error');
  } else {
    lastUpdatedEl.textContent = fmtRelative(lastFetched);
    lastUpdatedEl.removeAttribute('title');
    lastUpdatedEl.setAttribute('aria-label', lastUpdatedEl.textContent);
    lastUpdatedEl.classList.remove('last-updated--error');
  }
}

function showSetup(prefill = '') {
  graphView.hidden = true;
  setupView.hidden = false;
  refreshBtn.style.display = 'none';
  tokenInput.value = prefill;
  themeSelect.value = settings.theme;
  syncZoomSlider(settings.zoom);
  labelsToggle.checked = !!settings.showLabels;
  setupError.hidden = true;
  setSettingsButtonMode(true);
  setTimeout(() => tokenInput.focus(), 50);
}

function showGraph() {
  setupView.hidden = true;
  graphView.hidden = false;
  refreshBtn.style.display = '';
  setSettingsButtonMode(false);
  requestAnimationFrame(rerender);
}

async function refresh({ force = true } = {}) {
  if (!hasToken) return;
  if (fetching) {
    refreshQueued = true;
    return;
  }
  const range = visibleRange();
  if (!force && rangeCovers(completedRange, range)) return;

  fetching = true;
  refreshBtn.classList.add('spin');
  try {
    const res = await window.api.fetchTasks(range);
    if (res.ok) {
      lastFetchError = null;
      currentItems = res.items;
      completedRange = res.completedRange || range;
      lastFetched = res.lastFetched;
      rerender();
      updateLastUpdated();
    } else if (res.error === 'NO_TOKEN') {
      lastFetchError = null;
      hasToken = false;
      showSetup();
    } else {
      const detail = String(res.error || 'Unknown error');
      console.error('Fetch failed:', detail);
      lastFetchError = detail;
      updateLastUpdated();
    }
  } finally {
    fetching = false;
    refreshBtn.classList.remove('spin');
    if (refreshQueued) {
      refreshQueued = false;
      setTimeout(refreshIfNeeded, 0);
    }
  }
}

function refreshIfNeeded() {
  refresh({ force: false });
}

async function saveSettings() {
  const val = tokenInput.value.trim();
  const newTheme = themeSelect.value;
  const newZoom = zoomFromSlider();
  const newShowLabels = !!labelsToggle.checked;

  setupError.hidden = true;

  // Persist display settings (cheap)
  settings.theme = newTheme;
  settings.zoom = newZoom;
  settings.showLabels = newShowLabels;
  applyTheme(newTheme);
  applyZoom(newZoom);
  await window.api.setSettings({ theme: newTheme, zoom: newZoom, showLabels: newShowLabels });

  // Token: verify only when the value changed (same as stored → skip API check)
  if (val) {
    const existing = (await window.api.getToken()).trim();
    if (val !== existing) {
      tokenSave.disabled = true;
      tokenSave.textContent = 'Verifying…';
      try {
        const res = await window.api.setToken(val);
        if (!res.ok) {
          setupError.textContent = res.error || 'Failed';
          setupError.hidden = false;
          return;
        }
        hasToken = true;
      } finally {
        tokenSave.disabled = false;
        tokenSave.textContent = 'Save';
      }
    } else {
      hasToken = true;
    }
  } else if (!hasToken) {
    setupError.textContent = 'Token required';
    setupError.hidden = false;
    return;
  }

  showGraph();
  refresh();
}

async function bootstrap() {
  if (!window.api) {
    lastUpdatedEl.textContent = 'Preload failed to load';
    console.error('window.api missing — preload did not attach');
    return;
  }
  systemDark = await window.api.getTheme();
  const loaded = await window.api.getSettings();
  const loadedTheme = loaded.theme && VALID_THEMES.has(loaded.theme) ? loaded.theme : 'system';
  settings = {
    theme: loadedTheme,
    zoom: typeof loaded.zoom === 'number' ? loaded.zoom : 1,
    showLabels: typeof loaded.showLabels === 'boolean' ? loaded.showLabels : true
  };
  applyTheme(settings.theme);
  applyZoom(settings.zoom);

  const token = await window.api.getToken();
  hasToken = !!token;

  if (!hasToken) {
    showSetup();
    return;
  }

  const cached = await window.api.getCached();
  currentItems = cached.items || [];
  completedRange = cached.completedRange || null;
  lastFetched = cached.lastFetched || 0;
  rerender();
  updateLastUpdated();
  refresh({ force: !rangeCovers(completedRange, visibleRange()) });
}

refreshBtn.addEventListener('click', () => refresh());
settingsBtn.addEventListener('click', async () => {
  if (!setupView.hidden) {
    setupError.hidden = true;
    showGraph();
    return;
  }
  const current = await window.api.getToken();
  showSetup(current);
});
tokenSave.addEventListener('click', saveSettings);
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveSettings();
});
themeSelect.addEventListener('change', () => {
  const v = themeSelect.value;
  if (!VALID_THEMES.has(v)) return;
  settings.theme = v;
  applyTheme(v);
  window.api.setSettings({ theme: v });
});
labelsToggle.addEventListener('change', () => {
  const v = !!labelsToggle.checked;
  settings.showLabels = v;
  rerender();
  refreshIfNeeded();
  window.api.setSettings({ showLabels: v });
});
zoomSlider.addEventListener('input', () => {
  const pct = parseInt(zoomSlider.value, 10);
  zoomSlider.setAttribute('aria-valuenow', String(pct));
  zoomValueEl.textContent = `${pct}%`;
  applyZoom(zoomFromSlider());
});
zoomSlider.addEventListener('change', () => {
  const z = zoomFromSlider();
  settings.zoom = z;
  window.api.setSettings({ zoom: z });
});
tokenLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.api.openExternal(TOKEN_URL);
});

let resizeRefreshTimer = null;
window.addEventListener('resize', () => {
  rerender();
  clearTimeout(resizeRefreshTimer);
  resizeRefreshTimer = setTimeout(refreshIfNeeded, 200);
});

if (window.api) {
  window.api.onFocus(() => refresh());
  window.api.onThemeChange((dark) => {
    systemDark = dark;
    if (settings.theme === 'system') applyTheme('system');
  });
}

setInterval(refresh, 15 * 60 * 1000);
setInterval(updateLastUpdated, 30 * 1000);

// Show close button on Windows (frameless — no native controls)
if (window.api?.platform === 'win32') {
  closeBtn.hidden = false;
  closeBtn.addEventListener('click', () => window.api.closeWindow());
}

bootstrap();
