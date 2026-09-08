import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FRUIT_COLLECTION,FRUIT_LEVELS,FRUIT_BODY_AREA,chooseFruitLineup} from '../app/fruit-collection.ts';
import {MergeGame,FRUITS,STEP,CIRCLE} from '../app/engine.ts';
import {fruitHull,hullContact,landingY} from '../app/collision.ts';
import {drawFruit} from '../app/render.ts';
import {outsideBowl} from '../app/arena.ts';

test('110 distinct named characters provide exactly 10 alternatives per growth level',()=>{
  assert.equal(FRUIT_COLLECTION.length,110);assert.equal(new Set(FRUIT_COLLECTION.map(f=>f.name)).size,110);
  for(let level=0;level<11;level++){
    const choices=FRUIT_COLLECTION.filter(f=>f.level===level);assert.equal(choices.length,10);
    for(const fruit of choices){assert.equal(fruit.id,FRUIT_COLLECTION.indexOf(fruit));assert.ok(fruit.geometry.radius>0);assert.ok(fruit.geometry.hull.length>=12);}
  }
});
test('every alternative can be picked and each new round changes the previous family',()=>{
  for(let slot=0;slot<10;slot++){
    const lineup=chooseFruitLineup(()=>(slot+.5)/10);
    assert.deepEqual(lineup,FRUIT_LEVELS.map(ids=>ids[slot]));
    const next=chooseFruitLineup(()=>(slot+.5)/10,lineup);
    assert.ok(next.every((id,level)=>FRUIT_COLLECTION[id].level===level&&id!==lineup[level]));
  }
  for(const value of [NaN,-1,1,Infinity])assert.ok(chooseFruitLineup(()=>value).every((id,level)=>FRUIT_LEVELS[level].includes(id)));
  assert.deepEqual(chooseFruitLineup(()=>0,FRUIT_LEVELS.map((_,i)=>FRUIT_LEVELS[(i+1)%11][0])),chooseFruitLineup(()=>0));
});
test('all fruit have cited size evidence and the levels are ordered equal-count buckets',()=>{
  const research=JSON.parse(readFileSync(new URL('../docs/fruit-size-research.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(research.rows).length,110);
  const bases=new Set(['study-mean','cultivar-typical','range-midpoint','published-estimate','market-grade','proxy']);
  for(const fruit of FRUIT_COLLECTION){
    const row=research.rows[fruit.name];assert.ok(row,fruit.name);
    assert.ok(Number.isFinite(row.massG)&&row.massG>0,fruit.name);
    assert.equal(fruit.typicalMassG,Number(row.massG.toPrecision(3)),fruit.name);
    assert.equal(new URL(row.source).protocol,'https:');assert.ok(bases.has(row.basis));assert.ok(row.note.length>20);
  }
  assert.equal(FRUIT_LEVELS.length,11);assert.equal(new Set(FRUIT_LEVELS.flat()).size,110);
  let previous;
  for(const ids of FRUIT_LEVELS){
    assert.equal(ids.length,10);
    for(const id of ids){
      const fruit=FRUIT_COLLECTION[id];
      if(previous){assert.ok(fruit.typicalMassG>=previous.typicalMassG);if(fruit.typicalMassG===previous.typicalMassG)assert.ok(fruit.id>previous.id);}
      previous=fruit;
    }
  }
  assert.equal(FRUIT_COLLECTION.find(f=>f.name==='Bilberry').level,0);
  assert.equal(FRUIT_COLLECTION.find(f=>f.name==='Jackfruit').level,10);
});
test('every possible next-level fruit has a larger body area',()=>{
  const area=shape=>Math.abs(shape.points.reduce((sum,p,i)=>{const q=shape.points[(i+1)%shape.points.length];return sum+p.x*q.y-p.y*q.x;},0))/2;
  const levels=FRUIT_LEVELS.map(ids=>ids.map(id=>{
    const fruit=FRUIT_COLLECTION[id],r=FRUITS[fruit.level].radius;
    const a=area(fruitHull(fruit.level,r,.71,fruit.geometry));
    assert.ok(Math.abs(a-FRUIT_BODY_AREA*r*r)<1e-7,fruit.name);
    return a;
  }));
  for(let i=1;i<levels.length;i++)assert.ok(Math.min(...levels[i])>Math.max(...levels[i-1])*1.26,`level ${i+1}`);
});
test('a family remains fixed through drops and merges, and resets on a new game',()=>{
  let seed=981;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const g=new MergeGame(random),first=[...g.lineup];g.drop();for(let n=0;n<150;n++)g.step();g.drop();for(let n=0;n<250;n++)g.step();
  assert.deepEqual(g.lineup,first);assert.equal(g.merges,1);
  assert.deepEqual(g.snapshot().lineup.map(f=>f.name),first.map(id=>FRUIT_COLLECTION[id].name));
  g.reset();assert.ok(g.lineup.every((id,i)=>id!==first[i]));assert.equal(g.bodies.length,0);
});
test('all 110 render bounds match their own collision geometry without padding',()=>{
  const sprites=FRUIT_COLLECTION.map(f=>({width:f.geometry.crop[2],height:f.geometry.crop[3]}));
  for(const fruit of FRUIT_COLLECTION){
    const r=FRUITS[fruit.level].radius;let call;
    const ctx={save(){},restore(){},translate(){},rotate(){},drawImage(...args){call=args;}};
    drawFruit(ctx,sprites,fruit.level,0,0,r,0,1,fruit);
    assert.equal(call[0],sprites[fruit.id]);
    for(const [x,y] of fruit.geometry.hull){
      const sourceX=fruit.geometry.center[0]+x*fruit.geometry.radius,sourceY=fruit.geometry.center[1]+y*fruit.geometry.radius;
      assert.ok(sourceX>=-1&&sourceX<=fruit.geometry.crop[2]+1);assert.ok(sourceY>=-1&&sourceY<=fruit.geometry.crop[3]+1);
      assert.ok(Math.abs(call[1]+sourceX*call[3]/sprites[fruit.id].width-x*r)<1e-8);
      assert.ok(Math.abs(call[2]+sourceY*call[4]/sprites[fruit.id].height-y*r)<1e-8);
    }
  }
});
test('every character settles flush on the floor and merges by growth level',()=>{
  for(const fruit of FRUIT_COLLECTION){
    const g=new MergeGame(()=>0);g.lineup[fruit.level]=fruit.id;
    const a=g.addFruit(fruit.level,220,450),shape=g.getShape(fruit.level);
    a.y=570-shape.maxY-1;
    for(let n=0;n<80;n++)g.step();
    assert.ok(Math.abs(a.y+g.getShape(fruit.level,a.angle).maxY-570)<.03,fruit.name);
    const b=g.addFruit(fruit.level,a.x,a.y);b.age=1;g.step();
    assert.equal(g.merges,1,fruit.name);assert.equal(g.over,false,fruit.name);
  }
});
test('all fruit silhouettes meet exactly along the drop guide at varied rotations',()=>{
  for(const fruit of FRUIT_COLLECTION){
    const shape=fruitHull(fruit.level,FRUITS[fruit.level].radius,.6,fruit.geometry),other=fruitHull(5,49,-.8,FRUIT_COLLECTION[57].geometry);
    const y=landingY(220,0,shape,[{x:220,y:350,shape:other}],570);
    assert.equal(hullContact({x:220,y:y-.02},shape,{x:220,y:350},other),null);
    assert.ok(hullContact({x:220,y:y+.02},shape,{x:220,y:350},other));
    assert.equal(outsideBowl({x:CIRCLE.x,y:CIRCLE.y},shape,CIRCLE,CIRCLE.radius),false);
  }
});
test('all 50 droppable alternatives spawn inside the circular bowl at every aim edge',()=>{
  const game=new MergeGame(()=>0);game.setMode('gravity');
  for(const fruit of FRUIT_COLLECTION.filter(f=>f.level<5)){
    game.lineup[fruit.level]=fruit.id;game.current=fruit.level;
    for(const [x,y] of [[0,1],[1,0],[0,-1],[-1,0]]){
      game.setGravity(x,y);for(let n=0;n<180;n++)game.step();
      for(const aim of [-100,220,1000]){
        game.setAim(aim);const spawn=game.getSpawn(),shape=game.getShape(fruit.level);
        for(const p of shape.points)assert.ok(Math.hypot(spawn.x+p.x-CIRCLE.x,spawn.y+p.y-CIRCLE.y)<CIRCLE.radius,fruit.name);
      }
    }
  }
});
