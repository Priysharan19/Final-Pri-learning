import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { cloud, isGuardianConsentRefusal } from '../platform/cloudTransport.js';
import { resolveHomeRecommendation, actionOpenable } from '../home/recommendation.js';
import { cacheAssignments, cachedAssignments, loadSavedFilters, saveFilters } from '../home/homeCache.js';
import { useApp } from '../App.jsx';
import { dotpointAvailable, practiceTargetAvailable, topicAvailability } from '../engine/curriculumAvailability.js';
import { dayKey, formatWeekday } from '../lib/locale.js';
import { useT, useTx } from '../i18n/index.js';
import { practiceDifficulties, practiceHref } from '../lib/practiceLinks.js';
import { textMatches, useGlossary } from '../i18n/glossary.js';
import TermGloss from '../components/TermGloss.jsx';
import { featureEnabled } from '../platform/features.js';

// Jokes in the idiom of a maths classroom — "The proof is left as an exercise
// for you", "Integrate practice. Differentiate yourself." A translated pun is
// not the same joke, so the Hindi catalogue carries a tagline written for a
// Hindi-medium classroom under each key (उपपत्ति…, इति सिद्धम्), translated in
// spirit rather than pun for pun.
const TAGLINE_KEYS = [
  'home.tagline1',
  'home.tagline2',
  'home.tagline3',
  'home.tagline4',
  'home.tagline5',
  'home.tagline6',
  'home.tagline7',
];

const DIFF_KEYS = { 1: 'difficulty.1', 2: 'difficulty.2', 3: 'difficulty.3', 4: 'difficulty.4' };


