import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, TYPE } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Display, TextBox, useFrameSpec, w } from '../lib/Type';
import { easeDrift, ramp } from '../lib/ease';

/**
 * S5 — CLOSE (27.00–30.00). Wordmark · "Join the change." · CTA. The second
 * stillness beat: the camera's drift decays to zero and everything holds.
 * Fade to black by 29.70 — the last frame hands off cleanly to frame 0.
 *
 * All timings here are sequence-relative so the 15 s cut can reuse the card.
 */
export const CloseCard: React.FC<{ tRel: number; atRel?: number; compact?: boolean }> = ({ tRel, atRel = 0, compact }) => {
  const spec = useFrameSpec();
  const markP = ramp(tRel, [atRel + 0.1, atRel + 0.65], [0, 1], easeDrift);
  const ctaP = ramp(tRel, [atRel + 0.8, atRel + 1.15], [0, 1]);
  const markSize = (compact ? 84 : 104) * spec.typeScale;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 30 : 44, marginTop: -40 }}>
        {/* wordmark — blackboard-bold ℙ + serif, exactly the app's lockup */}
        <TextBox style={{ opacity: markP }}>
          <div style={{ transform: `translateY(${(1 - markP) * 26}px)` }}>
            <span style={{ fontFamily: FONT.ams, fontSize: markSize, color: C.ink }}>
              P
              <span style={{ fontFamily: FONT.serif, fontSize: markSize * 0.82 }}>ri Learning.</span>
            </span>
          </div>
        </TextBox>

        <Display
          words={w('Join the *change.*')}
          size={compact ? TYPE.s3 : TYPE.s4}
          wordAt={[atRel + 0.24, atRel + 0.4, atRel + 0.56]}
          landDur={0.3}
          mode="rise"
        />

        {/* CTA — the app's cream primary action */}
        <TextBox style={{ opacity: ctaP }}>
          <div
            style={{
              transform: `translateY(${(1 - ctaP) * 18}px)`,
              background: C.cream,
              color: C.creamInk,
              fontFamily: FONT.serif,
              fontSize: 30 * spec.typeScale,
              padding: '16px 40px',
              borderRadius: 999,
              boxShadow: '0 0 26px rgba(244,241,224,0.18)',
            }}
          >
            Follow @pri.learning
          </div>
        </TextBox>
        <TextBox style={{ opacity: ctaP * 0.85 }}>
          <div
            style={{
              fontFamily: FONT.serif,
              fontSize: 23 * spec.typeScale,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: C.ink3,
            }}
          >
            Coming soon
          </div>
        </TextBox>
      </div>
    </AbsoluteFill>
  );
};

export const Close: React.FC<{ t0?: number; fadeAt?: number; fadeDur?: number }> = ({ t0 = 27, fadeAt = 29.2, fadeDur = 0.5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tRel = frame / fps;
  const t = tRel + t0;

  // stillness: drift decays to zero — confidence reads as expensive
  const drift = ramp(t, [t0, t0 + 1.4], [0.4, 0]);
  const fade = ramp(t, [fadeAt, fadeAt + fadeDur], [0, 1], easeDrift);

  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ drift, dof: 1.6 }} tOffset={t0}>
        <Plane z={-260}>
          <MathField opacity={0.28} seed={57} count={34} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <CloseCard tRel={tRel} />
        </Plane>
      </Stage>
      {/* the authored fade to black — loop-safe hand-off to frame 0 */}
      <AbsoluteFill style={{ background: C.black, opacity: fade, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
