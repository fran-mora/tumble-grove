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
type MovingBody = Point & {vx:number;vy:number};
function removeOutwardVelocity(body:MovingBody,nx:number,ny:number,bounce:boolean){
  const outward=body.vx*nx+body.vy*ny;
  if(outward>0){const impulse=outward*(bounce&&outward>65?1.12:1);body.vx-=nx*impulse;body.vy-=ny*impulse;}
}
/** One-sided interior contacts cannot resolve through the back of a thin wall.
 * The start-of-step reference leaves fruit that went over the open rim free to spill.
 */
export function containInBasket(body:MovingBody,shape:Hull,reference:Point,width:number,height:number,bounce=true):void {
  if(reference.x<0||reference.x>width||reference.y>height)return;
  if(body.y+shape.maxY>height){body.y=height-shape.maxY-.005;removeOutwardVelocity(body,0,1,bounce);}
  // Near the rim, finite polygon contacts still let a fruit roll over either lip.
  if(body.y+shape.minY<RIM_Y)return;
  if(body.x+shape.minX<0){body.x=-shape.minX+.005;removeOutwardVelocity(body,-1,0,bounce);}
  if(body.x+shape.maxX>width){body.x=width-shape.maxX-.005;removeOutwardVelocity(body,1,0,bounce);}
}
/** Keep the closed arc solid, including deep merge overlaps, but leave the mouth open. */
export function containInBowl(body:MovingBody,shape:Hull,reference:Point,center:Point,radius:number,down:Point,bounce=true):void {
  if(Math.hypot(reference.x-center.x,reference.y-center.y)>radius)return;
  const mouthCos=Math.cos(MOUTH_HALF_ANGLE);
  for(let iteration=0;iteration<24;iteration++){
    let farthest=radius,nx=0,ny=0;
    for(const p of shape.points){
      const x=body.x+p.x-center.x,y=body.y+p.y-center.y,distance=Math.hypot(x,y);
      if(distance<=farthest||-(x*down.x+y*down.y)>=distance*mouthCos)continue;
      farthest=distance;nx=x/distance;ny=y/distance;
    }
    if(farthest<=radius+1e-5)return;
    body.x-=nx*(farthest-radius+.005);body.y-=ny*(farthest-radius+.005);
    removeOutwardVelocity(body,nx,ny,bounce);
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
