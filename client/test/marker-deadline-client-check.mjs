// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a marker stopped at its deadline is not a wrong answer
//
// Marking runs in a server worker under a hard deadline (server/platform/
// markerPool.js). A worker stopped at that deadline — a starved machine, never
// the answer — is answered like an entry the marker could not read: invalid,
// unresolved, nothing spent, nothing recorded. The device used to flatten the
// two into one shape, so nothing downstream could tell "write it simply" from
// "the marker did not finish; send it again as it is". The device now carries
// the server's word — `tooComplex` and `code` — through to the card and the
// suites. This is hardening against a so far unobserved trigger: issue #544's
// failing run logged no deadline stop at all; its cause was the server's
// unseeded question dice (crypto.randomInt in practice.js chooseQuestion),
// now seeded from PRI_SUITE_SEED in the suites' online authority.
//
// Deterministic: the server's pool is swapped for the test worker and told to
// spin on a marker in the answer text, so the deadline is hit on purpose, not
// on a slow machine.
//   1. a stalled marking comes back typed — invalid, unresolved, tooComplex,
//      MARKING_TOO_COMPLEX, the try not spent — and nothing is recorded
//   2. sent again once the marker finishes, the same question is marked normally
//   3. an entry the marker cannot READ is invalid without the deadline word: the
//      two are told apart
//
// Usage: node client/test/marker-deadline-client-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import { installBrowserEnv, rawRows, resetStorage } from './backend-check.mjs';

installBrowserEnv(); resetStorage();
// Only the server marks (owner decision 2026-10-10): every submission below is
// graded by the real /v1 app for a real verified account.
const { startOnlineAuthority, nextSubmissionId } = await import('./support/online-authority.mjs');
const online = await startOnlineAuthority({ label: 'marker-deadline' });
const { dispatch } = await import('../src/local/backend.js');
const idb = await import('../src/local/idb.js');
const { checkAnswer } = await import('../src/engine/checker.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
// The server runs in this process (support/app-harness.mjs), so its pool is
// the one these imports reach.
const { useMarkerPoolForTests, markerPool, closeMarkerPool, MARKING_TOO_COMPLEX, TOO_COMPLEX_MESSAGE } = await import('../../server/platform/markerPool.js');
const { magic } = await import('../../server/test/support/marker-test-worker.mjs');
const TEST_ENTRY = fileURLToPath(new URL('../../server/test/support/marker-test-worker.mjs', import.meta.url));
await loadAllBanks();

let pass = 0;
const failures = [];
const show = v => JSON.stringify(v) ?? String(v);
function ok(name, condition, detail = '') {
  if (condition) { pass++; return true; }
  failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${show(expected)}, got ${show(actual)}`);

// The card names every tap with a stable submission key; the server marks under it.
const POST = (path, body) => dispatch('POST', path,
  /\/submit$/.test(path) && body && body.submissionId === undefined ? { ...body, submissionId: nextSubmissionId('sub_deadline') } : body);

/** The canonical typed form of the oracle's answer, as the other suites derive it. */
function canonicalInput(q) {
  const a = q.answer;
  if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric':
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k === -1 ? '-' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.requireExact) return null;
      return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a}:${a.b}`;
    default: return null;
  }
}

const { user } = await dispatch('POST', '/profiles', { name: 'Deadline Student', course: 'in', indiaTrack: 'cbse', year: 10 });
await online.link(user.id, { entitlement: 'premium' });
const pid = user.id;

/** A served question the oracle can type a right answer for (others are discarded). */
async function typeable(wanting = () => true) {
  for (let i = 0; i < 16; i++) {
    const r = await POST('/practice/next', { mode: 'topic', subtopic: 'c10-quadratic-equations', difficulty: 2, track: 'cbse' });
    const row = await idb.get('questions', r.question.id);
    const key = await online.answerKey(row);
    const right = canonicalInput(key);
    if (right !== null && checkAnswer(key, right).correct === true && wanting(key)) return { id: r.question.id, right, key };
    await POST(`/practice/${r.question.id}/discard`, {});
  }
  throw new Error('no suitable question in sixteen serves');
}
/** Everything a marked answer would leave behind for this profile. */
const recorded = () => {
  const rows = rawRows();
  return {
    answered: rows.questions.filter(r => r.pid === pid && r.answered).length,
    attempts: (rows.attempts || []).filter(r => r.pid === pid).length,
    ratings: rows.ratings.filter(r => r.pid === pid).map(r => [r.subtopic, r.attempts, r.correct]),
    reviews: rows.reviews.filter(r => r.pid === pid).length
  };
};

