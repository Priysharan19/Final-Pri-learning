import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, TYPE, type Aspect } from '../design/tokens';
import { Film, MathField } from '../lib/Film';
import { AspectProvider, Captions, Display, Kicker, useFrameSpec, w } from '../lib/Type';
import { Stage, Plane } from '../lib/Stage';
import { easeDrift, ramp } from '../lib/ease';
import { Axes, LitPath, fnPath, makeMap } from '../lib/plots';
import { sec, SCENES15, TEXT15 } from '../data/timeline';
import { FactoryGrid, SeizeCard } from '../scenes/Factory';
import { HingeCore } from '../scenes/TurnHinge';
import { PLOT, plotSize } from '../scenes/TurnCurve';
import { ProductPanel } from '../scenes/TurnProduct';
import { LadderStation } from '../scenes/Ladder';
import { CloseCard } from '../scenes/Close';
import { LADDER } from '../math/expressions';

/**
 * The 15 s cut — a real edit, not a truncation. It inverts the order of
 * revelation: beauty first (the curve already drawing under the hook line),
 * one breath of the factory, then the tangent lock carries everything.
 */

const S = SCENES15;

/** 0.00–1.20 — the curve draws in the dark; the hook sets over it. */
const CurveOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps;
  const isCover = frame === 0;

  const { W, H, top } = plotSize(spec.aspect);
  const m = makeMap(PLOT.xmin, PLOT.xmax, PLOT.ymin, PLOT.ymax, W, H);
  const axesP = isCover ? 1 : ramp(t, [0.02, 0.5], [0, 1], easeDrift);
  const curveP = isCover ? 1 : ramp(t, [0.08, 1.05], [0, 1], easeDrift);

  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ dolly: ramp(t, [0, 1.2], [-60, -20], easeDrift), drift: 0.5, focus: 0, dof: 2.0 }}>
        <Plane z={-260}>
          <MathField opacity={0.35} seed={21} count={40} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <div style={{ position: 'absolute', left: (spec.w - W) / 2, top, width: W, height: H, opacity: 0.85 }}>
            <svg width={W} height={H} style={{ overflow: 'visible' }}>
              <Axes m={m} {...PLOT} progress={axesP} opacity={0.8} />
              <LitPath d={fnPath(m, (x) => x * x, -0.62, 2.24)} progress={curveP} color={C.gold} width={5.5} glow={0.8} />
            </svg>
          </div>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Display
              words={w('Stop *memorising* maths.')}
              size={spec.aspect === '916' ? TYPE.s5 : TYPE.s4}
              wordAt={isCover ? undefined : [0.15, 0.35, 0.55]}
              landDur={0.22}
              mode="slam"
              style={{ maxWidth: spec.w - spec.safeSide * 2, textAlign: 'center' }}
            />
          </AbsoluteFill>
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};

/** 1.20–3.60 — three breaths of the factory, then the seize. */
const FactoryFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + S.factory.at;
  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ drift: 0, dof: 0 }}>
        <Plane z={0} blurScale={0}>
          <FactoryGrid t={t} start={S.factory.at} seizeAt={2.5} compress={2} />
          <SeizeCard t={t} at={2.5} />
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};

/** 3.60–8.40 — the hinge, retimed: lock at 7.20. */
const HingeFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + S.hinge.at;
  return (
    <AbsoluteFill style={{ background: C.page, opacity: ramp(t, [S.hinge.at, S.hinge.at + 0.3], [0, 1]) }}>
      <HingeCore t={t} t0={S.hinge.at} lockAt={7.0} speed={1} />
    </AbsoluteFill>
  );
};

/** 8.40–10.80 — the product marks the handwritten close. */
const MarkedFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + S.marked.at;
  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ dolly: ramp(t, [8.5, 10.5], [-20, 14], easeDrift), drift: 0.5, dof: 2.0 }} tOffset={S.marked.at}>
        <Plane z={-240}>
          <MathField opacity={0.3} seed={33} count={30} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <ProductPanel t={t} enterAt={8.55} inkAt={8.9} speed={0.7} markAt={[9.5, 9.9, 10.3]} verdictAt={10.35} />
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};

/** 10.80–12.60 — the ladder as one lateral move. */
const LadderFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps + S.ladder.at;

  const stepW = spec.w * 0.72;
  const slide = ramp(t, [10.6, 12.4], [0, (LADDER.length - 1) * stepW], easeDrift);

  return (
    <AbsoluteFill style={{ background: C.page, opacity: ramp(t, [10.5, 10.8], [0, 1]) }}>
      <Stage cam={{ drift: 0.5, dof: 1.6 }} tOffset={S.ladder.at}>
        <Plane z={-260}>
          <MathField opacity={0.28} seed={45} count={30} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <div style={{ position: 'absolute', top: spec.aspect === '916' ? 480 : 260, left: 0, right: 0 }}>
            <div style={{ display: 'flex', transform: `translateX(${spec.w / 2 - stepW / 2 - slide}px)` }}>
              {LADDER.map((_, i) => (
                <div key={i} style={{ width: stepW, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <LadderStation index={i} p={ramp(t, [10.55 + i * 0.28, 10.85 + i * 0.28], [0, 1])} motifSize={spec.aspect === '916' ? 380 : 320} />
                </div>
              ))}
            </div>
          </div>
        </Plane>
      </Stage>
    </AbsoluteFill>
  );
};

/** 12.60–15.00 — close, still, fade to black. */
const CloseFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tRel = frame / fps;
  const t = tRel + S.close.at;
  const fade = ramp(t, [14.35, 14.85], [0, 1], easeDrift);
  return (
    <AbsoluteFill style={{ background: C.page }}>
      <Stage cam={{ drift: ramp(t, [S.close.at, S.close.at + 1], [0.35, 0]), dof: 1.6 }} tOffset={S.close.at}>
        <Plane z={-260}>
          <MathField opacity={0.26} seed={57} count={30} />
        </Plane>
        <Plane z={0} blurScale={0}>
          <CloseCard tRel={tRel} compact />
        </Plane>
      </Stage>
      <AbsoluteFill style={{ background: C.black, opacity: fade, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

export const Cut15: React.FC<{ aspect: Aspect; debugSafe: boolean; muted: boolean }> = ({ aspect, debugSafe, muted }) => {
  return (
    <AspectProvider aspect={aspect} debugSafe={debugSafe}>
      <Film>
        <AbsoluteFill style={{ background: C.page }}>
          <Sequence from={0} durationInFrames={sec(S.curveOpen.dur)} name="Curve open">
            <CurveOpen />
          </Sequence>
          <Sequence from={sec(S.factory.at)} durationInFrames={sec(S.factory.dur)} name="Factory flash">
            <FactoryFlash />
          </Sequence>
          <Sequence from={sec(S.hinge.at)} durationInFrames={sec(S.hinge.dur)} name="Hinge">
            <HingeFlash />
          </Sequence>
          <Sequence from={sec(S.marked.at)} durationInFrames={sec(S.marked.dur)} name="Marked">
            <MarkedFlash />
          </Sequence>
          <Sequence from={sec(S.ladder.at)} durationInFrames={sec(S.ladder.dur)} name="Ladder flash">
            <LadderFlash />
          </Sequence>
          <Sequence from={sec(S.close.at)} durationInFrames={sec(S.close.dur)} name="Close">
            <CloseFlash />
          </Sequence>
          <Captions beats={TEXT15} roles={['caption']} />
        </AbsoluteFill>
      </Film>
      {muted ? null : <Audio src={staticFile('audio/soundtrack-15.wav')} />}
    </AspectProvider>
  );
};
