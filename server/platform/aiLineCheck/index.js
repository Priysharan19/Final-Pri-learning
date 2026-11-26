// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AI line check · the layer that speaks on lines the engine left open
//
// OWNER DIRECTIVE, 27 November 2026: every line verified, detailed annotated marking, on every question.
// Built inside the project's hard rules:
//
//   · A model output NEVER sets or changes a mark. This layer runs AFTER every mark and the scheme pay were
//     computed, on the displayed report only; its result is feedback. (Pinned by a test over every page.)
//   · The engine's verdicts win. A line the engine ticked or crossed is never touched. The model is asked only
//     about the lines the engine left open, and only for display.
//   · ENGINE VETO (veto.js): before an AI opinion is shown, the engine runs every check it can on the line. If it
//     can REFUTE an AI "correct", the tick is dropped. If it can PROVE the line, the line becomes an ordinary
//     engine tick with the engine's own reason. A model's restated claim (schema.js, claims.js guard) is proved by
//     the existing verifier (lineInterpreter/verifier.js); nothing from the model's free text is trusted for that.
//   · An AI "correct" that survives is labelled "AI-checked", never engine-verified. An AI "incorrect" is
//     advisory ("AI-doubt"), never a cross, never a mark, and never shown when the engine can show the line true.
//   · Comments pass the sanitiser (sanitise.js) or are replaced by a fixed generic sentence.
//   · Stable: the result is cached per (question id, normalised page, layer version); a re-opened page never changes.
//   · Any failure or refusal returns null: the page is exactly what it is today.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { providerConfig, providerStaticStatus } from '../handwritingProvider.js';
import { serverEdition } from '../edition.js';
import { recordProviderCall, recordProviderUsage } from '../metrics.js';
import { publicDescription } from '../lineInterpreter/givens.js';
import { ruleInterpretation } from '../lineInterpreter/rules.js';
import { verifyLines } from '../lineInterpreter/verifier.js';
import { parseResponse, MAX_LINES } from './schema.js';
import { buildRequest, LAYER_VERSION } from './request.js';
import { commentFor } from './sanitise.js';
import { engineCheckLine, endValueOf, correctionHolds } from './veto.js';

export { LAYER_VERSION };
const DEFAULT_TIMEOUT_MS = 25_000;
const EFFORTS = ['none', 'minimal', 'low', 'medium'];
const CACHE_MAX = 400;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** The kill switch. Off by default everywhere; on only where the variable is 1 AND the deployment is the Australian edition. */
export function aiLineCheckEnabled(env = process.env) {
  if (String(env?.PRI_FEATURE_AI_LINE_CHECK || '').trim() !== '1') return false;
  try { return serverEdition(env) === 'prithagoras'; } catch { return false; }   // an unknown edition is not the Australian one
}

export function aiLineCheckConfig(env = process.env) {
  const base = providerConfig(env);
  const status = providerStaticStatus(env);
  const timeout = Number(env.PRI_AI_LINE_CHECK_TIMEOUT_MS);
  return Object.freeze({
    usable: status.configured && status.configValid,
    apiKey: base.apiKey,
    endpoint: base.endpoint,
    model: String(env.PRI_AI_LINE_CHECK_MODEL || base.primaryModel).trim() || base.primaryModel,
    // Checking arithmetic is not transcription: the reader's own setting (often "none") is not inherited. Low unless the deployment says otherwise.
    reasoningEffort: EFFORTS.includes(String(env.PRI_AI_LINE_CHECK_REASONING_EFFORT || '').trim()) ? String(env.PRI_AI_LINE_CHECK_REASONING_EFFORT).trim() : 'low',
    timeoutMs: Number.isFinite(timeout) && timeout >= 3_000 && timeout <= 60_000 ? timeout : DEFAULT_TIMEOUT_MS
  });
}

export const nonBlankLines = working => String(working ?? '').split('\n').map(l => l.trim()).filter(Boolean);
const ENGINE_DECIDED = new Set(['ok', 'break', 'wrong', 'ecf', 'also']);
const decided = l => !!l && (ENGINE_DECIDED.has(l.status) || l.state === 'incomplete');

/** What the engine said of each line so far, in the words the model is given. */
export function engineVerdicts(report, count) {
  const lines = Array.isArray(report?.lines) && report.lines.length === count ? report.lines : [];
  const firstBreak = lines.findIndex(l => l?.status === 'break');
  return Array.from({ length: count }, (_, i) => {
    const l = lines[i];
    if (!l) return 'open';
    if (l.status === 'break') return 'crossed';
    if (l.status === 'ok') return 'ticked';
    if (firstBreak >= 0 && i > firstBreak) return 'follows-from-earlier-error';
    return 'open';
  });
}

