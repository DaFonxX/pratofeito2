import { html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { money } from '../core/format.js';
import { cart, session } from '../core/store.js';
import { navigate } from '../core/router.js';
import { openDialog } from '../core/ui.js';
import { emptyState } from './common.js';

function body() {
  const state = cart.get();
  if (!state) {
    return html`<div class="drawer-body">${emptyState({
      title: t('bag.emptyTitle'),
      text: t('bag.emptyText'),
      action: html`<a class="btn btn-primary" href="/explorar" data-close>${t('bag.browse')}</a>`,
    })}</div>`;
  }
  const subtotal = cart.subtotal();
  const savings = cart.originalTotal() - subtotal;
  const user = session.user;
  return html`
    <div class="drawer-body">
      <a class="bag-store" href="/loja/${encodeURIComponent(state.storeId)}" data-close>
        <span class="store-avatar" aria-hidden="true">${state.storeEmoji}</span>
        <span><strong>${state.storeName}</strong><span class="small muted">${t('bag.oneStore')}</span></span>
      </a>
      <ul class="bag-items">
        ${state.items.map((item) => html`<li class="bag-item">
          <span class="bag-emoji" aria-hidden="true">${item.emoji}</span>
          <div class="bag-info">
            <p class="bag-title">${item.title}</p>
            <p class="small">${item.priceCents === 0 ? html`<strong class="text-couve">${t('offer.free')}</strong>` : html`<strong>${money(item.priceCents)}</strong> <s class="muted">${money(item.originalPriceCents)}</s>`}</p>
          </div>
          <div class="stepper" role="group" aria-label="${t('offer.quantityFor', { title: item.title })}">
            <button type="button" data-action="dec" data-id="${item.offerId}" aria-label="${item.quantity === 1 ? t('bag.remove') : t('offer.decrease')}">${icon(item.quantity === 1 ? 'trash' : 'minus')}</button>
            <output aria-live="polite">${item.quantity}</output>
            <button type="button" data-action="inc" data-id="${item.offerId}" aria-label="${t('offer.increase')}" ${item.quantity >= cart.limitFor(item) ? 'disabled' : ''}>${icon('plus')}</button>
          </div>
        </li>`)}
      </ul>
      <button type="button" class="btn btn-ghost btn-sm" data-action="clear">${icon('trash')}${t('bag.clear')}</button>
    </div>
    <div class="drawer-foot">
      <dl class="totals">
        <div><dt>${t('checkout.subtotal')}</dt><dd>${money(subtotal)}</dd></div>
        ${savings > 0 ? html`<div class="savings"><dt>${t('bag.savings')}</dt><dd>${money(savings)}</dd></div>` : ''}
      </dl>
      ${!user ? html`<a class="btn btn-primary btn-lg btn-block" href="/entrar?next=${encodeURIComponent('/finalizar')}" data-close>${t('bag.signInToCheckout')}</a>`
        : user.role === 'buyer' ? html`<a class="btn btn-primary btn-lg btn-block" href="/finalizar" data-close>${t('bag.checkout')}</a>`
          : html`<p class="notice notice-ambar">${icon('info')}${t('bag.businessCannotOrder')}</p>`}
    </div>`;
}

export function openBag() {
  let unsubscribe = () => {};
  return openDialog(html`<div class="drawer-head">
      <h2>${t('bag.title')}</h2>
      <button type="button" class="icon-btn" data-close aria-label="${t('common.close')}">${icon('x')}</button>
    </div><div class="bag-content"></div>`, {
    className: 'drawer',
    onMount(dialog, close) {
      const content = dialog.querySelector('.bag-content');
      const draw = () => render(content, body());
      draw();
      unsubscribe = cart.subscribe(draw);
      dialog.addEventListener('close', () => unsubscribe());
      on(content, 'click', '[data-action]', (e, btn) => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'inc') cart.setQuantity(id, cart.quantityOf(id) + 1);
        if (btn.dataset.action === 'dec') cart.setQuantity(id, cart.quantityOf(id) - 1);
        if (btn.dataset.action === 'clear') cart.clear();
      });
      on(content, 'click', 'a[data-close]', (e, a) => {
        e.preventDefault();
        close();
        navigate(a.getAttribute('href'));
      });
    },
  });
}
