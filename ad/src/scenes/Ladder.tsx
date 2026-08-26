import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, TYPE } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Kicker, TextBox, useFrameSpec } from '../lib/Type';
import { Tex } from '../lib/Tex';
import { easeDrift, easeMassive, ramp } from '../lib/ease';
import { Axes, Dot, LitPath, fnPath, linePath, makeMap } from '../lib/plots';
import { LADDER } from '../math/expressions';

/**
 * S4 — THE LADDER (20.00–27.00). One continuous upward camera move past five
 * stations — the same motif (a line touching a curve) at five pressures.
 * Not four products; one ladder. The Olympiad station answers the seize.
 */

// station transitions relative to the act start (on beats)
const MOVES_REL = [1.2, 2.3, 3.4, 4.6];

const Motif: React.FC<{ index: number; p: number; size: number }> = ({ index, p, size }) => {
  const W = size;
  const H = size * 0.78;
  const gold = C.gold;

  if (index === 0) {
    // Class 7 — slope: y = 2x with rise/run staircase
    const m = makeMap(-0.6, 3.1, -1.1, 6.3, W, H);
    return (
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Axes m={m} xmin={-0.6} xmax={3.1} ymin={-1.1} ymax={6.3} opacity={0.8} />
        <LitPath d={linePath(m, 0, 0, 2, -0.45, 2.9)} progress={p} color={gold} width={4.5} glow={0.5} />
        {/* run 1, rise 2 — the staircase */}
        <path
          d={`M${m.x(1)},${m.y(2)}L${m.x(2)},${m.y(2)}L${m.x(2)},${m.y(4)}`}
          stroke={C.ink2}
          strokeWidth={2.5}
          strokeDasharray="7 7"
          fill="none"
          opacity={ramp(p, [0.5, 1], [0, 0.9])}
        />
        <Dot cx={m.x(1)} cy={m.y(2)} r={6} halo={false} color={C.ink} opacity={p} />
        <Dot cx={m.x(2)} cy={m.y(4)} r={6} halo={false} color={C.ink} opacity={p} />
      </svg>
    );
  }
  if (index === 1) {
    // Class 10 — tangent ⊥ radius at the point of contact
    const cx = W * 0.42;
    const cy = H * 0.52;
    const r = H * 0.34;
    // contact point at 40°; tangent is perpendicular to the radius there
    const a = (-40 * Math.PI) / 180;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    const L1 = W * 0.52; // toward the lower left
    const L2 = W * 0.34; // toward the header — kept clear of the type
    const circ = 2 * Math.PI * r;
    return (
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={gold}
          strokeWidth={4.5}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - p)}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <path d={`M${cx},${cy}L${px},${py}`} stroke={C.ink2} strokeWidth={3} opacity={ramp(p, [0.55, 0.9], [0, 1])} />
        <path
          d={`M${px - tx * L2},${py - ty * L2}L${px + tx * L1},${py + ty * L1}`}
          stroke={C.goldBright}
          strokeWidth={4}
          opacity={ramp(p, [0.65, 1], [0, 1])}
        />
        {/* right-angle marker at the contact point */}
        <path
          d={(() => {
            const s = 16;
            const ux = Math.cos(a);
            const uy = Math.sin(a);
            const q1x = px - ux * s;
            const q1y = py - uy * s;
            return `M${q1x + tx * s},${q1y + ty * s}L${q1x},${q1y}L${px + tx * s},${py + ty * s}`;
          })()}
          stroke={C.ink}
          strokeWidth={2.5}
          fill="none"
          opacity={ramp(p, [0.8, 1], [0, 1])}
        />
        <Dot cx={px} cy={py} r={7} opacity={ramp(p, [0.7, 1], [0, 1])} />
      </svg>
    );
  }
  if (index === 2) {
    // Class 12 — the derivative: the hinge, miniature
    const m = makeMap(-0.6, 2.5, -0.9, 4.9, W, H);
    return (
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Axes m={m} xmin={-0.6} xmax={2.5} ymin={-0.9} ymax={4.9} opacity={0.8} />
        <LitPath d={fnPath(m, (x) => x * x, -0.55, 2.15)} progress={p} color={gold} width={4.5} glow={0.5} />
        <LitPath d={linePath(m, 1, 1, 2, -0.35, 2.35)} progress={ramp(p, [0.45, 1], [0, 1])} color={C.goldBright} width={3.5} glow={0.4} />
        <Dot cx={m.x(1)} cy={m.y(1)} r={7} opacity={ramp(p, [0.6, 1], [0, 1])} />
      </svg>
    );
  }
  if (index === 3) {
    // JEE — tangent to y² = 4x at (1, 2)
    const m = makeMap(-1.4, 4.6, -4.4, 4.6, W, H);
    const par = (() => {
      let d = '';
      const n = 80;
      for (let i = 0; i <= n; i++) {
        const y = -4.1 + (8.2 * i) / n;
        const x = (y * y) / 4;
        d += `${i === 0 ? 'M' : 'L'}${m.x(x).toFixed(2)},${m.y(y).toFixed(2)}`;
      }
      return d;
    })();
    return (
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Axes m={m} xmin={-1.4} xmax={4.6} ymin={-4.4} ymax={4.6} opacity={0.8} />
        <LitPath d={par} progress={p} color={gold} width={4.5} glow={0.5} />
        {/* x − y + 1 = 0 → y = x + 1 */}
        <LitPath d={linePath(m, 1, 2, 1, -1.2, 3.4)} progress={ramp(p, [0.45, 1], [0, 1])} color={C.goldBright} width={3.5} glow={0.4} />
        <Dot cx={m.x(1)} cy={m.y(2)} r={7} opacity={ramp(p, [0.6, 1], [0, 1])} />
      </svg>
    );
  }
  // Olympiad — eˣ ≥ 1 + x: the seize question, now a two-line proof
  const m = makeMap(-2.3, 1.7, -1.5, 3.6, W, H);
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <Axes m={m} xmin={-2.3} xmax={1.7} ymin={-1.5} ymax={3.6} opacity={0.8} />
      {/* the gap between curve and tangent, softly gold — the inequality made visible */}
      <path
        d={(() => {
          let d = '';
          const n = 60;
          for (let i = 0; i <= n; i++) {
            const x = -2.25 + (3.5 * i) / n;
            d += `${i === 0 ? 'M' : 'L'}${m.x(x).toFixed(2)},${m.y(Math.exp(x)).toFixed(2)}`;
          }
          for (let i = n; i >= 0; i--) {
            const x = -2.25 + (3.5 * i) / n;
            d += `L${m.x(x).toFixed(2)},${m.y(1 + x).toFixed(2)}`;
          }
          return d + 'Z';
        })()}
        fill={C.gold}
        opacity={0.1 * ramp(p, [0.6, 1], [0, 1])}
      />
      <LitPath d={fnPath(m, (x) => Math.exp(x), -2.25, 1.25)} progress={p} color={gold} width={4.5} glow={0.6} />
      <LitPath d={linePath(m, 0, 1, 1, -2.2, 1.5)} progress={ramp(p, [0.4, 1], [0, 1])} color={C.goldBright} width={3.5} glow={0.4} />
      <Dot cx={m.x(0)} cy={m.y(1)} r={7} opacity={ramp(p, [0.55, 1], [0, 1])} />
    </svg>
  );
};

