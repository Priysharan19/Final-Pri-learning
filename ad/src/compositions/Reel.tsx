import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, type Aspect } from '../design/tokens';
import { Film } from '../lib/Film';
import { AspectProvider, Captions, TextBox, useFrameSpec } from '../lib/Type';
import { ramp } from '../lib/ease';
import { sec, SCENES_MAIN, TEXT_MAIN } from '../data/timeline';
import { Hook } from '../scenes/Hook';
import { Factory } from '../scenes/Factory';
import { TurnCurve } from '../scenes/TurnCurve';
import { TurnHinge } from '../scenes/TurnHinge';
import { TurnProduct } from '../scenes/TurnProduct';
import { Instrument } from '../scenes/Instrument';
import { Ladder } from '../scenes/Ladder';
import { Close } from '../scenes/Close';

export interface ReelProps {
  aspect: Aspect;
  debugSafe: boolean;
  muted: boolean;
}

const S = SCENES_MAIN;

/** A quiet ℙ from the film's turn onward — recall for a pre-launch brand,
 * whispered (the factory stays unbranded; the close carries the full lockup). */
const Monogram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = useFrameSpec();
  const t = frame / fps;
  const o = ramp(t, [0.2, 1.0], [0, 0.5]);
  return (
    <div style={{ position: 'absolute', top: spec.safeTop + 24, left: spec.safeSide + 10, opacity: o }}>
      <TextBox>
        <span style={{ fontFamily: FONT.ams, fontSize: 36, color: C.ink3 }}>P</span>
      </TextBox>
    </div>
  );
};

export const Reel: React.FC<ReelProps> = ({ aspect, debugSafe, muted }) => {
  return (
    <AspectProvider aspect={aspect} debugSafe={debugSafe}>
      <Film>
        <AbsoluteFill style={{ background: C.page }}>
          <Sequence from={sec(S.hook.at)} durationInFrames={sec(S.hook.dur)} name="Hook">
            <Hook t0={S.hook.at} />
          </Sequence>
          <Sequence from={sec(S.factory.at)} durationInFrames={sec(S.factory.dur)} name="Factory">
            <Factory t0={S.factory.at} />
          </Sequence>
          <Sequence from={sec(S.turnCurve.at)} durationInFrames={sec(S.turnCurve.dur)} name="Turn · curve">
            <TurnCurve t0={S.turnCurve.at} />
          </Sequence>
          <Sequence from={sec(S.turnHinge.at)} durationInFrames={sec(S.turnHinge.dur)} name="Turn · hinge">
            <TurnHinge t0={S.turnHinge.at} />
          </Sequence>
          {/* product + marked are one continuously developing shot */}
          <Sequence from={sec(S.turnProduct.at)} durationInFrames={sec(S.turnProduct.dur + S.turnMarked.dur)} name="Turn · product/marked">
            <TurnProduct t0={S.turnProduct.at} />
          </Sequence>
          <Sequence from={sec(S.instrument.at)} durationInFrames={sec(S.instrument.dur)} name="Instrument">
            <Instrument t0={S.instrument.at} />
          </Sequence>
          <Sequence from={sec(S.ladder.at)} durationInFrames={sec(S.ladder.dur)} name="Ladder">
            <Ladder t0={S.ladder.at} />
          </Sequence>
          <Sequence from={sec(S.close.at)} durationInFrames={sec(S.close.dur)} name="Close">
            <Close t0={S.close.at} fadeAt={S.close.at + 2.2} />
          </Sequence>

          {/* the whispered monogram, turn → ladder (the close takes over) */}
          <Sequence from={sec(S.turnCurve.at)} durationInFrames={sec(S.close.at - S.turnCurve.at)} name="Monogram">
            <Monogram />
          </Sequence>

          {/* burned captions — part of the design system, span the whole film */}
          <Captions beats={TEXT_MAIN} roles={['caption']} />
        </AbsoluteFill>
      </Film>
      {muted ? null : <Audio src={staticFile('audio/soundtrack-30.wav')} />}
    </AspectProvider>
  );
};
