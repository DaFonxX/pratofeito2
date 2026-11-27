import { html, on, render } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { get, post } from '../../core/api.js';
import { ago, dateTime, money } from '../../core/format.js';
import { busy, formDialog, toast, toastError } from '../../core/ui.js';
import { emptyState, pager, statusBadge } from '../../components/common.js';

const COLUMNS = ['pending', 'confirmed', 'ready'];
const NEXT = { pending: 'confirmed', confirmed: 'ready', ready: 'completed' };

function card(o) {
  return html`<article class="kanban-card" data-id="${o.id}">
    <header class="row-between">
      <strong class="num">${o.code}</strong>
      <span class="tiny muted" title="${dateTime(o.createdAt)}">${ago(o.createdAt)}</span>
    </header>
    <p class="kanban-buyer">${icon(o.fulfillment === 'delivery' ? 'truck' : 'store')}<span>${o.buyer.name}</span>
      <span class="badge">${t(`fulfillment.${o.fulfillment}`)}</span></p>
    ${o.fulfillment === 'delivery' ? html`<p class="small">${icon('pin')} ${o.deliveryAddress}${o.buyer.phone ? html`<br>${icon('phone')} ${o.buyer.phone}` : ''}</p>` : ''}
    <ul class="kanban-items">${o.items.map((i) => html`<li><span aria-hidden="true">${i.emoji}</span> ${i.quantity}× ${i.title}</li>`)}</ul>
    ${o.notes ? html`<p class="kanban-note">“${o.notes}”</p>` : ''}
    <p class="row-between small"><span class="muted">${t(`payment.${o.paymentMethod}`)}</span><strong>${o.totalCents ? money(o.totalCents) : t('offer.free')}</strong></p>
    <div class="kanban-actions">
      <button type="button" class="btn btn-sm ${o.status === 'ready' ? 'btn-couve' : 'btn-primary'}" data-action="advance" data-id="${o.id}" data-status="${o.status}">
        ${icon('check')}${t(`supplier.action.${o.status}`)}
      </button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="cancel" data-id="${o.id}">${o.status === 'pending' ? t('supplier.reject') : t('common.cancel')}</button>
    </div>
  </article>`;
}

