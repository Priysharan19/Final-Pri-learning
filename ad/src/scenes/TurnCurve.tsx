import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Kicker, useFrameSpec } from '../lib/Type';
import { easeDrift, ramp } from '../lib/ease';
import { Axes, Dot, LitPath, fnPath, makeMap } from '../lib/plots';

// Shared plot geometry for the whole Turn act.
export const PLOT = {
  xmin: -0.7,
  xmax: 2.7,
  ymin: -0.9,
  ymax: 5.3,
};

export const plotSize = (aspect: string): { W: number; H: number; top: number } =>
  aspect === '916' ? { W: 940, H: 1010, top: 360 } : aspect === '45' ? { W: 860, H: 760, top: 240 } : { W: 780, H: 620, top: 190 };

/**
 * S3a — THE CURVE (8.00–10.00 abs). Out of near-silence, y = x² draws itself
 * in a lit dark space. The formula card from the factory, but alive.
 */
export const TurnCurve: React.FC<{ t0?: number }> = ({ t0 = 8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps + t0;

  const { W, H, top } = plotSize(spec.aspect);
  const m = makeMap(PLOT.xmin, PLOT.xmax, PLOT.ymin, PLOT.ymax, W, H);

  const bloom = ramp(t, [8.0, 8.7], [0, 1], easeDrift);
  const axesP = ramp(t, [8.1, 8.8], [0, 1], easeDrift);
  const curveP = ramp(t, [8.35, 9.7], [0, 1], easeDrift);
  const dotO = ramp(t, [9.65, 9.95], [0, 1]);
  const dolly = ramp(t, [8.0, 10.0], [-70, 0], easeDrift);
  const kickerO = ramp(t, [8.5, 9.0], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.page, opacity: ramp(t, [8.0, 8.35], [0, 1]) }}>
      <Stage cam={{ dolly, drift: 0.55, focus: 0, dof: 2.2, roll: ramp(t, [8.0, 10.0], [-0.8, -0.55], easeDrift) }} tOffset={t0}>
        <Plane z={-260}>
          <MathField opacity={0.4 * bloom} seed={21} count={40} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <div style={{ position: 'absolute', top: spec.safeTop + 26, width: '100%', display: 'flex', justifyContent: 'center', opacity: kickerO }}>
            <Kicker color={C.gold} tracking="0.32em">
              The idea
            </Kicker>
          </div>
          <div style={{ position: 'absolute', left: (spec.w - W) / 2, top, width: W, height: H }}>
            <svg width={W} height={H} style={{ overflow: 'visible' }}>
              <Axes m={m} {...PLOT} progress={axesP} opacity={0.9} />
              <LitPath d={fnPath(m, (x) => x * x, -0.62, 2.24)} progress={curveP} color={C.gold} width={5.5} glow={0.8 * bloom} />
              {/* the ember from the seize card lands here and becomes the curve */}
              <Dot
                cx={m.x(-0.62)}
                cy={m.y(0.3844)}
                r={7}
                color={C.goldBright}
                opacity={ramp(t, [8.0, 8.12], [1, 1]) * ramp(t, [8.25, 8.65], [1, 0])}
              />
              <Dot cx={m.x(1)} cy={m.y(1)} opacity={dotO} />
            </svg>
          </div>
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};