const HAS_CONTENT = /[A-Za-z0-9]/;
const BARE_TOKEN = /^\s*[-−]?\s*[A-Za-z0-9.]{1,3}\s*$/;
/** The indices the layer may ask about: lines the engine left open, before any engine cross, with something to check. */
export function openIndices(report, lines) {
  const reportLines = Array.isArray(report?.lines) && report.lines.length === lines.length ? report.lines : [];
  const firstBreak = reportLines.findIndex(l => l?.status === 'break');
  const out = [];
  lines.forEach((text, i) => {
    if (i >= MAX_LINES) return;
    const l = reportLines[i];
    if (decided(l)) return;
    if (firstBreak >= 0 && i > firstBreak) return;
    if (l && (l.context === true || l.state === 'unread' || l.state === 'condition')) return;
    if (!HAS_CONTENT.test(text) || BARE_TOKEN.test(text)) return;
    out.push(i);
  });
  return out;
}

// ── the cache ────────────────────────────────────────────────────────────────
const cache = new Map();
export const normalisePage = lines => lines.map(l => String(l).replace(/\s+/g, ' ').trim()).join('\n');
// The key is (question id, the question's own text, the normalised page, the layer version): the same lines under another question never share a result.
export const cacheKey = (questionId, lines, prompt = '') => createHash('sha256').update(`${LAYER_VERSION}\n${String(questionId ?? '')}\n${createHash('sha256').update(String(prompt)).digest('hex')}\n${normalisePage(lines)}`).digest('hex');
export function clearCache() { cache.clear(); }
const remember = (key, value, now) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, at: now });
};
const recall = (key, now) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.value;
};

// ── the provider call ────────────────────────────────────────────────────────
let temperatureSupported = true;
export function resetTemperatureSupport() { temperatureSupported = true; }

