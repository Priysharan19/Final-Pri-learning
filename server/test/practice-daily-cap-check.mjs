// Pri Learning · the free plan's daily practice cap is the SERVER's (#537).
//
// Since #418 every creditable question is issued by the server, so the cap is
// decided there, per account, from the server's own entitlement record and its
// own count — a modified client, a cleared device or a second device changes
// nothing. Over real HTTP, on either engine:
//   · a free account is issued its 20 questions and refused the 21st with
//     402 FREE_CAP_REACHED, Retry-After and the reset instant (IST midnight);
//     the refusal escrows nothing and counts nothing;
//   · a question issued before the cap is still marked and revealed at the cap;
//   · a replayed issue (same Idempotency-Key, or the same account re-binding a
//     prepared question) returns the stored question and counts nothing;
//   · two devices on one account share one count, and racing for the last
//     question exactly one of them gets it;
//   · a capped bind never burns the prepared token: another account takes it up;
//   · "the same question again" from History counts and is refused at the cap;
//   · Rush, Match and the placement check are not counted (free copy: "20
//     practice questions a day, and everything else unlimited");
//   · Premium (the server's record) is unlimited; an expired period, a claimed
//     plan in a header or body, and another account's usage grant nothing;
//   · the day turns over at midnight Asia/Kolkata and the count starts afresh;
//   · the issue reply itself is unchanged: the question and the account id.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-daily-cap-'));
delete process.env.NODE_ENV;              // the product's own mode: the server chooses every question
delete process.env.PRI_FREE_PRACTICE_PER_DAY; // the shipped default, 20
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '7c'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;

