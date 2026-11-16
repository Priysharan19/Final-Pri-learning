import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { cloud } from '../platform/cloudTransport.js';
import { resolveHomeRecommendation } from '../home/recommendation.js';
import { cacheAssignments, cachedAssignments } from '../home/homeCache.js';
import { dayKey, formatWeekday } from '../lib/locale.js';
import { useT } from '../i18n/index.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { featureEnabled } from '../platform/features.js';


// ── The home decision ─────────────────────────────────────────────────────────
// What the student's home shows besides the chapters: the next action from the
// one resolver (home/recommendation.js), the placement offer and the week. The
// home itself is the Instrument's Index (instrument/IndexPage.jsx), the one
// interface every build ships (client/interface.config.mjs); the v1.0 Home page
// that used to live in this file is gone, and this module keeps only the parts
// the Index renders.
export function useHomeDecision(user, dueCount, dueUnit) {
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
    user, stats, dueCount, dueUnit, tasks: local.tasks, exams: local.exams, resume: local.resume,
    assignments: Array.isArray(assignments) ? assignments : [], online, cloudReady: Array.isArray(assignments),
    cachedAssignments: assignments === false ? cachedAssignments(user) : []
  }) : { primary: null, alternatives: [] }, [local, user, stats, dueCount, dueUnit, assignments, online]);
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

const WORK_REASONS = {
  overdue: 'home.reason.overdue', due: 'home.reason.due', started: 'home.reason.started',
  returned: 'home.reason.returned', ready: 'home.reason.ready'
};

/** The words for one recommendation. Every claim comes from the action's own data. */
// The engine's specific reason for its pick. A misconception reason names the
// slip only when the engine named one; a dot point is named only when the pick
// targets one. Anything else keeps the general sentence.
function adaptiveReasonKey(d) {
  const tag = d.reasonTag;
  if (tag === 'misconception') return d.misconception ? 'home.reason.adaptiveSlipNamed' : 'home.reason.adaptiveSlip';
  if (tag === 'review-due') return d.dotpointN ? 'home.reason.adaptiveReviewDp' : 'home.reason.adaptiveReview';
  if (tag === 'weak-spot') return d.dotpointN ? 'home.reason.adaptiveWeakDp' : 'home.reason.adaptiveWeak';
  if (tag === 'new-ground') return 'home.reason.adaptiveNew';
  if (tag === 'interleave') return 'home.reason.adaptiveInterleave';
  return 'home.reason.adaptive';
}

export function actionCopy(action, user, t, topicName, resume) {
  const d = action.data || {};
  const india = user.course === 'in';
  const resumeTopic = action.kind === 'practice-resume' ? topicName(resume?.subtopic) : null;
  const adaptiveTopic = action.kind === 'adaptive' ? (d.topic || null) : null;
  const title = action.kind === 'exam' || action.kind === 'exam-expired' ? (d.title || t('home.next.exam'))
    : action.kind === 'assignment' || action.kind === 'task' ? d.title
      : action.kind === 'task-resume' ? (d.title || t('home.next.resumePractice'))
        : action.kind === 'practice-resume' ? (resumeTopic || t('home.next.resumePractice'))
          : action.kind === 'reviews' ? t(d.unit === 'dotpoint' ? 'review.dueToday' : 'home.next.reviews', d)
            : action.kind === 'daily-goal' ? t('home.goalRemaining', d)
              : action.kind === 'first-practice' ? t(india ? 'home.next.firstIndia' : 'home.next.firstNsw', d)
                : adaptiveTopic ? adaptiveTopic
                  : t('home.next.smart');
  const reason = action.kind === 'exam' ? 'home.reason.examInProgress'
    : action.kind === 'exam-expired' ? 'home.reason.examExpired'
    : action.kind === 'assignment' && d.cached ? 'home.reason.assignmentCached'
    : action.kind === 'assignment' || action.kind === 'task' ? WORK_REASONS[d.status] || 'home.reason.ready'
      : action.kind.endsWith('resume') ? 'home.reason.resume'
        : action.kind === 'reviews' ? 'home.reason.reviews'
          : action.kind === 'daily-goal' ? 'home.reason.dailyGoal'
            : action.kind === 'adaptive' ? adaptiveReasonKey(d)
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
