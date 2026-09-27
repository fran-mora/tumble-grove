import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MergeGame,STEP,WIDTH,HEIGHT,CIRCLE,WILD_RADIUS} from '../app/engine.ts';
import {FRUIT_LEVELS} from '../app/fruit-collection.ts';
import {POWER_TYPES,POWER_DETAILS,powerStrength} from '../app/powers.ts';
import {RIM_Y,MOUTH_HALF_ANGLE} from '../app/arena.ts';
import {hullContact} from '../app/collision.ts';
const advance=(g,seconds)=>{for(let n=0;n<Math.ceil(seconds/STEP);n++)g.step();};
function fresh(mode='classic'){const g=new MergeGame(()=>0);g.setMode(mode);g.setPowers(true);return g;}
let chargeSerial=10000;
function charge(g,type,level=1){const c={id:++chargeSerial,type,level};g.inventory.push(c);assert.equal(g.armPower(c.id),true);return c;}
function pair(g,kind=0,x=220,y=280){for(const dx of [-7,7])g.addFruit(kind,x+dx,y).age=2;g.step();return g.bodies.at(-1);}
function link(g,result,other=null){
  const partner=other??g.addFruit(result.kind,220,280);partner.age=2;
  const before=g.merges;
  for(let n=0;n<300&&g.merges===before;n++){
    result.x=partner.x=220;result.y=partner.y=280;result.vx=result.vy=partner.vx=partner.vy=0;g.step();
  }
  assert.equal(g.merges,before+1);return g.bodies.at(-1);
}
function cascade(g,count,startKind=0){let result=pair(g,startKind);for(let n=1;n<count;n++)result=link(g,result);return result;}
function settle(g){for(let i=0;i<1500&&(g.rewardProgress||g.powerAssisted);i++)g.step();assert.equal(g.rewardProgress,null);assert.equal(g.powerAssisted,false);}
function award(g,count,startKind=0){const result=cascade(g,count,startKind);settle(g);return result;}
function contained(g,b){
  assert.ok([b.x,b.y,b.vx,b.vy,b.angle,b.scale??1].every(Number.isFinite));const s=g.getBodyShape(b);
  if(g.mode==='classic'){
    assert.ok(b.y+s.maxY<=HEIGHT+.04,'basket base');
    if(b.y+s.minY>=RIM_Y){assert.ok(b.x+s.minX>=-.04,'left wall');assert.ok(b.x+s.maxX<=WIDTH+.04,'right wall');}
  }else for(const p of s.points){
    const x=b.x+p.x-CIRCLE.x,y=b.y+p.y-CIRCLE.y,r=Math.hypot(x,y);
    if(-(x*g.down.x+y*g.down.y)<r*Math.cos(MOUTH_HALF_ANGLE))assert.ok(r<=CIRCLE.radius+.04,'closed bowl arc');
  }
}

test('all seven collectible abilities have targets and bounded five-tier strength',()=>{
  assert.deepEqual(POWER_TYPES,['gather','ripen','juice','wild','rescue','shake','squeeze']);
  for(const type of POWER_TYPES){assert.ok(POWER_DETAILS[type].name);assert.ok(['area','fruit','pair','none'].includes(POWER_DETAILS[type].target));}
  for(let level=1;level<=5;level++){
    const s=powerStrength(level);assert.ok(s.maxKind>=2&&s.maxKind<=9);assert.ok(s.scale>=.65&&s.scale<=.75);
    if(level>1){assert.ok(s.radius>powerStrength(level-1).radius);assert.ok(s.maxKind>powerStrength(level-1).maxKind);}
  }
  assert.deepEqual(powerStrength(Infinity),powerStrength(1));assert.deepEqual(powerStrength(99),powerStrength(5));
});

test('disabled powers leave ordinary merges, points, and the basket unchanged',()=>{
  const g=new MergeGame(()=>0);cascade(g,3);advance(g,4);
  assert.equal(g.powersEnabled,false);assert.equal(g.merges,3);assert.equal(g.score,10);assert.deepEqual(g.inventory,[]);
  assert.deepEqual(g.powerEffects,[]);assert.equal(g.rewardProgress,null);assert.equal(g.armPower(1),false);
});






