import { fruitHull, hullContact, confineToCircle, circleTravel } from './collision.ts';
export const WIDTH = 440;
export const HEIGHT = 570;
export const DANGER_Y = 100;
export const STEP = 1 / 120;
export const CIRCLE = {x:WIDTH/2,y:WIDTH/2,radius:WIDTH/2-.5};
export const CIRCLE_DANGER = -CIRCLE.radius + 95;
export type GameMode = 'classic' | 'gravity';
export const FRUITS = [
  { name: 'Cherry', emoji: '🍒', radius: 18, color: '#e74753' },
  { name: 'Strawberry', emoji: '🍓', radius: 25, color: '#f66b59' },
  { name: 'Grapes', emoji: '🍇', radius: 31, color: '#ac77c8' },
  { name: 'Mandarin', emoji: '🍊', radius: 37, color: '#f7a52d' },
  { name: 'Persimmon', emoji: '🟠', radius: 43, color: '#f38e2c' },
  { name: 'Apple', emoji: '🍎', radius: 49, color: '#ec6a58' },
  { name: 'Pear', emoji: '🍐', radius: 57, color: '#b4c95b' },
  { name: 'Peach', emoji: '🍑', radius: 64, color: '#f7a2a0' },
  { name: 'Pineapple', emoji: '🍍', radius: 72, color: '#eaba36' },
  { name: 'Melon', emoji: '🍈', radius: 84, color: '#b8ce77' },
  { name: 'Watermelon', emoji: '🍉', radius: 96, color: '#4b9952' },
] as const;
export type FruitBody = { id: number; kind: number; x: number; y: number; vx: number; vy: number; angle: number; age: number };
export type MergeEvent = { x: number; y: number; kind: number; points: number; time: number; cleared: boolean };
export class MergeGame {
  bodies: FruitBody[] = [];
  events: MergeEvent[] = [];
  score = 0;
  drops = 0;
  merges = 0;
  highest = 0;
  current = 0;
  next = 0;
  aim = WIDTH / 2;
  time = 0;
  cooldown = 0;
  danger = 0;
  over = false;
  paused = false;
  watermelons = 0;
  mode: GameMode = 'classic';
  gravity = {x:0,y:1};
  private gravityTarget = {x:0,y:1};
  private gravityDirection = {x:0,y:1};
  private dangerDirection = {x:0,y:1};
  private tiltGrace = 0;
  private serial = 0;
  random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }
  get height() { return this.mode === 'gravity' ? WIDTH : HEIGHT; }
  get down() { return this.mode === 'gravity' ? this.gravityDirection : {x:0,y:1}; }
  setMode(mode: GameMode) {
    if (mode !== 'classic' && mode !== 'gravity') throw new Error('Invalid game mode');
    if (mode === this.mode) return;
    this.mode = mode; this.gravity = {x:0,y:1}; this.gravityTarget = {x:0,y:1}; this.gravityDirection = {x:0,y:1}; this.dangerDirection = {x:0,y:1};
    this.reset();
  }
  setGravity(x:number,y:number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const magnitude = Math.max(1,Math.hypot(x,y));
    this.gravityTarget = {x:x/magnitude,y:y/magnitude};
  }
  setAimPoint(x:number,y:number) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const d=this.down;
    this.setAim(this.mode==='gravity' ? WIDTH/2+(x-CIRCLE.x)*d.y-(y-CIRCLE.y)*d.x : x);
  }
  getSpawn() {
    if(this.mode==='classic')return {x:this.aim,y:43};
    const d=this.down,offset=this.aim-WIDTH/2;
    const base={x:CIRCLE.x+d.y*offset,y:CIRCLE.y-d.x*offset};
    const shape=fruitHull(this.current,FRUITS[this.current].radius);
    const travel=Math.max(0,circleTravel(base,shape,{x:-d.x,y:-d.y},CIRCLE,CIRCLE.radius)-18);
    return {x:base.x-d.x*travel,y:base.y-d.y*travel};
  }
  get canDrop() { return !this.over && !this.paused && this.cooldown <= 0; }
  setAim(x: number) {
    if (!Number.isFinite(x)) return;
    if(this.mode==='gravity'){const limit=Math.max(0,CIRCLE.radius-FRUITS[this.current].radius*2-24);this.aim=Math.max(WIDTH/2-limit,Math.min(WIDTH/2+limit,x));return;}
    const shape = fruitHull(this.current, FRUITS[this.current].radius);
    this.aim = Math.max(-shape.minX + 1, Math.min(WIDTH - shape.maxX - 1, x));
  }
  addFruit(kind: number, x: number, y: number): FruitBody {
    if (!Number.isInteger(kind) || kind < 0 || kind >= FRUITS.length || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid fruit');
    const shape = fruitHull(kind, FRUITS[kind].radius);
    const body = { id: ++this.serial, kind, x: Math.max(-shape.minX + .5, Math.min(WIDTH - shape.maxX - .5, x)), y: Math.min(y, HEIGHT - shape.maxY - .5), vx: 0, vy: 0, angle: 0, age: 0 };
    if(this.mode==='gravity'){body.x=x;body.y=y;confineToCircle(body,shape,CIRCLE,CIRCLE.radius);}
    this.bodies.push(body);
    return body;
  }
  drop(x = this.aim): boolean {
    if (!this.canDrop || !Number.isFinite(x)) return false;
    this.setAim(x);
    const spawn=this.getSpawn(),direction=this.down;
    const fruit=this.addFruit(this.current,spawn.x,spawn.y);fruit.vx=direction.x*20;fruit.vy=direction.y*20;
    this.drops++;
    this.highest = Math.max(this.highest, this.current);
    this.current = this.next;
    const value = this.random();
    this.next = value < .27 ? 0 : value < .53 ? 1 : value < .75 ? 2 : value < .92 ? 3 : 4;
    this.cooldown = .48;
    this.setAim(this.aim);
    return true;
  }
  reset() {
    this.bodies = []; this.events = []; this.score = 0; this.drops = 0; this.merges = 0;
    this.highest = 0; this.current = 0; this.next = 0; this.aim = WIDTH / 2;
    this.time = 0; this.cooldown = 0; this.danger = 0; this.over = false; this.paused = false;
    this.watermelons = 0; this.serial = 0; this.tiltGrace = .8;
  }
  snapshot() {
    return { mode: this.mode, height:this.height, gravity:this.gravity, direction:this.down, spawn:this.getSpawn(), score: this.score, drops: this.drops, merges: this.merges, highest: this.highest, current: this.current, next: this.next, canDrop: this.canDrop, paused: this.paused, over: this.over, danger: this.danger, watermelons: this.watermelons, bodies: this.bodies.map(b => ({ kind: b.kind, x: Math.round(b.x), y: Math.round(b.y) })) };
  }
  step(dt = STEP) {
    if (this.paused || this.over || dt <= 0 || !Number.isFinite(dt)) return;
    dt = Math.min(dt, 1 / 60);
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.events = this.events.filter(e => this.time - e.time < 1);
    if(this.mode==='gravity'){
      const mix=1-Math.exp(-10*dt);
      this.gravity.x+=(this.gravityTarget.x-this.gravity.x)*mix;this.gravity.y+=(this.gravityTarget.y-this.gravity.y)*mix;
      const length=Math.hypot(this.gravity.x,this.gravity.y);
      if(length>.045)this.gravityDirection={x:this.gravity.x/length,y:this.gravity.y/length};
      if(this.down.x*this.dangerDirection.x+this.down.y*this.dangerDirection.y<Math.cos(Math.PI/15)){
        this.dangerDirection={...this.down};this.tiltGrace=.85;this.danger=0;
      }
    }
    this.tiltGrace=Math.max(0,this.tiltGrace-dt);
    for (const b of this.bodies) {
      b.age += dt; b.vx += (this.mode==='gravity'?this.gravity.x:0)*1050*dt; b.vy += (this.mode==='gravity'?this.gravity.y:1)*1050*dt;
      b.vx *= Math.exp(-.8 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.angle += b.vx * dt / FRUITS[b.kind].radius * .38;
    }
    // Rotation stays fixed during position solving; only world translations change.
    const shapes = new Map(this.bodies.map(b => [b.id, fruitHull(b.kind, FRUITS[b.kind].radius, b.angle)]));
    const removed = new Set<number>();
    const pairs: [FruitBody, FruitBody][] = [];
    for (let iteration = 0; iteration < 8; iteration++) {
      for (let i = 0; i < this.bodies.length; i++) {
        const a = this.bodies[i]; if (removed.has(a.id)) continue;
        const ra = FRUITS[a.kind].radius;
        for (let j = i + 1; j < this.bodies.length; j++) {
          const b = this.bodies[j]; if (removed.has(a.id) || removed.has(b.id)) continue;
          const rb = FRUITS[b.kind].radius;
          const contact = hullContact(a, shapes.get(a.id)!, b, shapes.get(b.id)!);
          if (!contact) continue;
          if (a.kind === b.kind && a.age > .08 && b.age > .08) {
            removed.add(a.id); removed.add(b.id); pairs.push([a, b]); continue;
          }
          const { nx, ny, depth } = contact;
          const invA = 1 / (ra * ra), invB = 1 / (rb * rb), total = invA + invB;
          const correction = Math.max(0, depth - .015) * .8 / total;
          a.x -= nx * correction * invA; a.y -= ny * correction * invA;
          b.x += nx * correction * invB; b.y += ny * correction * invB;
          const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (relative < 0) {
            const restitution = relative < -65 ? .12 : 0;
            const impulse = -(1 + restitution) * relative / total;
            a.vx -= impulse * nx * invA; a.vy -= impulse * ny * invA;
            b.vx += impulse * nx * invB; b.vy += impulse * ny * invB;
            const tangent = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
            const friction = Math.max(-impulse * .22, Math.min(impulse * .22, -tangent / total));
            a.vx -= friction * -ny * invA; a.vy -= friction * nx * invA;
            b.vx += friction * -ny * invB; b.vy += friction * nx * invB;
          }
        }
      }
      for (const b of this.bodies) {
        if (removed.has(b.id)) continue;
        const shape = shapes.get(b.id)!;
        if(this.mode==='gravity'){confineToCircle(b,shape,CIRCLE,CIRCLE.radius);continue;}
        if (b.x + shape.minX < .5) { b.x = .5 - shape.minX; if (b.vx < 0) b.vx *= -.2; }
        if (b.x + shape.maxX > WIDTH - .5) { b.x = WIDTH - shape.maxX - .5; if (b.vx > 0) b.vx *= -.2; }
        if (b.y + shape.maxY > HEIGHT - .5) { b.y = HEIGHT - shape.maxY - .5; if (b.vy > 0) b.vy = b.vy > 65 ? -b.vy * .13 : 0; b.vx *= .985; }
      }
    }
    if (pairs.length) {
      this.bodies = this.bodies.filter(b => !removed.has(b.id));
      for (const [a, b] of pairs) {
        const kind = a.kind + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        const cleared = kind === FRUITS.length;
        const points = cleared ? 100 : kind * (kind + 1) / 2;
        if (!cleared) {
          const fruit = this.addFruit(kind, x, y);
          if(this.mode==='gravity'){fruit.vx=(a.vx+b.vx)/2-this.down.x*35;fruit.vy=(a.vy+b.vy)/2-this.down.y*35;}
          else{fruit.vx = (a.vx + b.vx) / 2; fruit.vy = Math.min(0, (a.vy + b.vy) / 2) - 35;}
          this.highest = Math.max(this.highest, kind);
          if (kind === 10) this.watermelons++;
        }
        this.score += points; this.merges++;
        this.events.push({ x, y, kind: Math.min(kind, 10), points, time: this.time, cleared });
      }
    }
    const overflowing = this.bodies.some(b => {
      if(b.age<=1.15)return false;
      const shape=shapes.get(b.id)??fruitHull(b.kind,FRUITS[b.kind].radius,b.angle);
      if(this.mode==='classic')return b.y+shape.minY<DANGER_Y;
      if(this.tiltGrace>0)return false;
      const d=this.down;
      return shape.points.some(p=>(b.x+p.x-CIRCLE.x)*d.x+(b.y+p.y-CIRCLE.y)*d.y<CIRCLE_DANGER);
    });
    this.danger = overflowing ? this.danger + dt : Math.max(0, this.danger - dt * 3);
    if (this.danger >= 2.5) this.over = true;
  }
}
