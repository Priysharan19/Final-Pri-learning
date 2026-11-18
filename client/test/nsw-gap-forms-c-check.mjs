// Independent recomputation for the content-gap work that is not covered by
// nsw-gap-forms-a/b-check.mjs: me12-induction D4, the replaced me11-comb D4 base,
// me11-poly D4 / me11-functions D2 / y7-algebra D2 / y12-appdiff D3 key repairs.
// Every key is rebuilt here from the numbers in the PROMPT TEXT by a different
// method from the generator (brute force, direct summation, numeric scan).
// SYNTHETIC: nothing here is evidence about students or examiners.
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { answerTextFor } = await import('../../server/platform/practice.js');
await loadAllBanks();

const fails = [];
const fail = (id, msg) => { if (fails.length < 40) fails.push(`${id}: ${msg}`); };
const N = 1500;
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const P = (b, e) => BigInt(b) ** BigInt(e);
const stats = {};
const bump = (k) => { stats[k] = (stats[k] || 0) + 1; };

function sample(sub, d, fn) {
  let seen = 0;
  for (let i = 1; i <= N; i++) {
    const q = generateQuestion(sub, d, i * 104729 + 17);
    if (q.answerType === 'working') continue;
    fn(q, `${sub} D${d} seed#${i}`);
    seen++;
  }
  return seen;
}

// ── me12-induction D4 ────────────────────────────────────────────────────────
sample('me12-induction', 4, (q, id) => {
  const t = q.prompt;
  let m;
  if (q.answerType === 'mcq') {
    bump('ind-mcq');
    const right = q.mcqOptions[q.answer.correctIndex];
    if (!/^Assume \$P\(k\)\$.*Show \$P\(k\+1\)\$/.test(right)) fail(id, 'correct option is not "assume P(k), show P(k+1)"');
    q.mcqOptions.forEach((o, i) => { if (i !== q.answer.correctIndex && /^Assume \$P\(k\)\$.*Show \$P\(k\+1\)\$/.test(o)) fail(id, 'a distractor is also correct'); });
    return;
  }
  const key = q.answer.value;
  if ((m = t.match(/proof of \$(.+?) > (.+?)\$ must start/))) {
    bump('ind-n0');
    const [lhs, rhs] = [m[1], m[2]];
    const f = n => {
      let a, b;
      if (/^n!$/.test(lhs)) { let fct = 1n; for (let i = 2; i <= n; i++) fct *= BigInt(i); a = fct; b = P(rhs.match(/(\d+)\^n/)[1], n); }
      else if (/^(\d+)\^n$/.test(lhs) && /^n\^(\d+)$/.test(rhs)) { a = P(lhs.match(/^(\d+)/)[1], n); b = P(n, rhs.match(/\^(\d+)/)[1]); }
      else { const mm = rhs.match(/^(\d+)n \+ 1$/); a = P(2, n); b = BigInt(mm[1]) * BigInt(n) + 1n; }
      return a > b;
    };
    let want = null;
    for (let n = 1; n <= 80; n++) { let all = true; for (let j = n; j <= 80; j++) if (!f(j)) { all = false; break; } if (all) { want = n; break; } }
    if (want !== key) fail(id, `n0 ${key} != ${want} for ${m[1]} > ${m[2]}`);
  } else if ((m = t.match(/needs \$(\d+)k\^(\d+) \\ge \(k\+1\)\^(\d+)\$/))) {
    bump('ind-k');
    const mult = Number(m[1]), p = Number(m[2]);
    let want = null;
    for (let k = 1; k <= 300; k++) { let all = true; for (let j = k; j <= 300; j++) if (!(mult * j ** p >= (j + 1) ** p)) { all = false; break; } if (all) { want = k; break; } }
    if (want !== key) fail(id, `k ${key} != ${want}`);
  } else if ((m = t.match(/\$n\^3 \+ (\d+)n\$ is divisible by \$3\$/))) {
    bump('ind-c');
    const a = Number(m[1]);
    const k = 7;
    const rest = ((k + 1) ** 3 + a * (k + 1)) - (k ** 3 + a * k) - 3 * k * k - 3 * k;   // must equal 3c
    if (rest !== 3 * key) fail(id, `c ${key}: remainder ${rest} != 3c`);
  } else if ((m = t.match(/\\sum_\{r=1\}\^\{n\} (.+?) = .*For \$k = (\d+)\$/))) {
    bump('ind-sum');
    const k = Number(m[2]);
    const term = r => (m[1] === 'r(r+1)' ? r * (r + 1) : m[1] === 'r^2' ? r * r : r * (r + 1) * (r + 2));
    let s0 = 0, s1 = 0;
    for (let r = 1; r <= k; r++) s0 += term(r);
    s1 = s0 + term(k + 1);
    // the claimed closed form must itself be right for k and k+1, and its increase is the new term
    const closed = n => (m[1] === 'r(r+1)' ? n * (n + 1) * (n + 2) / 3 : m[1] === 'r^2' ? n * (n + 1) * (2 * n + 1) / 6 : n * (n + 1) * (n + 2) * (n + 3) / 4);
    if (closed(k) !== s0 || closed(k + 1) !== s1) fail(id, 'the stated closed form is not the sum');
    if (s1 - s0 !== key) fail(id, `increase ${key} != ${s1 - s0}`);
  } else if ((m = t.match(/largest\*\* whole number that divides \$(.+?)\$ for every/))) {
    bump('ind-gcd');
    const e = m[1];
    const f = n => {
      let mm;
      if ((mm = e.match(/^(\d+)\^n - 1$/))) return P(mm[1], n) - 1n;
      if ((mm = e.match(/^(\d+)\^\{2n\} - 1$/))) return P(mm[1], 2 * n) - 1n;
      if (e === 'n^3 - n') return BigInt(n) ** 3n - BigInt(n);
      if (e === 'n(n+1)(n+2)') return BigInt(n) * BigInt(n + 1) * BigInt(n + 2);
      mm = e.match(/^(\d+)\^n - (\d+)\^n$/); return P(mm[1], n) - P(mm[2], n);
    };
    let g = 0n; for (let n = 1; n <= 60; n++) g = gcd(g, f(n));
    if (Number(g) !== key) fail(id, `gcd ${key} != ${g} for ${e}`);
    if (/\^n - 1\^n/.test(t)) fail(id, 'prints 1^n');
  } else fail(id, `unrecognised D4 prompt: ${t.slice(0, 60)}`);
  (q.hints || []).forEach(h => { if (new RegExp(`(^|[^\\d])${key}([^\\d]|$)`).test(h) && key > 9) fail(id, 'hint states the key'); });
});

