import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { MathText } from '../lib/latex.jsx';
import { indiaExamBlueprint, indiaExamClaim } from '../engine/indiaExams.js';

export default function Exams() {
  const { user } = useApp();
  const [exams, setExams] = useState(null);
  const [cfg, setCfg] = useState({ length: 10, minutes: 30, year: user.year });
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');
  const nav = useNavigate();
  const indiaBlueprint = useMemo(() => user.course === 'in'
    ? indiaExamBlueprint({ track: user.indiaTrack || 'cbse', grade: user.year })
    : null, [user.course, user.indiaTrack, user.year]);

  async function openPaper(id) {
    setError('');
    try {
      const p = await api.get(`/exams/${id}/paper`);
      setPaper(p);
    } catch (err) { setError(err.message || 'Could not open this paper.'); }
  }

  useEffect(() => { api.get('/exams').then(r => setExams(r.exams)).catch(() => setExams([])); }, []);

  async function start() {
    setBusy(true);
    setError('');
    try {
      const body = user.course === 'in' ? { year: user.year } : cfg;
      const r = await api.post('/exams', body);
      nav(`/exams/${r.exam.id}`);
    } catch (err) {
      setError(err.message || 'This exam format is not ready yet.');
    } finally { setBusy(false); }
  }

  if (user.course === 'in') {
    return <IndiaExams
      user={user} exams={exams} blueprint={indiaBlueprint} busy={busy} error={error}
      start={start} openPaper={openPaper} nav={nav} paper={paper} setPaper={setPaper}
    />;
  }

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      {!paper && <h1 className="sr-only">Exams</h1>}
      <div className="card">
        <div className="card-title">Sit a practice paper</div>
        <p className="sub" style={{ marginBottom: 18 }}>
          A generated practice paper with a progressive difficulty profile. No hints, one shot,
          full worked solutions afterwards.
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
              <option value={20}>20 — full practice</option>
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
          {busy ? 'Building your paper…' : '📄 Start practice paper'}
        </button>
      </div>

      <PaperHistory exams={exams} openPaper={openPaper} nav={nav} />
      {error && <div className="card" role="alert" style={{ gridColumn: '1 / -1' }}>{error}</div>}
      {paper && <PrintPaper paper={paper} onClose={() => setPaper(null)} />}
    </div>
  );
}

function IndiaExams({ user, exams, blueprint, busy, error, start, openPaper, nav, paper, setPaper }) {
  const claim = indiaExamClaim(blueprint);
  const track = user.indiaTrack || 'cbse';
  const jeeMainReady = track === 'jee-main' && blueprint?.authenticity === 'official-mathematics-section';

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      {!paper && <h1 className="sr-only">India exams</h1>}
      <div className="card">
        <div className="card-title">{blueprint?.label || `Class ${user.year} exam practice`}</div>
        {jeeMainReady ? <>
          <p className="sub" style={{ marginBottom: 16 }}>
            A source-versioned simulation of the <b>Mathematics section</b> of JEE Main 2026 Paper 1.
            Pri Learning does not call this a complete Paper 1 because Physics and Chemistry are not part of this maths app.
          </p>
          <div className="grid cols-2" style={{ gap: 10, marginBottom: 14 }}>
            <div className="stat-tile"><div className="sc-label">Questions</div><div className="big">25</div><div className="muted">20 MCQ + 5 numerical</div></div>
            <div className="stat-tile"><div className="sc-label">Maximum</div><div className="big">100</div><div className="muted">+4 correct · −1 incorrect</div></div>
          </div>
          <p className="muted" style={{ marginBottom: 14 }}>
            Suggested maths-section timer: 60 minutes. The official Paper 1 timer is 180 minutes for Mathematics, Physics and Chemistry together; NTA does not publish a separate official Mathematics timer.
          </p>
          <p className="muted" style={{ marginBottom: 16 }}>
            Exam mode draws only from Pri Learning's reviewed JEE previous-year-question archive. If the reviewed bank cannot fill all 25 required slots without breaking the official section structure, generation fails instead of substituting school questions.
          </p>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={start} disabled={busy}>
            {busy ? 'Building reviewed JEE section…' : 'Start JEE Main Mathematics simulation'}
          </button>
        </> : <>
          <p className="sub" style={{ marginBottom: 14 }}>{claim.reason}</p>
          {track === 'cbse' && user.year === 10 && <p className="muted">
            The 2026–27 CBSE curriculum is current in Pri Learning, but the source-checked Class X paper pattern currently recorded here is the 2025–26 sample paper. Pri Learning will not relabel that older pattern as an authentic 2026–27 board paper.
          </p>}
          {track === 'jee-advanced' && <p className="muted">
            JEE Advanced 2026 officially has two compulsory three-hour papers. Question counts, types and negative-mark rules are paper-specific, so a universal hard-coded marking grid would be misleading.
          </p>}
          <button className="btn btn-ghost btn-lg" style={{ width: '100%', marginTop: 16 }} disabled>
            Authentic full exam not released for this selection
          </button>
        </>}
        {error && <div role="alert" style={{ marginTop: 14, color: 'var(--bad)' }}>{error}</div>}
      </div>

      <PaperHistory exams={exams} openPaper={openPaper} nav={nav} india />
      {paper && <PrintPaper paper={paper} onClose={() => setPaper(null)} />}
    </div>
  );
}

