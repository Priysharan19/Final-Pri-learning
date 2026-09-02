import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

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
  const [curriculum, setCurriculum] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/curriculum'), api.get('/stats')])
      .then(([c, s]) => { setCurriculum(c); setStats(s); })
      .catch(err => setError(err.message || 'Could not load progress.'));
  }, []);

  const scope = useMemo(() => scopeFor(curriculum, user), [curriculum, user]);
  const rows = useMemo(() => rowsFor(scope), [scope]);
  const chapterEvidence = useMemo(() => rows.map(row => ({ row, evidence: evidenceOf(row) })), [rows]);
  const started = chapterEvidence.filter(x => x.evidence.attempts > 0).length;
  const practiced = chapterEvidence.filter(x => x.evidence.attempts >= 5).length;
  const totals = stats?.totals || {};
  const accuracy = pct(totals.correct, totals.attempts);
  const trackName = user.indiaTrack === 'jee-main' ? 'JEE Main'
    : user.indiaTrack === 'jee-advanced' ? 'JEE Advanced'
      : `Class ${user.year} CBSE / NCERT`;

  if (error) return <div className="card" role="alert">{error}</div>;
  if (!curriculum || !stats) return <div className="skeleton" style={{ height: 420 }} />;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <h1 className="sr-only">{trackName} progress</h1>

      <div className="card">
        <div className="spread" style={{ gap: 16, alignItems: 'flex-start' }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>{trackName} progress</div>
            <p className="sub" style={{ margin: 0 }}>
              Evidence from the questions you have actually solved, organised by your India curriculum scope.
            </p>
          </div>
          <span className="tag tag-brand">No predicted board/JEE score</span>
        </div>
        <p className="muted" style={{ marginTop: 12, maxWidth: 820 }}>
          Pri Learning does not convert a small practice history into a fake CBSE percentage, JEE percentile or rank prediction. This page shows demonstrated chapter coverage, attempts and accuracy; exam results are reported separately from exam simulations.
        </p>
      </div>

      <div className="grid cols-4">
        <div className="card"><div className="sc-label">Chapters started</div><div className="big">{started}<span className="muted">/{rows.length}</span></div></div>
        <div className="card"><div className="sc-label">Chapters practised</div><div className="big">{practiced}</div><div className="muted">5+ attempts</div></div>
        <div className="card"><div className="sc-label">Questions answered</div><div className="big">{Number(totals.attempts || 0).toLocaleString()}</div></div>
        <div className="card"><div className="sc-label">Demonstrated accuracy</div><div className="big">{accuracy == null ? '—' : `${accuracy}%`}</div><div className="muted">Across recorded attempts</div></div>
      </div>

      <div className="card">
        <div className="spread">
          <div className="card-title" style={{ marginBottom: 0 }}>{scope?.title || trackName} syllabus evidence</div>
          <span className="muted">{rows.length} chapters/topics</span>
        </div>
        {!rows.length ? <p className="muted" style={{ marginTop: 16 }}>No released curriculum rows are available for this track yet.</p> : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="syl-table">
              <thead><tr><th style={{ textAlign: 'left' }}>Chapter / topic</th><th>Attempts</th><th>Correct</th><th>Accuracy</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {chapterEvidence.map(({ row, evidence }) => (
                  <tr key={row.id || row.name}>
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 640 }}>{row.name || row.title}</div>
                      {row.strand && <div className="muted" style={{ fontSize: 12 }}>{row.strand}</div>}
                    </td>
                    <td>{evidence.attempts}</td>
                    <td>{evidence.correct}</td>
                    <td>{evidence.accuracy == null ? '—' : `${evidence.accuracy}%`}</td>
                    <td>
                      <button className="btn btn-quiet btn-sm" onClick={() => nav(`/practice?subtopic=${encodeURIComponent(row.id)}&track=${encodeURIComponent(user.indiaTrack || 'cbse')}`)}>
                        Practise
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
        <div className="card-title">How to read this page</div>
        <p className="muted" style={{ margin: 0 }}>
          “Started” means at least one recorded attempt. “Practised” is a simple product-display threshold of five attempts, not an adaptive-learning judgement. Accuracy is descriptive evidence only. Mastery decisions, review scheduling and Pri Explain remain owned by the learning-intelligence layer.
        </p>
      </div>
    </div>
  );
}
