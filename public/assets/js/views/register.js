import { html, on, render } from '../core/dom.js';
import { logo } from '../core/icons.js';
import { getLocale, t } from '../core/i18n.js';
import { post } from '../core/api.js';
import { busy, handleFormError, showFieldErrors } from '../core/ui.js';
import { enhanceForms, formValues } from '../core/forms.js';
import { STORE_TYPES } from '../core/catalog.js';
import { field, passwordField } from '../components/common.js';
import { afterAuth } from './login.js';

export function isValidCnpj(value) {
  const c = String(value).toUpperCase().replace(/[.\-/\s]/g, '');
  if (!/^[A-Z0-9]{12}\d{2}$/.test(c) || /^(.)\1{13}$/.test(c)) return false;
  const digit = (base) => {
    let sum = 0;
    let w = base.length - 7;
    for (const ch of base) { sum += (ch.charCodeAt(0) - 48) * w; w = w === 2 ? 9 : w - 1; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digit(c.slice(0, 12));
  return c.slice(12) === `${d1}${digit(c.slice(0, 12) + d1)}`;
}

export function maskCnpj(value) {
  const c = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
  return [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8)].filter(Boolean).join('.')
    + (c.length > 8 ? `/${c.slice(8, 12)}` : '') + (c.length > 12 ? `-${c.slice(12)}` : '');
}

export function maskPhone(value) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function register({ root, query }) {
  let role = query.get('tipo') === 'loja' ? 'supplier' : 'buyer';
  const next = query.get('next');

  const fields = () => (role === 'supplier'
    ? html`
      <h2 class="form-section">${t('auth.storeSection')}</h2>
      <div class="form-grid cols-2">
        <div class="span-2">${field({ name: 'storeName', label: t('auth.storeName'), required: true, autocomplete: 'organization', attrs: 'maxlength="80"' })}</div>
        <div class="field">
          <label for="f-storeType">${t('auth.storeType')}</label>
          <select class="input" id="f-storeType" name="storeType" required>
            ${STORE_TYPES.map((s) => html`<option value="${s}">${t(`storeTypes.${s}`)}</option>`)}
          </select>
        </div>
        ${field({ name: 'cnpj', label: t('auth.cnpj'), required: true, hint: t('auth.cnpjHint'), attrs: 'maxlength="18" data-mask="cnpj"' })}
        ${field({ name: 'phone', label: t('auth.phone'), type: 'tel', required: true, autocomplete: 'tel', attrs: 'data-mask="phone"' })}
        ${field({ name: 'city', label: t('auth.city'), required: true, autocomplete: 'address-level2', attrs: 'maxlength="60"' })}
        <div class="span-2">${field({ name: 'address', label: t('auth.storeAddress'), required: true, autocomplete: 'street-address', attrs: 'maxlength="160"' })}</div>
        ${field({ name: 'neighborhood', label: t('auth.neighborhood'), required: true, attrs: 'maxlength="60"' })}
      </div>
      <h2 class="form-section">${t('auth.responsibleSection')}</h2>`
    : html`<h2 class="form-section">${t('auth.aboutYou')}</h2>`);

  const draw = () => {
    render(root, html`<div class="container page auth-page">
      <div class="auth-card auth-card-wide">
        <div class="auth-brand">${logo(44)}</div>
        <h1>${t('auth.registerTitle')}</h1>
        <p class="muted">${t('auth.registerLead')}</p>
        <div class="choice-grid account-type" role="radiogroup" aria-label="${t('auth.accountType')}">
          <label class="choice"><input type="radio" name="role" value="buyer" ${role === 'buyer' ? 'checked' : ''}><span class="choice-mark" aria-hidden="true"></span>
            <span><strong>${t('auth.typeBuyer')}</strong><small>${t('auth.typeBuyerHint')}</small></span></label>
          <label class="choice"><input type="radio" name="role" value="supplier" ${role === 'supplier' ? 'checked' : ''}><span class="choice-mark" aria-hidden="true"></span>
            <span><strong>${t('auth.typeSupplier')}</strong><small>${t('auth.typeSupplierHint')}</small></span></label>
        </div>
        <form class="stack" data-form="register" novalidate>
          ${fields()}
          <div class="form-grid cols-2">
            <div class="span-2">${field({ name: 'name', label: t('auth.name'), required: true, autocomplete: 'name', attrs: 'maxlength="80"' })}</div>
            <div class="span-2">${field({ name: 'email', label: t('auth.email'), type: 'email', required: true, autocomplete: 'email', inputmode: 'email' })}</div>
            <div class="span-2">${passwordField({ name: 'password', label: t('auth.password'), autocomplete: 'new-password', strength: true, hint: t('auth.passwordHint') })}</div>
            ${role === 'buyer' ? html`
              ${field({ name: 'phone', label: t('auth.phone'), type: 'tel', autocomplete: 'tel', attrs: 'data-mask="phone"' })}
              ${field({ name: 'neighborhood', label: t('auth.neighborhood'), attrs: 'maxlength="60"' })}` : ''}
          </div>
          <label class="check"><input type="checkbox" name="acceptTerms" required>
            <span>${t('auth.acceptStart')} <a href="/termos" target="_blank" rel="noopener">${t('footer.terms')}</a> ${t('auth.acceptAnd')} <a href="/privacidade" target="_blank" rel="noopener">${t('footer.privacy')}</a>.</span></label>
          <button type="submit" class="btn btn-primary btn-lg btn-block">${role === 'supplier' ? t('auth.registerStoreButton') : t('auth.registerButton')}</button>
        </form>
        <p class="auth-switch">${t('auth.haveAccount')} <a href="/entrar${next ? `?next=${encodeURIComponent(next)}` : ''}">${t('auth.loginButton')}</a></p>
      </div>
    </div>`);
    enhanceForms(root);
  };
  draw();

  on(root, 'change', 'input[name="role"]', (e, input) => {
    const form = root.querySelector('[data-form="register"]');
    const keep = formValues(form);
    role = input.value;
    draw();
    const fresh = root.querySelector('[data-form="register"]');
    for (const key of ['name', 'email', 'phone', 'neighborhood']) {
      if (keep[key] && fresh[key]) fresh[key].value = keep[key];
    }
    root.querySelector(`input[name="role"][value="${role}"]`).focus();
  });

  on(root, 'input', '[data-mask]', (e, input) => {
    input.value = input.dataset.mask === 'cnpj' ? maskCnpj(input.value) : maskPhone(input.value);
  });

  on(root, 'submit', '[data-form="register"]', async (e, form) => {
    e.preventDefault();
    const v = formValues(form);
    const errors = {};
    for (const key of ['name', 'email', 'password', ...(role === 'supplier' ? ['storeName', 'cnpj', 'phone', 'city', 'address', 'neighborhood'] : [])]) {
      if (!String(v[key] ?? '').trim()) errors[key] = 'required';
    }
    if (v.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.email.trim())) errors.email = 'invalid_email';
    if (v.password && v.password.length < 8) errors.password = 'too_short';
    if (role === 'supplier' && v.cnpj && !isValidCnpj(v.cnpj)) errors.cnpj = 'invalid_cnpj';
    if (!v.acceptTerms) errors.acceptTerms = 'must_accept';
    if (Object.keys(errors).length) { showFieldErrors(form, errors); return; }

    const body = { role, name: v.name, email: v.email.trim(), password: v.password, acceptTerms: true, locale: getLocale() };
    for (const key of ['phone', 'neighborhood', 'city', 'address', 'storeName', 'storeType', 'cnpj']) {
      if (v[key] !== undefined && String(v[key]).trim()) body[key] = String(v[key]).trim();
    }
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const { user } = await post('/auth/register', body);
        await afterAuth(user, next ?? (role === 'supplier' ? '/painel/ofertas/nova' : null));
      } catch (err) {
        handleFormError(form, err);
      }
    });
  });

  return { title: t('auth.registerTitle') };
}