function PaperHistory({ exams, openPaper, nav, india = false }) {
  return (
    <div className="card">
      <div className="card-title">Your papers</div>
      {!exams && <div className="skeleton" style={{ height: 160 }} />}
      {exams && !exams.length && <p className="muted">No exams yet.</p>}
      {exams && exams.map(e => {
        const pct = e.finished_at && e.total ? Math.round(100 * e.score / e.total) : null;
        return (
          <div className="prio-item" key={e.id}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 640, fontSize: 14 }}>{e.title}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {new Date(e.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · {e.duration_min} min{india ? ' suggested section timer' : ''}
              </div>
            </div>
            {e.finished_at
              ? <span className="tag" style={{ color: pct >= 80 ? 'var(--good)' : pct >= 50 ? 'var(--ink)' : 'var(--bad)' }}>
                {e.score}/{e.total} · {pct}%
              </span>
              : <span className="tag tag-brand">In progress</span>}
            <button className="btn btn-quiet btn-sm" title="Open printable paper"
              aria-label={`Open “${e.title}” as a printable paper`} onClick={() => openPaper(e.id)}>🖨</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav(`/exams/${e.id}`)}>{e.finished_at ? 'Review' : 'Resume'}</button>
          </div>
        );
      })}
      <p className="muted" style={{ marginTop: 10 }}>
        🖨 opens the question paper for printing. Worked solutions are included only after submission for India exam simulations.
      </p>
    </div>
  );
}

function marksForQuestion(q) {
  if (q.multipart) return q.parts.reduce((t, pt) => t + Number(pt.marks || 0), 0);
  if (Array.isArray(q.criteria)) return q.criteria.reduce((n, c) => n + Number(c.mark || 1), 0);
  return Number(q.marks || 1);
}