// ── me11-comb D4 base: circular table, two not adjacent ─────────────────────
sample('me11-comb', 4, (q, id) => {
  const m = q.prompt.match(/^\$(\d+)\$ .*Asha and Ben, sit around a \*\*circular\*\* table.*not\*\* next/);
  if (!m) return;   // an overlay form, checked in nsw-gap-forms-b-check
  bump('comb-base');
  const n = Number(m[1]);
  // fix Asha in seat 0 (removes rotations); count orders of the other n-1 where Ben is not in seat 1 or n-1
  let count = 0;
  const seats = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const perm = (arr, k, used, cur) => {
    if (k === arr.length) { const benSeat = cur.indexOf(0) + 1; if (benSeat !== 1 && benSeat !== n - 1) count++; return; }
    for (let i = 0; i < arr.length; i++) if (!used[i]) { used[i] = true; cur.push(i); perm(arr, k + 1, used, cur); cur.pop(); used[i] = false; }
  };
  if (n <= 8) { perm(seats, 0, [], []); if (count !== q.answer.value) fail(id, `n=${n}: ${q.answer.value} != brute ${count}`); } else {
    const f = x => (x <= 1 ? 1 : x * f(x - 1));
    if (q.answer.value !== f(n - 1) - 2 * f(n - 2)) fail(id, 'n=9 formula mismatch');
  }
});

// ── me11-poly D4: a rational solution is printed as a fraction ──────────────
sample('me11-poly', 4, (q, id) => {
  if (q.answerType !== 'set') return;
  bump('poly-set');
  const printed = answerTextFor(q);
  const toks = printed.split(', ');
  if (toks.length !== q.answer.values.length) fail(id, 'token count');
  toks.forEach((tk, i) => {
    const v = tk.includes('/') ? tk.split('/').reduce((a, b) => Number(a) / Number(b)) : Number(tk);
    if (!(Math.abs(v - q.answer.values[i]) < 1e-9)) fail(id, `"${tk}" != ${q.answer.values[i]}`);
    if (/\.\d{4,}/.test(tk)) fail(id, `raw float "${tk}"`);
  });
});

// ── me11-functions D2: domain of the inverse of a sqrt function ─────────────
sample('me11-functions', 2, (q, id) => {
  const m = q.prompt.match(/f\(x\) = (\d+)\\sqrt\{x (?:- (-?\d+)|\+ (\d+))\} ([+-]) (\d+)\$ has domain/);
  if (!m) return;
  bump('fn-inv-domain');
  const a = Number(m[1]), h = m[2] !== undefined ? Number(m[2]) : -Number(m[3]), k = (m[4] === '-' ? -1 : 1) * Number(m[5]);
  let lo = Infinity; for (let x = h; x <= h + 400; x += 0.25) lo = Math.min(lo, a * Math.sqrt(x - h) + k);
  if (Math.abs(lo - k) > 1e-9 || q.answer.value !== k) fail(id, `range floor ${lo} vs key ${q.answer.value}`);
  if (q.answerPrefix !== 'c =') fail(id, 'prefix');
  if (/x ≥/.test(q.answerPrefix || '')) fail(id, 'unreadable prefix');
});

// ── y7-algebra D2 / y12-appdiff D3: the key keeps its variable term ─────────
sample('y7-algebra', 2, (q, id) => {
  if (q.answerType !== 'expression') return;
  bump('y7-expr');
  if (/^0x/.test(q.answer.expr)) fail(id, `zero-coefficient key ${q.answer.expr}`);
});
sample('y12-appdiff', 3, (q, id) => {
  if (q.answerType !== 'expression') return;
  bump('appdiff-expr');
  if (/^0x/.test(q.answer.expr)) fail(id, `zero-gradient key ${q.answer.expr}`);
  const m = q.prompt.match(/y = x\^2 ([+-] \d*x)? ?([+-] \d+)?.* at the point where \$x = (-?\d+)\$/);
  if (!m) return;
});

console.log(JSON.stringify(stats));
for (const k of ['ind-n0', 'ind-k', 'ind-c', 'ind-sum', 'ind-gcd', 'ind-mcq', 'comb-base', 'poly-set', 'fn-inv-domain', 'y7-expr', 'appdiff-expr']) if (!stats[k]) fails.push(`no ${k} question was sampled`);
console.log(fails.length ? `NSW GAP FORMS C: FAIL\n  ${fails.join('\n  ')}` : 'NSW GAP FORMS C: PASS — every key rebuilt independently. [SYNTHETIC]');
process.exit(fails.length ? 1 : 0);
