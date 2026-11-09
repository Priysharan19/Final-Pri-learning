// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Mistake DNA (client/src/engine/mistakeDna.js, GET /v1/habits)
//
//   1 · a move counts only from a named ontology id the engine filed on a
//       wrong, unrevealed practice answer; its chances are every practice
//       answer on a dot point where it has been seen; one occurrence is a
//       one-off, never a habit; two chapters make it cross-chapter; a right
//       twin marks it fixed;
//   2 · rows name the move (an ontology key), never the student;
//   3 · over HTTP, premium is the server's decision, and a device-written
//       event is not evidence.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { HABIT_MIN, mistakeDna } from '../../client/src/engine/mistakeDna.js';
import { checks, registerAccount, startApp, verifyEmail } from './support/app-harness.mjs';
import { requestedEngine } from './support/engine.mjs';
import { asStore } from '../platform/store.js';

const c = checks();
const DAY = 86_400_000;
const T = Date.parse('2026-11-01T06:00:00Z');
let n = 0;
const at = (subtopic, dotpoint, correct, extra = {}) => ({ attemptId: `a${++n}`, at: T + n * 3600_000, subtopic, dotpoint, correct, mode: 'practice', ...extra });

const attempts = [
  // sign-on-transfer: 3 times, in 2 chapters, out of 7 answers on those dot points.
  at('c10-quadratic-equations', '0', false, { misconception: 'sign-on-transfer' }),
  at('c10-quadratic-equations', '0', true),
  at('c10-quadratic-equations', '0', true),
  at('c10-pair-linear-equations', '1', false, { misconception: 'sign-on-transfer' }),
  at('c10-pair-linear-equations', '1', true),
  at('c10-pair-linear-equations', '1', false, { misconception: 'sign-on-transfer' }),
  at('c10-pair-linear-equations', '1', false, { misconception: 'not-a-real-id' }),
  // distribute-sign: once — a one-off.
  at('c10-polynomials', '2', false, { misconception: 'distribute-sign' }),
  // Not evidence: revealed, a paper answer, no committed mark.
  at('c10-quadratic-equations', '0', false, { misconception: 'sign-on-transfer', revealed: true }),
  at('c10-quadratic-equations', '0', false, { misconception: 'sign-on-transfer', mode: 'exam' }),
  at('c10-quadratic-equations', '0', undefined, { misconception: 'sign-on-transfer' })
];
// A right twin of the second sign slip, after the last one.
attempts.push(at('c10-pair-linear-equations', '1', true, { twinOf: 'a4' }));

const dna = mistakeDna(attempts);
const sign = dna.habits.find(r => r.id === 'sign-on-transfer');
c.eq(HABIT_MIN, 2, 'a habit needs at least two occurrences, the study plan\'s floor');
c.deq([sign.times, sign.chances], [3, 8], 'times against chances: every practice answer on a dot point where the move was seen (the twin included)');
c.deq([sign.chapters, sign.crossChapter], [['c10-pair-linear-equations', 'c10-quadratic-equations'], true], 'seen in two chapters, so cross-chapter');
c.ok(sign.lastFixedAt && sign.fixedSinceLast, 'a right twin after the last slip marks the move fixed');
c.eq(dna.habits.length, 1, 'only the repeated move is a habit');
c.deq(dna.oneOffs.map(r => [r.id, r.times, r.habit]), [['distribute-sign', 1, false]], 'a single slip is a one-off, never a habit');
c.ok(![...dna.habits, ...dna.oneOffs].some(r => r.id === 'not-a-real-id'), 'an id outside the ontology is not guessed at');
c.eq(dna.answered, 9, 'revealed, paper and unmarked answers are not counted as answered');
c.match(sign.nameKey, /^misconception\.[a-zA-Z]+\.name$/, 'a row names the move by its ontology key');
c.ok(!JSON.stringify(dna).match(/careless|weak student|bad at/i), 'nothing labels the student');
c.deq(mistakeDna([]), { habits: [], oneOffs: [], answered: 0 }, 'no answers, no profile');
{
  const one = mistakeDna([at('c10-circles', '0', false, { misconception: 'sign-on-transfer' }), at('c10-circles', '0', false, { misconception: 'sign-on-transfer' })]);
  c.eq(one.habits[0].crossChapter, false, 'twice in one chapter is a habit, not cross-chapter');
}

// ── Over HTTP ────────────────────────────────────────────────────────────────
const h = await startApp({ engine: requestedEngine() });
const db = asStore(h.db);
try {
  const now = Date.now();
  let cursor = 1;
  async function student(email, premium) {
    const r = await registerAccount(h, { email });
    await verifyEmail(h, r.account.id);
    if (premium) await db.run("INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,updated_at) VALUES (?,'premium','active','web',?,?) ON CONFLICT(account_id) DO UPDATE SET plan='premium',status='active',current_period_end=excluded.current_period_end", [r.account.id, now + 30 * DAY, now]);
    let seq = 1;
    for (const a of attempts) {
      await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,'graded-attempt',?,?,?,?)",
        [cursor++, `${email}-${a.attemptId}`, r.account.id, 'server-grader', seq++, 'q', a.at, JSON.stringify(a), a.at]);
    }
    for (let i = 0; i < 3; i++) await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,'graded-attempt',?,?,?,?)",
      [cursor++, `${email}-dev${i}`, r.account.id, 'ipad-test', i + 1, 'q', now, JSON.stringify({ attemptId: `dev${i}`, subtopic: 'c10-circles', correct: false, misconception: 'power-of-sum', mode: 'practice' }), now]);
    return r.jar;
  }
  const free = await student('free@example.test', false);
  const paid = await student('paid@example.test', true);
  c.eq((await h.request('/v1/habits')).status, 401, 'no session, no profile');
  const f = (await h.request('/v1/habits', { jar: free })).data;
  c.deq([f.premium, f.habitCount, 'habits' in f], [false, 1, false], 'a free account learns how many moves were found, not what they are');
  const p = (await h.request('/v1/habits', { jar: paid })).data;
  c.deq([p.premium, p.habits.map(r => [r.id, r.times, r.chances])], [true, [['sign-on-transfer', 3, 8]]], 'premium gets the profile, from the server\'s own marks');
  c.ok(![...p.habits, ...p.oneOffs].some(r => r.id === 'power-of-sum'), 'device-written events are not evidence');
} finally {
  await h.close();
}

console.log(`MISTAKE DNA: PASS — ${c.count()}/${c.count()} checks`);
