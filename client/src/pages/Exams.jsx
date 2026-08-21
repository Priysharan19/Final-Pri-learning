import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { MathText } from '../lib/latex.jsx';

export default function Exams() {
  const { user } = useApp();
  const [exams, setExams] = useState(null);
  const [cfg, setCfg] = useState({ length: 10, minutes: 30, year: user.year });
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState(null);
  const nav = useNavigate();

  async function openPaper(id) {
    const p = await api.get(`/exams/${id}/paper`);
    setPaper(p);
  }

  useEffect(() => { api.get('/exams').then(r => setExams(r.exams)).catch(() => { }); }, []);

  async function start() {
    setBusy(true);
    try {
      const r = await api.post('/exams', cfg);
      nav(`/exams/${r.exam.id}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      {/* the printable paper brings its own <h1>, so this one steps aside */}
      {!paper && <h1 className="sr-only">Exams</h1>}
      <div className="card">
        <div className="card-title">Sit a practice paper</div>
        <p className="sub" style={{ marginBottom: 18 }}>
          A generated paper with the same difficulty profile as the real thing — foundation openers
          through to exam-extension finishers. No hints, one shot, full worked solutions afterwards.
        </p>
        <div className="field">
          <label className="label" htmlFor="exam-year">Year level</label>
          <select className="input" id="exam-year" value={cfg.year} onChange={e => setCfg(c => ({ ...c, year: Number(e.target.value) }))}>
            {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>Year {y}{y === user.year ? ' · yours' : ''}</option>)}
          </select>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="exam-length">Questions</label>
            <select className="input" id="exam-length" value={cfg.length} onChange={e => setCfg(c => ({ ...c, length: Number(e.target.value), minutes: Number(e.target.value) * 3 }))}>
              <option value={10}>10 — quick paper</option>
              <option value={15}>15 — standard</option>
              <option value={20}>20 — full paper</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="exam-minutes">Time limit</label>
            <select className="input" id="exam-minutes" value={cfg.minutes} onChange={e => setCfg(c => ({ ...c, minutes: Number(e.target.value) }))}>
              {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} onClick={start} disabled={busy}>
          {busy ? 'Building your paper…' : '📄 Start exam'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Your papers</div>
        {!exams && <div className="skeleton" style={{ height: 160 }} />}
        {exams && !exams.length && <p className="muted">No exams yet — your first paper is one click away.</p>}
        {exams && exams.map(e => (
          <div className="prio-item" key={e.id}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 640, fontSize: 14 }}>{e.title}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {new Date(e.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · {e.duration_min} min
              </div>
            </div>
            {e.finished_at
              ? <span className="tag" style={{ color: e.score / e.total >= 0.8 ? 'var(--good)' : e.score / e.total >= 0.5 ? 'var(--ink)' : 'var(--bad)' }}>
                {e.score}/{e.total} · {Math.round(100 * e.score / e.total)}%
              </span>
              : <span className="tag tag-brand">In progress</span>}
            <button className="btn btn-quiet btn-sm" title="Download as printable paper"
              aria-label={`Open “${e.title}” as a printable paper`} onClick={() => openPaper(e.id)}>🖨</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav(`/exams/${e.id}`)}>{e.finished_at ? 'Review' : 'Resume'}</button>
          </div>
        ))}
        <p className="muted" style={{ marginTop: 10 }}>🖨 turns any paper into a printable PDF — questions up front, marking criteria and full solutions behind.</p>
      </div>

      {paper && <PrintPaper paper={paper} onClose={() => setPaper(null)} />}
    </div>
  );
}

export function PrintPaper({ paper, onClose }) {
  return (
    <div className="paper-overlay">
      <div className="row no-print" style={{ padding: 14, justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
      <div className="paper-sheet">
        <h1 style={{ fontSize: 22 }}>{paper.title}</h1>
        <p style={{ margin: '4px 0 2px' }}>{paper.course} · Time allowed: {paper.durationMin} minutes · Total marks: {paper.questions.reduce((s, q) => s + (q.multipart ? q.parts.reduce((t, pt) => t + pt.marks, 0) : q.criteria.length), 0)}</p>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 18px' }}>Pri Learning · attempt all questions · show all necessary working</p>
        {paper.questions.map((q, i) => q.multipart ? (
          <div key={i} style={{ margin: '0 0 26px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Question {i + 1} <span style={{ fontWeight: 400, color: '#666' }}>({q.parts.reduce((t, pt) => t + pt.marks, 0)} marks · structured)</span></div>
            <MathText block text={q.stem} />
            {q.figure && <div className="q-figure print-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.parts.map(pt => (
              <div key={pt.key} style={{ margin: '10px 0 0' }}>
                <div><b>({pt.key})</b> <MathText text={pt.prompt} /> <span style={{ color: '#666' }}>[{pt.marks} mark{pt.marks === 1 ? '' : 's'}]</span></div>
                {pt.answerType === 'mcq' && pt.mcqOptions && (
                  <div style={{ marginTop: 4 }}>
                    {pt.mcqOptions.map((o, j) => <div key={j} style={{ margin: '2px 0' }}>({'ABCD'[j]}) <MathText text={o} /></div>)}
                  </div>
                )}
                <div style={{ height: pt.answerType === 'mcq' ? 6 : 48, borderBottom: pt.answerType === 'mcq' ? 'none' : '1px dotted #bbb' }} />
              </div>
            ))}
          </div>
        ) : (
          <div key={i} style={{ margin: '0 0 26px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Question {i + 1} <span style={{ fontWeight: 400, color: '#666' }}>({q.criteria.length} mark{q.criteria.length === 1 ? '' : 's'} · {q.subtopicName})</span></div>
            <MathText block text={q.prompt} />
            {q.figure && <div className="q-figure print-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.answerType === 'mcq' && q.mcqOptions && (
              <div style={{ marginTop: 6 }}>
                {q.mcqOptions.map((o, j) => <div key={j} style={{ margin: '3px 0' }}>({'ABCD'[j]}) <MathText text={o} /></div>)}
              </div>
            )}
            <div style={{ height: q.answerType === 'mcq' ? 8 : 64, borderBottom: q.answerType === 'mcq' ? 'none' : '1px dotted #bbb' }} />
          </div>
        ))}
        <div style={{ pageBreakBefore: 'always' }} />
        <h2 style={{ fontSize: 18, margin: '18px 0 12px' }}>Marking criteria & worked solutions</h2>
        {paper.questions.map((q, i) => q.multipart ? (
          <div key={i} style={{ margin: '0 0 20px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700 }}>Question {i + 1} — structured</div>
            {q.parts.map(pt => (
              <div key={pt.key} style={{ margin: '6px 0 8px' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>({pt.key}) answer: <MathText text={pt.answerText} /> <span style={{ color: '#666', fontWeight: 400 }}>[{pt.marks} mark{pt.marks === 1 ? '' : 's'}]</span></div>
                {pt.steps.map((s, j) => (
                  <div key={j} style={{ fontSize: 13, margin: '2px 0' }}><b><MathText text={s.h} />:</b> <MathText text={s.d} /></div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div key={i} style={{ margin: '0 0 20px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700 }}>Question {i + 1} — answer: <MathText text={q.answerText} /></div>
            <ul style={{ margin: '4px 0 6px', paddingLeft: 20 }}>
              {q.criteria.map((c, j) => <li key={j} style={{ fontSize: 13 }}>1 mark — <MathText text={c.text} /></li>)}
            </ul>
            {q.steps.map((s, j) => (
              <div key={j} style={{ fontSize: 13, margin: '2px 0' }}><b><MathText text={s.h} />:</b> <MathText text={s.d} /></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
