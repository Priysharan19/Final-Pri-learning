// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Section analysis card for a finalised India exam.
//
// Renders what local/examAnalysis.js computed — nothing here re-derives a
// mark. Every figure is stated in words and numbers, never by colour alone,
// and the table scrolls sideways on a phone rather than squeezing.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useT } from '../i18n/index.js';

const pctText = v => (v === null || v === undefined ? '—' : `${v}%`);
const signed = n => (n > 0 ? `+${n}` : String(n));

function minutes(ms) {
  if (ms === null || ms === undefined) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ExamAnalysis({ analysis }) {
  const t = useT();
  if (!analysis || !Array.isArray(analysis.sections) || !analysis.sections.length) return null;
  const { pattern, totals, sections, timed, weakChapters = [] } = analysis;
  const jee = pattern === 'jee-main' || pattern === 'jee-advanced';
  const cbse = pattern === 'cbse';
  const partialCol = cbse || pattern === 'jee-advanced';
  const summaryVars = { attempted: totals.attempted, questions: totals.questions, full: totals.full, wrong: totals.wrong, accuracy: pctText(totals.accuracy) };

  return (
    <section className="card exam-analysis" aria-labelledby="exam-analysis-title">
      <h2 className="card-title" id="exam-analysis-title">{t('examAnalysis.title')}</h2>
      <p className="sub" style={{ marginBottom: 4 }}>
        {totals.partial
          ? t('examAnalysis.summaryWithPartial', { ...summaryVars, partial: totals.partial })
          : t('examAnalysis.summary', summaryVars)}
      </p>
      {jee && (
        <p className="sub" style={{ marginBottom: 12 }}>
          {t('examAnalysis.jeeNet', { positive: signed(totals.positive), negative: totals.negative, net: totals.awarded })}
        </p>
      )}

      <div className="table-scroll" style={{ marginTop: jee ? 0 : 8 }}>
        <table className="table">
          <caption className="sr-only">{t('examAnalysis.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('examAnalysis.colSection')}</th>
              <th scope="col">{t('examAnalysis.colMarks')}</th>
              <th scope="col">{t('examAnalysis.colAttempted')}</th>
              <th scope="col">{t('examAnalysis.colCorrect')}</th>
              {partialCol && <th scope="col">{t('examAnalysis.colPartial')}</th>}
              <th scope="col">{t('examAnalysis.colWrong')}</th>
              <th scope="col">{t('examAnalysis.colUnattempted')}</th>
              <th scope="col">{t('examAnalysis.colAccuracy')}</th>
              {jee && <th scope="col">{t('examAnalysis.colNegative')}</th>}
              {cbse && <th scope="col">{t('examAnalysis.colStepLost')}</th>}
              {timed && <th scope="col">{t('examAnalysis.colTime')}</th>}
            </tr>
          </thead>
          <tbody>
            {sections.map(s => (
              <tr key={s.id}>
                <th scope="row" lang="en" style={{ fontWeight: 600, textAlign: 'left' }}>{s.label}</th>
                <td>{s.awarded} / {s.marks}</td>
                <td>{s.attempted} / {s.questions}</td>
                <td>{s.full}</td>
                {partialCol && <td>{s.partial}</td>}
                <td>{s.wrong}</td>
                <td>{s.unattempted}</td>
                <td>{pctText(s.accuracy)}</td>
                {jee && <td>{s.negative ? `−${s.negative}` : '0'}</td>}
                {cbse && <td>{s.stepMarksLost}</td>}
                {timed && <td>{minutes(s.ms)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cbse && analysis.stepMarks && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          {analysis.stepMarks.questions
            ? t('examAnalysis.stepMarks', { count: analysis.stepMarks.questions, earned: analysis.stepMarks.earned, lost: analysis.stepMarks.lost, lostOnAttempted: analysis.stepMarks.lostOnAttempted, unattempted: analysis.stepMarks.unattemptedMarks })
            : t('examAnalysis.stepMarksNone', { lostOnAttempted: analysis.stepMarks.lostOnAttempted, unattempted: analysis.stepMarks.unattemptedMarks })}
        </p>
      )}

      {jee && analysis.negativeMarking && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          {t('examAnalysis.negative', { wrong: analysis.negativeMarking.wrong, lost: analysis.negativeMarking.marksLost, blank: analysis.negativeMarking.netIfWrongLeftBlank, net: analysis.negativeMarking.net })}
        </p>
      )}

      {pattern === 'jee-advanced' && analysis.partialMarking && (
        <p style={{ marginTop: 8, fontSize: 14 }}>
          {analysis.partialMarking.questions
            ? t('examAnalysis.partial', { questions: analysis.partialMarking.questions, marks: analysis.partialMarking.marks, left: analysis.partialMarking.left })
            : t('examAnalysis.partialNone')}
        </p>
      )}

      {weakChapters.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 className="sc-label" style={{ fontSize: 13, margin: '0 0 6px' }}>{t('examAnalysis.weakTitle')}</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {weakChapters.map(c => (
              <li key={c.id}>
                {t('examAnalysis.weakItem', { label: c.label, awarded: c.awarded, marks: c.marks, lost: c.lost, wrong: c.wrong, unattempted: c.unattempted })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!timed && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>{t('examAnalysis.untimed')}</p>}
    </section>
  );
}
