import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, TYPE } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Display, useFrameSpec, w } from '../lib/Type';
import { easeDrift, ramp } from '../lib/ease';

/**
 * S1 — HOOK (0.00–1.50). "Stop memorising maths." lands in three hard beats;
 * on the third, a gold line sweeps under the words — the film's object,
 * promised before it is explained. Frame 0 is special-cased fully set: it is
 * the cover image (out/cover.png) and the loop's hand-off target; at 60 fps
 * the single pre-hold frame is imperceptible in motion.
 */
export const Hook: React.FC<{ t0?: number }> = ({ t0 = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps + t0;
  const isCover = frame === 0;

  const wordAt = isCover ? undefined : [0.1, 0.35, 0.6];
  const fieldO = isCover ? 0.4 : ramp(t, [0.05, 0.9], [0, 0.4]);
  const dolly = ramp(t, [0, 1.5], [0, 55], easeDrift);
  // the tangent's promise — draws with the third beat
  const lineP = isCover ? 1 : ramp(t, [0.62, 1.18], [0, 1], easeDrift);

  const lineW = Math.min(560, (spec.w - spec.safeSide * 2 - 60) * 0.62);

  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ dolly, drift: 0.35, focus: 0, dof: 2.0 }}>
        <Plane z={-240} blurScale={1}>
          <MathField opacity={fieldO} seed={9} count={48} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 38 }}>
              <Display
                words={w('Stop memorising maths.')}
                size={spec.aspect === '916' ? TYPE.s5 : TYPE.s4}
                wordAt={wordAt}
                landDur={0.24}
                mode="slam"
                lineHeight={1.04}
                // zoom headroom: the push-in scales this plane ~4% and drift adds ±9px
                style={{ maxWidth: spec.w - spec.safeSide * 2 - 90, textAlign: 'center' }}
              />
              <svg width={lineW} height={22} style={{ overflow: 'visible' }}>
                <path
                  d={`M2,17 L${lineW - 2},5`}
                  stroke={C.gold}
                  strokeWidth={5}
                  strokeLinecap="round"
                  fill="none"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - lineP}
                  opacity={0.95}
                />
                <path
                  d={`M2,17 L${lineW - 2},5`}
                  stroke={C.gold}
                  strokeWidth={16}
                  strokeLinecap="round"
                  fill="none"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - lineP}
                  opacity={0.16}
                  style={{ filter: 'blur(9px)' }}
                />
              </svg>
            </div>
          </AbsoluteFill>
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};
