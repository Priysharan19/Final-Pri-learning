import React, { useLayoutEffect } from 'react';
import { useT } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import { featureEnabled } from '../platform/features.js';
import { CLOUD_WORKING_ENGINE } from '../ink/cloudWorking.js';
import { MarkGlyph } from './margin/MarginIcon.jsx';
import { reduced, rowReveal, embossStamp, planeSpring } from './margin/motion.js';

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
      <MarkGlyph kind={kind} size={34} className="wc-stamp" />
    </span>
  );
}

// Timings from the C reference (section 5): a row is set, its mark is struck,
// 220ms rest, the next row. The rise is A's plane spring (k 170, c 22).
export const CEREMONY = Object.freeze({ row: 260, rowGap: 40, stamp: 340, between: 220, rise: 36, underline: 320 });

/**
 * The Check ceremony over a sheet whose margin rows carry [data-wc-row] (the
 * typeset transcription) with a MarkStamp inside. Each row's transcription is
 * set (rowReveal), then its engine mark is struck (embossStamp) and rises on
 * its own plane (planeSpring); then the first error is underlined in copper;
 * then `pri:check-marked` tells the question head to flip the score into its
 * date window. Every step is scheduled at once and is interruptible (a new
 * verdict or an unmount finishes or stops it). Reduce Motion: the motion
 * helpers land on the final frame, so the marks are simply there.
 */
export function useCheckCeremony(sheetRef, key) {
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !key) return undefined;
    const announce = () => window.dispatchEvent(new CustomEvent('pri:check-marked', { detail: { key } }));
    const rows = [...sheet.querySelectorAll('[data-wc-row]')];
    const planes = rows.map(r => r.querySelector('.wc-plane')).filter(Boolean);
    const setZ = (el, z) => { el.style.transform = `translateZ(${z.toFixed(2)}px)`; };
    if (reduced() || typeof Element === 'undefined' || !Element.prototype.animate || !rows.length) {
      planes.forEach(p => setZ(p, CEREMONY.rise));
      announce();
      return undefined;
    }
    const handles = [];
    const per = CEREMONY.row + CEREMONY.rowGap + CEREMONY.stamp + CEREMONY.between;
    rows.forEach((row, i) => {
      const t0 = i * per;
      const text = row.querySelector('.in-read-m');
      if (text) handles.push(rowReveal([text], { delay: t0 }));
      const ts = t0 + CEREMONY.row + CEREMONY.rowGap;
      const stamp = row.querySelector('.wc-stamp');
      const plane = row.querySelector('.wc-plane');
      if (stamp) handles.push(embossStamp(stamp, row.querySelector('.wc-ring'), { delay: ts }));
      if (plane) {
        setZ(plane, 0);
        handles.push(planeSpring({ from: 0, to: CEREMONY.rise, delay: ts + CEREMONY.stamp * 0.55, onUpdate: z => setZ(plane, z) }));
      }
    });
    const tUnder = rows.length * per;
    sheet.querySelectorAll('[data-wc-first-error]').forEach(u => {
      if (!u.animate) return;
      const a = u.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: CEREMONY.underline, delay: tUnder, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      handles.push({ finish: () => a.finish() });
    });
    const timer = setTimeout(announce, tUnder + CEREMONY.underline);
    return () => {
      clearTimeout(timer);
      // Interrupted: jump every mark to its final frame rather than leave one half struck.
      for (const h of handles) { try { h.finish(); } catch { /* element gone */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
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
