const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const time = value => {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const item = (kind, priority, id, data = {}, destination = '/practice', dueAt = null, offlineCaveat = false) =>
  ({ kind, priority, id, data, destination, dueAt, offlineCaveat });

const byPriority = (a, b) =>
  b.priority - a.priority
  || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity)
  || String(a.id || '').localeCompare(String(b.id || ''));

function assignment(row, now) {
  const state = row?.submission?.state || 'not_started';
  if (state === 'submitted') return null;
  const dueAt = time(row?.dueAt);
  const left = dueAt == null ? null : dueAt - now;
  const overdue = left != null && left < 0;
  const started = state === 'started';
  const total = Math.max(1, Math.min(50, Number(row?.specification?.questionCount) || 10));
  const remaining = Math.max(0, total - Math.max(0, Number(row?.submission?.summary?.questionsAnswered) || 0));
  const priority = state === 'returned' ? 96
    : started && (overdue || (left != null && left <= 48 * HOUR)) ? 95
    : overdue || (left != null && left <= DAY) ? 94
    : started ? 90
    : left != null && left <= 7 * DAY ? 76 : 58;
  return item(
    'assignment', priority, row.id,
    { title: row.title || 'Assignment', status: overdue ? 'overdue' : dueAt != null ? 'due' : started ? 'started' : state === 'returned' ? 'returned' : 'ready', remaining },
    row.classId && row.id ? '/practice?classId=' + encodeURIComponent(row.classId) + '&assignment=' + encodeURIComponent(row.id) : '/classes',
    dueAt
  );
}

function task(row, now) {
  if (!row || row.finished) return null;
  const dueAt = time(row.dueAt);
  const left = dueAt == null ? null : dueAt - now;
  const overdue = left != null && left < 0;
  const started = Number(row.done) > 0;
  const classTask = Boolean(row.classId || row.className);
  const priority = overdue ? (classTask ? 92 : 89)
    : left != null && left <= 48 * HOUR ? (classTask ? 88 : 86)
    : started ? 82 : classTask ? 75 : 68;
  return item(
    'task', priority, row.id,
    { title: row.title || 'Practice task', status: overdue ? 'overdue' : dueAt != null ? 'due' : started ? 'started' : 'ready', remaining: Math.max(0, (Number(row.count) || 0) - (Number(row.done) || 0)) },
    row.id ? '/practice?task=' + encodeURIComponent(row.id) : '/tasks',
    dueAt
  );
}

export function resolveHomeRecommendation({
  user, stats = null, dueCount = 0, tasks = [], exams = [], resume = null,
  assignments = [], online = true, cloudReady = true, now = Date.now()
} = {}) {
  if (!user || user.role === 'teacher') return { primary: null, alternatives: [] };
  const rows = [];

  const exam = exams.filter(x => !x?.finished_at)
    .sort((a, b) => (Number(b?.created_at) || 0) - (Number(a?.created_at) || 0))[0];
  if (exam) rows.push(item('exam', 100, exam.id, { title: exam.title || 'Practice exam' }, exam.id ? '/exams/' + encodeURIComponent(exam.id) : '/exams'));

  if (online && cloudReady) for (const row of assignments) {
    const item = assignment(row, now);
    if (item) rows.push(item);
  }

  for (const row of tasks) {
    const item = task(row, now);
    if (item) rows.push(item);
  }

  if (resume) rows.push(item(
    resume.kind === 'task' ? 'task-resume' : 'practice-resume',
    resume.kind === 'task' ? 84 : 83,
    resume.taskId || resume.questionId || 'practice',
    { title: resume.title || '' },
    resume.destination || '/practice'
  ));

  const due = Math.max(0, Number(dueCount) || 0);
  if (due) rows.push(item('reviews', 80, 'reviews', { count: due, n: due }));

  const done = Math.max(0, Number(user?.today?.questions) || 0);
  const goal = Math.max(1, Number(user?.dailyGoal) || 10);
  const hasHistory = Math.max(0, Number(stats?.totals?.attempts) || 0) > 0 || done > 0;
  if (done > 0 && done < goal) { const n = goal - done; rows.push(item('daily-goal', 70, 'daily-goal', { done, goal, remaining: n, n, count: n })); }

  const adaptive = stats?.recommendation || stats?.priorities?.[0];
  if (adaptive && hasHistory) rows.push(item('adaptive', 60, adaptive.subtopic || adaptive.id || 'adaptive', { topic: adaptive.name || '' }));

  if (!hasHistory) rows.push(item('first-practice', 55, 'first-practice', { year: user.year }, '/practice', null, !online));

  rows.push(item('smart-practice', 50, 'smart-practice', {}, '/practice', null, !online));
  rows.sort(byPriority);
  const primary = rows[0] || null;
  return { primary, alternatives: rows.slice(1, 3) };
}

export const HOME_RECOMMENDATION_POLICY = {
  activeExam: 100, returnedAssignment: 96, urgentStartedAssignment: 95, urgentAssignment: 94,
  overdueClassTask: 92, startedAssignment: 90, overduePersonalTask: 89, dueClassTask: 88,
  duePersonalTask: 86, taskOrPracticeResume: 84, dueReviews: 80, futureAssignment: 76,
  classTask: 75, partialDailyGoal: 70, personalTask: 68, adaptive: 60, firstPractice: 55, smartPractice: 50
};
