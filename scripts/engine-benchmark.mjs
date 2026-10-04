#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Engine benchmark — a confusion table for the deterministic marker
//
// Ledger 3.8. Regenerates docs/evidence/engine-benchmark.md: for every
// generator in the bank, a fixed set of seeded questions is drawn, the
// authored answer is written in its canonical form and marked (it must be
// accepted), and a deterministic wrong answer is derived from it and marked
// (it must be refused). The per-answer-type and per-equivalence-class counts
// are the confusion table. Seeds are fixed, so two runs of the same commit
// produce the same table and the diff on main shows only real changes.
//
// WHAT THIS IS NOT. It is synthetic self-consistency evidence: the engine's
// own generators, marked by the engine's own marker, with wrong answers
// derived by rule. It is not a measurement of marking accuracy on student
// answers, it involves no handwriting, no student, no teacher and no human
// review, and no number in the report is an accuracy claim. The release gates
// are elsewhere (server/test/selfcheck.mjs and the holdout suites) and this
// report never lowers them; `--strict` makes a false positive exit non-zero.
//
//   node scripts/engine-benchmark.mjs [--draws=6] [--strict] [--out=path]
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const DRAWS = Math.max(1, Number(args.draws) || 6);
const STRICT = Boolean(args.strict);
const OUT = resolve(ROOT, typeof args.out === 'string' ? args.out : 'docs/evidence/engine-benchmark.md');

const { generateQuestion, loadAllBanks, GENERATORS } = await import(join(ROOT, 'client/src/engine/generators/index.js'));
const { checkAnswer } = await import(join(ROOT, 'client/src/engine/checker.js'));
const { formatRegion, formatMatrix, formatVector, formatComplex, transposeMatrix, authoredRegion } = await import(join(ROOT, 'client/src/engine/answer-forms.js'));

await loadAllBanks();

const fmt = v => (Number.isInteger(v) ? String(v) : String(Number(Number(v).toPrecision(12))));

/** The authored answer in its canonical writing, and one rule-derived wrong answer. */
function pair(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'numeric': {
      if (a.simplestFraction) return { right: `${a.simplestFraction.n}/${a.simplestFraction.d}`, wrong: `${a.simplestFraction.n + a.simplestFraction.d}/${a.simplestFraction.d}`, rule: 'numerator + denominator' };
      if (a.surdForm) return { right: `${a.surdForm.k}sqrt(${a.surdForm.r})`, wrong: `${a.surdForm.k + 1}sqrt(${a.surdForm.r})`, rule: 'coefficient + 1' };
      if (!Number.isFinite(a.value)) return null;
      const step = Math.max(1, Math.abs(a.value) * 0.1, (a.tol || 0) * 4);
      return { right: fmt(a.value), wrong: fmt(a.value + step), rule: 'value + max(1, 10%, 4·tol)' };
    }
    case 'expression': return a.expr ? { right: a.expr, wrong: `(${a.expr}) + 1`, rule: 'expression + 1' } : null;
    case 'set': return Array.isArray(a.values) && a.values.length ? { right: a.values.map(fmt).join(', '), wrong: a.values.map(v => fmt(v + 1)).join(', '), rule: 'each value + 1' } : null;
    case 'point': return { right: `(${fmt(a.x)}, ${fmt(a.y)})`, wrong: `(${fmt(a.x + 1)}, ${fmt(a.y)})`, rule: 'x + 1' };
    case 'ratio': return { right: `${a.a}:${a.b}`, wrong: `${a.a + 1}:${a.b}`, rule: 'first part + 1' };
    case 'mcq': return { right: String(a.correctIndex), wrong: String((a.correctIndex + 1) % Math.max(2, q.mcqOptions?.length || 4)), rule: 'next option' };
    case 'interval': { const r = authoredRegion(a); return r ? { right: formatRegion(r, a.variable || 'x'), wrong: formatRegion(r.map(iv => ({ lo: iv.hi === Infinity ? -Infinity : -iv.hi, hi: iv.lo === -Infinity ? Infinity : -iv.lo, loOpen: iv.hiOpen, hiOpen: iv.loOpen })), a.variable || 'x'), rule: 'reflected region' } : null; }
    case 'matrix': return Array.isArray(a.rows) ? { right: formatMatrix(a.rows), wrong: formatMatrix(a.rows.map((r, i) => r.map((v, j) => (i === 0 && j === 0 ? v + 1 : v)))), rule: 'first entry + 1' } : null;
    case 'vector': return Array.isArray(a.components) ? { right: formatVector(a.components, 'tuple'), wrong: formatVector(a.components.map(v => -v).map((v, i) => (i === 0 ? v + 1 : v)), 'tuple'), rule: 'negated, x + 1' } : null;
    case 'complex': return { right: formatComplex(a), wrong: formatComplex({ re: a.re + 1, im: a.im }), rule: 're + 1' };
    case 'working': return a.canonicalWorking ? { right: a.canonicalWorking, wrong: '1 = 2\n2 = 3', rule: 'two false lines' } : null;
    default: return null;
  }
}

