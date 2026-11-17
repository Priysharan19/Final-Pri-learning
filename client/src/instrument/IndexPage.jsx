import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import Working from './Working.jsx';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT, tLater } from '../i18n/index.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../engine/progressTruth.js';
import { practiceHref } from '../lib/practiceLinks.js';
import ChapterScope from './ChapterScope.jsx';
import TermGloss from '../components/TermGloss.jsx';
import Glyph from './Glyph.jsx';
import TopicGenerator from '../home/TopicGenerator.jsx';
import { actionOpenable } from '../home/recommendation.js';
import { featureEnabled } from '../platform/features.js';
import { useHomeDecision, usePlacement, actionCopy, PlacementCard, GoalCard } from '../pages/Home.jsx';
import { chapterEvidence, colourFor, figureFor, practiceTrack, scopeFor } from './chapters.js';
import HomeAside, { NextMeta } from '../home/HomeVerified.jsx';

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

// The review-queue and plan cards arrive after the Index has painted, as they
// do on the v1.0 Home: neither is needed for the first paint, and a chunk that
// cannot be fetched (a first run offline) leaves the Index without the card
// rather than without the Index.
function Lazy(load) {
  return function LazyCard(props) {
    const [Card, setCard] = useState(null);
    useEffect(() => {
      let live = true;
      load().then(m => { if (live) setCard(() => m.default); }).catch(() => { });
      return () => { live = false; };
    }, []);
    return Card ? <Card {...props} /> : null;
  };
}
const LazyReviewQueueCard = Lazy(() => import('../home/ReviewQueueCard.jsx'));
const LazyPlanCard = Lazy(() => import('../home/PlanCard.jsx'));

function Ring({ value, colourVar }) {
  const r = 10; const length = 2 * Math.PI * r;
  return (
    <svg className="in-ring" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r={r} fill="none" stroke="var(--in-l4)" strokeWidth="2.5" />
      <circle cx="13" cy="13" r={r} fill="none" stroke={`var(${colourVar})`} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={length} strokeDashoffset={length * (1 - value / 100)} transform="rotate(-90 13 13)" />
    </svg>
  );
}

// The student's next action, from the one resolver both homes share
// (home/recommendation.js through useHomeDecision). Time-bound work outranks
// the chapter the student last opened: an exam in progress, assigned or
// overdue work, an unfinished question, an expired paper to read, reviews due
// (priority 80 and above). Below that the Index's own resume card — the last
// chapter, with its marks — is the primary action when there is one; a
// student with no history gets the resolver's first-practice action.
const URGENT = 80;
const CLASSROOM_ON = featureEnabled('extendedTracks');
// A title that is a chapter or topic name is curriculum content, which stays
// in English (D11), so it is marked lang="en" on a Hindi screen as the chapter
// list is. Other titles are interface strings in the reader's language, or a
// name a teacher typed (an exam or task title), left unmarked.
const topicLang = (action, topicName, resume) => (
  (action.kind === 'practice-resume' && topicName(resume?.subtopic)) || (action.kind === 'adaptive' && action.data?.topic) ? 'en' : undefined);

function NextAction({ action, copy, online, nav, lang }) {
  const t = useT();
  const openable = actionOpenable(action, { online });
  const reasonId = 'home-primary-reason';
  return (
    <div className="in-resume in-nextact" data-home-primary data-kind={action.kind}>
      <div>
        <small className="in-nextact-k">{copy.kicker}</small>
        <b id="home-next-title" lang={lang}>{copy.title}</b>
        <small id={reasonId}>{openable ? copy.reason : t('home.needsConnection')}</small>
        <NextMeta action={action} />
      </div>
      <button type="button" className="in-btn is-primary" data-home-primary-cta aria-describedby={reasonId}
        disabled={!openable} onClick={() => nav(action.destination)}>{copy.cta} <span className="in-kbd" aria-hidden="true">↵</span></button>
    </div>
  );
}

