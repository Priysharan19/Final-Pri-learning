// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · sitting an exam paper (or one question of it) in the app
//
// The competitor's shape, kept honest: a stem (with its diagram), parts (a),
// (b), (c) each with its marks and its own ruled writing area, one "Submit
// all", then per-part feedback. The server decides what is marked
// (server/platform/paperAttempts.js): multiple choice and final answers by the
// deterministic engine; proofs, explanations and sketches are checked by the
// student against the sample answer and claim NO mark. The totals line says so.
//
//   · autosave: every answer is saved a moment after it changes, so a sitting
//     can be left and resumed (here or on another device);
//   · the optional clock: the paper's own reading and working times, which the
//     student can switch off; it never limits anything;
//   · Submit all names the parts still empty and asks once;
//   · after Submit: per part the verdict, the sample answer on demand and
//     "How this is marked" (the guideline text; its marks only for a scheme the
//     owner has approved).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import PageLink from '../components/PageLink.jsx';
import Working from '../instrument/Working.jsx';
import Blocks from './PaperBlocks.jsx';
import PaperAnswer, { PaperChoice } from './PaperAnswer.jsx';
import PaperTimer from './PaperTimer.jsx';
import { answerToTex } from '../engine/answerTex.js';
import { failureKey, loadSitting, loadSolution, saveAnswers, submitSitting } from './paperApi.js';
import './paper.css';

const AUTOSAVE_MS = 1500;
const SAVE_KEY = Object.freeze({ saved: 'paper.save.saved', saving: 'paper.save.saving', pending: 'paper.save.pending', failed: 'paper.save.failed' });

/** Every answerable part of the paper as issued, in order, with the question it belongs to. */
export function leavesOf(paper) {
  const out = [];
  const walk = (parts, question, section, trail) => parts.forEach(p => {
    if (p.parts) walk(p.parts, question, section, [...trail, p.label]);
    else out.push({ part: p, question, section, label: [...trail, p.label].filter(Boolean).join('') });
  });
  for (const s of paper.sections) for (const q of s.questions) walk(q.parts, q, s, []);
  return out;
}

const answered = a => !!a && ((a.text || '').trim() !== '' || (a.working || '').trim() !== '');
const marksWord = (t, n) => t(n === 1 ? 'paper.mark.one' : 'paper.mark.other', { n });

// ── The sample answer and how it is marked, fetched when asked for ────────────

function Solution({ attemptId, part, solutions, ask }) {
  const t = useT();
  const s = solutions[part.id];
  if (!s) return <button type="button" className="btn btn-ghost btn-sm" onClick={() => ask(part.id)} data-paper-show-sample={part.id}>{t('paper.res.showSample')}</button>;
  if (s === 'loading') return <p className="muted" role="status">{t('paper.res.loadingSample')}</p>;
  if (s === 'failed') return <p className="muted" role="status">{t('paper.res.sampleFailed')}</p>;
  return (
    <div className="pp-solution" data-paper-solution={part.id}>
      {s.finalAnswer && <p className="pp-final-answer">{s.finalAnswer.letter ? t('paper.res.correctOption', { letter: s.finalAnswer.letter }) : <>{t('paper.res.finalAnswer')} <MathText text={`$${s.finalAnswer.tex || ''}$`} /></>}</p>}
      <h4 className="pp-h4">{t('paper.res.sample')}</h4>
      <div className="pp-sample"><Blocks blocks={s.sampleAnswer} attemptId={attemptId} /></div>
      {s.note && <><h4 className="pp-h4">{t('paper.res.note')}</h4><Blocks blocks={s.note} attemptId={attemptId} /></>}
      {s.commonErrors && <><h4 className="pp-h4">{t('paper.res.commonErrors')}</h4><Blocks blocks={s.commonErrors} attemptId={attemptId} /></>}
    </div>
  );
}

function HowMarked({ part, solutions, ask }) {
  const t = useT();
  const s = solutions[part.id];
  const [open, setOpen] = useState(false);
  return (
    <details className="pp-how" open={open} onToggle={e => { setOpen(e.currentTarget.open); if (e.currentTarget.open) ask(part.id); }} data-paper-how={part.id}>
      <summary>{t('paper.res.howMarked')}</summary>
      {s && typeof s === 'object'
        ? <ul className="pp-criteria">{s.howMarked.map((c, i) => <li key={i}>{c.marks != null && <strong className="pp-crit-marks">{marksWord(t, c.marks)}</strong>}<Blocks blocks={c.text} inline /></li>)}</ul>
        : <p className="muted" role="status">{s === 'failed' ? t('paper.res.sampleFailed') : t('paper.res.loadingSample')}</p>}
    </details>
  );
}

// ── The verdict on one part ───────────────────────────────────────────────────

