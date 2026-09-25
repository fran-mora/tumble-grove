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
  dropId?:number;powerBlocked?:boolean;naturalFresh?:boolean;rewardRoot?:number;
};
export type MergeSource = Pick<FruitBody,'kind'|'x'|'y'|'angle'|'scale'|'wild'>;
export type MergeEvent = {id:number;chain:number;sources:MergeSource[];x:number;y:number;kind:number;points:number;time:number;cleared:boolean;bodyId:number|null;power?:FruitPower};
export type PowerEffect = {id:number;power:FruitPower;level:number;kind:number;x:number;y:number;time:number;duration:number;radius:number};
type RewardChain = {id:number;count:number;lastTime:number};
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
  choiceOptions: number[] = [];
  inventory:PowerCharge[] = [];
  pendingReward:PowerCharge|null = null;
  rewardNotice:{id:number;text:string}|null = null;
  armedPowerId:number|null = null;
  targetPoint:{x:number;y:number}|null = null;
  wildReady:{level:number;maxKind:number}|null = null;
  rescuedFruit:{kind:number}|null = null;
  private nextDropPowered = false;
  private choiceOrder = new Map<number,number[]>();
  private rewardChains = new Map<number,RewardChain>();
  private powerSerial = 0;
  private rewardSerial = 0;
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
  get rewardProgress(){
    const chain=[...this.rewardChains.values()].sort((a,b)=>b.count-a.count||b.lastTime-a.lastTime)[0];
    return chain?{chain:chain.count,level:Math.min(5,Math.max(0,chain.count-1))}:null;
  }
  private clearPowers(){
    this.powerEffects=[];this.choiceOptions=[];this.inventory=[];this.pendingReward=null;this.rewardNotice=null;
    this.armedPowerId=null;this.targetPoint=null;this.wildReady=null;this.rescuedFruit=null;
    this.nextDropPowered=false;this.choiceOrder.clear();this.rewardChains.clear();this.powerSerial=0;this.rewardSerial=0;this.noticeSerial=0;this.lastReward=null;
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
  cancelPower(){this.armedPowerId=null;this.targetPoint=null;this.choiceOptions=[];}
  setPowerTarget(x:number,y:number){if(this.targeting&&Number.isFinite(x)&&Number.isFinite(y))this.targetPoint={x,y};}
  private spend(charge:PowerCharge){
    this.inventory=this.inventory.filter(item=>item.id!==charge.id);this.choiceOrder.delete(charge.id);this.cancelPower();
    if(this.pendingReward&&this.inventory.length<3){
      const reward=this.pendingReward;this.pendingReward=null;this.inventory.push(reward);this.notice(`${POWER_DETAILS[reward.type].name} level ${reward.level} added to the free slot.`);
    }
  }
  private effect(charge:PowerCharge,x:number,y:number,kind=0){
    const strength=powerStrength(charge.level);
    this.powerEffects.push({id:++this.powerSerial,power:charge.type,level:charge.level,kind,x,y,time:this.time,duration:strength.duration,radius:strength.radius});
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
  private taint(body:FruitBody){body.powerBlocked=true;body.naturalFresh=false;body.rewardRoot=undefined;}
  private taintPile(){
    // Contacts and changes to supporting fruit can move the whole pile. A power
    // cannot farm new charges through indirect collisions outside its visual area.
    // A later ordinary drop starts fresh credit against this older provenance.
    for(const body of this.bodies)this.taint(body);
  }
  private fitBody(body:FruitBody,reference:{x:number;y:number}){
    const shape=this.getBodyShape(body),walls=this.mode==='classic'?basketWalls(WIDTH,HEIGHT):bowlWalls(CIRCLE,CIRCLE.radius,this.down);
    const contain=()=>this.mode==='classic'?containInBasket(body,shape,reference,WIDTH,HEIGHT,false):containInBowl(body,shape,reference,CIRCLE,CIRCLE.radius,this.down,false);
    contain();collideWithWalls(body,shape,walls);contain();
  }
  getPowerTargetBody(x:number,y:number){
    const charge=this.armedCharge(),body=this.hitBody(x,y);
    return charge&&body&&!body.wild&&body.kind<=powerStrength(charge.level).maxKind?body:undefined;
  }
  isPowerTargetValid(x:number,y:number):boolean {
    const charge=this.armedCharge();
    if(!this.powerAvailable()||!charge||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>WIDTH||y<0||y>this.height)return false;
    if(this.mode==='gravity'&&Math.hypot(x-CIRCLE.x,y-CIRCLE.y)>CIRCLE.radius)return false;
    const {target}=POWER_DETAILS[charge.type],strength=powerStrength(charge.level);
    if(target==='none')return false;
    if(target==='fruit'){
      const body=this.getPowerTargetBody(x,y);
      return !!body&&!(charge.type==='rescue'&&this.rescuedFruit)&&!(charge.type==='ripen'&&body.kind>=10);
    }
    const nearby=this.bodies.filter(body=>!body.wild&&body.kind<=strength.maxKind&&Math.hypot(body.x-x,body.y-y)<=strength.radius);
    if(charge.type==='squeeze')return nearby.some(body=>(body.scale??1)>strength.scale+.001);
    if(charge.type==='gather')return nearby.some((a,i)=>nearby.some((b,j)=>j>i&&a.kind===b.kind&&Math.hypot(b.x-a.x,b.y-a.y)<strength.radius*1.2));
    return nearby.length>0;
  }
  usePowerAt(x:number,y:number):boolean {
    const charge=this.armedCharge();
    if(!charge||!this.isPowerTargetValid(x,y))return false;
    if(x<0||x>WIDTH||y<0||y>this.height||(this.mode==='gravity'&&Math.hypot(x-CIRCLE.x,y-CIRCLE.y)>CIRCLE.radius))return false;
    const detail=POWER_DETAILS[charge.type],strength=powerStrength(charge.level);
    if(detail.target==='none')return false;
    if(detail.target==='fruit'){
      const body=this.hitBody(x,y);
      if(!body||body.wild||body.kind>strength.maxKind||(charge.type==='rescue'&&this.rescuedFruit))return false;
      if(charge.type==='ripen'){
        if(body.kind>=FRUITS.length-1)return false;
        const reference={x:body.x,y:body.y};body.kind++;body.scale=1;body.age=0;body.birth={time:this.time,chain:1};
        this.taint(body);this.fitBody(body,reference);this.rememberFruit(body.kind);this.highest=Math.max(this.highest,body.kind);if(body.kind===10)this.watermelons++;
      }else{
        if(charge.type==='rescue')this.rescuedFruit={kind:body.kind};
        this.bodies=this.bodies.filter(item=>item.id!==body.id);
        // Removing support can settle the pile far beyond the selected fruit.
        for(const remaining of this.bodies)this.taint(remaining);
      }
      this.taintPile();this.effect(charge,body.x,body.y,body.kind);this.spend(charge);return true;
    }
    const nearby=this.bodies.filter(body=>!body.wild&&body.kind<=strength.maxKind&&Math.hypot(body.x-x,body.y-y)<=strength.radius);
    if(!nearby.length)return false;
    if(charge.type==='gather'&&!nearby.some((a,i)=>nearby.some((b,j)=>j>i&&a.kind===b.kind&&Math.hypot(b.x-a.x,b.y-a.y)<strength.radius*1.2)))return false;
    if(charge.type==='squeeze'){
      const shrinking=nearby.filter(body=>(body.scale??1)>strength.scale+.001);if(!shrinking.length)return false;
      for(const body of shrinking){body.scale=strength.scale;this.taint(body);}
    }
    this.taintPile();this.effect(charge,x,y);this.spend(charge);return true;
  }
  activatePower():boolean {
    const charge=this.armedCharge();if(!this.powerAvailable()||!charge)return false;
    if(charge.type==='wild'){
      if(this.wildReady)return false;
      const {maxKind}=powerStrength(charge.level);this.wildReady={level:charge.level,maxKind};this.spend(charge);this.setAim(this.aim);return true;
    }
    if(charge.type!=='choose'||this.wildReady)return false;
    if(this.choiceOptions.length)return true;
    const {choices,maxDropKind}=powerStrength(charge.level);
    let order=this.choiceOrder.get(charge.id);
    if(!order){
      const candidates=Array.from({length:maxDropKind+1},(_,kind)=>kind);order=[];
      while(candidates.length)order.push(candidates.splice(Math.floor(this.fraction()*candidates.length),1)[0]);
      this.choiceOrder.set(charge.id,order);
    }
    const options=[this.current,...order.filter(kind=>kind!==this.current).slice(0,choices-1)];
    this.choiceOptions=options;for(const kind of options)this.rememberFruit(kind);return true;
  }
  chooseFruit(kind:number):boolean {
    const charge=this.armedCharge();
    if(!this.powerAvailable()||charge?.type!=='choose'||!this.choiceOptions.includes(kind))return false;
    if(kind===this.current){this.cancelPower();return true;}
    this.current=kind;this.nextDropPowered=true;this.rememberFruit(kind);this.effect(charge,this.getSpawn().x,this.getSpawn().y,kind);this.spend(charge);this.setAim(this.aim);return true;
  }
  acceptReward(replaceId:number):boolean {
    if(!this.powerAvailable()||!this.pendingReward||!this.inventory.some(charge=>charge.id===replaceId))return false;
    const reward=this.pendingReward;this.inventory=this.inventory.map(charge=>charge.id===replaceId?reward:charge);this.choiceOrder.delete(replaceId);this.pendingReward=null;
    if(this.armedPowerId===replaceId)this.cancelPower();this.notice(`${POWER_DETAILS[reward.type].name} level ${reward.level} added.`);return true;
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
  get canDrop() { return !this.over && !this.paused && !this.inspecting && !this.targeting && !this.choiceOptions.length && this.cooldown <= 0; }
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
    const body:FruitBody = { id: ++this.serial, kind, x, y, vx: 0, vy: 0, angle: 0, age: 0,dropId:0 };
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
      const fruit:FruitBody={id:++this.serial,kind:0,x:spawn.x,y:spawn.y,vx:direction.x*20,vy:direction.y*20,angle:0,age:0,wild:{...this.wildReady},dropId:this.drops,powerBlocked:true};
      this.bodies.push(fruit);this.taintPile();this.wildReady=null;
    }else{
      const fruit=this.addFruit(this.current,spawn.x,spawn.y);fruit.vx=direction.x*20;fruit.vy=direction.y*20;
      fruit.dropId=this.drops;fruit.powerBlocked=this.nextDropPowered;fruit.naturalFresh=!this.nextDropPowered;if(this.nextDropPowered)this.taintPile();this.nextDropPowered=false;
      this.highest = Math.max(this.highest, this.current);this.current=this.next;
      const value=this.random();this.next=value<.27?0:value<.53?1:value<.75?2:value<.92?3:4;
      this.rememberFruit(this.current);this.rememberFruit(this.next);
    }
    this.cooldown = .48;
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
      rewardProgress:this.rewardProgress,rewardNotice:this.rewardNotice,armedPowerId:this.armedPowerId,targetPoint:this.targetPoint,targeting:this.targeting,
      wildReady:this.wildReady,rescuedFruit:this.rescuedFruit,choiceOptions:[...this.choiceOptions],powerEffects:this.powerEffects.map(e=>({...e})),
      mode:this.mode,height:this.height,gravity:this.gravity,direction:this.down,spawn:this.getSpawn(),score:this.score,drops:this.drops,merges:this.merges,highest:this.highest,
      current:this.current,next:this.next,canDrop:this.canDrop,paused:this.paused,inspecting:this.inspecting,inspectedId:this.inspectedId,over:this.over,danger:this.danger,watermelons:this.watermelons,
      celebrations:this.events.map(e=>({id:e.id,chain:e.chain,kind:e.kind,name:this.getFruit(e.kind).name,age:Math.round((this.time-e.time)*100)/100,cleared:e.cleared,bodyId:e.bodyId})),
      bodies:this.bodies.map(b=>({id:b.id,name:b.wild?'Wild seed':this.getFruit(b.kind).name,kind:b.kind,x:Math.round(b.x),y:Math.round(b.y),scale:b.scale??1,wild:b.wild??null,dropId:b.dropId??0,powerBlocked:!!b.powerBlocked,rewardRoot:b.rewardRoot??null}))
    };
  }
  private settleRewards(){
    for(const chain of this.rewardChains.values()){
      if(this.time-chain.lastTime<CASCADE_LINK_SECONDS)continue;
      this.rewardChains.delete(chain.id);if(chain.count<2)continue;
      const occupied=new Set([...this.inventory.map(charge=>charge.type),this.pendingReward?.type,this.lastReward]);
      const alternatives=POWER_TYPES.filter(type=>!occupied.has(type)),choices=alternatives.length?alternatives:POWER_TYPES;
      const type=choices[Math.floor(this.fraction()*choices.length)],reward={id:++this.powerSerial,type,level:Math.min(5,chain.count-1)};
      this.lastReward=type;
      if(this.inventory.length<3){this.inventory.push(reward);this.notice(`${chain.count}-merge cascade! ${POWER_DETAILS[type].name} level ${reward.level} earned.`);}
      else if(!this.pendingReward||reward.level>this.pendingReward.level){
        this.pendingReward=reward;this.notice(`${POWER_DETAILS[type].name} level ${reward.level} earned. Replace a saved power or skip.`);
      }else this.notice(`Power tray full. Your level ${this.pendingReward.level} offer is still waiting.`);
    }
  }
  private mergeCredit(a:FruitBody,b:FruitBody):Pick<FruitBody,'dropId'|'powerBlocked'|'rewardRoot'> {
    const dropId=Math.max(a.dropId??0,b.dropId??0);
    if(!this.powersEnabled)return {dropId};
    // A new normal drop can start a new chain, but can never extend an earlier
    // drop's chain. It can also start fresh after a power-assisted result.
    const fresh=[a,b].some((body,i)=>body.naturalFresh&&!body.powerBlocked&&(body.dropId??0)>([a,b][1-i].dropId??0));
    const overridesOldPower=(natural:FruitBody,powered:FruitBody)=>!natural.powerBlocked&&(natural.naturalFresh||natural.rewardRoot!==undefined)&&(natural.dropId??0)>(powered.dropId??0);
    if(a.wild||b.wild||(a.powerBlocked&&!overridesOldPower(b,a))||(b.powerBlocked&&!overridesOldPower(a,b)))return {dropId,powerBlocked:true};
    const roots=fresh?[]:[...new Set([a.rewardRoot,b.rewardRoot].filter((id):id is number=>id!==undefined))]
      .map(id=>this.rewardChains.get(id)).filter((chain):chain is RewardChain=>!!chain&&this.time-chain.lastTime<=CASCADE_LINK_SECONDS);
    const id=roots.length?Math.min(...roots.map(chain=>chain.id)):++this.rewardSerial;
    const count=1+Math.max(0,...roots.map(chain=>chain.count));
    for(const chain of roots)this.rewardChains.delete(chain.id);
    this.rewardChains.set(id,{id,count,lastTime:this.time});return {dropId,powerBlocked:false,rewardRoot:id};
  }
  private applyGather(dt:number){
    const acceleration=new Map<number,{x:number;y:number}>();
    for(const effect of this.powerEffects){
      if(effect.power!=='gather')continue;
      const nearby=this.bodies.filter(body=>!body.wild&&body.kind<=powerStrength(effect.level).maxKind&&Math.hypot(body.x-effect.x,body.y-effect.y)<=effect.radius);
      const pairs:{a:FruitBody;b:FruitBody;distance:number}[]=[];
      for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++){
        const a=nearby[i],b=nearby[j];if(a.kind!==b.kind)continue;
        const distance=Math.hypot(b.x-a.x,b.y-a.y);
        if(distance>1&&distance<effect.radius*1.2)pairs.push({a,b,distance});
      }
      const paired=new Set<number>();
      // Each fruit follows at most one matching partner per pulse, with smooth,
      // bounded acceleration. The ordinary collision/containment solver still runs.
      for(const {a,b,distance} of pairs.sort((a,b)=>a.distance-b.distance)){
        if(paired.has(a.id)||paired.has(b.id))continue;
        paired.add(a.id);paired.add(b.id);
        const nx=(b.x-a.x)/distance,ny=(b.y-a.y)/distance;
        const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
        const envelope=Math.sin(Math.PI*Math.min(1,(this.time-effect.time)/effect.duration));
        const force=Math.min(powerStrength(effect.level).acceleration*envelope,Math.max(0,(65-closing)/(2*dt)));
        for(const [body,sign] of [[a,1],[b,-1]] as const){
          const total=acceleration.get(body.id)??{x:0,y:0};
          if(force>0)this.taint(body);total.x+=nx*force*sign;total.y+=ny*force*sign;acceleration.set(body.id,total);
        }
      }
    }
    for(const effect of this.powerEffects){
      if(effect.power!=='shake')continue;
      const elapsed=this.time-effect.time,envelope=Math.sin(Math.PI*Math.min(1,elapsed/effect.duration));
      const force=Math.sin(elapsed*Math.PI*4)*envelope*(125+effect.level*20),down=this.down;
      for(const body of this.bodies){
        if(body.wild||body.kind>powerStrength(effect.level).maxKind||Math.hypot(body.x-effect.x,body.y-effect.y)>effect.radius)continue;
        const total=acceleration.get(body.id)??{x:0,y:0};total.x+=down.y*force;total.y-=down.x*force;acceleration.set(body.id,total);if(Math.abs(force)>.001)this.taint(body);
      }
    }
    for(const body of this.bodies){
      const force=acceleration.get(body.id);if(!force)continue;
      const scale=Math.min(1,145/Math.max(1,Math.hypot(force.x,force.y)));
      body.vx+=force.x*scale*dt;body.vy+=force.y*scale*dt;
    }
  }
  private readyToMerge(body:FruitBody) {
    return body.age>.08 && (!body.birth || this.time-body.birth.time>=mergeHoldSeconds(body.birth.chain));
  }
  step(dt = STEP) {
    if (this.paused || this.inspecting || this.over || this.targeting || this.choiceOptions.length || dt <= 0 || !Number.isFinite(dt)) return;
    dt = Math.min(dt, 1 / 60);
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.events = this.events.filter(e => this.time - e.time < MERGE_LABEL_SECONDS);
    if(this.powersEnabled){this.powerEffects=this.powerEffects.filter(effect=>this.time-effect.time<effect.duration);this.applyGather(dt);}
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
      this.bodies = this.bodies.filter(b => !removed.has(b.id));
      for (const [a, b] of pairs) {
        const kind = (a.wild?b.kind:b.wild?a.kind:a.kind) + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        // A cascade follows the result of a recent merge, not unrelated matches elsewhere.
        const chain=1+Math.max(...[a,b].map(body=>body.birth&&this.time-body.birth.time<=CASCADE_LINK_SECONDS?body.birth.chain:0));
        const sources=[a,b].map(({kind,x,y,angle,scale,wild})=>({kind,x,y,angle,...(scale?{scale}:{}),...(wild?{wild}:{})}));
        const credit=this.mergeCredit(a,b);
        const cleared = kind === FRUITS.length;
        const points = cleared ? 100 : kind * (kind + 1) / 2;
        let bodyId: number | null = null;
        if (!cleared) {
          const fruit = this.addFruit(kind, x, y);
          bodyId = fruit.id;
          fruit.birth={time:this.time,chain};Object.assign(fruit,credit);
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
        this.events.push({id:this.merges,chain,sources,x,y,kind:Math.min(kind,10),points,time:this.time,cleared,bodyId});
      }
    }
    // The dashed guide never ends a round. A whole fruit must spill outside.
    this.over = this.bodies.some(b => {
      const shape=shapes.get(b.id)??this.getBodyShape(b);
      return this.mode==='classic'?outsideBasket(b,shape,WIDTH,HEIGHT):outsideBowl(b,shape,CIRCLE,CIRCLE.radius);
    });
    this.danger = 0;
    if(this.powersEnabled)this.settleRewards();
  }
}
