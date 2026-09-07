import { DANGER_Y, FRUITS, HEIGHT, WIDTH, CIRCLE, CIRCLE_DANGER, MergeGame } from './engine.ts';
import { FRUIT_SHAPES } from './fruit-shapes.ts';
import { fruitHull, landingY, directionalLanding } from './collision.ts';
export async function loadSprites(): Promise<HTMLCanvasElement[]> {
  const image = new Image(); image.src = new URL('fruits.png', document.baseURI).href; await image.decode();
  return FRUIT_SHAPES.map(({crop:[x,y,w,h]}) => {
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
export function drawFruit(ctx:CanvasRenderingContext2D,sprites:HTMLCanvasElement[],kind:number,x:number,y:number,r:number,angle=0,opacity=1){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=opacity;
  if(sprites[kind]){
    const sprite=sprites[kind],shape=FRUIT_SHAPES[kind],scale=r/shape.radius;
    ctx.drawImage(sprite,-shape.center[0]*scale,-shape.center[1]*scale,sprite.width*scale,sprite.height*scale);
  }
  else{ctx.font=`${r*1.7}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(FRUITS[kind].emoji,0,0);}
  ctx.restore();
}
export function renderGame(ctx:CanvasRenderingContext2D,game:MergeGame,sprites:HTMLCanvasElement[],reducedMotion:boolean){
  const scale=ctx.canvas.width/WIDTH;
  ctx.setTransform(scale,0,0,ctx.canvas.height/game.height,0,0);ctx.clearRect(0,0,WIDTH,game.height);
  const circular=game.mode==='gravity',direction=game.down;
  ctx.save();
  if(circular){ctx.translate(CIRCLE.x,CIRCLE.y);ctx.rotate(Math.atan2(-direction.x,direction.y));}
  const limitY=circular?CIRCLE_DANGER:DANGER_Y;
  const half=circular?Math.sqrt(CIRCLE.radius*CIRCLE.radius-limitY*limitY):0;
  const left=circular?-half:14,right=circular?half:WIDTH-14;
  ctx.setLineDash([6,6]);ctx.lineWidth=game.danger>.15?2:1;
  ctx.strokeStyle=game.danger>.15?'#d25b43':'#dcc2a1';ctx.beginPath();ctx.moveTo(left,limitY);ctx.lineTo(right,limitY);ctx.stroke();
  ctx.fillStyle=game.danger>.15?'#b44832':'#978367';ctx.font='9px Trebuchet MS, sans-serif';ctx.textAlign=circular?'center':'right';
  ctx.fillText(game.danger>.15?`MAKE SOME ROOM · ${Math.max(1,Math.ceil(2.5-game.danger))}`:circular?'LEAVE ROOM TO DROP':'KEEP IT BELOW THE LINE',circular?0:WIDTH-15,limitY-11);
  ctx.restore();
  if(!game.over){
    const radius=FRUITS[game.current].radius,shape=fruitHull(game.current,radius),spawn=game.getSpawn();
    const obstacles=game.bodies.map(b=>({x:b.x,y:b.y,shape:fruitHull(b.kind,FRUITS[b.kind].radius,b.angle)}));
    const target=circular?directionalLanding(spawn,shape,direction,obstacles,CIRCLE,CIRCLE.radius):{x:game.aim,y:landingY(game.aim,43,shape,obstacles,HEIGHT-.5)};
    const support=Math.max(...shape.points.map(p=>p.x*direction.x+p.y*direction.y));
    if(!game.paused){
      ctx.save();ctx.setLineDash([3,7]);ctx.strokeStyle='#a8bf8f';ctx.beginPath();ctx.moveTo(spawn.x+direction.x*support,spawn.y+direction.y*support);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
      if(circular){
        const tip={x:spawn.x+direction.x*(support+27),y:spawn.y+direction.y*(support+27)};
        ctx.beginPath();ctx.moveTo(tip.x-direction.x*7+direction.y*4,tip.y-direction.y*7-direction.x*4);ctx.lineTo(tip.x,tip.y);ctx.lineTo(tip.x-direction.x*7-direction.y*4,tip.y-direction.y*7+direction.x*4);ctx.stroke();
      }else{ctx.beginPath();ctx.ellipse(target.x,target.y+shape.maxY,radius*.65,3,0,0,Math.PI*2);ctx.fillStyle='#bbc79c44';ctx.fill();}
      ctx.restore();
    }
    drawFruit(ctx,sprites,game.current,spawn.x,spawn.y,radius,0,game.canDrop?1:.38);
  }
  for(const b of game.bodies){
    // Never shrink the artwork away from its collider, including during merges.
    drawFruit(ctx,sprites,b.kind,b.x,b.y,FRUITS[b.kind].radius,b.angle);
  }
  if(!reducedMotion)for(const e of game.events){
    const age=game.time-e.time;
    ctx.globalAlpha=Math.max(0,1-age);
    for(let i=0;i<10;i++){const angle=i*Math.PI*2/10;const distance=age*92;ctx.fillStyle=FRUITS[e.kind].color;ctx.beginPath();ctx.arc(e.x+Math.cos(angle)*distance,e.y+Math.sin(angle)*distance+age*age*35,Math.max(.1,3*(1-age)),0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#356645';ctx.font='bold 22px Trebuchet MS, sans-serif';ctx.textAlign='center';ctx.fillText(`+${e.points}`,e.x,e.y-age*65-15);ctx.globalAlpha=1;
  }
}
