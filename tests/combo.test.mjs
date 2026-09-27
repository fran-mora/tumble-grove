import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MergeGame,STEP,HEIGHT,WIDTH,COMBO_CALM_SECONDS} from '../app/engine.ts';
const advance=(g,seconds)=>{for(let n=0;n<Math.ceil(seconds/STEP);n++)g.step();};
function fresh(mode='classic'){const g=new MergeGame(()=>0);g.setMode(mode);g.setPowers(true);return g;}
function pair(g,kind=0,x=220,y=280){for(const dx of [-7,7])g.addFruit(kind,x+dx,y).age=2;g.step();return g.bodies.at(-1);}
function link(g,result){const b=g.addFruit(result.kind,220,280);b.age=2;const before=g.merges;for(let i=0;i<300&&g.merges===before;i++){result.x=b.x=220;result.y=b.y=280;result.vx=result.vy=b.vx=b.vy=0;g.step();}assert.equal(g.merges,before+1);return g.bodies.at(-1);}
function cascade(g,count){let body=pair(g);for(let i=1;i<count;i++)body=link(g,body);return body;}
function settle(g,limit=15){for(let i=0;i<limit/STEP&&(g.rewardProgress||g.powerAssisted);i++)g.step();assert.equal(g.rewardProgress,null);assert.equal(g.powerAssisted,false);}
let id=20000;
function charge(g,type,level=1){const item={id:++id,type,level};g.inventory.push(item);assert.equal(g.armPower(item.id),true);return item;}

test('whole-basket natural combos award strengths one through five once, with six paying immediately',()=>{
  for(let count=1;count<=7;count++){
    const g=fresh();cascade(g,count);assert.equal(g.rewardProgress.chain,count);assert.equal(g.rewardProgress.level,Math.min(5,count-1));
    assert.equal(g.inventory.length,count>=6?1:0);assert.equal(g.rewardProgress.paid,count>=6);
    assert.deepEqual(g.events.map(e=>e.chain),Array.from({length:Math.min(count,g.events.length)},(_,i)=>count-g.events.length+i+1));
    settle(g);assert.equal(g.inventory.length,count>1?1:0);if(count>1)assert.equal(g.inventory[0].level,Math.min(5,count-1));advance(g,3);assert.equal(g.inventory.length,count>1?1:0);
  }
});

test('simultaneous and unrelated matches anywhere in the basket share one visible combo counter',()=>{
  const g=fresh();for(const [kind,x,y] of [[0,65,250],[0,80,250],[2,350,350],[2,365,350]])g.addFruit(kind,x,y).age=2;
  g.step();assert.equal(g.merges,2);assert.deepEqual(g.events.map(e=>e.chain),[1,2]);assert.equal(g.rewardProgress.chain,2);settle(g);assert.equal(g.inventory.length,1);assert.equal(g.inventory[0].level,1);
});

test('continued movement beyond three seconds and later ordinary drops keep the same unsettled combo',()=>{
  const g=fresh();pair(g,0,80,280);const moving=g.addFruit(3,320,250);moving.age=2;
  for(let i=0;i<5/STEP;i++){moving.x=320;moving.y=250;moving.vy=60;g.step();}
  assert.equal(g.rewardProgress.chain,1);assert.equal(g.inventory.length,0);
  assert.equal(g.drop(40),true);pair(g,2,320,330);assert.equal(g.rewardProgress.chain,2);assert.equal(g.events.at(-1).chain,2);
  settle(g);assert.equal(g.inventory.length,1);
});

test('one paid maximum combo survives ongoing drops and movement without repeated awards',()=>{
  const g=fresh();let result=cascade(g,6);const first=g.inventory[0];assert.equal(first.level,5);
  g.cooldown=0;assert.equal(g.drop(25),true);g.bodies=g.bodies.filter(b=>b===result);result=link(g,result);assert.equal(g.rewardProgress.chain,7);assert.equal(g.inventory.length,1);assert.equal(g.inventory[0].id,first.id);
  for(let i=0;i<4/STEP;i++){result.x=220;result.y=280;result.vy=50;g.step();}assert.equal(g.inventory.length,1);settle(g);assert.equal(g.inventory.length,1);
  g.bodies=[];cascade(g,2);settle(g);assert.equal(g.inventory.length,2);
});

