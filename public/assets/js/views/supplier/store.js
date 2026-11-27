import { html, on, render } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { get, patch } from '../../core/api.js';
import { centsToInput, parseMoney } from '../../core/format.js';
import { session } from '../../core/store.js';
import { busy, handleFormError, showFieldErrors, toast } from '../../core/ui.js';
import { formValues } from '../../core/forms.js';
import { field } from '../../components/common.js';
import { maskCnpj, maskPhone } from '../register.js';

export default async function storeSettings({ root }) {
  const s = await get('/supplier/store');
  const emojis = session.meta?.storeEmojis ?? [s.emoji];

  render(root, html`<div class="container page page-narrow">
    <div class="page-head">
      <div><h1>${t('supplier.storeTitle')}</h1><p>${t('supplier.storeLead')}</p></div>
      <a class="btn" href="/loja/${encodeURIComponent(s.id)}">${icon('eye')}${t('nav.viewStore')}</a>
    </div>
    <form class="stack" data-form="store" novalidate>
      <section class="panel stack">
        <div class="pref-row">
          <div><p class="label">${t('supplier.storeOpen')}</p><p class="small muted">${t('supplier.storeOpenHint')}</p></div>
          <label class="switch"><input type="checkbox" name="open" ${s.status === 'active' ? 'checked' : ''}><span>${s.status === 'active' ? t('supplier.store_active') : t('supplier.store_paused')}</span></label>
        </div>
      </section>
      <section class="panel stack">
        <h2 class="panel-title">${t('supplier.identity')}</h2>
        ${field({ name: 'name', label: t('auth.storeName'), value: s.name, required: true, attrs: 'maxlength="80"' })}
        <div class="field"><label for="f-cnpj">${t('auth.cnpj')}</label><input class="input" id="f-cnpj" value="${maskCnpj(s.cnpj)}" disabled></div>
        <div class="field"><label for="f-description">${t('supplier.fields.storeDescription')} <span class="muted small">(${t('common.optional')})</span></label>
          <textarea class="input" id="f-description" name="description" maxlength="300">${s.description}</textarea></div>
        <fieldset><legend class="label">${t('supplier.fields.storeEmoji')}</legend>
          <div class="emoji-grid">${emojis.map((e) => html`<label class="emoji-option"><input type="radio" name="emoji" value="${e}" ${s.emoji === e ? 'checked' : ''}><span aria-hidden="true">${e}</span><span class="visually-hidden">${e}</span></label>`)}</div>
        </fieldset>
      </section>
      <section class="panel">
        <h2 class="panel-title">${t('supplier.location')}</h2>
        <div class="form-grid cols-2">
          <div class="span-2">${field({ name: 'address', label: t('auth.storeAddress'), value: s.address, required: true, attrs: 'maxlength="160"' })}</div>
          ${field({ name: 'neighborhood', label: t('auth.neighborhood'), value: s.neighborhood, required: true, attrs: 'maxlength="60"' })}
          ${field({ name: 'city', label: t('auth.city'), value: s.city, required: true, attrs: 'maxlength="60"' })}
          ${field({ name: 'phone', label: t('auth.phone'), type: 'tel', value: s.phone ? maskPhone(s.phone) : '', attrs: 'data-mask="phone"' })}
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-title">${t('supplier.hoursAndDelivery')}</h2>
        <div class="form-grid cols-2">
          <div class="field"><label for="f-opens">${t('supplier.fields.opensAt')}</label><input class="input" id="f-opens" name="opensAt" type="time" value="${s.opensAt}" required></div>
          <div class="field"><label for="f-closes">${t('supplier.fields.closesAt')}</label><input class="input" id="f-closes" name="closesAt" type="time" value="${s.closesAt}" required></div>
          <label class="switch span-2"><input type="checkbox" name="delivery" ${s.delivery ? 'checked' : ''}><span>${t('supplier.fields.delivery')}</span></label>
          <div class="field" data-slot="fee" ${s.delivery ? '' : 'hidden'}><label for="f-fee">${t('supplier.fields.deliveryFee')}</label>
            <div class="input-affix"><span class="affix">R$</span><input class="input" id="f-fee" name="deliveryFeeCents" inputmode="decimal" value="${centsToInput(s.deliveryFeeCents)}"></div>
            <p class="hint">${t('supplier.fields.deliveryFeeHint')}</p></div>
        </div>
      </section>
      <div class="form-actions"><button type="submit" class="btn btn-primary btn-lg">${icon('check')}${t('common.saveChanges')}</button></div>
    </form>
  </div>`);

  const form = root.querySelector('[data-form="store"]');
  on(root, 'input', '[data-mask="phone"]', (e, input) => { input.value = maskPhone(input.value); });
  on(root, 'change', 'input[name="delivery"]', (e, input) => { root.querySelector('[data-slot="fee"]').hidden = !input.checked; });
  on(root, 'change', 'input[name="open"]', (e, input) => {
    input.nextElementSibling.textContent = input.checked ? t('supplier.store_active') : t('supplier.store_paused');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    const fee = v.delivery ? parseMoney(v.deliveryFeeCents || '0') : 0;
    if (v.delivery && (!Number.isFinite(fee) || fee < 0 || fee > 5000)) { showFieldErrors(form, { deliveryFeeCents: 'fee_range' }); return; }
    if (v.closesAt <= v.opensAt) { showFieldErrors(form, { closesAt: 'pickup_end_before_start' }); return; }
    const body = {
      name: v.name, description: v.description ?? '', phone: v.phone ?? '', address: v.address, neighborhood: v.neighborhood,
      city: v.city, emoji: v.emoji, opensAt: v.opensAt, closesAt: v.closesAt, delivery: !!v.delivery,
      deliveryFeeCents: fee, status: v.open ? 'active' : 'paused',
    };
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const updated = await patch('/supplier/store', body);
        if (session.user?.store) session.setUser({ ...session.user, store: { ...session.user.store, name: updated.name } });
        toast(t('supplier.storeSaved'));
      } catch (err) { handleFormError(form, err); }
    });
  });

  return { title: t('supplier.storeTitle') };
}
