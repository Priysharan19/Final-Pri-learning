// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · final-attempt detection is never a guess oracle — every plan bank
//
// The line check (and the live coach built on the same evidence) must reply
// identically to a RIGHT and a WRONG final value. Two root causes made it
// differ on main (reviewer probes826/repro2.mjs, c10-areas-circles D1 seed 11,
// answer "462 cm²": "A = 462" judged, "A = 461" final — 24 of 38 plan
// questions differed):
//   1. the constant-answer guard read "462 cm²" as carrying letters;
//   2. the plan Step Check's stage tag (which marks a WRONG final value at the
//      last stage and leaves a right one untagged) took part in the decision.
//
// This sweep takes EVERY generator whose Step Check is a plan, at every
// difficulty, over several seeds, and for each question probes the final
// value written several ways — "A = v", "v = A", "V_1 = v", "v", "A = v cm²",
// a one-letter relation, and the same after a symbolic working line — with the
// RIGHT value and three WRONG ones (±1, ×1.1, a different constant). For each
// probe shape the evidence must be byte-identical across the four values.
//
//   node server/test/final-attempt-oracle-sweep-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { GENERATORS, loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
import { lineCheckEvidence, stepMetaFor } from '../platform/markerOps.js';
import { isConstantAnswer, stripUnits } from '../platform/finalAttempt.js';
import { answerTextFor } from '../platform/practice.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

await loadAllBanks?.();

const SEEDS = [1, 2, 3, 5, 8, 11, 13, 21];
const fmt = n => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4))));
const SHAPES = [
  v => [`A = ${v}`],
  v => [`${v} = A`],
  v => [`V_1 = ${v}`],
  v => [`${v}`],
  v => [`A = ${v} cm²`],
  v => [`A = ${v} cm^2`],
  v => [`A = ${v} square units`],
  v => [`A = ${v} sq. units`],
  v => [`V = ${v} cubic units`],
  v => [`A = ${v} square metres`],
  v => [`2*A = 2*${v}`],
  v => [`A = l * b`, `A = ${v}`],
  v => [`A = l * b`, `A = ${v}`, `A + l = ${v} + l`],
  // Word labels (#831 review round 3): any label, any script, any spacing.
  v => [`area = ${v}`],
  v => [`Area = ${v}`],
  v => [`volume = ${v}`],
  v => [`total = ${v}`],
  v => [`total area = ${v}`],
  v => [`Total surface area = ${v} sq units`],
  v => [`area of the shaded region = ${v} square units`],
  v => [`the area is ${v}`],
  v => [`The answer is ${v} cm²`],
  v => [`answer is ${v}`],
  v => [`ans: ${v}`],
  v => [`Ans : ${v} sq. units`],
  v => [`= ${v} sq units`],
  v => [`${v} sq units`],
  v => [`A_1 = ${v}`],
  v => [`f(r) = ${v}`],
  v => [`area(ABCD) = ${v}`],
  v => [`क्षेत्रफल = ${v}`],
  v => [`कुल क्षेत्रफल = ${v} वर्ग सेमी`],
  v => [`उत्तर ${v} है`],
  v => [`उत्तर: ${v}`],
  v => [`area = l * b`, `area = ${v}`],
  v => [`area = l * b`, `the area is ${v}`, `so area = ${v}`]
];

const SPELLED_UNITS = ['square units', 'sq units', 'sq. units', 'cubic units', 'units', 'square metres', 'sq. cm', 'cubic centimetres'];

let planQuestions = 0;
let constantAnswers = 0;
const banks = new Set();
for (const id of Object.keys(GENERATORS)) {
  for (const diff of [1, 2, 3]) {
    for (const seed of SEEDS) {
      let q;
      try { q = generateQuestion(id, diff, seed); } catch { continue; }
      const meta = q && stepMetaFor(q);
      if (meta?.kind !== 'plan') continue;
      planQuestions += 1;
      banks.add(id);
      const answerText = String(answerTextFor(q) ?? '');
      if (!isConstantAnswer(answerText)) continue;   // non-constant answers: the form rules in finalAttempt.js
      constantAnswers += 1;
      const right = Number(stripUnits(answerText).replace(/,/g, ''));
      if (!Number.isFinite(right)) continue;
      const values = [right, right + 1, right * 1.1 + 0.37, right === 400 ? 401 : 400].map(fmt);
      // The escrow's own answer text, and the same value with each spelled-out unit (#831 review).
      const answers = [answerText, ...SPELLED_UNITS.map(u => `${fmt(right)} ${u}`)];
      for (const answer of answers) {
        for (const [s, shape] of SHAPES.entries()) {
          const replies = values.map(v => JSON.stringify(lineCheckEvidence(q, shape(v), answer)));
          ok(replies.every(r => r === replies[0]),
            `${id} D${diff} seed ${seed} (answer "${answer}") shape ${s} ${JSON.stringify(shape('v'))}: right and wrong values differ — ${[...new Set(replies)].join(' | ')}`);
        }
      }
    }
  }
}

