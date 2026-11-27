import { html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { dateTime, money } from '../core/format.js';
import { emptyState, statusBadge } from '../components/common.js';

const ACTIVE = ['pending', 'confirmed', 'ready'];

function orderRow(o) {
  const items = o.items.map((i) => `${i.quantity}× ${i.title}`).join(', ');
  return html`<li><a class="order-card" href="/pedidos/${encodeURIComponent(o.id)}">
    <span class="store-avatar" aria-hidden="true">${o.store.emoji}</span>
    <span class="order-card-body">
      <span class="row-between"><strong>${o.store.name}</strong>${statusBadge(o.status)}</span>
      <span class="small muted order-items-line">${items}</span>
      <span class="row-between small"><span class="muted">${o.code} | ${dateTime(o.createdAt)}</span><strong class="num">${o.totalCents ? money(o.totalCents) : t('offer.free')}</strong></span>
    </span>
    ${icon('chevron-right', 'chev')}
  </a></li>`;
}

export default async function ordersView({ root, query }) {
  const orders = await get('/orders');
  let tab = query.get('aba') === 'anteriores' ? 'past' : 'active';
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));
  if (!active.length && past.length && !query.get('aba')) tab = 'past';

  const draw = () => {
    const list = tab === 'active' ? active : past;
    render(root, html`<div class="container page page-narrow">
      <div class="page-head"><div><h1>${t('orders.title')}</h1><p>${t('orders.lead')}</p></div>
        <a class="btn" href="/impacto">${icon('leaf')}${t('nav.impact')}</a></div>
      <div class="segmented" role="tablist" aria-label="${t('orders.title')}">
        <button type="button" role="tab" aria-selected="${String(tab === 'active')}" data-tab="active">${t('orders.active')} (${active.length})</button>
        <button type="button" role="tab" aria-selected="${String(tab === 'past')}" data-tab="past">${t('orders.past')} (${past.length})</button>
      </div>
      <div class="section-sm" role="tabpanel">
        ${list.length ? html`<ul class="order-list">${list.map(orderRow)}</ul>` : emptyState({
          title: tab === 'active' ? t('orders.emptyActive') : t('orders.emptyPast'),
          text: t('orders.emptyText'),
          action: html`<a class="btn btn-primary" href="/explorar">${t('bag.browse')}</a>`,
        })}
      </div>
    </div>`);
  };
  draw();
  on(root, 'click', '[data-tab]', (e, btn) => { tab = btn.dataset.tab; draw(); root.querySelector(`[data-tab="${tab}"]`).focus(); });
  return { title: t('orders.title') };
}
