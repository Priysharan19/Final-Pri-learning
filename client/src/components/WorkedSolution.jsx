// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the solution of a worked-solution question
//
// His show-that, prove, explain, sketch and unkeyed "find" questions have no key, so nothing marks them. After the student presses for it, the server
// sends his worked steps and his criteria, and (only where the report never crosses his own page) a note on the student's own lines. This draws them:
//
//   · his steps, in the page's own step style;
//   · "what a marker looks for": his criteria with his marks, as a list to READ. There is no input, no box to tick and nothing the student can set: a mark
//     here is information, never earned and never stored;
//   · the student's own lines with a tick where one holds and one quiet "look again", when the server sent that note. Never a cross, never a mark.
// It decides nothing. client/test/online-check-access-check.mjs holds the card to that.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { MathText } from '../lib/latex.jsx';
import Icon from './Icon.jsx';
import { useT } from '../i18n/index.js';
import './WorkedSolution.css';

export default function WorkedSolution({ res, lines = [] }) {
  const t = useT();
  const steps = res?.solution?.steps || [];
  const criteria = res?.solution?.criteria || [];
  const note = res?.workNote || null;
  const shown = Array.isArray(lines) ? lines.slice(0, 40) : [];
  return (
    <section className="solution-block wk" data-worked-solution aria-label={t('worked.solutionTitle')}>
      {note && shown.length > 0 && (
        <div className="wk-work" data-worked-work>
          <p className="sc-label">{t('worked.yourWorking')}</p>
          <ol className="wk-lines">
            {shown.map((line, i) => (
              <li key={i} data-worked-line={i < note.verified ? 'holds' : note.lookAgain === i + 1 ? 'look' : 'plain'}>
                <span className="wk-glyph" aria-hidden="true">{i < note.verified ? <Icon name="check" size={14} /> : null}</span>
                <span className="wk-line-text" lang="en">{line}</span>
                {i < note.verified && <span className="sr-only">{t('worked.lineHolds')}</span>}
                {note.lookAgain === i + 1 && <span className="wk-look">{t('worked.lookAgain')}</span>}
              </li>
            ))}
          </ol>
          <p className="wk-note muted" role="status">{note.verified > 0 ? (note.lines === 1 ? t('worked.noteOne') : t('worked.noteSome', { verified: note.verified, lines: note.lines })) : t('worked.noteNone')}</p>
        </div>
      )}
      <p className="sc-label">{t('worked.solutionTitle')}</p>
      <div className="steps">
        {steps.map((s, i) => (
          <div className="step" key={i}>
            <span className="step-n">{i + 1}</span>
            <div>
              {/* His solution is content, in the content's language, like the prompt. */}
              <div className="step-h" lang="en"><MathText text={s.h} /></div>
              <div className="step-d" lang="en"><MathText text={s.d} /></div>
            </div>
          </div>
        ))}
      </div>
      {criteria.length > 0 && (
        <div className="wk-criteria" data-worked-criteria>
          <p className="sc-label">{t('worked.criteriaTitle')}</p>
          <ul>
            {criteria.map((c, i) => (
              <li key={i}>
                <span className="wk-point" lang="en"><MathText text={c.point} /></span>
                <span className="wk-marks">{c.marks === 1 ? t('worked.marksOne') : t('worked.marksMany', { n: c.marks })}</span>
              </li>
            ))}
          </ul>
          <p className="wk-note muted">{t('worked.criteriaNote')}</p>
        </div>
      )}
    </section>
  );
}
