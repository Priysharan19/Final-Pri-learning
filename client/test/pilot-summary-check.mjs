// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · privacy-safe pilot summary (#141)
//
// The anonymous study-programme summary (local/pilotSummary.js, route
// POST /data/pilot-summary) against the eight acceptance tests in the issue and
// docs/kalp-unsw-2027/pilot-metrics-export-spec.md:
//
//   1. a locked protected profile cannot export
//   2. the file carries none of the prohibited identifiers or content
//   3. the date range is respected, in the profile's own calendar days
//   4. the retry / repeat rule is deterministic
//   5. the totals match a fixture counted by hand
//   6. a participant with no attempts gets zeros and a null accuracy
//   7. making a summary writes nothing
//   8. the backup and the teacher's progress file are unchanged
//
// The clock is fixed, so a failure reproduces.
//
// Usage: node client/test/pilot-summary-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
const NOW = Date.UTC(2026, 9, 22, 6, 0, 0);
Date.now = () => NOW;

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const show = v => JSON.stringify(v);
const eq = (name, actual, expected) => ok(name, show(actual) === show(expected), `expected ${show(expected)}, got ${show(actual)}`);
async function rejects(name, run, want = {}) {
  let err = null;
  try { await run(); } catch (e) { err = e; }
  if (!err) return ok(name, false, 'resolved, expected a refusal');
  const wrong = Object.entries(want).filter(([k, v]) => (k === 'message' ? !v.test(String(err.message)) : err[k] !== v));
  ok(name, !wrong.length, `got ${show({ status: err.status, code: err.code, message: err.message, needsPassword: err.needsPassword })}`);
}
const deepFreeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); } return v; };

installBrowserEnv();
resetStorage();
const { buildPilotSummary, pilotRequest, PILOT_SUMMARY_SCHEMA } = await import(`${SRC}local/pilotSummary.js`);
const { dayKey } = await import(`${SRC}local/entitlementGate.js`);
const { timezoneOf } = await import(`${SRC}lib/locale.js`);

// ── The hand-counted fixture ─────────────────────────────────────────────────
// India Standard Time is UTC+05:30, so 18:29 UTC is 23:59 IST and 18:31 UTC is
// 00:01 IST the next day.
const IST = 'Asia/Kolkata';
const istDay = ms => dayKey(ms, IST);
const at = (month, d, h, m) => Date.UTC(2026, month - 1, d, h, m);
const PID = 'p-asha';
const ATTEMPTS = [
  // 31 Aug 23:59 IST: the last minute before the period starts.
  { id: 'a0', pid: PID, subtopic: 'in-c10-polynomials', correct: 1, hintsUsed: 3, createdAt: at(8, 31, 18, 29), answerGiven: 'x^2', questionId: 'q-0' },
  // 1 Sep 00:01 IST: the first minute of the period.
  { id: 'a1', pid: PID, subtopic: 'in-c10-polynomials', correct: 1, hintsUsed: 0, createdAt: at(8, 31, 18, 31), answerGiven: '42', questionId: 'q-1' },
  { id: 'a2', pid: PID, subtopic: 'in-c10-polynomials', correct: 0, hintsUsed: 2, createdAt: at(9, 1, 9, 0), answerGiven: 'Asha Rao', questionId: 'q-2' },
  // A repeat answered correctly: an attempt, not a correct one, not scored.
  { id: 'a3', pid: PID, subtopic: 'in-c10-trigonometry', correct: 1, repeat: true, hintsUsed: 0, createdAt: at(9, 3, 9, 0), answerGiven: '1/2', questionId: 'q-3' },
  { id: 'a4', pid: PID, subtopic: 'in-c10-trigonometry', correct: 1, hintsUsed: 1, createdAt: at(9, 5, 9, 0), answerGiven: 'sin', questionId: 'q-4' },
  // 7 Sep 23:59 IST: the last minute of the period.
  { id: 'a5', pid: PID, subtopic: 'in-c10-statistics', correct: 0, hintsUsed: 0, createdAt: at(9, 7, 18, 29), answerGiven: '7', questionId: 'q-5' },
  // 8 Sep 00:01 IST: the day after.
  { id: 'a6', pid: PID, subtopic: 'in-c10-statistics', correct: 1, hintsUsed: 5, createdAt: at(9, 7, 18, 31), answerGiven: '8', questionId: 'q-6' },
  null,
  { id: 'a7', pid: PID, subtopic: 'in-c10-statistics', correct: 1, createdAt: 'not a time' }
];
const ACTIVITY = [
  { key: `${PID}:2026-08-31`, pid: PID, date: '2026-08-31', questions: 1, correct: 1, ms: 50000 },
  { key: `${PID}:2026-09-01`, pid: PID, date: '2026-09-01', questions: 2, correct: 1, ms: 90000 },
  { key: `${PID}:2026-09-03`, pid: PID, date: '2026-09-03', questions: 1, correct: 0, ms: 30000 },
  { key: `${PID}:2026-09-04`, pid: PID, date: '2026-09-04', questions: 0, correct: 0, ms: 0 },
  { key: `${PID}:2026-09-05`, pid: PID, date: '2026-09-05', questions: 1, correct: 1, ms: 45000 },
  { key: `${PID}:2026-09-07`, pid: PID, date: '2026-09-07', questions: 1, correct: 0, ms: 15000 },
  { key: `${PID}:2026-09-08`, pid: PID, date: '2026-09-08', questions: 1, correct: 1, ms: 99000 }
];
const REQUEST = { participant: 's042', from: '2026-09-01', to: '2026-09-07', baseline: '41.5', post: 63 };
// By hand, 1–7 Sep IST: attempts a1 a2 a3 a4 a5 = 5; repeats a3 = 1;
// correct a1 a4 = 2 (a3 is a repeat); accuracy 2 / (5 − 1) = 0.5; hints
// 0+2+0+1+0 = 3; topics polynomials, trigonometry, statistics = 3; active days
// 1, 3, 5, 7 Sep = 4 (4 Sep recorded no question); practice
// 90000+30000+0+45000+15000 = 180000 ms.
const EXPECTED = {
  activeDays: 4, questionsAttempted: 5, repeatAttempts: 1, correctAttempts: 2, accuracy: 0.5,
  practiceMs: 180000, hintsUsed: 3, topicsTouched: 3, baseline: 41.5, post: 63, completed: null
};
const pick = s => Object.fromEntries(Object.keys(EXPECTED).map(k => [k, s[k]]));
const ALLOWED_KEYS = ['schema', 'rules', 'pilot', 'participant', 'period', 'generatedAt', 'app', 'activeDays', 'questionsAttempted',
  'repeatAttempts', 'correctAttempts', 'accuracy', 'practiceMs', 'hintsUsed', 'topicsTouched', 'baseline', 'post', 'completed', 'limitations'];

