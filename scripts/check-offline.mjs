import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../dist-pages/', import.meta.url);
const scope = process.env.OFFLINE_TEST_SCOPE || 'https://example.test/tumble-grove/';
const handlers = {};
const stored = new Map();
const normalize = value => typeof value === 'string' ? value : value.url;
const cache = {
  async addAll(requests) { for (const request of requests) { const key=normalize(request); assert.ok(key.startsWith(scope)); stored.set(key,new Response(await readFile(new URL(key.slice(scope.length),root)))); } },
  async match(request) { const url = new URL(normalize(request)); url.search=''; return stored.get(url.href)?.clone(); }
};
const context = {URL, Request, Response, caches:{open:async()=>cache}, fetch:async()=>{throw new Error('Network is offline');}, self:{registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,handler)=>{handlers[type]=handler;}}};
vm.runInNewContext(await readFile(new URL('sw.js',root),'utf8'),context);
let pending;
handlers.install({waitUntil:p=>{pending=p;}}); await pending;
handlers.activate({waitUntil:p=>{pending=p;}}); await pending;
let ready;
handlers.message({data:{type:'CHECK_OFFLINE'},ports:[{postMessage:data=>{ready=data.ready;}}],waitUntil:p=>{pending=p;}}); await pending; assert.equal(ready,true);
for (const url of [scope,scope+'?launch=1',...stored.keys()]) {
  let response;
  handlers.fetch({request:{url,method:'GET',mode: url===scope || url.includes('?') ? 'navigate':'cors'},respondWith:p=>{response=p;}});
  assert.ok((await response)?.ok,url);
}
const html=await readFile(new URL('index.html',root),'utf8');
// A direct navigation must open the cited size table, rather than the game shell.
let sizeResponse;
handlers.fetch({request:{url:scope+'fruit-sizes.html?from=help',method:'GET',mode:'navigate'},respondWith:p=>{sizeResponse=p;}});
assert.equal(await (await sizeResponse).text(),await readFile(new URL('fruit-sizes.html',root),'utf8'));
for (const [,path] of html.matchAll(/(?:src|href)="([^\"]+)"/g)) { if (path.startsWith('https://')) continue; assert.ok(await cache.match(new URL(path,scope).href),path); }
stored.delete(scope+'fruits.png');
handlers.message({data:{type:'CHECK_OFFLINE'},ports:[{postMessage:data=>{ready=data.ready;}}],waitUntil:p=>{pending=p;}}); await pending; assert.equal(ready,false);
console.log('Offline checks passed: installation, subpath navigation, fruit-size table navigation, all assets, missing-cache detection.');
