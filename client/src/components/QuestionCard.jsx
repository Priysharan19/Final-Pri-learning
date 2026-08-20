// ─────────────────────────────────────────────────────────────────────────────
// The question experience, styled as a full page: marks + live timer up top,
// hint bulbs that trade credit for help, three answer modes (type / write /
// photo), an evaluation card with reasoning, worked solution, final answer and
// an HSC-style criteria table. All marking logic is the verified v3 engine.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import InkAnswer from '../ink/InkAnswer.jsx';
import InkCanvas from '../ink/InkCanvas.jsx';
import { exprToLatex } from '../ink/recognizer.js';

const DIFF_CLASS = { 1: 'tag-d1', 2: 'tag-d2', 3: 'tag-d3', 4: 'tag-d4' };
const SYMBOLS = ['π', '√(', '^', '±', '×', '÷', '≤', '≥', '≠', '°', 'θ', '(', ')', '/', ':'];
const preferMode = () => {
  const saved = localStorage.getItem('pri-input-mode');
  if (saved) return saved;
  return (window.matchMedia?.('(pointer: coarse)').matches ?? false) ? 'write' : 'type';
};

export default function QuestionCard({ question, why, reason, onResolved, onNext, onRedo, compact = false }) {
  const { celebrate, refreshUser, refreshDue, refreshRecent, toast } = useApp();
  const [answer, setAnswer] = useState('');
  const [mcqSel, setMcqSel] = useState(null);
  const [mode, setMode] = useState(preferMode());       // 'type' | 'write' | 'photo'
  const [inkResult, setInkResult] = useState(null);
  const [hints, setHints] = useState([]);
  const [hintsLeft, setHintsLeft] = useState(question.hintsAvailable);
  const [working, setWorking] = useState('');
  const [showWorking, setShowWorking] = useState(false);
  const [showScribble, setShowScribble] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showSyms, setShowSyms] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [state, setState] = useState({ phase: 'answering' });
  const [busy, setBusy] = useState(false);
  const [selfMarks, setSelfMarks] = useState({});
  const [selfSaved, setSelfSaved] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const inputRef = useRef(null);
  const scribbleRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    setAnswer(''); setMcqSel(null); setInkResult(null); setHints([]); setHintsLeft(question.hintsAvailable);
    setShowWorking(false); setWorking(''); setState({ phase: 'answering' }); setBusy(false);
    setSelfMarks({}); setSelfSaved(false); setPhoto(null); setBookmarked(false); setElapsed(0);
    startRef.current = Date.now();
    if (mode === 'type') setTimeout(() => inputRef.current?.focus(), 60);
  }, [question.id]); // eslint-disable-line

  const resolved = state.phase === 'resolved';
  const res = state.res;

  useEffect(() => {
    if (resolved) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [resolved, question.id]);

  const isMcq = question.answerType === 'mcq';
  const isWorking = question.answerType === 'working';
  const totalMarks = question.criteria?.length || 1;
  const hintsUsed = hints.length;
  const credit = Math.max(0.55, 1 - 0.15 * hintsUsed);
  const writeMode = mode === 'write';

  const typedPreview = useMemo(() => {
    if (!answer.trim() || /^[\d\s.]+$/.test(answer)) return null;
    try { return exprToLatex(answer.trim()); } catch { return null; }
  }, [answer]);

  const flipMode = (m) => {
    setMode(m);
    localStorage.setItem('pri-input-mode', m);
    if (m === 'type') setTimeout(() => inputRef.current?.focus(), 60);
    if (m === 'photo' && !photo) setTimeout(() => photoInputRef.current?.click(), 120);
  };

  const insertSym = (s) => {
    const el = inputRef.current;
    if (!el) { setAnswer(a => a + s); return; }
    const st = el.selectionStart ?? el.value.length, en = el.selectionEnd ?? el.value.length;
    const setV = isWorking ? setWorking : setAnswer;
    setV(v => v.slice(0, st) + s + v.slice(en));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(st + s.length, st + s.length); });
  };

  async function submit() {
    if (busy || resolved) return;
    let given, steps, viaInk = false, ink;
    if (isMcq) {
      given = mcqSel;
      if (given === null) return;
    } else if (isWorking) {
      if (writeMode) {
        if (!inkResult?.lines?.length) return;
        given = inkResult.lines.join('\n');
        viaInk = true;
        ink = { strokes: inkResult.strokes.map(s => ({ points: s.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })) })), recognized: inkResult.text };
      } else {
        given = working;
        if (!given.trim()) return;
      }
    } else if (writeMode) {
      if (!inkResult?.answerLine) return;
      given = inkResult.answerLine;
      steps = inkResult.lines.length > 1 ? inkResult.lines.join('\n') : undefined;
      viaInk = true;
      ink = { strokes: inkResult.strokes.map(s => ({ points: s.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })) })), recognized: inkResult.text };
    } else {
      given = answer;
      if (String(given).trim() === '') return;
      steps = (showWorking || mode === 'photo') && working.trim() ? working : undefined;
    }
    setBusy(true);
    try {
      const scribbleStrokes = scribbleRef.current && !scribbleRef.current.isEmpty()
        ? scribbleRef.current.getStrokes().map(st => ({ points: st.points.map(pt => ({ x: Math.round(pt.x), y: Math.round(pt.y) })) }))
        : undefined;
      const r = await api.post(`/practice/${question.id}/submit`, {
        answer: String(given), ms: Date.now() - startRef.current, steps, viaInk, ink, photo, scribble: scribbleStrokes
      });
      if (r.resolved) {
        setState({ phase: 'resolved', res: r });
        celebrate(r); refreshUser(); refreshDue(); refreshRecent?.();
        toast(<div><b>Syllabus outcome updated</b><div className="badge-desc">{question.subtopicName} — based on your performance</div></div>, 4200);
        onResolved?.(r);
      } else {
        setState({ phase: 'retry', res: r });
      }
    } catch (e) {
      setState({ phase: 'retry', res: { feedback: e.message, invalid: true } });
    } finally { setBusy(false); }
  }

  async function getHint() {
    if (hintsLeft <= 0 || resolved) return;
    try {
      const r = await api.post(`/practice/${question.id}/hint`, {});
      setHints(h => [...h, r.hint]);
      setHintsLeft(r.remaining);
    } catch { }
  }

  async function reveal() {
    if (busy || resolved) return;
    setBusy(true);
    try {
      const r = await api.post(`/practice/${question.id}/reveal`, { ms: Date.now() - startRef.current });
      setState({ phase: 'resolved', res: r });
      celebrate(r); refreshUser(); refreshDue(); refreshRecent?.();
      onResolved?.(r);
    } finally { setBusy(false); }
  }

  async function toggleBookmark() {
    try {
      const r = await api.post(`/history/${question.id}/bookmark`, {});
      setBookmarked(r.bookmarked);
      toast(r.bookmarked ? 'Saved to Favorites' : 'Removed from Favorites', 2200);
    } catch { toast('Answer the question first, then favorite it from History.', 3200); }
  }

  const verdictGood = resolved && res.correct;
  const activeReport = state.res?.stepReport;
  // Teacher-style pin: per-line verdicts on the student's own ink. Step Check
  // pinpoints the exact line where the maths breaks; if every line is
  // consistent but the answer is still wrong, the final line gets the ✗ — the
  // mistake is always pointed at, never just "incorrect".
  const lineVerdicts = useMemo(() => {
    if (!writeMode) return null;
    const n = inkResult?.lines?.length || 0;
    let base = activeReport?.lines
      ? activeReport.lines.map(l => ({ status: l.status, note: l.note }))
      : null;
    const wrongNow = (state.phase === 'retry' && !state.res?.invalid) || (resolved && !res?.correct && !res?.revealed);
    if (wrongNow && n > 0) {
      if (!base) base = Array.from({ length: n }, () => ({ status: 'unknown' }));
      if (!base.some(v => v.status === 'break')) {
        const idx = Math.min(n, base.length) - 1;
        if (idx >= 0) base[idx] = {
          status: 'wrong',
          note: resolved && res?.solution?.answerText
            ? `this line should conclude ${String(res.solution.answerText)}`
            : 'this line doesn’t reach the right answer — rework it'
        };
      }
    }
    // Correct → the marked answer line earns its tick on the ink itself.
    if (resolved && res?.correct && n > 0) {
      if (!base) base = Array.from({ length: n }, () => ({ status: 'unknown' }));
      const idx = Math.min(n, base.length) - 1;
      if (idx >= 0 && base[idx].status !== 'break') base[idx] = { status: 'ok', note: base[idx]?.note };
    }
    return base;
  }, [writeMode, activeReport, state.phase, state.res?.invalid, resolved, res, inkResult]);

  // Teacher comments panel — one card per marked step, like a margin column.
  const inkComments = useMemo(() => {
    if (!writeMode || !lineVerdicts || !inkResult?.lines?.length) return null;
    const cards = [];
    lineVerdicts.forEach((v, i) => {
      const text = inkResult.lines[i];
      if (!text) return;
      if (v.status === 'ok') {
        cards.push({
          kind: 'good', line: i + 1,
          text: v.note || (i === 0 ? 'A valid starting point.' : 'Checks out — follows correctly from the line above.')
        });
      } else if (v.status === 'break' || v.status === 'wrong') {
        cards.push({ kind: 'bad', line: i + 1, text: v.note || 'The maths breaks on this line.' });
      }
    });
    return cards.length ? cards : null;
  }, [writeMode, lineVerdicts, inkResult]);
  const canSubmit = isMcq ? mcqSel !== null : isWorking ? (writeMode ? !!inkResult?.lines?.length : !!working.trim()) : writeMode ? !!inkResult?.answerLine : !!answer.trim();

  const earnedMarks = resolved
    ? (verdictGood ? totalMarks : (selfSaved ? Object.values(selfMarks).filter(Boolean).length : 0))
    : 0;
  const shownMarks = Math.round(earnedMarks * credit * 10) / 10;
  const pct = totalMarks ? Math.round(100 * shownMarks / totalMarks) : 0;

  const answerLines = isMcq ? [] : writeMode
    ? (inkResult?.lines || [])
    : isWorking ? working.split('\n').filter(Boolean)
      : [...(showWorking && working ? working.split('\n').filter(Boolean) : []), answer].filter(Boolean);

  return (
    <div className="qpage">
      {/* left action rail */}
      <div className="q-rail no-print">
        <button className={`q-rail-btn ${bookmarked ? 'on' : ''}`} title="Favorite" onClick={toggleBookmark}>☆</button>
        <button className={`q-rail-btn ${showWhy ? 'on' : ''}`} title="Why this question?" onClick={() => setShowWhy(s => !s)}>ⓘ</button>
        <button className={`q-rail-btn ${showScribble ? 'on' : ''}`} title="Scribble pad" onClick={() => setShowScribble(s => !s)}>✎</button>
      </div>

      {/* hint bulbs */}
      {!isMcq && question.hintsAvailable > 0 && (
        <div className="hint-rail no-print">
          {Array.from({ length: question.hintsAvailable }, (_, i) => (
            <button key={i} className={`hint-bulb ${i < hintsUsed ? 'lit' : ''}`}
              disabled={resolved || i !== hintsUsed}
              title={`Hint ${i + 1} — costs 15% credit`}
              onClick={getHint}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 0-3.4 10.9c.7.5 1.1 1.2 1.2 2.1h4.4c.1-.9.5-1.6 1.2-2.1A6 6 0 0 0 12 3Z" /></svg>
              <sup>{i + 1}</sup>
            </button>
          ))}
        </div>
      )}

      <div className="q-topmeta">
        <span>{totalMarks} mark{totalMarks === 1 ? '' : 's'}</span>
        {hintsUsed > 0 && !resolved && (
          <span className="q-credit"><span className="dot">•</span> {Math.round(credit * 100)}% credit available ({Math.round(totalMarks * credit * 10) / 10} marks) <span className="dot">•</span></span>
        )}
        <span className="tag">{question.subtopicName}</span>
        <span className={`tag ${DIFF_CLASS[question.difficulty] || ''}`}>{question.diffLabel}</span>
        {reason === 'review' && <span className="tag tag-brand">Spaced review</span>}
        {reason === 'weak-spot' && <span className="tag tag-brand">Weak spot</span>}
        {reason === 'new-ground' && <span className="tag tag-brand">New ground</span>}
        {reason === 'task' && <span className="tag tag-brand">Task</span>}
        <span className="q-timer">◷ {fmtTime(elapsed)}</span>
      </div>

      {showWhy && why && <p className="muted" style={{ marginBottom: 12 }}>{why}</p>}

      <MathText block className="q-prompt" text={question.prompt} />
      {question.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: question.figure }} />}

      {resolved && (
        <div className="row no-print" style={{ margin: '14px 0 2px' }}>
          <button className="redo-chip" onClick={() => onRedo ? onRedo() : onNext?.()}>↻ Redo Question</button>
        </div>
      )}

      {/* ── answering surface ── */}
      {isMcq ? (
        <div className="mcq">
          {question.mcqOptions.map((opt, i) => {
            let cls = 'mcq-opt';
            if (!resolved && mcqSel === i) cls += ' sel';
            if (resolved) {
              if (opt === res.solution?.answerText) cls += ' right';
              else if (mcqSel === i && !res.correct) cls += ' wrong';
            }
            return (
              <button key={i} className={cls} disabled={resolved} onClick={() => setMcqSel(i)}>
                <span className="mcq-key">{'ABCD'[i]}</span>
                <MathText text={opt} />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mode-tabs no-print">
            <button className={`mode-tab ${mode === 'type' ? 'on' : ''}`} title="Maths editor — type equations and working" onClick={() => flipMode('type')}>T</button>
            <button className={`mode-tab ${mode === 'write' ? 'on' : ''}`} title="Handwriting — draw with pencil or finger" onClick={() => flipMode('write')}>✎</button>
            <button className={`mode-tab ${mode === 'photo' ? 'on' : ''}`} title="Photo — attach handwritten work" onClick={() => flipMode('photo')}>▣</button>
          </div>

          {mode !== 'write' ? (
            <div className={`editor-shell ${resolved ? 'ink-disabled' : ''}`}>
              <div className="editor-toolbar">
                <button className={`editor-tool ${showSyms ? 'on' : ''}`} title="Symbol palette" onClick={() => setShowSyms(s => !s)}>Σ</button>
                <span className="editor-hint"><span className="kbd">{isWorking ? '⏎' : 'type'}</span> {isWorking ? 'one line of working per row' : 'to write math — it reads naturally'}</span>
                <span style={{ flex: 1 }} />
                {question.answerSuffix && <span className="answer-suffix">answer in {question.answerSuffix}</span>}
              </div>
              {showSyms && (
                <div className="sym-palette">
                  {SYMBOLS.map(s => <button key={s} className="sym-key" onClick={() => insertSym(s)}>{s}</button>)}
                </div>
              )}
              <div className="editor-body">
                {mode === 'photo' && (
                  <div style={{ marginBottom: 14 }}>
                    <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                      onChange={e => attachPhoto(e, setPhoto)} />
                    {!photo
                      ? <button className="btn btn-ghost" onClick={() => photoInputRef.current?.click()}>▣ Attach a photo of your working</button>
                      : (
                        <div className="photo-attach">
                          <div className="photo-thumb"><img src={photo} alt="Paper working" /><button onClick={() => setPhoto(null)}>✕</button></div>
                          <span className="muted">Saved with this attempt. Type your final answer below so it can be marked.</span>
                        </div>
                      )}
                  </div>
                )}
                {isWorking ? (
                  <textarea
                    ref={inputRef}
                    className="working-input"
                    style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--ink)' }}
                    placeholder={question.inputHint || 'Show every line of your working — each line is marked.\nFinish with the result you were asked to reach.'}
                    value={working} disabled={resolved}
                    onChange={e => setWorking(e.target.value)}
                    rows={6}
                  />
                ) : (
                  <div className="answer-row">
                    {question.answerPrefix && <span className="answer-prefix"><MathText text={question.answerPrefix} /></span>}
                    <input
                      ref={inputRef}
                      className="answer-input"
                      placeholder={question.inputHint || 'Your answer…'}
                      value={answer}
                      disabled={resolved}
                      onChange={e => setAnswer(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                      autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    />
                    {question.answerSuffix && <span className="answer-suffix">{question.answerSuffix}</span>}
                  </div>
                )}
                {typedPreview && !resolved && !isWorking && (
                  <div className="typed-preview">reads as&nbsp; <MathText text={`$${typedPreview}$`} /></div>
                )}
                {question.supportsSteps && !resolved && !isWorking && mode === 'type' && (
                  <div style={{ marginTop: 14 }}>
                    <button className="btn btn-quiet btn-sm" onClick={() => setShowWorking(s => !s)}>
                      {showWorking ? '⌄' : '›'} Show working for partial credit — every line is checked
                    </button>
                    {showWorking && (
                      <textarea
                        className="input" style={{ marginTop: 8 }}
                        placeholder={'One step per line, e.g.\n2x + 3 = 13\n2x = 10\nx = 5'}
                        value={working} onChange={e => setWorking(e.target.value)}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="editor-foot no-print">
                <span className="editor-brand">✒ Pri Ink Engine</span>
                <span style={{ flex: 1 }} />
                {!resolved && (
                  <button className={`btn btn-primary ${canSubmit ? 'btn-glow' : ''}`} onClick={submit} disabled={busy || !canSubmit}>
                    {busy ? 'Marking…' : '➤ Submit Answer'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="ink-row">
              <div className="editor-shell" style={{ flex: 1, minWidth: 0 }}>
                <InkAnswer onRecognized={setInkResult} height={380} lineVerdicts={lineVerdicts} disabled={resolved} />
                <div className="editor-foot no-print">
                  <span className="editor-brand">✒ Pri Ink Engine — on-device recognition</span>
                  <span style={{ flex: 1 }} />
                  {inkResult?.answerLine && (
                    <span className="muted" style={{ marginRight: 10 }}>
                      submitting: <MathText text={`$${safeLatex(isWorking ? inkResult.lines[inkResult.lines.length - 1] : inkResult.answerLine)}$`} />
                    </span>
                  )}
                  {!resolved && (
                    <button className={`btn btn-primary ${canSubmit ? 'btn-glow' : ''}`} onClick={submit} disabled={busy || !canSubmit}>
                      {busy ? 'Marking…' : '➤ Submit Answer'}
                    </button>
                  )}
                </div>
              </div>
              {inkComments && (
                <aside className="ink-comments">
                  <div className="spread">
                    <span className="sc-label" style={{ margin: 0 }}>Comments</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>{inkComments.length} on this page</span>
                  </div>
                  {inkComments.map((c, i) => (
                    <div key={i} className={`ink-comment ${c.kind}`}>
                      <div className="ic-head">{c.kind === 'good' ? 'Correct' : 'Mistake'}<span className="ic-line">line {c.line}</span></div>
                      {c.text}
                    </div>
                  ))}
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {/* scribble pad */}
      {showScribble && !resolved && (
        <div className="editor-shell" style={{ marginTop: 12 }}>
          <div className="editor-toolbar">
            <span className="editor-hint">Scribble pad — rough work, never marked</span>
            <span style={{ flex: 1 }} />
            <button className="editor-tool" onClick={() => scribbleRef.current?.undo()}>↩</button>
            <button className="editor-tool" onClick={() => scribbleRef.current?.clear()}>🗑</button>
          </div>
          <InkCanvas ref={scribbleRef} height={200} guides={false} ariaLabel="Scribble pad" />
        </div>
      )}

      {/* hints shown */}
      {hints.length > 0 && (
        <div className="hints-block">
          <div className="hints-block-title">Hints</div>
          {hints.map((h, i) => (
            <div className="hintbox" key={i}><span className="h-n">Hint {i + 1}</span><MathText text={h} /></div>
          ))}
        </div>
      )}

      {/* retry */}
      {state.phase === 'retry' && (
        <div className="verdict verdict-bad">
          <span className="verdict-ico">{state.res.invalid ? '?' : '✗'}</span>
          <div>
            <b>{state.res.invalid ? 'I couldn’t read that.' : 'Not quite.'}</b>{' '}
            <MathText text={state.res.feedback || 'Have another look and try again — you have one more go.'} />
            {state.res.stepReport && <StepReport report={state.res.stepReport} />}
          </div>
        </div>
      )}

      {/* ── evaluation ── */}
      {resolved && (
        <>
          {answerLines.length > 0 && (
            <div className="your-answer">
              <div className="sc-label">Your answer</div>
              {answerLines.map((l, i) => (
                <div className="ya-line" key={i}><MathText text={`$${safeLatex(l)}$`} /></div>
              ))}
              {photo && <div className="photo-thumb" style={{ marginTop: 8 }}><img src={photo} alt="Attached working" /></div>}
            </div>
          )}

          <div className="eval-card">
            <div className="eval-head">
              <span className="logo-bb">P</span><span className="eval-title">ri Learning. <span style={{ color: 'var(--ink-2)' }}>Evaluation</span></span>
              <span className="eval-marks">
                <b>{verdictGood ? shownMarks : earnedMarks} / {totalMarks}</b> marks <small>({verdictGood ? pct : (selfSaved ? Math.round(100 * earnedMarks / totalMarks) : 0)}%)</small>
              </span>
            </div>
            <div className="eval-disclaimer">Marked on-device by the Pri engine. If your working differs from the sample, check it with your teacher.</div>
            <div className="eval-body">
              <div className="spread">
                <b>{verdictGood ? ['Nailed it.', 'Correct.', 'Beautiful work.', 'That’s it.'][question.id.charCodeAt(0) % 4] : res.revealed ? 'Solution revealed.' : 'Not this time.'}</b>
                <span>
                  {res.xp > 0 && <span className="xp-pop">+{res.xp} XP</span>}
                  {hintsUsed > 0 && <span className="muted" style={{ marginLeft: 8 }}>after {hintsUsed} hint{hintsUsed > 1 ? 's' : ''}</span>}
                </span>
              </div>
              {res.feedback && !verdictGood && <div style={{ marginTop: 6 }}><b>Reasoning:</b> <MathText text={res.feedback} /></div>}
              {verdictGood && writeMode && inkResult?.lines?.length > 1 && (
                <div style={{ marginTop: 6 }}><b>Reasoning:</b> Every line of your handwritten working was checked — {inkResult.lines.length} steps read and verified, reaching the required result through a logical chain.</div>
              )}
              {!verdictGood && res.solution && (
                <div style={{ marginTop: 4 }}>Expected: <b><MathText text={res.solution.answerText} /></b></div>
              )}
              {res.stepReport && <StepReport report={res.stepReport} />}
              <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                <span className="tag">Mastery {res.mastery}%</span>
                <span className="tag" style={{ color: res.ratingDelta >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                  {res.ratingDelta >= 0 ? '▲' : '▼'} {Math.abs(res.ratingDelta)} skill
                </span>
                {res.predicted && <span className="tag">Predicted mark {res.predicted.mark}</span>}
              </div>
            </div>

            {res.solution?.steps && (
              <div className="solution-block">
                <div className="sc-label" style={{ margin: '12px 0' }}>Worked solution</div>
                <div className="steps">
                  {res.solution.steps.map((s, i) => (
                    <div className="step" key={i}>
                      <span className="step-n">{i + 1}</span>
                      <div>
                        <div className="step-h"><MathText text={s.h} /></div>
                        <div className="step-d"><MathText text={s.d} /></div>
                      </div>
                    </div>
                  ))}
                </div>
                {res.solution.answerText && (
                  <div className="final-answer">
                    <div className="sc-label" style={{ marginBottom: 8 }}>Final answer</div>
                    <MathText text={res.solution.answerText} />
                  </div>
                )}
              </div>
            )}
          </div>

          {res.solution?.criteria && (
            <CriteriaTable
              criteria={res.solution.criteria}
              correct={verdictGood}
              selfMarks={selfMarks} setSelfMarks={setSelfMarks}
              selfSaved={selfSaved} setSelfSaved={setSelfSaved}
            />
          )}
        </>
      )}

      {/* actions */}
      {!resolved && (
        <div className="row no-print" style={{ marginTop: 18, flexWrap: 'wrap' }}>
          {isMcq && (
            <button className={`btn btn-primary ${canSubmit ? 'btn-glow' : ''}`} onClick={submit} disabled={busy || !canSubmit}>
              {busy ? 'Marking…' : '➤ Submit Answer'}
            </button>
          )}
          <button className="btn btn-quiet" onClick={reveal} disabled={busy}>Show solution</button>
          {!writeMode && !isMcq && <span className="muted" style={{ marginLeft: 'auto' }}>press <span className="kbd">Enter</span> to submit</span>}
        </div>
      )}
    </div>
  );
}

function CriteriaTable({ criteria, correct, selfMarks, setSelfMarks, selfSaved, setSelfSaved }) {
  const marked = i => correct || !!selfMarks[i];
  const missed = i => selfSaved && !marked(i);
  const earned = i => (correct || selfSaved) && marked(i);
  return (
    <div>
      <table className="criteria-table">
        <thead>
          <tr><th style={{ width: '100%', textAlign: 'center' }}>Criteria</th><th>Marks</th></tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr key={i} className={missed(i) ? 'criteria-row-missed' : earned(i) ? 'criteria-row-earned' : ''}>
              <td>
                {!correct && !selfSaved ? (
                  <label className="selfmark-row" style={{ padding: 0 }}>
                    <input type="checkbox" checked={!!selfMarks[i]}
                      onChange={e => setSelfMarks(m => ({ ...m, [i]: e.target.checked }))} />
                    <span><MathText text={c.text} /></span>
                  </label>
                ) : (
                  <span><span className="crit-bullet">{missed(i) ? '→' : earned(i) ? '✓' : '•'}</span><MathText text={c.text} /></span>
                )}
              </td>
              <td className="cm">1</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!correct && (
        <div className="row" style={{ marginTop: 10 }}>
          {!selfSaved
            ? <>
              <span className="muted">Tick the criteria your working earned, then save.</span>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelfSaved(true)}>Save self-marking</button>
            </>
            : <span className="tag" style={{ color: 'var(--good)' }}>✓ self-marking recorded — {Object.values(selfMarks).filter(Boolean).length}/{criteria.length} marks</span>}
        </div>
      )}
    </div>
  );
}

function StepReport({ report }) {
  if (!report?.lines?.length) return null;
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 3 }}>
      <div className="muted" style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Step check on your working</div>
      {report.lines.map((l, i) => (
        <div key={i} className={`stepcheck-line sc-${l.status}`}>
          <span>{l.status === 'ok' ? '✓' : l.status === 'break' ? '✗' : '·'}</span>
          <span>{l.text}</span>
          {l.status === 'break' && <b style={{ fontFamily: 'var(--font)', fontSize: 12.5, whiteSpace: 'nowrap' }}>← the mistake is here</b>}
          {l.note && <span style={{ fontFamily: 'var(--font)', fontWeight: 400, fontSize: 12.5 }}> — {l.note}</span>}
        </div>
      ))}
    </div>
  );
}

function attachPhoto(e, setPhoto) {
  const f = e.target.files?.[0];
  if (!f) return;
  const img = new Image();
  const url = URL.createObjectURL(f);
  img.onload = () => {
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    setPhoto(cv.toDataURL('image/jpeg', 0.82));
    URL.revokeObjectURL(url);
  };
  img.src = url;
  e.target.value = '';
}

function safeLatex(s) {
  try { return exprToLatex(String(s)); } catch { return String(s).replace(/\\/g, ''); }
}

function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
