// Timeline — the single source of truth for structure, text and captions.
// Frame-accurate: 60 fps, 120 BPM (1 beat = 0.5 s = 30 frames). Every cut lands on a beat.
// scripts/check.ts imports this file for the hold-time gate; the SRT is generated from CAPTIONS.

export const FPS = 60;

export const sec = (s: number): number => Math.round(s * FPS);

/** Scene windows, 30 s master (seconds). */
export const SCENES30 = {
  hook: { at: 0.0, dur: 1.5 },
  factory: { at: 1.5, dur: 6.5 },
  turnCurve: { at: 8.0, dur: 2.0 },
  turnHinge: { at: 10.0, dur: 5.0 },
  turnProduct: { at: 15.0, dur: 2.5 },
  turnMarked: { at: 17.5, dur: 2.5 },
  ladder: { at: 20.0, dur: 7.0 },
  close: { at: 27.0, dur: 3.0 },
} as const;

export const DUR30 = 30.0;

/** The tangent locks — the film's loudest moment. Absolute seconds. */
export const LOCK30 = 12.6;

/** Scene windows, 15 s cut — a real edit (beauty first), not a truncation. */
export const SCENES15 = {
  curveOpen: { at: 0.0, dur: 1.0 },
  factory: { at: 1.0, dur: 2.5 },
  hinge: { at: 3.5, dur: 5.0 },
  marked: { at: 8.5, dur: 2.0 },
  ladder: { at: 10.5, dur: 2.0 },
  close: { at: 12.5, dur: 2.5 },
} as const;

export const DUR15 = 15.0;
export const LOCK15 = 7.0;

export interface TextBeat {
  /** Absolute start, seconds. */
  at: number;
  /** Absolute end, seconds. */
  until: number;
  text: string;
  /** Where the line lives; 'headline' beats are the shot, 'caption' beats ride the caption band. */
  role: 'headline' | 'caption' | 'kicker' | 'cta';
}

/** Every worded beat in the 30 s master (kickers included). Gate: >4 words ⇒ ≥1.2 s hold. */
export const TEXT30: TextBeat[] = [
  { at: 0.1, until: 1.5, text: 'Stop memorising maths.', role: 'headline' },
  { at: 2.5, until: 4.5, text: 'Memorise. Repeat.', role: 'headline' },
  { at: 4.6, until: 6.4, text: 'Four hundred formulas. No ideas.', role: 'headline' },
  { at: 6.7, until: 8.0, text: 'Until the question is new.', role: 'caption' },
  { at: 12.9, until: 14.9, text: 'The derivative isn’t a rule. It’s what you’re watching.', role: 'caption' },
  { at: 15.3, until: 17.4, text: 'Understand one idea. Solve what you’ve never seen.', role: 'caption' },
  { at: 18.6, until: 20.0, text: 'Marked like an examiner.', role: 'caption' },
  { at: 20.6, until: 26.8, text: 'Class 7 to Olympiad. The same mathematics, at different pressures.', role: 'caption' },
  { at: 27.2, until: 29.6, text: 'Join the change.', role: 'headline' },
  { at: 27.8, until: 29.5, text: '@pri.learning · coming soon', role: 'cta' },
];

export const TEXT15: TextBeat[] = [
  { at: 0.15, until: 1.0, text: 'Stop memorising maths.', role: 'headline' },
  { at: 2.6, until: 3.9, text: 'Until the question is new.', role: 'caption' },
  { at: 7.1, until: 8.4, text: 'The derivative isn’t a rule.', role: 'caption' },
  { at: 8.7, until: 10.4, text: 'Your working, marked like an examiner.', role: 'caption' },
  { at: 10.6, until: 12.4, text: 'Class 7 to Olympiad.', role: 'caption' },
  { at: 12.7, until: 14.6, text: 'Join the change.', role: 'headline' },
  { at: 13.2, until: 14.5, text: '@pri.learning · coming soon', role: 'cta' },
];

export interface VoLine {
  at: number;
  until: number;
  text: string;
  /** Caption text if it differs from the spoken line (defaults to `text`). */
  caption?: string;
}

/** VO for the 30 s master. Also the source of out/captions.srt.
 * The gap at 11.7–13.2 is authored: the music owns the tangent lock (12.6). */
export const VO30: VoLine[] = [
  { at: 0.15, until: 1.45, text: 'Stop memorising maths.' },
  { at: 2.6, until: 6.3, text: 'Four hundred formulas. The same drill, the same batch, every day.' },
  { at: 6.55, until: 7.75, text: 'Until the question is new.' },
  { at: 9.0, until: 11.7, text: 'Watch the secant become the tangent.' },
  { at: 13.2, until: 14.9, text: 'That’s the derivative — not a rule, a reason.' },
  { at: 15.4, until: 19.6, text: 'Understand one idea, and you can solve what you’ve never seen. Marked like an examiner.' },
  { at: 20.8, until: 26.4, text: 'Class seven to Olympiad. The same mathematics, at different pressures.' },
  { at: 27.3, until: 29.3, text: 'Pri Learning. Join the change.' },
];

export const VO15: VoLine[] = [
  { at: 0.2, until: 1.15, text: 'Stop memorising maths.' },
  { at: 2.55, until: 3.7, text: 'Until the question is new.' },
  { at: 3.9, until: 6.5, text: 'Watch the secant become the tangent.' },
  { at: 8.7, until: 10.4, text: 'Your working, marked like an examiner.' },
  { at: 10.7, until: 12.3, text: 'Class seven to Olympiad.' },
  { at: 12.8, until: 14.5, text: 'Pri Learning. Join the change.' },
];

/** Beat-grid helper: true if a time lands on the 0.5 s grid (tolerance one frame). */
export const onBeat = (s: number): boolean => {
  const r = s % 0.5;
  return r < 1 / FPS || 0.5 - r < 1 / FPS;
};
