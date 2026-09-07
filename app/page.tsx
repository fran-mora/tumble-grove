'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp, VolumeX, Volume2, RotateCcw, ArrowRight, Trophy, MousePointer2, Pause, Play, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { FRUITS, WIDTH, HEIGHT, STEP, MergeGame } from './engine';
import { loadSprites, renderGame } from './render';

type Modal = 'help' | 'restart' | 'win' | null;
const getHud = (g: MergeGame) => ({score:g.score,drops:g.drops,merges:g.merges,highest:g.highest,next:g.next,current:g.current,over:g.over,danger:g.danger>.1,watermelons:g.watermelons});
type ModelContext = { registerTool:(tool:{name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown}, options:{signal:AbortSignal})=>void|Promise<void> };
export default function Home() {
  const gameRef=useRef<MergeGame|null>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const spritesRef=useRef<HTMLCanvasElement[]>([]);
  const audioRef=useRef<AudioContext|null>(null);
  const soundRef=useRef(false);
  const bestRef=useRef(0);
  const modalRef=useRef<Modal>(null);
  const [hud,setHud]=useState(()=>getHud(new MergeGame()));
  const [best,setBest]=useState(0);
  const [sound,setSound]=useState(false);
  const [paused,setPaused]=useState(false);
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
    const game=gameRef.current;if(!game)return false;
    unlockAudio();const dropped=game.drop(x);if(dropped){playTone(0,true);sync();}return dropped;
  },[playTone,sync,unlockAudio]);
  const reset=useCallback(()=>{gameRef.current?.reset();setPaused(false);setModal(null);modalRef.current=null;setNotice('Fresh fruit, fresh start.');sync();canvasRef.current?.focus();},[sync]);
  useEffect(()=>{
    const game=new MergeGame();gameRef.current=game;
    try{const saved=Number(localStorage.getItem('fruitmerge.best'));if(Number.isFinite(saved)&&saved>0){bestRef.current=Math.floor(saved);setBest(bestRef.current);}}catch{}
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
      if(game.score!==previousScore){previousScore=game.score;if(game.score>bestRef.current){bestRef.current=game.score;setBest(game.score);try{localStorage.setItem('fruitmerge.best',String(game.score));}catch{}}}
      if(game.merges>previousMerges){const event=game.events.at(-1);if(event)playTone(event.kind);}
      previousMerges=game.merges;
      if(game.watermelons>previousWatermelons){setModal('win');modalRef.current='win';game.paused=true;}
      previousWatermelons=game.watermelons;
      if(game.over&&!wasOver)setNotice(`Basket full. Final score: ${game.score}.`);
      wasOver=game.over;
      renderGame(ctx,game,spritesRef.current,reducedMotion);
      if(now-lastUi>100){setHud(old=>{const next=getHud(game);return JSON.stringify(old)===JSON.stringify(next)?old:next;});lastUi=now;}
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    const visibility=()=>{if(document.hidden&&game.drops>0&&!game.over){game.paused=true;setPaused(true);}};
    document.addEventListener('visibilitychange',visibility);
    return()=>{alive=false;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);void audioRef.current?.close().catch(()=>{});audioRef.current=null;};
  },[playTone]);
  useEffect(()=>{modalRef.current=modal;if(gameRef.current)gameRef.current.paused=paused||modal!==null;},[paused,modal]);
  useEffect(()=>{
    if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);
  },[notice]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?:ModelContext}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=(tool:Parameters<ModelContext['registerTool']>[0])=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'read_fruit_merge_game',title:'Read Fruit Merge game',description:'Read score, fruit positions, current and next fruit, and whether a fruit can be dropped. Coordinates use a 440 by 570 play area. Fruit kinds are 0 through 10, cherry through watermelon.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>gameRef.current?.snapshot()});
    register({name:'drop_fruit',title:'Drop a fruit',description:'Drop the current fruit at a horizontal position in the active game. Refuses while paused, a dialog is open, the cooldown is active, or the game is over.',inputSchema:{type:'object',properties:{x:{type:'number',minimum:0,maximum:440}},required:['x'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input)=>{
      if(!input||typeof input!=='object'||!('x' in input)||typeof input.x!=='number'||!Number.isFinite(input.x)||input.x<0||input.x>WIDTH)throw new Error('x must be a number from 0 to 440.');
      if(Object.keys(input).some(key=>key!=='x'))throw new Error('Only x is accepted.');
      if(modalRef.current||!doDrop(input.x))throw new Error('Cannot drop now. Read the game state and wait or resume the game.');
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      return gameRef.current?.snapshot();
    }});
    return()=>lifecycle.abort();
  },[doDrop]);
  const Fruit=({kind,className=''}:{kind:number;className?:string})=>spriteUrls[kind]?<img className={`fruit-image ${className}`} src={spriteUrls[kind]} alt={FRUITS[kind].name} draggable={false}/>:<span className={`fruit-fallback ${className}`} role="img" aria-label={FRUITS[kind].name}>{FRUITS[kind].emoji}</span>;
  const aim=(clientX:number)=>{const rect=canvasRef.current?.getBoundingClientRect();if(rect&&rect.width)gameRef.current?.setAim((clientX-rect.left)/rect.width*WIDTH);};
  const openRestart=()=>{if(!hud.drops||hud.over)reset();else setModal('restart');};
  const toggleSound=()=>{soundRef.current=!soundRef.current;setSound(soundRef.current);unlockAudio();if(soundRef.current)playTone(3);};
  const closeDialog=()=>setModal(null);
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="Fruit Merge home"><Fruit kind={0}/><span>fruit<span className="brand-light">merge</span><span className="brand-dot">.</span></span></a><span className="mode-pill"><i/> CLASSIC MODE</span><div className="toolbar"><button className="icon-button" onClick={toggleSound} aria-label={sound?'Mute sound':'Enable sound'} aria-pressed={sound} title={sound?'Mute sound':'Enable sound'}>{sound?<Volume2 size={21}/>:<VolumeX size={21}/>}</button><button className="icon-button" onClick={()=>setModal('help')} aria-label="How to play" title="How to play"><CircleHelp size={21}/></button></div></header>
    <section className="game-layout" aria-label="Fruit Merge game">
      <aside className="score-column"><div className="score-card"><span className="eyebrow">YOUR SCORE</span><strong className="score-number" aria-label={`Score: ${hud.score}`}>{hud.score.toLocaleString()}</strong><div className="best-score"><Trophy size={17}/><span>Personal best</span><b>{best.toLocaleString()}</b></div></div><div className="next-card"><span className="eyebrow">UP NEXT</span><div className="next-fruit"><Fruit kind={hud.next}/></div><span>{FRUITS[hud.next].name}</span></div><button className="new-game" onClick={openRestart} aria-label="New game"><RotateCcw size={17}/><span>New game</span></button><p className="little-note">A little focus.<br/>A lot of fruit.</p></aside>
      <div className="play-column"><div className="board-heading"><span>Make room for something bigger.</span><button className="pause-button" disabled={hud.over} onClick={()=>setPaused(p=>!p)} aria-label={paused?'Resume game':'Pause game'}>{paused?<Play size={13}/>:<Pause size={13}/>} {paused?'RESUME':'PAUSE'}</button></div>
        <div className={`game-board ${hud.danger?'in-danger':''}`}>
          <canvas ref={canvasRef} className="game-canvas" width={WIDTH} height={HEIGHT} tabIndex={0} role="application" aria-label={`Fruit Merge play area. Current fruit: ${FRUITS[hud.current].name}. Use left and right arrows to aim, Space or Enter to drop, P to pause.`}
            onPointerDown={event=>{if(event.button!==0)return;pointRef.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();aim(event.clientX);unlockAudio();}}
            onPointerMove={event=>aim(event.clientX)}
            onPointerUp={event=>{if(pointRef.current!==event.pointerId)return;aim(event.clientX);pointRef.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);doDrop();}}
            onPointerCancel={()=>{pointRef.current=null;}}
            onKeyDown={event=>{if(['ArrowLeft','ArrowRight',' ','Enter','p','P'].includes(event.key))event.preventDefault();const g=gameRef.current;if(!g)return;if(event.key==='ArrowLeft')g.setAim(g.aim-12);if(event.key==='ArrowRight')g.setAim(g.aim+12);if((event.key===' '||event.key==='Enter')&&!event.repeat)doDrop();if((event.key==='p'||event.key==='P')&&!event.repeat)setPaused(p=>!p);}}
          >Your browser needs Canvas to play this game.</canvas>
          {!hud.drops&&!paused&&<div className="empty-board"><div className="empty-icon"><Fruit kind={0}/></div><h1>Good things grow together.</h1><p>Drop a fruit. Match a pair.<br/>See how big you can go.</p><span className="empty-cta">{ready?'Click or tap to drop':'Getting the fruit ready…'} <ArrowRight size={16}/></span></div>}
          {paused&&!hud.over&&<div className="board-overlay"><div className="overlay-symbol"><Pause size={30}/></div><h2>A little breather.</h2><p>Your fruit will be right here.</p><button className="primary-button" onClick={()=>{setPaused(false);canvasRef.current?.focus();}}><Play size={17}/> Keep playing</button></div>}
          {hud.over&&<div className="board-overlay" role="region" aria-label="Game over"><div className="overlay-symbol"><Fruit kind={hud.highest}/></div><span className="eyebrow">THAT’S A FULL BASKET</span><h2>Nicely grown.</h2><strong className="final-score">{hud.score.toLocaleString()}</strong><p>{hud.score>=best&&hud.score>0?'A new personal best!':`${hud.merges} happy little merges.`}</p><button className="primary-button" onClick={reset}><RotateCcw size={17}/> One more game</button></div>}
        </div><p className="control-hint"><MousePointer2 size={15}/><span className="desktop-hint">Move to aim · Click to drop</span><span className="touch-hint">Drag to aim · Release to drop</span><kbd>← → &nbsp; + &nbsp; Space</kbd></p></div>
      <aside className="goal-column"><span className="eyebrow">THE BIG IDEA</span><h2>Small fruit.<br/>Big possibilities.</h2><div className="watermelon-art"><Fruit kind={10}/></div><p>Two of a kind become<br/>one of the next.</p><div className="mini-equation"><Fruit kind={0}/><span>+</span><Fruit kind={0}/><ArrowRight size={18}/><Fruit kind={1}/></div><div className="goal-note"><span>THE ULTIMATE GOAL</span><strong>Meet the watermelon.</strong></div></aside>
    </section>
    <section className="evolution" aria-label="Fruit evolution, from cherry to watermelon"><div><span className="eyebrow">THE FRUIT FAMILY</span><p>Every match is a fresh start.</p></div><ol className="fruit-chain">{FRUITS.map((fruit,i)=><li key={fruit.name} className={i<=hud.highest?'discovered':''} title={`${i+1}. ${fruit.name}${i===10?' — the ultimate goal':''}`}><span className="chain-fruit"><Fruit kind={i}/>{i===hud.highest&&hud.drops>0&&<i/>}</span>{i<10&&<small aria-hidden="true">›</small>}</li>)}</ol></section>
    <footer>Made for your happy little breaks.<span>DROP. MERGE. REPEAT.</span></footer><div className="sr-only" aria-live="polite" aria-atomic="true">{notice}</div>
    <Dialog open={modal==='help'||modal==='win'} onOpenChange={open=>{if(!open)closeDialog();}}><DialogContent className="game-dialog">
      {modal==='win'?<><div className="dialog-art"><Fruit kind={10}/></div><DialogTitle className="dialog-title">Hello, watermelon!</DialogTitle><DialogDescription className="dialog-copy">You grew the whole fruit family. Keep going for a bigger score—merge two watermelons to clear them and earn 100 bonus points.</DialogDescription><DialogClose className="primary-button"><Sparkles size={17}/> Keep growing</DialogClose></>:<><span className="eyebrow">A QUICK LITTLE GUIDE</span><DialogTitle className="dialog-title">Let’s grow something.</DialogTitle><DialogDescription className="dialog-copy">Aim, drop, and bring matching fruit together.</DialogDescription><ol className="rules"><li><b>Drop a fruit.</b><span>Move your mouse and click. On a phone, drag to aim and release to drop.</span></li><li><b>Make a match.</b><span>Two identical fruits touching become a bigger fruit and earn points.</span></li><li><b>Leave a little room.</b><span>If fruit stays above the dashed line for too long, the basket is full and the game ends.</span></li><li><b>Grow a watermelon.</b><span>Keep matching through all 11 fruits. Two watermelons clear for 100 bonus points.</span></li></ol><p className="keyboard-guide">Keyboard: <kbd>←</kbd> <kbd>→</kbd> aim · <kbd>Space</kbd> drop · <kbd>P</kbd> pause</p><DialogClose className="primary-button">Got it. Let’s play <ArrowRight size={17}/></DialogClose></>}
    </DialogContent></Dialog>
    <AlertDialog open={modal==='restart'} onOpenChange={open=>{if(!open)closeDialog();}}><AlertDialogContent className="game-dialog"><AlertDialogTitle className="dialog-title">A fresh start?</AlertDialogTitle><AlertDialogDescription className="dialog-copy">This basket will be cleared. Your personal best will stay.</AlertDialogDescription><div className="dialog-actions"><AlertDialogCancel className="secondary-button">Keep playing</AlertDialogCancel><AlertDialogAction className="primary-button" onClick={reset}>New game</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </main>;
}
