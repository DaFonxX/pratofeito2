// Service worker: rede primeiro (sempre a versão mais nova); sem internet, usa a cópia guardada.
// A API nunca é guardada em cache. Ao mudar arquivos do site, aumente a versão abaixo.
const CACHE = 'pratofeito-v2';
const ASSETS = ['/', '/css/style.css', '/js/app.js', '/js/utils.js', '/js/i18n.js', '/js/auth.js', '/js/products.js', '/js/cart.js',
  '/js/orders.js', '/js/dashboard.js', '/js/logs.js', '/icon.svg', '/icon-192.png', '/manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
