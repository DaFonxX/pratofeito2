import { api, esc, money, date, toast, session } from './utils.js';
import { t } from './i18n.js';
const STATUSES = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
export async function renderOrders(el) {
  const supplier = session.user?.type === 'supplier';
  try {
    const orders = await api('/orders');
    el.innerHTML = `<h1>${t(supplier ? 'o.sup' : 'o.buyer')}</h1>` + (orders.length ? `<div class="tablewrap"><table><thead><tr><th>${t('o.order')}</th><th>${t('o.items')}</th><th>${t('o.total')}</th><th>${t('o.status')}</th></tr></thead><tbody>${orders.map((o) => `<tr>
      <td>#${o.order_number}<br><span class="muted">${date(o.created_at)}</span></td>
      <td>${o.items.map((i) => `${i.quantity}× ${esc(i.name)}`).join('<br>')}</td><td>${money(o.total_amount)}</td>
      <td>${supplier ? `<select data-id="${o.id}" aria-label="${t('o.aria', { n: o.order_number })}">${STATUSES.filter((k) => k !== 'pending' || o.status === 'pending').map((k) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${t('s.' + k)}</option>`).join('')}</select>` : t('s.' + o.status)}</td></tr>`).join('')}</tbody></table></div>` : `<p>${t('o.none')}</p>`);
    el.querySelectorAll('select[data-id]').forEach((s) => s.addEventListener('change', async () => {
      try { await api(`/orders/${s.dataset.id}/status`, { method: 'PATCH', body: { status: s.value } }); toast(t('o.updated')); } catch (e) { toast(e.message); }
    }));
  } catch (e) { el.textContent = e.message; }
}
