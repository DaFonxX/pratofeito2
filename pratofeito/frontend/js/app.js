import { session } from './utils.js';
import { t, getLang, setLang, LANGS } from './i18n.js';
import { renderAuth, logout } from './auth.js';
import { renderProducts } from './products.js';
import { renderCart, cartCount } from './cart.js';
import { renderOrders } from './orders.js';
import { renderDashboard } from './dashboard.js';
import { renderLogs } from './logs.js';
const view = document.getElementById('view'), nav = document.getElementById('nav'), langSel = document.getElementById('lang');
const routes = {
  '': renderProducts, cart: renderCart, orders: renderOrders, dashboard: renderDashboard, logs: renderLogs,
  login: (el) => renderAuth(el, 'login'), register: (el) => renderAuth(el, 'register'),
};
const protectedRoutes = ['orders', 'dashboard'];
const current = () => location.hash.replace(/^#\/?/, '');

langSel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}" lang="${k}">${v}</option>`).join('');
langSel.addEventListener('change', (e) => setLang(e.target.value));

function applyStatic() {
  document.documentElement.lang = getLang(); document.title = t('app.title');
  document.getElementById('skip').textContent = t('a11y.skip');
  document.getElementById('foot-text').textContent = t('foot.text');
  document.getElementById('foot-logs').textContent = t('foot.logs');
  nav.setAttribute('aria-label', t('a11y.main')); langSel.setAttribute('aria-label', t('a11y.lang')); langSel.value = getLang();
}
function renderNav(route) {
  const u = session.user, a = (h, label) => `<a href="#/${h}" ${route === h ? 'class="on" aria-current="page"' : ''}>${label}</a>`;
  nav.innerHTML = a('', t('nav.foods')) + (u?.type !== 'supplier' ? a('cart', t('nav.cart', { n: cartCount() })) : '') +
    (u ? a('orders', t('nav.orders')) + a('dashboard', u.type === 'supplier' ? t('nav.panel') : t('nav.impact')) + `<button class="btn" id="out">${t('nav.logout')}</button>` : a('login', t('nav.login')) + a('register', t('nav.register')));
  nav.querySelector('#out')?.addEventListener('click', logout);
}
function route() {
  const r = current();
  if (protectedRoutes.includes(r) && !session.user) { location.hash = '#/login'; return; }
  applyStatic(); renderNav(r in routes ? r : ''); (routes[r] || routes[''])(view); view.focus();
}
window.addEventListener('hashchange', route);
document.addEventListener('lang:change', route);
document.addEventListener('cart:change', () => renderNav(current()));
route();
// Portabilidade: o site pode ser instalado como app (PWA) e abre offline com o que já foi carregado.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
