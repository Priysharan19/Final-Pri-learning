import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { predictionSentence } from '../engine/markPredictor.js';
import { tLater, useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';

function pct(correct, attempts) {
  const a = Number(attempts || 0);
  return a > 0 ? Math.round(1000 * Number(correct || 0) / a) / 10 : null;
}

function scopeFor(curriculum, user) {
  if (!curriculum) return null;
  const track = user.indiaTrack || 'cbse';
  if (track === 'cbse') return (curriculum.years || []).find(s => Number(s.year) === Number(user.year)) || null;
  return (curriculum.streams || []).find(s => s.track === track && (s.year == null || Number(s.year) === Number(user.year)))
    || (curriculum.streams || []).find(s => s.track === track)
    || null;
}

function rowsFor(scope) {
  return scope?.chapters || scope?.subtopics || [];
}

function evidenceOf(row) {
  const attempts = Number(row.attempts || row.evidence?.attempts || 0);
  const correct = Number(row.correct || row.evidence?.correct || 0);
  const accuracy = row.accuracy ?? row.evidence?.accuracy ?? pct(correct, attempts);
  return { attempts, correct, accuracy };
}

export default function IndiaProgress() {
  const { user } = useApp();
  const nav = useNavigate();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/curriculum'), api.get('/stats')])
      .then(([c, s]) => { setCurriculum(c); setStats(s); })
      .catch(err => setError(err.message || tLater('progress.couldNotLoad')));
  }, [t]);

  const scope = useMemo(() => scopeFor(curriculum, user), [curriculum, user]);
  const rows = useMemo(() => rowsFor(scope), [scope]);
  const chapterEvidence = useMemo(() => rows.map(row => ({ row, evidence: evidenceOf(row) })), [rows]);
  const started = chapterEvidence.filter(x => x.evidence.attempts > 0).length;
  const practiced = chapterEvidence.filter(x => x.evidence.attempts >= 5).length;
  const totals = stats?.totals || {};
  const prediction = stats?.examPrediction || null;
  const accuracy = pct(totals.correct, totals.attempts);
  // "JEE Main" and "JEE Advanced" are the examining bodies' own names, printed
  // that way on the Hindi paper too, so they are not translated. The CBSE label
  // is built from a word that is, hence the catalogue key around the class.
  const trackName = user.indiaTrack === 'jee-main' ? 'JEE Main'
    : user.indiaTrack === 'jee-advanced' ? 'JEE Advanced'
      : `${t('common.classNumber', { n: user.year })} CBSE / NCERT`;

  if (error) return <div className="card" role="alert">{error}</div>;
  if (!curriculum || !stats) return <div className="skeleton" style={{ height: 420 }} />;

  return (
    <div className="pg">
      {/* One column, read top to bottom: what the evidence says, where the marks
          are, then the syllabus itself. Sections are separated by space and
          hairlines; the paper estimate is the only sheet on the page. */}
      <header className="pg-head">
        <h1>{t('progress.title', { track: trackName })}</h1>
        <p className="sub">{t('progress.evidenceSub')}</p>
      </header>

      {prediction && (
        <section className="pg-sheet" aria-labelledby="pg-paper">
          <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div>
              <h2 className="sc-label" id="pg-paper">{t('progress.ifYouSatTomorrow')}</h2>
              <p className="sub" style={{ margin: 0 }}>{prediction.label}</p>
            </div>
            {prediction.show && (
              <div style={{ textAlign: 'right' }}>
                <div className="big" style={{ lineHeight: 1.1 }}>
                  {prediction.expected}<span className="muted" style={{ fontSize: '0.5em' }}>/{prediction.coveredMarks}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{t('progress.likelyRange', { low: prediction.low, high: prediction.high })}</div>
              </div>
            )}
          </div>

          <p className="pg-sentence">{predictionSentence(prediction)}</p>

          {/* Coverage is drawn, not just stated: the practised share of the paper
              against the whole, so an impressive number over a quarter of the
              paper cannot be mistaken for an impressive number over all of it. */}
          <div className="pg-coverage">
            <div className="pg-coverage-track"
              role="img" aria-label={t('progress.marksPractised', { covered: prediction.coveredMarks, total: prediction.totalMarks })}>
              <div style={{ width: `${Math.round(prediction.coverage * 100)}%` }} />
            </div>
            <div className="muted pg-coverage-note">
              {t('progress.marksPractised', { covered: prediction.coveredMarks, total: prediction.totalMarks })}
              {prediction.unseenMarks > 0 && t('progress.marksUntouched', { n: prediction.unseenMarks })}
            </div>
          </div>

          {prediction.priorities.length > 0 && (
            <div className="pg-priorities">
              <div className="sc-label">{t('progress.whereTheMarksAre')}</div>
              {prediction.priorities.slice(0, 4).map(unit => (
                <div key={unit.unitId} className="set-row">
                  <span className="set-k">
                    {unit.name}
                    <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                      {unit.covered
                        ? t('progress.unitCovered', { count: unit.attempts, n: unit.attempts, expected: unit.expected, marks: unit.marks })
                        : t('progress.unitUntouched', { marks: unit.marks })}
                    </span>
                  </span>
                  <span className="set-v">+{unit.atStake}</span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('progress.rankedByMarks')}</p>
            </div>
          )}
        </section>
      )}

      <div className="grid cols-4 pg-facts">
        <div className="card"><div className="sc-label">{t('progress.chaptersStarted')}</div><div className="big">{started}<span className="muted">/{rows.length}</span></div></div>
        <div className="card"><div className="sc-label">{t('progress.chaptersPractised')}</div><div className="big">{practiced}</div><div className="muted">{t('progress.fivePlusAttempts')}</div></div>
        <div className="card"><div className="sc-label">{t('progress.questionsAnswered')}</div><div className="big">{Number(totals.attempts || 0).toLocaleString()}</div></div>
        <div className="card"><div className="sc-label">{t('progress.demonstratedAccuracy')}</div><div className="big">{accuracy == null ? t('common.none') : t('common.percent', { n: accuracy })}</div><div className="muted">{t('progress.acrossAttempts')}</div></div>
      </div>

      <section aria-labelledby="pg-syllabus">
        <div className="spread pg-section-head">
          <h2 className="sc-label" id="pg-syllabus">{t('progress.syllabusEvidence', { scope: scope?.title || trackName })}</h2>
          <span className="muted">{t('progress.rowCount', { count: rows.length, n: rows.length })}</span>
        </div>
        {!rows.length ? <p className="muted" style={{ marginTop: 16 }}>{t('progress.noRows')}</p> : (
          <div className="table-scroll">
            <table className="syl-table pg-table">
              <thead><tr><th scope="col">{t('progress.colChapter')}</th><th scope="col">{t('common.attempts')}</th><th scope="col">{t('progress.colCorrect')}</th><th scope="col">{t('common.accuracy')}</th><th scope="col"><span className="sr-only">{t('progress.colAction')}</span></th></tr></thead>
              <tbody>
                {chapterEvidence.map(({ row, evidence }) => (
                  <tr key={row.id || row.name}>
                    <td>
                      {/* Chapter and unit names are curriculum data and stay English by
                          design; lang="en" lets a screen reader on a Hindi page voice them
                          in English (TermGloss marks its Hindi terms lang="hi"). */}
                      <div className="pg-chapter" lang="en"><TermGloss text={row.name || row.title} /></div>
                      {row.strand && <div className="muted" lang="en" style={{ fontSize: 12 }}><TermGloss text={row.strand} /></div>}
                    </td>
                    <td>{evidence.attempts}</td>
                    <td>{evidence.correct}</td>
                    <td>{evidence.accuracy == null ? t('common.none') : t('common.percent', { n: evidence.accuracy })}</td>
                    <td>
                      <button className="btn btn-quiet btn-sm" onClick={() => nav(`/practice?subtopic=${encodeURIComponent(row.id)}&track=${encodeURIComponent(user.indiaTrack || 'cbse')}`)}>
                        {t('progress.practise')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* What this page does and does not claim, said once, where a careful
          reader looks for it. */}
      <footer className="pg-notes">
        <h2 className="sc-label">{t('progress.howToRead')}</h2>
        <p className="muted"><b>{t('progress.noPercentile')}.</b> {t('progress.honesty')}</p>
        <p className="muted">{t('progress.howToReadBody')}</p>
      </footer>
    </div>
  );
}
