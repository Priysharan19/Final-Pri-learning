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
