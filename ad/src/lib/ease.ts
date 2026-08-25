import { Easing, interpolate } from 'remotion';

// The film's motion physics (docs/BRAND.md): no linear easing anywhere.
// Enters and exits never share a curve.

/** The app's signature ease-out — cubic-bezier(0.22, 1, 0.36, 1). */
export const easeOutSignature = Easing.bezier(0.22, 1, 0.36, 1);
/** Verdict-pop overshoot — cubic-bezier(0.34, 1.56, 0.64, 1). */
export const easeOvershoot = Easing.bezier(0.34, 1.56, 0.64, 1);
/** Heavy arrival: slow in, settles with mass. */
export const easeMassive = Easing.bezier(0.6, 0, 0.16, 1);
/** Exit curve — accelerate away. */
export const easeExit = Easing.bezier(0.5, 0, 0.85, 0.4);
/** Mechanical snap for the factory — hard, zero settle (rigidity as characterisation). */
export const easeSnap = Easing.bezier(0.9, 0, 1, 0.7);
/** Gentle drift for camera work. */
export const easeDrift = Easing.bezier(0.37, 0, 0.63, 1);

type EasingFn = (t: number) => number;

/** interpolate with clamping baked in. */
export const ramp = (
  t: number,
  inRange: [number, number],
  outRange: [number, number],
  easing: EasingFn = easeOutSignature,
): number =>
  interpolate(t, inRange, outRange, {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** 0→1 progress over a window (seconds-based, pass T in seconds). */
export const win = (t: number, at: number, dur: number, easing: EasingFn = easeOutSignature): number =>
  ramp(t, [at, at + dur], [0, 1], easing);

/** Fade in then out over a window with given edge durations. */
export const fadeIO = (t: number, at: number, until: number, inDur = 0.25, outDur = 0.2): number => {
  if (t < at || t > until) return 0;
  const a = ramp(t, [at, at + inDur], [0, 1], easeOutSignature);
  const b = ramp(t, [until - outDur, until], [1, 0], easeExit);
  return Math.min(a, b);
};

/** Deterministic value noise (seeded), for camera drift and grain seeds. */
export const noise1 = (t: number, seed: number): number => {
  // sum of incommensurate sines — smooth, deterministic, zero-mean
  return (
    0.5 * Math.sin(t * 0.7 + seed * 12.9898) +
    0.3 * Math.sin(t * 1.3 + seed * 78.233) +
    0.2 * Math.sin(t * 2.9 + seed * 37.719)
  );
};
