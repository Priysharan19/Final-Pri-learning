import React from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame } from 'remotion';
import { C, GRADE } from '../design/tokens';

/**
 * The grade — one look across every shot (docs/BRAND.md):
 * lifted blacks, gentle S-curve, gold highlight roll-off, vignette,
 * near-invisible animated grain. Wraps a whole composition exactly once.
 */
export const Film: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const seed = (frame * 7919) % 65521;
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <AbsoluteFill style={{ filter: GRADE.filter }}>{children}</AbsoluteFill>
      {/* lift the blacks — a whisper of warm floor over everything */}
      <AbsoluteFill
        style={{
          background: GRADE.liftFloor,
          opacity: 0.5,
          mixBlendMode: 'lighten',
          pointerEvents: 'none',
        }}
      />
      {/* gold highlight roll-off from the key-light direction (upper left) */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(120% 90% at 28% 8%, rgba(201,173,99,0.10) 0%, rgba(201,173,99,0.035) 34%, rgba(0,0,0,0) 62%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(130% 105% at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,${GRADE.vignette}) 100%)`,
          pointerEvents: 'none',
        }}
      />
      {/* animated film grain — 8 pre-generated frames cycling at 2× scale
          (public/grain, scripts/gen-grain.mjs); vastly cheaper than per-frame
          SVG turbulence, same look at this opacity */}
      <AbsoluteFill
        style={{
          opacity: GRADE.grainOpacity,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          backgroundImage: `url(${staticFile(`grain/grain-${frame % 8}.png`)})`,
          backgroundSize: 'cover',
        }}
      />
    </AbsoluteFill>
  );
};

/** The signature "mathfield" backdrop from the app's landing page — faded, rotated glyphs. */
export const MathField: React.FC<{
  opacity?: number;
  parallax?: number;
  count?: number;
  seed?: number;
}> = ({ opacity = 1, parallax = 0, count = 42, seed = 5 }) => {
  const glyphs = ['∑', '∫', 'π', 'θ', 'Ω', '√', '∞', 'ℝ', '∂', '∇', 'dx', 'λ', 'ζ', '≥', 'lim', 'Δ', 'φ', 'μ'];
  // deterministic scatter (FNV-ish hash, mirrors client/src/pages/Login.jsx)
  const items = Array.from({ length: count }, (_, i) => {
    let h = (2166136261 ^ (i * 16777619) ^ (seed * 2654435761)) >>> 0;
    const rnd = () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 4294967296;
    };
    return {
      g: glyphs[Math.floor(rnd() * glyphs.length)],
      x: rnd() * 100,
      y: rnd() * 100,
      s: 18 + rnd() * 54,
      r: (rnd() - 0.5) * 70,
      o: 0.05 + rnd() * 0.13,
      z: rnd(),
    };
  });
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${it.x}%`,
            top: `${it.y}%`,
            fontSize: it.s,
            fontFamily: `'KaTeX_Math', 'KaTeX_Main', Georgia, serif`,
            fontStyle: 'italic',
            color: C.ink,
            opacity: it.o,
            transform: `translate(-50%, -50%) rotate(${it.r}deg) translateX(${parallax * (it.z - 0.5) * 2}px)`,
          }}
        >
          {it.g}
        </div>
      ))}
    </AbsoluteFill>
  );
};
