import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FRUIT_COLLECTION,FRUIT_LEVELS,chooseFruitLineup} from '../app/fruit-collection.ts';
import {ROUND_THEMES,THEME_MEMBERS,chooseRoundTheme,chooseThemedRound,lineupWeights,matchesTheme,parseFruitHistory} from '../app/fruit-themes.ts';
import {MergeGame} from '../app/engine.ts';
const seeded=(seed)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

test('every fruit has valid associations and documented level coverage is accurate',()=>{
  const names=new Set(FRUIT_COLLECTION.map(f=>f.name));
  for(const members of Object.values(THEME_MEMBERS)){
    assert.equal(new Set(members).size,members.length);
    for(const name of members)assert.ok(names.has(name),name);
  }
  for(const fruit of FRUIT_COLLECTION)assert.ok(Object.keys(THEME_MEMBERS).some(theme=>matchesTheme(fruit.id,theme)),fruit.name);
  const coverage={tropical:[1,2,5,5,7,5,3,6,6,3,3],temperate:[9,8,5,5,2,4,6,2,4,7,7],mediterranean:[0,2,3,6,7,6,9,7,5,7,7]};
  for(const [theme,expected] of Object.entries(coverage))assert.deepEqual(FRUIT_LEVELS.map(ids=>ids.filter(id=>matchesTheme(id,theme)).length),expected);
  assert.equal(matchesTheme(FRUIT_COLLECTION.find(f=>f.name==='Pawpaw').id,'tropical'),false);
  assert.equal(matchesTheme(FRUIT_COLLECTION.find(f=>f.name==='Papaya').id,'tropical'),true);
});

test('the theme is rolled independently with fixed chances, including occasional mixed rounds',()=>{
  assert.ok(Math.abs(ROUND_THEMES.reduce((sum,t)=>sum+t.chance,0)-1)<1e-12);
  for(const [roll,id] of [[0,'tropical'],[.299,'tropical'],[.3,'temperate'],[.6,'mediterranean'],[.95,'mixed'],[1,'mixed'],[NaN,'tropical']])assert.equal(chooseRoundTheme(()=>roll).id,id);
  const h=parseFruitHistory(null);
  h.selected.fill(500);h.seen.fill(100);
  assert.equal(chooseThemedRound(()=>.95,h).theme.id,'mixed');
  assert.equal(chooseThemedRound(()=>.95,h).theme.id,'mixed','repeating a theme is a valid independent roll');
});

test('weighted selection preserves every candidate, size level, non-repetition and empty-theme fallback',()=>{
  for(const theme of ROUND_THEMES){
    const history=parseFruitHistory(null),weights=lineupWeights(theme.id,history);
    for(let level=0;level<11;level++){
      const ids=FRUIT_LEVELS[level],total=ids.reduce((sum,id)=>sum+weights[id],0);let before=0;
      for(const id of ids){
        const roll=(before+weights[id]/2)/total;
        assert.equal(chooseFruitLineup(()=>roll,undefined,weights)[level],id);
        before+=weights[id];
      }
    }
    let previous;
    const random=seeded(127);
    for(let i=0;i<100;i++){
      const lineup=chooseFruitLineup(random,previous,weights);
      assert.ok(lineup.every((id,level)=>FRUIT_LEVELS[level].includes(id)&&id!==previous?.[level]));previous=lineup;
    }
  }
});

test('underselected and never-encountered fruit receive a boost without changing the theme probabilities',()=>{
  const history=parseFruitHistory(null),[a,b]=FRUIT_LEVELS[0];
  history.seen.fill(1);history.selected[a]=5;
  const weights=lineupWeights('mixed',history);assert.ok(weights[b]>weights[a]*30);
  history.selected[a]=0;history.seen[a]=0;
  const unseen=lineupWeights('mixed',history);assert.ok(unseen[a]>unseen[b]);
  assert.ok(unseen.every(w=>Number.isFinite(w)&&w>0));
});

