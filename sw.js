/* Monaro Milk Toolbox Talks – service worker.
   CACHE_VERSION is bumped automatically by scripts/publish.sh on every publish. */
const CACHE_VERSION = 'mm-toolbox-v8';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = 'mm-toolbox-data'; // talks survive version bumps so old weeks stay readable offline
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/signature.js',
  './icons/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.endsWith('-shell') && k !== SHELL_CACHE).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch (e) {} }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'version' && event.source) event.source.postMessage({ type: 'version', version: CACHE_VERSION });
  if (event.data && event.data.type === 'warm' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(DATA_CACHE).then((c) => Promise.all(event.data.urls.map((u) =>
      fetch(u, { cache: 'no-cache' }).then((r) => r.ok && c.put(u, r)).catch(() => {})))));
  }
});

// Network-first (with timeout) for talk data + version.json so new weeks appear straight away.
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  const key = request.url.split('?')[0];
  try {
    const response = await Promise.race([
      fetch(request, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
    ]);
    if (response && response.ok) cache.put(key, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

// Cache-first for the app shell.
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith('talks/') || path === 'version.json') {
    event.respondWith(networkFirst(req));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((r) => r || fetch(req)).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(cacheFirst(req));
});
