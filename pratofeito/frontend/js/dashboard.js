import { api, esc, money, toast, form, session, busy, download } from './utils.js';
import { t } from './i18n.js';
export async function renderDashboard(el) {
  const supplier = session.user?.type === 'supplier';
  try {
    const orders = await api('/orders'), done = orders.filter((o) => o.status === 'completed');
    const kg = done.reduce((n, o) => n + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const total = done.reduce((s, o) => s + Number(o.total_amount), 0);
    el.innerHTML = `<h1>${t(supplier ? 'd.sup' : 'd.buyer')}</h1>
    <div class="stats"><div><b>${kg}</b>${t('d.saved')}</div><div><b>${done.length}</b>${t('d.done')}</div><div><b>${money(total)}</b>${t(supplier ? 'd.revenue' : 'd.spent')}</div></div>
    <p><button class="btn" id="exp">${t('d.export')}</button><br><span class="hint">${t('d.exportHint')}</span></p><div id="sup"></div>`;
    el.querySelector('#exp').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try { download(new Blob([JSON.stringify(await api('/users/me/export'), null, 2)], { type: 'application/json' }), 'pratofeito-dados.json'); } catch (err) { toast(err.message); }
    }));
    if (supplier) await renderSupplier(el.querySelector('#sup'));
  } catch (e) { el.textContent = e.message; }
}
async function renderSupplier(el) {
  const items = await api('/products/mine');
  el.innerHTML = `<h2>${t('d.publish')}</h2><form class="stack" id="pf">
  <label>${t('a.name')}<input name="name" required></label><label>${t('d.category')}<input name="category" required></label>
  <label>${t('d.qty')}<input name="quantity" type="number" min="0" required></label><label>${t('d.unit')}<input name="unit" value="un"></label>
  <label>${t('d.expiry')}<input name="expiry_date" type="date" required></label><label>${t('d.orig')}<input name="original_price" type="number" step="0.01" min="0" required></label>
  <label>${t('d.price')}<input name="price" type="number" step="0.01" min="0" required></label>
  <label>${t('d.offer')}<select name="offer_type"><option value="discount">${t('d.discount')}</option><option value="donation">${t('d.donation')}</option></select></label>
  <label>${t('d.pickup')}<input name="pickup_time"></label><button class="btn primary">${t('d.submit')}</button></form>
  <h2>${t('d.mine')}</h2><div class="tablewrap"><table><tbody>${items.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.quantity} ${esc(p.unit)}</td><td>${p.is_active ? money(p.price) : t('d.inactive')}</td>
  <td>${p.is_active ? `<button class="btn danger" data-rm="${p.id}">${t('d.off')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  el.querySelector('#pf').addEventListener('submit', (e) => {
    e.preventDefault(); const d = form(e.target);
    if (d.offer_type === 'donation') d.price = 0;
    return busy(e.target.querySelector('button'), async () => {
      try { await api('/products', { method: 'POST', body: d }); toast(t('d.published')); renderSupplier(el); } catch (err) { toast(err.message); }
    });
  });
  el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(t('d.confirm'))) return;
    try { await api(`/products/${b.dataset.rm}`, { method: 'DELETE' }); renderSupplier(el); } catch (e) { toast(e.message); }
  }));
}