// ── 4, 5 · the counting rules on the hand-counted fixture ───────────────────
const attempts = deepFreeze(structuredClone(ATTEMPTS));
const activity = deepFreeze(structuredClone(ACTIVITY));
const summary = buildPilotSummary({ request: REQUEST, attempts, activity, dayOf: istDay, now: NOW });
eq('5 · every total matches the hand count', pick(summary), EXPECTED);
eq('the participant code is normalised to capitals', summary.participant, 'S042');
eq('the period and schema are stated', [summary.schema, summary.rules, summary.pilot, summary.period], [PILOT_SUMMARY_SCHEMA, 'pri-pilot-rules-v1', 'india-student-impact-2026', { from: '2026-09-01', to: '2026-09-07' }]);
eq('the generation time is the clock\'s', summary.generatedAt, new Date(NOW).toISOString());
eq('4 · the same rows give the same file', show(buildPilotSummary({ request: REQUEST, attempts, activity, dayOf: istDay, now: NOW })), show(summary));
const reordered = buildPilotSummary({ request: REQUEST, attempts: [...attempts].reverse(), activity: [...activity].reverse(), dayOf: istDay, now: NOW });
eq('4 · row order does not change a total', pick(reordered), EXPECTED);
const doubled = buildPilotSummary({ request: REQUEST, attempts, activity: [...activity, ...activity], dayOf: istDay, now: NOW });
eq('4 · a day listed twice is counted once', [doubled.activeDays, doubled.practiceMs], [EXPECTED.activeDays, EXPECTED.practiceMs]);
const allRepeats = buildPilotSummary({ request: REQUEST, attempts: [attempts[3]], activity: [], dayOf: istDay, now: NOW });
eq('4 · only repeats: attempted, never correct, no accuracy', [allRepeats.questionsAttempted, allRepeats.correctAttempts, allRepeats.accuracy], [1, 0, null]);

