export type NativeCommand = {type:'beginTilt'|'endTilt'};
export type NativeBridgeHost = {
  webkit?:{messageHandlers?:{tumbleGrove?:{postMessage:(message:NativeCommand)=>void}}};
};
export type NativeEvent = {detail?:unknown};
export type NativeEventHost = NativeBridgeHost & {
  addEventListener:(type:string,listener:(event:NativeEvent)=>void)=>void;
  removeEventListener:(type:string,listener:(event:NativeEvent)=>void)=>void;
};
export type NativeGravity = {x:number;y:number};

/** The bundled WKWebView installs this handler before any game JavaScript runs.
 * Commands: {type:'beginTilt'} / {type:'endTilt'} (only after the player's opt-in).
 * Events: tumblegrove:tilt {x,y}, tumblegrove:tilt-error {message},
 *         tumblegrove:lifecycle {active}. Gravity is measured in g, in screen
 * coordinates: x points right and y down; a flat phone projects to {0,0}.
 * The first valid sample is the readiness acknowledgement. No network is used.
 */
export function isNativeApp(host:NativeBridgeHost|undefined=typeof window==='undefined'?undefined:window as NativeBridgeHost):boolean {
  return typeof host?.webkit?.messageHandlers?.tumbleGrove?.postMessage==='function';
}

function nativeGravity(detail:unknown):NativeGravity|null {
  if(!detail||typeof detail!=='object'||!('x' in detail)||!('y' in detail))return null;
  const {x,y}=detail;
  if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1.001||Math.abs(y)>1.001)return null;
  if(Math.hypot(x,y)<.045)return {x:0,y:0};
  return {x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};
}

export function requestNativeTilt(onSample:(gravity:NativeGravity)=>void,options:{signal:AbortSignal;host:NativeEventHost;timeoutMs:number;onError?:(error:Error)=>void}):Promise<()=>void> {
  const {signal,host,timeoutMs,onError}=options;
  const handler=host.webkit?.messageHandlers?.tumbleGrove;
  if(signal.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  if(!handler)return Promise.reject(new Error('Motion controls are unavailable.'));
  return new Promise((resolve,reject)=>{
    let stopped=false,received=false;
    const stop=()=>{
      if(stopped)return;stopped=true;clearTimeout(timer);
      host.removeEventListener('tumblegrove:tilt',sample);host.removeEventListener('tumblegrove:tilt-error',failure);signal.removeEventListener('abort',abort);
      try{handler.postMessage({type:'endTilt'});}catch{/* The native view may already be closing. */}
    };
    const fail=(error:Error)=>{stop();if(received)onError?.(error);else reject(error);};
    const sample=(event:NativeEvent)=>{
      if(stopped)return;
      const gravity=nativeGravity(event.detail);if(!gravity)return;
      onSample(gravity);
      if(!received){received=true;clearTimeout(timer);resolve(stop);}
    };
    const failure=(event:NativeEvent)=>{
      const detail=event.detail;
      const message=detail&&typeof detail==='object'&&'message' in detail&&typeof detail.message==='string'?detail.message:'Phone motion is unavailable. Try turning gravity mode off and on again.';
      fail(new Error(message));
    };
    const abort=()=>{stop();if(!received)reject(new DOMException('Cancelled','AbortError'));};
    const timer=setTimeout(()=>fail(new Error('No phone motion received. Try turning gravity mode on again.')),timeoutMs);
    host.addEventListener('tumblegrove:tilt',sample);host.addEventListener('tumblegrove:tilt-error',failure);signal.addEventListener('abort',abort,{once:true});
    try{handler.postMessage({type:'beginTilt'});}catch{fail(new Error('Could not start phone motion. Try gravity mode again.'));}
  });
}

/** Foreground notifications never change the user's own pause/inspection state. */
export function observeNativeActivity(onActivity:(active:boolean)=>void,host:NativeEventHost=window as unknown as NativeEventHost):()=>void {
  if(!isNativeApp(host))return ()=>{};
  const activity=(event:NativeEvent)=>{
    const detail=event.detail;
    if(detail&&typeof detail==='object'&&'active' in detail&&typeof detail.active==='boolean')onActivity(detail.active);
  };
  host.addEventListener('tumblegrove:lifecycle',activity);
  return ()=>host.removeEventListener('tumblegrove:lifecycle',activity);
}
