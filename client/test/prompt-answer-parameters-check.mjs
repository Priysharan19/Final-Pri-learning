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

// ── 3 · a "mode" / "modal class" question has exactly one mode ──────────────
// "A grouped frequency table reads 30–40: 13 … 60–70: 13. Find the mode." gave two
// modal classes by the same formula (700/19 and 65.5) while the key named one, so
// a student who chose the other class was marked wrong with an equally right answer.
// Every prompt that asks for a mode (or modal class) is read back into its data —
// a listed set of values, a frequency table, a grouped table, a dot plot or a
// histogram — and the highest frequency must belong to one value only, across the
// same seed range as above, in both editions' generators.
const MODE_ASK = /\bmod(?:e|al class)\b/i;
const num = t => Number(String(t).replace(/[^\d.\-]/g, ''));
function dataOf(q) {
  const p = String(q.prompt);
  // an unknown frequency x is filled with the key, so the modal class that results is the one checked
  const xKey = q.answer && typeof q.answer.value === 'number' ? q.answer.value : null;
  const grouped = [...p.matchAll(/\$[\d.]+\$[–-]\$[\d.]+\$:\s*\$(\d+|x)\$/g)].map(m => (m[1] === 'x' ? xKey : Number(m[1])));
  if (grouped.length >= 3 && grouped.every(v => Number.isFinite(v))) return { kind: 'grouped table', freqs: grouped };
  const row = p.match(/Frequency\}?\s*((?:&\s*\d+\s*)+)/);
  if (row) return { kind: 'frequency table', freqs: [...row[1].matchAll(/\d+/g)].map(m => Number(m[0])) };
  const fig = String(q.figure ?? '');
  const dots = [...fig.matchAll(/<circle cx="([\d.]+)"/g)].map(m => m[1]);
  if (dots.length) { const c = new Map(); for (const x of dots) c.set(x, (c.get(x) || 0) + 1); return { kind: 'dot plot', freqs: [...c.values()] }; }
  const bars = [...fig.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)"/g)].map(m => Number(m[1]));
  if (bars.length >= 3) return { kind: 'histogram', freqs: bars };
  const list = p.split(/Find|What/)[0].match(/(?:\$?-?\d+(?:\.\d+)?\$?(?:,\\ |,\s*)){2,}\$?-?\d+(?:\.\d+)?\$?/);
  if (list) { const c = new Map(); for (const m of list[0].matchAll(/-?\d+(?:\.\d+)?/g)) c.set(m[0], (c.get(m[0]) || 0) + 1); return { kind: 'listed values', freqs: [...c.values()] }; }
  return null;
}
const modeKinds = {};
const modeIds = new Set();
const modeBad = [];
for (const id of Object.keys(GENERATORS)) {
  for (let d = 1; d <= 4; d++) {
    for (let s = 1; s <= SEEDS; s++) {
      let q;
      try { q = generateQuestion(id, d, s * 7919 + d); } catch { continue; }
      if (!MODE_ASK.test(String(q.prompt))) continue;
      const data = dataOf(q);
      if (!data) continue;
      modeKinds[data.kind] = (modeKinds[data.kind] || 0) + 1;
      modeIds.add(id);
      const top = Math.max(...data.freqs);
      if (data.freqs.filter(f => Math.abs(f - top) < 1e-9).length !== 1) modeBad.push(`${id} d${d} seed ${s * 7919 + d}: ${data.kind} ${JSON.stringify(data.freqs)} has more than one mode, key ${JSON.stringify(q.answer)}`);
    }
  }
}
for (const c of modeBad.slice(0, 40)) fail(c);
if (modeBad.length > 40) fail(`... and ${modeBad.length - 40} more questions with two modes`);
ok(Object.keys(modeKinds).length >= 5, `mode sweep read only these data forms: ${JSON.stringify(modeKinds)}; it must see grouped tables, frequency tables, dot plots, histograms and listed values`);
ok(modeIds.size >= 5, `mode sweep reached only ${modeIds.size} generators`);

// ── 4 · the question's verb agrees with the story ────────────────────────────
// "A council pump removes floodwater from a car park ... How many kilolitres arrive between t = 1 and
// t = 6?" asked for an arrival of something the story takes away. A prompt whose story removes
// something (removes, drains, pumps out, leaks, loses) must not ask how much arrives, enters or is
// delivered, and the reverse: a story that adds or delivers must not ask how much is removed.
const TAKES = /\b(?:removes?|drains?|pumps?\s+out|empties|leaks?|loses)\b/i;
const GIVES = /\b(?:arrives?|enters?|flows?\s+into|delivers?|fills?|adds?)\b/i;
const verbBad = [];
let verbChecked = 0;
for (const id of Object.keys(GENERATORS)) {
  for (let d = 1; d <= 4; d++) {
    for (let s = 1; s <= Math.min(SEEDS, 120); s++) {
      let q;
      try { q = generateQuestion(id, d, s * 7919 + d); } catch { continue; }
      const text = String(q.prompt).replace(/\$[^$]*\$/g, ' ');
      const sentences = text.split(/(?<=[.?!])\s+/);
      const ask = sentences.filter(x => /\bhow (?:many|much)\b/i.test(x)).join(' ');
      const story = sentences.filter(x => !/\bhow (?:many|much)\b/i.test(x)).join(' ');
      if (!ask || !story) continue;
      verbChecked++;
      if ((TAKES.test(story) && /\b(?:arrives?|arrive|enters?|flows? into|(?:are |is )?delivered)\b/i.test(ask) && !GIVES.test(story))
        || (GIVES.test(story) && !TAKES.test(story) && /\b(?:(?:are |is )?removed|drains?)\b/i.test(ask))) {
        verbBad.push(`${id} d${d} seed ${s * 7919 + d}: ${norm(q.prompt).slice(0, 200)}`);
      }
    }
  }
}
for (const c of verbBad.slice(0, 20)) fail(`verb disagrees with the story: ${c}`);
ok(verbChecked >= 10000, `verb sweep read only ${verbChecked} story-and-question prompts`);

console.log(`prompt-answer-parameters: ${verbChecked} story-and-question prompts read for removes/arrive mismatches, ${verbBad.length} found;`);
console.log(`prompt-answer-parameters: mode questions ${JSON.stringify(modeKinds)} over ${modeIds.size} generators, ${modeBad.length} with two modes;`);
console.log(`prompt-answer-parameters: ${energy} energy questions over ${rates.size} printed rates; ${generated} questions from ${Object.keys(GENERATORS).length} generators; ${failures} failure(s)`);
if (failures) process.exit(1);
