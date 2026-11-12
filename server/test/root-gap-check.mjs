// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Root-gap finder (client/src/engine/rootGap.js, GET /v1/root-gap)
//
//   1 · the walk goes down one prerequisite link at a time, only while the
//       prerequisite has its own failing evidence; each link carries wrong /
//       chances; it stops at a prerequisite the student holds or has too few
//       answers on, and lists the unanswered ones as unchecked;
//   2 · no evidence, no claim: an empty record, too few answers, or answers
//       that are mostly right produce no gap;
//   3 · over HTTP, premium is the server's decision, and a device-written
//       event is not evidence.
// All records are SYNTHETIC fixtures.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { EVIDENCE_MIN, WRONG_MIN, chapterOfSubtopic, rootGaps } from '../../client/src/engine/rootGap.js';
import { checks, registerAccount, startApp, verifyEmail } from './support/app-harness.mjs';
import { requestedEngine } from './support/engine.mjs';
import { asStore } from '../platform/store.js';

const c = checks();
const DAY = 86_400_000;
const T = Date.parse('2026-11-01T06:00:00Z');
let n = 0;
const at = (subtopic, correct, extra = {}) => ({ attemptId: `a${++n}`, at: T + n * 60_000, subtopic, correct, mode: 'practice', ...extra });
const many = (subtopic, wrong, right, extra) => [...Array(wrong)].map(() => at(subtopic, false, extra)).concat([...Array(right)].map(() => at(subtopic, true, extra)));

const UNKNOWN = 'c7-finding-unknown-current';   // prerequisites: letter-numbers, then integer-operations
const LETTERS = 'c7-letter-numbers-current';    // prerequisite: arithmetic-expressions
const ARITH = 'c7-arithmetic-expressions-current';
const INTS = 'c7-integer-operations-current';

c.eq(chapterOfSubtopic('c7-balance-reasoning'), UNKNOWN, 'a generator id maps to its one chapter');
c.eq(chapterOfSubtopic('not-a-subtopic'), null, 'an unknown subtopic maps to nothing');
c.deq([EVIDENCE_MIN, WRONG_MIN], [4, 2], 'the floors: four marked answers, two of them wrong and more wrong than right');

// ── No evidence, no claim ────────────────────────────────────────────────────
c.deq(rootGaps([]).gaps, [], 'a student with no answers gets no claim');
c.deq(rootGaps(many(UNKNOWN, 3, 0)).gaps, [], 'three wrong answers are below the evidence floor: no claim');
c.deq(rootGaps(many(UNKNOWN, 2, 3)).gaps, [], 'mostly right is not a gap');
c.deq(rootGaps([...many(UNKNOWN, 5, 1, { revealed: true }), ...many(UNKNOWN, 5, 1, { mode: 'exam' }), ...many(UNKNOWN, 5, 0, { correct: undefined })]).gaps, [],
  'revealed, paper and unmarked answers are not evidence');

// ── Failing chapter, nothing known below: the gap starts here, prerequisites unchecked ──
{
  const r = rootGaps(many(UNKNOWN, 4, 1));
  c.eq(r.gaps.length, 1, 'one failing chapter, one row');
  const g = r.gaps[0];
  c.deq([g.from, g.root, g.chain.length], [UNKNOWN, UNKNOWN, 1], 'no failing evidence below: the root is the chapter itself, nothing guessed');
  c.deq(g.unchecked, [LETTERS, INTS], 'its unanswered prerequisites are listed as unchecked, not as gaps');
  c.deq([g.chain[0].wrong, g.chain[0].chances], [4, 5], 'the link shows wrong against chances');
}