export default function Home() {
  const { user, dueCount } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  const [local, setLocal] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const stats = local?.stats || null;
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('year');
  // Filters are saved under the class/track they were chosen in (homeCache.js).
  const filterOwner = useRef(user);
  const saved = useRef(loadSavedFilters(user));
  const [year, setYear] = useState(saved.current.year ?? user.year);
  const [sectionKey, setSectionKey] = useState(saved.current.sectionKey ?? null);
  const [subtopic, setSubtopic] = useState(saved.current.subtopic ?? null);
  const [dotpoint, setDotpoint] = useState(saved.current.dotpoint ?? null);
  const [difficulty, setDifficulty] = useState(saved.current.difficulty ?? null);
  // Typed into the topic filter. Kept out of the saved filter set on purpose:
  // it is how you find a topic, not part of what you asked for.
  const [topicQuery, setTopicQuery] = useState('');
  // The glossary is what lets the filter answer Hinglish. Loading it here means
  // a student with the bridge on can type "trikonmiti"; one without it still
  // gets a working English filter, because textMatches falls back to the label.
  useGlossary(user?.mathsGloss === true);

  useEffect(() => {
    let live = true;
    Promise.allSettled([
      api.get('/stats'), api.get('/curriculum'), api.get('/tasks'),
      api.get('/exams'), api.get('/practice/resume')
    ]).then(([statsR, curriculumR, tasksR, examsR, resumeR]) => {
      if (!live) return;
      if (curriculumR.status === 'fulfilled') setCurriculum(curriculumR.value);
      setLocal({
        stats: statsR.status === 'fulfilled' ? statsR.value : null,
        tasks: tasksR.status === 'fulfilled' ? (tasksR.value.tasks || []) : [],
        exams: examsR.status === 'fulfilled' ? (examsR.value.exams || []) : [],
        resume: resumeR.status === 'fulfilled' ? (resumeR.value.resume || null) : null
      });
    });
    return () => { live = false; };
  }, [user.id]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (!online) {
        if (live) setAssignments(false);
        return;
      }
      try {
        const [me, result] = await Promise.all([cloud.me(), cloud.assignments()]);
        if (!live) return;
        const rows = me?.account?.role === 'student' && Array.isArray(result?.assignments) ? result.assignments : null;
        if (rows) cacheAssignments(user, rows);
        setAssignments(rows);
      } catch (err) {
        if (!live) return;
        // Signed out, no cloud, or a guardian has not confirmed this child's
        // account: none of those is an outage, so no "cloud unavailable" note.
        setAssignments(err?.status === 401 || err?.code === 'CLOUD_DISABLED' || isGuardianConsentRefusal(err) ? null : false);
      }
    };

    load();
    return () => { live = false; };
  }, [online, user.id]);
  // The placement check (flagged, off in production builds) is offered to
  // Indian students after onboarding until they take it or say not now.
  const [placement, setPlacement] = useState(null);
  useEffect(() => {
    if (!featureEnabled('placement') || user.course !== 'in' || user.role === 'teacher') return;
    api.get('/placement').then(setPlacement).catch(() => { });
  }, [user.course, user.role]);
  useEffect(() => {
    saveFilters(filterOwner.current, { year, sectionKey, subtopic, dotpoint, difficulty });
  }, [year, sectionKey, subtopic, dotpoint, difficulty]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.goodMorning') : hour < 18 ? t('home.goodAfternoon') : t('home.goodEvening');
  const firstName = user.name.split(' ')[0];

  // ── sections available for the chosen year ──
  const sections = useMemo(() => {
    if (!curriculum) return [];
    const out = [];
    const core = curriculum.years.find(y => y.year === year);
    if (core) out.push({ key: core.key || `y${year}`, label: curriculum.country === 'in' ? 'CBSE / NCERT' : (year >= 11 ? 'Advanced' : 'Core'), ...core });
    for (const g of curriculum.streams || []) {
      if (g.year === year || g.allYears) out.push({ key: g.key, label: curriculum.country === 'in' ? (g.courseLabel || g.title) : g.title.replace(/^Mathematics\s*/, ''), ...g });
    }
    return out;
  }, [curriculum, year]);

  const section = useMemo(
    () => sections.find(s => s.key === sectionKey) || null,
    [sections, sectionKey]
  );
  // The difficulty buttons this context may offer: never D4 to a CBSE student
  // (CBSE practice is held to D1–D3), and never above the section's ceiling. A
  // remembered D4 from an earlier filter is dropped rather than sent.
  const offeredDifficulties = practiceDifficulties({
    course: user.course, track: section?.track || (user.course === 'in' ? user.indiaTrack || 'cbse' : null),
    grade: section?.year ?? user.year, ceiling: section?.difficultyCeiling || null
  });
  const chosenDifficulty = difficulty != null && offeredDifficulties.includes(difficulty) ? difficulty : null;

  // Indian students type Hindi words in Latin letters and English words in
  // half: "trikonmiti", "trig", "quadratic", "समुच्चय". The matcher folds all
  // four onto the same topic, so the box finds what was meant rather than what
  // was spelled. An empty query matches everything, which is the old behaviour.
  const byStrand = useMemo(() => {
    if (!section) return [];
    const m = new Map();
    for (const s of section.subtopics) {
      if (topicQuery.trim() && !textMatches(s.name, topicQuery) && !textMatches(s.strand || '', topicQuery)) continue;
      if (!m.has(s.strand)) m.set(s.strand, []);
      m.get(s.strand).push(s);
    }
    return [...m.entries()];
  }, [section, topicQuery]);

  const selSub = useMemo(() => {
    if (!subtopic || !curriculum) return null;
    for (const sec of [...(curriculum.years || []), ...(curriculum.streams || [])]) {
      const hit = sec.subtopics.find(s => s.id === subtopic);
      if (hit) return hit;
    }
    return null;
  }, [subtopic, curriculum]);

  const selectedDotpoint = dotpoint != null ? selSub?.dotpoints?.[dotpoint] || null : null;
  const impossibleTarget = Boolean(
    (subtopic && curriculum && !selSub) ||
    (selSub && !practiceTargetAvailable(selSub, dotpoint))
  );

  // A saved filter can outlive a curriculum rationalisation. Do not keep a
  // stale target selected after a source update has removed that chapter or made
  // that exact outcome unavailable in production.
  useEffect(() => {
    if (!curriculum) return;
    if (subtopic && !selSub) {
      setSubtopic(null);
      setDotpoint(null);
      return;
    }
    if (!selSub) return;
    if (!topicAvailability(selSub).selectable) {
      setSubtopic(null);
      setDotpoint(null);
      return;
    }
    if (selectedDotpoint && !dotpointAvailable(selectedDotpoint)) setDotpoint(null);
  }, [curriculum, subtopic, selSub, selectedDotpoint]);

  // The profile is already authoritative for region; do not flash Australian
  // “Year” copy while the asynchronous curriculum response is still loading.
  const india = user.course === 'in';
  const chips = [];
  if (year != null) chips.push({ k: 'year', label: t(india ? 'common.classNumber' : 'common.yearNumber', { n: year }), clear: () => { setYear(user.year); setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (section) chips.push({ k: 'course', label: section.label, clear: () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (selSub) chips.push({ k: 'topic', label: selSub.name, clear: () => { setSubtopic(null); setDotpoint(null); } });
  if (dotpoint != null && selSub) chips.push({ k: 'dp', label: t('home.dotpointChip', { n: dotpoint + 1 }), clear: () => setDotpoint(null) });
  if (chosenDifficulty != null) chips.push({ k: 'diff', label: t('home.difficultyChip', { n: chosenDifficulty, label: t(DIFF_KEYS[chosenDifficulty]) }), clear: () => setDifficulty(null) });

  const generate = () => {
    if (impossibleTarget) return;
    nav(practiceHref({ subtopic, dotpoint, difficulty: chosenDifficulty, track: section?.track || null }));
  };

  const resetAll = () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); setDifficulty(null); setYear(user.year); };

  const homeDecision = useMemo(() => local ? resolveHomeRecommendation({
    user, stats, dueCount, tasks: local.tasks, exams: local.exams, resume: local.resume,
    assignments: Array.isArray(assignments) ? assignments : [], online, cloudReady: Array.isArray(assignments),
    cachedAssignments: assignments === false ? cachedAssignments(user) : []
  }) : { primary: null, alternatives: [] }, [local, user, stats, dueCount, assignments, online]);

  return (
    <div className="home-wrap">
      <h1 className="home-greet">{tx('home.greeting', { greeting, name: <b>{firstName}</b> })}</h1>
      <Tagline />

      <HomeAction primary action={homeDecision.primary} nav={nav} />
      {assignments === false && (
        <div className="card home-cloud-note" role="status">
          {t('home.cloudUnavailable')}
        </div>
      )}

      <div className="home-cards home-support-grid">
        <PlacementCard placement={placement} onGo={path => nav(path)}
          onSkip={() => { setPlacement(p => ({ ...p, status: 'skipped' })); api.post('/placement/skip', {}).catch(() => { }); }} />
        <GoalCard user={user} activity={stats?.activity || []} onGo={() => nav('/practice')} />
        {homeDecision.alternatives.map(item => (
          <HomeAction key={item.kind + ':' + item.id} action={item} nav={nav} online={online} />
        ))}
      </div>

      <section className="home-manual">
        <h2 id="home-manual-title">{t('nav.practice')}</h2>
        <button className="btn btn-ghost btn-sm" data-home-photo-practise onClick={() => nav('/practise-photo')}>
          {t('snap.entry')}
        </button>
      </section>

      {/* ── Manual practice configuration is deliberately secondary ── */}
      <div className="genbar">
        <div className={`genbar-head ${open ? 'open' : ''}`}>
          <button className="genbar-toggle" onClick={() => setOpen(o => !o)}
            aria-label={open ? t('home.hideFilters') : t('home.showFilters')}
            aria-expanded={open} aria-controls="gen-panel">{open ? '⌄' : '⌃'}</button>
          {chips.length === 0 ? (
            <button className="genbar-empty" onClick={() => setOpen(true)}>
              {open ? t('home.noFilters') : t('home.configureFilters')}
            </button>
          ) : (
            <div className="genbar-chips">
              {chips.map(c => (
                <span className="chip" key={c.k}>{c.label}
                  <button className="chip-x" aria-label={t('home.removeFilter', { filter: c.label })}
                    onClick={e => { e.stopPropagation(); c.clear(); }}>✕</button>
                </span>
              ))}
            </div>
          )}
          {chips.length > 0 && (
            <button className="editor-tool" title={t('home.clearFilters')} aria-label={t('home.clearFilters')} onClick={resetAll}>↺</button>
          )}
          <button className="btn btn-primary" style={{ padding: '7px 18px' }} onClick={generate} disabled={impossibleTarget}>{t('home.generate')}</button>
        </div>

        {open && (
          <div className="gen-panel" id="gen-panel">
            <div className="gen-cats">
              {[
                ['year', t(india ? 'home.catClass' : 'home.catYear')], ['course', t(india ? 'home.catTrack' : 'home.catCourse')], ['topics', t('home.catTopics')],
                ['dots', t('home.catDots')], ['difficulty', t('home.catDifficulty')],
              ].map(([k, label]) => (
                <button
                  key={k}
                  className={`gen-cat ${cat === k ? 'on' : ''}`}
                  disabled={(k === 'topics' && !section) || (k === 'dots' && !selSub)}
                  onClick={() => setCat(k)}
                >
                  {label}
                  {((k === 'year') || (k === 'course' && section) || (k === 'topics' && selSub) || (k === 'dots' && dotpoint != null) || (k === 'difficulty' && chosenDifficulty != null)) && <span className="gen-cat-dot" />}
                </button>
              ))}
            </div>

            <div className="gen-pane">
              {cat === 'year' && (
                <>
                  <div className="gen-pane-title">{t(india ? 'home.pickClass' : 'home.pickYear')}</div>
                  <div className="gen-opts">
                    {[7, 8, 9, 10, 11, 12].map(y => (
                      <button key={y} className={`gen-opt ${year === y ? 'on' : ''}`}
                        onClick={() => { setYear(y); setSectionKey(null); setSubtopic(null); setDotpoint(null); setCat('course'); }}>
                        {t(india ? 'common.classNumber' : 'common.yearNumber', { n: y })}{y === user.year ? <small>{t('home.yours')}</small> : null}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {cat === 'course' && (
                <>
                  <div className="gen-pane-title">{t(india ? 'home.pickTrack' : 'home.pickCourse')}</div>
                  <div className="gen-opts">
                    {sections.map(s => (
                      <button key={s.key} className={`gen-opt ${sectionKey === s.key ? 'on' : ''}`}
                        onClick={() => { setSectionKey(s.key); setSubtopic(null); setDotpoint(null); setCat('topics'); }}>
                        {s.label}
                      </button>
                    ))}
                    {!sections.length && <div className="muted">{t('home.loadingSyllabus')}</div>}
                  </div>
                </>
              )}

              {cat === 'topics' && section && (
                <>
                  <div className="gen-pane-note">{t('home.optional')}</div>
                  <div className="gen-pane-title">{t('home.pickTopic')}</div>
                  <input className="input" type="search" value={topicQuery} style={{ marginBottom: 12 }}
                    placeholder={t('gloss.filterTopics')} aria-label={t('gloss.filterTopics')}
                    onChange={e => setTopicQuery(e.target.value)} />
                  {!byStrand.length && <div className="muted">{t('gloss.noTopicMatch', { query: topicQuery.trim() })}</div>}
                  {byStrand.map(([strand, subs]) => (
                    <div key={strand} style={{ marginBottom: 14 }}>
                      <div className="gen-sub-head"><TermGloss text={strand} /></div>
                      <div className="gen-opts">
                        {subs.map(s => {
                          const available = topicAvailability(s).selectable;
                          return (
                            <button key={s.id} className={`gen-opt ${subtopic === s.id ? 'on' : ''}`} style={{ textAlign: 'left' }}
                              disabled={!available}
                              aria-label={available ? s.name : t('home.topicComingSoon', { topic: s.name })}
                              onClick={() => { if (!available) return; setSubtopic(subtopic === s.id ? null : s.id); setDotpoint(null); }}>
                              <TermGloss text={s.name} />{!available ? <small>{t('home.comingSoon')}</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {cat === 'dots' && selSub && (
                <>
                  <div className="gen-pane-note">{t('home.optional')}</div>
                  <div className="gen-pane-title">{t('home.pickDotpoint', { topic: selSub.name })}</div>
                  <div className="gen-opts narrow">
                    {selSub.dotpoints.map((dp, i) => {
                      const text = typeof dp === 'string' ? dp : dp.text;
                      const available = dotpointAvailable(dp);
                      return (
                        <button key={i} className={`gen-opt ${dotpoint === i ? 'on' : ''}`} style={{ textAlign: 'left' }}
                          disabled={!available}
                          aria-label={available ? text : t('home.dotpointComingSoon', { dotpoint: text })}
                          onClick={() => { if (available) setDotpoint(dotpoint === i ? null : i); }}>
                          {text}{!available ? <small>{t('home.formsComingSoon')}</small> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {cat === 'difficulty' && (
                <>
                  <div className="gen-pane-note">{t('home.optional')}</div>
                  <div className="gen-pane-title">{t('home.pickDifficulty')}</div>
                  <div className="gen-opts">
                    {offeredDifficulties.map(d => (
                      <button key={d} className={`gen-opt ${difficulty === d ? 'on' : ''}`}
                        onClick={() => setDifficulty(difficulty === d ? null : d)}>
                        {`D${d}`} · {t(DIFF_KEYS[d])}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlacementCard({ placement, onGo, onSkip }) {
  const t = useT();
  if (!placement?.available || placement.status === 'skipped' || placement.status === 'unavailable') return null;
  const root = placement.result?.rootGaps?.[0] || null;
  const rootChapter = root ? (placement.chapters || []).find(c => c.id === root.chapterId) : null;
  const asked = placement.progress?.asked || 0;
  return (
    <div className="home-card" data-placement-card={placement.status}>
      <span className="sc-label" style={{ margin: 0 }}>{t('placement.title')}</span>
      <p style={{ fontSize: 17, lineHeight: 1.4, margin: '8px 0 12px', maxWidth: 420 }}>
        {placement.status === 'active' ? t('placement.homeActive', { count: asked, n: asked })
          : placement.status === 'finished'
            ? (rootChapter ? t('placement.homeDone', { chapter: rootChapter.name, grade: rootChapter.grade }) : t('placement.homeDoneClean'))
            : t('placement.homeOffer')}
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {placement.status === 'none' && (
          <>
            <button className="btn btn-primary" onClick={() => onGo('/placement?go=1')}>{t('placement.start')}</button>
            <button className="btn btn-quiet" onClick={onSkip}>{t('placement.notNow')}</button>
          </>
        )}
        {placement.status === 'active' && <button className="btn btn-primary" onClick={() => onGo('/placement')}>{t('placement.resume')}</button>}
        {placement.status === 'finished' && (
          <>
            {rootChapter && <button className="btn btn-primary" onClick={() => onGo(practiceHref({ subtopic: rootChapter.id, track: 'cbse' }))}>{t('placement.practiseRoot', { chapter: rootChapter.name })}</button>}
            <button className="btn btn-ghost" onClick={() => onGo('/placement')}>{t('placement.seeResult')}</button>
          </>
        )}
      </div>
    </div>
  );
}

const WORK_REASONS = {
  overdue: 'home.reason.overdue', due: 'home.reason.due', started: 'home.reason.started',
  returned: 'home.reason.returned', ready: 'home.reason.ready'
};

function actionCopy(action, user, t) {
  const d = action.data || {};
  const genericTitle = {
    'practice-resume': 'home.next.resumePractice', reviews: 'nav.review',
    'daily-goal': 'home.goalRemaining',
    'first-practice': user.course === 'in' ? 'home.next.firstIndia' : 'home.next.firstNsw',
    adaptive: 'nav.practice', 'smart-practice': 'nav.practice'
  }[action.kind];
  const title = (action.kind === 'task-resume' ? t('common.continue') + ': ' : '') + (d.title || t(genericTitle, d));
  let reason = action.kind === 'exam' ? 'home.reason.examInProgress'
    : action.kind === 'exam-expired' ? 'home.reason.examExpired'
    : action.kind === 'assignment' && d.cached ? 'home.reason.assignmentCached'
    : action.kind === 'assignment' || action.kind === 'task' ? WORK_REASONS[d.status]
      : action.kind.endsWith('resume') ? 'home.reason.resume'
      : action.kind === 'reviews' ? 'home.reviewDue'
      : action.kind === 'daily-goal' ? 'home.goalTarget'
      : action.kind === 'adaptive' ? 'home.reason.adaptive'
      : action.offlineCaveat ? 'home.reason.practiceOffline' : 'home.reason.practice';
  const cta = action.kind === 'reviews' ? 'nav.review'
    : action.kind === 'exam-expired' ? 'home.next.examResult'
    : ['exam', 'assignment', 'task', 'task-resume', 'practice-resume'].includes(action.kind) ? 'common.continue' : 'nav.practice';
  return { title, reason: t(reason, { ...d, date: action.dueAt ? new Date(action.dueAt).toLocaleDateString() : '' }), cta: t(cta) };
}

function HomeAction({ action, nav, primary, online = true }) {
  const { user } = useApp();
  const t = useT();
  if (!action) return null;
  const copy = actionCopy(action, user, t);
  const openable = actionOpenable(action, { online });
  if (!primary) {
    // Alternatives share CTA words ("Continue", "Practice"), so each button is
    // named by its own card title and described by its own reason.
    const key = String(action.id || action.destination || copy.title).replace(/[^A-Za-z0-9_-]/g, '-');
    const titleId = `home-alt-title-${key}`;
    const reasonId = `home-alt-reason-${key}`;
    return (
      <article className="home-card" data-home-alt aria-labelledby={titleId}>
        <strong id={titleId}>{copy.title}</strong>
        <p id={reasonId}>{copy.reason}</p>
        <button className="btn btn-ghost btn-sm" aria-describedby={reasonId}
          aria-labelledby={`${titleId}-cta ${copy.title === copy.cta ? reasonId : titleId}`}
          disabled={!openable} data-home-alt-offline={openable ? undefined : ''}
          onClick={() => { if (openable) nav(action.destination); }}><span id={`${titleId}-cta`}>{openable ? copy.cta : t('home.needsConnection')}</span></button>
      </article>
    );
  }
  const reasonId = 'home-primary-reason';
  return (
    <section className="card home-command" data-home-primary aria-labelledby="home-next-title">
      <div className="home-command-copy">
        <div className="home-command-kicker">{t('nav.practice')}</div>
        <h2 id="home-next-title">{copy.title}</h2>
        <p id={reasonId}>{copy.reason}</p>
      </div>
      <button className="btn btn-primary home-command-cta" data-home-primary-cta
        aria-describedby={reasonId} onClick={() => nav(action.destination)}>{copy.cta}</button>
    </section>
  );
}

function Tagline() {
  const t = useT();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * TAGLINE_KEYS.length));
  const [len, setLen] = useState(0);
  const [phase, setPhase] = useState('typing'); // typing | holding | deleting

  useEffect(() => {
    const text = t(TAGLINE_KEYS[idx]);
    let timer;
    if (phase === 'typing') {
      if (len < text.length) timer = setTimeout(() => setLen(l => l + 1), 34);
      else timer = setTimeout(() => setPhase('holding'), 4200);
    } else if (phase === 'holding') {
      timer = setTimeout(() => setPhase('deleting'), 2600);
    } else {
      if (len > 0) timer = setTimeout(() => setLen(l => l - 1), 13);
      else { setIdx(i => (i + 1) % TAGLINE_KEYS.length); setPhase('typing'); }
    }
    return () => clearTimeout(timer);
  }, [phase, len, idx, t]);

  return (
    <div className="home-tagline">
      {t(TAGLINE_KEYS[idx]).slice(0, len)}
      <span className="type-caret" />
    </div>
  );
}

function GoalCard({ user, activity, onGo }) {
  const t = useT();
  const done = user.today?.questions || 0;
  const goal = user.dailyGoal || 10;
  const frac = Math.min(1, done / goal);
  const R = 38, C = 2 * Math.PI * R;
  const byDate = Object.fromEntries(activity.map(d => [d.date, d]));
  // The week is the student's week: each day is keyed and labelled in the
  // profile's own timezone, the same boundary the backend files activity under.
  const days = Array.from({ length: 7 }, (_, i) => {
    const ms = Date.now() - (6 - i) * 86400000;
    const date = dayKey(ms, user.timezone);
    const row = byDate[date];
    return {
      date, lbl: formatWeekday(ms, user),
      hit: (row?.questions || 0) > 0, today: i === 6
    };
  });
  return (
    <div className="home-card goal-card" style={{ maxWidth: 420 }}>
      <div className="goal-ring" role="img" aria-label={t('home.goalRing', { done, goal })}>
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle className="goal-ring-track" cx="46" cy="46" r={R} fill="none" strokeWidth="7" />
          <circle className={`goal-ring-fill ${frac >= 1 ? 'done' : ''}`} cx="46" cy="46" r={R} fill="none" strokeWidth="7"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <div className="goal-ring-num">
          <div style={{ textAlign: 'center' }}>
            {done}<span style={{ color: 'var(--ink-3)', fontSize: 13 }}>/{goal}</span>
            <small>{t('home.today')}</small>
          </div>
        </div>
      </div>
      <div className="goal-copy">
        <div className="goal-title">
          {frac >= 1 ? t('home.goalComplete')
            : done > 0 ? t('home.goalRemaining', { count: goal - done, n: goal - done })
              : t('home.goalTarget', { count: goal, n: goal })}
        </div>
        <div className="goal-sub">
          {user.streak > 0
            ? <><span className="streak-flame">▲</span> {t(frac >= 1 ? 'home.streakExtended' : 'home.streakOnTheLine', { count: user.streak, n: user.streak })}</>
            : t('home.startStreak')}
        </div>
        <div className="week-strip" aria-hidden="true">
          {days.map(d => (
            <div key={d.date} className="week-day">
              <div className={`week-dot ${d.hit ? 'hit' : ''} ${d.today ? 'today' : ''}`}>{d.hit ? '✓' : ''}</div>
              <div className="week-lbl">{d.lbl}</div>
            </div>
          ))}
        </div>
        {frac < 1 && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onGo}>
            {done > 0 ? t('home.keepGoing') : t('home.startNow')}
          </button>
        )}
      </div>
    </div>
  );
}