// ── 3 · the date range ──────────────────────────────────────────────────────
const firstDay = buildPilotSummary({ request: { ...REQUEST, to: '2026-09-01' }, attempts, activity, dayOf: istDay, now: NOW });
eq('3 · 00:01 IST on the first day is in, 23:59 IST the evening before is out', [firstDay.questionsAttempted, firstDay.hintsUsed], [2, 2]);
const lastDay = buildPilotSummary({ request: { ...REQUEST, from: '2026-09-07' }, attempts, activity, dayOf: istDay, now: NOW });
eq('3 · 23:59 IST on the last day is in, 00:01 IST the next morning is out', [lastDay.questionsAttempted, lastDay.hintsUsed, lastDay.practiceMs], [1, 0, 15000]);
const sydney = buildPilotSummary({ request: REQUEST, attempts, activity, dayOf: ms => dayKey(ms, 'Australia/Sydney'), now: NOW });
ok('3 · days are the profile\'s own calendar days, not UTC', sydney.questionsAttempted !== summary.questionsAttempted || sydney.hintsUsed !== summary.hintsUsed);

// ── 6 · zero attempts ───────────────────────────────────────────────────────
const empty = buildPilotSummary({ request: { participant: 'S7', from: '2026-09-01', to: '2026-09-07' }, attempts: [], activity: [], dayOf: istDay, now: NOW });
eq('6 · no attempts: zeros, a null accuracy, no scores', pick(empty),
  { activeDays: 0, questionsAttempted: 0, repeatAttempts: 0, correctAttempts: 0, accuracy: null, practiceMs: 0, hintsUsed: 0, topicsTouched: 0, baseline: null, post: null, completed: null });

// ── 2 · nothing prohibited ──────────────────────────────────────────────────
const text = JSON.stringify(summary);
eq('2 · the file holds exactly the listed fields', Object.keys(summary), ALLOWED_KEYS);
for (const leak of [PID, 'Asha', 'x^2', 'q-1', 'in-c10-polynomials', 'answerGiven', 'questionId', 'subtopic', 'strokes', 'photo', 'email', '"pid"', '"name"']) {
  ok(`2 · the file does not contain ${leak}`, !text.includes(leak));
}
eq('2 · no completion rule is invented: completed is null until the programme declares one', summary.completed, null);
ok('the integrity boundary travels with the file', summary.limitations.some(l => /does not show that Pri Learning caused/.test(l)));

// ── what a request may ask for ──────────────────────────────────────────────
const refuse = (name, input, message) => rejects(name, async () => pilotRequest({ ...REQUEST, ...input }), { status: 400, message });
await refuse('a name is not a participant code', { participant: 'Asha' }, /participant code/);
await refuse('an email address is not a participant code', { participant: 'asha@example.com' }, /participant code/);
await refuse('a code that is too long is refused', { participant: 'S1234567' }, /participant code/);
await refuse('an impossible date is refused', { from: '2026-02-30' }, /start date and an end date/);
await refuse('an end before the start is refused', { from: '2026-09-08' }, /on or before/);
await refuse('a period over a year is refused', { from: '2025-01-01', to: '2026-09-07' }, /a year or less/);
await refuse('a baseline over 100% is refused', { baseline: 101 }, /percentage/);
await refuse('a post-test that is not a number is refused', { post: 'high' }, /percentage/);
await refuse('an unknown programme is refused', { pilot: 'constructor' }, /programme/);
eq('an empty score is no score', [pilotRequest({ ...REQUEST, baseline: '', post: null }).baseline, pilotRequest({ ...REQUEST, baseline: '', post: null }).post], [null, null]);

// ── Through the app: the local backend and its gateway ──────────────────────
const { dispatch } = await import(`${SRC}local/backend.js`);
const { validateRequest } = await import(`${SRC}local/gateway.js`);
const idb = await import(`${SRC}local/idb.js`);
const call = (method, path, body) => { const c = validateRequest(method, path, body); return dispatch(c.method, c.path, c.body); };

const asha = (await dispatch('POST', '/profiles', { name: 'Asha Rao', year: 10, email: 'asha.rao@example.com' })).user;
const ashaRow = await idb.get('profiles', asha.id);
const ashaDay = ms => dayKey(ms, timezoneOf(ashaRow));
for (const a of ATTEMPTS.filter(Boolean)) await idb.put('attempts', { ...a, id: `${asha.id}:${a.id}`, pid: asha.id });
for (const r of ACTIVITY) await idb.put('activity', { ...r, key: `${asha.id}:${r.date}`, pid: asha.id });

