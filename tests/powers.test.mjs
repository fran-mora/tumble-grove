import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MergeGame,STEP,MERGE_GATHER_SECONDS,WIDTH,HEIGHT,CIRCLE} from '../app/engine.ts';
import {FRUIT_COLLECTION,FRUIT_LEVELS} from '../app/fruit-collection.ts';
import {fruitPower,powerStrength,POWER_DETAILS} from '../app/powers.ts';
import {RIM_Y,MOUTH_HALF_ANGLE} from '../app/arena.ts';
const advance=(game,seconds)=>{for(let n=0;n<Math.ceil(seconds/STEP);n++)game.step();};
const identities={gather:0,zest:32,choose:21};
function gameWithPower(power,kind=0,mode='classic'){
  const game=new MergeGame(()=>.99,()=>0);game.setMode(mode);game.setPowers(true);
  game.lineup[kind]=identities[power];
  for(const x of [210,225])game.addFruit(kind,x,280).age=2;
  game.step();assert.equal(game.merges,1);return game;
}
function activeEffect(game,power,kind=1,x=220,y=300){
  const {radius,duration}=powerStrength(kind);
  game.powerEffects.push({id:101,power,kind,x,y,time:game.time,duration,radius});
}
function assertContained(game,body){
  assert.ok([body.x,body.y,body.vx,body.vy,body.angle].every(Number.isFinite));
  const shape=game.getShape(body.kind,body.angle);
  if(game.mode==='classic'){
    assert.ok(body.y+shape.maxY<=HEIGHT+.02,'solid basket base');
    if(body.y+shape.minY>=RIM_Y){assert.ok(body.x+shape.minX>=-.02,'left side');assert.ok(body.x+shape.maxX<=WIDTH+.02,'right side');}
  }else{
    for(const p of shape.points){
      const x=body.x+p.x-CIRCLE.x,y=body.y+p.y-CIRCLE.y,distance=Math.hypot(x,y);
      if(-(x*game.down.x+y*game.down.y)<distance*Math.cos(MOUTH_HALF_ANGLE))assert.ok(distance<=CIRCLE.radius+.04,'solid bowl arc');
    }
  }
}

test('all 110 artwork identities have a stable, described ability independent of their growth bucket',()=>{
  assert.equal(FRUIT_COLLECTION.length,110);
  const counts={gather:0,zest:0,choose:0};
  for(const fruit of FRUIT_COLLECTION){const power=fruitPower(fruit.id);counts[power]++;assert.ok(POWER_DETAILS[power].name);assert.equal(fruitPower(fruit.id),power);}
  for(const count of Object.values(counts))assert.ok(count>=25&&count<=55);
  assert.equal(fruitPower(0),'gather');assert.equal(fruitPower(32),'zest');assert.equal(fruitPower(73),'choose');
  for(const id of [-1,110,NaN,.5])assert.throws(()=>fruitPower(id));
});

test('powers are opt-in and disabled merges have no effect, no choice, and unchanged points',()=>{
  const game=new MergeGame(()=>0);game.lineup[0]=21;
  game.addFruit(0,205,300).age=2;game.addFruit(0,220,300).age=2;
  advance(game,.7);assert.equal(game.powersEnabled,false);assert.equal(game.score,1);assert.equal(game.merges,1);
  assert.equal(game.events[0].power,undefined);assert.deepEqual(game.powerEffects,[]);assert.deepEqual(game.choiceOptions,[]);
});

test('a merge activates its parents’ power exactly once, after the visual reveal',()=>{
  const game=gameWithPower('gather');game.lineup[1]=21;
  assert.equal(game.events[0].power,'gather');assert.equal(game.powerEffects.length,0);
  advance(game,MERGE_GATHER_SECONDS-STEP);assert.equal(game.powerEffects.length,0);
  advance(game,STEP*2);assert.equal(game.powerEffects.length,1);assert.equal(game.powerEffects[0].power,'gather');
  const first=game.powerEffects[0];assert.ok(first.time-game.events[0].time>=MERGE_GATHER_SECONDS);
  advance(game,.5);assert.equal(game.powerEffects.length,1);assert.equal(game.powerEffects[0].id,first.id);
  advance(game,4);assert.equal(game.powerEffects.length,0);assert.equal(game.merges,1);assert.equal(game.score,1);
});

