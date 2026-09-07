import { FRUIT_SHAPES } from './fruit-shapes.ts';
export type Point = { x: number; y: number };
export type Hull = { points: Point[]; axes: Point[]; minX: number; maxX: number; minY: number; maxY: number };
export type Contact = { nx: number; ny: number; depth: number };

/** Offsets from the fruit body's center, shared by contact, walls and aim guide. */
export function fruitHull(kind: number, radius: number, angle = 0): Hull {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const points = FRUIT_SHAPES[kind].hull.map(([x,y]) => ({ x: (x*cos-y*sin)*radius, y: (x*sin+y*cos)*radius }));
  const axes = points.map((p,i) => {
    const q=points[(i+1)%points.length], dx=q.x-p.x, dy=q.y-p.y, length=Math.hypot(dx,dy);
    return {x:-dy/length,y:dx/length};
  });
  return {points,axes,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
function project(shape:Hull,axis:Point):[number,number] {
  let min=Infinity,max=-Infinity;
  for(const p of shape.points){const value=p.x*axis.x+p.y*axis.y;min=Math.min(min,value);max=Math.max(max,value);}
  return [min,max];
}
/** Convex silhouette contact. The normal points from A toward B. */
export function hullContact(a:Point,sa:Hull,b:Point,sb:Hull):Contact|null {
  const dx=b.x-a.x,dy=b.y-a.y;
  if(sa.maxX<=dx+sb.minX||dx+sb.maxX<=sa.minX||sa.maxY<=dy+sb.minY||dy+sb.maxY<=sa.minY)return null;
  let depth=Infinity,nx=0,ny=0;
  for(const shape of [sa,sb])for(const axis of shape.axes){
    const [aMin,aMax]=project(sa,axis),[bMin,bMax]=project(sb,axis),offset=dx*axis.x+dy*axis.y;
    const forward=aMax-bMin-offset,backward=bMax+offset-aMin;
    if(forward<=0||backward<=0)return null;
    // Also handles one small shape fully contained by a larger shape after merging.
    const overlap=Math.min(forward,backward);
    if(overlap<depth){depth=overlap;const sign=forward<backward?1:-1;nx=axis.x*sign;ny=axis.y*sign;}
  }
  return {nx,ny,depth};
}
/** Exact first contact while translating the current silhouette straight down. */
export function landingY(x:number,startY:number,shape:Hull,obstacles:{x:number;y:number;shape:Hull}[],floor:number):number {
  let landing=floor-shape.maxY;
  for(const obstacle of obstacles){
    const other=obstacle.shape,dx=obstacle.x-x;
    if(shape.maxX<dx+other.minX||dx+other.maxX<shape.minX)continue;
    let enter=-Infinity,exit=Infinity,possible=true;
    for(const candidate of [shape,other])for(const axis of candidate.axes){
      const [aMin,aMax]=project(shape,axis),[rawMin,rawMax]=project(other,axis);
      const offset=dx*axis.x+obstacle.y*axis.y,bMin=rawMin+offset,bMax=rawMax+offset;
      if(Math.abs(axis.y)<1e-8){if(aMax<bMin||aMin>bMax)possible=false;continue;}
      const t0=(bMin-aMax)/axis.y,t1=(bMax-aMin)/axis.y;
      enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));
    }
    if(possible&&enter<=exit&&exit>=startY)landing=Math.min(landing,Math.max(startY,enter));
  }
  return Math.max(startY,landing);
}
