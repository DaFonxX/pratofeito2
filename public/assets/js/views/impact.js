import { html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { kg, money, moneyShort, monthLabel, number } from '../core/format.js';
import { barList, lineChart } from '../core/charts.js';
import { session } from '../core/store.js';
import { emptyState } from '../components/common.js';
import { statTile } from '../components/report.js';

const MILESTONES = [
  { key: 'first', test: (k) => k.completedOrders >= 1 },
  { key: 'five', test: (k) => k.completedOrders >= 5 },
  { key: 'tenKg', test: (k) => k.foodKg >= 10 },
  { key: 'hundred', test: (k) => k.savingsCents >= 10000 },
  { key: 'donation', test: (k) => k.donations >= 1 },
];

export default async function impact({ root }) {
  const data = await get('/me/impact');
  const k = data.kpis;
  const cleanups = [];

  if (!k.completedOrders) {
    render(root, html`<div class="container page page-narrow"><h1>${t('impact.title')}</h1>${emptyState({
      title: t('impact.emptyTitle'), text: t('impact.emptyText'),
      action: html`<a class="btn btn-primary" href="/explorar">${t('bag.browse')}</a>`,
    })}</div>`);
    return { title: t('impact.title') };
  }

  render(root, html`<div class="container page">
    <div class="page-head">
      <div><h1>${t('impact.title')}</h1><p>${t('impact.lead', { name: session.user.name.split(' ')[0] })}</p></div>
      <button type="button" class="btn" data-action="print">${icon('printer')}${t('reports.print')}</button>
    </div>
    <section class="impact-hero">
      <p class="impact-hero-label">${t('impact.savedTotal')}</p>
      <p class="impact-hero-value">${money(k.savingsCents)}</p>
      <p class="small">${t('impact.heroText', { meals: number(k.meals), stores: number(data.stores) })}</p>
    </section>
    <dl class="stats">
      ${statTile(t('impact.meals'), number(k.meals))}
      ${statTile(t('impact.food'), kg(k.foodKg))}
      ${statTile(t('impact.co2'), kg(k.co2Kg))}
      ${statTile(t('impact.orders'), number(k.completedOrders))}
      ${statTile(t('impact.donationsReceived'), number(k.donations))}
    </dl>
    <p class="tiny muted">${t('impact.footnote')}</p>
    <div class="report-grid">
      <section class="panel"><div class="panel-head"><h2>${t('impact.byMonth')}</h2></div><div class="chart-box" data-chart="months"></div></section>
      <section class="panel"><div class="panel-head"><h2>${t('impact.favoriteCategories')}</h2></div><div data-chart="categories"></div></section>
    </div>
    <section class="panel">
      <div class="panel-head"><h2>${t('impact.milestones')}</h2></div>
      <ul class="milestones">
        ${MILESTONES.map((m) => {
          const done = m.test(k);
          return html`<li class="${done ? 'done' : ''}">${icon(done ? 'check' : 'lock')}<span><strong>${t(`impact.milestone.${m.key}.title`)}</strong><span class="small muted">${t(`impact.milestone.${m.key}.text`)}</span></span></li>`;
        })}
      </ul>
    </section>
  </div>`);

  cleanups.push(lineChart(root.querySelector('[data-chart="months"]'), {
    points: data.months.map((m) => ({ x: `${m.month}-15`, y: m.savingsCents, label: monthLabel(m.month), long: monthLabel(m.month) })),
    format: money,
    axisFormat: moneyShort,
    colorClass: 'series-2',
    label: t('impact.byMonth'),
  }));
  barList(root.querySelector('[data-chart="categories"]'), data.byCategory.map((c) => ({ label: t(`categories.${c.category}`), value: c.items })), {
    format: (v) => number(v), label: t('impact.favoriteCategories'),
  });
  root.querySelector('[data-action="print"]').addEventListener('click', () => window.print());

  return { title: t('impact.title'), cleanup: () => cleanups.forEach((c) => c()) };
}
