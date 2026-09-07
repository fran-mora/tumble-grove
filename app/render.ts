import { FRUIT_COLLECTION, type FruitAppearance } from './fruit-collection.ts';
import { RIM_Y, VIEW_PADDING, MOUTH_HALF_ANGLE } from './arena.ts';
import { DANGER_Y, FRUITS, HEIGHT, WIDTH, CIRCLE, CIRCLE_DANGER, MergeGame } from './engine.ts';
import { FRUIT_SHAPES } from './fruit-shapes.ts';
import { landingY, directionalLanding } from './collision.ts';
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
  else{ctx.font=`${r*1.7}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(FRUITS[kind].emoji,0,0);}
  ctx.restore();
}
export function renderGame(ctx:CanvasRenderingContext2D,game:MergeGame,sprites:HTMLCanvasElement[],reducedMotion:boolean){
  const scale=ctx.canvas.width/(WIDTH+2*VIEW_PADDING),sy=ctx.canvas.height/(game.height+2*VIEW_PADDING);
  ctx.setTransform(scale,0,0,sy,VIEW_PADDING*scale,VIEW_PADDING*sy);ctx.clearRect(-VIEW_PADDING,-VIEW_PADDING,WIDTH+2*VIEW_PADDING,game.height+2*VIEW_PADDING);
  const circular=game.mode==='gravity',direction=game.down;
  ctx.save();ctx.fillStyle='#fffdf1';ctx.beginPath();
  if(circular)ctx.arc(CIRCLE.x,CIRCLE.y,CIRCLE.radius,0,Math.PI*2);else ctx.rect(0,RIM_Y,WIDTH,HEIGHT-RIM_Y);
  ctx.fill();ctx.restore();
  ctx.save();ctx.strokeStyle='#b7c99f';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  if(circular){const opening=Math.atan2(-direction.y,-direction.x);ctx.arc(CIRCLE.x,CIRCLE.y,CIRCLE.radius+2.5,opening+MOUTH_HALF_ANGLE,opening+Math.PI*2-MOUTH_HALF_ANGLE);}
  else{ctx.moveTo(-2.5,RIM_Y);ctx.lineTo(-2.5,HEIGHT+2.5);ctx.lineTo(WIDTH+2.5,HEIGHT+2.5);ctx.lineTo(WIDTH+2.5,RIM_Y);}
  ctx.stroke();ctx.restore();
  ctx.save();
  if(circular){ctx.translate(CIRCLE.x,CIRCLE.y);ctx.rotate(Math.atan2(-direction.x,direction.y));}
  const limitY=circular?CIRCLE_DANGER:DANGER_Y;
  const half=circular?Math.sqrt(CIRCLE.radius*CIRCLE.radius-limitY*limitY):0;
  const left=circular?-half:14,right=circular?half:WIDTH-14;
  ctx.setLineDash([6,6]);ctx.lineWidth=1;
  ctx.strokeStyle='#dcc2a1';ctx.beginPath();ctx.moveTo(left,limitY);ctx.lineTo(right,limitY);ctx.stroke();
  ctx.fillStyle='#978367';ctx.font='9px Trebuchet MS, sans-serif';ctx.textAlign=circular?'center':'right';
  ctx.fillText('STACK HIGH · DON’T SPILL',circular?0:WIDTH-15,limitY-11);
  ctx.restore();
  if(!game.over){
    const radius=FRUITS[game.current].radius,shape=game.getShape(game.current),spawn=game.getSpawn();
    const obstacles=game.bodies.map(b=>({x:b.x,y:b.y,shape:game.getShape(b.kind,b.angle)}));
    const target=circular?directionalLanding(spawn,shape,direction,obstacles,CIRCLE,CIRCLE.radius):{x:game.aim,y:landingY(game.aim,43,shape,obstacles,HEIGHT-.005)};
    const support=Math.max(...shape.points.map(p=>p.x*direction.x+p.y*direction.y));
    if(!game.paused){
      ctx.save();ctx.setLineDash([3,7]);ctx.strokeStyle='#a8bf8f';ctx.beginPath();ctx.moveTo(spawn.x+direction.x*support,spawn.y+direction.y*support);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
      if(circular){
        const tip={x:spawn.x+direction.x*(support+27),y:spawn.y+direction.y*(support+27)};
        ctx.beginPath();ctx.moveTo(tip.x-direction.x*7+direction.y*4,tip.y-direction.y*7-direction.x*4);ctx.lineTo(tip.x,tip.y);ctx.lineTo(tip.x-direction.x*7-direction.y*4,tip.y-direction.y*7+direction.x*4);ctx.stroke();
      }else{ctx.beginPath();ctx.ellipse(target.x,target.y+shape.maxY,radius*.65,3,0,0,Math.PI*2);ctx.fillStyle='#bbc79c44';ctx.fill();}
      ctx.restore();
    }
    drawFruit(ctx,sprites,game.current,spawn.x,spawn.y,radius,0,game.canDrop?1:.38,game.getFruit(game.current));
  }
  for(const b of game.bodies){
    // Never shrink the artwork away from its collider, including during merges.
    drawFruit(ctx,sprites,b.kind,b.x,b.y,FRUITS[b.kind].radius,b.angle,1,game.getFruit(b.kind));
  }
  if(!reducedMotion)for(const e of game.events){
    const age=game.time-e.time;
    ctx.globalAlpha=Math.max(0,1-age);
    for(let i=0;i<10;i++){const angle=i*Math.PI*2/10;const distance=age*92;ctx.fillStyle=FRUITS[e.kind].color;ctx.beginPath();ctx.arc(e.x+Math.cos(angle)*distance,e.y+Math.sin(angle)*distance+age*age*35,Math.max(.1,3*(1-age)),0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#356645';ctx.font='bold 22px Trebuchet MS, sans-serif';ctx.textAlign='center';ctx.fillText(`+${e.points}`,e.x,e.y-age*65-15);ctx.globalAlpha=1;
  }
}
