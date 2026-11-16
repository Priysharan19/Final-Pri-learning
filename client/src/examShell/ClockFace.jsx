// The exam shell's clock face (F4 §1.1). It ONLY DISPLAYS what its caller gives
// it: no timer, no device clock, no deadline arithmetic lives here. The caller
// derives the time (the desk from the server-stamped event log, the marked
// room from the paper's deadline) and hands over milliseconds and words.
//
//   remainingMs   time left in the phase (shown HH:MM:SS, rounded up)
//   overtimeMs    when positive, shown instead as "+HH:MM:SS"
//   label         "Reading time" / "Working time" (desk), "Time left" (marked room)
//   note          a short line under the figures ("paused", "offline estimate")
//   hidden        the student has hidden the figures; the label stays
//   onToggle      press to hide or show
//
// role="timer" with aria-live="off": a screen reader reads it on demand and is
// never interrupted every second. Phase changes are announced by useAnnounce.
import React from 'react';
import { useT } from '../i18n/index.js';
import { formatClock } from '../engine/deskClock.js';

export default function ClockFace({ remainingMs, overtimeMs = 0, label, note = null, hidden = false, onToggle = null }) {
  const t = useT();
  const over = overtimeMs > 0;
  const figures = `${over ? '+' : ''}${formatClock(over ? overtimeMs : remainingMs)}`;
  const body = (
    <>
      <span className="xs-clock-label">{label}</span>
      <span className="xs-clock-time" data-clock-time>{hidden ? t('shell.clockHidden') : figures}</span>
      {note && <span className="xs-clock-note">{note}</span>}
    </>
  );
  const spoken = hidden ? `${label}. ${t('shell.clockHidden')}` : `${label} ${figures}${note ? `, ${note}` : ''}`;
  return (
    <div className={`xs-clock${over ? ' is-over' : ''}`} role="timer" aria-live="off" aria-label={spoken} data-clock-hidden={hidden ? 'true' : undefined}>
      {onToggle
        ? <button type="button" className="xs-clock-btn" onClick={onToggle} aria-label={t(hidden ? 'shell.clockShow' : 'shell.clockHide')} title={t(hidden ? 'shell.clockShow' : 'shell.clockHide')}>{body}</button>
        : body}
    </div>
  );
}

/**
 * The full-width elapsed rule under the header: how much of the phase has run,
 * with a tick at each quarter. Decorative (the clock says the same in words),
 * so it is hidden from assistive technology. `fraction` is the caller's.
 */
export function ElapsedRule({ fraction, tone = null }) {
  const width = `${Math.round(Math.min(1, Math.max(0, Number(fraction) || 0)) * 1000) / 10}%`;
  return (
    <div className="xs-rule" aria-hidden="true" data-tone={tone || undefined}>
      <i style={{ width }} />
      <u style={{ left: '25%' }} /><u style={{ left: '50%' }} /><u style={{ left: '75%' }} />
    </div>
  );
}
