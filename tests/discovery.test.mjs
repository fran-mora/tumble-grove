import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MergeGame, FRUITS, MERGE_LABEL_SECONDS, STEP } from '../app/engine.ts';
import { FRUIT_COLLECTION } from '../app/fruit-collection.ts';
import { renderGame } from '../app/render.ts';
import { VIEW_PADDING } from '../app/arena.ts';
const advance=(game,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)game.step();};

test('inspection freezes fruit, pending merges, gravity, guide direction, and cooldown',()=>{
  for(const mode of ['classic','gravity']){
    const game=new MergeGame(()=>.4,()=>0);game.setMode(mode);game.drop();
    const fruit=game.addFruit(0,220,210);fruit.age=2;
    game.addFruit(0,222,210).age=2;
    assert.equal(game.setInspecting(true),true);
    const before=JSON.stringify({snapshot:game.snapshot(),bodies:game.bodies,events:game.events,time:game.time,cooldown:game.cooldown});
    game.setGravity(1,0);advance(game,3);
    assert.equal(game.drop(),false);
    assert.equal(JSON.stringify({snapshot:game.snapshot(),bodies:game.bodies,events:game.events,time:game.time,cooldown:game.cooldown}),before);
    game.setInspecting(false);advance(game,.6);
    assert.ok(game.time>0);assert.ok(game.merges>0);assert.equal(game.canDrop,true);
    if(mode==='gravity')assert.ok(game.down.x>.99);
  }
});

test('inspection hits every rotated fruit silhouette and ignores empty bounding-box corners',()=>{
  for(const fruit of FRUIT_COLLECTION)for(const angle of [0,.7,2.1]){
    const game=new MergeGame(()=>0);game.lineup[fruit.level]=fruit.id;
    const body=game.addFruit(fruit.level,220,280);body.angle=angle;
    const hull=game.getShape(body.kind,angle),center={x:hull.points.reduce((sum,p)=>sum+p.x,0)/hull.points.length,y:hull.points.reduce((sum,p)=>sum+p.y,0)/hull.points.length};
    game.setInspecting(true);
    game.inspectFruit(body.x+center.x,body.y+center.y);
    assert.equal(game.inspectedId,body.id,fruit.name);
    game.inspectFruit(body.x+hull.maxX-0.001,body.y+hull.maxY-0.001);
    assert.equal(game.inspectedId,null,`${fruit.name}: empty corner`);
    game.inspectFruit(-100,-100);assert.equal(game.inspectedId,null);
  }
});

test('frontmost fruit wins overlapping taps, keyboard selection wraps, and invalid taps are harmless',()=>{
  const game=new MergeGame(()=>0);
  const back=game.addFruit(4,220,300),front=game.addFruit(1,220,300);
  game.inspectFruit(220,300);assert.equal(game.inspectedId,null);
  game.setInspecting(true);game.inspectFruit(220,300);assert.equal(game.inspectedId,front.id);
  game.inspectFruit(NaN,Infinity);assert.equal(game.inspectedId,front.id);
  game.cycleInspectedFruit(1);assert.equal(game.inspectedId,back.id);
  game.cycleInspectedFruit(-1);assert.equal(game.inspectedId,front.id);
  game.setInspecting(false);assert.equal(game.inspectedId,null);
});

test('inspection cannot start on an empty or finished board and resets with the round',()=>{
  const game=new MergeGame(()=>0);assert.equal(game.setInspecting(true),false);
  game.addFruit(4,220,300);game.over=true;assert.equal(game.setInspecting(true),false);
  game.over=false;game.setInspecting(true);game.inspectFruit(220,300);game.reset();
  assert.equal(game.inspecting,false);assert.equal(game.inspectedId,null);assert.equal(game.paused,false);
  game.addFruit(4,220,300);game.setInspecting(true);game.setMode('gravity');
  assert.equal(game.inspecting,false);assert.equal(game.inspectedId,null);assert.equal(game.paused,false);
});

test('merge labels retain the new body and actual round variety for two seconds, then expire',()=>{
  for(let kind=0;kind<FRUITS.length;kind++){
    const game=new MergeGame(()=>.8);
    game.addFruit(kind,205,330).age=2;game.addFruit(kind,225,330).age=2;game.step();
    const event=game.events[0];assert.ok(event);
    if(kind===10){assert.equal(event.cleared,true);assert.equal(event.bodyId,null);continue;}
    const result=game.bodies.find(b=>b.id===event.bodyId);
    assert.equal(result.kind,kind+1);assert.equal(game.getFruit(event.kind).id,game.lineup[kind+1]);
    advance(game,1.5);assert.ok(game.events.includes(event));
    game.setInspecting(true);advance(game,4);assert.ok(game.events.includes(event));
    game.setInspecting(false);advance(game,MERGE_LABEL_SECONDS);
    assert.equal(game.events.includes(event),false);
  }
});

// Record actual renderer output without requiring a browser or loading artwork.
function canvasRecorder(clientWidth,height){
  const text=[],boxes=[];
  const ctx=new Proxy({
    canvas:{width:504,height:height+64,clientWidth},
    measureText(value){return {width:value.length*parseFloat(this.font.replace('bold ',''))*.6};},
    fillText(value){text.push(value);},
    roundRect(x,y,width,height){boxes.push({x,y,width,height});},
  },{get:(target,key)=>key in target?target[key]:()=>{}});
  return {ctx,text,boxes};
}

test('Inspect renders every fruit name within a small phone canvas in both appearances, including rotated edge fruit',()=>{
  for(const darkMode of [false,true])for(const fruit of FRUIT_COLLECTION)for(const mode of ['classic','gravity']){
    const game=new MergeGame(()=>0);game.setMode(mode);game.lineup[fruit.level]=fruit.id;
    const body=game.addFruit(fruit.level,fruit.id%2?0:440,fruit.id%3?game.height:0);body.angle=1.2;
    game.setInspecting(true);game.inspectedId=body.id;
    const {ctx,text,boxes}=canvasRecorder(220,game.height);renderGame(ctx,game,[],true,darkMode);
    assert.ok(text.includes(fruit.name),fruit.name);assert.equal(boxes.length,1);
    const box=boxes[0];
    assert.ok(box.x>=-VIEW_PADDING&&box.x+box.width<=440+VIEW_PADDING);
    assert.ok(box.y>=-VIEW_PADDING&&box.y+box.height<=game.height+VIEW_PADDING);
  }
});

test('large merge names remain visible with reduced motion and cleared pairs do not announce a new fruit',()=>{
  for(const darkMode of [false,true])for(const reducedMotion of [false,true]){
    const game=new MergeGame(()=>.7);const body=game.addFruit(9,220,400);
    game.events=[{x:220,y:400,kind:9,points:45,time:0,cleared:false,bodyId:body.id}];game.time=1.6;
    const visible=canvasRecorder(374,game.height);renderGame(visible.ctx,game,[],reducedMotion,darkMode);
    assert.ok(visible.text.includes(game.getFruit(9).name));
    game.events[0].cleared=true;game.bodies=[];
    const cleared=canvasRecorder(374,game.height);renderGame(cleared.ctx,game,[],reducedMotion,darkMode);
    assert.ok(!cleared.text.includes(game.getFruit(9).name));
  }
});
