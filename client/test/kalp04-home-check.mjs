
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_RECOMMENDATION_POLICY, resolveHomeRecommendation } from '../src/home/recommendation.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = rel => readFile(join(ROOT, rel), 'utf8');
const now = Date.parse('2026-10-01T12:00:00+05:30');
const student = {
  id: 'student-1', role: 'student', course: 'in', year: 10,
  indiaTrackName: 'CBSE / NCERT', courseLabel: 'CBSE / NCERT',
  dailyGoal: 10, today: { questions: 0 }
};
const base = {
  user: student,
  stats: { totals: { attempts: 12 }, priorities: [{ id: 'algebra', name: 'Algebra' }] },
  reviews: { due: [] }, tasks: [], exams: [], resume: null,
  assignments: [], online: true, cloudState: 'ready', now
};

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.log('  ✘ ' + name); }
}
const selected = overrides => resolveHomeRecommendation({ ...base, ...overrides }).primary;

check('active exam outranks ordinary work', () => {
  const row = selected({
    exams: [{ id: 'exam-1', title: 'Paper', created_at: now - 1000, finished_at: null }],
    reviews: { due: [{ subtopic: 'x' }] },
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' }
  });
  assert.equal(row.kind, 'exam');
  assert.equal(row.destination, '/exams/exam-1');
});

check('returned teacher assignment is urgent and contextual', () => {
  const row = selected({ assignments: [{
    id: 'a1', classId: 'c1', title: 'Quadratics', dueAt: now + 10 * 86400000,
    specification: { questionCount: 10 }, submission: { state: 'returned', summary: { questionsAnswered: 4 } }
  }] });
  assert.equal(row.kind, 'assignment');
  assert.equal(row.priority, HOME_RECOMMENDATION_POLICY.returnedAssignment);
  assert.equal(row.destination, '/practice?classId=c1&assignment=a1');
});

check('teacher assignment due soon outranks ordinary resume', () => {
  const row = selected({
    assignments: [{ id: 'a2', classId: 'c1', title: 'Due', dueAt: now + 2 * 3600000, specification: { questionCount: 8 } }],
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' }
  });
  assert.equal(row.kind, 'assignment');
});

check('active local resume outranks due reviews', () => {
  const row = selected({
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' },
    reviews: { due: [{ subtopic: 'x' }, { subtopic: 'y' }] }
  });
  assert.equal(row.kind, 'practice-resume');
});

check('due reviews outrank daily goal', () => {
  const row = selected({
    user: { ...student, today: { questions: 4 } },
    reviews: { due: [{ subtopic: 'x' }] }
  });
  assert.equal(row.kind, 'reviews');
});

check('partial daily goal beats generic adaptive work', () => {
  const row = selected({ user: { ...student, today: { questions: 6 } } });
  assert.equal(row.kind, 'daily-goal');
  assert.equal(row.reasonVars.remaining, 4);
});

check('new student receives a real first practice action', () => {
  const row = selected({
    stats: { totals: { attempts: 0 }, priorities: [{ id: 'zero-history', name: 'Algebra' }] },
    user: { ...student, today: { questions: 0 } }
  });
  assert.equal(row.kind, 'first-practice');
  assert.equal(row.destination, '/practice');
});

check('new offline student receives honest caveat', () => {
  const row = selected({
    stats: { totals: { attempts: 0 } },
    user: { ...student, today: { questions: 0 } },
    online: false, cloudState: 'offline'
  });
  assert.equal(row.kind, 'first-practice');
  assert.equal(row.metadata.offlineCaveat, true);
  assert.equal(row.reasonKey, 'home.reason.firstPracticeOffline');
});

check('cloud assignments are excluded while offline', () => {
  const row = selected({
    online: false, cloudState: 'offline',
    assignments: [{ id: 'a3', classId: 'c1', title: 'Cloud only', dueAt: now - 1000 }],
    reviews: { due: [{ subtopic: 'x' }] }
  });
  assert.equal(row.kind, 'reviews');
});

check('cloud failure leaves local recommendation usable', () => {
  const decision = resolveHomeRecommendation({
    ...base, cloudState: 'error',
    assignments: [{ id: 'a4', classId: 'c1', title: 'Unavailable', dueAt: now - 1000 }]
  });
  assert.ok(decision.primary);
  assert.notEqual(decision.primary.kind, 'assignment');
  assert.equal(decision.context.cloudAssignmentsConsidered, false);
});

check('unfinished local class task preserves task context', () => {
  const row = selected({ tasks: [{ id: 't1', title: 'Teacher pack', classId: 'cl', className: '10A', count: 10, done: 3, finished: false, dueAt: now + 6 * 3600000 }] });
  assert.equal(row.kind, 'task');
  assert.equal(row.destination, '/practice?task=t1');
});

