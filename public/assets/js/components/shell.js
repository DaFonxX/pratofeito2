import { $, html, on, render } from '../core/dom.js';
import { icon, logo } from '../core/icons.js';
import { LOCALES, getLocale, onLocaleChange, setLocale, t } from '../core/i18n.js';
import { onThemeChange, resolvedTheme, toggleTheme } from '../core/theme.js';
import { cart, session } from '../core/store.js';
import { homeFor, navigate, onRouteChange } from '../core/router.js';
import { money } from '../core/format.js';
import { openBag } from './bag.js';
import { toast, toastError } from '../core/ui.js';
import { patch } from '../core/api.js';
import { canInstall, promptInstall, onInstallChange } from '../core/pwa.js';

function navLinks(user) {
  if (user?.role === 'supplier') {
    return [
      ['/painel', 'nav.dashboard', 'home'],
      ['/painel/pedidos', 'nav.storeOrders', 'receipt'],
      ['/painel/ofertas', 'nav.offers', 'box'],
      ['/painel/relatorios', 'nav.reports', 'chart'],
    ];
  }
  if (user?.role === 'admin') {
    return [
      ['/admin', 'nav.reports', 'chart'],
      ['/admin/usuarios', 'nav.users', 'users'],
      ['/admin/seguranca', 'nav.security', 'shield'],
      ['/explorar', 'nav.explore', 'compass'],
    ];
  }
  return [
    ['/', 'nav.home', 'home'],
    ['/explorar', 'nav.explore', 'compass'],
    ['/pedidos', 'nav.orders', 'receipt'],
  ];
}

const isCurrent = (href) => {
  const path = location.pathname;
  if (href === '/' || href === '/painel' || href === '/admin') return path === href;
  return path === href || path.startsWith(`${href}/`);
};

function header() {
  const user = session.user;
  const shopper = !user || user.role === 'buyer';
  const links = navLinks(user).filter(([href]) => href !== '/' && (href !== '/pedidos' || user));
  const count = cart.count();
  const current = LOCALES.find((l) => l.code === getLocale());
  const dark = resolvedTheme() === 'dark';
  return html`<div class="container">
    <a class="brand" href="${homeFor(user)}" aria-label="${t('nav.homeAria')}">${logo()}<span>PratoFeito</span></a>
    <nav class="header-nav" aria-label="${t('nav.main')}">
      ${links.map(([href, key]) => html`<a href="${href}" ${isCurrent(href) ? html`aria-current="page"` : ''}>${t(key)}</a>`)}
      ${!user ? html`<a href="/como-funciona" ${isCurrent('/como-funciona') ? html`aria-current="page"` : ''}>${t('nav.how')}</a>` : ''}
    </nav>
    ${shopper ? html`<form class="header-search" role="search" data-form="search">
      <label class="visually-hidden" for="header-q">${t('search.label')}</label>
      <div class="input-affix">${icon('search')}<input class="input" id="header-q" name="q" type="search" placeholder="${t('search.placeholder')}" autocomplete="off" maxlength="60"></div>
    </form>` : ''}
    <div class="header-actions">
      <div class="menu-wrap">
        <button type="button" class="lang-btn" data-action="menu" data-menu="lang" aria-haspopup="menu" aria-expanded="false" aria-label="${t('settings.language')}: ${current.label}">
          ${icon('globe')}<span>${current.short}</span>
        </button>
        <div class="menu" role="menu" data-menu-panel="lang" hidden>
          <p class="menu-label">${t('settings.language')}</p>
          ${LOCALES.map((l) => html`<button type="button" class="menu-item" role="menuitemradio" aria-checked="${l.code === getLocale()}" data-action="locale" data-locale="${l.code}" lang="${l.code}">${l.label}</button>`)}
        </div>
      </div>
      <button type="button" class="icon-btn" data-action="theme" aria-label="${dark ? t('settings.useLight') : t('settings.useDark')}" title="${dark ? t('settings.useLight') : t('settings.useDark')}">
        ${icon(dark ? 'sun' : 'moon')}
      </button>
      ${shopper ? html`<button type="button" class="icon-btn" data-action="bag" aria-label="${t('bag.open', { count })}">
        ${icon('bag')}${count ? html`<span class="count" aria-hidden="true">${count}</span>` : ''}
      </button>` : ''}
      ${user ? accountMenu(user) : html`<a class="btn btn-sm btn-primary account-btn" href="/entrar">${t('nav.signIn')}</a>`}
    </div>
  </div>`;
}

