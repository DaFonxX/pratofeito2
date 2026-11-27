const VERSION = '__BUILD_VERSION__';
const PRECACHE = "__PRECACHE__";
const SHELL_CACHE = `pf-shell-${VERSION}`;
const API_CACHE = 'pf-api-v1';
const PUBLIC_API = /^\/api\/(offers|stores|meta|impact)(\/|$|\?)/;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('pf-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? (await network) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/').catch(() => Response.error()));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    if (PUBLIC_API.test(url.pathname + url.search)) {
      event.respondWith(networkFirst(request, API_CACHE).catch(() => new Response(
        JSON.stringify({ error: { code: 'OFFLINE' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )));
    }
    return;
  }
  if (url.pathname.startsWith('/assets/img/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(networkFirst(request, SHELL_CACHE).catch(() => Response.error()));
  }
});
