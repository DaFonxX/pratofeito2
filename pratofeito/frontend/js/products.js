import { api, esc, money, date, isToday, toast } from './utils.js';
import { t } from './i18n.js';
import { addToCart } from './cart.js';
export async function renderProducts(el) {
  el.innerHTML = `<h1>${t('home.title')}</h1><p class="muted">${t('home.sub')}</p>
  <form class="filters" id="flt" role="search"><input name="q" placeholder="${t('f.search')}" aria-label="${t('f.search')}"><input name="category" placeholder="${t('f.category')}" aria-label="${t('f.category')}">
  <select name="offer_type" aria-label="${t('f.type')}"><option value="">${t('f.all')}</option><option value="discount">${t('f.discount')}</option><option value="donation">${t('f.donation')}</option></select><button class="btn primary">${t('f.apply')}</button></form>
  <div class="grid" id="list" aria-live="polite"></div>`;
  const list = el.querySelector('#list'), f = el.querySelector('#flt');
  const load = async () => {
    const qs = new URLSearchParams([...new FormData(f)].filter(([, v]) => v));
    list.setAttribute('aria-busy', 'true'); list.innerHTML = `<p class="muted">${t('p.loading')}</p>`;
    try {
      const items = await api('/products?' + qs);
      list.innerHTML = items.length ? items.map((p) => `<article class="card">
        <div class="tags">${p.offer_type === 'donation' ? `<span class="tag">${t('p.donation')}</span>` : ''}${isToday(p.expiry_date) ? `<span class="tag urgent">${t('p.today')}</span>` : ''}</div><h3>${esc(p.name)}</h3>
        <span class="muted">${esc(p.supplier_name)} · ${t('p.expires', { d: date(p.expiry_date) })}</span>
        <span class="price">${p.offer_type === 'donation' ? t('p.free') : money(p.price)} <span class="old">${money(p.original_price)}</span></span>
        <span class="muted">${p.quantity} ${esc(p.unit)} · ${t('p.pickup', { p: esc(p.pickup_time || t('p.tbd')) })}</span>
        <button class="btn primary" data-id="${p.id}">${t('p.add')}</button></article>`).join('') : `<p>${t('p.none')}</p>`;
      list.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { addToCart(items.find((p) => p.id === b.dataset.id)); toast(t('p.added')); }));
    } catch (e) { list.textContent = e.message; }
    list.removeAttribute('aria-busy');
  };
  f.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  load();
}
