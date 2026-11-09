// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · worked steps and hints read as if a person wrote them
//
// #700 made the content certifier fail a prompt, stem or option that shows a
// double sign ("-8 + -36"), a unit or zero coefficient ("1x = 8", "0t"), or a
// zero term inside an algebraic expression ("(x + 1)(x - 0)"). It left the
// hints and worked steps a student reads after answering as the follow-up.
// This suite is that follow-up: the same rules (client/test/support/
// typesetting-rules.mjs), over every hint and worked step of every generator a
// V1 chapter declares, at every difficulty.
//
// Hints and steps are not part of the content hash (contentIdentity.js hashes
// the stem, prompt, options, answer, figure and parts), so fixing them changes
// no contentId and needs no CONTENT_VERSION bump. content-report-fresh-check
// proves that on every run: the committed generator digests still match.
//
// A step may show arithmetic with a zero in it — evaluating at a lower limit,
// summing a list that holds 0, substituting C = 0 — so the +0 rule fires only on
// a side of a relation that has a variable in it.
//
// HELD lists generators whose hints or steps may still break a rule, each with
// the file that could not be edited yet. It is empty: the held L5 commit (after
// lane L1's train) fixed the last 26. A generator outside HELD with a hit fails
// here; a HELD generator that no longer exists fails here too.
// ─────────────────────────────────────────────────────────────────────────────
import { workedStepHits } from './support/typesetting-rules.mjs';

const { IN_CURRICULUM } = await import('../src/engine/curriculum-in.js');
const { indiaScope } = await import('../src/engine/indiaProduct.js');
const { generateQuestion, loadAllBanks, GENERATORS } = await import('../src/engine/generators/index.js');

const DRAWS = 60;
// Empty since the held L5 commit landed after lane L1's train: every V1
// generator's hints and steps pass. A generator may be added here only with a
// reason naming the file that cannot be edited yet.
const HELD = new Map();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// ── 1. The rule itself: it fires on each defect and on nothing it should not ─
const RULE_CASES = [
  ['$3x+0=180$', true], ['$(x + 1)(x - 0)=0$', true], ['$f(x) = x^2 - -4x + 0$', true],
  ['$3m+12+0=2m + 20$', true], ['$1x = 8$', true], ['$-8 + -36$', true], ['$\\sin 1x$', true],
  ['$24t-1=0t+239$', true], ['$7x = 1n$', true], ['$1 + -\\dfrac{3}{4}$', true],
  ['$\\dfrac{16 + 8 + 0 + 8 + 16}{5}$', false], ['$= \\dfrac{1 - 0}{3}$', false],
  ['$\\left[\\dfrac{x^{5}}{5}\\right]_{0}^{5} = \\dfrac{5^{5}}{5} - 0$', false], ['$-18 - 0 = -18$', false],
  ['$y(4) = 1(4)^{3} + 0 = 64$', false], ['$\\dfrac{2}{1 + 0} = \\dfrac{2}{1}$', false],
  ['$x = 8$', false], ['$-8 - 36$', false], ['$6 - (-1)$', false], ['$x_1 = 3$', false],
  ['$10x = 20$', false], ['$a_1x + b_1y$', false], ['$y - 5 = 8(x - 1)$', false],
  // Chains of two or more relations: every relation splits the span, so each
  // side is judged on its own.
  ['$x + 0 = 5 = y + 0$', true], ['$5 = 2 + 3 = x + 0$', true], ['$0 \\le x + 0 \\le 3$', true],
  ['$x \\le 3 \\quad 2x + 0 \\ge 2$', true], ['$1 - 0 = 1 = 3 - 2$', false],
  ['$y(1) = 1 - 0 = 1 \\Rightarrow k = 1$', false], ['$0 \\le x \\le 3 \\le 5 - 0$', false]
];
for (const [text, defect] of RULE_CASES) {
  ok((workedStepHits(text).length > 0) === defect, `rule ${defect ? 'fires on' : 'passes'} ${text}`);
}

