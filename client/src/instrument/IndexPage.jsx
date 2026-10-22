import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { isCurrentUrl } from '../platform/pageLink.js';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT, tLater } from '../i18n/index.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../engine/progressTruth.js';
import { practiceHref } from '../lib/practiceLinks.js';
import ChapterScope from './ChapterScope.jsx';
import TermGloss from '../components/TermGloss.jsx';
import { MathText } from '../lib/latex.jsx';
import { chapterEvidence, colourFor, figureFor, practiceTrack, scopeFor } from './chapters.js';
import IndexDial from './margin/IndexDial.jsx';
import { registerOf } from './margin/register.js';
import { noteCurriculum } from './CommandBar.jsx';
import { reduced, rowReveal } from './margin/motion.js';
import './margin/shell.css';

// The v1.1 home: the student's syllabus as a thumb-indexed book. The list and
// the coloured tabs choose a chapter; its plate shows what the evidence says
// (answers, correct, accuracy only over enough answers) and its mathematics on
// the scope. Every figure is the server's; nothing is estimated here.


// The phone home is a different arrangement (and its own scope), so the
// phone branch is chosen by the same 760px line the stylesheet uses.
const PHONE = '(max-width: 760px)';
const subscribePhone = notify => {
  const mq = window.matchMedia?.(PHONE);
  mq?.addEventListener?.('change', notify);
  return () => mq?.removeEventListener?.('change', notify);
};
const isPhone = () => !!window.matchMedia?.(PHONE).matches;

const greetingKey = hour => (hour < 12 ? 'inst.greetMorning' : hour < 17 ? 'inst.greetAfternoon' : 'inst.greetEvening');

// A chapter's mastery as a ten-tick meter (only where accuracy may be stated:
// chapterEvidence already holds mastery at 0 below the floor).
function Ticks({ value }) {
  const lit = Math.round(value / 10);
  return <span className="k-ticks" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < lit ? 'on' : undefined} />)}</span>;
}

// A figure whose digits roll into place like an odometer (CSS, Settle, 300ms
// in). Screen readers get the plain figure.
let ledgerRolled = false;
function Odometer({ value }) {
  const text = String(value);
  return (
    <span className="k-odo">
      <span className="sr-only">{text}</span>
      {/* A blank cell, then two turns of the drum: it starts empty, never on a false 0. */}
      {[...text].map((ch, i) => /\d/.test(ch)
        ? <span key={i} aria-hidden="true"><span style={{ '--d': 11 + Number(ch) }}><i />{Array.from({ length: 20 }, (_, n) => <i key={n}>{n % 10}</i>)}</span></span>
        : <span key={i} aria-hidden="true">{ch}</span>)}
    </span>
  );
}

// The shared element (design v3 05): the next question on the Index becomes
// Write's question prompt. With the View Transitions API the card is named for the old snapshot
// and the new page's .q-prompt carries the same name (shell.css); the update
// waits briefly for that prompt to mount so the two can be matched, and falls
// back to a cross-fade if it does not arrive. No API, or Reduce Motion: a cut.
function morphTo(card, go) {
  if (typeof document.startViewTransition !== 'function' || reduced() || !card) { go(); return; }
  const root = document.documentElement;
  card.style.viewTransitionName = 'pri-question';
  try {
    const vt = document.startViewTransition(() => {
      card.style.viewTransitionName = '';
      // Only now, and only for this transition, does the prompt take the name.
      root.dataset.vt = 'question';
      flushSync(go);
    return new Promise(resolve => {
      const t0 = performance.now();
      // Rendering (and so rAF) is paused while the update runs: poll on a timer.
      const look = () => (document.querySelector('.q-prompt') || performance.now() - t0 > 300 ? resolve() : setTimeout(look, 16));
      look();
    });
    });
    vt.finished.finally(() => { delete root.dataset.vt; });
  } catch { card.style.viewTransitionName = ''; delete root.dataset.vt; go(); }
}

