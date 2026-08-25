import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Reel, type ReelProps } from './compositions/Reel';
import { Cut15 } from './compositions/Cut15';
import { DUR15, DUR30, FPS, sec } from './data/timeline';

const defaults: ReelProps = { aspect: '916', debugSafe: false, muted: false };

// Remotion's Composition wants loosely-typed components; the props stay typed at the call sites.
type Loose = React.ComponentType<Record<string, unknown>>;
const ReelC = Reel as unknown as Loose;
const Cut15C = Cut15 as unknown as Loose;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel916"
        component={ReelC}
        durationInFrames={sec(DUR30)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ...defaults, aspect: '916' as const }}
      />
      <Composition
        id="Story916"
        component={ReelC}
        durationInFrames={sec(DUR30)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ...defaults, aspect: '916' as const }}
      />
      <Composition
        id="Feed45"
        component={ReelC}
        durationInFrames={sec(DUR30)}
        fps={FPS}
        width={1080}
        height={1350}
        defaultProps={{ ...defaults, aspect: '45' as const }}
      />
      <Composition
        id="Square11"
        component={ReelC}
        durationInFrames={sec(DUR30)}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ ...defaults, aspect: '11' as const }}
      />
      <Composition
        id="Cut15"
        component={Cut15C}
        durationInFrames={sec(DUR15)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ...defaults, aspect: '916' as const }}
      />
    </>
  );
};
