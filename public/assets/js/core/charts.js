import { date } from './format.js';

const SVG = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.append(node);
  return node;
}

export function niceScale(max, ticks = 4, integer = false) {
  if (!(max > 0)) return { max: integer ? 4 : 1, step: integer ? 1 : 0.25 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  if (integer) step = Math.max(1, Math.ceil(step));
  return { max: Math.ceil(max / step) * step, step };
}

function tooltip(container) {
  let tip = container.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    tip.setAttribute('role', 'status');
    container.append(tip);
  }
  return {
    show(lines, x, y) {
      tip.replaceChildren();
      lines.forEach(([text, strong], i) => {
        const line = document.createElement(i === 0 ? 'span' : 'strong');
        line.className = i === 0 ? 'chart-tip-label' : 'chart-tip-value';
        line.textContent = text;
        if (strong) line.dataset.key = strong;
        tip.append(line);
      });
      tip.hidden = false;
      const box = container.getBoundingClientRect();
      const w = tip.offsetWidth;
      const left = Math.min(Math.max(x - w / 2, 0), box.width - w);
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(0, y - tip.offsetHeight - 12))}px)`;
    },
    hide() { tip.hidden = true; },
  };
}

export function lineChart(container, { points, format, axisFormat = format, label, integer = false, colorClass = 'series-1' }) {
  container.classList.add('chart');
  let svg = container.querySelector('svg.chart-svg');
  const tip = tooltip(container);
  let index = points.length - 1;

  function draw() {
    const width = Math.max(280, container.clientWidth);
    const height = width < 520 ? 200 : 260;
    const m = { top: 20, right: 16, bottom: 30, left: 56 };
    const iw = width - m.left - m.right;
    const ih = height - m.top - m.bottom;
    const values = points.map((p) => p.y);
    const { max, step } = niceScale(Math.max(...values, 0), 4, integer);
    const x = (i) => m.left + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
    const y = (v) => m.top + ih - (v / max) * ih;

    svg?.remove();
    svg = el('svg', { class: 'chart-svg', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': label, tabindex: 0 });
    container.prepend(svg);

    const grid = el('g', { class: 'chart-grid' }, svg);
    const axis = el('g', { class: 'chart-axis' }, svg);
    for (let v = 0; v <= max + 1e-9; v += step) {
      el('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v) }, grid);
      const tick = el('text', { x: m.left - 8, y: y(v) + 4, 'text-anchor': 'end' }, axis);
      tick.textContent = axisFormat(v);
    }
    const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 64))));
    points.forEach((p, i) => {
      if (i % labelEvery !== 0 && i !== points.length - 1) return;
      if (i !== points.length - 1 && points.length - 1 - i < labelEvery) return;
      const tx = el('text', { x: x(i), y: height - 8, 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle' }, axis);
      tx.textContent = p.label ?? date(p.x, { day: '2-digit', month: '2-digit' });
    });

    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    el('path', { class: `chart-area ${colorClass}`, d: `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` }, svg);
    el('path', { class: `chart-line ${colorClass}`, d: line }, svg);

    const last = points.length - 1;
    el('circle', { class: `chart-dot ${colorClass}`, cx: x(last), cy: y(points[last].y), r: 4 }, svg);
    const endLabel = el('text', { class: 'chart-end-label', x: x(last) - 8, y: y(points[last].y) - 10, 'text-anchor': 'end' }, svg);
    endLabel.textContent = format(points[last].y);

    const cross = el('line', { class: 'chart-crosshair', y1: m.top, y2: m.top + ih, visibility: 'hidden' }, svg);
    const focusDot = el('circle', { class: `chart-dot ${colorClass}`, r: 5, visibility: 'hidden' }, svg);
    const hit = el('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' }, svg);

    const showAt = (i) => {
      index = Math.max(0, Math.min(points.length - 1, i));
      const p = points[index];
      cross.setAttribute('x1', x(index)); cross.setAttribute('x2', x(index));
      cross.setAttribute('visibility', 'visible');
      focusDot.setAttribute('cx', x(index)); focusDot.setAttribute('cy', y(p.y));
      focusDot.setAttribute('visibility', 'visible');
      tip.show([[p.long ?? date(p.x, { weekday: 'short', day: 'numeric', month: 'short' })], [format(p.y)]], x(index), y(p.y));
    };
    const hide = () => {
      cross.setAttribute('visibility', 'hidden');
      focusDot.setAttribute('visibility', 'hidden');
      tip.hide();
    };
    hit.addEventListener('pointermove', (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * width;
      showAt(Math.round(((px - m.left) / iw) * (points.length - 1)));
    });
    hit.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', () => showAt(index));
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        showAt(index + (e.key === 'ArrowRight' ? 1 : -1));
      } else if (e.key === 'Home') { e.preventDefault(); showAt(0); }
      else if (e.key === 'End') { e.preventDefault(); showAt(points.length - 1); }
      else if (e.key === 'Escape') hide();
    });
  }

  draw();
  let lastWidth = container.clientWidth;
  const ro = new ResizeObserver(() => {
    if (Math.abs(container.clientWidth - lastWidth) < 4) return;
    lastWidth = container.clientWidth;
    draw();
  });
  ro.observe(container);
  return () => ro.disconnect();
}

export function barList(container, rows, { format, colorClass = 'series-1', label = '' }) {
  container.classList.add('bar-list');
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const list = document.createElement('ul');
  list.setAttribute('aria-label', label);
  for (const row of rows) {
    const li = document.createElement('li');
    li.tabIndex = 0;
    const name = document.createElement('span');
    name.className = 'bar-name';
    name.textContent = row.label;
    const track = document.createElement('span');
    track.className = 'bar-track';
    const fill = document.createElement('span');
    fill.className = `bar-fill ${colorClass}`;
    fill.style.width = `${Math.max(row.value > 0 ? 1.5 : 0, (row.value / max) * 100)}%`;
    track.append(fill);
    const value = document.createElement('span');
    value.className = 'bar-value';
    value.textContent = format(row.value);
    li.append(name, track, value);
    li.setAttribute('aria-label', `${row.label}: ${format(row.value)}${row.extra ? `, ${row.extra}` : ''}`);
    if (row.extra) li.title = row.extra;
    list.append(li);
  }
  container.replaceChildren(list);
}

export function segmentedBar(container, parts, { format, label }) {
  container.classList.add('segmented-chart');
  const total = parts.reduce((s, p) => s + p.value, 0);
  const bar = document.createElement('div');
  bar.className = 'seg-bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `${label}: ${parts.map((p) => `${p.label} ${format(p.value)} (${total ? Math.round((p.value * 100) / total) : 0}%)`).join(', ')}`);
  const legend = document.createElement('ul');
  legend.className = 'seg-legend';
  const tip = tooltip(container);
  for (const part of parts) {
    if (part.value > 0) {
      const seg = document.createElement('span');
      seg.className = `seg ${part.className}`;
      seg.style.flexGrow = String(part.value);
      const share = Math.round((part.value * 100) / total);
      if (share >= 9) {
        const txt = document.createElement('span');
        txt.className = 'seg-text';
        txt.textContent = `${share}%`;
        seg.append(txt);
      }
      seg.addEventListener('pointerenter', () => {
        const r = seg.getBoundingClientRect();
        const c = container.getBoundingClientRect();
        tip.show([[part.label], [`${format(part.value)} (${share}%)`]], r.left - c.left + r.width / 2, r.top - c.top);
      });
      seg.addEventListener('pointerleave', () => tip.hide());
      bar.append(seg);
    }
    const li = document.createElement('li');
    const key = document.createElement('span');
    key.className = `seg-key ${part.className}`;
    const text = document.createElement('span');
    text.textContent = part.label;
    const val = document.createElement('strong');
    val.textContent = format(part.value);
    li.append(key, text, val);
    legend.append(li);
  }
  if (!total) bar.classList.add('is-empty');
  container.replaceChildren(bar, legend, container.querySelector('.chart-tip') ?? '');
}

export function heatmap(container, { rows, cols, value, rowLabel, colLabel, format, label }) {
  container.classList.add('heatmap');
  let max = 0;
  rows.forEach((r) => cols.forEach((c) => { max = Math.max(max, value(r, c)); }));
  const grid = document.createElement('div');
  grid.className = 'heat-grid';
  grid.style.gridTemplateColumns = `auto repeat(${cols.length}, minmax(14px, 1fr))`;
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', label);
  const tip = tooltip(container);
  grid.append(document.createElement('span'));
  cols.forEach((c, i) => {
    const head = document.createElement('span');
    head.className = 'heat-col';
    head.textContent = i % 3 === 0 ? colLabel(c) : '';
    grid.append(head);
  });
  for (const r of rows) {
    const head = document.createElement('span');
    head.className = 'heat-row';
    head.textContent = rowLabel(r);
    grid.append(head);
    for (const c of cols) {
      const v = value(r, c);
      const cell = document.createElement('span');
      cell.className = 'heat-cell';
      const level = v === 0 ? 0 : Math.min(5, Math.ceil((v / (max || 1)) * 5));
      cell.dataset.level = String(level);
      cell.addEventListener('pointerenter', () => {
        const rc = cell.getBoundingClientRect();
        const cc = container.getBoundingClientRect();
        tip.show([[`${rowLabel(r)} ${colLabel(c)}`], [format(v)]], rc.left - cc.left + rc.width / 2, rc.top - cc.top);
      });
      cell.addEventListener('pointerleave', () => tip.hide());
      grid.append(cell);
    }
  }
  container.replaceChildren(grid, container.querySelector('.chart-tip') ?? '');
}
