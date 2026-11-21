// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Prithagoras first screen for a visitor (ADR-0003)
//
// The same trial as GuestTry.jsx, to the same server routes and limits, laid
// out as a question on a page rather than a form: a visitor whose day's
// questions are untouched arrives on a question the server has already drawn
// (Year 12 Mathematics Advanced unless this device remembers another choice),
// with the answer field ready. The choices live in a quiet margin and open only
// when asked for. A visitor who has already used some of today's questions
// arrives on the chooser instead, so a reload never spends a second one.
//
// Nothing here marks, holds a key or stores an answer: the question is the
// server's public fields and a sealed ticket, the verdict is the server's. What
// is typed is shown back typeset (notation only, never evaluated). Written
// answers stay behind sign-in, exactly as in GuestTry.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { MathText } from '../lib/latex.jsx';
import { answerToTex } from '../engine/answerTex.js';
import { PATHWAYS } from '../engine/curriculum.js';
import { Wordmark } from '../components/BrandMark.jsx';
import PageLink from '../components/PageLink.jsx';
import { EDITION } from '../platform/edition.js';
import { rememberedChoice, rememberChoice } from './QuestionPicker.jsx';
import { coursesFor, chaptersFor, guestYears, guestTarget, settleChoice, PICKER_FORMS } from './guestMenu.js';
import { startGuest, askGuest, answerGuest } from './guestTrial.js';
import { useWorked, WorkedSteps, WorkedControls, hasMore } from './WorkedHelp.jsx';
import './guest.css';

const DEFAULT_LIMIT = 5;
const DEFAULT_YEAR = 12;
const FORM_KEY = { typed: 'picker.typeTyped', choice: 'picker.typeChoice', written: 'picker.typeWritten' };
const SIGNUP_KEY = { limit: 'guest.signupLimit', address: 'guest.signupAddress', written: 'guest.signupWritten', account: 'guest.signupWritten', busy: 'guest.signupBusy' };
const ERROR_KEY = { none: 'guest.noQuestion', expired: 'guest.expired', fast: 'guest.tooFast', 'marking-busy': 'guest.busy', offline: 'guest.offline' };

