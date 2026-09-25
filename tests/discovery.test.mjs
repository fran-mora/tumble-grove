import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MergeGame, FRUITS, MERGE_LABEL_SECONDS, STEP, WILD_RADIUS } from '../app/engine.ts';
import { FRUIT_COLLECTION } from '../app/fruit-collection.ts';
import { renderGame } from '../app/render.ts';
import { VIEW_PADDING } from '../app/arena.ts';
import { POWER_DETAILS, powerStrength } from '../app/powers.ts';
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

test('merge labels retain the new body and actual round variety, then expire',()=>{
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
  const text=[],boxes=[],arcs=[],images=[];
  const ctx=new Proxy({
    canvas:{width:504,height:height+64,clientWidth},
    createRadialGradient(){return {addColorStop(){}};},
    measureText(value){return {width:value.length*parseFloat(this.font.replace('bold ',''))*.6};},
    fillText(value){text.push(value);},
    roundRect(x,y,width,height){boxes.push({x,y,width,height});},
    arc(x,y,radius){arcs.push({x,y,radius});},
    drawImage(...args){images.push(args);},
  },{get:(target,key)=>key in target?target[key]:()=>{}});
  return {ctx,text,boxes,arcs,images};
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
    game.events=[{id:1,chain:1,sources:[],x:220,y:400,kind:9,points:45,time:0,cleared:false,bodyId:body.id}];game.time=1.6;
    const visible=canvasRecorder(374,game.height);renderGame(visible.ctx,game,[],reducedMotion,darkMode);
    assert.ok(visible.text.includes(game.getFruit(9).name));
    game.events[0].cleared=true;game.bodies=[];
    const cleared=canvasRecorder(374,game.height);renderGame(cleared.ctx,game,[],reducedMotion,darkMode);
    assert.ok(!cleared.text.includes(game.getFruit(9).name));
  }
});


test('cascade labels fit every fruit name at narrow arena edges in both appearances',()=>{
  for(const darkMode of [false,true])for(const fruit of FRUIT_COLLECTION){
    const game=new MergeGame(()=>0);game.lineup[fruit.level]=fruit.id;
    const body=game.addFruit(fruit.level,fruit.id%2?0:440,570);body.angle=1.2;
    game.events=[{id:1,chain:8,sources:[],x:body.x,y:body.y,kind:fruit.level,points:55,time:0,cleared:false,bodyId:body.id}];game.time=.6;
    const {ctx,text,boxes}=canvasRecorder(180,game.height);renderGame(ctx,game,[],false,darkMode);
    assert.ok(text.includes(fruit.name));assert.ok(text.includes('+55 · 8-step cascade'));
    for(const box of boxes){assert.ok(box.x>=-VIEW_PADDING&&box.x+box.width<=440+VIEW_PADDING);assert.ok(box.y>=-VIEW_PADDING&&box.y+box.height<=game.height+VIEW_PADDING);}
  }
});

test('ordinary fruit labels stay within a narrow canvas and do not claim an intrinsic power',()=>{
  for(const darkMode of [false,true])for(const fruit of FRUIT_COLLECTION)for(const inspecting of [false,true]){
    const game=new MergeGame(()=>0);game.powersEnabled=true;game.lineup[fruit.level]=fruit.id;
    game.current=fruit.level;game.aim=fruit.id%2?0:440;
    if(inspecting){const body=game.addFruit(fruit.level,game.aim,570);body.angle=1.2;game.setInspecting(true);game.inspectedId=body.id;}
    const {ctx,text,boxes}=canvasRecorder(180,game.height);renderGame(ctx,game,[],true,darkMode);
    assert.ok(text.includes(fruit.name),fruit.name);
    assert.ok(!text.some(value=>value.includes('on merge')||Object.values(POWER_DETAILS).some(power=>value===power.name)),fruit.name);
    for(const box of boxes){assert.ok(box.x>=-VIEW_PADDING&&box.x+box.width<=440+VIEW_PADDING);assert.ok(box.y>=-VIEW_PADDING&&box.y+box.height<=game.height+VIEW_PADDING);}
  }
});

test('power effects are limited to three, stay still with reduced motion, and disappear when disabled',()=>{
  const game=new MergeGame(()=>0);game.powersEnabled=true;
  game.powerEffects=['gather','gather','shake','choose'].map((power,id)=>({id,power,level:1,kind:1,x:200,y:300,time:0,duration:3,radius:90+id}));
  for(const time of [.2,1.6]){
    game.time=time;
    const {ctx,arcs}=canvasRecorder(374,game.height);renderGame(ctx,game,[],true);
    assert.deepEqual(arcs.map(arc=>arc.radius),[91,92,93]);
  }
  game.powersEnabled=false;
  const {ctx,arcs,text}=canvasRecorder(374,game.height);renderGame(ctx,game,[],true);
  assert.equal(arcs.length,0);
  assert.ok(!text.some(value=>Object.values(POWER_DETAILS).some(power=>value.includes(power.name))));
});

