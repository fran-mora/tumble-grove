import { pathToFileURL } from 'node:url';
import { FRUIT_COLLECTION, chooseFruitLineup } from '../app/fruit-collection.ts';
import { chooseColourfulRound, colourSimilarity, parseFruitHistory } from '../app/fruit-selection.ts';

export function simulateSelection(rounds=30000){
  let seed=15;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const history=parseFruitHistory(null),counts=Array(FRUIT_COLLECTION.length).fill(0);
  let similarPairs=0,randomPairs=0,adjacentPairs=0,randomAdjacentPairs=0;
  for(let round=0;round<rounds;round++){
    const {lineup}=chooseColourfulRound(random,history),baseline=chooseFruitLineup(random);
    for(const id of lineup)counts[id]++;
    for(let a=0;a<lineup.length;a++)for(let b=a+1;b<lineup.length;b++){
      const similar=colourSimilarity(lineup[a],lineup[b])>.75,randomSimilar=colourSimilarity(baseline[a],baseline[b])>.75;
      similarPairs+=Number(similar);randomPairs+=Number(randomSimilar);
      if(b===a+1){adjacentPairs+=Number(similar);randomAdjacentPairs+=Number(randomSimilar);}
    }
  }
  return {rounds,minimum:Math.min(...counts),maximum:Math.max(...counts),similarPairs:similarPairs/rounds,randomPairs:randomPairs/rounds,adjacentPairs:adjacentPairs/rounds,randomAdjacentPairs:randomAdjacentPairs/rounds};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=simulateSelection();
  console.log(`${result.rounds.toLocaleString()} seeded rounds; every climate eligible; no simulated discoveries.`);
  console.table([
    {measure:'Very similar colour pairs / round',colourful:result.similarPairs,uniformRandom:result.randomPairs},
    {measure:'Very similar neighbouring pairs / round',colourful:result.adjacentPairs,uniformRandom:result.randomAdjacentPairs},
  ]);
  console.log(`Appearances per fruit: ${result.minimum}–${result.maximum}; equal-share target ${result.rounds/10}.`);
}
