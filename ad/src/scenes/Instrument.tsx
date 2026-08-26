import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, RADIUS, TYPE } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane } from '../lib/Stage';
import { Display, Kicker, TextBox, useFrameSpec, w } from '../lib/Type';
import { easeDrift, easeOvershoot, ramp } from '../lib/ease';
import { PANEL_CROSSINGS } from '../data/timeline';

/**
 * S4 — THE INSTRUMENT (20.00–26.50). The feature run: six lit panels of real
 * product surface fly through a depth corridor, each crossing the focal plane
 * on a beat (20.5 … 25.5), capped by the offline line. Every panel is a
 * plausible extension of theme.css v4; every claim matches the shipped
 * marketing (3,44,798 measured; percentile/rivals illustrative, as in the
 * launch reel). This is the flex — but it stays inside the argument: the
 * diagnosis panel, not the streak counter, gets the emphasis.
 */

const SPACING = 340;
const PANEL_W = 620;

// ── the six feature faces ──────────────────────────────────────────────────

const Shell: React.FC<{ kicker: string; children: React.ReactNode }> = ({ kicker, children }) => (
  <div
    style={{
      width: PANEL_W,
      background: `linear-gradient(150deg, rgba(240,236,224,0.06) 0%, rgba(240,236,224,0.015) 40%, rgba(0,0,0,0.12) 100%), ${C.surface2}`,
      border: `1px solid ${C.hairlineStrong}`,
      borderRadius: RADIUS.card,
      boxShadow: '0 26px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(240,236,224,0.09)',
      padding: '26px 32px 30px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}
  >
    <Kicker size={17} color={C.ink3}>
      {kicker}
    </Kicker>
    {children}
  </div>
);

const BankCard: React.FC<{ p: number }> = ({ p }) => (
  <Shell kicker="Question bank · generated on-device">
    <TextBox>
      <div style={{ fontFamily: FONT.serif, fontSize: 92, color: C.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {Math.round(344798 * ramp(p, [0, 0.85], [0, 1], easeDrift)).toLocaleString('en-IN')}
      </div>
    </TextBox>
    <TextBox>
      <span style={{ fontFamily: FONT.serif, fontSize: 22, color: C.ink2 }}>distinct questions · every one fresh</span>
    </TextBox>
  </Shell>
);

const MapCard: React.FC<{ p: number }> = ({ p }) => {
  // deterministic constellation
  const nodes = Array.from({ length: 22 }, (_, i) => {
    let h = (2166136261 ^ (i * 16777619)) >>> 0;
    const rnd = () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 4294967296;
    };
    return { x: 30 + rnd() * 500, y: 16 + rnd() * 210, r: 4 + rnd() * 6, m: rnd() };
  });
  const edges: [number, number][] = [];
  nodes.forEach((n, i) => {
    let best = -1;
    let bd = 1e9;
    nodes.forEach((o, j) => {
      if (j === i) return;
      const d = (n.x - o.x) ** 2 + (n.y - o.y) ** 2;
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best > i) edges.push([i, best]);
  });
  const dp = ramp(p, [0, 0.9], [0, 1], easeDrift);
  return (
    <Shell kicker="Knowledge map · every topic, one web">
      <svg width={560} height={240} style={{ overflow: 'visible' }}>
        {edges.map(([a, b], k) => (
          <line
            key={k}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke={C.gold}
            strokeWidth={1.5}
            opacity={0.65 * ramp(dp, [k / edges.length, Math.min(1, k / edges.length + 0.25)], [0, 1])}
          />
        ))}
        {nodes.map((n, k) => (
          <circle
            key={k}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.m > 0.55 ? C.goldBright : C.surface3}
            stroke={C.gold}
            strokeWidth={1.4}
            opacity={ramp(dp, [k / nodes.length, Math.min(1, k / nodes.length + 0.2)], [0, 1])}
          />
        ))}
      </svg>
    </Shell>
  );
};

const DiagCard: React.FC<{ p: number }> = ({ p }) => (
  <Shell kicker="Priorities · why this next">
    <TextBox style={{ opacity: ramp(p, [0.1, 0.5], [0, 1]) }}>
      <div style={{ fontFamily: FONT.serif, fontSize: 33, color: C.ink, lineHeight: 1.35 }}>
        Not quite. You keep flipping the sign when terms move.
      </div>
    </TextBox>
    <TextBox style={{ opacity: ramp(p, [0.4, 0.8], [0, 1]) }}>
      <div
        style={{
          display: 'inline-block',
          fontFamily: FONT.serif,
          fontSize: 20,
          color: C.goldBright,
          border: `1px solid ${C.goldBorder}`,
          background: C.goldSoft,
          borderRadius: RADIUS.control,
          padding: '7px 14px',
        }}
      >
        misconception traced → practise: linear equations
      </div>
    </TextBox>
  </Shell>
);

const PercCard: React.FC<{ p: number }> = ({ p }) => (
  <Shell kicker="Predicted percentile · from your practice">
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
      <TextBox>
        <div style={{ fontFamily: FONT.serif, fontSize: 108, color: C.goldBright, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {(96.4 * ramp(p, [0, 0.8], [0.86, 1], easeOvershoot)).toFixed(1)}
        </div>
      </TextBox>
      <TextBox>
        <span style={{ fontFamily: FONT.serif, fontSize: 26, color: C.ink2 }}>%ile · trajectory ↗</span>
      </TextBox>
    </div>
    <TextBox>
      <span style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 17, color: C.ink3 }}>
        estimate from your practice data — not a guarantee of results
      </span>
    </TextBox>
  </Shell>
);

const MatchCard: React.FC<{ p: number }> = ({ p }) => {
  const lanes = [
    { name: 'You', v: 0.92, you: true },
    { name: 'Ishaan', v: 0.78 },
    { name: 'Kabir', v: 0.66 },
  ];
  return (
    <Shell kicker="Match mode · race live rivals">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lanes.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <TextBox>
              <span style={{ fontFamily: FONT.serif, fontSize: 21, color: l.you ? C.ink : C.ink3, width: 84, display: 'inline-block' }}>{l.name}</span>
            </TextBox>
            <div style={{ flex: 1, height: 12, background: C.surface3, borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${l.v * 100 * ramp(p, [0.05 + i * 0.08, 0.8], [0.4, 1], easeDrift)}%`,
                  height: '100%',
                  background: l.you ? C.cream : C.ink3,
                  borderRadius: 999,
                }}
              />
            </div>
            {l.you ? (
              <TextBox>
                <span style={{ fontFamily: FONT.serif, fontSize: 20, color: C.goldBright }}>♛</span>
              </TextBox>
            ) : null}
          </div>
        ))}
      </div>
      <TextBox>
        <span style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 16, color: C.ink3 }}>rivals illustrative · all on-device</span>
      </TextBox>
    </Shell>
  );
};

const MockCard: React.FC<{ p: number }> = ({ p }) => {
  const rows = [
    { c: 'Substitution t = cos x', ok: true, m: '2' },
    { c: 'Limits transformed', ok: true, m: '2' },
    { c: 'Exact value stated', ok: false, m: '1' },
  ];
  return (
    <Shell kicker="Full mocks · criteria marking">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r, i) => {
          const rp = ramp(p, [0.08 + i * 0.14, 0.35 + i * 0.14], [0, 1]);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: rp, borderBottom: `1px solid ${C.hairlineFaint}`, paddingBottom: 8 }}>
              <TextBox>
                <span style={{ fontFamily: FONT.serif, fontSize: 24, color: r.ok ? C.good : C.bad }}>{r.ok ? '✓' : '✗'}</span>
              </TextBox>
              <TextBox>
                <span style={{ fontFamily: FONT.serif, fontSize: 21, color: C.ink2, flex: 1 }}>{r.c}</span>
              </TextBox>
              <TextBox>
                <span style={{ fontFamily: FONT.serif, fontSize: 20, color: C.ink3 }}>{r.m}</span>
              </TextBox>
            </div>
          );
        })}
      </div>
      <TextBox style={{ opacity: ramp(p, [0.6, 0.9], [0, 1]) }}>
        <div style={{ alignSelf: 'flex-start', display: 'inline-block', fontFamily: FONT.serif, fontSize: 27, color: C.goldBright, border: `1px solid ${C.goldBorder}`, borderRadius: RADIUS.control, padding: '6px 16px' }}>
          4 / 5 · method marks kept
        </div>
      </TextBox>
    </Shell>
  );
};

const FACES = [BankCard, MapCard, DiagCard, PercCard, MatchCard, MockCard];

// ── the corridor ───────────────────────────────────────────────────────────

export const Instrument: React.FC<{ t0?: number }> = ({ t0 = 20 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps + t0;

  // depth progress: panel i (z = −(200 + i·SPACING)) crosses the screen plane
  // exactly at PANEL_CROSSINGS[i]; velocity dips between beats, never stops
  const depth =
    200 * ramp(t, [t0 + 0.05, PANEL_CROSSINGS[0]], [0, 1], easeDrift) +
    PANEL_CROSSINGS.slice(1).reduce((acc, tc) => acc + SPACING * ramp(t, [tc - 0.8, tc], [0, 1], easeDrift), 0) +
    120 * ramp(t, [25.5, 26.5], [0, 1], easeDrift);

  const offlineO = t >= 25.55;

  return (
    <AbsoluteFill style={{ background: C.page, opacity: ramp(t, [t0, t0 + 0.3], [0, 1]) }}>
      <Stage cam={{ dolly: depth, focus: -depth, drift: 0.5, dof: 1.9 }} tOffset={t0}>
        <Plane z={-depth} blurScale={0}>
          <div style={{ position: 'absolute', top: spec.safeTop + 62, width: '100%', display: 'flex', justifyContent: 'center', opacity: ramp(t, [t0 + 0.2, t0 + 0.7], [0, 1]) * ramp(t, [25.3, 25.6], [1, 0]) }}>
            <Kicker color={C.gold} tracking="0.32em">
              The instrument
            </Kicker>
          </div>
        </Plane>
        <Plane z={-260 - 1900} blurScale={0.4}>
          <MathField opacity={0.3} seed={63} count={40} parallax={depth * 0.02} />
        </Plane>
        {FACES.map((Face, i) => {
          const z = -(200 + i * SPACING);
          const rel = z + depth; // 0 = in focus at the screen plane
          // fade in from the deep, die before growing past the margins
          const o = ramp(rel, [-1250, -820], [0, 1]) * ramp(rel, [55, 135], [1, 0]);
          if (o <= 0.002) return null;
          const cross = PANEL_CROSSINGS[i];
          const p = ramp(t, [cross - 0.85, cross + 0.15], [0, 1]);
          const side = i % 2 === 0 ? -1 : 1;
          return (
            <Plane key={i} z={z} blurScale={0.85}>
              <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: o }}>
                <div
                  style={{
                    transform: `translateX(${side * 78}px) translateY(${spec.aspect === '916' ? -150 : spec.aspect === '45' ? -60 : -20}px) rotateY(${side * -4.5}deg)`,
                  }}
                >
                  <Face p={p} />
                </div>
              </AbsoluteFill>
            </Plane>
          );
        })}
      </Stage>

      {/* the run's punchline — set type, still frame, brand truth */}
      {offlineO ? (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Display
            words={w('All of it *offline.*')}
            size={spec.aspect === '916' ? TYPE.s4 : TYPE.s3}
            wordAt={[25.6 - t0, 25.6 - t0, 25.72 - t0]}
            landDur={0.22}
            mode="rise"
            style={{ maxWidth: spec.w - spec.safeSide * 2 - 60, textAlign: 'center' }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
