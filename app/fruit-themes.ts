import { FRUIT_COLLECTION, FRUIT_LEVELS, chooseFruitLineup, randomFraction } from './fruit-collection.ts';

export const ROUND_THEMES = [
  {id:'tropical',name:'Tropical Grove',description:'Tropical and subtropical favourites, with a few visiting fruits.',chance:.3},
  {id:'temperate',name:'Temperate Orchard',description:'Orchard, berry and summer-garden favourites, with a few visiting fruits.',chance:.3},
  {id:'mediterranean',name:'Mediterranean Market',description:'Sun-loving orchard and market favourites, with a few visiting fruits.',chance:.3},
  {id:'mixed',name:'Wild Mix',description:'A surprise harvest from across the whole collection.',chance:.1},
] as const;
export type RoundThemeId = typeof ROUND_THEMES[number]['id'];
export type RoundTheme = typeof ROUND_THEMES[number];

// Editorial growing/market associations, not native-origin or hardiness claims.
// Names refer to artwork identities, so changing a size bucket cannot change a tag.
// Rationale and primary-source references: docs/fruit-themes.md.
export const THEME_MEMBERS:Record<Exclude<RoundThemeId,'mixed'>,readonly string[]> = {
  tropical:[
    'Acerola','Coffee cherry','Lychee','Longan','Rambutan','Mangosteen','Passionfruit',
    'Jabuticaba','Salak','Langsat','Kumquat','Mandarin','Lime','Lemon','Clementine',
    'Tangerine','Calamansi','Key lime','Loquat','Feijoa','Guava','Rose apple',
    'Star apple','Wax apple','Avocado','Pepino','Cherimoya','Custard apple','Mango',
    'Dragonfruit','Papaya','Starfruit','Tamarillo','Soursop','Sapodilla','Pineapple',
    'Coconut','Durian','Jackfruit','Breadfruit','Cacao','Pomelo','Citron','Ugli fruit',
    'Red pineapple','Winter melon',
  ],
  temperate:[
    'Cherry','Blueberry','Cranberry','Redcurrant','Blackcurrant','Gooseberry','Bilberry',
    'Chokeberry','Strawberry','Raspberry','Blackberry','Cloudberry','Salmonberry',
    'Mulberry','Huckleberry','Loganberry','Boysenberry','Pineberry','Grapes',
    'Persimmon','Apricot','Plum','Damson','Greengage','Mirabelle','Jujube','Medlar',
    'Apple','Green apple','Golden apple','Quince','Crabapple','Pear','Asian pear',
    'Fig','Kiwifruit','Golden kiwi','Peach','Nectarine','Pawpaw',
    'Melon','Honeydew','Galia melon','Canary melon','Piel de Sapo','Crenshaw melon',
    'Casaba melon','Hami melon','Korean melon','Snow Leopard melon','Watermelon',
    'Yellow watermelon','Sugar Baby watermelon','Pale striped watermelon',
    'Orange watermelon','Pumpkin','Kabocha','Butternut','Acorn squash',
  ],
  mediterranean:[
    'Mulberry','Grapes','Strawberry','Kumquat','Mandarin','Lime','Lemon','Clementine',
    'Tangerine','Yuzu','Blood orange','Bergamot','Key lime','Persimmon','Apricot',
    'Plum','Greengage','Mirabelle','Jujube','Loquat','Medlar','Feijoa','Apple',
    'Green apple','Golden apple','Pomegranate','Quince','Pear','Asian pear',
    'Avocado','Fig','Kiwifruit','Golden kiwi','Cactus pear','Pepino','Cherimoya',
    'Peach','Nectarine','Citron','Pomelo',
    'Melon','Honeydew','Galia melon','Canary melon','Piel de Sapo','Crenshaw melon',
    'Casaba melon','Hami melon','Korean melon','Snow Leopard melon','Watermelon',
    'Yellow watermelon','Sugar Baby watermelon','Pale striped watermelon',
    'Orange watermelon','Pumpkin','Kabocha','Butternut','Acorn squash',
  ],
};
const affinities = FRUIT_COLLECTION.map(fruit=>new Set(
  Object.entries(THEME_MEMBERS).filter(([,names])=>names.includes(fruit.name)).map(([theme])=>theme)
));
export const matchesTheme=(id:number,theme:RoundThemeId)=>theme==='mixed'||!!affinities[id]?.has(theme);

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
export function chooseRoundTheme(random:()=>number):RoundTheme {
  const roll=randomFraction(random);let boundary=0;
  return ROUND_THEMES.find(theme=>{boundary+=theme.chance;return roll<boundary;})??ROUND_THEMES[3];
}
export function lineupWeights(theme:RoundThemeId,history:FruitHistory):number[] {
  const weights=FRUIT_COLLECTION.map(()=>1);
  for(const ids of FRUIT_LEVELS){
    const leastSelected=Math.min(...ids.map(id=>history.selected[id]));
    for(const id of ids){
      const themeBoost=matchesTheme(id,theme)&&theme!=='mixed'?5:1;
      const unseenBoost=history.seen[id]===0?1.4:1;
      const excess=history.selected[id]-leastSelected;
      weights[id]=themeBoost*unseenBoost/(1+excess)**2;
    }
  }
  return weights;
}
/** Theme choice is random; balancing affects fruit choices, never the theme roll. */
export function chooseThemedRound(random:()=>number,history:FruitHistory,previous:readonly number[]=history.previous){
  const theme=chooseRoundTheme(random);
  const lineup=chooseFruitLineup(random,previous,lineupWeights(theme.id,history));
  for(const id of lineup)history.selected[id]=Math.min(MAX_COUNT,history.selected[id]+1);
  // Rebase lifetime selection totals without losing within-level differences.
  for(const ids of FRUIT_LEVELS){const minimum=Math.min(...ids.map(id=>history.selected[id]));if(minimum>1000)for(const id of ids)history.selected[id]-=minimum;}
  history.previous=[...lineup];
  return {theme,lineup};
}
