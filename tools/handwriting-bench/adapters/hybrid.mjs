// ─────────────────────────────────────────────────────────────────────────────
// Architecture C · two independent readers, then Pri decides
//
// Mathpix reads the ink. A multimodal model reads the ink. Pri compares them.
// Agreement raises confidence; disagreement destroys auto-mark certainty and
// sends the page to confirmation instead of marking the student wrong.
//
// The arbitration is NOT written here. It is Pri's production consensus
// function, `chooseNativeConsensus` (client/src/ink/nativeConsensus.js), which
// already implements exactly this rule for the local engines:
//
//     "No two independent readers agree. We may still display the best
//      evidence, but we deliberately destroy auto-mark certainty."
//
// Reusing it means Architecture C is measured through the code Pri would
// actually ship if this study chose it — including its per-line consensus
// fallback, which matters because one reader can be right on line 1 and wrong
// on line 4 while the other does the opposite. A hand-rolled comparator here
// would measure the comparator.
//
// So the worked example in the brief — Mathpix `ln(x^2-1)+C` against a vision
// model's `ln(x^2+1)+C` — is not special-cased. It falls out of the existing
// disagreement branch, and `escalated` below is how often that branch fires.
// ─────────────────────────────────────────────────────────────────────────────
import { chooseNativeConsensus } from '../../../client/src/ink/nativeConsensus.js';
import { reading } from '../contract.mjs';

export const kind = 'recognition';
export const inputs = ['composite'];

/** Benchmark reading → the candidate shape the production arbiter consumes. */
function toCandidate(result) {
  if (!result || result.error || !result.lines.length) return null;
  const confidences = result.lines.map(l => l.confidence).filter(Number.isFinite);
  return {
    engine: result.engine,
    text: result.text,
    lines: result.lines.map(l => ({ text: l.text, conf: l.confidence, box: l.box })),
    minConf: confidences.length ? Math.min(...confidences) : result.confidence,
    // The arbiter uses `margin` as the gap to the runner-up reading. Neither a
    // cloud recogniser nor Mathpix returns one, so it is left undefined rather
    // than invented — the arbiter already treats a missing margin as unknown.
    margin: undefined
  };
}

/**
 * `parts` is the map of already-run readings, keyed by adapter id. Both legs
 * are run once per sample by the runner and shared here, so the hybrid costs
 * exactly what its two legs cost and nothing is called twice.
 */
export function make(leftId, rightId) {
  const id = `hybrid:${leftId}+${rightId}`;
  return {
    id, kind, inputs,
    envKeys: [],
    legs: [leftId, rightId],
    run(_sample, { parts = {} } = {}) {
      const started = performance.now();
      const left = parts[leftId];
      const right = parts[rightId];
      const costUsd = [left?.costUsd, right?.costUsd].every(c => c === null || c === undefined)
        ? null
        : (Number(left?.costUsd) || 0) + (Number(right?.costUsd) || 0);
      // Both legs run in parallel in production, so the hybrid's latency is the
      // slower leg, not the sum. Reporting the sum would make the architecture
      // look worse than it would actually feel.
      const latencyMs = Math.max(Number(left?.latencyMs) || 0, Number(right?.latencyMs) || 0) + (performance.now() - started);

      const candidates = [toCandidate(left), toCandidate(right)].filter(Boolean);
      if (!candidates.length) {
        return reading({ engine: id, latencyMs, costUsd, error: 'both-legs-failed' });
      }
      if (candidates.length === 1) {
        // One leg down is not agreement. A single surviving reader cannot
        // corroborate itself, so it is offered for confirmation, never applied.
        const only = candidates[0];
        return reading({
          engine: id,
          lines: only.lines.map(l => ({ text: l.text, confidence: l.conf, box: l.box })),
          confidence: Math.min(only.minConf ?? 0, 0.54),
          needsConfirmation: true,
          latencyMs, costUsd,
          raw: { agreement: 'single-leg', survivingLeg: only.engine, escalated: true }
        });
      }

      const chosen = chooseNativeConsensus(candidates);
      if (!chosen) return reading({ engine: id, latencyMs, costUsd, error: 'no-consensus-reading' });

      const escalated = chosen.disagreement === true;
      return reading({
        engine: id,
        lines: (chosen.lines || []).map(l => ({ text: l.text, confidence: l.conf ?? 0, box: l.box })),
        confidence: Number.isFinite(chosen.minConf) ? chosen.minConf : 0,
        // The whole point of the architecture: a disagreement is never marked.
        needsConfirmation: escalated || !Number.isFinite(chosen.minConf) || chosen.minConf < 0.55,
        latencyMs, costUsd,
        residue: [...new Set([...(left?.residue || []), ...(right?.residue || [])])],
        raw: {
          agreement: escalated ? 'disagreement' : 'consensus',
          escalated,
          arbiterEngine: chosen.engine,
          left: left?.text ?? null,
          right: right?.text ?? null
        }
      });
    }
  };
}
