import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = new URL('../dist-pages/', import.meta.url);
const files = (await readdir(dir,{recursive:true,withFileTypes:true})).filter(e=>e.isFile()).map(e=>relative(fileURLToPath(dir),join(e.parentPath,e.name))).filter(f=>!f.startsWith('.git/')&&!['sw.js','.nojekyll'].includes(f)).sort();
const hash = createHash('sha256');
for (const file of files) { hash.update(file); hash.update(await readFile(new URL(file,dir))); }
const version = hash.digest('hex').slice(0,16);
const sw = `const CACHE = 'fruit-merge-${version}';
const FILES = ${JSON.stringify(files)};
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
`;
await writeFile(new URL('sw.js',dir),sw);
await writeFile(new URL('.nojekyll',dir),'');
console.log('Offline cache prepared:',files.length,'files, version',version);
