import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MergeGame,STEP,MERGE_GATHER_SECONDS,MERGE_HOLD_SECONDS,CASCADE_LINK_SECONDS,mergeHoldSeconds} from '../app/engine.ts';
const advance=(game,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)game.step();};
function firstMerge(mode='classic'){
  const game=new MergeGame(()=>0);game.setMode(mode);
  const a=game.addFruit(0,205,300),b=game.addFruit(0,224,300);a.age=b.age=2;game.step();
  return game;
}

test('a newly grown fruit has a visible reveal before it can take part in another merge, in both arenas',()=>{
  for(const mode of ['classic','gravity']){
    const game=firstMerge(mode),first=game.events[0],result=game.bodies[0];
    assert.equal(first.chain,1);assert.equal(first.sources.length,2);
    assert.deepEqual(first.sources.map(s=>s.kind),[0,0]);
    const partner=game.addFruit(1,result.x,result.y);partner.age=2;
    // Keep contact deterministic without relying on a particular random sprite's bounce.
    while(game.time-first.time<MERGE_HOLD_SECONDS-STEP){
      result.x=partner.x=220;result.y=partner.y=280;result.vx=result.vy=partner.vx=partner.vy=0;
      game.step();assert.equal(game.merges,1);
    }
    for(let i=0;i<3&&game.merges===1;i++){
      result.x=partner.x=220;result.y=partner.y=280;result.vx=result.vy=partner.vx=partner.vy=0;game.step();
    }
    assert.equal(game.merges,2);assert.equal(game.score,4);assert.equal(game.events[1].chain,2);
    assert.ok(game.events[1].time-first.time>=MERGE_HOLD_SECONDS);
    assert.ok(mergeHoldSeconds(2)>MERGE_HOLD_SECONDS);
    assert.ok(MERGE_HOLD_SECONDS-MERGE_GATHER_SECONDS>.7);
  }
});

test('actual cascade contact is paced and still resolves without manually forcing the next merge',()=>{
  const game=new MergeGame(()=>0);
  for(const [kind,x,y] of [[0,206,500],[0,224,500],[1,215,541]])game.addFruit(kind,x,y).age=2;
  advance(game,.8);assert.equal(game.merges,1);
  advance(game,1.2);assert.equal(game.merges,2);assert.equal(game.score,4);
  assert.deepEqual(game.events.map(e=>e.chain),[1,2]);
  assert.ok(game.events[1].time-game.events[0].time>=mergeHoldSeconds(1));
});

test('unrelated simultaneous pairs each begin their own cascade and do not inflate points',()=>{
  const game=new MergeGame(()=>0);
  for(const x of [85,104,320,339])game.addFruit(0,x,400).age=2;
  game.step();assert.equal(game.merges,2);assert.equal(game.score,2);
  assert.deepEqual(game.events.map(e=>e.chain),[1,1]);
  assert.deepEqual(game.events.map(e=>e.id),[1,2]);
  assert.equal(new Set(game.events.map(e=>e.bodyId)).size,2);
});

test('old results do not start a misleading cascade after a later unrelated drop',()=>{
  const game=firstMerge();advance(game,CASCADE_LINK_SECONDS+.2);
  const result=game.bodies[0];game.addFruit(1,result.x,result.y).age=2;game.step();
  assert.equal(game.merges,2);assert.equal(game.events.at(-1).chain,1);
});

test('reveal protection still permits collisions, movement and normal drops',()=>{
  const game=firstMerge(),result=game.bodies[0],startY=result.y;
  const other=game.addFruit(1,result.x,result.y);other.age=2;
  advance(game,.25);
  assert.equal(game.merges,1);assert.ok(result.y>startY);
  assert.ok(Math.hypot(result.x-other.x,result.y-other.y)>10);
  assert.equal(game.drop(100),true);advance(game,.49);assert.equal(game.canDrop,true);
});

test('pause and inspection freeze animation time; restart removes all in-progress celebration state',()=>{
  const game=firstMerge();advance(game,.3);game.setInspecting(true);
  const before=JSON.stringify({bodies:game.bodies,events:game.events,time:game.time});
  advance(game,5);assert.equal(JSON.stringify({bodies:game.bodies,events:game.events,time:game.time}),before);
  game.setInspecting(false);game.paused=true;advance(game,1);
  assert.equal(JSON.stringify({bodies:game.bodies,events:game.events,time:game.time}),before);
  game.reset();assert.equal(game.events.length,0);assert.equal(game.bodies.length,0);assert.equal(game.time,0);
  for(const x of [205,224])game.addFruit(0,x,300).age=2;
  game.step();assert.equal(game.events[0].chain,1);assert.equal(game.events[0].id,1);
});

test('final pairs clear once and preserve the cascade without creating an out-of-range fruit',()=>{
  const game=new MergeGame(()=>0);
  const a=game.addFruit(10,205,300),b=game.addFruit(10,225,300);
  a.age=b.age=2;a.birth={time:-1.5,chain:4};game.step();
  assert.equal(game.merges,1);assert.equal(game.score,100);assert.equal(game.bodies.length,0);
  assert.equal(game.events[0].cleared,true);assert.equal(game.events[0].bodyId,null);assert.equal(game.events[0].chain,5);
  advance(game,2);assert.equal(game.score,100);assert.equal(game.merges,1);
});

test('four-step cascades progress one reveal at a time in a basket and bowl',()=>{
  for(const mode of ['classic','gravity']){
    const game=new MergeGame(()=>0);game.setMode(mode);const x=mode==='gravity'?220:400;
    for(const [kind,dx,y] of [[0,-8,250],[0,8,250],[1,0,290],[2,0,345],[3,0,400]])game.addFruit(kind,x+dx,y).age=2;
    const completed=[];let previous=0;
    for(let step=0;step<5/STEP;step++){
      game.step();if(game.merges>previous){completed.push(game.events.at(-1));previous=game.merges;}
    }
    assert.equal(game.over,false);assert.equal(game.merges,4);assert.equal(game.score,20);
    assert.deepEqual(completed.map(e=>e.chain),[1,2,3,4]);
    for(let i=1;i<completed.length;i++)assert.ok(completed[i].time-completed[i-1].time>=mergeHoldSeconds(i));
    assert.ok(completed[3].time>3.4&&completed[3].time<4);
  }
});
