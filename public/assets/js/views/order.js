import { html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get, post } from '../core/api.js';
import { dateTime, kg, money, time } from '../core/format.js';
import { busy, confirmDialog, formDialog, toast, toastError } from '../core/ui.js';
import { backLink, statusBadge } from '../components/common.js';
import { unitLabel } from '../components/offer.js';
import notFound from './not-found.js';

const FLOW = ['pending', 'confirmed', 'ready', 'completed'];
const STAMP = { pending: 'createdAt', confirmed: 'confirmedAt', ready: 'readyAt', completed: 'completedAt' };

function timeline(order) {
  if (order.status === 'cancelled') {
    return html`<div class="notice notice-tomate">${icon('x')}<span>${t(order.cancelledBy === 'store' ? 'order.cancelledByStore' : 'order.cancelledByYou')}${order.cancelReason ? html` <em>“${order.cancelReason}”</em>` : ''}</span></div>`;
  }
  const reached = FLOW.indexOf(order.status);
  return html`<ol class="timeline" aria-label="${t('order.progress')}">
    ${FLOW.map((s, i) => html`<li class="${i < reached ? 'done' : i === reached ? 'current' : ''}" ${i === reached ? html`aria-current="step"` : ''}>
      <span class="dot" aria-hidden="true">${i <= reached ? icon('check') : i + 1}</span>
      <span><strong>${t(`order.step.${s}.${order.fulfillment}`)}</strong>
      <span class="tiny muted">${order[STAMP[s]] ? time(order[STAMP[s]]) : ''}</span></span>
    </li>`)}
  </ol>`;
}

