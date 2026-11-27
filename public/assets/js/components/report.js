import { html, on, render, withQuery } from '../core/dom.js';
import { icon, logo } from '../core/icons.js';
import { getLocale, t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { addDaysYmd, compact, date, dateLong, dateTime, kg, money, moneyShort, number, percent, todayYmd, weekdayShort } from '../core/format.js';
import { barList, heatmap, lineChart, segmentedBar } from '../core/charts.js';
import { toastError } from '../core/ui.js';

const PRESETS = [
  ['7', 6], ['30', 29], ['90', 89], ['365', 364],
];

export function deltaBadge(current, previous, { goodWhenUp = true } = {}) {
  if (previous === null || previous === undefined) return '';
  if (!previous) {
    return current ? html`<span class="delta flat">${t('reports.newInPeriod')}</span>` : '';
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return html`<span class="delta flat">${t('reports.stable')}</span>`;
  const up = change > 0;
  const good = up === goodWhenUp;
  return html`<span class="delta ${good ? 'up' : 'down'}">${up ? '↑' : '↓'} ${percent(Math.abs(change))}<span class="visually-hidden"> ${t('reports.vsPrevious')}</span></span>`;
}

export function statTile(labelText, value, delta = '', note = '') {
  return html`<div class="stat"><dt>${labelText}</dt><dd>${value}</dd>${delta}${note ? html`<span class="tiny muted">${note}</span>` : ''}</div>`;
}

const SERIES = {
  revenueCents: { label: () => t('reports.revenue'), format: money, axis: (v) => moneyShort(v), integer: false },
  orders: { label: () => t('reports.orders'), format: (v) => number(v), axis: (v) => number(v), integer: true },
  foodKg: { label: () => t('reports.foodKg'), format: (v) => kg(v), axis: (v) => number(v), integer: false },
  donations: { label: () => t('reports.donations'), format: (v) => number(v), axis: (v) => number(v), integer: true },
  savingsCents: { label: () => t('reports.savings'), format: money, axis: (v) => moneyShort(v), integer: false },
};

const STATUS_ORDER = ['completed', 'ready', 'confirmed', 'pending', 'cancelled'];

export async function reportPage({ root, query, title, lead, endpoint, csvEndpoint, kind }) {
  const today = todayYmd();
  let range = { from: query.get('de') || addDaysYmd(today, -29), to: query.get('ate') || today };
  let preset = query.get('de') ? 'custom' : '30';
  let metric = 'revenueCents';
  let data = null;
  const cleanups = [];

  render(root, html`<div class="container page report-page">
    <div class="print-header">${logo(36)}<div><strong>PratoFeito</strong><span data-slot="print-range"></span></div></div>
    <div class="page-head">
      <div><h1>${title}</h1><p>${lead}</p></div>
      <div class="row report-actions">
        <a class="btn" data-slot="csv" href="#" download>${icon('download')}${t('reports.exportCsv')}</a>
        <button type="button" class="btn" data-action="print">${icon('printer')}${t('reports.print')}</button>
      </div>
    </div>
    <div class="report-filters" role="group" aria-label="${t('reports.period')}">
      <div class="segmented">
        ${PRESETS.map(([key]) => html`<button type="button" data-action="preset" data-preset="${key}" aria-pressed="${String(preset === key)}">${t(`reports.last${key}`)}</button>`)}
        <button type="button" data-action="preset" data-preset="custom" aria-pressed="${String(preset === 'custom')}">${t('reports.custom')}</button>
      </div>
      <form class="custom-range" data-form="range" ${preset === 'custom' ? '' : 'hidden'}>
        <label><span class="small">${t('reports.from')}</span><input class="input" type="date" name="from" value="${range.from}" max="${today}" required></label>
        <label><span class="small">${t('reports.to')}</span><input class="input" type="date" name="to" value="${range.to}" max="${today}" required></label>
        <button type="submit" class="btn btn-primary">${t('reports.apply')}</button>
      </form>
      <p class="small muted" data-slot="range-label"></p>
    </div>
    <div class="report-body" data-slot="body" aria-live="polite">
      <div class="stats">${Array.from({ length: 8 }, () => html`<div class="skeleton stat-skeleton"></div>`)}</div>
    </div>
  </div>`);

  const slot = (n) => root.querySelector(`[data-slot="${n}"]`);

  function body() {
    const k = data.kpis;
    const p = data.previous;
    const tiles = [
      statTile(t('reports.revenue'), money(k.revenueCents), deltaBadge(k.revenueCents, p.revenueCents)),
      statTile(t('reports.orders'), number(k.orders), deltaBadge(k.orders, p.orders), t('reports.completedOf', { count: k.completedOrders })),
      statTile(t('reports.foodKg'), kg(k.foodKg), deltaBadge(k.foodKg, p.foodKg), t('reports.meals', { count: k.meals })),
      statTile(t('reports.itemsRescued'), number(k.itemsRescued), deltaBadge(k.itemsRescued, p.itemsRescued)),
      statTile(t('reports.donations'), number(k.donations), deltaBadge(k.donations, p.donations)),
      statTile(t('reports.avgTicket'), money(k.avgTicketCents), deltaBadge(k.avgTicketCents, p.avgTicketCents)),
      statTile(t('reports.cancelRate'), percent(k.cancelRate, 1), deltaBadge(k.cancelRate, p.cancelRate, { goodWhenUp: false })),
      statTile(kind === 'admin' ? t('reports.customers') : t('reports.rating'), kind === 'admin' ? number(k.customers) : (k.rating ? `${number(k.rating, 1)} ★` : '—'), kind === 'admin' ? deltaBadge(k.customers, p.customers) : ''),
    ];
    const statusTotal = data.byStatus.reduce((s, r) => s + r.count, 0);
    return html`
      <dl class="stats">${tiles}</dl>
      <p class="tiny muted">${t('reports.deltaNote', { from: date(data.range.prevFrom), to: date(data.range.prevTo) })} ${t('impact.footnote')}</p>

      <section class="panel chart-panel">
        <div class="panel-head">
          <h2>${t('reports.overTime')}</h2>
          <div class="segmented" role="group" aria-label="${t('reports.metric')}">
            ${Object.keys(SERIES).map((key) => html`<button type="button" data-action="metric" data-metric="${key}" aria-pressed="${String(metric === key)}">${SERIES[key].label()}</button>`)}
          </div>
        </div>
        <div class="chart-box" data-chart="line"></div>
        <details class="table-view">
          <summary>${t('reports.showTable')}</summary>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>${t('reports.day')}</th>${Object.keys(SERIES).map((key) => html`<th class="num">${SERIES[key].label()}</th>`)}</tr></thead>
            <tbody>${[...data.series].reverse().map((row) => html`<tr><td>${date(row.date, { weekday: 'short', day: '2-digit', month: 'short' })}</td>${Object.keys(SERIES).map((key) => html`<td class="num">${SERIES[key].format(row[key])}</td>`)}</tr>`)}</tbody>
          </table></div>
        </details>
      </section>

      <div class="report-grid">
        <section class="panel">
          <div class="panel-head"><h2>${t('reports.byCategory')}</h2><span class="small muted">${t('reports.itemsRescued')}</span></div>
          ${data.byCategory.length ? html`<div data-chart="category"></div>` : html`<p class="muted">${t('reports.noData')}</p>`}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>${t('reports.byStatus')}</h2><span class="small muted">${t('reports.ordersCount', { count: statusTotal })}</span></div>
          <div data-chart="status"></div>
          <h3 class="subhead">${t('reports.byFulfillment')}</h3>
          <div data-chart="fulfillment"></div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>${t('reports.byPayment')}</h2><span class="small muted">${t('reports.completedOnly')}</span></div>
          ${data.byPayment.length ? html`<div data-chart="payment"></div>` : html`<p class="muted">${t('reports.noData')}</p>`}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>${t('reports.peakHours')}</h2><span class="small muted">${t('reports.ordersCount', { count: data.byWeekdayHour.reduce((s, r) => s + r.count, 0) })}</span></div>
          <div data-chart="heatmap"></div>
          <p class="tiny muted">${t('reports.heatmapHint')}</p>
        </section>
      </div>

      ${kind === 'admin' ? adminSections() : ''}

      <section class="panel">
        <div class="panel-head"><h2>${t('reports.topOffers')}</h2></div>
        ${data.topOffers.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th>${t('reports.offer')}</th><th>${t('reports.category')}</th><th class="num">${t('reports.itemsRescued')}</th><th class="num">${t('reports.foodKg')}</th><th class="num">${t('reports.revenue')}</th></tr></thead>
          <tbody>${data.topOffers.map((o) => html`<tr><td><span aria-hidden="true">${o.emoji}</span> ${o.title}</td><td>${t(`categories.${o.category}`)}</td><td class="num">${number(o.items)}</td><td class="num">${kg(o.foodKg)}</td><td class="num">${money(o.revenueCents)}</td></tr>`)}</tbody>
        </table></div>` : html`<p class="muted">${t('reports.noData')}</p>`}
      </section>
      <p class="tiny muted print-only">${t('reports.generatedAt', { when: dateTime(new Date().toISOString()) })}</p>`;
  }

  function adminSections() {
    const u = data.users;
    const s = data.security;
    return html`
      <div class="report-grid">
        <section class="panel">
          <div class="panel-head"><h2>${t('reports.signups')}</h2><span class="small muted">${t('reports.signupsTotal', { count: data.signups.reduce((a, r) => a + r.buyers + r.suppliers, 0) })}</span></div>
          <div class="chart-box" data-chart="signups"></div>
          <dl class="kv">
            <dt>${t('roles.buyer')}</dt><dd>${number(u.buyers)}</dd>
            <dt>${t('roles.supplier')}</dt><dd>${number(u.suppliers)}</dd>
            <dt>${t('admin.suspended')}</dt><dd>${number(u.suspended)}</dd>
          </dl>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>${t('reports.securityTitle')}</h2><a class="small" href="/admin/seguranca">${t('reports.seeAudit')}</a></div>
          <dl class="stats stats-compact">
            ${statTile(t('reports.logins'), number(s.logins))}
            ${statTile(t('reports.failedLogins'), number(s.failed))}
            ${statTile(t('reports.lockedAccounts'), number(s.locked))}
            ${statTile(t('reports.blockedRequests'), number(s.blocked))}
          </dl>
        </section>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>${t('reports.topStores')}</h2></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>${t('reports.store')}</th><th class="num">${t('reports.orders')}</th><th class="num">${t('reports.foodKg')}</th><th class="num">${t('reports.rating')}</th><th class="num">${t('reports.revenue')}</th></tr></thead>
          <tbody>${data.topStores.map((st) => html`<tr><td><a href="/loja/${encodeURIComponent(st.id)}"><span aria-hidden="true">${st.emoji}</span> ${st.name}</a><span class="tiny muted"> ${st.neighborhood}</span></td><td class="num">${number(st.orders)}</td><td class="num">${kg(st.foodKg)}</td><td class="num">${st.rating ? number(st.rating, 1) : '—'}</td><td class="num">${money(st.revenueCents)}</td></tr>`)}</tbody>
        </table></div>
      </section>`;
  }

  function drawCharts() {
    while (cleanups.length) cleanups.pop()();
    const series = SERIES[metric];
    const lineBox = root.querySelector('[data-chart="line"]');
    cleanups.push(lineChart(lineBox, {
      points: data.series.map((r) => ({ x: r.date, y: r[metric] })),
      format: series.format,
      axisFormat: series.axis,
      integer: series.integer,
      label: t('reports.lineAria', { metric: series.label(), from: dateLong(data.range.from), to: dateLong(data.range.to) }),
    }));
    const cat = root.querySelector('[data-chart="category"]');
    if (cat) {
      barList(cat, data.byCategory.map((c) => ({ label: t(`categories.${c.category}`), value: c.items, extra: `${kg(c.foodKg)}, ${money(c.revenueCents)}` })), {
        format: (v) => number(v), label: t('reports.byCategory'),
      });
    }
    const byStatus = Object.fromEntries(data.byStatus.map((r) => [r.status, r.count]));
    segmentedBar(root.querySelector('[data-chart="status"]'), STATUS_ORDER.map((s) => ({ key: s, label: t(`status.${s}`), value: byStatus[s] ?? 0, className: `seg-status-${s}` })), {
      format: (v) => number(v), label: t('reports.byStatus'),
    });
    const byF = Object.fromEntries(data.byFulfillment.map((r) => [r.fulfillment, r.count]));
    segmentedBar(root.querySelector('[data-chart="fulfillment"]'), ['pickup', 'delivery'].map((f, i) => ({ key: f, label: t(`fulfillment.${f}`), value: byF[f] ?? 0, className: `series-${i + 1}` })), {
      format: (v) => number(v), label: t('reports.byFulfillment'),
    });
    const pay = root.querySelector('[data-chart="payment"]');
    if (pay) {
      barList(pay, data.byPayment.map((r) => ({ label: t(`payment.${r.method}`), value: r.count, extra: money(r.revenueCents) })), {
        format: (v) => number(v), label: t('reports.byPayment'), colorClass: 'series-2',
      });
    }
    const counts = new Map(data.byWeekdayHour.map((r) => [`${r.weekday}-${r.hour}`, r.count]));
    heatmap(root.querySelector('[data-chart="heatmap"]'), {
      rows: [1, 2, 3, 4, 5, 6, 0],
      cols: Array.from({ length: 16 }, (_, i) => i + 7),
      value: (r, c) => counts.get(`${r}-${c}`) ?? 0,
      rowLabel: (r) => weekdayShort(r),
      colLabel: (c) => `${c}h`,
      format: (v) => t('reports.ordersCount', { count: v }),
      label: t('reports.peakHours'),
    });
    const signups = root.querySelector('[data-chart="signups"]');
    if (signups) {
      cleanups.push(lineChart(signups, {
        points: data.signups.map((r) => ({ x: r.date, y: r.buyers + r.suppliers })),
        format: (v) => number(v), axisFormat: (v) => compact(v), integer: true, colorClass: 'series-2',
        label: t('reports.signups'),
      }));
    }
  }

  function updateLinks() {
    const lang = getLocale();
    slot('csv').setAttribute('href', withQuery(`/api${csvEndpoint}`, { from: range.from, to: range.to, lang }));
    const label = t('reports.rangeLabel', { from: dateLong(range.from), to: dateLong(range.to) });
    slot('range-label').textContent = label;
    slot('print-range').textContent = `${title} | ${label}`;
  }

  async function load() {
    const bodyEl = slot('body');
    bodyEl.classList.add('is-loading');
    updateLinks();
    try {
      data = await get(withQuery(endpoint, range));
      render(bodyEl, body());
      drawCharts();
    } catch (err) {
      toastError(err);
    } finally {
      bodyEl.classList.remove('is-loading');
    }
  }

  on(root, 'click', '[data-action]', (e, el) => {
    const action = el.dataset.action;
    if (action === 'print') window.print();
    if (action === 'metric') {
      metric = el.dataset.metric;
      for (const b of root.querySelectorAll('[data-action="metric"]')) b.setAttribute('aria-pressed', String(b === el));
      drawCharts();
    }
    if (action === 'preset') {
      preset = el.dataset.preset;
      for (const b of root.querySelectorAll('[data-action="preset"]')) b.setAttribute('aria-pressed', String(b === el));
      const form = root.querySelector('[data-form="range"]');
      form.hidden = preset !== 'custom';
      if (preset === 'custom') { form.querySelector('input').focus(); return; }
      const days = PRESETS.find(([k]) => k === preset)[1];
      range = { from: addDaysYmd(today, -days), to: today };
      load();
    }
  });
  on(root, 'submit', '[data-form="range"]', (e, form) => {
    e.preventDefault();
    const from = form.from.value;
    const to = form.to.value;
    if (!from || !to || from > to) { form.from.setAttribute('aria-invalid', 'true'); return; }
    form.from.removeAttribute('aria-invalid');
    range = { from, to };
    load();
  });

  await load();
  return { cleanup: () => { while (cleanups.length) cleanups.pop()(); } };
}

