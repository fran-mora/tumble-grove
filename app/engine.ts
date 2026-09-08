import { FRUIT_COLLECTION } from './fruit-collection.ts';
import { chooseThemedRound, parseFruitHistory, type FruitHistory, type RoundTheme } from './fruit-themes.ts';
import { basketWalls, bowlWalls, collideWithWalls, outsideBasket, outsideBowl, MOUTH_HALF_ANGLE } from './arena.ts';
import { fruitHull, hullContact, circleTravel } from './collision.ts';
export const WIDTH = 440;
export const HEIGHT = 570;
export const DANGER_Y = 100;
export const STEP = 1 / 120;
export const MERGE_LABEL_SECONDS = 2.2;
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
export type MergeEvent = { x: number; y: number; kind: number; points: number; time: number; cleared: boolean; bodyId: number | null };
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
  inspecting = false;
  inspectedId: number | null = null;
  watermelons = 0;
  mode: GameMode = 'classic';
  gravity = {x:0,y:1};
  private gravityTarget = {x:0,y:1};
  private gravityDirection = {x:0,y:1};
  private serial = 0;
  random: () => number;
  lineup: number[];
  theme: RoundTheme;
  historyRevision = 0;
  private history: FruitHistory;
  private encountered = new Set<number>();
  private appearanceRandom:()=>number;
  constructor(random: () => number = Math.random, appearanceRandom:()=>number=random, savedHistory?:unknown) {
    this.random=random;this.appearanceRandom=appearanceRandom;this.history=parseFruitHistory(savedHistory);
    const round=chooseThemedRound(appearanceRandom,this.history);
    this.lineup=round.lineup;this.theme=round.theme;this.historyRevision++;
    this.rememberFruit(0);
  }
  getFruitHistory(){return parseFruitHistory(this.history);}
  private rememberFruit(kind:number){
    const id=this.lineup[kind];if(this.encountered.has(id))return;
    this.encountered.add(id);this.history.seen[id]=Math.min(1_000_000,this.history.seen[id]+1);this.historyRevision++;
  }
  getFruit(kind:number){return FRUIT_COLLECTION[this.lineup[kind]];}
  getShape(kind:number,angle=0){return fruitHull(kind,FRUITS[kind].radius,angle,this.getFruit(kind).geometry);}
  get height() { return this.mode === 'gravity' ? WIDTH : HEIGHT; }
  get down() { return this.mode === 'gravity' ? this.gravityDirection : {x:0,y:1}; }
  setMode(mode: GameMode) {
    if (mode !== 'classic' && mode !== 'gravity') throw new Error('Invalid game mode');
    if (mode === this.mode) return;
    this.mode = mode; this.gravity = {x:0,y:1}; this.gravityTarget = {x:0,y:1}; this.gravityDirection = {x:0,y:1};
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
    const shape=this.getShape(this.current);
    const travel=Math.max(0,circleTravel(base,shape,{x:-d.x,y:-d.y},CIRCLE,CIRCLE.radius)-18);
    return {x:base.x-d.x*travel,y:base.y-d.y*travel};
  }
  get canDrop() { return !this.over && !this.paused && !this.inspecting && this.cooldown <= 0; }
  setInspecting(enabled: boolean) {
    if (enabled && (this.over || !this.bodies.length)) return false;
    this.inspecting = enabled;
    this.inspectedId = null;
    this.paused = enabled;
    return true;
  }
  inspectFruit(x: number, y: number) {
    if (!this.inspecting || !Number.isFinite(x) || !Number.isFinite(y)) return;
    // Hit the rotated fruit body, front to back, rather than its padded image box.
    const body = this.bodies.findLast(b => {
      const { points } = this.getShape(b.kind, b.angle);
      let positive = false, negative = false;
      for (let i = 0; i < points.length; i++) {
        const p = points[i], q = points[(i + 1) % points.length];
        const cross = (q.x - p.x) * (y - b.y - p.y) - (q.y - p.y) * (x - b.x - p.x);
        if (cross > 1e-6) positive = true;
        if (cross < -1e-6) negative = true;
        if (positive && negative) return false;
      }
      return true;
    });
    this.inspectedId = body?.id ?? null;
  }
  cycleInspectedFruit(direction: -1 | 1) {
    if (!this.inspecting || !this.bodies.length) return;
    const index = this.bodies.findIndex(b => b.id === this.inspectedId);
    const next = index < 0 ? (direction === 1 ? 0 : this.bodies.length - 1)
      : (index + direction + this.bodies.length) % this.bodies.length;
    this.inspectedId = this.bodies[next].id;
  }
  setAim(x: number) {
    if (!Number.isFinite(x)) return;
    if(this.mode==='gravity'){const limit=Math.max(0,CIRCLE.radius*Math.sin(MOUTH_HALF_ANGLE)-FRUITS[this.current].radius-12);this.aim=Math.max(WIDTH/2-limit,Math.min(WIDTH/2+limit,x));return;}
    const shape = this.getShape(this.current);
    this.aim = Math.max(-shape.minX + 1, Math.min(WIDTH - shape.maxX - 1, x));
  }
  addFruit(kind: number, x: number, y: number): FruitBody {
    if (!Number.isInteger(kind) || kind < 0 || kind >= FRUITS.length || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid fruit');
    const body = { id: ++this.serial, kind, x, y, vx: 0, vy: 0, angle: 0, age: 0 };
    this.rememberFruit(kind);
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
    this.rememberFruit(this.current);this.rememberFruit(this.next);
    this.cooldown = .48;
    this.setAim(this.aim);
    return true;
  }
  reset() {
    const round=chooseThemedRound(this.appearanceRandom,this.history,this.lineup);
    this.lineup=round.lineup;this.theme=round.theme;this.historyRevision++;this.encountered.clear();this.rememberFruit(0);
    this.bodies = []; this.events = []; this.score = 0; this.drops = 0; this.merges = 0;
    this.highest = 0; this.current = 0; this.next = 0; this.aim = WIDTH / 2;
    this.time = 0; this.cooldown = 0; this.danger = 0; this.over = false; this.paused = false;
    this.inspecting = false; this.inspectedId = null;
    this.watermelons = 0; this.serial = 0;
  }
  snapshot() {
    return { theme:{id:this.theme.id,name:this.theme.name}, lineup:this.lineup.map(id=>({id,name:FRUIT_COLLECTION[id].name,level:FRUIT_COLLECTION[id].level})), mode: this.mode, height:this.height, gravity:this.gravity, direction:this.down, spawn:this.getSpawn(), score: this.score, drops: this.drops, merges: this.merges, highest: this.highest, current: this.current, next: this.next, canDrop: this.canDrop, paused: this.paused, inspecting: this.inspecting, inspectedId: this.inspectedId, over: this.over, danger: this.danger, watermelons: this.watermelons, bodies: this.bodies.map(b => ({ id: b.id, name: this.getFruit(b.kind).name, kind: b.kind, x: Math.round(b.x), y: Math.round(b.y) })) };
  }
  step(dt = STEP) {
    if (this.paused || this.inspecting || this.over || dt <= 0 || !Number.isFinite(dt)) return;
    dt = Math.min(dt, 1 / 60);
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.events = this.events.filter(e => this.time - e.time < MERGE_LABEL_SECONDS);
    if(this.mode==='gravity'){
      const mix=1-Math.exp(-10*dt);
      this.gravity.x+=(this.gravityTarget.x-this.gravity.x)*mix;this.gravity.y+=(this.gravityTarget.y-this.gravity.y)*mix;
      const length=Math.hypot(this.gravity.x,this.gravity.y);
      if(length>.045)this.gravityDirection={x:this.gravity.x/length,y:this.gravity.y/length};
    }
    const walls=this.mode==='gravity'?bowlWalls(CIRCLE,CIRCLE.radius,this.down):basketWalls(WIDTH,HEIGHT);
    for (const b of this.bodies) {
      b.age += dt; b.vx += (this.mode==='gravity'?this.gravity.x:0)*1050*dt; b.vy += (this.mode==='gravity'?this.gravity.y:1)*1050*dt;
      b.vx *= Math.exp(-.8 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.angle += b.vx * dt / FRUITS[b.kind].radius * .38;
    }
    // Rotation stays fixed during position solving; only world translations change.
    const shapes = new Map(this.bodies.map(b => [b.id, this.getShape(b.kind,b.angle)]));
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
        collideWithWalls(b,shape,walls);
      }
    }
    if (pairs.length) {
      this.bodies = this.bodies.filter(b => !removed.has(b.id));
      for (const [a, b] of pairs) {
        const kind = a.kind + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        const cleared = kind === FRUITS.length;
        const points = cleared ? 100 : kind * (kind + 1) / 2;
        let bodyId: number | null = null;
        if (!cleared) {
          const fruit = this.addFruit(kind, x, y);
          bodyId = fruit.id;
          if(this.mode==='gravity'){fruit.vx=(a.vx+b.vx)/2-this.down.x*35;fruit.vy=(a.vy+b.vy)/2-this.down.y*35;}
          else{fruit.vx = (a.vx + b.vx) / 2; fruit.vy = Math.min(0, (a.vy + b.vy) / 2) - 35;}
          this.highest = Math.max(this.highest, kind);
          if (kind === 10) this.watermelons++;
        }
        this.score += points; this.merges++;
        this.events.push({ x, y, kind: Math.min(kind, 10), points, time: this.time, cleared, bodyId });
      }
    }
    // The dashed guide never ends a round. A whole fruit must spill outside.
    this.over = this.bodies.some(b => {
      const shape=shapes.get(b.id)??this.getShape(b.kind,b.angle);
      return this.mode==='classic'?outsideBasket(b,shape,WIDTH,HEIGHT):outsideBowl(b,shape,CIRCLE,CIRCLE.radius);
    });
    this.danger = 0;
  }
}