async function callProvider({ config, body, fetchImpl, signal }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort, { once: true });
  const started = Date.now();
  const send = payload => fetchImpl(config.endpoint, {
    method: 'POST', signal: controller.signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(payload)
  });
  try {
    let response = await send(body);
    let calls = 1;
    // A reasoning model may refuse `temperature`; say so once and ask again without it (remembered for this process).
    if (!response.ok && response.status === 400 && 'temperature' in body) {
      let detail = ''; try { detail = await response.text(); } catch { detail = ''; }
      if (/temperature/i.test(detail)) {
        temperatureSupported = false;
        const { temperature: _t, ...rest } = body;
        response = await send(rest); calls = 2;
      } else return { ok: false, status: `http-400`, latencyMs: Date.now() - started, calls };
    }
    if (!response.ok) return { ok: false, status: `http-${response.status}`, latencyMs: Date.now() - started, calls };
    const payload = await response.json();
    const text = payload?.output_text ?? payload?.output?.flatMap(item => item?.content || []).find(part => typeof part?.text === 'string')?.text ?? null;
    if (!text) return { ok: false, status: 'empty', latencyMs: Date.now() - started, calls };
    return { ok: true, text, usage: payload?.usage || null, latencyMs: Date.now() - started, calls, model: payload?.model || null };
  } catch (error) {
    return { ok: false, status: error?.name === 'AbortError' ? 'timeout' : 'unreachable', latencyMs: Date.now() - started, calls: 1 };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

const BASIS = Object.freeze({
  'restates-the-question': ['Given in the question', 'This line restates what the question gives.'],
  'condition-called-for': ['Condition stated', 'A condition the question calls for is stated.'],
  'same-solutions': ['Same solutions', 'This equation has the same solutions as the line above.'],
  continuation: ['Equal to the line above', 'This line is equal to the line above.'],
  identity: ['True identity', 'Both sides are equal at every value tried.'],
  'solution-set': ['Correct solutions', 'These values are exactly the solutions of the equation.'],
  root: ['Correct solution', 'This value satisfies the equation.'],
  'root-by-arithmetic': ['Correct solution', 'This value satisfies the equation.'],
  'final-value-equals-answer': ['Correct answer', 'This is the answer the question asks for.'],
  'asked-quantity-equals-answer': ['Correct answer', 'This is the answer the question asks for.'],
  derivative: ['Correct derivative', 'This derivative agrees with the real derivative of the function.'],
  arithmetic: ['Correct arithmetic', 'The arithmetic on this line is correct.']
});

/** Verdicts the existing verifier gives each line when it reads the model's claim as a rule reading would. Probe only: nothing here crosses a line. */
function verifierProbe(question, lines, parsed, answer) {
  try {
    const description = publicDescription(question);
    const items = lines.map((text, i) => {
      const claim = parsed.get(i)?.claim;
      return claim && claim.kind !== 'unparseable' && claim.kind !== 'prose' ? { claim, source: 'rule', text } : { ...ruleInterpretation(text, description), text };
    });
    return verifyLines(items, description, { answer });
  } catch { return []; }
}

const numeric = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Turn what the model said into what may be shown: engine ticks, AI-checked lines, AI-doubt lines. Pure given its inputs (the model's parsed
 * items included): the same inputs always give the same lines.
 */
export function decide({ question, lines, report, parsed, open, reference, answer }) {
  const prompt = String(question?.prompt ?? '');
  const probe = verifierProbe(question, lines, parsed, answer?.key ?? null);
  const submitted = numeric(answer?.submitted);
  const out = [];
  for (const i of open) {
    const p = parsed.get(i);
    if (!p || p.verdict === 'cannot_tell') continue;
    const above = lines.slice(0, i);
    const veto = engineCheckLine(lines[i], { above, prompt });
    const v = probe[i];
    const keyRefutes = answer?.correct === false && submitted !== null && (() => { const e = endValueOf(lines[i]); return e !== null && Math.abs(e - submitted) <= 1e-9 * Math.max(1, Math.abs(e)); })();
    const refuted = !!veto.refuted || v?.verdict === 'first-break' || keyRefutes;
    let proved = null;
    if (veto.proved) proved = { short: veto.proved.short, sentence: veto.proved.sentence, rule: `ai-veto-${veto.proved.kind}` };
    else if (v && (v.verdict === 'valid' || v.verdict === 'given') && !keyRefutes) {
      const [short, sentence] = BASIS[v.basis] || ['Verified by the engine', 'The engine verified what this line claims.'];
      proved = { short, sentence, rule: `ai-claim-${String(v.basis || 'verified').replace(/[^a-z-]/g, '').slice(0, 40)}` };
    }
    if (proved && refuted) continue;          // the engine contradicts itself: say nothing
    if (proved) { out.push({ index: i, kind: 'engine-proved', ...proved }); continue; }
    const ctx = { line: lines[i], above: lines[i - 1] ?? '', prompt, solution: reference, lineCount: lines.length };
    if (p.verdict === 'correct') {
      if (refuted) continue;                  // the engine refutes the model's "correct": the line stays as the engine sees it
      const c = commentFor('correct', p.comment, ctx);
      out.push({ index: i, kind: 'ai-checked', comment: c.text, generic: c.generic });
    } else if (p.verdict === 'incorrect') {
      const c = commentFor('incorrect', p.comment, ctx);
      const corrected = p.correctedRhs ? correctionHolds(lines[i], p.correctedRhs, { above, prompt }) : null;
      out.push({ index: i, kind: 'ai-doubt', comment: c.text, generic: c.generic, ...(corrected ? { corrected } : {}), ...(p.wrongSpan ? { span: p.wrongSpan } : {}) });
    }
  }
  return out;
}

const tally = items => ({
  engineProved: items.filter(x => x.kind === 'engine-proved').length,
  aiChecked: items.filter(x => x.kind === 'ai-checked').length,
  aiDoubt: items.filter(x => x.kind === 'ai-doubt').length
});

/**
 * Run the layer for one submitted page.
 * @param {object} p
 *   question   the issued question (server side); only its prompt is sent
 *   questionId the issued question's id (the cache key); without one nothing is cached
 *   working    the working text as marked
 *   report     the DISPLAYED report so far (engine verdicts), or null
 *   reference  the worked solution and answer as one text (for checking only)
 *   answer     { key: {kind:'numeric', value}|null, correct: boolean, submitted: number|null }
 *   reserve    async () => { ok, release? }  the spend gate (budget.js)
 * @returns {Promise<null | { version, lines, counts, status, ... }>}  null: show exactly what is shown today
 */
export async function runAiLineCheck({ question, questionId = null, working, report, reference = '', answer = null, env = process.env, fetchImpl = globalThis.fetch, reserve = null, now = Date.now(), signal = null, stats = null }) {
  if (!aiLineCheckEnabled(env)) return null;
  const lines = nonBlankLines(working);
  if (!lines.length || lines.length > MAX_LINES) return null;
  const open = openIndices(report, lines);
  if (!open.length) return null;
  // No question id, no cache: a page is never matched to a result by its text alone.
  const key = questionId ? cacheKey(questionId, lines, question?.prompt ?? '') : null;
  const hit = key ? recall(key, now) : null;
  if (hit) return hit;
  const config = aiLineCheckConfig(env);
  if (!config.usable) return null;
  let reservation = null;
  if (reserve) {
    try { reservation = await reserve(); } catch { return null; }
    if (!reservation?.ok) return null;
  }
  const body = buildRequest({
    prompt: publicDescription(question).prompt ?? String(question?.prompt ?? ''), lines,
    engine: engineVerdicts(report, lines.length), check: open, reference,
    model: config.model, reasoningEffort: config.reasoningEffort, temperature: temperatureSupported ? 0 : null
  });
  const result = await callProvider({ config, body, fetchImpl, signal });
  recordProviderCall('ai-line-check', { ok: result.ok, code: result.ok ? null : String(result.status).toUpperCase().replace(/[^A-Z0-9_]/g, '_'), ms: result.latencyMs });
  if (result.ok) recordProviderUsage('ai-line-check', { calls: result.calls, model: config.model, inputTokens: result.usage?.input_tokens ?? null, outputTokens: result.usage?.output_tokens ?? null, reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens ?? null });
  if (stats) { stats.calls = (stats.calls || 0) + result.calls; stats.usage = result.usage || null; stats.latencyMs = result.latencyMs; stats.status = result.ok ? 'ok' : result.status; }
  if (!result.ok) {
    // A call that never reached the provider (nothing was sent) gives its units back; any other failure may have been billed.
    if (result.status === 'unreachable' && reservation?.release) { try { await reservation.release(); } catch { /* the unit stays spent */ } }
    return null;
  }
  const parsed = parseResponse(result.text, { asked: open, lines });
  const items = decide({ question, lines, report, parsed, open, reference, answer });
  const value = { version: LAYER_VERSION, lines: items, counts: tally(items), asked: open.length };
  if (key) remember(key, value, now);
  return value;
}

// ── what the page receives ───────────────────────────────────────────────────
const NOTE_FALLBACK = 'Pri could not check this line against the question.';

/**
 * Fold the layer's result into the displayed report. Engine-proved lines become ordinary ticks (as the engine's own proofs do); AI lines
 * stay `note` lines (so any older reader still sees "not checked") and carry `ai` for the page. A line the layer did not speak on is
 * returned as it was. Marks never read this: it is called on the reply after every mark was computed.
 */
export function applyAiLineCheck({ report, result, working }) {
  if (!result || !Array.isArray(result.lines) || !result.lines.length) return report || null;
  const texts = nonBlankLines(working);
  const base = Array.isArray(report?.lines) ? report.lines : null;
  if (base && base.length !== texts.length) return report;
  const byIndex = new Map(result.lines.map(x => [x.index, x]));
  const lines = texts.map((text, i) => {
    const own = base ? base[i] : null;
    const x = byIndex.get(i);
    if (!x || decided(own)) return own || { text, status: 'note', unverified: true, state: 'unverified', note: NOTE_FALLBACK };
    if (x.kind === 'engine-proved') {
      return { ...(own || {}), text, status: 'ok', state: 'verified', unverified: undefined, note: x.sentence, valueChain: { rule: x.rule }, explain: { short: x.short, sentence: x.sentence }, fromAiLayer: true };
    }
    const ai = x.kind === 'ai-checked'
      ? { verdict: 'checked', comment: x.comment, generic: x.generic === true, v: 1 }
      : { verdict: 'doubt', comment: x.comment, generic: x.generic === true, ...(x.corrected ? { corrected: x.corrected } : {}), v: 1 };
    return { ...(own || { text, status: 'note', unverified: true, state: 'unverified', note: NOTE_FALLBACK }), ai };
  });
  const at = (pred) => lines.flatMap((l, k) => (pred(l) ? [k + 1] : []));
  const prior = report?.summary || {};
  const unverified = at(l => l.state === 'unverified' && !l.ai), unread = at(l => l.state === 'unread');
  return {
    ...(report || { source: 'value-chain', firstBreak: -1, diagnosis: null }),
    lines,
    aiLineCheck: { version: result.version, ...result.counts },
    summary: {
      ...prior,
      total: lines.length,
      checked: lines.filter(l => l.status === 'ok').length,
      verified: at(l => l.state === 'verified'), unverified, unread,
      aiChecked: at(l => l.ai?.verdict === 'checked'), aiDoubt: at(l => l.ai?.verdict === 'doubt'),
      reason: prior.reason ?? (unverified.length ? 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.' : null)
    }
  };
}
