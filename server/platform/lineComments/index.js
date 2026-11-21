// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · generate, constrain, fall back
//
//   engine's FINAL verdicts (tick / cross with a state) ──▶ model comment per line (feature on, key present,
//                                                           question resolved, ceiling ok)
//                 ──▶ constraints a–g ──▶ accepted (AI) or NOTHING: the page keeps the engine's own sentence
//
// The marks and the states are INPUTS. Nothing returned from here is ever read
// back into a mark, a tick or a verdict.
// ─────────────────────────────────────────────────────────────────────────────
import { buildLineStates } from './states.js';
import { violationsOf, RULES } from './constraints.js';
import { lineCommentsEnabled, lineCommentsConfig, buildCommentsRequest, callCommentsModel } from './provider.js';

export { buildLineStates, violationsOf, lineCommentsEnabled, lineCommentsConfig };
export const COMMENTS_VERSION = 1;

/** The parts of an issued question the comment layer is allowed to see (server side only). */
export function questionView(q, { marks = null } = {}) {
  const a = q?.answer || {};
  const numeric = q?.answerType === 'numeric' && Number.isFinite(Number(a.value)) ? Number(a.value) : null;
  const fn = q?.stepcheck?.fn;
  const fns = fn && fn.name && fn.variable && fn.expr ? { [String(fn.name)]: { variable: String(fn.variable), expr: String(fn.expr) } } : null;
  const sc = q?.stepcheck;
  const solutions = sc?.kind === 'equation' && sc.variable && Array.isArray(sc.solutions) && sc.solutions.every(v => Number.isFinite(Number(v)))
    ? { variable: String(sc.variable), values: sc.solutions.map(Number) } : null;
  return { prompt: String(q?.prompt ?? ''), marks, answerKey: { numeric }, fns, solutions };
}

const REPAIR = { '\t': '\\t', '\b': '\\b', '\f': '\\f', '\r': '\\r', '\n': '\\n' };
export const repairEscapes = text => text.replace(/[\t\b\f\r\n]/g, ch => REPAIR[ch]);

const emptyStats = () => ({
  asked: false, calls: 0, model: null, fellBack: false, status: 'not-asked', latencyMs: 0, usage: null,
  modelLines: 0, accepted: 0, rejected: 0, missing: 0,
  violatedBefore: Object.fromEntries(RULES.map(r => [r, 0])), violationCodes: {}
});

/**
 * @param {object} input
 *   stepReport, readStates   the engine's findings (see states.js)
 *   question   questionView(q)           solution   the released solution ({ steps, answerText })
 *   edition    'NSW' | 'India'           language   'en' | 'hi'
 *   resolved   false: no model, templates only (nothing is revealed before the question resolves)
 *   authorize  async () => null | refusal   the spend ceiling, consulted before every paid call
 */
export async function generateLineComments({
  stepReport, readStates = null, question, solution, edition = 'NSW', language = 'en',
  resolved = true, env = process.env, fetchImpl = globalThis.fetch, authorize = async () => null, signal = null,
  useModel = true, now = Date.now(), score = null
}) {
  const stats = emptyStats();
  const { lines } = buildLineStates({ stepReport, readStates });
  const studentLines = lines.map(l => l.text);
  const at = new Date(now).toISOString();
  const result = comments => ({ version: COMMENTS_VERSION, comments, stats, edition, language, generatedAt: at });
  if (!lines.length) { stats.status = 'no-final-verdicts'; return result([]); }

  // No model unless: the server flag is on, the provider is configured, the question is resolved (the released
  // solution is then the student's to see) and the caller allows it. Otherwise the page keeps the engine's sentences.
  const config = lineCommentsConfig(env);
  if (!useModel || !lineCommentsEnabled(env) || !config.usable || !resolved) {
    stats.status = !lineCommentsEnabled(env) ? 'flag-off' : !config.usable ? 'not-configured' : !resolved ? 'unresolved' : 'not-asked';
    return result([]);
  }

  stats.asked = true;
  const request = buildCommentsRequest({ model: config.model, reasoningEffort: config.reasoningEffort, question, solution, lines, edition, language });
  const started = Date.now();
  let reply = null;
  const hasFallback = config.fallbackModel && config.fallbackModel !== config.model;
  const attempts = [[0, config.model], ...(hasFallback ? [[1, config.fallbackModel]] : [])];
  for (const [attempt, model] of attempts) {
    const remaining = config.timeoutMs - (Date.now() - started);
    if (attempt === 1 && remaining < 1500) break;
    const refusal = await authorize();
    if (refusal) { stats.status = `refused:${refusal.code || 'ceiling'}`; break; }
    stats.calls += 1;
    try {
      reply = await callCommentsModel({
        model, config, request, fetchImpl, signal,
        timeoutMs: attempt === 0 && hasFallback ? Math.round(config.timeoutMs * 0.6) : Math.max(1500, remaining)
      });
      stats.model = model; stats.fellBack = attempt === 1; stats.status = 'ok';
      break;
    } catch (error) {
      stats.status = `error:${error.code || 'unknown'}`;
    }
  }
  stats.latencyMs = Date.now() - started;
  if (!reply) return result([]);
  stats.usage = reply.usage;

  const byIndex = new Map();
  for (const c of reply.comments) if (c && Number.isInteger(c.index) && !byIndex.has(c.index)) byIndex.set(c.index, c);
  const ctx = { question, solution, studentLines, resolved, language, edition, states: lines };
  const out = [];
  for (const line of lines) {
    stats.modelLines += 1;
    const candidate = byIndex.get(line.index);
    if (!candidate) { stats.missing += 1; continue; }
    // A model that writes a LaTeX command inside JSON with one backslash turns \\times into a tab and \\theta into a tab:
    // those control characters are always accidents here, so the command is restored before anything is checked.
    const comment = { text: repairEscapes(String(candidate.text ?? '')).trim(), kind: candidate.kind };
    const violations = violationsOf(comment, { ...ctx, line });
    if (typeof score === 'function') score({ line, comment, violations });
    if (violations.length) {
      stats.rejected += 1;
      for (const v of new Set(violations.map(x => x.rule))) stats.violatedBefore[v] += 1;
      for (const v of violations) stats.violationCodes[v.code] = (stats.violationCodes[v.code] || 0) + 1;
      continue;   // never shown: the page keeps the engine's own sentence for this line
    }
    stats.accepted += 1;
    out.push({ index: line.index, n: line.n, state: line.state, lineText: line.text, text: comment.text, kind: comment.kind, source: 'ai', model: stats.model, at });
  }
  return result(out);
}
