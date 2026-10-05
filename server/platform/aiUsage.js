// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · cost telemetry for the paid model routes (ledger 1.9)
//
// Every call the server makes to the model provider on a student's behalf —
// handwriting reading, working check, question photo, tutor — is recorded
// here after it returns: one row per account, UTC day and kind, holding the
// number of calls and the provider's own input/output token counts (the
// `usage` object of the Responses API; zero when the provider did not say).
//
// What it is for:
//   · GET /v1/metrics        ai_calls_total{kind}, ai_tokens_total{kind,direction}
//                            and the gauges ai_month_estimated_inr,
//                            ai_budget_month_inr, ai_budget_month_ratio.
//   · GET /v1/admin/ai-usage this month and today, by kind and the heaviest
//                            accounts (admin + second factor only).
//   · AI_MONTHLY_BUDGET_70PCT in docs/operations/alerts.md: the month's
//                            estimated spend has reached 70% of
//                            PRI_MONTHLY_BUDGET_INR.
//
// Spend is an ESTIMATE: tokens × the INR rates the operator configures from
// the provider's price list (PRI_AI_INR_PER_MILLION_INPUT_TOKENS and
// PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS). The provider's invoice is the truth;
// this is the early warning. Nothing here is shown to a student, and nothing
// here can refuse a request — refusals are aiAllowance.js (per account) and
// spendCeiling.js (per deployment). Recording never fails a request either:
// a write that fails is logged as `ai_usage_record_failed` and the student's
// answer goes out regardless.
// ─────────────────────────────────────────────────────────────────────────────
import { logEvent } from './observability.js';
import { recordAiUsageMetrics, setAiBudgetGauge } from './metrics.js';
import { id } from './security.js';
import { asStore, sqliteHandle } from './store.js';

export const AI_USAGE_KINDS = Object.freeze(['handwriting', 'working', 'question-photo', 'tutor']);
export const BUDGET_ALERT_RATIO = 0.7;
export const GAUGE_REFRESH_MS = 5 * 60 * 1000;
const MAX_TOKENS_PER_CALL = 10_000_000;

export function ensureAiUsageTable(db) {
  // SQLite builds its schema at boot; Postgres is migrated
  // (supabase/migrations/20261008000000_ai_usage_daily.sql).
  const raw = sqliteHandle(db);
  if (!raw) return;
  raw.exec(`CREATE TABLE IF NOT EXISTS ai_usage_daily (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    UNIQUE(account_id, day, kind)
  );
  CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_day ON ai_usage_daily(day);`);
}

/** The UTC calendar day a timestamp falls in, as YYYY-MM-DD. */
export function usageDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function nonNegative(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { set: false, value: null };
  const n = Number(text);
  return { set: true, value: Number.isFinite(n) && n >= 0 && n <= 1e9 ? n : null };
}

/** The budget and rates for this deployment, or nulls where unset. */
export function aiUsageConfig(env = process.env) {
  const budget = nonNegative(env.PRI_MONTHLY_BUDGET_INR);
  const input = nonNegative(env.PRI_AI_INR_PER_MILLION_INPUT_TOKENS);
  const output = nonNegative(env.PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS);
  return Object.freeze({
    budgetInr: budget.value && budget.value > 0 ? budget.value : null,
    inrPerMillionInput: input.value,
    inrPerMillionOutput: output.value,
    estimable: input.value !== null && output.value !== null
  });
}

/** Configuration mistakes production must not boot with (config.js). */
export function aiUsageConfigProblems(env = process.env) {
  const problems = [];
  const budget = nonNegative(env.PRI_MONTHLY_BUDGET_INR);
  const input = nonNegative(env.PRI_AI_INR_PER_MILLION_INPUT_TOKENS);
  const output = nonNegative(env.PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS);
  if (budget.set && (budget.value === null || budget.value <= 0)) problems.push('PRI_MONTHLY_BUDGET_INR (a positive number of rupees)');
  if (input.set && input.value === null) problems.push('PRI_AI_INR_PER_MILLION_INPUT_TOKENS (a non-negative number)');
  if (output.set && output.value === null) problems.push('PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS (a non-negative number)');
  // A budget nobody can measure against is not a budget.
  if (budget.set && budget.value > 0 && (!input.set || !output.set)) {
    problems.push('PRI_AI_INR_PER_MILLION_INPUT_TOKENS and PRI_AI_INR_PER_MILLION_OUTPUT_TOKENS (required with PRI_MONTHLY_BUDGET_INR)');
  }
  return problems;
}

