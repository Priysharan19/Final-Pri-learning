// Audit #12: the study plan (and Home's plan card, which reads the same hook)
// takes the mistake notebook and named repeated slips into account.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStudyPlan, slipFocus, REASON_KEYS } from '../src/plan/studyPlan.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let passed = 0; const failures = [];
const check = (name, fn) => { try { fn(); passed++; } catch (e) { failures.push(name + ': ' + e.message); } };
const TODAY = '2026-10-02';
const ms = d => Date.parse(`${d}T06:00:00Z`);
const CANDS = ['ch-a', 'ch-b', 'ch-c', 'ch-d'].map((id, order) => ({ id, name: id, strand: order % 2 ? 'A' : 'G', weight: 5, order, own: true, keys: [id] }));
const base = { candidates: CANDS, ratings: { 'ch-a': { rating: 1000, attempts: 12, correct: 5, last_at: ms('2026-09-25') } }, reviews: [], today: TODAY, weeklyMinutes: 150, nowMs: ms(TODAY) };
const days = p => p.weeks.flatMap(w => w.days);
const slipSessions = p => days(p).flatMap(d => d.sessions.map(s => ({ ...s, day: d.date }))).filter(s => s.reason.key === REASON_KEYS.slip || s.reason.key === REASON_KEYS.notebook);

const misconceptions = [
  { subtopic: 'ch-c', label: 'drops the ± on the square root', count: 3 },
  { subtopic: 'ch-d', label: 'one-off', count: 1 }
];
const notebook = { groups: [
  { subtopic: 'ch-b', misconception: null, open: 2, items: [{ fixed: false, review: { due: true } }, { fixed: false, review: { due: false } }] },
  { subtopic: 'zz-unknown', misconception: { label: 'x' }, open: 4, items: [] }
] };

check('slipFocus: due notebook first, named repeats next; a single slip is not a pattern', () => {
  const f = slipFocus({ misconceptions, notebook });
  assert.deepEqual(f.map(r => r.subtopic), ['ch-b', 'ch-c', 'zz-unknown']);
  assert.equal(f[0].due, 1); assert.equal(f[1].label, 'drops the ± on the square root');
  assert.ok(!f.some(r => r.subtopic === 'ch-d'));
});
check('slipFocus: nothing in, nothing out', () => { assert.deepEqual(slipFocus(), []); assert.deepEqual(slipFocus({ notebook: { groups: [{ subtopic: 'ch-a', open: 0, items: [] }] } }), []); });

const plan = buildStudyPlan({ ...base, slips: slipFocus({ misconceptions, notebook }) });
check('today carries one notebook session for the due second try', () => {
  const today = plan.today.sessions.filter(s => s.reason.key === REASON_KEYS.notebook || s.reason.key === REASON_KEYS.slip);
  assert.equal(today.length, 1);
  assert.equal(today[0].subtopic, 'ch-b'); assert.equal(today[0].reason.key, 'plan.reason.notebook'); assert.equal(today[0].reason.vars.n, 1);
});
check('the named slip gets its own session, naming it', () => {
  const s = slipSessions(plan).find(x => x.subtopic === 'ch-c');
  assert.ok(s, 'ch-c slip session'); assert.equal(s.reason.key, 'plan.reason.slip'); assert.equal(s.reason.vars.slip, 'drops the ± on the square root');
});
check('at most one slip session a day, a repeated slip weekly, unknown chapters never planned', () => {
  for (const d of days(plan)) assert.ok(d.sessions.filter(s => [REASON_KEYS.slip, REASON_KEYS.notebook].includes(s.reason.key)).length <= 1, d.date);
  const byChapter = {};
  for (const s of slipSessions(plan)) (byChapter[s.subtopic] ||= []).push(Date.parse(s.day));
  for (const [id, list] of Object.entries(byChapter)) for (let i = 1; i < list.length; i++) assert.ok(list[i] - list[i - 1] >= 7 * 86400000, id);
  assert.ok(!slipSessions(plan).some(s => s.subtopic === 'zz-unknown'));
});
check('one notebook mistake is never called a repeated slip, and is planned once', () => {
  const single = slipFocus({ notebook: { groups: [{ subtopic: 'ch-c', misconception: { label: 'drops the ±' }, count: 1, open: 1, items: [] }] } });
  assert.equal(single[0].label, null);
  const p = buildStudyPlan({ ...base, slips: single });
  const s = slipSessions(p);
  assert.equal(s.length, 1, 'planned once');
  assert.equal(s[0].reason.key, 'plan.reason.notebook'); assert.equal(s[0].reason.vars.n, 1);
});
check('a notebook group of two under one label is a repeated slip', () => {
  const two = slipFocus({ notebook: { groups: [{ subtopic: 'ch-c', misconception: { label: 'drops the ±' }, count: 2, open: 2, items: [] }] } });
  assert.equal(two[0].label, 'drops the ±'); assert.equal(two[0].repeats, 2);
  const s = slipSessions(buildStudyPlan({ ...base, slips: two }));
  assert.ok(s.length >= 2 && s.every(x => x.reason.key === 'plan.reason.slip'), 'recurs weekly as a slip');
});
check('a due second try is named once, then the repeated slip takes over', () => {
  const both = slipFocus({ misconceptions: [{ subtopic: 'ch-b', label: 'sign error', count: 3 }], notebook: { groups: [{ subtopic: 'ch-b', count: 1, open: 1, items: [{ fixed: false, review: { due: true } }] }] } });
  const s = slipSessions(buildStudyPlan({ ...base, slips: both })).filter(x => x.subtopic === 'ch-b');
  assert.equal(s[0].reason.key, 'plan.reason.notebook'); assert.equal(s[0].day, '2026-10-02');
  assert.ok(s.slice(1).every(x => x.reason.key === 'plan.reason.slip'));
});
check('no slips: the plan is unchanged', () => assert.equal(JSON.stringify(buildStudyPlan(base)), JSON.stringify(buildStudyPlan({ ...base, slips: [] }))));
check('usePlan feeds the notebook and /stats misconceptions in', () => {
  const src = readFileSync(new URL('../src/plan/usePlan.js', import.meta.url), 'utf8');
  assert.match(src, /api\.get\('\/notebook'\)\.catch\(\(\) => null\)/);
  assert.match(src, /slips: slipFocus\(\{ misconceptions: stats\?\.misconceptions, notebook: evidence\.notebook \}\)/);
});
check('reasons in English and Hindi', () => { for (const k of ['plan.reason.slip', 'plan.reason.notebook']) { assert.ok(en[k], k); assert.ok(hi[k], 'hi ' + k); } });

console.log(`PLAN SLIPS: ${failures.length ? 'FAIL' : 'PASS'} — ${passed}/${passed + failures.length} checks`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
