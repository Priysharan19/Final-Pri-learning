// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the per-account daily AI budget and the cost ledger
// (ledger 1.8 and 1.9)
//
//   1. PRI_AI_DAILY_BUDGET_CALLS bounds one account's day ACROSS every paid
//      kind: handwriting, working, question photo and the tutor share it. The
//      refusal is 429 AI_DAILY_BUDGET_EXHAUSTED with Retry-After, an honest
//      sentence (the engine and the on-device reader carry on) and
//      fallback: 'engine-only'; the per-kind unit is given back; another
//      account is untouched; a refused paid-ceiling call refunds the budget.
//   2. Every call that reached the provider is recorded per account, day and
//      kind with the provider's token counts — on success and on a failure
//      the provider answered; never for NOT_CONFIGURED.
//   3. /v1/metrics carries ai_calls_total{kind}, ai_tokens_total{kind,
//      direction} and the budget gauges; AI_MONTHLY_BUDGET_70PCT fires at 70%
//      of PRI_MONTHLY_BUDGET_INR; GET /v1/admin/ai-usage is admin + second
//      factor only and sums the month, the day, the kinds and the accounts.
//   4. Configuration mistakes are boot-time problems.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_METRICS_TOKEN', 'PRI_HANDWRITING_API_KEY',
  'PRI_AI_DAILY_BUDGET_CALLS', 'PRI_MONTHLY_BUDGET_INR', 'PRI_AI_INR_PER_MILLION_INPUT_TOKENS', 'PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS', 'PRI_FEATURE_TUTOR'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-ai-budget-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '66'.repeat(32);
for (const name of names.slice(3)) delete process.env[name];

const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');
const { createPlatformDb } = await import('../platform/db.js');
const { createHandwritingRouter } = await import('../platform/handwriting.js');
const { createWorkingRouter } = await import('../platform/working.js');
const { createQuestionPhotoRouter } = await import('../platform/questionPhoto.js');
const { createTutorRouter } = await import('../platform/tutor.js');
const { WorkingProviderError } = await import('../platform/workingProvider.js');
const { HandwritingProviderError } = await import('../platform/handwritingProvider.js');
const { SESSION_COOKIE, sha256 } = await import('../platform/security.js');
const {
  AI_DAILY_BUDGET_CODE, AI_DAILY_BUDGET_DEFAULT, AI_DAILY_BUDGET_MESSAGE, aiAllowanceConfigProblems, aiDailyBudget,
  consumeAiAllowance, consumeAiDailyBudget, refundAiAllowance, refundAiDailyBudget
} = await import('../platform/aiAllowance.js');
const {
  aiUsageConfigProblems, aiUsageSummary, ensureAiUsageTable, estimateInr, monthlyAiSpend, normalizeUsage, recordAiUsage, refreshAiBudgetGauge, usageCollector, usageDay
} = await import('../platform/aiUsage.js');
const { metrics, createMetrics, setAiBudgetGauge } = await import('../platform/metrics.js');
const { startApp, registerAccount, checks, promoteRole } = await import('./support/app-harness.mjs');

const c = checks();
metrics.reset();

