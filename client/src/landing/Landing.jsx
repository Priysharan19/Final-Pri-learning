// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the public landing ("the verified page", design §3)
//
// Signed out, on the web. The hero is a live marked-work demo: a scripted
// student's five lines of working on the u = tan x question, read, confirmed
// by the visitor, then checked line by line. Every status comes from the real
// engine at run time (landing/demoScript.js); this file only paces what the
// engine returned and draws it.
//
// Honesty rules this page keeps (client/test/landing-home-check.mjs):
//   · no invented statistics, no competitor names;
//   · the social-proof slots render only with the flag on AND consented
//     content (landing.config.js) — neither is true today;
//   · every status is a shape and a word, never colour alone;
//   · reduced motion shows the final state at once.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageLink from '../components/PageLink.jsx';
import { BrandMark } from '../components/BrandMark.jsx';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { EDITION } from '../platform/edition.js';
import { DEMO_LINES, DEMO_QUESTION_TEX, CORRECT_LINE4, STATUS, UNSURE, runDemo } from './demoScript.js';
import { LANDING_ROUTES, TEACHER_ONBOARDING_ROUTE, socialProofSlots } from './landing.config.js';
import './landing.css';

const MistakeGraphView = React.lazy(() => import('../components/MistakeGraph.jsx')
  .then(m => ({ default: m.MistakeGraphView })).catch(() => ({ default: () => null })));

/** Each rule's label (a kind of step, never a verdict). */
const RULE_KEY = Object.freeze({
  substitution: 'landing.rule.substitution', identity: 'landing.rule.identity', changeOfVariable: 'landing.rule.changeOfVariable',
  algebraicDivision: 'landing.rule.algebraicDivision', integration: 'landing.rule.integration'
});

/** The pace of the demo (design §3): one reading or one verdict every 650 ms. */
export const DEMO_STEP_MS = 650;
const SIGN_IN = '/';