check('finished local task is never primary', () => {
  const row = selected({ tasks: [{ id: 't2', title: 'Done', count: 10, done: 10, finished: true }] });
  assert.notEqual(row.id, 't2');
});

check('submitted cloud assignment is never primary', () => {
  const row = selected({ assignments: [{ id: 'a5', classId: 'c1', title: 'Submitted', submission: { state: 'submitted' } }] });
  assert.notEqual(row.id, 'a5');
});

check('teacher role receives no student recommendation', () => {
  const decision = resolveHomeRecommendation({ ...base, user: { ...student, role: 'teacher' } });
  assert.equal(decision.primary, null);
  assert.equal(decision.context.roleSafe, true);
});

check('policy is deterministic under identical inputs', () => {
  const input = { ...base, reviews: { due: [{ subtopic: 'x' }] }, tasks: [{ id: 't4', title: 'Task', count: 10, done: 0, finished: false }] };
  assert.deepEqual(resolveHomeRecommendation(input), resolveHomeRecommendation(input));
});

check('tie-break prefers earlier real deadline', () => {
  const row = selected({ assignments: [
    { id: 'later', classId: 'c', title: 'Later', dueAt: now + 10 * 3600000 },
    { id: 'earlier', classId: 'c', title: 'Earlier', dueAt: now + 2 * 3600000 }
  ] });
  assert.equal(row.id, 'earlier');
});

check('assignment without a due date is not falsely urgent', () => {
  const row = selected({
    assignments: [{ id: 'undated', classId: 'c', title: 'Undated' }],
    reviews: { due: [{ subtopic: 'x' }] }
  });
  assert.equal(row.kind, 'reviews');
});

check('unfinished task question keeps resume priority', () => {
  const row = selected({
    tasks: [{ id: 'task-resume', title: 'Task', count: 10, done: 1, finished: false }],
    resume: { kind: 'task', taskId: 'task-resume', questionId: 'q9', title: 'Task', destination: '/practice?task=task-resume' },
    user: { ...student, today: { questions: 4 } }
  });
  assert.equal(row.kind, 'task-resume');
  assert.equal(row.destination, '/practice?task=task-resume');
});

const [backend, home, app, en, hi, theme] = await Promise.all([
  read('src/local/backend.js'),
  read('src/pages/Home.jsx'),
  read('src/App.jsx'),
  read('src/i18n/strings.en.js'),
  read('src/i18n/strings.hi.js'),
  read('src/theme.css')
]);

check('backend exposes read-only practice resume summary', () => {
  assert.match(backend, /'GET \/practice\/resume'/);
  assert.match(backend, /questionId: row\.id/);
  assert.match(backend, /never question content/i);
});

check('Home consumes one central recommendation resolver', () => {
  assert.match(home, /resolveHomeRecommendation/);
  assert.match(home, /api\.get\('\/practice\/resume'\)/);
  assert.match(home, /cloud\.assignments\(\)/);
});

check('Home uses profile authority for India copy before curriculum loads', () => {
  assert.match(home, /const india = user\.course === 'in';/);
  assert.doesNotMatch(home, /const india = curriculum\?\.country === 'in';/);
});

check('Home exposes exactly one semantic primary recommendation region and CTA', () => {
  assert.equal((home.match(/data-home-primary(?!-)/g) || []).length, 1);
  assert.equal((home.match(/data-home-primary-cta/g) || []).length, 1);
  assert.match(home, /aria-describedby=\{reasonId\}/);
});

check('primary recommendation appears before manual generator in source order', () => {
  assert.ok(home.indexOf('<PrimaryAction') < home.indexOf('className="genbar"'));
});

check('cloud failure is bounded and local learning remains rendered', () => {
  assert.match(home, /cloudState === 'offline' \|\| cloudState === 'error'/);
  assert.match(home, /home\.cloudError/);
});

check('teacher routing remains outside student Home', () => {
  assert.match(app, /user\.role === 'teacher' \? <Navigate to="\/teach"/);
});

check('English and Hindi include command-centre copy', () => {
  for (const source of [en, hi]) {
    assert.match(source, /'home\.nextUp'/);
    assert.match(source, /'home\.cta\.startFirstPractice'/);
    assert.match(source, /'home\.reason\.smartPracticeOffline'/);
  }
});

check('KALP-04 command-centre CSS has responsive and reduced-motion rules', () => {
  assert.match(theme, /\.home-command \{/);
  assert.match(theme, /@media \(max-width: 640px\)/);
  assert.match(theme, /prefers-reduced-motion: reduce/);
});

console.log('');
console.log('KALP-04 HOME SCENARIO CHECK — ' + passed + '/' + (passed + failures.length) + ' checks');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('KALP-04 RECOMMENDATION CONTRACT: PASS');
}