// ── Configuration ────────────────────────────────────────────────────────────
c.eq(aiDailyBudget({}), AI_DAILY_BUDGET_DEFAULT, `the budget defaults to ${AI_DAILY_BUDGET_DEFAULT} calls a day`);
c.eq(aiDailyBudget({ PRI_AI_DAILY_BUDGET_CALLS: '25' }), 25, 'and is deployment-tunable');
for (const bad of ['0', '-1', '1.5', 'many', '100001']) {
  c.ok(aiAllowanceConfigProblems({ PRI_AI_DAILY_BUDGET_CALLS: bad }).some(p => p.startsWith('PRI_AI_DAILY_BUDGET_CALLS')), `${JSON.stringify(bad)} is a boot-time problem, not a silent default`);
}
c.deq(aiUsageConfigProblems({}), [], 'no budget, no rates: nothing to check');
c.deq(aiUsageConfigProblems({ PRI_MONTHLY_BUDGET_INR: '5000', PRI_AI_INR_PER_MILLION_INPUT_TOKENS: '12.5', PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS: '100' }), [], 'a budget with both rates is complete');
c.ok(aiUsageConfigProblems({ PRI_MONTHLY_BUDGET_INR: '5000' }).some(p => p.includes('required with PRI_MONTHLY_BUDGET_INR')), 'a budget without rates cannot be measured and is refused');
c.ok(aiUsageConfigProblems({ PRI_MONTHLY_BUDGET_INR: '0' }).some(p => p.startsWith('PRI_MONTHLY_BUDGET_INR')), 'a zero budget is a mistake');
c.ok(aiUsageConfigProblems({ PRI_AI_INR_PER_MILLION_INPUT_TOKENS: '-3' }).some(p => p.startsWith('PRI_AI_INR_PER_MILLION_INPUT_TOKENS')), 'a negative rate is a mistake');
c.deq(normalizeUsage({ input_tokens: 120, output_tokens: 30 }), { inputTokens: 120, outputTokens: 30 }, 'the Responses API usage shape is read');
c.deq(normalizeUsage({ prompt_tokens: 7, completion_tokens: 'x' }), { inputTokens: 7, outputTokens: 0 }, 'the chat shape too; a non-integer is zero');
c.deq(normalizeUsage(null), { inputTokens: 0, outputTokens: 0 }, 'no usage is zero tokens, never a throw');
const rates = { PRI_AI_INR_PER_MILLION_INPUT_TOKENS: '1000000', PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS: '2000000' };
c.eq(estimateInr({ inputTokens: 300, outputTokens: 60 }, { estimable: true, inrPerMillionInput: 1_000_000, inrPerMillionOutput: 2_000_000 }), 420, 'tokens × rates is the estimate');
c.eq(estimateInr({ inputTokens: 300, outputTokens: 60 }, { estimable: false }), null, 'without rates there is no estimate, not a zero');
c.eq(usageDay(Date.UTC(2026, 9, 5, 23, 59, 59)), '2026-10-05', 'the day is the UTC calendar day');