export default function IndexPage() {
  const { user, dueCount, dueUnit } = useApp();
  const t = useT();
  const nav = useNavigate();
  const { stats: homeStats, local, assignments, online, homeDecision, alternatives, topicName } = useHomeDecision(user, dueCount, dueUnit);
  const [placement, skipPlacement] = usePlacement(user);
  const [curriculum, setCurriculum] = useState(null);
  const [recent, setRecent] = useState(undefined);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);
  const [marks, setMarks] = useState({});
  // The plan card reads the week through the same stats the Plan page uses.
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/curriculum').then(c => { if (live) setCurriculum(c); })
      .catch(err => { if (live) setError(err?.message || tLater('inst.indexError')); });
    api.get('/marks/by-chapter').then(r => { if (live) setMarks(r?.chapters || {}); }).catch(() => { });
    api.post('/history/list', { limit: 1 }).then(r => { if (live) setRecent(r?.items?.[0] || null); })
      .catch(() => { if (live) setRecent(null); });
    api.get('/stats').then(r => { if (live) setStats(r || null); }).catch(() => { });
    return () => { live = false; };
  }, []);

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
  const name = (user.name || '').split(' ')[0];
  const markOf = id => (marks[id]?.possible ? marks[id] : null);
  // The tick scale reads the dot points the plate already lists, from the same
  // evidence: a dot point is "practised" once it has the answers the progress floor
  // calls practised (a count of answers, not a judgement of how well they went), "started" with any answer
  // (its own evidence, or a server-certified answer filed under it), else empty.
  // No new measure: only the existing floors, applied per dot point.
  const dotStates = c => {
    const dps = Array.isArray(c.row.dotpoints) ? c.row.dotpoints : [];
    const seen = marks[c.row.id]?.dotpoints || {};
    return dps.map((dp, i) => {
      const ev = typeof dp === 'object' && dp ? chapterEvidence(dp, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy) : null;
      const key = typeof dp === 'object' && dp?.id ? String(dp.id) : String(i);
      if (ev && ev.accuracy != null && ev.attempts >= PROGRESS_THRESHOLDS.chapterPractised) return 'practised';
      const any = (ev?.attempts || 0) > 0 || Number(seen[key]?.questions) > 0 || Number(seen[String(i)]?.questions) > 0;
      return any ? 'started' : 'empty';
    });
  };
  const chapterTicks = c => {
    const st = dotStates(c);
    const n = st.length;
    const secure = st.filter(x => x === 'practised').length;
    const building = st.filter(x => x === 'started').length;
    // One tick per topic up to 8; beyond that, 8 ticks in proportion (a tick is
    // secure when most of its share is, building when any of it has started).
    const cells = n <= 8 ? st : Array.from({ length: 8 }, (_, k) => {
      const part = st.slice(Math.floor((k * n) / 8), Math.floor(((k + 1) * n) / 8));
      const sec = part.filter(x => x === 'practised').length;
      return sec * 2 > part.length ? 'practised' : part.some(x => x !== 'empty') ? 'started' : 'empty';
    });
    return { n, secure, building, cells };
  };
  const chapterSub = (c, ticks) => {
    if (ticks.n) {
      if (ticks.secure) return t('inst.tickPractised', { s: ticks.secure, n: ticks.n });
      if (ticks.building) return t('inst.tickStarted', { b: ticks.building, n: ticks.n });
      return t('inst.notStarted');
    }
    const m = markOf(c.row.id);
    if (m) return `${m.earned}/${m.possible} ${t('inst.mapMarks')}`;
    return c.evidence.attempts ? t('inst.answered', { n: c.evidence.attempts }) : t('inst.notStarted');
  };
  // Phone paging: swipe the scope, or the ‹ › buttons (also for a mouse and for
  // assistive tech). Existing selection state, a new gesture target.
  const step = d => {
    if (!current) return;
    const next = chapters[(current.index + d + chapters.length) % chapters.length];
    if (next) setPick(next.row.id);
  };
  const swipe = React.useRef(null);
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
    return `${Math.round((100 * n) / dps.length)}%`;
  };
  // The resume card's ten segments: the last attempt's own marks, nothing more.
  const resumeMarks = recent && Number.isInteger(recent.marksPossible) && recent.marksPossible > 0 && !recent.repeat
    ? { earned: Math.max(0, Math.min(recent.marksPossible, Number(recent.marksEarned) || 0)), possible: recent.marksPossible } : null;
  const hour = new Date().getHours();

  if (error) return <div className="card" role="alert">{t('inst.indexError')} {error}</div>;

  return (
    <div className="in-index" data-instrument-index>
      {/* The verified page's Home (§5): the one next action, and beside it
          the papers trend and the latest marked work (home/HomeVerified.jsx). */}
      <div className="vp-home" data-verified-home>
        <div className="vp-next">
          <div className="in-greet">
            <small>{user.year ? t('common.classNumber', { n: user.year }) : ''}</small>
            <h1 className="home-greet">{t(greetingKey(hour), { name })}</h1>
          </div>

          {(() => {
            const primary = homeDecision.primary;
            if (primary && (primary.priority >= URGENT || recent === null)) {
              return <NextAction action={primary} copy={actionCopy(primary, user, t, topicName, local?.resume)} online={online} nav={nav} lang={topicLang(primary, topicName, local?.resume)} />;
            }
            return null;
          })()}
          {/* Teacher-set assignments are the classroom product, hidden from
              students in V1 (D10): only where it is on does their absence matter. */}
          {assignments === false && CLASSROOM_ON && (
            <p className="in-note in-cloud-note" role="status">{t('home.cloudUnavailable')}</p>
          )}
          {recent && !(homeDecision.primary && homeDecision.primary.priority >= URGENT) && (
            <div className="in-resume" data-instrument-resume data-home-primary data-kind="last-chapter">
              <div>
                <b id="home-next-title">{t('inst.resumePrefix')} · <span lang="en"><TermGloss text={recent.subtopicName || ''} /></span></b>
                <small>{resumeMarks ? t('inst.resumeMarks', { earned: resumeMarks.earned, possible: resumeMarks.possible }) : t('inst.resumeSub')}</small>
              </div>
              <PageLink into className="in-btn is-primary" to={practiceHref({ subtopic: recent.subtopic, track })} data-home-primary-cta>{t('inst.resume')} <span className="in-kbd" aria-hidden="true">↵</span></PageLink>
              {resumeMarks && resumeMarks.possible <= 10 && (
                <div className="in-seg10" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < resumeMarks.earned ? 'd' : i < resumeMarks.possible ? 'x' : undefined} />)}
                </div>
              )}
            </div>
          )}
        </div>
        <HomeAside exams={local?.exams} recent={recent} action={homeDecision.primary} />
      </div>
      <div className="in-spine">
        {phone && current && (
          <>
            <div className="in-next" style={{ '--cc': `var(${current.colour})` }} data-instrument-next={current.row.id}
              onTouchStart={e => { swipe.current = [e.touches[0].clientX, e.touches[0].clientY]; }}
              onTouchCancel={() => { swipe.current = null; }}
              onTouchEnd={e => {
                const from = swipe.current; swipe.current = null;
                if (!from) return;
                const dx = e.changedTouches[0].clientX - from[0];
                const dy = e.changedTouches[0].clientY - from[1];
                if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
              }}>
              <ChapterScope figure={current.figure} colourVar={current.colour} label={t('inst.scopeLabel', { name: current.row.name })} tracerHint={t('inst.scopeTracer')} probeHint={t('inst.scopeProbe')} />
              <div className="in-next-label">
                <small>{t('inst.chapterN', { n: current.index + 1 })}{markOf(current.row.id) ? ` · ${markOf(current.row.id).earned}/${markOf(current.row.id).possible}` : ''}</small>
                <b lang="en"><TermGloss text={current.row.name} /></b>
              </div>
            </div>
            <div className="in-pager">
              <button type="button" className="in-pager-b" aria-label={t('inst.chapterPrev')} onClick={() => step(-1)}>‹</button>
              <span className="in-pager-n" aria-live="polite">{t('inst.chapterOf', { n: current.index + 1, total: chapters.length })}</span>
              <button type="button" className="in-pager-b" aria-label={t('inst.chapterNext')} onClick={() => step(1)}>›</button>
            </div>
          </>
        )}

        {!curriculum && <div className="skeleton" style={{ height: 380, marginTop: 18 }} aria-hidden="true"><Working pending={!curriculum} size={24} /></div>}

        {curriculum && (
          <nav aria-label={t('inst.chapters')}>
            <ul className="in-chs">
              {chapters.map(c => {
                const on = current?.row.id === c.row.id;
                const ticks = chapterTicks(c);
                return (
                  <li key={c.row.id}>
                    <button type="button" className="in-ch" style={{ '--cc': `var(${c.colour})` }}
                      aria-pressed={on} data-current={on ? 'true' : undefined} data-chapter={c.row.id}
                      onClick={() => setPick(c.row.id)} onFocus={() => setPick(c.row.id)}>
                      <span className="in-ch-n">{String(c.index + 1).padStart(2, '0')}</span>
                      <span className="in-ch-t"><span lang="en"><TermGloss text={c.row.name} /></span>
                        <small className="in-ch-sub">{chapterSub(c, ticks)}</small>
                      </span>
                      {ticks.n > 0 && (
                        <span className="in-ticks" role="img" aria-label={t('inst.tickLabel', { count: ticks.n, s: ticks.secure, n: ticks.n, b: ticks.building })}>
                          {ticks.cells.map((x, k) => <i key={k} className={x === 'empty' ? undefined : x === 'practised' ? 's' : 'b'} />)}
                        </span>
                      )}
                      <Ring value={c.evidence.mastery} colourVar={c.colour} />
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
          {!phone && <ChapterScope figure={current.figure} colourVar={current.colour} label={t('inst.scopeLabel', { name: current.row.name })} tracerHint={t('inst.scopeTracer')} probeHint={t('inst.scopeProbe')} />}
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
              <PageLink into className="in-btn" to={practiceHref({ subtopic: current.row.id, track })} data-instrument-practise>{t('inst.practise')}</PageLink>
            </div>
            {current.evidence.attempts > 0 && current.evidence.accuracy == null && <p className="in-note" style={{ marginTop: 10 }}>{t('inst.accuracyHeld')}</p>}
          </div>
        </section>
      )}
      {curriculum && !chapters.length && <p className="in-empty">{t('inst.noChapters')}</p>}

      {/* What the v1.0 Home offered besides the chapters, so nothing a student
          could reach there is lost when the Index is the home: the review
          queue (dot points due, from the server's own evidence), the study
          plan, photo practice and the exact-topic generator. The due figure is
          the shell's, from GET /reviews. */}
      <section className="in-also" aria-labelledby="in-also-title" data-instrument-also>
        <h2 id="in-also-title">{t('inst.alsoTitle')}</h2>
        <ul className="in-also-list">
          <li>
            <PageLink className="in-also-link" to="/practice" data-instrument-review-queue>
              <span className="in-also-glyph" aria-hidden="true"><Glyph name="doc" size={18} /></span>
              <span className="in-also-text">
                <b>{t('inst.reviewQueue')}</b>
                <small data-instrument-review-due={dueCount}>{dueCount > 0 ? t('inst.reviewQueueDue', { n: dueCount, count: dueCount }) : t('inst.reviewQueueNone')}</small>
              </span>
            </PageLink>
          </li>
          <li>
            <PageLink className="in-also-link" to="/plan" data-instrument-plan>
              <span className="in-also-glyph" aria-hidden="true"><Glyph name="plan" size={18} /></span>
              <span className="in-also-text"><b>{t('nav.plan')}</b><small>{t('inst.planSub')}</small></span>
            </PageLink>
          </li>
          <li>
            <PageLink className="in-also-link" to="/practise-photo" data-home-photo-practise data-instrument-photo>
              <span className="in-also-glyph" aria-hidden="true"><Glyph name="box" size={18} /></span>
              <span className="in-also-text"><b>{t('snap.entry')}</b><small>{t('inst.photoSub')}</small></span>
            </PageLink>
          </li>
        </ul>
        {alternatives.length > 0 && (
          <ul className="in-also-list in-alts" aria-label={t('home.chooseElse')}>
            {alternatives.map(item => {
              const copy = actionCopy(item, user, t, topicName, local?.resume);
              const openable = actionOpenable(item, { online });
              const key = String(item.kind + '-' + item.id).replace(/[^A-Za-z0-9_-]/g, '-');
              return (
                <li key={item.kind + ':' + item.id} data-home-alt>
                  <button type="button" className="in-also-link" disabled={!openable} data-home-alt-offline={openable ? undefined : ''}
                    onClick={() => { if (openable) nav(item.destination); }} aria-describedby={`in-alt-${key}`}>
                    <span className="in-also-text"><b lang={topicLang(item, topicName, local?.resume)}>{copy.title}</b><small id={`in-alt-${key}`}>{openable ? copy.reason : t('home.needsConnection')}</small></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <PlacementCard placement={placement} onGo={path => nav(path)} onSkip={skipPlacement} />
        <LazyReviewQueueCard user={user} />
        <LazyPlanCard user={user} stats={stats} />
        <div className="in-week" data-instrument-week>
          <GoalCard user={user} activity={(homeStats || stats)?.activity || []} />
        </div>
        <div className="in-also-gen" data-instrument-generator>
          <TopicGenerator user={user} curriculum={curriculum} />
        </div>
      </section>
    </div>
  );
}