export function PrintPaper({ paper, onClose }) {
  const solutionsAvailable = paper.solutionsAvailable !== false;
  return (
    <div className="paper-overlay">
      <div className="row no-print" style={{ padding: 14, justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
      <div className="paper-sheet">
        <h1 style={{ fontSize: 22 }}>{paper.title}</h1>
        <p style={{ margin: '4px 0 2px' }}>{paper.course} · Suggested time: {paper.durationMin} minutes · Total marks: {paper.questions.reduce((s, q) => s + marksForQuestion(q), 0)}</p>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 18px' }}>Pri Learning · attempt all questions · show necessary working where appropriate</p>
        {paper.questions.map((q, i) => q.multipart ? (
          <div key={i} style={{ margin: '0 0 26px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Question {i + 1} <span style={{ fontWeight: 400, color: '#666' }}>({q.parts.reduce((t, pt) => t + pt.marks, 0)} marks · structured)</span></div>
            <MathText block text={q.stem} />
            {q.figure && <div className="q-figure print-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.parts.map(pt => (
              <div key={pt.key} style={{ margin: '10px 0 0' }}>
                <div><b>({pt.key})</b> <MathText text={pt.prompt} /> <span style={{ color: '#666' }}>[{pt.marks} mark{pt.marks === 1 ? '' : 's'}]</span></div>
                {pt.answerType === 'mcq' && pt.mcqOptions && (
                  <div style={{ marginTop: 4 }}>{pt.mcqOptions.map((o, j) => <div key={j} style={{ margin: '2px 0' }}>({'ABCD'[j]}) <MathText text={o} /></div>)}</div>
                )}
                <div style={{ height: pt.answerType === 'mcq' ? 6 : 48, borderBottom: pt.answerType === 'mcq' ? 'none' : '1px dotted #bbb' }} />
              </div>
            ))}
          </div>
        ) : (
          <div key={i} style={{ margin: '0 0 26px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Question {i + 1} <span style={{ fontWeight: 400, color: '#666' }}>({marksForQuestion(q)} marks{q.section ? ` · Section ${q.section}` : q.subtopicName ? ` · ${q.subtopicName}` : ''})</span>
            </div>
            <MathText block text={q.prompt} />
            {q.figure && <div className="q-figure print-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.answerType === 'mcq' && q.mcqOptions && (
              <div style={{ marginTop: 6 }}>{q.mcqOptions.map((o, j) => <div key={j} style={{ margin: '3px 0' }}>({'ABCD'[j]}) <MathText text={o} /></div>)}</div>
            )}
            <div style={{ height: q.answerType === 'mcq' ? 8 : 64, borderBottom: q.answerType === 'mcq' ? 'none' : '1px dotted #bbb' }} />
          </div>
        ))}

        {solutionsAvailable && <>
          <div style={{ pageBreakBefore: 'always' }} />
          <h2 style={{ fontSize: 18, margin: '18px 0 12px' }}>Marking criteria & worked solutions</h2>
          {paper.questions.map((q, i) => q.multipart ? (
            <div key={i} style={{ margin: '0 0 20px', breakInside: 'avoid' }}>
              <div style={{ fontWeight: 700 }}>Question {i + 1} — structured</div>
              {q.parts.map(pt => (
                <div key={pt.key} style={{ margin: '6px 0 8px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>({pt.key}) answer: <MathText text={pt.answerText} /> <span style={{ color: '#666', fontWeight: 400 }}>[{pt.marks} mark{pt.marks === 1 ? '' : 's'}]</span></div>
                  {(pt.steps || []).map((s, j) => <div key={j} style={{ fontSize: 13, margin: '2px 0' }}><b><MathText text={s.h} />:</b> <MathText text={s.d} /></div>)}
                </div>
              ))}
            </div>
          ) : (
            <div key={i} style={{ margin: '0 0 20px', breakInside: 'avoid' }}>
              <div style={{ fontWeight: 700 }}>Question {i + 1} — answer: <MathText text={q.answerText || ''} /></div>
              {Array.isArray(q.criteria) && <ul style={{ margin: '4px 0 6px', paddingLeft: 20 }}>
                {q.criteria.map((c, j) => <li key={j} style={{ fontSize: 13 }}>{c.mark || 1} mark{Number(c.mark || 1) === 1 ? '' : 's'} — <MathText text={c.text} /></li>)}
              </ul>}
              {(q.steps || []).map((s, j) => <div key={j} style={{ fontSize: 13, margin: '2px 0' }}><b><MathText text={s.h} />:</b> <MathText text={s.d} /></div>)}
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}
