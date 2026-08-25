import React from 'react';
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, RADIUS } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Kicker, TextBox, useFrameSpec } from '../lib/Type';
import { Tex } from '../lib/Tex';
import { easeDrift, easeMassive, easeOutSignature, fadeIO, ramp } from '../lib/ease';
import { Axes, Dot, LitPath, fnPath, linePath, makeMap } from '../lib/plots';
import { HINGE } from '../math/expressions';
import { PLOT, plotSize } from './TurnCurve';

/**
 * S3b — THE HINGE (10.00–15.00 abs, lock at 12.60). The secant sweeps into
 * tangency with real mass. This is the product reveal: the mathematics is the
 * hero object — lit, revolved, racked into focus, held long enough to be admired.
 */

/** h(t): three discrete settles, then the long slide home. Absolute seconds. */
export const hOf = (t: number, lockAt = 12.6, s = 1): number => {
  const k = (x: number) => lockAt - (12.6 - x) * s; // re-times for the 15 s cut
  if (t < k(10.55)) return 1;
  if (t < k(10.95)) return 1 + (0.5 - 1) * ramp(t, [k(10.55), k(10.95)], [0, 1], easeOutSignature);
  if (t < k(11.35)) return 0.5;
  if (t < k(11.75)) return 0.5 + (0.1 - 0.5) * ramp(t, [k(11.35), k(11.75)], [0, 1], easeOutSignature);
  if (t < k(12.05)) return 0.1;
  return 0.1 + (0.0001 - 0.1) * ramp(t, [k(12.05), lockAt], [0, 1], easeMassive);
};

