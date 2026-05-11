const CELL_SIZE = 11;
const GAP = 3;
const WEEK_WIDTH = CELL_SIZE + GAP;

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function level(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 7) return 3;
  return 4;
}

export function aggregate(items) {
  const byDate = new Map();
  for (const it of items) {
    if (!it.completed_at) continue;
    const d = new Date(it.completed_at);
    const key = ymd(d);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(it.content);
  }
  return byDate;
}

export function computeStats(byDate) {
  let total = 0;
  let active = 0;
  let bestDay = { date: null, count: 0 };
  for (const [date, tasks] of byDate) {
    total += tasks.length;
    active += 1;
    if (tasks.length > bestDay.count) bestDay = { date, count: tasks.length };
  }

  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  if (!byDate.has(ymd(cur))) cur.setDate(cur.getDate() - 1);
  while (byDate.has(ymd(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }

  return { total, active, bestDay, streak };
}

export function render(graphEl, statsEl, items, tooltipEl) {
  const byDate = aggregate(items);

  const width = graphEl.clientWidth || 600;
  const maxWeeks = Math.max(4, Math.floor((width + GAP) / WEEK_WIDTH));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // last column = current week. Find Saturday of current week (Sun-Sat layout)
  const endSat = new Date(today);
  endSat.setDate(today.getDate() + (6 - today.getDay()));

  const startSun = new Date(endSat);
  startSun.setDate(endSat.getDate() - (maxWeeks * 7 - 1));

  graphEl.innerHTML = '';

  for (let w = 0; w < maxWeeks; w++) {
    const weekEl = document.createElement('div');
    weekEl.className = 'week';
    for (let d = 0; d < 7; d++) {
      const day = new Date(startSun);
      day.setDate(startSun.getDate() + w * 7 + d);

      const cell = document.createElement('div');
      cell.className = 'cell';

      if (day > today) {
        cell.classList.add('empty');
      } else {
        const key = ymd(day);
        const tasks = byDate.get(key) || [];
        const lv = level(tasks.length);
        if (lv > 0) cell.classList.add(`l${lv}`);
        attachTooltip(cell, key, tasks, tooltipEl);
      }
      weekEl.appendChild(cell);
    }
    graphEl.appendChild(weekEl);
  }

  const stats = computeStats(byDate);
  statsEl.innerHTML = `
    <span><b>${stats.total}</b> completed</span>
    <span><b>${stats.streak}</b> day streak</span>
    <span>Best day <b>${stats.bestDay.count}</b>${stats.bestDay.date ? ' (' + fmtDate(stats.bestDay.date) + ')' : ''}</span>
    <span><b>${stats.active}</b> active days</span>
  `;
}

function fmtDate(key) {
  const [y, m, d] = key.split('-');
  const dt = new Date(+y, +m - 1, +d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function attachTooltip(cell, dateKey, tasks, tooltipEl) {
  cell.addEventListener('mouseenter', (e) => {
    const dt = fmtDate(dateKey);
    const count = tasks.length;
    const preview = tasks.slice(0, 4).map(t => `<div class="t-task">• ${escapeHtml(t)}</div>`).join('');
    const more = tasks.length > 4 ? `<div class="t-task">…+${tasks.length - 4} more</div>` : '';
    tooltipEl.innerHTML = `<div class="t-date">${dt} — ${count} task${count === 1 ? '' : 's'}</div>${preview}${more}`;
    tooltipEl.hidden = false;
    positionTooltip(e, tooltipEl);
  });
  cell.addEventListener('mousemove', (e) => positionTooltip(e, tooltipEl));
  cell.addEventListener('mouseleave', () => { tooltipEl.hidden = true; });
}

function positionTooltip(e, el) {
  const pad = 10;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const r = el.getBoundingClientRect();
  if (x + r.width > window.innerWidth) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight) y = e.clientY - r.height - pad;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
