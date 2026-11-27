import { html, on, render, withQuery } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t, tMaybe } from '../../core/i18n.js';
import { get } from '../../core/api.js';
import { dateTime } from '../../core/format.js';
import { toastError } from '../../core/ui.js';
import { emptyState, pager } from '../../components/common.js';

const EVENTS = ['auth.login', 'auth.login_failed', 'auth.locked', 'auth.register', 'auth.logout', 'account.password_changed',
  'account.exported', 'account.deleted', 'admin.user_status', 'security.csrf_failed', 'security.forbidden',
  'security.rate_limited', 'security.origin_blocked', 'order.created', 'order.status', 'offer.created', 'offer.imported'];

const tone = (event) => (event.startsWith('security.') || event === 'auth.login_failed' || event === 'auth.locked' ? 'badge-tomate'
  : event.startsWith('admin.') || event.startsWith('account.') ? 'badge-ambar' : 'badge-agata');

export default async function adminAudit({ root }) {
  const state = { event: '', page: 1 };

  render(root, html`<div class="container page">
    <div class="page-head"><div><h1>${t('admin.auditTitle')}</h1><p>${t('admin.auditLead')}</p></div></div>
    <div class="notice">${icon('shield')}<span>${t('admin.auditPrivacy')}</span></div>
    <div class="toolbar">
      <label class="visually-hidden" for="a-event">${t('admin.event')}</label>
      <select class="input" id="a-event">
        <option value="">${t('admin.allEvents')}</option>
        ${EVENTS.map((e) => html`<option value="${e}">${tMaybe(`audit.${e}`) ?? e}</option>`)}
      </select>
    </div>
    <div data-slot="table" aria-live="polite"></div>
  </div>`);
  const slot = root.querySelector('[data-slot="table"]');

  async function load() {
    slot.classList.add('is-loading');
    try {
      const data = await get(withQuery('/admin/audit', state));
      render(slot, data.items.length ? html`<div class="table-wrap"><table class="table">
        <thead><tr><th>${t('admin.when')}</th><th>${t('admin.event')}</th><th>${t('admin.who')}</th><th>${t('admin.ip')}</th><th>${t('admin.details')}</th></tr></thead>
        <tbody>${data.items.map((r) => html`<tr>
          <td class="small nowrap">${dateTime(r.at)}</td>
          <td><span class="badge ${tone(r.event)}">${tMaybe(`audit.${r.event}`) ?? r.event}</span></td>
          <td class="small">${r.user_name ? html`${r.user_name}<br><span class="tiny muted">${t(`roles.${r.user_role}`)}</span>` : html`<span class="muted">—</span>`}</td>
          <td class="small num">${r.ip ?? '—'}</td>
          <td class="tiny muted">${r.details ? Object.entries(r.details).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ') : ''}</td>
        </tr>`)}</tbody>
      </table></div>${pager({ page: data.page, pageSize: data.pageSize, total: data.total })}`
        : emptyState({ title: t('admin.noEvents'), illustration: false }));
    } catch (err) { toastError(err); } finally { slot.classList.remove('is-loading'); }
  }

  on(root, 'change', '#a-event', (e, select) => { state.event = select.value; state.page = 1; load(); });
  on(root, 'click', '[data-action="page"]', (e, btn) => { state.page = Number(btn.dataset.page); load(); });
  await load();
  return { title: t('admin.auditTitle') };
}