test('the last watermelon clear can finish a cascade and award once without a remaining body',()=>{
  const g=fresh();const large=pair(g,9);link(g,large);
  assert.equal(g.bodies.length,0);assert.equal(g.events.at(-1).cleared,true);assert.equal(g.events.at(-1).bodyId,null);
  advance(g,3.1);assert.equal(g.inventory.length,1);assert.equal(g.inventory[0].level,1);const score=g.score;advance(g,4);assert.equal(g.score,score);assert.equal(g.inventory.length,1);
});

test('reward selection prefers variety and sanitizes hostile random results',()=>{
  const g=fresh();for(let i=0;i<3;i++){g.bodies=[];award(g,2);}assert.equal(new Set(g.inventory.map(c=>c.type)).size,3);
  for(const value of [NaN,Infinity,-1,1]){const h=fresh();h.random=()=>value;award(h,2);assert.ok(POWER_TYPES.includes(h.inventory[0].type));}
});

test('a full tray keeps three powers and one highest-tier offer with explicit swap or skip',()=>{
  const g=fresh();g.inventory=POWER_TYPES.slice(0,3).map((type,i)=>({id:100+i,type,level:1}));
  award(g,2);assert.equal(g.inventory.length,3);const first=g.pendingReward;assert.equal(first.level,1);assert.equal(g.canDrop,true);
  g.bodies=[];award(g,4);const higher=g.pendingReward;assert.equal(higher.level,3);assert.notEqual(higher.id,first.id);
  g.bodies=[];award(g,2);assert.equal(g.pendingReward.id,higher.id);
  assert.equal(g.acceptReward(-1),false);assert.equal(g.pendingReward.id,higher.id);
  const replace=g.inventory[1].id;assert.equal(g.acceptReward(replace),true);assert.equal(g.inventory.length,3);assert.equal(g.inventory[1].id,higher.id);assert.equal(g.pendingReward,null);assert.equal(g.acceptReward(replace),false);
  g.bodies=[];award(g,2);assert.ok(g.pendingReward);const saved=JSON.stringify(g.inventory);g.skipReward();assert.equal(g.pendingReward,null);assert.equal(JSON.stringify(g.inventory),saved);
});

test('arming freezes time, effects and physics; cancellation, misses, and paused actions cost nothing',()=>{
  const g=fresh();g.addFruit(0,220,280);const c=charge(g,'juice');
  assert.equal(g.targeting,true);const state=JSON.stringify(g.snapshot());advance(g,5);assert.equal(JSON.stringify(g.snapshot()),state);assert.equal(g.drop(),false);
  assert.equal(g.usePowerAt(20,20),false);assert.equal(g.usePowerAt(NaN,280),false);assert.equal(g.inventory[0].id,c.id);assert.equal(g.armedPowerId,c.id);
  g.paused=true;assert.equal(g.usePowerAt(220,280),false);assert.equal(g.activatePower(),false);g.paused=false;
  g.cancelPower();assert.equal(g.inventory.length,1);assert.equal(g.targeting,false);advance(g,.1);assert.ok(g.time>0);
});



test('Ripen grows one eligible fruit, fits the larger hull, and creates no points or fake merge',()=>{
  const g=fresh();const a=g.addFruit(2,20,HEIGHT-10);a.age=2;g.step();const before=g.score;
  charge(g,'ripen',1);assert.equal(g.usePowerAt(a.x,a.y),true);assert.equal(a.kind,3);assert.equal(g.score,before);assert.equal(g.merges,0);assert.equal(g.events.length,0);assert.equal(g.powerAssisted,true);contained(g,a);
  charge(g,'ripen',1);assert.equal(g.usePowerAt(a.x,a.y),false);assert.equal(g.inventory.length,1);
});

test('Juice removes exactly the selected eligible fruit and prevents a falling-pile reward loop',()=>{
  const g=fresh();const a=g.addFruit(0,120,300),b=g.addFruit(3,320,300);charge(g,'juice',1);
  assert.equal(g.usePowerAt(b.x,b.y),false);assert.equal(g.usePowerAt(a.x,a.y),true);
  assert.deepEqual(g.bodies.map(x=>x.id),[b.id]);assert.equal(g.score,0);assert.equal(g.merges,0);assert.equal(g.powerAssisted,true);assert.equal(g.powerEffects.at(-1).power,'juice');
});