test('merge labels celebrate the cascade rather than promising an automatic power',()=>{
  const game=new MergeGame(()=>0);game.powersEnabled=true;
  const body=game.addFruit(6,220,350);
  game.events=[{id:1,chain:8,sources:[],x:220,y:350,kind:6,points:55,time:0,cleared:false,bodyId:body.id}];game.time=.6;
  const {ctx,text}=canvasRecorder(180,game.height);renderGame(ctx,game,[],true);
  assert.ok(text.includes('+55 · 8-step cascade'));
});

test('all eight collectible powers render with and without reduced motion',()=>{
  for(const power of Object.keys(POWER_DETAILS))for(const reducedMotion of [false,true]){
    const game=new MergeGame(()=>0);game.powersEnabled=true;game.time=.5;
    game.powerEffects=[{id:1,power,level:3,kind:1,x:200,y:300,time:0,duration:3,radius:149}];
    const {ctx,arcs}=canvasRecorder(374,game.height);assert.doesNotThrow(()=>renderGame(ctx,game,[],reducedMotion));
    if(reducedMotion)assert.deepEqual(arcs,[{x:200,y:300,radius:149}]);
  }
});

test('squeezed fruit use their actual sprite size for rendering and their actual hull for inspection and aiming',()=>{
  const game=new MergeGame(()=>0),body=game.addFruit(6,220,300);body.scale=.75;body.angle=.7;
  const fruit=game.getFruit(6),sprites=[];sprites[fruit.id]={width:fruit.geometry.crop[2],height:fruit.geometry.crop[3]};
  const shapeCalls=[],getBodyShape=game.getBodyShape.bind(game);game.getBodyShape=b=>{shapeCalls.push(b.id);return getBodyShape(b);};
  game.setInspecting(true);game.inspectedId=body.id;
  const {ctx,images,text}=canvasRecorder(374,game.height);renderGame(ctx,game,sprites,true);
  const scale=FRUITS[6].radius/fruit.geometry.radius*.75;
  assert.ok(images.some(args=>Math.abs(args[3]-sprites[fruit.id].width*scale)<1e-8&&Math.abs(args[4]-sprites[fruit.id].height*scale)<1e-8));
  assert.ok(shapeCalls.filter(id=>id===body.id).length>=2,'landing prediction and inspection must both use the scaled body shape');
  assert.ok(text.includes('Squeezed'));assert.ok(text.includes(fruit.name));
});

test('Wild seed has a distinct preview, inspection name and geometry at narrow edges',()=>{
  for(const inspecting of [false,true])for(const darkMode of [false,true]){
    const game=new MergeGame(()=>0);game.powersEnabled=true;game.current=4;
    game.wildReady={level:3,maxKind:6};game.setAim(0);
    if(inspecting){const body=game.addFruit(0,440,570);body.wild=game.wildReady;game.wildReady=null;game.setInspecting(true);game.inspectedId=body.id;}
    const {ctx,text,arcs,boxes}=canvasRecorder(180,game.height);renderGame(ctx,game,[],true,darkMode);
    assert.ok(text.includes('Wild seed'));assert.ok(text.includes('Matches levels 1–7'));assert.ok(text.includes('✦'));
    assert.ok(arcs.some(arc=>arc.radius===WILD_RADIUS));assert.ok(!text.includes(game.getFruit(game.current).name));
    for(const box of boxes){assert.ok(box.x>=-VIEW_PADDING&&box.x+box.width<=440+VIEW_PADDING);assert.ok(box.y>=-VIEW_PADDING&&box.y+box.height<=game.height+VIEW_PADDING);}
  }
});

test('armed area and fruit powers preview the actual range and eligible fruit without a drop label',()=>{
  for(const type of ['gather','ripen']){
    const game=new MergeGame(()=>0);game.powersEnabled=true;game.current=5;
    const body=game.addFruit(1,220,300);game.addFruit(1,270,300);
    game.inventory=[{id:1,type,level:3}];assert.equal(game.armPower(1),true);game.setPowerTarget(body.x,body.y);
    const {ctx,arcs,text}=canvasRecorder(180,game.height);renderGame(ctx,game,[],true);
    if(type==='gather')assert.ok(arcs.some(arc=>arc.radius===powerStrength(3).radius));
    else {assert.ok(text.includes(game.getFruit(body.kind).name));assert.ok(text.includes('Ripen · Level 3'));}
    assert.ok(!text.includes(game.getFruit(game.current).name),'targeting should not show a ready-to-drop label');
  }
});
