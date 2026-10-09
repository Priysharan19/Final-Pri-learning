// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · issuing by seed is deterministic, private and per-account
//
// A device can start a question from the bundled engine before it is signed in
// (or while it is offline) and have the SERVER adopt it afterwards by asking
// /v1/practice/issue for the same { generator, difficulty, seed, curriculum }.
// That only works if the server's issuance is a pure function of those four
// values. This suite boots the shipped /v1 app (SQLite, or Postgres with
// --engine=postgres) and proves over real HTTP that:
//
//   1. issuing twice with the same request for one account yields the same
//      prompt, answerType, contentId and the rest of the public question — as
//      two separate server questions, each with its own id;
//   2. the issued public question never contains an answer or solution key,
//      at any depth;
//   3. a different seed, and a different difficulty, give a different question
//      (the equality in 1 is not the generator ignoring its inputs);
//   4. a second account issuing the same seed gets the same public content
//      under its OWN question id, and neither account can grade, reveal or
//      read recognition for the other's id;
//   5. what was adopted is what is graded: the root solved from the public
//      prompt is marked correct on both issuances.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-seed-reissue-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'f5'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');

const c = checks();
const h = await startApp({ engine: requestedEngine() });

// Keys that would disclose the answer, the worked solution or the marking
// rubric's content. (`criteriaCount` — how many marks — is public by design.)
const PRIVATE_KEYS = [
  'answer', 'answerText', 'answers', 'correct', 'correctIndex', 'correctAnswer', 'expected', 'expectedAnswer',
  'solution', 'solutionText', 'solutions', 'steps', 'stepcheck', 'criteria', 'markScheme', 'marks',
  'traps', 'optionTraps', 'canonical', 'canonicalInput', 'canonicalWorking', 'seed', '_practiceMode'
];
const keysOf = value => !value || typeof value !== 'object' ? []
  : Array.isArray(value) ? value.flatMap(keysOf)
  : Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
const withoutId = ({ id, ...rest }) => rest;

// Generators of different answer types, so determinism and privacy are not
// proved for the linear generator alone.
const REQUESTS = [
  { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: 104729, curriculum: 'in' },
  { generator: 'c8-linear-equations-both-sides', difficulty: 3, seed: 1, curriculum: 'in' },
  { generator: 'c8-linear-equations-verification', difficulty: 1, seed: 642714604, curriculum: 'in' },
  { generator: 'c12-differential-equations', difficulty: 1, seed: 19, curriculum: 'in' }
];