/** Estimated rupees for a token total, or null when the rates are not configured. */
export function estimateInr({ inputTokens = 0, outputTokens = 0 } = {}, config = aiUsageConfig()) {
  if (!config.estimable) return null;
  const inr = (inputTokens / 1_000_000) * config.inrPerMillionInput + (outputTokens / 1_000_000) * config.inrPerMillionOutput;
  return Math.round(inr * 100) / 100;
}

/** The provider's usage object, reduced to two bounded integers. */
export function normalizeUsage(usage) {
  const n = value => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= MAX_TOKENS_PER_CALL ? number : 0;
  };
  return {
    inputTokens: n(usage?.input_tokens ?? usage?.inputTokens ?? usage?.prompt_tokens),
    outputTokens: n(usage?.output_tokens ?? usage?.outputTokens ?? usage?.completion_tokens)
  };
}

/** Sum several usage objects (a primary call plus its fallback). */
export function sumUsage(list = []) {
  const total = { calls: 0, inputTokens: 0, outputTokens: 0 };
  for (const usage of list) {
    const { inputTokens, outputTokens } = normalizeUsage(usage);
    total.calls += 1;
    total.inputTokens += inputTokens;
    total.outputTokens += outputTokens;
  }
  return total;
}

/** A collector the routes hand to a provider as `onUsage`; `total()` is what to record. */
export function usageCollector() {
  const seen = [];
  const collect = usage => { seen.push(usage || {}); };
  collect.total = () => sumUsage(seen);
  collect.calls = () => seen.length;
  return collect;
}

/**
 * Record one or more completed calls. Never throws: the student's answer has
 * already been produced, and a ledger that cannot be written is an operator
 * problem (logged, counted), not the student's.
 */
export async function recordAiUsage(db, { accountId, kind, calls = 1, inputTokens = 0, outputTokens = 0, env = process.env, now = Date.now() }) {
  if (!AI_USAGE_KINDS.includes(kind) || !accountId || !(calls > 0)) return false;
  const store = asStore(db);
  const day = usageDay(now);
  const { inputTokens: inTokens, outputTokens: outTokens } = normalizeUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
  recordAiUsageMetrics(kind, { calls, inputTokens: inTokens, outputTokens: outTokens });
  try {
    await store.run(`INSERT INTO ai_usage_daily(id, account_id, day, kind, calls, input_tokens, output_tokens, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, day, kind) DO UPDATE SET
        calls = ai_usage_daily.calls + excluded.calls,
        input_tokens = ai_usage_daily.input_tokens + excluded.input_tokens,
        output_tokens = ai_usage_daily.output_tokens + excluded.output_tokens,
        updated_at = excluded.updated_at`,
    [id('aiu'), String(accountId), day, kind, Math.floor(calls), inTokens, outTokens, now]);
    await refreshAiBudgetGauge(store, { env, now });
    return true;
  } catch (error) {
    logEvent('warn', 'ai_usage_record_failed', { aiKind: kind, code: error?.code || 'AI_USAGE_WRITE_FAILED' });
    return false;
  }
}

// One fixed statement, bound parameters only: a single day is the range
// [day, day] inclusive, a month is [YYYY-MM-01, YYYY-MM-31].
async function totals(store, fromDay, toDay) {
  const row = await store.get(`SELECT COALESCE(SUM(calls),0) AS calls, COALESCE(SUM(input_tokens),0) AS input_tokens,
    COALESCE(SUM(output_tokens),0) AS output_tokens FROM ai_usage_daily WHERE day >= ? AND day <= ?`, [fromDay, toDay]);
  return { calls: Number(row?.calls || 0), inputTokens: Number(row?.input_tokens || 0), outputTokens: Number(row?.output_tokens || 0) };
}

