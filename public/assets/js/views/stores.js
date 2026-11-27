import { html, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { get } from '../core/api.js';
import { stars } from '../components/common.js';

export default async function storesView({ root }) {
  const stores = await get('/stores');
  render(root, html`
    <div class="container page">
      <div class="page-head"><div><h1>${t('stores.title')}</h1><p>${t('stores.lead', { count: stores.length })}</p></div></div>
      <ul class="store-list">
        ${stores.map((s) => html`<li>
          <a class="store-card" href="/loja/${encodeURIComponent(s.id)}">
            <span class="store-avatar" aria-hidden="true">${s.emoji}</span>
            <span class="store-card-body">
              <strong>${s.name}</strong>
              <span class="small muted">${t(`storeTypes.${s.type}`)}</span>
              <span class="offer-meta">
                <span>${icon('pin')}${s.neighborhood}</span>
                <span>${icon('clock')}${s.opensAt}–${s.closesAt}</span>
                ${s.delivery ? html`<span>${icon('truck')}${t('offer.delivery')}</span>` : ''}
              </span>
            </span>
            <span class="store-card-side">
              ${stars(s.rating, s.ratingCount)}
              <span class="badge ${s.activeOffers ? 'badge-agata' : ''}">${t('stores.offers', { count: s.activeOffers })}</span>
            </span>
          </a>
        </li>`)}
      </ul>
    </div>`);
  return { title: t('stores.title') };
}