// ── 1 and 2 · The routes, mounted directly with fake providers ───────────────
const db = createPlatformDb(':memory:');
const now = Date.now();
for (const [id, email] of [['acct-a', 'a@example.test'], ['acct-b', 'b@example.test']]) {
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)').run(id, email, id, 'student', now, now, now);
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(`ses-${id}`, id, sha256(`raw-${id}`), 'ipad', null, now, now, now + 86400000);
}
const env = { PRI_HANDWRITING_API_KEY: 'k-test', PRI_PAID_CALLS_PER_HOUR: '1000', PRI_PAID_CALLS_PER_DAY: '1000', PRI_AI_DAILY_BUDGET_CALLS: '3', PRI_FEATURE_TUTOR: '1', PRI_MONTHLY_BUDGET_INR: '500', ...rates };
const providerCalls = { handwriting: 0, working: 0, 'question-photo': 0, tutor: 0 };
let workingFails = false;
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/handwriting', createHandwritingRouter(db, {
  env,
  transcribe: async (image, { onUsage }) => {
    providerCalls.handwriting += 1;
    onUsage({ input_tokens: 100, output_tokens: 20 });
    return { engine: 'cloud-test', lines: [{ text: 'x = 4', confidence: 0.95 }], text: 'x = 4', confidence: 0.95, needsConfirmation: false, escalated: false };
  }
}));
app.use('/working', createWorkingRouter(db, {
  env,
  check: async (prompt, lines, { onUsage }) => {
    providerCalls.working += 1;
    onUsage({ input_tokens: 100, output_tokens: 20 });
    if (workingFails) throw new WorkingProviderError('The step check was not valid JSON.', { code: 'WORKING_MALFORMED', status: 502, retryable: true });
    return { engine: 'cloud-working-test', lines: lines.map((_, i) => ({ index: i, status: 'ok', carried: false, why: '' })), firstBreak: -1, hint: '', confidence: 0.9, needsConfirmation: false };
  }
}));
app.use('/question-photo', createQuestionPhotoRouter(db, {
  env,
  identify: async (image, { onUsage }) => {
    providerCalls['question-photo'] += 1;
    onUsage({ input_tokens: 100, output_tokens: 20 });
    return { isMathsQuestion: true, readable: true, questionText: 'Solve 2x = 8', candidates: [] };
  }
}));
app.use('/tutor', createTutorRouter(db, {
  env,
  ask: async (request, { onUsage }) => {
    providerCalls.tutor += 1;
    onUsage({ input_tokens: 100, output_tokens: 20 });
    return { message: 'What could you do to both sides?', referencesStepIndex: 0, revealsAnswer: false, model: 'test-model' };
  }
}));
const unconfigured = express();
unconfigured.use(express.json({ limit: '2mb' }));
unconfigured.use(cookieParser());
unconfigured.use('/handwriting', createHandwritingRouter(db, {
  env: { ...env, PRI_HANDWRITING_API_KEY: '' },
  transcribe: async () => { throw new HandwritingProviderError('not configured', { code: 'HANDWRITING_NOT_CONFIGURED', status: 503 }); }
}));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const server2 = await new Promise(resolve => { const s = unconfigured.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const base2 = `http://127.0.0.1:${server2.address().port}`;
const PNG = 'data:image/png;base64,' + Buffer.from('a'.repeat(600)).toString('base64');
const TUTOR = {
  context: 'practice', level: 'nudge', locale: 'en', questionId: 'q-linear-1', questionVersion: '3',
  question: { prompt: 'Solve $2x + 3 = 11$.', steps: [{ h: 'Subtract 3', d: '$2x = 8$.' }, { h: 'Divide by 2', d: '$x = 4$.' }], answer: '4', hints: ['Try both sides.', 'Then divide.'] },
  studentWork: { lines: ['2x + 3 = 11'], typedAnswer: '' }
};
const call = async (who, path, body, origin = base) => {
  const res = await fetch(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-${who}` }, body: JSON.stringify(body) });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
};
const bucketCount = async bucket => Number((await db.prepare('SELECT count FROM rate_limits WHERE bucket = ?').get(bucket))?.count || 0);
const perKind = (who, kind) => `ai-daily:${kind}:${sha256(who).slice(0, 24)}`;
const budget = who => `ai-daily-budget:${sha256(who).slice(0, 24)}`;

try {
  const first = await call('acct-a', '/handwriting/transcribe', { image: PNG });
  const second = await call('acct-a', '/working/check', { prompt: 'q', lines: ['2x = 8', 'x = 4'] });
  const third = await call('acct-a', '/question-photo/identify', { image: PNG });
  c.deq([first.status, second.status, third.status], [200, 200, 200], 'three calls across three kinds fit a budget of three');
  c.eq(await bucketCount(budget('acct-a')), 3, 'and the combined bucket counts three');

  const fourth = await call('acct-a', '/handwriting/transcribe', { image: PNG });
  c.eq(fourth.status, 429, 'the fourth is refused');
  c.eq(fourth.json?.error?.code, AI_DAILY_BUDGET_CODE, `as ${AI_DAILY_BUDGET_CODE}`);
  c.eq(fourth.json?.error?.message, AI_DAILY_BUDGET_MESSAGE, 'with the honest sentence');
  c.match(fourth.json?.error?.message, /built-in engine/, 'which says the engine still marks');
  c.eq(fourth.json?.error?.fallback, 'engine-only', 'and names the fallback the client should take');
  c.eq(fourth.json?.error?.limit, 3, 'and the limit');
  c.ok(Number(fourth.headers.get('retry-after')) > 0, 'with Retry-After');
  c.eq(fourth.headers.get('ratelimit-remaining'), '0', 'and RateLimit-Remaining: 0');
  c.eq(providerCalls.handwriting, 1, 'the provider was not called for the refused request');
  c.eq(await bucketCount(perKind('acct-a', 'handwriting')), 1, 'the per-kind unit the refused request took was given back');

  const tutorRefused = await call('acct-a', '/tutor/help', TUTOR);
  c.eq([tutorRefused.status, tutorRefused.json?.error?.code].join(' '), `429 ${AI_DAILY_BUDGET_CODE}`, 'the tutor shares the same budget: refused too');
  c.eq(providerCalls.tutor, 0, 'and its model was not asked');
  const photoRefused = await call('acct-a', '/question-photo/identify', { image: PNG });
  c.eq(photoRefused.json?.error?.code, AI_DAILY_BUDGET_CODE, 'and so is the photo reader');

  const other = await call('acct-b', '/tutor/help', TUTOR);
  c.eq(other.status, 200, 'another account is untouched (per account, not per deployment)');
  c.eq(providerCalls.tutor, 1, 'and its tutor call reached the model');
  c.eq(await bucketCount(budget('acct-b')), 1, 'spending one of its own three');

  // Recorded usage: acct-a 3 calls (one each kind), acct-b 1 tutor call, 100/20 tokens each.
  const day = usageDay();
  const rows = db.prepare('SELECT account_id, kind, calls, input_tokens, output_tokens FROM ai_usage_daily WHERE day = ? ORDER BY account_id, kind').all(day);
  c.deq(rows, [
    { account_id: 'acct-a', kind: 'handwriting', calls: 1, input_tokens: 100, output_tokens: 20 },
    { account_id: 'acct-a', kind: 'question-photo', calls: 1, input_tokens: 100, output_tokens: 20 },
    { account_id: 'acct-a', kind: 'working', calls: 1, input_tokens: 100, output_tokens: 20 },
    { account_id: 'acct-b', kind: 'tutor', calls: 1, input_tokens: 100, output_tokens: 20 }
  ], 'every call that reached a provider is in the ledger, per account, day and kind, with its tokens; refused calls are not');

  workingFails = true;
  const failed = await call('acct-b', '/working/check', { prompt: 'q', lines: ['2x = 8', 'x = 4'] });
  workingFails = false;
  c.eq(failed.status, 502, 'a provider failure after the call is still a failure for the student');
  const failedRow = db.prepare("SELECT calls, input_tokens FROM ai_usage_daily WHERE account_id='acct-b' AND kind='working' AND day=?").get(day);
  c.deq(failedRow, { calls: 1, input_tokens: 100 }, 'but the call was paid for, so it is recorded');

  const notConfigured = await call('acct-b', '/handwriting/transcribe', { image: PNG }, base2);
  c.eq(notConfigured.status, 503, 'an unconfigured provider answers 503');
  c.eq(db.prepare("SELECT COUNT(*) AS n FROM ai_usage_daily WHERE account_id='acct-b' AND kind='handwriting'").get().n, 0, 'and nothing is recorded: nothing was spent');
  c.eq(await bucketCount(budget('acct-b')), 2, 'and the budget unit was given back (tutor + failed working = 2)');

  // Refund on a refused paid ceiling, directly.
  const scoped = { ...env, PRI_AI_DAILY_BUDGET_CALLS: '5' };
  const verdict = await consumeAiAllowance(db, { accountId: 'acct-b', kind: 'working', env: scoped });
  c.eq(verdict.allowed, true, 'a unit is taken');
  c.eq(await bucketCount(budget('acct-b')), 3, 'from the combined bucket');
  await refundAiAllowance(db, verdict);
  c.eq(await bucketCount(budget('acct-b')), 2, 'refundAiAllowance gives the combined unit back too');
  c.eq(await bucketCount(perKind('acct-b', 'working')), 1, 'and the per-kind one');
  const direct = await consumeAiDailyBudget(db, { accountId: 'acct-b', env: scoped });
  await refundAiDailyBudget(db, direct);
  c.eq(await bucketCount(budget('acct-b')), 2, 'the tutor\'s direct budget path refunds the same way');

  // ── 3 · Metrics, gauges, the alert and the admin summary ─────────────────
  c.eq(metrics.sum('ai_calls_total'), 5, 'ai_calls_total counts five recorded calls');
  c.eq(metrics.sum('ai_calls_total', { where: { kind: 'tutor' } }), 1, 'by kind');
  c.eq(metrics.sum('ai_tokens_total', { where: { direction: 'input' } }), 500, 'ai_tokens_total{direction=input}');
  c.eq(metrics.sum('ai_tokens_total', { where: { direction: 'output' } }), 100, 'ai_tokens_total{direction=output}');
  const spend = await monthlyAiSpend(db, { env });
  c.deq([spend.calls, spend.inputTokens, spend.outputTokens, spend.estimatedInr, spend.budgetInr], [5, 500, 100, 700, 500], 'the month: 5 calls, 500/100 tokens, ₹700 estimated against a ₹500 budget');
  c.eq(spend.alerting, true, 'which is past 70%');
  const snap = metrics.snapshot();
  c.eq(snap.gauges.ai_budget_month_ratio, 1.4, 'the gauge carries the ratio');
  c.eq(snap.gauges.ai_month_estimated_inr, 700, 'and the estimate');
  c.ok(snap.firing.includes('AI_MONTHLY_BUDGET_70PCT'), 'AI_MONTHLY_BUDGET_70PCT fires');
  setAiBudgetGauge({ ratio: 0.69 });
  c.ok(!metrics.snapshot().firing.includes('AI_MONTHLY_BUDGET_70PCT'), 'and does not at 69%');
  setAiBudgetGauge({ ratio: 0.7 });
  c.ok(metrics.snapshot().firing.includes('AI_MONTHLY_BUDGET_70PCT'), 'and does at exactly 70%');
  const noBudget = await refreshAiBudgetGauge(db, { env: { ...env, PRI_MONTHLY_BUDGET_INR: '' } });
  c.eq(noBudget.ratio, null, 'without a budget there is no ratio');
  c.eq(metrics.snapshot().gauges.ai_budget_month_ratio, 0.7, 'and the last gauge value stands rather than lying with a zero');

  const summary = await aiUsageSummary(db, { env });
  c.deq([summary.month.calls, summary.month.inputTokens, summary.month.estimatedInr, summary.month.ratio, summary.month.alerting], [5, 500, 700, 1.4, true], 'the admin summary agrees with the month');
  c.deq(summary.month.byKind.map(k => `${k.kind}:${k.calls}`), ['handwriting:1', 'question-photo:1', 'tutor:1', 'working:2'], 'by kind');
  c.deq(summary.topAccounts.map(a => `${a.accountId}:${a.calls}`), ['acct-a:3', 'acct-b:2'], 'and the heaviest accounts');
  c.deq([summary.today.calls, summary.today.estimatedInr], [5, 700], 'today');
  c.eq(summary.rates.inrPerMillionInputTokens, 1_000_000, 'with the rates it used');

  // Account deletion keeps the spend as anonymous rows.
  db.prepare("DELETE FROM accounts WHERE id='acct-b'").run();
  const orphaned = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(calls),0) AS calls FROM ai_usage_daily WHERE account_id IS NULL").get();
  c.deq([orphaned.n, orphaned.calls], [2, 2], 'a deleted account\'s rows stay as anonymous spend (the bill did not shrink)');

  // Recording never throws into a request.
  const collector = usageCollector();
  collector({ input_tokens: 1 }); collector({ output_tokens: 2 });
  c.deq(collector.total(), { calls: 2, inputTokens: 1, outputTokens: 2 }, 'a collector sums primary and fallback usage');
  const broken = { run: async () => { throw Object.assign(new Error('disk full'), { code: 'SQLITE_FULL' }); }, get: async () => null, all: async () => [], dialect: 'sqlite', transaction: fn => fn() };
  c.eq(await recordAiUsage(broken, { accountId: 'acct-a', kind: 'working' }), false, 'a ledger that cannot be written answers false and never throws');
  c.ok(typeof ensureAiUsageTable === 'function', 'the SQLite table is created lazily, like every router-owned table');
} finally {
  server.close();
  server2.close();
}

// ── Admin route through the real /v1 router ──────────────────────────────────
const h = await startApp({ engine: 'sqlite' });
try {
  const anon = await h.request('/v1/admin/ai-usage');
  c.eq(anon.status, 401, 'no session: 401');
  const student = await registerAccount(h, { email: 'student.budget@example.test' });
  const forbidden = await h.request('/v1/admin/ai-usage', { jar: student.jar });
  c.eq(forbidden.status, 403, 'a student: 403');
  const admin = await registerAccount(h, { email: 'admin.budget@example.test' });
  await promoteRole(h, admin.jar, admin.account.id, 'admin');
  const okRes = await h.request('/v1/admin/ai-usage', { jar: admin.jar });
  c.eq(okRes.status, 200, 'an admin with a verified second factor: 200');
  c.deq(Object.keys(okRes.data.aiUsage).sort(), ['day', 'month', 'note', 'rates', 'today', 'topAccounts'], 'with the summary shape');
  c.eq(okRes.data.aiUsage.month.calls, 0, 'an empty ledger on this fresh store');
  const metricsRes = await h.request('/v1/metrics');
  c.eq(metricsRes.status, 200, 'loopback metrics outside production');
  c.ok('gauges' in metricsRes.data && 'ai_budget_month_ratio' in metricsRes.data.gauges, '/v1/metrics exposes the budget gauge');
  c.ok(Object.keys(metricsRes.data.counters).some(key => key.startsWith('ai_calls_total{kind=')), 'and the per-kind call counters');
  c.ok(metricsRes.data.alerts.some(a => a.id === 'AI_MONTHLY_BUDGET_70PCT' && a.thresholds.ratio === 0.7), 'and the 70% rule with its threshold');
} finally {
  await h.close();
  metrics.reset();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) { if (prior[name] === undefined) delete process.env[name]; else process.env[name] = prior[name]; }
}

console.log(`AI BUDGET AND COST: PASS — ${c.count()}/${c.count()} checks — one daily budget per account across handwriting, working, photo and tutor with an honest engine-only refusal; every paid call in the per-account per-day ledger with tokens; /v1/metrics series, the 70% monthly alert and the admin summary.`);