// ── The reviewer's round-4 shape set (probes826/shapes3.mjs), ported whole ──
// 53 ways to write a final value under each plan stage's own label words,
// alone and after the plan's earlier stages, right vs three wrong values —
// brackets, sqrt, abs, factorial, sci notation, LaTeX \text/\frac, arrows,
// emoji, quotes, Devanagari digits, subscripts. Every pair must be identical.
let r4 = 0;
{
  const sci = v => { const e = Math.floor(Math.log10(Math.abs(v) || 1)); return `${+(v / 10 ** e).toPrecision(12)}e${e}`; };
  const SH = (w, v) => [
    `${v} is the ${w}`, `${w} ≈ ${v}`, `${v} (approx)`, `A=${v}.0`, `A=${sci(v)}`, `${w}=${v} ✓`, `${w} = ${v} 🎉`, `\\text{${w}}=${v}`, `\\text{${w}} = ${v}\\,\\text{cm}^2`,
    `${w} = ${v}`, `${w}: ${v}`, `${w} is ${v}`, `${w} = ${v}.00`, `${w} = +${v}`, `${w} = (${v})`, `${w} = ${v}/1`, `${w} = 2*${v}/2`, `${w} = ${v} + 0`, `${w} = ${v}*1`,
    `${w}=${v};`, `${w} = ${v} exactly`, `${w} = ${v}!`, `${w}=${v}\n`, `${w}\t=\t${v}`, `${w} = ${v} → done`, `${w} ⇒ ${v}`, `${w} -> ${v}`, `${w} == ${v}`, `${w} := ${v}`,
    `${w} = ${String(v).replace('.', ',')}`, `${w} = ${v}`.replace(/\d/g, d => String.fromCharCode(0x0966 + +d)), `${w}=\\frac{${2 * v}}{2}`, `${w} = \\dfrac{${2 * v}}{2}`, `${w}=${v}\\%`,
    `${w} = |${v}|`, `${w} = sqrt(${v * v})`, `${w} = √${v * v}`, `${w} = ${v}^1`, `${w} = 1*${v}`, `so ${w} = ${v}`, `∴ ${w} = ${v}`, `hence ${w} is ${v}`, `${w} = ${v} units`,
    `${w}=${v} (ans)`, `${w}≅${v}`, `${w} ~ ${v}`, `${w} = ${v}…`, `${w} = '${v}'`, `${w} = "${v}"`, `${w} = [${v}]`, `${w} = {${v}}`, `${w}₁ = ${v}`, `${w}' = ${v}`
  ];
  for (const id of Object.keys(GENERATORS)) for (const d of [1, 2, 3, 4]) for (const seed of [7, 11, 23]) {
    let q; try { q = generateQuestion(id, d, seed); } catch { continue; }
    const meta = q && stepMetaFor(q);
    if (meta?.kind !== 'plan' || q.answerType !== 'numeric') continue;
    const v = Number(q.answer.value);
    if (!Number.isFinite(v)) continue;
    const answerText = String(answerTextFor(q) ?? '');
    const words = [...new Set(meta.stages.filter(Boolean).flatMap(s => s.labels || []).concat(['area', 'dy/dx', 'total']))];
    const pre = meta.stages.filter(Boolean).slice(0, -1).filter(s => s.source).map(s => `${s.labels?.[0] || 'k'} = ${s.source}`);
    for (const w of words) for (const P of [[], pre]) {
      const right = SH(w, v);
      for (const x of [v + 1, v * 1.1, 7]) {
        const wrong = SH(w, +x.toFixed(6));
        right.forEach((line, i) => {
          r4 += 1;
          const a = JSON.stringify(lineCheckEvidence(q, [...P, line], answerText));
          const b = JSON.stringify(lineCheckEvidence(q, [...P, wrong[i]], answerText));
          if (a !== b) failures.push(`round-4 shape ${i} ${JSON.stringify(line)} (${id} D${d} seed ${seed}, after ${P.length} lines): ${a} | ${b}`);
          else pass += 1;
        });
      }
    }
  }
}
ok(r4 >= 100000, `the round-4 shape set ran (${r4} probes)`);

