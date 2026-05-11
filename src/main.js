import { render } from './graph.js';

const graphEl = document.getElementById('graph');
const statsEl = document.getElementById('stats');
const tooltipEl = document.getElementById('tooltip');
const refreshBtn = document.getElementById('refresh-btn');
const settingsBtn = document.getElementById('settings-btn');
const lastUpdatedEl = document.getElementById('last-updated');
const closeBtn = document.getElementById('close-btn');
const graphView = document.getElementById('graph-view');
const setupView = document.getElementById('setup-view');
const tokenInput = document.getElementById('token-input');
const tokenSave = document.getElementById('token-save');
const tokenLink = document.getElementById('token-link');
const setupError = document.getElementById('setup-error');

const TOKEN_URL = 'https://app.todoist.com/app/settings/integrations/developer';

let currentItems = [];
let lastFetched = 0;
let fetching = false;
let hasToken = false;

function applyTheme(dark) {
  document.body.classList.toggle('dark', !!dark);
}

function rerender() {
  render(graphEl, statsEl, currentItems, tooltipEl);
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
  lastUpdatedEl.textContent = fmtRelative(lastFetched);
}

function showSetup(prefill = '') {
  graphView.hidden = true;
  setupView.hidden = false;
  refreshBtn.style.display = 'none';
  tokenInput.value = prefill;
  setupError.hidden = true;
  setTimeout(() => tokenInput.focus(), 50);
}

function showGraph() {
  setupView.hidden = true;
  graphView.hidden = false;
  refreshBtn.style.display = '';
}

async function refresh() {
  if (!hasToken || fetching) return;
  fetching = true;
  refreshBtn.classList.add('spin');
  try {
    const res = await window.api.fetchTasks();
    if (res.ok) {
      currentItems = res.items;
      lastFetched = res.lastFetched;
      rerender();
      updateLastUpdated();
    } else if (res.error === 'NO_TOKEN') {
      hasToken = false;
      showSetup();
    } else {
      console.error('Fetch failed:', res.error);
      lastUpdatedEl.textContent = 'Fetch failed';
    }
  } finally {
    fetching = false;
    refreshBtn.classList.remove('spin');
  }
}

async function saveToken() {
  const val = tokenInput.value.trim();
  if (!val) {
    setupError.textContent = 'Token required';
    setupError.hidden = false;
    return;
  }
  tokenSave.disabled = true;
  tokenSave.textContent = 'Verifying…';
  setupError.hidden = true;
  try {
    const res = await window.api.setToken(val);
    if (!res.ok) {
      setupError.textContent = res.error || 'Failed';
      setupError.hidden = false;
      return;
    }
    hasToken = true;
    showGraph();
    refresh();
  } finally {
    tokenSave.disabled = false;
    tokenSave.textContent = 'Save';
  }
}

async function bootstrap() {
  if (!window.api) {
    lastUpdatedEl.textContent = 'Preload failed to load';
    console.error('window.api missing — preload did not attach');
    return;
  }
  const dark = await window.api.getTheme();
  applyTheme(dark);

  const token = await window.api.getToken();
  hasToken = !!token;

  if (!hasToken) {
    showSetup();
    return;
  }

  const cached = await window.api.getCached();
  currentItems = cached.items || [];
  lastFetched = cached.lastFetched || 0;
  rerender();
  updateLastUpdated();
  refresh();
}

closeBtn.addEventListener('click', () => window.api.closeWindow());
refreshBtn.addEventListener('click', refresh);
settingsBtn.addEventListener('click', async () => {
  const current = await window.api.getToken();
  showSetup(current);
});
tokenSave.addEventListener('click', saveToken);
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveToken();
});
tokenLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.api.openExternal(TOKEN_URL);
});

window.addEventListener('resize', () => rerender());

if (window.api) {
  window.api.onFocus(() => refresh());
  window.api.onThemeChange((dark) => applyTheme(dark));
}

setInterval(refresh, 15 * 60 * 1000);
setInterval(updateLastUpdated, 30 * 1000);

bootstrap();
