// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · an answer is shown as typeset maths, never as engine notation
//
// "Expected: 2*x^8" and "Final answer 2*x^8 + -8*x" are a program talking. This
// suite pins client/src/engine/answerTex.js: engine notation becomes TeX, and
// anything it is not sure is one plain expression (units, words, lists, an
// answer already marked up) is left exactly as it was. It then sweeps every
// answer Prithagoras can show — every issued NSW cell, many seeds — and holds
// the whole set to: no engine notation survives ("*", "^", "+ -" outside TeX),
// every $…$ segment parses in KaTeX, and nothing is ever lost or invented
// (the TeX evaluates to the same function as the answer).
// ─────────────────────────────────────────────────────────────────────────────
import katex from 'katex';
const SRC = new URL('../src/', import.meta.url).href;
const { answerToTex } = await import(`${SRC}engine/answerTex.js`);
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { NSW_ISSUED_CELLS } = await import(`${SRC}engine/nswIssuedCells.js`);
const { answerTextFor } = await import('../../server/platform/practice.js');
await loadAllBanks();

let pass = 0;
const failures = [];
const eq = (name, actual, expected) => { if (actual === expected) pass++; else failures.push(`${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };

// ── Authored cases ──────────────────────────────────────────────────────────
for (const [text, tex] of [
  ['2*x^8 + -8*x', '$2x^{8} - 8x$'],
  ['(x + 2)(x + -7)', '$\\left(x + 2\\right)\\left(x - 7\\right)$'],
  ['9*e^(2*x)', '$9e^{2x}$'],
  ['1*x^2', '$x^{2}$'],
  ['-18x^1', '$-18x$'],
  ['12(2x + -6)^5', '$12\\left(2x - 6\\right)^{5}$'],
  ['sqrt(3)', '$\\sqrt{3}$'],
  ['3/4', '$\\frac{3}{4}$'],
  ['(x - 1)/(x + 2)', '$\\frac{x - 1}{x + 2}$'],
  ['4x^3 + -15x^2', '$4x^{3} - 15x^{2}$'],
  ['2*pi*r', '$2 \\cdot \\pi r$'],
  ['2*3^x', '$2 \\cdot 3^{x}$'],
  ['2*10^3', '$2 \\cdot 10^{3}$'],
  ['3*2^(n-1)', '$3 \\cdot 2^{n - 1}$'],
  ['x*2^n', '$x \\cdot 2^{n}$']
]) eq(`typeset ${text}`, answerToTex(text), tex);
for (const text of ['6', '-2.5', '6 % p.a.', 'Δ = 97', 'x ≥ -1', '$x^2$', '1.5 cm', '(-3, 4)', 'Reflection in the x-axis', '3 : 5', '2, -3', '']) {
  eq(`left alone: ${JSON.stringify(text)}`, answerToTex(text), text);
}
eq('nothing is invented from null', answerToTex(null), '');

// ── Every answer Prithagoras can show ───────────────────────────────────────
const engine = /\*|\^|\+\s*-/;
let shown = 0, typeset = 0, bad = 0;
for (const [generator, levels] of Object.entries(NSW_ISSUED_CELLS)) {
  for (const d of levels) for (let i = 0; i < 12; i++) {
    let q;
    try { q = generateQuestion(generator, d, ((i + 1) * 2654435761 + d * 40503 + generator.length * 97) >>> 0 & 0x7fffffff); } catch { continue; }
    const text = String(answerTextFor(q) ?? '');
    if (!text || q.answerType === 'mcq') continue;
    shown++;
    const out = answerToTex(text);
    if (out !== text) typeset++;
    const outside = out.replace(/\$[^$]*\$/g, '');
    if (out === text && engine.test(text) && !/\$/.test(text) && /^[\dxyzabcnt+\-*/^().\s e]*$/i.test(text) && !/^[\d\s.,-]+$/.test(text)) { bad++; failures.push(`${generator} D${d}: engine notation survives: ${JSON.stringify(text)}`); }
    if (engine.test(outside) && out !== text) { bad++; failures.push(`${generator} D${d}: engine notation outside TeX: ${JSON.stringify(out)}`); }
    for (const span of out.match(/\$[^$]*\$/g) || []) {
      try { katex.renderToString(span.slice(1, -1), { throwOnError: true, strict: false }); } catch (err) { bad++; failures.push(`${generator} D${d}: ${span} does not parse: ${String(err.message).slice(0, 80)}`); }
    }
  }
}
if (!bad) pass++; else failures.push(`${bad} answers broke the rules above`);
if (shown > 500 && typeset > 100) pass++; else failures.push(`the sweep saw ${shown} answers and typeset ${typeset}`);

console.log(failures.length
  ? `ANSWER TEX: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`
  : `ANSWER TEX: PASS — ${pass} checks — engine notation becomes typeset maths, units/words/lists are left alone; ${typeset} of ${shown} issued answers typeset, all parse in KaTeX. [SYNTHETIC]`);
process.exit(failures.length ? 1 : 0);
