// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the one question picker
//
// Year (or class), course (or track), topic, level, type, and one Start button:
// the first screen for a visitor (GuestTry) and the Home quick-start for a
// signed-in student. Nothing is listed that has no question behind it: the
// chapters and levels come from guestMenu.js, which reads the same availability
// the existing pickers do. Plain native controls, so the keyboard, a screen
// reader and a phone all get what they already know how to use. The last
// choice is remembered on this device only.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/index.js';
import { coursesFor, chaptersFor, guestYears, settleChoice, PICKER_FORMS } from './guestMenu.js';

const STORE = 'pri.picker.v1';
const FORM_KEY = { typed: 'picker.typeTyped', choice: 'picker.typeChoice', written: 'picker.typeWritten' };

function remembered(edition) {
  try { return JSON.parse(globalThis.localStorage?.getItem(`${STORE}.${edition}`) || '{}') || {}; } catch { return {}; }
}
function remember(edition, choice) {
  try { globalThis.localStorage?.setItem(`${STORE}.${edition}`, JSON.stringify(choice)); } catch { /* a convenience only */ }
}

/**
 * `onStart(choice)` receives { year, course, chapter, difficulty, form }.
 * `forms` lists the types offered (the guest offers all three; Home offers none,
 * because the practice page itself lets a student type or write).
 */
export default function QuestionPicker({ edition, defaultYear = 9, forms = PICKER_FORMS, onStart, busy = false, idPrefix = 'qp', startLabel = null }) {
  const t = useT();
  const [choice, setChoice] = useState(() => settleChoice(edition, remembered(edition), { defaultYear }));

  const courses = useMemo(() => coursesFor(edition, choice.year, { mathsLabel: t('picker.maths') }), [edition, choice.year, t]);
  const chapters = useMemo(() => (choice.course ? chaptersFor(edition, choice.year, choice.course) : []), [edition, choice.year, choice.course]);
  const levels = chapters.find(c => c.id === choice.chapter)?.levels || [];
  const groups = useMemo(() => {
    const map = new Map();
    for (const c of chapters) { if (!map.has(c.strand)) map.set(c.strand, []); map.get(c.strand).push(c); }
    return [...map.entries()];
  }, [chapters]);

  useEffect(() => { remember(edition, choice); }, [edition, choice]);

  // Any change settles to a choice that is still on offer (a new year may have no such course or chapter).
  const change = patch => setChoice(prev => settleChoice(edition, { ...prev, ...patch }, { defaultYear }));
  const ready = choice.course && choice.chapter && choice.difficulty != null && !busy;
  const submit = e => { e.preventDefault(); if (ready) onStart(choice); };
  const id = name => `${idPrefix}-${name}`;

  return (
    <form className="qp" onSubmit={submit} data-question-picker aria-busy={busy || undefined}>
      <div className="qp-row">
        <div className="qp-field">
          <label htmlFor={id('year')}>{t('picker.year')}</label>
          <select id={id('year')} className="input" value={choice.year} onChange={e => change({ year: Number(e.target.value) })} data-picker-year>
            {guestYears().map(y => <option key={y} value={y}>{t('common.classNumber', { n: y })}</option>)}
          </select>
        </div>
        <div className="qp-field">
          <label htmlFor={id('course')}>{t('picker.course')}</label>
          <select id={id('course')} className="input" value={choice.course || ''} onChange={e => change({ course: e.target.value })} data-picker-course>
            {courses.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="qp-field">
        <label htmlFor={id('topic')}>{t('picker.topic')}</label>
        <select id={id('topic')} className="input" value={choice.chapter || ''} disabled={!chapters.length} onChange={e => change({ chapter: e.target.value })} data-picker-topic>
          {groups.map(([strand, rows]) => (
            <optgroup key={strand || 'all'} label={strand}>
              {rows.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
        {!chapters.length && <p className="qp-note" role="status">{t('picker.noTopics')}</p>}
      </div>

      <fieldset className="qp-set" disabled={!levels.length}>
        <legend>{t('picker.level')}</legend>
        <div className="qp-choices">
          {levels.map(d => (
            <label key={d} className="qp-choice">
              <input type="radio" name={id('level')} value={d} checked={choice.difficulty === d} onChange={() => change({ difficulty: d })} data-picker-level={d} />
              <span>{t(`difficulty.${d}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {forms.length > 0 && (
        <fieldset className="qp-set">
          <legend>{t('picker.type')}</legend>
          <div className="qp-choices">
            {forms.map(f => (
              <label key={f} className="qp-choice">
                <input type="radio" name={id('form')} value={f} checked={choice.form === f} onChange={() => change({ form: f })} data-picker-form={f} />
                <span>{t(FORM_KEY[f])}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button type="submit" className="btn btn-primary qp-start" disabled={!ready} data-picker-start>{startLabel || t('picker.start')}</button>
    </form>
  );
}
