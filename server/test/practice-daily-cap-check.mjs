// Pri Learning · the free plan's daily MARKING allowance is the SERVER's
// (#537, re-scoped by the notebook/paywall split).
//
// Practice is unlimited on the free plan; what it rations is examiner marking
// — 5 marked scripts a day. The allowance is decided by the server, per
// account, from its own entitlement record and its own count — a modified
// client, a cleared device or a second device changes nothing. Over real HTTP,
// on either engine:
//   · a free account is issued as many questions as it asks for, in every
//     mode; issuing counts nothing;
//   · each question marked is one script; its second try is the same script,
//     counted once and never refused, even at the limit;
//   · the sixth script of the day is refused with 402 FREE_CAP_REACHED
//     (capability unlimited-marking), Retry-After and the reset instant (IST
//     midnight), BEFORE the marker runs: the refusal writes no reply, spends no
//     try and counts nothing;
//   · a replayed submission returns its stored reply, at the limit too, and
//     counts nothing; an unreadable entry is no script;
//   · two devices on one account share one count, and racing for the last
//     script exactly one of them is marked;
//   · Rush, Match and the placement check are not counted;
//   · Premium (the server's record) is unlimited; an expired period, a claimed
//     plan in a header or body, and another account's usage grant nothing;
//   · the day turns over at midnight Asia/Kolkata and the count starts afresh;
//   · a question can still be revealed at the limit.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-daily-cap-'));
delete process.env.NODE_ENV;              // the product's own mode: the server chooses every question
delete process.env.PRI_FREE_MARKED_PER_DAY; // the shipped default, 5
delete process.env.PRI_FREE_PRACTICE_PER_DAY;
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
const { practiceDay, practiceAllowanceConfigProblems, freeMarkedPerDay, practiceModeCounted, MARKING_DAILY_SCOPE, PRACTICE_DAY_TIME_ZONE } = await import('../platform/practiceAllowance.js');
const { FREE_MARKING_ALLOWANCE, FREE_PRACTICE_ALLOWANCE, CAPPED_PRACTICE_MODES } = await import('../../client/src/engine/practiceAllowance.js');
const { PREMIUM_CAPABILITIES } = await import('../platform/entitlements.js');
const h = await startApp({ engine: requestedEngine() });
const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const LIMIT = FREE_MARKING_ALLOWANCE.scriptsPerDay;
const REQUEST = { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in', mode: 'practice' };
const PASSWORD = 'correct-horse-battery';
const post = (path, body, jar = {}, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, extra = {}, headers = {}) => post('/v1/practice/issue', { ...REQUEST, ...extra }, jar, headers);
let sub = 0;
const nextSid = () => `daily-cap-${String(++sub).padStart(4, '0')}`;
const grade = (jar, id, answer, sid = nextSid(), headers = {}) => post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid, ...headers });
const sealedAnswer = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer;
const rowsOf = async (accountId, scope) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?', [accountId, scope])).n);
// The server's own count for an account's day (the test's desk reads the row).
const counted = async (accountId, dayKey = practiceDay(now()).key) => {
  const row = await h.db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, MARKING_DAILY_SCOPE, dayKey]);
  return row ? JSON.parse(row.response_json).marked.length : 0;
};
const counterExpiry = async (accountId, dayKey) => Number((await h.db.get('SELECT expires_at FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, MARKING_DAILY_SCOPE, dayKey]))?.expires_at);
const answerOf = a => a?.canonicalInput ?? (a?.simplestFraction ? `${a.simplestFraction.n}/${a.simplestFraction.d}` : a?.value);
const kolkataDay = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const WRONG = '987654321';

try {
  // ── the pure rules ──────────────────────────────────────────────────────────
  c.eq(PRACTICE_DAY_TIME_ZONE, 'Asia/Kolkata', 'the server\'s day is the Indian calendar day');
  for (const ms of [Date.UTC(2026, 8, 5, 18, 0, 0), Date.UTC(2026, 8, 5, 18, 30, 0), Date.UTC(2026, 8, 5, 18, 29, 59, 999), Date.UTC(2026, 0, 1, 0, 0, 0), Date.UTC(2026, 11, 31, 23, 59, 59), realNow()]) {
    const day = practiceDay(ms);
    c.eq(day.key, kolkataDay(ms), `${new Date(ms).toISOString()} falls on the Asia/Kolkata day ${day.key}`);
    c.ok(day.start <= ms && ms < day.end && day.end - day.start === DAY && kolkataDay(day.start) === day.key && kolkataDay(day.end - 1) === day.key && kolkataDay(day.end) !== day.key,
      `its bounds are exactly that day's midnights (${new Date(day.start).toISOString()} → ${new Date(day.end).toISOString()})`);
  }
  c.eq(practiceDay(Date.UTC(2026, 8, 5, 18, 29, 59, 999)).key, '2026-09-05', '23:59:59.999 IST is still the same day');
  c.eq(practiceDay(Date.UTC(2026, 8, 5, 18, 30, 0)).key, '2026-09-06', 'and 00:00:00 IST is the next');
  c.eq(LIMIT, 5, 'the free plan is 5 marked scripts a day — one definition, shared with the device');
  c.eq(FREE_PRACTICE_ALLOWANCE.perDay, null, 'and practice itself is unlimited');
  c.ok(PREMIUM_CAPABILITIES.includes('unlimited-marking') && PREMIUM_CAPABILITIES.includes('full-notebook'), 'Premium carries unlimited marking and the full notebook');
  c.eq(freeMarkedPerDay({}), LIMIT, 'unset, the deployment runs the shipped allowance');
  c.eq(freeMarkedPerDay({ PRI_FREE_MARKED_PER_DAY: '8' }), 8, 'the allowance is deployment-tunable');
  c.deq(practiceAllowanceConfigProblems({}), [], 'no configuration is a valid configuration');
  for (const bad of ['0', '-3', 'five', '1.5', '100001']) c.eq(practiceAllowanceConfigProblems({ PRI_FREE_MARKED_PER_DAY: bad }).length, 1, `PRI_FREE_MARKED_PER_DAY=${bad} is a configuration problem (production refuses to boot)`);
  c.deq(CAPPED_PRACTICE_MODES.filter(practiceModeCounted), ['practice', 'review', 'task'], 'the Practice surface\'s modes are counted');
  c.deq(['rush', 'match', 'placement'].filter(practiceModeCounted), [], 'Rush, Match and the placement check are not');

  // ── accounts ────────────────────────────────────────────────────────────────
  const a = await registerAccount(h, { email: 'daily.cap.a@example.test', password: PASSWORD, deviceId: 'ipad-cap-a' });
  const b = await registerAccount(h, { email: 'daily.cap.b@example.test', password: PASSWORD, deviceId: 'ipad-cap-b' });
  const p = await registerAccount(h, { email: 'daily.cap.premium@example.test', password: PASSWORD, deviceId: 'ipad-cap-p' });
  const lapsed = await registerAccount(h, { email: 'daily.cap.lapsed@example.test', password: PASSWORD, deviceId: 'ipad-cap-l' });
  c.deq([a.status, b.status, p.status, lapsed.status], [201, 201, 201, 201], 'four real accounts exist');
  for (const who of [a, b, p, lapsed]) c.eq((await verifyEmail(h, who.account.id)).status, 200, `${who.account.id} is verified`);
  // Premium is the server's own record, as a verified purchase writes it.
  const paid = (accountId, periodEnd) => h.db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,product_id,current_period_end,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,product_id=excluded.product_id,current_period_end=excluded.current_period_end,source_version=excluded.source_version,updated_at=excluded.updated_at`,
  [accountId, 'premium', 'active', 'apple', 'pri-premium-monthly', periodEnd, now()]);
  await paid(p.account.id, now() + 30 * DAY);
  await paid(lapsed.account.id, now() - DAY);
  const today = practiceDay(now());

  // ── practice is unlimited ───────────────────────────────────────────────────
  const a2 = {};
  const login = await post('/v1/account/login', { email: 'daily.cap.a@example.test', password: PASSWORD, deviceId: 'iphone-cap-a' }, a2);
  c.eq(login.status, 200, 'the same account signs in on a second device');
  const qs = [];
  for (let i = 1; i <= 30; i++) {
    const r = await issue(i % 2 ? a.jar : a2);
    if (r.status !== 201) { c.ok(false, `free question ${i}: ${r.status} ${JSON.stringify(r.data?.error)}`); break; }
    qs.push(r.data.question.id);
  }
  c.eq(qs.length, 30, 'a free account is issued 30 practice questions in a day: practice is unlimited');
  c.deq(Object.keys((await issue(a.jar)).data).sort(), ['accountId', 'question'], 'the issue reply is unchanged: the question and the account id');
  for (const mode of ['rush', 'match', 'placement']) c.eq((await issue(a.jar, { mode })).status, 201, `a ${mode} question is issued`);
  c.eq(await counted(a.account.id), 0, 'issuing counts nothing');

  // ── each marked question is one script ──────────────────────────────────────
  const open1 = await grade(a.jar, qs[0], WRONG);
  c.deq([open1.status, open1.data?.resolved, await counted(a.account.id)], [200, false, 1], 'a first try on question 1 is marked and is the day\'s first script');
  const close1 = await grade(a2, qs[0], answerOf(await sealedAnswer(qs[0])));
  c.deq([close1.status, close1.data?.correct, await counted(a.account.id)], [200, true, 1], 'its second try, from the other device, is the same script: still 1');
  const unreadable = await grade(a.jar, qs[1], '');
  c.deq([unreadable.status, unreadable.data?.invalid, await counted(a.account.id)], [200, true, 1], 'an unreadable entry spends no try and is no script');
  const replaySid = nextSid();
  const r2 = await grade(a.jar, qs[1], WRONG, replaySid);
  c.deq([r2.status, await counted(a.account.id)], [200, 2], 'question 2 is the second script');
  const r3 = await grade(a2, qs[2], WRONG);
  c.deq([r3.status, await counted(a.account.id)], [200, 3], 'question 3 from the iPhone is the third: one count for the account');
  const r4 = await grade(a.jar, qs[3], WRONG);
  c.deq([r4.status, await counted(a.account.id)], [200, 4], 'question 4 is the fourth');
  // Both devices ask for the last free script at once: exactly one is marked.
  const [race1, race2] = await Promise.all([grade(a.jar, qs[4], WRONG), grade(a2, qs[5], WRONG)]);
  c.deq([race1.status, race2.status].sort(), [200, 402], 'two devices racing for the fifth script: exactly one is marked, the other refused');
  c.eq(await counted(a.account.id), LIMIT, 'and the account\'s count is exactly 5');
  const lost = race1.status === 402 ? qs[4] : qs[5];
  const won = race1.status === 402 ? qs[5] : qs[4];

  // ── the sixth script ───────────────────────────────────────────────────────
  const gradesBefore = await rowsOf(a.account.id, 'practice-grade');
  const triesBefore = await rowsOf(a.account.id, 'practice-tries');
  const refused = await grade(a.jar, qs[6], WRONG);
  const err = refused.data?.error || {};
  c.deq([refused.status, err.code, err.capability, err.plan, err.used, err.limit, err.resetAt, err.timeZone, err.retryable, err.window],
    [402, 'FREE_CAP_REACHED', 'unlimited-marking', 'free', LIMIT, LIMIT, today.end, 'Asia/Kolkata', true, 'day'],
    'the sixth script is refused with the device\'s own code, the count, the limit and the reset instant');
  c.match(err.message, /5 free marked answers.*Practice stays unlimited.*midnight \(Asia\/Kolkata\).*Premium/, 'the refusal says what ran out, that practice goes on, when marking comes back and what Premium changes');
  c.ok(!('correct' in refused.data) && !('feedback' in refused.data) && !('stepReport' in refused.data), 'and says nothing about the answer: it was never marked');
  const retryAfter = Number(refused.headers.get('retry-after'));
  const expectedRetry = Math.ceil((today.end - now()) / 1000);
  c.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && Math.abs(retryAfter - expectedRetry) <= 5, `Retry-After is the seconds until midnight (${retryAfter}s, expected about ${expectedRetry}s)`);
  c.eq(Number(refused.headers.get('ratelimit-reset')), Math.ceil(today.end / 1000), 'RateLimit-Reset names the same instant');
  c.eq(refused.headers.get('cache-control'), 'no-store', 'and the refusal is never cached');
  c.deq([await rowsOf(a.account.id, 'practice-grade'), await rowsOf(a.account.id, 'practice-tries'), await counted(a.account.id)], [gradesBefore, triesBefore, LIMIT],
    'a refusal writes no reply, spends no try and counts nothing');
  c.ok(!JSON.stringify(refused.data).includes(a.account.id), 'the refusal carries no account id');
  c.eq((await grade(a2, lost, WRONG)).status, 402, 'the other device is refused too: the allowance is the account\'s, not the device\'s');
  c.eq((await grade(a.jar, qs[7], WRONG, nextSid(), { 'x-pri-plan': 'premium', 'x-pri-entitlement': 'unlimited-marking' })).status, 402, 'a Premium claim in a header changes nothing');
  c.eq((await post(`/v1/practice/${qs[7]}/submit`, { submissionId: 'daily-cap-claim', answer: WRONG, mode: 'typed', plan: 'premium' }, a.jar, { 'Idempotency-Key': 'daily-cap-claim' })).status, 400, 'a Premium claim in the body is not even a valid request');

  // ── what a capped account can still do ──────────────────────────────────────
  const replay = await grade(a.jar, qs[1], WRONG, replaySid);
  c.deq([replay.status, replay.data?.attemptId, await counted(a.account.id)], [200, r2.data.attemptId, LIMIT], 'a committed submission replays under its key at the limit — a lost reply is not a lost mark');
  const second = await grade(a.jar, won, answerOf(await sealedAnswer(won)));
  c.deq([second.status, second.data?.correct, second.data?.resolved, await counted(a.account.id)], [200, true, true, LIMIT], 'the second try on a script already counted today is marked at the limit');
  c.eq((await issue(a.jar)).status, 201, 'practice questions are still issued at the limit');
  const reveal = await post(`/v1/practice/${qs[8]}/reveal`, {}, a.jar);
  c.ok(reveal.status === 200 && reveal.data?.solution, 'and an issued question can still be revealed');
  for (const mode of ['rush', 'match']) {
    const q = await issue(a.jar, { mode });
    const g = await grade(a.jar, q.data.question.id, WRONG);
    c.deq([g.status, await counted(a.account.id)], [200, LIMIT], `a ${mode} answer is still marked at the limit, and does not count`);
  }

  // ── another account's day is its own ────────────────────────────────────────
  const bq = await issue(b.jar);
  c.deq([(await grade(b.jar, bq.data.question.id, WRONG)).status, await counted(b.account.id)], [200, 1], 'another free account is marked as its own first script');

  // ── Premium is unlimited; a lapsed period is not ────────────────────────────
  let premiumMarked = 0;
  for (let i = 1; i <= LIMIT + 3; i++) {
    const q = await issue(p.jar);
    const g = await grade(p.jar, q.data.question.id, WRONG);
    if (g.status !== 200) { c.ok(false, `Premium script ${i}: ${g.status} ${JSON.stringify(g.data?.error)}`); break; }
    premiumMarked++;
  }
  c.eq(premiumMarked, LIMIT + 3, `Premium is marked ${LIMIT + 3} scripts in a day: unlimited, as the server's own record says`);
  c.eq(await counted(p.account.id), 0, 'and writes no free-plan counter');
  let lapsedMarked = 0;
  for (let i = 1; i <= LIMIT; i++) { const q = await issue(lapsed.jar); if ((await grade(lapsed.jar, q.data.question.id, WRONG)).status === 200) lapsedMarked++; }
  c.eq(lapsedMarked, LIMIT, 'a "premium" record whose period has ended is a free account: its 5 are marked');
  c.eq((await grade(lapsed.jar, (await issue(lapsed.jar)).data.question.id, WRONG)).data?.error?.code, 'FREE_CAP_REACHED', 'and its sixth is refused like one');
  c.eq(await counted(a.account.id), LIMIT, 'nothing any other account did changed the capped account\'s count');

  // ── the day turns over at midnight Asia/Kolkata ─────────────────────────────
  c.eq(await counterExpiry(a.account.id, today.key), today.end + DAY, 'the day\'s counter expires a day after the day ends (housekeeping purges it)');
  clockOffset = today.end - realNow() - 1000;      // 23:59:59 IST
  c.eq((await grade(a.jar, qs[9], WRONG)).data?.error?.code, 'FREE_CAP_REACHED', 'one second before midnight the account is still at its limit');
  clockOffset = today.end - realNow() + 1000;      // 00:00:01 IST
  const tomorrow = practiceDay(now());
  c.eq(tomorrow.start, today.end, 'the next day begins the instant this one ends');
  const fresh = await grade(a.jar, qs[9], WRONG);
  c.deq([fresh.status, await counted(a.account.id, tomorrow.key)], [200, 1], 'one second after midnight the account is marked its first script of the new day');
  c.eq(await counted(a.account.id, today.key), LIMIT, 'yesterday\'s count is kept as its own row');
  for (let i = 10; i < 10 + LIMIT - 1; i++) await grade(a.jar, qs[i], WRONG);
  const refusedTomorrow = await grade(a2, qs[20], WRONG);
  c.deq([refusedTomorrow.status, refusedTomorrow.data?.error?.resetAt], [402, tomorrow.end], 'and the new day has its own five and its own midnight');

  // The Postgres runner only counts a suite that says which engine it ran on.
  console.log(`engine: ${h.engine}`);
  console.log(`DAILY MARKING ALLOWANCE: PASS — ${c.count()}/${c.count()} checks — practice is unlimited; the free day's 5 marked scripts are the account's, decided by the server before marking, idempotent, device-blind, and turn over at midnight Asia/Kolkata.`);
} catch (error) {
  console.error(error);
  console.log('DAILY MARKING ALLOWANCE: FAIL');
  process.exitCode = 1;
} finally {
  Date.now = realNow;
  await h.close();
}