// ── Draw, mark, count ────────────────────────────────────────────────────────
const byType = new Map();
const falsePositives = [];
const falseNegatives = [];
const skipped = new Map();
let questions = 0;
const ids = Object.keys(GENERATORS).sort();
for (const id of ids) {
  for (let d = 1; d <= 4; d++) {
    for (let seed = 1; seed <= DRAWS; seed++) {
      let q;
      try { q = generateQuestion(id, d, 1000 * d + seed); } catch { continue; }
      if (!q || q.multipart) continue;
      questions++;
      const p = pair(q);
      const row = byType.get(q.answerType) || { type: q.answerType, n: 0, tp: 0, fn: 0, tn: 0, fp: 0 };
      byType.set(q.answerType, row);
      if (!p) { skipped.set(q.answerType, (skipped.get(q.answerType) || 0) + 1); continue; }
      row.n++;
      const r = checkAnswer(q, p.right);
      if (r.correct) row.tp++; else { row.fn++; if (falseNegatives.length < 40) falseNegatives.push({ id, d, seed, type: q.answerType, input: p.right, feedback: r.feedback }); }
      const w = checkAnswer(q, p.wrong);
      if (!w.correct) row.tn++; else { row.fp++; if (falsePositives.length < 40) falsePositives.push({ id, d, seed, type: q.answerType, input: p.wrong, rule: p.rule }); }
    }
  }
}

// ── Equivalence classes (the authored suite, parsed) ─────────────────────────
let classTable = [];
let classSummary = '';
try {
  const out = execFileSync(process.execPath, [join(ROOT, 'client/test/marker-equivalence-classes-check.mjs')], { encoding: 'utf8' });
  classTable = [...out.matchAll(/^\s{2}(\S+)\s+(\d+) pass\s+(\d+) fail$/gm)].map(m => ({ cls: m[1], pass: Number(m[2]), fail: Number(m[3]) }));
  classSummary = (out.split('\n').find(l => l.startsWith('EQUIVALENCE CLASSES:')) || '').replace(/ — .*$/, '');
} catch (e) {
  const out = String(e.stdout || '');
  classTable = [...out.matchAll(/^\s{2}(\S+)\s+(\d+) pass\s+(\d+) fail$/gm)].map(m => ({ cls: m[1], pass: Number(m[2]), fail: Number(m[3]) }));
  classSummary = (out.split('\n').find(l => l.startsWith('EQUIVALENCE CLASSES:')) || 'EQUIVALENCE CLASSES: did not run').replace(/ — .*$/, '');
}

