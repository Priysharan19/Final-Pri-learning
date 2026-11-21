// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · generate, constrain, fall back
//
//   engine's FINAL verdicts (tick / cross with a state) ──▶ model picks { template, slots } per line (feature on,
//                                                           key present, question resolved, ceiling ok)
//                 ──▶ structured.js renders the sentence from the reviewed catalogue, or NOTHING: the page keeps the
//                     engine's own sentence. The model never writes a sentence.
//
// The marks and the states are INPUTS. Nothing returned from here is ever read
// back into a mark, a tick or a verdict.
// ─────────────────────────────────────────────────────────────────────────────
import { buildLineStates } from './states.js';
import { renderEntry } from './structured.js';
import { lineCommentsEnabled, lineCommentsConfig, buildCommentsRequest, callCommentsModel } from './provider.js';

export { buildLineStates, renderEntry, lineCommentsEnabled, lineCommentsConfig };
export const COMMENTS_VERSION = 1;

/** The parts of an issued question the comment layer is allowed to see (server side only). */
export function questionView(q, { marks = null } = {}) {
  return { prompt: String(q?.prompt ?? ''), marks };
}

const REPAIR = { '\t': '\\t', '\b': '\\b', '\f': '\\f', '\r': '\\r', '\n': '\\n' };
// A model that writes a LaTeX command inside JSON with one backslash turns \\times into a tab: those control characters are
// always accidents here, so the command is restored before the slot is checked.
const repairSlots = e => (e && typeof e === 'object' && e.slots && typeof e.slots === 'object' && !Array.isArray(e.slots)
  ? { ...e, slots: Object.fromEntries(Object.entries(e.slots).map(([k, v]) => [k, typeof v === 'string' ? repairEscapes(v) : v])) } : e);
export const repairEscapes = text => text.replace(/[\t\b\f\r\n]/g, ch => REPAIR[ch]);

const emptyStats = () => ({
  asked: false, calls: 0, model: null, fellBack: false, status: 'not-asked', latencyMs: 0, usage: null,
  modelLines: 0, accepted: 0, rejected: 0, missing: 0,
  violationCodes: {}
});

/**
 * @param {object} input
 *   stepReport, readStates   the engine's findings (see states.js)
 *   question   questionView(q)           (the released solution is not sent: see provider.js)
 *   edition    'NSW' | 'India'           language   'en' | 'hi'
 *   resolved   false: no model, templates only (nothing is revealed before the question resolves)
 *   authorize  async () => null | refusal   the spend ceiling, consulted before every paid call
 */
export async function generateLineComments({
  stepReport, readStates = null, question, edition = 'NSW', language = 'en',
  resolved = true, env = process.env, fetchImpl = globalThis.fetch, authorize = async () => null, signal = null,
  useModel = true, now = Date.now(), score = null
}) {
  const stats = emptyStats();
  const { lines, allTexts } = buildLineStates({ stepReport, readStates });
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
  const request = buildCommentsRequest({ model: config.model, reasoningEffort: config.reasoningEffort, question, lines, allTexts, edition, language });
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

  // The model's reply is STRUCTURED: [{ line, template, slots }]. Each line is rendered from the reviewed catalogue
  // (structured.js) or not at all; a line with two entries, a bad entry or no entry keeps the engine's sentence.
  const entriesByLine = new Map();
  for (const c of reply.comments) {
    const n = c && typeof c === 'object' ? c.line : null;
    entriesByLine.set(n, entriesByLine.has(n) ? 'duplicate' : c);
  }
  const out = [];
  for (const line of lines) {
    stats.modelLines += 1;
    const entry = entriesByLine.get(line.n);
    if (entry === undefined) { stats.missing += 1; continue; }
    const rendered = entry === 'duplicate' ? { ok: false, code: 'duplicate-line' } : renderEntry(repairSlots(entry), { line, allTexts }, language);
    if (typeof score === 'function') score({ line, entry, rendered });
    if (!rendered.ok) { stats.rejected += 1; stats.violationCodes[rendered.code] = (stats.violationCodes[rendered.code] || 0) + 1; continue; }
    stats.accepted += 1;
    out.push({ index: line.index, n: line.n, state: line.state, lineText: line.text, text: rendered.text, kind: rendered.kind, template: rendered.template, source: 'ai', model: stats.model, at });
  }
  return result(out);
}
