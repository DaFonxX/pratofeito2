import { html, on, render } from '../core/dom.js';
import { icon, logo } from '../core/icons.js';
import { getLocale, setLocale, t } from '../core/i18n.js';
import { post } from '../core/api.js';
import { session } from '../core/store.js';
import { homeFor, navigate } from '../core/router.js';
import { busy, handleFormError, toast } from '../core/ui.js';
import { enhanceForms, formValues } from '../core/forms.js';
import { field, passwordField } from '../components/common.js';

export const safeNext = (value) => (typeof value === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(value) && !value.startsWith('/api/') ? value : null);

export async function afterAuth(user, next) {
  session.setUser(user);
  let saved = null;
  try { saved = localStorage.getItem('pf.lang'); } catch { saved = null; }
  if (user.locale && !saved && user.locale !== getLocale()) await setLocale(user.locale);
  toast(t('auth.welcome', { name: user.name.split(' ')[0] }));
  const target = safeNext(next);
  const allowed = target && !(user.role !== 'buyer' && /^\/(finalizar|pedidos|impacto)/.test(target));
  navigate(allowed ? target : homeFor(user), { replace: true });
}

export default function login({ root, query }) {
  const next = query.get('next');
  const demo = session.meta?.demo;
  render(root, html`<div class="container page auth-page">
    <div class="auth-card">
      <div class="auth-brand">${logo(44)}</div>
      <h1>${t('auth.loginTitle')}</h1>
      <p class="muted">${t('auth.loginLead')}</p>
      <form class="stack" data-form="login" novalidate>
        ${field({ name: 'email', label: t('auth.email'), type: 'email', required: true, autocomplete: 'username', inputmode: 'email' })}
        ${passwordField({ name: 'password', label: t('auth.password') })}
        <button type="submit" class="btn btn-primary btn-lg btn-block">${t('auth.loginButton')}</button>
      </form>
      <p class="auth-switch">${t('auth.noAccount')} <a href="/cadastro${next ? `?next=${encodeURIComponent(next)}` : ''}">${t('auth.createAccount')}</a></p>
    </div>
    ${demo ? html`<aside class="demo-card" aria-labelledby="demo-title">
      <h2 id="demo-title">${t('auth.demoTitle')}</h2>
      <p class="small muted">${t('auth.demoText')}</p>
      <div class="demo-accounts">
        ${demo.accounts.map((a) => html`<button type="button" class="demo-account" data-action="demo" data-email="${a.email}">
          <span class="demo-icon" aria-hidden="true">${a.role === 'buyer' ? '🧑' : a.role === 'supplier' ? '🍲' : '🛡️'}</span>
          <span><strong>${t(`roles.${a.role}`)}</strong><span class="tiny muted">${a.email}</span></span>
          ${icon('chevron-right')}
        </button>`)}
      </div>
      <p class="tiny muted">${t('auth.demoPassword')} <code>${demo.password}</code></p>
    </aside>` : ''}
  </div>`);

  enhanceForms(root);
  const form = root.querySelector('[data-form="login"]');

  const doLogin = async (email, password, button) => busy(button, async () => {
    try {
      const { user } = await post('/auth/login', { email, password });
      await afterAuth(user, next);
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') {
        handleFormError(form, { ...err, details: { fields: { password: 'invalid_credentials' } } });
      } else {
        handleFormError(form, err);
      }
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { email, password } = formValues(form);
    if (!email || !password) {
      handleFormError(form, { code: 'VALIDATION_ERROR', details: { fields: { ...(email ? {} : { email: 'required' }), ...(password ? {} : { password: 'required' }) } } });
      return;
    }
    doLogin(email.trim(), password, form.querySelector('button[type="submit"]'));
  });

  on(root, 'click', '[data-action="demo"]', (e, btn) => doLogin(btn.dataset.email, demo.password, btn));
  return { title: t('auth.loginTitle') };
}