// ── Round 5 (probes826/r5sweep.mjs): givens are constants ────────────────────
// "S = -59.5*n" with n fixed by the question is "S = <number>". Every letter
// the plan fixes (givens, derived, stage substitutions, aliases) is
// substituted, and letters that cancel ACROSS the sides ("S + x = v + x") do
// not count. Families: the answer times / plus a given, over a given, mixed
// with free letters that cancel, inequalities around it.
let r5 = 0;
let r5judgedRight = 0;
{
  const f = x => String(+x.toPrecision(12));
  for (const id of Object.keys(GENERATORS)) for (const d of [1, 2, 3, 4]) for (const seed of [1, 7, 11, 23, 42]) {
    let q; try { q = generateQuestion(id, d, seed); } catch { continue; }
    const meta = q && stepMetaFor(q);
    if (meta?.kind !== 'plan' || q.answerType !== 'numeric') continue;
    const v = Number(q.answer.value);
    if (!Number.isFinite(v)) continue;
    const answerText = String(answerTextFor(q) ?? '');
    const stages = meta.stages.filter(Boolean);
    const subs = Object.assign({}, meta.givens || {}, ...stages.map(s => s.substitutions || {}));
    const labs = [...new Set(stages.flatMap(s => s.labels || []).concat(['A']))].filter(l => /^[A-Za-z]+$/.test(l)).slice(0, 4);
    const pre = stages.slice(0, -1).filter(s => s.source).map(s => `${s.labels?.[0] || 'k'} = ${s.source}`);
    const fams = (lab, val) => {
      const out = [`${lab} + x = ${f(val)} + x`, `${lab}*x = ${f(val)}*x`, `(${lab} - ${f(val)})*x + y = y`, `${lab} + x < ${f(val + 0.5)} + x`, `${lab} + x > ${f(val - 0.5)} + x`];
      for (const [s, sv] of Object.entries(subs)) {
        if (!/^[A-Za-z]$/.test(s) || !Number(sv)) continue;
        out.push(`${lab} = ${f(val / sv)}*${s}`, `${lab} = ${s} + ${f(val - sv)}`, `${lab} - ${s} = ${s} - ${s} + ${f(val - sv)} + y - y + 0*${s}`, `${lab} = ${f(val / sv)}*${s} + y - y`,
          `${lab} < ${f((val + 0.5) / sv)}*${s}`, `${lab} > ${f((val - 0.5) / sv)}*${s}`, `${lab}/${s} = ${f(val / sv)}*${s}/${s}`, `${lab} = (${f(val)}/${f(sv)})*${s}`, `${lab}*${s} = ${f(val * sv)}*${s}^0*${s}/${s}*${s}`);
      }
      return out;
    };
    for (const lab of labs) for (const P of [[], pre]) {
      const right = fams(lab, v);
      for (const w of [v + 1, v * 1.1, v - 0.5]) {
        const wrong = fams(lab, w);
        right.forEach((line, i) => {
          r5 += 1;
          const a = lineCheckEvidence(q, [...P, line], answerText);
          const b = lineCheckEvidence(q, [...P, wrong[i]], answerText);
          if (a.attemptAt === -1 && a.verifiedLines > P.length) r5judgedRight += 1;
          if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(`round-5 ${JSON.stringify(line)} vs ${JSON.stringify(wrong[i])} (${id} D${d} seed ${seed}, after ${P.length}): ${JSON.stringify(a)} | ${JSON.stringify(b)}`);
          else pass += 1;
        });
      }
    }
  }
}
ok(r5 >= 40000, `the round-5 givens families ran (${r5} probes)`);

