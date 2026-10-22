import React, { useEffect, useId, useRef } from 'react';
import { reduced } from './motion.js';

// Pri's one lock-up: the P′ mark (Instrument Serif on a glass tile lit from
// within by the signature violet) and, with `wordmark`, "Pri Learning" set in
// the same serif. Every surface uses this; there is no other mark or
// wordmark. `engrave` draws the tile's edge in from the first frame. `engrave` draws the bezel in from the first frame (C's bezel
// engrave, 800ms); under Reduce Motion it is simply there. Decorative unless
// given a label.

export default function PMark({ size = 32, engrave = false, wordmark = false, label, className = '' }) {
  const ring = useRef(null);
  const glow = `pm-glow-${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const el = ring.current;
    if (!engrave || !el || reduced() || !el.animate) return undefined;
    const a = el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 800, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'backwards' });
    return () => a.cancel();
  }, [engrave]);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' };
  const mark = (
    <svg className={`c-pmark ${wordmark ? '' : className}`.trim()} viewBox="0 0 48 48" width={size} height={size} {...a11y}>
      <defs>
        <radialGradient id={glow} cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="var(--a-brand)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--a-brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="var(--a-surface)" />
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${glow})`} />
      <rect ref={ring} x="2.5" y="2.5" width="43" height="43" rx="11.5" fill="none" stroke="var(--a-glass-edge)" strokeWidth="1" pathLength="1" strokeDasharray="1" strokeDashoffset="0" />
      <text x="23" y="32" textAnchor="middle" fontFamily="'Instrument Serif', Georgia, serif" fontSize="24" fill="var(--a-ink)">P<tspan fill="var(--a-violet)">′</tspan></text>
    </svg>
  );
  if (!wordmark) return mark;
  // The name is real text (not drawn), so it scales, translates and reads.
  return (
    <span className={`c-lockup ${className}`.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3) }}>
      {mark}
      <span className="c-wordmark" style={{ font: `400 ${Math.round(size * 0.62)}px/1 var(--c-serif)`, letterSpacing: '-0.01em', color: 'var(--c-ink)' }}>Pri Learning</span>
    </span>
  );
}
