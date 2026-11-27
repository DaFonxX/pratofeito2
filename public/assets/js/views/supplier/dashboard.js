import { html, render } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { get } from '../../core/api.js';
import { addDaysYmd, money, number, todayYmd } from '../../core/format.js';
import { lineChart } from '../../core/charts.js';
import { statTile } from '../../components/report.js';

export default async function dashboard({ root }) {
  const today = todayYmd();
  const [summary, report] = await Promise.all([
    get('/supplier/summary'),
    get(`/supplier/reports?from=${addDaysYmd(today, -13)}&to=${today}`),
  ]);
  const s = summary;
  const waiting = s.pending + s.confirmed + s.ready;

  render(root, html`<div class="container page">
    <div class="page-head">
      <div class="row">
        <span class="store-avatar" aria-hidden="true">${s.store.emoji}</span>
        <div><p class="small muted">${t('supplier.dashboardOf')}</p><h1>${s.store.name}</h1></div>
        <span class="badge ${s.store.status === 'active' ? 'badge-couve' : 'badge-ambar'} badge-dot">${t(`supplier.store_${s.store.status}`)}</span>
      </div>
      <div class="row">
        <a class="btn" href="/loja/${encodeURIComponent(s.store.id)}">${icon('eye')}${t('nav.viewStore')}</a>
        <a class="btn btn-primary" href="/painel/ofertas/nova">${icon('plus')}${t('supplier.newOffer')}</a>
      </div>
    </div>

    ${s.offers.expiringToday ? html`<p class="notice notice-ambar">${icon('alert')}<span>${t('supplier.expiringAlert', { count: s.offers.expiringToday })} <a href="/painel/ofertas">${t('supplier.reviewOffers')}</a></span></p>` : ''}
    ${s.store.status !== 'active' ? html`<p class="notice notice-ambar">${icon('pause')}<span>${t('supplier.pausedAlert')} <a href="/painel/loja">${t('supplier.openStore')}</a></span></p>` : ''}

    <section class="section-sm" aria-labelledby="queue-title">
      <div class="section-head"><h2 id="queue-title">${t('supplier.queueTitle')}</h2>
        <a class="see-all" href="/painel/pedidos">${t('supplier.openQueue')}${icon('chevron-right')}</a></div>
      <div class="queue">
        <a class="queue-card status-card-pending" href="/painel/pedidos"><span class="queue-n">${number(s.pending)}</span><span>${t('supplier.col.pending')}</span></a>
        <a class="queue-card status-card-confirmed" href="/painel/pedidos"><span class="queue-n">${number(s.confirmed)}</span><span>${t('supplier.col.confirmed')}</span></a>
        <a class="queue-card status-card-ready" href="/painel/pedidos"><span class="queue-n">${number(s.ready)}</span><span>${t('supplier.col.ready')}</span></a>
      </div>
      ${!waiting ? html`<p class="small muted">${t('supplier.queueEmpty')}</p>` : ''}
    </section>

    <section class="section-sm" aria-labelledby="today-title">
      <h2 id="today-title" class="h-section">${t('supplier.todayTitle')}</h2>
      <dl class="stats">
        ${statTile(t('supplier.ordersToday'), number(s.today.orders))}
        ${statTile(t('supplier.revenueToday'), money(s.today.revenue))}
        ${statTile(t('supplier.activeOffers'), number(s.offers.active), '', t('supplier.unitsInStock', { count: s.offers.stock }))}
        ${statTile(t('reports.foodKg'), `${number(report.kpis.foodKg, 1)} kg`, '', t('supplier.last14'))}
      </dl>
    </section>

    <section class="panel section-sm">
      <div class="panel-head"><h2>${t('supplier.last14Orders')}</h2><a class="small" href="/painel/relatorios">${t('supplier.fullReport')}</a></div>
      <div class="chart-box" data-chart="orders"></div>
    </section>

    <section class="section-sm shortcuts">
      <a class="shortcut" href="/painel/ofertas">${icon('box')}<span><strong>${t('nav.offers')}</strong><span class="small muted">${t('supplier.offersHint')}</span></span></a>
      <a class="shortcut" href="/painel/relatorios">${icon('chart')}<span><strong>${t('nav.reports')}</strong><span class="small muted">${t('supplier.reportsHint')}</span></span></a>
      <a class="shortcut" href="/painel/loja">${icon('store')}<span><strong>${t('nav.myStore')}</strong><span class="small muted">${t('supplier.storeHint')}</span></span></a>
    </section>
  </div>`);

  const cleanup = lineChart(root.querySelector('[data-chart="orders"]'), {
    points: report.series.map((r) => ({ x: r.date, y: r.orders })),
    format: (v) => t('reports.ordersCount', { count: v }),
    axisFormat: (v) => number(v),
    integer: true,
    label: t('supplier.last14Orders'),
  });
  return { title: t('nav.dashboard'), cleanup };
}