function reviewForm(order) {
  if (order.status !== 'completed') return '';
  if (order.rating) {
    return html`<section class="panel"><h2 class="panel-title">${t('order.yourReview')}</h2>
      <p class="stars">${Array.from({ length: order.rating }, () => icon('star'))}</p>
      ${order.review ? html`<p>${order.review}</p>` : ''}</section>`;
  }
  return html`<section class="panel">
    <h2 class="panel-title">${t('order.rateTitle', { store: order.store.name })}</h2>
    <form data-form="review" class="stack" novalidate>
      <fieldset class="rating-fieldset"><legend class="visually-hidden">${t('order.rating')}</legend>
        <div class="rating-input">
          ${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" name="rating" id="r${n}" value="${n}"><label for="r${n}" title="${t('order.stars', { count: n })}">${icon('star')}<span class="visually-hidden">${t('order.stars', { count: n })}</span></label>`)}
        </div>
      </fieldset>
      <div class="field"><label for="f-review">${t('order.comment')} <span class="muted small">(${t('common.optional')})</span></label>
        <textarea class="input" id="f-review" name="review" maxlength="280"></textarea></div>
      <button type="submit" class="btn btn-primary">${t('order.sendReview')}</button>
    </form>
  </section>`;
}

export default async function orderView({ root, params, query }) {
  let order;
  try {
    order = await get(`/orders/${encodeURIComponent(params.id)}`);
  } catch (err) {
    if (err.status === 404) return notFound({ root });
    throw err;
  }
  const isNew = query.get('novo') === '1';
  let timer = null;

  const draw = () => {
    const active = ['pending', 'confirmed', 'ready'].includes(order.status);
    render(root, html`<div class="container page page-narrow">
      ${backLink('/pedidos', t('orders.title'))}
      ${isNew ? html`<div class="notice notice-couve order-success">${icon('check')}<span><strong>${t('order.createdTitle')}</strong> ${t('order.createdText')}</span></div>` : ''}
      <div class="page-head">
        <div><p class="small muted">${t('order.code')} ${order.code}</p><h1>${order.store.name}</h1></div>
        ${statusBadge(order.status)}
      </div>

      ${active ? html`<section class="ticket" aria-labelledby="ticket-title">
        <p id="ticket-title" class="ticket-label">${order.fulfillment === 'pickup' ? t('order.showCode') : t('order.tellCode')}</p>
        <p class="ticket-code" aria-label="${order.pickupCode.split('').join(' ')}">${order.pickupCode}</p>
        <p class="small">${order.fulfillment === 'pickup' ? t('order.pickupAt', { address: `${order.store.address}, ${order.store.neighborhood}` }) : t('order.deliverTo', { address: order.deliveryAddress })}</p>
      </section>` : ''}

      <section class="panel">${timeline(order)}</section>

      <section class="panel">
        <h2 class="panel-title">${t('order.items')}</h2>
        <ul class="summary-items">
          ${order.items.map((i) => html`<li><span aria-hidden="true">${i.emoji}</span>
            <span class="grow">${i.quantity}× ${i.title}<span class="tiny muted"> ${unitLabel(i.unit, i.quantity)}</span></span>
            <span class="num">${i.unitPriceCents === 0 ? t('offer.free') : money(i.unitPriceCents * i.quantity)}</span></li>`)}
        </ul>
        <dl class="totals">
          <div><dt>${t('checkout.subtotal')}</dt><dd>${money(order.subtotalCents)}</dd></div>
          ${order.fulfillment === 'delivery' ? html`<div><dt>${t('checkout.deliveryFee')}</dt><dd>${money(order.deliveryFeeCents)}</dd></div>` : ''}
          <div class="grand"><dt>${t('checkout.total')}</dt><dd>${money(order.totalCents)}</dd></div>
          ${order.savingsCents > 0 ? html`<div class="savings"><dt>${t('order.saved')}</dt><dd>${money(order.savingsCents)}</dd></div>` : ''}
        </dl>
        <dl class="kv">
          <dt>${t('checkout.payment')}</dt><dd>${t(`payment.${order.paymentMethod}`)}</dd>
          <dt>${t('order.placedAt')}</dt><dd>${dateTime(order.createdAt)}</dd>
          <dt>${t('order.food')}</dt><dd>${kg(order.weightGrams / 1000)}</dd>
          ${order.notes ? html`<dt>${t('checkout.notes')}</dt><dd>${order.notes}</dd>` : ''}
        </dl>
      </section>

      <section class="panel">
        <h2 class="panel-title">${t('order.store')}</h2>
        <dl class="kv">
          <dt>${t('store.address')}</dt><dd>${order.store.address}, ${order.store.neighborhood}</dd>
          <dt>${t('store.hours')}</dt><dd>${t('store.opensBetween', { from: order.store.opensAt, to: order.store.closesAt })}</dd>
          ${order.store.phone ? html`<dt>${t('store.phone')}</dt><dd>${order.store.phone}</dd>` : ''}
        </dl>
      </section>

      ${reviewForm(order)}

      ${['pending', 'confirmed'].includes(order.status) ? html`<div class="form-actions">
        <button type="button" class="btn btn-danger" data-action="cancel">${icon('x')}${t('order.cancel')}</button>
      </div>` : ''}
    </div>`);
  };

  draw();

  const poll = async () => {
    if (!['pending', 'confirmed', 'ready'].includes(order.status) || document.hidden) return;
    try {
      const fresh = await get(`/orders/${encodeURIComponent(order.id)}`);
      if (fresh.status !== order.status) {
        order = fresh;
        draw();
        toast(t('order.statusChanged', { status: t(`status.${order.status}`) }), { type: 'info' });
      }
    } catch { return; }
  };
  timer = setInterval(poll, 15000);

  on(root, 'click', '[data-action="cancel"]', async (e, btn) => {
    const values = await formDialog({
      title: t('order.cancelTitle'),
      description: t('order.cancelText'),
      fields: html`<div class="field"><label for="f-reason">${t('order.cancelReason')} <span class="muted small">(${t('common.optional')})</span></label>
        <input class="input" id="f-reason" name="reason" maxlength="200"></div>`,
      submit: t('order.cancelConfirm'),
      cancel: t('common.back'),
      danger: true,
    });
    if (!values) return;
    await busy(btn, async () => {
      try {
        order = await post(`/orders/${encodeURIComponent(order.id)}/cancel`, values.reason?.trim() ? { reason: values.reason.trim() } : {});
        draw();
        toast(t('order.cancelled'));
      } catch (err) { toastError(err); }
    });
  });

  on(root, 'submit', '[data-form="review"]', async (e, form) => {
    e.preventDefault();
    const rating = Number(form.querySelector('input[name="rating"]:checked')?.value);
    if (!rating) { toast(t('order.pickRating'), { type: 'error' }); return; }
    const review = form.review.value.trim();
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        order = await post(`/orders/${encodeURIComponent(order.id)}/review`, review ? { rating, review } : { rating });
        draw();
        toast(t('order.reviewThanks'));
      } catch (err) { toastError(err); }
    });
  });

  return { title: `${t('order.code')} ${order.code}`, cleanup: () => clearInterval(timer) };
}
