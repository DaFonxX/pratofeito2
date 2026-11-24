import { api, session, toast, form, busy } from './utils.js';
import { t } from './i18n.js';
export const isAuth = () => !!session.user;
export const logout = () => { session.token = null; location.hash = '#/'; };
export function renderAuth(el, mode = 'login') {
  const reg = mode === 'register';
  el.innerHTML = `<h1>${t(reg ? 'a.register' : 'a.login')}</h1>
  <form class="stack" id="f">
    ${reg ? `<label>${t('a.type')}<select name="type" id="t"><option value="buyer">${t('a.buyer')}</option><option value="supplier">${t('a.supplier')}</option></select></label>
    <label>${t('a.name')}<input name="name" required minlength="2" autocomplete="name"></label>` : ''}
    <label>${t('a.email')}<input name="email" type="email" required autocomplete="email"></label>
    <label>${t('a.password')}<input name="password" type="password" required minlength="8" autocomplete="${reg ? 'new-password' : 'current-password'}">${reg ? `<span class="hint">${t('a.pwHint')}</span>` : ''}</label>
    ${reg ? `<label>${t('a.city')}<input name="city" autocomplete="address-level2"></label><label>${t('a.address')}<input name="address" autocomplete="street-address"></label>
    <div id="sup" hidden class="stack"><label>${t('a.cnpj')}<input name="cnpj" placeholder="00.000.000/0000-00" inputmode="numeric"></label><label>${t('a.estab')}<input name="establishment_type"></label></div>` : ''}
    <button class="btn primary">${t(reg ? 'nav.register' : 'nav.login')}</button>
    <a href="#/${reg ? 'login' : 'register'}">${t(reg ? 'a.have' : 'nav.register')}</a>
  </form>`;
  const f = el.querySelector('#f'), sup = el.querySelector('#sup');
  el.querySelector('#t')?.addEventListener('change', (e) => {
    const on = e.target.value === 'supplier'; sup.hidden = !on; sup.querySelector('[name=cnpj]').required = on;
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = form(f); if (data.type !== 'supplier') { delete data.cnpj; delete data.establishment_type; }
    return busy(f.querySelector('button'), async () => {
      try { session.token = (await api(`/auth/${mode}`, { method: 'POST', body: data })).token; location.hash = '#/'; toast(t('a.welcome')); }
      catch (err) { toast(err.message); }
    });
  });
}
