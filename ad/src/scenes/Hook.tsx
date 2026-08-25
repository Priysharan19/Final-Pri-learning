import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, TYPE } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Display, useFrameSpec, w } from '../lib/Type';
import { ramp } from '../lib/ease';

/**
 * S1 — HOOK (0.00–1.50). "Stop memorising maths." lands in three hard beats.
 * Frame 0 is special-cased fully set: it is the cover image (out/cover.png)
 * and the loop's hand-off target; at 60 fps the single pre-hold frame is
 * imperceptible in motion.
 */
export const Hook: React.FC<{ t0?: number }> = ({ t0 = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps + t0;
  const isCover = frame === 0;

  const wordAt = isCover ? undefined : [0.1, 0.35, 0.6];
  const fieldO = isCover ? 0.55 : ramp(t, [0.05, 0.9], [0, 0.55]);
  const dolly = ramp(t, [0, 1.5], [0, 26]);

  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ dolly, drift: 0.35, focus: 0, dof: 2.0 }}>
        <Plane z={-240} blurScale={1}>
          <MathField opacity={fieldO} seed={9} count={48} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: spec.w - spec.safeSide * 2, display: 'flex', justifyContent: 'center' }}>
              <Display
                words={w('Stop *memorising* maths.')}
                size={spec.aspect === '916' ? TYPE.s5 : TYPE.s4}
                wordAt={wordAt}
                landDur={0.24}
                mode="slam"
                lineHeight={1.04}
                // 50px of zoom headroom: the push-in scales this plane ~2% and drift adds ±5px
                style={{ maxWidth: spec.w - spec.safeSide * 2 - 50, textAlign: 'center' }}
              />
            </div>
          </AbsoluteFill>
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};
