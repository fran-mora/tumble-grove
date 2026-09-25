import { FRUIT_COLLECTION, type FruitAppearance } from './fruit-collection.ts';
import { RIM_Y, VIEW_PADDING, MOUTH_HALF_ANGLE } from './arena.ts';
import { DANGER_Y, FRUITS, HEIGHT, WIDTH, CIRCLE, CIRCLE_DANGER, MERGE_LABEL_SECONDS, MERGE_GATHER_SECONDS, type MergeEvent, MergeGame } from './engine.ts';
import { FRUIT_SHAPES } from './fruit-shapes.ts';
import { landingY, directionalLanding } from './collision.ts';
import { POWER_DETAILS, type FruitPower } from './powers.ts';
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
const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
const POWER_MARKS:Record<FruitPower,string>={gather:'◎',zest:'≈',choose:'✦'};
const powerLabel=(power:FruitPower)=>`${POWER_MARKS[power]} ${POWER_DETAILS[power].name}`;
function drawPowerEffects(ctx:CanvasRenderingContext2D,game:MergeGame,reducedMotion:boolean){
  if(!game.powersEnabled||game.inspecting)return;
  // Show the area the ability actually reaches, without obscuring a busy cascade.
  for(const effect of game.powerEffects.slice(-3)){
    const progress=clamp01((game.time-effect.time)/effect.duration);
    if(progress>=1)continue;
    const {x,y,radius,power}=effect;
    ctx.save();ctx.strokeStyle=POWER_DETAILS[power].color;ctx.fillStyle=POWER_DETAILS[power].color;
    ctx.lineWidth=1.8;ctx.globalAlpha=.32*(1-progress);
    if(reducedMotion){
      ctx.setLineDash(power==='gather'?[3,6]:power==='zest'?[10,5]:[2,8]);
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
    }else if(power==='gather'){
      ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const phase=(progress*1.6)%1,reach=radius*(1-.72*phase);
      ctx.globalAlpha=.38*(1-progress);ctx.beginPath();ctx.arc(x,y,reach,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3+effect.id*.37;
        ctx.beginPath();ctx.arc(x+Math.cos(angle)*reach,y+Math.sin(angle)*reach,2.5,0,Math.PI*2);ctx.fill();
      }
    }else if(power==='zest'){
      for(let i=0;i<2;i++){
        const phase=(progress*1.5+i*.5)%1;
        ctx.globalAlpha=.35*(1-progress)*(1-phase);
        ctx.beginPath();ctx.arc(x,y,radius*(.22+.78*phase),0,Math.PI*2);ctx.stroke();
      }
    }else{
      for(let i=0;i<5;i++){
        const angle=i*Math.PI*2/5+effect.id*.37,reach=radius*(.35+.5*progress);
        const px=x+Math.cos(angle)*reach,py=y+Math.sin(angle)*reach,size=3+2*Math.sin(progress*Math.PI);
        ctx.globalAlpha=.65*(1-progress);ctx.beginPath();
        ctx.moveTo(px,py-size);ctx.lineTo(px,py+size);ctx.moveTo(px-size,py);ctx.lineTo(px+size,py);ctx.stroke();
      }
    }
    ctx.restore();
  }
}
function mergePosition(game:MergeGame,event:MergeEvent){
  return game.bodies.find(body=>body.id===event.bodyId)??event;
}
function drawMergeGlow(ctx:CanvasRenderingContext2D,game:MergeGame,event:MergeEvent,reducedMotion:boolean,colours:BoardColours){
  const age=game.time-event.time,point=mergePosition(game,event),radius=FRUITS[event.kind].radius;
  if(age>=1.6)return;
  ctx.save();
  if(reducedMotion){
    ctx.globalAlpha=.5;ctx.strokeStyle=colours.highlight;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(point.x,point.y,radius+6,0,Math.PI*2);ctx.stroke();
  }else{
    const strength=Math.sin(Math.PI*clamp01(age/1.6)),reach=radius+20+Math.min(3,event.chain-1)*5;
    const glow=ctx.createRadialGradient(point.x,point.y,radius*.25,point.x,point.y,reach);
    glow.addColorStop(0,'#f5cb6a66');glow.addColorStop(.65,'#f5cb6a30');glow.addColorStop(1,'#f5cb6a00');
    ctx.globalAlpha=strength;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(point.x,point.y,reach,0,Math.PI*2);ctx.fill();
    const reveal=clamp01((age-MERGE_GATHER_SECONDS)/1.15);
    if(age>=MERGE_GATHER_SECONDS){
      ctx.globalAlpha=(1-reveal)*.8;ctx.strokeStyle=colours.highlight;ctx.lineWidth=2*(1-reveal)+.5;
      ctx.beginPath();ctx.arc(point.x,point.y,radius*(.65+.65*reveal)+8,0,Math.PI*2);ctx.stroke();
    }
  }
  ctx.restore();
}
function drawGatheringFruit(ctx:CanvasRenderingContext2D,game:MergeGame,event:MergeEvent,sprites:HTMLCanvasElement[]){
  const age=game.time-event.time,duration=MERGE_GATHER_SECONDS+.16;
  if(age>=duration)return;
  const point=mergePosition(game,event),progress=clamp01(age/duration),ease=progress*progress*(3-2*progress);
  for(const source of event.sources??[]){
    const x=source.x+(point.x-source.x)*ease,y=source.y+(point.y-source.y)*ease;
    drawFruit(ctx,sprites,source.kind,x,y,FRUITS[source.kind].radius*(1-.6*ease),source.angle*(1-ease),1-ease,game.getFruit(source.kind));
  }
}
function drawMergeSparkles(ctx:CanvasRenderingContext2D,game:MergeGame,event:MergeEvent,colours:BoardColours){
  const age=game.time-event.time-MERGE_GATHER_SECONDS;
  if(age<0||age>=1.35)return;
  const point=mergePosition(game,event),progress=age/1.35,radius=FRUITS[event.kind].radius;
  const count=10+Math.min(3,event.chain-1)*3;
  ctx.save();ctx.globalAlpha=Math.pow(1-progress,1.4);
  for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count+event.id*.61;
    const distance=radius*.55+(18+Math.min(3,event.chain-1)*6+radius*.4)*(1-Math.pow(1-progress,3));
    const x=point.x+Math.cos(angle)*distance,y=point.y+Math.sin(angle)*distance+progress*progress*14;
    const size=(i%3===0?4:2.4)*(1-progress*.6);
    ctx.fillStyle=i%3===0?colours.highlight:i%2?'#eab757':FRUITS[event.kind].color;
    ctx.beginPath();
    if(i%3===0){ctx.moveTo(x,y-size*1.5);ctx.quadraticCurveTo(x+size*.25,y-size*.25,x+size*1.5,y);ctx.quadraticCurveTo(x+size*.25,y+size*.25,x,y+size*1.5);ctx.quadraticCurveTo(x-size*.25,y+size*.25,x-size*1.5,y);ctx.quadraticCurveTo(x-size*.25,y-size*.25,x,y-size*1.5);}
    else ctx.arc(x,y,size,0,Math.PI*2);
    ctx.fill();
  }
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
  const nameWidth=ctx.measureText(fruit.name).width,detailSize=Math.max(12,11*unit);
  const subtitle=game.powersEnabled?powerLabel(game.getPower(game.current)):'';
  ctx.font=`bold ${detailSize}px Trebuchet MS, sans-serif`;
  const width=Math.min(Math.max(nameWidth,subtitle?ctx.measureText(subtitle).width:0)+padding*2,maxX-minX);
  const nameHeight=fontSize+10*unit,height=nameHeight+(subtitle?detailSize+4*unit:0);
  ctx.font=`bold ${fontSize}px Trebuchet MS, sans-serif`;
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
  ctx.beginPath();ctx.roundRect(x,y,width,height,subtitle?12*unit:height/2);ctx.fill();ctx.stroke();
  ctx.fillStyle=colours.labelText;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(fruit.name,x+width/2,y+nameHeight/2,width-padding*2);
  if(subtitle){
    ctx.font=`bold ${detailSize}px Trebuchet MS, sans-serif`;
    ctx.fillText(subtitle,x+width/2,y+nameHeight+detailSize/2-2*unit,width-padding*2);
  }
  ctx.restore();
}
type LabelBox = {x:number;y:number;width:number;height:number};
function drawBodyName(ctx:CanvasRenderingContext2D,game:MergeGame,kind:number,x:number,y:number,angle=0,occupied:LabelBox[]=[],colours:BoardColours=BOARD_COLOURS.light,subtitle='') {
  const fruit=game.getFruit(kind),geometry=fruit.geometry,scale=FRUITS[kind].radius/geometry.radius;
  const unit=Math.max(1,(WIDTH+2*VIEW_PADDING)/(ctx.canvas.clientWidth||WIDTH+2*VIEW_PADDING));
  const padding=8*unit,gap=8*unit,fontSize=Math.max(14,12*unit),height=fontSize+10*unit;
  const minX=-VIEW_PADDING+padding,maxX=WIDTH+VIEW_PADDING-padding;
  const minY=-VIEW_PADDING+padding,maxY=game.height+VIEW_PADDING-padding;
  ctx.save();ctx.font=`bold ${fontSize}px Trebuchet MS, sans-serif`;
  const nameWidth=ctx.measureText(fruit.name).width,detailSize=Math.max(12,11*unit);
  ctx.font=`bold ${detailSize}px Trebuchet MS, sans-serif`;
  const width=Math.min(Math.max(nameWidth,subtitle?ctx.measureText(subtitle).width:0)+padding*2,maxX-minX);
  const labelHeight=height+(subtitle?detailSize+5*unit:0);
  ctx.font=`bold ${fontSize}px Trebuchet MS, sans-serif`;
  // Account for rotated leaves and stems while keeping the text itself upright.
  const corners=[[0,0],[geometry.crop[2],0],[geometry.crop[2],geometry.crop[3]],[0,geometry.crop[3]]].map(([cx,cy])=>{
    const dx=(cx-geometry.center[0])*scale,dy=(cy-geometry.center[1])*scale;
    return {x:x+dx*Math.cos(angle)-dy*Math.sin(angle),y:y+dx*Math.sin(angle)+dy*Math.cos(angle)};
  });
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x));
  const top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  const candidates=[{x:x-width/2,y:top-gap-labelHeight},{x:right+gap,y:y-labelHeight/2},{x:left-gap-width,y:y-labelHeight/2},{x:x-width/2,y:bottom+gap}]
    .map(p=>({x:Math.max(minX,Math.min(maxX-width,p.x)),y:Math.max(minY,Math.min(maxY-labelHeight,p.y)),width,height:labelHeight}));
  const box=candidates.find(p=>occupied.every(o=>p.x+p.width+gap<=o.x||p.x>=o.x+o.width+gap||p.y+p.height+gap<=o.y||p.y>=o.y+o.height+gap));
  if(!box){ctx.restore();return;}
  occupied.push(box);
  ctx.fillStyle=colours.label;ctx.strokeStyle=colours.discoveryBorder;ctx.lineWidth=unit;
  ctx.beginPath();ctx.roundRect(box.x,box.y,width,labelHeight,subtitle?12*unit:height/2);ctx.fill();ctx.stroke();
  ctx.fillStyle=colours.discoveryText;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(fruit.name,box.x+width/2,box.y+height/2,width-padding*2);
  if(subtitle){
    ctx.font=`bold ${detailSize}px Trebuchet MS, sans-serif`;
    ctx.fillStyle=colours.labelText;
    ctx.fillText(subtitle,box.x+width/2,box.y+height+detailSize/2-2*unit,width-padding*2);
  }
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
  if(!game.inspecting)for(const event of game.events)drawMergeGlow(ctx,game,event,reducedMotion,colours);
  drawPowerEffects(ctx,game,reducedMotion);
  for(const b of game.bodies){
    // The new silhouette stays full-sized; only its reveal fades, never its collider.
    const opacity=reducedMotion||game.inspecting||!b.birth?1:clamp01((game.time-b.birth.time-.1)/.3);
    drawFruit(ctx,sprites,b.kind,b.x,b.y,FRUITS[b.kind].radius,b.angle,opacity,game.getFruit(b.kind));
  }
  if(!reducedMotion&&!game.inspecting)for(const event of game.events){
    drawGatheringFruit(ctx,game,event,sprites);
    drawMergeSparkles(ctx,game,event,colours);
  }
  if(game.inspecting){
    const body=game.bodies.find(b=>b.id===game.inspectedId);
    if(body){
      const shape=game.getShape(body.kind,body.angle);
      const unit=Math.max(1,(WIDTH+2*VIEW_PADDING)/(ctx.canvas.clientWidth||WIDTH+2*VIEW_PADDING));
      ctx.save();ctx.strokeStyle=colours.highlight;ctx.lineWidth=2.5*unit;ctx.lineJoin='round';ctx.beginPath();
      shape.points.forEach((p,i)=>{if(i===0)ctx.moveTo(body.x+p.x,body.y+p.y);else ctx.lineTo(body.x+p.x,body.y+p.y);});
      ctx.closePath();ctx.stroke();ctx.restore();
      drawBodyName(ctx,game,body.kind,body.x,body.y,body.angle,[],colours,game.powersEnabled?`${powerLabel(game.getPower(body.kind))} on merge`:'');
    }
  }else if(!game.over){
    const occupied:LabelBox[]=[];
    // Keep a busy chain reaction readable; the most recent discoveries take priority.
    for(const e of game.events.filter(e=>!e.cleared&&game.time-e.time>=MERGE_GATHER_SECONDS&&game.time-e.time<MERGE_LABEL_SECONDS&&game.bodies.some(b=>b.id===e.bodyId)).slice(-3).reverse()){
      const body=game.bodies.find(b=>b.id===e.bodyId),age=game.time-e.time;
      ctx.save();ctx.globalAlpha=reducedMotion?1:Math.min(1,(MERGE_LABEL_SECONDS-age)/.4);
      const achievement=`+${e.points}${e.chain>1?` · ${e.chain}-step cascade`:''}`;
      // The trigger belongs to the fruit that merged, not the newly discovered fruit.
      const detail=game.powersEnabled&&e.power?`+${e.points} · ${powerLabel(e.power)}${e.chain>1?` · ×${e.chain}`:''}`:achievement;
      drawBodyName(ctx,game,e.kind,body?.x??e.x,body?.y??e.y,body?.angle??0,occupied,colours,detail);
      ctx.restore();
    }
  }
  if(!game.over&&!game.paused)drawDropName(ctx,game,colours);
}
