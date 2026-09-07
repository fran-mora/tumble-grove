import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orientationGravity,requestPhoneTilt} from '../app/tilt.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function host(permission){
  const listeners=new Map();
  return {isSecureContext:true,DeviceOrientationEvent:permission?{requestPermission:permission}:{},screen:{orientation:{angle:0}},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    emit(type,event){for(const fn of listeners.get(type)??[])fn(event);},
    count(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0);}};
}
test('tilt maps to gravity in all four screen directions, with a flat dead zone',()=>{
  assert.deepEqual(orientationGravity(0,0),{x:0,y:0});
  assert.deepEqual(orientationGravity(.5,.5),{x:0,y:0});
  for(const [beta,gamma,x,y] of [[90,0,0,1],[-90,0,0,-1],[0,90,1,0],[0,-90,-1,0],[0,30,.5,0],[30,0,0,.5]]){
    const g=orientationGravity(beta,gamma);near(g.x,x);near(g.y,y);
  }
});
test('gravity follows screen rotation in portrait, landscape and upside down',()=>{
  for(const [angle,x,y] of [[0,1,0],[90,0,1],[180,-1,0],[270,0,-1],[-90,0,-1]]){
    const g=orientationGravity(0,90,angle);near(g.x,x);near(g.y,y);
  }
});
test('invalid or unavailable sensor values are rejected without inventing gravity',()=>{
  for(const [beta,gamma] of [[null,0],[0,null],[NaN,0],[0,Infinity],[181,0],[0,91]])assert.equal(orientationGravity(beta,gamma),null);
});
test('permission is requested synchronously in the gesture and first valid data enables tilt',async()=>{
  let asked=false;const h=host(()=>{asked=true;return Promise.resolve('granted');}),samples=[],controller=new AbortController();
  const pending=requestPhoneTilt(g=>samples.push(g),{host:h,signal:controller.signal,timeoutMs:200});
  assert.equal(asked,true);await Promise.resolve();
  h.emit('deviceorientation',{beta:null,gamma:null});assert.equal(samples.length,0);
  h.emit('deviceorientation',{beta:0,gamma:30});const stop=await pending;
  near(samples[0].x,.5);h.screen.orientation.angle=90;h.emit('orientationchange',{});near(samples.at(-1).y,.5);
  stop();assert.equal(h.count(),0);h.emit('deviceorientation',{beta:90,gamma:0});assert.equal(samples.length,2);
});
test('browsers without a permission API can connect, and abort removes active listeners',async()=>{
  const h=host(),controller=new AbortController();let calls=0;
  const pending=requestPhoneTilt(()=>calls++,{host:h,signal:controller.signal,timeoutMs:200});
  h.emit('deviceorientation',{beta:45,gamma:0});await pending;controller.abort();
  assert.equal(h.count(),0);h.emit('deviceorientation',{beta:45,gamma:10});assert.equal(calls,1);
});
test('denial, missing support and insecure contexts never install sensor listeners',async()=>{
  for(const h of [host(()=>Promise.resolve('denied')),{...host(),DeviceOrientationEvent:undefined},{...host(),isSecureContext:false},host(()=>Promise.reject(new Error('blocked'))) ]){
    await assert.rejects(requestPhoneTilt(()=>assert.fail('unexpected data'),{host:h,signal:new AbortController().signal,timeoutMs:20}));assert.equal(h.count(),0);
  }
});
test('no data times out cleanly and an abandoned connection cannot enable later',async()=>{
  const h=host(),controller=new AbortController();
  await assert.rejects(requestPhoneTilt(()=>assert.fail('unexpected sample'),{host:h,signal:controller.signal,timeoutMs:15}),/No tilt data/);
  assert.equal(h.count(),0);
  const next=new AbortController(),pending=requestPhoneTilt(()=>assert.fail('unexpected sample'),{host:h,signal:next.signal,timeoutMs:200});
  next.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(h.count(),0);
});
