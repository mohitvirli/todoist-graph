import { render } from './graph.js';

const graphEl = document.getElementById('graph');
const statsEl = document.getElementById('stats');
const tooltipEl = document.getElementById('tooltip');
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdatedEl = document.getElementById('last-updated');
const closeBtn = document.getElementById('close-btn');

let currentItems = [];
let lastFetched = 0;
let fetching = false;

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

async function refresh() {
  if (fetching) return;
  fetching = true;
  refreshBtn.classList.add('spin');
  try {
    const res = await window.api.fetchTasks();
    if (res.ok) {
      currentItems = res.items;
      lastFetched = res.lastFetched;
      rerender();
      updateLastUpdated();
    } else {
      console.error('Fetch failed:', res.error);
      lastUpdatedEl.textContent = 'Fetch failed';
    }
  } finally {
    fetching = false;
    refreshBtn.classList.remove('spin');
  }
}

async function bootstrap() {
  if (!window.api) {
    lastUpdatedEl.textContent = 'Preload failed to load';
    console.error('window.api missing — preload did not attach');
    return;
  }
  // Apply theme
  const dark = await window.api.getTheme();
  applyTheme(dark);

  // Cache-first render
  const cached = await window.api.getCached();
  currentItems = cached.items || [];
  lastFetched = cached.lastFetched || 0;
  rerender();
  updateLastUpdated();

  // Background fetch
  refresh();
}

closeBtn.addEventListener('click', () => window.api.closeWindow());
refreshBtn.addEventListener('click', refresh);

window.addEventListener('resize', () => {
  rerender();
});

if (window.api) {
  window.api.onFocus(() => refresh());
  window.api.onThemeChange((dark) => applyTheme(dark));
}

setInterval(refresh, 15 * 60 * 1000);
setInterval(updateLastUpdated, 30 * 1000);

bootstrap();