test('larger merges extend power reach and duration; the final pair also activates exactly once',()=>{
  let previous=powerStrength(1);
  for(let kind=2;kind<=11;kind++){const next=powerStrength(kind);assert.ok(next.radius>previous.radius);assert.ok(next.duration>previous.duration);assert.ok(next.acceleration>previous.acceleration);previous=next;}
  const game=gameWithPower('zest',10);assert.equal(game.bodies.length,0);advance(game,.3);
  assert.equal(game.powerEffects.length,1);assert.equal(game.powerEffects[0].kind,11);
  assert.equal(game.score,100);advance(game,4);assert.equal(game.powerEffects.length,0);assert.equal(game.score,100);
});

test('Gather gently moves matching pairs towards each other while leaving unrelated fruit alone',()=>{
  const game=new MergeGame(()=>0);game.setPowers(true);
  for(const [kind,x] of [[0,170],[0,270],[2,100]])game.addFruit(kind,x,250).age=2;
  activeEffect(game,'gather',5,220,310);const [a,b,other]=game.bodies;
  advance(game,.35);assert.ok(a.x>170.3);assert.ok(b.x<269.7);assert.equal(other.x,100);
  assert.ok(Math.abs(a.vx)<35&&Math.abs(b.vx)<35);assert.equal(game.score,0);
});

test('overlapping Gather pulses cap added acceleration and remain finite',()=>{
  const game=new MergeGame(()=>0);game.setPowers(true);
  const a=game.addFruit(0,160,280),b=game.addFruit(0,280,280);a.age=b.age=2;
  for(let i=0;i<20;i++)activeEffect(game,'gather',11,220,280);
  game.time=1;game.step();assert.ok(Math.abs(a.vx)<=145*STEP);assert.ok(Math.abs(b.vx)<=145*STEP);
  for(const body of game.bodies)assertContained(game,body);
});

test('Zest reduces damping locally and ends cleanly, without injecting an impulse',()=>{
  const control=new MergeGame(()=>0),game=new MergeGame(()=>0);game.setPowers(true);game.lineup=[...control.lineup];
  for(const g of [control,game]){const body=g.addFruit(0,220,180);body.vx=80;body.age=2;}
  activeEffect(game,'zest',8,220,260);
  advance(control,.35);advance(game,.35);
  assert.ok(game.bodies[0].vx>control.bodies[0].vx+10);assert.ok(game.bodies[0].vx<80);
  assert.ok(game.bodies[0].x>control.bodies[0].x+2);assert.equal(game.score,0);
  advance(game,4);assert.equal(game.powerEffects.length,0);
});

test('Zest lets contacting fruit slide past each other by reducing tangential friction',()=>{
  const simulate=zest=>{
    const game=new MergeGame(()=>0),lineup=[...game.lineup];game.setPowers(true);game.lineup=lineup;
    const a=game.addFruit(0,200,260),b=game.addFruit(4,225,300);a.vx=160;a.vy=160;a.age=b.age=2;
    if(zest)activeEffect(game,'zest',5,220,290);
    game.step();return a;
  };
  const normal=simulate(false),sliding=simulate(true);
  assert.ok(sliding.vx>normal.vx+20,'contact tangential motion is preserved');
  assert.ok(Math.abs(sliding.vy-normal.vy)<.01,'the normal collision remains solid');
});

test('Choose offers valid replacements, freezes physics, blocks drops, and preserves next and score',()=>{
  const game=gameWithPower('choose');game.current=2;game.next=4;advance(game,.3);
  assert.equal(game.choiceOptions.length,2);assert.equal(game.choiceOptions[0],2);assert.equal(new Set(game.choiceOptions).size,2);
  assert.ok(game.choiceOptions.every(kind=>kind>=0&&kind<=4));
  const state=JSON.stringify(game.snapshot()),time=game.time;advance(game,5);
  assert.equal(JSON.stringify(game.snapshot()),state);assert.equal(game.time,time);assert.equal(game.canDrop,false);assert.equal(game.drop(),false);
  assert.equal(game.chooseFruit(-1),false);assert.equal(game.chooseFruit(10),false);assert.equal(JSON.stringify(game.snapshot()),state);
  const selected=game.choiceOptions[1];game.setAim(10000);assert.equal(game.chooseFruit(selected),true);
  assert.equal(game.current,selected);assert.equal(game.next,4);assert.equal(game.score,1);assert.equal(game.merges,1);assert.deepEqual(game.choiceOptions,[]);
  assert.ok(game.getSpawn().x+game.getShape(selected).maxX<=WIDTH);advance(game,.6);assert.equal(game.canDrop,true);
});

