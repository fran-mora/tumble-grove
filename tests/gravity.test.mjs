import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MergeGame,FRUITS,WIDTH,HEIGHT,CIRCLE,CIRCLE_DANGER,STEP} from '../app/engine.ts';
import {fruitHull,confineToCircle,circleTravel,directionalLanding,hullContact} from '../app/collision.ts';
const advance=(g,seconds)=>{for(let n=0;n<Math.ceil(seconds/STEP);n++)g.step();};
const shapeOf=b=>fruitHull(b.kind,FRUITS[b.kind].radius,b.angle);
function inside(b,shape=shapeOf(b)){for(const p of shape.points)assert.ok(Math.hypot(b.x+p.x-CIRCLE.x,b.y+p.y-CIRCLE.y)<=CIRCLE.radius+.08,`escaped: ${b.kind}`);}
function gameWithDirection(x,y){const g=new MergeGame(()=>.4,()=>0);g.setMode('gravity');g.setGravity(x,y);advance(g,1.5);return g;}
test('mode changes start a fresh round, and normal restarts keep gravity mode',()=>{
  const g=new MergeGame(()=>0);g.drop();g.score=55;g.setMode('gravity');
  assert.equal(g.height,WIDTH);assert.equal(g.drops,0);assert.equal(g.score,0);assert.equal(g.bodies.length,0);
  g.setGravity(1,0);advance(g,1);g.reset();assert.equal(g.mode,'gravity');assert.ok(g.down.x>.99);
  g.setMode('classic');assert.equal(g.height,HEIGHT);assert.deepEqual(g.down,{x:0,y:1});
  assert.throws(()=>g.setMode('unknown'));
});
test('gravity is smoothed, bounded, finite, and frozen while paused',()=>{
  const g=gameWithDirection(0,1);g.setGravity(1,0);g.step();assert.ok(g.gravity.x>0&&g.gravity.x<.2);
  g.paused=true;const state=JSON.stringify(g.snapshot());advance(g,1);assert.equal(JSON.stringify(g.snapshot()),state);
  g.paused=false;g.setGravity(NaN,Infinity);advance(g,1);assert.ok(g.gravity.x>.99);
  g.setGravity(100,100);advance(g,1);assert.ok(Math.hypot(g.gravity.x,g.gravity.y)<=1.001);
  g.setGravity(0,0);advance(g,2);assert.ok(Math.hypot(g.gravity.x,g.gravity.y)<.001);assert.ok(Number.isFinite(g.down.x));
});
test('all fruit silhouettes stay inside the circle at every wall and rotation',()=>{
  for(let kind=0;kind<11;kind++)for(const angle of [0,.7,1.9])for(let quadrant=0;quadrant<8;quadrant++){
    const theta=quadrant*Math.PI/4,b={kind,x:CIRCLE.x+250*Math.cos(theta),y:CIRCLE.y+250*Math.sin(theta),vx:120*Math.cos(theta),vy:120*Math.sin(theta),angle};
    confineToCircle(b,shapeOf(b),CIRCLE,CIRCLE.radius);inside(b);
  }
});
test('spawn and guide follow gravity, with silhouettes landing on the circular wall',()=>{
  for(let step=0;step<12;step++){
    const theta=step*Math.PI/6,g=gameWithDirection(Math.sin(theta),Math.cos(theta));
    for(const aim of [0,110,220,330,440]){
      g.setAim(aim);const spawn=g.getSpawn(),shape=g.getShape(g.current);
      inside({...spawn,kind:g.current,angle:0},shape);
      const target=directionalLanding(spawn,shape,g.down,[],CIRCLE,CIRCLE.radius);
      const dx=target.x-spawn.x,dy=target.y-spawn.y;
      assert.ok(Math.abs(dx*g.down.y-dy*g.down.x)<.01);
      const distances=shape.points.map(p=>Math.hypot(target.x+p.x-CIRCLE.x,target.y+p.y-CIRCLE.y));
      assert.ok(Math.abs(Math.max(...distances)-CIRCLE.radius)<.01);
    }
  }
});
test('fruit accelerates toward each tilted wall and cannot escape the bowl',()=>{
  for(const direction of [[0,1],[1,0],[0,-1],[-1,0]]){
    const g=gameWithDirection(...direction),b=g.addFruit(3,CIRCLE.x,CIRCLE.y);advance(g,.2);
    assert.ok(b.vx*direction[0]+b.vy*direction[1]>150);
    advance(g,2);inside(b,g.getShape(b.kind,b.angle));assert.ok((b.x-CIRCLE.x)*direction[0]+(b.y-CIRCLE.y)*direction[1]>130);
  }
});
test('matching fruit merge while falling sideways and upward',()=>{
  for(const direction of [[1,0],[0,-1],[-1,0]]){
    const g=gameWithDirection(...direction);g.drop(220);advance(g,1.2);g.drop(220);advance(g,2.5);
    assert.equal(g.merges,1);assert.equal(g.score,1);assert.equal(g.bodies[0].kind,1);inside(g.bodies[0],g.getShape(1,g.bodies[0].angle));
  }
});
test('the rotated dotted line permits a higher stack without a countdown',()=>{
  const g=gameWithDirection(1,0),b=g.addFruit(6,CIRCLE.x,CIRCLE.y);
  for(let n=0;n<600;n++){b.x=CIRCLE.x+CIRCLE_DANGER-15;b.y=CIRCLE.y;b.age=3;b.vx=0;b.vy=0;g.step();}
  assert.equal(g.over,false);assert.equal(g.danger,0);
});
test('a fruit may protrude through the mouth and loses only when fully outside',()=>{
  for(const [x,y] of [[0,1],[1,0],[0,-1],[-1,0]]){
    const g=gameWithDirection(x,y),b=g.addFruit(0,CIRCLE.x-x*(CIRCLE.radius-5),CIRCLE.y-y*(CIRCLE.radius-5));
    g.step();assert.equal(g.over,false);
    b.x=CIRCLE.x-x*(CIRCLE.radius+60);b.y=CIRCLE.y-y*(CIRCLE.radius+60);g.step();
    assert.equal(g.over,true);assert.equal(g.drop(),false);
  }
});
test('overflow moves outward through the circular opening without an invisible wall',()=>{
  const g=gameWithDirection(0,1),b=g.addFruit(0,CIRCLE.x,25);b.vy=-650;
  advance(g,.3);assert.equal(g.over,true);assert.ok(b.y<0);
});
test('obstacle landing is exact along oblique gravity',()=>{
  const g=gameWithDirection(.6,.8),shape=g.getShape(0),obstacle={x:CIRCLE.x,y:CIRCLE.y,shape:g.getShape(6)};
  const spawn=g.getSpawn(),target=directionalLanding(spawn,shape,g.down,[obstacle],CIRCLE,CIRCLE.radius);
  const contact=hullContact({x:target.x+g.down.x*.02,y:target.y+g.down.y*.02},shape,obstacle,obstacle.shape);
  assert.ok(contact&&contact.depth<.025);
  assert.equal(hullContact({x:target.x-g.down.x*.02,y:target.y-g.down.y*.02},shape,obstacle,obstacle.shape),null);
  assert.ok(circleTravel(spawn,shape,g.down,CIRCLE,CIRCLE.radius)>0);
});
test('a mixed bowl stays finite through full rotations and can spill',()=>{
  const g=gameWithDirection(0,1);
  for(let drop=0;drop<45&&!g.over;drop++){
    const angle=drop*.29;g.setGravity(Math.sin(angle),Math.cos(angle));g.drop(80+(drop*73)%280);advance(g,.75);
    for(const b of g.bodies){assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.vx)&&Number.isFinite(b.vy));}
  }
  assert.ok(g.merges>0);
});
