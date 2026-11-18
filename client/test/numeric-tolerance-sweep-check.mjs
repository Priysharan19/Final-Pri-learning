// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · numeric tolerance sweep (no answer band may swallow a wrong value)
//
// A numeric key carries an authored `tol`. A walk-through found tolerances that
// were looser than the question: a z-score of 0.5 keyed with tol 0.011 (0.51 was
// right), "2.35 %" with tol 0.11 (2.397 was right), a rate keyed 0.03 with tol
// 0.0011 (0.0306 was right), and "evaluate exactly" answers authored with an
// absolute tol 0.001 that is half the size of a key such as 1/480.
//
// For every generator, at every difficulty, over a fixed seed range, every
// numeric-answer question is put to the real marker (engine/checker.js) with:
//
//   · key + d and key - d, where d = max(one unit in the last required place,
//     2% of |key|). The last required place is the named precision ("correct to
//     2 decimal places", "to the nearest degree"), else the last digit of the
//     key as authored (a whole key: 1). Both must be refused.
//   · an "exact" question (prompt asks for the exact value): the key moved by
//     0.1% of itself, either way, must be refused. An absolute band must never
//     accept a value that differs from an exact answer by more than a tiny
//     relative amount.
//   · a named precision: the next value at that precision either side of the
//     correctly rounded key must be refused, and the rounded key and the key
//     itself must be accepted (so the probes cannot pass by refusing everything).
//
// The key itself must be accepted by the marker. It fails if it sees too few
// numeric questions, so it cannot pass vacuously.
//
// Usage: node client/test/numeric-tolerance-sweep-check.mjs [seeds-per-cell]
//        TOL_REPORT=1 prints every loose cell with an example.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { namedDecimalPlaces } = await import(`${SRC}engine/checker-core.js`);

const SEEDS = Number(process.argv[2]) || 40;
const REPORT = !!process.env.TOL_REPORT;

const fmt = x => String(Number(x.toPrecision(12)));
const accepts = (q, text) => { try { return checkAnswer(q, text)?.correct === true; } catch { return false; } };
// "find the exact value" yes; "exactly 3 integer solutions", "exactly one", "exactly when" no.
const asksExact = prompt => /\bexact\b(?!\s+(?:change|same))|\bexactly\b(?!\s+(?:\$?\d|one|two|three|four|five|when|the same|equal|half|as many|divisible))/i.test(String(prompt).replace(/\$[^$]*\$/g, ' '));
// How a student writes the key: the authored exact form when there is one (a fraction demanded
// in lowest terms refuses its decimal), else the number.
const keyText = (q, v) => q.answer.canonicalInput ?? (q.answer.simplestFraction ? `${q.answer.simplestFraction.n}/${q.answer.simplestFraction.d}` : fmt(v));
const decimalsOf = v => {
  const t = String(Number(v.toPrecision(12)));
  if (/e/i.test(t)) return 12;
  return (t.split('.')[1] || '').length;
};

const ROUNDING_WORDS = /\b(?:estimate[sd]?|approximat\w*|about|roughly|round(?:ed|ing)?|nearest|significant|decimal\s+places?|d\.\s?p\.?|s\.\s?f\.?)\b/i;
const unstated = [];   // a rounded key (more than two decimals, an authored tol) whose prompt names no precision
const loose = new Map();   // "id dN" -> { count, example }
let refused = 0;   // keys the marker refused when typed (the probes mean little if most keys are refused)
let questions = 0, probes = 0, namedCount = 0, exactCount = 0;
const families = new Set();

