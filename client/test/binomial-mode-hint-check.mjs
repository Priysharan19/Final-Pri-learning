// Pri Learning · the binomial-mode hint ladder never states (n+1)p.
//
// Regression: me12-binomial-forms (difficulty 4) "which value of X is the most likely" had a hint rung that wrote
// (n+1)p = 148.75 when the key is 148, so the rung gave the answer ("the whole number just below it"). The rungs may name n+1 and p, but no
// rung may state the product, and no rung may be a correct answer. Fixed seeds, deterministic, SYNTHETIC.
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { checkAnswer } from '../src/engine/checker.js';

await loadAllBanks();
let drawn = 0;
const failures = [];
const numbersIn = text => (String(text).match(/\d+(?:\.\d+)?/g) || []).map(Number);
for (let difficulty = 1; difficulty <= 4; difficulty++) {
  for (let seed = 1; seed <= 400; seed++) {
    let q; try { q = generateQuestion('me12-binomial-forms', difficulty, seed); } catch { continue; }
    const m = q && /^\$X \\sim \\text\{Bin\}\((\d+), ([\d.]+)\)\$\. Which value of \$X\$ is the most likely/.exec(q.prompt);
    if (!m) continue;
    drawn++;
    const n = Number(m[1]), p = Number(m[2]);
    const product = (n + 1) * p;
    const where = `d${difficulty} seed ${seed} Bin(${n}, ${p})`;
    for (const hint of q.hints || []) {
      const stated = numbersIn(hint.replace(/\$n\+1 = \d+\$/g, '').replace(/\$p = [\d.]+\$/g, ''));
      if (stated.some(v => Math.abs(v - product) < 1e-9)) failures.push(`${where}: a hint states (n+1)p = ${product}: "${hint}"`);
      if (/=\s*\d+(?:\.\d+)?\s*\$/.test(hint) && /\(n ?\+ ?1\)\s*p|\(\d+\s*\+\s*1\)/.test(hint)) failures.push(`${where}: a hint writes (n+1)p as an equation: "${hint}"`);
      if (checkAnswer(q, hint.replace(/\$/g, ''))?.correct === true) failures.push(`${where}: a hint is the correct answer: "${hint}"`);
    }
    if (!numbersIn(q.hints.join(' ')).includes(n + 1)) failures.push(`${where}: the ladder no longer names n+1`);
  }
}
if (drawn < 50) failures.push(`only ${drawn} mode questions were drawn`);
console.log(failures.length ? `BINOMIAL MODE HINT: FAIL\n  · ${failures.slice(0, 10).join('\n  · ')}` : `BINOMIAL MODE HINT: PASS - ${drawn} mode questions, no rung states (n+1)p`);
process.exit(failures.length ? 1 : 0);