// ── 1. A stalled marking is typed, and records nothing ──────────────────────
await useMarkerPoolForTests({ entry: TEST_ENTRY, deadlineMs: 150 });
await markerPool().ready();
const one = await typeable();
const before = recorded();
const row0 = await idb.get('questions', one.id);
const stalled = await POST(`/practice/${one.id}/submit`, { answer: magic('spin'), ms: 1200 });
eq('a stalled marking is invalid, unresolved and not correct', [stalled.invalid, stalled.resolved, stalled.correct], [true, false, false]);
eq('…typed as the marker stopped at its deadline', [stalled.tooComplex, stalled.code], [true, MARKING_TOO_COMPLEX]);
eq('…with the try not spent', stalled.triesLeft, 1);
eq('…and the fixed plain sentence', stalled.feedback, TOO_COMPLEX_MESSAGE);
ok('…under the submission it was sent as', typeof stalled.submissionId === 'string' && stalled.submissionId.startsWith('sub_deadline'), show(stalled.submissionId));
ok('nothing from the key comes with it', !('solution' in stalled) && stalled.stepReport == null, show(Object.keys(stalled)));
eq('nothing is recorded: no answered row, no attempt, no rating, no review', recorded(), before);
const row1 = await idb.get('questions', one.id);
eq('the question row is untouched: no try spent, not answered, nothing pending', [row1.tries || 0, row1.answered, row1.pendingGrade ?? null, row1.lastTry ?? null], [row0.tries || 0, 0, null, null]);
const again = await POST(`/practice/${one.id}/submit`, { answer: magic('spin'), ms: 1200 });
eq('a second stalled marking says the same and still records nothing', [again.invalid, again.tooComplex, again.code, recorded()], [true, true, MARKING_TOO_COMPLEX, before]);

// ── 2. Once the marker finishes, the same question is marked normally ───────
await useMarkerPoolForTests({});
await markerPool().ready();
const marked = await POST(`/practice/${one.id}/submit`, { answer: one.right, ms: 1500 });
eq('the right answer, sent again as it is, is marked right', [marked.resolved, marked.correct, marked.invalid === true, 'tooComplex' in marked], [true, true, false, false]);
const afterMark = recorded();
eq('and this time the answer is recorded', [afterMark.answered, afterMark.ratings.length >= 1], [before.answered + 1, true]);

// ── 3. Unreadable and stopped-in-time are told apart ────────────────────────
{
  const gibberish = ['?', 'banana', '∞ ∞'];
  const two = await typeable(key => gibberish.some(g => checkAnswer(key, g).invalid === true));
  const input = gibberish.find(g => checkAnswer(two.key, g).invalid === true);
  const unreadable = await POST(`/practice/${two.id}/submit`, { answer: input, ms: 800 });
  eq('an entry the marker cannot read is invalid and unresolved', [unreadable.invalid, unreadable.resolved], [true, false]);
  ok('but carries no deadline word: the card can tell "write it simply" from "send it again"', unreadable.tooComplex !== true && unreadable.code !== MARKING_TOO_COMPLEX, show({ tooComplex: unreadable.tooComplex, code: unreadable.code }));
  eq('and records nothing either', recorded(), afterMark);
}

await online.close();
await closeMarkerPool();
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  ' + f);
  console.log(`\nMARKER DEADLINE CLIENT: FAIL — ${pass}/${pass + failures.length} checks`);
  process.exit(1);
}
console.log(`MARKER DEADLINE CLIENT: PASS — ${pass}/${pass} checks`);
process.exit(0);
