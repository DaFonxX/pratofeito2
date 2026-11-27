import { html, on, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { LOCALES, getLocale, setLocale, t } from '../core/i18n.js';
import { get, patch, post } from '../core/api.js';
import { ago, dateLong } from '../core/format.js';
import { session } from '../core/store.js';
import { navigate } from '../core/router.js';
import { getThemePreference, setThemePreference } from '../core/theme.js';
import { busy, formDialog, handleFormError, toast, toastError } from '../core/ui.js';
import { enhanceForms, formValues } from '../core/forms.js';
import { canInstall, isStandalone, promptInstall } from '../core/pwa.js';
import { field, passwordField } from '../components/common.js';
import { maskPhone } from './register.js';

function deviceName(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : t('account.unknownBrowser');
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? t('account.browserOn', { browser, os }) : browser;
}

export default async function account({ root }) {
  let data = await get('/account');

  const draw = () => {
    const u = data.user;
    const pref = getThemePreference();
    render(root, html`<div class="container page account-page">
      <div class="page-head"><div><h1>${t('account.title')}</h1><p>${t('account.lead', { date: dateLong(u.createdAt) })}</p></div></div>
      <div class="account-grid">
        <nav class="account-nav" aria-label="${t('account.sections')}">
          <a href="#perfil">${icon('user')}${t('account.profile')}</a>
          <a href="#preferencias">${icon('sliders')}${t('account.preferences')}</a>
          <a href="#seguranca">${icon('lock')}${t('account.security')}</a>
          <a href="#dados">${icon('shield')}${t('account.privacy')}</a>
        </nav>
        <div class="account-sections">
          <section class="panel" id="perfil" aria-labelledby="h-perfil">
            <h2 class="panel-title" id="h-perfil">${t('account.profile')}</h2>
            <form class="form-grid cols-2" data-form="profile" novalidate>
              <div class="span-2">${field({ name: 'name', label: t('auth.name'), value: u.name, required: true, autocomplete: 'name', attrs: 'maxlength="80"' })}</div>
              <div class="field span-2"><label for="f-email">${t('auth.email')}</label><input class="input" id="f-email" value="${u.email}" disabled></div>
              ${field({ name: 'phone', label: t('auth.phone'), type: 'tel', value: u.phone ? maskPhone(u.phone) : '', autocomplete: 'tel', attrs: 'data-mask="phone"' })}
              ${field({ name: 'city', label: t('auth.city'), value: u.city, autocomplete: 'address-level2', attrs: 'maxlength="60"' })}
              ${field({ name: 'neighborhood', label: t('auth.neighborhood'), value: u.neighborhood, attrs: 'maxlength="60"' })}
              ${field({ name: 'address', label: t('auth.address'), value: u.address, autocomplete: 'street-address', attrs: 'maxlength="160"' })}
              <div class="span-2"><button type="submit" class="btn btn-primary">${t('common.saveChanges')}</button></div>
            </form>
          </section>

          <section class="panel" id="preferencias" aria-labelledby="h-pref">
            <h2 class="panel-title" id="h-pref">${t('account.preferences')}</h2>
            <div class="pref-row">
              <div><p class="label">${t('settings.language')}</p><p class="small muted">${t('account.languageHint')}</p></div>
              <div class="segmented" role="group" aria-label="${t('settings.language')}">
                ${LOCALES.map((l) => html`<button type="button" data-action="locale" data-locale="${l.code}" aria-pressed="${String(getLocale() === l.code)}" lang="${l.code}">${l.label}</button>`)}
              </div>
            </div>
            <div class="pref-row">
              <div><p class="label">${t('settings.theme')}</p><p class="small muted">${t('account.themeHint')}</p></div>
              <div class="segmented" role="group" aria-label="${t('settings.theme')}">
                ${['light', 'dark', 'system'].map((m) => html`<button type="button" data-action="theme" data-theme-pref="${m}" aria-pressed="${String(pref === m)}">${icon(m === 'light' ? 'sun' : m === 'dark' ? 'moon' : 'phone-app')}${t(`settings.${m}`)}</button>`)}
              </div>
            </div>
            <div class="pref-row">
              <div><p class="label">${t('pwa.title')}</p><p class="small muted">${isStandalone() ? t('pwa.alreadyInstalled') : t('pwa.hint')}</p></div>
              ${canInstall() ? html`<button type="button" class="btn" data-action="install">${icon('download')}${t('pwa.install')}</button>` : ''}
            </div>
          </section>

          <section class="panel" id="seguranca" aria-labelledby="h-sec">
            <h2 class="panel-title" id="h-sec">${t('account.security')}</h2>
            <form class="stack" data-form="password" novalidate>
              ${passwordField({ name: 'currentPassword', label: t('account.currentPassword') })}
              ${passwordField({ name: 'newPassword', label: t('account.newPassword'), autocomplete: 'new-password', strength: true, hint: t('auth.passwordHint') })}
              <div><button type="submit" class="btn btn-primary">${t('account.changePassword')}</button></div>
            </form>
            <h3 class="subhead">${t('account.sessions')}</h3>
            <ul class="session-list">
              ${data.sessions.map((s) => html`<li>
                ${icon('phone-app')}
                <span class="grow"><strong>${deviceName(s.userAgent)}</strong><span class="tiny muted">${t('account.lastSeen', { when: ago(s.lastSeenAt) })}</span></span>
                ${s.current ? html`<span class="badge badge-couve">${t('account.thisDevice')}</span>` : ''}
              </li>`)}
            </ul>
            ${data.sessions.length > 1 ? html`<button type="button" class="btn" data-action="revoke">${icon('logout')}${t('account.signOutOthers')}</button>` : ''}
          </section>

          <section class="panel" id="dados" aria-labelledby="h-dados">
            <h2 class="panel-title" id="h-dados">${t('account.privacy')}</h2>
            <p class="small muted">${t('account.privacyText')}</p>
            <div class="row">
              <a class="btn" href="/api/account/export" download>${icon('download')}${t('account.export')}</a>
              ${u.role !== 'admin' ? html`<button type="button" class="btn btn-danger" data-action="delete">${icon('trash')}${t('account.delete')}</button>` : ''}
            </div>
          </section>

          <button type="button" class="btn btn-ghost" data-action="logout">${icon('logout')}${t('nav.signOut')}</button>
        </div>
      </div>
    </div>`);
    enhanceForms(root);
  };
  draw();

  on(root, 'input', '[data-mask="phone"]', (e, input) => { input.value = maskPhone(input.value); });

  on(root, 'submit', '[data-form="profile"]', async (e, form) => {
    e.preventDefault();
    const v = formValues(form);
    const body = { name: v.name, phone: v.phone ?? '', city: v.city ?? '', neighborhood: v.neighborhood ?? '', address: v.address ?? '' };
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const user = await patch('/account', body);
        session.setUser(user);
        data.user = user;
        toast(t('account.saved'));
      } catch (err) { handleFormError(form, err); }
    });
  });

  on(root, 'submit', '[data-form="password"]', async (e, form) => {
    e.preventDefault();
    const v = formValues(form);
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const res = await post('/account/password', v);
        form.reset();
        toast(t('account.passwordChanged', { count: res.otherSessionsClosed }));
        data = await get('/account');
        draw();
      } catch (err) { handleFormError(form, err); }
    });
  });

  on(root, 'click', '[data-action]', async (e, el) => {
    const action = el.dataset.action;
    if (action === 'locale') {
      await setLocale(el.dataset.locale);
      patch('/account', { locale: el.dataset.locale }).then((u) => session.setUser(u)).catch(() => {});
    }
    if (action === 'theme') { setThemePreference(el.dataset.themePref); draw(); }
    if (action === 'install') { await promptInstall(); draw(); }
    if (action === 'revoke') {
      await busy(el, async () => {
        try {
          const r = await post('/account/sessions/revoke-others');
          toast(t('account.othersSignedOut', { count: r.closed }));
          data = await get('/account');
          draw();
        } catch (err) { toastError(err); }
      });
    }
    if (action === 'logout') {
      await session.logout();
      toast(t('auth.signedOut'));
      navigate('/');
    }
    if (action === 'delete') {
      const values = await formDialog({
        title: t('account.deleteTitle'),
        description: t(data.user.role === 'supplier' ? 'account.deleteTextSupplier' : 'account.deleteText'),
        fields: passwordField({ name: 'password', label: t('account.confirmWithPassword') }),
        submit: t('account.deleteConfirm'),
        danger: true,
        validate: (vals) => (vals.password ? null : { password: 'required' }),
      });
      if (!values) return;
      try {
        await post('/account/delete', { password: values.password });
        session.setUser(null);
        toast(t('account.deleted'));
        navigate('/');
      } catch (err) { toastError(err); }
    }
  });

  return { title: t('account.title') };
}
