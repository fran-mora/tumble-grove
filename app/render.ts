import { DANGER_Y, FRUITS, HEIGHT, WIDTH, MergeGame } from './engine';
// Crop coordinates for the original generated sprite sheet. The pineapple's leaves
// extend above its nominal grid cell, so each piece uses its actual artwork bounds.
const CROPS = [[34,40,308,309],[426,37,266,313],[771,33,286,320],[1120,34,304,323],[29,386,310,300],[406,363,299,326],[768,365,291,326],[1124,385,288,292],[36,684,290,350],[397,719,300,320],[755,689,308,354]];
export async function loadSprites(): Promise<HTMLCanvasElement[]> {
  const image = new Image(); image.src = '/fruits.png'; await image.decode();
  return CROPS.map(([x,y,w,h]) => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const scale = 246 / Math.max(w,h);
    ctx.drawImage(image,x,y,w,h,(256-w*scale)/2,(256-h*scale)/2,w*scale,h*scale);
    const pixels = ctx.getImageData(0,0,256,256);
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
  if(sprites[kind])ctx.drawImage(sprites[kind],-r*1.06,-r*1.06,r*2.12,r*2.12);
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
    let target=HEIGHT-radius-3;
    for(const b of game.bodies){const sum=radius+FRUITS[b.kind].radius,dx=game.aim-b.x;if(Math.abs(dx)<sum){const y=b.y-Math.sqrt(sum*sum-dx*dx);if(y>=43)target=Math.min(target,y);}}
    if(!game.paused){ctx.save();ctx.setLineDash([3,7]);ctx.strokeStyle='#c4d2ac';ctx.beginPath();ctx.moveTo(game.aim,43+radius);ctx.lineTo(game.aim,target);ctx.stroke();ctx.restore();
      ctx.beginPath();ctx.ellipse(game.aim,target+radius,radius*.65,3,0,0,Math.PI*2);ctx.fillStyle='#bbc79c44';ctx.fill();}
    drawFruit(ctx,sprites,game.current,game.aim,43,radius,0,game.canDrop?1:.38);
  }
  for(const b of game.bodies){
    const pop=reducedMotion?1:Math.min(1,b.age*9+.68);
    drawFruit(ctx,sprites,b.kind,b.x,b.y,FRUITS[b.kind].radius*pop,b.angle);
  }
  if(!reducedMotion)for(const e of game.events){
    const age=game.time-e.time;
    ctx.globalAlpha=Math.max(0,1-age);
    for(let i=0;i<10;i++){const angle=i*Math.PI*2/10;const distance=age*92;ctx.fillStyle=FRUITS[e.kind].color;ctx.beginPath();ctx.arc(e.x+Math.cos(angle)*distance,e.y+Math.sin(angle)*distance+age*age*35,Math.max(.1,3*(1-age)),0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#356645';ctx.font='bold 22px Trebuchet MS, sans-serif';ctx.textAlign='center';ctx.fillText(`+${e.points}`,e.x,e.y-age*65-15);ctx.globalAlpha=1;
  }
}
