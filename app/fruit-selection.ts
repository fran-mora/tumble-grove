import { FRUIT_COLLECTION, FRUIT_LEVELS, randomFraction } from './fruit-collection.ts';
import { FRUIT_COLOURS } from './fruit-colours.ts';

export const FRUIT_HISTORY_KEY='tumblegrove.fruit-history.v1';
export type FruitHistory={version:1;selected:number[];seen:number[];previous:number[]};
const MAX_COUNT=1_000_000;
/** Storage is optional and untrusted; copy and validate before using its weights. */
export function parseFruitHistory(value:unknown):FruitHistory {
  const data=value&&typeof value==='object'?value as Partial<FruitHistory>:{};
  const counts=(input:unknown)=>FRUIT_COLLECTION.map((_,id)=>{
    const count=Array.isArray(input)?input[id]:undefined;
    return typeof count==='number'&&Number.isInteger(count)&&count>=0&&count<=MAX_COUNT?count:0;
  });
  const previous=Array.isArray(data.previous)&&data.previous.length===FRUIT_LEVELS.length
    &&data.previous.every((id,level)=>FRUIT_LEVELS[level].includes(id))?[...data.previous]:[];
  return {version:1,selected:counts(data.version===1?data.selected:[]),seen:counts(data.version===1?data.seen:[]),previous:data.version===1?previous:[]};
}
/** Similarity of visible body colours in OKLab, with a smaller same-hue penalty
 * across light/dark shades. This measures artwork, never the fruit's climate/name.
 */
export function colourSimilarity(a:number,b:number):number {
  const [l1,a1,b1]=FRUIT_COLOURS[a].lab,[l2,a2,b2]=FRUIT_COLOURS[b].lab;
  const distance=(l1-l2)**2*.45**2+(a1-a2)**2+(b1-b2)**2;
  const appearance=Math.exp(-distance/(2*.065**2));
  const c1=Math.hypot(a1,b1),c2=Math.hypot(a2,b2);
  const angle=Math.acos(Math.max(-1,Math.min(1,(a1*a2+b1*b2)/(c1*c2||1))));
  const hue=Math.exp(-((angle/.55)**2))*Math.min(1,c1/.08)*Math.min(1,c2/.08);
  return .7*appearance+.3*hue;
}
export function lineupWeights(history:FruitHistory):number[] {
  const weights=FRUIT_COLLECTION.map(()=>1);
  for(const ids of FRUIT_LEVELS){
    const leastSelected=Math.min(...ids.map(id=>history.selected[id]));
    for(const id of ids){
      const unseenBoost=history.seen[id]===0?1.4:1;
      const excess=history.selected[id]-leastSelected;
      weights[id]=unseenBoost/(1+excess)**2;
    }
  }
  return weights;
}
/** Every round draws from all climates. Colour is a soft preference, not a ban:
 * repeated shades remain possible and every fruit keeps a positive chance.
 */
export function chooseColourfulRound(random:()=>number,history:FruitHistory,previous:readonly number[]=history.previous){
  const base=lineupWeights(history),lineup:number[]=Array(FRUIT_LEVELS.length).fill(-1);
  const order=FRUIT_LEVELS.map((_,level)=>level);
  // No fixed level gets first claim on a colour in every round.
  for(let i=order.length-1;i>0;i--){const j=Math.floor(randomFraction(random)*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for(const level of order){
    const candidates=FRUIT_LEVELS[level].filter(id=>id!==previous[level]);
    const weights=candidates.map(id=>{
      const crowding=lineup.reduce((sum,other,otherLevel)=>other<0?sum:sum+colourSimilarity(id,other)**2*(Math.abs(level-otherLevel)===1?1.5:1),0);
      // Bound the colour bias so selection history can keep all varieties in rotation.
      return base[id]*Math.max(.025,Math.exp(-2.6*crowding));
    });
    let target=randomFraction(random)*weights.reduce((sum,weight)=>sum+weight,0);
    lineup[level]=candidates.at(-1)!;
    for(let i=0;i<candidates.length;i++){target-=weights[i];if(target<0){lineup[level]=candidates[i];break;}}
  }
  for(const id of lineup)history.selected[id]=Math.min(MAX_COUNT,history.selected[id]+1);
  for(const ids of FRUIT_LEVELS){const minimum=Math.min(...ids.map(id=>history.selected[id]));if(minimum>1000)for(const id of ids)history.selected[id]-=minimum;}
  history.previous=[...lineup];
  return {lineup};
}
