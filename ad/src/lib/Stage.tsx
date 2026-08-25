import React, { createContext, useContext } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { noise1 } from './ease';

/**
 * The virtual camera. Everything on screen lives in a 3D stage; the camera has
 * position, roll, a focal plane and drift, so no frame is ever perfectly static.
 *
 *  - dolly: camera moves toward the stage (positive = closer), in px of world z
 *  - x / y: truck / pedestal in px
 *  - roll: degrees
 *  - focus: the z of the focal plane; Planes blur by |z − focus| (focus pulls)
 *  - drift: 0..1 — organic handheld micro-movement; 0 = locked-off (the factory)
 */
export interface Cam {
  dolly?: number;
  x?: number;
  y?: number;
  roll?: number;
  focus?: number;
  drift?: number;
  /** Depth-of-field strength: blur px per 100px of z distance from focus. */
  dof?: number;
}

const StageCtx = createContext<{ focus: number; dof: number }>({ focus: 0, dof: 2.2 });

export const Stage: React.FC<{ cam?: Cam; tOffset?: number; children: React.ReactNode }> = ({ cam = {}, tOffset = 0, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // drift runs on absolute film time so camera motion is continuous across cuts
  const t = frame / fps + tOffset;
  const { dolly = 0, x = 0, y = 0, roll = 0, focus = 0, drift = 0.5, dof = 2.2 } = cam;

  const dx = drift * 4.5 * noise1(t * 0.55, 3.1);
  const dy = drift * 3.5 * noise1(t * 0.45, 7.7);
  const dr = drift * 0.22 * noise1(t * 0.3, 11.3);
  const dz = drift * 6 * noise1(t * 0.35, 17.9);

  return (
    <StageCtx.Provider value={{ focus, dof }}>
      <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: '50% 46%' }}>
        <AbsoluteFill
          style={{
            transformStyle: 'preserve-3d',
            transform: `translate3d(${-x + dx}px, ${-y + dy}px, ${dolly + dz}px) rotate(${roll + dr}deg)`,
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    </StageCtx.Provider>
  );
};

/**
 * A plane in the stage at depth z (negative = away from camera). Gets parallax
 * from perspective and defocus from the camera's focal plane.
 */
export const Plane: React.FC<{
  z?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** multiply the DOF blur for this plane (0 disables, e.g. for text that must stay crisp) */
  blurScale?: number;
}> = ({ z = 0, style, children, blurScale = 1 }) => {
  const { focus, dof } = useContext(StageCtx);
  const blur = (Math.abs(z - focus) / 100) * dof * blurScale;
  return (
    <AbsoluteFill
      style={{
        transform: `translateZ(${z}px)`,
        filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * Studio light on a panel: soft key from the upper-left, a rim on the top edge,
 * and a contact shadow below. Wrap any UI card in this so it reads as an object
 * with thickness that light lands on, not a flat div.
 */
export const LitPanel: React.FC<{
  width: number;
  radius?: number;
  background?: string;
  border?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ width, radius = 10, background = '#101010', border = 'rgba(240,236,224,0.13)', style, children }) => {
  return (
    <div style={{ position: 'relative', width, ...style }}>
      {/* contact shadow */}
      <div
        style={{
          position: 'absolute',
          left: '6%',
          right: '6%',
          bottom: -16,
          height: 34,
          background: 'radial-gradient(50% 100% at 50% 0%, rgba(0,0,0,0.55), rgba(0,0,0,0) 75%)',
          filter: 'blur(6px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          borderRadius: radius,
          background: `linear-gradient(155deg, rgba(240,236,224,0.055) 0%, rgba(240,236,224,0.015) 38%, rgba(0,0,0,0.12) 100%), ${background}`,
          border: `1px solid ${border}`,
          boxShadow: 'inset 0 1px 0 rgba(240,236,224,0.09)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};
