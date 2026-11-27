import { debounce, html, on, render, withQuery } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { get, patch } from '../../core/api.js';
import { date, number } from '../../core/format.js';
import { session } from '../../core/store.js';
import { confirmDialog, toast, toastError } from '../../core/ui.js';
import { emptyState, pager } from '../../components/common.js';

export default async function adminUsers({ root }) {
  const state = { q: '', role: '', status: '', page: 1 };
  let data = null;

  render(root, html`<div class="container page">
    <div class="page-head"><div><h1>${t('admin.usersTitle')}</h1><p>${t('admin.usersLead')}</p></div></div>
    <div class="toolbar">
      <div class="input-affix grow">${icon('search')}<label class="visually-hidden" for="u-q">${t('admin.searchUsers')}</label>
        <input class="input" id="u-q" type="search" placeholder="${t('admin.searchUsers')}" maxlength="60"></div>
      <label class="visually-hidden" for="u-role">${t('admin.role')}</label>
      <select class="input" id="u-role" data-filter="role">
        <option value="">${t('admin.allRoles')}</option>
        ${['buyer', 'supplier', 'admin'].map((r) => html`<option value="${r}">${t(`roles.${r}`)}</option>`)}
      </select>
      <label class="visually-hidden" for="u-status">${t('admin.status')}</label>
      <select class="input" id="u-status" data-filter="status">
        <option value="">${t('admin.allStatuses')}</option>
        <option value="active">${t('admin.active')}</option>
        <option value="suspended">${t('admin.suspended')}</option>
      </select>
    </div>
    <div data-slot="table" aria-live="polite"></div>
  </div>`);

  const slot = root.querySelector('[data-slot="table"]');

  async function load() {
    slot.classList.add('is-loading');
    try {
      data = await get(withQuery('/admin/users', state));
      render(slot, data.items.length ? html`
        <p class="small muted">${t('admin.usersCount', { count: data.total })}</p>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>${t('auth.name')}</th><th>${t('admin.role')}</th><th>${t('auth.city')}</th><th class="num">${t('nav.orders')}</th><th>${t('admin.since')}</th><th>${t('admin.lastLogin')}</th><th>${t('admin.status')}</th><th><span class="visually-hidden">${t('admin.actions')}</span></th></tr></thead>
          <tbody>${data.items.map((u) => html`<tr>
            <td><strong>${u.name}</strong><br><span class="tiny muted">${u.email}</span>${u.store_name ? html`<br><span class="tiny">${icon('store')} ${u.store_name}</span>` : ''}</td>
            <td>${t(`roles.${u.role}`)}</td>
            <td>${u.city ?? '—'}</td>
            <td class="num">${number(u.orders_count)}</td>
            <td class="small">${date(u.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            <td class="small">${u.last_login_at ? date(u.last_login_at, { day: '2-digit', month: 'short' }) : '—'}</td>
            <td><span class="badge ${u.status === 'active' ? 'badge-couve' : 'badge-tomate'}">${t(`admin.${u.status}`)}</span></td>
            <td>${u.role !== 'admin' && u.id !== session.user.id ? html`<button type="button" class="btn btn-sm ${u.status === 'active' ? 'btn-danger' : ''}" data-action="status" data-id="${u.id}" data-name="${u.name}" data-next="${u.status === 'active' ? 'suspended' : 'active'}">
              ${u.status === 'active' ? t('admin.suspend') : t('admin.reactivate')}</button>` : ''}</td>
          </tr>`)}</tbody>
        </table></div>
        ${pager({ page: data.page, pageSize: data.pageSize, total: data.total })}` : emptyState({ title: t('admin.noUsers'), illustration: false }));
    } catch (err) { toastError(err); } finally { slot.classList.remove('is-loading'); }
  }

  const search = debounce((v) => { state.q = v.trim(); state.page = 1; load(); }, 300);
  on(root, 'input', '#u-q', (e, input) => search(input.value));
  on(root, 'change', '[data-filter]', (e, select) => { state[select.dataset.filter] = select.value; state.page = 1; load(); });
  on(root, 'click', '[data-action]', async (e, el) => {
    if (el.dataset.action === 'page') { state.page = Number(el.dataset.page); load(); return; }
    if (el.dataset.action === 'status') {
      const suspending = el.dataset.next === 'suspended';
      const ok = await confirmDialog({
        title: suspending ? t('admin.suspendTitle', { name: el.dataset.name }) : t('admin.reactivateTitle', { name: el.dataset.name }),
        message: suspending ? t('admin.suspendText') : '',
        confirm: suspending ? t('admin.suspend') : t('admin.reactivate'),
        danger: suspending,
      });
      if (!ok) return;
      try {
        await patch(`/admin/users/${encodeURIComponent(el.dataset.id)}`, { status: el.dataset.next });
        toast(suspending ? t('admin.suspendedToast') : t('admin.reactivatedToast'));
        load();
      } catch (err) { toastError(err); }
    }
  });

  await load();
  return { title: t('admin.usersTitle') };
}
