// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first screen for a visitor with no account (ADR-0003)
//
// The question picker, then a question, then the server's verdict, up to the
// day's five; then a calm sign-up prompt. "Sign in" is one click away, top
// right, and goes to the sign-in page that used to be the first screen.
//
// The device marks nothing here and holds no key: the question is the server's
// public fields plus a sealed ticket, the verdict is the server's. Handwriting
// and photos are not part of the trial (they are a paid reader and need an
// account and the consent prompt), so choosing them is the sign-up prompt.
// Nothing is stored about the visitor on this device except the last picker
// choice. No countdown, no streak, no guilt.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT, useLanguage, LANGUAGES, rememberSignInLanguage, setLanguage } from '../i18n/index.js';
import { MathText } from '../lib/latex.jsx';
import { answerToTex } from '../engine/answerTex.js';
import { Wordmark } from '../components/BrandMark.jsx';
import PageLink from '../components/PageLink.jsx';
import { EDITION } from '../platform/edition.js';
import QuestionPicker from './QuestionPicker.jsx';
import { guestTarget } from './guestMenu.js';
import { startGuest, askGuest, answerGuest } from './guestTrial.js';
import './guest.css';

const CURRICULUM = EDITION === 'priyabhata' ? 'in' : 'nsw';
const LIMIT = 5;
const SIGNUP_KEY = { limit: 'guest.signupLimit', address: 'guest.signupAddress', written: 'guest.signupWritten', account: 'guest.signupWritten', busy: 'guest.signupBusy' };
const ERROR_KEY = { none: 'guest.noQuestion', expired: 'guest.expired', fast: 'guest.tooFast', 'marking-busy': 'guest.busy', offline: 'guest.offline' };

/** The language control a device has before any profile: English only in an edition with no other language. */
function Languages() {
  const { chosen, t } = useLanguage();
  if (EDITION === 'prithagoras' || LANGUAGES.length < 2) return null;
  const pick = id => { rememberSignInLanguage(id); setLanguage(id); };
  return (
    <div className="gt-langs" role="group" aria-label={t('login.chooseLanguage')}>
      {LANGUAGES.map(l => (
        <button key={l.id} type="button" className={`pill-opt ${chosen === l.id ? 'on' : ''}`} lang={l.htmlLang} aria-pressed={chosen === l.id}
          aria-label={t('lang.switchTo', { language: l.english })} onClick={() => pick(l.id)}>{l.label}</button>
      ))}
      {chosen !== 'en' && <p className="gt-quiet" data-lang-note role="note">{t('lang.help')}</p>}
    </div>
  );
}

