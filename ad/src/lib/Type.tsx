import React, { createContext, useContext } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, KICKER_TRACKING, LABEL_TRACKING, TYPE, trackingFor, frameFor, type Frame_, type Aspect } from '../design/tokens';
import { easeMassive, easeOutSignature, fadeIO, ramp } from './ease';
import type { TextBeat } from '../data/timeline';

// ── Aspect + debug plumbing ────────────────────────────────────────────────

export const AspectCtx = createContext<Frame_>(frameFor('916'));
export const useFrameSpec = (): Frame_ => useContext(AspectCtx);

/** When true, every text element renders as a solid pure-red box (safe-zone / layout lint). */
export const DebugSafeCtx = createContext<boolean>(false);

export const AspectProvider: React.FC<{ aspect: Aspect; debugSafe: boolean; children: React.ReactNode }> = ({
  aspect,
  debugSafe,
  children,
}) => (
  <AspectCtx.Provider value={frameFor(aspect)}>
    <DebugSafeCtx.Provider value={debugSafe}>{children}</DebugSafeCtx.Provider>
  </AspectCtx.Provider>
);

/**
 * Every visible piece of text in the film flows through TextBox: in debugSafe
 * mode it paints a solid #ff0000 box over its exact bounds so scripts/check.ts
 * can pixel-lint the IG safe zones. Non-text graphics never use pure red.
 */
export const TextBox: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => {
  const debug = useContext(DebugSafeCtx);
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div style={debug ? { opacity: 0 } : undefined}>{children}</div>
      {debug ? <div style={{ position: 'absolute', inset: 0, background: '#ff0000' }} /> : null}
    </div>
  );
};

// ── Type components ────────────────────────────────────────────────────────

export const Kicker: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  tracking?: string;
  style?: React.CSSProperties;
}> = ({ children, size, color = C.ink3, tracking = LABEL_TRACKING, style }) => {
  const spec = useFrameSpec();
  return (
    <TextBox style={style}>
      <div
        style={{
          fontFamily: FONT.serif,
          fontSize: (size ?? 26) * spec.typeScale,
          textTransform: 'uppercase',
          letterSpacing: tracking,
          color,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </div>
    </TextBox>
  );
};

export interface DisplayWord {
  text: string;
  accent?: boolean;
}

/**
 * Display type — big, tight, optically tracked. Words can arrive on their own
 * beats (`wordAt` in seconds, absolute) with mass, or all at once.
 */
export const Display: React.FC<{
  words: DisplayWord[];
  size?: number;
  /** absolute seconds each word lands; omit for static */
  wordAt?: number[];
  landDur?: number;
  align?: 'center' | 'left';
  lineHeight?: number;
  style?: React.CSSProperties;
  exitAt?: number;
  exitDur?: number;
  mode?: 'slam' | 'rise';
}> = ({ words, size = TYPE.s5, wordAt, landDur = 0.32, align = 'center', lineHeight = 1.06, style, exitAt, exitDur = 0.25, mode = 'rise' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps;
  const fs = size * spec.typeScale;

  const exitP = exitAt !== undefined ? ramp(t, [exitAt, exitAt + exitDur], [0, 1], easeMassive) : 0;

  return (
    <TextBox style={style}>
      <div
        style={{
          fontFamily: FONT.serif,
          fontSize: fs,
          letterSpacing: trackingFor(fs),
          lineHeight,
          color: C.ink,
          textAlign: align,
          opacity: 1 - exitP,
          transform: exitP > 0 ? `translateY(${-14 * exitP}px)` : undefined,
        }}
      >
        {words.map((w, i) => {
          const at = wordAt?.[i];
          let opacity = 1;
          let transform: string | undefined;
          if (at !== undefined) {
            const p = ramp(t, [at, at + landDur], [0, 1], mode === 'slam' ? easeMassive : easeOutSignature);
            opacity = p;
            transform =
              mode === 'slam'
                ? `scale(${1.22 - 0.22 * p}) translateY(${(1 - p) * 6}px)`
                : `translateY(${(1 - p) * 34}px)`;
          }
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                whiteSpace: 'pre',
                color: w.accent ? C.gold : undefined,
                opacity,
                transform,
              }}
            >
              {w.text}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </TextBox>
  );
};

/** Split helper: "Stop *memorising* maths." → accent between asterisks. */
export const w = (line: string): DisplayWord[] =>
  line.split(' ').map((tk) =>
    tk.startsWith('*') && tk.endsWith('*')
      ? { text: tk.slice(1, -1), accent: true }
      : { text: tk },
  );

/**
 * The caption band — burned-in captions styled as part of the design system.
 * Sits inside the IG safe zone; one line active at a time from the timeline.
 */
export const Captions: React.FC<{ beats: TextBeat[]; roles?: TextBeat['role'][] }> = ({ beats, roles = ['caption'] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps;

  const active = beats.filter((b) => roles.includes(b.role) && t >= b.at - 0.3 && t <= b.until + 0.1);
  if (active.length === 0) return null;

  // caption block bottom edge sits 60px above the IG bottom zone
  const bottom = spec.safeBottom + 60;

  return (
    <div
      style={{
        position: 'absolute',
        left: spec.safeSide,
        right: spec.safeSide,
        bottom,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {active.map((b, i) => {
        const o = fadeIO(t, b.at, b.until, 0.28, 0.22);
        const rise = ramp(t, [b.at, b.at + 0.35], [16, 0], easeOutSignature);
        return (
          <TextBox key={i} style={{ position: 'absolute', bottom: 0 }}>
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: TYPE.caption * spec.typeScale,
                lineHeight: 1.3,
                color: C.ink,
                textAlign: 'center',
                whiteSpace: 'pre-line', // authored line breaks — no widows
                maxWidth: spec.w - spec.safeSide * 2,
                opacity: o,
                transform: `translateY(${rise}px)`,
                textShadow: '0 2px 24px rgba(0,0,0,0.85), 0 0 60px rgba(0,0,0,0.55)',
                padding: '12px 30px',
                // a soft scrim so bright plot strokes never run through the words
                background: 'radial-gradient(60% 90% at 50% 50%, rgba(5,5,4,0.52), rgba(5,5,4,0.0) 78%)',
                borderRadius: 14,
              }}
            >
              {b.text}
            </div>
          </TextBox>
        );
      })}
    </div>
  );
};
