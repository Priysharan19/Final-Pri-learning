
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const asTime = value => {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const stable = (a, b) =>
  b.priority - a.priority
  || (a.dueAt ?? Number.POSITIVE_INFINITY) - (b.dueAt ?? Number.POSITIVE_INFINITY)
  || String(a.kind).localeCompare(String(b.kind))
  || String(a.id || '').localeCompare(String(b.id || ''));

function action(kind, priority, data = {}) {
  return { kind, priority, destination: null, dueAt: null, metadata: {}, ...data };
}

function assignmentAction(row, now) {
  const state = row?.submission?.state || 'not_started';
  if (state === 'submitted') return null;
  const dueAt = asTime(row?.dueAt);
  const remainingMs = dueAt == null ? null : dueAt - now;
  const overdue = remainingMs != null && remainingMs < 0;
  const target = Math.max(1, Math.min(50, Number(row?.specification?.questionCount) || 10));
  const answered = Math.max(0, Number(row?.submission?.summary?.questionsAnswered) || 0);
  const remaining = Math.max(0, target - answered);

  let priority = 58;
  if (state === 'returned') priority = 96;
  else if (state === 'started' && (overdue || (remainingMs != null && remainingMs <= 48 * HOUR))) priority = 95;
  else if (overdue || (remainingMs != null && remainingMs <= 24 * HOUR)) priority = 94;
  else if (state === 'started') priority = 90;
  else if (remainingMs != null && remainingMs <= 7 * DAY) priority = 76;

  return action('assignment', priority, {
    id: row.id,
    titleKey: state === 'returned' ? 'home.next.assignmentReturned' : 'home.next.assignment',
    titleVars: { title: row.title || 'Assignment' },
    reasonKey: overdue ? 'home.reason.assignmentOverdue'
      : dueAt != null ? 'home.reason.assignmentDue'
        : state === 'started' ? 'home.reason.assignmentStarted' : 'home.reason.assignmentReady',
    reasonVars: { date: dueAt ? new Date(dueAt).toLocaleDateString() : '', remaining },
    ctaKey: state === 'returned' ? 'home.cta.reviseAssignment'
      : state === 'started' ? 'home.cta.resumeAssignment' : 'home.cta.startAssignment',
    destination: row.classId && row.id
      ? '/practice?classId=' + encodeURIComponent(row.classId) + '&assignment=' + encodeURIComponent(row.id)
      : '/classes',
    dueAt,
    metadata: { source: 'cloud-assignment', state, remaining, className: row.className || '' }
  });
}

function taskAction(row, now) {
  if (!row || row.finished) return null;
  const dueAt = asTime(row.dueAt);
  const remainingMs = dueAt == null ? null : dueAt - now;
  const overdue = remainingMs != null && remainingMs < 0;
  const classTask = Boolean(row.classId || row.className);
  const started = Number(row.done) > 0;

  let priority = classTask ? 75 : 68;
  if (overdue) priority = classTask ? 92 : 89;
  else if (remainingMs != null && remainingMs <= 48 * HOUR) priority = classTask ? 88 : 86;
  else if (started) priority = 82;

  return action('task', priority, {
    id: row.id,
    titleKey: classTask ? 'home.next.classTask' : 'home.next.task',
    titleVars: { title: row.title || 'Practice task' },
    reasonKey: overdue ? 'home.reason.taskOverdue'
      : dueAt != null ? 'home.reason.taskDue'
        : started ? 'home.reason.taskStarted' : 'home.reason.taskReady',
    reasonVars: {
      date: dueAt ? new Date(dueAt).toLocaleDateString() : '',
      done: Number(row.done) || 0,
      total: Number(row.count) || 0,
      remaining: Math.max(0, (Number(row.count) || 0) - (Number(row.done) || 0))
    },
    ctaKey: started ? 'home.cta.resumeTask' : 'home.cta.startTask',
    destination: row.id ? '/practice?task=' + encodeURIComponent(row.id) : '/tasks',
    dueAt,
    metadata: { source: 'local-task', classTask, started }
  });
}

function examAction(row) {
  if (!row || row.finished_at) return null;
  return action('exam', 100, {
    id: row.id,
    titleKey: 'home.next.exam',
    titleVars: { title: row.title || 'Practice exam' },
    reasonKey: 'home.reason.examInProgress',
    reasonVars: {},
    ctaKey: 'home.cta.resumeExam',
    destination: row.id ? '/exams/' + encodeURIComponent(row.id) : '/exams',
    metadata: { source: 'local-exam', createdAt: row.created_at || null }
  });
}

function resumeAction(row) {
  if (!row) return null;
  return action(row.kind === 'task' ? 'task-resume' : 'practice-resume', row.kind === 'task' ? 84 : 83, {
    id: row.taskId || row.questionId || 'practice',
    titleKey: row.kind === 'task' ? 'home.next.resumeTask' : 'home.next.resumePractice',
    titleVars: { title: row.title || '' },
    reasonKey: 'home.reason.resume',
    reasonVars: {},
    ctaKey: 'home.cta.resume',
    destination: row.destination || '/practice',
    metadata: { source: 'local-resume', createdAt: row.createdAt || null }
  });
}

export function resolveHomeRecommendation({
  user,
  stats = null,
  reviews = null,
  tasks = [],
  exams = [],
  resume = null,
  assignments = [],
  online = true,
  cloudState = 'unavailable',
  now = Date.now()
} = {}) {
  if (!user || user.role === 'teacher') return { primary: null, alternatives: [], context: { roleSafe: true } };

  const candidates = [];
  const unfinishedExams = (Array.isArray(exams) ? exams : []).filter(e => !e?.finished_at)
    .sort((a, b) => (Number(b?.created_at) || 0) - (Number(a?.created_at) || 0));
  if (unfinishedExams[0]) candidates.push(examAction(unfinishedExams[0]));

  if (online && cloudState === 'ready') {
    for (const row of Array.isArray(assignments) ? assignments : []) {
      const candidate = assignmentAction(row, now);
      if (candidate) candidates.push(candidate);
    }
  }

  const taskCandidates = (Array.isArray(tasks) ? tasks : []).map(row => taskAction(row, now)).filter(Boolean);
  candidates.push(...taskCandidates);

  const resumed = resumeAction(resume);
  if (resumed) candidates.push(resumed);

  const due = Array.isArray(reviews?.due) ? reviews.due : [];
  if (due.length) {
    candidates.push(action('reviews', 80, {
      id: 'reviews',
      titleKey: 'home.next.reviews',
      titleVars: { count: due.length },
      reasonKey: 'home.reviewDue',
      reasonVars: { count: due.length, n: due.length },
      ctaKey: 'home.cta.startReviews',
      destination: '/practice',
      metadata: { source: 'local-reviews', count: due.length }
    }));
  }

  const today = Math.max(0, Number(user?.today?.questions) || 0);
  const goal = Math.max(1, Number(user?.dailyGoal) || 10);
  const attempts = Math.max(0, Number(stats?.totals?.attempts) || 0);
  const hasHistory = attempts > 0 || today > 0;

  if (today > 0 && today < goal) {
    candidates.push(action('daily-goal', 70, {
      id: 'daily-goal',
      titleKey: 'home.next.dailyGoal',
      titleVars: { remaining: goal - today },
      reasonKey: 'home.reason.dailyGoal',
      reasonVars: { done: today, goal, remaining: goal - today },
      ctaKey: 'home.cta.continuePractice',
      destination: '/practice',
      metadata: { source: 'profile-today', done: today, goal }
    }));
  }

  const adaptive = stats?.recommendation || stats?.priorities?.[0] || null;
  if (adaptive && hasHistory) {
    candidates.push(action('adaptive', 60, {
      id: adaptive.subtopic || adaptive.id || 'adaptive',
      titleKey: 'home.next.adaptive',
      titleVars: { topic: adaptive.name || '' },
      reasonKey: 'home.reason.adaptive',
      reasonVars: { topic: adaptive.name || '' },
      ctaKey: 'home.cta.smartPractice',
      destination: '/practice',
      metadata: { source: stats?.recommendation ? 'stats-recommendation' : 'stats-priorities', topic: adaptive.name || '' }
    }));
  }

  if (!hasHistory) {
    candidates.push(action('first-practice', 55, {
      id: 'first-practice',
      titleKey: user.course === 'in' ? 'home.next.firstIndia' : 'home.next.firstNsw',
      titleVars: { year: user.year, track: user.indiaTrackName || user.courseLabel || '' },
      reasonKey: online ? 'home.reason.firstPractice' : 'home.reason.firstPracticeOffline',
      reasonVars: {},
      ctaKey: 'home.cta.startFirstPractice',
      destination: '/practice',
      metadata: { source: 'profile-curriculum', offlineCaveat: !online }
    }));
  }

  candidates.push(action('smart-practice', 50, {
    id: 'smart-practice',
    titleKey: 'home.next.smartPractice',
    titleVars: {},
    reasonKey: online ? 'home.reason.smartPractice' : 'home.reason.smartPracticeOffline',
    reasonVars: {},
    ctaKey: 'home.cta.smartPractice',
    destination: '/practice',
    metadata: { source: 'practice-authority', offlineCaveat: !online }
  }));

  const sorted = candidates.filter(Boolean).sort(stable);
  const primary = sorted[0] || null;
  const alternatives = sorted.filter(row => row !== primary)
    .filter((row, index, all) => all.findIndex(other => other.kind === row.kind && other.id === row.id) === index)
    .slice(0, 3);

  return {
    primary,
    alternatives,
    context: {
      hasHistory,
      dueReviews: due.length,
      cloudState,
      online,
      cloudAssignmentsConsidered: online && cloudState === 'ready',
      authoritativeAdaptive: adaptive ? { name: adaptive.name || '', id: adaptive.subtopic || adaptive.id || null } : null
    }
  };
}

export const HOME_RECOMMENDATION_POLICY = Object.freeze({
  activeExam: 100,
  returnedAssignment: 96,
  urgentStartedAssignment: 95,
  urgentAssignment: 94,
  overdueClassTask: 92,
  startedAssignment: 90,
  overduePersonalTask: 89,
  dueClassTask: 88,
  duePersonalTask: 86,
  taskOrPracticeResume: 84,
  dueReviews: 80,
  futureAssignment: 76,
  classTask: 75,
  partialDailyGoal: 70,
  personalTask: 68,
  adaptive: 60,
  firstPractice: 55,
  smartPractice: 50
});
