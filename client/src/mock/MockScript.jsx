import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import { MathText } from '../lib/latex.jsx';
import { mockScript } from '../engine/boardMock.js';
import './mock.css';

// The returned script of a board mock: the server-marked result read back as
// an examiner returns a script — the total, each section's score and time, and
// per question the marks, the first line of working the engine refuted and the
// margin mark beside each line. Display only: every number is the server's
// result (engine/boardMock.js mockScript); nothing here marks anything.

const OUTCOME = { correct: 'mock.outcomeCorrect', 'part-marks': 'mock.outcomePart', wrong: 'mock.outcomeWrong', unanswered: 'mock.outcomeUnanswered', pending: 'mock.outcomePending' };
const VERDICT = { ok: 'mock.verdictOk', void: 'mock.verdictVoid', break: 'mock.verdictBreak' };

function clock(ms) {
  const s = Math.round(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

function Margin({ line, t }) {
  if (!line.margin.length) return line.outcome === 'correct' || line.outcome === 'unanswered' || line.outcome === 'pending' ? null : <p className="mock-meta">{t('mock.noWorking')}</p>;
  const fe = line.firstError ? line.firstError.line - 1 : -1;
  return (
    <div className="mock-margin" data-mock-margin>
      <p className="sc-label">{t('mock.margin')}</p>
      <ol className="mock-lines">
        {line.margin.map((l, i) => (
          <li key={i} className={`mock-line is-${l.verdict}${i === fe ? ' is-first-error' : ''}`} data-mock-line={l.verdict}>
            <span className="mock-line-text"><MathText text={l.text} /></span>
            <span className="mock-line-verdict">{t(VERDICT[l.verdict] || 'mock.verdictNote')}</span>
            <span className="mock-line-mark">{l.mark ? `+${l.mark}` : ''}</span>
          </li>
        ))}
      </ol>
      <p className={line.firstError ? 'mock-first-error' : 'mock-meta'} data-mock-first-error={line.firstError ? line.firstError.line : 'none'}>
        {line.firstError ? t('mock.firstError', { n: line.firstError.line }) : t('mock.noError')}
      </p>
    </div>
  );
}

function Line({ line, t }) {
  return (
    <>
      <p className="mock-outcome">
        <b>{line.awarded} / {line.marks}</b> · {t(OUTCOME[line.outcome])}
        {line.choiceTaken === 'or' && <> · {t('mock.choiceTaken')}</>}
      </p>
      {line.note && <p className="mock-meta">{line.note}</p>}
      <Margin line={line} t={t} />
    </>
  );
}

export default function MockScript() {
  const t = useT();
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/exams/${id}`).then(r => setExam(r.exam)).catch(() => setError(t('mock.loadFailed')));
  }, [id]);
  const script = useMemo(() => (exam?.finishedAt && exam.detail
    ? mockScript({ detail: exam.detail, title: exam.title, provisional: exam.provisional === true }, exam.indiaExam?.sections || [])
    : null), [exam]);

  if (error) return <div className="mock-page"><p className="mock-note" role="alert">{error}</p><Link to="/mock">{t('mock.back')}</Link></div>;
  if (!exam) return <div className="mock-page" aria-busy="true" />;
  if (!script) return <div className="mock-page"><p className="mock-note">{t('mock.stillOpen')}</p><Link to={`/exams/${exam.id}`}>{t('mock.resume')}</Link></div>;

  return (
    <div className="mock-page" data-mock-script={exam.id}>
      <Link to="/mock" className="mock-back">{t('mock.back')}</Link>
      <p className="sc-label mock-kicker">{t('mock.label')}</p>
      <h1 className="mock-h1">{t('mock.scriptTitle')}</h1>
      <p className="mock-meta">{exam.title}</p>
      <p className="mock-total" data-mock-total={`${script.score}/${script.total}`}>
        <span className="sc-label">{t('mock.total')}</span> <b>{script.score} / {script.total}</b> <span className="mock-meta">{script.pct}%</span>
      </p>
      {script.provisional && <p className="mock-note" role="status">{t('mock.provisional')}</p>}
      {script.late && <p className="mock-note" role="status">{t('mock.late')}</p>}

      <section className="mock-card" aria-labelledby="mock-sections">
        <h2 id="mock-sections" className="mock-h2">{t('mock.sectionsHead')}</h2>
        <div className="mock-table-wrap">
          <table className="mock-table">
            <thead><tr><th scope="col">{t('mock.colSection')}</th><th scope="col">{t('mock.colScore')}</th><th scope="col">{t('mock.colTime')}</th></tr></thead>
            <tbody>
              {script.sections.map(s => (
                <tr key={s.id} data-mock-section-score={s.id}>
                  <th scope="row">{s.id}</th><td>{s.awarded} / {s.marks}</td><td>{script.timed ? clock(s.ms) : t('mock.notTimed')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="mock-questions">
        <h2 id="mock-questions" className="mock-h2">{t('mock.questionsHead')}</h2>
        {script.questions.map(q => (
          <article key={q.order} className="mock-card mock-q" data-mock-question={q.order}>
            <h3 className="mock-h3">{t('mock.question', { n: q.order })} <span className="mock-meta">· {q.section}{q.chapter ? ` · ${q.chapter}` : ''}{q.timed ? ` · ${clock(q.ms)}` : ''}</span></h3>
            {q.parts
              ? q.parts.map(p => (
                <div key={p.key} className="mock-part" data-mock-part={p.key}>
                  <h4 className="mock-h4">{t('mock.part', { key: p.key })}</h4>
                  <Line line={p} t={t} />
                </div>
              ))
              : <Line line={q} t={t} />}
          </article>
        ))}
      </section>
    </div>
  );
}