/** The full hinge picture, reusable by the 15 s cut. `t` absolute; retimed via lockAt/speed. */
export const HingeCore: React.FC<{ t: number; t0: number; lockAt?: number; speed?: number }> = ({ t, t0, lockAt = 12.6, speed = 1 }) => {
  const spec = useFrameSpec();
  const { W, H, top } = plotSize(spec.aspect);
  const m = makeMap(PLOT.xmin, PLOT.xmax, PLOT.ymin, PLOT.ymax, W, H);

  const h = hOf(t, lockAt, speed);
  const slope = 2 + h;
  const k = (x: number) => lockAt - (12.6 - x) * speed;
  const secantIn = ramp(t, [k(10.04), k(10.52)], [0, 1], easeDrift);
  const chipO = ramp(t, [k(10.3), k(10.62)], [0, 1]);
  const locked = t >= lockAt;
  const pulse = ramp(t, [lockAt, lockAt + 0.05], [0, 1]) * ramp(t, [lockAt + 0.05, lockAt + 0.9], [1, 0], easeDrift);

  const lineColor = interpolateColors(ramp(t, [lockAt - 0.12, lockAt + 0.08], [0, 1]), [0, 1], [C.ink2, C.goldBright]);
  const lineW = 3.6 + 1.9 * ramp(t, [lockAt - 0.1, lockAt + 0.1], [0, 1]);

  // camera: slow push through the shot; a felt push + settle on the lock
  const dolly =
    ramp(t, [lockAt - 2.6 * speed, lockAt + 2.4], [0, 24], easeDrift) +
    26 * ramp(t, [lockAt, lockAt + 0.15], [0, 1], easeOutSignature) * ramp(t, [lockAt + 0.15, lockAt + 1.2], [1, 0.45], easeDrift);
  // rack focus: the equation plane sharpens as the curve softens, once the tangent locks
  const focus = ramp(t, [lockAt + 0.25, lockAt + 1.0], [0, 36], easeDrift);

  // slope readout stages (top-right chip)
  const stageIdx = h > 0.72 ? 0 : h > 0.28 ? 1 : h > 0.045 ? 2 : 3;
  const chips = [
    HINGE.slopeAt(1, '3'),
    HINGE.slopeAt(0.5, '2.5'),
    HINGE.slopeAt(0.1, '2.1'),
    HINGE.resolved,
  ];

  // equation strip (upper-left): quotient → limit → resolved
  const eqPhase = t < lockAt - 0.55 * speed ? 0 : t < lockAt ? 1 : 2;

  return (
    <Stage cam={{ dolly, drift: 0.55, focus, dof: 2.2 }} tOffset={t0}>
      <Plane z={-260}>
        <MathField opacity={0.4} seed={21} count={40} />
      </Plane>

      {/* the plot — hero plane */}
      <Plane z={0} blurScale={1}>
        <div style={{ position: 'absolute', left: (spec.w - W) / 2, top, width: W, height: H }}>
          <svg width={W} height={H} style={{ overflow: 'visible' }}>
            <Axes m={m} {...PLOT} opacity={0.9} />
            {pulse > 0 ? (
              <circle cx={m.x(1)} cy={m.y(1)} r={40 + pulse * 210} fill="none" stroke={C.goldBright} strokeWidth={2.5 * (1 - pulse * 0.7)} opacity={0.5 * (1 - pulse)} />
            ) : null}
            <LitPath d={fnPath(m, (x) => x * x, -0.62, 2.24)} color={C.gold} width={5.5} glow={0.8 + pulse * 1.6} />
            <LitPath
              d={linePath(m, 1, 1, slope, PLOT.xmin + 0.12, PLOT.xmax - 0.12)}
              color={lineColor}
              width={lineW}
              glow={0.35 + pulse * 2.2}
              progress={secantIn}
            />
            <Dot cx={m.x(1)} cy={m.y(1)} r={9} />
            <Dot
              cx={m.x(1 + h)}
              cy={m.y((1 + h) ** 2)}
              r={7.5}
              color={C.ink}
              halo={false}
              opacity={secantIn * ramp(h, [0.004, 0.02], [0, 1])}
            />
          </svg>
          {/* tangent label rides the line after the lock (inboard: its rotated
              corner must clear the side margin even under the dolly's zoom) */}
          <div
            style={{
              position: 'absolute',
              left: m.x(1.8),
              top: m.y(2 * 1.8 - 1) - 56,
              opacity: fadeIO(t, lockAt + 0.55, lockAt + 900, 0.35, 1),
              transform: 'rotate(-31deg)',
            }}
          >
            <TextBox>
              <Tex tex={HINGE.tangentLine} size={30} color={C.goldBright} />
            </TextBox>
          </div>
        </div>
      </Plane>

      {/* the information plane — slightly forward; focus racks to it on the lock.
          Text here sits deeper inside the margins: this plane magnifies ~5% at
          full dolly, and the safe-zone gate measures the projected pixels. */}
      <Plane z={36} blurScale={0.8}>
        <div style={{ position: 'absolute', top: spec.safeTop + 62, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Kicker color={C.gold} tracking="0.32em">
            The idea
          </Kicker>
        </div>

        {/* slope readout chip */}
        <div
          style={{
            position: 'absolute',
            right: spec.safeSide + 44,
            top: spec.safeTop + 132,
            background: C.surface2,
            border: `1px solid ${stageIdx === 3 ? C.goldBorder : C.hairline}`,
            borderRadius: RADIUS.card,
            padding: '16px 24px',
            boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
            opacity: chipO,
          }}
        >
          <TextBox>
            <Tex tex={chips[stageIdx]} size={27} color={stageIdx === 3 ? C.goldBright : C.ink2} />
          </TextBox>
        </div>

        {/* the derivation, upper-left in the curve's negative space */}
        <div style={{ position: 'absolute', left: spec.safeSide + 44, top: spec.aspect === '916' ? 560 : 400, width: 460 }}>
          {eqPhase === 0 ? (
            <TextBox style={{ opacity: fadeIO(t, t0 + 0.2, lockAt - 0.55 * speed, 0.3, 0.25) }}>
              <Tex tex={HINGE.quotient} size={38} color={C.ink} />
            </TextBox>
          ) : eqPhase === 1 ? (
            <TextBox style={{ opacity: fadeIO(t, lockAt - 0.52 * speed, lockAt + 0.1, 0.25, 0.1) }}>
              <Tex tex={HINGE.limit} size={34} color={C.ink} />
            </TextBox>
          ) : (
            <TextBox style={{ opacity: ramp(t, [lockAt + 0.08, lockAt + 0.4], [0, 1]) }}>
              <div style={{ transform: `scale(${1 + pulse * 0.05})`, transformOrigin: 'left center' }}>
                <Tex tex={HINGE.resolved} size={56} color={C.goldBright} />
              </div>
            </TextBox>
          )}
        </div>
      </Plane>
    </Stage>
  );
};

export const TurnHinge: React.FC<{ t0?: number }> = ({ t0 = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + t0;
  return (
    <AbsoluteFill style={{ background: C.page }}>
      <HingeCore t={t} t0={t0} />
    </AbsoluteFill>
  );
};
