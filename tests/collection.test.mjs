import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FRUIT_COLLECTION,chooseFruitLineup} from '../app/fruit-collection.ts';
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
    assert.deepEqual(lineup,Array.from({length:11},(_,i)=>i*10+slot));
    const next=chooseFruitLineup(()=>(slot+.5)/10,lineup);
    assert.ok(next.every((id,level)=>Math.floor(id/10)===level&&id!==lineup[level]));
  }
  for(const value of [NaN,-1,1,Infinity])assert.ok(chooseFruitLineup(()=>value).every((id,level)=>id>=level*10&&id<level*10+10));
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