/** The examiner's two marks, drawn here (no icon set). Decorative: the words beside them say the same. */
function Mark({ right }) {
  return (
    <svg className={`gp-mark ${right ? 'is-right' : 'is-wrong'}`} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      {right ? <path d="M4 12.5l5 5L20 6.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
    </svg>
  );
}

/** Today's questions as squares: right first time, right after a hint or a worked step, not yet right, used (before this page opened, or left unanswered), open now, or still to come. */
function Tally({ limit, used, log, t }) {
  const before = used - log.length;                    // questions used that this page did not see
  const cells = Array.from({ length: limit }, (_, i) => {
    if (i >= used) return 'left';
    const mine = log[i - before];
    return mine === 'open' ? 'now' : ['right', 'assisted', 'wrong'].includes(mine) ? mine : 'used';
  });
  const count = k => cells.filter(c => c === k).length;
  const [first, after, notYet] = [count('right'), count('assisted'), count('wrong')];
  return (
    <div className="gp-tally" data-guest-left>
      <span className="gp-squares" aria-hidden="true">{cells.map((c, i) => <i key={i} className={`is-${c}`} />)}</span>
      <p className="gp-left">{t('guest.leftToday', { n: limit - used, count: limit - used })}</p>
      {(first + after + notYet) > 0 && (
        <ul className="gp-tally-sum" data-guest-tally aria-label={t('guest.tallyLabel')}>
          {first > 0 && <li data-tally="right">{t('guest.tallyFirst', { n: first })}</li>}
          {after > 0 && <li data-tally="assisted">{t('guest.tallyAfter', { n: after })}</li>}
          {notYet > 0 && <li data-tally="wrong">{t('guest.tallyNot', { n: notYet })}</li>}
        </ul>
      )}
    </div>
  );
}

/** One row of the chooser: a legend and its options as radios (arrow keys move within a row, Tab between rows). */
function Choices({ legend, name, options, value, onChange, attr }) {
  return (
    <fieldset className="gp-row" disabled={!options.length}>
      <legend>{legend}</legend>
      <div className="gp-opts">
        {options.map(o => (
          <label key={o.value} className="gp-opt">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} {...{ [attr]: o.value }} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// A short lead such as "k =" or "dy/dx =" is mathematics, so it is set in the maths face; a unit stays as written.
const affixTex = text => {
  const lead = String(text).trim();
  return !lead.includes('$') && /^[A-Za-z0-9'()/ ]{1,12}=$/.test(lead) ? `$${lead.slice(0, -1).trim()} =$` : String(text);
};
const numberTex = text => (/^[-−]?\d+(?:\.\d+)?$/.test(text) ? `$${text.replace('−', '-')}$` : answerToTex(text));

/** The server's answer, with a unit or a leading "x =" the question carries kept out of the typeset part. */
function ServerAnswer({ text, q }) {
  let body = String(text ?? '').trim();
  const prefix = q?.answerPrefix && body.startsWith(q.answerPrefix) ? q.answerPrefix : '';
  if (prefix) body = body.slice(prefix.length).trim();
  const suffix = q?.answerSuffix && body.endsWith(q.answerSuffix) ? q.answerSuffix : '';
  if (suffix) body = body.slice(0, -suffix.length).trim();
  return (
    <span lang="en">
      {prefix && <><MathText text={affixTex(prefix)} />{' '}</>}
      <MathText text={numberTex(body)} />
      {suffix && <>{' '}<MathText text={suffix} /></>}
    </span>
  );
}

export default function GuestPage() {
  const t = useT();
  const nav = useNavigate();
  const [choice, setChoice] = useState(() => settleChoice(EDITION, rememberedChoice(EDITION), { defaultYear: DEFAULT_YEAR }));
  const [stage, setStage] = useState('opening'); // opening | choose | question | worked (a wrong first answer, one try left) | verdict | signup
  const [choosing, setChoosing] = useState(false);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [remaining, setRemaining] = useState(null);
  const [asked, setAsked] = useState(null);
  const [item, setItem] = useState(null);
  const [answer, setAnswer] = useState('');
  const [option, setOption] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [log, setLog] = useState([]);              // every question this page was issued: open | right | assisted | wrong | skipped
  const [retrying, setRetrying] = useState(false);   // the one retry, after a worked step, is being typed
  const [firstAnswer, setFirstAnswer] = useState(''); // the wrong first answer, kept on the page
  const [firstOption, setFirstOption] = useState(null);
  const { worked, asking, trouble, open: openWorked, close: closeWorked, more: moreWorked, clear: clearWorked } = useWorked();
  const [problem, setProblem] = useState(null);
  const [hint, setHint] = useState(false);
  const [why, setWhy] = useState('limit');
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState(false);   // the question on the page is the one drawn on arrival (it draws in once)
  const headRef = useRef(null);
  const answerRef = useRef(null);
  const flying = useRef(false);                   // one question request at a time per page (a second tab is the server's to count)
  const arrivalSent = useRef(false);
  const land = useRef(null);                      // where focus goes once the next view is drawn

  const courses = useMemo(() => coursesFor(EDITION, choice.year), [choice.year]);
  const chapters = useMemo(() => (choice.course ? chaptersFor(EDITION, choice.year, choice.course) : []), [choice.year, choice.course]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const c of chapters) { if (!map.has(c.strand)) map.set(c.strand, []); map.get(c.strand).push(c); }
    return [...map.entries()];
  }, [chapters]);
  const levels = chapters.find(c => c.id === choice.chapter)?.levels || [];
  const change = patch => setChoice(prev => settleChoice(EDITION, { ...prev, ...patch }, { defaultYear: DEFAULT_YEAR }));

  useEffect(() => { rememberChoice(EDITION, choice); }, [choice]);
  useEffect(() => { document.title = `${t('guest.title')} · ${document.title.split(' · ').pop()}`; }, [t]);

  const cameFrom = useRef('choose');               // the view the sign-up prompt was reached from, so "written" has a way back
  const prompt = reason => { setWhy(reason); setChoosing(false); land.current = 'head'; setStage(s => { if (s !== 'signup') cameFrom.current = s === 'opening' ? 'choose' : s; return 'signup'; }); };
  const leavePrompt = () => { land.current = 'head'; setChoosing(true); setStage(cameFrom.current); };

  const start = useCallback(async (picked, { arrival = false, like = null } = {}) => {
    setProblem(null);
    if (picked.form === 'written') return prompt('written');
    if (flying.current) return;
    flying.current = true;
    setBusy(true);
    try {
      const target = guestTarget(EDITION, picked);
      if (!target) throw Object.assign(new Error('not offered'), { reason: 'none' });
      const out = await askGuest({ generator: target.generator, difficulty: target.difficulty, curriculum: 'nsw', form: picked.form, like });
      setAsked(picked); setItem(out); setRemaining(out.remaining); if (out.limit) setLimit(out.limit);
      setLog(l => [...l.map(m => (m === 'open' ? 'skipped' : m)), 'open']);
      setAnswer(''); setOption(null); setVerdict(null); setHint(false); setChoosing(false);
      clearWorked(); setRetrying(false); setFirstAnswer(''); setFirstOption(null);
      // A fine pointer means a keyboard is at hand: the visitor can type at once. A phone keeps its keyboard down until asked.
      const typed = out.question?.answerType !== 'mcq';
      // On arrival the heading takes focus so a screen reader says "Question n of 5" first; later questions go to the answer.
      land.current = arrival ? 'head' : (typed ? 'answer' : 'head');
      setArrived(arrival);
      setStage('question');
    } catch (error) {
      const r = error.reason || 'offline';
      // On arrival a refusal is never the first thing said: the chooser is, and it will say so when asked.
      if (!arrival && ['limit', 'address', 'busy', 'account'].includes(r)) prompt(r);
      else { if (!arrival || r === 'none') setProblem(ERROR_KEY[r] || 'guest.offline'); setStage(s => (s === 'opening' ? 'choose' : s)); if (!arrival) setChoosing(true); }
    } finally { flying.current = false; setBusy(false); }
  }, [clearWorked]);

  // Arrival. Untouched day and a page someone is looking at: draw the first question now. Otherwise the chooser.
  useEffect(() => {
    let live = true;
    startGuest().then(s => {
      if (!live) return;
      setRemaining(s.remaining); if (s.limit) setLimit(s.limit);
      if (s.remaining === 0) { setWhy('limit'); setStage('signup'); }
      else if (s.remaining === s.limit && choice.form !== 'written' && document.visibilityState === 'visible' && !arrivalSent.current) { arrivalSent.current = true; start(choice, { arrival: true }); }
      else setStage('choose');
    }).catch(() => { if (live) setStage('choose'); });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const where = land.current; land.current = null;
    if (where === 'answer') answerRef.current?.focus({ preventScroll: true });
    else if (where === 'option') document.querySelector('[data-gp-option]:not(:disabled)')?.focus({ preventScroll: true });
    else if (where === 'head') headRef.current?.focus({ preventScroll: false });
  }, [stage, item, choosing, retrying]);

  const q = item?.question;
  const mcq = q?.answerType === 'mcq';
  const given = mcq ? (option === null ? '' : String(option)) : answer.trim();
  const marked = stage === 'verdict';
  const editable = stage === 'question' || (stage === 'worked' && retrying);
  const settled = marked || (stage === 'worked' && !retrying);   // the answer on the page has its mark

  const check = async e => {
    e?.preventDefault();
    if (!given || busy || !editable) return;
    setBusy(true); setProblem(null);
    try {
      const out = await answerGuest({ sealed: item.sealed, answer: given });
      if (out.invalid) setProblem('guest.unreadable');
      else if (out.resolved === false && out.retry) {
        // A first wrong answer on a question with worked steps: the first step, the answer kept, one more try.
        openWorked(out); setVerdict(null); setFirstAnswer(given); setFirstOption(mcq ? option : null); setRetrying(false);
        setLog(l => [...l.slice(0, -1), 'wrong']);
        if (typeof out.remaining === 'number') setRemaining(out.remaining);
        setStage('worked');
      } else {
        const assisted = out.correct === true && (out.assisted === true || hint);
        if (stage === 'worked') closeWorked(out);
        setVerdict({ ...out, assisted, byStep: out.assisted === true });
        setLog(l => [...l.slice(0, -1), out.correct ? (assisted ? 'assisted' : 'right') : 'wrong']);
        if (typeof out.remaining === 'number') setRemaining(out.remaining);
        setRetrying(false); setStage('verdict');
      }
    } catch (error) {
      setProblem(ERROR_KEY[error.reason] || 'guest.offline');
      if (error.reason === 'expired') { setItem(null); setLog(l => l.map(m => (m === 'open' ? 'skipped' : m))); clearWorked(); setStage('choose'); }
    } finally { setBusy(false); }
  };

  const startRetry = () => {
    setRetrying(true); setProblem(null); setAnswer(''); setOption(null);
    land.current = mcq ? 'option' : 'answer';
  };
  // The next step, or the answer as the step after the last: that closes the question (no retry after it).
  const showMore = async () => {
    const out = await moreWorked(item.sealed);
    if (out && out.answer != null && stage === 'worked') {
      setVerdict({ resolved: true, correct: false, answer: out.answer, assisted: false, moreForms: worked?.moreForms === true });
      if (typeof out.remaining === 'number') setRemaining(out.remaining);
      setRetrying(false); land.current = 'head'; setStage('verdict');
    }
  };

  const next = () => (remaining === 0 ? prompt('limit') : start(asked));
  const likeIt = () => (remaining === 0 ? prompt('limit') : start(asked, { like: item?.sealed }));
  const openChooser = () => { land.current = 'head'; setProblem(null); setChoosing(true); };
  const closeChooser = () => { land.current = !editable ? 'head' : (mcq ? 'head' : 'answer'); setProblem(null); setChoosing(false); };

  const left = remaining ?? limit;
  const used = limit - left;
  const showChooser = stage === 'choose' || (choosing && (stage === 'question' || stage === 'worked' || stage === 'verdict'));
  const open = Boolean(q) && (stage === 'question' || stage === 'worked');
  // The question on the page is the newest one used; the chooser is choosing the one after it.
  const number = q && !showChooser ? Math.max(1, used) : Math.min(limit, used + 1);
  const shown = (stage === 'question' || stage === 'worked' || stage === 'verdict') && !showChooser ? asked : choice;
  const chapterName = chaptersFor(EDITION, shown?.year, shown?.course).find(c => c.id === shown?.chapter)?.name || '';
  const preview = !mcq && answer.trim() ? numberTex(answer.trim()) : '';
  const typeset = preview.startsWith('$') ? preview : '';
  const correctIndex = mcq && verdict?.answer != null ? q.mcqOptions.findIndex(o => String(o) === String(verdict.answer)) : -1;
  // After the working, a new question like this one is offered when the answer was missed or needed help.
  const offerLike = marked && verdict && (!verdict.correct || verdict.assisted);

  return (
    <div className="auth-wrap gt gp" data-guest-try data-guest-page data-stage={stage}>
      <header className="gp-bar">
        <Wordmark as="span" />
        <button type="button" className="btn btn-ghost gp-signin" data-testid="guest-sign-in" onClick={() => nav('/signin')}>{t('guest.signIn')}</button>
      </header>

      <main className="gp-main" id="main">
        {stage === 'signup' ? (
          <section className="gp-sheet gp-signup" aria-labelledby="gp-title" data-guest-signup={why}>
            <h1 id="gp-title" className="gp-display" tabIndex={-1} ref={headRef}>{t('guest.signupTitle')}</h1>
            <p className="gp-lede">{t(SIGNUP_KEY[why] || SIGNUP_KEY.limit, { n: limit })}</p>
            <div className="gp-actions">
              <button type="button" className="btn btn-primary" data-testid="guest-create-account" onClick={() => nav('/signin')}>{t('guest.createAccount')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => nav('/signin')}>{t('guest.signIn')}</button>
              {why === 'written' && <button type="button" className="gp-link" data-guest-leave-prompt onClick={leavePrompt}>{t('guest.changeTopic')}</button>}
            </div>
          </section>
        ) : (
          <div className="gp-sheet gp-paper">
            <aside className="gp-margin" aria-label={t('guest.aboutQuestion')}>
              <h1 id="gp-title" className="gp-number" tabIndex={-1} ref={headRef} data-guest-number={number}>{t('guest.questionOf', { n: number, total: limit })}</h1>
              <Tally limit={limit} used={used} log={log} t={t} />
              {stage !== 'opening' && (
                <dl className="gp-context" data-guest-context>
                  <div><dt>{t('picker.course')}</dt><dd>{t('common.classNumber', { n: shown.year })} {PATHWAYS[shown.course]?.name || ''}</dd></div>
                  <div><dt>{t('picker.topic')}</dt><dd>{chapterName}</dd></div>
                  <div><dt>{t('picker.level')}</dt><dd>{shown.difficulty != null ? t(`difficulty.${shown.difficulty}`) : ''}</dd></div>
                </dl>
              )}
              {(stage === 'question' || stage === 'worked' || stage === 'verdict') && !showChooser && (
                <button type="button" className="gp-link" data-guest-change aria-expanded="false" aria-controls="gp-chooser" onClick={openChooser}>{t('guest.changeTopic')}</button>
              )}
            </aside>

            {stage === 'opening' ? (
              <section className="gp-body" aria-busy="true">
                <p className="gp-quiet" role="status">{t('guest.loading')}</p>
              </section>
            ) : showChooser ? (
              <section className="gp-body" id="gp-chooser" aria-label={t('guest.changeTopic')}>
                <form className="gp-chooser" data-guest-chooser aria-busy={busy || undefined} onSubmit={e => { e.preventDefault(); if (!busy && choice.chapter && choice.difficulty != null) start(choice); }}>
                  {problem && <p className="gp-problem" role="alert" data-guest-problem>{t(problem)}</p>}
                  <Choices legend={t('picker.year')} name="gp-year" attr="data-pick-year" value={choice.year} onChange={year => change({ year })}
                    options={guestYears().map(y => ({ value: y, label: t('common.classNumber', { n: y }) }))} />
                  <Choices legend={t('picker.course')} name="gp-course" attr="data-pick-course" value={choice.course} onChange={course => change({ course })}
                    options={courses.map(c => ({ value: c.key, label: PATHWAYS[c.key]?.name || c.label }))} />
                  <div className="gp-row">
                    <label htmlFor="gp-topic">{t('picker.topic')}</label>
                    <div className="gp-opts">
                      <select id="gp-topic" className="input gp-select" value={choice.chapter || ''} disabled={!chapters.length} onChange={e => change({ chapter: e.target.value })} data-pick-topic>
                        {groups.map(([strand, rows]) => (
                          <optgroup key={strand || 'all'} label={strand}>
                            {rows.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      {!chapters.length && <p className="gp-quiet" role="status">{t('picker.noTopics')}</p>}
                    </div>
                  </div>
                  <Choices legend={t('picker.level')} name="gp-level" attr="data-pick-level" value={choice.difficulty} onChange={difficulty => change({ difficulty })}
                    options={levels.map(d => ({ value: d, label: t(`difficulty.${d}`) }))} />
                  <Choices legend={t('picker.type')} name="gp-form" attr="data-pick-form" value={choice.form} onChange={form => change({ form })}
                    options={PICKER_FORMS.map(f => ({ value: f, label: t(FORM_KEY[f]) }))} />
                  {open && <p className="gp-quiet" data-guest-change-note>{t('guest.changeNote', { n: limit })}</p>}
                  <div className="gp-actions">
                    <button type="submit" className="btn btn-primary" disabled={busy || !choice.chapter || choice.difficulty == null} data-guest-begin>{busy ? t('guest.loading') : t('guest.show')}</button>
                    {q && choosing && <button type="button" className="btn btn-ghost" data-guest-back onClick={closeChooser}>{t('guest.backToQuestion')}</button>}
                  </div>
                </form>
              </section>
            ) : q && (
              <section className="gp-body" aria-labelledby="gp-title" data-guest-question>
                <div className={`gp-prompt${arrived ? ' is-arriving' : ''}`} id="gp-prompt" lang="en"><MathText block text={q.prompt} /></div>
                <form onSubmit={check} className="gp-answer">
                  {mcq ? (
                    <fieldset className="gp-options" disabled={!editable || busy}>
                      <legend>{t('guest.optionsLabel')}</legend>
                      {q.mcqOptions.map((opt, i) => (
                        <label key={i} className={`gt-option gp-option${option === i ? ' on' : ''}${marked && i === correctIndex ? ' is-right' : ''}${(settled && option === i && i !== correctIndex) || (retrying && firstOption === i) ? ' is-wrong' : ''}`}>
                          <input type="radio" name="gp-option" data-gp-option value={i} checked={option === i} disabled={retrying && firstOption === i} onChange={() => setOption(i)} />
                          <span className="gp-key" aria-hidden="true">{'ABCD'[i]}</span>
                          <span lang="en"><MathText text={opt} /></span>
                          {((marked && (i === correctIndex || option === i)) || (settled && !marked && option === i) || (retrying && firstOption === i)) && <Mark right={marked && i === correctIndex} />}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <div className="gp-typed">
                      <label htmlFor="gt-answer">{t('guest.answerLabel')}</label>
                      <div className="gp-typed-row">
                        {q.answerPrefix && <span className="gp-affix" lang="en"><MathText text={affixTex(q.answerPrefix)} /></span>}
                        <input id="gt-answer" ref={answerRef} className="input gp-input" value={answer} readOnly={!editable || busy} aria-readonly={!editable || busy || undefined} maxLength={200}
                          aria-describedby="gp-prompt" onChange={e => setAnswer(e.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                        {q.answerSuffix && <span className="gp-affix" lang="en"><MathText text={q.answerSuffix} /></span>}
                        {editable && <button type="submit" className="btn btn-primary gp-check" disabled={!given || busy} data-guest-check>{busy ? t('guest.checking') : t('guest.check')}</button>}
                      </div>
                      {/* The working line: what was typed, set out as maths, large, on a ruled line; once marked it carries the mark. */}
                      <p className="gp-working" data-guest-reads>
                        <span className="gp-reads-k">{t('guest.readsAs')}</span>
                        {typeset
                          ? <span className="gp-line" lang="en"><MathText text={typeset} /></span>
                          : <span className="gp-how">{marked ? answer : t('guest.howToType')}</span>}
                        {settled && <Mark right={marked && verdict?.correct === true} />}
                      </p>
                      {retrying && firstAnswer && (
                        <p className="gp-first" data-guest-first-answer><span className="gp-reads-k">{t('guest.firstAnswer')}</span> <span className="gp-line-sm" lang="en"><MathText text={numberTex(firstAnswer)} /></span><Mark right={false} /></p>
                      )}
                    </div>
                  )}
                  {editable && (mcq || (stage === 'question' && Array.isArray(q.hints) && q.hints[0] && !hint)) && (
                    <div className="gp-actions">
                      {mcq && <button type="submit" className="btn btn-primary gp-check" disabled={!given || busy} data-guest-check>{busy ? t('guest.checking') : t('guest.check')}</button>}
                      {stage === 'question' && Array.isArray(q.hints) && q.hints[0] && !hint && <button type="button" className="gp-link" onClick={() => setHint(true)}>{t('guest.hint')}</button>}
                    </div>
                  )}
                </form>
                {hint && q.hints?.[0] && <p className="gp-hint" lang="en"><MathText text={String(q.hints[0].text ?? q.hints[0])} /></p>}
                {problem && <p className="gp-problem" role="alert" data-guest-problem>{t(problem)}</p>}
                {stage === 'worked' && worked && (
                  <>
                    <p className="gp-verdict-line gp-worked-line" role="status" data-guest-verdict="wrong" data-guest-stage="worked"><Mark right={false} />{t('guest.notQuite')}</p>
                    {!retrying && <p className="gp-quiet gp-worked-lede">{t('guest.firstStepLede')}</p>}
                  </>
                )}
                {(stage === 'worked' || stage === 'verdict') && worked && worked.steps.length > 0 && (
                  <WorkedSteps steps={worked.steps} heading={t('guest.stepsHeading')} label={n => t('guest.stepLabel', { n })} idPrefix="gp" />
                )}
                {stage === 'worked' && worked && (
                  <WorkedControls worked={worked} phase="worked" retrying={retrying} asking={asking} trouble={trouble} onRetry={startRetry} onMore={showMore} t={t} prefix="gp" />
                )}
                {marked && verdict && (
                  <div className="gp-verdict" role="status" data-guest-verdict={verdict.correct ? 'correct' : 'wrong'} data-guest-assisted={verdict.assisted ? (verdict.byStep ? 'step' : 'hint') : undefined}>
                    <p className="gp-verdict-line"><Mark right={verdict.correct} />{verdict.correct ? (verdict.assisted ? t(verdict.byStep ? 'guest.correctAfterStep' : 'guest.correctAfterHint') : t('guest.correct')) : t('guest.notQuite')}</p>
                    {verdict.answer && (
                      <p className="gp-working gp-verdict-answer"><span className="gp-reads-k">{t('guest.theAnswerIs')}</span> <span className="gp-line"><ServerAnswer text={verdict.answer} q={q} /></span></p>
                    )}
                  </div>
                )}
                {marked && verdict && worked && hasMore(worked) && (
                  <WorkedControls worked={worked} phase="closed" retrying={false} asking={asking} trouble={trouble} onMore={showMore} t={t} prefix="gp" />
                )}
                {marked && verdict && (
                  <div className="gp-actions gp-after" data-guest-after>
                    {offerLike && remaining === 0 && <p className="gp-quiet gp-nolike" data-guest-no-like>{t('guest.noLikeLeft')}</p>}
                    <button type="button" className="btn btn-primary" data-guest-next={!offerLike || remaining === 0 ? '' : undefined} data-guest-like={offerLike && remaining !== 0 ? '' : undefined} onClick={offerLike ? likeIt : next} disabled={busy} autoFocus={!worked || !hasMore(worked)}>
                      {remaining === 0 ? t('guest.createAccount') : offerLike ? t(verdict.moreForms ? 'guest.likeIt' : 'guest.likeItTopic') : t('guest.next')}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="gp-foot">
        {stage !== 'signup' && <p>{t('guest.checkedBy')} {t('guest.accountLine')}</p>}
        <p><span>{t('guest.privacy')}</span>{' '}<PageLink to="/privacy">{t('guest.privacyLink')}</PageLink></p>
      </footer>
    </div>
  );
}
