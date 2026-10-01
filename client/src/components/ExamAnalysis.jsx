// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Section analysis card for a finalised India exam.
//
// Renders what local/examAnalysis.js computed — nothing here re-derives a
// mark. Every figure is stated in words and numbers, never by colour alone,
// and the table scrolls sideways on a phone rather than squeezing.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

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
  if (!analysis || !Array.isArray(analysis.sections) || !analysis.sections.length) return null;
  const { pattern, totals, sections, timed, weakChapters = [] } = analysis;
  const jee = pattern === 'jee-main' || pattern === 'jee-advanced';
  const cbse = pattern === 'cbse';

  return (
    <section className="card exam-analysis" aria-labelledby="exam-analysis-title">
      <h2 className="card-title" id="exam-analysis-title">Section analysis</h2>
      <p className="sub" style={{ marginBottom: 12 }}>
        Attempted <b>{totals.attempted}</b> of {totals.questions} · fully correct <b>{totals.full}</b>
        {totals.partial ? <> · part-credit <b>{totals.partial}</b></> : null}
        {' '}· wrong <b>{totals.wrong}</b> · accuracy on attempted <b>{pctText(totals.accuracy)}</b>
        {jee && <> · <b>{signed(totals.positive)}</b> earned, <b>−{totals.negative}</b> lost, net <b>{totals.awarded}</b></>}
      </p>

      <div className="table-scroll">
        <table className="table">
          <caption className="sr-only">Marks by section</caption>
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th scope="col">Marks</th>
              <th scope="col">Attempted</th>
              <th scope="col">Correct</th>
              {(cbse || pattern === 'jee-advanced') && <th scope="col">Part-credit</th>}
              <th scope="col">Wrong</th>
              <th scope="col">Unattempted</th>
              <th scope="col">Accuracy</th>
              {jee && <th scope="col">Negative</th>}
              {cbse && <th scope="col">Step marks lost</th>}
              {timed && <th scope="col">Time</th>}
            </tr>
          </thead>
          <tbody>
            {sections.map(s => (
              <tr key={s.id}>
                <th scope="row" style={{ fontWeight: 600, textAlign: 'left' }}>{s.label}</th>
                <td>{s.awarded} / {s.marks}</td>
                <td>{s.attempted} / {s.questions}</td>
                <td>{s.full}</td>
                {(cbse || pattern === 'jee-advanced') && <td>{s.partial}</td>}
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
          <b>Step marks.</b> {analysis.stepMarks.questions
            ? <>Method marks earned on {analysis.stepMarks.questions} question{analysis.stepMarks.questions === 1 ? '' : 's'} ({analysis.stepMarks.earned} marks); {analysis.stepMarks.lost} more were lost on those same questions.</>
            : <>No question earned part-credit for working.</>}
          {' '}On attempted questions {analysis.stepMarks.lostOnAttempted} mark{analysis.stepMarks.lostOnAttempted === 1 ? ' was' : 's were'} lost; {analysis.stepMarks.unattemptedMarks} were left on unattempted questions.
        </p>
      )}

      {jee && analysis.negativeMarking && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          <b>Negative marking.</b> {analysis.negativeMarking.wrong} wrong answer{analysis.negativeMarking.wrong === 1 ? '' : 's'} cost {analysis.negativeMarking.marksLost} mark{analysis.negativeMarking.marksLost === 1 ? '' : 's'}.
          {' '}Leaving {analysis.negativeMarking.wrong === 1 ? 'it' : 'them'} blank would have scored {analysis.negativeMarking.netIfWrongLeftBlank} instead of {analysis.negativeMarking.net}.
        </p>
      )}

      {pattern === 'jee-advanced' && analysis.partialMarking && (
        <p style={{ marginTop: 8, fontSize: 14 }}>
          <b>Partial marking.</b> {analysis.partialMarking.questions
            ? <>{analysis.partialMarking.questions} multiple-correct answer{analysis.partialMarking.questions === 1 ? '' : 's'} earned partial credit worth {analysis.partialMarking.marks} mark{analysis.partialMarking.marks === 1 ? '' : 's'}, leaving {analysis.partialMarking.left} on the table.</>
            : <>No answer earned partial credit.</>}
        </p>
      )}

      {weakChapters.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 className="sc-label" style={{ fontSize: 13, margin: '0 0 6px' }}>Chapters to work on next</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {weakChapters.map(c => (
              <li key={c.id}>
                <b>{c.label}</b> — {c.awarded} of {c.marks} marks ({c.lost} lost
                {c.wrong ? `, ${c.wrong} wrong` : ''}{c.unattempted ? `, ${c.unattempted} unattempted` : ''})
              </li>
            ))}
          </ul>
        </div>
      )}
      {!timed && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>Time per section was not measured for this paper.</p>}
    </section>
  );
}