export default function IndexPage() {
  const { user } = useApp();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [recent, setRecent] = useState(undefined);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);
  const [marks, setMarks] = useState({});

  useEffect(() => {
    let live = true;
    api.get('/curriculum').then(c => { if (live) setCurriculum(c); })
      .catch(err => { if (live) setError(err?.message || tLater('inst.indexError')); });
    api.get('/marks/by-chapter').then(r => { if (live) setMarks(r?.chapters || {}); }).catch(() => { });
    api.post('/history/list', { limit: 1 }).then(r => { if (live) setRecent(r?.items?.[0] || null); })
      .catch(() => { if (live) setRecent(null); });
    return () => { live = false; };
  }, []);

  // The command sheet reuses this read instead of fetching /curriculum again.
  useEffect(() => { if (curriculum) noteCurriculum(curriculum, user); }, [curriculum, user]);

  const track = practiceTrack(user);
  const chapters = useMemo(() => {
    const scope = scopeFor(curriculum, user);
    const rows = scope?.chapters || scope?.subtopics || [];
    return rows.map((row, i) => ({
      row, index: i, colour: colourFor(i), figure: figureFor(row.name),
      evidence: chapterEvidence(row, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy)
    }));
  }, [curriculum, user]);

  // Default to the chapter the student last worked in, else the first.
  const current = useMemo(() => {
    if (!chapters.length) return null;
    const chosen = chapters.find(c => c.row.id === pick);
    if (chosen) return chosen;
    const last = recent && chapters.find(c => c.row.id === recent.subtopic);
    return last || chapters[0];
  }, [chapters, pick, recent]);

  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const nav = useNavigate();
  const root = useRef(null);
  const resumeCard = useRef(null);

  // The register: every figure is a sum of the server's own evidence.
  const register = useMemo(() => registerOf(chapters, accuracyClaim, PROGRESS_THRESHOLDS), [chapters]);

  // The entrance (v3 choreography 05, in C's row-reveal motion): the greeting
  // fades at 0ms, the resume card rises at 40ms, the rows follow 40ms apart
  // (at most five staggered), the ledger digits roll at 300ms (CSS). Once.
  const entered = useRef({ greet: false, resume: false, rows: false });
  // The ledger rolls on the first Index of a page load only; decided at mount.
  const rolls = useRef(!ledgerRolled);
  useEffect(() => { if (chapters.length) ledgerRolled = true; }, [chapters.length]);
  useLayoutEffect(() => {
    const el = root.current; const done = entered.current;
    if (!el || reduced()) return;
    const greet = el.querySelector('.in-greet');
    if (greet && !done.greet) { done.greet = true; greet.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); }
    const card = el.querySelector('.k-next');
    if (card && !done.resume) { done.resume = true; rowReveal([card], { delay: 40, stagger: 0 }); }
    const rows = el.querySelectorAll('.in-chs > li');
    if (rows.length && !done.rows) {
      done.rows = true;
      const list = [...rows];
      rowReveal(list.slice(0, 5), { delay: 80, stagger: 40 });
      rowReveal(list.slice(5), { delay: 80 + 4 * 40, stagger: 0 });
    }
  });
  const name = (user.name || '').split(' ')[0];
  const markOf = id => (marks[id]?.possible ? marks[id] : null);
  const chapterSub = c => {
    const m = markOf(c.row.id);
    if (m) return `${m.earned}/${m.possible} ${t('inst.mapMarks')}`;
    return c.evidence.attempts ? t('inst.answered', { n: c.evidence.attempts }) : t('inst.notStarted');
  };
  // "Covered": the share of the chapter's dot points with at least one answer
  // — the dot point's own evidence from /curriculum (the figure its tile
  // shows), or a server-certified answer filed under exactly that dot point
  // (GET /marks/by-chapter dotpoints). A chapter with no dot point list has
  // nothing to cover against, so it says "—".
  const coveredOf = c => {
    const dps = Array.isArray(c.row.dotpoints) ? c.row.dotpoints : [];
    if (!dps.length) return '—';
    const seen = marks[c.row.id]?.dotpoints || {};
    const n = dps.filter((dp, i) => {
      const own = typeof dp === 'object' && dp ? chapterEvidence(dp, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy).attempts : 0;
      const key = typeof dp === 'object' && dp?.id ? String(dp.id) : String(i);
      return own > 0 || Number(seen[key]?.questions) > 0 || Number(seen[String(i)]?.questions) > 0;
    }).length;
    return `${Math.floor((100 * n) / dps.length)}%`;
  };
  // The resume card's ten segments: the last attempt's own marks, nothing more.
  const resumeMarks = recent && Number.isInteger(recent.marksPossible) && recent.marksPossible > 0 && !recent.repeat
    ? { earned: Math.max(0, Math.min(recent.marksPossible, Number(recent.marksEarned) || 0)), possible: recent.marksPossible } : null;
  const hour = new Date().getHours();

  if (error) return <div className="card" role="alert">{t('inst.indexError')} {error}</div>;

  return (
    <div className="in-index" data-instrument-index ref={root}>
      <header className="k-hero">
        {curriculum && chapters.length > 0 ? (
          <IndexDial accuracy={register.accuracy} covered={register.covered} label={t('inst.dialLabel')}
            caption={<><span>{t('inst.dialLong')}</span>{register.accuracy == null ? '—' : `${register.accuracy}%`}<span>{t('inst.dialShort')}</span>{`${register.covered}%`}</>}
            ariaLabel={register.accuracy == null
              ? t('inst.dialAriaHeld', { started: register.started, total: register.total })
              : t('inst.dialAria', { accuracy: register.accuracy, started: register.started, total: register.total })} />
        ) : <div className="m-dial" aria-hidden="true" />}
        <div>
          <div className="in-greet">
            <small>{user.year ? t('common.classNumber', { n: user.year }) : ''}</small>
            <h1>{t(greetingKey(hour), { name })}</h1>
          </div>
          {/* Loading: the block's engraved rules hold its place (no shimmer). */}
          {recent === undefined && <div className="k-next k-wait" aria-hidden="true"><i /><i /></div>}
          {recent && (
            <div className="k-next" data-instrument-resume ref={resumeCard}>
              <small>{t('inst.resumePrefix')} · <span lang="en">{recent.subtopicName || ''}</span></small>
              {recent.prompt ? <p className="k-q" lang="en"><MathText text={recent.prompt} /></p> : <p className="k-q" lang="en"><TermGloss text={recent.subtopicName || ''} /></p>}
              {resumeMarks && <small>{t('inst.resumeMarks', { earned: resumeMarks.earned, possible: resumeMarks.possible })}</small>}
              {resumeMarks && resumeMarks.possible <= 10 && (
                <div className="in-seg10" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < resumeMarks.earned ? 'd' : i < resumeMarks.possible ? 'x' : undefined} />)}
                </div>
              )}
              <PageLink className="in-btn is-primary c-btn-primary" to={practiceHref({ subtopic: recent.subtopic, track })}
                onClick={e => {
                  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  const to = practiceHref({ subtopic: recent.subtopic, track });
                  morphTo(resumeCard.current?.querySelector('.k-q'), () => nav(to, { replace: isCurrentUrl(to) }));
                }}>{t('inst.resume')}</PageLink>
            </div>
          )}
          {/* A new student: chapter 1's first question, one tap away. */}
          {recent === null && chapters[0] && (
            <div className="k-next" data-instrument-begin>
              <small>{t('inst.chapterN', { n: 1 })} · <span lang="en">{chapters[0].row.name}</span></small>
              <p className="k-q">{t('inst.beginFirst')}</p>
              <PageLink className="in-btn is-primary c-btn-primary" to={practiceHref({ subtopic: chapters[0].row.id, track })}>{t('inst.begin')}</PageLink>
            </div>
          )}
          {curriculum && chapters.length > 0 && (
            <dl className={`k-ledger${rolls.current ? '' : ' k-still'}`} data-instrument-ledger>
              <div><dt>{t('inst.ledgerAnswers')}</dt><dd><Odometer value={register.answers} /></dd></div>
              <div><dt>{t('inst.ledgerCorrect')}</dt><dd><Odometer value={register.correct == null ? '—' : register.correct} /></dd></div>
              <div><dt>{t('inst.ledgerChapters')}</dt><dd><Odometer value={`${register.started}/${register.total}`} /></dd></div>
            </dl>
          )}
        </div>
      </header>

      <div className="k-body">
      <div className="in-spine">
        {!curriculum && <div className="skeleton" style={{ height: 380, marginTop: 18 }} aria-hidden="true" />}

        {curriculum && (
          <nav aria-label={t('inst.chapters')}>
            <ul className="in-chs">
              {chapters.map(c => {
                const on = current?.row.id === c.row.id;
                return (
                  <li key={c.row.id}>
                    <button type="button" className="in-ch" style={{ '--cc': `var(${c.colour})` }}
                      aria-pressed={on} data-current={on ? 'true' : undefined} data-chapter={c.row.id}
                      onClick={() => setPick(c.row.id)} onFocus={() => setPick(c.row.id)}>
                      <span className="in-ch-n">{String(c.index + 1).padStart(2, '0')}</span>
                      <span className="in-ch-t"><span lang="en"><TermGloss text={c.row.name} /></span>
                        <small>{chapterSub(c)}</small>
                      </span>
                      <Ticks value={c.evidence.mastery} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>

      {current && (
        <section className="in-plate" style={{ '--cc': `var(${current.colour})` }} aria-labelledby="in-plate-title" data-instrument-plate={current.row.id}>
          <div className="in-plate-head">
            <div>
              <small>{t('inst.chapterN', { n: current.index + 1 })}</small>
              <h2 id="in-plate-title" lang="en"><TermGloss text={current.row.name} /></h2>
              {current.row.strand && <p lang="en">{current.row.strand}</p>}
            </div>
            <div className="in-kpis">
              <div data-plate-marks><b>{marks[current.row.id]?.possible ? `${marks[current.row.id].earned}/${marks[current.row.id].possible}` : '—'}</b><small>{t('inst.mapMarks')}</small></div>
              <div data-plate-questions><b>{current.evidence.attempts}</b><small>{t('inst.kpiQuestions')}</small></div>
              <div data-plate-covered><b>{coveredOf(current)}</b><small>{t('inst.kpiCovered')}</small></div>
            </div>
          </div>
          {/* Evidence only: a chapter with no answers has nothing to plot, so it
              gets a clean ruled frame (the slot PR5's empty plot fills), never an
              invented curve. */}
          {current.evidence.attempts > 0
            ? !phone && <ChapterScope figure={current.figure} colourVar="--c-lume" label={t('inst.scopeLabel', { name: current.row.name })} tracerHint={t('inst.scopeTracer')} probeHint={t('inst.scopeProbe')} />
            : <div className="in-scope k-slot" data-empty-plot aria-hidden="true" />}
          {Array.isArray(current.row.dotpoints) && current.row.dotpoints.length > 0 && (
            <ul className="in-exs" aria-label={t('inst.dotpoints')}>
              {current.row.dotpoints.slice(0, 4).map((dp, i) => {
                // A dot point is a string (India) or a row with its own evidence.
                const text = typeof dp === 'string' ? dp : String(dp?.text || '');
                const ev = typeof dp === 'object' && dp ? chapterEvidence(dp, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy) : null;
                const figure = ev?.accuracy != null ? `${ev.accuracy}%` : ev?.attempts ? t('inst.answered', { n: ev.attempts }) : '—';
                return (
                  <li key={i}>
                    <PageLink className="in-ex" to={practiceHref({ subtopic: current.row.id, dotpoint: i, track })} data-plate-dotpoint={i}>
                      <span className="in-ex-h"><span>{`${current.index + 1}.${i + 1}`}</span><span>{figure}</span></span>
                      <b lang="en"><TermGloss text={text} /></b>
                      <span className="in-ex-bar" aria-hidden="true"><i style={{ width: `${ev?.accuracy != null ? ev.mastery : 0}%` }} /></span>
                    </PageLink>
                  </li>
                );
              })}
            </ul>
          )}
          <div>
            <div className="in-plate-acts">
              <PageLink className="c-btn" to={practiceHref({ subtopic: current.row.id, track })} data-instrument-practise>{t('inst.practise')}</PageLink>
            </div>
            {current.evidence.attempts > 0 && current.evidence.accuracy == null && <p className="in-note" style={{ marginTop: 10 }}>{t('inst.accuracyHeld')}</p>}
          </div>
        </section>
      )}
      </div>
      {curriculum && !chapters.length && <p className="in-empty">{t('inst.noChapters')}</p>}
    </div>
  );
}
