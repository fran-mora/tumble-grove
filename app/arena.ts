import type { Hull, Point } from './collision.ts';
import { hullContact } from './collision.ts';
export const RIM_Y = 55;
export const VIEW_PADDING = 32;
export const MOUTH_HALF_ANGLE = Math.PI * .20;
export type Wall = {x:number;y:number;shape:Hull};
function polygon(points:Point[]):Hull {
  const axes=points.map((p,i)=>{const q=points[(i+1)%points.length],x=q.x-p.x,y=q.y-p.y,length=Math.hypot(x,y);return {x:-y/length,y:x/length};});
  return {points,axes,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
function rectangle(x:number,y:number,width:number,height:number):Wall {return {x,y,shape:polygon([{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}])};}
export function basketWalls(width:number,height:number):Wall[]{
  return [rectangle(-5,RIM_Y,5,height-RIM_Y+5),rectangle(width,RIM_Y,5,height-RIM_Y+5),rectangle(-5,height,width+10,5)];
}
export function bowlWalls(center:Point,radius:number,down:Point):Wall[]{
  const start=Math.atan2(-down.y,-down.x)+MOUTH_HALF_ANGLE,span=2*Math.PI-2*MOUTH_HALF_ANGLE,count=56;
  return Array.from({length:count},(_,i)=>{
    const a=start+span*i/count,b=start+span*(i+1)/count;
    return {x:center.x,y:center.y,shape:polygon([{x:Math.cos(a)*radius,y:Math.sin(a)*radius},{x:Math.cos(b)*radius,y:Math.sin(b)*radius},{x:Math.cos(b)*(radius+5),y:Math.sin(b)*(radius+5)},{x:Math.cos(a)*(radius+5),y:Math.sin(a)*(radius+5)}])};
  });
}
export function collideWithWalls(body:Point&{vx:number;vy:number},shape:Hull,walls:Wall[]):void {
  for(const wall of walls){
    const contact=hullContact(body,shape,wall,wall.shape);if(!contact)continue;
    const {nx,ny,depth}=contact;body.x-=nx*(depth+.005);body.y-=ny*(depth+.005);
    const inward=body.vx*nx+body.vy*ny;
    if(inward>0){const bounce=inward>65?1.12:1;body.vx-=nx*inward*bounce;body.vy-=ny*inward*bounce;const tangent=body.vx*-ny+body.vy*nx;body.vx+=ny*tangent*.015;body.vy-=nx*tangent*.015;}
  }
}
export function outsideBasket(body:Point,shape:Hull,width:number,height:number):boolean {
  const beyondSide=body.x+shape.maxX < -8 || body.x+shape.minX > width+8;
  return (beyondSide&&body.y+shape.minY>RIM_Y) || body.y+shape.minY>height+10;
}
export function outsideBowl(body:Point,shape:Hull,center:Point,radius:number):boolean {
  const dx=body.x-center.x,dy=body.y-center.y,distance=Math.hypot(dx,dy);
  if(distance<=radius+8)return false;
  return shape.points.every(p=>distance+(p.x*dx+p.y*dy)/distance>radius+8);
}
