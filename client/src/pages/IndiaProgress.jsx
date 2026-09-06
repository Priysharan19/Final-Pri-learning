import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { predictionSentence } from '../engine/markPredictor.js';
import { useT } from '../i18n/index.js';
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
      .catch(err => setError(err.message || t('progress.couldNotLoad')));
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
    <div className="grid" style={{ gap: 18 }}>
      <h1 className="sr-only">{t('progress.title', { track: trackName })}</h1>

      <div className="card">
        <div className="spread" style={{ gap: 16, alignItems: 'flex-start' }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>{t('progress.title', { track: trackName })}</div>
            <p className="sub" style={{ margin: 0 }}>{t('progress.evidenceSub')}</p>
          </div>
          <span className="tag tag-brand">{t('progress.noPercentile')}</span>
        </div>
        <p className="muted" style={{ marginTop: 12, maxWidth: 820 }}>{t('progress.honesty')}</p>
      </div>

      {prediction && (
        <div className="card">
          <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 4 }}>{t('progress.ifYouSatTomorrow')}</div>
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

          <p style={{ marginTop: 12, maxWidth: 820 }}>{predictionSentence(prediction)}</p>

          {/* Coverage is drawn, not just stated: the practised share of the paper
              against the whole, so an impressive number over a quarter of the
              paper cannot be mistaken for an impressive number over all of it. */}
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--line, rgba(128,128,128,.2))', overflow: 'hidden' }}
              role="img" aria-label={t('progress.marksPractised', { covered: prediction.coveredMarks, total: prediction.totalMarks })}>
              <div style={{ width: `${Math.round(prediction.coverage * 100)}%`, height: '100%', background: 'var(--brand, #4f7cff)' }} />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
              {t('progress.marksPractised', { covered: prediction.coveredMarks, total: prediction.totalMarks })}
              {prediction.unseenMarks > 0 && t('progress.marksUntouched', { n: prediction.unseenMarks })}
            </div>
          </div>

          {prediction.priorities.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="sc-label" style={{ marginBottom: 6 }}>{t('progress.whereTheMarksAre')}</div>
              {prediction.priorities.slice(0, 4).map(unit => (
                <div key={unit.unitId} className="set-row">
                  <span className="set-k">
                    {unit.name}
                    <span className="muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
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
        </div>
      )}

      <div className="grid cols-4">
        <div className="card"><div className="sc-label">{t('progress.chaptersStarted')}</div><div className="big">{started}<span className="muted">/{rows.length}</span></div></div>
        <div className="card"><div className="sc-label">{t('progress.chaptersPractised')}</div><div className="big">{practiced}</div><div className="muted">{t('progress.fivePlusAttempts')}</div></div>
        <div className="card"><div className="sc-label">{t('progress.questionsAnswered')}</div><div className="big">{Number(totals.attempts || 0).toLocaleString()}</div></div>
        <div className="card"><div className="sc-label">{t('progress.demonstratedAccuracy')}</div><div className="big">{accuracy == null ? t('common.none') : t('common.percent', { n: accuracy })}</div><div className="muted">{t('progress.acrossAttempts')}</div></div>
      </div>

      <div className="card">
        <div className="spread">
          <div className="card-title" style={{ marginBottom: 0 }}>{t('progress.syllabusEvidence', { scope: scope?.title || trackName })}</div>
          <span className="muted">{t('progress.rowCount', { count: rows.length, n: rows.length })}</span>
        </div>
        {!rows.length ? <p className="muted" style={{ marginTop: 16 }}>{t('progress.noRows')}</p> : (
          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table className="syl-table">
              <thead><tr><th style={{ textAlign: 'left' }}>{t('progress.colChapter')}</th><th>{t('common.attempts')}</th><th>{t('progress.colCorrect')}</th><th>{t('common.accuracy')}</th><th><span className="sr-only">{t('progress.colAction')}</span></th></tr></thead>
              <tbody>
                {chapterEvidence.map(({ row, evidence }) => (
                  <tr key={row.id || row.name}>
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 640 }}><TermGloss text={row.name || row.title} /></div>
                      {row.strand && <div className="muted" style={{ fontSize: 12 }}><TermGloss text={row.strand} /></div>}
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
      </div>

      <div className="card">
        <div className="card-title">{t('progress.howToRead')}</div>
        <p className="muted" style={{ margin: 0 }}>{t('progress.howToReadBody')}</p>
      </div>
    </div>
  );
}
