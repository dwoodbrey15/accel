const VERSION = 'v3';
const BASE = new URL('./', self.location.href);
const PREFIX = 'vibration-offline-' + BASE.pathname + '-';
const CACHE = PREFIX + VERSION;
const PAGE = new URL('accel.html', BASE).href;
const ASSETS = ['accel.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']
  .map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'OFFLINE_STATUS') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      const files = await Promise.all(ASSETS.map(url => cache.match(url)));
      event.ports[0]?.postMessage({ready: files.every(Boolean), version: VERSION});
    } catch {
      event.ports[0]?.postMessage({ready: false});
    }
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== BASE.origin) return;
  const canonical = url.origin + url.pathname;
  if (!ASSETS.includes(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (canonical === PAGE) {
      try {
        const response = await fetch(event.request);
        if (!response.ok) throw new Error('Page unavailable');
        event.waitUntil(cache.put(PAGE, response.clone()).catch(() => {}));
        return response;
      } catch {
        return (await cache.match(PAGE)) || Response.error();
      }
    }
    return (await cache.match(canonical)) || fetch(event.request);
  })());
});
