// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Exam room — one timed paper, answered question by question
// (by hand or by keyboard) and marked in a single pass at the end.
//
// THE CLOCK IS NOT THIS SCREEN'S. The paper's deadline is an absolute
// timestamp the exam backend wrote when the paper started (local/examSession.js).
// The room only ever subtracts "now" from it, so a reload, a backgrounded tab or
// an app relaunched an hour later shows exactly the time that is really left —
// and a paper whose time ran out while the app was closed is finalised the
// moment it is reopened.
//
// NOTHING LIVES ONLY IN REACT STATE. Answers, working, per-question time and
// handwriting strokes autosave to the device store (POST /exams/:id/responses)
// a moment after each change and immediately when the tab hides. The backend
// refuses those writes after the deadline or once the paper is finalised, and
// a submit after the deadline is marked on what was saved before it.
//
// EXAM CONDITIONS. No hints, no tutor, no explanations, no step feedback and no
// solutions while the paper is open. Handwriting is only transcribed — the
// reader is answer-blind, and the ink is never ticked or crossed until the
// paper is marked. Multiple-choice and numerical-entry questions keep their
// native controls; written answers can be handwritten or typed.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import { clearDraft, queueDraft, readDraft } from '../components/drafts.js';
import ExamAnalysis from '../components/ExamAnalysis.jsx';
import { compactStrokes, expandStrokes } from '../local/examSession.js';

const SAVE_DEBOUNCE_MS = 600;
const INK_POINTS_PER_SAVE = 9000;
const OBJECTIVE = new Set(['mcq', 'multi-mcq']);
const NUMERIC_SINGLE_GLYPH_ALPHABET = Array.from({ length: 10 }, (_, i) => String(i));

// The handwriting surface carries the recogniser (~0.9 MB), so it is fetched
// the first time a student chooses to write — never for a paper sat by keyboard.
let inkModule = null;
let inkPending = null;
function loadInk() {
  if (inkModule) return Promise.resolve(inkModule);
  if (!inkPending) {
    inkPending = import('../ink/InkAnswer.jsx').then(
      mod => { inkModule = mod; inkPending = null; return mod; },
      err => { inkPending = null; throw err; }
    );
  }
  return inkPending;
}

const blank = v => v === undefined || v === null || String(v).trim() === '';
const strokeSignature = strokes => `${strokes.length}:${strokes.reduce((n, s) => n + (s.points?.length || 0), 0)}`;

function newSubmissionKey() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* fall through */ }
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Every answer key a question owns: the question, its OR choice, its parts and their OR choices. */
function keysOf(q) {
  if (q.multipart) return (q.parts || []).flatMap(pt => [`${q.id}::${pt.key}`, ...(pt.alt ? [`${q.id}::${pt.key}::or`] : [])]);
  return [q.id, ...(q.choice ? [`${q.id}::or`] : [])];
}

const writtenItem = item => item && !OBJECTIVE.has(item.answerType);

