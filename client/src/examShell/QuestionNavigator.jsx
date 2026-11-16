// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the exam shell — the question navigator (ADR-0002 §8, F4 §1.1)
//
// One navigator for both modes of the examination system: the unmarked Exam
// Desk uses it today; the marked exam room moves onto it in plan F4c. Questions
// are numbers, grouped by the paper's sections. Each button says where it is
// and what the student has put on it — "Question 7, flagged, has a note,
// current" — and nothing about whether anything is right: the shell has no
// such state to show.
//
//   groups    [{ label, format, start, end }]   the paper's sections, in order
//   current   the question on screen
//   stateOf   q → { done, flagged, noted }
//   onSelect  q → void
//   doneKey   the word for `done` (the marked room says "answered")
//
// Roving tabindex: the grid is one tab stop, and the arrow keys, Home and End
// move inside it (up and down by the row the buttons actually wrap into).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef } from 'react';
import { useT } from '../i18n/index.js';

/** The spoken name of one question's button. Exported for client/test/desk-ui-check.mjs. */
export function questionLabel(t, q, state, isCurrent, doneKey = 'shell.qDone') {
  return [
    t('shell.q', { n: q }),
    state?.done ? t(doneKey) : null,
    state?.flagged ? t('shell.qFlagged') : null,
    state?.noted ? t('shell.qNoted') : null,
    isCurrent ? t('shell.qCurrent') : null
  ].filter(Boolean).join(', ');
}

/** Where an arrow key takes the focus: an index into the buttons, or null to stay. */
export function rovingTarget(key, index, boxes) {
  const last = boxes.length - 1;
  if (key === 'ArrowRight') return Math.min(last, index + 1);
  if (key === 'ArrowLeft') return Math.max(0, index - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (key !== 'ArrowDown' && key !== 'ArrowUp') return null;
  const here = boxes[index];
  const down = key === 'ArrowDown';
  // The nearest button in the next (or previous) row, by where it was drawn.
  let best = null;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (down ? b.top <= here.top : b.top >= here.top) continue;
    const rowGap = Math.abs(b.top - here.top), colGap = Math.abs(b.left - here.left);
    if (!best || rowGap < best.rowGap || (rowGap === best.rowGap && colGap < best.colGap)) best = { i, rowGap, colGap };
  }
  return best ? best.i : index;
}

export default function QuestionNavigator({ groups, current, stateOf, onSelect, doneKey = 'shell.qDone' }) {
  const t = useT();
  const ref = useRef(null);
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const buttons = [...(ref.current?.querySelectorAll('button[data-q]') || [])];
    const index = buttons.indexOf(e.target);
    if (index < 0) return;
    const to = rovingTarget(e.key, index, buttons.map(b => ({ top: b.offsetTop, left: b.offsetLeft })));
    if (to === null) return;
    // The page's own ← → shortcuts move between questions; inside the grid the
    // arrows move the focus instead, so the key stops here.
    e.preventDefault();
    e.stopPropagation();
    buttons[to]?.focus();
  };
  return (
    <nav className="xs-nav" aria-label={t('shell.questions')} ref={ref} onKeyDown={onKeyDown}>
      {groups.map(group => (
        <div className="xs-nav-group" key={group.start} role="group" aria-label={group.label}>
          {/* i18n-exempt-start: a section's own label and format, as the paper's publisher recorded them */}
          {groups.length > 1 && <p className="xs-nav-label">{group.label}{group.format ? <span> · {group.format}</span> : null}</p>}
          {/* i18n-exempt-end */}
          <div className="xs-nav-grid">
            {Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i).map(q => {
              const state = stateOf(q) || {};
              const here = q === current;
              return (
                <button key={q} type="button" data-q={q}
                  className={`xs-q${here ? ' is-current' : ''}${state.done ? ' is-done' : ''}${state.flagged ? ' is-flagged' : ''}${state.noted ? ' is-noted' : ''}`}
                  aria-label={questionLabel(t, q, state, here, doneKey)}
                  aria-current={here ? 'true' : undefined}
                  tabIndex={here ? 0 : -1}
                  onClick={() => onSelect(q)}>{q}</button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
