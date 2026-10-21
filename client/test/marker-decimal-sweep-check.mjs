// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Decimal sweep — every keyed fraction on every live generator
//
// Issue #527. The marker read any \frac in a prompt as a demand for a fraction
// answer, so "0.8" was refused for cos A = 4/5 whenever the given sin A was
// typeset as a fraction: 19 generators, 6,675 rejected draws in a 2,000-draw
// D1–D4 sweep. The form of an answer is asked for by words; it is never
// implied by the data the question gives.
//
// This sweep walks every generator at every difficulty and, for every numeric
// answer keyed with a `simplestFraction`, checks three things:
//
//   · ACCEPTED — the fraction itself, always; the exact terminating decimal
//     (0.8 for 4/5, 38.5 for 77/2, 0.084375 for 27/320) unless the prompt
//     asks for a fraction or the generator sets requireFraction; and, where
//     no fraction is asked, the full-precision decimal of a non-terminating
//     fraction (8.333333333333334 for 25/3 is the same double as the key).
//   · REJECTED — the exact decimal when the prompt does ask for a fraction;
//     a rounded decimal of a non-terminating fraction (0.33 and 0.3333 for
//     1/3) unless the prompt states decimal places; and the wrong value.
//   · HONEST — a generator that sets requireFraction says so in its prompt,
//     so the demand the marker enforces is the one the student was shown.
//
// The client and the server mark through one engine: server/engine/checker.js
// re-exports client/src/engine/checker.js. The sweep asserts that identity, so
// the online marker cannot drift from the instant one.
//
// Usage: node client/test/marker-decimal-sweep-check.mjs [draws-per-cell=150]
// It is also the second half of `npm run test:marker:equivalence`:
// marker-equivalence-classes-check.mjs imports it once its own authored
// classes pass, so `npm test` and CI sweep without a separate script entry.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer } from '../src/engine/checker.js';
import { checkAnswer as serverCheckAnswer } from '../../server/engine/checker.js';
import { generateQuestion, loadAllBanks, GENERATORS } from '../src/engine/generators/index.js';
await loadAllBanks();

const DEFAULT_DRAWS = 150;
const DRAWS = Math.max(1, Number(process.argv[2]) || DEFAULT_DRAWS);   // seeds per (generator, difficulty)
// The population floors below were measured at DEFAULT_DRAWS; a smaller run
// scales them down so a quick local pass is still a real pass.
const scaled = (n) => Math.floor(n * Math.min(1, DRAWS / DEFAULT_DRAWS));

// The test's own reading of "this prompt asks for a fraction", kept separate
// from the engine's so the two can disagree. Some prompts hyphenate
// "simplest-form"; "partial-fraction" names a method, not a form of answer.
const ASKS_FRACTION = /(?<!partial[- ])\bfractions?\b|simplest[- ]form|lowest[- ]terms|\bsimplif|in the form/i;
// A prompt that states a rounding is the one place a rounded decimal is the answer.
const STATES_ROUNDING = /decimal places?|\d\s*d\.?p\.?\b|significant figures?|\d\s*s\.?f\.?\b|nearest (?:whole|tenth|hundredth|thousandth|integer)|correct to|round(?:ed|ing)? (?:off )?to|approximate/i;

const failures = [];
let pass = 0;
function ok(cond, label) {
  if (cond) pass++; else failures.push(label);
}

// ── One engine for the client and the server ─────────────────────────────────
ok(serverCheckAnswer === checkAnswer, 'server/engine/checker.js re-exports the client checkAnswer (one marker online and offline)');

// ── Helpers ──────────────────────────────────────────────────────────────────
/** The exact decimal of n/d when it terminates (d = 2^a·5^b), or null when it does not. */
function exactDecimal(n, d) {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d <= 0) return null;
  let a = 0, b = 0, den = d;
  while (den % 2 === 0) { den /= 2; a++; }
  while (den % 5 === 0) { den /= 5; b++; }
  if (den !== 1) return null;
  const k = Math.max(a, b);
  const scale = 10n ** BigInt(k);
  const digits = (BigInt(Math.abs(n)) * (scale / BigInt(d))).toString().padStart(k + 1, '0');
  const whole = digits.slice(0, digits.length - k);
  const frac = k ? digits.slice(digits.length - k) : '';
  return (n < 0 ? '-' : '') + (frac ? `${whole}.${frac}` : whole);
}
const mark = (q, input) => {
  try { return checkAnswer(q, input); } catch (e) { return { correct: false, feedback: `threw: ${e?.message || e}` }; }
};
const where = (id, d, seed, q) => `${id} D${d} seed ${seed} — ${String(q.prompt).replace(/\s+/g, ' ').slice(0, 110)}`;

