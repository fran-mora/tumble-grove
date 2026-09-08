import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FRUITS,HEIGHT,MergeGame} from '../app/engine.ts';
import {FRUIT_SHAPES} from '../app/fruit-shapes.ts';
import {fruitHull,hullContact,landingY} from '../app/collision.ts';
import {drawFruit} from '../app/render.ts';

test('padding above the cherry body no longer collides like a solid circle',()=>{
  const cherry=fruitHull(0,18),mandarin=fruitHull(3,37);
  // Previous radius-only physics blocked at 55px, leaving a visible gap here.
  assert.equal(hullContact({x:0,y:0},cherry,{x:0,y:45},mandarin),null);
  assert.ok(hullContact({x:0,y:0},cherry,{x:0,y:39},mandarin));
});
test('touching silhouettes produce contact across rotations and mixed fruit pairs',()=>{
  for(let a=0;a<11;a++)for(let b=0;b<11;b++)for(const angle of [0,.7,-1.2]){
    const top=fruitHull(a,FRUITS[a].radius,angle),bottom=fruitHull(b,FRUITS[b].radius,-angle);
    const y=landingY(220,0,top,[{x:220,y:350,shape:bottom}],HEIGHT);
    assert.ok(y>0&&y<350);
    assert.equal(hullContact({x:220,y:y-.02},top,{x:220,y:350},bottom),null);
    const contact=hullContact({x:220,y:y+.02},top,{x:220,y:350},bottom);
    assert.ok(contact&&contact.depth>0&&contact.depth<=.021,`${a}, ${b}, ${angle}`);
  }
});
test('rendered fruit bodies reach the contact surface without square padding',()=>{
  // Measured flesh extents in the source PNG, independent of any canvas padding.
  const cases=[{kind:0,right:331,bottom:332},{kind:3,right:1396,bottom:339},{kind:6,right:1027,bottom:674},{kind:8,right:302,bottom:1017}];
  for(const {kind,right,bottom} of cases){
    const source=FRUIT_SHAPES[kind],radius=FRUITS[kind].radius;
    const sprites=FRUIT_SHAPES.map(s=>({width:s.crop[2],height:s.crop[3]}));
    let call;
    const ctx={save(){},restore(){},translate(){},rotate(){},drawImage(...args){call=args;}};
    drawFruit(ctx,sprites,kind,0,0,radius);
    const [,x,y,w,h]=call;
    const visibleRight=x+(right-source.crop[0])/source.crop[2]*w;
    const visibleBottom=y+(bottom-source.crop[1])/source.crop[3]*h;
    const shape=fruitHull(kind,radius);
    assert.ok(Math.abs(visibleRight-shape.maxX)<.25,`right edge of ${FRUITS[kind].name}`);
    assert.ok(Math.abs(visibleBottom-shape.maxY)<.25,`bottom edge of ${FRUITS[kind].name}`);
  }
});
test('fruit flesh rests flush with the floor at any orientation',()=>{
  for(let kind=0;kind<11;kind++)for(const angle of [0,.4,1.8,3.1]){
    const game=new MergeGame(()=>0);const body=game.addFruit(kind,220,HEIGHT);body.angle=angle;body.age=2;game.step();
    const shape=game.getShape(kind,body.angle);
    // Start already below the floor after rotation as well.
    body.y=HEIGHT;game.step();
    assert.ok(Math.abs(body.y+shape.maxY-(HEIGHT-.005))<.01);
  }
});
test('a contained shape is separated using its full penetration, without NaN',()=>{
  const small=fruitHull(0,18),big=fruitHull(10,96);
  const contact=hullContact({x:0,y:0},small,{x:0,y:0},big);
  assert.ok(contact&&Number.isFinite(contact.depth)&&contact.depth>18);
  assert.equal(hullContact({x:-contact.nx*(contact.depth+.01),y:-contact.ny*(contact.depth+.01)},small,{x:0,y:0},big),null);
});