// ── probes826/sweep831.mjs, ported: cancellation across sides, products,
// quotients, a free letter minus the value ("z = V - v", whose quotient once
// hid V at large magnitudes), subscripts, comma-joined bounds, juxtaposition.
let r831 = 0;
{
  const fmt6 = x => String(Math.round(x * 1e6) / 1e6);
  const shapes = (lab, v, sfx) => [
    [`${lab} = ${v}`], [`${lab} + z = ${v} + z`], [`${lab} = ${v} + z - z`], [`${lab}*z = ${v}*z`], [`${lab} - B = ${v} - B`],
    [`${lab} = ${v}*m/m`], [`${lab} + ${lab} = 2*${v}`], [`(${lab} - ${v})*z = 0`], [`${lab}/z = ${v}/z`], [`z = ${lab} - ${v}`],
    [`${lab} = ${v} ${sfx}`], [`${lab} = ${v} cubic cm`], [`${lab} = ${v} ft`], [`${lab}_1 + y = ${v} + y`],
    [`${lab} > ${v} - 1, ${lab} < ${v} + 1`], [`${lab} = ${v}`, `${lab} + z = ${v} + z`], [`${lab}·z = ${v}·z`], [`${v} + z`], [`${v}z`],
    [`z = V - ${v}`], [`z*(V - ${v}) = y`], [`(V - ${v})/z = y`]
  ];
  for (const id of Object.keys(GENERATORS)) for (const d of [1, 2, 3, 4]) for (const seed of [7, 11, 23]) {
    let q; try { q = generateQuestion(id, d, seed); } catch { continue; }
    const meta = q && stepMetaFor(q);
    if (meta?.kind !== 'plan') continue;
    const v = Number(q.answer?.value);
    if (!Number.isFinite(v)) continue;
    const answerText = String(answerTextFor(q) ?? '');
    const stages = meta.stages.filter(Boolean);
    const lab = stages.at(-1).labels?.[0] || 'A';
    const pre = stages.slice(0, -1).filter(s => s.source).map(s => `${s.labels?.[0] || 'k'} = ${s.source}`);
    const R = shapes(lab, fmt6(v), q.answerSuffix || '');
    for (const P of [[], pre]) R.forEach((right, i) => {
      const a = JSON.stringify(lineCheckEvidence(q, [...P, ...right], answerText));
      for (const w of [v + 1, v * 1.1, 7, v * 1000 + 3, v / 1000]) {
        r831 += 1;
        const b = JSON.stringify(lineCheckEvidence(q, [...P, ...shapes(lab, fmt6(w), q.answerSuffix || '')[i]], answerText));
        if (a !== b) failures.push(`sweep831 shape ${i} ${JSON.stringify(right)} (${id} D${d} seed ${seed}): ${a} | ${b}`);
        else pass += 1;
      }
    });
  }
}
ok(r831 >= 5000, `the sweep831 shapes ran (${r831} probes)`);
ok(r5judgedRight === 0, `no right final value is ever verified by the line check (${r5judgedRight})`);

// The reviewer's exact repro.
{
  const q = generateQuestion('c10-areas-circles', 1, 11);
  const answerText = String(answerTextFor(q) ?? '');
  ok(/462/.test(answerText), `the repro question is the reviewer's (answer "${answerText}")`);
  const replies = ['A = 462', 'A = 461', 'A = 463', 'A = 400', 'A = 462 cm²'].map(l => JSON.stringify(lineCheckEvidence(q, [l], answerText)));
  ok(replies.every(r => r === replies[0]), `repro: "A = 462" and its wrong values give identical evidence — ${[...new Set(replies)].join(' | ')}`);
}

ok(planQuestions >= 30, `the sweep reached the plan banks (${planQuestions} plan questions in ${banks.size} banks)`);
ok(constantAnswers >= 20, `and their constant answers (${constantAnswers})`);

console.log(failures.length
  ? `FINAL-ATTEMPT ORACLE SWEEP: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`
  : `FINAL-ATTEMPT ORACLE SWEEP: PASS — ${pass}/${pass} checks — ${planQuestions} plan questions in ${banks.size} banks, ${constantAnswers} constant answers, ${r4} round-4 probes, ${r5} round-5 probes, ${r831} sweep831 probes, right and wrong values byte-identical for every probe shape.`);
process.exit(failures.length ? 1 : 0);
