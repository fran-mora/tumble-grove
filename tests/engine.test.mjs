import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MergeGame, FRUITS, WIDTH, HEIGHT, STEP } from '../app/engine.ts';
import { hullContact } from '../app/collision.ts';
const shapeOf=(game,b)=>game.getShape(b.kind,b.angle);
const assertInside=(game,b)=>{const shape=shapeOf(game,b);assert.ok(b.x+shape.minX>=-.05);assert.ok(b.x+shape.maxX<=WIDTH+.05);assert.ok(b.y+shape.maxY<=HEIGHT+.05);};
const advance=(game,seconds)=>{for(let n=0;n<Math.ceil(seconds/STEP);n++)game.step();};
const settled=(game,kind,x,y)=>{const b=game.addFruit(kind,x,y);b.age=2;return b;};
test('first drops merge into the next growth level, score once, and settle inside the basket',()=>{
  const game=new MergeGame(()=>.4,()=>0);
  assert.equal(game.drop(220),true);
  assert.equal(game.drop(220),false);
  advance(game,1.3);
  assert.equal(game.drop(220),true);
  advance(game,2.5);
  assert.equal(game.merges,1);assert.equal(game.score,1);assert.equal(game.bodies.length,1);assert.equal(game.bodies[0].kind,1);
  assert.ok(Math.abs(game.bodies[0].y+shapeOf(game,game.bodies[0]).maxY-(HEIGHT-.005))<.05);
  assert.equal(game.over,false);
});
test('every fruit tier merges once and two final-level fruits clear with a bonus',()=>{
  for(let kind=0;kind<FRUITS.length;kind++){
    const game=new MergeGame(()=>0);const radius=FRUITS[kind].radius;
    settled(game,kind,220-radius*.7,400);settled(game,kind,220+radius*.7,400);
    game.step();
    assert.equal(game.merges,1,FRUITS[kind].name);
    assert.equal(game.bodies.length,kind===10?0:1);
    assert.equal(game.score,kind===10?100:(kind+1)*(kind+2)/2);
    if(kind<10)assert.equal(game.bodies[0].kind,kind+1);
    if(kind===9)assert.equal(game.watermelons,1);
  }
});
test('three touching fruit cannot consume a fruit twice in one step',()=>{
  const game=new MergeGame(()=>0);[195,220,245].forEach(x=>settled(game,0,x,400));game.step();
  assert.equal(game.merges,1);assert.equal(game.score,1);assert.deepEqual(game.bodies.map(b=>b.kind).sort(),[0,1]);
});
test('a merge can cause a further merge, preserving the correct score',()=>{
  const game=new MergeGame(()=>0);
  settled(game,0,206,500);settled(game,0,224,500);settled(game,1,215,541);
  advance(game,2);
  assert.equal(game.merges,2);assert.equal(game.score,4);assert.equal(game.bodies.length,1);assert.equal(game.bodies[0].kind,2);
});
test('unlike fruit separate and remain inside the basket',()=>{
  const game=new MergeGame(()=>0);settled(game,4,200,500);settled(game,6,245,500);advance(game,6);
  assert.equal(game.merges,0);
  const [a,b]=game.bodies;
  const contact=hullContact(a,shapeOf(game,a),b,shapeOf(game,b));assert.ok(!contact||contact.depth<.15);
  for(const body of game.bodies){assertInside(game,body);assert.ok(Number.isFinite(body.vx));}
});
test('a fruit can remain above the old dotted line indefinitely',()=>{
  const game=new MergeGame(()=>0),fruit=settled(game,6,220,70);
  for(let n=0;n<720;n++){fruit.y=70;fruit.vy=0;game.step();}
  assert.equal(game.over,false);assert.equal(game.danger,0);assert.equal(game.canDrop,true);
});
test('the basket has an open rim and ends only after a whole fruit spills outside',()=>{
  const game=new MergeGame(()=>0),fruit=settled(game,3,20,0);
  fruit.vx=-220;advance(game,.18);assert.ok(fruit.x<0);assert.equal(game.over,false);
  advance(game,1);assert.equal(game.over,true);assert.equal(game.drop(),false);
});
test('pause freezes physics and cooldown, and reset clears the whole round',()=>{
  const game=new MergeGame(()=>0);game.drop(120);advance(game,.2);game.paused=true;
  const before=JSON.stringify(game.snapshot()),time=game.time;advance(game,5);
  assert.equal(JSON.stringify(game.snapshot()),before);assert.equal(game.time,time);assert.equal(game.drop(),false);
  game.reset();assert.equal(game.bodies.length,0);assert.equal(game.score,0);assert.equal(game.drops,0);assert.equal(game.over,false);assert.equal(game.paused,false);assert.equal(game.canDrop,true);assert.equal(game.danger,0);
});
test('aim is clamped and invalid inputs never corrupt state',()=>{
  const game=new MergeGame(()=>0),shape=game.getShape(0);game.setAim(-100);assert.equal(game.aim+shape.minX,1);game.setAim(10000);assert.equal(game.aim+shape.maxX,WIDTH-1);
  const previous=game.aim;game.setAim(NaN);assert.equal(game.aim,previous);assert.equal(game.drop(Infinity),false);assert.equal(game.bodies.length,0);
  assert.throws(()=>game.addFruit(-1,100,100));assert.throws(()=>game.addFruit(1,NaN,100));
});
test('extended deterministic games stay finite without a line-based time limit',()=>{
  let seed=71;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let round=0;round<3;round++){
    const game=new MergeGame(random,()=>0);
    for(let turn=0;turn<120&&!game.over;turn++){
      game.drop(25+random()*390);advance(game,.8);
      for(const body of game.bodies){assert.ok(Number.isFinite(body.x)&&Number.isFinite(body.y));if(!game.over&&body.y+shapeOf(game,body).minY>55)assert.ok(body.y<HEIGHT+250);}
    }
    assert.ok(game.merges>0);if(game.over)assert.equal(game.drop(),false);
  }
});
