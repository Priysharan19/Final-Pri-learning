import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, RADIUS, TYPE } from '../design/tokens';
import { Stage, Plane } from '../lib/Stage';
import { Display, Kicker, TextBox, useFrameSpec, w } from '../lib/Type';
import { Tex } from '../lib/Tex';
import { easeSnap, ramp } from '../lib/ease';
import { FACTORY_CARDS, SEIZE_QUESTION } from '../math/expressions';

/**
 * S2 — THE FACTORY (1.50–8.00 abs). Pattern-recall made visible: identical
 * formula cards stamped onto a conveyor grid, one per beat, until a question
 * that matches no pattern seizes the machine. Deliberately flat light and
 * locked-off camera — the rigidity is the characterisation. The film's first
 * stillness beat lives at the end of this scene.
 */

const CARD_W = 284;
const CARD_H = 150;
const GAP = 20;
const SEIZE = 6.5; // absolute

const Card: React.FC<{ tex: string; hero?: boolean; style?: React.CSSProperties }> = ({ tex, hero, style }) => (
  <div
    style={{
      width: CARD_W,
      height: CARD_H,
      background: C.surface,
      border: `1px solid ${hero ? C.hairlineStrong : C.hairline}`,
      borderRadius: RADIUS.card,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...style,
    }}
  >
    <TextBox>
      <Tex tex={tex} size={26} color={hero ? C.ink : C.ink2} />
    </TextBox>
  </div>
);

/** Reusable core (also drives the 15 s cut). `t` is absolute seconds; `compress` speeds the ritual up. */
export const FactoryGrid: React.FC<{ t: number; start: number; seizeAt: number; compress?: number; rows?: number }> = ({
  t,
  start,
  seizeAt,
  compress = 1,
  rows = 3,
}) => {
  const spec = useFrameSpec();
  // the machine's clock stops dead at the seize
  const tt = Math.min(t, seizeAt);
  const beat = 0.5 / compress;

  const cols = 3;
  const gridW = cols * CARD_W + (cols - 1) * GAP;

  // Phase 1: cards stamp in sequentially, one per beat.
  const stampCount = Math.max(0, Math.floor((tt - start) / beat) + 1);

  // Phase 2 (after `multAt`): the conveyor — every new row is the SAME card.
  const multAt = start + 6 * beat;
  const rowShift = Math.max(0, (tt - multAt) / (beat * 0.75));
  const shiftRows = Math.floor(rowShift);
  const shiftFrac = ramp(rowShift - shiftRows, [0.55, 1], [0, 1], easeSnap);

  // stamp impact jolt: a hard 3px hit decaying over 0.1 s after each stamp/row-land
  const lastEvent =
    tt < multAt ? start + (stampCount - 1) * beat : multAt + shiftRows * (beat * 0.75);
  const sinceEvent = tt - lastEvent;
  const jolt = sinceEvent >= 0 && sinceEvent < 0.1 ? (1 - sinceEvent / 0.1) * 3 : 0;

  const frozen = t >= seizeAt;
  const dim = frozen ? ramp(t, [seizeAt, seizeAt + 0.35], [1, 0.35]) : 1;

  const totalRows = rows + 2;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < cols; c++) {
      const absRow = r + shiftRows;
      const idx = absRow * cols + c;
      // before the conveyor starts, only stamped cards exist
      const stampedIn = idx < stampCount || absRow >= Math.ceil((multAt - start) / beat / cols) + 1;
      const isConveyorRow = absRow * cols >= 6;
      const texIdx = isConveyorRow ? 0 : idx % FACTORY_CARDS.length; // sameness: the d/dx card, again and again
      if (!stampedIn && !isConveyorRow) continue;

      // stamp scale-in with a mechanical snap (no settle)
      const stampT = start + idx * beat;
      const p = isConveyorRow ? 1 : ramp(tt, [stampT, stampT + 0.16], [0, 1], easeSnap);
      if (p <= 0) continue;

      // the card stuck mid-stamp when the machine seizes
      const stuck = frozen && r === 1 && c === 1;

      cells.push(
        <div
          key={`${absRow}-${c}`}
          style={{
            position: 'absolute',
            left: c * (CARD_W + GAP),
            top: r * (CARD_H + GAP) - shiftFrac * (CARD_H + GAP),
            transform: stuck
              ? `scale(1.06) rotate(2.1deg)`
              : `scale(${1.22 - 0.22 * p})`,
            opacity: p,
          }}
        >
          <Card tex={FACTORY_CARDS[texIdx]} hero={texIdx === 0 && isConveyorRow} />
        </div>,
      );
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: (spec.w - gridW) / 2,
        top: spec.aspect === '916' ? 620 : spec.aspect === '45' ? 430 : 330,
        width: gridW,
        height: rows * (CARD_H + GAP),
        overflow: 'hidden',
        opacity: dim,
        transform: `translateY(${jolt}px)`,
        maskImage: 'linear-gradient(180deg, transparent 0%, black 7%, black 90%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 7%, black 90%, transparent 100%)',
      }}
    >
      {cells}
    </div>
  );
};

