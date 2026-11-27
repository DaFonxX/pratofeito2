import { html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { date, money } from '../core/format.js';
import { offerGrid } from '../components/offer.js';
import { emptyState, stars } from '../components/common.js';
import notFound from './not-found.js';

export default async function storeView({ root, params }) {
  let data;
  try {
    data = await get(`/stores/${encodeURIComponent(params.id)}`);
  } catch (err) {
    if (err.status === 404) return notFound({ root });
    throw err;
  }
  const { store, offers, reviews } = data;
  render(root, html`
    <div class="container page">
      <header class="store-header">
        <span class="store-avatar store-avatar-lg" aria-hidden="true">${store.emoji}</span>
        <div class="store-heading">
          <p class="small muted">${t(`storeTypes.${store.type}`)}</p>
          <h1>${store.name}</h1>
          ${stars(store.rating, store.ratingCount)}
          ${store.description ? html`<p class="lead">${store.description}</p>` : ''}
        </div>
        <dl class="store-facts">
          <div><dt>${icon('pin')}<span class="visually-hidden">${t('store.address')}</span></dt><dd>${store.address}, ${store.neighborhood}, ${store.city}</dd></div>
          <div><dt>${icon('clock')}<span class="visually-hidden">${t('store.hours')}</span></dt><dd>${t('store.opensBetween', { from: store.opensAt, to: store.closesAt })}</dd></div>
          <div><dt>${icon('truck')}<span class="visually-hidden">${t('offer.delivery')}</span></dt><dd>${store.delivery ? (store.deliveryFeeCents ? t('offer.deliveryFee', { fee: money(store.deliveryFeeCents) }) : t('offer.deliveryFree')) : t('store.pickupOnly')}</dd></div>
          ${store.phone ? html`<div><dt>${icon('phone')}<span class="visually-hidden">${t('store.phone')}</span></dt><dd>${store.phone}</dd></div>` : ''}
        </dl>
      </header>

      <section class="section" aria-labelledby="store-offers">
        <div class="section-head"><h2 id="store-offers">${t('store.offersToday', { count: offers.length })}</h2></div>
        ${offers.length ? offerGrid(offers, { showStore: false }) : emptyState({ title: t('store.noOffersTitle'), text: t('store.noOffersText') })}
      </section>

      ${reviews.length ? html`<section class="section" aria-labelledby="store-reviews">
        <div class="section-head"><h2 id="store-reviews">${t('store.reviews')}</h2></div>
        <ul class="reviews">
          ${reviews.map((r) => html`<li class="review">
            <div class="row-between"><strong>${r.first_name || t('store.anonymous')}</strong>${stars(r.rating)}</div>
            <p>${r.review}</p>
            <p class="tiny muted">${date(r.completed_at, { day: 'numeric', month: 'long' })}</p>
          </li>`)}
        </ul>
      </section>` : ''}
    </div>`);
  return { title: store.name };
}