function Verdict({ part, row, answer }) {
  const t = useT();
  if (!row) return null;
  const key = row.verdict === 'correct' ? (part.answerType === 'mcq' ? 'paper.res.optionRight' : 'paper.res.finalRight')
    : row.verdict === 'incorrect' ? (part.answerType === 'mcq' ? 'paper.res.optionWrong' : 'paper.res.finalWrong')
      : row.verdict === 'unanswered' ? 'paper.res.empty' : row.verdict === 'unreadable' ? 'paper.res.unreadable' : 'paper.res.self';
  return (
    <div className="pp-verdict" data-paper-verdict={row.verdict}>
      <p className="pp-verdict-line"><strong>{t(key)}</strong>
        {row.checks === 'pri' && <span className="pp-verdict-marks"> {t('paper.res.byPri', { awarded: row.awarded, available: row.autoMarks })}</span>}
      </p>
      {row.checks === 'pri' && part.marks > row.autoMarks && <p className="muted">{t('paper.res.restSelf', { n: part.marks - row.autoMarks })}</p>}
      {row.checks === 'self' && <p className="muted">{t('paper.res.selfMarks', { n: part.marks })}</p>}
      {row.feedback && row.verdict !== 'correct' && <p className="muted">{row.feedback}</p>}
      {answer?.text && part.answerType !== 'mcq' && (
        <p className="pp-yours"><span className="muted">{t('paper.res.yours')} </span>{answer.mode === 'typed' && part.checks === 'pri' ? <MathText text={answerToTex(answer.text)} /> : <span className="pp-yours-text">{answer.text}</span>}</p>
      )}
      {answer?.text && part.answerType === 'mcq' && <p className="pp-yours"><span className="muted">{t('paper.res.yours')} </span>{answer.text}</p>}
    </div>
  );
}

// ── The page ──────────────────────────────────────────────────────────────────

