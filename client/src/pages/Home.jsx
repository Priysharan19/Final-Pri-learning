import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { cloud } from '../platform/cloudTransport.js';
import { resolveHomeRecommendation, actionOpenable } from '../home/recommendation.js';
import { cacheAssignments, cachedAssignments } from '../home/homeCache.js';
import TopicGenerator from '../home/TopicGenerator.jsx';
import Icon from '../components/Icon.jsx';
import { useApp } from '../App.jsx';
import { dayKey, formatWeekday } from '../lib/locale.js';
import { useT, useTx } from '../i18n/index.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { featureEnabled } from '../platform/features.js';


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

// The per-dot-point review card, lazily like the plan card.
function LazyReviewQueueCard(props) {
  const [Card, setCard] = useState(null);
  useEffect(() => {
    let live = true;
    import('../home/ReviewQueueCard.jsx').then(m => { if (live) setCard(() => m.default); }).catch(() => { });
    return () => { live = false; };
  }, []);
  return Card ? <Card {...props} /> : null;
}

// ── The home decision, shared by both homes ──────────────────────────────────
// The Instrument's Index (the home every build ships, client/interface.config.mjs)
// and this page read the same recommendation, the same placement offer and the
// same week from here, so the Index carries everything the v1.0 Home offered
// and one resolver decides the student's next action for both.
export function useHomeDecision(user, dueCount) {
  const [local, setLocal] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const stats = local?.stats || null;
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  // Every input to the recommendation is read from its own authority; none of
  // it is persisted as truth. A source that fails leaves the rest usable.
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
  const homeDecision = useMemo(() => local ? resolveHomeRecommendation({
    user, stats, dueCount, tasks: local.tasks, exams: local.exams, resume: local.resume,
    assignments: Array.isArray(assignments) ? assignments : [], online, cloudReady: Array.isArray(assignments),
    cachedAssignments: assignments === false ? cachedAssignments(user) : []
  }) : { primary: null, alternatives: [] }, [local, user, stats, dueCount, assignments, online]);
  // A generic "practice" alternative under a practice recommendation says the
  // same thing twice; the manual chooser below already covers it.
  const alternatives = homeDecision.alternatives.filter(item =>
    item.kind !== 'daily-goal'
    && !(item.kind === 'smart-practice' && ['first-practice', 'adaptive', 'smart-practice', 'daily-goal'].includes(homeDecision.primary?.kind)));

  const topicName = useMemo(() => {
    const names = new Map();
    for (const sec of [...(curriculum?.years || []), ...(curriculum?.streams || [])]) {
      for (const sub of sec.subtopics || []) names.set(sub.id, sub.name);
    }
    return id => (id ? names.get(id) || null : null);
  }, [curriculum]);

  return { local, stats, curriculum, assignments, online, homeDecision, alternatives, topicName };
}

// The placement check (flagged, off in production builds) is offered to
// Indian students after onboarding until they take it or say not now.
export function usePlacement(user) {
  const [placement, setPlacement] = useState(null);
  useEffect(() => {
    if (!featureEnabled('placement') || user.course !== 'in' || user.role === 'teacher') return;
    api.get('/placement').then(setPlacement).catch(() => { });
  }, [user.course, user.role]);
  const skip = () => { setPlacement(p => ({ ...p, status: 'skipped' })); api.post('/placement/skip', {}).catch(() => { }); };
  return [placement, skip];
}

export default function Home() {
  const { user, dueCount } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  const { local, stats, curriculum, assignments, online, homeDecision, alternatives, topicName } = useHomeDecision(user, dueCount);
  const [placement, skipPlacement] = usePlacement(user);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.goodMorning') : hour < 18 ? t('home.goodAfternoon') : t('home.goodEvening');
  const firstName = user.name.split(' ')[0];

  return (
    <div className="home-wrap">
      <h1 className="home-greet">{tx('home.greeting', { greeting, name: <b>{firstName}</b> })}</h1>

      <HomeAction primary action={homeDecision.primary} nav={nav} topicName={topicName} resume={local?.resume} />
      {assignments === false && (
        <div className="notice offline home-cloud-note" role="status">
          {t('home.cloudUnavailable')}
        </div>
      )}

      <section className="home-section" aria-labelledby="home-manual-title">
        <h2 className="home-section-title" id="home-manual-title">{t('home.chooseElse')}</h2>
        <PlacementCard placement={placement} onGo={path => nav(path)} onSkip={skipPlacement} />
        <LazyReviewQueueCard user={user} />
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

        <TopicGenerator user={user} curriculum={curriculum} />
      </section>

      <section className="home-section" aria-labelledby="home-week-title">
        <h2 className="home-section-title" id="home-week-title">{t('home.thisWeek')}</h2>
        <GoalCard user={user} activity={stats?.activity || []} />
      </section>
    </div>
  );
}

const WORK_REASONS = {
  overdue: 'home.reason.overdue', due: 'home.reason.due', started: 'home.reason.started',
  returned: 'home.reason.returned', ready: 'home.reason.ready'
};

/** The words for one recommendation. Every claim comes from the action's own data. */
export function actionCopy(action, user, t, topicName, resume) {
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

export function GoalCard({ user, activity }) {
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

export function PlacementCard({ placement, onGo, onSkip }) {
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
            <button className="btn btn-ghost" onClick={() => onGo('/placement?go=1')}>{t('placement.start')}</button>
            <button className="btn btn-quiet" onClick={onSkip}>{t('placement.notNow')}</button>
          </>
        )}
        {placement.status === 'active' && <button className="btn btn-ghost" onClick={() => onGo('/placement')}>{t('placement.resume')}</button>}
        {placement.status === 'finished' && (
          <>
            {rootChapter && <button className="btn btn-ghost" onClick={() => onGo(practiceHref({ subtopic: rootChapter.id, track: 'cbse' }))}>{t('placement.practiseRoot', { chapter: rootChapter.name })}</button>}
            <button className="btn btn-ghost" onClick={() => onGo('/placement')}>{t('placement.seeResult')}</button>
          </>
        )}
      </div>
    </div>
  );
}
