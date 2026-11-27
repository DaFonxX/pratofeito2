import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { daysUntil, money, moneyPlain, number, timeRange } from '../core/format.js';
import { stars } from './common.js';

export function priceTag(offer, size = '') {
  const sizeClass = size ? `price-tag-${size}` : '';
  if (offer.priceCents === 0) {
    return html`<span class="price-tag price-tag-free ${sizeClass}" aria-label="${t('offer.freeAria', { was: money(offer.originalPriceCents) })}">
      <span class="was" aria-hidden="true">${money(offer.originalPriceCents)}</span>
      <span class="now" aria-hidden="true">${t('offer.free')}</span>
    </span>`;
  }
  const off = offer.discountPct ?? Math.round(100 - (offer.priceCents * 100) / offer.originalPriceCents);
  return html`<span class="price-tag ${sizeClass}" aria-label="${t('offer.priceAria', { now: money(offer.priceCents), was: money(offer.originalPriceCents), off })}">
    <span class="was" aria-hidden="true">${money(offer.originalPriceCents)}</span>
    <span class="now" aria-hidden="true"><small>R$</small>${moneyPlain(offer.priceCents)}</span>
    <span class="off" aria-hidden="true">${t('offer.off', { off })}</span>
  </span>`;
}

export function expiryBadge(expiresOn) {
  const days = daysUntil(expiresOn);
  if (days <= 0) return html`<span class="badge badge-solid-tomate">${t('offer.expiresToday')}</span>`;
  if (days === 1) return html`<span class="badge badge-ambar">${t('offer.expiresTomorrow')}</span>`;
  return '';
}

export function stockLabel(quantity) {
  if (quantity <= 0) return html`<span class="stock-left low">${t('offer.soldOut')}</span>`;
  return html`<span class="stock-left ${quantity <= 3 ? 'low' : ''}">${t('offer.left', { count: quantity })}</span>`;
}

export function offerCard(offer, { showStore = true } = {}) {
  return html`<a class="offer-card" href="/oferta/${encodeURIComponent(offer.id)}">
    <div class="offer-tile">
      <span class="emoji" aria-hidden="true">${offer.emoji}</span>
      <div class="tile-flags">${expiryBadge(offer.expiresOn)}</div>
      ${priceTag(offer)}
    </div>
    <div class="offer-body">
      <h3 class="offer-title">${offer.title}</h3>
      ${showStore && offer.store ? html`<p class="offer-store"><span aria-hidden="true">${offer.store.emoji}</span><span>${offer.store.name}</span></p>` : ''}
      <p class="offer-meta">
        <span>${icon('clock')}<span class="visually-hidden">${t('offer.pickup')}</span>${timeRange(offer.pickupStart, offer.pickupEnd)}</span>
        ${offer.store ? html`<span>${icon('pin')}${offer.store.neighborhood}</span>` : ''}
        ${offer.store?.delivery ? html`<span>${icon('truck')}${t('offer.delivery')}</span>` : ''}
      </p>
      <div class="offer-foot">
        ${stockLabel(offer.quantity)}
        ${offer.store?.rating ? stars(offer.store.rating) : ''}
      </div>
    </div>
  </a>`;
}

export const offerGrid = (offers, opts) => html`<div class="offer-grid">${offers.map((o) => offerCard(o, opts))}</div>`;

export const unitLabel = (unit, count = 1) => t(`units.${unit}`, { count });

export const tagList = (tags) => (tags?.length
  ? html`<ul class="tag-list">${tags.map((tag) => html`<li class="badge badge-couve">${icon('leaf')}${t(`tags.${tag}`)}</li>`)}</ul>`
  : '');

export const quantityText = (offer) => t('offer.leftLong', { count: offer.quantity, unit: unitLabel(offer.unit, offer.quantity), max: number(offer.maxPerOrder) });
