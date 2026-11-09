// Audit #14: review rows carry their history, Home and the review card share
// one "due" count, and the review card's reason does not repeat its title.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveHomeRecommendation } from '../src/home/recommendation.js';

const read = rel => readFileSync(new URL('../src/' + rel, import.meta.url), 'utf8');
const en = (await import('../src/i18n/strings.en.js')).default;
const t = (k, v = {}) => { let s = en[k] ?? k; if (typeof s === 'object') s = v.count === 1 ? s.one : s.other; return String(s).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? ''); };
let passed = 0; const failures = [];
const check = (name, fn) => { try { fn(); passed++; } catch (e) { failures.push(name + ': ' + e.message); } };

// reviewHistory lives in a .jsx file; evaluate just that function's source.
const card = read('home/ReviewQueueCard.jsx');
const fnSrc = card.slice(card.indexOf('export function reviewHistory'), card.indexOf('export default function'));
const reviewHistory = new Function(fnSrc.replace('export function', 'return function'))();
const DAY = 86400000; const now = Date.parse('2026-11-09T12:00:00Z');

check('history line from the server counts', () =>
  assert.equal(reviewHistory({ attempts: 3, correct: 1, lastAt: now - 12 * DAY }, t, now), 'Last time 1 of 3 right, 12 days ago · '));
check('same-day history says today; one day is singular', () => {
  assert.equal(reviewHistory({ attempts: 2, correct: 2, lastAt: now - 3600000 }, t, now), 'Last time 2 of 2 right, today · ');
  assert.equal(reviewHistory({ attempts: 2, correct: 1, lastAt: now - DAY }, t, now), 'Last time 1 of 2 right, 1 day ago · ');
});
check('no counts, no history claim; correct never exceeds attempts', () => {
  assert.equal(reviewHistory({ recall: 0.4 }, t, now), '');
  assert.match(reviewHistory({ attempts: 2, correct: 5, lastAt: now - DAY }, t, now), /2 of 2/);
});
check('the client keeps attempts, correct and lastAt from the server queue', () =>
  assert.match(read('local/backend.js'), /attempts: Math\.max\(0, Number\(r\.attempts\) \|\| 0\), correct: Math\.max\(0, Number\(r\.correct\) \|\| 0\), lastAt: Number\(r\.lastAt\) \|\| 0/));
check('one due count: App takes the dot-point dueCount when the server queue exists', () => {
  const app = read('App.jsx');
  assert.match(app, /setDueCount\(dp \? \(Number\(dp\.dueCount\) \|\| 0\) : \(r\?\.due\?\.length \|\| 0\)\)/);
  assert.match(app, /setDueUnit\(dp \? 'dotpoint' : 'topic'\)/);
});
check('Home names the unit it counted', () => {
  const user = { id: 's', role: 'student', course: 'in', dailyGoal: 10, today: { questions: 0 } };
  const row = resolveHomeRecommendation({ user, stats: { totals: { attempts: 5 } }, dueCount: 3, dueUnit: 'dotpoint' }).primary;
  assert.equal(row.kind, 'reviews'); assert.equal(row.data.unit, 'dotpoint');
  assert.equal(resolveHomeRecommendation({ user, stats: { totals: { attempts: 5 } }, dueCount: 2 }).primary.data.unit, 'topic');
  assert.match(read('pages/Home.jsx'), /d\.unit === 'dotpoint' \? 'review\.dueToday' : 'home\.next\.reviews'/);
});
check('the review reason does not repeat the title count', () => {
  assert.match(read('pages/Home.jsx'), /action\.kind === 'reviews' \? 'home\.reason\.reviews'/);
  assert.doesNotMatch(en['home.reason.reviews'], /\{n\}/);
  assert.equal(en['home.reviewDue'], undefined);
});

console.log(`REVIEW CONSISTENCY: ${failures.length ? 'FAIL' : 'PASS'} — ${passed}/${passed + failures.length} checks`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
