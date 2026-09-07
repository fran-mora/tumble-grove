import { FRUIT_SHAPES } from './fruit-shapes.ts';
import { COLLECTION_SHAPES } from './collection-shapes.ts';
export type FruitGeometry = {crop:readonly number[];center:readonly number[];radius:number;hull:readonly (readonly number[])[]};
export type FruitAppearance = {id:number;level:number;name:string;emoji:string;sheet:string;geometry:FruitGeometry};
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
export const FRUIT_COLLECTION:FruitAppearance[]=names.flatMap((choices,level)=>choices.map((name,choice)=>{
  const geometry=choice===0?FRUIT_SHAPES[level]:COLLECTION_SHAPES[level*9+choice-1];
  return {id:level*10+choice,level,name,emoji:emoji[level],sheet:choice===0?'fruits.png':COLLECTION_SHAPES[level*9+choice-1].sheet,geometry};
}));
/** Choose once per level; restarting changes each level's previous character. */
export function chooseFruitLineup(random:()=>number,previous?:readonly number[]):number[]{
  return names.map((_,level)=>{
    const value=random(),fraction=Number.isFinite(value)?Math.max(0,Math.min(1-Number.EPSILON,value)):0;
    const old=previous?.[level];let choice=Math.floor(fraction*(old===undefined?10:9));
    if(old!==undefined&&choice>=old%10)choice++;
    return level*10+choice;
  });
}
