import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import { MarkGlyph } from './margin/MarginIcon.jsx';
import { reduced, rowReveal, embossStamp, planeSpring, flip } from './margin/motion.js';

// Write & Check (Pri Luxury, direction C): the margin's engine marks, the
// Check ceremony and the date window. This module is only ever loaded lazily,
// by the instrument build (StepMarks and write are in the flag-off skip list
// in vite.config.js), so the classic build carries none of it.
import './margin/write.css';

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
// How many ceremonies are striking marks right now. The date window waits for
// `pri:check-marked` only while one is; otherwise the score lands at once.
let running = 0;
export const ceremonyRunning = () => running > 0;

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
    const stage = sheetRef.current;
    if (!stage || !key) return undefined;
    // The stage and the reading list under it share the InkAnswer root.
    const sheet = stage.parentElement || stage;
    const announce = () => window.dispatchEvent(new CustomEvent('pri:check-marked', { detail: { key } }));
    // Only the rows whose stamp is on screen: the chips beside the ink on a
    // tablet, the reading list on a phone (write.css shows one or the other).
    const rows = [...sheet.querySelectorAll('[data-wc-row]')].filter(r => {
      const st = r.querySelector('.wc-plane');
      return st && st.getClientRects().length > 0;
    });
    running += 1;
    let ended = false;
    const end = () => { if (!ended) { ended = true; running -= 1; announce(); } };
    const planes = rows.map(r => r.querySelector('.wc-plane')).filter(Boolean);
    const setZ = (el, z) => { el.style.transform = `translateZ(${z.toFixed(2)}px)`; };
    if (reduced() || typeof Element === 'undefined' || !Element.prototype.animate || !rows.length) {
      planes.forEach(p => setZ(p, CEREMONY.rise));
      end();
      return undefined;
    }
    const handles = [];
    const per = CEREMONY.row + CEREMONY.rowGap + CEREMONY.stamp + CEREMONY.between;
    rows.forEach((row, i) => {
      const t0 = i * per;
      const text = row.querySelector('.in-read-m, .ink-line-math');
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
    const timer = setTimeout(end, tUnder + CEREMONY.underline);
    return () => {
      clearTimeout(timer);
      end();
      // Interrupted: jump every mark to its final frame rather than leave one half struck.
      for (const h of handles) { try { h.finish(); } catch { /* element gone */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * The date window (Pri Luxury, direction C): "– /3" until the engine has
 * decided, then the score flips in like a calendar complication, after the
 * margin's marks are struck (`pri:check-marked`), or at once when there is no
 * ceremony to wait for (typed answers, Reduce Motion). Display only and
 * aria-hidden: the verdict is announced once, by the card's own live region.
 */
export function DateWindow({ score, outOf }) {
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
    // A ceremony may still be on its way in this commit (its layout effect
    // runs first): look on the next frame, and never wait more than 6s.
    const look = requestAnimationFrame(() => { if (!ceremonyRunning()) go(); });
    const fallback = setTimeout(go, reduced() ? 0 : 6000);
    return () => { window.removeEventListener('pri:check-marked', onMarked); clearTimeout(fallback); cancelAnimationFrame(look); };
  }, [score]);
  // The window's faces are owned by flip() (motion.js): React renders the
  // empty frame and never reconciles inside it.
  const face = shown == null ? `– /${outOf}` : `${shown} /${outOf}`;
  useEffect(() => {
    const win = flipRef.current;
    if (!win) return undefined;
    if (!win.firstChild) { const f = document.createElement('span'); f.textContent = face; win.appendChild(f); return undefined; }
    if (win.lastElementChild?.textContent === face) return undefined;
    const h = flip(win, face);
    return () => h.finish();
  }, [face]);
  if (!Number.isInteger(outOf) || outOf < 1) return null;
  return (
    <span className="wc-datewin" aria-hidden="true" data-date-window={shown == null ? 'pending' : `${shown}/${outOf}`}>
      <span className="wc-flip" ref={flipRef} />
    </span>
  );
}

/** The ceremony as a component, so InkAnswer can load it lazily. Renders nothing. */
export function CheckCeremony({ sheetRef, ceremonyKey }) {
  useCheckCeremony(sheetRef, ceremonyKey);
  return null;
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
