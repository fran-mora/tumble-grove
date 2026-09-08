const CACHE = 'tumble-grove-e638d2e1031010cc';
const FILES = ["artwork-prompt.txt","assets/index-DgQg6X0G.js","assets/index-Qv6EHege.css","favicon.svg","fruit-collection-a-prompt.txt","fruit-collection-a.png","fruit-collection-b-prompt.txt","fruit-collection-b.png","fruits.png","index.html","manifest.webmanifest"];
const urls = FILES.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(urls.map(url => new Request(url, {cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = event.request.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : event.request;
    const cached = await cache.match(key, {ignoreSearch:true});
    return cached || fetch(event.request);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const entries = await Promise.all(urls.map(url => cache.match(url)));
    event.ports[0]?.postMessage({ready:entries.every(Boolean)});
  })());
});