const progressBefore = await call('GET', '/data/progress-file');
const backupBefore = await call('GET', '/data/export');
const diskBefore = JSON.stringify(rawRows());
const viaApp = await call('POST', '/data/pilot-summary', REQUEST);
eq('7 · making a summary writes nothing to the device', JSON.stringify(rawRows()) === diskBefore, true);
eq('8 · the teacher\'s progress file is unchanged', show(await call('GET', '/data/progress-file')), show(progressBefore));
eq('8 · the backup is unchanged', show(await call('GET', '/data/export')), show(backupBefore));
const expectedHere = buildPilotSummary({ request: REQUEST, attempts: ATTEMPTS.filter(Boolean).map(a => ({ ...a, pid: asha.id })), activity: ACTIVITY, dayOf: ashaDay, now: NOW });
eq('5 · the app\'s summary is the builder\'s over this profile\'s rows', pick(viaApp), pick(expectedHere));
const appText = JSON.stringify(viaApp);
for (const leak of [asha.id, 'Asha', 'asha.rao', '@example.com']) ok(`2 · the app\'s file does not contain ${leak}`, !appText.includes(leak));
eq('2 · the app\'s file holds exactly the listed fields', Object.keys(viaApp), ALLOWED_KEYS);
await rejects('the gateway refuses a participant code that is not text', () => call('POST', '/data/pilot-summary', { ...REQUEST, participant: 42 }), { status: 400 });
await rejects('the gateway refuses an oversized field', () => call('POST', '/data/pilot-summary', { ...REQUEST, from: 'x'.repeat(41) }), { status: 413 });
await rejects('the route refuses a malformed request with a 400 the screen can show', () => call('POST', '/data/pilot-summary', { ...REQUEST, participant: 'Asha' }), { status: 400 });

// Another profile on the same device sees only its own rows.
const ravi = (await dispatch('POST', '/profiles', { name: 'Ravi Kumar', year: 10 })).user;
eq('profile isolation: a second profile with no practice gets zeros', pick(await call('POST', '/data/pilot-summary', REQUEST)),
  { ...EXPECTED, activeDays: 0, questionsAttempted: 0, repeatAttempts: 0, correctAttempts: 0, accuracy: null, practiceMs: 0, hintsUsed: 0, topicsTouched: 0 });
ok('the second profile is the one selected', ravi.id !== asha.id);

// ── 1 · a locked protected profile ──────────────────────────────────────────
const meera = (await dispatch('POST', '/profiles', { name: 'Meera Iyer', year: 10, password: 'compass-rose-7' })).user;
const meeraRow = await idb.get('profiles', meera.id);
for (const a of ATTEMPTS.filter(Boolean)) await idb.put('attempts', { ...a, id: `${meera.id}:${a.id}`, pid: meera.id });
for (const r of ACTIVITY) await idb.put('activity', { ...r, key: `${meera.id}:${r.date}`, pid: meera.id });
const meeraDay = ms => dayKey(ms, timezoneOf(meeraRow));
eq('an open protected profile can make its own summary', pick(await call('POST', '/data/pilot-summary', REQUEST)),
  pick(buildPilotSummary({ request: REQUEST, attempts: ATTEMPTS.filter(Boolean), activity: ACTIVITY, dayOf: meeraDay, now: NOW })));
idb.dropDataKeys();
const lockedDisk = JSON.stringify(rawRows());
await rejects('1 · once locked, the protected profile cannot export', () => call('POST', '/data/pilot-summary', REQUEST), { status: 401, needsPassword: true });
ok('1 · and the refusal changed nothing on disk', JSON.stringify(rawRows()) === lockedDisk);

// ── The route is a read ─────────────────────────────────────────────────────
const backendSource = readFileSync(new URL('local/backend.js', SRC), 'utf8');
const routeBody = backendSource.slice(backendSource.indexOf("'POST /data/pilot-summary'"), backendSource.indexOf("'POST /classes/:id/import-progress'"));
ok('7 · the route opens the profile through requireProfile()', /const p = await requireProfile\(\);/.test(routeBody));
ok('7 · the route calls no write (put, add, del, tx, withProfileRow)', !/\b(put|add|del|tx|withProfileRow|enqueue)\(/.test(routeBody), routeBody);
const builderSource = readFileSync(new URL('local/pilotSummary.js', SRC), 'utf8');
ok('the builder imports nothing that could write or send', [...builderSource.matchAll(/^import .* from '([^']+)';$/gm)].every(m => m[1] === '../engine/progressTruth.js'));

if (failures.length) {
  console.log(`\nPILOT SUMMARY: FAIL — ${failures.length} failed, ${pass} passed`);
  for (const f of failures) console.log(`  ✖ ${f}`);
  process.exit(1);
}
console.log(`PILOT SUMMARY: PASS — ${pass}/${pass} checks`);
