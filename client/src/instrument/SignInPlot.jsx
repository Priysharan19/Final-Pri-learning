import React, { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.js';
import PMark from './margin/PMark.jsx';
import { startLight } from './margin/light.js';

// The sign-in's left half: C's own object at rest, the P′ bezel large on the
// desk, lit by the one key light (.c-rim; light.js runs on this element only,
// never on <html>) with the register's hairline hands resting at 10:10.
// Decorative (aria-hidden). Instrument build only.
export default function SignInPlot() {
  const t = useT();
  const lit = useRef(null);
  useEffect(() => {
    if (!lit.current) return undefined;
    const stop = startLight(lit.current);
    return () => { if (typeof stop === 'function') stop(); };
  }, []);
  return (
    <div className="in-signin-plot c-signin-desk" aria-hidden="true">
      <div className="c-signin-object c-rim" ref={lit}>
        <PMark size={320} engrave />
        <svg className="c-signin-hands" viewBox="0 0 48 48">
          {/* 10:10 — hour hand at 305°, minute hand at 60°, from the centre. */}
          <line x1="24" y1="24" x2={24 + 9 * Math.sin(-55 * Math.PI / 180)} y2={24 - 9 * Math.cos(-55 * Math.PI / 180)} />
          <line x1="24" y1="24" x2={24 + 14 * Math.sin(60 * Math.PI / 180)} y2={24 - 14 * Math.cos(60 * Math.PI / 180)} />
          <circle cx="24" cy="24" r="0.9" />
        </svg>
      </div>
      <p className="in-signin-line">{t('login.instrumentHeadline')}</p>
    </div>
  );
}
