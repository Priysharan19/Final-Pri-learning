import React from 'react';
import { C } from '../design/tokens';

// SVG plot primitives for the film's mathematics. All geometry is computed,
// never eyeballed: the curves ARE the functions.

export interface Map2D {
  x: (wx: number) => number;
  y: (wy: number) => number;
}

export const makeMap = (
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  W: number,
  H: number,
): Map2D => ({
  x: (wx) => ((wx - xmin) / (xmax - xmin)) * W,
  y: (wy) => H - ((wy - ymin) / (ymax - ymin)) * H,
});

export const fnPath = (m: Map2D, f: (x: number) => number, x0: number, x1: number, n = 90): string => {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    d += `${i === 0 ? 'M' : 'L'}${m.x(x).toFixed(2)},${m.y(f(x)).toFixed(2)}`;
  }
  return d;
};

/** A line through (px,py) with slope s, clipped to world x∈[x0,x1]. */
export const linePath = (m: Map2D, px: number, py: number, s: number, x0: number, x1: number): string =>
  `M${m.x(x0).toFixed(2)},${m.y(py + s * (x0 - px)).toFixed(2)}L${m.x(x1).toFixed(2)},${m.y(py + s * (x1 - px)).toFixed(2)}`;

export const Axes: React.FC<{ m: Map2D; xmin: number; xmax: number; ymin: number; ymax: number; progress?: number; opacity?: number }> = ({
  m,
  xmin,
  xmax,
  ymin,
  ymax,
  progress = 1,
  opacity = 1,
}) => (
  <g opacity={opacity}>
    <path
      d={`M${m.x(xmin)},${m.y(0)}L${m.x(xmax)},${m.y(0)}`}
      stroke={C.hairlineStrong}
      strokeWidth={1.5}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
      fill="none"
    />
    <path
      d={`M${m.x(0)},${m.y(ymin)}L${m.x(0)},${m.y(ymax)}`}
      stroke={C.hairlineStrong}
      strokeWidth={1.5}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
      fill="none"
    />
  </g>
);

/** Gold stroke with a soft light bloom behind it — the "lit object" treatment. */
export const LitPath: React.FC<{
  d: string;
  progress?: number;
  color?: string;
  width?: number;
  glow?: number;
  opacity?: number;
}> = ({ d, progress = 1, color = C.gold, width = 5, glow = 0.55, opacity = 1 }) => (
  <g opacity={opacity}>
    <path
      d={d}
      stroke={color}
      strokeWidth={width * 3.4}
      fill="none"
      opacity={0.16 * glow}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
      strokeLinecap="round"
      style={{ filter: `blur(${width * 1.6}px)` }}
    />
    <path
      d={d}
      stroke={color}
      strokeWidth={width}
      fill="none"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
      strokeLinecap="round"
    />
  </g>
);

export const Dot: React.FC<{ cx: number; cy: number; r?: number; color?: string; halo?: boolean; opacity?: number }> = ({
  cx,
  cy,
  r = 9,
  color = C.goldBright,
  halo = true,
  opacity = 1,
}) => (
  <g opacity={opacity}>
    {halo ? <circle cx={cx} cy={cy} r={r * 2.6} fill={color} opacity={0.16} style={{ filter: `blur(${r * 0.8}px)` }} /> : null}
    <circle cx={cx} cy={cy} r={r} fill={color} />
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
  </g>
);