test('Rescue stores one fruit, refuses an occupied reserve, and later replaces the ready fruit without dropping',()=>{
  const g=fresh();const a=g.addFruit(2,120,300),b=g.addFruit(1,320,300);charge(g,'rescue',1);assert.equal(g.usePowerAt(a.x,a.y),true);
  assert.deepEqual(g.rescuedFruit,{kind:2});charge(g,'rescue',1);assert.equal(g.usePowerAt(b.x,b.y),false);g.cancelPower();
  const next=g.next,drops=g.drops;assert.equal(g.releaseRescue(),true);assert.equal(g.current,2);assert.equal(g.next,next);assert.equal(g.drops,drops);assert.equal(g.rescuedFruit,null);assert.equal(g.releaseRescue(),false);
  assert.equal(g.drop(),true);assert.equal(g.powerAssisted,true);
});

test('Wild drops a separate seed, preserves the normal queue, and merges with the first eligible unlike fruit',()=>{
  const g=fresh();g.current=2;g.next=4;charge(g,'wild',2);assert.equal(g.activatePower(),true);assert.equal(g.inventory.length,0);
  assert.equal(g.getDropShape().maxX,WILD_RADIUS);const ready=g.wildReady;charge(g,'wild',1);assert.equal(g.activatePower(),false);assert.equal(g.wildReady,ready);g.cancelPower();
  assert.equal(g.drop(),true);assert.equal(g.current,2);assert.equal(g.next,4);const seed=g.bodies.at(-1);assert.ok(seed.wild);assert.equal(g.powerAssisted,true);
  seed.x=215;seed.y=280;seed.age=2;const target=g.addFruit(3,225,280);target.age=2;g.step();
  assert.equal(g.merges,1);assert.equal(g.bodies[0].kind,4);assert.equal(g.score,10);assert.equal(g.events[0].sources[0].wild.maxKind,4);assert.equal(g.powerAssisted,true);
  link(g,g.bodies[0]);advance(g,3.1);assert.equal(g.inventory.length,1,'only the unused second Wild charge remains');
});

test('Wild refuses fruit above its tier cap and two wild seeds never merge together',()=>{
  const g=fresh();const seed=g.addFruit(0,215,280);seed.wild={level:1,maxKind:2};seed.age=2;
  g.addFruit(3,225,280).age=2;g.step();assert.equal(g.merges,0);
  g.bodies=[];for(const x of [215,225]){const b=g.addFruit(0,x,280);b.wild={level:1,maxKind:2};b.age=2;}g.step();assert.equal(g.merges,0);
});

test('Shake visibly oscillates sideways with capped acceleration in either arena',()=>{
  for(const mode of ['classic','gravity']){
    const g=fresh(mode);const b=g.addFruit(0,220,250);charge(g,'shake',5);assert.equal(g.usePowerAt(220,300),true);
    const positions=[];for(let i=0;i<80;i++){g.step();positions.push(b.vx);contained(g,b);}
    assert.ok(Math.max(...positions)>5);assert.ok(Math.min(...positions)<-5);assert.equal(g.powerAssisted,true);assert.equal(g.merges,0);
  }
});

test('Squeeze shrinks both artwork geometry and collision hull until the next merge, without compounding',()=>{
  const g=fresh();const a=g.addFruit(2,170,300),b=g.addFruit(2,240,300);a.age=b.age=2;
  const original=g.getBodyShape(a);charge(g,'squeeze',5);assert.equal(g.usePowerAt(205,300),true);
  assert.equal(a.scale,.65);assert.equal(g.getBodyShape(a).maxX,original.maxX*.65);assert.equal(g.getBodyShape(a).points[3].y,original.points[3].y*.65);
  assert.equal(hullContact(a,g.getBodyShape(a),b,g.getBodyShape(b)),null);
  charge(g,'squeeze',1);assert.equal(g.usePowerAt(205,300),false);g.cancelPower();
  const result=link(g,a,b);assert.equal(result.scale??1,1);assert.equal(g.events.at(-1).sources[0].scale,.65);assert.equal(g.powerAssisted,true);
});

