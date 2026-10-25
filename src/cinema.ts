import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';

export const DURATION = 72;
export type CameraMode = 'cinema' | 'explore' | 'returning';
export interface Shot {
  start: number; end: number; title: string; caption: string;
  position: Vector3; target: Vector3; fov: number;
}
export const shots: Shot[] = [
  { start: 0, end: 14, title: '壹 · 水岸初见', caption: '沿着风的方向，去往灯火深处。', position: new Vector3(43, 23, 67), target: new Vector3(-9, 17, -17), fov: 43 },
  { start: 14, end: 34, title: '贰 · 走过红桥', caption: '不要回头，一直向前走。', position: new Vector3(3.5, 12, 35), target: new Vector3(0, 17, -22), fov: 49 },
  { start: 34, end: 52, title: '叁 · 灯火苏醒', caption: '抬头，是另一个世界的灯火。', position: new Vector3(0, 11.8, 9), target: new Vector3(0, 18, -23), fov: 53 },
  { start: 52, end: 72, title: '肆 · 暮色来信', caption: '那些曾经发生过的事，不会被忘记。', position: new Vector3(8, 25, 14), target: new Vector3(0, 27, -26), fov: 43 },
];
const positions = new CatmullRomCurve3([
  ...shots.map(shot => shot.position), new Vector3(53, 29, 48),
], false, 'centripetal');
const targets = new CatmullRomCurve3([
  ...shots.map(shot => shot.target), new Vector3(0, 18, -23),
], false, 'centripetal');
export const ease = (t: number) => t * t * (3 - 2 * t);
export function getShot(time: number) { return shots.find(s => time < s.end) ?? shots[3]; }
export function sampleCamera(time: number, aspect = 16 / 9) {
  const t = MathUtils.clamp(time, 0, DURATION);
  const shot = getShot(t), index = shots.indexOf(shot);
  const local = ease((t - shot.start) / (shot.end - shot.start));
  const u = (index + local) / 4;
  const position = positions.getPoint(u), target = targets.getPoint(u);
  const fov = MathUtils.lerp(shot.fov, shots[Math.min(index + 1, 3)].fov, local);
  if (aspect < 1) {
    // Preserve the full silhouette on a narrow viewport instead of simply cropping it.
    const originalElevation = position.y;
    position.sub(target).multiplyScalar(1.65).add(target);
    position.y = Math.max(originalElevation, position.y);
    if (index === 0) target.x = MathUtils.lerp(0, target.x, local);
  }
  return { position, target, fov, shot };
}

export class Timeline {
  time = 0;
  playing: boolean;
  mode: CameraMode = 'cinema';
  returnElapsed = 0;
  constructor(reducedMotion = false) { this.playing = !reducedMotion; }
  get ended() { return this.time >= DURATION; }
  tick(dt: number) {
    const delta = MathUtils.clamp(dt, 0, 0.1);
    if (this.mode === 'returning') {
      this.returnElapsed = Math.min(1.2, this.returnElapsed + delta);
      if (this.returnElapsed >= 1.2) { this.mode = 'cinema'; this.playing = !this.ended; }
    } else if (this.playing && this.mode === 'cinema') {
      this.time = Math.min(DURATION, this.time + delta);
      if (this.ended) this.playing = false;
    }
  }
  pause() { this.playing = false; if (this.mode === 'returning') this.mode = 'explore'; }
  play() {
    if (this.mode !== 'cinema') { this.returnToCinema(); return; }
    if (this.ended) this.time = 0;
    this.playing = true;
  }
  seek(time: number) { this.time = MathUtils.clamp(Number.isFinite(time) ? time : 0, 0, DURATION); if (this.ended) this.playing = false; }
  restart() { this.time = 0; this.mode = 'cinema'; this.playing = true; this.returnElapsed = 0; }
  explore() { this.playing = false; this.mode = 'explore'; }
  returnToCinema() { this.playing = false; this.mode = 'returning'; this.returnElapsed = 0; }
}