export default function GuestTry() {
  const t = useT();
  const nav = useNavigate();
  const [stage, setStage] = useState('pick'); // pick | loading | question | verdict | signup
  const [remaining, setRemaining] = useState(null);
  const [asked, setAsked] = useState(null);   // the picker choice behind the open question
  const [item, setItem] = useState(null);     // { question, sealed }
  const [answer, setAnswer] = useState('');
  const [option, setOption] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [problem, setProblem] = useState(null);
  const [hint, setHint] = useState(false);
  const [why, setWhy] = useState('limit');
  const [busy, setBusy] = useState(false);
  const focusRef = useRef(null);

  useEffect(() => { document.title = `${t('guest.title')} · ${document.title.split(' · ').pop()}`; }, [t]);
  useEffect(() => { startGuest().then(s => setRemaining(s.remaining)).catch(() => { /* named on the first request */ }); }, []);
  // Where a person lands after each step: the heading of what they are now reading.
  useEffect(() => { if (stage !== 'pick') focusRef.current?.focus({ preventScroll: false }); }, [stage]);

  const prompt = reason => { setWhy(reason); setStage('signup'); };

  const start = useCallback(async choice => {
    setProblem(null);
    if (choice.form === 'written') return prompt('written');
    setAsked(choice); setStage('loading'); setBusy(true);
    try {
      let out = null;
      // An India chapter has several authored forms; one may have no question of the asked-for type.
      for (let attempt = 0; attempt < 4 && !out; attempt++) {
        const target = guestTarget(EDITION, choice);
        if (!target) throw Object.assign(new Error('not offered'), { reason: 'none' });
        try { out = await askGuest({ generator: target.generator, difficulty: target.difficulty, curriculum: CURRICULUM, form: choice.form }); }
        catch (error) { if (error.reason !== 'none' || attempt === 3) throw error; }
      }
      setItem(out); setRemaining(out.remaining); setAnswer(''); setOption(null); setVerdict(null); setHint(false); setStage('question');
    } catch (error) {
      const r = error.reason || 'offline';
      if (['limit', 'address', 'busy', 'account'].includes(r)) prompt(r);
      else { setProblem(ERROR_KEY[r] || 'guest.offline'); setStage('pick'); }
    } finally { setBusy(false); }
  }, []);

  const mcq = item?.question?.answerType === 'mcq';
  const given = mcq ? (option === null ? '' : String(option)) : answer.trim();

  const check = async e => {
    e?.preventDefault();
    if (!given || busy) return;
    setBusy(true); setProblem(null);
    try {
      const out = await answerGuest({ sealed: item.sealed, answer: given });
      if (out.invalid) setProblem('guest.unreadable');
      else { setVerdict(out); if (typeof out.remaining === 'number') setRemaining(out.remaining); setStage('verdict'); }
    } catch (error) { setProblem(ERROR_KEY[error.reason] || 'guest.offline'); if (error.reason === 'expired') setStage('pick'); }
    finally { setBusy(false); }
  };

  const next = () => (remaining === 0 ? prompt('limit') : start(asked));
  const q = item?.question;
  const left = remaining ?? LIMIT;

  // `auth-wrap` is the "before sign-in" shell the sign-in page is too, so a document that waits for it still finds it.
  return (
    <div className="auth-wrap gt" data-guest-try data-stage={stage}>
      <header className="gt-bar">
        <Wordmark as="span" />
        <button type="button" className="btn btn-ghost" data-testid="guest-sign-in" onClick={() => nav('/signin')}>{t('guest.signIn')}</button>
      </header>

      <main className="gt-main" id="main">
        {stage === 'signup' ? (
          <section className="gt-panel" aria-labelledby="gt-signup-title" data-guest-signup={why}>
            <h1 id="gt-signup-title" tabIndex={-1} ref={focusRef}>{t('guest.signupTitle')}</h1>
            <p>{t(SIGNUP_KEY[why] || SIGNUP_KEY.limit, { n: LIMIT })}</p>
            <div className="gt-actions">
              <button type="button" className="btn btn-primary" data-testid="guest-create-account" onClick={() => nav('/signin')}>{t('guest.createAccount')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => nav('/signin')}>{t('guest.signIn')}</button>
            </div>
          </section>
        ) : stage === 'pick' || stage === 'loading' ? (
          <section className="gt-panel" aria-labelledby="gt-title">
            <h1 id="gt-title">{t('guest.title')}</h1>
            <p className="gt-lede">{t('guest.lede', { n: LIMIT })}</p>
            {problem && <p className="gt-problem" role="alert" data-guest-problem>{t(problem)}</p>}
            <QuestionPicker edition={EDITION} defaultYear={EDITION === 'priyabhata' ? 9 : 12} onStart={start} busy={busy} idPrefix="gt" />
            <p className="gt-left" role="status" data-guest-left>{t('guest.leftToday', { n: left, count: left })}</p>
            {stage === 'loading' && <p className="gt-quiet" role="status">{t('guest.loading')}</p>}
          </section>
        ) : q && (
          <section className="gt-panel" aria-labelledby="gt-q-title" data-guest-question>
            <h1 id="gt-q-title" tabIndex={-1} ref={focusRef} className="gt-qhead">{t('guest.title')}</h1>
            <p className="gt-left" role="status" data-guest-left>{t('guest.leftToday', { n: left, count: left })}</p>
            <div className="gt-prompt" lang="en"><MathText block text={q.prompt} /></div>
            <form onSubmit={check} className="gt-answer">
              {mcq ? (
                <fieldset className="gt-options" disabled={stage === 'verdict' || busy}>
                  <legend>{t('guest.optionsLabel')}</legend>
                  {q.mcqOptions.map((opt, i) => (
                    <label key={i} className={`gt-option${option === i ? ' on' : ''}`}>
                      <input type="radio" name="gt-option" value={i} checked={option === i} onChange={() => setOption(i)} />
                      <span className="gt-key" aria-hidden="true">{'ABCD'[i]}</span>
                      <span lang="en"><MathText text={opt} /></span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className="gt-typed">
                  <label htmlFor="gt-answer">{t('guest.answerLabel')}</label>
                  <div className="gt-typed-row">
                    {q.answerPrefix && <span lang="en"><MathText text={q.answerPrefix} /></span>}
                    <input id="gt-answer" className="input" value={answer} readOnly={stage === 'verdict' || busy} aria-readonly={stage === 'verdict' || busy || undefined} maxLength={200}
                      onChange={e => setAnswer(e.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                    {q.answerSuffix && <span lang="en"><MathText text={q.answerSuffix} /></span>}
                  </div>
                </div>
              )}
              {stage === 'question' && (
                <div className="gt-actions">
                  <button type="submit" className="btn btn-primary" disabled={!given || busy} data-guest-check>{busy ? t('guest.checking') : t('guest.check')}</button>
                  {Array.isArray(q.hints) && q.hints[0] && !hint && <button type="button" className="btn btn-ghost" onClick={() => setHint(true)}>{t('guest.hint')}</button>}
                </div>
              )}
            </form>
            {hint && q.hints?.[0] && <p className="gt-hint" lang="en"><MathText text={String(q.hints[0].text ?? q.hints[0])} /></p>}
            {problem && <p className="gt-problem" role="alert" data-guest-problem>{t(problem)}</p>}
            {stage === 'verdict' && verdict && (
              <div className="gt-verdict" role="status" data-guest-verdict={verdict.correct ? 'correct' : 'wrong'}>
                <p className="gt-verdict-line">{verdict.correct ? t('guest.correct') : t('guest.notQuite')}</p>
                {verdict.answer && <p>{t('guest.theAnswerIs')} <MathText text={answerToTex(verdict.answer)} /></p>}
                <div className="gt-actions">
                  <button type="button" className="btn btn-primary" data-guest-next onClick={next} autoFocus>{remaining === 0 ? t('guest.createAccount') : t('guest.next')}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setStage('pick'); setItem(null); }}>{t('guest.changeTopic')}</button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="gt-foot">
        <Languages />
        <span>{t('guest.privacy')}</span>{' '}
        <PageLink to="/privacy">{t('guest.privacyLink')}</PageLink>
      </footer>
    </div>
  );
}

