import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';

function OfflineStatus() {
  const [status, setStatus] = useState('Saving for offline play…');
  useEffect(() => {
    let alive = true;
    if (!('serviceWorker' in navigator)) { setStatus('Offline saving unavailable in this browser'); return; }
    const check = () => {
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      channel.port1.onmessage = event => { if (alive) setStatus(event.data.ready ? '✓ Ready for offline play' : 'Connect to the internet and reload to save offline'); channel.port1.close(); };
      worker.postMessage({type:'CHECK_OFFLINE'}, [channel.port2]);
    };
    navigator.serviceWorker.addEventListener('controllerchange', check);
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {scope:'./', updateViaCache:'none'})
      .then(() => navigator.serviceWorker.ready).then(check)
      .catch(() => { if (alive) setStatus('Could not save offline. Connect and reload to retry.'); });
    return () => { alive = false; navigator.serviceWorker.removeEventListener('controllerchange', check); };
  }, []);
  return <p role="status" className="offline-status">{status}</p>;
}
createRoot(document.getElementById('root')!).render(<><Home/><OfflineStatus/></>);