export default async function supplierOrders({ root }) {
  let scope = 'active';
  let page = 1;
  let data = await get('/supplier/orders?scope=active');
  let known = new Set(data.items.map((o) => o.id));

  const draw = () => {
    const by = (s) => data.items.filter((o) => o.status === s);
    render(root, html`<div class="container page">
      <div class="page-head">
        <div><h1>${t('supplier.ordersTitle')}</h1><p>${t('supplier.ordersLead')}</p></div>
        <div class="segmented" role="tablist">
          <button type="button" role="tab" aria-selected="${String(scope === 'active')}" data-action="scope" data-scope="active">${t('supplier.inProgress')}</button>
          <button type="button" role="tab" aria-selected="${String(scope === 'history')}" data-action="scope" data-scope="history">${t('supplier.history')}</button>
        </div>
      </div>
      ${scope === 'active' ? html`<p class="small muted live-note">${icon('refresh')}${t('supplier.autoRefresh')}</p>
      <div class="kanban">
        ${COLUMNS.map((s) => html`<section class="kanban-col" aria-labelledby="col-${s}">
          <h2 id="col-${s}" class="kanban-title"><span class="badge badge-dot status-${s}">${t(`supplier.col.${s}`)}</span><span class="muted">${by(s).length}</span></h2>
          ${by(s).length ? by(s).map(card) : html`<p class="kanban-empty">${t(`supplier.colEmpty.${s}`)}</p>`}
        </section>`)}
      </div>` : html`
      ${data.items.length ? html`<div class="table-wrap"><table class="table">
        <thead><tr><th>${t('order.code')}</th><th>${t('supplier.customer')}</th><th>${t('order.items')}</th><th>${t('supplier.status')}</th><th>${t('supplier.updated')}</th><th class="num">${t('checkout.total')}</th></tr></thead>
        <tbody>${data.items.map((o) => html`<tr>
          <td class="num">${o.code}</td><td>${o.buyer.name}</td>
          <td class="small">${o.items.map((i) => `${i.quantity}× ${i.title}`).join(', ')}</td>
          <td>${statusBadge(o.status)}${o.rating ? html` <span class="stars">${icon('star')}${o.rating}</span>` : ''}</td>
          <td class="small">${dateTime(o.completedAt ?? o.cancelledAt ?? o.createdAt)}</td>
          <td class="num">${o.totalCents ? money(o.totalCents) : t('offer.free')}</td></tr>`)}</tbody>
      </table></div>${pager({ page: data.page, pageSize: data.pageSize, total: data.total })}`
        : emptyState({ title: t('supplier.historyEmpty') })}`}
    </div>`);
  };
  draw();

  const reload = async () => {
    data = await get(`/supplier/orders?scope=${scope}&page=${page}`);
    draw();
  };

  const poll = async () => {
    if (scope !== 'active' || document.hidden) return;
    try {
      const fresh = await get('/supplier/orders?scope=active');
      const incoming = fresh.items.filter((o) => !known.has(o.id));
      known = new Set(fresh.items.map((o) => o.id));
      if (JSON.stringify(fresh.items.map((o) => [o.id, o.status])) !== JSON.stringify(data.items.map((o) => [o.id, o.status]))) {
        data = fresh;
        draw();
      }
      if (incoming.length) {
        toast(t('supplier.newOrders', { count: incoming.length }), { type: 'info' });
        document.title = `(${incoming.length}) ${document.title.replace(/^\(\d+\)\s/, '')}`;
      }
    } catch { return; }
  };
  const timer = setInterval(poll, 15000);
  const onFocus = () => { document.title = document.title.replace(/^\(\d+\)\s/, ''); };
  window.addEventListener('focus', onFocus);

  on(root, 'click', '[data-action]', async (e, el) => {
    const action = el.dataset.action;
    if (action === 'scope') { scope = el.dataset.scope; page = 1; await reload(); return; }
    if (action === 'page') { page = Number(el.dataset.page); await reload(); return; }
    const id = el.dataset.id;
    if (action === 'advance') {
      const next = NEXT[el.dataset.status];
      let body = { status: next };
      if (next === 'completed') {
        const values = await formDialog({
          title: t('supplier.completeTitle'),
          description: t('supplier.completeText'),
          fields: html`<div class="field"><label for="f-code">${t('supplier.pickupCode')}</label>
            <input class="input code-input" id="f-code" name="pickupCode" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required></div>`,
          submit: t('supplier.complete'),
          validate: (v) => (/^\d{4}$/.test(v.pickupCode ?? '') ? null : { pickupCode: 'invalid_pickup_code' }),
        });
        if (!values) return;
        body = { ...body, pickupCode: values.pickupCode };
      }
      await busy(el, async () => {
        try {
          await post(`/supplier/orders/${encodeURIComponent(id)}/status`, body);
          toast(t(`supplier.moved.${next}`));
          await reload();
        } catch (err) { toastError(err); }
      });
    }
    if (action === 'cancel') {
      const values = await formDialog({
        title: t('supplier.cancelTitle'),
        description: t('supplier.cancelText'),
        fields: html`<div class="field"><label for="f-reason">${t('order.cancelReason')}</label>
          <select class="input" id="f-reason" name="reason">
            ${['sold_out', 'closing', 'quality', 'other'].map((r) => html`<option value="${t(`supplier.reasons.${r}`)}">${t(`supplier.reasons.${r}`)}</option>`)}
          </select></div>`,
        submit: t('supplier.cancelConfirm'),
        cancel: t('common.back'),
        danger: true,
      });
      if (!values) return;
      try {
        await post(`/supplier/orders/${encodeURIComponent(id)}/status`, { status: 'cancelled', reason: values.reason });
        toast(t('order.cancelled'));
        await reload();
      } catch (err) { toastError(err); }
    }
  });

  return {
    title: t('supplier.ordersTitle'),
    cleanup: () => { clearInterval(timer); window.removeEventListener('focus', onFocus); onFocus(); },
  };
}
