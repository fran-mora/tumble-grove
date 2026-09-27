export type FruitPower = 'gather' | 'ripen' | 'juice' | 'wild' | 'rescue' | 'shake' | 'squeeze';
export type PowerCharge = {id:number;type:FruitPower;level:number};
export const POWER_TYPES: FruitPower[] = ['gather','ripen','juice','wild','rescue','shake','squeeze'];
export const POWER_DETAILS: Record<FruitPower, {name:string;description:string;color:string;target:'area'|'fruit'|'pair'|'none'}> = {
  gather: {name:'Gather',description:'Pull two selected matching fruit together. Other fruit can block their path.',color:'#bd83df',target:'pair'},
  ripen: {name:'Ripen',description:'Grow one eligible fruit by one level.',color:'#eab64c',target:'fruit'},
  juice: {name:'Juice',description:'Turn one eligible fruit into a splash of juice.',color:'#ef7c75',target:'fruit'},
  wild: {name:'Wild',description:'Drop a wild seed that merges with an eligible fruit.',color:'#90bdf4',target:'none'},
  rescue: {name:'Rescue',description:'Save one eligible fruit to drop again later.',color:'#61bfba',target:'fruit'},
  shake: {name:'Shake',description:'Give nearby fruit a gentle sideways wobble.',color:'#edaa6a',target:'area'},
  squeeze: {name:'Squeeze',description:'Shrink nearby fruit until they next merge.',color:'#b7c969',target:'area'},
};
export function powerStrength(chargeLevel:number) {
  const level=Math.max(1,Math.min(5,Number.isFinite(chargeLevel)?Math.floor(chargeLevel):1));
  return {
    radius:80+level*23,
    duration:1.4+level*.16,
    acceleration:65+level*14,
    maxKind:[2,4,6,8,9][level-1],
    scale:[.75,.725,.7,.675,.65][level-1],
    gatherReach:220+level*45,
    gatherDuration:3.2+level*.35,
    gatherAcceleration:280+level*65,
    gatherSpeed:140+level*18,
  };
}
