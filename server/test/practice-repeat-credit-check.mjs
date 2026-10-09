// Pri Learning · a repeat of content an account has already been shown the
// solution of is marked, and is recorded as a repeat — never as new work.
//
// Over real HTTP: however the same content comes to be issued again (the same
// request, with or without the device's recently-seen list, after a reveal or
// after a resolved answer), the server seals it as a repeat, and both the
// receipt and the server's own graded-attempt event say so. Another account's
// first sitting of that content is not a repeat.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-repeat-credit-'));
process.env.NODE_ENV = 'test'; // fixed seeds: the same content on demand
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
console.log(`engine: ${requestedEngine()}`);
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, seed) => post('/v1/practice/issue', { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' }, jar);
const sealedAnswer = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer;
const eventOf = async id => { const row = await h.db.get("SELECT payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id]); return row ? JSON.parse(row.payload_json) : null; };
let n = 0;
const grade = (jar, id, answer) => { const sid = `repeat-credit-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid }); };

try {
  const a = await registerAccount(h, { email: 'repeat.a@example.test', deviceId: 'ipad-repeat-a' });
  const b = await registerAccount(h, { email: 'repeat.b@example.test', deviceId: 'ipad-repeat-b' });
  eq([(await verifyEmail(h, a.account.id)).status, (await verifyEmail(h, b.account.id)).status], [200, 200], 'two verified accounts');

  // first sitting, resolved by a correct answer
  const first = await issue(a.jar, 4242);
  eq([first.status, first.data.repeat ?? false], [201, false], 'a first sitting is not a repeat');
  const firstGrade = await grade(a.jar, first.data.question.id, (await sealedAnswer(first.data.question.id)).value);
  eq([firstGrade.data.correct, firstGrade.data.repeat ?? false], [true, false], 'its receipt is not a repeat');
  eq((await eventOf(first.data.question.id)).repeat ?? false, false, 'nor is its attempt');

  // the same content again, with no recently-seen list from the device
  const again = await issue(a.jar, 4242);
  eq([again.status, again.data.repeat, again.data.question.prompt === first.data.question.prompt], [201, true, true], 'the same content issued again is declared a repeat');
  const againGrade = await grade(a.jar, again.data.question.id, (await sealedAnswer(again.data.question.id)).value);
  eq([againGrade.data.authoritative, againGrade.data.correct, againGrade.data.repeat], [true, true, true], 'it is still marked, and its receipt says repeat');
  eq((await eventOf(again.data.question.id)).repeat, true, 'and so does the server\'s graded-attempt event');

  // revealed, then issued again: also a repeat
  const shown = await issue(a.jar, 9191);
  eq((await post(`/v1/practice/${shown.data.question.id}/reveal`, {}, a.jar)).status, 200, 'a second question is revealed');
  const afterReveal = await issue(a.jar, 9191);
  eq(afterReveal.data.repeat, true, 'content whose solution was revealed is a repeat when issued again');
  eq((await grade(a.jar, afterReveal.data.question.id, (await sealedAnswer(afterReveal.data.question.id)).value)).data.repeat, true, 'and is marked as one');

  // a copy issued BEFORE the first was resolved is not retroactively a repeat by seal,
  // but content issued after resolution always is
  const third = await issue(a.jar, 4242);
  eq(third.data.repeat, true, 'every later copy stays a repeat');

  // another account's first sitting of the same content is its own
  const other = await issue(b.jar, 4242);
  eq([other.status, other.data.repeat ?? false], [201, false], 'another account\'s first sitting of that content is not a repeat');

  // ── copies issued up front, before any of them is resolved ───────────────
  // None is a repeat when issued. Once one has shown its solution the others
  // are no longer new work, and the server says so when it marks them.
  const c = await registerAccount(h, { email: 'repeat.c@example.test', deviceId: 'ipad-repeat-c' });
  eq((await verifyEmail(h, c.account.id)).status, 200, 'a third verified account');
  const copies = [];
  for (let i = 0; i < 4; i++) copies.push(await issue(c.jar, 31337));
  eq(copies.map(x => [x.status, x.data.repeat ?? false]), copies.map(() => [201, false]), 'four copies of one question issued before any is resolved: none is a repeat yet');
  const key = (await sealedAnswer(copies[0].data.question.id)).value;
  const opened = await post(`/v1/practice/${copies[0].data.question.id}/reveal`, {}, c.jar);
  eq([opened.status, opened.data.repeat ?? false], [200, false], 'the first is revealed, as new work');
  const second = await grade(c.jar, copies[1].data.question.id, key);
  eq([second.data.correct, second.data.repeat], [true, true], 'a copy issued earlier and answered after the reveal is marked as a repeat');
  eq((await eventOf(copies[1].data.question.id)).repeat, true, 'and its graded-attempt event says repeat');
  const third2 = await post(`/v1/practice/${copies[2].data.question.id}/reveal`, {}, c.jar);
  eq(third2.data.repeat, true, 'revealing another earlier copy is a repeat too');
  eq((await eventOf(copies[2].data.question.id)).repeat, true, 'in its event as well');
  const wrongFirst = await grade(c.jar, copies[3].data.question.id, '987654');
  eq([wrongFirst.data.resolved, wrongFirst.data.repeat], [false, true], 'a first wrong try on the last copy already says repeat');

  // ── working with no final answer is an attempt, right or wrong ───────────
  const d = await registerAccount(h, { email: 'repeat.d@example.test', deviceId: 'ipad-repeat-d' });
  eq((await verifyEmail(h, d.account.id)).status, 200, 'a fourth verified account');
  const sub = (jar, id, answer, steps) => { const sid = `repeat-credit-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer, mode: 'typed', steps }, jar, { 'Idempotency-Key': sid }); };
  const probe = await issue(d.jar, 2024);
  const guess1 = await sub(d.jar, probe.data.question.id, '', ['x = 123456']);
  eq([guess1.status, guess1.data.invalid, guess1.data.resolved, guess1.data.triesLeft, guess1.data.marksEarned], [200, false, false, 1, 0], 'a false line with no final answer spends a try');
  const guess2 = await sub(d.jar, probe.data.question.id, '', ['x = 123457']);
  eq([guess2.status, guess2.data.resolved, guess2.data.correct, guess2.data.marksEarned], [200, true, false, 0], 'and a second one resolves the question: there is no free third check');
  eq((await sub(d.jar, probe.data.question.id, '', ['x = 1'])).status, 409, 'after which nothing more is checked');
  const empty = await issue(d.jar, 2025);
  const nothing = await sub(d.jar, empty.data.question.id, '', []);
  eq([nothing.data.invalid, nothing.data.triesLeft, nothing.data.stepReport, nothing.data.partial], [true, 1, null, null], 'a submission with neither answer nor working is still not an attempt, and says nothing');

  // ── true arithmetic that is not about the question earns nothing ─────────
  const padded = await issue(d.jar, 2026);
  const paddedGrade = await sub(d.jar, padded.data.question.id, '987654', ['3 + 4 = 7', '10 - 2 = 8', '5 * 5 = 25']);
  eq([paddedGrade.data.correct, paddedGrade.data.marksEarned, paddedGrade.data.partial?.awarded ?? 0], [false, 0, 0], 'a wrong answer with unrelated true arithmetic as working earns no method mark');

  // ── a prepared question names its account ────────────────────────────────
  const prep = await post('/v1/practice/prepare', { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in' });
  eq(prep.status, 200, 'a prepared question');
  eq((await post('/v1/practice/issue', { prepared: prep.data.prepared }, d.jar)).status, 400, 'binding it without naming the account is refused');
  eq((await post('/v1/practice/issue', { prepared: prep.data.prepared, account: String(d.account.id) }, d.jar)).status, 201, 'and it is still there to bind for the account it names');

  // ── the grader's device id is not a device's to use ──────────────────────
  const g = await registerAccount(h, { email: 'repeat.g@example.test', deviceId: 'server-grader' });
  eq((await verifyEmail(h, g.account.id)).status, 200, 'an account whose device calls itself the grader');
  const taken = await post('/v1/sync/push', { schemaVersion: 1, deviceId: 'server-grader', events: [{ id: 'evt-grader-1', kind: 'practice-attempt', deviceId: 'server-grader', deviceSeq: 9007199254740991, entityId: 'q-grader-1', occurredAt: Date.now(), payload: {} }], entities: [] }, g.jar, { 'Idempotency-Key': 'grader-push-1' });
  eq([taken.status, taken.data?.error?.code], [400, 'SYNC_DEVICE_RESERVED'], 'cannot push events under it');
  for (const seed of [51, 52]) {
    const q = await issue(g.jar, seed);
    eq((await grade(g.jar, q.data.question.id, (await sealedAnswer(q.data.question.id)).value)).status, 200, `and that account's own answers are still marked (${seed})`);
  }

  // ══ the same question with its options dealt in another order ════════════
  // A multiple-choice question is the same content whatever order its options
  // come in. Keyed on a hash that includes the order, "seen" let one reveal
  // buy full first-sitting credit on every reshuffled copy.
  const { loadAllBanks, generateQuestion } = await import('../../client/src/engine/generators/index.js');
  const { contentIdentityOf, seenKeysOf, triedKeyOf, opaqueContentHash } = await import('../platform/contentSeen.js');
  await loadAllBanks();
  const MCQ = 'c9-euclid-geometry';
  // Fixed seeds of ONE prompt whose options come out in four different orders.
  const deals = [];
  for (let seed = 1; seed < 400 && deals.length < 6; seed++) {
    const q = generateQuestion(MCQ, 1, seed);
    if (q.answerType !== 'mcq' || (deals.length && q.prompt !== deals[0].q.prompt)) continue;
    if (deals.some(d => d.q.contentHash === q.contentHash)) continue;
    deals.push({ seed, q });
  }
  eq([deals.length, new Set(deals.map(d => d.q.mcqOptions.join('|'))).size, new Set(deals.map(d => [...d.q.mcqOptions].sort().join('|'))).size, new Set(deals.map(d => d.q.mcqOptions[d.q.answer.correctIndex])).size],
    [6, 6, 1, 1], 'six deals of one question: six option orders, one option set, one keyed option');
  const issueMcq = (jar, deal, extra = {}) => post('/v1/practice/issue', { generator: MCQ, difficulty: 1, seed: deal.seed, curriculum: 'in', ...extra }, jar);
  const right = deal => deal.q.answer.correctIndex;
  const wrong = (deal, nth = 0) => [0, 1, 2, 3].filter(i => i !== deal.q.answer.correctIndex)[nth];
  // Registration is rate-limited per caller; this suite needs more accounts
  // than one hour allows, and that limit is not what it is testing.
  const account = async tag => { await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register%'"); const x = await registerAccount(h, { email: `repeat.${tag}@example.test`, deviceId: `ipad-repeat-${tag}` }); await verifyEmail(h, x.account.id); return x; };
  const attempts = async id => (await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='graded-attempt' ORDER BY device_seq", [id])).map(r => JSON.parse(r.payload_json));

  // the identity itself
  const [d0, d1, d2, d3, d4, d5] = deals;
  eq(new Set(deals.map(d => contentIdentityOf(d.q))).size, 1, 'every deal of the question has one content identity');
  eq(new Set(deals.map(d => seenKeysOf(d.q)[0])).size, 1, 'and so one shared seen-key');
  eq(seenKeysOf(d0.q).includes('seen-' + opaqueContentHash(d0.q.contentHash)), true, 'the key content was recorded under before the identity existed is still one of its keys');
  const rekeyed = { ...d0.q, answer: { ...d0.q.answer, correctIndex: wrong(d0) } };
  eq(contentIdentityOf(rekeyed) === contentIdentityOf(d0.q), false, 'the same prompt and options keyed to a different answer is different content');
  eq(contentIdentityOf({ ...d0.q, mcqOptions: d0.q.mcqOptions.map((o, i) => (i === wrong(d0) ? o + ' at all' : o)) }) === contentIdentityOf(d0.q), false, 'so is the same prompt with a different option');
  eq(contentIdentityOf({ ...d0.q, prompt: d0.q.prompt + ' (ii)' }) === contentIdentityOf(d0.q), false, 'and a different prompt');
  eq(contentIdentityOf({ ...d0.q, figure: '<svg data-n="2"/>' }) === contentIdentityOf(d0.q), false, 'and a different figure');
  const lin = n => generateQuestion('c8-linear-equations-both-sides', 2, n);
  eq(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(n => contentIdentityOf(lin(n)))).size, new Set([1, 2, 3, 4, 5, 6, 7, 8].map(n => lin(n).prompt)).size, 'written questions with different numbers keep different identities');
  const twoPart = { prompt: 'A', answerType: 'multipart', parts: [{ prompt: 'a', answerType: 'mcq', mcqOptions: ['1', '2'], answer: { correctIndex: 0 } }] };
  const twoPartDealt = { ...twoPart, parts: [{ ...twoPart.parts[0], mcqOptions: ['2', '1'], answer: { correctIndex: 1 } }] };
  const twoPartRekeyed = { ...twoPart, parts: [{ ...twoPart.parts[0], answer: { correctIndex: 1 } }] };
  eq([contentIdentityOf(twoPartDealt) === contentIdentityOf(twoPart), contentIdentityOf(twoPartRekeyed) === contentIdentityOf(twoPart)], [true, false], 'a part\'s options may be dealt in any order; a part keyed differently is different content');
  const opaque = [contentIdentityOf(d0.q), ...seenKeysOf(d0.q), triedKeyOf(d0.q)].join(' ');
  eq([/^[0-9a-f]{32}$/.test(contentIdentityOf(d0.q)), opaque.includes(String(d0.seed) + ':'), opaque.includes(d0.q.contentHash), opaque.includes(d0.q.contentId)], [true, false, false, false], 'the identity is opaque: no seed, engine hash or content id in it');

  // reveal one deal, then be issued the others
  const e = await account('e');
  const e0 = await issueMcq(e.jar, d0);
  eq([e0.status, e0.data.repeat ?? false, e0.data.triesLeft], [201, false, undefined], 'a first sitting of the multiple-choice question: not a repeat, both tries in hand');
  eq((await post(`/v1/practice/${e0.data.question.id}/reveal`, {}, e.jar)).status, 200, 'its solution is revealed');
  const e1 = await issueMcq(e.jar, d1);
  eq([e1.status, e1.data.question.prompt === e0.data.question.prompt, e1.data.question.contentHash === e0.data.question.contentHash, e1.data.repeat], [201, true, false, true],
    'the same question with its options in another order is declared a repeat when issued');
  const e1Grade = await grade(e.jar, e1.data.question.id, right(d1));
  eq([e1Grade.data.correct, e1Grade.data.repeat], [true, true], 'and its receipt says repeat');
  eq((await eventOf(e1.data.question.id)).repeat, true, 'and so does its graded-attempt event');
  for (const deal of [d2, d3, d4, d5]) {
    const copy = await issueMcq(e.jar, deal);
    const marked = await grade(e.jar, copy.data.question.id, right(deal));
    eq([copy.data.repeat, marked.data.correct, marked.data.repeat], [true, true, true], `every other deal is a repeat too (seed ${deal.seed})`);
  }
  eq((await attempts(e.account.id)).filter(x => x.correct && !x.repeat).length, 0, 'one reveal bought no first-sitting credit on any reshuffled copy');
  const seenRows = await h.db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-content'", [e.account.id]);
  eq([seenRows.some(r => r.key === seenKeysOf(d0.q)[0]), seenRows.some(r => r.key.includes(d0.q.contentHash))], [true, false], 'the record is the keyed identity, never the engine hash');

  // resolved by a correct answer, then a reshuffled copy
  const f = await account('f');
  const f0 = await issueMcq(f.jar, d2);
  eq([(await grade(f.jar, f0.data.question.id, right(d2))).data.repeat ?? false, (await issueMcq(f.jar, d4)).data.repeat], [false, true], 'answered once for credit, the reshuffled copy is a repeat');

  // deals issued up front, before any is resolved
  const g2 = await account('g2');
  const upfront = [];
  for (const deal of [d0, d1, d2]) upfront.push(await issueMcq(g2.jar, deal));
  eq(upfront.map(x => x.data.repeat ?? false), [false, false, false], 'three deals issued before any is resolved: none is a repeat yet');
  eq((await post(`/v1/practice/${upfront[0].data.question.id}/reveal`, {}, g2.jar)).data.repeat ?? false, false, 'the first is revealed as new work');
  eq((await grade(g2.jar, upfront[1].data.question.id, right(d1))).data.repeat, true, 'a differently dealt copy answered after it is a repeat');
  eq((await post(`/v1/practice/${upfront[2].data.question.id}/reveal`, {}, g2.jar)).data.repeat, true, 'and revealing the third is a repeat');
  const otherPrompt = await issue(g2.jar, 777);
  eq(otherPrompt.data.repeat ?? false, false, 'a different question is not swept up with it');

  // content recorded as seen before the identity existed stays seen
  const legacy = await account('legacy');
  const stamp = Date.now();
  await h.db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-content',?,?,?,?,?)",
    [legacy.account.id, 'seen-' + opaqueContentHash(d3.q.contentHash), '{}', 'legacy-row', stamp, stamp + 86_400_000]);
  eq([(await issueMcq(legacy.jar, d3)).data.repeat, (await issueMcq(legacy.jar, d5)).data.repeat ?? false], [true, false], 'a record under the old key alone still makes that copy a repeat (and, as before, only that copy)');

  // a record past its expiry is not a record, and seeing the content again renews it
  const lapsed = await account('lapsed');
  for (const key of seenKeysOf(d0.q)) await h.db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-content',?,?,?,?,?)",
    [lapsed.account.id, key, '{}', 'lapsed-row', stamp - 2000, stamp - 1000]);
  const lapsed0 = await issueMcq(lapsed.jar, d0);
  eq(lapsed0.data.repeat ?? false, false, 'an expired seen-record does not make content a repeat');
  eq((await grade(lapsed.jar, lapsed0.data.question.id, right(d0))).data.repeat ?? false, false, 'nor when it is marked');
  eq((await issueMcq(lapsed.jar, d1)).data.repeat, true, 'resolving it renews the record: the next copy is a repeat');

  // ══ tries follow the content, not the issued copy ════════════════════════
  // Two tries per question. Counted per copy alone, every fresh copy was one
  // more free guess with feedback, and nothing was recorded until one landed.
  const t = await account('t');
  const t0 = await issueMcq(t.jar, d0);
  const t0Wrong = await grade(t.jar, t0.data.question.id, wrong(d0, 0));
  eq([t0Wrong.data.correct, t0Wrong.data.resolved, t0Wrong.data.triesLeft, t0Wrong.data.solution], [false, false, 1, undefined], 'a first wrong try leaves one try and shows no solution');
  const t1 = await issueMcq(t.jar, d1);
  eq([t1.status, t1.data.repeat ?? false, t1.data.triesLeft], [201, false, 1], 'a fresh copy of that content is issued with the try already spent, and says so');
  const t1Sid = `repeat-credit-${String(n + 1).padStart(4, '0')}`;
  const t1Wrong = await grade(t.jar, t1.data.question.id, wrong(d1, 1));
  eq([t1Wrong.data.correct, t1Wrong.data.resolved, t1Wrong.data.triesLeft, t1Wrong.data.marksEarned, typeof t1Wrong.data.solution?.answerText], [false, true, 0, 0, 'string'],
    'a wrong answer on the copy is the second try: it resolves the question as wrong');
  const t1Event = await eventOf(t1.data.question.id);
  eq([t1Event?.correct, t1Event?.marksEarned, t1Event?.repeat ?? false], [false, 0, false], 'and the wrong attempt is recorded');
  const t1Replay = await post(`/v1/practice/${t1.data.question.id}/submit`, { submissionId: t1Sid, answer: String(wrong(d1, 1)), mode: 'typed' }, t.jar, { 'Idempotency-Key': t1Sid });
  eq([t1Replay.status, t1Replay.data], [200, t1Wrong.data], 'replaying that submission returns the stored receipt');
  const t2 = await issueMcq(t.jar, d2);
  eq([t2.data.repeat, t2.data.triesLeft], [true, undefined], 'the content is now seen: the next copy is a repeat');
  const t2Grade = await grade(t.jar, t2.data.question.id, right(d2));
  eq([t2Grade.data.correct, t2Grade.data.repeat], [true, true], 'so the answer the wrong tries narrowed down earns no first-sitting credit');
  const t0Late = await grade(t.jar, t0.data.question.id, right(d0));
  eq([t0Late.data.correct, t0Late.data.repeat], [true, true], 'nor does going back to the copy left open');
  const tEvents = await attempts(t.account.id);
  eq([tEvents.filter(x => x.correct && !x.repeat).length, tEvents.filter(x => !x.correct).length], [0, 1], 'guessing across copies ends with the wrong resolution on record and no new credit');

  // one option per fresh copy, for as many copies as it takes
  const u = await account('u');
  const tried = new Set();
  let landed = null;
  for (const deal of deals) {
    const copy = await issueMcq(u.jar, deal);
    const pick = deal.q.mcqOptions.findIndex(o => o !== deal.q.mcqOptions[right(deal)] && !tried.has(o));
    const index = pick >= 0 ? pick : right(deal);
    tried.add(deal.q.mcqOptions[index]);
    const marked = await grade(u.jar, copy.data.question.id, index);
    if (marked.data.correct) { landed = marked.data; break; }
  }
  const uEvents = await attempts(u.account.id);
  eq([landed?.repeat, uEvents.filter(x => x.correct && !x.repeat).length, uEvents.filter(x => !x.correct).length], [true, 0, 1],
    'eliminating one wrong option per fresh copy converges only on a repeat, with the wrong resolution recorded');

  // the second try, taken on a copy, is still a second try
  const v = await account('v');
  const v0 = await issue(v.jar, 6161);
  eq((await grade(v.jar, v0.data.question.id, '987654')).data.triesLeft, 1, 'a written question: one wrong try');
  const v1 = await issue(v.jar, 6161);
  eq([v1.data.repeat ?? false, v1.data.triesLeft], [false, 1], 'the same question issued again starts with that try spent');
  const unread = await grade(v.jar, v1.data.question.id, 'abc');
  eq([unread.data.invalid, unread.data.resolved, unread.data.triesLeft, unread.data.solution], [true, false, 1, undefined], 'an entry that cannot be read as an answer still spends nothing on it');
  const v1Grade = await grade(v.jar, v1.data.question.id, (await sealedAnswer(v1.data.question.id)).value);
  eq([v1Grade.data.correct, v1Grade.data.resolved, v1Grade.data.repeat ?? false, v1Grade.data.marksEarned === v1Grade.data.marksPossible], [true, true, false, true], 'a right answer there is marked exactly as the second try on the original would be');
  eq((await grade(v.jar, v0.data.question.id, (await sealedAnswer(v0.data.question.id)).value)).data.repeat, true, 'after which the original is a repeat');
  eq((await issue(v.jar, 6262)).data.triesLeft, undefined, 'a different question has both tries');
  eq((await issue(b.jar, 6161)).data.triesLeft, undefined, 'and another account\'s tries are its own');

  // one-try modes are unchanged
  const w = await account('w');
  const w0 = await issueMcq(w.jar, d0);
  eq((await grade(w.jar, w0.data.question.id, wrong(d0))).data.resolved, false, 'a wrong first try in practice');
  const wRush = await issueMcq(w.jar, d1, { mode: 'rush' });
  eq([wRush.status, wRush.data.triesLeft], [201, undefined], 'a one-try copy of it reports no second try to lose');
  const wRushGrade = await grade(w.jar, wRush.data.question.id, right(d1));
  eq([wRushGrade.data.correct, wRushGrade.data.resolved, wRushGrade.data.triesLeft], [true, true, 0], 'and resolves on its one answer as it always did');

  // ══ the account a request names is a string ══════════════════════════════
  const named = await account('named');
  const listed = await post('/v1/practice/issue', { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in', account: [String(named.account.id)] }, named.jar);
  eq([listed.status, listed.data?.error?.code], [409, 'PRACTICE_ACCOUNT_MISMATCH'], 'an array that merely prints as the account id does not name the account');
  const prep2 = await post('/v1/practice/prepare', { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in' });
  const listedBind = await post('/v1/practice/issue', { prepared: prep2.data.prepared, account: [String(named.account.id)] }, named.jar);
  eq([listedBind.status, listedBind.data?.error?.code], [409, 'PRACTICE_ACCOUNT_MISMATCH'], 'nor does it bind a prepared question');
  eq((await post('/v1/practice/issue', { prepared: prep2.data.prepared, account: String(named.account.id) }, named.jar)).status, 201, 'which is still there for the account named properly');

  // ══ a wrong first try is not told the answer through its working ═════════
  // A page of ninety-one guessed values under a wrong final answer came back
  // with exactly the true one marked right; the second try then earned full
  // marks as new work. One false line came back with a diagnosis naming the
  // answer. While a question is open, a line that states or checks a value is
  // not judged, the first mistake is marked without saying what it should have
  // been, and nothing after it is judged. Resolution returns the full report.
  const work = (jar, id, answer, steps) => { const sid = `repeat-credit-${String(++n).padStart(4, '0')}`; return { sid, sent: post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed', steps }, jar, { 'Idempotency-Key': sid }) }; };
  const lineStatuses = report => (report?.lines || []).map(l => l.status);
  const guesser = await account('guess');
  const or_g0 = await issue(guesser.jar, 21);
  const gKey = Number((await sealedAnswer(or_g0.data.question.id)).value);
  const gLetter = or_g0.data.question.prompt.match(/[a-z]/i)[0];
  const guesses = [];
  for (let k = gKey - 45; k <= gKey + 45; k++) guesses.push(`${gLetter} = ${k}`);
  const or_g1 = work(guesser.jar, or_g0.data.question.id, '987654', guesses);
  const or_g1r = await or_g1.sent;
  eq([or_g1r.status, or_g1r.data.correct, or_g1r.data.resolved, or_g1r.data.triesLeft, or_g1r.data.solution], [200, false, false, 1, undefined], 'ninety-one guessed values under a wrong answer: a wrong first try, still open');
  eq([or_g1r.data.stepReport.lines.length, [...new Set(lineStatuses(or_g1r.data.stepReport))]], [91, ['note']], 'not one of the ninety-one lines is confirmed or refuted');
  const trueLine = or_g1r.data.stepReport.lines[45], falseLine = or_g1r.data.stepReport.lines[44];
  eq([trueLine.text, { ...trueLine, text: null }], [`${gLetter} = ${gKey}`, { ...falseLine, text: null }], 'the line that states the true value comes back exactly as a false one does');
  eq([or_g1r.data.marksEarned, or_g1r.data.partial, or_g1r.data.stepReport.firstBreak, or_g1r.data.stepReport.diagnosis], [0, null, -1, null], 'and there are no marks, no per-line marks and no first mistake to read it from');
  eq((await post(`/v1/practice/${or_g0.data.question.id}/submit`, { submissionId: or_g1.sid, answer: '987654', mode: 'typed', steps: guesses }, guesser.jar, { 'Idempotency-Key': or_g1.sid })).data, or_g1r.data, 'the stored reply is the same one');
  const or_g2r = await work(guesser.jar, or_g0.data.question.id, '987654', guesses).sent;
  eq([or_g2r.data.resolved, or_g2r.data.correct, typeof or_g2r.data.solution], [true, false, 'object'], 'the second wrong try resolves the question');
  eq(or_g2r.data.stepReport.lines.filter(l => l.status === 'ok').map(l => l.text), [`${gLetter} = ${gKey}`], 'and the full report is then returned: the true value is the one line verified');
  eq(or_g2r.data.stepReport.withheld ?? false, false, 'nothing in it is withheld');

  // Genuine working is still judged on the first try, and shows its marks —
  // whatever values are stated beside it.
  const PAIR = { generator: 'c10-linear-pair-methods', difficulty: 2, seed: 7, curriculum: 'in' };
  const elimination = (y, x) => ['12x + 6y = -120', '12x - 3y = -66', '9y = -54', `y = ${y}`, `x = ${x}`, `6(${x}) + 3(${y}) = -60`];
  const solver = await account('solver'), bluffer = await account('bluffer');
  const or_s0 = await post('/v1/practice/issue', PAIR, solver.jar), or_b0 = await post('/v1/practice/issue', PAIR, bluffer.jar);
  eq([or_s0.data.question.prompt, or_b0.data.question.prompt, (await sealedAnswer(or_s0.data.question.id)).value],
    Array(2).fill('Solve by elimination: $6x + 3y = -60$ and $4x - y = -22$. Find the value of $y$.').concat(-6), 'two accounts sit the same pair of equations');
  const or_s1r = await work(solver.jar, or_s0.data.question.id, '5', elimination(-6, -7)).sent;
  const or_b1r = await work(bluffer.jar, or_b0.data.question.id, '5', elimination(6, 7)).sent;
  eq(lineStatuses(or_s1r.data.stepReport), ['ok', 'ok', 'ok', 'note', 'note', 'note'], 'the eliminations are verified line by line; the values stated after them and the check are not');
  eq([or_s1r.data.resolved, or_s1r.data.marksEarned, or_s1r.data.marksPossible, or_s1r.data.partial.awarded, or_s1r.data.partial.lines.map(l => l.mark)], [false, 1, 2, 1, [0, 0, 1, 0, 0, 0]], 'the step that eliminates x shows its method mark');
  const unsent = r => ({ report: { ...r.data.stepReport, lines: r.data.stepReport.lines.map(l => ({ ...l, text: null })) }, partial: { ...r.data.partial, lines: r.data.partial.lines.map(l => ({ ...l, text: null })) }, marks: [r.data.marksEarned, r.data.marksPossible], feedback: r.data.feedback });
  eq(unsent(or_b1r), unsent(or_s1r), 'the same working with the wrong values stated comes back identically, line for line and mark for mark');
  const or_s2r = await work(solver.jar, or_s0.data.question.id, '5', elimination(-6, -7)).sent;
  eq([or_s2r.data.resolved, lineStatuses(or_s2r.data.stepReport), or_s2r.data.marksEarned], [true, ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'], 1], 'on resolution every line is judged, and the marks earned are the ones shown');
  const or_b2r = await work(bluffer.jar, or_b0.data.question.id, '5', elimination(6, 7)).sent;
  eq([or_b2r.data.resolved, lineStatuses(or_b2r.data.stepReport).slice(0, 4), or_b2r.data.stepReport.firstBreak], [true, ['ok', 'ok', 'ok', 'break'], 3], 'and the wrong value is then the first mistake');

  // One false line: the first mistake is marked, the answer is not given away.
  const slipper = guesser;   // a pair of equations is new content to this account
  const or_sl0 = await post('/v1/practice/issue', PAIR, slipper.jar);
  const or_sl1r = await work(slipper.jar, or_sl0.data.question.id, '5', ['9y = -50', '9y = -54', '18x = -126']).sent;
  eq([or_sl1r.data.resolved, lineStatuses(or_sl1r.data.stepReport), or_sl1r.data.stepReport.firstBreak, or_sl1r.data.marksEarned], [false, ['break', 'note', 'note'], 0, 0], 'a false line is the first mistake, and nothing after it is judged');
  const told = JSON.stringify([or_sl1r.data.stepReport.diagnosis, or_sl1r.data.stepReport.lines.map(l => [l.note, l.diagnosis]), or_sl1r.data.partial, or_sl1r.data.feedback, or_sl1r.data.trapWhy]);
  eq(/-\s?6|-\s?7|54|126/.test(told), false, 'nothing said about that mistake contains the solution of the pair or the number the line should have had');
  const or_sl2r = await work(slipper.jar, or_sl0.data.question.id, '5', ['9y = -50', '9y = -54', '18x = -126']).sent;
  eq([or_sl2r.data.resolved, or_sl2r.data.stepReport.withheld ?? false, /-6|-54/.test(JSON.stringify([or_sl2r.data.stepReport.diagnosis, or_sl2r.data.stepReport.lines[0].note]))], [true, false, true], 'the full diagnosis, which does name it, is returned once the question is resolved');

  // A mark that IS the stated value waits for resolution, and is then earned.
  const oneStep = solver;
  const os0 = await issue(oneStep.jar, 1234579);
  const osKey = Number((await sealedAnswer(os0.data.question.id)).value);
  const osLetter = os0.data.question.prompt.match(/[a-z]/i)[0];
  const osWork = value => [os0.data.question.prompt.replace(/\$/g, ''), `${osLetter} = ${value}`];
  const os1r = await work(oneStep.jar, os0.data.question.id, '987654', osWork(osKey)).sent;
  eq([os0.data.question.prompt, os1r.data.resolved, os1r.data.marksEarned, os1r.data.partial?.awarded, lineStatuses(os1r.data.stepReport)], ['$2t=t - 3$', false, 0, 0, ['ok', 'note']],
    'the question copied out and its root stated: on the open question the root is not confirmed and shows no mark');
  const os2r = await work(oneStep.jar, os0.data.question.id, '987654', osWork(osKey)).sent;
  eq([os2r.data.resolved, os2r.data.marksEarned, os2r.data.partial?.awarded, lineStatuses(os2r.data.stepReport)], [true, 1, 1, ['ok', 'ok']],
    'on resolution the one-step solution earns its method mark');

  // Arithmetic folded from the question's own numbers is not a method.
  const or_f0 = await post('/v1/practice/issue', { ...PAIR, seed: 531 }, bluffer.jar);
  const folded = ['5 + 4 = 9', '3 + 2 = 5', '2 + 2 = 4', '9 - 5 = 4', '4 + 4 = 8'];
  eq([or_f0.data.question.prompt, (await sealedAnswer(or_f0.data.question.id)).value], ['Solve by elimination: $5x + 4y = -3$ and $2x + 2y = 2$. Find the value of $y$.', 8], 'a second pair of equations');
  const or_f1r = await work(bluffer.jar, or_f0.data.question.id, '1', folded).sent;
  const or_f2r = await work(bluffer.jar, or_f0.data.question.id, '2', folded).sent;
  eq([or_f1r.data.marksEarned, or_f2r.data.marksEarned, or_f2r.data.resolved, (await eventOf(or_f0.data.question.id)).marksEarned], [0, 0, true, 0], 'five true sums on the six numbers of a pair of equations that end on y earn nothing, on either try or on record');

  console.log(`REPEAT CREDIT: PASS — ${count}/${count} checks — content an account has been shown the solution of is a repeat however, whenever and in whatever option order it was issued; tries follow the content across copies; working without an answer always spends a try; unrelated arithmetic earns nothing; a wrong first try is told nothing that confirms a value.`);
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
}
