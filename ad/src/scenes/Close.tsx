import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, TYPE } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Display, TextBox, useFrameSpec, w } from '../lib/Type';
import { easeDrift, easeOvershoot, ramp } from '../lib/ease';

/**
 * S5 — CLOSE (27.00–30.00). Wordmark · "Join the change." · CTA. The second
 * stillness beat: the camera's drift decays to zero and everything holds.
 * Fade to black by 29.70 — the last frame hands off cleanly to frame 0.
 *
 * All timings here are sequence-relative so the 15 s cut can reuse the card.
 */
export const CloseCard: React.FC<{ tRel: number; atRel?: number; compact?: boolean }> = ({ tRel, atRel = 0, compact }) => {
  const spec = useFrameSpec();
  const markP = ramp(tRel, [atRel, atRel + 0.5], [0, 1], easeDrift);
  const ctaP = ramp(tRel, [atRel + 0.7, atRel + 1.05], [0, 1]);
  const breath = 1 + 0.18 * Math.exp(-((tRel - atRel - 1.9) ** 2) / 0.18); // one slow luminous breath
  const markSize = (compact ? 84 : 104) * spec.typeScale;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 30 : 44, marginTop: -40 }}>
        {/* wordmark — blackboard-bold ℙ + serif, exactly the app's lockup */}
        <TextBox style={{ opacity: markP }}>
          <div style={{ transform: `translateY(${(1 - markP) * 26}px)`, position: 'relative', overflow: 'hidden', padding: '6px 14px' }}>
            <span style={{ fontFamily: FONT.ams, fontSize: markSize, color: C.ink }}>
              P
              <span style={{ fontFamily: FONT.serif, fontSize: markSize * 0.82 }}>ri Learning.</span>
            </span>
            {(() => {
              const sp = ramp(tRel, [atRel + 0.75, atRel + 1.45], [0, 1], easeDrift);
              if (sp <= 0 || sp >= 1) return null;
              return (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '26%',
                    left: `${-30 + sp * 150}%`,
                    background: 'linear-gradient(105deg, transparent, rgba(244,241,224,0.20), transparent)',
                    transform: 'skewX(-14deg)',
                  }}
                />
              );
            })()}
          </div>
        </TextBox>

        <Display
          words={w('Join the *change.*')}
          size={compact ? TYPE.s3 : TYPE.s4}
          wordAt={[atRel + 0.18, atRel + 0.32, atRel + 0.46]}
          landDur={0.3}
          mode="rise"
        />

        {/* CTA — the app's cream primary action */}
        <TextBox style={{ opacity: ctaP }}>
          <div
            style={{
              transform: `translateY(${(1 - ctaP) * 18}px) scale(${0.9 + 0.1 * ramp(tRel, [atRel + 0.7, atRel + 1.08], [0, 1], easeOvershoot)})`,
              background: C.cream,
              color: C.creamInk,
              fontFamily: FONT.serif,
              fontSize: 30 * spec.typeScale,
              padding: '16px 40px',
              borderRadius: 999,
              boxShadow: `0 0 ${Math.round(16 * breath)}px rgba(244,241,224,${(0.16 * breath).toFixed(3)})`,
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
  const drift = ramp(t, [t0, t0 + 1.6], [0.4, 0.12]);
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
