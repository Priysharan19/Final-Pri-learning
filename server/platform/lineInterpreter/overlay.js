// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter overlay · runs AFTER the engine's step check
//
// The engine's step check (stepCheck) has priority on every line it judged. The
// interpreter (RULES ONLY here) is asked only about the lines the engine left
// without a verdict, and it can only add a verified tick, "from the question",
// a rule-read first break or "couldn't verify"; it never overturns an engine
// verdict and never sets a mark. The model arm is not reachable from this path:
// `useModel` is false and no fetch or authorisation is passed in.
//
// Dark unless PRI_FEATURE_LINE_INTERPRETER=1 (lineInterpreterEnabled).
// ─────────────────────────────────────────────────────────────────────────────
import { interpretWorking, lineInterpreterEnabled } from './index.js';

const ENGINE_DECIDED = new Set(['ok', 'break', 'wrong', 'ecf', 'also']);
const nonBlankLines = working => String(working ?? '').split('\n').map(l => l.trim()).filter(Boolean);

/** Did the engine give this report line a verdict of its own? */
export const engineDecided = line => !!line && (ENGINE_DECIDED.has(line.status) || line.state === 'incomplete');

/**
 * Per-line interpretation for a question's working, or null when the feature is
 * off or there is nothing to say. The result is aligned with the working's
 * non-blank lines; `engine: true` marks a line the engine already judged, whose
 * own verdict stands (the interpreter's reading of it is dropped).
 */
export async function interpretAfterStepCheck({ question, working, stepReport, env = process.env }) {
  if (!lineInterpreterEnabled(env)) return null;
  const lines = nonBlankLines(working);
  if (!lines.length) return null;
  const engineLines = Array.isArray(stepReport?.lines) ? stepReport.lines : [];
  let out;
  try {
    out = await interpretWorking({
      question, lines, env, useModel: false,
      engineVerdicts: lines.map((_, i) => engineDecided(engineLines[i]))
    });
  } catch { return null; }
  if (!out) return null;
  return {
    version: out.version,
    lines: out.lines.map((r, i) => (engineDecided(engineLines[i])
      ? { index: i, engine: true }
      : { index: i, engine: false, verdict: r.verdict, why: typeof r.why === 'string' ? r.why.slice(0, 200) : null, ticked: r.ticked === true }))
  };
}

// ── What the student's marked page shows ─────────────────────────────────────
// Owner, 19 November 2026: step-by-step marking on every Year 11 and 12 question.
// The interpretation is folded into the step report the marked page already
// draws, so no new surface is needed. The engine's own verdict on a line always
// stands. Only a report that judges each line on its own (no report at all, the
// arithmetic check, a value chain, a vector chain) is extended; a report in
// which a line is judged as following from the line before it is left alone.
// Nothing here is a mark: the caller's `partial` and marks are computed before
// this and never read the result.
const WHY_FALLBACK = 'This line is not true for the question.';
const NOTE_FALLBACK = 'Pri could not check this line against the question.';

export function reportWithInterpretation({ stepReport, lineInterpretation, working }) {
  if (!lineInterpretation || !Array.isArray(lineInterpretation.lines)) return stepReport || null;
  if (stepReport && stepReport.source !== 'value-chain') return stepReport;
  const texts = nonBlankLines(working);
  if (!texts.length || lineInterpretation.lines.length !== texts.length) return stepReport || null;
  const base = Array.isArray(stepReport?.lines) ? stepReport.lines : [];
  if (stepReport && base.length !== texts.length) return stepReport;
  let firstBreak = base.findIndex(l => l?.status === 'break');
  let diagnosis = firstBreak >= 0 ? (stepReport.diagnosis || null) : null;
  let added = 0;
  const lines = texts.map((text, i) => {
    const own = base[i];
    if (engineDecided(own)) return own;
    const r = lineInterpretation.lines[i];
    const note = () => own || { text, status: 'note', unverified: true, state: 'unverified', note: typeof r?.why === 'string' && r.why ? r.why : NOTE_FALLBACK };
    if (!r || r.engine) return note();
    // After the first wrong line nothing more is ticked or crossed: it may only follow from the slip.
    if (firstBreak >= 0 && i > firstBreak) return own || { text, status: 'note', unverified: true, state: 'unverified', note: 'Follows from the earlier slip.' };
    if (r.verdict === 'valid') { added++; return { text, status: 'ok', state: 'verified', valueChain: { rule: 'interpreter' } }; }
    if (r.verdict === 'given') { added++; return { text, status: 'ok', state: 'given', restates: true, note: 'From the question.', valueChain: { rule: 'interpreter-given' } }; }
    if (r.verdict === 'first-break') {
      added++;
      const message = typeof r.why === 'string' && r.why ? r.why : WHY_FALLBACK;
      firstBreak = i;
      diagnosis = { code: 'line-not-true', title: 'This line is not true for the question', message, fix: 'Check this line against the question.', confidence: 'high' };
      return { text, status: 'break', state: 'wrong', note: message, diagnosis };
    }
    return note();
  });
  if (!added) return stepReport || null;
  // A line the engine or the arithmetic check ticked AFTER what is now the first wrong line stays as it was judged.
  const at = st => lines.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  return {
    lines, firstBreak, diagnosis, source: 'value-chain', interpreted: true,
    summary: {
      total: lines.length, checked: lines.filter(l => l.status === 'ok').length,
      given: at('given'), verified: at('verified'), arithmetic: at('arithmetic'), conditions: at('condition'), wrong: at('wrong'), unverified, unread,
      reason: unverified.length ? 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.' : null
    }
  };
}
