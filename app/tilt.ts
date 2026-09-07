export type GravityVector = {x:number;y:number};
type OrientationSample = {beta:number|null;gamma:number|null};
export type TiltHost = {
  isSecureContext:boolean;
  DeviceOrientationEvent?:{requestPermission?:()=>Promise<string>};
  screen?:{orientation?:{angle:number}};
  orientation?:number;
  addEventListener:(type:string,listener:(event:OrientationSample)=>void)=>void;
  removeEventListener:(type:string,listener:(event:OrientationSample)=>void)=>void;
};
/** Project Earth's gravity into screen coordinates, including landscape rotation.
 * Device axes: https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Orientation_and_motion_data_explained
 * Screen angles: https://www.w3.org/TR/screen-orientation/#dfn-current-orientation-angle
 */
export function orientationGravity(beta:number|null,gamma:number|null,screenAngle=0):GravityVector|null {
  if(beta===null||gamma===null||!Number.isFinite(beta)||!Number.isFinite(gamma)||!Number.isFinite(screenAngle)||Math.abs(beta)>180||Math.abs(gamma)>90)return null;
  const b=beta*Math.PI/180,g=gamma*Math.PI/180,a=screenAngle*Math.PI/180;
  const x=Math.cos(b)*Math.sin(g),y=Math.sin(b);
  const vector={x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};
  return Math.hypot(vector.x,vector.y)<.045?{x:0,y:0}:vector;
}
/** Called directly by the toggle/confirmation gesture. No sensor is used before opt-in. */
export async function requestPhoneTilt(onSample:(gravity:GravityVector)=>void,options:{signal:AbortSignal;host?:TiltHost;timeoutMs?:number}):Promise<()=>void> {
  const {signal,timeoutMs=6500}=options;
  const host=options.host??window as unknown as TiltHost;
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(!host.isSecureContext)throw new Error('Open the secure game link on your phone to use tilt.');
  if(!host.DeviceOrientationEvent)throw new Error('This browser has no motion sensors. Try the game in Safari or Chrome on your phone.');
  if(host.DeviceOrientationEvent.requestPermission){
    let permission:string;
    try{permission=await host.DeviceOrientationEvent.requestPermission();}catch{throw new Error('Motion access was not allowed. Enable it in your browser settings, then try again.');}
    if(permission!=='granted')throw new Error('Motion access was not allowed. Your current game is unchanged.');
  }
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  return new Promise((resolve,reject)=>{
    let stopped=false,received=false,last:OrientationSample|null=null;
    const stop=()=>{if(stopped)return;stopped=true;clearTimeout(timer);host.removeEventListener('deviceorientation',sample);host.removeEventListener('orientationchange',rotation);signal.removeEventListener('abort',abort);};
    const abort=()=>{stop();if(!received)reject(new DOMException('Cancelled','AbortError'));};
    const sample=(event:OrientationSample)=>{
      if(stopped)return;
      const angle=host.screen?.orientation?.angle??host.orientation??0;
      const gravity=orientationGravity(event.beta,event.gamma,angle);
      if(!gravity)return;
      last={beta:event.beta,gamma:event.gamma};onSample(gravity);
      if(!received){received=true;clearTimeout(timer);resolve(stop);}
    };
    const rotation=()=>{if(last)sample(last);};
    const timer=setTimeout(()=>{stop();reject(new Error('No tilt data received. Open the game on your phone and allow motion access.'));},timeoutMs);
    signal.addEventListener('abort',abort,{once:true});
    host.addEventListener('deviceorientation',sample);host.addEventListener('orientationchange',rotation);
  });
}
