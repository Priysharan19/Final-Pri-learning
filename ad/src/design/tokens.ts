// Design tokens — derived from client/src/theme.css ("Design system v4 — Dark LaTeX")
// and pinned in docs/BRAND.md. Single source of truth for the film.

export const C = {
  page: '#0a0a09',
  surface: '#101010',
  surface2: '#161615',
  surface3: '#1d1d1b',
  ink: '#efece1',
  ink2: '#b3afa2',
  ink3: '#7c796d',
  cream: '#f4f1e0',
  creamInk: '#131310',
  gold: '#c9ad63',
  goldBright: '#e3c87e',
  goldSoft: 'rgba(201,173,99,0.12)',
  goldBorder: 'rgba(201,173,99,0.55)',
  good: '#5aa86c',
  goodSoft: 'rgba(90,168,108,0.13)',
  bad: '#cf5f56',
  hairline: 'rgba(240,236,224,0.13)',
  hairlineStrong: 'rgba(240,236,224,0.24)',
  hairlineFaint: 'rgba(240,236,224,0.07)',
  // The film's true black (loop seam, fades). Slightly warm, matches the old reel shell.
  black: '#050504',
} as const;

// Type — everything Computer Modern (KaTeX fonts, bundled from the katex npm package).
export const FONT = {
  serif: `'KaTeX_Main', 'Latin Modern Roman', Georgia, 'Times New Roman', serif`,
  mathItalic: `'KaTeX_Math', 'KaTeX_Main', Georgia, serif`,
  ams: `'KaTeX_AMS', 'KaTeX_Main', Georgia, serif`, // blackboard-bold ℙ wordmark
  hand: `'Caveat', 'Segoe Script', cursive`,
} as const;

// Modular scale, ratio 1.333, base 36 (1080-wide master). docs/BRAND.md.
export const TYPE = {
  caption: 42,
  s0: 36,
  s1: 48,
  s2: 64,
  s3: 85,
  s4: 113,
  s5: 151,
  s6: 201,
} as const;

// Display type is tracked tight; Computer Modern needs negative tracking at size.
export const trackingFor = (px: number): number =>
  px >= 150 ? -0.012 * px * 0.09 - 1.2 : px >= 100 ? -1.0 : px >= 64 ? -0.5 : 0;

export const LABEL_TRACKING = '0.18em';
export const KICKER_TRACKING = '0.32em';

export const RADIUS = { card: 10, control: 5 } as const; // app 6/3 × film scale ≈ 1.6

// Instagram 9:16 safe zones (px at 1080×1920).
export const SAFE = {
  top: 250,
  bottom: 420,
  side: 90,
} as const;

// Grade parameters — one grade across the whole film (docs/BRAND.md).
export const GRADE = {
  filter: 'contrast(1.04) brightness(1.01) saturate(1.05)',
  vignette: 0.42,
  grainOpacity: 0.045,
  liftFloor: '#0d0d0b',
} as const;

export type Aspect = '916' | '45' | '11';

export interface Frame_ {
  w: number;
  h: number;
  aspect: Aspect;
  /** Multiplier on the modular scale for this recomposition. */
  typeScale: number;
  safeTop: number;
  safeBottom: number;
  safeSide: number;
}

export const frameFor = (aspect: Aspect): Frame_ => {
  switch (aspect) {
    case '916':
      return { w: 1080, h: 1920, aspect, typeScale: 1, safeTop: SAFE.top, safeBottom: SAFE.bottom, safeSide: SAFE.side };
    case '45':
      return { w: 1080, h: 1350, aspect, typeScale: 0.92, safeTop: 120, safeBottom: 150, safeSide: 80 };
    case '11':
      return { w: 1080, h: 1080, aspect, typeScale: 0.85, safeTop: 90, safeBottom: 120, safeSide: 76 };
  }
};
