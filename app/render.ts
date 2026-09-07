import { DANGER_Y, FRUITS, HEIGHT, WIDTH, MergeGame } from './engine.ts';
import { FRUIT_SHAPES } from './fruit-shapes.ts';
import { fruitHull, landingY } from './collision.ts';
export async function loadSprites(): Promise<HTMLCanvasElement[]> {
  const image = new Image(); image.src = '/fruits.png'; await image.decode();
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
  ctx.setTransform(scale,0,0,ctx.canvas.height/HEIGHT,0,0);ctx.clearRect(0,0,WIDTH,HEIGHT);
  ctx.save();ctx.setLineDash([6,6]);ctx.lineWidth=game.danger>.15?2:1;
  ctx.strokeStyle=game.danger>.15?'#d25b43':'#dcc2a1';ctx.beginPath();ctx.moveTo(14,DANGER_Y);ctx.lineTo(WIDTH-14,DANGER_Y);ctx.stroke();ctx.restore();
  ctx.fillStyle=game.danger>.15?'#b44832':'#978367';ctx.font='9px Trebuchet MS, sans-serif';ctx.textAlign='right';
  ctx.fillText(game.danger>.15?`MAKE SOME ROOM · ${Math.max(1,Math.ceil(2.5-game.danger))}`:'KEEP IT BELOW THE LINE',WIDTH-15,DANGER_Y-11);
  if(!game.over){
    const radius=FRUITS[game.current].radius;
    const shape=fruitHull(game.current,radius);
    const target=landingY(game.aim,43,shape,game.bodies.map(b=>({x:b.x,y:b.y,shape:fruitHull(b.kind,FRUITS[b.kind].radius,b.angle)})),HEIGHT-.5);
    if(!game.paused){ctx.save();ctx.setLineDash([3,7]);ctx.strokeStyle='#c4d2ac';ctx.beginPath();ctx.moveTo(game.aim,43+shape.maxY);ctx.lineTo(game.aim,target);ctx.stroke();ctx.restore();
      ctx.beginPath();ctx.ellipse(game.aim,target+shape.maxY,radius*.65,3,0,0,Math.PI*2);ctx.fillStyle='#bbc79c44';ctx.fill();}
    drawFruit(ctx,sprites,game.current,game.aim,43,radius,0,game.canDrop?1:.38);
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
