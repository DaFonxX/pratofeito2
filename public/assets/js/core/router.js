import { session } from './store.js';
import { announce, progressDone, progressStart } from './ui.js';
import { t } from './i18n.js';

let routes = [];
let current = null;
let renderToken = 0;
const listeners = new Set();
const scrollPositions = new Map();

function compile(path) {
  if (path === '*') return { re: /(?!)/, keys: [] };
  const keys = [];
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}/?$`);
  return { re, keys };
}

export function defineRoutes(list) {
  routes = list.map((r) => ({ ...r, ...compile(r.path) }));
}

function match(pathname) {
  for (const route of routes) {
    const m = route.re.exec(pathname);
    if (m) {
      const params = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route, params };
    }
  }
  return null;
}

export const currentRoute = () => current;
export const onRouteChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function navigate(to, { replace = false, keepScroll = false } = {}) {
  const url = new URL(to, location.origin);
  if (url.origin !== location.origin) { location.href = to; return; }
  const key = history.state?.key;
  if (key) scrollPositions.set(key, window.scrollY);
  const state = { key: Math.random().toString(36).slice(2) };
  if (replace) history.replaceState(state, '', url.pathname + url.search + url.hash);
  else history.pushState(state, '', url.pathname + url.search + url.hash);
  return renderCurrent({ scroll: keepScroll ? 'keep' : 'top' });
}

export function updateQuery(params, { replace = true } = {}) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) url.searchParams.delete(k);
    else url.searchParams.set(k, v === true ? '1' : String(v));
  }
  const state = history.state ?? { key: Math.random().toString(36).slice(2) };
  if (replace) history.replaceState(state, '', url.pathname + url.search);
  else history.pushState({ key: Math.random().toString(36).slice(2) }, '', url.pathname + url.search);
}

export const refresh = () => renderCurrent({ scroll: 'keep' });

async function renderCurrent({ scroll = 'top' } = {}) {
  const token = ++renderToken;
  const found = match(location.pathname) ?? { route: routes.find((r) => r.path === '*'), params: {} };
  const { route, params } = found;

  if (route.auth) {
    const roles = route.auth === true ? null : [].concat(route.auth);
    if (!session.user) {
      return navigate(`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
    if (roles && !roles.includes(session.user.role)) {
      return navigate(homeFor(session.user), { replace: true });
    }
  }
  if (route.guestOnly && session.user) return navigate(homeFor(session.user), { replace: true });

  progressStart();
  const main = document.getElementById('main');
  try {
    const mod = await route.view();
    if (token !== renderToken) return;
    current?.cleanup?.();
    const root = document.createElement('div');
    root.className = 'view';
    const ctx = { params, query: new URLSearchParams(location.search), root, route };
    const result = (await mod.default(ctx)) ?? {};
    if (token !== renderToken) { result.cleanup?.(); return; }
    main.replaceChildren(root);
    current = { route, params, cleanup: result.cleanup };
    const title = typeof result.title === 'string' ? result.title : t('app.tagline');
    document.title = route.path === '/' ? `PratoFeito | ${t('app.tagline')}` : `${title} | PratoFeito`;
    if (scroll === 'top') window.scrollTo(0, 0);
    else if (scroll === 'restore') window.scrollTo(0, scrollPositions.get(history.state?.key) ?? 0);
    if (scroll !== 'keep') {
      const heading = root.querySelector('h1');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      announce(title);
    }
    for (const fn of listeners) fn(route, params);
  } catch (err) {
    console.error(err);
    if (token === renderToken) {
      const failed = await import('../views/error.js');
      const root = document.createElement('div');
      await failed.default({ root, error: err });
      main.replaceChildren(root);
    }
  } finally {
    if (token === renderToken) progressDone();
  }
}

export function homeFor(user) {
  if (!user) return '/';
  if (user.role === 'supplier') return '/painel';
  if (user.role === 'admin') return '/admin';
  return '/';
}

export function startRouter() {
  if (!history.state?.key) history.replaceState({ key: Math.random().toString(36).slice(2) }, '');
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.external !== undefined) return;
    const url = new URL(a.href, location.origin);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    if (url.pathname === location.pathname && url.search === location.search && url.hash) {
      document.getElementById(url.hash.slice(1))?.scrollIntoView();
      return;
    }
    navigate(url.pathname + url.search + url.hash);
  });
  window.addEventListener('popstate', () => renderCurrent({ scroll: 'restore' }));
  return renderCurrent({ scroll: 'top' });
}
