import { FRUIT_COLLECTION, FRUIT_LEVELS } from '../app/fruit-collection.ts';
import { ROUND_THEMES, chooseThemedRound, matchesTheme, parseFruitHistory } from '../app/fruit-themes.ts';

let seed=15;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const history=parseFruitHistory(null),counts=Array(FRUIT_COLLECTION.length).fill(0);
const stats=Object.fromEntries(ROUND_THEMES.map(theme=>[theme.id,{rounds:0,matches:0}]));
const rounds=30000;
for(let round=0;round<rounds;round++){
  const {theme,lineup}=chooseThemedRound(random,history);
  stats[theme.id].rounds++;
  for(const id of lineup){counts[id]++;stats[theme.id].matches+=Number(matchesTheme(id,theme.id));}
}
console.log(`${rounds.toLocaleString()} seeded rounds; no simulated player discoveries.`);
console.table(ROUND_THEMES.map(theme=>({
  theme:theme.name,
  rounds:stats[theme.id].rounds,
  frequency:`${(100*stats[theme.id].rounds/rounds).toFixed(1)}%`,
  matchingFruit:`${(100*stats[theme.id].matches/(stats[theme.id].rounds*11)).toFixed(1)}%`,
  unthemedBaseline:`${(100*FRUIT_LEVELS.reduce((sum,ids)=>sum+ids.filter(id=>matchesTheme(id,theme.id)).length/ids.length,0)/11).toFixed(1)}%`,
})));
console.log(`Lineup appearances per fruit: ${Math.min(...counts)}–${Math.max(...counts)} (equal-share target ${rounds/10}).`);
