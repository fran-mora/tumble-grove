import { FRUIT_COLLECTION } from './fruit-collection.ts';
import { chooseColourfulRound, parseFruitHistory, type FruitHistory } from './fruit-selection.ts';
import { basketWalls, bowlWalls, collideWithWalls, containInBasket, containInBowl, outsideBasket, outsideBowl, MOUTH_HALF_ANGLE } from './arena.ts';
import { fruitHull, hullContact, circleTravel, type Hull } from './collision.ts';
import { POWER_DETAILS, POWER_TYPES, powerStrength, type FruitPower, type PowerCharge } from './powers.ts';
export type {PowerCharge} from './powers.ts';
export const WIDTH = 440;
export const HEIGHT = 570;
export const DANGER_Y = 100;
export const STEP = 1 / 120;
export const MERGE_LABEL_SECONDS = 3;
export const MERGE_GATHER_SECONDS = .24;
export const MERGE_HOLD_SECONDS = 1.05;
export const CASCADE_LINK_SECONDS = 3;
export const COMBO_CALM_SECONDS = 1;
export const mergeHoldSeconds = (chain:number) => MERGE_HOLD_SECONDS + Math.min(3,Math.max(0,chain-1))*.1;
export const CIRCLE = {x:WIDTH/2,y:WIDTH/2,radius:WIDTH/2-.5};
export const CIRCLE_DANGER = -CIRCLE.radius + 95;
export type GameMode = 'classic' | 'gravity';
export const FRUITS = [
  { name: 'Cherry', emoji: '🍒', radius: 18, color: '#e74753' },
  { name: 'Strawberry', emoji: '🍓', radius: 25, color: '#f66b59' },
  { name: 'Grapes', emoji: '🍇', radius: 31, color: '#ac77c8' },
  { name: 'Mandarin', emoji: '🍊', radius: 37, color: '#f7a52d' },
  { name: 'Persimmon', emoji: '🟠', radius: 43, color: '#f38e2c' },
  { name: 'Apple', emoji: '🍎', radius: 49, color: '#ec6a58' },
  { name: 'Pear', emoji: '🍐', radius: 57, color: '#b4c95b' },
  { name: 'Peach', emoji: '🍑', radius: 64, color: '#f7a2a0' },
  { name: 'Pineapple', emoji: '🍍', radius: 72, color: '#eaba36' },
  { name: 'Melon', emoji: '🍈', radius: 84, color: '#b8ce77' },
  { name: 'Watermelon', emoji: '🍉', radius: 96, color: '#4b9952' },
] as const;
export const WILD_RADIUS = 18;
export type FruitBody = {
  id:number;kind:number;x:number;y:number;vx:number;vy:number;angle:number;age:number;
  birth?:{time:number;chain:number};scale?:number;wild?:{level:number;maxKind:number};
};
export type MergeSource = Pick<FruitBody,'kind'|'x'|'y'|'angle'|'scale'|'wild'>;
export type MergeEvent = {id:number;chain:number;sources:MergeSource[];x:number;y:number;kind:number;points:number;time:number;cleared:boolean;bodyId:number|null;power?:FruitPower;assisted?:boolean};
export type PowerEffect = {id:number;power:FruitPower;level:number;kind:number;x:number;y:number;time:number;duration:number;radius:number;bodyIds?:[number,number]};
export class MergeGame {
  bodies: FruitBody[] = [];
  events: MergeEvent[] = [];
  score = 0;
  drops = 0;
  merges = 0;
  highest = 0;
  current = 0;
  next = 0;
  aim = WIDTH / 2;
  time = 0;
  cooldown = 0;
  danger = 0;
  over = false;
  paused = false;
  powersEnabled = false;
  powerEffects: PowerEffect[] = [];
  inventory:PowerCharge[] = [];
  pendingReward:PowerCharge|null = null;
  rewardNotice:{id:number;text:string}|null = null;
  armedPowerId:number|null = null;
  targetPoint:{x:number;y:number}|null = null;
  wildReady:{level:number;maxKind:number}|null = null;
  rescuedFruit:{kind:number}|null = null;
  private nextDropPowered = false;
  gatherSourceId:number|null = null;
  private comboCount = 0;
  private comboPaid = false;
  private assisted = false;
  private calmSeconds = 0;
  private powerSerial = 0;
  private noticeSerial = 0;
  private lastReward:FruitPower|null = null;
  inspecting = false;
  inspectedId: number | null = null;
  watermelons = 0;
  mode: GameMode = 'classic';
  gravity = {x:0,y:1};
  private gravityTarget = {x:0,y:1};
  private gravityDirection = {x:0,y:1};
  private serial = 0;
  random: () => number;
  lineup: number[];
  historyRevision = 0;
  private history: FruitHistory;
  private encountered = new Set<number>();
  private appearanceRandom:()=>number;
  constructor(random: () => number = Math.random, appearanceRandom:()=>number=random, savedHistory?:unknown) {
    this.random=random;this.appearanceRandom=appearanceRandom;this.history=parseFruitHistory(savedHistory);
    const round=chooseColourfulRound(appearanceRandom,this.history);
    this.lineup=round.lineup;this.historyRevision++;
    this.rememberFruit(0);
  }
  getFruitHistory(){return parseFruitHistory(this.history);}
  private rememberFruit(kind:number){
    const id=this.lineup[kind];if(this.encountered.has(id))return;
    this.encountered.add(id);this.history.seen[id]=Math.min(1_000_000,this.history.seen[id]+1);this.historyRevision++;
  }
  getFruit(kind:number){return FRUIT_COLLECTION[this.lineup[kind]];}
  get targeting(){return this.armedPowerId!==null;}
  get powerAssisted(){return this.assisted;}
  get rewardProgress(){
    return this.comboCount?{chain:this.comboCount,level:Math.min(5,Math.max(0,this.comboCount-1)),paid:this.comboPaid,settling:Math.min(1,this.calmSeconds/COMBO_CALM_SECONDS)}:null;
  }
  private clearPowers(){
    this.powerEffects=[];this.inventory=[];this.pendingReward=null;this.rewardNotice=null;
    this.armedPowerId=null;this.targetPoint=null;this.gatherSourceId=null;this.wildReady=null;this.rescuedFruit=null;
    this.nextDropPowered=false;this.comboCount=0;this.comboPaid=false;this.assisted=false;this.calmSeconds=0;
    this.powerSerial=0;this.noticeSerial=0;this.lastReward=null;
  }
  setPowers(enabled:boolean){if(this.powersEnabled===enabled)return;this.powersEnabled=enabled;this.reset();}
  private powerAvailable(){return this.powersEnabled&&!this.paused&&!this.inspecting&&!this.over;}
  private fraction(){const value=this.random();return Number.isFinite(value)?Math.max(0,Math.min(1-Number.EPSILON,value)):0;}
  private notice(text:string){this.rewardNotice={id:++this.noticeSerial,text};}
  private armedCharge(){return this.inventory.find(charge=>charge.id===this.armedPowerId);}
  armPower(id:number):boolean {
    if(!this.powerAvailable()||!this.inventory.some(charge=>charge.id===id))return false;
    this.cancelPower();this.armedPowerId=id;this.targetPoint={x:WIDTH/2,y:this.height*.62};return true;
  }
  cancelPower(){this.armedPowerId=null;this.targetPoint=null;this.gatherSourceId=null;}
  clearGatherSelection(){this.gatherSourceId=null;}
  setPowerTarget(x:number,y:number){if(this.targeting&&Number.isFinite(x)&&Number.isFinite(y))this.targetPoint={x,y};}
  private spend(charge:PowerCharge){
    this.inventory=this.inventory.filter(item=>item.id!==charge.id);this.cancelPower();
    if(this.pendingReward&&this.inventory.length<3){
      const reward=this.pendingReward;this.pendingReward=null;this.inventory.push(reward);this.notice(`${POWER_DETAILS[reward.type].name} Strength ${reward.level} added to the free slot.`);
    }
  }
  private effect(charge:PowerCharge,x:number,y:number,kind=0,bodyIds?:[number,number]){
    const strength=powerStrength(charge.level);
    this.powerEffects.push({id:++this.powerSerial,power:charge.type,level:charge.level,kind,x,y,time:this.time,duration:charge.type==='gather'?strength.gatherDuration:strength.duration,radius:charge.type==='gather'?strength.gatherReach:strength.radius,...(bodyIds?{bodyIds}:{})});
  }
  private hitBody(x:number,y:number){
    return this.bodies.findLast(body=>{
      const {points}=this.getBodyShape(body);let positive=false,negative=false;
      for(let i=0;i<points.length;i++){
        const p=points[i],q=points[(i+1)%points.length],cross=(q.x-p.x)*(y-body.y-p.y)-(q.y-p.y)*(x-body.x-p.x);
        if(cross>1e-6)positive=true;if(cross< -1e-6)negative=true;if(positive&&negative)return false;
      }
      return true;
    });
  }
  private beginAssisted(){
    if(!this.powersEnabled)return;
    if(!this.assisted){this.bankCombo();this.comboCount=0;this.comboPaid=true;this.assisted=true;}
    this.calmSeconds=0;
  }
  private fitBody(body:FruitBody,reference:{x:number;y:number}){
    const shape=this.getBodyShape(body),walls=this.mode==='classic'?basketWalls(WIDTH,HEIGHT):bowlWalls(CIRCLE,CIRCLE.radius,this.down);
    const contain=()=>this.mode==='classic'?containInBasket(body,shape,reference,WIDTH,HEIGHT,false):containInBowl(body,shape,reference,CIRCLE,CIRCLE.radius,this.down,false);
    contain();collideWithWalls(body,shape,walls);contain();
  }
  getGatherPartners(sourceId:number):FruitBody[]{
    const charge=this.armedCharge(),source=this.bodies.find(body=>body.id===sourceId);
    if(charge?.type!=='gather'||!source||source.wild)return [];
    const reach=powerStrength(charge.level).gatherReach;
    return this.bodies.filter(body=>body.id!==source.id&&!body.wild&&body.kind===source.kind&&Math.hypot(body.x-source.x,body.y-source.y)<=reach);
  }
  getPowerTargetBody(x:number,y:number){
    const charge=this.armedCharge(),body=this.hitBody(x,y);if(!charge||!body||body.wild)return undefined;
    if(charge.type==='gather'){
      if(this.gatherSourceId===body.id)return body;
      return (this.gatherSourceId===null?this.getGatherPartners(body.id).length>0:this.getGatherPartners(this.gatherSourceId).some(partner=>partner.id===body.id))?body:undefined;
    }
    return charge.type==='squeeze'||body.kind<=powerStrength(charge.level).maxKind?body:undefined;
  }
  isPowerTargetValid(x:number,y:number):boolean {
    const charge=this.armedCharge();
    if(!this.powerAvailable()||!charge||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>WIDTH||y<0||y>this.height)return false;
    if(this.mode==='gravity'&&Math.hypot(x-CIRCLE.x,y-CIRCLE.y)>CIRCLE.radius)return false;
    const {target}=POWER_DETAILS[charge.type],strength=powerStrength(charge.level);
    if(target==='none')return false;
    if(target==='pair')return !!this.getPowerTargetBody(x,y);
    if(target==='fruit'){
      const body=this.getPowerTargetBody(x,y);
      return !!body&&!(charge.type==='rescue'&&this.rescuedFruit)&&!(charge.type==='ripen'&&body.kind>=10);
    }
    const nearby=this.bodies.filter(body=>!body.wild&&(charge.type==='squeeze'||body.kind<=strength.maxKind)&&Math.hypot(body.x-x,body.y-y)<=strength.radius);
    return charge.type==='squeeze'?nearby.some(body=>(body.scale??1)>strength.scale+.001):nearby.length>0;
  }
  usePowerAt(x:number,y:number):boolean {
    const charge=this.armedCharge();if(!charge||!this.isPowerTargetValid(x,y))return false;
    const detail=POWER_DETAILS[charge.type],strength=powerStrength(charge.level);
    if(detail.target==='pair'){
      const body=this.getPowerTargetBody(x,y)!;
      if(this.gatherSourceId===body.id){this.clearGatherSelection();return true;}
      if(this.gatherSourceId===null){this.gatherSourceId=body.id;this.targetPoint={x:body.x,y:body.y};return true;}
      const source=this.bodies.find(item=>item.id===this.gatherSourceId)!;
      this.beginAssisted();this.effect(charge,(source.x+body.x)/2,(source.y+body.y)/2,source.kind,[source.id,body.id]);this.spend(charge);return true;
    }
    if(detail.target==='fruit'){
      const body=this.getPowerTargetBody(x,y)!;this.beginAssisted();
      if(charge.type==='ripen'){
        const reference={x:body.x,y:body.y};body.kind++;body.scale=1;body.age=0;body.birth={time:this.time,chain:1};
        this.fitBody(body,reference);this.rememberFruit(body.kind);this.highest=Math.max(this.highest,body.kind);if(body.kind===10)this.watermelons++;
      }else{
        if(charge.type==='rescue')this.rescuedFruit={kind:body.kind};
        this.bodies=this.bodies.filter(item=>item.id!==body.id);
      }
      this.effect(charge,body.x,body.y,body.kind);this.spend(charge);return true;
    }
    const nearby=this.bodies.filter(body=>!body.wild&&(charge.type==='squeeze'||body.kind<=strength.maxKind)&&Math.hypot(body.x-x,body.y-y)<=strength.radius);
    this.beginAssisted();
    if(charge.type==='squeeze')for(const body of nearby)body.scale=Math.min(body.scale??1,strength.scale);
    this.effect(charge,x,y);this.spend(charge);return true;
  }
  activatePower():boolean {
    const charge=this.armedCharge();if(!this.powerAvailable()||!charge)return false;
    if(charge.type==='wild'){
      if(this.wildReady)return false;
      const {maxKind}=powerStrength(charge.level);this.wildReady={level:charge.level,maxKind};this.spend(charge);this.setAim(this.aim);return true;
    }
    return false;
  }
  acceptReward(replaceId:number):boolean {
    if(!this.powerAvailable()||!this.pendingReward||!this.inventory.some(charge=>charge.id===replaceId))return false;
    const reward=this.pendingReward;this.inventory=this.inventory.map(charge=>charge.id===replaceId?reward:charge);this.pendingReward=null;
    if(this.armedPowerId===replaceId)this.cancelPower();this.notice(`${POWER_DETAILS[reward.type].name} Strength ${reward.level} added.`);return true;
  }
  skipReward(){if(!this.pendingReward)return;this.pendingReward=null;this.notice('Power offer skipped.');}
  releaseRescue():boolean {
    if(!this.powerAvailable()||this.targeting||this.wildReady||!this.rescuedFruit)return false;
    this.current=this.rescuedFruit.kind;this.rescuedFruit=null;this.nextDropPowered=true;this.rememberFruit(this.current);this.setAim(this.aim);return true;
  }
  getShape(kind:number,angle=0){return fruitHull(kind,FRUITS[kind].radius,angle,this.getFruit(kind).geometry);}
  getBodyShape(body:Pick<FruitBody,'kind'|'angle'|'scale'|'wild'>):Hull {
    const scale=body.scale??1;
    if(body.wild){
      const points=Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8)*WILD_RADIUS*scale,y:Math.sin(i*Math.PI/8)*WILD_RADIUS*scale}));
      const axes=points.map((p,i)=>{const q=points[(i+1)%points.length],x=q.x-p.x,y=q.y-p.y,length=Math.hypot(x,y);return {x:-y/length,y:x/length};});
      return {points,axes,minX:-WILD_RADIUS*scale,maxX:WILD_RADIUS*scale,minY:-WILD_RADIUS*scale,maxY:WILD_RADIUS*scale};
    }
    const shape=this.getShape(body.kind,body.angle);if(scale===1)return shape;
    return {...shape,points:shape.points.map(p=>({x:p.x*scale,y:p.y*scale})),minX:shape.minX*scale,maxX:shape.maxX*scale,minY:shape.minY*scale,maxY:shape.maxY*scale};
  }
  getDropShape(){return this.wildReady?this.getBodyShape({kind:0,angle:0,wild:this.wildReady}):this.getShape(this.current);}
  get height() { return this.mode === 'gravity' ? WIDTH : HEIGHT; }
  get down() { return this.mode === 'gravity' ? this.gravityDirection : {x:0,y:1}; }
  setMode(mode: GameMode) {
    if (mode !== 'classic' && mode !== 'gravity') throw new Error('Invalid game mode');
    if (mode === this.mode) return;
    this.mode = mode; this.gravity = {x:0,y:1}; this.gravityTarget = {x:0,y:1}; this.gravityDirection = {x:0,y:1};
    this.reset();
  }
  setGravity(x:number,y:number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const magnitude = Math.max(1,Math.hypot(x,y));
    this.gravityTarget = {x:x/magnitude,y:y/magnitude};
  }
  setAimPoint(x:number,y:number) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const d=this.down;
    this.setAim(this.mode==='gravity' ? WIDTH/2+(x-CIRCLE.x)*d.y-(y-CIRCLE.y)*d.x : x);
  }
  getSpawn() {
    if(this.mode==='classic')return {x:this.aim,y:43};
    const d=this.down,offset=this.aim-WIDTH/2;
    const base={x:CIRCLE.x+d.y*offset,y:CIRCLE.y-d.x*offset};
    const shape=this.getDropShape();
    const travel=Math.max(0,circleTravel(base,shape,{x:-d.x,y:-d.y},CIRCLE,CIRCLE.radius)-18);
    return {x:base.x-d.x*travel,y:base.y-d.y*travel};
  }
  get canDrop() { return !this.over && !this.paused && !this.inspecting && !this.targeting && this.cooldown <= 0; }
  setInspecting(enabled: boolean) {
    if (enabled && (this.over || !this.bodies.length)) return false;
    this.inspecting = enabled;
    this.inspectedId = null;
    this.paused = enabled;
    return true;
  }
  inspectFruit(x: number, y: number) {
    if (!this.inspecting || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.inspectedId=this.hitBody(x,y)?.id??null;
  }
  cycleInspectedFruit(direction: -1 | 1) {
    if (!this.inspecting || !this.bodies.length) return;
    const index = this.bodies.findIndex(b => b.id === this.inspectedId);
    const next = index < 0 ? (direction === 1 ? 0 : this.bodies.length - 1)
      : (index + direction + this.bodies.length) % this.bodies.length;
    this.inspectedId = this.bodies[next].id;
  }
  setAim(x: number) {
    if (!Number.isFinite(x)) return;
    if(this.mode==='gravity'){const limit=Math.max(0,CIRCLE.radius*Math.sin(MOUTH_HALF_ANGLE)-(this.wildReady?WILD_RADIUS:FRUITS[this.current].radius)-12);this.aim=Math.max(WIDTH/2-limit,Math.min(WIDTH/2+limit,x));return;}
    const shape = this.getDropShape();
    this.aim = Math.max(-shape.minX + 1, Math.min(WIDTH - shape.maxX - 1, x));
  }
  addFruit(kind: number, x: number, y: number): FruitBody {
    if (!Number.isInteger(kind) || kind < 0 || kind >= FRUITS.length || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid fruit');
    const body:FruitBody = { id: ++this.serial, kind, x, y, vx: 0, vy: 0, angle: 0, age: 0 };
    this.rememberFruit(kind);
    this.bodies.push(body);
    return body;
  }
  drop(x = this.aim): boolean {
    if (!this.canDrop || !Number.isFinite(x)) return false;
    this.setAim(x);
    const spawn=this.getSpawn(),direction=this.down;
    this.drops++;
    if(this.wildReady){
      const fruit:FruitBody={id:++this.serial,kind:0,x:spawn.x,y:spawn.y,vx:direction.x*20,vy:direction.y*20,angle:0,age:0,wild:{...this.wildReady}};
      this.beginAssisted();this.bodies.push(fruit);this.wildReady=null;
    }else{
      const fruit=this.addFruit(this.current,spawn.x,spawn.y);fruit.vx=direction.x*20;fruit.vy=direction.y*20;
      if(this.nextDropPowered)this.beginAssisted();this.nextDropPowered=false;
      this.highest = Math.max(this.highest, this.current);this.current=this.next;
      const value=this.random();this.next=value<.27?0:value<.53?1:value<.75?2:value<.92?3:4;
      this.rememberFruit(this.current);this.rememberFruit(this.next);
    }
    this.calmSeconds=0;this.cooldown = .48;
    this.setAim(this.aim);
    return true;
  }
  reset() {
    this.clearPowers();
    const round=chooseColourfulRound(this.appearanceRandom,this.history,this.lineup);
    this.lineup=round.lineup;this.historyRevision++;this.encountered.clear();this.rememberFruit(0);
    this.bodies = []; this.events = []; this.score = 0; this.drops = 0; this.merges = 0;
    this.highest = 0; this.current = 0; this.next = 0; this.aim = WIDTH / 2;
    this.time = 0; this.cooldown = 0; this.danger = 0; this.over = false; this.paused = false;
    this.inspecting = false; this.inspectedId = null;
    this.watermelons = 0; this.serial = 0;
  }
  snapshot() {
    return {
      lineup:this.lineup.map(id=>({id,name:FRUIT_COLLECTION[id].name,level:FRUIT_COLLECTION[id].level})),
      powersEnabled:this.powersEnabled,inventory:this.inventory.map(c=>({...c})),pendingReward:this.pendingReward?{...this.pendingReward}:null,
      rewardProgress:this.rewardProgress,powerAssisted:this.powerAssisted,gatherSourceId:this.gatherSourceId,rewardNotice:this.rewardNotice,armedPowerId:this.armedPowerId,targetPoint:this.targetPoint,targeting:this.targeting,
      wildReady:this.wildReady,rescuedFruit:this.rescuedFruit,powerEffects:this.powerEffects.map(e=>({...e})),
      mode:this.mode,height:this.height,gravity:this.gravity,direction:this.down,spawn:this.getSpawn(),score:this.score,drops:this.drops,merges:this.merges,highest:this.highest,
      current:this.current,next:this.next,canDrop:this.canDrop,paused:this.paused,inspecting:this.inspecting,inspectedId:this.inspectedId,over:this.over,danger:this.danger,watermelons:this.watermelons,
      celebrations:this.events.map(e=>({id:e.id,chain:e.chain,kind:e.kind,name:this.getFruit(e.kind).name,age:Math.round((this.time-e.time)*100)/100,cleared:e.cleared,bodyId:e.bodyId,...(e.assisted?{assisted:true}:{})})),
      bodies:this.bodies.map(b=>({id:b.id,name:b.wild?'Wild seed':this.getFruit(b.kind).name,kind:b.kind,x:Math.round(b.x),y:Math.round(b.y),scale:b.scale??1,wild:b.wild??null}))
    };
  }
  private bankCombo(){
    if(this.assisted||this.comboPaid||this.comboCount<2)return;
    this.comboPaid=true;
    const occupied=new Set([...this.inventory.map(charge=>charge.type),this.pendingReward?.type,this.lastReward]);
    const alternatives=POWER_TYPES.filter(type=>!occupied.has(type)),choices=alternatives.length?alternatives:POWER_TYPES;
    const type=choices[Math.floor(this.fraction()*choices.length)],reward={id:++this.powerSerial,type,level:Math.min(5,this.comboCount-1)};
    this.lastReward=type;
    if(this.inventory.length<3){this.inventory.push(reward);this.notice(`${this.comboCount}-merge combo! ${POWER_DETAILS[type].name} Strength ${reward.level} earned.`);}
    else if(!this.pendingReward||reward.level>this.pendingReward.level){
      this.pendingReward=reward;this.notice(`${POWER_DETAILS[type].name} Strength ${reward.level} earned. Replace a saved power or skip.`);
    }else this.notice(`Power tray full. Your Strength ${this.pendingReward.level} offer is still waiting.`);
  }
  private recordComboMerge(){
    this.comboCount++;this.calmSeconds=0;
    if(this.comboCount>=6)this.bankCombo();
    return this.comboCount;
  }
  private settleCombo(dt:number,references:Map<number,{x:number;y:number}>,walls:ReturnType<typeof basketWalls>){
    if(this.over){this.bankCombo();return;}
    if(!this.comboCount&&!this.assisted)return;
    const shapes=new Map(this.bodies.map(body=>[body.id,this.getBodyShape(body)]));
    const down=this.down;
    let moving=this.events.some(event=>this.time-event.time<mergeHoldSeconds(event.chain))
      ||this.powerEffects.some(effect=>effect.power==='shake'||effect.power==='gather');
    for(const body of this.bodies){
      if(moving)break;
      const reference=references.get(body.id),speed=Math.hypot(body.vx,body.vy);
      if(!reference||body.age<.18||(body.birth&&!this.readyToMerge(body))){moving=true;break;}
      // Position correction and rolling on the bowl can jitter at a few px/s.
      // Both real displacement and speed must pass the resting deadband.
      const drift=Math.hypot(body.x-reference.x,body.y-reference.y)/dt;
      if(drift>14&&speed>8){moving=true;break;}
      // Slow airborne fruit still have a landing ahead, even at tiny gravity.
      if(body.vx*down.x+body.vy*down.y>.5){
        const probe={x:body.x+down.x*2,y:body.y+down.y*2},shape=shapes.get(body.id)!;
        const supported=walls.some(wall=>!!hullContact(probe,shape,wall,wall.shape))||this.bodies.some(other=>other.id!==body.id&&(other.x-body.x)*down.x+(other.y-body.y)*down.y>0&&!!hullContact(probe,shape,other,shapes.get(other.id)!));
        if(!supported){moving=true;break;}
      }
    }
    // A slow pair already closing its last few pixels should finish its merge
    // before the combo is banked. An obstacle or a stationary gap does not count.
    if(!moving)for(let i=0;i<this.bodies.length&&!moving;i++)for(let j=i+1;j<this.bodies.length;j++){
      const a=this.bodies[i],b=this.bodies[j];if(a.wild||b.wild||a.kind!==b.kind)continue;
      const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);if(distance<1)continue;
      const nx=dx/distance,ny=dy/distance,closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(closing<1.5)continue;
      const sa=shapes.get(a.id)!,sb=shapes.get(b.id)!;
      const near=hullContact({x:a.x+nx*6,y:a.y+ny*6},sa,b,sb);
      if(near&&distance>1&&closing>2){moving=true;break;}
    }
    this.calmSeconds=moving?0:this.calmSeconds+dt;
    if(this.calmSeconds>=COMBO_CALM_SECONDS){this.bankCombo();this.comboCount=0;this.comboPaid=false;this.assisted=false;this.calmSeconds=0;}
  }
  private applyGather(dt:number){
    const acceleration=new Map<number,{x:number;y:number}>();
    for(const effect of this.powerEffects){
      if(effect.power!=='gather'||!effect.bodyIds)continue;
      const a=this.bodies.find(body=>body.id===effect.bodyIds![0]),b=this.bodies.find(body=>body.id===effect.bodyIds![1]);
      if(!a||!b||a.kind!==b.kind)continue;
      const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);if(distance<1)continue;
      const nx=dx/distance,ny=dy/distance,closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny,strength=powerStrength(effect.level);
      const ramp=Math.min(1,(this.time-effect.time)/.18);
      const force=Math.min(strength.gatherAcceleration*ramp,Math.max(0,(strength.gatherSpeed-closing)*8));
      for(const [body,sign] of [[a,1],[b,-1]] as const){
        const total=acceleration.get(body.id)??{x:0,y:0};total.x+=nx*force*sign;total.y+=ny*force*sign;acceleration.set(body.id,total);
      }
    }
    for(const effect of this.powerEffects){
      if(effect.power!=='shake')continue;
      const elapsed=this.time-effect.time,envelope=Math.sin(Math.PI*Math.min(1,elapsed/effect.duration));
      const force=Math.sin(elapsed*Math.PI*4)*envelope*(125+effect.level*20),down=this.down;
      for(const body of this.bodies){
        if(body.wild||body.kind>powerStrength(effect.level).maxKind||Math.hypot(body.x-effect.x,body.y-effect.y)>effect.radius)continue;
        const total=acceleration.get(body.id)??{x:0,y:0};total.x+=down.y*force;total.y-=down.x*force;acceleration.set(body.id,total);
      }
    }
    for(const body of this.bodies){
      const force=acceleration.get(body.id);if(!force)continue;
      const scale=Math.min(1,650/Math.max(1,Math.hypot(force.x,force.y)));
      body.vx+=force.x*scale*dt;body.vy+=force.y*scale*dt;
    }
  }
  private readyToMerge(body:FruitBody) {
    return body.age>.08 && (!body.birth || this.time-body.birth.time>=mergeHoldSeconds(body.birth.chain));
  }
  step(dt = STEP) {
    if (this.paused || this.inspecting || this.over || this.targeting || dt <= 0 || !Number.isFinite(dt)) return;
    dt = Math.min(dt, 1 / 60);
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.events = this.events.filter(e => this.time - e.time < MERGE_LABEL_SECONDS);
    if(this.powersEnabled){this.powerEffects=this.powerEffects.filter(effect=>this.time-effect.time<effect.duration&&(effect.power!=='gather'||effect.bodyIds?.every(id=>this.bodies.some(body=>body.id===id))));this.applyGather(dt);}
    if(this.mode==='gravity'){
      const mix=1-Math.exp(-10*dt);
      this.gravity.x+=(this.gravityTarget.x-this.gravity.x)*mix;this.gravity.y+=(this.gravityTarget.y-this.gravity.y)*mix;
      const length=Math.hypot(this.gravity.x,this.gravity.y);
      if(length>.045)this.gravityDirection={x:this.gravity.x/length,y:this.gravity.y/length};
    }
    const walls=this.mode==='gravity'?bowlWalls(CIRCLE,CIRCLE.radius,this.down):basketWalls(WIDTH,HEIGHT);
    const references=new Map(this.bodies.map(body=>[body.id,{x:body.x,y:body.y}]));
    const contain=(body:FruitBody,shape:ReturnType<MergeGame['getShape']>,reference:{x:number;y:number},bounce=true)=>{
      if(this.mode==='classic')containInBasket(body,shape,reference,WIDTH,HEIGHT,bounce);
      else containInBowl(body,shape,reference,CIRCLE,CIRCLE.radius,this.down,bounce);
    };
    for (const b of this.bodies) {
      b.age += dt; b.vx += (this.mode==='gravity'?this.gravity.x:0)*1050*dt; b.vy += (this.mode==='gravity'?this.gravity.y:1)*1050*dt;
      b.vx *= Math.exp(-.8 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.angle += b.vx * dt / FRUITS[b.kind].radius * .38;
    }
    // Rotation stays fixed during position solving; only world translations change.
    const shapes = new Map(this.bodies.map(b => [b.id, this.getBodyShape(b)]));
    // Stop fast motion at solid boundaries before looking for merge contacts.
    for(const body of this.bodies)contain(body,shapes.get(body.id)!,references.get(body.id)!);
    const removed = new Set<number>();
    const pairs: [FruitBody, FruitBody][] = [];
    for (let iteration = 0; iteration < 8; iteration++) {
      for (let i = 0; i < this.bodies.length; i++) {
        const a = this.bodies[i]; if (removed.has(a.id)) continue;
        const ra = (a.wild?WILD_RADIUS:FRUITS[a.kind].radius)*(a.scale??1);
        for (let j = i + 1; j < this.bodies.length; j++) {
          const b = this.bodies[j]; if (removed.has(a.id) || removed.has(b.id)) continue;
          const rb = (b.wild?WILD_RADIUS:FRUITS[b.kind].radius)*(b.scale??1);
          const contact = hullContact(a, shapes.get(a.id)!, b, shapes.get(b.id)!);
          if (!contact) continue;
          const match=!a.wild&&!b.wild?a.kind===b.kind:!!(a.wild&&!b.wild&&b.kind<=a.wild.maxKind||b.wild&&!a.wild&&a.kind<=b.wild.maxKind);
          if (match && this.readyToMerge(a) && this.readyToMerge(b)) {
            removed.add(a.id); removed.add(b.id); pairs.push([a, b]); continue;
          }
          const { nx, ny, depth } = contact;
          const invA = 1 / (ra * ra), invB = 1 / (rb * rb), total = invA + invB;
          const correction = Math.max(0, depth - .015) * .8 / total;
          a.x -= nx * correction * invA; a.y -= ny * correction * invA;
          b.x += nx * correction * invB; b.y += ny * correction * invB;
          const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (relative < 0) {
            const restitution = relative < -65 ? .12 : 0;
            const impulse = -(1 + restitution) * relative / total;
            a.vx -= impulse * nx * invA; a.vy -= impulse * ny * invA;
            b.vx += impulse * nx * invB; b.vy += impulse * ny * invB;
            const tangent = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
            const coefficient=.22;
            const friction = Math.max(-impulse * coefficient, Math.min(impulse * coefficient, -tangent / total));
            a.vx -= friction * -ny * invA; a.vy -= friction * nx * invA;
            b.vx += friction * -ny * invB; b.vy += friction * nx * invB;
          }
        }
      }
      for (const b of this.bodies) {
        if (removed.has(b.id)) continue;
        const shape = shapes.get(b.id)!;
        contain(b,shape,references.get(b.id)!);
        collideWithWalls(b,shape,walls);
        contain(b,shape,references.get(b.id)!);
      }
    }
    if (pairs.length) {
      if(this.powersEnabled&&pairs.some(([a,b])=>a.wild||b.wild))this.beginAssisted();
      this.bodies = this.bodies.filter(b => !removed.has(b.id));
      for (const [a, b] of pairs) {
        const kind = (a.wild?b.kind:b.wild?a.kind:a.kind) + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        // Powers mode shares one basket-wide combo. Ordinary mode keeps the
        // original animation chain that follows recently merged fruit.
        const chain=this.powersEnabled?this.recordComboMerge():1+Math.max(...[a,b].map(body=>body.birth&&this.time-body.birth.time<=CASCADE_LINK_SECONDS?body.birth.chain:0));
        const sources=[a,b].map(({kind,x,y,angle,scale,wild})=>({kind,x,y,angle,...(scale?{scale}:{}),...(wild?{wild}:{})}));
        const cleared = kind === FRUITS.length;
        const points = cleared ? 100 : kind * (kind + 1) / 2;
        let bodyId: number | null = null;
        if (!cleared) {
          const fruit = this.addFruit(kind, x, y);
          bodyId = fruit.id;
          fruit.birth={time:this.time,chain};
          // Preserve the parents' average velocity; celebration is visual, never a kick.
          fruit.vx=(a.vx+b.vx)/2;fruit.vy=(a.vy+b.vy)/2;
          const shape=this.getShape(kind);
          const startA=references.get(a.id)!,startB=references.get(b.id)!;
          const reference={x:(startA.x+startB.x)/2,y:(startA.y+startB.y)/2};
          // The larger silhouette must fit before it is rendered or checked for a spill.
          contain(fruit,shape,reference,false);
          collideWithWalls(fruit,shape,walls);
          contain(fruit,shape,reference,false);
          shapes.set(fruit.id,shape);
          this.highest = Math.max(this.highest, kind);
          if (kind === 10) this.watermelons++;
        }
        this.score += points; this.merges++;
        this.events.push({id:this.merges,chain,sources,x,y,kind:Math.min(kind,10),points,time:this.time,cleared,bodyId,...(this.powersEnabled&&this.assisted?{assisted:true}:{})});
      }
    }
    // The dashed guide never ends a round. A whole fruit must spill outside.
    this.over = this.bodies.some(b => {
      const shape=shapes.get(b.id)??this.getBodyShape(b);
      return this.mode==='classic'?outsideBasket(b,shape,WIDTH,HEIGHT):outsideBowl(b,shape,CIRCLE,CIRCLE.radius);
    });
    this.danger = 0;
    if(this.powersEnabled)this.settleCombo(dt,references,walls);
  }
}