/** The unseen question, arriving like a spanner in the works. */
export const SeizeCard: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const spec = useFrameSpec();
  const p = ramp(t, [at, at + 0.55], [0, 1]);
  const rise = (1 - p) * 260;
  if (p <= 0) return null;
  // a barely-visible tremble — the machine straining (then true stillness)
  const tremble = t < at + 0.9 ? Math.sin(t * 71) * 0.6 * (1 - ramp(t, [at + 0.4, at + 0.9], [0, 1])) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: spec.aspect === '916' ? 900 : spec.aspect === '45' ? 620 : 480,
        transform: `translate(-50%, ${rise + tremble}px)`,
        opacity: p,
        width: Math.min(720, spec.w - spec.safeSide * 2),
        background: C.surface2,
        border: `1px solid ${C.goldBorder}`,
        borderRadius: RADIUS.card,
        padding: '38px 44px',
        boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        alignItems: 'center',
      }}
    >
      <Kicker size={20} color={C.gold}>
        Question 1 · unseen
      </Kicker>
      <TextBox>
        <Tex tex={SEIZE_QUESTION} size={31} color={C.ink} />
      </TextBox>
    </div>
  );
};

export const Factory: React.FC<{ t0?: number }> = ({ t0 = 1.5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps + t0;

  const kickerO = ramp(t, [1.6, 2.0], [0, 1]) * ramp(t, [6.5, 6.9], [1, 0.4]);

  return (
    <AbsoluteFill style={{ background: C.page }}>
      {/* the rank-list wall — sameness as wallpaper */}
      <AbsoluteFill style={{ opacity: 0.07, overflow: 'hidden' }}>
        {Array.from({ length: 26 }, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: i * 78 - ((Math.min(t, SEIZE) * 26) % 78),
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: FONT.serif,
              fontSize: 22,
              letterSpacing: '0.3em',
              color: C.ink3,
              whiteSpace: 'nowrap',
            }}
          >
            {`BATCH ${7 + (i % 3)}A · ROLL ${String(401 + i).padStart(3, '0')} · SAME DRILL · SAME DESK · `.repeat(2)}
          </div>
        ))}
      </AbsoluteFill>

      {/* locked-off camera: drift 0 — the only motion is the machine's */}
      <Stage cam={{ drift: 0, dof: 0 }}>
        <Plane z={0} blurScale={0}>
          <div style={{ position: 'absolute', top: spec.safeTop + 26, width: '100%', display: 'flex', justifyContent: 'center', opacity: kickerO }}>
            <Kicker>The factory</Kicker>
          </div>

          {/* headline beats (from data/timeline.ts) */}
          <div
            style={{
              position: 'absolute',
              top: spec.aspect === '916' ? 380 : spec.aspect === '45' ? 230 : 160,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {t >= 2.5 && t < 4.55 ? (
              <Display words={w('Memorise. Repeat.')} size={TYPE.s4} wordAt={[2.5, 3.0].map((s) => s - t0)} landDur={0.2} mode="slam" exitAt={4.3 - t0} />
            ) : null}
            {t >= 4.6 && t <= 6.45 ? (
              <Display
                words={w('Four hundred formulas. *No* *ideas.*')}
                size={70}
                wordAt={[4.6, 4.6, 4.6, 5.1, 5.1].map((s) => s - t0)}
                landDur={0.22}
                mode="rise"
                exitAt={6.25 - t0}
                style={{ maxWidth: spec.w - spec.safeSide * 2 }}
              />
            ) : null}
          </div>

          <FactoryGrid t={t} start={1.5} seizeAt={SEIZE} />
          <SeizeCard t={t} at={SEIZE} />
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};
