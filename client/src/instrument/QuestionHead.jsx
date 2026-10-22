import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';

// v1.1 instrument: the question header's right side (design s4 `.qh`). The
// number is a real count — the questions shown in this visit to Practice, or
// for an assignment the questions answered against its own target — and the
// clock is the time on this question. Both are display only: the clock is
// never sent, read or used for marking (the card measures time on task
// itself, as it always has). It stops when the question is resolved.
// The ten-segment bar is drawn only when the session has a defined length
// (an assignment); open practice states how many have been answered instead.

const clock = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};


// The date window and the margin marks live in StepMarks.jsx, a chunk of the
// instrument build only, so the classic build carries none of their motion.
const DateWindow = React.lazy(() => import('./StepMarks.jsx').then(m => ({ default: m.DateWindow })));

export default function QuestionHead({ index, length = null, answered = 0, startedAt, stopped = false, score = null, outOf = null }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stopped) return undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [stopped]);
  if (!Number.isInteger(index) || index < 1 || !Number.isFinite(startedAt)) return null;
  const bounded = Number.isInteger(length) && length > 0;
  const n = bounded ? Math.min(length, answered + 1) : index;
  const lit = bounded ? Math.min(10, Math.round((Math.min(answered, length) / length) * 10)) : 0;
  return (
    <span className="in-qh" data-question-head={bounded ? `${n}/${length}` : String(n)}>
      {bounded && (
        <span className="in-prog10" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < lit ? 'd' : i === lit ? 'n' : undefined} />)}
        </span>
      )}
      <span className="in-qh-n">
        <span aria-hidden="true">{bounded ? t('inst.qNumberOf', { n, total: length }) : t('inst.qNumber', { n })}</span>
        <span className="sr-only">{bounded ? t('inst.qNumberOfSr', { n, total: length }) : t('inst.qNumberSr', { n })}</span>
      </span>
      {!bounded && answered > 0 && <span className="in-qh-a">{t('inst.answeredSession', { n: answered })}</span>}
      <span className="in-qh-sep" aria-hidden="true">·</span>
      <span className="in-qh-t" role="timer" aria-label={t('inst.timerSr')} data-question-timer>{clock(now - startedAt)}</span>
      <React.Suspense fallback={null}><DateWindow score={Number.isFinite(score) ? score : null} outOf={outOf} /></React.Suspense>
    </span>
  );
}
