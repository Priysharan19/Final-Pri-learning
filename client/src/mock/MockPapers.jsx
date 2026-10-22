import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { checkRefusal, checkRefusalCopy } from '../components/checkAccess.js';
import { CheckRefusal } from '../components/CheckRefusal.jsx';
import { boardMockOf, mockSpecOf } from '../engine/boardMock.js';
import './mock.css';

// Board mock papers ("Pri mock in board format", engine/boardMock.js): the
// student's board paper set out as its blueprint, one start button, and the
// mocks already sat. The paper itself is sat in the exam room (/exams/:id) and
// marked by the server; whether this account may start one is the server's
// decision (one free sample, then Premium), shown here as it answers.

export default function MockPapers() {
  const t = useT();
  const nav = useNavigate();
  const { user, refreshUser } = useApp();
  const [mocks, setMocks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refusal, setRefusal] = useState(null);
  const [premium, setPremium] = useState(false);

  const selection = useMemo(() => ({ track: user?.course === 'in' ? (user.indiaTrack || 'cbse') : null, grade: Number(user?.year), variant: 'standard' }), [user?.course, user?.indiaTrack, user?.year]);
  const mock = boardMockOf(selection);
  const spec = mock ? mockSpecOf(selection) : null;

  useEffect(() => {
    if (!mock) return;
    api.get('/exams').then(r => setMocks((r.exams || []).filter(e => e.mock))).catch(() => setMocks([]));
  }, [mock?.id]);

  async function start() {
    setBusy(true); setError(''); setRefusal(null); setPremium(false);
    try {
      const r = await api.post('/exams', { mock: true });
      nav(`/exams/${r.exam.id}`);
    } catch (err) {
      const kind = checkRefusal(err);
      if (err?.status === 402) setPremium(true);
      else if (checkRefusalCopy(kind, 'exam')) setRefusal(kind);
      else setError(err?.message || t('mock.startFailed'));
    } finally { setBusy(false); }
  }

  return (
    <div className="mock-page" data-mock-page>
      <p className="sc-label mock-kicker">{t('mock.label')}</p>
      <h1 className="mock-h1">{t('mock.title')}</h1>
      <p className="mock-intro">{t('mock.intro')}</p>

      {!mock && <p className="mock-note" role="status" data-mock-unavailable>{t('mock.notAvailable')}</p>}

      {mock && spec && (
        <section className="mock-card" aria-labelledby="mock-paper-name" data-mock-blueprint={spec.id}>
          <h2 id="mock-paper-name" className="mock-h2">{t(selection.grade === 12 ? 'mock.class12' : 'mock.class10')}</h2>
          <p className="mock-meta">{t('mock.shape', { min: spec.durationMinutes, marks: spec.totalMarks, n: spec.sections.reduce((n, s) => n + s.questions, 0) })}</p>
          <div className="mock-table-wrap">
            <table className="mock-table">
              <thead><tr>
                <th scope="col">{t('mock.colSection')}</th><th scope="col">{t('mock.colQuestions')}</th>
                <th scope="col">{t('mock.colMarksEach')}</th><th scope="col">{t('mock.colMarks')}</th><th scope="col">{t('mock.colChoice')}</th>
              </tr></thead>
              <tbody>
                {spec.sections.map(s => (
                  <tr key={s.id} data-mock-section={s.id}>
                    <th scope="row">{s.id}</th><td>{s.questions}</td><td>{s.marksEach}</td><td>{s.marks}</td>
                    <td>{s.internalChoice ? t('mock.choiceN', { n: s.internalChoice }) : t('mock.choiceNone')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(spec.sources || []).filter(s => s.kind === 'sample-paper').map(s => (
            <p key={s.url} className="mock-source"><a href={s.url} target="_blank" rel="noreferrer">{t('mock.source', { title: s.title })}</a></p>
          ))}
          <p className="mock-meta">{t('mock.allowance')}</p>
          <button type="button" className="btn btn-primary" onClick={start} disabled={busy} data-mock-start>
            {busy ? t('mock.starting') : t('mock.start')}
          </button>
          {premium && (
            <p className="mock-note" role="alert" data-mock-premium>
              {t('mock.premium')} <Link to="/settings">{t('mock.seePlans')}</Link>
            </p>
          )}
          {refusal && <CheckRefusal kind={refusal} context="exam" user={user} refreshUser={refreshUser} onRetry={start} busy={busy} />}
          {error && <p className="mock-note" role="alert">{error}</p>}
        </section>
      )}

      {mock && (
        <section className="mock-card" aria-labelledby="mock-past">
          <h2 id="mock-past" className="mock-h2">{t('mock.past')}</h2>
          {mocks && !mocks.length && <p className="mock-meta">{t('mock.none')}</p>}
          <ul className="mock-list">
            {(mocks || []).map(m => (
              <li key={m.id} data-mock-row={m.id}>
                <span className="mock-list-title">{m.title}</span>
                {m.finished_at
                  ? <><span className="mock-score">{m.score} / {m.total}</span> <Link to={`/mock/${m.id}`}>{t('mock.openScript')}</Link></>
                  : <Link to={`/exams/${m.id}`}>{t('mock.resume')}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
