// The exam shell's per-question notes (F4 §1.1): typed text, up to 5,000
// characters, the student's own thinking space. Notes are never an answer:
// nothing reads them, marks them or sends them anywhere but the attempt's own
// record. Pencil ink (spec §7.3) is a later, separately reviewed change; this
// component takes text only.
//
//   q, text, onText(text), readOnly, inputRef, maxLength
import React from 'react';
import { useT } from '../i18n/index.js';

export const NOTE_LIMIT = 5000;

export default function QuestionNotes({ q, text, onText, readOnly = false, inputRef = null, maxLength = NOTE_LIMIT }) {
  const t = useT();
  const id = `xs-notes-${q}`;
  const left = maxLength - String(text || '').length;
  return (
    <div className="xs-notes">
      <label className="label" htmlFor={id}>{t('shell.notesFor', { n: q })}</label>
      <textarea id={id} ref={inputRef} className="input xs-notes-input" value={text || ''} maxLength={maxLength} readOnly={readOnly}
        rows={8} spellCheck="true" data-notes-for={q}
        aria-describedby={`${id}-hint`}
        onChange={e => onText(e.target.value.slice(0, maxLength))} />
      <p className="in-note xs-notes-hint" id={`${id}-hint`}>
        {t('shell.notesHint')}{left <= 200 ? ` ${t('shell.notesLeft', { count: left, n: left })}` : ''}
      </p>
    </div>
  );
}