export default function PaperSitting() {
  const { attemptId } = useParams();
  const t = useT();
  const nav = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [save, setSave] = useState('saved');
  const [timerOn, setTimerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [solutions, setSolutions] = useState({});
  const dirty = useRef(new Set());
  const answersRef = useRef({});
  const elapsedRef = useRef(0);
  const timerRef = useRef(null);
  const keepers = useRef({});
  const saving = useRef(Promise.resolve());

  // load / resume
  useEffect(() => {
    let live = true;
    loadSitting(attemptId).then(r => {
      if (!live) return;
      const a = r.attempt;
      setAttempt(a);
      setAnswers(a.answers || {});
      answersRef.current = a.answers || {};
      setTimerOn(a.timer.mode !== 'off');
      setElapsed(a.ms || 0);
      elapsedRef.current = a.ms || 0;
    }).catch(e => { if (live) setLoadError(failureKey(e)); });
    return () => { live = false; };
  }, [attemptId]);

  const submitted = attempt?.state === 'submitted';
  const leaves = useMemo(() => (attempt ? leavesOf(attempt.paper) : []), [attempt]);

  // the clock: active time in this sitting, carried over a resume
  useEffect(() => {
    if (!attempt || submitted) return undefined;
    const tick = setInterval(() => { if (document.visibilityState === 'visible') { elapsedRef.current += 1000; setElapsed(elapsedRef.current); } }, 1000);
    return () => clearInterval(tick);
  }, [attempt, submitted]);

  const flush = useCallback(() => {
    saving.current = saving.current.then(async () => {
      const ids = [...dirty.current];
      if (!ids.length && timerRef.current === null) return;
      const payload = {};
      for (const id of ids) {
        const a = answersRef.current[id];
        payload[id] = { mode: a?.mode || 'typed', text: a?.text || '', ...(a?.working ? { working: a.working } : {}) };
      }
      dirty.current = new Set();
      setSave('saving');
      try {
        await saveAnswers(attemptId, { answers: payload, ms: Math.round(elapsedRef.current), ...(timerRef.current ? { timer: timerRef.current } : {}) });
        timerRef.current = null;
        setSave(dirty.current.size ? 'pending' : 'saved');
      } catch (e) {
        for (const id of ids) dirty.current.add(id);
        setSave(e?.code === 'PAPER_ATTEMPT_SUBMITTED' ? 'saved' : 'failed');
      }
    });
    return saving.current;
  }, [attemptId]);

  // debounce: a save a moment after the last change
  const saveTimer = useRef(null);
  const touch = useCallback(() => {
    setSave('pending');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { flush(); }, AUTOSAVE_MS);
  }, [flush]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  // also when the page is left or hidden, and on a slow beat so the elapsed time is not lost
  useEffect(() => {
    if (!attempt || submitted) return undefined;
    const hide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', hide);
    const beat = setInterval(() => { timerRef.current = timerRef.current ?? (timerOn ? 'paper' : 'off'); flush(); }, 30_000);
    return () => { document.removeEventListener('visibilitychange', hide); clearInterval(beat); };
  }, [attempt, submitted, flush, timerOn]);

  const change = useCallback((partId, next) => {
    // a kept flag is the server's word, set only by the Keep call; an edit clears it
    const prior = answersRef.current[partId];
    const merged = { ...next, kept: next.kept === true ? true : false };
    if (!merged.text && !merged.working) { const copy = { ...answersRef.current }; delete copy[partId]; answersRef.current = copy; }
    else answersRef.current = { ...answersRef.current, [partId]: merged };
    setAnswers(answersRef.current);
    const textChanged = !prior || prior.text !== merged.text || prior.working !== merged.working || prior.mode !== merged.mode;
    if (textChanged) { dirty.current.add(partId); touch(); }
  }, [touch]);

  const register = useCallback((partId, fn) => { if (fn) keepers.current[partId] = fn; else delete keepers.current[partId]; }, []);

  const toggleTimer = on => { setTimerOn(on); timerRef.current = on ? 'paper' : 'off'; touch(); };

  // Submit all
  const empty = useMemo(() => leaves.filter(l => !answered(answers[l.part.id])), [leaves, answers]);
  async function doSubmit() {
    setSubmitting(true); setSubmitError(null); setConfirming(false);
    try {
      // handwritten parts still waiting are kept first
      for (const l of leaves) {
        const a = answersRef.current[l.part.id];
        if (a && a.mode !== 'typed' && !a.kept && keepers.current[l.part.id]) {
          const ok = await keepers.current[l.part.id]();
          if (!ok) { setSubmitError({ key: 'paper.err.keep', part: l.label }); setSubmitting(false); return; }
        }
      }
      clearTimeout(saveTimer.current);
      timerRef.current = timerOn ? 'paper' : 'off';
      for (const l of leaves) if (answersRef.current[l.part.id] && !answersRef.current[l.part.id].kept) dirty.current.add(l.part.id);
      await flush();
      const r = await submitSitting(attemptId, { submissionId: `sit-${attemptId.slice(0, 8)}-${Date.now().toString(36)}`, ms: Math.round(elapsedRef.current) });
      setAttempt(r.attempt);
      setSolutions({});
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setSubmitError({ key: failureKey(e), parts: e?.parts });
    } finally { setSubmitting(false); }
  }

  const ask = useCallback(partId => {
    setSolutions(prev => {
      if (prev[partId]) return prev;
      loadSolution(attemptId, partId)
        .then(s => setSolutions(p => ({ ...p, [partId]: s })))
        .catch(() => setSolutions(p => ({ ...p, [partId]: 'failed' })));
      return { ...prev, [partId]: 'loading' };
    });
  }, [attemptId]);

  if (loadError) return <div className="card pp-page"><p role="alert">{t(loadError)}</p><PageLink to="/exams">{t('paper.back')}</PageLink></div>;
  if (!attempt) return <p className="muted pp-page" role="status"><Working pending size={24} /><span>{t('paper.loading')}</span></p>;

  const { paper } = attempt;
  const result = attempt.result;
  const single = !!attempt.scope;
  // a single question is timed by its share of the paper's working time
  const stated = attempt.timer;
  const readingMs = single ? 0 : stated.readingMs;
  const workingMs = single ? Math.round((stated.workingMs * paper.totalMarks) / 70) : stated.workingMs;
  const doneCount = leaves.length - empty.length;
  const totals = result?.totals;

  return (
    <div className="pp-page" data-paper-sitting={attempt.paperId} data-paper-state={attempt.state}>
      <header className="pp-head">
        <p className="pp-back"><PageLink to="/exams">{t('paper.back')}</PageLink></p>
        <h1 className="pp-title">{single ? t('paper.titleQuestion', { paper: paper.title, n: paper.sections[0].questions[0].number }) : paper.title}</h1>
        <p className="muted">{t('paper.meta', { marks: paper.totalMarks, time: paper.workingTime })}</p>
        {!submitted && <PaperTimer on={timerOn} onToggle={toggleTimer} elapsedMs={elapsed} readingMs={readingMs} workingMs={workingMs} />}
        {!submitted && <p className="muted pp-howto">{t(single ? 'paper.howtoQuestion' : 'paper.howto')}</p>}
      </header>

      {submitted && (
        <section className="pp-summary" aria-labelledby="pp-result-h" data-paper-result>
          <h2 id="pp-result-h" className="pp-h2">{t('paper.res.title')}</h2>
          <p className="pp-totals" data-paper-totals>{t('paper.totals', { count: totals.autoAvailable, awarded: totals.autoAwarded, available: totals.autoAvailable, selfChecked: totals.selfChecked })}</p>
          <p className="muted">{t('paper.res.totalsNote', { total: totals.total })}</p>
          {totals.emptyParts > 0 && <p className="muted">{t('paper.res.emptyParts', { n: totals.emptyParts })}</p>}
        </section>
      )}

      {paper.sections.map(section => (
        <section key={section.id} className="pp-section" aria-labelledby={`pp-s-${section.id}`}>
          <h2 id={`pp-s-${section.id}`} className="pp-h2">{section.title}</h2>
          {section.instructions && <p className="muted">{section.instructions}</p>}
          {section.questions.map(q => (
            <article key={q.id} className="pp-question" aria-labelledby={`pp-q-${q.id}`} data-paper-question={q.number}>
              <h3 id={`pp-q-${q.id}`} className="pp-h3">{t('paper.question', { n: q.number })}<span className="pp-marks"> {marksWord(t, q.marks)}</span></h3>
              {q.stem.length > 0 && <div className="pp-stem"><Blocks blocks={q.stem} attemptId={attemptId} /></div>}
              <Parts parts={q.parts} depth={0} attemptId={attemptId} answers={answers} change={change} register={register} disabled={submitted || submitting}
                result={result} solutions={solutions} ask={ask} />
            </article>
          ))}
        </section>
      ))}

      {!submitted && (
        <div className="pp-bar" role="region" aria-label={t('paper.bar.label')}>
          <p className="pp-bar-status" role="status" aria-live="polite" data-paper-save={save}>
            {t('paper.bar.progress', { done: doneCount, total: leaves.length })} · {t(SAVE_KEY[save])}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => (empty.length ? setConfirming(true) : doSubmit())} disabled={submitting} data-paper-submit>
            {submitting ? t('paper.submitting') : t('paper.submit')}
          </button>
        </div>
      )}

      {confirming && (
        <div className="pp-confirm" role="alertdialog" aria-modal="false" aria-labelledby="pp-confirm-h" data-paper-confirm-empty>
          <h2 id="pp-confirm-h" className="pp-h3">{t('paper.confirm.title', { n: empty.length })}</h2>
          <p className="muted pp-empty-list">{empty.slice(0, 40).map(l => `Q${l.question.number}${l.label}`).join(', ')}{empty.length > 40 ? '…' : ''}</p>
          <div className="pp-confirm-row">
            <button type="button" className="btn btn-primary" onClick={doSubmit} data-paper-confirm-submit>{t('paper.confirm.submit')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>{t('paper.confirm.keepWorking')}</button>
          </div>
        </div>
      )}
      {submitError && <p className="pp-error" role="alert" data-paper-error>{t(submitError.key)}{submitError.part ? ` (${submitError.part})` : ''}</p>}
      {submitted && <p className="pp-after"><button type="button" className="btn btn-ghost" onClick={() => nav('/exams')}>{t('paper.back')}</button></p>}
    </div>
  );
}

function Parts({ parts, depth, attemptId, answers, change, register, disabled, result, solutions, ask }) {
  const t = useT();
  return (
    <div className={`pp-parts depth-${depth}`}>
      {parts.map(part => (
        <div key={part.id} className="pp-part" data-paper-part={part.id}>
          {part.label && <span className="pp-label" aria-hidden="true">{part.label}</span>}
          <div className="pp-part-body">
            <div className="pp-part-head">
              {part.label && <span className="sr-only">{t('paper.partLabel', { label: part.id.replace(/^q/, '') })}</span>}
              {part.prompt?.length > 0 && <div className="pp-prompt"><Blocks blocks={part.prompt} attemptId={attemptId} /></div>}
              {part.marks != null && <span className="pp-marks pp-part-marks">{marksWord(t, part.marks)}</span>}
            </div>
            {part.parts
              ? <Parts parts={part.parts} depth={depth + 1} attemptId={attemptId} answers={answers} change={change} register={register} disabled={disabled} result={result} solutions={solutions} ask={ask} />
              : (
                <>
                  {!result && part.checks && part.answerType !== 'mcq' && <p className="muted pp-checks" data-paper-checks={part.checks}>{t(part.checks === 'pri' ? 'paper.checks.pri' : 'paper.checks.self', { n: part.autoMarks, marks: part.marks })}</p>}
                  {part.answerType === 'mcq'
                    ? <PaperChoice part={part} attemptId={attemptId} value={answers[part.id]} onChange={next => change(part.id, next)} disabled={disabled} />
                    : !result && <PaperAnswer part={part} attemptId={attemptId} value={answers[part.id]} onChange={change} disabled={disabled} register={register} />}
                  {result && (
                    <>
                      <Verdict part={part} row={result.parts[part.id]} answer={answers[part.id]} />
                      <div className="pp-after-row">
                        <Solution attemptId={attemptId} part={part} solutions={solutions} ask={ask} />
                        <HowMarked part={part} solutions={solutions} ask={ask} />
                      </div>
                    </>
                  )}
                </>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}