for (const id of Object.keys(GENERATORS)) {
  for (let d = 1; d <= 4; d++) {
    for (let s = 1; s <= SEEDS; s++) {
      let q;
      try { q = generateQuestion(id, d, s * 7919 + d); } catch { continue; }
      const a = q.answer;
      if (q.answerType !== 'numeric' || !a || typeof a.value !== 'number' || !Number.isFinite(a.value)) continue;
      if (q.mcqOptions) continue;
      questions++;
      families.add(id);
      const v = a.value;
      const places = namedDecimalPlaces(q);
      if (places != null) namedCount++;
      const unit = places != null ? 10 ** -places : (Number.isInteger(v) ? 1 : 10 ** -Math.min(decimalsOf(v), 9));
      const delta = Math.max(unit, 0.02 * Math.abs(v));
      const bad = [];
      const probe = (x, why) => {
        if (!Number.isFinite(x) || Math.abs(x - v) < 1e-12) return;
        probes++;
        if (accepts(q, fmt(x))) bad.push(`${why}: ${fmt(x)}`);
      };
      probe(v + delta, 'key + max(unit, 2%)');
      probe(v - delta, 'key - max(unit, 2%)');
      if (places == null && v !== 0 && delta > 0.02 * Math.abs(v) * (1 + 1e-9)) { probe(v + 0.02 * Math.abs(v), 'key + 2%'); probe(v - 0.02 * Math.abs(v), 'key - 2%'); }
      if (places == null && a.tol != null && !a.simplestFraction && !a.requireExact && decimalsOf(v) <= 6 && Math.abs(v) < 1e6 && !ROUNDING_WORDS.test(`${q.prompt} ${q.answerSuffix ?? ''}`)) {
        // No precision named and no rounding asked for: the key is exact, so one unit in its own last
        // place (a hundredth for a whole key) off it is a different number (the NSW quality gate's probe).
        const own = Number.isInteger(v) ? 0.01 : 10 ** -Math.min(decimalsOf(v), 9);
        probe(v + own, 'key + one unit in its last place');
        probe(v - own, 'key - one unit in its last place');
        // A key with more than two decimals is a rounded value of something longer: the prompt must say so.
        if (decimalsOf(v) > 2 && !a.simplestFraction && !a.requireExact && a.tol > 1e-6 * Math.max(1, Math.abs(v)) && !asksExact(q.prompt)) unstated.push(`${id} d${d}: ${String(q.prompt).slice(-80).replace(/\n/g, ' ')} | key ${fmt(v)} tol ${a.tol}`);
      }
      if (asksExact(q.prompt) && v !== 0) {
        exactCount++;
        probe(v * 1.001, 'exact key + 0.1%');
        probe(v * 0.999, 'exact key - 0.1%');
      }
      if (places != null) {
        const rounded = Number(v.toFixed(places));
        probe(rounded + 10 ** -places, `${places} d.p., next value up`);
        probe(rounded - 10 ** -places, `${places} d.p., next value down`);
        if (!accepts(q, rounded.toFixed(places))) refused++;
      } else if (!accepts(q, keyText(q, v))) refused++;
      if (bad.length) {
        const k = `${id} d${d}`;
        const cell = loose.get(k) || { count: 0, example: `${String(q.prompt).slice(-110)} | key ${fmt(v)} tol ${a.tol ?? 'default'} | accepted ${bad[0]}` };
        cell.count++;
        loose.set(k, cell);
      }
    }
  }
}

let failures = 0;
// The marker itself, on the walk-through's case: key 1/480 authored with an absolute tol of 0.001
// on an "exactly" prompt (no fraction form, no requireExact, so only the tol decides).
{
  const base = { answerType: 'numeric', answer: { value: 1 / 480, tol: 0.001 } };
  const exactQ = { ...base, prompt: 'Use $u = \\sin(3x)$ to evaluate $\\displaystyle\\int_0^{\\pi/18} 5\\cos(3x)\\sin^2(3x)\\,dx$ exactly.' };
  const roundedQ = { ...base, prompt: 'Evaluate the integral, correct to 3 decimal places.' };
  const expect = (q, text, want, label) => { if (accepts(q, text) !== want) { failures++; console.error(`FAIL ${label}: "${text}" should be ${want ? 'accepted' : 'refused'}`); } };
  for (const wrong of ['0.0015', '0.0025', '0.00108', '0.00308', '1/400', '0.002']) expect(exactQ, wrong, false, 'exact prompt, authored tol 0.001');
  expect(exactQ, '1/480', true, 'exact prompt, the key');
  expect(exactQ, '0.00208333333333333', true, 'exact prompt, the key to 15 places');
  expect(roundedQ, '0.002', true, 'a rounding prompt keeps its band');
  expect(roundedQ, '0.003', false, 'a rounding prompt refuses the next place');
}
for (const [k, c] of loose) { failures++; console.error(`FAIL ${k}: ${c.count} question(s) accept a wrong value. ${c.example}`); }
if (refused > questions * 0.05) { failures++; console.error(`FAIL the marker refused ${refused} of ${questions} keys typed as a student would; the probes cannot be trusted`); }
const unstatedCells = new Map();
for (const u of unstated) { const k = u.split(':')[0]; if (!unstatedCells.has(k)) unstatedCells.set(k, u); }
for (const u of unstatedCells.values()) { failures++; console.error(`FAIL a rounded key with no stated precision: ${u}`); }
const looseFamilies = new Set([...loose.keys()].map(k => k.split(' ')[0]));
if (questions < 20000) { failures++; console.error(`FAIL only ${questions} numeric questions swept`); }
if (namedCount < 1000 || exactCount < 500) { failures++; console.error(`FAIL the sweep saw ${namedCount} named-precision and ${exactCount} exact questions; it must see both kinds in numbers`); }
if (REPORT && !failures) console.log('no loose cell');
console.log(`numeric-tolerance-sweep: ${questions} numeric questions from ${families.size} generators (${namedCount} with a named precision, ${exactCount} asking for an exact value), ${probes} probes; ${loose.size} loose cell(s) in ${looseFamilies.size} generator(s); ${unstatedCells.size} cell(s) with a rounded key and no stated precision; ${refused} key(s) not accepted as typed; ${failures} failure(s)`);
if (failures) process.exit(1);
