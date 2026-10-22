import React, { useEffect, useRef } from 'react';
import { reduced } from './motion.js';

// Pri's one brand mark: an Instrument Serif P′ inside an engraved bezel. Every
// surface uses this (bar, first open, sign-in, Index), never a second
// wordmark. `engrave` draws the bezel in from the first frame (C's bezel
// engrave, 800ms); under Reduce Motion it is simply there. Decorative unless
// given a label.

export default function PMark({ size = 32, engrave = false, label, className = '' }) {
  const ring = useRef(null);
  useEffect(() => {
    const el = ring.current;
    if (!engrave || !el || reduced() || !el.animate) return undefined;
    const a = el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 800, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'backwards' });
    return () => a.cancel();
  }, [engrave]);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' };
  return (
    <svg className={`c-pmark ${className}`.trim()} viewBox="0 0 48 48" width={size} height={size} {...a11y}>
      <circle cx="24" cy="24" r="22.5" fill="var(--c-dial)" stroke="var(--c-bezel-2)" strokeWidth="1" />
      <circle ref={ring} cx="24" cy="24" r="19.5" fill="none" stroke="var(--c-dial-line)" strokeWidth="1" pathLength="1" strokeDasharray="1" strokeDashoffset="0" />
      <text x="23" y="31.5" textAnchor="middle" fontFamily="'Instrument Serif', Georgia, serif" fontSize="22" fill="var(--c-ink)">P<tspan fill="var(--c-lume)">′</tspan></text>
    </svg>
  );
}
