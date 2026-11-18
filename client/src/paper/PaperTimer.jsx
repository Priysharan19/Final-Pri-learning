// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the optional paper clock
//
// Reading time and working time are the ones the paper states. The clock is a
// courtesy to the student, never a limit: it counts the time spent in this
// sitting (carried over a resume), shows what is left of the current stage, and
// can be switched off. Nothing is locked when it reaches zero.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useT } from '../i18n/index.js';

export const clock = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

/** Which stage the elapsed time is in, and what is left of it. */
export function stageOf(elapsedMs, readingMs, workingMs) {
  if (elapsedMs < readingMs) return { stage: 'reading', left: readingMs - elapsedMs };
  const left = readingMs + workingMs - elapsedMs;
  return left >= 0 ? { stage: 'working', left } : { stage: 'over', left: -left };
}

export default function PaperTimer({ on, onToggle, elapsedMs, readingMs, workingMs, disabled = false }) {
  const t = useT();
  const { stage, left } = stageOf(elapsedMs, readingMs, workingMs);
  return (
    <div className="pp-timer">
      <label className="pp-timer-switch">
        <input type="checkbox" checked={on} disabled={disabled} onChange={e => onToggle(e.target.checked)} data-paper-timer-switch />
        <span>{t('paper.timer.show')}</span>
      </label>
      {on && (
        <p className="pp-timer-read" role="timer" aria-live="off" data-paper-timer={stage}>
          {t(`paper.timer.${stage}`, { time: clock(left) })}
        </p>
      )}
    </div>
  );
}