function accountMenu(user) {
  const initial = user.name.trim().charAt(0).toUpperCase();
  return html`<div class="menu-wrap">
    <button type="button" class="avatar-btn" data-action="menu" data-menu="account" aria-haspopup="menu" aria-expanded="false" aria-label="${t('nav.accountMenu', { name: user.name })}">
      <span class="avatar" aria-hidden="true">${initial}</span>
    </button>
    <div class="menu" role="menu" data-menu-panel="account" hidden>
      <p class="menu-label">${user.name}<br><span class="tiny">${user.store ? user.store.name : t(`roles.${user.role}`)}</span></p>
      ${user.role === 'buyer' ? html`
        <a class="menu-item" role="menuitem" href="/pedidos">${icon('receipt')}${t('nav.orders')}</a>
        <a class="menu-item" role="menuitem" href="/impacto">${icon('leaf')}${t('nav.impact')}</a>` : ''}
      ${user.role === 'supplier' ? html`
        <a class="menu-item" role="menuitem" href="/painel/loja">${icon('store')}${t('nav.myStore')}</a>
        <a class="menu-item" role="menuitem" href="/loja/${user.store?.id ?? ''}">${icon('eye')}${t('nav.viewStore')}</a>` : ''}
      <a class="menu-item" role="menuitem" href="/conta">${icon('user')}${t('nav.account')}</a>
      <div class="menu-sep"></div>
      <button type="button" class="menu-item" role="menuitem" data-action="logout">${icon('logout')}${t('nav.signOut')}</button>
    </div>
  </div>`;
}

function tabbar() {
  const user = session.user;
  const links = navLinks(user).slice(0, 4);
  if (!user) links.push(['/entrar', 'nav.signIn', 'user']);
  else if (user.role === 'buyer') links.push(['/conta', 'nav.account', 'user']);
  else if (user.role === 'admin') links.splice(3, 1, ['/conta', 'nav.account', 'user']);
  return html`${links.slice(0, 5).map(([href, key, ic]) => html`<a href="${href}" ${isCurrent(href) ? html`aria-current="page"` : ''}>${icon(ic)}<span>${t(key)}</span></a>`)}`;
}

function footer() {
  const user = session.user;
  return html`<div class="container">
    <div class="footer-grid">
      <div class="stack-sm">
        <a class="brand" href="/">${logo(30)}<span>PratoFeito</span></a>
        <p>${t('footer.about')}</p>
      </div>
      <div>
        <h2>${t('footer.shop')}</h2>
        <ul>
          <li><a href="/explorar">${t('footer.allOffers')}</a></li>
          <li><a href="/explorar?price=free">${t('footer.freeToday')}</a></li>
          <li><a href="/lojas">${t('footer.stores')}</a></li>
          <li><a href="/como-funciona">${t('nav.how')}</a></li>
        </ul>
      </div>
      <div>
        <h2>${t('footer.business')}</h2>
        <ul>
          <li><a href="${user?.role === 'supplier' ? '/painel' : '/cadastro?tipo=loja'}">${t('footer.sell')}</a></li>
          <li><a href="/como-funciona#lojas">${t('footer.howBusiness')}</a></li>
        </ul>
      </div>
      <div>
        <h2>${t('footer.platform')}</h2>
        <ul>
          <li><a href="/privacidade">${t('footer.privacy')}</a></li>
          <li><a href="/termos">${t('footer.terms')}</a></li>
          ${canInstall() ? html`<li><button type="button" class="link-btn" data-action="install">${t('pwa.install')}</button></li>` : ''}
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>${t('footer.copyright', { year: new Date().getFullYear() })}</span>
      <span>${t('footer.school')}</span>
    </div>
  </div>`;
}