test('pause and inspection freeze reward/effect timers; reset and mode switches clear inventory and transient state',()=>{
  const g=fresh();cascade(g,2);charge(g,'shake',2);g.usePowerAt(220,300);g.paused=true;const before=JSON.stringify(g.snapshot());advance(g,10);assert.equal(JSON.stringify(g.snapshot()),before);
  g.paused=false;g.setInspecting(true);const inspected=JSON.stringify(g.snapshot());advance(g,10);assert.equal(JSON.stringify(g.snapshot()),inspected);g.setInspecting(false);
  g.wildReady={level:1,maxKind:2};g.rescuedFruit={kind:1};g.pendingReward={id:999,type:'shake',level:4};g.reset();
  assert.equal(g.powersEnabled,true);assert.deepEqual(g.inventory,[]);assert.equal(g.wildReady,null);assert.equal(g.rescuedFruit,null);assert.equal(g.pendingReward,null);assert.equal(g.rewardProgress,null);assert.deepEqual(g.powerEffects,[]);
  charge(g,'juice');g.setMode('gravity');assert.deepEqual(g.inventory,[]);assert.equal(g.targeting,false);g.setPowers(false);assert.equal(g.powersEnabled,false);
});

test('Ripen, Squeeze, and growing powered bodies respect solid walls for every eligible artwork and tilted bowl direction',()=>{
  for(const mode of ['classic','gravity'])for(const theta of mode==='gravity'?[0,Math.PI/2,Math.PI,3*Math.PI/2]:[0])for(const kind of [0,3,6,9])for(const id of FRUIT_LEVELS[kind]){
    const g=fresh(mode);if(mode==='gravity'){g.setGravity(Math.cos(theta),Math.sin(theta));advance(g,1.2);}g.lineup[kind]=id;
    const d=g.down,shape=g.getShape(kind),extent=Math.max(...shape.points.map(p=>p.x*d.x+p.y*d.y));
    const x=mode==='classic'?Math.max(40,-shape.minX+.02):CIRCLE.x+d.x*(CIRCLE.radius-extent-.2),y=mode==='classic'?HEIGHT-shape.maxY-.02:CIRCLE.y+d.y*(CIRCLE.radius-extent-.2);
    const body=g.addFruit(kind,x,y);body.age=2;g.step();charge(g,'ripen',5);assert.equal(g.usePowerAt(body.x,body.y),true);contained(g,body);
    if(body.kind<=9){charge(g,'squeeze',5);assert.equal(g.usePowerAt(body.x,body.y),true);charge(g,'shake',5);assert.equal(g.usePowerAt(body.x,body.y),true);}
    for(let i=0;i<35;i++){g.step();for(const b of g.bodies)contained(g,b);assert.equal(g.over,false);}
    assert.equal(g.score,0);assert.equal(g.merges,0);
  }
});

test('spending a saved power fills the newly free slot with the waiting offer exactly once',()=>{
  const g=fresh();g.inventory=[{id:901,type:'wild',level:1},{id:902,type:'ripen',level:2},{id:903,type:'juice',level:1}];g.pendingReward={id:904,type:'shake',level:4};
  assert.equal(g.armPower(901),true);assert.equal(g.activatePower(),true);
  assert.deepEqual(g.inventory.map(c=>c.id),[902,903,904]);assert.equal(g.pendingReward,null);assert.equal(g.acceptReward(901),false);
});


test('Ripen reaching the final fruit records the same achievement without inventing points',()=>{
  const g=fresh();const b=g.addFruit(9,220,280);charge(g,'ripen',5);assert.equal(g.usePowerAt(b.x,b.y),true);
  assert.equal(b.kind,10);assert.equal(g.highest,10);assert.equal(g.watermelons,1);assert.equal(g.score,0);assert.equal(g.merges,0);
});



