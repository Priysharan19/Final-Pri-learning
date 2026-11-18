// Pri Learning · index-law slips: products of powers, a power of a power, a
// power of a product, and the surd sum. A detector names a slip only when it
// explains the broken line exactly (poly.js), using the question's own numbers.
// Feedback only; no status, mark or first break moves.
import { registerTopic } from './registry.js';
import { parse, normalize, evaluate } from '../../expr.js';
import { resetPolyBudget, sameAsPrevious, fmt, polyEqual, polyFromAst, polyOfText, productFactors, unwrap } from './poly.js';

const astOf = text => {
  const s = String(text ?? '').replace(/[−–—]/g, '-').trim();
  const body = s.includes('=') ? s.split('=').pop() : s;
  try { return parse(normalize(body)); } catch { return null; }
};
const num = n => { const u = unwrap(n); if (u?.t === 'num') return u.v; if (u?.t === 'neg' && unwrap(u.v)?.t === 'num') return -unwrap(u.v).v; return null; };
const monomial = p => (p && p.size === 1 ? [...p.values()][0] : null);

/** One factor as { coef, exps, outer }: (coef · Πv^e)^outer, or null when it is not that shape. */
function powerFactor(node) {
  const n = unwrap(node);
  let base = n, outer = 1;
  if (n?.t === 'bin' && n.op === '^' && unwrap(n.l)?.t === 'bin' && unwrap(n.l).op === '*') {
    const k = num(n.r);
    if (k === null || !Number.isInteger(k)) return null;
    base = unwrap(n.l); outer = k;
  }
  const m = monomial(polyFromAst(base));
  if (!m) return null;
  // `(x^5)^2`: a power of a power is written as ^ of a ^.
  if (n?.t === 'bin' && n.op === '^' && unwrap(n.l)?.t === 'bin' && unwrap(n.l).op === '^') {
    const k = num(n.r);
    const inner = monomial(polyFromAst(unwrap(n.l)));
    if (k === null || !Number.isInteger(k) || !inner) return null;
    return { coef: inner.c, exps: inner.e, outer: k, power: true };
  }
  if (n?.t === 'bin' && n.op === '^' && outer === 1) {
    const k = num(n.r);
    const inner = unwrap(n.l);
    if (k !== null && Number.isInteger(k) && inner?.t === 'bin' && inner.op === '*') { const mm = monomial(polyFromAst(inner)); if (mm) return { coef: mm.c, exps: mm.e, outer: k, power: true }; }
  }
  return { coef: m.c, exps: m.e, outer, power: outer !== 1 };
}

function build(coef, exps) {
  const e = {}; for (const v of Object.keys(exps)) if (exps[v]) e[v] = exps[v];
  const key = Object.keys(e).sort().map(v => `${v}^${e[v]}`).join('*');
  return Math.abs(coef) < 1e-12 ? new Map() : new Map([[key, { c: coef, e }]]);
}