function bagBar() {
  const user = session.user;
  const state = cart.get();
  if (!state || (user && user.role !== 'buyer') || /^\/(finalizar|entrar|cadastro)/.test(location.pathname)) return '';
  return html`<button type="button" class="bag-bar" data-action="bag">
    ${icon('bag')}<span>${t('bag.view', { count: cart.count() })}</span><span class="bag-total">${money(cart.subtotal())}</span>
  </button>`;
}

function closeMenus(except = null) {
  for (const btn of document.querySelectorAll('[data-action="menu"][aria-expanded="true"]')) {
    if (btn === except) continue;
    btn.setAttribute('aria-expanded', 'false');
    btn.parentElement.querySelector('[data-menu-panel]').hidden = true;
  }
}

export function renderShell() {
  const headerEl = document.getElementById('app-header');
  const footerEl = document.getElementById('app-footer');
  const tabbarEl = document.getElementById('app-tabbar');
  const bagEl = document.getElementById('bag-bar-root');

  const draw = () => {
    const focusedAction = document.activeElement?.closest('#app-header')?.dataset?.action;
    render(headerEl, header());
    render(footerEl, footer());
    render(tabbarEl, tabbar());
    tabbarEl.hidden = false;
    tabbarEl.setAttribute('aria-label', t('nav.main'));
    document.body.classList.add('has-tabbar');
    render(bagEl, bagBar());
    if (focusedAction) headerEl.querySelector(`[data-action="${focusedAction}"]`)?.focus();
  };

  const onAction = async (e, el) => {
    const action = el.dataset.action;
    if (action === 'menu') {
      const panel = el.parentElement.querySelector('[data-menu-panel]');
      const open = el.getAttribute('aria-expanded') !== 'true';
      closeMenus(el);
      el.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (open) panel.querySelector('.menu-item')?.focus();
      return;
    }
    if (action === 'locale') {
      closeMenus();
      await setLocale(el.dataset.locale);
      if (session.user && session.user.locale !== el.dataset.locale) {
        patch('/account', { locale: el.dataset.locale }).then((u) => { session.user.locale = u.locale; }).catch(() => {});
      }
      return;
    }
    if (action === 'theme') { toggleTheme(); return; }
    if (action === 'bag') { openBag(); return; }
    if (action === 'install') { promptInstall(); return; }
    if (action === 'logout') {
      closeMenus();
      try {
        await session.logout();
        toast(t('auth.signedOut'));
        navigate('/');
      } catch (err) { toastError(err); }
    }
  };

  for (const el of [headerEl, footerEl, bagEl]) on(el, 'click', '[data-action]', onAction);
  on(headerEl, 'submit', '[data-form="search"]', (e, form) => {
    e.preventDefault();
    const q = form.q.value.trim();
    navigate(q ? `/explorar?q=${encodeURIComponent(q)}` : '/explorar');
    form.q.blur();
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('[data-action="menu"][aria-expanded="true"]');
    if (open) { closeMenus(); open.focus(); }
  });
  headerEl.addEventListener('keydown', (e) => {
    const panel = e.target.closest('[data-menu-panel]');
    if (!panel || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const items = [...panel.querySelectorAll('.menu-item')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  });

  draw();
  session.subscribe(draw);
  cart.subscribe(draw);
  onLocaleChange(draw);
  onThemeChange(draw);
  onRouteChange(draw);
  onInstallChange(draw);
  return draw;
}

export const shellSearchFocus = () => $('#header-q')?.focus();
