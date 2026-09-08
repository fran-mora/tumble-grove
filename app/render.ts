import { FRUIT_COLLECTION, type FruitAppearance } from './fruit-collection.ts';
import { RIM_Y, VIEW_PADDING, MOUTH_HALF_ANGLE } from './arena.ts';
import { DANGER_Y, FRUITS, HEIGHT, WIDTH, CIRCLE, CIRCLE_DANGER, MERGE_LABEL_SECONDS, MergeGame } from './engine.ts';
import { FRUIT_SHAPES } from './fruit-shapes.ts';
import { landingY, directionalLanding } from './collision.ts';
const BOARD_COLOURS = {
  light: {surface:'#fffdf1',rim:'#b7c99f',stackGuide:'#dcc2a1',stackText:'#978367',aim:'#a8bf8f',landing:'#bbc79c44',label:'#fffdf1f5',labelBorder:'#d6dfc4',labelText:'#356645',discoveryBorder:'#85a576',discoveryText:'#28583b',highlight:'#397447'},
  dark: {surface:'#1b2d24',rim:'#82a77b',stackGuide:'#9f8969',stackText:'#c2ae90',aim:'#8bb880',landing:'#a5ca8944',label:'#253e31f5',labelBorder:'#688962',labelText:'#e1efd3',discoveryBorder:'#91bd83',discoveryText:'#edfadf',highlight:'#b4df93'},
};
type BoardColours = typeof BOARD_COLOURS.light;
export async function loadSprites(): Promise<HTMLCanvasElement[]> {
  const sheets=new Map<string,HTMLImageElement>();
  await Promise.all(['fruits.png','fruit-collection-a.png','fruit-collection-b.png'].map(async file=>{const image=new Image();image.src=new URL(file,document.baseURI).href;await image.decode();sheets.set(file,image);}));
  return FRUIT_COLLECTION.map(({sheet,geometry:{crop:[x,y,w,h]}}) => {
    const image=sheets.get(sheet)!;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image,x,y,w,h,0,0,w,h);
    const pixels = ctx.getImageData(0,0,w,h);
    // Remove neutral white sheet background; preserve saturated fruit and leaves.
    for(let i=0;i<pixels.data.length;i+=4){
      const lo=Math.min(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);
      const hi=Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);
      if(lo>210 && hi-lo<27) pixels.data[i+3]*=Math.max(0,Math.min(1,(237-lo)/27));
    }
    ctx.putImageData(pixels,0,0); return canvas;
  });
}
export function drawFruit(ctx:CanvasRenderingContext2D,sprites:HTMLCanvasElement[],kind:number,x:number,y:number,r:number,angle=0,opacity=1,appearance?:FruitAppearance){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=opacity;
  const sprite=sprites[appearance?.id??kind];
  if(sprite){
    const shape=appearance?.geometry??FRUIT_SHAPES[kind],scale=r/shape.radius;
    ctx.drawImage(sprite,-shape.center[0]*scale,-shape.center[1]*scale,sprite.width*scale,sprite.height*scale);
  }
  else{ctx.font=`${r*1.7}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(appearance?.emoji??FRUITS[kind].emoji,0,0);}
  ctx.restore();
}
function drawDropName(ctx:CanvasRenderingContext2D,game:MergeGame,colours:BoardColours){
  const fruit=game.getFruit(game.current),spawn=game.getSpawn();
  const geometry=fruit.geometry,fruitScale=FRUITS[game.current].radius/geometry.radius;
  // Keep the name readable when the arena shrinks to fit a phone's viewport.
  const unit=Math.max(1,(WIDTH+2*VIEW_PADDING)/(ctx.canvas.clientWidth||WIDTH+2*VIEW_PADDING));
  const fontSize=Math.max(14,12*unit),padding=8*unit,gap=7*unit;
  const minX=-VIEW_PADDING+padding,maxX=WIDTH+VIEW_PADDING-padding;
  const minY=-VIEW_PADDING+padding,maxY=game.height+VIEW_PADDING-padding;
  ctx.save();ctx.font=`bold ${fontSize}px Trebuchet MS, sans-serif`;
  const width=ctx.measureText(fruit.name).width+padding*2,height=fontSize+10*unit;
  // Use the complete sprite bounds so the label also clears leaves and stems.
  const left=spawn.x-geometry.center[0]*fruitScale,right=left+geometry.crop[2]*fruitScale;
  const top=spawn.y-geometry.center[1]*fruitScale,bottom=top+geometry.crop[3]*fruitScale;
  const horizontal=[{x:right+gap,y:spawn.y-height/2},{x:left-gap-width,y:spawn.y-height/2}];
  const vertical=[{x:spawn.x-width/2,y:top-gap-height},{x:spawn.x-width/2,y:bottom+gap}];
  // Prefer a position beside the drop guide; the text always stays upright.
  const positions=Math.abs(game.down.y)>=Math.abs(game.down.x)?[...horizontal,...vertical]:[...vertical,...horizontal];
  const position=positions.find(p=>p.x>=minX&&p.x+width<=maxX&&p.y>=minY&&p.y+height<=maxY)??positions[0];
  const x=Math.max(minX,Math.min(maxX-width,position.x)),y=Math.max(minY,Math.min(maxY-height,position.y));
  ctx.fillStyle=colours.label;ctx.strokeStyle=colours.labelBorder;ctx.lineWidth=unit;
  ctx.beginPath();ctx.roundRect(x,y,width,height,height/2);ctx.fill();ctx.stroke();
  ctx.fillStyle=colours.labelText;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(fruit.name,x+width/2,y+height/2);
  ctx.restore();
}
type LabelBox = {x:number;y:number;width:number;height:number};
function drawBodyName(ctx:CanvasRenderingContext2D,game:MergeGame,kind:number,x:number,y:number,angle=0,occupied:LabelBox[]=[],colours:BoardColours=BOARD_COLOURS.light) {
  const fruit=game.getFruit(kind),geometry=fruit.geometry,scale=FRUITS[kind].radius/geometry.radius;
  const unit=Math.max(1,(WIDTH+2*VIEW_PADDING)/(ctx.canvas.clientWidth||WIDTH+2*VIEW_PADDING));
  const padding=8*unit,gap=8*unit,fontSize=Math.max(14,12*unit),height=fontSize+10*unit;
  const minX=-VIEW_PADDING+padding,maxX=WIDTH+VIEW_PADDING-padding;
  const minY=-VIEW_PADDING+padding,maxY=game.height+VIEW_PADDING-padding;
  ctx.save();ctx.font=`bold ${fontSize}px Trebuchet MS, sans-serif`;
  const width=Math.min(ctx.measureText(fruit.name).width+padding*2,maxX-minX);
  // Account for rotated leaves and stems while keeping the text itself upright.
  const corners=[[0,0],[geometry.crop[2],0],[geometry.crop[2],geometry.crop[3]],[0,geometry.crop[3]]].map(([cx,cy])=>{
    const dx=(cx-geometry.center[0])*scale,dy=(cy-geometry.center[1])*scale;
    return {x:x+dx*Math.cos(angle)-dy*Math.sin(angle),y:y+dx*Math.sin(angle)+dy*Math.cos(angle)};
  });
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x));
  const top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  const candidates=[{x:x-width/2,y:top-gap-height},{x:right+gap,y:y-height/2},{x:left-gap-width,y:y-height/2},{x:x-width/2,y:bottom+gap}]
    .map(p=>({x:Math.max(minX,Math.min(maxX-width,p.x)),y:Math.max(minY,Math.min(maxY-height,p.y)),width,height}));
  const box=candidates.find(p=>occupied.every(o=>p.x+p.width+gap<=o.x||p.x>=o.x+o.width+gap||p.y+p.height+gap<=o.y||p.y>=o.y+o.height+gap));
  if(!box){ctx.restore();return;}
  occupied.push(box);
  ctx.fillStyle=colours.label;ctx.strokeStyle=colours.discoveryBorder;ctx.lineWidth=unit;
  ctx.beginPath();ctx.roundRect(box.x,box.y,width,height,height/2);ctx.fill();ctx.stroke();
  ctx.fillStyle=colours.discoveryText;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(fruit.name,box.x+width/2,box.y+height/2,width-padding*2);
  ctx.restore();
}
export function renderGame(ctx:CanvasRenderingContext2D,game:MergeGame,sprites:HTMLCanvasElement[],reducedMotion:boolean,darkMode=false){
  const colours=darkMode?BOARD_COLOURS.dark:BOARD_COLOURS.light;
  const scale=ctx.canvas.width/(WIDTH+2*VIEW_PADDING),sy=ctx.canvas.height/(game.height+2*VIEW_PADDING);
  ctx.setTransform(scale,0,0,sy,VIEW_PADDING*scale,VIEW_PADDING*sy);ctx.clearRect(-VIEW_PADDING,-VIEW_PADDING,WIDTH+2*VIEW_PADDING,game.height+2*VIEW_PADDING);
  const circular=game.mode==='gravity',direction=game.down;
  ctx.save();ctx.fillStyle=colours.surface;ctx.beginPath();
  if(circular)ctx.arc(CIRCLE.x,CIRCLE.y,CIRCLE.radius,0,Math.PI*2);else ctx.rect(0,RIM_Y,WIDTH,HEIGHT-RIM_Y);
  ctx.fill();ctx.restore();
  ctx.save();ctx.strokeStyle=colours.rim;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  if(circular){const opening=Math.atan2(-direction.y,-direction.x);ctx.arc(CIRCLE.x,CIRCLE.y,CIRCLE.radius+2.5,opening+MOUTH_HALF_ANGLE,opening+Math.PI*2-MOUTH_HALF_ANGLE);}
  else{ctx.moveTo(-2.5,RIM_Y);ctx.lineTo(-2.5,HEIGHT+2.5);ctx.lineTo(WIDTH+2.5,HEIGHT+2.5);ctx.lineTo(WIDTH+2.5,RIM_Y);}
  ctx.stroke();ctx.restore();
  ctx.save();
  if(circular){ctx.translate(CIRCLE.x,CIRCLE.y);ctx.rotate(Math.atan2(-direction.x,direction.y));}
  const limitY=circular?CIRCLE_DANGER:DANGER_Y;
  const half=circular?Math.sqrt(CIRCLE.radius*CIRCLE.radius-limitY*limitY):0;
  const left=circular?-half:14,right=circular?half:WIDTH-14;
  ctx.setLineDash([6,6]);ctx.lineWidth=1;
  ctx.strokeStyle=colours.stackGuide;ctx.beginPath();ctx.moveTo(left,limitY);ctx.lineTo(right,limitY);ctx.stroke();
  ctx.fillStyle=colours.stackText;ctx.font='9px Trebuchet MS, sans-serif';ctx.textAlign=circular?'center':'right';
  ctx.fillText('STACK HIGH · DON’T SPILL',circular?0:WIDTH-15,limitY-11);
  ctx.restore();
  if(!game.over){
    const radius=FRUITS[game.current].radius,shape=game.getShape(game.current),spawn=game.getSpawn();
    const obstacles=game.bodies.map(b=>({x:b.x,y:b.y,shape:game.getShape(b.kind,b.angle)}));
    const target=circular?directionalLanding(spawn,shape,direction,obstacles,CIRCLE,CIRCLE.radius):{x:game.aim,y:landingY(game.aim,43,shape,obstacles,HEIGHT-.005)};
    const support=Math.max(...shape.points.map(p=>p.x*direction.x+p.y*direction.y));
    if(!game.paused){
      ctx.save();ctx.setLineDash([3,7]);ctx.strokeStyle=colours.aim;ctx.beginPath();ctx.moveTo(spawn.x+direction.x*support,spawn.y+direction.y*support);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
      if(circular){
        const tip={x:spawn.x+direction.x*(support+27),y:spawn.y+direction.y*(support+27)};
        ctx.beginPath();ctx.moveTo(tip.x-direction.x*7+direction.y*4,tip.y-direction.y*7-direction.x*4);ctx.lineTo(tip.x,tip.y);ctx.lineTo(tip.x-direction.x*7-direction.y*4,tip.y-direction.y*7+direction.x*4);ctx.stroke();
      }else{ctx.beginPath();ctx.ellipse(target.x,target.y+shape.maxY,radius*.65,3,0,0,Math.PI*2);ctx.fillStyle=colours.landing;ctx.fill();}
      ctx.restore();
    }
    drawFruit(ctx,sprites,game.current,spawn.x,spawn.y,radius,0,game.canDrop?1:.38,game.getFruit(game.current));
  }
  for(const b of game.bodies){
    // Never shrink the artwork away from its collider, including during merges.
    drawFruit(ctx,sprites,b.kind,b.x,b.y,FRUITS[b.kind].radius,b.angle,1,game.getFruit(b.kind));
  }
  if(!reducedMotion&&!game.inspecting)for(const e of game.events){
    const age=game.time-e.time;
    if(age>=1)continue;
    ctx.globalAlpha=Math.max(0,1-age);
    for(let i=0;i<10;i++){const angle=i*Math.PI*2/10;const distance=age*92;ctx.fillStyle=FRUITS[e.kind].color;ctx.beginPath();ctx.arc(e.x+Math.cos(angle)*distance,e.y+Math.sin(angle)*distance+age*age*35,Math.max(.1,3*(1-age)),0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=colours.labelText;ctx.font='bold 22px Trebuchet MS, sans-serif';ctx.textAlign='center';ctx.fillText(`+${e.points}`,e.x,e.y-age*65-15);ctx.globalAlpha=1;
  }
  if(game.inspecting){
    const body=game.bodies.find(b=>b.id===game.inspectedId);
    if(body){
      const shape=game.getShape(body.kind,body.angle);
      const unit=Math.max(1,(WIDTH+2*VIEW_PADDING)/(ctx.canvas.clientWidth||WIDTH+2*VIEW_PADDING));
      ctx.save();ctx.strokeStyle=colours.highlight;ctx.lineWidth=2.5*unit;ctx.lineJoin='round';ctx.beginPath();
      shape.points.forEach((p,i)=>{if(i===0)ctx.moveTo(body.x+p.x,body.y+p.y);else ctx.lineTo(body.x+p.x,body.y+p.y);});
      ctx.closePath();ctx.stroke();ctx.restore();
      drawBodyName(ctx,game,body.kind,body.x,body.y,body.angle,[],colours);
    }
  }else if(!game.over){
    const occupied:LabelBox[]=[];
    // Keep a busy chain reaction readable; the most recent discoveries take priority.
    for(const e of game.events.filter(e=>!e.cleared&&game.time-e.time<MERGE_LABEL_SECONDS).slice(-3).reverse()){
      const body=game.bodies.find(b=>b.id===e.bodyId),age=game.time-e.time;
      ctx.save();ctx.globalAlpha=reducedMotion?1:Math.min(1,(MERGE_LABEL_SECONDS-age)/.4);
      drawBodyName(ctx,game,e.kind,body?.x??e.x,body?.y??e.y,body?.angle??0,occupied,colours);
      ctx.restore();
    }
  }
  if(!game.over&&!game.paused)drawDropName(ctx,game,colours);
}
