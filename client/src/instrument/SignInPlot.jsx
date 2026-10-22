import React, { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.js';
import PMark from './margin/PMark.jsx';
import { startLight } from './margin/light.js';

// The sign-in's left half: C's own object at rest, the P′ bezel large on the
// desk, lit by the one key light (.c-rim; light.js runs on this element only,
// never on <html>) with the register's hairline hands resting at 10:10, clear of the glyph.
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
          {/* 10:10, drawn only outside the glyph's circle (r > 12.8) so no
              hand ever crosses the P′: hour at 305°, minute at 60°. */}
          <line x1="13.51" y1="16.66" x2="10.48" y2="14.54" />
          <line x1="35.09" y1="17.60" x2="40.45" y2="14.50" />
        </svg>
      </div>
      <p className="in-signin-line">{t('login.instrumentHeadline')}</p>
    </div>
  );
}
