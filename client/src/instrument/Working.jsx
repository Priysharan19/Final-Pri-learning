import { useEffect, useState } from 'react';
import { edition } from '../platform/edition.js';
import { workingClock } from './workingClock.js';

// Pri's working indicator, "Construction" (Lit Instrument D6): three points
// settle into the edition's cut, the line draws, holds and lets go. Pure SVG
// and CSS (instrument.css, UI-IND). `pending` is the caller's real request or
// promise; workingClock decides when it shows. Where the caller unmounts it
// when the work ends (a Suspense fallback, a skeleton, a read that its result
// replaces), the result takes its place; where the host stays (the status
// line, a button), it holds 480 ms and fades. Decorative: the caller's own
// live status region carries what is happening, in `label` or beside it.
// Never on a verdict, a reading or the question; ink under the instrument
// skin, the edition light under Aurora (aurora.css .pri-working).
const { line, points } = edition().identity.working;
const STROKE = { 16: 2.25, 24: 1.5, 40: 0.9 };

export default function Working({ pending, size = 16, label = null }) {
  const [shown, setShown] = useState(false);
  const [clock] = useState(() => workingClock(setShown));
  useEffect(() => clock.stop, [clock]);
  useEffect(() => { clock.set(pending); }, [clock, pending]);
  if (!shown) return null;
  return (
    <span className="pri-working" data-out={shown === 'out' ? '' : undefined}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path pathLength="1" strokeWidth={STROKE[size]} d={line} />
        {points.map(([x, y, dx, dy], i) => <circle key={i} cx={x} cy={y} r="2" style={{ '--dx': `${dx}px`, '--dy': `${dy}px` }} />)}
      </svg>
      {label}
    </span>
  );
}