export const LadderStation: React.FC<{ index: number; p: number; motifSize: number }> = ({ index, p, motifSize }) => {
  const st = LADDER[index];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
      {index === 4 ? (
        <div
          style={{
            opacity: ramp(p, [0.3, 0.6], [0, 1]),
            border: `1px solid ${C.goldBorder}`,
            background: 'rgba(201,173,99,0.10)',
            borderRadius: 6,
            padding: '8px 18px',
            marginBottom: 2,
          }}
        >
          <Kicker size={17} color={C.goldBright}>
            Question 1 · solved
          </Kicker>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, opacity: ramp(p, [0.05, 0.4], [0, 1]) }}>
        <Kicker size={30} color={C.ink}>
          {st.label}
        </Kicker>
        <Kicker size={19} color={C.gold}>
          {st.kicker}
        </Kicker>
      </div>
      <Motif index={index} p={ramp(p, [0.08, 0.85], [0, 1], easeDrift)} size={motifSize} />
      <TextBox style={{ opacity: ramp(p, [0.35, 0.7], [0, 1]) }}>
        <Tex tex={st.tex} size={46} color={C.ink} />
      </TextBox>
      <TextBox style={{ opacity: ramp(p, [0.5, 0.85], [0, 1]) }}>
        <span style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 24, color: C.ink3 }}>{st.note}</span>
      </TextBox>
    </div>
  );
};

