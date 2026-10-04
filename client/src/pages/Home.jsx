import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { cloud } from '../platform/cloudTransport.js';
import { resolveHomeRecommendation, actionOpenable } from '../home/recommendation.js';
import { cacheAssignments, cachedAssignments, loadSavedFilters, saveFilters } from '../home/homeCache.js';
import Icon from '../components/Icon.jsx';
import { useApp } from '../App.jsx';
import { dotpointAvailable, practiceTargetAvailable, topicAvailability } from '../engine/curriculumAvailability.js';
import { dayKey, formatWeekday } from '../lib/locale.js';
import { useT, useTx } from '../i18n/index.js';
import { practiceDifficulties, practiceHref } from '../lib/practiceLinks.js';
import { textMatches, useGlossary } from '../i18n/glossary.js';
import TermGloss from '../components/TermGloss.jsx';
import { featureEnabled } from '../platform/features.js';
import GettingStarted from '../components/GettingStarted.jsx';
import PageState from '../components/PageState.jsx';
import './Home.css';

const DIFF_KEYS = { 1: 'difficulty.1', 2: 'difficulty.2', 3: 'difficulty.3', 4: 'difficulty.4' };
// The rungs of the generate rail, in the order a student narrows a request.
const RAIL = ['year', 'course', 'topics', 'dots', 'difficulty', 'type'];


// The "This week" plan card is loaded after Home has painted. The planner and
// the reminder scheduler are not needed for the first paint, so their code
// stays out of the install (vite.config.js budgets the entry) and arrives as
// its own warm chunk. A chunk that fails to arrive — a first run offline before
// the warm pass — leaves Home without the card rather than without Home: the
// failure is caught here instead of thrown at the route's error boundary.
function LazyPlanCard(props) {
  const [Card, setCard] = useState(null);
  useEffect(() => {
    let live = true;
    import('../home/PlanCard.jsx').then(m => { if (live) setCard(() => m.default); }).catch(() => { });
    return () => { live = false; };
  }, []);
  return Card ? <Card {...props} /> : null;
}

