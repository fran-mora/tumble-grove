const CACHE = 'tumble-grove-09928d50bee934ad';
const FILES = ["artwork-prompt.txt","assets/index-BcqhfBjq.js","assets/index-C8w_3Zr3.css","credits.html","favicon.svg","fruit-collection-a-prompt.txt","fruit-collection-a.png","fruit-collection-b-prompt.txt","fruit-collection-b.png","fruit-sizes.csv","fruit-sizes.html","fruits.png","index.html","legal/bundled-dependencies.json","legal/dependency-inventory.json","legal/project-license.txt","legal/third-party-notices.txt","manifest.webmanifest"];
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
    const exact = await cache.match(event.request, {ignoreSearch:true});
    const cached = exact || (event.request.mode === 'navigate' ? await cache.match(new URL('index.html', self.registration.scope).href) : undefined);
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