test('corrupt or older saved history cannot supply invalid counts or lineup identities',()=>{
  for(const value of [null,'bad',[],{version:2,selected:Array(110).fill(100)}, {version:1,selected:[NaN,-1,Infinity,1.5,1e20],previous:FRUIT_LEVELS.map(()=>-1)}]){
    const h=parseFruitHistory(value);assert.equal(h.selected.length,110);assert.ok(h.selected.every(x=>Number.isInteger(x)&&x>=0));assert.deepEqual(h.previous,[]);
    const round=chooseThemedRound(()=>.4,h);assert.ok(round.lineup.every((id,level)=>FRUIT_LEVELS[level].includes(id)));
  }
  const h=parseFruitHistory(null),round=chooseThemedRound(()=>.4,h),copy=parseFruitHistory(h);
  assert.deepEqual(copy,h);copy.selected[0]=999;assert.notEqual(copy.selected[0],h.selected[0]);
  const later=chooseThemedRound(()=>.4,parseFruitHistory(JSON.parse(JSON.stringify(h))));
  assert.ok(later.lineup.every((id,level)=>id!==round.lineup[level]));
});

test('only displayed or created fruit count as encounters, once per round',()=>{
  const g=new MergeGame(()=>.8,seeded(37)),lineup=[...g.lineup],theme=g.theme;
  let h=g.getFruitHistory();assert.equal(h.seen[lineup[0]],1);
  for(let level=1;level<11;level++)assert.equal(h.seen[lineup[level]],0,`hidden level ${level+1}`);
  g.addFruit(6,220,350);g.addFruit(6,220,350);h=g.getFruitHistory();
  assert.equal(h.seen[lineup[6]],1);assert.equal(h.seen[lineup[10]],0);
  g.drop();h=g.getFruitHistory();assert.equal(h.seen[lineup[g.next]],1,'visible next preview counts');
  assert.deepEqual(g.lineup,lineup);assert.equal(g.theme,theme);
  g.setInspecting(true);g.inspectFruit(220,350);assert.deepEqual(g.getFruitHistory(),h);
  const loaded=new MergeGame(()=>.8,seeded(38),JSON.parse(JSON.stringify(h)));
  assert.ok(loaded.lineup.every((id,level)=>id!==lineup[level]));
  assert.equal(loaded.getFruitHistory().seen[lineup[6]],1);
  g.reset();assert.ok(g.lineup.every((id,level)=>id!==lineup[level]));assert.ok(ROUND_THEMES.includes(g.theme));
  g.setMode('gravity');assert.equal(g.snapshot().theme.name,g.theme.name);
});

test('30,000 seeded rounds retain theme coherence and near-equal within-level exposure',()=>{
  const random=seeded(15),history=parseFruitHistory(null),counts=Array(110).fill(0);
  const stats=Object.fromEntries(ROUND_THEMES.map(t=>[t.id,{n:0,match:0}]));
  for(let i=0;i<30000;i++){
    const {theme,lineup}=chooseThemedRound(random,history);stats[theme.id].n++;
    for(const id of lineup){counts[id]++;stats[theme.id].match+=Number(matchesTheme(id,theme.id));}
  }
  assert.ok(Math.max(...counts)-Math.min(...counts)<=10,`${Math.min(...counts)}–${Math.max(...counts)}`);
  for(const theme of ROUND_THEMES){
    assert.ok(Math.abs(stats[theme.id].n/30000-theme.chance)<.02);
    if(theme.id==='mixed')continue;
    const baseline=FRUIT_COLLECTION.filter(f=>matchesTheme(f.id,theme.id)).length/110;
    assert.ok(stats[theme.id].match/(stats[theme.id].n*11)>baseline+.12,theme.name);
  }
});

test('balancing survives reloads and uneven discoveries without starving any fruit',()=>{
  const random=seeded(799),counts=Array(110).fill(0);let history=parseFruitHistory(null);
  for(let i=0;i<2000;i++){
    const {lineup}=chooseThemedRound(random,history);
    for(const id of lineup){counts[id]++;if(id%3===0)history.seen[id]++;}
    if(i%13===0)history=parseFruitHistory(JSON.parse(JSON.stringify(history)));
  }
  assert.ok(Math.max(...counts)-Math.min(...counts)<=12);
  const loaded=new MergeGame(()=>0,()=>0,history);assert.ok(loaded.canDrop);
});
