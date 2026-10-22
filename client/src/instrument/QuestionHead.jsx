import React, { useEffect, useRef, useState } from 'react';
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

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The date window (Pri Luxury, direction C): "– /3" until the engine has
 * decided, then the score flips in like a calendar complication, after the
 * margin's marks are struck (`pri:check-marked`), or at once when there is no
 * ceremony to wait for (typed answers, Reduce Motion). Display only and
 * aria-hidden: the verdict is announced once, by the card's own live region.
 */
function DateWindow({ score, outOf }) {
  const [shown, setShown] = useState(score);
  const flipRef = useRef(null);
  useEffect(() => {
    if (score == null) { setShown(null); return undefined; }
    let fired = false;
    const go = () => { if (!fired) { fired = true; setShown(score); } };
    const onMarked = () => go();
    window.addEventListener('pri:check-marked', onMarked);
    // No margin ceremony is coming (nothing was written, or it already ran):
    // the figure lands after the longest ceremony could take, never before.
    const hasRows = typeof document !== 'undefined' && document.querySelector('[data-wc-row]');
    const fallback = setTimeout(go, hasRows && !reduced() ? 6000 : 0);
    return () => { window.removeEventListener('pri:check-marked', onMarked); clearTimeout(fallback); };
  }, [score]);
  useEffect(() => {
    const el = flipRef.current?.lastElementChild;
    if (!el || shown == null || reduced() || !el.animate) return undefined;
    const a = el.animate([{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(8deg)', offset: 0.75 }, { transform: 'rotateX(0)' }],
      { duration: 170, delay: 110, easing: 'cubic-bezier(0,0,.3,1)', fill: 'backwards' });
    return () => a.cancel();
  }, [shown]);
  if (!Number.isInteger(outOf) || outOf < 1) return null;
  return (
    <span className="wc-datewin" aria-hidden="true" data-date-window={shown == null ? 'pending' : `${shown}/${outOf}`}>
      <span className="wc-flip" ref={flipRef}><span key={shown == null ? 'p' : 's'}>{shown == null ? '–' : shown}<span className="wc-dw-of"> /{outOf}</span></span></span>
    </span>
  );
}

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
      <DateWindow score={Number.isFinite(score) ? score : null} outOf={outOf} />
    </span>
  );
}
