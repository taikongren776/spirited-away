import { describe, expect, it } from 'vitest';
import { DURATION, getShot, sampleCamera, Timeline } from '../src/cinema';

describe('director timeline', () => {
  it('starts paused when reduced motion is requested', () => {
    const timeline = new Timeline(true); timeline.tick(.1); expect(timeline.time).toBe(0); timeline.play(); timeline.tick(.1); expect(timeline.time).toBeCloseTo(.1);
  });
  it('stops exactly at the final composition and can replay', () => {
    const timeline = new Timeline(); timeline.seek(71.97); timeline.tick(.1);
    expect(timeline.time).toBe(DURATION); expect(timeline.playing).toBe(false);
    timeline.play(); expect(timeline.time).toBe(0); expect(timeline.playing).toBe(true);
  });
  it('freezes film time during exploration and the entire 1.2 second return', () => {
    const timeline = new Timeline(); timeline.seek(25); timeline.explore(); timeline.tick(.1);
    expect(timeline.time).toBe(25); expect(timeline.playing).toBe(false);
    timeline.returnToCinema(); for (let i = 0; i < 11; i++) timeline.tick(.1);
    expect(timeline.mode).toBe('returning'); expect(timeline.time).toBe(25);
    timeline.tick(.1); expect(timeline.mode).toBe('cinema'); expect(timeline.time).toBe(25);
    timeline.tick(.1); expect(timeline.time).toBeCloseTo(25.1);
  });
  it('clamps input and prevents a long hidden-tab interval from skipping the film', () => {
    const timeline = new Timeline(); timeline.seek(-12); expect(timeline.time).toBe(0);
    timeline.seek(300); expect(timeline.time).toBe(72); timeline.seek(Number.NaN); expect(timeline.time).toBe(0);
    timeline.play(); timeline.tick(100); expect(timeline.time).toBeCloseTo(.1);
  });
  it('can interrupt a return and restart from every mode', () => {
    const timeline = new Timeline(); timeline.explore(); timeline.returnToCinema(); timeline.pause(); expect(timeline.mode).toBe('explore');
    timeline.seek(40); timeline.restart(); expect(timeline.mode).toBe('cinema'); expect(timeline.time).toBe(0); expect(timeline.playing).toBe(true);
  });
});
describe('camera paths', () => {
  it('uses the intended four chapter boundaries', () => {
    expect([0, 14, 34, 52].map(t => getShot(t).start)).toEqual([0, 14, 34, 52]); expect(getShot(72).end).toBe(72);
  });
  it('remains continuous through each cut point', () => {
    for (const t of [14, 34, 52]) {
      const a = sampleCamera(t - .001), b = sampleCamera(t + .001);
      expect(a.position.distanceTo(b.position)).toBeLessThan(.001);
      expect(a.target.distanceTo(b.target)).toBeLessThan(.001); expect(Math.abs(a.fov - b.fov)).toBeLessThan(.001);
    }
  });
  it('keeps both desktop and portrait paths outside architecture and above the bridge', () => {
    for (const aspect of [16 / 9, 390 / 844]) for (let t = 0; t <= 72; t += .1) {
      const { position, fov } = sampleCamera(t, aspect);
      expect(position.z).toBeGreaterThan(5); expect(position.y).toBeGreaterThan(9);
      expect(fov).toBeGreaterThan(35); expect(fov).toBeLessThan(60);
    }
  });
});
