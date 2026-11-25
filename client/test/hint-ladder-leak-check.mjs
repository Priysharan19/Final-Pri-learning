// Pri Learning · no hint rung states the final answer (launch QA 2026-11-26, SHOULD FIX 2).
// The input-hint check covers the answer-field placeholder only. This one builds the real four-rung ladder
// (engine/hintLadder.js, the object the server serves) for every generator the Prithagoras server issues, at every
// issued difficulty, over many seeds, and fails when a rung before the solution rung
//   (a) states a number equal to the key, in any form (statesAnswerValue), or the key's text (containsAnswer), or
//   (b) is a bare restatement the prompt itself does not print, using the same rephrasing rules as the form checks.
// SYNTHETIC: generated questions, no evidence about students. Usage: node client/test/hint-ladder-leak-check.mjs [seeds]
import { readFileSync } from 'node:fs';
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { NSW_ISSUED_CELLS } from '../src/engine/nswIssuedCells.js';
import { buildHintLadder, rungGivesAnswer } from '../src/engine/hintLadder.js';
import { evalNumeric, normalize } from '../src/engine/expr.js';

await loadAllBanks();
const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 60;

const keyNumbers = q => {
  const a = q?.answer || {}, out = [];
  if (Number.isFinite(a.value)) out.push(a.value);
  if (a.simplestFraction && Number(a.simplestFraction.d)) out.push(Number(a.simplestFraction.n) / Number(a.simplestFraction.d));
  if (Array.isArray(a.values)) for (const v of a.values) if (Number.isFinite(v)) out.push(v);
  if (typeof a.canonicalInput === 'string') { try { out.push(evalNumeric(normalize(a.canonicalInput))); } catch { /* not numeric */ } }
  return out.filter(Number.isFinite);
};
const quoted = (q, n) => new RegExp(`(?<![\\d.])${String(n).replace(/[.\-]/g, '\\$&')}(?!\\d|\\.\\d)`).test(String(q.prompt).replace(/\$/g, ' '));

/** Three independent readings of "this rung states the answer": the engine's own rule, the form checks' phrase rule, and the numeric-value rule. */
export function ladderLeaks(q) {
  const out = [];
  if (!q || q.multipart || q.placement || q.custom) return out;
  const values = keyNumbers(q).filter(v => !quoted(q, v));
  const finals = values.map(String);
  for (const r of buildHintLadder(q, { withholdAnswer: true })) {
    if (r.rung === 'solution' || !r.text) continue;
    if (rungGivesAnswer(q, r.text)) out.push(`${r.rung}: ${r.text}`);
    else if (finals.some(f => new RegExp(`(?:=|\\bis\\b|\\bgives\\b|\\bequals\\b|\\bso\\b|\\banswer\\b)\\s*\\$?\\s*${f.replace(/[.\-]/g, '\\$&')}(?!\\d|\\.\\d)\\s*\\$?\\s*(?:[.,;]|$)`).test(r.text.replace(/\\(?:left|right|,)/g, '')))) out.push(`${r.rung}: (phrase) ${r.text}`);
  }
  return out;
}

export function ladderLeakSelfTest() {
  const q = { prompt: 'Find the mean of a binomial with $n = 4$, $p = 0.7$.', answerType: 'numeric', answer: { value: 2.8 },
    steps: [{ h: 'Use np', d: '$E(X) = np = 4 \\times 0.7 = 2.8$' }, { h: 'State it', d: 'The mean is 2.8' }], hints: ['Mean of a binomial: $np$.'] };
  const errors = [];
  if (rungGivesAnswer(q, '$E(X) = np = 4 \\times 0.7 = 2.8$') === false) errors.push('a worked chain ending in the key was not caught');
  if (rungGivesAnswer(q, '$4 \\times 0.7$') === false) errors.push('the one trivial step was not caught');
  if (rungGivesAnswer(q, 'Mean of a binomial: $np$.')) errors.push('a method line was flagged');
  if (ladderLeaks(q).length) errors.push(`the built ladder still leaks: ${ladderLeaks(q).join(' | ')}`);
  // The server's hint route is the only place a rung is served; it must ask for the guard on the Prithagoras edition.
  const route = readFileSync(new URL('../../server/platform/practice.js', import.meta.url), 'utf8');
  if (!/buildHintLadder\(q, \{ withholdAnswer: serverEdition\(env\) === 'prithagoras' \}\)/.test(route)) errors.push('the hint route does not withhold the answer on the Prithagoras edition');
  return errors;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const selfErrors = ladderLeakSelfTest();
  if (selfErrors.length) { console.log(`HINT LADDER LEAK: FAIL, self-test: ${selfErrors.join('; ')}`); process.exit(1); }
  // Launch QA 26 Nov 2026 (14): "(each term × \\frac{1}{3})" had its TeX outside the dollar signs and would show raw. No hint or
  // solution step of any issued question carries a TeX command outside $...$.
  const rawTex = [];
  for (const [id, levels] of Object.entries(NSW_ISSUED_CELLS)) for (const d of levels) for (let seed = 1; seed <= SEEDS; seed++) {
    let q; try { q = generateQuestion(id, d, seed * 7919 + d); } catch { continue; }
    if (!q) continue;
    for (const text of [...(q.hints || []), ...(q.steps || []).flatMap(st => [st.h, st.d])]) {
      if (typeof text === 'string' && /\\[A-Za-z]{2,}/.test(text.replace(/\\\$/g, '#').replace(/\$[^$]*\$/g, ' '))) { rawTex.push(`${id} d${d} seed ${seed * 7919 + d}: ${text.slice(0, 120)}`); break; }
    }
  }
  if (rawTex.length) { console.log(`HINT LADDER LEAK: FAIL, ${rawTex.length} hints or steps carry TeX outside the dollar signs\n  · ${[...new Set(rawTex)].slice(0, 12).join('\n  · ')}`); process.exit(1); }
  const bad = new Map();
  let questions = 0, rungs = 0;
  for (const [id, levels] of Object.entries(NSW_ISSUED_CELLS)) {
    for (const d of levels) for (let seed = 1; seed <= SEEDS; seed++) {
      let q; try { q = generateQuestion(id, d, seed * 7919 + d); } catch { continue; }
      if (!q) continue;
      questions++; rungs += 3;
      for (const m of ladderLeaks(q)) { const k = `${id}`; if (!bad.has(k)) bad.set(k, []); bad.get(k).push(`d${d} seed ${seed * 7919 + d} ${m}`); }
    }
  }
  if (questions < 5000) { console.log(`HINT LADDER LEAK: FAIL, the scan did not reach the bank (${questions} questions)`); process.exit(1); }
  const total = [...bad.values()].reduce((s, v) => s + v.length, 0);
  if (total) {
    console.log(`HINT LADDER LEAK: FAIL, ${total} leaking rungs in ${bad.size} generators`);
    for (const [id, v] of [...bad].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${id} (${v.length}): ${v[0].slice(0, 220)}`);
    process.exit(1);
  }
  console.log(`HINT LADDER LEAK: PASS, ${rungs} rungs over ${questions} questions across ${Object.keys(NSW_ISSUED_CELLS).length} generators, none states the answer, and no hint or step carries raw TeX`);
}