export const reducedMotion = () => {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** The edition's syllabus proof point. */
export const syllabusKey = (edition = EDITION) => (edition === 'prithagoras' ? 'landing.proofSyllabusAu' : 'landing.proofSyllabusIn');

/* ── shapes: each state is a shape AND a word ─────────────────────────────── */
export function StatusGlyph({ status }) {
  const common = { width: 16, height: 16, viewBox: '0 0 18 18', 'aria-hidden': true, focusable: 'false' };
  if (status === STATUS.GIVEN) {
    return <svg {...common}><path d="M6.5 3H4v12h2.5M11.5 3H14v12h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (status === STATUS.CHECKED) {
    return <svg {...common}><circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5.5 9.3l2.3 2.3 4.6-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (status === STATUS.ERROR) {
    return <svg {...common}><path d="M9 2l7.5 13.5h-15z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 7v4M9 13.2v.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
  }
  if (status === STATUS.FOLLOWS) {
    return <svg {...common}><path d="M3 9h11M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  return <svg {...common}><circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.4" /><path d="M7.2 7.1a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.5M9 12.9v.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

export function statusWord(t, status, firstError) {
  if (status === STATUS.GIVEN) return t('landing.st.given');
  if (status === STATUS.CHECKED) return t('landing.st.checked');
  if (status === STATUS.ERROR) return t('landing.st.error');
  if (status === STATUS.FOLLOWS) return t('landing.st.follows', { n: firstError });
  return t('landing.st.unverified');
}

/**
 * The demo's pacing as a pure function of a step counter, so the final state
 * is reachable at once (reduced motion) and a render check can draw any step.
 *   read:  0..5   lines whose reading is shown
 *   glyph: null until the visitor confirms
 *   lock:  0..5   lines whose verdict is shown (after confirmation)
 *   open:  See why is open
 */
export const FINAL = Object.freeze({ read: DEMO_LINES.length, glyph: UNSURE.read, lock: DEMO_LINES.length, open: true });
const START = Object.freeze({ read: 0, glyph: null, lock: 0, open: false });
/** Reduced motion: every line read at once, still waiting for the visitor to confirm — the reading is never confirmed for them. */
export const WAITING = Object.freeze({ read: DEMO_LINES.length, glyph: null, lock: 0, open: false });

export function LiveDemo({ initial = null }) {
  const t = useT();
  const [state, setState] = useState(() => initial || (reducedMotion() ? WAITING : START));
  const sayRef = useRef(null);
  const timer = useRef(null);
  const result = useMemo(() => runDemo({ glyph: state.glyph }), [state.glyph]);
  const n = DEMO_LINES.length;
  const waiting = state.read >= n && state.glyph == null;
  const done = state.glyph != null && state.lock >= n && state.open;

  useEffect(() => {
    if (reducedMotion() && state.glyph != null && !done) { setState(s => ({ ...s, lock: n, open: true })); return undefined; }
    if (waiting || done) return undefined;
    timer.current = setTimeout(() => setState(s => {
      if (s.read < n) return { ...s, read: s.read + 1 };
      if (s.glyph != null && s.lock < n) return { ...s, lock: s.lock + 1 };
      if (s.glyph != null) return { ...s, open: true };
      return s;
    }), DEMO_STEP_MS);
    return () => clearTimeout(timer.current);
  }, [state, waiting, done, n]);

  // The button pressed disappears, so focus moves to the status line it changed.
  const toSay = () => setTimeout(() => sayRef.current?.focus({ preventScroll: true }), 0);
  const confirm = glyph => { setState(s => ({ ...s, glyph, lock: reducedMotion() ? n : 0, open: reducedMotion() })); toSay(); };
  const replay = () => { setState(reducedMotion() ? WAITING : START); toSay(); };

  const firstError = result?.firstError ?? null;
  const say = state.read < n ? t('landing.demo.reading')
    : waiting ? t('landing.demo.ask', { n: UNSURE.line, a: UNSURE.read, b: UNSURE.alternative })
      : !done ? t('landing.demo.checking')
        : firstError ? t('landing.demo.done', { n: firstError }) : t('landing.demo.doneClean');
  const errorLine = DEMO_LINES.find(l => l.n === firstError);
  const showSeeWhy = done && result?.seeWhy && errorLine;

  return (
    <section className="lp-demo" aria-labelledby="lp-demo-title" data-landing-demo data-demo-state={done ? 'done' : waiting ? 'waiting' : 'running'}>
      <div className="lp-demo-head">
        <h2 id="lp-demo-title" className="lp-demo-q"><MathText text={DEMO_QUESTION_TEX} /></h2>
        <span className="lp-demo-tag">{t('landing.demo.label')}</span>
      </div>
      <ol className="lp-paper" aria-label={t('landing.demo.working')}>
        {DEMO_LINES.map((line, i) => {
          const read = state.read > i;
          const verdict = result && state.lock > i ? result.lines[i] : null;
          const unsure = read && line.n === UNSURE.line && state.glyph == null;
          const glyph = state.glyph || UNSURE.read;
          const tex = line.tex.replace('{GLYPH}', unsure ? `\\boxed{${UNSURE.read}}` : glyph);
          return (
            <li key={line.n} className={`lp-line${verdict ? ` is-${verdict.status}` : ''}`} data-demo-line={line.n} data-status={verdict?.status || 'pending'}>
              <span className="lp-ln" aria-hidden="true">{line.n}</span>
              <span className="lp-work">
                <span className="lp-ink" aria-hidden="true">{line.ink}</span>
                {read && (
                  <span className={`lp-read${unsure ? ' is-unsure' : ''}`} data-demo-read={line.n}>
                    <span className="lp-sr">{t('landing.demo.lineN', { n: line.n })}</span>
                    <MathText text={`$${tex}$`} />
                  </span>
                )}
              </span>
              <span className="lp-st" data-demo-status={line.n}>
                {verdict && (
                  <>
                    <StatusGlyph status={verdict.status} />
                    <span className="lp-st-w">{statusWord(t, verdict.status, firstError)}</span>
                    <span className="lp-chip">{t(RULE_KEY[line.rule])}</span>
                  </>
                )}
              </span>
              {verdict?.status === STATUS.CHECKED && <span className="lp-trace" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="lp-demo-bar">
        <p className="lp-say" aria-live="polite" data-demo-say tabIndex={-1} ref={sayRef}>{say}</p>
        {waiting && (
          <div className="lp-demo-acts">
            <button type="button" className="lp-btn lp-btn-sec" data-demo-confirm onClick={() => confirm(UNSURE.read)}>{t('landing.demo.confirm', { a: UNSURE.read })}</button>
            <button type="button" className="lp-btn lp-btn-quiet" data-demo-other onClick={() => confirm(UNSURE.alternative)}>{t('landing.demo.other', { b: UNSURE.alternative })}</button>
          </div>
        )}
        {done && <button type="button" className="lp-btn lp-btn-sec" data-demo-replay onClick={replay}>{t('landing.demo.replay')}</button>}
      </div>

      {showSeeWhy && (
        <div className="lp-seewhy" data-demo-seewhy>
          <h3 className="lp-h3">{t('landing.demo.seeWhy')}</h3>
          {result.correct && errorLine.n === 4 && (
            <p className="lp-correct" data-demo-correct>
              <span className="lp-correct-k">{t('landing.demo.correctForm')}</span>{' '}
              <MathText text={`$${CORRECT_LINE4.tex}$`} />
            </p>
          )}
          <React.Suspense fallback={null}>
            <MistakeGraphView view={result.seeWhy} />
          </React.Suspense>
        </div>
      )}
      <p className="lp-fine">{t('landing.demo.scripted')}</p>
    </section>
  );
}

function Header() {
  const t = useT();
  return (
    <header className="lp-head">
      <PageLink to={LANDING_ROUTES.home} className="lp-brand" aria-label={t('landing.home')}><BrandMark size={26} /></PageLink>
      <nav className="lp-nav" aria-label={t('landing.navLabel')}>
        <PageLink to={LANDING_ROUTES.marking}>{t('landing.navMarking')}</PageLink>
        <PageLink to={LANDING_ROUTES.syllabus}>{t('landing.navSyllabus')}</PageLink>
        <PageLink to={TEACHER_ONBOARDING_ROUTE}>{t('landing.navTeachers')}</PageLink>
      </nav>
      <PageLink to={SIGN_IN} className="lp-btn lp-btn-sec lp-signin" data-landing-signin>{t('landing.signIn')}</PageLink>
    </header>
  );
}

function Tick() {
  return <span className="lp-tick" aria-hidden="true"><StatusGlyph status={STATUS.CHECKED} /></span>;
}

export function SocialProof({ slots = socialProofSlots() }) {
  if (!slots.length) return null;
  return (
    <ul className="lp-proofs-social" data-social-proof>
      {slots.map(s => <li key={s.consentRef} data-social-slot={s.kind}>{s.body}</li>)}
    </ul>
  );
}

export function LandingShell({ children, title }) {
  const t = useT();
  useEffect(() => {
    const before = document.title;
    if (title) document.title = title;
    return () => { document.title = before; };
  }, [title]);
  return (
    <div className="lp" data-landing>
      <Header />
      {children}
      <footer className="lp-foot">
        <PageLink to={LANDING_ROUTES.marking}>{t('landing.navMarking')}</PageLink>
        <PageLink to={LANDING_ROUTES.syllabus}>{t('landing.navSyllabus')}</PageLink>
        <PageLink to={TEACHER_ONBOARDING_ROUTE}>{t('landing.navTeachers')}</PageLink>
        <PageLink to="/privacy">{t('login.privacy')}</PageLink>
        <PageLink to="/terms">{t('login.terms')}</PageLink>
      </footer>
    </div>
  );
}

export default function Landing({ demoInitial = null }) {
  const t = useT();
  return (
    <LandingShell title={t('landing.docTitle')}>
      <main className="lp-main" id="main">
        <div className="lp-hero">
          <div className="lp-copy">
            <h1 className="lp-title">{t('landing.title')}<br /><span className="lp-title-2">{t('landing.titleTail')}</span></h1>
            <p className="lp-sub">{t('landing.sub')}</p>
            <div className="lp-ctas">
              <PageLink to={SIGN_IN} className="lp-btn lp-btn-pri" data-landing-create>{t('landing.create')}</PageLink>
              <PageLink to={LANDING_ROUTES.marking} className="lp-btn lp-btn-sec">{t('landing.navMarking')}</PageLink>
            </div>
            <ul className="lp-proofs" data-landing-proofs>
              <li><Tick /><span>{t('landing.proofEngine')}</span></li>
              <li><Tick /><span>{t('landing.proofConfirm')}</span></li>
              <li data-proof-syllabus><Tick /><span>{t(syllabusKey())}</span></li>
            </ul>
          </div>
          <LiveDemo initial={demoInitial} />
        </div>
        <SocialProof />
      </main>
    </LandingShell>
  );
}