function mmss(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export default function ExamRoom() {
  const { id } = useParams();
  const { celebrate, refreshUser } = useApp();
  const nav = useNavigate();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [workings, setWorkings] = useState({});
  const [inks, setInks] = useState({});
  const [modes, setModes] = useState({});
  const [showWk, setShowWk] = useState({});
  const [cur, setCur] = useState(0);
  const [deadlineAt, setDeadlineAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState('loading');   // loading | sitting | finalising | done
  const [result, setResult] = useState(null);
  const [resumed, setResumed] = useState(false);
  const [saveState, setSaveState] = useState('idle');   // idle | saving | saved | error
  const [submitError, setSubmitError] = useState('');
  const [inkOpenKey, setInkOpenKey] = useState(null);
  const [inkPhase, setInkPhase] = useState(inkModule ? 'ready' : 'idle');   // idle | loading | ready | failed
  const [announce, setAnnounce] = useState('');

  const startedAtRef = useRef(Date.now());
  const submissionKey = useRef(newSubmissionKey());
  const phaseRef = useRef('loading');
  const latest = useRef({});
  const timesRef = useRef({});
  const enteredRef = useRef({ qid: null, at: null });
  const dirtyInk = useRef(new Set());
  const restoredSig = useRef({});
  const saveTimer = useRef(null);
  const saveChain = useRef(Promise.resolve());
  const warned = useRef(new Set());
  const deadlineFired = useRef(false);

  const setPhaseBoth = p => { phaseRef.current = p; setPhase(p); };
  latest.current = { answers, workings, inks, modes, cur, exam };

  // ── Time on each question ──────────────────────────────────────────────────
  // Measured while the question is on screen and the page is visible; a hidden
  // tab's time is not attributed to any question (the paper's own clock still
  // runs — that is the deadline's job, not this one's).
  const accrue = useCallback(() => {
    const { qid, at } = enteredRef.current;
    if (qid && at) {
      timesRef.current = { ...timesRef.current, [qid]: (timesRef.current[qid] || 0) + Math.max(0, Date.now() - at) };
    }
    enteredRef.current = { qid, at: qid && typeof document !== 'undefined' && document.visibilityState === 'hidden' ? null : Date.now() };
  }, []);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let live = true;
    api.get(`/exams/${id}`).then(r => {
      if (!live) return;
      const e = r.exam;
      if (e.finishedAt && e.detail) {
        // A submitted paper has nothing left to recover, and a draft that
        // outlived its submit would only resurrect it.
        clearDraft('exam', id);
        setExam(e);
        setResult({ score: e.score, total: e.total, pct: Math.round(100 * e.score / Math.max(1, e.total)), detail: e.detail, analysis: e.analysis || null, final: e.session?.final || null });
        setPhaseBoth('done');
        return;
      }
      const session = e.session || {};
      const saved = session.responses;
      const draft = saved ? null : readDraft('exam', id);
      const from = saved || draft;
      if (from) {
        setAnswers(from.answers || {});
        setWorkings(from.workings || {});
        setShowWk(Object.fromEntries(Object.keys(from.workings || {}).map(k => [k, true])));
        setCur(Math.min(Number(from.cur) || 0, Math.max(0, e.questions.length - 1)));
        if (saved) {
          setInks(saved.inks || {});
          setModes(saved.modes || {});
          timesRef.current = { ...(saved.times || {}) };
          restoredSig.current = Object.fromEntries(Object.entries(saved.inks || {}).map(([k, v]) => [k, strokeSignature(v.strokes || [])]));
        }
        setResumed(true);
      }
      startedAtRef.current = session.startedAt || e.createdAt || Date.now();
      // The deadline is the stored one. An exam view without a session (an
      // older backend) falls back to the paper's own creation time — never to
      // "now", which would turn a crash into extra time.
      setDeadlineAt(session.deadlineAt || ((e.createdAt || Date.now()) + e.durationMin * 60000));
      setExam(e);
      setNow(Date.now());
      setPhaseBoth('sitting');
    }).catch(() => nav('/exams'));
    return () => { live = false; };
  }, [id, nav]);

  const secondsLeft = deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  const sitting = phase === 'sitting' && secondsLeft !== null && secondsLeft > 0;
  const locked = !sitting;

  // ── Autosave ───────────────────────────────────────────────────────────────
  const save = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (phaseRef.current !== 'sitting') return saveChain.current;
    accrue();
    const snap = latest.current;
    // One request carries at most ~9,000 points of handwriting, which keeps it
    // inside the API gateway's value budget; any further changed pages go in
    // the next save, scheduled as soon as this one lands.
    const sent = [];
    let points = 0;
    for (const k of dirtyInk.current) {
      const n = (snap.inks[k]?.strokes || []).reduce((m, s) => m + (s.points?.length || 0), 0);
      if (sent.length && points + n > INK_POINTS_PER_SAVE) break;
      sent.push(k);
      points += n;
    }
    const body = {
      answers: snap.answers, workings: snap.workings, times: timesRef.current, modes: snap.modes, cur: snap.cur,
      inks: Object.fromEntries(sent.map(k => [k, snap.inks[k] || { strokes: [], lines: [] }]))
    };
    setSaveState('saving');
    saveChain.current = saveChain.current.catch(() => {}).then(() => api.post(`/exams/${id}/responses`, body)).then(() => {
      for (const k of sent) if (latest.current.inks[k] === snap.inks[k]) dirtyInk.current.delete(k);
      setSaveState(dirtyInk.current.size ? 'saving' : 'saved');
      if (dirtyInk.current.size && phaseRef.current === 'sitting') {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(save, 50);
      }
    }, err => {
      setSaveState('error');
      if (err?.code === 'EXAM_DEADLINE_PASSED') setNow(Date.now());
    });
    return saveChain.current;
  }, [id, accrue]);

  const scheduleSave = useCallback(() => {
    if (phaseRef.current !== 'sitting') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, SAVE_DEBOUNCE_MS);
  }, [save]);

  const answeredCount = useMemo(() => {
    if (!exam) return 0;
    return exam.questions.filter(q => keysOf(q).some(k => !blank(answers[k]))).length;
  }, [answers, exam]);

  // Every change is saved a moment later; the localStorage draft remains the
  // "carry on where you left off" pointer the rest of the app lists.
  useEffect(() => {
    if (!exam || phase !== 'sitting') return;
    scheduleSave();
    queueDraft('exam', id, { answers, workings, cur }, {
      label: exam.title,
      note: `${answeredCount} of ${exam.questions.length} answered`,
      path: `/exams/${id}`
    });
  }, [answers, workings, inks, modes, cur]); // eslint-disable-line react-hooks/exhaustive-deps

  // A hidden tab may never come back: save now, not in 600 ms.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
      else accrue();
    };
    const onPageHide = () => save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [save, accrue]);

  // Moving between questions closes one question's clock and opens the next.
  useEffect(() => {
    if (!exam || phase !== 'sitting') return;
    accrue();
    const q = exam.questions[cur];
    enteredRef.current = { qid: q?.id || null, at: Date.now() };
    // The writing surface follows the student to the first written answer on
    // this question that they are answering by hand.
    const first = q ? keysOf(q).find(k => modeFor(k, itemFor(q, k)) === 'ink') : null;
    setInkOpenKey(first || null);
  }, [cur, exam, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── The clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'sitting') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (secondsLeft === null || phase !== 'sitting') return;
    for (const [mark, text] of [[300, 'Five minutes left.'], [60, 'One minute left.']]) {
      if (secondsLeft <= mark && secondsLeft > 0 && !warned.current.has(mark)) {
        warned.current.add(mark);
        setAnnounce(text);
      }
    }
    // The clock submits once. If that submit fails, the student is offered a
    // retry rather than the room hammering the backend every render.
    if (secondsLeft <= 0 && !deadlineFired.current) {
      deadlineFired.current = true;
      finalise('deadline');
    }
  }, [secondsLeft, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Finalise ───────────────────────────────────────────────────────────────
  async function finalise(reason = 'student') {
    if (phaseRef.current !== 'sitting') return;
    setPhaseBoth('finalising');
    setSubmitError('');
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    accrue();
    if (reason === 'deadline') setAnnounce('Time is up. Your paper is being marked.');
    // Any autosave still in flight lands first, so the submit is the last write.
    await saveChain.current.catch(() => {});
    const snap = latest.current;
    try {
      const r = await api.post(`/exams/${id}/submit`, {
        answers: snap.answers, workings: snap.workings, times: timesRef.current,
        ms: Date.now() - startedAtRef.current, submissionKey: submissionKey.current, reason
      });
      clearDraft('exam', id);
      setResult(r);
      setPhaseBoth('done');
      celebrate(r);
      refreshUser();
    } catch (err) {
      // Already finalised — by another tab, or by a submit whose reply was
      // lost. The marked paper is the answer, so show it.
      if (err?.status === 409 || err?.code === 'INDIA_EXAM_ALREADY_SUBMITTED') {
        try {
          const back = (await api.get(`/exams/${id}`)).exam;
          if (back.finishedAt && back.detail) {
            clearDraft('exam', id);
            setExam(back);
            setResult({ score: back.score, total: back.total, pct: Math.round(100 * back.score / Math.max(1, back.total)), detail: back.detail, analysis: back.analysis || null, final: back.session?.final || null });
            setPhaseBoth('done');
            return;
          }
        } catch { /* fall through to the retry message */ }
      }
      setSubmitError(err?.message || 'The paper could not be marked. Your answers are saved — try again.');
      setPhaseBoth('sitting');
      setNow(Date.now());
    }
  }

  // ── Handwriting ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!inkOpenKey || inkPhase === 'ready' || inkPhase === 'loading') return;
    if (inkModule) { setInkPhase('ready'); return; }
    let live = true;
    setInkPhase('loading');
    loadInk().then(() => { if (live) setInkPhase('ready'); }, () => { if (live) setInkPhase('failed'); });
    return () => { live = false; };
  }, [inkOpenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function itemFor(q, key) {
    if (q.multipart) {
      const [, partKey, or] = key.split('::');
      const pt = (q.parts || []).find(p => p.key === partKey);
      return or ? pt?.alt : pt;
    }
    return key.endsWith('::or') ? q.choice : q;
  }

  function modeFor(key, item) {
    if (!writtenItem(item)) return 'native';
    if (modes[key]) return modes[key];
    // Written answers on a board paper, and full-working answers anywhere, are
    // handwritten by default; numerical entry keeps its keyboard by default.
    if (item.answerType === 'working') return 'ink';
    return exam?.indiaExam?.track === 'cbse' ? 'ink' : 'type';
  }

  function setMode(key, mode) {
    setModes(m => ({ ...m, [key]: mode }));
    if (mode === 'ink') setInkOpenKey(key);
    else if (inkOpenKey === key) setInkOpenKey(null);
  }

  const onInk = useCallback((key, item, reading) => {
    if (phaseRef.current !== 'sitting') return;
    const strokes = compactStrokes(reading.strokes || []);
    const sig = strokeSignature(strokes);
    const lines = (reading.lines || []).map(l => String(l || ''));
    const record = strokes.length ? { strokes, lines, answerLine: reading.answerLine || '', engine: reading.engine || null } : null;
    // The first reading of restored ink re-reads the page that was saved. The
    // answer saved with it — which the student may have corrected by hand —
    // stands; only new writing replaces it.
    if (restoredSig.current[key] && restoredSig.current[key] === sig) {
      delete restoredSig.current[key];
      setInks(x => (record ? { ...x, [key]: { ...(x[key] || {}), lines, answerLine: record.answerLine } } : x));
      return;
    }
    delete restoredSig.current[key];
    dirtyInk.current.add(key);
    setInks(x => {
      const next = { ...x };
      if (record) next[key] = record; else delete next[key];
      return next;
    });
    const isWorking = item.answerType === 'working';
    setAnswers(a => ({ ...a, [key]: record ? (isWorking ? lines.filter(Boolean).join('\n') : (record.answerLine || '')) : '' }));
    if (!isWorking && item.supportsSteps) {
      setWorkings(w => {
        const next = { ...w };
        if (record && lines.length > 1) next[key] = lines.join('\n'); else delete next[key];
        return next;
      });
    }
  }, []);

  // ── Results view ───────────────────────────────────────────────────────────
  if (!exam) return <div className="skeleton" style={{ height: 300 }} />;

  if (phase === 'done' && result) {
    const pct = result.pct ?? Math.round(100 * result.score / result.total);
    const shownPct = Math.round(pct);
    return (
      <div className="grid" style={{ gap: 18, maxWidth: 860, margin: '0 auto' }}>
        <h1 className="sr-only">{exam.title} — marked</h1>
        <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          <div className="card-title">{exam.title}</div>
          {/* the big number is tinted good / neutral / bad; the tint is spelled out */}
          <div className="hero-num" style={{ color: shownPct >= 80 ? 'var(--good)' : shownPct >= 50 ? 'var(--ink)' : 'var(--bad)' }}>
            {shownPct}%<span className="sr-only"> of the paper's marks — {shownPct >= 80 ? 'a strong result' : shownPct >= 50 ? 'a fair result' : 'below half'}</span>
          </div>
          <p className="sub" style={{ marginTop: 6 }}>{result.score} of {result.total} marks · {
            shownPct >= 90 ? 'Outstanding — this is board-topper territory.' :
              shownPct >= 80 ? 'Excellent work — exam ready.' :
                shownPct >= 65 ? 'Solid — a few areas to tighten up.' :
                  shownPct >= 50 ? 'A fair base — the review below shows exactly where the marks went.' :
                    'Every mark lost below is a mark you can win back. Review each solution.'}</p>
          {result.final?.finalisedBy === 'deadline' && (
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Submitted when time ran out{result.final.late ? ' — marked on the answers saved before the deadline' : ''}.</p>
          )}
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => nav('/exams')}>New paper</button>
            <button className="btn btn-ghost" onClick={() => nav('/stats')}>See insights</button>
          </div>
        </div>

        <ExamAnalysis analysis={result.analysis} />

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
              {d.sectionLabel && <span className="tag">{d.sectionLabel}</span>}
              <span className="tag">{d.subtopicName}</span>
              <span className="tag">D{d.difficulty}</span>
              <span className="tag" style={{ color: d.correct ? 'var(--good)' : d.awarded > 0 ? 'var(--warn)' : 'var(--bad)' }}>
                {d.correct ? `✔ ${d.awarded}/${d.marks} marks` : d.awarded > 0 ? `◐ ${d.awarded}/${d.marks} marks` : d.awarded < 0 ? `✖ −${-d.awarded} (negative mark) of ${d.marks}` : `✖ 0/${d.marks} marks`}
                {d.unanswered && <span> · not attempted</span>}
              </span>
            </div>
            <MathText block className="q-prompt" style={{ fontSize: 16 }} text={d.prompt} />
            {d.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: d.figure }} />}
            {OBJECTIVE.has(d.answerType) && d.mcqOptions && (
              <div className="muted" style={{ marginBottom: 8 }}>
                Options: {d.mcqOptions.map((o, j) => <span key={j} style={{ marginRight: 12 }}>{'ABCD'[j]}. <MathText text={o} /></span>)}
              </div>
            )}
            <div className="row" style={{ flexWrap: 'wrap', gap: 16, fontSize: 14 }}>
              <span>Your answer: <b>{givenText(d)}</b></span>
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
                    {d.solution.criteria.map((c, j) => <li key={j}>{c.mark ?? 1} mark{(c.mark ?? 1) === 1 ? '' : 's'} — <MathText text={c.text} /></li>)}
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

  // ── Taking view ────────────────────────────────────────────────────────────
  const q = exam.questions[cur];
  const left = secondsLeft ?? 0;
  const InkAnswer = inkPhase === 'ready' ? inkModule?.default : null;
  const qNumber = cur + 1;

  /** One answer control: native for objective items, write-or-type for written ones. */
  function answerControl(key, item, label) {
    if (!item) return null;
    const value = answers[key] || '';
    const set = v => setAnswers(a => ({ ...a, [key]: v }));
    const matchList = item.matchList ? (
      <div className="grid cols-2" style={{ gap: 10, margin: '6px 0 12px', fontSize: 14 }}>
        <div><b>List-I</b>{item.matchList.left.map(r => <div key={r.key} style={{ marginTop: 4 }}>{r.key}. <MathText text={r.text} /></div>)}</div>
        <div><b>List-II</b>{item.matchList.right.map(r => <div key={r.key} style={{ marginTop: 4 }}>{r.key}. <MathText text={r.text} /></div>)}</div>
      </div>
    ) : null;

    if (item.answerType === 'mcq') {
      return (
        <>
          {matchList}
          <div className="mcq" role="group" aria-label={`Options for ${label}`}>
            {item.mcqOptions.map((opt, j) => (
              <button key={j} type="button" disabled={locked}
                className={`mcq-opt ${value === String(j) ? 'sel' : ''}`}
                aria-pressed={value === String(j)}
                onClick={() => set(value === String(j) ? '' : String(j))}>
                <span className="mcq-key">{'ABCD'[j]}</span>
                <MathText text={opt} />
              </button>
            ))}
          </div>
        </>
      );
    }
    if (item.answerType === 'multi-mcq') {
      const chosen = new Set(String(value).split(',').filter(Boolean));
      const toggle = j => {
        const next = new Set(chosen);
        if (next.has(String(j))) next.delete(String(j)); else next.add(String(j));
        set([...next].map(Number).sort((a, b) => a - b).join(','));
      };
      return (
        <>
          {matchList}
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 6px' }}>One or more options may be correct. Choose every one you are sure of — a wrong choice costs marks.</p>
          <div className="mcq" role="group" aria-label={`Options for ${label} — choose one or more`}>
            {item.mcqOptions.map((opt, j) => (
              <button key={j} type="button" disabled={locked}
                className={`mcq-opt ${chosen.has(String(j)) ? 'sel' : ''}`}
                aria-pressed={chosen.has(String(j))}
                onClick={() => toggle(j)}>
                <span className="mcq-key">{'ABCD'[j]}</span>
                <MathText text={opt} />
              </button>
            ))}
          </div>
        </>
      );
    }

    const mode = modeFor(key, item);
    const isWorking = item.answerType === 'working';
    const typed = isWorking ? (
      <textarea className="input working-input" rows={6} disabled={locked}
        aria-label={`Your working for ${label} — one line per row, every line earns marks`}
        placeholder={item.inputHint || 'Show every line of your working — each line earns marks.'}
        value={value} onChange={e => set(e.target.value)} />
    ) : (
      <div className="answer-row">
        {item.answerPrefix && <span className="answer-prefix"><MathText text={item.answerPrefix} /></span>}
        <input className="input answer-input" disabled={locked}
          placeholder={item.inputHint || 'Your answer…'}
          aria-label={mode === 'ink' ? `Your answer to ${label}, as read from your writing — correct it if the reading is wrong` : `Your answer to ${label}`}
          value={value} onChange={e => set(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && cur < exam.questions.length - 1) setCur(c => c + 1); }} />
        {item.answerSuffix && <span className="answer-suffix">{item.answerSuffix}</span>}
      </div>
    );
    const saved = inks[key];
    return (
      <div className="exam-answer" data-answer-key={key}>
        {matchList}
        <div className="row" role="group" aria-label={`How you answer ${label}`} style={{ gap: 6, marginBottom: 8 }}>
          <button type="button" className={`btn btn-sm ${mode === 'ink' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={mode === 'ink'} disabled={locked}
            onClick={() => setMode(key, 'ink')}>✍ Write by hand</button>
          <button type="button" className={`btn btn-sm ${mode === 'type' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={mode === 'type'} disabled={locked}
            onClick={() => setMode(key, 'type')}>⌨ Type</button>
        </div>
        {mode === 'ink' ? (
          <>
            {inkOpenKey === key ? (
              InkAnswer ? (
                <InkAnswer key={key} height={isWorking ? 340 : 240} disabled={locked}
                  initialStrokes={saved?.strokes?.length ? expandStrokes(saved.strokes) : null}
                  recognitionContext={item.answerType === 'numeric' ? { answerType: 'numeric', singleGlyphAlphabet: NUMERIC_SINGLE_GLYPH_ALPHABET } : null}
                  lineVerdicts={null}
                  onRecognized={r => onInk(key, item, r)} />
              ) : inkPhase === 'failed' ? (
                <div role="alert" className="muted" style={{ fontSize: 13 }}>
                  The handwriting engine could not load. Type your answer instead — it is saved the same way.
                </div>
              ) : (
                <div className="skeleton" style={{ height: 200 }} role="status" aria-label="Opening the writing space" />
              )
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" disabled={locked} onClick={() => setInkOpenKey(key)}>
                {saved?.strokes?.length ? 'Open your writing' : 'Open the writing space'}
              </button>
            )}
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>
                {isWorking ? 'Your working, as read from your writing — this is what is marked:' : 'Your answer, as read from your writing — this is what is marked:'}
              </div>
              {typed}
            </div>
          </>
        ) : typed}
        {mode === 'type' && !isWorking && item.supportsSteps && (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-quiet btn-sm" aria-expanded={!!showWk[key]} onClick={() => setShowWk(w => ({ ...w, [key]: !w[key] }))}>
              {showWk[key] ? '▾' : '▸'} Show working for partial credit
            </button>
            {showWk[key] && (
              <>
                <textarea className="input" style={{ marginTop: 8 }} rows={4} disabled={locked}
                  aria-label={`Your working for ${label} — one step per line`}
                  placeholder={'One step per line — if your final answer is wrong,\ncorrect working lines still earn marks.'}
                  value={workings[key] || ''}
                  onChange={e => setWorkings(w => ({ ...w, [key]: e.target.value }))} />
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>Marked like a real paper: a wrong answer with sound working still collects method marks.</div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const answeredQ = qq => keysOf(qq).some(k => !blank(answers[k]));
  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved on this device' : saveState === 'error' ? 'Not saved yet — retrying' : '';

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 860, margin: '0 auto' }}>
      <h1 className="sr-only">{exam.title}</h1>
      <div className="card exam-head">
        <div>
          <b>{exam.title}</b>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {answeredCount}/{exam.questions.length} answered
            {resumed && ' · picked up where you left off'}
            {saveLabel && <> · <span className="exam-save" data-state={saveState}>{saveLabel}</span></>}
          </div>
        </div>
        <span className={`exam-timer ${left < 120 ? 'low' : ''}`} style={{ marginLeft: 'auto' }} data-deadline={deadlineAt || undefined}>
          ⏱ {mmss(left)}
          <span className="sr-only"> left{left < 120 ? ' — under two minutes' : ''}</span>
        </span>
        <button className="btn btn-primary" onClick={() => finalise('student')} disabled={locked}>
          {phase === 'finalising' ? 'Marking…' : 'Submit paper'}
        </button>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
      {submitError && (
        <div className="card" role="alert">
          {submitError}
          {phase === 'sitting' && left <= 0 && (
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 12 }} onClick={() => finalise('deadline')}>Try again</button>
          )}
        </div>
      )}

      <div className="exam-nav">
        {exam.questions.map((qq, i) => (
          <button key={qq.id}
            className={`exam-dot ${i === cur ? 'cur' : ''} ${answeredQ(qq) ? 'done' : ''}`}
            aria-label={`Question ${i + 1}${answeredQ(qq) ? ', answered' : ', not answered yet'}`}
            aria-current={i === cur ? 'true' : undefined}
            onClick={() => setCur(i)}>{i + 1}</button>
        ))}
      </div>

      <div className="card">
        <div className="q-meta">
          <span className="tag">Question {qNumber} of {exam.questions.length}</span>
          {q.sectionLabel && <span className="tag">{q.sectionLabel}</span>}
          <span className="tag">{q.subtopicName}</span>
          <span className="tag">{q.multipart ? `${q.marks} marks` : q.negativeMarks ? `+${q.marks} correct · −${q.negativeMarks} wrong` : q.section ? `${q.marks} mark${q.marks === 1 ? '' : 's'}` : q.diffLabel}</span>
          {q.multipart && <span className="tag tag-brand">Structured — parts (a)–({q.parts[q.parts.length - 1].key})</span>}
          {/* A question that was actually set in an exam says which one. Every
              other question in the paper is authored practice, and a student
              is entitled to tell them apart while they are sitting it. */}
          {q.pyq && <span className="tag tag-brand" title={q.pyqSource || 'Previous year question'}>PYQ · {q.pyqSource || 'previous year question'}</span>}
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
                {pt.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: pt.figure }} />}
                {answerControl(`${q.id}::${pt.key}`, pt, `part (${pt.key})`)}
                {pt.alt && (
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ fontWeight: 600, margin: '6px 0' }}>OR</div>
                    <MathText block text={pt.alt.prompt} />
                    {answerControl(`${q.id}::${pt.key}::or`, pt.alt, `part (${pt.key}), the other choice`)}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <MathText block className="q-prompt" text={q.prompt} />
            {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {answerControl(q.id, q, `question ${qNumber}`)}
            {q.choice && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                <div className="muted" style={{ fontWeight: 600, marginBottom: 6 }}>OR — answer one of the two. If both are answered, the first is marked.</div>
                <MathText block className="q-prompt" text={q.choice.prompt} />
                {q.choice.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.choice.figure }} />}
                {answerControl(`${q.id}::or`, q.choice, `question ${qNumber}, the other choice`)}
              </div>
            )}
          </>
        )}

        <div className="spread" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" disabled={cur === 0} onClick={() => setCur(c => c - 1)}>← Previous</button>
          {cur < exam.questions.length - 1
            ? <button className="btn btn-ghost" onClick={() => setCur(c => c + 1)}>Next →</button>
            : <button className="btn btn-primary" onClick={() => finalise('student')} disabled={locked}>Finish & submit</button>}
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        Exam conditions: no hints, no retries, no feedback on your writing. Handwriting is only read, never marked, until you submit — worked solutions unlock then.
      </p>
    </div>
  );
}

/** What the review prints as the student's answer. */
function givenText(d) {
  if (d.given === '' || d.given == null) return '—';
  if (d.answerType === 'mcq') return 'ABCD'[Number(d.given)] ?? '—';
  if (d.answerType === 'multi-mcq') return String(d.given).split(',').filter(Boolean).map(i => 'ABCD'[Number(i)] ?? '?').join(', ') || '—';
  return d.given;
}