// ── The sweep ────────────────────────────────────────────────────────────────
const perGenerator = new Map();    // id -> { keyed, decimalAccepted, demanded, nonTerminating }
const tally = { keyed: 0, decimalAccepted: 0, demanded: 0, nonTerminating: 0, rounded: 0, honest: 0, wrong: 0, generated: 0, threw: 0 };
const acceptedDecimalGenerators = new Set();
const demandedGenerators = new Set();

for (const id of Object.keys(GENERATORS).sort()) {
  const row = { keyed: 0, decimalAccepted: 0, demanded: 0, nonTerminating: 0 };
  for (let d = 1; d <= 4; d++) {
    for (let i = 0; i < DRAWS; i++) {
      const seed = (d * 100000 + i * 977 + id.length * 13) >>> 0;   // the selfcheck's own seeds
      let q;
      try { q = generateQuestion(id, d, seed); } catch { tally.threw++; continue; }
      tally.generated++;
      const a = q?.answer;
      if (q?.answerType !== 'numeric' || !a?.simplestFraction) continue;
      const { n, d: den } = a.simplestFraction;
      if (!Number.isInteger(n) || !Number.isInteger(den) || den === 1 || den <= 0) continue;
      row.keyed++; tally.keyed++;
      const prompt = String(q.prompt ?? '');
      const at = where(id, d, seed, q);
      const demanded = a.requireFraction === true || (a.requireFraction !== false && ASKS_FRACTION.test(prompt));

      // The fraction itself is always the answer.
      const fraction = `${n}/${den}`;
      ok(mark(q, fraction).correct === true, `ACCEPT the keyed fraction "${fraction}": ${at}`);

      // HONEST: a generator that demands the form said so to the student.
      if (a.requireFraction === true) {
        tally.honest++;
        ok(ASKS_FRACTION.test(prompt), `HONEST requireFraction: the prompt must ask for a fraction: ${at}`);
      }

      // The wrong value is wrong, as a fraction and (when it terminates) as a decimal.
      const wrongFraction = `${n + den}/${den}`;
      ok(mark(q, wrongFraction).correct === false, `REJECT the wrong fraction "${wrongFraction}" (value + 1): ${at}`);
      tally.wrong++;

      const dec = exactDecimal(n, den);
      if (dec !== null) {
        const wrongDec = exactDecimal(n + den, den);
        ok(mark(q, wrongDec).correct === false, `REJECT the wrong decimal "${wrongDec}" (value + 1): ${at}`);
        if (demanded) {
          row.demanded++; tally.demanded++; demandedGenerators.add(id);
          const v = mark(q, dec);
          ok(v.correct === false, `REJECT the exact decimal "${dec}" for ${fraction} when the prompt asks for a fraction: ${at}`);
        } else {
          row.decimalAccepted++; tally.decimalAccepted++; acceptedDecimalGenerators.add(id);
          const v = mark(q, dec);
          ok(v.correct === true, `ACCEPT the exact decimal "${dec}" for ${fraction} when no fraction is asked (${v.feedback || 'no feedback'}): ${at}`);
        }
        continue;
      }

      // Non-terminating: the full-precision decimal is the key's own double;
      // a rounded decimal is not the value, and nothing in the prompt said to round.
      row.nonTerminating++; tally.nonTerminating++;
      const value = n / den;
      if (!demanded) {
        const v = mark(q, String(value));
        ok(v.correct === true, `ACCEPT the full-precision decimal "${String(value)}" for ${fraction} when no fraction is asked (${v.feedback || 'no feedback'}): ${at}`);
      }
      if (!STATES_ROUNDING.test(prompt)) {
        const exactTol = Math.max(1e-9, Math.abs(value) * 1e-9);
        for (const places of [2, 4]) {
          const rounded = value.toFixed(places);
          // A rounding the engine's exact band cannot tell from the value
          // (a very large value to 2 places) is not a near miss to assert on.
          if (Math.abs(Number(rounded) - value) <= 2 * exactTol) continue;
          tally.rounded++;
          ok(mark(q, rounded).correct === false, `REJECT the rounded decimal "${rounded}" for ${fraction} (no decimal places were asked for): ${at}`);
        }
      }
    }
  }
  if (row.keyed) perGenerator.set(id, row);
}

