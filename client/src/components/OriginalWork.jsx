// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · OriginalWork — the student's own page, as the marked work
//
// Owner rule: "the final marking must check the human's handwriting, not the
// computer's." Marked work and the teacher's review show the ORIGINAL first:
// the student's strokes as the server kept them with the mark (or their
// photographed page), with numbered boxes on the lines the marking speaks
// about. The typeset reading is the small secondary line, labelled "What Pri
// read" — never presented as the student's work.
//
// Props
//   original   the /v1/originals view: { kind, data, sha256, lines, reading }
//   marks      [{ line, status, n }] — status in the annotated-working
//              vocabulary (checked, first-error, follows, not-verified, unread)
//   showReading  show the small "What Pri read" line (default true)
//   label      accessible name of the page (default: "Your handwriting")
//
// The bytes are re-hashed before anything is drawn: a page that does not match
// the digest the mark names is not shown as the student's work. Strokes are
// drawn through their own samples with straight segments — nothing smoothed or
// redrawn. Replay plays the strokes in the order and at the pace written;
// reduced motion shows the finished page and offers no replay.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import { cloud } from '../platform/cloudTransport.js';
import { markBoxes, openOriginal, pointsUntil, readingLayer, strokePath, timeline } from './originalWorkModel.js';
import './OriginalWork.css';

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
const STATUS_KEY = Object.freeze({
  checked: 'ow.status.checked', 'first-error': 'ow.status.firstError', follows: 'ow.status.follows',
  'not-verified': 'ow.status.notVerified', unread: 'ow.status.unread'
});

export default function OriginalWork({ original, marks = [], showReading = true, label = null }) {
  const t = useT();
  const [opened, setOpened] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [clock, setClock] = useState(null);          // replay time (s) or null for the finished page
  const rafRef = useRef(0);

  useEffect(() => {
    let live = true;
    setOpened(null);
    openOriginal(original).then(result => { if (live) setOpened(result); });
    return () => { live = false; };
  }, [original]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const page = opened?.ok && opened.kind === 'strokes' ? opened.page : null;
  const boxes = useMemo(() => (page ? markBoxes(page, original?.lines || [], marks) : []), [page, original, marks]);
  const span = useMemo(() => (page ? timeline(page) : null), [page]);
  const reading = showReading ? readingLayer(original?.reading) : null;
  const name = label || t('ow.label');

  const replay = () => {
    if (!span || reducedMotion()) return;
    cancelAnimationFrame(rafRef.current);
    const started = performance.now();
    const step = now => {
      const at = (now - started) / 1000;
      if (at >= span.end) { setClock(null); return; }
      setClock(at);
      rafRef.current = requestAnimationFrame(step);
    };
    setClock(0);
    rafRef.current = requestAnimationFrame(step);
  };

  if (!opened) return <div className="ow ow-pending" role="status">{t('ow.opening')}</div>;
  if (!opened.ok) {
    return (
      <div className="ow ow-missing" role="status">
        {opened.reason === 'digest' ? t('ow.digestMismatch') : t('ow.unavailable')}
      </div>
    );
  }

  return (
    <figure className="ow" data-ow-kind={opened.kind} data-ow-sha={opened.sha256}>
      {opened.kind === 'image' ? (
        <img className="ow-photo" src={opened.src} alt={name} />
      ) : (
        <svg className="ow-ink" role="img" aria-label={name} viewBox={`0 0 ${Math.max(1, page.width)} ${Math.max(1, page.height)}`}
          preserveAspectRatio="xMinYMin meet">
          {showRemoved && page.removed.map((s, i) => (
            <path key={`r${i}`} className="ow-removed" d={strokePath(s.points)} />
          ))}
          {page.strokes.map((s, i) => (
            <path key={i} className="ow-stroke" d={strokePath(clock === null ? s.points : pointsUntil(s, clock))} />
          ))}
          {clock === null && boxes.map(b => (
            <g key={`b${b.line}`} className={`ow-box is-${b.status}`} data-ow-line={b.line}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" />
              <circle cx={b.x + b.w} cy={b.y} r="9" />
              <text x={b.x + b.w} y={b.y} dy="0.35em" textAnchor="middle">{b.n}</text>
            </g>
          ))}
        </svg>
      )}
      <figcaption className="ow-caption">
        {boxes.length > 0 && (
          <ul className="ow-legend">
            {boxes.map(b => (
              <li key={b.line} className={`is-${b.status}`}>
                <span className="ow-num">{b.n}</span> {t(STATUS_KEY[b.status])}
              </li>
            ))}
          </ul>
        )}
        <div className="ow-tools">
          {page && !reducedMotion() && (
            <button type="button" className="ow-btn" onClick={replay} disabled={clock !== null}>{t('ow.replay')}</button>
          )}
          {page && page.removed.length > 0 && (
            <button type="button" className="ow-btn" aria-pressed={showRemoved} onClick={() => setShowRemoved(v => !v)}>
              {showRemoved ? t('ow.hideCrossedOut') : t('ow.showCrossedOut')}
            </button>
          )}
        </div>
        {reading && reading.confirmed && (
          <p className="ow-reading">
            <span className="ow-reading-label">{t('ow.whatPriRead')}</span>{' '}
            <span className="ow-reading-text">{reading.corrected && reading.read !== null ? reading.read : reading.confirmed}</span>
            {reading.corrected && (
              <>
                {' · '}<span className="ow-reading-label">{t('ow.youConfirmed')}</span>{' '}
                <span className="ow-reading-text">{reading.confirmed}</span>
              </>
            )}
          </p>
        )}
        <p className="ow-proof">{t('ow.keptWithMark', { digest: opened.sha256.slice(0, 8) })}</p>
      </figcaption>
    </figure>
  );
}

/**
 * MarkedOriginal — fetch the original a mark names and show it.
 *   originalId          the id in the grade reply (`original.id`) or the
 *                       graded-attempt event (`original.id`)
 *   sha256              the digest the mark names; a fetched page with any
 *                       other digest is not shown as this mark's work
 *   classId, studentId  the teacher's view (both, or neither)
 *   marks, showReading, label   as OriginalWork
 */
export function MarkedOriginal({ originalId, sha256 = null, classId = null, studentId = null, ...rest }) {
  const t = useT();
  const [state, setState] = useState({ phase: 'loading', original: null });
  useEffect(() => {
    let live = true;
    if (!originalId) { setState({ phase: 'none', original: null }); return undefined; }
    setState({ phase: 'loading', original: null });
    const ask = classId && studentId ? cloud.teacherOriginal(classId, studentId, originalId) : cloud.original(originalId);
    ask.then(reply => {
      if (!live) return;
      const original = reply?.original || null;
      if (!original || (sha256 && original.sha256 !== sha256)) setState({ phase: sha256 && original ? 'mismatch' : 'none', original: null });
      else setState({ phase: 'ready', original });
    }).catch(() => { if (live) setState({ phase: 'none', original: null }); });
    return () => { live = false; };
  }, [originalId, sha256, classId, studentId]);
  if (state.phase === 'loading') return <div className="ow ow-pending" role="status">{t('ow.opening')}</div>;
  if (state.phase === 'mismatch') return <div className="ow ow-missing" role="status">{t('ow.digestMismatch')}</div>;
  if (state.phase === 'none') return <div className="ow ow-missing" role="status">{t('ow.unavailable')}</div>;
  return <OriginalWork original={state.original} {...rest} />;
}
