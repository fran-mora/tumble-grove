import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import { isNativeApp } from '../app/native';
import '../app/globals.css';

function OfflineStatus() {
  const [status, setStatus] = useState(()=> 'serviceWorker' in navigator?'Saving for offline play…':'Offline saving unavailable in this browser');
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV || isNativeApp()) return;
    let alive = true, checkingUpdate = false;
    let registration: ServiceWorkerRegistration | undefined;
    const channels = new Map<MessageChannel, ReturnType<typeof setTimeout>>();
    if (!('serviceWorker' in navigator)) return;
    const check = () => {
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      const close=()=>{clearTimeout(channels.get(channel));channels.delete(channel);channel.port1.close();};
      channels.set(channel,setTimeout(close,5000));
      channel.port1.onmessage = event => {
        if(navigator.serviceWorker.controller!==worker){close();return;}
        if (alive) {
          const newer=event.data.ready&&event.data.current===false;
          setUpdateReady(newer);
          setStatus(newer?'New version ready':event.data.ready?'✓ Ready for offline play':'Connect to the internet and reload to save offline');
        }
        close();
      };
      worker.postMessage({type:'CHECK_OFFLINE',entry:import.meta.url}, [channel.port2]);
    };
    const update=()=>{
      if(!registration||checkingUpdate||document.hidden)return;
      checkingUpdate=true;
      // Returning to an open game checks for updates without interrupting the round.
      void registration.update().catch(()=>{}).finally(()=>{checkingUpdate=false;if(alive)check();});
    };
    navigator.serviceWorker.addEventListener('controllerchange', check);
    document.addEventListener('visibilitychange',update);
    window.addEventListener('online',update);
    window.addEventListener('focus',update);
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {scope:'./', updateViaCache:'none'})
      .then(value => {registration=value;return navigator.serviceWorker.ready;}).then(()=>{if(alive)check();})
      .catch(() => { if (alive) setStatus('Could not save offline. Connect and reload to retry.'); });
    return () => {
      alive = false;navigator.serviceWorker.removeEventListener('controllerchange', check);
      document.removeEventListener('visibilitychange',update);window.removeEventListener('online',update);window.removeEventListener('focus',update);
      for(const [channel,timer] of channels){clearTimeout(timer);channel.port1.close();}channels.clear();
    };
  }, []);
  return import.meta.env.DEV || isNativeApp() ? null : <output className={`offline-status ${updateReady?'has-update':''}`}><span>{status}</span>{updateReady&&<button className="offline-update" onClick={()=>window.location.reload()} title="Load the latest game and start a new round">Update &amp; restart</button>}</output>;
}
createRoot(document.getElementById('root')!).render(<><Home/><OfflineStatus/></>);
