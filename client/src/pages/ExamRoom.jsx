// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Exam room — one timed paper, answered question by question and
// marked in a single pass at the end.
// Everything the student writes lives in `answers`/`workings` until that pass,
// which makes this the screen with the most to lose to a thrown render: an
// hour's paper is React state and nothing else. So the paper is mirrored to the
// draft store as it is filled in, and picked back up — clock included — if the
// screen ever has to be rebuilt from scratch.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import { clearDraft, queueDraft, readDraft } from '../components/drafts.js';

export default function ExamRoom() {
  const { id } = useParams();
  const { celebrate, refreshUser } = useApp();
  const nav = useNavigate();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [workings, setWorkings] = useState({});
  const [showWk, setShowWk] = useState({});
  const [cur, setCur] = useState(0);
  const [left, setLeft] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resumed, setResumed] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    api.get(`/exams/${id}`).then(r => {
      if (r.exam.finishedAt && r.exam.detail) {
        // A submitted paper has nothing left to recover, and a draft that
        // outlived its submit would only resurrect it.
        clearDraft('exam', id);
        setExam(r.exam);
        setResult({ score: r.exam.score, total: r.exam.total, pct: Math.round(100 * r.exam.score / r.exam.total), detail: r.exam.detail });
        return;
      }
      const draft = readDraft('exam', id);
      if (draft) {
        setAnswers(draft.answers || {});
        setWorkings(draft.workings || {});
        setShowWk(Object.fromEntries(Object.keys(draft.workings || {}).map(k => [k, true])));
        setCur(Math.min(draft.cur || 0, r.exam.questions.length - 1));
        startRef.current = draft.startedAt || Date.now();
        setResumed(true);
      }
      setExam(r.exam);
      // The clock is read off the paper's own start time, not restarted: a
      // crash is not extra time, and picking the paper up an hour later should
      // land exactly where it would have without the crash.
      const spent = Math.floor((Date.now() - startRef.current) / 1000);
      setLeft(Math.max(0, r.exam.durationMin * 60 - spent));
    }).catch(() => nav('/exams'));
  }, [id, nav]);

  useEffect(() => {
    if (left === null || result) return;
    if (left <= 0) { submit(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result]); // eslint-disable-line

  const answeredCount = useMemo(() => {
    if (!exam) return 0;
    return exam.questions.filter(q => q.multipart
      ? q.parts.some(pt => { const v = answers[`${q.id}::${pt.key}`]; return v !== '' && v != null; })
      : (answers[q.id] !== '' && answers[q.id] != null)).length;
  }, [answers, exam]);

  // Mirror the paper as it is filled in. queueDraft coalesces, so a burst of
  // keystrokes is one write, and it flushes when the tab hides or goes away.
  useEffect(() => {
    if (!exam || result || exam.finishedAt) return;
    queueDraft('exam', id, { answers, workings, cur, startedAt: startRef.current }, {
      label: exam.title,
      note: `${answeredCount} of ${exam.questions.length} answered`,
      path: `/exams/${id}`
    });
  }, [answers, workings, cur, exam, result, id, answeredCount]);

  async function submit() {
    if (busy || result) return;
    setBusy(true);
    try {
      const r = await api.post(`/exams/${id}/submit`, { answers, workings, ms: Date.now() - startRef.current });
      clearDraft('exam', id);
      setResult(r);
      celebrate(r);
      refreshUser();
    } finally { setBusy(false); }
  }

  if (!exam) return <div className="skeleton" style={{ height: 300 }} />;

  // ── Results view ──────────────────────────────────────────────────────────
  if (result) {
    const pct = result.pct ?? Math.round(100 * result.score / result.total);
    return (
      <div className="grid" style={{ gap: 18, maxWidth: 860, margin: '0 auto' }}>
        <h1 className="sr-only">{exam.title} — marked</h1>
        <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          <div className="card-title">{exam.title}</div>
          {/* the big number is tinted good / neutral / bad; the tint is spelled out */}
          <div className="hero-num" style={{ color: pct >= 80 ? 'var(--good)' : pct >= 50 ? 'var(--ink)' : 'var(--bad)' }}>
            {pct}%<span className="sr-only"> of the paper's marks — {pct >= 80 ? 'a strong result' : pct >= 50 ? 'a fair result' : 'below half'}</span>
          </div>
          <p className="sub" style={{ marginTop: 6 }}>{result.score} of {result.total} marks · {
            pct >= 90 ? 'Outstanding — Band 6 territory.' :
              pct >= 80 ? 'Excellent work — exam ready.' :
                pct >= 65 ? 'Solid — a few areas to tighten up.' :
                  pct >= 50 ? 'A fair base — the review below shows exactly where the marks went.' :
                    'Every mark lost below is a mark you can win back. Review each solution.'}</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => nav('/exams')}>New paper</button>
            <button className="btn btn-ghost" onClick={() => nav('/stats')}>See insights</button>
          </div>
        </div>

        {result.detail.map((d, i) => d.multipart ? (
          <div className="card" key={d.id}>
            <div className="q-meta">
              <span className="tag">Q{i + 1}</span>
              <span className="tag">{d.title}</span>
              <span className="tag tag-brand">Structured</span>
              <span className="tag" style={{ color: d.awarded === d.marks ? 'var(--good)' : d.awarded > 0 ? 'var(--warn)' : 'var(--bad)' }}>
                {d.awarded}/{d.marks} marks
                <span className="sr-only"> — {d.awarded === d.marks ? 'all earned' : d.awarded > 0 ? 'partly earned' : 'none earned'}</span>
              </span>
            </div>
            <MathText block className="q-prompt" style={{ fontSize: 16 }} text={d.stem} />
            {d.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: d.figure }} />}
            {d.parts.map(pt => (
              <div key={pt.key} style={{ margin: '12px 0 0', paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <b>({pt.key})</b>
                  <span style={{ flex: 1 }}><MathText text={pt.prompt} /></span>
                  <span className="tag" style={{ color: pt.correct ? 'var(--good)' : 'var(--bad)' }}>
                    {pt.awarded}/{pt.marks}<span className="sr-only"> marks — {pt.correct ? 'correct' : 'incorrect'}</span>
                  </span>
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 16, fontSize: 14, marginTop: 4 }}>
                  <span>Yours: <b>{pt.answerType === 'mcq' ? (pt.given !== '' && pt.given != null ? 'ABCD'[Number(pt.given)] ?? '—' : '—') : (pt.given || '—')}</b></span>
                  <span>Correct: <b><MathText text={pt.answerText} /></b></span>
                </div>
                {!pt.correct && pt.steps && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--brand-1)', fontWeight: 600, fontSize: 13 }}>Worked solution</summary>
                    <div className="steps">
                      {pt.steps.map((s, j) => (
                        <div className="step" key={j}>
                          <span className="step-n">{j + 1}</span>
                          <div>
                            <div className="step-h"><MathText text={s.h} /></div>
                            <div className="step-d"><MathText text={s.d} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" key={d.id}>
            <div className="q-meta">
              <span className="tag">Q{i + 1}</span>
              <span className="tag">{d.subtopicName}</span>
              <span className="tag">D{d.difficulty}</span>
              <span className="tag" style={{ color: d.correct ? 'var(--good)' : d.awarded > 0 ? 'var(--warn)' : 'var(--bad)' }}>
                {d.correct ? `✔ ${d.awarded}/${d.marks} marks` : d.awarded > 0 ? `◐ ${d.awarded}/${d.marks} marks` : `✖ 0/${d.marks} marks`}
              </span>
            </div>
            <MathText block className="q-prompt" style={{ fontSize: 16 }} text={d.prompt} />
            {d.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: d.figure }} />}
            {d.answerType === 'mcq' && d.mcqOptions && (
              <div className="muted" style={{ marginBottom: 8 }}>
                Options: {d.mcqOptions.map((o, j) => <span key={j} style={{ marginRight: 12 }}>{'ABCD'[j]}. <MathText text={o} /></span>)}
              </div>
            )}
            <div className="row" style={{ flexWrap: 'wrap', gap: 16, fontSize: 14 }}>
              <span>Your answer: <b>{d.answerType === 'mcq' ? (d.given !== '' && d.given != null ? 'ABCD'[Number(d.given)] ?? '—' : '—') : (d.given || '—')}</b></span>
              <span>Correct answer: <b><MathText text={d.solution.answerText} /></b></span>
            </div>
            {d.partial && (
              <div className="verdict" style={{ marginTop: 8, background: 'var(--brand-soft)', border: '1px solid var(--brand-1)' }}>
                <span className="verdict-ico">◐</span>
                <div style={{ fontSize: 13.5 }}>{d.partial.note}</div>
              </div>
            )}
            {!d.correct && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--brand-1)', fontWeight: 600, fontSize: 14 }}>Show worked solution & marking criteria</summary>
                {d.solution.criteria && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                    {d.solution.criteria.map((c, j) => <li key={j}>1 mark — <MathText text={c.text} /></li>)}
                  </ul>
                )}
                <div className="steps">
                  {d.solution.steps.map((s, j) => (
                    <div className="step" key={j}>
                      <span className="step-n">{j + 1}</span>
                      <div>
                        <div className="step-h"><MathText text={s.h} /></div>
                        <div className="step-d"><MathText text={s.d} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Taking view ───────────────────────────────────────────────────────────
  const q = exam.questions[cur];
  const mins = Math.floor((left || 0) / 60), secs = (left || 0) % 60;

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 860, margin: '0 auto' }}>
      <h1 className="sr-only">{exam.title}</h1>
      <div className="card exam-head">
        <div>
          <b>{exam.title}</b>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {answeredCount}/{exam.questions.length} answered
            {resumed && ' · picked up where you left off'}
          </div>
        </div>
        <span className={`exam-timer ${left < 120 ? 'low' : ''}`} style={{ marginLeft: 'auto' }}>
          ⏱ {mins}:{String(secs).padStart(2, '0')}
          <span className="sr-only"> left{left < 120 ? ' — under two minutes' : ''}</span>
        </span>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Marking…' : 'Submit paper'}
        </button>
      </div>

      <div className="exam-nav">
        {exam.questions.map((qq, i) => (
          <button key={qq.id}
            className={`exam-dot ${i === cur ? 'cur' : ''} ${answers[qq.id] ? 'done' : ''}`}
            aria-label={`Question ${i + 1}${answers[qq.id] ? ', answered' : ', not answered yet'}`}
            aria-current={i === cur ? 'true' : undefined}
            onClick={() => setCur(i)}>{i + 1}</button>
        ))}
      </div>

      <div className="card">
        <div className="q-meta">
          <span className="tag">Question {cur + 1} of {exam.questions.length}</span>
          <span className="tag">{q.subtopicName}</span>
          <span className="tag">{q.multipart ? `${q.marks} marks` : q.diffLabel}</span>
          {q.multipart && <span className="tag tag-brand">Structured — parts (a)–({q.parts[q.parts.length - 1].key})</span>}
        </div>
        {q.multipart ? (
          <>
            <MathText block className="q-prompt" text={q.stem} />
            {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.parts.map(pt => (
              <div key={pt.key} style={{ margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
                  <b style={{ fontSize: 16 }}>({pt.key})</b>
                  <span style={{ flex: 1 }}><MathText text={pt.prompt} /></span>
                  <span className="tag">{pt.marks} mark{pt.marks === 1 ? '' : 's'}</span>
                </div>
                {pt.answerType === 'mcq' ? (
                  <div className="mcq">
                    {pt.mcqOptions.map((opt, j) => (
                      <button key={j}
                        className={`mcq-opt ${answers[`${q.id}::${pt.key}`] === String(j) ? 'sel' : ''}`}
                        onClick={() => setAnswers(a => ({ ...a, [`${q.id}::${pt.key}`]: String(j) }))}>
                        <span className="mcq-key">{'ABCD'[j]}</span>
                        <MathText text={opt} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="answer-row">
                    {pt.answerPrefix && <span className="answer-prefix"><MathText text={pt.answerPrefix} /></span>}
                    <input className="input answer-input" placeholder={pt.inputHint || 'Your answer…'}
                      aria-label={`Your answer to part (${pt.key})`}
                      value={answers[`${q.id}::${pt.key}`] || ''}
                      onChange={e => setAnswers(a => ({ ...a, [`${q.id}::${pt.key}`]: e.target.value }))} />
                    {pt.answerSuffix && <span className="answer-suffix">{pt.answerSuffix}</span>}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
        <>
        <MathText block className="q-prompt" text={q.prompt} />
        {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}

        {q.answerType === 'mcq' ? (
          <div className="mcq">
            {q.mcqOptions.map((opt, i) => (
              <button key={i}
                className={`mcq-opt ${answers[q.id] === String(i) ? 'sel' : ''}`}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: String(i) }))}>
                <span className="mcq-key">{'ABCD'[i]}</span>
                <MathText text={opt} />
              </button>
            ))}
          </div>
        ) : q.answerType === 'working' ? (
          <div>
            <textarea className="input working-input" rows={6}
              aria-label="Your working — one line per row, every line earns marks"
              placeholder={q.inputHint || 'Show every line of your working — each line earns marks.'}
              value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
            <div className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>Full-working question — marks are awarded line by line.</div>
          </div>
        ) : (
          <div className="answer-row">
            {q.answerPrefix && <span className="answer-prefix"><MathText text={q.answerPrefix} /></span>}
            <input className="input answer-input" placeholder={q.inputHint || 'Your answer…'}
              aria-label={`Your answer to question ${cur + 1}`}
              value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && cur < exam.questions.length - 1) setCur(c => c + 1); }} />
            {q.answerSuffix && <span className="answer-suffix">{q.answerSuffix}</span>}
          </div>
        )}

        {q.answerType !== 'mcq' && q.answerType !== 'working' && q.supportsSteps && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-quiet btn-sm" onClick={() => setShowWk(w => ({ ...w, [q.id]: !w[q.id] }))}>
              {showWk[q.id] ? '▾' : '▸'} Show working for partial credit
            </button>
            {showWk[q.id] && (
              <>
                <textarea className="input" style={{ marginTop: 8 }} rows={4}
                  aria-label="Your working for partial credit — one step per line"
                  placeholder={'One step per line — if your final answer is wrong,\ncorrect working lines still earn marks.'}
                  value={workings[q.id] || ''}
                  onChange={e => setWorkings(w => ({ ...w, [q.id]: e.target.value }))} />
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>Marked like a real paper: a wrong answer with sound working still collects method marks.</div>
              </>
            )}
          </div>
        )}
        </>
        )}

        <div className="spread" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" disabled={cur === 0} onClick={() => setCur(c => c - 1)}>← Previous</button>
          {cur < exam.questions.length - 1
            ? <button className="btn btn-ghost" onClick={() => setCur(c => c + 1)}>Next →</button>
            : <button className="btn btn-primary" onClick={submit} disabled={busy}>Finish & submit</button>}
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>Exam conditions: no hints, no retries. Worked solutions unlock when you submit.</p>
    </div>
  );
}