// ── The sweep must have swept ────────────────────────────────────────────────
// Measured on 2026-10-18 at 150 draws per cell over 213 generators, with the
// generators as they stand on main (no generator sets requireFraction yet):
// 15,697 keyed fractions; 5,097 exact decimals accepted over 42 generators;
// 1,738 refused over 15 generators whose prompts already ask for the fraction
// ("in simplest form", "simplify", "as a fraction"); 17,685 rounded near
// misses; 0 requireFraction draws. The floors sit at three quarters of the
// measurement, rounded down to the hundred, so an ordinary generator edit
// cannot trip them while a change that silently empties one class — every
// decimal refused again, or every demand gone — cannot pass. When a generator
// is given explicit fraction wording, the demanded count rises and the floor
// is re-measured upward, never down.
const subtopics = Object.keys(GENERATORS).length;
ok(subtopics >= 200, `the generator registry loaded (${subtopics} subtopics)`);
ok(tally.generated >= subtopics * 4 * DRAWS * 0.95, `the sweep generated its questions (${tally.generated}; ${tally.threw} draws threw)`);
ok(tally.keyed >= scaled(11700), `the sweep met keyed fractions (${tally.keyed}; floor ${scaled(11700)})`);
ok(tally.decimalAccepted >= scaled(3800), `exact terminating decimals accepted where no fraction was asked (${tally.decimalAccepted}; floor ${scaled(3800)})`);
ok(acceptedDecimalGenerators.size >= Math.min(31, scaled(31) || 1), `generators whose exact decimal is accepted (${acceptedDecimalGenerators.size}; floor ${Math.min(31, scaled(31) || 1)})`);
ok(tally.demanded >= scaled(1300), `exact decimals still refused where the prompt asks for a fraction (${tally.demanded}; floor ${scaled(1300)})`);
ok(demandedGenerators.size >= Math.min(11, scaled(11) || 1), `generators that honestly demand the fraction (${demandedGenerators.size}; floor ${Math.min(11, scaled(11) || 1)})`);
ok(tally.rounded >= scaled(13000), `rounded decimals of non-terminating fractions refused (${tally.rounded}; floor ${scaled(13000)})`);
// `tally.honest` counts the draws whose generator sets `requireFraction: true`.
// The Class 8 rational-numbers fraction-arithmetic forms set it with explicit
// wording (#547): measured 1,494 draws and 2,148 demanded over 17 generators
// at DEFAULT_DRAWS. The floors sit at three quarters, rounded down to the
// hundred, so losing the wording or the flag cannot pass.
ok(tally.honest >= scaled(1100), `requireFraction draws whose prompt asks for the fraction (${tally.honest}; floor ${scaled(1100)})`);
ok(tally.demanded >= scaled(1600), `exact decimals refused where a fraction is demanded, after #547 (${tally.demanded}; floor ${scaled(1600)})`);
ok(demandedGenerators.size >= Math.min(12, scaled(12) || 1), `generators that demand the fraction, after #547 (${demandedGenerators.size}; floor ${Math.min(12, scaled(12) || 1)})`);

// The generators the issue named: each must now accept its exact decimal, or
// must have been given explicit wording that demands the fraction.
const NAMED = [
  'c8-rational-numbers-strategy', 'c8-rational-numbers-between', 'c12-random-variable', 'c12-differentiation-rules',
  'c8-rational-numbers-identities', 'c8-rational-numbers', 'c11-conic-sections', 'c12-conditional-probability',
  'c11-limits-derivatives', 'c8-linear-equations-source-mastery', 'c11-sequences-series', 'c10-trigonometry-current',
  'c10-areas-circles', 'y11-lines', 'c8-rational-numbers-distributivity', 'y12-series', 'c7-fractions-current',
  'c11-trig-functions', 'c12-inverse-trigonometric'
];
if (DRAWS >= DEFAULT_DRAWS) {
  for (const id of NAMED) {
    const row = perGenerator.get(id);
    ok(row && (row.decimalAccepted > 0 || row.demanded > 0), `#527 generator ${id} drew a terminating keyed fraction and marked it (${JSON.stringify(row || null)})`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const rows = [...perGenerator.entries()].sort((x, y) => (y[1].decimalAccepted + y[1].demanded) - (x[1].decimalAccepted + x[1].demanded));
console.log(`generator                                  keyed  decimal-ok  demanded  non-term`);
for (const [id, r] of rows.slice(0, 25)) {
  console.log(`${id.padEnd(42)} ${String(r.keyed).padStart(5)}  ${String(r.decimalAccepted).padStart(10)}  ${String(r.demanded).padStart(8)}  ${String(r.nonTerminating).padStart(8)}`);
}
if (rows.length > 25) console.log(`… and ${rows.length - 25} more generators with keyed fractions`);
console.log('');
if (failures.length) {
  console.log(`DECIMAL SWEEP: FAIL — ${failures.length} failing checks (${pass} passed), ${DRAWS} draws per cell`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`);
  process.exit(1);
}
console.log(`DECIMAL SWEEP: PASS — ${pass} checks, ${DRAWS} draws per cell over ${subtopics} generators: ${tally.keyed} keyed fractions, ${tally.decimalAccepted} exact decimals accepted (${acceptedDecimalGenerators.size} generators), ${tally.demanded} refused where the prompt asks for a fraction (${demandedGenerators.size} generators), ${tally.rounded} rounded near misses refused, ${tally.honest} requireFraction draws worded honestly.`);
