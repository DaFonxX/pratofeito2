import { html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get, post } from '../core/api.js';
import { money } from '../core/format.js';
import { cart, session } from '../core/store.js';
import { navigate } from '../core/router.js';
import { busy, handleFormError, toast } from '../core/ui.js';
import { formValues } from '../core/forms.js';
import { emptyState } from '../components/common.js';
import { unitLabel } from '../components/offer.js';

export default async function checkout({ root }) {
  const state = cart.get();
  if (!state) {
    render(root, html`<div class="container page page-narrow"><h1 class="visually-hidden">${t('checkout.title')}</h1>${emptyState({
      title: t('bag.emptyTitle'), text: t('bag.emptyText'),
      action: html`<a class="btn btn-primary" href="/explorar">${t('bag.browse')}</a>`,
    })}</div>`);
    return { title: t('checkout.title') };
  }

  const [account, ...fresh] = await Promise.all([
    get('/account'),
    ...state.items.map((i) => get(`/offers/${encodeURIComponent(i.offerId)}`).then((d) => d.offer).catch(() => null)),
  ]);

  const notices = [];
  state.items.forEach((item, index) => {
    const offer = fresh[index];
    if (!offer || !offer.available || offer.quantity === 0) {
      notices.push(t('checkout.itemGone', { title: item.title }));
      cart.remove(item.offerId);
      return;
    }
    if (offer.priceCents !== item.priceCents) notices.push(t('checkout.priceChanged', { title: item.title, price: money(offer.priceCents) }));
    const limit = Math.min(offer.maxPerOrder, offer.quantity);
    if (item.quantity > limit) notices.push(t('checkout.qtyReduced', { title: item.title, count: limit }));
    cart.add(offer, 0);
    cart.setQuantity(item.offerId, Math.min(item.quantity, limit));
  });

  const current = cart.get();
  if (!current) {
    render(root, html`<div class="container page page-narrow"><h1 class="visually-hidden">${t('checkout.title')}</h1>
      ${notices.map((n) => html`<p class="notice notice-ambar">${icon('alert')}<span>${n}</span></p>`)}
      ${emptyState({ title: t('checkout.allGoneTitle'), text: t('checkout.allGoneText'), action: html`<a class="btn btn-primary" href="/explorar">${t('bag.browse')}</a>` })}
    </div>`);
    return { title: t('checkout.title') };
  }

  const user = account.user;
  const allowance = account.freeAllowance;
  const freeItems = current.items.filter((i) => i.priceCents === 0).reduce((s, i) => s + i.quantity, 0);
  const defaultAddress = [user.address, user.neighborhood].filter(Boolean).join(', ');
  let fulfillment = 'pickup';

  const summary = () => {
    const subtotal = cart.subtotal();
    const fee = fulfillment === 'delivery' ? current.deliveryFeeCents : 0;
    const total = subtotal + fee;
    const savings = cart.originalTotal() - subtotal;
    return html`
      <h2>${t('checkout.summary')}</h2>
      <a class="bag-store" href="/loja/${encodeURIComponent(current.storeId)}">
        <span class="store-avatar" aria-hidden="true">${current.storeEmoji}</span><strong>${current.storeName}</strong>
      </a>
      <ul class="summary-items">
        ${current.items.map((i) => html`<li>
          <span aria-hidden="true">${i.emoji}</span>
          <span class="grow">${i.quantity}× ${i.title}<span class="tiny muted"> ${unitLabel(i.unit, i.quantity)}</span></span>
          <span class="num">${i.priceCents === 0 ? t('offer.free') : money(i.priceCents * i.quantity)}</span>
        </li>`)}
      </ul>
      <dl class="totals">
        <div><dt>${t('checkout.subtotal')}</dt><dd>${money(subtotal)}</dd></div>
        ${fulfillment === 'delivery' ? html`<div><dt>${t('checkout.deliveryFee')}</dt><dd>${fee ? money(fee) : t('offer.deliveryFree')}</dd></div>` : ''}
        <div class="grand"><dt>${t('checkout.total')}</dt><dd>${money(total)}</dd></div>
        ${savings > 0 ? html`<div class="savings"><dt>${t('bag.savings')}</dt><dd>${money(savings)}</dd></div>` : ''}
      </dl>
      <button type="submit" class="btn btn-primary btn-lg btn-block" form="checkout-form">${icon('check')}${t('checkout.place')}</button>
      <p class="tiny muted">${t('checkout.payAtStore')}</p>`;
  };

  const paymentBlock = () => {
    const total = cart.subtotal() + (fulfillment === 'delivery' ? current.deliveryFeeCents : 0);
    if (total === 0) return html`<p class="notice notice-couve">${icon('gift')}<span>${t('checkout.nothingToPay')}</span></p>`;
    return html`<div class="choice-grid" role="radiogroup" aria-label="${t('checkout.payment')}">
      ${['pix', 'card', 'cash'].map((m, i) => html`<label class="choice">
        <input type="radio" name="paymentMethod" value="${m}" ${i === 0 ? 'checked' : ''}>
        <span class="choice-mark" aria-hidden="true"></span>
        <span><strong>${t(`payment.${m}`)}</strong><small>${t(`payment.${m}Hint`)}</small></span>
      </label>`)}
    </div>`;
  };

  render(root, html`
    <div class="container page">
      <div class="page-head"><div><h1>${t('checkout.title')}</h1><p>${t('checkout.lead')}</p></div></div>
      ${notices.map((n) => html`<p class="notice notice-ambar">${icon('alert')}<span>${n}</span></p>`)}
      <div class="checkout-grid">
        <form id="checkout-form" class="checkout-form" novalidate>
          <section class="panel">
            <h2 class="panel-title">${t('checkout.howToReceive')}</h2>
            <div class="choice-grid" role="radiogroup" aria-label="${t('checkout.howToReceive')}">
              <label class="choice">
                <input type="radio" name="fulfillment" value="pickup" checked>
                <span class="choice-mark" aria-hidden="true"></span>
                <span><strong>${icon('store')} ${t('fulfillment.pickup')}</strong><small>${t('checkout.pickupHint')}</small></span>
              </label>
              <label class="choice">
                <input type="radio" name="fulfillment" value="delivery" ${current.delivery ? '' : 'disabled'}>
                <span class="choice-mark" aria-hidden="true"></span>
                <span><strong>${icon('truck')} ${t('fulfillment.delivery')}</strong>
                  <small>${current.delivery ? (current.deliveryFeeCents ? t('offer.deliveryFee', { fee: money(current.deliveryFeeCents) }) : t('offer.deliveryFree')) : t('checkout.noDelivery')}</small></span>
              </label>
            </div>
            <div class="field" data-slot="address" hidden>
              <label for="f-deliveryAddress">${t('checkout.address')}</label>
              <input class="input" id="f-deliveryAddress" name="deliveryAddress" value="${defaultAddress}" autocomplete="street-address" maxlength="160">
            </div>
          </section>
          <section class="panel">
            <h2 class="panel-title">${t('checkout.payment')}</h2>
            <div data-slot="payment">${paymentBlock()}</div>
          </section>
          <section class="panel">
            <div class="field">
              <label for="f-notes">${t('checkout.notes')} <span class="muted small">(${t('common.optional')})</span></label>
              <textarea class="input" id="f-notes" name="notes" maxlength="200" placeholder="${t('checkout.notesPlaceholder')}"></textarea>
            </div>
            ${freeItems ? html`<p class="notice notice-couve">${icon('gift')}<span>${t('checkout.freeAllowance', { used: allowance?.used ?? 0, limit: allowance?.limit ?? 3, count: freeItems })}</span></p>` : ''}
          </section>
        </form>
        <aside class="checkout-summary panel" data-slot="summary" aria-label="${t('checkout.summary')}">${summary()}</aside>
      </div>
    </div>`);

  const slot = (n) => root.querySelector(`[data-slot="${n}"]`);
  const form = root.querySelector('#checkout-form');

  on(root, 'change', 'input[name="fulfillment"]', (e, input) => {
    fulfillment = input.value;
    slot('address').hidden = fulfillment !== 'delivery';
    render(slot('payment'), paymentBlock());
    render(slot('summary'), summary());
    if (fulfillment === 'delivery') slot('address').querySelector('input').focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = formValues(form);
    const submit = root.querySelector('button[type="submit"]');
    const body = {
      storeId: current.storeId,
      items: cart.get().items.map((i) => ({ offerId: i.offerId, quantity: i.quantity })),
      fulfillment: values.fulfillment,
      ...(values.fulfillment === 'delivery' ? { deliveryAddress: values.deliveryAddress } : {}),
      ...(values.paymentMethod ? { paymentMethod: values.paymentMethod } : {}),
      ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
    };
    await busy(submit, async () => {
      try {
        const order = await post('/orders', body);
        cart.clear();
        toast(t('checkout.placed', { code: order.code }));
        navigate(`/pedidos/${encodeURIComponent(order.id)}?novo=1`, { replace: true });
      } catch (err) {
        handleFormError(form, err);
      }
    });
  });

  return { title: t('checkout.title') };
}