/** This calendar month's totals, estimate and share of the budget. */
export async function monthlyAiSpend(db, { env = process.env, now = Date.now() } = {}) {
  const store = asStore(db);
  const config = aiUsageConfig(env);
  const month = usageDay(now).slice(0, 7);
  const sums = await totals(store, `${month}-01`, `${month}-31`);
  const estimatedInr = estimateInr(sums, config);
  const ratio = estimatedInr !== null && config.budgetInr ? Math.round((estimatedInr / config.budgetInr) * 10_000) / 10_000 : null;
  return {
    month, ...sums, estimatedInr, budgetInr: config.budgetInr, ratio,
    alertRatio: BUDGET_ALERT_RATIO, alerting: ratio !== null && ratio >= BUDGET_ALERT_RATIO
  };
}

/** Re-read the month and publish it to the gauges; errors are swallowed (the previous value stands). */
export async function refreshAiBudgetGauge(db, { env = process.env, now = Date.now() } = {}) {
  try {
    const spend = await monthlyAiSpend(db, { env, now });
    setAiBudgetGauge({ ratio: spend.ratio, estimatedInr: spend.estimatedInr, budgetInr: spend.budgetInr });
    return spend;
  } catch {
    return null;
  }
}

/** Keep the gauge fresh between calls (index.js); returns a stop function. */
export function startAiBudgetGaugeRefresh(db, { env = process.env, intervalMs = GAUGE_REFRESH_MS } = {}) {
  refreshAiBudgetGauge(db, { env });
  const timer = setInterval(() => refreshAiBudgetGauge(db, { env }), intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}

/** The operator's view (admin.js GET /v1/admin/ai-usage). */
export async function aiUsageSummary(db, { env = process.env, now = Date.now(), top = 20 } = {}) {
  const store = asStore(db);
  const config = aiUsageConfig(env);
  const day = usageDay(now);
  const month = await monthlyAiSpend(store, { env, now });
  const today = await totals(store, day, day);
  const byKindRows = await store.all(`SELECT kind, COALESCE(SUM(calls),0) AS calls, COALESCE(SUM(input_tokens),0) AS input_tokens,
    COALESCE(SUM(output_tokens),0) AS output_tokens FROM ai_usage_daily WHERE day >= ? AND day <= ? GROUP BY kind ORDER BY kind`,
  [`${month.month}-01`, `${month.month}-31`]);
  const topRows = await store.all(`SELECT account_id, COALESCE(SUM(calls),0) AS calls, COALESCE(SUM(input_tokens),0) AS input_tokens,
    COALESCE(SUM(output_tokens),0) AS output_tokens FROM ai_usage_daily WHERE day >= ? AND day <= ? AND account_id IS NOT NULL
    GROUP BY account_id ORDER BY calls DESC, account_id ASC LIMIT ?`, [`${month.month}-01`, `${month.month}-31`, Math.max(1, Math.min(100, Math.floor(top)))]);
  const shape = row => ({ calls: Number(row.calls || 0), inputTokens: Number(row.input_tokens || 0), outputTokens: Number(row.output_tokens || 0) });
  return {
    day,
    month: { ...month, estimatedInr: month.estimatedInr, byKind: byKindRows.map(row => ({ kind: row.kind, ...shape(row), estimatedInr: estimateInr(shape(row), config) })) },
    today: { ...today, estimatedInr: estimateInr(today, config) },
    topAccounts: topRows.map(row => ({ accountId: row.account_id, ...shape(row), estimatedInr: estimateInr(shape(row), config) })),
    rates: { inrPerMillionInputTokens: config.inrPerMillionInput, inrPerMillionOutputTokens: config.inrPerMillionOutput },
    // The ledger is spend as the provider reported it per call; the invoice is the truth.
    note: 'estimate from recorded tokens and configured INR rates; reconcile against the provider invoice'
  };
}
