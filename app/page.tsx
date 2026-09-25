'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { CircleHelp, VolumeX, Volume2, RotateCcw, ArrowRight, Trophy, MousePointer2, Pause, Play, Sparkles, Smartphone, Search, Palette, Moon, Sun, Magnet, Sprout, Droplets, WandSparkles, Hand, Waves, Minimize2, Shuffle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { requestPhoneTilt, type GravityVector } from './tilt';
import { isNativeApp, observeNativeActivity } from './native';
import { FRUIT_COLLECTION } from './fruit-collection';
import { FRUIT_HISTORY_KEY } from './fruit-selection';
import { POWER_DETAILS, powerStrength, type FruitPower, type PowerCharge } from './powers';
import { VIEW_PADDING } from './arena';
import { WIDTH, HEIGHT, STEP, MERGE_GATHER_SECONDS, MERGE_HOLD_SECONDS, MergeGame, type MergeEvent, type GameMode } from './engine';
import { loadSprites, renderGame } from './render';

type Modal = 'help' | 'restart' | 'win' | 'mode' | 'powers' | null;
type ScoreMode = 'classic' | 'gravity' | 'classic.powers' | 'gravity.powers';
const scoreMode = (game:MergeGame):ScoreMode => game.powersEnabled ? `${game.mode}.powers` : game.mode;
const bestKey = (mode:ScoreMode) => mode==='classic' ? 'tumblegrove.best' : `tumblegrove.best.${mode==='classic.powers'?'powers':mode}`;
const getHud = (g: MergeGame) => {
  const event=g.events.findLast(e=>g.time-e.time>=MERGE_GATHER_SECONDS&&g.time-e.time<2.6);
  const moment=event?{id:event.id,chain:event.chain,points:event.points,cleared:event.cleared,name:g.getFruit(event.kind).name}:null;
  return {lineup:g.lineup,moment,powersEnabled:g.powersEnabled,inventory:[...g.inventory],pendingReward:g.pendingReward,rewardProgress:g.rewardProgress,rewardNotice:g.rewardNotice,armedPowerId:g.armedPowerId,targeting:g.targeting,choiceOptions:g.choiceOptions,wildReady:g.wildReady,rescuedFruit:g.rescuedFruit,mode:g.mode,score:g.score,drops:g.drops,merges:g.merges,highest:g.highest,next:g.next,current:g.current,over:g.over,danger:g.danger>.1,watermelons:g.watermelons,inspecting:g.inspecting,inspectedKind:g.bodies.find(b=>b.id===g.inspectedId)?.kind??null,inspectedWild:!!g.bodies.find(b=>b.id===g.inspectedId)?.wild,hasFruit:g.bodies.length>0};
};
type ModelContext = { registerTool:(tool:{name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown}, options:{signal:AbortSignal})=>void|Promise<void> };
const powerIcons={gather:Magnet,ripen:Sprout,juice:Droplets,wild:WandSparkles,rescue:Hand,shake:Waves,squeeze:Minimize2,choose:Shuffle};
function PowerIcon({type,size=20}:{type:FruitPower;size?:number}){const Icon=powerIcons[type];return <Icon size={size} aria-hidden="true"/>;}
function powerInstruction(charge:PowerCharge){
  const strength=powerStrength(charge.level),limit=strength.maxKind+1;
  switch(charge.type){
    case 'gather':return `Tap an area to pull matching pairs together, up to growth level ${limit}.`;
    case 'ripen':return `Tap a fruit up to growth level ${limit} to grow it one level.`;
    case 'juice':return `Tap a fruit up to growth level ${limit} to clear it with a splash.`;
    case 'wild':return `Your next drop will match the first fruit it touches, up to growth level ${limit}.`;
    case 'rescue':return `Tap a fruit up to growth level ${limit} to save it outside the basket for later.`;
    case 'shake':return `Tap an area to gently shuffle fruit up to growth level ${limit}.`;
    case 'squeeze':return `Tap an area to shrink fruit up to growth level ${limit} until their next merge.`;
    case 'choose':return `Pick from ${strength.choices} fruits to replace your next drop.`;
  }
}
function FruitImage({id,url,className=''}:{id:number;url?:string;className?:string}){const fruit=FRUIT_COLLECTION[id];return url?<img className={`fruit-image ${className}`} src={url} alt={fruit.name} draggable={false}/>:<span className={`fruit-fallback ${className}`} aria-label={fruit.name}>{fruit.emoji}</span>;}
export default function Home() {
  const gameRef=useRef<MergeGame|null>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const spritesRef=useRef<HTMLCanvasElement[]>([]);
  const audioRef=useRef<AudioContext|null>(null);
  const soundRef=useRef(false);
  const [darkMode,setDarkMode]=useState(()=>document.documentElement.classList.contains('dark'));
  const darkModeRef=useRef(darkMode);
  const bestRef=useRef(0);
  const bestScoresRef=useRef<Record<ScoreMode,number>>({classic:0,gravity:0,'classic.powers':0,'gravity.powers':0});
  const tiltControllerRef=useRef<AbortController|null>(null);
  const tiltStopRef=useRef<(()=>void)|null>(null);
  const latestTiltRef=useRef<GravityVector>({x:0,y:1});
  const busyRef=useRef(false);
  const modalRef=useRef<Modal>(null);
  const [hud,setHud]=useState(()=>getHud(new MergeGame(()=>0)));
  const [best,setBest]=useState(0);
  const [sound,setSound]=useState(false);
  const [paused,setPaused]=useState(false);
  const [appActivity,setAppActivity]=useState({inactive:false});
  const appInactiveRef=useRef(false);
  const [tiltBusy,setTiltBusy]=useState(false);
  const [tiltError,setTiltError]=useState('');
  const [pendingMode,setPendingMode]=useState<GameMode>('gravity');
  const [pendingPowers,setPendingPowers]=useState(false);
  const [modal,setModal]=useState<Modal>(null);
  const [spriteUrls,setSpriteUrls]=useState<string[]>([]);
  const [notice,setNotice]=useState('');
  const [powerError,setPowerError]=useState('');
  const [swapRewardId,setSwapRewardId]=useState<number|null>(null);
  const [ready,setReady]=useState(false);
  const pointRef=useRef<number|null>(null);
  const playTone=useCallback((kind:number,drop=false,chain=1)=>{
    if(!soundRef.current)return;
    try{
      const audio=audioRef.current;
      if(!audio || audio.state!=='running')return;
      const now=audio.currentTime;
      const notes=drop?[0]:chain>1?[0,4,7]:[0,7];
      const base=drop?320:330*Math.pow(2,Math.min(18,kind+Math.max(0,chain-1)*2)/12);
      for(const [index,note] of notes.entries()){
        const oscillator=audio.createOscillator(),gain=audio.createGain(),start=now+index*.085,end=start+(drop?.14:.65);
        oscillator.type='sine';oscillator.frequency.setValueAtTime(base*Math.pow(2,note/12),start);
        if(drop)oscillator.frequency.exponentialRampToValueAtTime(155,start+.09);
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(drop?.09:.065/Math.sqrt(notes.length),start+.015);gain.gain.exponentialRampToValueAtTime(.001,end);
        oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(end+.02);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      }
    }catch{/* Sound is optional; play remains available. */}
  },[]);
  const unlockAudio=useCallback(()=>{
    if(!soundRef.current)return;
    try{audioRef.current??=new AudioContext();void audioRef.current.resume().catch(()=>{});}catch{}
  },[]);
  const sync=useCallback(()=>{const g=gameRef.current;if(g)setHud(getHud(g));},[]);
  const doDrop=useCallback((x?:number)=>{
    const game=gameRef.current;if(!game||busyRef.current||appInactiveRef.current)return false;
    unlockAudio();const dropped=game.drop(x);if(dropped){playTone(0,true);sync();}return dropped;
  },[playTone,sync,unlockAudio]);
  const reset=useCallback(()=>{pointRef.current=null;gameRef.current?.reset();setPaused(false);setModal(null);modalRef.current=null;setNotice('A fresh mix of fruit.');setPowerError('');setSwapRewardId(null);sync();canvasRef.current?.focus();},[sync]);
  useEffect(()=>{
    darkModeRef.current=darkMode;
    document.documentElement.classList.toggle('dark',darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',darkMode?'#14221c':'#fff9df');
    try{localStorage.setItem('tumblegrove.appearance',darkMode?'dark':'light');}catch{/* The switch also works when storage is unavailable. */}
  },[darkMode]);
  useEffect(()=>{
    let savedHistory:unknown;
    try{savedHistory=JSON.parse(localStorage.getItem(FRUIT_HISTORY_KEY)??'null');}catch{/* Discovery balancing also works without storage. */}
    const game=new MergeGame(Math.random,Math.random,savedHistory);
    try{game.powersEnabled=localStorage.getItem('tumblegrove.powers')==='on';}catch{}
    gameRef.current=game;
    let savedRevision=-1;
    const saveFruitHistory=()=>{if(savedRevision===game.historyRevision)return;savedRevision=game.historyRevision;try{localStorage.setItem(FRUIT_HISTORY_KEY,JSON.stringify(game.getFruitHistory()));}catch{}};
    saveFruitHistory();
    try{for(const mode of ['classic','gravity','classic.powers','gravity.powers'] as const){const key=bestKey(mode);const legacy=mode==='classic'?'fruitmerge.best':mode==='gravity'?'fruitmerge.best.gravity':null;const saved=Number(localStorage.getItem(key)??(legacy?localStorage.getItem(legacy):null));if(Number.isFinite(saved)&&saved>0){bestScoresRef.current[mode]=Math.floor(saved);localStorage.setItem(key,String(Math.floor(saved)));}}bestRef.current=bestScoresRef.current[scoreMode(game)];setBest(bestRef.current);}catch{}
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx){setNotice('Canvas is unavailable in this browser. Please use a current browser to play.');return;}
    let alive=true,last=0,accumulator=0,frame=0,lastUi=0,previousScore=0,previousWatermelons=0,wasOver=false,lastRewardNotice:object|null=null;
    const announcedEvents=new WeakSet<MergeEvent>();
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    void loadSprites().then(sprites=>{if(alive){spritesRef.current=sprites;setSpriteUrls(sprites.map(s=>s.toDataURL('image/png')));setReady(true);}}).catch(()=>{if(alive)setReady(true);});
    const animate=(now:number)=>{
      if(!alive)return;
      const delta=last?Math.min((now-last)/1000,.05):0;last=now;
      if(!appInactiveRef.current&&!game.paused&&!game.over){accumulator+=delta;while(accumulator>=STEP){game.step();accumulator-=STEP;}}else accumulator=0;
      if(game.score!==previousScore){previousScore=game.score;if(game.score>bestRef.current){bestRef.current=game.score;bestScoresRef.current[scoreMode(game)]=game.score;setBest(game.score);try{localStorage.setItem(bestKey(scoreMode(game)),String(game.score));}catch{}}}
      const reveals=game.events.filter(event=>!announcedEvents.has(event)&&game.time-event.time>=MERGE_GATHER_SECONDS);
      for(const event of reveals)announcedEvents.add(event);
      // Handle simultaneous pairs without flooding audio, and sync chimes to the reveal.
      for(const event of reveals.slice(-3))playTone(event.kind,false,event.chain);
      const discovery=reveals.at(-1);
      if(discovery)setNotice(discovery.cleared?`Final pair cleared. 100 points!`:`You grew ${game.getFruit(discovery.kind).name}.${discovery.chain>1?` ${discovery.chain}-step cascade!`:''}`);
      if(game.watermelons<previousWatermelons)previousWatermelons=game.watermelons;
      // Let the final fruit and any following cascade finish before a dialog pauses it.
      if(!game.targeting&&!game.choiceOptions.length&&game.watermelons>previousWatermelons&&game.events.every(event=>game.time-event.time>=MERGE_HOLD_SECONDS+.65)){
        previousWatermelons=game.watermelons;setModal('win');modalRef.current='win';game.paused=true;
      }
      if(game.rewardNotice&&game.rewardNotice!==lastRewardNotice){lastRewardNotice=game.rewardNotice;setNotice(game.rewardNotice.text);playTone(7,false,3);}
      if(game.over&&!wasOver)setNotice(`A fruit spilled. Final score: ${game.score}.`);
      wasOver=game.over;
      renderGame(ctx,game,spritesRef.current,reducedMotion,darkModeRef.current);
      if(now-lastUi>100){saveFruitHistory();setHud(old=>{const next=getHud(game);return JSON.stringify(old)===JSON.stringify(next)?old:next;});lastUi=now;}
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    const native=isNativeApp();let nativeActive=true;
    const updateNativeActivity=()=>{
      const inactive=!nativeActive||document.hidden;
      appInactiveRef.current=inactive;setAppActivity({inactive});last=0;accumulator=0;
      if(inactive){
        pointRef.current=null;game.paused=true;saveFruitHistory();
        void audioRef.current?.suspend().catch(()=>{});
      }else if(soundRef.current){void audioRef.current?.resume().catch(()=>{});}
      // Resuming only removes this pause reason. The effect below retains a
      // manual pause, inspection, an open dialog, or a pending tilt connection.
    };
    const stopNativeActivity=observeNativeActivity(active=>{nativeActive=active;updateNativeActivity();});
    const visibility=()=>{saveFruitHistory();if(native)updateNativeActivity();else if(document.hidden&&game.drops>0&&!game.over){pointRef.current=null;game.paused=true;setPaused(true);}};
    if(native)updateNativeActivity();
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',saveFruitHistory);
    return()=>{saveFruitHistory();stopNativeActivity();window.removeEventListener('pagehide',saveFruitHistory);alive=false;tiltControllerRef.current?.abort();tiltStopRef.current?.();cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);void audioRef.current?.close().catch(()=>{});audioRef.current=null;};
  },[playTone]);
  useEffect(()=>{modalRef.current=modal;if(gameRef.current)gameRef.current.paused=paused||hud.inspecting||modal!==null||tiltBusy||appActivity.inactive;},[paused,hud.inspecting,modal,tiltBusy,appActivity]);
  useEffect(()=>{
    if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);
  },[notice]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?:ModelContext}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=(tool:Parameters<ModelContext['registerTool']>[0])=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'read_tumble_grove_game',title:'Read Tumble Grove game',description:'Read score, fruit positions, current and next fruit, and whether a fruit can be dropped. The classic play area is 440 by 570; gravity mode uses a 440-diameter circle. Gravity and spawn coordinates are included. Fruit levels are 0 through 10. Every round mixes the whole collection with a preference for diverse artwork colours. The snapshot lists this round’s selected character for each level.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>gameRef.current?.snapshot()});
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
  const boardPoint=(clientX:number,clientY:number)=>{const rect=canvasRef.current?.getBoundingClientRect(),game=gameRef.current;return rect&&rect.width&&rect.height&&game?{x:(clientX-rect.left)/rect.width*(WIDTH+2*VIEW_PADDING)-VIEW_PADDING,y:(clientY-rect.top)/rect.height*(game.height+2*VIEW_PADDING)-VIEW_PADDING}:null;};
  const aim=(clientX:number,clientY:number)=>{const point=boardPoint(clientX,clientY),game=gameRef.current;if(point&&game&&!game.paused&&!game.inspecting){if(game.targeting)game.setPowerTarget(point.x,point.y);else game.setAimPoint(point.x,point.y);}};
  const toggleInspect=()=>{const game=gameRef.current;if(!game||busyRef.current||modalRef.current)return;if(game.targeting)return;if(game.setInspecting(!game.inspecting)){pointRef.current=null;setPaused(false);sync();canvasRef.current?.focus();}};
  const togglePause=()=>{const game=gameRef.current;if(!game||busyRef.current||modalRef.current)return;pointRef.current=null;if(game.inspecting){game.setInspecting(false);setPaused(false);sync();}else{game.paused=!game.paused;setPaused(game.paused);}canvasRef.current?.focus();};
  const openRestart=()=>{if(!hud.drops||hud.over)reset();else setModal('restart');};
  const toggleSound=()=>{soundRef.current=!soundRef.current;setSound(soundRef.current);unlockAudio();if(soundRef.current)playTone(3);};
  const changeMode=async(mode:GameMode)=>{
    const game=gameRef.current;if(!game||busyRef.current)return;
    setTiltError('');setModal(null);modalRef.current=null;
    if(mode==='gravity'){
      busyRef.current=true;setTiltBusy(true);game.paused=true;
      const controller=new AbortController();tiltControllerRef.current?.abort();tiltControllerRef.current=controller;
      try{
        const stop=await requestPhoneTilt(vector=>{latestTiltRef.current=vector;if(game.mode==='gravity')game.setGravity(vector.x,vector.y);},{signal:controller.signal,onError:error=>{if(!controller.signal.aborted){setTiltError(error.message);game.paused=true;setPaused(true);}}});
        if(controller.signal.aborted){stop();return;}
        tiltStopRef.current=stop;game.setMode('gravity');game.setGravity(latestTiltRef.current.x,latestTiltRef.current.y);
        bestRef.current=bestScoresRef.current[scoreMode(game)];setBest(bestRef.current);setPaused(false);setNotice('Gravity mode on. Tilt your phone to move the fruit.');
      }catch(error){if(!controller.signal.aborted)setTiltError(error instanceof Error?error.message:'Could not start phone tilt.');}
      finally{busyRef.current=false;setTiltBusy(false);sync();}
    }else{
      tiltControllerRef.current?.abort();tiltStopRef.current?.();tiltStopRef.current=null;
      game.setMode('classic');bestRef.current=bestScoresRef.current[scoreMode(game)];setBest(bestRef.current);setPaused(false);setNotice('Classic mode on.');sync();
    }
  };
  const chooseMode=(enabled:boolean)=>{const mode=enabled?'gravity':'classic';if(mode===hud.mode||tiltBusy)return;if(hud.drops&&!hud.over){setPendingMode(mode);setModal('mode');}else void changeMode(mode);};
  const changePowers=(enabled:boolean)=>{
    const game=gameRef.current;if(!game||busyRef.current)return;
    pointRef.current=null;game.setPowers(enabled);setPaused(false);setModal(null);modalRef.current=null;
    bestRef.current=bestScoresRef.current[scoreMode(game)];setBest(bestRef.current);
    try{localStorage.setItem('tumblegrove.powers',enabled?'on':'off');}catch{}
    setPowerError('');setSwapRewardId(null);setNotice(enabled?'Fruit powers on. Build a cascade of two or more merges to earn a power.':'Fruit powers off. A fresh ordinary round.');sync();canvasRef.current?.focus();
  };
  const choosePowers=(enabled:boolean)=>{if(enabled===hud.powersEnabled||tiltBusy)return;if(hud.drops&&!hud.over){setPendingPowers(enabled);setModal('powers');}else changePowers(enabled);};
  const pickFruit=(kind:number)=>{const game=gameRef.current;if(!game||appInactiveRef.current||modalRef.current)return;if(game.chooseFruit(kind)){pointRef.current=null;setNotice(`${game.getFruit(kind).name} ready to drop.`);sync();canvasRef.current?.focus();}};
  const armed=hud.inventory.find(charge=>charge.id===hud.armedPowerId);
  const swapping=!!hud.pendingReward&&swapRewardId===hud.pendingReward.id;
  const cancelPower=()=>{gameRef.current?.cancelPower();pointRef.current=null;setPowerError('');sync();canvasRef.current?.focus();};
  const armPower=(charge:PowerCharge)=>{
    const game=gameRef.current;if(!game||paused||game.inspecting||game.over||modalRef.current||busyRef.current)return;
    pointRef.current=null;setPowerError('');
    if(swapping){if(game.acceptReward(charge.id)){setSwapRewardId(null);setNotice('Power swapped.');sync();}return;}
    if(game.armedPowerId===charge.id){cancelPower();return;}
    if(game.armPower(charge.id)){sync();canvasRef.current?.focus();setNotice(`${POWER_DETAILS[charge.type].name}, power level ${charge.level}. ${powerInstruction(charge)} Basket paused. Cancel is free.`);}
  };
  const applyTargetedPower=(x:number,y:number)=>{
    const game=gameRef.current;if(!game||game.paused||modalRef.current||busyRef.current||appInactiveRef.current)return;
    if(game.usePowerAt(x,y)){setPowerError('');setNotice('Power used. Keep growing!');unlockAudio();playTone(5);}
    else setPowerError(game.rescuedFruit&&game.inventory.find(p=>p.id===game.armedPowerId)?.type==='rescue'?'Return your saved fruit before using Rescue again. Cancel keeps this power.':'No eligible fruit here. Try another target, or cancel.');
    pointRef.current=null;sync();
  };
  const activatePower=()=>{const game=gameRef.current;if(!game||game.paused||modalRef.current||appInactiveRef.current)return;if(game.activatePower()){setPowerError('');sync();canvasRef.current?.focus();}else setPowerError('Use your prepared fruit first, or cancel to keep this power.');};
  const releaseRescue=()=>{const game=gameRef.current;if(!game||game.paused||game.targeting||game.inspecting||game.over||appInactiveRef.current)return;if(game.releaseRescue()){pointRef.current=null;setNotice('Saved fruit ready to drop.');setPowerError('');sync();canvasRef.current?.focus();}else setNotice('Drop your prepared special fruit before returning the saved fruit.');};
  const closeDialog=()=>setModal(null);
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="./" aria-label="Tumble Grove home"><FruitImage id={hud.lineup[0]} url={spriteUrls[hud.lineup[0]]}/><span>tumble<span className="brand-light"> grove</span><span className="brand-dot">.</span></span></a><span className="mode-pill"><i/> {hud.mode==='gravity'?'GRAVITY MODE':'CLASSIC MODE'}{hud.powersEnabled?' · POWERS':''}</span><div className="toolbar"><button className="icon-button appearance-toggle" onClick={()=>setDarkMode(value=>!value)} aria-label="Dark mode" aria-pressed={darkMode} title={darkMode?'Switch to light mode':'Switch to dark mode'}>{darkMode?<Sun size={21}/>:<Moon size={21}/>}</button><button className="icon-button" onClick={toggleSound} aria-label={sound?'Mute sound':'Enable sound'} aria-pressed={sound} title={sound?'Mute sound':'Enable sound'}>{sound?<Volume2 size={21}/>:<VolumeX size={21}/>}</button><button className="icon-button" onClick={()=>setModal('help')} aria-label="How to play" title="How to play"><CircleHelp size={21}/></button></div></header>
    <section className="game-layout" aria-label="Tumble Grove game">
      <aside className="score-column"><div className="score-card"><span className="eyebrow">YOUR SCORE</span><strong className="score-number" aria-label={`Score: ${hud.score}`}>{hud.score.toLocaleString()}</strong><div className="best-score"><Trophy size={17}/><span>{hud.powersEnabled?'Best · powers':'Best'}</span><b>{best.toLocaleString()}</b></div></div><div className="next-card"><span className="eyebrow">UP NEXT</span><div className="next-fruit"><FruitImage id={hud.lineup[hud.next]} url={spriteUrls[hud.lineup[hud.next]]}/></div><span title={fruits[hud.next].name}>{fruits[hud.next].name}</span></div><button className="new-game" disabled={tiltBusy} onClick={openRestart} aria-label="New game"><RotateCcw size={17}/><span>New game</span></button><p className="little-note">A little focus.<br/>A lot of fruit.</p></aside>
      <div className={`play-column ${armed?'is-targeting':''}`}><div className="play-controls"><div className="mode-controls"><div className={`gravity-control ${hud.mode==='gravity'?'is-on':''}`}>
          <Smartphone size={22} aria-hidden="true"/><div className="gravity-label"><label htmlFor="gravity-toggle">Gravity mode</label><span id="gravity-description">{tiltBusy?'Allow motion access, then gently tilt your phone…':hud.mode==='gravity'?'Tilt your phone. Gravity follows.':'A circular bowl you control with phone tilt.'}</span></div><Switch id="gravity-toggle" className="gravity-switch" checked={hud.mode==='gravity'} onCheckedChange={chooseMode} disabled={tiltBusy} aria-describedby="gravity-description" aria-label="Gravity mode"/>
        </div><div className={`gravity-control powers-control ${hud.powersEnabled?'is-on':''}`}><Sparkles size={22} aria-hidden="true"/><div className="gravity-label"><label htmlFor="powers-toggle">Fruit powers</label><span id="powers-description">{hud.powersEnabled?'Cascades earn powers you can save.':'Build a cascade. Earn a little magic.'}</span></div><Switch id="powers-toggle" className="gravity-switch" checked={hud.powersEnabled} onCheckedChange={choosePowers} disabled={tiltBusy} aria-describedby="powers-description" aria-label="Fruit powers"/></div></div>{tiltBusy&&<button className="cancel-tilt" onClick={()=>tiltControllerRef.current?.abort()}>Cancel connection</button>}{tiltError&&<p className="tilt-error" role="alert">{tiltError}</p>}<div className="board-heading"><span>{hud.inspecting?'Take a closer look.':hud.powersEnabled?'Chain a match. Save the magic.':hud.mode==='gravity'?'Tilt, drop, and roll together.':'Make room for something bigger.'}</span><div className="board-actions"><button className="pause-button inspect-button" disabled={hud.over||tiltBusy||hud.targeting||!hud.hasFruit} onClick={toggleInspect} aria-label="Inspect fruit" aria-pressed={hud.inspecting} title="Pause and tap fruit to see their names"><Search size={14}/> INSPECT</button><button className="pause-button" disabled={hud.over||tiltBusy||hud.targeting} onClick={togglePause} aria-label={paused||hud.inspecting?'Resume game':'Pause game'}>{paused||hud.inspecting?<Play size={13}/>:<Pause size={13}/>} {paused||hud.inspecting?'RESUME':'PAUSE'}</button></div></div></div>
        <p className={`round-caption ${hud.moment&&!hud.inspecting?'merge-moment':''}`}>
          {armed?<><PowerIcon type={armed.type} size={15}/><strong>{POWER_DETAILS[armed.type].name} · Lv {armed.level}</strong><span>Basket paused</span></>:
          hud.rewardProgress&&hud.rewardProgress.level>0?<><Sparkles size={15}/><strong>{hud.rewardProgress.chain}-step cascade!</strong><span className="merge-points">Power Lv {hud.rewardProgress.level}</span></>:
          hud.moment&&!hud.inspecting?<><Sparkles size={15} aria-hidden="true"/><strong key={hud.moment.id} className="merge-moment-copy">{hud.moment.cleared?'Final pair!':hud.moment.chain>1?`${hud.moment.chain}-step cascade!`:'Beautifully grown.'}</strong><span className="merge-points">+{hud.moment.points}</span></>:
          hud.wildReady?<><WandSparkles size={15}/><strong>Wild seed ready</strong><span>Drop to match</span></>:
          hud.powersEnabled?<><Sparkles size={14}/><strong>{hud.inventory.length?'Your powers are ready below':'2 connected merges = a power'}</strong></>:
          <><Palette size={14} aria-hidden="true"/><span className="round-caption-prefix">THIS ROUND</span><strong>A fresh mix</strong></>}
        </p>
        <div className="arena-stage"><div className={`game-board ${hud.inspecting?'is-inspecting':''} ${hud.danger?'in-danger':''} ${hud.mode==='gravity'?'gravity-arena':''}`} style={{'--arena-ratio':(WIDTH+2*VIEW_PADDING)/((hud.mode==='gravity'?WIDTH:HEIGHT)+2*VIEW_PADDING),aspectRatio:`${WIDTH+2*VIEW_PADDING}/${(hud.mode==='gravity'?WIDTH:HEIGHT)+2*VIEW_PADDING}`} as CSSProperties} >
          <canvas ref={canvasRef} className="game-canvas" width={WIDTH} height={hud.mode==='gravity'?WIDTH:HEIGHT} tabIndex={0} role="application" aria-describedby={armed?'power-target-instruction':hud.inspecting?'inspection-status':undefined} aria-label={armed?`${POWER_DETAILS[armed.type].name} targeting. ${powerInstruction(armed)} Use arrow keys to move the target, Enter to use, Escape to cancel.`:hud.inspecting?'Tumble Grove inspection. Game paused. Tap a fruit to see its name, or use arrow keys to explore. Press Escape to resume.':`Tumble Grove play area. ${hud.mode==='gravity'?'Circular arena. Tilt your phone to change gravity. ':''}Current fruit: ${hud.wildReady?'Wild seed':fruits[hud.current].name}. Use left and right arrows to aim, Space or Enter to drop, P to pause, I to inspect fruit.`}
            onPointerDown={event=>{if(event.button!==0)return;event.currentTarget.focus();const game=gameRef.current;if(game?.inspecting){const point=boardPoint(event.clientX,event.clientY);if(point){game.inspectFruit(point.x,point.y);sync();}return;}if(!game||game.paused||game.choiceOptions.length||modalRef.current)return;pointRef.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);aim(event.clientX,event.clientY);unlockAudio();}}
            onPointerMove={event=>aim(event.clientX,event.clientY)}
            onPointerUp={event=>{if(gameRef.current?.inspecting||pointRef.current!==event.pointerId)return;aim(event.clientX,event.clientY);pointRef.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);const game=gameRef.current;if(game?.targeting){const point=boardPoint(event.clientX,event.clientY);if(point)applyTargetedPower(point.x,point.y);}else doDrop();}}
            onPointerCancel={()=>{pointRef.current=null;}}
            onKeyDown={event=>{
              if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter','p','P','i','I','Escape'].includes(event.key))event.preventDefault();
              const g=gameRef.current;if(!g)return;
              if(g.targeting){
                if(event.key==='Escape'){cancelPower();return;}
                if(g.paused||g.choiceOptions.length)return;
                const point=g.targetPoint??{x:WIDTH/2,y:g.height/2};
                if(event.key.startsWith('Arrow'))g.setPowerTarget(Math.max(0,Math.min(WIDTH,point.x+(event.key==='ArrowLeft'?-10:event.key==='ArrowRight'?10:0))),Math.max(0,Math.min(g.height,point.y+(event.key==='ArrowUp'?-10:event.key==='ArrowDown'?10:0))));
                if((event.key==='Enter'||event.key===' ')&&!event.repeat){const charge=g.inventory.find(p=>p.id===g.armedPowerId);if(charge&&POWER_DETAILS[charge.type].target==='none')activatePower();else applyTargetedPower(point.x,point.y);}
                return;
              }
              if((event.key==='i'||event.key==='I')&&!event.repeat){toggleInspect();return;}
              if((event.key==='p'||event.key==='P'||(event.key==='Escape'&&g.inspecting))&&!event.repeat){togglePause();return;}
              if(g.inspecting){if(event.key.startsWith('Arrow')){g.cycleInspectedFruit(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1);sync();}return;}
              if(g.paused||g.choiceOptions.length)return;
              if(event.key==='ArrowLeft')g.setAim(g.aim-12);if(event.key==='ArrowRight')g.setAim(g.aim+12);
              if((event.key===' '||event.key==='Enter')&&!event.repeat)doDrop();
            }}
          >Your browser needs Canvas to play this game.</canvas>
          {!hud.drops&&!paused&&!hud.inspecting&&!hud.targeting&&<div className="empty-board"><div className="empty-icon"><FruitImage id={hud.lineup[0]} url={spriteUrls[hud.lineup[0]]}/></div><h1>{hud.mode==='gravity'?'Give it a little tilt.':'Good things grow together.'}</h1><p>{hud.mode==='gravity'?<>Tilt to roll the fruit.<br/>Tap or drag to drop a new one.</>:<>Drop a fruit. Match a pair.<br/>See how big you can go.</>}</p><span className="empty-cta">{ready?'Click or tap to drop':'Getting the fruit ready…'} <ArrowRight size={16}/></span></div>}
          {paused&&!hud.over&&!hud.inspecting&&<div className="board-overlay"><div className="overlay-symbol"><Pause size={30}/></div><h2>A little breather.</h2><p>Your fruit will be right here.</p><button className="primary-button" onClick={()=>{setPaused(false);canvasRef.current?.focus();}}><Play size={17}/> Keep playing</button></div>}
          {hud.over&&<section className="board-overlay" aria-label="Game over"><div className="overlay-symbol"><FruitImage id={hud.lineup[hud.highest]} url={spriteUrls[hud.lineup[hud.highest]]}/></div><span className="eyebrow">A FRUIT FELL OUT</span><h2>Nicely grown.</h2><strong className="final-score">{hud.score.toLocaleString()}</strong><p>{hud.score>=best&&hud.score>0?'A new personal best!':`${hud.merges} happy little merges.`}</p><button className="primary-button" onClick={reset}><RotateCcw size={17}/> One more game</button></section>}
        </div></div>
        {hud.powersEnabled&&<section className="power-dock" aria-label="Saved powers">
          {hud.pendingReward&&!armed&&<output className="reward-offer"><PowerIcon type={hud.pendingReward.type} size={18}/><span>{swapping?'Tap a slot to replace':`Earned ${POWER_DETAILS[hud.pendingReward.type].name} · Lv ${hud.pendingReward.level}`}</span><button disabled={paused||hud.inspecting||hud.over} onClick={()=>setSwapRewardId(swapping?null:hud.pendingReward!.id)}>{swapping?'Cancel':'Swap'}</button><button onClick={()=>{gameRef.current?.skipReward();setSwapRewardId(null);sync();}} aria-label="Skip earned power">Skip</button></output>}
          {armed&&<div className="power-target-panel"><output id="power-target-instruction">{powerError||powerInstruction(armed)} <span>Cancel keeps your power.</span></output><div>{POWER_DETAILS[armed.type].target==='none'&&<button className="power-use" disabled={paused} onClick={activatePower}>{armed.type==='choose'?'Pick fruit':'Prepare seed'}</button>}<button className="power-cancel" onClick={cancelPower}><X size={16}/> Cancel</button></div></div>}
          <div className="power-slots">{Array.from({length:3},(_,index)=>{const charge=hud.inventory[index];return charge?<button key={charge.id} className={`power-slot ${armed?.id===charge.id?'is-armed':''} ${swapping?'is-swap':''}`} style={{'--power-color':POWER_DETAILS[charge.type].color} as CSSProperties} onClick={()=>armPower(charge)} disabled={paused||hud.inspecting||hud.over||tiltBusy} aria-pressed={armed?.id===charge.id} aria-label={`${swapping?'Replace':'Use'} ${POWER_DETAILS[charge.type].name}, power level ${charge.level}`} title={`${POWER_DETAILS[charge.type].description} ${powerInstruction(charge)}`}><PowerIcon type={charge.type}/><span><strong>{POWER_DETAILS[charge.type].name}</strong><small>{swapping?'Replace this':`Level ${charge.level}`}</small></span></button>:<div key={`empty-${index}`} className="power-slot is-empty"><Sparkles size={16}/><span>{index===0?'Earn a power':'Empty slot'}</span></div>;})}</div>
          {hud.rescuedFruit&&<button className="rescued-fruit" disabled={paused||hud.targeting||hud.inspecting||hud.over||!!hud.wildReady} onClick={releaseRescue}><Hand size={16}/><span>Saved: {fruits[hud.rescuedFruit.kind].name}</span><strong>Ready to drop</strong></button>}
        </section>}
        <p className={`control-hint ${hud.inspecting?'inspection-hint':''}`}>{armed?<><PowerIcon type={armed.type} size={15}/><span className="inspect-instruction">{POWER_DETAILS[armed.type].target==='none'?'Choose an action above':'Tap a target · Escape to cancel'}</span></>:hud.inspecting?<><Search size={15}/><span className="inspect-instruction">Paused · Tap a fruit to see its name</span></>:<><MousePointer2 size={15}/><span className="desktop-hint">Move to aim · Click to drop</span><span className="touch-hint">{hud.mode==='gravity'?'Tilt to roll · Drag and release to drop':'Drag to aim · Release to drop'}</span><kbd>← → &nbsp; + &nbsp; Space</kbd></>}</p><output id="inspection-status" className="sr-only" aria-live="polite" aria-atomic="true">{hud.inspecting?(hud.inspectedKind===null?'Game paused. Tap a fruit, or use the arrow keys, to learn its name.':hud.inspectedWild?'Wild seed. Merges with the first eligible fruit it touches.':`${fruits[hud.inspectedKind].name}. Level ${hud.inspectedKind+1}.`):''}</output></div>
      <aside className="goal-column"><span className="eyebrow">YOUR LATEST DISCOVERY</span><h2>Look what<br/>you grew.</h2><div className="watermelon-art"><FruitImage id={hud.lineup[hud.highest]} url={spriteUrls[hud.lineup[hud.highest]]}/></div><p>Match a pair.<br/>Discover what comes next.</p><div className="goal-note"><span>LEVEL {hud.highest+1}</span><strong>{fruits[hud.highest].name}</strong></div></aside>
    </section>

    <footer>Made for your happy little breaks.<span>DROP. MERGE. REPEAT.</span></footer><div className="sr-only" aria-live="polite" aria-atomic="true">{notice}</div>
    <Dialog open={hud.choiceOptions.length>0&&!hud.over&&!paused&&!hud.inspecting&&modal===null} onOpenChange={open=>{if(!open)cancelPower();}}><DialogContent className="game-dialog choice-dialog"><span className="eyebrow"><Sparkles size={16} aria-hidden="true"/> CHOOSE POWER</span><DialogTitle className="dialog-title">What falls next?</DialogTitle><DialogDescription className="dialog-copy">Pick a different fruit to spend your Choose power. Keeping the current fruit or closing costs nothing. The basket waits for you.</DialogDescription><div className="fruit-choices">{hud.choiceOptions.map(kind=><button key={kind} className="fruit-choice" onClick={()=>pickFruit(kind)} aria-label={`${kind===hud.current?'Keep':'Choose'} ${fruits[kind].name}`}><div><FruitImage id={hud.lineup[kind]} url={spriteUrls[hud.lineup[kind]]}/></div><strong>{fruits[kind].name}</strong><span>{kind===hud.current?'Keep current · free':`Growth level ${kind+1}`}</span></button>)}</div><p className="choice-hint">Choosing doesn’t drop it. Aim when you’re ready. Cancel for free with Escape or the close button.</p></DialogContent></Dialog>
    <Dialog open={modal==='help'||modal==='win'} onOpenChange={open=>{if(!open)closeDialog();}}><DialogContent className="game-dialog">
      {modal==='win'?<><div className="dialog-art"><FruitImage id={hud.lineup[10]} url={spriteUrls[hud.lineup[10]]}/></div><DialogTitle className="dialog-title">Hello, {fruits[10].name.toLowerCase()}!</DialogTitle><DialogDescription className="dialog-copy">You grew the whole fruit family. Keep going for a bigger score—merge two final-level fruits to clear them and earn 100 bonus points.</DialogDescription><DialogClose className="primary-button"><Sparkles size={17}/> Keep growing</DialogClose></>:<><span className="eyebrow">A QUICK LITTLE GUIDE</span><DialogTitle className="dialog-title">Let’s grow something.</DialogTitle><DialogDescription className="dialog-copy">Aim, drop, and bring matching fruit together.</DialogDescription><ol className="rules"><li><b>Drop a fruit.</b><span>Move your mouse and click. On a phone, drag to aim and release to drop.</span></li><li><b>Make a match.</b><span>Two identical fruits touching become a bigger fruit and earn points.</span></li><li><b>Stack high. Don’t spill.</b><span>The dashed line is only a guide. Stack above it as high as you can; the round ends when a whole fruit falls outside the basket or through the bowl’s opening.</span></li><li><b>Learn their names.</b><span>Merging fruit gather into a glowing new fruit, with a short beat before it can merge again. Cascades get brighter and their chimes rise with each step. Fruit names stay visible for three seconds; cascade counts celebrate the chain without multiplying your score. Choose Inspect to pause, then tap any fruit to see its name. Resume when you’re ready to keep playing.</span></li><li><b>A colourful mix each round.</b><span>Every round mixes fruits from the whole collection. Colours already present are less likely to repeat, especially at neighbouring size levels, while familiar and less-seen varieties stay in rotation. Each round still has 11 size levels and one fruit per level. Merge to discover the next one; two final-level fruits clear for 100 bonus points.</span></li></ol><p className="gravity-guide"><b>Fruit powers:</b> turn on the switch to earn magic through cascades. One merge earns points; when its new fruit merges again, you earn a level 1 power. Three linked merges earn level 2, up to level 5 for six or more. When a chain finishes, you receive one random power at its highest level. Unrelated matches don’t add to the chain, and powers can’t earn more powers.</p><p className="gravity-guide">Save up to three powers. Tap a saved power, then target a fruit or area while the basket pauses. Cancel keeps the power. When your slots are full, swap one or skip the new reward while you keep playing. Powers and any saved fruit last for this round. Turning powers on or off starts a new round; powers rounds keep separate best scores.</p><ul className="power-guide">{Object.entries(POWER_DETAILS).map(([type,detail])=><li key={type}><PowerIcon type={type as FruitPower} size={18}/><span><b>{detail.name}.</b> {detail.description}</span></li>)}</ul><p className="gravity-guide">Higher power levels affect larger fruit or a wider area, or offer more choices. Rescue holds one fruit outside the basket; tap it later to prepare it for dropping. Wild seed matches the first eligible fruit it touches. Squeezed fruit return to full size when they merge.</p><p className="gravity-guide">Gravity mode: allow motion access on your phone, then tilt to roll fruit around the circular bowl. The opening and dotted guides follow gravity. Keep your fruit inside as you tilt. Switching modes starts a new round; each mode keeps its own best score.</p><p className="gravity-guide"><a href="./fruit-sizes.html" target="_blank" rel="noreferrer">See all 110 fruits, sizes and sources ↗</a></p><p className="gravity-guide"><a href="./credits.html" target="_blank" rel="noreferrer">Credits &amp; licences ↗</a></p><p className="gravity-guide"><a href="./privacy.html" target="_blank" rel="noreferrer">Privacy policy ↗</a></p><p className="gravity-guide"><a href="./support.html" target="_blank" rel="noreferrer">Support ↗</a></p><p className="keyboard-guide">Keyboard: <kbd>←</kbd> <kbd>→</kbd> aim · <kbd>Space</kbd> drop · <kbd>P</kbd> pause · <kbd>I</kbd> inspect. While inspecting: arrows select fruit, <kbd>Esc</kbd> resumes. While targeting a power: arrows move the target, <kbd>Enter</kbd> uses it, <kbd>Esc</kbd> cancels.</p><DialogClose className="primary-button">Got it. Let’s play <ArrowRight size={17}/></DialogClose></>}
    </DialogContent></Dialog>
    <AlertDialog open={modal==='restart'||modal==='mode'||modal==='powers'} onOpenChange={open=>{if(!open)closeDialog();}}><AlertDialogContent className="game-dialog"><AlertDialogTitle className="dialog-title">{modal==='powers'?`Turn fruit powers ${pendingPowers?'on':'off'}?`:modal==='mode'?`Switch to ${pendingMode==='gravity'?'gravity':'classic'} mode?`:'A fresh start?'}</AlertDialogTitle><AlertDialogDescription className="dialog-copy">{modal==='powers'?'Changing fruit powers starts a new round. Powers and ordinary rounds keep separate personal bests.':modal==='mode'?'Changing the arena starts a new round. Your personal bests will stay.':'This basket will be cleared. Your personal best will stay.'}</AlertDialogDescription><div className="dialog-actions"><AlertDialogCancel className="secondary-button">Keep playing</AlertDialogCancel><AlertDialogAction className="primary-button" onClick={()=>{if(modal==='powers')changePowers(pendingPowers);else if(modal==='mode')void changeMode(pendingMode);else reset();}}>{modal==='powers'?`Turn ${pendingPowers?'on':'off'} & restart`:modal==='mode'?'Switch mode':'New game'}</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </main>;
}