test('quiet time, pending reveal, pause, inspection, and targeting have consistent settlement timing',()=>{
  const g=fresh();cascade(g,2);g.bodies=[];const last=g.events.at(-1);advance(g,.9);assert.equal(g.inventory.length,0);
  advance(g,.6);assert.equal(g.inventory.length,0);assert.ok(g.rewardProgress.settling>0);
  const c=charge(g,'wild');const state=JSON.stringify(g.snapshot());advance(g,5);assert.equal(JSON.stringify(g.snapshot()),state);g.cancelPower();g.inventory=[];
  g.paused=true;const time=g.time;advance(g,5);assert.equal(g.time,time);g.paused=false;
  const remaining=COMBO_CALM_SECONDS*(1-g.rewardProgress.settling);advance(g,remaining+.02);assert.equal(g.inventory.length,1);assert.ok(g.time-last.time>2);assert.equal(g.rewardProgress,null);assert.ok(c.id);
});

test('a valid power banks the natural combo first, scores during assistance, then recovers after calm',()=>{
  const g=fresh();cascade(g,2);const body=g.bodies[0];charge(g,'ripen',3);assert.equal(g.usePowerAt(body.x,body.y),true);
  assert.equal(g.inventory.length,1);assert.equal(g.inventory[0].level,1);assert.equal(g.powerAssisted,true);const points=g.score;
  link(g,body);assert.ok(g.score>points);assert.equal(g.events.at(-1).assisted,true);assert.equal(g.inventory.length,1);settle(g);
  const result=g.bodies[0];link(g,result);assert.equal(g.rewardProgress.chain,1);assert.equal(g.events.at(-1).assisted,undefined);link(g,g.bodies[0]);settle(g);assert.equal(g.inventory.length,2);
});

test('misses, Gather first selection, and preparing a Wild do not bank a natural combo',()=>{
  const g=fresh();cascade(g,2);const a=g.addFruit(0,80,300),b=g.addFruit(0,160,300);charge(g,'gather');assert.equal(g.usePowerAt(20,20),false);assert.equal(g.usePowerAt(a.x,a.y),true);
  assert.equal(g.rewardProgress.chain,2);assert.equal(g.inventory.length,1);assert.equal(g.powerAssisted,false);g.cancelPower();g.inventory=[];
  charge(g,'wild');assert.equal(g.activatePower(),true);assert.equal(g.inventory.length,0);assert.equal(g.powerAssisted,false);assert.equal(g.rewardProgress.chain,2);
  assert.equal(g.drop(),true);assert.equal(g.powerAssisted,true);assert.equal(g.inventory.length,1);assert.equal(g.inventory[0].level,1);assert.ok(b.id);
});

test('a resting Wild becomes assisted again on a later merge and cannot pay a natural reward',()=>{
  const g=fresh();const seed=g.addFruit(0,55,HEIGHT-18);seed.wild={level:2,maxKind:4};seed.age=2;
  pair(g,2,330,280);settle(g);assert.ok(g.bodies.includes(seed));assert.equal(g.powerAssisted,false);
  pair(g,0,220,280);const partner=g.addFruit(3,seed.x,seed.y);partner.age=2;seed.age=2;g.step();
  assert.equal(g.powerAssisted,true);assert.equal(g.events.at(-1).assisted,true);settle(g);assert.equal(g.inventory.length,0);
});

test('game over banks an unpaid eligible combo once instead of discarding it',()=>{
  const g=fresh();cascade(g,2);const spill=g.addFruit(0,WIDTH+100,130);spill.age=2;g.step();assert.equal(g.over,true);assert.equal(g.inventory.length,1);assert.equal(g.inventory[0].level,1);advance(g,3);assert.equal(g.inventory.length,1);
});

test('a weak-gravity airborne fruit keeps a combo open until it has landed',()=>{
  const g=fresh('gravity');g.setGravity(0,.003);advance(g,1.5);pair(g,0,220,170);advance(g,4.5);assert.equal(g.rewardProgress.chain,1);assert.equal(g.rewardProgress.settling,0);assert.equal(g.inventory.length,0);
  g.setGravity(0,1);settle(g);assert.equal(g.inventory.length,0);
});

test('ordinary bowl rest jitter settles in every gravity direction',()=>{
  for(const [x,y] of [[0,1],[1,0],[0,-1],[-1,0],[.6,.8]]){
    const g=fresh('gravity');g.setGravity(x,y);advance(g,1.2);pair(g,0,200,220);pair(g,2,280,220);settle(g,18);
    assert.equal(g.inventory.length,1,`${x},${y}`);assert.equal(g.inventory[0].level,1);assert.equal(g.over,false);
  }
});
