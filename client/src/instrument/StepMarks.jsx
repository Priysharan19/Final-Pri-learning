import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import { featureEnabled } from '../platform/features.js';
import { MarkGlyph } from './margin/MarginIcon.jsx';
import { reduced, rowReveal, embossStamp, flip } from './margin/motion.js';

// Write & Check (Pri Luxury, direction C): the margin's engine marks, the
// Check ceremony and the date window. Display only: every mark here is the
// deterministic engine's line verdict. The stylesheet is a CSS chunk of the
// instrument build only (`write` in the flag-off skip list).
const INSTRUMENT = featureEnabled('instrument');
if (INSTRUMENT && typeof document !== 'undefined') import('./margin/write.css');

/** The stamp a line earns. A line the second (model) read judged
 *  (source 'cloud-working') is never stamped: an opinion is not a mark. */
export function engineMark(v) {
  if (!v || v.source === 'cloud-working') return null;
  return v.status === 'ok' ? 'ok' : v.status === 'break' || v.status === 'wrong' ? 'x' : v.status === 'ecf' ? 'ecf' : null;
}

export function MarkStamp({ kind }) {
  return kind ? <span className="wc-plane" aria-hidden="true"><span className="wc-ring" /><MarkGlyph kind={kind} size={34} className="wc-stamp" /></span> : null;
}

// How many ceremonies are striking marks now; the date window waits for
// `pri:check-marked` only while one is.
let running = 0;
// C section 5: a row is set (260ms), its mark struck (340ms), 220ms rest.
const PER = 860, UNDER = 320;

/**
 * The Check ceremony over the InkAnswer root: each visible [data-wc-row] has
 * its transcription set (rowReveal), then its engine mark struck
 * (embossStamp) while the plane rises (a CSS transition, write.css); then the
 * first error's copper underline draws; then `pri:check-marked`. Scheduled at
 * once, interruptible (cleanup jumps to the final frame). Reduce Motion: the
 * helpers land on the final frame.
 */
export function useCheckCeremony(stageRef, key) {
  useLayoutEffect(() => {
    const root = stageRef.current?.parentElement;
    if (!root || !key) return undefined;
    // Visible rows only: the chips on a tablet, the reading list on a phone.
    const rows = [...root.querySelectorAll('[data-wc-row]')].filter(r => r.querySelector('.wc-plane')?.getClientRects().length);
    running++;
    let ended = false;
    const end = () => { if (!ended) { ended = true; running--; root.classList.add('wc-risen'); window.dispatchEvent(new Event('pri:check-marked')); } };
    root.classList.remove('wc-risen');
    const hs = [];
    rows.forEach((row, i) => {
      const text = row.querySelector('.in-read-m, .ink-line-math');
      if (text) hs.push(rowReveal([text], { delay: i * PER }));
      const st = row.querySelector('.wc-stamp');
      if (st) hs.push(embossStamp(st, row.querySelector('.wc-ring'), { delay: i * PER + 300 }));
      row.style.setProperty('--wc-d', `${i * PER + 490}ms`);
    });
    const t = reduced() ? 0 : rows.length * PER;
    root.querySelectorAll('[data-wc-first-error]').forEach(u => { if (!reduced() && u.animate) { const a = u.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: UNDER, delay: t, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); hs.push({ finish: () => a.finish() }); } });
    requestAnimationFrame(() => root.classList.add('wc-rise'));
    const timer = setTimeout(end, t && t + UNDER);
    return () => { clearTimeout(timer); hs.forEach(h => { try { h.finish(); } catch { /* gone */ } }); end(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * The date window: "– /3" until the engine has decided, then the score flips
 * in (motion.js flip) once the marks are struck, or at once when no ceremony
 * is running. aria-hidden: the verdict is announced once, by the card.
 */
export function DateWindow({ score, outOf }) {
  const [shown, setShown] = useState(null);
  const win = useRef(null);
  useEffect(() => {
    if (score == null) { setShown(null); return undefined; }
    const go = () => setShown(score);
    window.addEventListener('pri:check-marked', go);
    const raf = requestAnimationFrame(() => { if (!running) go(); });
    const cap = setTimeout(go, 6000);
    return () => { window.removeEventListener('pri:check-marked', go); cancelAnimationFrame(raf); clearTimeout(cap); };
  }, [score]);
  const face = `${shown == null ? '–' : shown} /${outOf}`;
  useEffect(() => {
    const w = win.current;
    if (!w || w.textContent === face) return undefined;
    if (!w.firstChild) { w.textContent = ''; w.append(Object.assign(document.createElement('span'), { textContent: face })); return undefined; }
    return flip(w, face).finish;
  }, [face]);
  if (!(outOf >= 1)) return null;
  return <span className="wc-datewin" aria-hidden="true" data-date-window={shown == null ? 'pending' : `${shown}/${outOf}`}><span className="wc-flip" ref={win} /></span>;
}

export default function StepMarks({ markRows }) {
  const t = useT();
  const rows = Array.isArray(markRows?.rows) ? markRows.rows : [];
  if (!rows.length) return null;
  const earned = rows.reduce((s, r) => s + (Number(r.earned) || 0), 0);
  const total = rows.reduce((s, r) => s + (Number(r.outOf) || 0), 0);
  return (
    <div className="board-award in-step-marks" data-step-marks={markRows.scheme} style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <span className="sc-label" style={{ margin: 0 }}>{t('verdict.markedStepByStep')}</span>
        {rows.length > 1 && <b style={{ fontVariantNumeric: 'tabular-nums' }}>{earned} / {total}</b>}
      </div>
      {rows.map((row, i) => {
        const full = row.earned === row.outOf;
        const label = row.kind === 'answer' ? t('board.labelAnswer') : row.label || t('inst.workingStep', { n: row.step });
        return (
          <div key={i} className="set-row" data-step-mark={row.kind} style={{ paddingTop: 5, paddingBottom: 5 }}>
            <span className="set-k" style={{ fontWeight: 400 }}>
              <span aria-hidden="true" style={{ marginRight: 7, color: full ? 'var(--good)' : 'var(--correction)' }}>
                <Icon name={full ? 'check' : 'correction'} size={14} />
              </span>
              {label}
            </span>
            <span className="set-v" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="sr-only">{t('verdict.rowMarks', { earned: row.earned, total: row.outOf })} </span>{row.earned}/{row.outOf}
            </span>
          </div>
        );
      })}
      {Number.isFinite(markRows.creditedAfterHints) && (
        <p style={{ fontSize: 13, marginTop: 8 }} data-step-marks-hints>{t('inst.stepMarksAfterHints', { credited: markRows.creditedAfterHints })}</p>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('inst.stepMarksOrder')} {t('inst.stepMarksNote')}</p>
    </div>
  );
}
