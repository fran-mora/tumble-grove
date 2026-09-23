import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FRUIT_COLLECTION,FRUIT_LEVELS} from '../app/fruit-collection.ts';
import {FRUIT_COLOURS} from '../app/fruit-colours.ts';
import {chooseColourfulRound,lineupWeights,colourSimilarity,parseFruitHistory} from '../app/fruit-selection.ts';
import {MergeGame} from '../app/engine.ts';
import {simulateSelection} from '../scripts/simulate-selection.mjs';
const seeded=(seed)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

test('all artwork has finite measured colours and similar reds differ from blue or green',()=>{
  assert.equal(FRUIT_COLOURS.length,FRUIT_COLLECTION.length);
  for(const colour of FRUIT_COLOURS){assert.match(colour.hex,/^#[0-9a-f]{6}$/);assert.ok(colour.lab.every(Number.isFinite));}
  const id=name=>FRUIT_COLLECTION.find(f=>f.name===name).id;
  assert.ok(colourSimilarity(id('Cherry'),id('Cranberry'))>.75);
  assert.ok(colourSimilarity(id('Cherry'),id('Blueberry'))<.2);
  assert.ok(colourSimilarity(id('Cherry'),id('Lime'))<.2);
});

test('selection preserves size levels, avoids the last lineup, and handles invalid random values',()=>{
  for(const random of [seeded(127),()=>0,()=>1,()=>NaN,()=>Infinity]){
    const history=parseFruitHistory(null);let previous=[];
    for(let i=0;i<100;i++){
      const {lineup}=chooseColourfulRound(random,history);
      assert.ok(lineup.every((id,level)=>FRUIT_LEVELS[level].includes(id)&&id!==previous[level]));previous=lineup;
    }
  }
});

test('underselected and never-encountered fruit get a boost; every candidate stays eligible',()=>{
  const history=parseFruitHistory(null),[a,b]=FRUIT_LEVELS[0];
  history.seen.fill(1);history.selected[a]=5;
  const weights=lineupWeights(history);assert.ok(weights[b]>weights[a]*30);
  history.selected[a]=0;history.seen[a]=0;
  const unseen=lineupWeights(history);assert.ok(unseen[a]>unseen[b]);
  assert.ok(unseen.every(w=>Number.isFinite(w)&&w>0));
});

test('corrupt or older saved history cannot supply invalid counts or lineup identities',()=>{
  for(const value of [null,'bad',[],{version:2,selected:Array(110).fill(100)}, {version:1,selected:[NaN,-1,Infinity,1.5,1e20],previous:FRUIT_LEVELS.map(()=>-1)}]){
    const h=parseFruitHistory(value);assert.equal(h.selected.length,110);assert.ok(h.selected.every(x=>Number.isInteger(x)&&x>=0));assert.deepEqual(h.previous,[]);
    const round=chooseColourfulRound(()=>.4,h);assert.ok(round.lineup.every((id,level)=>FRUIT_LEVELS[level].includes(id)));
  }
  const h=parseFruitHistory(null),round=chooseColourfulRound(()=>.4,h),copy=parseFruitHistory(h);
  assert.deepEqual(copy,h);copy.selected[0]=999;assert.notEqual(copy.selected[0],h.selected[0]);
  const later=chooseColourfulRound(()=>.4,parseFruitHistory(JSON.parse(JSON.stringify(h))));
  assert.ok(later.lineup.every((id,level)=>id!==round.lineup[level]));
});

test('only displayed or created fruit count as encounters, once per round',()=>{
  const g=new MergeGame(()=>.8,seeded(37)),lineup=[...g.lineup];
  let h=g.getFruitHistory();assert.equal(h.seen[lineup[0]],1);
  for(let level=1;level<11;level++)assert.equal(h.seen[lineup[level]],0,`hidden level ${level+1}`);
  g.addFruit(6,220,350);g.addFruit(6,220,350);h=g.getFruitHistory();
  assert.equal(h.seen[lineup[6]],1);assert.equal(h.seen[lineup[10]],0);
  g.drop();h=g.getFruitHistory();assert.equal(h.seen[lineup[g.next]],1,'visible next preview counts');
  assert.deepEqual(g.lineup,lineup);
  g.setInspecting(true);g.inspectFruit(220,350);assert.deepEqual(g.getFruitHistory(),h);
  const loaded=new MergeGame(()=>.8,seeded(38),JSON.parse(JSON.stringify(h)));
  assert.ok(loaded.lineup.every((id,level)=>id!==lineup[level]));
  assert.equal(loaded.getFruitHistory().seen[lineup[6]],1);
  g.reset();assert.ok(g.lineup.every((id,level)=>id!==lineup[level]));
  g.setMode('gravity');assert.ok(g.snapshot().lineup.every((fruit,level)=>FRUIT_LEVELS[level].includes(fruit.id)));
});

test('30,000 seeded mixed rounds reduce similar colours without starving any fruit',()=>{
  const result=simulateSelection(30000);
  assert.ok(result.maximum-result.minimum<=12,`${result.minimum}–${result.maximum}`);
  assert.ok(result.similarPairs<result.randomPairs*.75,JSON.stringify(result));
  assert.ok(result.adjacentPairs<result.randomAdjacentPairs*.65,JSON.stringify(result));
});

test('balancing survives reloads and uneven discoveries without starving any fruit',()=>{
  const random=seeded(799),counts=Array(110).fill(0);let history=parseFruitHistory(null);
  for(let i=0;i<2000;i++){
    const {lineup}=chooseColourfulRound(random,history);
    for(const id of lineup){counts[id]++;if(id%3===0)history.seen[id]++;}
    if(i%13===0)history=parseFruitHistory(JSON.parse(JSON.stringify(history)));
  }
  assert.ok(Math.max(...counts)-Math.min(...counts)<=12);
  const loaded=new MergeGame(()=>0,()=>0,history);assert.ok(loaded.canDrop);
});