// ── Report ───────────────────────────────────────────────────────────────────
let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
const rows = [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
const total = rows.reduce((s, r) => ({ n: s.n + r.n, tp: s.tp + r.tp, fn: s.fn + r.fn, tn: s.tn + r.tn, fp: s.fp + r.fp }), { n: 0, tp: 0, fn: 0, tn: 0, fp: 0 });
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(2)}%` : '—');

const lines = [];
lines.push('# Engine benchmark — deterministic marker confusion table');
lines.push('');
lines.push('> **Synthetic self-consistency evidence. Not an accuracy claim.**');
lines.push('> Generated by `npm run engine:benchmark` (`scripts/engine-benchmark.mjs`) from the engine\'s own question generators, marked by the engine\'s own deterministic marker. The "right" answer is the authored answer written canonically; the "wrong" answer is derived from it by a fixed rule (next option, value + 1, reflected region, …). No student answers, no handwriting, no teacher, no human review and no physical device were involved, and nothing here measures marking accuracy on real work. The release gates (`server/test/selfcheck.mjs`, the holdout suites, `client/test/marker-*-check.mjs`) are separate and are not lowered by this report.');
lines.push('');
lines.push(`- Commit: \`${commit}\` · draws per (generator, difficulty): ${DRAWS} · generators: ${ids.length} · questions drawn: ${questions} · marked pairs: ${total.n}`);
lines.push(`- Seeds are fixed (1000·difficulty + draw), so the table is reproducible for a commit.`);
lines.push('');
lines.push('## Confusion table by answer type');
lines.push('');
lines.push('| Answer type | Pairs | Right accepted (TP) | Right refused (FN) | Wrong refused (TN) | Wrong accepted (FP) | FN rate | FP rate |');
lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) lines.push(`| ${r.type} | ${r.n} | ${r.tp} | ${r.fn} | ${r.tn} | ${r.fp} | ${pct(r.fn, r.n)} | ${pct(r.fp, r.n)} |`);
lines.push(`| **all** | **${total.n}** | **${total.tp}** | **${total.fn}** | **${total.tn}** | **${total.fp}** | **${pct(total.fn, total.n)}** | **${pct(total.fp, total.n)}** |`);
if (skipped.size) {
  lines.push('');
  lines.push(`Not paired (no canonical writing derivable from the payload): ${[...skipped.entries()].map(([t, n]) => `${t} × ${n}`).join(', ')}.`);
}
lines.push('');
lines.push('## Equivalence classes (authored suite, accepted + refused per class)');
lines.push('');
lines.push('| Class | Pass | Fail |');
lines.push('|---|---:|---:|');
for (const c of classTable) lines.push(`| ${c.cls} | ${c.pass} | ${c.fail} |`);
lines.push('');
lines.push(`\`${classSummary || 'EQUIVALENCE CLASSES: no summary line'}\` — source: \`client/test/marker-equivalence-classes-check.mjs\`.`);
lines.push('');
lines.push('## False positives (wrong answers accepted)');
lines.push('');
if (!falsePositives.length) lines.push('None in this draw.');
else {
  lines.push('| Generator | d | seed | type | wrong input accepted | derivation |');
  lines.push('|---|---:|---:|---|---|---|');
  for (const f of falsePositives) lines.push(`| ${f.id} | ${f.d} | ${f.seed} | ${f.type} | \`${String(f.input).replace(/\|/g, '\\|').replace(/\n/g, ' / ')}\` | ${f.rule} |`);
}
lines.push('');
lines.push('## False negatives (right answers refused)');
lines.push('');
if (!falseNegatives.length) lines.push('None in this draw.');
else {
  lines.push('| Generator | d | seed | type | canonical input refused | marker said |');
  lines.push('|---|---:|---:|---|---|---|');
  for (const f of falseNegatives) lines.push(`| ${f.id} | ${f.d} | ${f.seed} | ${f.type} | \`${String(f.input).replace(/\|/g, '\\|').replace(/\n/g, ' / ')}\` | ${String(f.feedback || '').replace(/\|/g, '\\|').slice(0, 120)} |`);
}
lines.push('');
lines.push('## How to read this');
lines.push('');
lines.push('- A false positive here is a wrong answer the marker called right and is release-blocking under the project\'s invariants ("wrong mathematical marking" preempts feature work); `--strict` makes this script exit non-zero on any.');
lines.push('- A false negative here is a canonical authored answer the marker refused; it is a defect in the generator\'s canonical form or the parser, and the row names the seed to reproduce it.');
lines.push('- The equivalence-class table is authored, not generated; its false-positive half (x < 2 for x > 2, 0.51 for 1/2, the conjugate, the transpose) is the part that matters most.');
lines.push('');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n'));

console.log(`ENGINE BENCHMARK: ${total.n} pairs across ${rows.length} answer types — TP ${total.tp}, FN ${total.fn}, TN ${total.tn}, FP ${total.fp} — ${classSummary || 'equivalence suite not parsed'} — written to ${OUT.replace(ROOT + '/', '')}`);
if (STRICT && (total.fp > 0)) { console.error(`ENGINE BENCHMARK: ${total.fp} false positive(s) — see the report`); process.exit(1); }