try {
  const a = await registerAccount(h, { email: 'seed.reissue.a@example.test', deviceId: 'ipad-seed-a' });
  c.eq(a.status, 201, 'the first student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const b = await registerAccount(h, { email: 'seed.reissue.b@example.test', deviceId: 'ipad-seed-b' });
  c.eq(b.status, 201, 'the second student account exists');
  c.eq((await verifyEmail(h, b.account.id)).status, 200, 'and is verified');

  const issue = (jar, body) => h.request('/v1/practice/issue', { method: 'POST', jar, body });
  const submit = (jar, qid, submissionId, answer) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed' }
  });
  const escrowed = async accountId => Number((await h.db.get(
    "SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [accountId]))?.n || 0);

  for (const request of REQUESTS) {
    const tag = `${request.generator} d${request.difficulty} s${request.seed}`;
    const first = await issue(a.jar, request);
    const second = await issue(a.jar, request);
    c.eq(first.status, 201, `${tag}: issued`);
    c.eq(second.status, 201, `${tag}: issued again with the same request`);
    const q1 = first.data.question;
    const q2 = second.data.question;

    // 1 · deterministic by seed
    c.eq(q2.prompt, q1.prompt, `${tag}: the same prompt both times`);
    c.eq(q2.answerType, q1.answerType, `${tag}: the same answerType`);
    c.eq(q2.contentId, q1.contentId, `${tag}: the same contentId`);
    c.ok(typeof q1.contentId === 'string' && q1.contentId.includes(String(request.seed)), `${tag}: and the contentId names the seed`);
    c.deq(withoutId(q2), withoutId(q1), `${tag}: the whole public question is identical apart from its id`);
    c.ok(q1.id && q2.id && q1.id !== q2.id, `${tag}: as two server questions, each with its own id`);

    // 2 · nothing private in the public question
    for (const response of [first.data, second.data]) {
      const leaked = keysOf(response).filter(key => PRIVATE_KEYS.includes(key));
      c.eq(leaked.join(','), '', `${tag}: the issue response carries no answer, solution or rubric key`);
    }
    c.deq(Object.keys(first.data), ['question'], `${tag}: and nothing beside the question`);

    // 4 · another account, the same seed
    const other = await issue(b.jar, request);
    c.eq(other.status, 201, `${tag}: a second account issues the same seed`);
    c.deq(withoutId(other.data.question), withoutId(q1), `${tag}: and gets the same public content`);
    c.ok(other.data.question.id !== q1.id && other.data.question.id !== q2.id, `${tag}: under its own question id`);
    const foreign = await submit(b.jar, q1.id, `seed-foreign-${request.seed}-${request.difficulty}`, '1');
    c.eq(foreign.status, 404, `${tag}: the second account cannot grade the first account's id`);
    c.eq(foreign.data?.error?.code, 'QUESTION_NOT_FOUND', `${tag}: which, to it, does not exist`);
    c.eq((await h.request(`/v1/practice/${q1.id}/reveal`, { method: 'POST', jar: b.jar, body: {} })).status, 404, `${tag}: nor reveal it`);
    c.eq((await submit(a.jar, other.data.question.id, `seed-foreign-back-${request.seed}-${request.difficulty}`, '1')).status, 404,
      `${tag}: and the first account cannot grade the second account's id`);
    c.eq((await submit({}, q1.id, `seed-anonymous-${request.seed}-${request.difficulty}`, '1')).status, 401, `${tag}: no session, no grade`);
  }
  c.eq(await escrowed(a.account.id), REQUESTS.length * 2, 'every issuance to the first account is its own escrowed question');
  c.eq(await escrowed(b.account.id), REQUESTS.length, 'and the second account holds only its own');
  c.eq(Number((await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE kind='graded-attempt'"))?.n || 0), 0,
    'no refused cross-account request recorded progress');

  // 3 · the inputs matter
  const base = REQUESTS[0];
  const baseQ = (await issue(a.jar, base)).data.question;
  const otherSeed = (await issue(a.jar, { ...base, seed: base.seed + 1 })).data.question;
  c.ok(otherSeed.contentId !== baseQ.contentId, 'a different seed is a different contentId');
  c.ok(otherSeed.prompt !== baseQ.prompt, 'and a different question');
  const otherDifficulty = (await issue(a.jar, { ...base, difficulty: 3 })).data.question;
  c.ok(otherDifficulty.contentId !== baseQ.contentId, 'a different difficulty is a different contentId');
  // A string seed is the same seed, as a device that stored it as text would send it.
  const asText = (await issue(a.jar, { ...base, seed: String(base.seed) })).data.question;
  c.deq(withoutId(asText), withoutId(baseQ), 'the seed sent as text issues the same question');
  for (const [name, body] of [
    ['a negative seed', { ...base, seed: -1 }], ['a fractional seed', { ...base, seed: 1.5 }],
    ['a seed past 2^31', { ...base, seed: 0x80000000 }], ['a non-numeric seed', { ...base, seed: 'abc' }]
  ]) {
    const refused = await issue(a.jar, body);
    c.eq(refused.status, 400, `${name} is refused`);
    c.eq(refused.data?.error?.code, 'PRACTICE_SEED_INVALID', `${name}: coded as an invalid seed`);
  }
  c.eq((await issue(a.jar, { ...base, answer: '9' })).status, 400, 'an issue request cannot carry an answer');
  c.eq((await issue(a.jar, { ...base, curriculum: 'au' })).status, 400, 'nor name another curriculum');

  // 5 · what was adopted is what is graded
  const { root } = solveLinearPrompt(baseQ.prompt);
  const again = (await issue(a.jar, base)).data.question;
  for (const [label, q] of [['first issuance', baseQ], ['re-issuance', again]]) {
    const marked = await submit(a.jar, q.id, `seed-root-${label.replace(/\W/g, '-')}`, String(root));
    c.eq(marked.status, 200, `${label}: the root solved from the public prompt is graded`);
    c.eq(marked.data.correct, true, `${label}: and is correct`);
    c.eq(marked.data.marksEarned, marked.data.marksPossible, `${label}: for full marks`);
    c.eq(marked.data.contentId, baseQ.contentId, `${label}: against the same content`);
  }
  const mine = (await issue(b.jar, base)).data.question;
  const wrong = await submit(b.jar, mine.id, 'seed-root-wrong-b', String(root + 1));
  c.eq(wrong.data.correct, false, 'and a wrong answer to the same seed is wrong for the second account');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}

console.log(`engine: ${h.engine}`);
console.log(`PRACTICE SEED REISSUE: PASS — ${c.count()}/${c.count()} checks — the same generator, difficulty, seed and curriculum issue the same public question every time, with no answer or solution key, as a separate question per issuance and per account; another account cannot grade it.`);