export default function Home() {
  const { user, dueCount } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  const [local, setLocal] = useState(null);
  const [localFailed, setLocalFailed] = useState(false);
  const location = useLocation();
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
  // "Past papers only": the one question-type filter the backend serves (India).
  const [pyq, setPyq] = useState(saved.current.pyq === true);
  const railRefs = useRef({});
  // Typed into the topic filter. Kept out of the saved filter set on purpose:
  // it is how you find a topic, not part of what you asked for.
  const [topicQuery, setTopicQuery] = useState('');
  // The glossary is what lets the filter answer Hinglish. Loading it here means
  // a student with the bridge on can type "trikonmiti"; one without it still
  // gets a working English filter, because textMatches falls back to the label.
  useGlossary(user?.mathsGloss === true);

  // Every input to the recommendation is read from its own authority; none of
  // it is persisted as truth. A source that fails leaves the rest usable.
  useEffect(() => {
    let live = true;
    Promise.allSettled([
      api.get('/stats'), api.get('/curriculum'), api.get('/tasks'),
      api.get('/exams'), api.get('/practice/resume')
    ]).then(([statsR, curriculumR, tasksR, examsR, resumeR]) => {
      if (!live) return;
      // Every source failing at once is the app failing, not an empty page:
      // say so, and offer the one action that helps.
      setLocalFailed([statsR, curriculumR, tasksR, examsR, resumeR].every(r => r.status === 'rejected'));
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
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // Teacher-set assignments exist only with a cloud student session. Offline,
  // or with the cloud unreachable, they are left out rather than guessed at.
  useEffect(() => {
    let live = true;
    (async () => {
      if (!online) { if (live) setAssignments(false); return; }
      try {
        const [me, result] = await Promise.all([cloud.me(), cloud.assignments()]);
        if (!live) return;
        const rows = me?.account?.role === 'student' && Array.isArray(result?.assignments) ? result.assignments : null;
        if (rows) cacheAssignments(user, rows);
        setAssignments(rows);
      } catch (err) {
        if (live) setAssignments(err?.status === 401 || err?.code === 'CLOUD_DISABLED' ? null : false);
      }
    })();
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
    saveFilters(filterOwner.current, { year, sectionKey, subtopic, dotpoint, difficulty, pyq });
  }, [year, sectionKey, subtopic, dotpoint, difficulty, pyq]);

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

  // The profile is already authoritative for region; do not flash the wrong
  // course's copy while the curriculum is still loading.
  const india = user.course === 'in';
  const chips = [];
  // The rail's first rung already shows the class; a chip repeats it only when
  // the request has moved away from the profile's own class.
  if (year != null && year !== user.year) chips.push({ k: 'year', label: t(india ? 'common.classNumber' : 'common.yearNumber', { n: year }), clear: () => { setYear(user.year); setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (section) chips.push({ k: 'course', label: section.label, clear: () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (selSub) chips.push({ k: 'topic', label: selSub.name, clear: () => { setSubtopic(null); setDotpoint(null); } });
  if (dotpoint != null && selSub) chips.push({ k: 'dp', label: t('home.dotpointChip', { n: dotpoint + 1 }), clear: () => setDotpoint(null) });
  if (chosenDifficulty != null) chips.push({ k: 'diff', label: t('home.difficultyChip', { n: chosenDifficulty, label: t(DIFF_KEYS[chosenDifficulty]) }), clear: () => setDifficulty(null) });
  if (pyq && india) chips.push({ k: 'type', label: t('home.typePyq'), clear: () => setPyq(false) });

  const generate = () => {
    if (impossibleTarget) return;
    nav(practiceHref({ subtopic, dotpoint, difficulty: chosenDifficulty, track: section?.track || null, pyq: pyq && india }));
  };

  const resetAll = () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); setDifficulty(null); setPyq(false); setYear(user.year); };

  // The rail: one rung per step of the request, each showing what it holds.
  // Opening a rung opens the chooser on that step; arrow keys move along the
  // rail (WAI-ARIA tabs), so the whole thing works from a keyboard.
  const rungs = RAIL.filter(k => k !== 'type' || india).map(k => ({
    k,
    label: t(k === 'year' ? (india ? 'home.catClass' : 'home.catYear') : k === 'course' ? (india ? 'home.catTrack' : 'home.catCourse')
      : k === 'topics' ? 'home.catTopics' : k === 'dots' ? 'home.catDots' : k === 'difficulty' ? 'home.catDifficulty' : 'home.catType'),
    value: k === 'year' ? t(india ? 'common.classNumber' : 'common.yearNumber', { n: year })
      : k === 'course' ? (section?.label || null)
        : k === 'topics' ? (selSub?.name || null)
          : k === 'dots' ? (dotpoint != null && selSub ? t('home.dotpointChip', { n: dotpoint + 1 }) : null)
            : k === 'difficulty' ? (chosenDifficulty != null ? `D${chosenDifficulty}` : null)
              : (pyq ? t('home.typePyq') : null),
    disabled: (k === 'topics' && !section) || (k === 'dots' && !selSub)
  }));
  const openRung = (k) => { setCat(k); setOpen(true); };
  const onRailKey = (e, i) => {
    const enabled = rungs.filter(r => !r.disabled);
    const at = enabled.findIndex(r => r.k === rungs[i].k);
    let to = null;
    if (e.key === 'ArrowRight') to = enabled[(at + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') to = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') to = enabled[0];
    else if (e.key === 'End') to = enabled[enabled.length - 1];
    if (!to) return;
    e.preventDefault();
    openRung(to.k);
    railRefs.current[to.k]?.focus();
  };
  // Guests see how many free questions remain, when the client is told. The
  // count comes from the profile the server returns and is never computed here.
  const guestLeft = user.guest === true && Number.isFinite(Number(user.guestRemaining)) ? Number(user.guestRemaining) : null;

  const homeDecision = useMemo(() => local ? resolveHomeRecommendation({
    user, stats, dueCount, tasks: local.tasks, exams: local.exams, resume: local.resume,
    assignments: Array.isArray(assignments) ? assignments : [], online, cloudReady: Array.isArray(assignments),
    cachedAssignments: assignments === false ? cachedAssignments(user) : []
  }) : { primary: null, alternatives: [] }, [local, user, stats, dueCount, assignments, online]);
  const topicName = useMemo(() => {
    const names = new Map();
    for (const sec of [...(curriculum?.years || []), ...(curriculum?.streams || [])]) {
      for (const sub of sec.subtopics || []) names.set(sub.id, sub.name);
    }
    return id => (id ? names.get(id) || null : null);
  }, [curriculum]);

  // Today's standing items, kept in view whatever the resolver chose first:
  // reviews that are due, and work left unfinished. Each is shown once — here
  // when it is not already the primary action, and not again below.
  const primaryKind = homeDecision.primary?.kind || null;
  const today = [];
  if (local && dueCount > 0 && primaryKind !== 'reviews') {
    today.push({ k: 'reviews', title: t('home.todayReviews', { count: dueCount, n: dueCount }), cta: t('home.cta.review'), go: () => nav('/practice') });
  }
  if (local?.resume && !String(primaryKind || '').endsWith('resume')) {
    const topic = topicName(local.resume.subtopic) || local.resume.title || '';
    today.push({ k: 'resume', title: topic ? t('home.todayContinueTopic', { topic }) : t('home.todayContinue'), cta: t('home.cta.resume'), go: () => nav(local.resume.destination || '/practice') });
  }
  const shownToday = new Set(today.map(i => i.k === 'reviews' ? 'reviews' : 'resume'));
  // A generic "practice" alternative under a practice recommendation says the
  // same thing twice; the manual chooser below already covers it.
  const alternatives = homeDecision.alternatives.filter(item =>
    item.kind !== 'daily-goal'
    && !(item.kind === 'reviews' && shownToday.has('reviews'))
    && !(item.kind.endsWith('resume') && shownToday.has('resume'))
    && !(item.kind === 'smart-practice' && ['first-practice', 'adaptive', 'smart-practice', 'daily-goal'].includes(homeDecision.primary?.kind)));

  return (
    <div className="home-wrap">
      <h1 className="home-greet">{tx('home.greeting', { greeting, name: <b>{firstName}</b> })}</h1>

      <HomeAction primary action={homeDecision.primary} nav={nav} topicName={topicName} resume={local?.resume} />
      {today.length > 0 && (
        <ul className="home-today" aria-label={t('home.today')} data-home-today>
          {today.map(item => (
            <li key={item.k} className="home-today-row" data-today={item.k}>
              <span className="home-today-title">{item.title}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={item.go}>{item.cta}</button>
            </li>
          ))}
        </ul>
      )}
      {assignments === false && (
        <div className="notice offline home-cloud-note" role="status">
          {t('home.cloudUnavailable')}
        </div>
      )}

      <section className="home-section" aria-labelledby="home-manual-title">
        <h2 className="home-section-title" id="home-manual-title">{t('home.chooseElse')}</h2>
        <PlacementCard placement={placement} onGo={path => nav(path)}
          onSkip={() => { setPlacement(p => ({ ...p, status: 'skipped' })); api.post('/placement/skip', {}).catch(() => { }); }} />
        <LazyPlanCard user={user} stats={stats} />
        {alternatives.length > 0 && (
          <ul className="home-alts">
            {alternatives.map(item => (
              <HomeAction key={item.kind + ':' + item.id} action={item} nav={nav} topicName={topicName} resume={local?.resume} online={online} />
            ))}
          </ul>
        )}

        <button className="btn btn-ghost btn-sm home-photo-entry" data-home-photo-practise onClick={() => nav('/practise-photo')}>
          {t('snap.entry')}
        </button>

        {/* ── Manual practice configuration is deliberately secondary ── */}
        <div className="genbar" data-gen-rail data-open={open ? '' : undefined}>
          {/* The rail itself: every step of the request in a row, each showing
              what it holds. One tap on a rung opens that step's chooser in
              place; there is no second screen between here and Generate. */}
          <div className="gen-rail" role="tablist" aria-label={t('home.showFilters')} aria-orientation="horizontal">
            {rungs.map((r, i) => (
              <button key={r.k} type="button" ref={el => { railRefs.current[r.k] = el; }}
                className={`gen-cat gen-rung${open && cat === r.k ? ' on' : ''}${r.value ? ' has-value' : ''}`}
                role="tab" id={`gen-rung-${r.k}`} aria-selected={open && cat === r.k} aria-controls="gen-pane" aria-expanded={open && cat === r.k}
                tabIndex={(open ? cat === r.k : i === 0) ? 0 : -1} disabled={r.disabled}
                onClick={() => (open && cat === r.k ? setOpen(false) : openRung(r.k))} onKeyDown={e => onRailKey(e, i)}>
                <span className="gen-rung-label">{r.label}</span>
                <span className="gen-rung-value">{r.value || t('home.railAny')}</span>
              </button>
            ))}
          </div>
          <div className={`genbar-head ${open ? 'open' : ''}`}>
            {chips.length === 0 ? (
              <span className="genbar-empty chip" data-gen-summary>{t('home.noFilters')}</span>
            ) : (
              <div className="genbar-chips" data-gen-summary>
                {chips.map(c => (
                  <span className="chip" key={c.k}>{c.label}
                    <button className="chip-x" aria-label={t('home.removeFilter', { filter: c.label })}
                      onClick={e => { e.stopPropagation(); c.clear(); }}><Icon name="close" size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            {chips.length > 0 && (
              <button className="icon-btn" title={t('home.clearFilters')} aria-label={t('home.clearFilters')} onClick={resetAll}><Icon name="review" size={16} /></button>
            )}
            {guestLeft !== null && (
              <span className="genbar-guest" data-guest-remaining={guestLeft}>{t('home.guestLeft', { count: guestLeft, n: guestLeft })}</span>
            )}
            <button className="btn btn-primary" onClick={generate} disabled={impossibleTarget} data-home-generate>{t('home.generate')}</button>
          </div>
          {open && (
            <div className="gen-panel" id="gen-panel">
              <div className="gen-pane" id="gen-pane" role="tabpanel" aria-labelledby={`gen-rung-${cat}`}>
                {cat === 'year' && (
                  <>
                    <div className="gen-pane-title">{t(india ? 'home.pickClass' : 'home.pickYear')}</div>
                    <div className="gen-opts">
                      {[7, 8, 9, 10, 11, 12].map(y => (
                        <button key={y} className={`gen-opt ${year === y ? 'on' : ''}`} aria-pressed={year === y}
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
                        <button key={s.key} className={`gen-opt ${sectionKey === s.key ? 'on' : ''}`} aria-pressed={sectionKey === s.key}
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
                              <button key={s.id} className={`gen-opt ${subtopic === s.id ? 'on' : ''}`} aria-pressed={subtopic === s.id} style={{ textAlign: 'left' }}
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
                          <button key={i} className={`gen-opt ${dotpoint === i ? 'on' : ''}`} aria-pressed={dotpoint === i} style={{ textAlign: 'left' }}
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
                        <button key={d} className={`gen-opt ${difficulty === d ? 'on' : ''}`} aria-pressed={difficulty === d}
                          onClick={() => setDifficulty(difficulty === d ? null : d)}>
                          {`D${d}`} · {t(DIFF_KEYS[d])}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {cat === 'type' && india && (
                  <>
                    <div className="gen-pane-note">{t('home.optional')}</div>
                    <div className="gen-pane-title">{t('home.pickType')}</div>
                    <div className="gen-opts">
                      <button className={`gen-opt ${!pyq ? 'on' : ''}`} aria-pressed={!pyq} onClick={() => setPyq(false)}>{t('home.typeAny')}</button>
                      <button className={`gen-opt ${pyq ? 'on' : ''}`} aria-pressed={pyq} onClick={() => setPyq(true)}>{t('home.typePyq')}</button>
                    </div>
                    <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{t('home.typeNote')}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-week-title">
        <h2 className="home-section-title" id="home-week-title">{t('home.thisWeek')}</h2>
        <GoalCard user={user} activity={stats?.activity || []} />
      </section>

      {localFailed && (
        <PageState kind="error" title={t('home.loadFailedTitle')} body={t('home.loadFailedBody')}
          action={{ label: t('common.tryAgain'), onClick: () => window.location.reload() }} />
      )}

      {/* Getting started: three steps, once per device for a profile with no
          attempts yet, and whenever Settings → Help restarts it. */}
      <GettingStarted
        show={!!local && (location.state?.tour === true || (Number(stats?.totals?.attempts) || 0) === 0)}
        focus={location.state?.tour === true}
        onStart={() => nav('/practice')} />
    </div>
  );
}

const WORK_REASONS = {
  overdue: 'home.reason.overdue', due: 'home.reason.due', started: 'home.reason.started',
  returned: 'home.reason.returned', ready: 'home.reason.ready'
};

/** The words for one recommendation. Every claim comes from the action's own data. */
function actionCopy(action, user, t, topicName, resume) {
  const d = action.data || {};
  const india = user.course === 'in';
  const resumeTopic = action.kind === 'practice-resume' ? topicName(resume?.subtopic) : null;
  const adaptiveTopic = action.kind === 'adaptive' ? (d.topic || null) : null;
  const title = action.kind === 'exam' || action.kind === 'exam-expired' ? (d.title || t('home.next.exam'))
    : action.kind === 'assignment' || action.kind === 'task' ? d.title
      : action.kind === 'task-resume' ? (d.title || t('home.next.resumePractice'))
        : action.kind === 'practice-resume' ? (resumeTopic || t('home.next.resumePractice'))
          : action.kind === 'reviews' ? t('home.next.reviews', d)
            : action.kind === 'daily-goal' ? t('home.goalRemaining', d)
              : action.kind === 'first-practice' ? t(india ? 'home.next.firstIndia' : 'home.next.firstNsw', d)
                : adaptiveTopic ? adaptiveTopic
                  : t('home.next.smart');
  const reason = action.kind === 'exam' ? 'home.reason.examInProgress'
    : action.kind === 'exam-expired' ? 'home.reason.examExpired'
    : action.kind === 'assignment' && d.cached ? 'home.reason.assignmentCached'
    : action.kind === 'assignment' || action.kind === 'task' ? WORK_REASONS[d.status] || 'home.reason.ready'
      : action.kind.endsWith('resume') ? 'home.reason.resume'
        : action.kind === 'reviews' ? 'home.reviewDue'
          : action.kind === 'daily-goal' ? 'home.reason.dailyGoal'
            : action.kind === 'adaptive' ? 'home.reason.adaptive'
              : action.kind === 'first-practice' ? (action.offlineCaveat ? 'home.reason.practiceOffline' : 'home.reason.first')
                : action.offlineCaveat ? 'home.reason.practiceOffline' : 'home.reason.practice';
  const kicker = action.kind === 'exam' || action.kind === 'exam-expired' ? 'home.kicker.exam'
    : action.kind === 'assignment' || action.kind === 'task' ? 'home.kicker.assigned'
      : action.kind.endsWith('resume') ? 'home.kicker.continue'
        : action.kind === 'reviews' ? 'home.kicker.review'
          : action.kind === 'first-practice' ? 'home.kicker.start' : 'home.kicker.next';
  const cta = action.kind === 'exam-expired' ? 'home.next.examResult'
    : action.kind === 'exam' ? 'home.cta.exam'
    : action.kind.endsWith('resume') ? 'home.cta.resume'
      : action.kind === 'reviews' ? 'home.cta.review'
        : action.kind === 'assignment' || action.kind === 'task' ? (d.status === 'started' ? 'home.cta.resume' : 'home.cta.start')
          : action.kind === 'first-practice' ? 'home.cta.start' : 'home.cta.practise';
  const meta = (action.kind === 'assignment' || action.kind === 'task') && d.remaining
    ? t('home.meta.remaining', { count: d.remaining, n: d.remaining }) : '';
  return {
    title, kicker: t(kicker), cta: t(cta), meta,
    reason: t(reason, { ...d, topic: adaptiveTopic || d.topic || '', date: action.dueAt ? new Date(action.dueAt).toLocaleDateString() : '' })
  };
}

function HomeAction({ action, nav, primary, topicName, resume, online = true }) {
  const { user } = useApp();
  const t = useT();
  if (!primary && !action) return null;
  if (primary && !action) {
    // Known content first: the greeting is already on screen, and this region
    // holds its place quietly while the recommendation is worked out.
    return (
      <section className="home-next" data-loading="true" aria-busy="true" aria-labelledby="home-next-title">
        <div className="home-next-kicker">{t('home.kicker.next')}</div>
        <h2 className="home-next-title" id="home-next-title">{t('home.next.working')}</h2>
        <div className="skeleton" style={{ height: 16, width: '60%' }} />
      </section>
    );
  }
  const copy = actionCopy(action, user, t, topicName, resume);
  if (!primary) {
    const key = String(action.kind + '-' + action.id).replace(/[^A-Za-z0-9_-]/g, '-');
    // Offline, an alternative that needs the network says so and stays shut
    // rather than opening onto a failure.
    const openable = actionOpenable(action, { online });
    return (
      <li className="home-alt" data-home-alt>
        <button type="button" disabled={!openable} data-home-alt-offline={openable ? undefined : ''}
          onClick={() => { if (openable) nav(action.destination); }} aria-describedby={`home-alt-${key}`}>
          <span className="home-alt-title">{copy.title}</span>
          <span className="home-alt-reason" id={`home-alt-${key}`}>{openable ? copy.reason : t('home.needsConnection')}</span>
          <span className="home-alt-go" aria-hidden="true"><Icon name="next" /></span>
        </button>
      </li>
    );
  }
  const reasonId = 'home-primary-reason';
  return (
    <section className="home-next" data-home-primary data-kind={action.kind} aria-labelledby="home-next-title">
      <div className="home-next-kicker">{copy.kicker}</div>
      <h2 className="home-next-title" id="home-next-title">{copy.title}</h2>
      <p className="home-next-reason" id={reasonId}>{copy.reason}</p>
      {copy.meta && <p className="home-next-meta">{copy.meta}</p>}
      <div className="home-next-cta">
        <button className="btn btn-primary btn-lg" data-home-primary-cta aria-describedby={reasonId}
          onClick={() => nav(action.destination)}>{copy.cta}</button>
      </div>
    </section>
  );
}

function GoalCard({ user, activity }) {
  const t = useT();
  const done = user.today?.questions || 0;
  const goal = user.dailyGoal || 10;
  const byDate = Object.fromEntries(activity.map(d => [d.date, d]));
  // The week is the student's week: each day is keyed and labelled in the
  // profile's own timezone, the same boundary the backend files activity under.
  const days = Array.from({ length: 7 }, (_, i) => {
    const ms = Date.now() - (6 - i) * 86400000;
    const date = dayKey(ms, user.timezone);
    const row = byDate[date];
    return { date, lbl: formatWeekday(ms, user), hit: (row?.questions || 0) > 0, today: i === 6 };
  });
  const studied = days.filter(d => d.hit).length;
  return (
    <div className="home-week goal-card" data-today={done}>
      <div className="goal-copy">
        <div className="goal-title">
          {done >= goal ? t('home.goalComplete')
            : done > 0 ? t('home.goalRemaining', { count: goal - done, n: goal - done })
              : t('home.goalTarget', { count: goal, n: goal })}
        </div>
        <div className="goal-sub">
          {t('home.todayCount', { done, goal })}
          {user.streak > 0 && <> · {t(done >= goal ? 'home.streakExtended' : 'home.streakOnTheLine', { count: user.streak, n: user.streak })}</>}
        </div>
      </div>
      <div className="week-strip" role="img" aria-label={t('home.weekSummary', { count: studied, n: studied })}>
        {days.map(d => (
          <div key={d.date} className="week-day">
            <div className={`week-dot ${d.hit ? 'hit' : ''} ${d.today ? 'today' : ''}`}>{d.hit ? '✓' : ''}</div>
            <div className="week-lbl">{d.lbl}</div>
          </div>
        ))}
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
