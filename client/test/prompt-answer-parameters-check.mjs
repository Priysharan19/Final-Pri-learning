// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · prompt numbers vs answer parameters
//
// `ms11-energy` (replacing an appliance) once printed "electricity at $0.32/kWh"
// while the key was computed with a rate drawn from 0.28-0.38: 308 of 400
// questions marked a student who used the printed rate wrong. Two audits:
//
//   1. The reported form, recomputed independently from the numbers the prompt
//      prints (power of both appliances, hours per day, the printed rate), must
//      equal the key for every seed, and the rate in the prompt, hint and
//      worked step must be one value. The sweep must see more than one rate,
//      or it proves nothing.
//
//   2. Every generator, at every difficulty, over a fixed seed range: two
//      questions that show the learner the identical prompt, options and
//      figure must not carry different answers. A value that decides the key
//      but is never shown (a hidden random parameter) makes the same visible
//      question have several keys. Answers are compared as the marker would:
//      numbers by value, solution lists as sets, expressions by equivalence.
//      "Factorise 10x + 10 fully" once keyed 2(5x + 5) and 5(2x + 2) for that
//      reason, and "Find the discriminant of 8z^2 - 4" printed "8z^2 + 4".
//
// It fails if it generates fewer questions than expected, so it cannot pass
// vacuously.
//
// Usage: node client/test/prompt-answer-parameters-check.mjs [--seeds N]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
const { exprEquivalent } = await import(`${SRC}engine/expr.js`);
await loadAllBanks();

const seedsArg = process.argv.indexOf('--seeds');
const SEEDS = seedsArg > 0 ? Math.max(1, Number(process.argv[seedsArg + 1]) || 0) : 400;

let failures = 0;
const fail = msg => { failures++; console.error(`FAIL ${msg}`); };
const ok = (cond, msg) => { if (!cond) fail(msg); };

// ── 1 · ms11-energy, replacing an appliance ─────────────────────────────────
const FORM = /Replacing a \$(\d+)\$ W appliance with a \$(\d+)\$ W one \(used \$(\d+)\$ h\/day, electricity at \\\$([\d.]+)\/kWh\)/;
let energy = 0;
const rates = new Set();
for (let seed = 1; energy < 400 && seed < 400000; seed++) {
  const q = generateQuestion('ms11-energy', 4, seed);
  const m = FORM.exec(q.prompt);
  if (!m) continue;
  energy++;
  const [oldW, newW, hrs, rate] = m.slice(1).map(Number);
  rates.add(rate);
  const expected = Math.round((oldW - newW) / 1000 * hrs * 365 * rate);
  if (Math.abs(expected - q.answer.value) > q.answer.tol) fail(`ms11-energy seed ${seed}: prompt rate ${rate} gives ${expected}, key ${q.answer.value}`);
  const shown = `${m[4]}`;
  const text = JSON.stringify([q.hints, q.steps]);
  ok(text.includes(`\\\\times ${shown} =`) && text.includes(`365 days × $${shown}`), `ms11-energy seed ${seed}: hint/step rate differs from the printed ${shown}`);
  ok(!/0\.32/.test(text) || rate === 0.32, `ms11-energy seed ${seed}: a stale 0.32 remains in the hints or steps`);
}
ok(energy === 400, `ms11-energy: only ${energy} replacing-an-appliance questions found`);
ok(rates.size >= 4, `ms11-energy: the sweep saw ${rates.size} distinct printed rates; the rate must vary for the check to mean anything`);

// ── 2 · identical visible question, different key ───────────────────────────
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
function sameAnswer(a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) return true;
  if (a?.expr != null && b?.expr != null) {
    try { return exprEquivalent(String(a.expr), String(b.expr)); } catch { return false; }
  }
  if (Array.isArray(a?.values) && Array.isArray(b?.values)) {
    const f = v => v.map(x => Math.round(x * 1e9) / 1e9).sort((p, q) => p - q).join(',');
    return f(a.values) === f(b.values) && (a.tol ?? 0) === (b.tol ?? 0);
  }
  return false;
}
const keyOf = q => {
  const a = q.answer;
  if (q.mcqOptions && a && typeof (a.index ?? a.correct ?? a.value) === 'number') {
    const i = a.index ?? a.correct ?? a.value;
    return { mcq: q.mcqOptions[i] };
  }
  return a;
};
let generated = 0;
const conflicts = [];
for (const id of Object.keys(GENERATORS)) {
  for (let d = 1; d <= 4; d++) {
    const seen = new Map();
    for (let s = 1; s <= SEEDS; s++) {
      let q;
      try { q = generateQuestion(id, d, s * 7919 + d); } catch { continue; }
      generated++;
      const visible = `${norm(q.prompt)}||${JSON.stringify(q.mcqOptions ?? null)}||${JSON.stringify(q.figure ?? null)}`;
      const key = keyOf(q);
      const prior = seen.get(visible);
      if (!prior) { seen.set(visible, { key, seed: s * 7919 + d, prompt: norm(q.prompt) }); continue; }
      if (!sameAnswer(prior.key, key)) conflicts.push(`${id} d${d}: "${prior.prompt.slice(0, 110)}" keyed ${JSON.stringify(prior.key)} (seed ${prior.seed}) and ${JSON.stringify(key)} (seed ${s * 7919 + d})`);
    }
  }
}
for (const c of conflicts) fail(c);
ok(generated >= Object.keys(GENERATORS).length * 4 * SEEDS * 0.9, `only ${generated} questions generated`);

console.log(`prompt-answer-parameters: ${energy} energy questions over ${rates.size} printed rates; ${generated} questions from ${Object.keys(GENERATORS).length} generators; ${failures} failure(s)`);
if (failures) process.exit(1);
