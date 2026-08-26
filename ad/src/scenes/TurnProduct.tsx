import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, RADIUS } from '../design/tokens';
import { MathField } from '../lib/Film';
import { Stage, Plane, LitPanel } from '../lib/Stage';
import { Kicker, TextBox, useFrameSpec } from '../lib/Type';
import { Tex } from '../lib/Tex';
import { easeDrift, easeOvershoot, ramp } from '../lib/ease';
import { LitPath, fnPath, linePath, makeMap } from '../lib/plots';
import { PRODUCT } from '../math/expressions';

/**
 * S3c/S3d — THE IDEAL PRODUCT (15.00–17.50) and MARKED (17.50–20.00).
 * The seize question returns — inside Pri Learning. The app offers the idea,
 * the student writes the close in real ink, and examiner marks land on it.
 * One panel, two phases; the ideal interface is a plausible extension of
 * theme.css v4 (hairlines, small caps, gold only where the maths earns it).
 */

const MARK_TIMES = [18.0, 18.5, 19.0]; // absolute, on beats
const MARKS = ['M1', 'M1', 'A1'];

export const ProductPanel: React.FC<{ t: number; enterAt: number; inkAt: number; markAt?: number[]; verdictAt?: number; speed?: number }> = ({
  t,
  enterAt,
  inkAt,
  markAt = MARK_TIMES,
  verdictAt = 19.3,
  speed = 1,
}) => {
  const spec = useFrameSpec();
  const enter = ramp(t, [enterAt, enterAt + 0.55 * speed], [0, 1], easeDrift);
  // as the act ends the panel falls back into depth — the corridor inherits it
  const recede = ramp(t, [19.5, 20.0], [0, 1], easeDrift);
  // 40px of zoom headroom for the dolly-in
  const panelW = Math.min(850, spec.w - spec.safeSide * 2 - 20);

  // the small e^x picture: curve then its tangent at 0
  const PW = 356;
  const PH = 256;
  const m = makeMap(-2.1, 1.7, -0.9, 3.4, PW, PH);
  const curveP = ramp(t, [enterAt + 0.35 * speed, enterAt + 1.1 * speed], [0, 1], easeDrift);
  const tanP = ramp(t, [enterAt + 0.8 * speed, enterAt + 1.5 * speed], [0, 1], easeDrift);

  // the student's ink writes on
  const inkP = ramp(t, [inkAt, inkAt + 1.05 * speed], [0, 1], easeDrift);

  const rows: { label: string; mark: string; at: number }[] = PRODUCT.ticks.map((label, i) => ({
    label,
    mark: MARKS[i],
    at: markAt[i],
  }));

  const verdictP = ramp(t, [verdictAt, verdictAt + 0.3], [0, 1], easeOvershoot);

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: spec.aspect === '916' ? 380 : spec.aspect === '45' ? 240 : 180,
        transform: `translateX(-50%) translateY(${(1 - enter) * 70}px) scale(${1 - recede * 0.16})`,
        opacity: enter * (1 - recede),
        filter: recede > 0.01 ? `blur(${(recede * 3.5).toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          perspective: 1200,
        }}
      >
      <div
        style={{
          transform: `rotateX(${(1 - enter) * 7 + 1.6}deg) rotateY(${-((1 - enter) * 5 + 1.2)}deg)`,
          transformStyle: 'preserve-3d',
          position: 'relative',
        }}
      >
      <LitPanel width={panelW} radius={RADIUS.card} background={C.surface2}>
        {/* header — the product frame */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 30px',
            borderBottom: `1px solid ${C.hairline}`,
          }}
        >
          <Kicker size={19} color={C.ink3}>
            ✒ Pri Ink Engine · your proof, marked live
          </Kicker>
          <TextBox>
            <span style={{ fontFamily: FONT.ams, fontSize: 30, color: C.ink }}>
              P<span style={{ fontFamily: FONT.serif, fontSize: 25 }}>ri Learning.</span>
            </span>
          </TextBox>
        </div>

        {/* the question that seized the factory */}
        <div style={{ padding: '26px 30px 20px' }}>
          <TextBox>
            <Tex tex={PRODUCT.question} size={29} color={C.ink} />
          </TextBox>
        </div>

        {/* the idea, not a formula sheet */}
        <div style={{ display: 'flex', gap: 26, padding: '4px 30px 8px', alignItems: 'center' }}>
          <svg width={PW} height={PH} style={{ overflow: 'visible', flexShrink: 0 }}>
            <path d={`M${m.x(-2.1)},${m.y(0)}L${m.x(1.7)},${m.y(0)}`} stroke={C.hairlineStrong} strokeWidth={1.4} fill="none" />
            <path d={`M${m.x(0)},${m.y(-0.9)}L${m.x(0)},${m.y(3.4)}`} stroke={C.hairlineStrong} strokeWidth={1.4} fill="none" />
            <LitPath d={fnPath(m, (x) => Math.exp(x), -2.05, 1.18)} progress={curveP} color={C.gold} width={4} glow={0.6} />
            <LitPath d={linePath(m, 0, 1, 1, -1.9, 1.55)} progress={tanP} color={C.goldBright} width={3.2} glow={0.35} />
            <circle cx={m.x(0)} cy={m.y(1)} r={6} fill={C.goldBright} opacity={tanP} />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextBox style={{ opacity: ramp(t, [enterAt + 0.9 * speed, enterAt + 1.25 * speed], [0, 1]) }}>
              <Tex tex={PRODUCT.idea} size={22} color={C.ink2} />
            </TextBox>
            <TextBox style={{ opacity: ramp(t, [enterAt + 1.15 * speed, enterAt + 1.5 * speed], [0, 1]) }}>
              <Tex tex={String.raw`e^{x}\text{ never dips below its tangent}`} size={22} color={C.ink2} />
            </TextBox>
          </div>
        </div>

        {/* the student's ink + the marks that land on it */}
        <div style={{ borderTop: `1px solid ${C.hairline}`, padding: '20px 30px 24px', position: 'relative' }}>
          <TextBox>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  fontFamily: FONT.hand,
                  fontSize: 44,
                  color: '#f5f0df',
                  transform: 'rotate(-0.8deg)',
                  clipPath: `inset(-14% ${(1 - inkP) * 100}% -10% 0)`,
                  whiteSpace: 'nowrap',
                }}
              >
                {/* real hands wobble: deterministic per-character drift + weight */}
                {PRODUCT.handwritten.split('').map((ch, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      whiteSpace: 'pre',
                      transform: `translateY(${Math.sin(i * 2.7) * 1.8}px) rotate(${Math.sin(i * 1.9) * 2.2}deg)`,
                      opacity: 0.88 + 0.12 * Math.abs(Math.sin(i * 3.3)),
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
              {/* the pen: a warm point riding the reveal edge while writing */}
              {inkP > 0.01 && inkP < 0.99 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: `${inkP * 100}%`,
                    top: 8,
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: C.goldBright,
                    boxShadow: '0 0 12px rgba(227,200,126,0.8)',
                  }}
                />
              ) : null}
            </div>
          </TextBox>

          {/* examiner marks, one per beat */}
          <div style={{ display: 'flex', gap: 14, marginTop: 20, minHeight: 54 }}>
            {rows.map((r, i) => {
              const p = ramp(t, [r.at, r.at + 0.22], [0, 1], easeOvershoot);
              if (p <= 0) return <div key={i} />;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: C.goodSoft,
                    border: `1px solid rgba(90,168,108,0.4)`,
                    borderRadius: RADIUS.control,
                    padding: '8px 16px',
                    transform: `scale(${0.6 + 0.4 * p})`,
                    opacity: p,
                  }}
                >
                  <TextBox>
                    <span style={{ fontFamily: FONT.serif, fontSize: 26, color: C.good }}>✓</span>
                  </TextBox>
                  <TextBox>
                    <span style={{ fontFamily: FONT.serif, fontSize: 19, color: C.ink2, letterSpacing: '0.08em' }}>
                      {r.mark} · {r.label}
                    </span>
                  </TextBox>
                </div>
              );
            })}
          </div>

          {/* the verdict, in the app's own voice */}
          {verdictP > 0 ? (
            <div style={{ position: 'absolute', right: 30, bottom: 24, transform: `scale(${0.7 + 0.3 * verdictP})`, opacity: verdictP }}>
              <TextBox>
                <span style={{ fontFamily: FONT.serif, fontSize: 27, color: C.goldBright }}>3 / 3 — Nailed it.</span>
              </TextBox>
            </div>
          ) : null}
        </div>
      </LitPanel>
      {/* one pass of key light across the object as it arrives */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: RADIUS.card,
          background: 'linear-gradient(115deg, transparent 30%, rgba(244,241,224,0.09) 46%, rgba(244,241,224,0.02) 52%, transparent 64%)',
          transform: `translateX(${(ramp(t, [enterAt + 0.15, enterAt + 1.3], [-0.65, 0.9]) * panelW).toFixed(1)}px)`,
          opacity: ramp(t, [enterAt + 1.15, enterAt + 1.45], [1, 0]),
          pointerEvents: 'none',
        }}
      />
      </div>
      </div>
    </div>
  );
};

const TurnStage: React.FC<{ t: number; t0: number }> = ({ t, t0 }) => {
  const dolly = ramp(t, [15.0, 20.0], [-45, 40], easeDrift);
  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ dolly, drift: 0.5, focus: 0, dof: 2.0 }} tOffset={t0}>
        <Plane z={-240}>
          <MathField opacity={0.35} seed={33} count={36} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <ProductPanel t={t} enterAt={15.05} inkAt={15.9} />
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};

export const TurnProduct: React.FC<{ t0?: number }> = ({ t0 = 15 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + t0;
  return <TurnStage t={t} t0={t0} />;
};

export const TurnMarked: React.FC<{ t0?: number }> = ({ t0 = 17.5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + t0;
  return <TurnStage t={t} t0={t0} />;
};