test('Gather selects two matching fruit in reach, leaves misses free, and keeps the first selection frozen',()=>{
  const g=fresh();const a=g.addFruit(0,80,280),b=g.addFruit(0,220,280),far=g.addFruit(0,425,280),other=g.addFruit(1,330,280);const c=charge(g,'gather',1);
  assert.deepEqual(g.getGatherPartners(a.id).map(x=>x.id),[b.id]);assert.equal(g.usePowerAt(other.x,other.y),false);assert.equal(g.inventory[0].id,c.id);
  assert.equal(g.usePowerAt(a.x,a.y),true);assert.equal(g.gatherSourceId,a.id);assert.equal(g.targeting,true);assert.equal(g.powerAssisted,false);
  const snapshot=JSON.stringify(g.snapshot());advance(g,5);assert.equal(JSON.stringify(g.snapshot()),snapshot);
  assert.equal(g.usePowerAt(far.x,far.y),false);assert.equal(g.usePowerAt(a.x,a.y),true);assert.equal(g.gatherSourceId,null);
  g.usePowerAt(a.x,a.y);g.clearGatherSelection();assert.equal(g.gatherSourceId,null);g.usePowerAt(a.x,a.y);assert.equal(g.usePowerAt(b.x,b.y),true);
  assert.equal(g.targeting,false);assert.equal(g.inventory.length,0);assert.deepEqual(g.powerEffects[0].bodyIds,[a.id,b.id]);assert.equal(g.powerAssisted,true);
});

test('Gather brings the selected small or large pair together on the floor without directly moving unrelated pairs',()=>{
  for(const kind of [0,6,9,10]){
    const g=fresh();const shape=g.getShape(kind),y=HEIGHT-shape.maxY-.02,half=Math.max(70,shape.maxX-shape.minX)/2+27;
    const a=g.addFruit(kind,220-half,y),b=g.addFruit(kind,220+half,y);a.age=b.age=2;
    charge(g,'gather',1);assert.equal(g.usePowerAt(a.x,a.y),true);assert.equal(g.usePowerAt(b.x,b.y),true);
    for(let i=0;i<650&&!g.merges;i++){g.step();for(const body of g.bodies)contained(g,body);}
    assert.equal(g.merges,1,`kind ${kind} should merge during Gather`);assert.equal(g.events.at(-1).assisted,true);assert.equal(g.inventory.length,0);
  }
  const g=fresh();const a=g.addFruit(0,100,400),b=g.addFruit(0,200,400),c=g.addFruit(0,325,400),d=g.addFruit(0,395,400);for(const body of g.bodies)body.age=2;
  charge(g,'gather',1);g.usePowerAt(a.x,a.y);g.usePowerAt(b.x,b.y);advance(g,.25);assert.ok(a.x>100&&b.x<200);assert.equal(c.x,325);assert.equal(d.x,395);
});

test('Gather never retargets when a selected fruit disappears and a blocked pull ends safely',()=>{
  const g=fresh();const a=g.addFruit(0,120,HEIGHT-22),b=g.addFruit(0,310,HEIGHT-22),other=g.addFruit(0,375,HEIGHT-22);
  charge(g,'gather',2);g.usePowerAt(a.x,a.y);g.usePowerAt(b.x,b.y);g.bodies=g.bodies.filter(body=>body.id!==b.id);g.step();assert.equal(g.powerEffects.length,0);assert.equal(other.vx,0);
  const blocked=fresh();const p=blocked.addFruit(0,70,HEIGHT-22),q=blocked.addFruit(0,350,HEIGHT-22);blocked.addFruit(8,220,HEIGHT-80);
  charge(blocked,'gather',3);blocked.usePowerAt(p.x,p.y);blocked.usePowerAt(q.x,q.y);advance(blocked,7);assert.equal(blocked.powerEffects.length,0);for(const body of blocked.bodies)contained(blocked,body);
});

test('Squeeze affects all normal centers within its circle, including the largest fruit, and never compounds past its tier',()=>{
  const g=fresh();const radius=powerStrength(1).radius;
  const small=g.addFruit(0,220,230),large=g.addFruit(10,220+radius-1,230),outside=g.addFruit(9,220-radius-1,230),wild=g.addFruit(0,220,280);wild.wild={level:1,maxKind:2};
  charge(g,'squeeze',1);assert.equal(g.usePowerAt(220,230),true);assert.equal(small.scale,.75);assert.equal(large.scale,.75);assert.equal(outside.scale,undefined);assert.equal(wild.scale,undefined);
  charge(g,'squeeze',1);assert.equal(g.usePowerAt(220,230),false);g.cancelPower();charge(g,'squeeze',5);assert.equal(g.usePowerAt(220,230),true);assert.equal(large.scale,.65);
  const stored=g.getBodyShape(large);assert.equal(stored.maxX,g.getShape(10).maxX*.65);
});
