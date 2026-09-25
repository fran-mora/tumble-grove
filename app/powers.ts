export type FruitPower = 'gather' | 'zest' | 'choose';
export const POWER_DETAILS: Record<FruitPower, {name:string;description:string;color:string}> = {
  gather: {name:'Gather',description:'Gently draws nearby matching pairs together.',color:'#bd83df'},
  zest: {name:'Zest',description:'Helps nearby fruit slide and settle for a moment.',color:'#eab64c'},
  choose: {name:'Choose',description:'Choose the fruit for your next drop.',color:'#50bcab'},
};

// Artwork IDs remain stable when fruit move between size levels. Soft berries,
// grapes and stone fruit gather; citrus, apples and melons loosen the pile;
// tropical and unusual fruit offer a new drop. These are playful associations.
const GATHER_IDS = new Set([
  ...Array.from({length:20},(_,id)=>id),20,26,
  41,42,43,44,45,48,63,70,71,79,
]);
const ZEST_IDS = new Set([
  29,...Array.from({length:10},(_,id)=>30+id),
  50,51,52,54,56,59,60,61,64,65,66,76,86,87,88,
  ...Array.from({length:20},(_,id)=>90+id),
]);
export function fruitPower(id:number):FruitPower {
  if(!Number.isInteger(id)||id<0||id>=110)throw new RangeError('Invalid fruit artwork ID');
  return GATHER_IDS.has(id)?'gather':ZEST_IDS.has(id)?'zest':'choose';
}

/** Result kind 1 is the first merge; 11 is the final pair clearing. */
export function powerStrength(resultKind:number) {
  const level=Math.max(1,Math.min(11,resultKind));
  return {
    radius:90+level*12,
    duration:1.25+level*.15,
    acceleration:65+level*7,
    choices:level>=9?4:level>=5?3:2,
    maxDropKind:level>=9?5:4,
  };
}
