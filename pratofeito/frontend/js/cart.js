import { api, esc, money, toast, session, busy } from './utils.js';
import { t } from './i18n.js';
const cart = new Map(); // em memória: carrinho vive só durante a sessão da aba
const changed = () => document.dispatchEvent(new Event('cart:change'));
export const cartCount = () => [...cart.values()].reduce((n, i) => n + i.qty, 0);
export function addToCart(p) { const i = cart.get(p.id); i ? i.qty = Math.min(i.qty + 1, p.quantity) : cart.set(p.id, { p, qty: 1 }); changed(); }
export function renderCart(el) {
  const rows = [...cart.values()], total = rows.reduce((s, { p, qty }) => s + p.price * qty, 0);
  if (!rows.length) { el.innerHTML = `<h1>${t('c.empty')}</h1><p><a href="#/">${t('c.see')}</a></p>`; return; }
  el.innerHTML = `<h1>${t('c.title')}</h1><div class="tablewrap"><table><tbody>${rows.map(({ p, qty }) => `<tr><td>${esc(p.name)}</td>
    <td><span class="qty"><button class="btn" data-dec="${p.id}" aria-label="${t('c.dec')}">−</button><span aria-live="polite">${qty}</span><button class="btn" data-inc="${p.id}" aria-label="${t('c.inc')}" ${qty >= p.quantity ? 'disabled' : ''}>+</button></span> × ${money(p.price)}</td>
    <td><button class="btn danger" data-rm="${p.id}">${t('c.remove')}</button></td></tr>`).join('')}</tbody></table></div>
  <p class="price">${t('c.total', { v: money(total) })}</p>
  <form class="stack" id="co"><label>${t('c.receipt')}<select name="receipt_type" id="rt"><option value="pickup">${t('c.pickup')}</option><option value="delivery">${t('c.delivery')}</option></select></label>
  <label id="addrL" hidden>${t('c.addr')}<input name="delivery_address" autocomplete="street-address"></label><button class="btn primary">${t('c.checkout')}</button></form>`;
  const step = (id, d) => { const i = cart.get(id); i.qty += d; if (i.qty <= 0) cart.delete(id); changed(); renderCart(el); };
  el.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', () => step(b.dataset.inc, 1)));
  el.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => step(b.dataset.dec, -1)));
  el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { cart.delete(b.dataset.rm); changed(); renderCart(el); }));
  const addrL = el.querySelector('#addrL');
  el.querySelector('#rt').addEventListener('change', (e) => { const d = e.target.value === 'delivery'; addrL.hidden = !d; addrL.querySelector('input').required = d; });
  el.querySelector('#co').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!session.user) { location.hash = '#/login'; return; }
    const fd = Object.fromEntries(new FormData(e.target));
    return busy(e.target.querySelector('button'), async () => {
      try {
        await api('/orders', { method: 'POST', body: { ...fd, items: rows.map(({ p, qty }) => ({ product_id: p.id, quantity: qty })) } });
        cart.clear(); changed(); toast(t('c.done')); location.hash = '#/orders';
      } catch (err) { toast(err.message); }
    });
  });
}
