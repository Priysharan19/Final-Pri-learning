import React, { useLayoutEffect } from 'react';
import { useT } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import { featureEnabled } from '../platform/features.js';
import { CLOUD_WORKING_ENGINE } from '../ink/cloudWorking.js';

// Write & Check (Pri Luxury, direction C): the margin's engine marks and the
// Check ceremony. Its stylesheet is a lazily loaded chunk of the instrument
// build only (`write` in the flag-off skip list), so the classic build gains
// nothing but these few functions.
const INSTRUMENT = featureEnabled('instrument');
if (INSTRUMENT && typeof document !== 'undefined') import('./margin/write.css');

/**
 * The stamp a line earns, from the deterministic engine's verdict only. A
 * line the second (model) read judged is never stamped: a model's opinion is
 * not a mark. Shapes differ as well as colours: ✓ circle, ✗ diamond, dashed
 * ecf capsule (drawn only if the engine ever reports a carried line).
 */
export function engineMark(v) {
  if (!v || v.source === CLOUD_WORKING_ENGINE) return null;
  if (v.status === 'ok') return 'ok';
  if (v.status === 'break' || v.status === 'wrong') return 'x';
  if (v.status === 'ecf') return 'ecf';
  return null;
}

export function MarkStamp({ kind }) {
  if (!kind) return null;
  return (
    <span className="wc-plane" data-wc-stamp={kind} aria-hidden="true">
      <span className="wc-ring" />
      <svg className="wc-stamp" viewBox="0 0 44 44" focusable="false">
        {kind === 'ok' && <>
          <circle cx="22" cy="22" r="19" className="wc-f-teal" strokeWidth="1.4" />
          <path d="M13 22.5l6 6 12-13" className="wc-s-teal" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>}
        {kind === 'x' && <>
          <rect x="7.5" y="7.5" width="29" height="29" rx="2" transform="rotate(45 22 22)" className="wc-f-copper" strokeWidth="1.4" />
          <path d="M16 16l12 12M28 16L16 28" className="wc-s-copper" strokeWidth="3" strokeLinecap="round" />
        </>}
        {kind === 'ecf' && <>
          <rect x="2.5" y="11" width="39" height="22" rx="11" fill="none" className="wc-s-copper" strokeWidth="1.4" strokeDasharray="3 2" />
          <text x="22" y="26.5" textAnchor="middle" className="wc-ecf">ecf</text>
        </>}
      </svg>
    </span>
  );
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Plane spring from the A reference: mass 1, k 170, c 22, four sub-steps per
// 60 Hz frame, sampled once into keyframes so the compositor runs it.
function planeKeyframes(rise) {
  const k = 170, c = 22, dt = 1 / 240;
  let x = 0, v = 0;
  const frames = [{ transform: 'translateZ(0px)' }];
  for (let f = 0; f < 90; f++) {
    for (let s = 0; s < 4; s++) { v += (k * (1 - x) - c * v) * dt; x += v * dt; }
    frames.push({ transform: `translateZ(${(x * rise).toFixed(2)}px)` });
    if (Math.abs(1 - x) < 0.0015 && Math.abs(v) < 0.01) break;
  }
  frames[frames.length - 1] = { transform: `translateZ(${rise}px)` };
  return { frames, duration: (frames.length - 1) * (1000 / 60) };
}

export const CEREMONY = Object.freeze({ row: 260, rowGap: 40, stamp: 340, ring: 420, between: 220, rise: 36, underline: 320 });

/**
 * The Check ceremony over a sheet whose rows carry [data-wc-row] (the typeset
 * transcription) with a MarkStamp inside. Each row is set (row reveal), then
 * its engine mark is struck (emboss stamp and press ring) and rises on its own
 * plane; then the first error is underlined in copper; then
 * `pri:check-marked` tells the question head to flip the score into its date
 * window. Every animation is a compositor transform/opacity, created at once
 * with delays so it can be interrupted at any frame (a new Check, an unmount).
 * Reduce Motion: nothing moves, the marks are simply there.
 */
export function useCheckCeremony(sheetRef, key) {
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !key) return undefined;
    const done = () => window.dispatchEvent(new CustomEvent('pri:check-marked', { detail: { key } }));
    const rows = [...sheet.querySelectorAll('[data-wc-row]')];
    if (reduced() || typeof Element === 'undefined' || !Element.prototype.animate || !rows.length) { done(); return undefined; }
    const anims = [];
    const plane = planeKeyframes(CEREMONY.rise);
    const per = CEREMONY.row + CEREMONY.rowGap + CEREMONY.stamp + CEREMONY.between;
    rows.forEach((row, i) => {
      const t0 = i * per;
      anims.push(row.animate([{ opacity: 0, transform: 'translate(-6px, -50%)' }, { opacity: 1, transform: 'translate(0, -50%)' }],
        { duration: CEREMONY.row, delay: t0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
      const ts = t0 + CEREMONY.row + CEREMONY.rowGap;
      const stamp = row.querySelector('.wc-stamp');
      const ring = row.querySelector('.wc-ring');
      const pl = row.querySelector('.wc-plane');
      if (stamp) anims.push(stamp.animate([
        { opacity: 0, transform: 'scale(1.7)' },
        { opacity: 1, transform: 'scale(.9)', offset: 0.55, easing: 'cubic-bezier(.2,0,.2,1)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: CEREMONY.stamp, delay: ts, easing: 'cubic-bezier(.7,0,.9,.6)', fill: 'backwards' }));
      if (ring) anims.push(ring.animate([
        { opacity: 0, transform: 'scale(1.9)' }, { opacity: 0.55, transform: 'scale(1.05)', offset: 0.6 }, { opacity: 0, transform: 'scale(1)' }
      ], { duration: CEREMONY.ring, delay: ts, easing: 'cubic-bezier(.3,0,.2,1)' }));
      if (pl) anims.push(pl.animate(plane.frames, { duration: plane.duration, delay: ts + CEREMONY.stamp * 0.55, easing: 'linear', fill: 'backwards' }));
    });
    const tUnder = rows.length * per;
    sheet.querySelectorAll('[data-wc-first-error]').forEach(u => anims.push(u.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: CEREMONY.underline, delay: tUnder, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' })));
    const timer = setTimeout(done, tUnder + CEREMONY.underline);
    return () => { clearTimeout(timer); for (const a of anims) a.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

// The server's mark, set out as CBSE-style step rows (server/platform/
// markRows.js). Display only: the rows sum to the mark the deterministic
// engine gave, and the server omits them rather than send rows that would
// not. Whole marks. Authored step headings appear only on a correct answer;
// a wrong answer's method marks are numbered, never named. Pri practice
// feedback in a board-style layout, not a CBSE marking scheme.

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
