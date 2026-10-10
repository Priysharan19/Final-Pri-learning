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
// THE SERVER MARKS. The paper was issued by Pri's server and only its result is
// ever shown as a score. If the finish cannot reach the server the paper is
// submitted, frozen and waiting: this screen says so plainly and shows no score
// until the server's result arrives. A paper an earlier app version marked on
// the device opens in review labelled as that — never as a certified result.
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
import { tLater, useT, useTx } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import { CheckSignIn } from '../components/CheckRefusal.jsx';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import '../workspace.css';

const SAVE_DEBOUNCE_MS = 600;
// A submitted paper waiting for the server is asked about again this often.
const PENDING_RECHECK_MS = 20000;
const MARKED_BY_KEY = { server: 'examRoom.markedByServer', 'earlier-version': 'examRoom.markedByEarlier', backup: 'examRoom.markedByBackup' };
const PENDING_KEY = { offline: 'examRoom.pendingOffline', 'sign-in': 'examRoom.pendingSignIn', refused: 'examRoom.pendingRefused' };

/** The result card's data from a finished paper as the backend reads it back. */
const resultOf = e => ({
  score: e.score, total: e.total, pct: Math.round(100 * e.score / Math.max(1, e.total)), detail: e.detail,
  analysis: e.analysis || null, final: e.session?.final || null, markedBy: e.markedBy || null
});
const INK_POINTS_PER_SAVE = 9000;
const HEARTBEAT_MS = 30000;
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

/** A response key: `qid`, `qid::or`, `qid::a`, `qid::a::or` — the backend's own shape. */
const OR = 'or';
const answerKey = (...parts) => parts.join('::');