function indexSlips(ctx) {
  const prevAst = astOf(ctx.previous);
  const line = polyOfText(ctx.line);
  if (!prevAst || !line) return null;
  // A number written before a power belongs to that power (5x⁶ · 3x⁴ is two factors, not four).
  const factors = [];
  let pending = 1, sawNumber = false;
  for (const node of productFactors(prevAst)) {
    const k = num(node);
    if (k !== null) { pending *= k; sawNumber = true; continue; }
    const f = powerFactor(node);
    if (!f) return null;
    if (sawNumber && !f.power) f.coef *= pending;
    else if (sawNumber) factors.push({ coef: pending, exps: {}, outer: 1, power: false });
    factors.push(f);
    pending = 1; sawNumber = false;
  }
  if (sawNumber && factors.length) { if (!factors[factors.length - 1].power) factors[factors.length - 1].coef *= pending; else return null; }
  if (factors.length === 0) return null;
  const mult = factors.length > 1;
  const powered = factors.some(f => f.power);
  if (!mult && !powered) return null;

  // Variants: exponents of a power multiplied (right) or added (slip); the
  // number raised (right) or left alone (slip); across factors, exponents
  // added (right) or multiplied (slip), numbers multiplied (right) or added (slip).
  const results = [];
  for (const expPower of ['mul', 'add']) for (const coefPower of ['pow', 'keep']) for (const expAcross of ['add', 'mul']) for (const coefAcross of ['mul', 'add']) {
    if (expPower === 'mul' && coefPower === 'pow' && expAcross === 'add' && coefAcross === 'mul') continue;   // the right answer
    const per = factors.map(f => {
      const e = {}; for (const v of Object.keys(f.exps)) e[v] = f.power ? (expPower === 'mul' ? f.exps[v] * f.outer : f.exps[v] + f.outer) : f.exps[v];
      const c = f.power ? (coefPower === 'pow' ? Math.pow(f.coef, f.outer) : f.coef) : f.coef;
      return { c, e };
    });
    const e = {};
    for (const p of per) for (const v of Object.keys(p.e)) e[v] = expAcross === 'add' ? (e[v] || 0) + p.e[v] : (v in e ? e[v] * p.e[v] : p.e[v]);
    const c = coefAcross === 'mul' ? per.reduce((s, p) => s * p.c, 1) : per.reduce((s, p) => s + p.c, 0);
    if (polyEqual(line, build(c, e))) results.push({ expPower, coefPower, expAcross, coefAcross });
  }
  if (!results.length) return null;
  const r = results[0];
  const first = factors.find(f => f.power) || factors[0];
  const v = Object.keys(first.exps)[0] || 'x';
  if (powered && r.expPower === 'add') {
    const f = factors.find(x => x.power);
    return {
      message: `A power of a power multiplies the indices: ${fmt(f.exps[v])} × ${fmt(f.outer)}, not ${fmt(f.exps[v])} + ${fmt(f.outer)}. Adding is for multiplying two powers of the same base.`,
      messages: { hi: `घात की घात में घातांक गुणा होते हैं: ${fmt(f.exps[v])} × ${fmt(f.outer)}, ${fmt(f.exps[v])} + ${fmt(f.outer)} नहीं। जोड़ना तब होता है जब एक ही आधार की दो घातों को गुणा किया जाए।` },
      code: 'power-of-power'
    };
  }
  if (powered && r.coefPower === 'keep') {
    const f = factors.find(x => x.power && Math.abs(x.coef) !== 1);
    if (f) return {
      message: `The power also applies to the number in front: (${fmt(f.coef)})^${fmt(f.outer)} = ${fmt(Math.pow(f.coef, f.outer))}, not ${fmt(f.coef)}.`,
      messages: { hi: `घात सामने की संख्या पर भी लागू होती है: (${fmt(f.coef)})^${fmt(f.outer)} = ${fmt(Math.pow(f.coef, f.outer))}, ${fmt(f.coef)} नहीं।` },
      code: 'index-power-not-applied-to-number'
    };
  }
  const singleVar = mult && factors.length === 2 && factors.every(f => Object.keys(f.exps).length === 1 && Object.keys(f.exps)[0] === Object.keys(factors[0].exps)[0]);
  if (mult && !singleVar) return null;
  if (mult && r.expAcross === 'mul') {
    const [a, b] = factors.map(f => f.exps[v] ?? 0);
    return {
      message: `When you multiply powers of the same base you add the indices: ${fmt(a)} + ${fmt(b)}, not ${fmt(a)} × ${fmt(b)}.`,
      messages: { hi: `एक ही आधार की घातों को गुणा करते समय घातांक जोड़े जाते हैं: ${fmt(a)} + ${fmt(b)}, ${fmt(a)} × ${fmt(b)} नहीं।` },
      code: 'index-multiplied-instead-of-added'
    };
  }
  if (mult && r.coefAcross === 'add') {
    const [a, b] = factors.map(f => f.coef);
    return {
      message: `Multiply the numbers in front (${fmt(a)} × ${fmt(b)}) and add the indices. The numbers are not added.`,
      messages: { hi: `सामने की संख्याओं को गुणा करें (${fmt(a)} × ${fmt(b)}) और घातांक जोड़ें। संख्याएँ जोड़ी नहीं जातीं।` },
      code: 'index-coefficients-added'
    };
  }
  return null;
}

// ── Surds ────────────────────────────────────────────────────────────────────
const sqrtArg = n => { const u = unwrap(n); return u && (u.t === 'fn' || u.t === 'call') && /^sqrt$/i.test(u.name || u.fn || '') ? (u.args ? u.args[0] : u.arg) : null; };
function surdSlips(ctx) {
  const prevAst = astOf(ctx.previous);
  if (!prevAst) return null;
  const u = unwrap(prevAst);
  if (u?.t !== 'bin' || (u.op !== '+' && u.op !== '-')) return null;
  const a = sqrtArg(u.l), b = sqrtArg(u.r);
  const x = a && num(a), y = b && num(b);
  if (x === null || y === null || x == null || y == null) return null;
  let val;
  try { val = evaluate(astOf(ctx.line), {}); } catch { return null; }
  const wrong = Math.sqrt(u.op === '+' ? x + y : x - y);
  if (!Number.isFinite(val) || Math.abs(val - wrong) > 1e-9 || Math.abs(val - evaluate(prevAst, {})) < 1e-9) return null;
  return {
    message: `√${fmt(x)} ${u.op === '+' ? '+' : '−'} √${fmt(y)} is not √${fmt(u.op === '+' ? x + y : x - y)}. Roots can be added only when the number under the root is the same; the sum of square roots is not the square root of the sum.`,
    messages: { hi: `√${fmt(x)} ${u.op === '+' ? '+' : '−'} √${fmt(y)}, √${fmt(u.op === '+' ? x + y : x - y)} के बराबर नहीं है। मूल तभी जोड़े जा सकते हैं जब मूल के अंदर की संख्या एक ही हो।` },
    code: 'surd-sum-under-one-root'
  };
}

const slip = (code, fn, id = null) => ({ code, misconceptionId: id, detect: ctx => { resetPolyBudget(); if (sameAsPrevious(ctx)) return null; const r = fn(ctx); return r && r.code === code ? r : null; } });
registerTopic({
  topic: 'indices',
  appliesTo: meta => meta?.kind !== 'equation' && meta?.kind !== 'plan',
  slips: [
    slip('power-of-power', indexSlips),
    slip('index-power-not-applied-to-number', indexSlips),
    slip('index-multiplied-instead-of-added', indexSlips),
    slip('index-coefficients-added', indexSlips),
    slip('surd-sum-under-one-root', surdSlips)
  ]
});
