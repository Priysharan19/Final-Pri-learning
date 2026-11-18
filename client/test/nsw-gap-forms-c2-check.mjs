// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · me12-calc (Further Calculus) integration-by-substitution forms C2:
// independent answer check. The integrand is parsed back out of the prompt text and
// every key is re-derived by a different method: definite integrals by composite
// Simpson on the ORIGINAL integrand in x (4000 intervals); indefinite answers by
// central-difference differentiation of the printed key (constant offsets allowed).
// Keys and traps are also run through the deterministic marker. SYNTHETIC checks only.
// Usage: node client/test/nsw-gap-forms-c2-check.mjs [seeds]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
await loadAllBanks();

const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 1200;
let failures = 0;
const fails = [];
const fail = (cell, seed, msg, q) => { failures++; if (fails.length < 40) fails.push(`${cell} seed ${seed}: ${msg}${q ? `\n    ${String(q.prompt).slice(0, 220)}` : ''}`); };
const hasBad = o => /undefined|NaN|\[object|Infinity/.test(JSON.stringify(o));
const skeleton = p => String(p).replace(/\d+/g, '#').slice(0, 40);
const num = s => (s === '' || s === undefined ? 1 : Number(s));

// ── evaluate a printed key / trap expression (our own syntax) as a JS function of x
function toFn(expr) {
  const js = expr.replace(/-x\^(\d+)/g, '-(x**$1)').replace(/\^/g, '**').replace(/sqrt\(/g, 'Math.sqrt(').replace(/\bln\(/g, 'Math.log(')
    .replace(/\bsin\(/g, 'Math.sin(').replace(/\bcos\(/g, 'Math.cos(').replace(/\be\*\*\(/g, 'Math.exp(');
  return new Function('x', `return ${js};`);
}
const simpson = (f, a, b, n = 4000) => {
  const h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
};
const sgnNum = (sign, d) => (sign === '-' ? -Number(d) : Number(d));
const PI = Math.PI;
const piOf = t => (t === '2' ? PI / 2 : t === '6' ? PI / 6 : PI / 3);

// ── parse prompt -> { kind, f (integrand), lo, hi } ─────────────────────────────
function parse(p) {
  let m;
  const def = /\\int_/.test(p);
  if (!def) {
    if ((m = p.match(/u = x ([+-]) (\d+)\$ to find.*?x\\,\(x [+-] \d+\)\^\{(\d+)\}/))) { const k = sgnNum(m[1], m[2]), n = Number(m[3]); return { kind: 'D1-shift', f: x => x * (x + k) ** n, dom: [-k + 0.3, 4] }; }
    if ((m = p.match(/\\frac\{(\d*)x\}\{x\^2 \+ (\d+)\}/))) { const a = num(m[1]), c = Number(m[2]); return { kind: 'D1-log', f: x => a * x / (x * x + c), dom: [0.2, 3] }; }
    if ((m = p.match(/int (\d*)x\\,e\^\{(-?\d*)x\^2\}/))) { const a = num(m[1]); const k = m[2] === '' ? 1 : m[2] === '-' ? -1 : Number(m[2]); return { kind: 'D1-exp', f: x => a * x * Math.exp(k * x * x), dom: [0.1, 1.2] }; }
    if ((m = p.match(/int (\d*)\\(sin|cos)\^\{(\d+)\}x\\,\\(cos|sin) x/))) { const a = num(m[1]), n = Number(m[3]); const A = m[2] === 'sin' ? Math.sin : Math.cos, B = m[4] === 'cos' ? Math.cos : Math.sin; return { kind: `D1-trig-${m[2]}`, f: x => a * A(x) ** n * B(x), dom: [0.2, 1.4] }; }
    if ((m = p.match(/\\frac\{(\d*)\(\\sqrt\{x\} \+ (\d+)\)\^\{(\d+)\}\}\{\\sqrt\{x\}\}/))) { const a = num(m[1]), c = Number(m[2]), n = Number(m[3]); return { kind: 'D1-sqrt', f: x => a * (Math.sqrt(x) + c) ** n / Math.sqrt(x), dom: [0.3, 5] }; }
    return null;
  }
  if ((m = p.match(/int_\{(\d+)\}\^\{(\d+)\} x\\,\(x ([+-]) (\d+)\)\^\{(\d+)\}/))) { const k = sgnNum(m[3], m[4]), n = Number(m[5]); return { kind: 'D2-shift', f: x => x * (x + k) ** n, lo: Number(m[1]), hi: Number(m[2]) }; }
  if ((m = p.match(/int_0\^\{\\frac\{\\pi\}\{(\d)\}\} (\d*)\\(sin|cos)\^\{(\d+)\}x\\,\\(cos|sin) x/))) { const a = num(m[2]), n = Number(m[4]); const A = m[3] === 'sin' ? Math.sin : Math.cos, B = m[5] === 'cos' ? Math.cos : Math.sin; return { kind: `D2-trig-${m[3]}`, f: x => a * A(x) ** n * B(x), lo: 0, hi: piOf(m[1]) }; }
  if ((m = p.match(/int_0\^\{(\d+)\} \\frac\{(\d*)x\}\{\(x\^2 \+ (\d+)\)\^\{(\d+)\}\}/))) { const a = num(m[2]), c = Number(m[3]), n = Number(m[4]); return { kind: 'D2-negpow', f: x => a * x / (x * x + c) ** n, lo: 0, hi: Number(m[1]) }; }
  if ((m = p.match(/int_\{1\}\^\{e\^\{(\d+)\}\} \\frac\{(\d*)\(\\ln x\)\^\{(\d+)\}\}\{x\}/))) { const k = Number(m[1]), a = num(m[2]), n = Number(m[3]); return { kind: 'D2-ln', f: x => a * Math.log(x) ** n / x, lo: 1, hi: Math.exp(k) }; }
  if ((m = p.match(/int_\{(\d+)\}\^\{(\d+)\} \\frac\{(\d*)\(\\sqrt\{x\} \+ (\d+)\)\^\{(\d+)\}\}\{\\sqrt\{x\}\}/))) { const a = num(m[3]), c = Number(m[4]), n = Number(m[5]); return { kind: 'D2-sqrt', f: x => a * (Math.sqrt(x) + c) ** n / Math.sqrt(x), lo: Number(m[1]), hi: Number(m[2]) }; }
  return null;
}

const keyText = q => (q.answerType === 'expression' ? q.answer.expr : (q.answer.canonicalInput || String(q.answer.value)));
const fracVal = s => { const [a, b] = String(s).split('/').map(Number); return b ? a / b : a; };

// derivative of g matches f at several x (constant offset irrelevant)
function derivMatches(g, f, dom) {
  for (let i = 0; i < 7; i++) {
    const x = dom[0] + (dom[1] - dom[0]) * (i + 0.5) / 7, h = 1e-5;
    const d = (g(x + h) - g(x - h)) / (2 * h), t = f(x);
    if (!(Math.abs(d - t) <= 1e-5 * Math.max(1, Math.abs(t)))) return false;
  }
  return true;
}

const cells = {};
function sweep(diff) {
  const cell = `me12-calc D${diff}`;
  const forms = new Map(), skels = new Set(); let n = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let q;
    try { q = generateQuestion('me12-calc', diff, seed * 7919 + 13); } catch (e) { fail(cell, seed, `generator threw ${e.message}`); continue; }
    if (q.dotpointSource !== 'payload') continue;       // the established base form is tested elsewhere
    n++;
    skels.add(skeleton(q.prompt));
    const P = parse(q.prompt);
    if (!P) { fail(cell, seed, 'unrecognised prompt form', q); continue; }
    forms.set(P.kind, (forms.get(P.kind) || 0) + 1);
    if (hasBad(q)) fail(cell, seed, 'undefined/NaN in question', q);
    if ((q.hints || []).length < 3 || (q.steps || []).length < 3) fail(cell, seed, 'need 3 hints and >= 3 steps', q);
    if (q.dotpoint !== 'me12-calc.1' && q.dotpoint !== 'me12-calc.0' && !/0|1/.test(String(q.dotpoint))) fail(cell, seed, `dot point ${q.dotpoint}`, q);
    const key = keyText(q);
    let v; try { v = checkAnswer(q, key); } catch (e) { v = { correct: false, feedback: e.message }; }
    if (!v.correct) fail(cell, seed, `marker refused its own key "${key}": ${v.feedback || ''}`, q);
    // hints never print the key
    for (const h of q.hints || []) if (key.length > 2 && h.replace(/\s/g, '').includes(key.replace(/\s/g, ''))) fail(cell, seed, `hint states the key: ${h}`, q);
    if (q.answerType === 'expression') {
      if (diff !== 1) fail(cell, seed, 'expression at D2', q);
      if (!derivMatches(toFn(key), P.f, P.dom)) fail(cell, seed, `d/dx of key "${key}" is not the integrand`, q);
      for (const t of q.traps || []) {
        if (derivMatches(toFn(t.expr), P.f, P.dom)) fail(cell, seed, `trap "${t.expr}" is also a correct antiderivative`, q);
        let tv; try { tv = checkAnswer(q, t.expr); } catch { tv = { correct: false }; }
        if (tv.correct) fail(cell, seed, `marker accepts trap ${t.expr}`, q);
      }
      for (const h of q.hints) if (/\+\s*C\s*\$?$/.test(h) && /=/.test(h) && h.length > 0 && /\\frac\{d/.test(h) === false && false) fail(cell, seed, 'x', q);
    } else {
      if (diff !== 2) fail(cell, seed, 'numeric at D1', q);
      const ref = simpson(P.f, P.lo, P.hi);
      if (Math.abs(ref - q.answer.value) > 1e-7 * Math.max(1, Math.abs(ref))) fail(cell, seed, `Simpson ${ref} != key ${q.answer.value}`, q);
      if (Math.abs(fracVal(q.answer.canonicalInput) - ref) > 1e-7 * Math.max(1, Math.abs(ref))) fail(cell, seed, `canonicalInput ${q.answer.canonicalInput} != Simpson ${ref}`, q);
      if (!q.answer.requireExact) fail(cell, seed, 'not requireExact', q);
      if (!(q.traps || []).length) fail(cell, seed, 'no traps', q);
      for (const t of q.traps || []) {
        if (Math.abs(t.value - ref) < 1e-3) fail(cell, seed, `trap equals key ${t.value}`, q);
        let tv; try { tv = checkAnswer(q, String(t.value)); } catch { tv = { correct: false }; }
        if (tv.correct) fail(cell, seed, `marker accepts trap ${t.value}`, q);
      }
      const fs = [q.answer.canonicalInput, new RegExp('x').test('') ? '' : (() => { const [a, b] = q.answer.canonicalInput.split('/'); return b ? `\\frac{${a}}{${b}}` : a; })()];
      for (const h of q.hints) for (const f of fs) { if (f && f.length >= 2 && new RegExp(`(?<![xu]\\s)=\\s*${f.replace(/[\\{}]/g, '\\$&')}(?![\\d.}]|\\s*\\\\to)`).test(h)) fail(cell, seed, `hint states the value ${f}: ${h}`, q); }
    }
  }
  cells[cell] = { n, forms: forms.size, skels: skels.size, detail: [...forms].map(([k, v]) => `${k}:${v}`).join(' ') };
  if (forms.size < 5) fail(cell, 0, `only ${forms.size} distinct forms (need >= 5)`);
  if (skels.size < 5) fail(cell, 0, `only ${skels.size} prompt skeletons (need >= 5)`);
  if (n < SEEDS * 0.4) fail(cell, 0, `only ${n} payload draws of ${SEEDS}`);
}
sweep(1); sweep(2);
for (const [k, v] of Object.entries(cells)) console.log(`${k}: payload draws ${v.n}, forms ${v.forms}, skeletons ${v.skels}\n   ${v.detail}`);
if (failures) { console.log(`FAIL (${failures})`); console.log(fails.join('\n')); process.exit(1); }
console.log('PASS');