export const Ladder: React.FC<{ t0?: number }> = ({ t0 = 26.5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps + t0;

  const gap = spec.aspect === '916' ? 1060 : spec.aspect === '45' ? 860 : 760;
  const motifSize = spec.aspect === '916' ? 560 : 450;

  // continuous pedestal move: one station per beat-pair, gliding with mass
  const moves = MOVES_REL.map((x) => t0 + x);
  const climbed = moves.reduce(
    (acc, mv, i) => acc + ramp(t, [mv - 0.25, mv + 0.35], [0, 1], i % 2 === 0 ? easeMassive : easeDrift),
    0,
  );
  // ...plus a slow constant creep so no hold is ever a dead frame
  const worldY = climbed * gap + ramp(t, [t0, t0 + 6.5], [0, 120], easeDrift);

  const enterO = ramp(t, [t0, t0 + 0.4], [0, 1]);
  const stationTop = spec.aspect === '916' ? 520 : spec.aspect === '45' ? 330 : 240;

  return (
    <AbsoluteFill style={{ background: C.page, opacity: enterO }}>
      <Stage cam={{ drift: 0.5, dof: 1.6, focus: 0 }} tOffset={t0}>
        <Plane z={-260}>
          <MathField opacity={0.3} seed={45} count={36} parallax={worldY * 0.04} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-worldY}px)` }}>
            {/* the rail — one ladder, literally */}
            <div
              style={{
                position: 'absolute',
                left: spec.safeSide - 26,
                top: -gap * 0.5,
                width: 1,
                height: gap * (LADDER.length + 1),
                background: `linear-gradient(180deg, transparent, ${C.goldBorder} 8%, ${C.goldBorder} 92%, transparent)`,
                opacity: 0.6,
              }}
            />
            {LADDER.map((_, i) => {
              const arrive = i === 0 ? t0 : moves[i - 1];
              const p = ramp(t, [arrive - 0.45, arrive + 0.55], [0, 1]);
              // the focus window: stations exist only near the camera — they
              // emerge from the dark below and recede above (and never leak
              // text into the IG zones from off-screen)
              const delta = i * gap - worldY;
              const windowO = ramp(Math.abs(delta), [gap * 0.22, gap * 0.5], [1, 0]);
              if (windowO <= 0.001) return null;
              return (
                <div key={i} style={{ position: 'absolute', top: stationTop + i * gap, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: windowO }}>
                  {/* rail node */}
                  <div
                    style={{
                      position: 'absolute',
                      left: spec.safeSide - 33,
                      top: 10,
                      width: 15,
                      height: 15,
                      borderRadius: 999,
                      background: p > 0.3 ? C.gold : C.surface3,
                      border: `1px solid ${C.goldBorder}`,
                      transition: 'none',
                    }}
                  />
                  <LadderStation index={i} p={p} motifSize={Math.round(motifSize * (1 + i * 0.045))} />
                </div>
              );
            })}
          </div>
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};