// ── Two failing links down, the third held ─────────────────────────────────────
{
  const r = rootGaps([...many('c7-balance-reasoning', 5, 2), ...many(LETTERS, 4, 1), ...many(ARITH, 1, 5), ...many(INTS, 4, 0)]);
  const g = r.gaps[0];
  c.deq(g.chain.map(l => [l.chapter, l.wrong, l.chances, l.state]),
    [[UNKNOWN, 5, 7, 'failing'], [LETTERS, 4, 5, 'failing']], 'follows the first failing prerequisite in authored order, and stops at a held one');
  c.eq(g.root, LETTERS, 'the gap starts at the deepest link with its own failing evidence');
  c.ok(typeof g.chain[1].skill === 'string' && g.chain[1].skill.length > 0, 'each link names the skill the edge uses');
  c.deq(g.unchecked, [], 'the held prerequisite below is evidence, not unchecked');
  c.ok(!r.gaps.some(x => x.from === LETTERS), 'a chapter already inside a longer walk is not its own row');
  c.eq(r.provenance.evidence, 'observational', 'the reading says its links are observational, not causal');
}

// ── A prerequisite with too few answers stops the walk ─────────────────────────
{
  const g = rootGaps([...many(UNKNOWN, 4, 0), ...many(LETTERS, 3, 0)]).gaps[0];
  c.deq([g.root, g.unchecked], [UNKNOWN, [LETTERS, INTS]], 'three wrong answers below do not extend the chain: the walk never guesses');
}
c.ok(!JSON.stringify(rootGaps([...many(UNKNOWN, 4, 0), ...many(LETTERS, 4, 0)])).match(/weak|careless|bad at|causes/i), 'nothing labels the student or claims a cause');

// ── Over HTTP ────────────────────────────────────────────────────────────────
const fixture = [...many(UNKNOWN, 5, 2), ...many(LETTERS, 4, 1)];
const h = await startApp({ engine: requestedEngine() });
const db = asStore(h.db);
try {
  const now = Date.now();
  let cursor = 1;
  async function student(email, premium, rows) {
    const r = await registerAccount(h, { email });
    await verifyEmail(h, r.account.id);
    if (premium) await db.run("INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,updated_at) VALUES (?,'premium','active','web',?,?) ON CONFLICT(account_id) DO UPDATE SET plan='premium',status='active',current_period_end=excluded.current_period_end", [r.account.id, now + 30 * DAY, now]);
    let seq = 1;
    for (const a of rows) {
      await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,'graded-attempt',?,?,?,?)",
        [cursor++, `${email}-${a.attemptId}`, r.account.id, 'server-grader', seq++, 'q', a.at, JSON.stringify(a), a.at]);
    }
    // Device-written failures on arithmetic: never evidence.
    for (let i = 0; i < 6; i++) await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,'graded-attempt',?,?,?,?)",
      [cursor++, `${email}-dev${i}`, r.account.id, 'ipad-test', i + 1, 'q', now, JSON.stringify({ attemptId: `dev${i}`, subtopic: ARITH, correct: false, mode: 'practice' }), now]);
    return r.jar;
  }
  const free = await student('free@example.test', false, fixture);
  const paid = await student('paid@example.test', true, fixture);
  const empty = await student('empty@example.test', true, []);
  c.eq((await h.request('/v1/root-gap')).status, 401, 'no session, no reading');
  const f = (await h.request('/v1/root-gap', { jar: free })).data;
  c.deq([f.premium, f.gapCount, 'gaps' in f], [false, 1, false], 'a free account learns how many gaps there are, not where');
  const p = (await h.request('/v1/root-gap', { jar: paid })).data;
  c.deq([p.premium, p.gaps.map(g => [g.from, g.root, g.chain.length])], [true, [[UNKNOWN, LETTERS, 2]]], 'premium gets the walk, from the server\'s own marks');
  c.deq(p.gaps[0].unchecked, [ARITH], 'device-written answers on arithmetic are not evidence: it stays unchecked');
  const e = (await h.request('/v1/root-gap', { jar: empty })).data;
  c.deq([e.premium, e.gaps, e.answered], [true, [], 0], 'a premium student with no evidence gets no claim');
} finally {
  await h.close();
}

console.log(`ROOT GAP: PASS — ${c.count()}/${c.count()} checks [SYNTHETIC fixtures]`);
