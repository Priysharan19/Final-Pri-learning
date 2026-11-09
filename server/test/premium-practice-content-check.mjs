// Pri Learning · D19 on the practice routes: JEE Advanced's own questions are
// Premium, and every question the free day counts is counted.
//
// Owner default D19 (docs/release/V1_DECISIONS_2026-11-01.md): "Free: 20
// questions a day ... Premium: unlimited questions and papers, plus JEE
// Advanced, which the server enforces." Over real HTTP, on either engine:
//   · a generator that exists only for the JEE Advanced track (the question
//     department's `jee-advanced-*`, the archive's `pyq-jee-advanced-*`) is
//     refused to a free account with 402 PREMIUM_REQUIRED before anything is
//     generated, escrowed or counted — at issue, at the bind of a prepared
//     question (which keeps its token), at "the same question again" and at a
//     notebook twin; a lapsed period and a claimed plan in a header are free;
//   · Premium (the server's own record) is not refused for that reason;
//   · JEE Main-depth chapter questions at difficulty 4 stay free content;
//   · a notebook twin is a question of the free day: it is counted, and
//     refused at the cap with 402 FREE_CAP_REACHED (it used to be issued
//     uncounted — an unlimited supply of free questions);
//   · Premium twins are not counted against anything.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const scratch = mkdtempSync(join(tmpdir(), 'pri-premium-content-'));
process.env.NODE_ENV = 'test';                  // fixed seeds: the same trap on demand
delete process.env.PRI_FREE_PRACTICE_PER_DAY;   // the shipped default, 20
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '5d'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { practiceDay, PRACTICE_DAILY_SCOPE } = await import('../platform/practiceAllowance.js');
const { premiumCapabilityForGenerator, PREMIUM_PRACTICE_CONTENT, FREE_PRACTICE_ALLOWANCE } = await import('../../client/src/engine/practiceAllowance.js');
const { encryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const h = await startApp({ engine: requestedEngine() });
const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const LIMIT = FREE_PRACTICE_ALLOWANCE.perDay;
const ADVANCED = 'jee-advanced-c11-binomial-theorem';
const ARCHIVE = 'pyq-jee-advanced-c11-conic-sections';
const PERCENT = 'c8-percentage-reasoning'; // seed 4242, D2: a 30% rise, with a trap value (an India bank, D15)
const post = (path, body, jar = {}, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, generator, extra = {}, headers = {}) => post('/v1/practice/issue', { generator, difficulty: 3, curriculum: 'in', mode: 'practice', ...extra }, jar, headers);
let sub = 0;
const grade = (jar, id, answer) => { const sid = `premium-content-${String(++sub).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid }); };
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const reseal = async (id, patch) => h.db.run("UPDATE idempotency_keys SET response_json=? WHERE scope='practice-question' AND key=?", [JSON.stringify({ ...await sealed(id), ...patch }), id]);
const escrowed = async accountId => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [accountId])).n);
const counted = async accountId => {
  const row = await h.db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, PRACTICE_DAILY_SCOPE, practiceDay(Date.now()).key]);
  return row ? Number(JSON.parse(row.response_json).issued) : 0;
};
const eventOf = async id => { const row = await h.db.get("SELECT id,payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id]); return row ? { eventId: row.id, ...JSON.parse(row.payload_json) } : null; };
const preparedToken = (g, d = 3) => encryptDeliveryToken(JSON.stringify({ g, d, s: 7, m: 'practice', x: Date.now() + 60 * 60 * 1000, n: randomUUID() }), 'practice-prepared-v1');
const premiumRefusal = r => r.status === 402 && r.data?.error?.code === 'PREMIUM_REQUIRED' && r.data.error.capability === 'jee-advanced-content';

/** A question this account resolved wrong under a diagnosed trap: a filed notebook entry. */
async function filedEntry(jar) {
  const t = await issue(jar, PERCENT, { seed: 4242, difficulty: 2 });
  const id = t.data.question.id;
  const trap = (await sealed(id)).traps.find(x => x.value !== undefined);
  await grade(jar, id, trap.value);
  await grade(jar, id, trap.value);
  return { questionId: id, eventId: (await eventOf(id)).eventId };
}

try {
  // ── the one definition ─────────────────────────────────────────────────────
  c.deq(PREMIUM_PRACTICE_CONTENT.map(rule => rule.capability), ['jee-advanced-content'], 'one Premium practice rule: JEE Advanced\'s own content');
  for (const id of [ADVANCED, ARCHIVE, 'jee-advanced-c12-integrals']) c.eq(premiumCapabilityForGenerator(id), 'jee-advanced-content', `${id} is JEE Advanced's own content`);
  for (const id of ['jee-main-c11-binomial-theorem', 'pyq-jee-main-c11-conic-sections', 'c11-binomial-theorem', 'pyq-cbse-c10-real-numbers', 'xjee-advanced-c11-sets', '', null]) {
    c.eq(premiumCapabilityForGenerator(id), null, `${JSON.stringify(id)} is not Premium content`);
  }

  // ── accounts ───────────────────────────────────────────────────────────────
  const free = await registerAccount(h, { email: 'content.free@example.test', deviceId: 'ipad-content-free' });
  const premium = await registerAccount(h, { email: 'content.premium@example.test', deviceId: 'ipad-content-premium' });
  const lapsed = await registerAccount(h, { email: 'content.lapsed@example.test', deviceId: 'ipad-content-lapsed' });
  const twins = await registerAccount(h, { email: 'content.twins@example.test', deviceId: 'ipad-content-twins' });
  for (const who of [free, premium, lapsed, twins]) c.eq((await verifyEmail(h, who.account.id)).status, 200, `${who.account.email || who.account.id} is verified`);
  const paid = (accountId, periodEnd) => h.db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,product_id,current_period_end,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,product_id=excluded.product_id,current_period_end=excluded.current_period_end,source_version=excluded.source_version,updated_at=excluded.updated_at`,
  [accountId, 'premium', 'active', 'apple', 'com.prilearning.app.premium.monthly', periodEnd, Date.now()]);
  await paid(premium.account.id, Date.now() + 30 * DAY);
  await paid(lapsed.account.id, Date.now() - DAY);

  // ── issue ──────────────────────────────────────────────────────────────────
  for (const generator of [ADVANCED, ARCHIVE]) {
    const r = await issue(free.jar, generator);
    c.ok(premiumRefusal(r), `a free account asking for ${generator} is refused: 402 PREMIUM_REQUIRED, jee-advanced-content (${r.status} ${r.data?.error?.code})`);
  }
  const refusal = (await issue(free.jar, ADVANCED)).data.error;
  c.deq([refusal.plan, refusal.retryable], ['free', false], 'the refusal says the plan is the reason and that retrying will not help');
  c.match(refusal.message, /JEE Advanced track is part of Pri Learning Premium.*JEE Main/, 'and says, as the device\'s gate does, that JEE Main stays free');
  c.deq([await escrowed(free.account.id), await counted(free.account.id)], [0, 0], 'nothing was escrowed and nothing counted toward the free day');
  c.ok(premiumRefusal(await issue(lapsed.jar, ADVANCED)), 'a "premium" record whose period has ended is free: refused');
  c.ok(premiumRefusal(await issue(free.jar, ADVANCED, {}, { 'x-pri-plan': 'premium', 'x-pri-capabilities': 'jee-advanced-content' })), 'a Premium claim in a header changes nothing');
  c.eq((await issue(free.jar, ADVANCED, { plan: 'premium' })).status, 400, 'a Premium claim in the body is not even a valid request');
  const premiumAsk = await issue(premium.jar, ADVANCED);
  c.ok(!premiumRefusal(premiumAsk), `Premium is not refused for its plan (${premiumAsk.status} ${premiumAsk.data?.error?.code || ''}: this server does not carry the bank yet, and says so)`);
  const mainDepth = await issue(free.jar, 'c11-binomial-theorem', { difficulty: 4 });
  c.eq(mainDepth.status, 201, 'a difficulty-4 chapter question — JEE Main depth, the same item the JEE Advanced track serves — stays free content');
  c.eq(await counted(free.account.id), 1, 'and counts toward the free day like any practice question');

  // ── the bind of a prepared question ────────────────────────────────────────
  const token = preparedToken(ADVANCED);
  const bound = await post('/v1/practice/issue', { prepared: token, account: String(free.account.id) }, free.jar);
  c.ok(premiumRefusal(bound), 'a free account binding a prepared JEE Advanced question is refused');
  const claim = await h.db.get('SELECT count FROM rate_limits WHERE bucket LIKE ?', ['practice-prepared-claim:%']);
  c.eq(claim ?? null, null, 'and the prepared token is not spent: no claim was written');
  const premiumBind = await post('/v1/practice/issue', { prepared: token, account: String(premium.account.id) }, premium.jar);
  c.ok(!premiumRefusal(premiumBind), `Premium binding the same token is not refused for its plan (${premiumBind.status})`);

  // ── the same question again ────────────────────────────────────────────────
  // A question issued while Premium was live, stored as the server stores it,
  // then the period lapses: History's "again" is a new issue, and is refused.
  const { questionId: seenId } = await filedEntry(lapsed.jar);
  const key = await sealed(seenId);
  await reseal(seenId, { _generator: ADVANCED });
  const lapsedRepeat = await post(`/v1/practice/${seenId}/repeat`, {}, lapsed.jar);
  c.ok(premiumRefusal(lapsedRepeat), 'a lapsed account repeating a JEE Advanced question is refused');
  await paid(lapsed.account.id, Date.now() + DAY);
  const renewedRepeat = await post(`/v1/practice/${seenId}/repeat`, {}, lapsed.jar);
  c.eq(renewedRepeat.status, 201, 'once the account is Premium again, the same repeat is issued');
  c.eq(renewedRepeat.data.question.prompt, key.prompt, 'and it is the same question');
  await paid(lapsed.account.id, Date.now() - DAY);

  // ── notebook twins: JEE Advanced stays Premium ─────────────────────────────
  const advancedEntry = await filedEntry(free.jar);
  await reseal(advancedEntry.questionId, { _generator: ADVANCED });
  c.ok(premiumRefusal(await post(`/v1/practice/notebook/${advancedEntry.eventId}/twin`, {}, free.jar)), 'a free account is refused a twin of a JEE Advanced entry');

  // ── notebook twins count toward the free day ───────────────────────────────
  const entry = await filedEntry(twins.jar);
  c.eq(await counted(twins.account.id), 1, 'the question behind the entry counted once');
  const firstTwin = await post(`/v1/practice/notebook/${entry.eventId}/twin`, {}, twins.jar);
  c.eq(firstTwin.status, 201, 'a free account draws a twin');
  c.eq(await counted(twins.account.id), 2, 'and the twin counts toward the free day');
  for (let i = 3; i <= LIMIT; i++) await issue(twins.jar, 'c8-linear-equations-both-sides', { difficulty: 2 });
  c.eq(await counted(twins.account.id), LIMIT, `the day is used up at ${LIMIT}`);
  const before = await escrowed(twins.account.id);
  const cappedTwin = await post(`/v1/practice/notebook/${entry.eventId}/twin`, {}, twins.jar);
  const err = cappedTwin.data?.error || {};
  c.deq([cappedTwin.status, err.code, err.capability, err.used, err.limit], [402, 'FREE_CAP_REACHED', 'unlimited-practice', LIMIT, LIMIT],
    'at the cap a twin is refused like any question: 402 FREE_CAP_REACHED with the server\'s count');
  const retryAfter = Number(cappedTwin.headers.get('retry-after'));
  c.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && Math.abs(retryAfter - Math.ceil((practiceDay(Date.now()).end - Date.now()) / 1000)) <= 5,
    `with Retry-After at the day's end (${retryAfter}s)`);
  c.deq([await escrowed(twins.account.id), await counted(twins.account.id)], [before, LIMIT], 'the refused twin escrowed nothing and counted nothing');

  // ── Premium twins are not limited ──────────────────────────────────────────
  const premiumEntry = await filedEntry(premium.jar);
  let premiumTwins = 0;
  for (let i = 0; i < 3; i++) if ((await post(`/v1/practice/notebook/${premiumEntry.eventId}/twin`, {}, premium.jar)).status === 201) premiumTwins++;
  c.eq(premiumTwins, 3, 'Premium draws twins without a daily limit');

  // The Postgres runner only counts a suite that says which engine it ran on.
  console.log(`engine: ${h.engine}`);
  console.log(`PREMIUM PRACTICE CONTENT: PASS — ${c.count()}/${c.count()} checks — JEE Advanced's own questions are issued to Premium only (issue, bind, repeat, twin), JEE Main-depth items stay free, and notebook twins count toward the free day.`);
} catch (error) {
  console.error(error);
  console.log('PREMIUM PRACTICE CONTENT: FAIL');
  process.exitCode = 1;
} finally {
  await h.close();
}
