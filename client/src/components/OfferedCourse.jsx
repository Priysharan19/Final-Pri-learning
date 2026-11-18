// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the course a student is offered (owner decision, 19 Nov 2026)
//
// Prithagoras offers Years 11 and 12, Mathematics Advanced and Extension 1
// (the edition table `offering`). Two small pieces, both silent where
// the edition offers everything (Priyabhata):
//
//   CoursePrompt   once, on the next sign-in of a student whose year or course
//                  is no longer offered: choose an offered one. Their history
//                  stays with the profile; only the year and course change.
//   NotOffered     the calm page a link to something hidden lands on.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import { courseOffered, offering, defaultOffering } from '../platform/edition.js';

const COURSE_NAMES = { advanced: 'Advanced', ext1: 'Extension 1' };

/** Whether a signed-in student's own year or course is one this edition no longer offers. */
export const needsCoursePick = user => !!user && user.role !== 'teacher' && (user.course || 'nsw') === 'nsw'
  && !!offering() && !courseOffered(user.year, user.year >= 11 ? (user.pathway || 'advanced') : null);

export function CoursePrompt({ user, setUser }) {
  const t = useT();
  const o = offering();
  const d = defaultOffering();
  const [year, setYear] = useState(o?.years.includes(Number(user?.year)) ? Number(user.year) : d?.year);
  const [pathway, setPathway] = useState(o?.pathways.includes(user?.pathway) ? user.pathway : d?.pathway);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!needsCoursePick(user)) return null;
  const save = async () => {
    setBusy(true); setFailed(false);
    try { const r = await api.patch('/me', { year, pathway }); setUser(r.user); } catch { setFailed(true); setBusy(false); }
  };
  return (
    <>
      <div className="mnav-sheet-scrim" style={{ display: 'block', zIndex: 140 }} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="course-pick-h" data-course-prompt>
        <h2 id="course-pick-h">{t('offer.pick.title')}</h2>
        <p className="muted">{t('offer.pick.lead')}</p>
        <div className="seg" role="radiogroup" aria-label={t('offer.pick.year')} style={{ marginTop: 12 }}>
          {o.years.map(y => (
            <button key={y} type="button" role="radio" aria-checked={year === y} className={year === y ? 'on' : ''} data-testid={`course-pick-year-${y}`} onClick={() => setYear(y)}>{t('common.yearNumber', { n: y })}</button>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label={t('offer.pick.course')} style={{ marginTop: 10 }}>
          {o.pathways.map(k => (
            <button key={k} type="button" role="radio" aria-checked={pathway === k} className={pathway === k ? 'on' : ''} data-testid={`course-pick-${k}`} onClick={() => setPathway(k)}>{COURSE_NAMES[k] || k}</button>
          ))}
        </div>
        {failed && <p role="alert" style={{ marginTop: 10 }}>{t('signup.genericError')}</p>}
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy} onClick={save} data-testid="course-pick-save">{t('offer.pick.save')}</button>
      </div>
    </>
  );
}
