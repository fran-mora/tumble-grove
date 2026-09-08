import { FRUIT_SHAPES } from './fruit-shapes.ts';
import { COLLECTION_SHAPES } from './collection-shapes.ts';
import { FRUIT_SIZE_GRAMS } from './fruit-sizes.ts';
export type FruitGeometry = {crop:readonly number[];center:readonly number[];radius:number;hull:readonly (readonly number[])[]};
export type FruitAppearance = {id:number;level:number;name:string;emoji:string;sheet:string;geometry:FruitGeometry;typicalMassG:number};
const names = [
  ['Cherry','Blueberry','Cranberry','Redcurrant','Blackcurrant','Gooseberry','Bilberry','Acerola','Chokeberry','Coffee cherry'],
  ['Strawberry','Raspberry','Blackberry','Cloudberry','Salmonberry','Mulberry','Huckleberry','Loganberry','Boysenberry','Pineberry'],
  ['Grapes','Lychee','Longan','Rambutan','Mangosteen','Passionfruit','Jabuticaba','Salak','Langsat','Kumquat'],
  ['Mandarin','Lime','Lemon','Clementine','Tangerine','Calamansi','Yuzu','Blood orange','Bergamot','Key lime'],
  ['Persimmon','Apricot','Plum','Damson','Greengage','Mirabelle','Jujube','Loquat','Medlar','Feijoa'],
  ['Apple','Green apple','Golden apple','Pomegranate','Quince','Guava','Rose apple','Star apple','Wax apple','Crabapple'],
  ['Pear','Asian pear','Avocado','Fig','Kiwifruit','Golden kiwi','Cactus pear','Pepino','Cherimoya','Custard apple'],
  ['Peach','Nectarine','Mango','Dragonfruit','Papaya','Starfruit','Tamarillo','Soursop','Pawpaw','Sapodilla'],
  ['Pineapple','Coconut','Durian','Jackfruit','Breadfruit','Cacao','Pomelo','Citron','Ugli fruit','Red pineapple'],
  ['Melon','Honeydew','Galia melon','Canary melon','Piel de Sapo','Crenshaw melon','Casaba melon','Hami melon','Korean melon','Snow Leopard melon'],
  ['Watermelon','Yellow watermelon','Sugar Baby watermelon','Pale striped watermelon','Orange watermelon','Winter melon','Pumpkin','Kabocha','Butternut','Acorn squash'],
];
const emoji=['🍒','🍓','🍇','🍊','🟠','🍎','🍐','🍑','🍍','🍈','🍉'];
export const FRUITS_PER_LEVEL=10;
export const FRUIT_BODY_AREA=2.6;
/** Equal area per level; apply the same scale to artwork and collision silhouette. */
function normalizeGeometry(source:FruitGeometry):FruitGeometry {
  const area=Math.abs(source.hull.reduce((sum,[x,y],i)=>{
    const [nx,ny]=source.hull[(i+1)%source.hull.length];return sum+x*ny-y*nx;
  },0))/2;
  const scale=Math.sqrt(FRUIT_BODY_AREA/area);
  return {...source,radius:source.radius/scale,hull:source.hull.map(([x,y])=>[x*scale,y*scale])};
}
// IDs and sheet positions describe artwork identity, independently of growth level.
export const FRUIT_COLLECTION:FruitAppearance[]=names.flatMap((choices,row)=>choices.map((name,choice)=>{
  const geometry=normalizeGeometry(choice===0?FRUIT_SHAPES[row]:COLLECTION_SHAPES[row*9+choice-1]);
  return {id:row*10+choice,level:-1,name,emoji:emoji[row],sheet:choice===0?'fruits.png':COLLECTION_SHAPES[row*9+choice-1].sheet,geometry,typicalMassG:FRUIT_SIZE_GRAMS[name]};
}));
const ordered=[...FRUIT_COLLECTION].sort((a,b)=>a.typicalMassG-b.typicalMassG||a.id-b.id);
/** Equal-count size buckets: consecutive groups of ten, from lightest to heaviest. */
export const FRUIT_LEVELS:number[][]=Array.from({length:names.length},(_,level)=>
  ordered.slice(level*FRUITS_PER_LEVEL,(level+1)*FRUITS_PER_LEVEL).map(fruit=>{
    fruit.level=level;return fruit.id;
  })
);
export function randomFraction(random:()=>number):number {
  const value=random();return Number.isFinite(value)?Math.max(0,Math.min(1-Number.EPSILON,value)):0;
}
/** Choose once per level; restarting changes each level's previous character. */
export function chooseFruitLineup(random:()=>number,previous?:readonly number[],weights?:readonly number[]):number[]{
  return FRUIT_LEVELS.map((ids,level)=>{
    const candidates=ids.filter(id=>id!==previous?.[level]);
    const chances=candidates.map(id=>{const weight=weights?.[id];return weight!==undefined&&Number.isFinite(weight)&&weight>0?weight:1;});
    let target=randomFraction(random)*chances.reduce((sum,weight)=>sum+weight,0);
    for(let i=0;i<candidates.length;i++){target-=chances[i];if(target<0)return candidates[i];}
    return candidates[candidates.length-1];
  });
}