test('large Choose offers more options including an occasional larger drop; visible options count as encounters',()=>{
  for(const [kind,count,max] of [[0,2,4],[4,3,4],[8,4,5]]){
    const game=gameWithPower('choose',kind);advance(game,.3);
    assert.equal(game.choiceOptions.length,count);assert.ok(Math.max(...game.choiceOptions)<=max);
    if(max===5)assert.ok(game.choiceOptions.includes(5));
    const history=game.getFruitHistory();for(const option of game.choiceOptions)assert.ok(history.seen[game.lineup[option]]>0);
  }
});

test('simultaneous Choose merges coalesce while other due powers activate and later pending powers resume',()=>{
  const game=new MergeGame(()=>0);game.setPowers(true);game.lineup[0]=21;game.lineup[2]=32;
  for(const [kind,x,y] of [[0,65,230],[0,80,230],[0,210,230],[0,225,230],[2,355,350],[2,370,350]])game.addFruit(kind,x,y).age=2;
  game.step();assert.equal(game.merges,3);advance(game,.3);
  assert.equal(game.choiceOptions.length,2);assert.equal(game.powerEffects.filter(e=>e.power==='choose').length,2);assert.equal(game.powerEffects.filter(e=>e.power==='zest').length,1);
  assert.equal(game.chooseFruit(game.current),true);game.step();assert.equal(game.choiceOptions.length,0);
  advance(game,3);assert.equal(game.choiceOptions.length,0);assert.equal(game.powerEffects.length,0);
});

test('a power scheduled just after Choose waits safely until the selection is resolved',()=>{
  const game=new MergeGame(()=>0);game.setPowers(true);game.lineup[0]=21;game.lineup[2]=0;
  for(const x of [65,80])game.addFruit(0,x,280).age=2;
  game.step();
  for(const x of [315,330])game.addFruit(2,x,320).age=2;
  game.step();
  for(let n=0;n<60&&!game.choiceOptions.length;n++)game.step();
  assert.equal(game.choiceOptions.length,2);assert.equal(game.powerEffects.filter(e=>e.power==='gather').length,0);
  game.chooseFruit(game.current);advance(game,STEP*2);
  assert.equal(game.powerEffects.filter(e=>e.power==='gather').length,1);assert.equal(game.choiceOptions.length,0);
});

test('pause and inspection preserve powers and choices; reset, arena changes, and toggling clear transient state',()=>{
  const game=gameWithPower('choose');game.paused=true;const pendingTime=game.time;advance(game,1);assert.equal(game.time,pendingTime);
  game.paused=false;advance(game,.3);assert.equal(game.choiceOptions.length,2);
  game.paused=true;const before=JSON.stringify(game.snapshot());advance(game,1);assert.equal(JSON.stringify(game.snapshot()),before);assert.equal(game.chooseFruit(game.current),false);
  game.paused=false;assert.equal(game.setInspecting(true),true);const inspecting=JSON.stringify(game.snapshot());advance(game,1);assert.equal(JSON.stringify(game.snapshot()),inspecting);
  game.setInspecting(false);assert.equal(game.chooseFruit(game.current),true);
  game.reset();assert.equal(game.powersEnabled,true);assert.deepEqual(game.powerEffects,[]);assert.deepEqual(game.choiceOptions,[]);advance(game,.4);assert.deepEqual(game.powerEffects,[]);
  for(const action of [()=>game.setMode('gravity'),()=>game.setPowers(false)]){
    activeEffect(game,'gather');game.choiceOptions=[0,1];action();assert.equal(game.bodies.length,0);assert.deepEqual(game.powerEffects,[]);assert.deepEqual(game.choiceOptions,[]);
  }
  game.addFruit(0,220,300);game.setPowers(false);assert.equal(game.bodies.length,1,'setting same mode does not reset');
});

test('active Gather and Zest keep growing fruit behind solid basket and bowl boundaries',()=>{
  for(const mode of ['classic','gravity'])for(const kind of [0,3,6,9])for(const id of FRUIT_LEVELS[kind]){
    const game=new MergeGame(()=>0);game.setMode(mode);game.setPowers(true);game.lineup[kind]=id;
    const x=mode==='classic'?75:220,y=mode==='classic'?HEIGHT-80:350;
    for(const dx of [-3,3])game.addFruit(kind,x+dx,y).age=2;
    activeEffect(game,'gather',11,x,y);activeEffect(game,'zest',11,x,y);
    for(let step=0;step<48;step++){
      if(game.choiceOptions.length)game.chooseFruit(game.current);
      game.step();for(const body of game.bodies)assertContained(game,body);assert.equal(game.over,false);
    }
    assert.equal(game.merges,1);assert.equal(game.score,(kind+1)*(kind+2)/2);
  }
});
