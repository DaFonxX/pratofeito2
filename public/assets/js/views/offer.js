import { html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { dateLong, daysUntil, money, relativeDay, timeRange } from '../core/format.js';
import { cart, session } from '../core/store.js';
import { confirmDialog, toast } from '../core/ui.js';
import { openBag } from '../components/bag.js';
import { expiryBadge, offerGrid, priceTag, tagList, unitLabel } from '../components/offer.js';
import { emptyState, stars } from '../components/common.js';
import notFound from './not-found.js';

export default async function offerView({ root, params }) {
  let data;
  try {
    data = await get(`/offers/${encodeURIComponent(params.id)}`);
  } catch (err) {
    if (err.status === 404) return notFound({ root });
    throw err;
  }
  const { offer, more } = data;
  const user = session.user;
  const canBuy = !user || user.role === 'buyer';
  const limit = Math.min(offer.maxPerOrder, offer.quantity);
  let qty = 1;
  const savings = offer.originalPriceCents - offer.priceCents;
  const days = daysUntil(offer.expiresOn);

  const actionArea = () => {
    if (!offer.available || offer.quantity === 0) {
      return html`<div class="notice notice-ambar">${icon('info')}<span>${t('offer.unavailable')}</span></div>`;
    }
    if (!canBuy) return html`<div class="notice">${icon('info')}<span>${t('bag.businessCannotOrder')}</span></div>`;
    const inBag = cart.quantityOf(offer.id);
    return html`<div class="buy-row">
      <div class="stepper stepper-lg" role="group" aria-label="${t('offer.quantityFor', { title: offer.title })}">
        <button type="button" data-action="dec" aria-label="${t('offer.decrease')}" ${qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
        <output aria-live="polite">${qty}</output>
        <button type="button" data-action="inc" aria-label="${t('offer.increase')}" ${qty >= limit ? 'disabled' : ''}>${icon('plus')}</button>
      </div>
      <button type="button" class="btn btn-primary btn-lg grow" data-action="add">
        ${icon('bag')}<span>${offer.priceCents === 0 ? t('offer.reserveFree') : t('offer.addFor', { price: money(offer.priceCents * qty) })}</span>
      </button>
    </div>
    ${inBag ? html`<p class="small muted">${t('offer.inBag', { count: inBag })} <button type="button" class="link-btn" data-action="open-bag">${t('bag.view', { count: cart.count() })}</button></p>` : ''}`;
  };

  render(root, html`
    <div class="container page">
      <nav class="breadcrumb" aria-label="${t('common.breadcrumb')}">
        <a href="/explorar">${t('nav.explore')}</a>${icon('chevron-right')}
        <a href="/explorar?category=${offer.category}">${t(`categories.${offer.category}`)}</a>
      </nav>
      <article class="offer-detail">
        <div class="offer-hero-tile">
          <span class="emoji" aria-hidden="true">${offer.emoji}</span>
          <div class="tile-flags">${expiryBadge(offer.expiresOn)}</div>
          ${priceTag(offer, 'lg')}
        </div>
        <div class="offer-info">
          <h1>${offer.title}</h1>
          <a class="store-line" href="/loja/${encodeURIComponent(offer.store.id)}">
            <span class="store-avatar" aria-hidden="true">${offer.store.emoji}</span>
            <span><strong>${offer.store.name}</strong><span class="small muted">${offer.store.neighborhood}</span></span>
            ${stars(offer.store.rating, offer.store.ratingCount)}
          </a>
          ${savings > 0 ? html`<p class="savings-line">${icon('tag')}${offer.priceCents === 0 ? t('offer.freeSavings', { value: money(savings) }) : t('offer.youSave', { value: money(savings) })}</p>` : ''}
          <dl class="facts">
            <div><dt>${icon('clock')}${t('offer.pickupWindow')}</dt><dd>${timeRange(offer.pickupStart, offer.pickupEnd)}</dd></div>
            <div><dt>${icon('calendar')}${t('offer.bestBefore')}</dt><dd class="${days <= 0 ? 'text-tomate' : ''}">${relativeDay(offer.expiresOn)}<span class="muted small"> (${dateLong(offer.expiresOn)})</span></dd></div>
            <div><dt>${icon('box')}${t('offer.available')}</dt><dd>${t('offer.leftLong', { count: offer.quantity, unit: unitLabel(offer.unit, offer.quantity), max: offer.maxPerOrder })}</dd></div>
            <div><dt>${icon('pin')}${t('offer.where')}</dt><dd>${offer.store.address}, ${offer.store.neighborhood}</dd></div>
            ${offer.store.delivery ? html`<div><dt>${icon('truck')}${t('offer.delivery')}</dt><dd>${offer.store.deliveryFeeCents ? t('offer.deliveryFee', { fee: money(offer.store.deliveryFeeCents) }) : t('offer.deliveryFree')}</dd></div>` : ''}
          </dl>
          ${tagList(offer.tags)}
          <div data-slot="actions">${actionArea()}</div>
          ${offer.priceCents === 0 ? html`<p class="notice notice-couve">${icon('gift')}<span>${t('offer.freeRule', { count: session.meta?.freeItemsPerDay ?? 3 })}</span></p>` : ''}
          ${offer.description ? html`<section class="offer-description"><h2>${t('offer.about')}</h2><p>${offer.description}</p></section>` : ''}
        </div>
      </article>
      <section class="section">
        <div class="section-head"><h2>${t('offer.moreFrom', { store: offer.store.name })}</h2>
          <a class="see-all" href="/loja/${encodeURIComponent(offer.store.id)}">${t('offer.seeStore')}${icon('chevron-right')}</a></div>
        ${more.length ? offerGrid(more, { showStore: false }) : emptyState({ title: t('offer.noMore'), illustration: false })}
      </section>
    </div>`);

  const drawActions = () => render(root.querySelector('[data-slot="actions"]'), actionArea());
  const unsubscribe = cart.subscribe(drawActions);

  on(root, 'click', '[data-action]', async (e, el) => {
    const action = el.dataset.action;
    if (action === 'inc') { qty = Math.min(limit, qty + 1); drawActions(); }
    if (action === 'dec') { qty = Math.max(1, qty - 1); drawActions(); }
    if (action === 'open-bag') openBag();
    if (action === 'add') {
      let result = cart.add(offer, qty);
      if (result.conflict) {
        const ok = await confirmDialog({
          title: t('bag.replaceTitle'),
          message: t('bag.replaceText', { current: result.conflict, next: offer.store.name }),
          confirm: t('bag.replaceConfirm'),
        });
        if (!ok) return;
        result = cart.replaceWith(offer, qty);
      }
      toast(t('bag.added', { title: offer.title }), { action: { label: t('bag.viewShort'), onClick: openBag } });
      qty = 1;
      drawActions();
    }
  });

  return { title: offer.title, cleanup: unsubscribe };
}
