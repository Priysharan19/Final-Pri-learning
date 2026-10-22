import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import { featureEnabled } from '../platform/features.js';
import { MarkGlyph } from './margin/MarginIcon.jsx';

// Write & Check (Pri Luxury, direction C): the margin's engine marks, the
// Check ceremony and the date window. Display only: every mark is the
// deterministic engine's line verdict. The motion is CSS keyframes in
// margin/write.css (C's row reveal, emboss stamp, press ring and calendar
// flip, same curves and durations as motion.js) so the ceremony costs the
// install a few hundred bytes; write.css is a CSS chunk of the instrument
// build only (`write` in the flag-off skip list).
/* global __PRI_FEATURE_INSTRUMENT__ */
// Compile-time: the classic build folds every export below to a no-op and
// carries none of this (nor MarkGlyph).
const ON = typeof __PRI_FEATURE_INSTRUMENT__ === 'boolean' && __PRI_FEATURE_INSTRUMENT__;
if (ON && featureEnabled('instrument') && typeof document !== 'undefined') import('./margin/write.css');

/** The stamp a line earns. Allowlist: only the on-device deterministic
 *  engine's verdicts, which carry no `source`. Anything with a source (the
 *  second, model read is 'cloud-working') is never stamped. */
export function engineMark(v) {
  if (!ON || !v || v.source != null) return null;
  return v.status === 'ok' ? 'ok' : v.status === 'break' || v.status === 'wrong' ? 'x' : v.status === 'ecf' ? 'ecf' : null;
}

export function MarkStamp({ kind }) {
  return ON && kind ? <span className="wc-plane" aria-hidden="true"><i className="wc-ring" /><MarkGlyph kind={kind} size={34} className="wc-stamp" /></span> : null;
}

// Ceremonies striking marks now; the date window waits only while one is.
let running = 0;
let lastSpan = 6000;   // the longest the date window may wait: the running ceremony's length
// One row's slot comes from write.css's own tokens (row + gap + stamp + rest),
// read once per ceremony, so the CSS and this timer cannot drift apart.
const ms = (cs, k) => { const v = cs.getPropertyValue(k).trim(), n = parseFloat(v) || 0; return /ms$/.test(v) ? n : n * 1000; };
const slot = cs => ['--c-d-row', '--wc-d-gap', '--wc-d-stamp', '--wc-d-rest'].reduce((t, k) => t + ms(cs, k), 0) || 860;

/**
 * The Check ceremony over the InkAnswer root. Each visible [data-wc-row] gets
 * its slot (--wc-d); `wc-go` on the root runs write.css's keyframes: the
 * transcription is set, the engine mark struck and raised on its own plane,
 * then the first error's copper underline draws; then `pri:check-marked`.
 * Interruptible: a new verdict restarts it, unmount ends it. Reduce Motion:
 * write.css drops the animations, so the marks are simply there.
 */
export function useCheckCeremony(stageRef, key) {
  useLayoutEffect(() => {
    const root = stageRef.current?.parentElement;
    if (!ON || !root || !key) return undefined;
    // Visible rows only: the chips on a tablet, the reading list on a phone.
    const cs = getComputedStyle(root);
    const PER = slot(cs);
    const rows = [...root.querySelectorAll('[data-wc-row]')].filter(r => r.querySelector('.wc-plane')?.getClientRects().length);
    rows.forEach((r, i) => r.style.setProperty('--wc-d', `${i * PER}ms`));
    root.style.setProperty('--wc-u', `${rows.length * PER}ms`);
    lastSpan = rows.length * PER + 1000;
    root.classList.remove('wc-go', 'wc-done'); void root.offsetWidth; root.classList.add('wc-go');
    // Nothing to strike (stale, unsure or unmarked lines): no ceremony, and
    // the date window, seeing none running, shows the score at once.
    if (!rows.length) return undefined;
    running++;
    let on = true;
    const stop = () => { if (on) { on = false; running--; } };
    // Only a ceremony that ran to its end lets the score into the window.
    const end = () => { if (on) { stop(); root.classList.add('wc-done'); window.dispatchEvent(new Event('pri:check-marked')); } };
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(end, still ? 0 : rows.length * PER + (ms(cs, '--wc-d-under') || 320));
    return () => { clearTimeout(t); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** The date window: "– /3" until the engine has decided, then the score
 *  flips in once the marks are struck (or at once with no ceremony running).
 *  aria-hidden: the verdict is announced once, by the card's live region. */
export function DateWindow({ score, outOf }) {
  const [shown, setShown] = useState(null);
  useEffect(() => {
    setShown(null);
    if (score == null) return undefined;
    const go = () => setShown(score);
    addEventListener('pri:check-marked', go);
    const f = requestAnimationFrame(() => running || go());
    const cap = setTimeout(go, lastSpan);
    return () => { removeEventListener('pri:check-marked', go); cancelAnimationFrame(f); clearTimeout(cap); };
  }, [score]);
  return ON && outOf >= 1 ? <span className="wc-datewin" aria-hidden="true" data-date-window={shown ?? 'pending'}><span key={shown ?? '-'}>{shown ?? '–'} /{outOf}</span></span> : null;
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