/** Every answer key a question owns: the question, its OR choice, its parts and their OR choices. */
function keysOf(q) {
  if (q.multipart) return (q.parts || []).flatMap(pt => [answerKey(q.id, pt.key), ...(pt.alt ? [answerKey(q.id, pt.key, OR)] : [])]);
  return [q.id, ...(q.choice ? [answerKey(q.id, OR)] : [])];
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
  const { celebrate, refreshUser, user } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [workings, setWorkings] = useState({});
  const [inks, setInks] = useState({});
  const [modes, setModes] = useState({});
  const [showWk, setShowWk] = useState({});
  const [cur, setCur] = useState(0);
  const [deadlineAt, setDeadlineAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState('loading');   // loading | sitting | finalising | pending | done
  // Submitted but not yet marked by the server: { reason, code }. Never a score.
  const [pending, setPending] = useState(null);
  const [rechecking, setRechecking] = useState(false);
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
  // Flags are the student's own marks to come back to; they ride in the draft.
  const [flagged, setFlagged] = useState(() => readDraft('exam', id)?.flagged || {});
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef(null);
  useEffect(() => {
    if (!confirming) return;
    confirmRef.current?.querySelector('button')?.focus();
    const onKey = e => { if (e.key === 'Escape') setConfirming(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirming]);
  const deadlineFired = useRef(false);
  // The backend's clock only moves forward (examSession observeClock). If the
  // device clock reads earlier than the time the paper has already seen, the
  // room counts from the paper's time, not the wound-back one.
  const skewRef = useRef(0);
  const clockNow = () => Date.now() + skewRef.current;
  // Every answer from the backend carries the paper's own time; the room
  // re-learns how far behind the device clock is each time, so a clock wound
  // back while the app was in the background is corrected without a reload.
  const learnClock = paperNow => {
    const n = Number(paperNow);
    if (Number.isFinite(n) && n > 0) skewRef.current = Math.max(0, n - Date.now());
  };

  const setPhaseBoth = p => { phaseRef.current = p; setPhase(p); };
  latest.current = { answers, workings, inks, modes, cur, exam, deadlineAt };

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
        setResult(resultOf(e));
        setPhaseBoth('done');
        return;
      }
      const session = e.session || {};
      if (session.pending) {
        // Submitted earlier and still waiting for the server: no score to show.
        clearDraft('exam', id);
        setExam(e);
        setPending(session.pending);
        setPhaseBoth('pending');
        return;
      }
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
      learnClock(session.now);
      setNow(clockNow());
      setPhaseBoth('sitting');
    }).catch(() => nav('/exams'));
    return () => { live = false; };
  }, [id, nav]);

  const secondsLeft = deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  const sitting = phase === 'sitting' && secondsLeft !== null && secondsLeft > 0;
  const locked = !sitting;

  // ── Autosave ───────────────────────────────────────────────────────────────
  const save = useCallback((urgent = false) => {
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
      inks: Object.fromEntries(sent.map(k => [k, snap.inks[k] || { strokes: [], lines: [] }])),
      // The page is going away: the server's checkpoint is sent now, not after its debounce.
      ...(urgent === true ? { urgent: true } : {})
    };
    setSaveState('saving');
    saveChain.current = saveChain.current.catch(() => {}).then(() => api.post(`/exams/${id}/responses`, body)).then(res => {
      learnClock(res?.now);
      setNow(clockNow());
      for (const k of sent) if (latest.current.inks[k] === snap.inks[k]) dirtyInk.current.delete(k);
      setSaveState(dirtyInk.current.size ? 'saving' : 'saved');
      if (dirtyInk.current.size && phaseRef.current === 'sitting') {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => save(), 50);
      }
    }, err => {
      setSaveState('error');
      // The paper's time is past the deadline even if this device's clock
      // says otherwise: count from the deadline, which submits the paper.
      if (err?.code === 'EXAM_DEADLINE_PASSED') {
        const deadline = latest.current.deadlineAt;
        if (Number.isFinite(deadline)) skewRef.current = Math.max(skewRef.current, deadline - Date.now());
        setNow(clockNow());
      }
    });
    return saveChain.current;
  }, [id, accrue]);

  const scheduleSave = useCallback(() => {
    if (phaseRef.current !== 'sitting') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // An unsaved change is never shown as saved, even for the debounce window.
    setSaveState('saving');
    saveTimer.current = setTimeout(() => save(), SAVE_DEBOUNCE_MS);
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
    queueDraft('exam', id, { answers, workings, cur, flagged }, {
      label: exam.title,
      note: t('examRoom.draftNote', { answered: answeredCount, total: exam.questions.length }),
      path: `/exams/${id}`
    });
  }, [answers, workings, inks, modes, cur, flagged]); // eslint-disable-line react-hooks/exhaustive-deps

  // A hidden tab may never come back: save now, not in 600 ms. Coming back
  // (visible again, or the window refocused) saves too — the reply carries the
  // paper's time, which corrects a device clock changed while the app was away.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save(true);
      else { accrue(); save(); }
    };
    const onPageHide = () => save(true);
    const onFocus = () => save();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('focus', onFocus);
    };
  }, [save, accrue]);

  // A heartbeat save every 30 seconds while the paper is open. The backend's
  // clock correction can only see a wound-back device clock when something
  // reads it; this bounds the time a rollback could ever hide to 30 seconds.
  useEffect(() => {
    if (phase !== 'sitting') return;
    const beat = setInterval(() => save(), HEARTBEAT_MS);
    return () => clearInterval(beat);
  }, [phase, save]);

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
    const timer = setInterval(() => setNow(clockNow()), 500);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (secondsLeft === null || phase !== 'sitting') return;
    for (const [mark, key] of [[300, 'examRoom.fiveMinutesLeft'], [60, 'examRoom.oneMinuteLeft']]) {
      if (secondsLeft <= mark && secondsLeft > 0 && !warned.current.has(mark)) {
        warned.current.add(mark);
        setAnnounce(tLater(key));
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
    setConfirming(false);
    setPhaseBoth('finalising');
    setSubmitError('');
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    accrue();
    if (reason === 'deadline') setAnnounce(tLater('examRoom.timeUp'));
    // Any autosave still in flight lands first, so the submit is the last write.
    await saveChain.current.catch(() => {});
    const snap = latest.current;
    try {
      const r = await api.post(`/exams/${id}/submit`, {
        answers: snap.answers, workings: snap.workings, times: timesRef.current,
        ms: Date.now() - startedAtRef.current, submissionKey: submissionKey.current, reason
      });
      clearDraft('exam', id);
      if (r?.pending) {
        // The server could not be reached. The paper is submitted and frozen;
        // it is not marked, and nothing here may look like a result.
        setPending(r);
        setPhaseBoth('pending');
        return;
      }
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
            setResult(resultOf(back));
            setPhaseBoth('done');
            return;
          }
        } catch { /* fall through to the retry message */ }
      }
      setSubmitError(err?.code === 'EXAM_NOT_SERVER_ISSUED' ? tLater('examRoom.notServerIssued') : (err?.message || tLater('examRoom.submitFailed')));
      setPhaseBoth('sitting');
      setNow(clockNow());
    }
  }

  // ── Waiting to be marked ───────────────────────────────────────────────────
  // Reading the paper back asks the server again (the backend sends the queued
  // finish). It is tried when the connection or the session returns, every
  // twenty seconds, and whenever the student asks.
  const recheck = useCallback(async () => {
    if (phaseRef.current !== 'pending') return;
    setRechecking(true);
    try {
      const back = (await api.get(`/exams/${id}`)).exam;
      if (phaseRef.current !== 'pending') return;
      if (back.finishedAt && back.detail) {
        setExam(back);
        setResult(resultOf(back));
        setPending(null);
        setPhaseBoth('done');
        refreshUser();
      } else if (back.session?.pending) setPending(back.session.pending);
    } catch { /* still waiting; the message on screen is still true */ }
    finally { setRechecking(false); }
  }, [id, refreshUser]);

  useEffect(() => {
    if (phase !== 'pending') return;
    const timer = setInterval(recheck, PENDING_RECHECK_MS);
    window.addEventListener('online', recheck);
    const offSession = onCloudSessionChange(event => { if (event?.detail?.connected === true) recheck(); });
    return () => { clearInterval(timer); window.removeEventListener('online', recheck); offSession?.(); };
  }, [phase, recheck]);

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

  // Handwriting is read when the student presses "Read my answer", not while
  // they write. The strokes are kept the moment the pen lifts all the same,
  // so a page that has not been read yet is still saved with the paper.
  const onInkStrokes = useCallback((key, raw) => {
    if (phaseRef.current !== 'sitting') return;
    const strokes = compactStrokes(raw || []);
    if (restoredSig.current[key] && restoredSig.current[key] === strokeSignature(strokes)) return;
    dirtyInk.current.add(key);
    setInks(x => {
      const next = { ...x };
      if (strokes.length) next[key] = { ...(x[key] || {}), strokes, lines: x[key]?.lines || [], answerLine: x[key]?.answerLine || '', engine: x[key]?.engine || null };
      else delete next[key];
      return next;
    });
  }, []);

  const onInk = useCallback((key, item, reading) => {
    if (phaseRef.current !== 'sitting') return;
    // A reading of earlier writing (the ink changed after it was read) is not
    // an answer: what it had put in the answer is withdrawn until the page is
    // read again. Nothing that no longer matches the ink is ever submitted.
    if (reading?.stale === true) {
      const isWorkingItem = item.answerType === 'working';
      setAnswers(a => ({ ...a, [key]: '' }));
      if (!isWorkingItem) setWorkings(w => { const next = { ...w }; delete next[key]; return next; });
      return;
    }
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

  if (phase === 'pending' && pending) {
    return (
      <div className="grid" style={{ gap: 18, maxWidth: 860, margin: '0 auto' }}>
        <h1 className="sr-only">{t('examRoom.pendingHeading', { title: exam.title })}</h1>
        <div className="card" style={{ padding: 34 }} role="status" data-exam-pending={pending.reason || 'offline'}>
          <div className="card-title">{exam.title}</div>
          <p style={{ fontWeight: 640, fontSize: 18, margin: '10px 0 0' }}>{t('examRoom.pendingTitle')}</p>
          <p className="sub" style={{ marginTop: 8 }}>{t(PENDING_KEY[pending.reason] || PENDING_KEY.offline)}</p>
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{t('examRoom.pendingLateNote')}</p>
          {pending.reason === 'sign-in' && (
            <div style={{ marginTop: 14 }}>
              <CheckSignIn user={user} refreshUser={refreshUser} label={t('examRoom.pendingSignInAction')} />
            </div>
          )}
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={recheck} disabled={rechecking}>
              {rechecking ? t('examRoom.pendingChecking') : t('examRoom.pendingRetry')}
            </button>
            <button className="btn btn-ghost" onClick={() => nav('/exams')}>{t('examRoom.pendingLeave')}</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done' && result) {
    const pct = result.pct ?? Math.round(100 * result.score / result.total);
    const shownPct = Math.round(pct);
    return (
      <div className="grid" style={{ gap: 18, maxWidth: 860, margin: '0 auto' }}>
        <h1 className="sr-only">{t('examRoom.markedHeading', { title: exam.title })}</h1>
        <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          <div className="card-title">{exam.title}</div>
          {/* The number is ink, never a traffic light; the sentence carries the meaning. */}
          <div className="hero-num exam-result-num">
            {shownPct}%<span className="sr-only"> {t(shownPct >= 80 ? 'examRoom.pctSrStrong' : shownPct >= 50 ? 'examRoom.pctSrFair' : 'examRoom.pctSrLow')}</span>
          </div>
          <p className="sub" style={{ marginTop: 6 }}>{t('examRoom.scoreOf', { count: result.total, score: result.score, total: result.total })} · {t(
            shownPct >= 90 ? 'examRoom.verdictOutstanding' :
              shownPct >= 80 ? 'examRoom.verdictExcellent' :
                shownPct >= 65 ? 'examRoom.verdictSolid' :
                  shownPct >= 50 ? 'examRoom.verdictFair' :
                    'examRoom.verdictLow')}</p>
          {result.final?.finalisedBy === 'deadline' && (
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>{t(result.final.late ? 'examRoom.finalisedLate' : 'examRoom.finalisedByDeadline')}</p>
          )}
          {/* Who marked it. Only the server's result is a certified one. */}
          {MARKED_BY_KEY[result.markedBy] && (
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }} data-exam-marked-by={result.markedBy}>{t(MARKED_BY_KEY[result.markedBy])}</p>
          )}
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => nav('/exams')}>{t('examRoom.newPaper')}</button>
            <button className="btn btn-ghost" onClick={() => nav('/stats')}>{t('examRoom.seeInsights')}</button>
          </div>
        </div>

        <ExamAnalysis analysis={result.analysis} />

        {result.detail.map((d, i) => d.multipart ? (
          <div className="card" key={d.id}>
            <div className="q-meta">
              <span className="tag">{t('examRoom.qNumber', { n: i + 1 })}</span>
              <span className="tag">{d.title}</span>
              <span className="tag tag-brand">{t('examRoom.structured')}</span>
              <span className="tag" style={{ color: d.awarded === d.marks ? 'var(--good)' : d.awarded > 0 ? 'var(--warn)' : 'var(--bad)' }}>
                {t('examRoom.awardedMarks', { awarded: d.awarded, n: d.marks })}
                <span className="sr-only"> — {t(d.awarded === d.marks ? 'examRoom.allEarned' : d.awarded > 0 ? 'examRoom.partlyEarned' : 'examRoom.noneEarned')}</span>
              </span>
            </div>
            <div lang="en"><MathText block className="q-prompt" style={{ fontSize: 16 }} text={d.stem} /></div>
            {d.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: d.figure }} />}
            {d.parts.map(pt => (
              <div key={pt.key} style={{ margin: '12px 0 0', paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <b>({pt.key})</b>
                  <span style={{ flex: 1 }} lang="en"><MathText text={pt.prompt} /></span>
                  <span className="tag" style={{ color: pt.correct ? 'var(--good)' : 'var(--bad)' }}>
                    {pt.awarded}/{pt.marks}<span className="sr-only"> {t(pt.correct ? 'examRoom.srMarksCorrect' : 'examRoom.srMarksIncorrect')}</span>
                  </span>
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 16, fontSize: 14, marginTop: 4 }}>
                  <span>{tx('examRoom.yours', { answer: <b>{pt.answerType === 'mcq' ? (pt.given !== '' && pt.given != null ? 'ABCD'[Number(pt.given)] ?? '—' : '—') : (pt.given || '—')}</b> })}</span>
                  <span>{tx('examRoom.correctShort', { answer: <b><MathText text={pt.answerText} /></b> })}</span>
                </div>
                {!pt.correct && pt.steps && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--brand-1)', fontWeight: 600, fontSize: 13 }}>{t('verdict.workedSolution')}</summary>
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
              <span className="tag">{t('examRoom.qNumber', { n: i + 1 })}</span>
              {d.sectionLabel && <span className="tag" lang="en">{d.sectionLabel}</span>}
              <span className="tag" lang="en">{d.subtopicName}</span>
              <span className="tag">{t('examRoom.difficultyTag', { n: d.difficulty })}</span>
              <span className="tag" style={{ color: d.correct ? 'var(--good)' : d.awarded > 0 ? 'var(--warn)' : 'var(--bad)' }}>
                {d.awarded < 0
                  ? t('examRoom.tagNegative', { lost: -d.awarded, n: d.marks })
                  : t(d.correct ? 'examRoom.tagCorrect' : d.awarded > 0 ? 'examRoom.tagPartial' : 'examRoom.tagWrong', { awarded: d.awarded, n: d.marks })}
                {d.unanswered && <span> {t('examRoom.notAttempted')}</span>}
              </span>
            </div>
            <div lang="en"><MathText block className="q-prompt" style={{ fontSize: 16 }} text={d.prompt} /></div>
            {d.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: d.figure }} />}
            {OBJECTIVE.has(d.answerType) && d.mcqOptions && (
              <div className="muted" style={{ marginBottom: 8 }}>
                {t('examRoom.options')} {d.mcqOptions.map((o, j) => <span key={j} lang="en" style={{ marginRight: 12 }}>{'ABCD'[j]}. <MathText text={o} /></span>)}
              </div>
            )}
            <div className="row" style={{ flexWrap: 'wrap', gap: 16, fontSize: 14 }}>
              <span>{t('history.yourAnswerWas')} <b>{givenText(d)}</b></span>
              <span>{t('history.correctAnswerWas')} <b><MathText text={d.solution.answerText} /></b></span>
            </div>
            {d.partial && (
              <div className="verdict" style={{ marginTop: 8, background: 'var(--brand-soft)', border: '1px solid var(--brand-1)' }}>
                <span className="verdict-ico">◐</span>
                <div style={{ fontSize: 13.5 }}>{d.partial.note}</div>
              </div>
            )}
            {!d.correct && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--brand-1)', fontWeight: 600, fontSize: 14 }}>{t('examRoom.showSolutionCriteria')}</summary>
                {d.solution.criteria && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                    {d.solution.criteria.map((c, j) => <li key={j}>{(c.mark ?? 1) === 1
                      ? tx('examRoom.oneMarkCriterion', { text: <MathText text={c.text} /> })
                      : tx('examRoom.marksCriterion', { n: c.mark, text: <MathText text={c.text} /> })}</li>)}
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
        <div><b>{t('examRoom.listOne')}</b>{item.matchList.left.map(r => <div key={r.key} style={{ marginTop: 4 }}>{r.key}. <MathText text={r.text} /></div>)}</div>
        <div><b>{t('examRoom.listTwo')}</b>{item.matchList.right.map(r => <div key={r.key} style={{ marginTop: 4 }}>{r.key}. <MathText text={r.text} /></div>)}</div>
      </div>
    ) : null;

    if (item.answerType === 'mcq') {
      return (
        <>
          {matchList}
          <div className="mcq" role="group" aria-label={t('examRoom.optionsFor', { label })}>
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
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 6px' }}>{t('examRoom.multiNote')}</p>
          <div className="mcq" role="group" aria-label={t('examRoom.optionsForMulti', { label })}>
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
      <>
        <textarea className="input working-input" rows={6} disabled={locked}
          aria-label={t('examRoom.workingAriaFor', { label })}
          placeholder={item.inputHint || t('examRoom.workingPlaceholder')}
          value={value} onChange={e => set(e.target.value)} />
        <div className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>{t('examRoom.workingNote')}</div>
      </>
    ) : (
      <div className="answer-row">
        {item.answerPrefix && <span className="answer-prefix"><MathText text={item.answerPrefix} /></span>}
        <input className="input answer-input" inputMode="text" enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={locked}
          placeholder={item.inputHint || t('verdict.answerPlaceholder')}
          aria-label={t(mode === 'ink' ? 'examRoom.answerAriaInk' : 'examRoom.answerAriaFor', { label })}
          value={value} onChange={e => set(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && cur < exam.questions.length - 1) setCur(c => c + 1); }} />
        {item.answerSuffix && <span className="answer-suffix">{item.answerSuffix}</span>}
      </div>
    );
    const saved = inks[key];
    return (
      <div className="exam-answer" data-answer-key={key}>
        {matchList}
        <div className="row" role="group" aria-label={t('examRoom.modeGroup', { label })} style={{ gap: 6, marginBottom: 8 }}>
          <button type="button" className={`btn btn-sm ${mode === 'ink' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={mode === 'ink'} disabled={locked}
            onClick={() => setMode(key, 'ink')}>{t('examRoom.writeByHand')}</button>
          <button type="button" className={`btn btn-sm ${mode === 'type' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={mode === 'type'} disabled={locked}
            onClick={() => setMode(key, 'type')}>{t('examRoom.typeMode')}</button>
        </div>
        {mode === 'ink' ? (
          <>
            {inkOpenKey === key ? (
              InkAnswer ? (
                <InkAnswer key={key} height={isWorking ? 340 : 240} disabled={locked}
                  initialStrokes={saved?.strokes?.length ? expandStrokes(saved.strokes) : null}
                  recognitionContext={item.answerType === 'numeric' ? { answerType: 'numeric', singleGlyphAlphabet: NUMERIC_SINGLE_GLYPH_ALPHABET } : null}
                  lineVerdicts={null}
                  onStrokes={strokes => onInkStrokes(key, strokes)}
                  onRecognized={r => onInk(key, item, r)} />
              ) : inkPhase === 'failed' ? (
                <div role="alert" className="muted" style={{ fontSize: 13 }}>
                  {t('examRoom.inkFailed')}
                </div>
              ) : (
                <div className="skeleton" style={{ height: 200 }} role="status" aria-label={t('examRoom.inkOpening')} />
              )
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" disabled={locked} onClick={() => setInkOpenKey(key)}>
                {t(saved?.strokes?.length ? 'examRoom.openWriting' : 'examRoom.openWritingSpace')}
              </button>
            )}
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>
                {t(isWorking ? 'examRoom.readWorking' : 'examRoom.readAnswer')}
              </div>
              {typed}
            </div>
          </>
        ) : typed}
        {mode === 'type' && !isWorking && item.supportsSteps && (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-quiet btn-sm" aria-expanded={!!showWk[key]} onClick={() => setShowWk(w => ({ ...w, [key]: !w[key] }))}>
              {showWk[key] ? '▾' : '▸'} {t('examRoom.showWorking')}
            </button>
            {showWk[key] && (
              <>
                <textarea className="input" style={{ marginTop: 8 }} rows={4} disabled={locked}
                  aria-label={t('examRoom.workingStepsAria', { label })}
                  placeholder={t('examRoom.partialPlaceholder')}
                  value={workings[key] || ''}
                  onChange={e => setWorkings(w => ({ ...w, [key]: e.target.value }))} />
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{t('examRoom.methodMarksNote')}</div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const answeredQ = qq => keysOf(qq).some(k => !blank(answers[k]));
  const saveLabel = saveState === 'saving' ? t('examRoom.saving') : saveState === 'saved' ? t('examRoom.saved') : saveState === 'error' ? t('examRoom.saveError') : '';

  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const unanswered = exam.questions.length - answeredCount;
  const low = left < 300;

  return (
    <div className="exam-page">
      <h1 className="sr-only">{exam.title}</h1>
      <header className="exam-head">
        <button type="button" className="icon-btn" onClick={() => nav('/exams')} aria-label={t('exam.leaveSaved')}><Icon name="back" /></button>
        <div className="exam-head-title">
          <b>{exam.title}</b>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {t('examRoom.answeredProgress', { answered: answeredCount, total: exam.questions.length })}
            {resumed && ` ${t('examRoom.resumedNote')}`}
            {saveLabel && <> · <span className="exam-save" data-state={saveState}>{saveLabel}</span></>}
          </span>
        </div>
        <span className={`exam-timer ${low ? 'low' : ''}`} role="timer" data-deadline={deadlineAt || undefined}
          aria-label={t(left < 120 ? 'examRoom.timeLeftLow' : 'examRoom.timeLeft')}>
          <Icon name="clock" />{mmss(left)}
          {low && <span className="exam-timer-note">{t('exam.underFive')}</span>}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)} disabled={locked}>
          {phase === 'finalising' ? t('verdict.marking') : t('exam.reviewSubmit')}
        </button>
      </header>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>

      <div className="exam-body">
      {submitError && (
        <div className="verdict verdict-technical" role="alert">
          <span className="verdict-ico"><Icon name="alert" /></span>
          <div>
            <div className="verdict-body">{submitError}</div>
            {phase === 'sitting' && left <= 0 && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => finalise('deadline')}>{t('common.tryAgain')}</button>
            )}
          </div>
        </div>
      )}

      <nav className="exam-nav" aria-label={t('exam.questions')}>
        {exam.questions.map((qq, i) => (
          <button key={qq.id}
            className={`exam-dot ${i === cur ? 'cur' : ''} ${answeredQ(qq) ? 'done' : ''} ${flagged[qq.id] ? 'flagged' : ''}`}
            aria-label={answeredQ(qq)
              ? (flagged[qq.id] ? t('exam.dotAnsweredFlagged', { n: i + 1 }) : t('examRoom.dotAnswered', { n: i + 1 }))
              : (flagged[qq.id] ? t('exam.dotOpenFlagged', { n: i + 1 }) : t('examRoom.dotNotAnswered', { n: i + 1 }))}
            aria-current={i === cur ? 'true' : undefined}
            onClick={() => setCur(i)}>{i + 1}</button>
        ))}
      </nav>
      <div className="exam-legend" aria-hidden="true">
        <span><i className="done" />{t('exam.legendAnswered')}</span>
        <span><i />{t('exam.legendOpen')}</span>
        <span><Icon name="flag" size={13} />{t('exam.legendFlagged')}</span>
      </div>

      {/* The paper retains English question content in a Hindi interface. Mark the
          authored mathematics in its source language for screen readers; keep
          the surrounding navigation and scoring labels translated with t(). */}
      <section className="exam-paper" aria-label={t('examRoom.questionOf', { n: qNumber, total: exam.questions.length })}>
        <div className="q-meta exam-qhead">
          <span className="tag">{t('examRoom.questionOf', { n: qNumber, total: exam.questions.length })}</span>
          {q.sectionLabel && <span className="tag" lang="en">{q.sectionLabel}</span>}
          <span className="tag" lang="en">{q.subtopicName}</span>
          <span className="tag">{q.negativeMarks && !q.multipart
            ? t('examRoom.negativeTag', { marks: q.marks, neg: q.negativeMarks })
            : (q.multipart || q.section) ? t('examRoom.marksCount', { count: q.marks, n: q.marks }) : q.diffLabel}</span>
          {q.multipart && <span className="tag tag-brand">{t('examRoom.structuredParts', { last: q.parts[q.parts.length - 1].key })}</span>}
          {/* A question that was actually set in an exam says which one. Every
              other question in the paper is authored practice, and a student
              is entitled to tell them apart while they are sitting it. */}
          {q.pyq && <span className="tag tag-brand" title={q.pyqSource || t('examRoom.pyqTitle')}>{q.pyqSource ? t('examRoom.pyqTag', { source: q.pyqSource }) : t('examRoom.pyqTagNoSource')}</span>}
          <button type="button" className="icon-btn exam-flag" style={{ marginLeft: 'auto' }} aria-pressed={!!flagged[q.id]}
            onClick={() => setFlagged(f => ({ ...f, [q.id]: !f[q.id] }))}>
            <Icon name="flag" size={16} />{flagged[q.id] ? t('exam.flagged') : t('exam.flag')}
          </button>
        </div>
        {q.multipart ? (
          <>
            <div lang="en"><MathText block className="q-prompt" text={q.stem} /></div>
            {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.parts.map(pt => (
              <div key={pt.key} style={{ margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
                  <b style={{ fontSize: 16 }}>({pt.key})</b>
                  <span style={{ flex: 1 }} lang="en"><MathText text={pt.prompt} /></span>
                  <span className="tag">{t('examRoom.marksCount', { count: pt.marks, n: pt.marks })}</span>
                </div>
                {pt.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: pt.figure }} />}
                {answerControl(answerKey(q.id, pt.key), pt, t('examRoom.labelPart', { key: pt.key }))}
                {pt.alt && (
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ fontWeight: 600, margin: '6px 0' }}>{t('examRoom.orLabel')}</div>
                    <div lang="en"><MathText block text={pt.alt.prompt} /></div>
                    {answerControl(answerKey(q.id, pt.key, OR), pt.alt, t('examRoom.labelPartOr', { key: pt.key }))}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <div lang="en"><MathText block className="q-prompt" text={q.prompt} /></div>
            {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {answerControl(q.id, q, t('examRoom.labelQuestion', { n: qNumber }))}
            {q.choice && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                <div className="muted" style={{ fontWeight: 600, marginBottom: 6 }}>{t('examRoom.orChoiceNote')}</div>
                <div lang="en"><MathText block className="q-prompt" text={q.choice.prompt} /></div>
                {q.choice.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.choice.figure }} />}
                {answerControl(answerKey(q.id, OR), q.choice, t('examRoom.labelQuestionOr', { n: qNumber }))}
              </div>
            )}
          </>
        )}

        <div className="exam-foot">
          <span className="status-line" data-state={saveState === 'error' ? 'failed' : saveState === 'saved' ? 'saved' : saveState === 'saving' ? 'working' : 'idle'}>
            {saveLabel && <span className="dot" aria-hidden="true" />}{saveLabel}
          </span>
          <button className="btn btn-ghost" disabled={cur === 0} onClick={() => setCur(c => c - 1)}>{t('examRoom.previous')}</button>
          {cur < exam.questions.length - 1
            ? <button className="btn btn-primary" onClick={() => setCur(c => c + 1)}>{t('examRoom.next')}</button>
            : <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={locked}>{t('exam.reviewSubmit')}</button>}
        </div>
      </section>
      <p className="exam-rules">{t('examRoom.conditionsNote')}</p>
      </div>

      {confirming && (
        <>
          <button type="button" className="sheet-scrim" aria-label={t('exam.keepWorking')} onClick={() => setConfirming(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title" ref={confirmRef}>
            <h2 id="exam-confirm-title">{t('exam.confirmTitle')}</h2>
            <p className="sub">{t('exam.confirmAnswered', { answered: answeredCount, total: exam.questions.length })}</p>
            {unanswered > 0 && <p className="sub" style={{ marginTop: 6 }}><b>{t('exam.confirmUnanswered', { count: unanswered, n: unanswered })}</b></p>}
            {flaggedCount > 0 && <p className="sub" style={{ marginTop: 6 }}>{t('exam.confirmFlagged', { count: flaggedCount, n: flaggedCount })}</p>}
            <p className="muted" style={{ marginTop: 10 }}>{t('exam.confirmFinal')}</p>
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>{t('exam.keepWorking')}</button>
              <button className="btn btn-primary" onClick={() => { setConfirming(false); finalise('student'); }} disabled={locked}>{t('exam.submitPaper')}</button>
            </div>
          </div>
        </>
      )}
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
