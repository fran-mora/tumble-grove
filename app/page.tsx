'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp, VolumeX, Volume2, RotateCcw, ArrowRight, Trophy, MousePointer2, Pause, Play, Sparkles, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { requestPhoneTilt, type GravityVector } from './tilt';
import { FRUIT_COLLECTION } from './fruit-collection';
import { VIEW_PADDING } from './arena';
import { WIDTH, HEIGHT, STEP, MergeGame, type GameMode } from './engine';
import { loadSprites, renderGame } from './render';

type Modal = 'help' | 'restart' | 'win' | 'mode' | null;
const getHud = (g: MergeGame) => ({lineup:g.lineup,mode:g.mode,score:g.score,drops:g.drops,merges:g.merges,highest:g.highest,next:g.next,current:g.current,over:g.over,danger:g.danger>.1,watermelons:g.watermelons});
type ModelContext = { registerTool:(tool:{name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown}, options:{signal:AbortSignal})=>void|Promise<void> };
export default function Home() {
  const gameRef=useRef<MergeGame|null>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const spritesRef=useRef<HTMLCanvasElement[]>([]);
  const audioRef=useRef<AudioContext|null>(null);
  const soundRef=useRef(false);
  const bestRef=useRef(0);
  const bestScoresRef=useRef({classic:0,gravity:0});
  const tiltControllerRef=useRef<AbortController|null>(null);
  const tiltStopRef=useRef<(()=>void)|null>(null);
  const latestTiltRef=useRef<GravityVector>({x:0,y:1});
  const busyRef=useRef(false);
  const modalRef=useRef<Modal>(null);
  const [hud,setHud]=useState(()=>getHud(new MergeGame(()=>0)));
  const [best,setBest]=useState(0);
  const [sound,setSound]=useState(false);
  const [paused,setPaused]=useState(false);
  const [tiltBusy,setTiltBusy]=useState(false);
  const [tiltError,setTiltError]=useState('');
  const [pendingMode,setPendingMode]=useState<GameMode>('gravity');
  const [modal,setModal]=useState<Modal>(null);
  const [spriteUrls,setSpriteUrls]=useState<string[]>([]);
  const [notice,setNotice]=useState('');
  const [ready,setReady]=useState(false);
  const pointRef=useRef<number|null>(null);
  const playTone=useCallback((kind:number,drop=false)=>{
    if(!soundRef.current)return;
    try{
      const audio=audioRef.current;
      if(!audio || audio.state!=='running')return;
      const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
      oscillator.type='sine';oscillator.frequency.setValueAtTime(drop?320:370*Math.pow(2,kind/12),now);
      oscillator.frequency.exponentialRampToValueAtTime(drop?155:550*Math.pow(2,kind/12),now+.09);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.11,now+.008);gain.gain.exponentialRampToValueAtTime(.001,now+(drop?.12:.3));
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(now+.35);
    }catch{/* Sound is optional; play remains available. */}
  },[]);
  const unlockAudio=useCallback(()=>{
    if(!soundRef.current)return;
    try{audioRef.current??=new AudioContext();void audioRef.current.resume().catch(()=>{});}catch{}
  },[]);
  const sync=useCallback(()=>{const g=gameRef.current;if(g)setHud(getHud(g));},[]);
  const doDrop=useCallback((x?:number)=>{
    const game=gameRef.current;if(!game||busyRef.current)return false;
    unlockAudio();const dropped=game.drop(x);if(dropped){playTone(0,true);sync();}return dropped;
  },[playTone,sync,unlockAudio]);
  const reset=useCallback(()=>{gameRef.current?.reset();setPaused(false);setModal(null);modalRef.current=null;setNotice('Fresh fruit, fresh start.');sync();canvasRef.current?.focus();},[sync]);
  useEffect(()=>{
    const game=new MergeGame();gameRef.current=game;
    try{for(const mode of ['classic','gravity'] as const){const saved=Number(localStorage.getItem(mode==='classic'?'fruitmerge.best':'fruitmerge.best.gravity'));if(Number.isFinite(saved)&&saved>0)bestScoresRef.current[mode]=Math.floor(saved);}bestRef.current=bestScoresRef.current.classic;setBest(bestRef.current);}catch{}
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx){setNotice('Canvas is unavailable in this browser. Please use a current browser to play.');return;}
    let alive=true,last=0,accumulator=0,frame=0,lastUi=0,previousScore=0,previousMerges=0,previousWatermelons=0,wasOver=false;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    void loadSprites().then(sprites=>{if(alive){spritesRef.current=sprites;setSpriteUrls(sprites.map(s=>s.toDataURL('image/png')));setReady(true);}}).catch(()=>{if(alive)setReady(true);});
    const animate=(now:number)=>{
      if(!alive)return;
      const delta=last?Math.min((now-last)/1000,.05):0;last=now;
      if(!game.paused&&!game.over){accumulator+=delta;while(accumulator>=STEP){game.step();accumulator-=STEP;}}else accumulator=0;
      if(game.score!==previousScore){previousScore=game.score;if(game.score>bestRef.current){bestRef.current=game.score;bestScoresRef.current[game.mode]=game.score;setBest(game.score);try{localStorage.setItem(game.mode==='classic'?'fruitmerge.best':'fruitmerge.best.gravity',String(game.score));}catch{}}}
      if(game.merges>previousMerges){const event=game.events.at(-1);if(event)playTone(event.kind);}
      previousMerges=game.merges;
      if(game.watermelons>previousWatermelons){setModal('win');modalRef.current='win';game.paused=true;}
      previousWatermelons=game.watermelons;
      if(game.over&&!wasOver)setNotice(`A fruit spilled. Final score: ${game.score}.`);
      wasOver=game.over;
      renderGame(ctx,game,spritesRef.current,reducedMotion);
      if(now-lastUi>100){setHud(old=>{const next=getHud(game);return JSON.stringify(old)===JSON.stringify(next)?old:next;});lastUi=now;}
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    const visibility=()=>{if(document.hidden&&game.drops>0&&!game.over){game.paused=true;setPaused(true);}};
    document.addEventListener('visibilitychange',visibility);
    return()=>{alive=false;tiltControllerRef.current?.abort();tiltStopRef.current?.();cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);void audioRef.current?.close().catch(()=>{});audioRef.current=null;};
  },[playTone]);
  useEffect(()=>{modalRef.current=modal;if(gameRef.current)gameRef.current.paused=paused||modal!==null||tiltBusy;},[paused,modal,tiltBusy]);
  useEffect(()=>{
    if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);
  },[notice]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?:ModelContext}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=(tool:Parameters<ModelContext['registerTool']>[0])=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'read_fruit_merge_game',title:'Read Fruit Merge game',description:'Read score, fruit positions, current and next fruit, and whether a fruit can be dropped. The classic play area is 440 by 570; gravity mode uses a 440-diameter circle. Gravity and spawn coordinates are included. Fruit levels are 0 through 10. The snapshot lists this round’s selected character for each level.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>gameRef.current?.snapshot()});
    register({name:'drop_fruit',title:'Drop a fruit',description:'Drop the current fruit at position x across the active entry edge. In gravity mode x is measured perpendicular to gravity. Refuses while paused, a dialog is open, the cooldown is active, or the game is over.',inputSchema:{type:'object',properties:{x:{type:'number',minimum:0,maximum:440}},required:['x'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input)=>{
      if(!input||typeof input!=='object'||!('x' in input)||typeof input.x!=='number'||!Number.isFinite(input.x)||input.x<0||input.x>WIDTH)throw new Error('x must be a number from 0 to 440.');
      if(Object.keys(input).some(key=>key!=='x'))throw new Error('Only x is accepted.');
      if(modalRef.current||!doDrop(input.x))throw new Error('Cannot drop now. Read the game state and wait or resume the game.');
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      return gameRef.current?.snapshot();
    }});
    return()=>lifecycle.abort();
  },[doDrop]);
  const fruits=hud.lineup.map(id=>FRUIT_COLLECTION[id]);
  const Fruit=({kind,className=''}:{kind:number;className?:string})=>spriteUrls[hud.lineup[kind]]?<img className={`fruit-image ${className}`} src={spriteUrls[hud.lineup[kind]]} alt={fruits[kind].name} draggable={false}/>:<span className={`fruit-fallback ${className}`} role="img" aria-label={fruits[kind].name}>{fruits[kind].emoji}</span>;
  const aim=(clientX:number,clientY:number)=>{const rect=canvasRef.current?.getBoundingClientRect(),game=gameRef.current;if(rect&&rect.width&&game)game.setAimPoint((clientX-rect.left)/rect.width*(WIDTH+2*VIEW_PADDING)-VIEW_PADDING,(clientY-rect.top)/rect.height*(game.height+2*VIEW_PADDING)-VIEW_PADDING);};
  const openRestart=()=>{if(!hud.drops||hud.over)reset();else setModal('restart');};
  const toggleSound=()=>{soundRef.current=!soundRef.current;setSound(soundRef.current);unlockAudio();if(soundRef.current)playTone(3);};
  const changeMode=async(mode:GameMode)=>{
    const game=gameRef.current;if(!game||busyRef.current)return;
    setTiltError('');setModal(null);modalRef.current=null;
    if(mode==='gravity'){
      busyRef.current=true;setTiltBusy(true);game.paused=true;
      const controller=new AbortController();tiltControllerRef.current?.abort();tiltControllerRef.current=controller;
      try{
        const stop=await requestPhoneTilt(vector=>{latestTiltRef.current=vector;if(game.mode==='gravity')game.setGravity(vector.x,vector.y);},{signal:controller.signal});
        if(controller.signal.aborted){stop();return;}
        tiltStopRef.current=stop;game.setMode('gravity');game.setGravity(latestTiltRef.current.x,latestTiltRef.current.y);
        bestRef.current=bestScoresRef.current.gravity;setBest(bestRef.current);setPaused(false);setNotice('Gravity mode on. Tilt your phone to move the fruit.');
      }catch(error){if(!controller.signal.aborted)setTiltError(error instanceof Error?error.message:'Could not start phone tilt.');}
      finally{busyRef.current=false;setTiltBusy(false);sync();}
    }else{
      tiltControllerRef.current?.abort();tiltStopRef.current?.();tiltStopRef.current=null;
      game.setMode('classic');bestRef.current=bestScoresRef.current.classic;setBest(bestRef.current);setPaused(false);setNotice('Classic mode on.');sync();
    }
  };
  const chooseMode=(enabled:boolean)=>{const mode=enabled?'gravity':'classic';if(mode===hud.mode||tiltBusy)return;if(hud.drops&&!hud.over){setPendingMode(mode);setModal('mode');}else void changeMode(mode);};
  const closeDialog=()=>setModal(null);
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="./" aria-label="Fruit Merge home"><Fruit kind={0}/><span>fruit<span className="brand-light">merge</span><span className="brand-dot">.</span></span></a><span className="mode-pill"><i/> {hud.mode==='gravity'?'GRAVITY MODE':'CLASSIC MODE'}</span><div className="toolbar"><button className="icon-button" onClick={toggleSound} aria-label={sound?'Mute sound':'Enable sound'} aria-pressed={sound} title={sound?'Mute sound':'Enable sound'}>{sound?<Volume2 size={21}/>:<VolumeX size={21}/>}</button><button className="icon-button" onClick={()=>setModal('help')} aria-label="How to play" title="How to play"><CircleHelp size={21}/></button></div></header>
    <section className="game-layout" aria-label="Fruit Merge game">
      <aside className="score-column"><div className="score-card"><span className="eyebrow">YOUR SCORE</span><strong className="score-number" aria-label={`Score: ${hud.score}`}>{hud.score.toLocaleString()}</strong><div className="best-score"><Trophy size={17}/><span>Personal best</span><b>{best.toLocaleString()}</b></div></div><div className="next-card"><span className="eyebrow">UP NEXT</span><div className="next-fruit"><Fruit kind={hud.next}/></div><span>{fruits[hud.next].name}</span></div><button className="new-game" disabled={tiltBusy} onClick={openRestart} aria-label="New game"><RotateCcw size={17}/><span>New game</span></button><p className="little-note">A little focus.<br/>A lot of fruit.</p></aside>
      <div className="play-column"><div className={`gravity-control ${hud.mode==='gravity'?'is-on':''}`}>
          <Smartphone size={22} aria-hidden="true"/><div className="gravity-label"><label htmlFor="gravity-toggle">Gravity mode</label><span id="gravity-description">{tiltBusy?'Allow motion access, then gently tilt your phone…':hud.mode==='gravity'?'Tilt your phone. Gravity follows.':'A circular bowl you control with phone tilt.'}</span></div><Switch id="gravity-toggle" className="gravity-switch" checked={hud.mode==='gravity'} onCheckedChange={chooseMode} disabled={tiltBusy} aria-describedby="gravity-description" aria-label="Gravity mode"/>
        </div>{tiltBusy&&<button className="cancel-tilt" onClick={()=>tiltControllerRef.current?.abort()}>Cancel connection</button>}{tiltError&&<p className="tilt-error" role="alert">{tiltError}</p>}<div className="board-heading"><span>{hud.mode==='gravity'?'Tilt, drop, and roll together.':'Make room for something bigger.'}</span><button className="pause-button" disabled={hud.over||tiltBusy} onClick={()=>setPaused(p=>!p)} aria-label={paused?'Resume game':'Pause game'}>{paused?<Play size={13}/>:<Pause size={13}/>} {paused?'RESUME':'PAUSE'}</button></div>
        <div className={`game-board ${hud.danger?'in-danger':''} ${hud.mode==='gravity'?'gravity-arena':''}`} style={{aspectRatio:`${WIDTH+2*VIEW_PADDING}/${(hud.mode==='gravity'?WIDTH:HEIGHT)+2*VIEW_PADDING}`}} >
          <canvas ref={canvasRef} className="game-canvas" width={WIDTH} height={hud.mode==='gravity'?WIDTH:HEIGHT} tabIndex={0} role="application" aria-label={`Fruit Merge play area. ${hud.mode==='gravity'?'Circular arena. Tilt your phone to change gravity. ':''}Current fruit: ${fruits[hud.current].name}. Use left and right arrows to aim, Space or Enter to drop, P to pause.`}
            onPointerDown={event=>{if(event.button!==0)return;pointRef.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();aim(event.clientX,event.clientY);unlockAudio();}}
            onPointerMove={event=>aim(event.clientX,event.clientY)}
            onPointerUp={event=>{if(pointRef.current!==event.pointerId)return;aim(event.clientX,event.clientY);pointRef.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);doDrop();}}
            onPointerCancel={()=>{pointRef.current=null;}}
            onKeyDown={event=>{if(['ArrowLeft','ArrowRight',' ','Enter','p','P'].includes(event.key))event.preventDefault();const g=gameRef.current;if(!g)return;if(event.key==='ArrowLeft')g.setAim(g.aim-12);if(event.key==='ArrowRight')g.setAim(g.aim+12);if((event.key===' '||event.key==='Enter')&&!event.repeat)doDrop();if((event.key==='p'||event.key==='P')&&!event.repeat)setPaused(p=>!p);}}
          >Your browser needs Canvas to play this game.</canvas>
          {!hud.drops&&!paused&&<div className="empty-board"><div className="empty-icon"><Fruit kind={0}/></div><h1>{hud.mode==='gravity'?'Give it a little tilt.':'Good things grow together.'}</h1><p>{hud.mode==='gravity'?<>Tilt to roll the fruit.<br/>Tap or drag to drop a new one.</>:<>Drop a fruit. Match a pair.<br/>See how big you can go.</>}</p><span className="empty-cta">{ready?'Click or tap to drop':'Getting the fruit ready…'} <ArrowRight size={16}/></span></div>}
          {paused&&!hud.over&&<div className="board-overlay"><div className="overlay-symbol"><Pause size={30}/></div><h2>A little breather.</h2><p>Your fruit will be right here.</p><button className="primary-button" onClick={()=>{setPaused(false);canvasRef.current?.focus();}}><Play size={17}/> Keep playing</button></div>}
          {hud.over&&<div className="board-overlay" role="region" aria-label="Game over"><div className="overlay-symbol"><Fruit kind={hud.highest}/></div><span className="eyebrow">A FRUIT FELL OUT</span><h2>Nicely grown.</h2><strong className="final-score">{hud.score.toLocaleString()}</strong><p>{hud.score>=best&&hud.score>0?'A new personal best!':`${hud.merges} happy little merges.`}</p><button className="primary-button" onClick={reset}><RotateCcw size={17}/> One more game</button></div>}
        </div><p className="control-hint"><MousePointer2 size={15}/><span className="desktop-hint">Move to aim · Click to drop</span><span className="touch-hint">{hud.mode==='gravity'?'Tilt to roll · Drag and release to drop':'Drag to aim · Release to drop'}</span><kbd>← → &nbsp; + &nbsp; Space</kbd></p></div>
      <aside className="goal-column"><span className="eyebrow">THE BIG IDEA</span><h2>Small fruit.<br/>Big possibilities.</h2><div className="watermelon-art"><Fruit kind={10}/></div><p>Two of a kind become<br/>one of the next.</p><div className="mini-equation"><Fruit kind={0}/><span>+</span><Fruit kind={0}/><ArrowRight size={18}/><Fruit kind={1}/></div><div className="goal-note"><span>THE ULTIMATE GOAL</span><strong>Meet {fruits[10].name.toLowerCase()}.</strong></div></aside>
    </section>
    <section className="evolution" aria-label="This round’s fruit evolution, from smallest to largest"><div><span className="eyebrow">THE FRUIT FAMILY</span><p>11 picks from 110 · A new family every round.</p></div><ol className="fruit-chain">{fruits.map((fruit,i)=><li key={fruit.name} className={i<=hud.highest?'discovered':''} title={`${i+1}. ${fruit.name}${i===10?' — the ultimate goal':''}`}><span className="chain-fruit"><Fruit kind={i}/>{i===hud.highest&&hud.drops>0&&<i/>}</span>{i<10&&<small aria-hidden="true">›</small>}</li>)}</ol></section>
    <footer>Made for your happy little breaks.<span>DROP. MERGE. REPEAT.</span></footer><div className="sr-only" aria-live="polite" aria-atomic="true">{notice}</div>
    <Dialog open={modal==='help'||modal==='win'} onOpenChange={open=>{if(!open)closeDialog();}}><DialogContent className="game-dialog">
      {modal==='win'?<><div className="dialog-art"><Fruit kind={10}/></div><DialogTitle className="dialog-title">Hello, {fruits[10].name.toLowerCase()}!</DialogTitle><DialogDescription className="dialog-copy">You grew the whole fruit family. Keep going for a bigger score—merge two final-level fruits to clear them and earn 100 bonus points.</DialogDescription><DialogClose className="primary-button"><Sparkles size={17}/> Keep growing</DialogClose></>:<><span className="eyebrow">A QUICK LITTLE GUIDE</span><DialogTitle className="dialog-title">Let’s grow something.</DialogTitle><DialogDescription className="dialog-copy">Aim, drop, and bring matching fruit together.</DialogDescription><ol className="rules"><li><b>Drop a fruit.</b><span>Move your mouse and click. On a phone, drag to aim and release to drop.</span></li><li><b>Make a match.</b><span>Two identical fruits touching become a bigger fruit and earn points.</span></li><li><b>Stack high. Don’t spill.</b><span>The dashed line is only a guide. Stack above it as high as you can; the round ends when a whole fruit falls outside the basket or through the bowl’s opening.</span></li><li><b>Discover a new fruit family.</b><span>Each round picks 11 characters from a collection of 110. Follow the fruit family below the basket. Matching two final-level fruits clears them for 100 bonus points.</span></li></ol><p className="gravity-guide">Gravity mode: allow motion access on your phone, then tilt to roll fruit around the circular bowl. The opening and dotted guides follow gravity. Keep your fruit inside as you tilt. Switching modes starts a new round; each mode keeps its own best score.</p><p className="keyboard-guide">Keyboard: <kbd>←</kbd> <kbd>→</kbd> aim · <kbd>Space</kbd> drop · <kbd>P</kbd> pause</p><DialogClose className="primary-button">Got it. Let’s play <ArrowRight size={17}/></DialogClose></>}
    </DialogContent></Dialog>
    <AlertDialog open={modal==='restart'||modal==='mode'} onOpenChange={open=>{if(!open)closeDialog();}}><AlertDialogContent className="game-dialog"><AlertDialogTitle className="dialog-title">{modal==='mode'?`Switch to ${pendingMode==='gravity'?'gravity':'classic'} mode?`:'A fresh start?'}</AlertDialogTitle><AlertDialogDescription className="dialog-copy">{modal==='mode'?'Changing the arena starts a new round. Your personal bests will stay.':'This basket will be cleared. Your personal best will stay.'}</AlertDialogDescription><div className="dialog-actions"><AlertDialogCancel className="secondary-button">Keep playing</AlertDialogCancel><AlertDialogAction className="primary-button" onClick={()=>{if(modal==='mode')void changeMode(pendingMode);else reset();}}>{modal==='mode'?'Switch mode':'New game'}</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </main>;
}
