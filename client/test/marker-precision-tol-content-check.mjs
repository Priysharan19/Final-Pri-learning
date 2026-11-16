// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · A precision the prompt states has a band the key authors
//
// Issue #518 (from the #515 review). A prompt that asks for an answer "to the
// nearest whole", "correct to 2 d.p." or "to 3 s.f." while its key carries no
// `tol` or `rounding` is marked against the default band: an honest rounding
// to a precision that band does not know (3 s.f. above all) is then refused.
// This check walks every generator at every difficulty and fails any numeric
// draw whose prompt states a precision but whose key authors no band, unless
// the generator is listed below with a reviewed reason the stated precision
// describes the GIVEN data and the keyed answer is exact.
//
// Usage: node client/test/marker-precision-tol-content-check.mjs [draws-per-cell=40]
// ─────────────────────────────────────────────────────────────────────────────
import { generateQuestion, loadAllBanks, GENERATORS } from '../src/engine/generators/index.js';
await loadAllBanks();

const DRAWS = Math.max(1, Number(process.argv[2]) || 40);
// The test's own reading of "this prompt states a precision", kept separate from
// the engine's namedDecimalPlaces so the two can disagree.
const STATES_PRECISION = /decimal places?|\d\s*d\.?p\.?\b|significant figures?|\d\s*s\.?f\.?\b|nearest (?:whole|tenth|hundredth|thousandth|integer)|correct to|round(?:ed|ing)? (?:off )?to/i;

// Reviewed: the precision in these prompts is that of the given data; the
// answer asked for is exact, so no band is authored and none should be.
const DATA_PRECISION = new Map([
  ['ms11-measure', 'states the measuring precision ("measured as 7.7 s, to the nearest tenth") and asks for the exact absolute error'],
  ['c7-rounding-bounds-reasoning', 'gives counts "rounded to the nearest thousand" and asks for an exact bound'],
]);

const failures = [];
let stated = 0, exempt = 0;
for (const id of Object.keys(GENERATORS).sort()) {
  for (let d = 1; d <= 4; d++) {
    for (let i = 0; i < DRAWS; i++) {
      const seed = (d * 100000 + i * 977 + id.length * 13) >>> 0;
      let q;
      try { q = generateQuestion(id, d, seed); } catch { continue; }
      if (q?.answerType !== 'numeric' || !q.answer) continue;
      const m = `${q.prompt ?? ''} ${q.answerSuffix ?? ''}`.match(STATES_PRECISION);
      if (!m) continue;
      stated++;
      if (q.answer.tol != null || q.answer.rounding) continue;
      if (DATA_PRECISION.has(id)) { exempt++; continue; }
      failures.push(`${id} D${d} seed ${seed} states "${m[0]}" but keys ${q.answer.value} with no tol or rounding — ${String(q.prompt).replace(/\s+/g, ' ').slice(0, 110)}`);
    }
  }
}
// The walk must actually meet stated precisions, or it proves nothing. Measured
// at 40 draws: 2,442 draws state a precision; the floor sits at three quarters.
const floor = Math.floor(1830 * Math.min(1, DRAWS / 40));
if (stated < floor) failures.push(`the walk met ${stated} draws that state a precision (floor ${floor})`);
if (exempt === 0 && DRAWS >= 40) failures.push('no draw from the reviewed data-precision generators was met: prune DATA_PRECISION');

const shown = failures.slice(0, 40);
console.log(failures.length
  ? `PRECISION BAND: FAIL — ${failures.length} problem(s)\n  · ${shown.join('\n  · ')}${failures.length > shown.length ? `\n  · … ${failures.length - shown.length} more` : ''}`
  : `PRECISION BAND: PASS — ${stated} draws state a precision; every one keys a tol or rounding, or is one of ${DATA_PRECISION.size} reviewed data-precision generators (${exempt} draws).`);
process.exit(failures.length ? 1 : 0);