// ── 2. Every hint and worked step of every V1 generator ─────────────────────
await loadAllBanks();
const gens = new Set();
for (const group of IN_CURRICULUM) for (const ch of group.chapters) for (const c of ch.covers || []) if (GENERATORS[c.gen]) gens.add(c.gen);
for (const track of ['jee-main', 'jee-advanced']) for (const grade of [11, 12]) for (const ch of indiaScope(track, grade)) for (const c of ch.covers || []) if (GENERATORS[c.gen]) gens.add(c.gen);
ok(gens.size > 200, `found the V1 generators (${gens.size})`);
for (const id of HELD.keys()) ok(gens.has(id), `held generator ${id} is still a V1 generator`);

function readAfterAnswering(q) {
  const out = [];
  const step = (where, s) => {
    if (typeof s === 'string') out.push([where, s]);
    else if (Array.isArray(s)) s.forEach(x => out.push([where, x]));
    else if (s && typeof s === 'object') { out.push([where, s.h]); out.push([where, s.d]); }
  };
  (q.hints || []).forEach((h, i) => out.push([`hint ${i + 1}`, h]));
  (q.steps || []).forEach((s, i) => step(`step ${i + 1}`, s));
  (q.parts || []).forEach((p, j) => {
    (p?.hints || []).forEach((h, i) => out.push([`part ${j + 1} hint ${i + 1}`, h]));
    (p?.steps || []).forEach((s, i) => step(`part ${j + 1} step ${i + 1}`, s));
  });
  return out.filter(([, text]) => typeof text === 'string' && text);
}

let draws = 0, strings = 0, heldHits = 0;
const heldSeen = new Set();
for (const id of [...gens].sort()) {
  const found = new Map();
  for (let d = 1; d <= 4; d++) {
    for (let i = 0; i < DRAWS; i++) {
      let q;
      try { q = generateQuestion(id, d, 0x57e95000 + d * 1000 + i); } catch { continue; }
      draws++;
      for (const [where, text] of readAfterAnswering(q)) {
        strings++;
        for (const hit of workedStepHits(text)) {
          const key = `${hit.rule} in ${where} at D${d}`;
          if (!found.has(key)) found.set(key, hit.math);
        }
      }
    }
  }
  if (HELD.has(id)) {
    heldHits += found.size;
    if (found.size) heldSeen.add(id);
    continue;
  }
  const first = [...found.entries()][0];
  ok(found.size === 0, `${id}: hints and worked steps carry no typesetting defect${first ? ` (${found.size} kinds; ${first[0]}: $${first[1].slice(0, 100)}$)` : ''}`);
}
ok(draws > 50000, `drew every V1 generator ${DRAWS} times at each difficulty (${draws} questions, ${strings} hint and step strings)`);

// ── 3. Regression: the collinearity hint names the real multiplier ──────────
// c10-coordinate-geometry D4 said "The x-step tripled" whatever the multiplier
// (2, 3 or 4) was; the hint now names k, and it matches the worked step.
{
  let checked = 0, wrong = 0;
  for (let i = 0; i < 200; i++) {
    const q = generateQuestion('c10-coordinate-geometry', 4, 0x57e96000 + i);
    const hint = (q.hints || []).find(h => /x-step/.test(h));
    const step = (q.steps || []).find(s => /Scale the y-step/.test(s?.h || ''));
    if (!hint || !step) continue;
    checked++;
    const k = /\$(\d+)\$ times as big/.exec(step.d)?.[1];
    if (/tripled/.test(hint) || !k || !hint.includes(`$${k}$ times as big`)) wrong++;
  }
  ok(checked >= 150, `drew the collinearity form (${checked})`);
  ok(wrong === 0, `the collinearity hint names the same multiplier as the worked step (${wrong} of ${checked} disagree)`);
}

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`WORKED STEPS TYPESETTING: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`WORKED STEPS TYPESETTING: PASS — ${pass}/${total} checks — ${draws} questions, ${strings} hint and step strings; ${HELD.size} generators held`);
