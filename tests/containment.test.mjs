import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MergeGame,WIDTH,HEIGHT,CIRCLE,STEP} from '../app/engine.ts';
import {FRUIT_LEVELS} from '../app/fruit-collection.ts';
import {RIM_Y} from '../app/arena.ts';
const advance=(g,seconds)=>{for(let n=0;n<seconds/STEP;n++)g.step();};
function inBasket(g,b){const s=g.getShape(b.kind,b.angle);assert.ok(b.y+s.maxY<=HEIGHT+.01,`through base: ${g.getFruit(b.kind).name}`);if(b.y+s.minY>=RIM_Y){assert.ok(b.x+s.minX>=-.01,'through left wall');assert.ok(b.x+s.maxX<=WIDTH+.01,'through right wall');}}
function inCircle(g,b){for(const p of g.getShape(b.kind,b.angle).points)assert.ok(Math.hypot(b.x+p.x-CIRCLE.x,b.y+p.y-CIRCLE.y)<=CIRCLE.radius+.02,`through bowl: ${g.getFruit(b.kind).name}`);}

test('all merging fruit fit above the floor and inside either corner on their first frame',()=>{
  for(let kind=0;kind<10;kind++)for(const id of FRUIT_LEVELS[kind])for(const corner of ['left','right']){
    const g=new MergeGame(()=>0);g.lineup[kind]=id;const shape=g.getShape(kind);
    const x=corner==='left'?-shape.minX+.02:WIDTH-shape.maxX-.02,y=HEIGHT-shape.maxY-.02;
    for(const dx of [-.01,.01])g.addFruit(kind,x+dx,y).age=2;
    g.step();assert.equal(g.merges,1);assert.equal(g.over,false);inBasket(g,g.bodies[0]);
    advance(g,.1);inBasket(g,g.bodies[0]);assert.equal(g.over,false);
  }
});

test('merges against the closed bowl arc stay inside at every gravity direction',()=>{
  for(let kind=0;kind<10;kind++)for(const id of FRUIT_LEVELS[kind])for(const theta of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
    const g=new MergeGame(()=>0);g.setMode('gravity');g.setGravity(Math.cos(theta),Math.sin(theta));advance(g,1.2);g.lineup[kind]=id;
    const d=g.down,s=g.getShape(kind),extent=Math.max(...s.points.map(p=>p.x*d.x+p.y*d.y));
    const x=CIRCLE.x+d.x*(CIRCLE.radius-extent-.1),y=CIRCLE.y+d.y*(CIRCLE.radius-extent-.1);
    for(const dx of [-.01,.01])g.addFruit(kind,x+dx,y).age=2;
    g.step();assert.equal(g.merges,1);assert.equal(g.over,false);inCircle(g,g.bodies[0]);
  }
});

test('merge celebration adds no velocity impulse',()=>{
  for(const mode of ['classic','gravity']){
    const g=new MergeGame(()=>0);g.setMode(mode);
    const a=g.addFruit(0,205,250),b=g.addFruit(0,220,250);a.age=b.age=2;a.vx=20;b.vx=40;a.vy=b.vy=0;
    g.step();assert.equal(g.merges,1);
    assert.ok(Math.abs(g.bodies[0].vx-30*Math.exp(-.8*STEP))<1e-8);
    assert.ok(Math.abs(g.bodies[0].vy-1050*STEP)<1e-8);
  }
});

test('a fast body cannot tunnel through thin solid walls before collision resolution',()=>{
  for(const mode of ['classic','gravity'])for(const velocity of [[60000,0],[-60000,0],[0,60000]]){
    const g=new MergeGame(()=>0);g.setMode(mode);const b=g.addFruit(6,220,220);[b.vx,b.vy]=velocity;
    g.step();assert.equal(g.over,false);if(mode==='classic')inBasket(g,b);else inCircle(g,b);
  }
});

test('dense growing stacks cannot expel fruit through the basket base or corners',()=>{
  for(const x of [95,220,345]){
    const g=new MergeGame(()=>0);
    for(let kind=0;kind<8;kind++)for(const dx of [-4,4])g.addFruit(kind,x+dx,HEIGHT-100-kind*8).age=2;
    for(let n=0;n<60;n++){g.step();for(const b of g.bodies)inBasket(g,b);assert.equal(g.over,false);}
    assert.ok(g.merges>=8);
  }
});

test('a fruit that goes over the rim can still fall outside the basket',()=>{
  const g=new MergeGame(()=>0),b=g.addFruit(0,WIDTH-15,8);b.vx=300;b.vy=-50;
  advance(g,.65);assert.equal(g.over,true);assert.ok(b.x>WIDTH);
});