// The suite owns the clock: the route reads Date.now() once per request, so a
// day can turn over without waiting for one.
const realNow = Date.now;
let clockOffset = 0;
Date.now = () => realNow() + clockOffset;
const now = () => Date.now();

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { practiceDay, practiceAllowanceConfigProblems, freePracticePerDay, practiceModeCounted, PRACTICE_DAILY_SCOPE, PRACTICE_DAY_TIME_ZONE } = await import('../platform/practiceAllowance.js');
const { FREE_PRACTICE_ALLOWANCE, CAPPED_PRACTICE_MODES } = await import('../../client/src/engine/practiceAllowance.js');
const h = await startApp({ engine: requestedEngine() });
const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const LIMIT = FREE_PRACTICE_ALLOWANCE.perDay;
const REQUEST = { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in', mode: 'practice' };
const PASSWORD = 'correct-horse-battery';
const post = (path, body, jar = {}, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, extra = {}, headers = {}) => post('/v1/practice/issue', { ...REQUEST, ...extra }, jar, headers);
let sub = 0;
const grade = (jar, id, answer) => { const sid = `daily-cap-${String(++sub).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid }); };
const sealedAnswer = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer;
const escrowed = async accountId => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [accountId])).n);
// The server's own count for an account's day (the test's desk reads the row).
const counted = async (accountId, dayKey = practiceDay(now()).key) => {
  const row = await h.db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, PRACTICE_DAILY_SCOPE, dayKey]);
  return row ? Number(JSON.parse(row.response_json).issued) : 0;
};
const counterExpiry = async (accountId, dayKey) => Number((await h.db.get('SELECT expires_at FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, PRACTICE_DAILY_SCOPE, dayKey]))?.expires_at);
const answerOf = a => a?.canonicalInput ?? (a?.simplestFraction ? `${a.simplestFraction.n}/${a.simplestFraction.d}` : a?.value);
const kolkataDay = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

try {
  // ── the pure rules ──────────────────────────────────────────────────────────
  c.eq(LIMIT, 20, 'the free plan is 20 practice questions a day — one definition, shared with the device');
  c.eq(PRACTICE_DAY_TIME_ZONE, 'Asia/Kolkata', 'the server\'s day is the Indian calendar day');
  for (const ms of [Date.UTC(2026, 8, 5, 18, 0, 0), Date.UTC(2026, 8, 5, 18, 30, 0), Date.UTC(2026, 8, 5, 18, 29, 59, 999), Date.UTC(2026, 0, 1, 0, 0, 0), Date.UTC(2026, 11, 31, 23, 59, 59), realNow()]) {
    const day = practiceDay(ms);
    c.eq(day.key, kolkataDay(ms), `${new Date(ms).toISOString()} falls on the Asia/Kolkata day ${day.key}`);
    c.ok(day.start <= ms && ms < day.end && day.end - day.start === DAY && kolkataDay(day.start) === day.key && kolkataDay(day.end - 1) === day.key && kolkataDay(day.end) !== day.key,
      `its bounds are exactly that day's midnights (${new Date(day.start).toISOString()} → ${new Date(day.end).toISOString()})`);
  }
  c.eq(practiceDay(Date.UTC(2026, 8, 5, 18, 29, 59, 999)).key, '2026-09-05', '23:59:59.999 IST is still the same day');
  c.eq(practiceDay(Date.UTC(2026, 8, 5, 18, 30, 0)).key, '2026-09-06', 'and 00:00:00 IST is the next');
  c.eq(freePracticePerDay({}), LIMIT, 'unset, the deployment runs the shipped cap');
  c.eq(freePracticePerDay({ PRI_FREE_PRACTICE_PER_DAY: '35' }), 35, 'the cap is deployment-tunable');
  c.deq(practiceAllowanceConfigProblems({}), [], 'no configuration is a valid configuration');
  for (const bad of ['0', '-3', 'twenty', '1.5', '100001']) c.eq(practiceAllowanceConfigProblems({ PRI_FREE_PRACTICE_PER_DAY: bad }).length, 1, `PRI_FREE_PRACTICE_PER_DAY=${bad} is a configuration problem (production refuses to boot)`);
  c.deq(CAPPED_PRACTICE_MODES.filter(practiceModeCounted), ['practice', 'review', 'task'], 'the Practice surface\'s modes are counted');
  c.deq(['rush', 'match', 'placement'].filter(practiceModeCounted), [], 'Rush, Match and the placement check are not');

  // ── accounts ────────────────────────────────────────────────────────────────
  const a = await registerAccount(h, { email: 'daily.cap.a@example.test', password: PASSWORD, deviceId: 'ipad-cap-a' });
  const b = await registerAccount(h, { email: 'daily.cap.b@example.test', password: PASSWORD, deviceId: 'ipad-cap-b' });
  const p = await registerAccount(h, { email: 'daily.cap.premium@example.test', password: PASSWORD, deviceId: 'ipad-cap-p' });
  const lapsed = await registerAccount(h, { email: 'daily.cap.lapsed@example.test', password: PASSWORD, deviceId: 'ipad-cap-l' });
  c.deq([a.status, b.status, p.status, lapsed.status], [201, 201, 201, 201], 'four real accounts exist');
  for (const who of [a, b, p, lapsed]) c.eq((await verifyEmail(h, who.account.id)).status, 200, `${who.account.id} is verified`);
  // Premium is the server's own record, as a verified purchase writes it
  // (registration opened each account's snapshot as free).
  const paid = (accountId, periodEnd) => h.db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,product_id,current_period_end,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,product_id=excluded.product_id,current_period_end=excluded.current_period_end,source_version=excluded.source_version,updated_at=excluded.updated_at`,
  [accountId, 'premium', 'active', 'apple', 'pri-premium-monthly', periodEnd, now()]);
  await paid(p.account.id, now() + 30 * DAY);
  await paid(lapsed.account.id, now() - DAY);
  const today = practiceDay(now());

  // ── one account, two devices, one count ─────────────────────────────────────
  const a2 = {};
  const login = await post('/v1/account/login', { email: 'daily.cap.a@example.test', password: PASSWORD, deviceId: 'iphone-cap-a' }, a2);
  c.eq(login.status, 200, 'the same account signs in on a second device');
  const first = await issue(a.jar);
  c.deq([first.status, Object.keys(first.data).sort(), first.data.accountId], [201, ['accountId', 'question'], String(a.account.id)], 'the issue reply is unchanged: the question and the account id, nothing beside them');
  c.eq(await counted(a.account.id), 1, 'and the server\'s own count for the account\'s day says 1');
  for (let i = 2; i <= 17; i++) {
    const r = await issue(i % 2 ? a.jar : a2);
    c.deq([r.status, await counted(a.account.id)], [201, i], `question ${i} is issued to the account from ${i % 2 ? 'the iPad' : 'the iPhone'} and the account's count says ${i}`);
  }

  // A retried issue under its own key is the same question and counts once.
  const keyed = await issue(a.jar, {}, { 'Idempotency-Key': 'daily-cap-retry-0018' });
  c.deq([keyed.status, await counted(a.account.id)], [201, 18], 'question 18 is issued under an idempotency key');
  const replayed = await issue(a2, {}, { 'Idempotency-Key': 'daily-cap-retry-0018' });
  c.deq([replayed.status, replayed.data?.question?.id, await counted(a.account.id)], [201, keyed.data.question.id, 18],
    'the same key from the other device gets the same question back, and the count stays at 18');

  // Rush, Match and the placement check are "everything else": issued, uncounted.
  for (const mode of ['rush', 'match', 'placement']) {
    const r = await issue(a.jar, { mode });
    c.deq([r.status, await counted(a.account.id)], [201, 18], `a ${mode} question is issued and does not count toward the practice day`);
  }

  const nineteenth = await issue(a.jar);
  c.deq([nineteenth.status, await counted(a.account.id)], [201, 19], 'question 19');
  // Both devices ask for the last question at once: exactly one gets it.
  const [r1, r2] = await Promise.all([issue(a.jar), issue(a2)]);
  c.deq([r1.status, r2.status].sort(), [201, 402], 'two devices racing for the twentieth question: exactly one is issued, the other is refused');
  const twentieth = r1.status === 201 ? r1 : r2;
  c.eq(await counted(a.account.id), LIMIT, 'and the account\'s count is exactly 20');
  const escrowedAtCap = await escrowed(a.account.id);

  // ── the twenty-first ───────────────────────────────────────────────────────
  const refused = await issue(a2);
  const err = refused.data?.error || {};
  c.deq([refused.status, err.code, err.capability, err.plan, err.used, err.limit, err.resetAt, err.timeZone, err.retryable, err.window],
    [402, 'FREE_CAP_REACHED', 'unlimited-practice', 'free', LIMIT, LIMIT, today.end, 'Asia/Kolkata', true, 'day'],
    'the twenty-first is refused with the device\'s own code, the count, the limit and the reset instant');
  c.match(err.message, /20 free practice questions.*midnight \(Asia\/Kolkata\).*Premium/, 'the refusal says what ran out, when it comes back and what Premium changes');
  const retryAfter = Number(refused.headers.get('retry-after'));
  const expectedRetry = Math.ceil((today.end - now()) / 1000);
  c.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && Math.abs(retryAfter - expectedRetry) <= 5, `Retry-After is the seconds until midnight (${retryAfter}s, expected about ${expectedRetry}s)`);
  c.eq(Number(refused.headers.get('ratelimit-reset')), Math.ceil(today.end / 1000), 'RateLimit-Reset names the same instant');
  c.eq(refused.headers.get('cache-control'), 'no-store', 'and the refusal is never cached');
  c.eq(await escrowed(a.account.id), escrowedAtCap, 'a refusal escrows nothing');
  c.eq(await counted(a.account.id), LIMIT, 'and counts nothing');
  c.ok(!JSON.stringify(refused.data).includes(a.account.id), 'the refusal carries no account id');
  c.eq((await issue(a.jar)).status, 402, 'the first device is refused too: the cap is the account\'s, not the device\'s');
  c.eq((await issue(a.jar, {}, { 'x-pri-plan': 'premium', 'x-pri-entitlement': 'unlimited-practice' })).status, 402, 'a Premium claim in a header changes nothing');
  c.eq((await issue(a.jar, { plan: 'premium' })).status, 400, 'a Premium claim in the body is not even a valid request');

  // ── what a capped account can still do ──────────────────────────────────────
  const stillSame = await issue(a.jar, {}, { 'Idempotency-Key': 'daily-cap-retry-0018' });
  c.deq([stillSame.status, stillSame.data?.question?.id, await counted(a.account.id)], [201, keyed.data.question.id, LIMIT],
    'a question issued before the cap is handed back under its key even at the cap — a lost reply is not a lost question');
  const qid = twentieth.data.question.id;
  const wrong = await grade(a.jar, qid, '987654321');
  c.deq([wrong.status, wrong.data?.authoritative, wrong.data?.correct, wrong.data?.resolved, wrong.data?.triesLeft], [200, true, false, false, 1],
    'the twentieth question is still marked at the cap: a wrong answer, one try left');
  const right = await grade(a.jar, qid, answerOf(await sealedAnswer(qid)));
  c.deq([right.status, right.data?.authoritative, right.data?.correct, right.data?.resolved], [200, true, true, true], 'and its right answer earns the mark');
  const reveal = await post(`/v1/practice/${nineteenth.data.question.id}/reveal`, {}, a.jar);
  c.ok(reveal.status === 200 && reveal.data?.solution, 'an issued question can still be revealed at the cap');
  const repeatCapped = await post(`/v1/practice/${qid}/repeat`, {}, a.jar);
  c.deq([repeatCapped.status, repeatCapped.data?.error?.code], [402, 'FREE_CAP_REACHED'], '"the same question again" is a practice question: refused at the cap, as the device refuses a History retry');
  c.eq(await escrowed(a.account.id), escrowedAtCap, 'the refused repeat escrowed nothing');
  for (const mode of ['rush', 'match', 'placement']) {
    const r = await issue(a.jar, { mode });
    c.deq([r.status, await counted(a.account.id)], [201, LIMIT], `${mode} is still issued at the cap, and still does not count`);
  }
  c.eq(await escrowed(a.account.id), escrowedAtCap + 3, 'those three were really issued');

  // ── a capped bind never burns the prepared token ────────────────────────────
  const prepared = await post('/v1/practice/prepare', REQUEST);
  c.eq(prepared.status, 200, 'a signed-out student is shown a prepared question');
  const capBind = await post('/v1/practice/issue', { prepared: prepared.data.prepared, account: String(a.account.id) }, a.jar);
  c.deq([capBind.status, capBind.data?.error?.code], [402, 'FREE_CAP_REACHED'], 'the capped account cannot bind it: the question would be creditable');
  const otherBind = await post('/v1/practice/issue', { prepared: prepared.data.prepared, account: String(b.account.id) }, b.jar);
  c.deq([otherBind.status, otherBind.data?.question?.prompt, await counted(b.account.id)], [201, prepared.data.question.prompt, 1],
    'the token was not burnt: another account takes the same question up, as its first of the day');
  const otherAgain = await post('/v1/practice/issue', { prepared: prepared.data.prepared, account: String(b.account.id) }, b.jar);
  c.deq([otherAgain.status, otherAgain.data?.question?.id, await counted(b.account.id)], [201, otherBind.data.question.id, 1],
    're-binding the same prepared question is the same issue and counts once');
  const bQid = otherBind.data.question.id;
  c.eq((await grade(b.jar, bQid, answerOf(await sealedAnswer(bQid)))).data?.resolved, true, 'the other account resolves its question');
  const repeatOk = await post(`/v1/practice/${bQid}/repeat`, {}, b.jar);
  c.deq([repeatOk.status, repeatOk.data?.repeat, await counted(b.account.id)], [201, true, 2], 'and "the same question again" is issued to it, counted as its second');

  // ── Premium is unlimited; a lapsed period is not ────────────────────────────
  let premiumIssued = 0;
  for (let i = 1; i <= LIMIT + 5; i++) {
    const r = await issue(p.jar);
    if (r.status !== 201) { c.ok(false, `Premium question ${i}: ${r.status} ${JSON.stringify(r.data?.error)}`); break; }
    premiumIssued++;
  }
  c.eq(premiumIssued, LIMIT + 5, `Premium is issued ${LIMIT + 5} questions in a day: unlimited, as the server's own record says`);
  c.eq(await counted(p.account.id), LIMIT + 5, 'its day is still counted, so a plan that lapses mid-day is held to the free cap from then on');
  c.eq((await post(`/v1/practice/${(await issue(p.jar)).data.question.id}/repeat`, {}, p.jar)).status, 409, 'Premium\'s unresolved question is refused a repeat for its own reason, never for the cap');
  let lapsedIssued = 0;
  for (let i = 1; i <= LIMIT; i++) if ((await issue(lapsed.jar)).status === 201) lapsedIssued++;
  c.eq(lapsedIssued, LIMIT, 'a "premium" record whose period has ended is a free account: its 20 are issued');
  c.eq((await issue(lapsed.jar)).data?.error?.code, 'FREE_CAP_REACHED', 'and its twenty-first is refused like one');
  c.eq(await counted(a.account.id), LIMIT, 'nothing any other account did changed the capped account\'s count');

  // ── the day turns over at midnight Asia/Kolkata ─────────────────────────────
  c.eq(await counterExpiry(a.account.id, today.key), today.end + DAY, 'the day\'s counter expires a day after the day ends (housekeeping purges it)');
  clockOffset = today.end - realNow() - 1000;      // 23:59:59 IST
  c.eq((await issue(a.jar)).data?.error?.code, 'FREE_CAP_REACHED', 'one second before midnight the account is still capped');
  clockOffset = today.end - realNow() + 1000;      // 00:00:01 IST
  const tomorrow = practiceDay(now());
  c.eq(tomorrow.start, today.end, 'the next day begins the instant this one ends');
  const fresh = await issue(a.jar);
  c.deq([fresh.status, await counted(a.account.id, tomorrow.key)], [201, 1], 'one second after midnight the account is issued its first question of the new day');
  const fresh2 = await issue(a2);
  c.deq([fresh2.status, await counted(a.account.id, tomorrow.key)], [201, 2], 'the other device shares the new day\'s count');
  c.eq(await counted(a.account.id, today.key), LIMIT, 'yesterday\'s count is kept as its own row');
  const refusedTomorrow = await (async () => { for (let i = 3; i <= LIMIT; i++) await issue(a.jar); return issue(a.jar); })();
  c.deq([refusedTomorrow.status, refusedTomorrow.data?.error?.resetAt], [402, tomorrow.end], 'and the new day has its own twenty and its own midnight');

  // The Postgres runner only counts a suite that says which engine it ran on.
  console.log(`engine: ${h.engine}`);
  console.log(`DAILY PRACTICE CAP: PASS — ${c.count()}/${c.count()} checks — the free day is the account's, decided by the server at issue, idempotent, device-blind, and turns over at midnight Asia/Kolkata.`);
} catch (error) {
  console.error(error);
  console.log('DAILY PRACTICE CAP: FAIL');
  process.exitCode = 1;
} finally {
  Date.now = realNow;
  await h.close();
}
