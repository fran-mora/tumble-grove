import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isNativeApp,observeNativeActivity} from '../app/native.ts';
import {requestPhoneTilt} from '../app/tilt.ts';

function nativeHost(onCommand=()=>{}){
  const listeners=new Map(),commands=[];
  const host={
    isSecureContext:false,
    DeviceOrientationEvent:{requestPermission(){assert.fail('The native app must not request browser motion permission.');}},
    webkit:{messageHandlers:{tumbleGrove:{postMessage(message){commands.push(message);onCommand(message,host);}}}},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    emit(type,detail){for(const fn of listeners.get(type)??[])fn({detail});},
    count(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0);},
    commands,
  };
  return host;
}

test('only the installed native game message handler enables native behaviour',()=>{
  assert.equal(isNativeApp(nativeHost()),true);
  for(const h of [{},{webkit:{}},{webkit:{messageHandlers:{}}},{webkit:{messageHandlers:{tumbleGrove:{postMessage:true}}}}])assert.equal(isNativeApp(h),false);
});

test('bundled native tilt works without a secure web origin or browser permission API',async()=>{
  const samples=[],h=nativeHost((message,host)=>{
    if(message.type==='beginTilt')host.emit('tumblegrove:tilt',{x:.3,y:.7});
  });
  const stop=await requestPhoneTilt(sample=>samples.push(sample),{host:h,signal:new AbortController().signal,timeoutMs:200});
  assert.deepEqual(h.commands,[{type:'beginTilt'}]);
  assert.deepEqual(samples,[{x:.3,y:.7}]);
  // Native coordinates already account for orientation: never rotate them again.
  h.screen={orientation:{angle:90}};
  h.emit('tumblegrove:tilt',{x:-1,y:0});
  assert.deepEqual(samples.at(-1),{x:-1,y:0});
  stop();stop();
  assert.equal(h.count(),0);
  assert.deepEqual(h.commands,[{type:'beginTilt'},{type:'endTilt'}]);
});

test('native readiness waits for valid samples and retains the flat-phone dead zone',async()=>{
  const samples=[],h=nativeHost(),controller=new AbortController();
  const pending=requestPhoneTilt(sample=>samples.push(sample),{host:h,signal:controller.signal,timeoutMs:200});
  for(const detail of [undefined,null,{x:0},{x:NaN,y:0},{x:0,y:Infinity},{x:1.1,y:0},{x:'0',y:1}])h.emit('tumblegrove:tilt',detail);
  assert.equal(samples.length,0);
  h.emit('tumblegrove:tilt',{x:.01,y:.01});
  await pending;
  assert.deepEqual(samples,[{x:0,y:0}]);
  controller.abort();
  h.emit('tumblegrove:tilt',{x:0,y:1});
  assert.equal(samples.length,1);
  assert.equal(h.count(),0);
});

test('native connection errors and cancellation cannot leave motion running',async()=>{
  const h=nativeHost(),controller=new AbortController();
  const pending=requestPhoneTilt(()=>assert.fail('Unexpected sample'),{host:h,signal:controller.signal,timeoutMs:200});
  h.emit('tumblegrove:tilt-error',{message:'Motion sensors are unavailable.'});
  await assert.rejects(pending,/Motion sensors are unavailable/);
  assert.equal(h.count(),0);assert.equal(h.commands.at(-1).type,'endTilt');
  const second=new AbortController();
  const cancelled=requestPhoneTilt(()=>assert.fail('Unexpected sample'),{host:h,signal:second.signal,timeoutMs:200});
  second.abort();await assert.rejects(cancelled,{name:'AbortError'});
  assert.equal(h.count(),0);assert.equal(h.commands.at(-1).type,'endTilt');
  const before=h.commands.length;
  await assert.rejects(requestPhoneTilt(()=>{}, {host:h,signal:second.signal}),{name:'AbortError'});
  assert.equal(h.commands.length,before);
});

test('native runtime failures stop motion and notify the game after connection',async()=>{
  const errors=[],h=nativeHost(),controller=new AbortController();
  const pending=requestPhoneTilt(()=>{}, {host:h,signal:controller.signal,timeoutMs:200,onError:error=>errors.push(error.message)});
  h.emit('tumblegrove:tilt',{x:0,y:1});const stop=await pending;
  h.emit('tumblegrove:tilt-error',{message:'Phone motion stopped.'});
  h.emit('tumblegrove:tilt-error',{message:'Should not repeat.'});
  assert.deepEqual(errors,['Phone motion stopped.']);assert.equal(h.count(),0);
  stop();controller.abort();assert.equal(h.commands.filter(c=>c.type==='endTilt').length,1);
});

test('native timeouts and a disconnected bridge clean up both event listeners',async()=>{
  const h=nativeHost();
  await assert.rejects(requestPhoneTilt(()=>{}, {host:h,signal:new AbortController().signal,timeoutMs:15}),/No phone motion received/);
  assert.equal(h.count(),0);assert.equal(h.commands.at(-1).type,'endTilt');
  const disconnected=nativeHost(()=>{throw new Error('View disappeared');});
  await assert.rejects(requestPhoneTilt(()=>{}, {host:disconnected,signal:new AbortController().signal,timeoutMs:200}),/Could not start phone motion/);
  assert.equal(disconnected.count(),0);
});

test('native lifecycle accepts only boolean activity events and unsubscribes on cleanup',()=>{
  const h=nativeHost(),states=[],stop=observeNativeActivity(active=>states.push(active),h);
  for(const detail of [null,undefined,{},false,{active:'false'},{active:0}])h.emit('tumblegrove:lifecycle',detail);
  h.emit('tumblegrove:lifecycle',{active:false});h.emit('tumblegrove:lifecycle',{active:true});
  assert.deepEqual(states,[false,true]);
  stop();h.emit('tumblegrove:lifecycle',{active:false});assert.equal(h.count(),0);assert.equal(states.length,2);
  const browser=nativeHost();delete browser.webkit;
  observeNativeActivity(()=>assert.fail('No native lifecycle in the browser'),browser)();
  assert.equal(browser.count(),0);
});
