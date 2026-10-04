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
  || a.id.localeCompare(b.id);

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

// An unfinished paper whose clock ran out is not "in progress": its deadline
// has passed, so nothing more can be written to it and opening it only shows
// the marking of what was autosaved. Papers with no recorded deadline fall back
// to created_at + duration (the backend's own conservative rule). An expired
// paper older than EXPIRED_EXAM_WINDOW is history, not a next action.
const EXPIRED_EXAM_WINDOW = 14 * DAY;
function examDeadline(row) {
  const explicit = time(row?.deadline_at ?? row?.deadlineAt);
  if (explicit != null) return explicit;
  const created = time(row?.created_at ?? row?.createdAt);
  const minutes = Number(row?.duration_min ?? row?.durationMin);
  return created == null ? null : created + Math.max(1, Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60000;
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
  assignments = [], cachedAssignments = [], online = true, cloudReady = true, now = Date.now()
} = {}) {
  // Only a learner gets a learning next action. Teacher, guardian, staff,
  // support and admin profiles (and any role this build does not know) get
  // none, rather than being handed student practice by default.
  if (!user || (user.role || 'student') !== 'student') return { primary: null, alternatives: [] };
  const rows = [];

  const unfinished = exams.filter(x => x && !x.finished_at)
    .sort((a, b) => (Number(b?.created_at) || 0) - (Number(a?.created_at) || 0));
  const live = unfinished.find(x => { const d = examDeadline(x); return d == null || d > now; });
  const expired = unfinished.find(x => { const d = examDeadline(x); return d != null && d <= now && now - d <= EXPIRED_EXAM_WINDOW; });
  const examHref = x => x.id ? '/exams/' + encodeURIComponent(x.id) : '/exams';
  if (live) rows.push(item('exam', 100, live.id, { title: live.title || 'Practice exam' }, examHref(live), examDeadline(live)));
  if (expired) rows.push(item('exam-expired', 81, expired.id, { title: expired.title || 'Practice exam' }, examHref(expired), examDeadline(expired)));

  if (online && cloudReady) for (const row of assignments) {
    const item = assignment(row, now);
    if (item) rows.push(item);
  } else for (const row of cachedAssignments || []) {
    // Offline (or cloud unreachable): the last list this device fetched is
    // shown so the student knows the work exists, marked as cached and never
    // chosen as the primary action — opening an assignment needs the cloud.
    const cached = assignment(row, now);
    if (cached) rows.push({ ...cached, data: { ...cached.data, cached: true }, offlineCaveat: true, requiresNetwork: true });
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
  const primary = rows.find(r => !r.requiresNetwork) || null;
  return { primary, alternatives: rows.filter(r => r !== primary).slice(0, 2) };
}

export const HOME_RECOMMENDATION_POLICY = {
  activeExam: 100, returnedAssignment: 96, urgentStartedAssignment: 95, urgentAssignment: 94,
  overdueClassTask: 92, startedAssignment: 90, overduePersonalTask: 89, dueClassTask: 88,
  duePersonalTask: 86, taskOrPracticeResume: 84, expiredExam: 81, dueReviews: 80, futureAssignment: 76,
  classTask: 75, partialDailyGoal: 70, personalTask: 68, adaptive: 60, firstPractice: 55, smartPractice: 50
};

/**
 * A card that needs the cloud (a cached assignment shown while offline) can be
 * read but not opened: the button is disabled and says why, instead of
 * sending the student to a page that cannot load without a connection.
 */
export function actionOpenable(action, { online = true } = {}) {
  if (!action) return false;
  if (action.requiresNetwork && !online) return false;
  if (action.data?.cached) return false;
  return true;
}
