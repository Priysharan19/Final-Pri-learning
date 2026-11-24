// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the corpus behind the first-error sweep (Australian edition, Years 11-12 Advanced + Extension 1)
//
// Every page is built by rule from a small expression tree that carries its OWN evaluator (JavaScript, never the product engine), so what is
// true is decided by construction and re-checked at many points by this file, not by the system under test:
//   · a TRUE page: a chain of expressions that are equal at every probe point (equivalent forms, reordered terms, unsimplified answers)
//   · a SLIP page: the same page with ONE line replaced by a typed mistake (sign, coefficient, exponent, dropped term, wrong function,
//     wrong constant, wrong arithmetic). It is kept only when the slipped line differs from the line above at most probe points.
// Deterministic: a seeded generator, no I/O, no model.
// ─────────────────────────────────────────────────────────────────────────────

export function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  const pick = arr => arr[int(0, arr.length - 1)];
  const nz = (a, b) => { let v = 0; while (!v) v = int(a, b); return v; };
  return { next, int, pick, nz };
}

// ── trees ─────────────────────────────────────────────────────────────────────
export const N = v => ({ k: 'n', v });
export const V = (name = 'x') => ({ k: 'v', name });
export const E = () => ({ k: 'e' });
export const add = (...ts) => ({ k: 'add', ts: ts.map(t => (Array.isArray(t) ? { s: t[0], t: t[1] } : { s: 1, t })) });
export const sub = (a, b) => ({ k: 'add', ts: [{ s: 1, t: a }, { s: -1, t: b }] });
export const mul = (...fs) => ({ k: 'mul', fs });
export const div = (a, b) => ({ k: 'div', a, b });
export const pow = (a, b) => ({ k: 'pow', a, b: typeof b === 'number' ? N(b) : b });
export const fn = (name, a) => ({ k: 'fn', name, a });
export const neg = a => add([-1, a]);

const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, sqrt: Math.sqrt, exp: Math.exp };
export function ev(t, env) {
  switch (t.k) {
    case 'n': return t.v;
    case 'v': return env[t.name];
    case 'e': return Math.E;
    case 'add': return t.ts.reduce((s, x) => s + x.s * ev(x.t, env), 0);
    case 'mul': return t.fs.reduce((p, f) => p * ev(f, env), 1);
    case 'div': return ev(t.a, env) / ev(t.b, env);
    case 'pow': return Math.pow(ev(t.a, env), ev(t.b, env));
    case 'fn': return FN[t.name](ev(t.a, env));
    default: return NaN;
  }
}
const varsOf = (t, out = new Set()) => {
  if (t.k === 'v') out.add(t.name);
  for (const key of ['a', 'b']) if (t[key]) varsOf(t[key], out);
  for (const x of t.ts || []) varsOf(x.t, out);
  for (const f of t.fs || []) varsOf(f, out);
  return out;
};

// ── rendering, the way a student writes it ──────────────────────────────────────
const prec = t => (t.k === 'add' ? 1 : t.k === 'mul' || t.k === 'div' ? 2 : t.k === 'n' && t.v < 0 ? 1 : 4);
const startsWithLetter = s => /^[A-Za-z(]/.test(s);
export function show(t, opts = {}) {
  const sp = opts.tight ? '' : ' ';
  const R = (u, minPrec) => { const s = show(u, opts); return prec(u) < minPrec ? `(${s})` : s; };
  switch (t.k) {
    case 'n': return Number.isInteger(t.v) ? String(t.v) : String(t.v);
    case 'v': return t.name;
    case 'e': return 'e';
    case 'add': return t.ts.map((x0, i) => {
      let x = x0;
      if (x.t.k === 'n' && x.t.v < 0) x = { s: -x.s, t: N(-x.t.v) };   // x + (-2) is written x - 2
      let body = R(x.t, 1 + (x.t.k === 'add' ? 1 : 0));
      if (x.t.k === 'add') body = `(${show(x.t, opts)})`;
      if (i === 0) return x.s < 0 ? `-${body}` : body;
      return `${sp}${x.s < 0 ? '-' : '+'}${sp}${body}`;
    }).join('');
    case 'mul': {
      let out = '';
      t.fs.forEach((f, i) => {
        const s = f.k === 'add' ? `(${show(f, opts)})` : R(f, 2);
        if (i === 0) { out = s; return; }
        const prevNum = t.fs[i - 1].k === 'n', prevClosed = /\)$/.test(out), isLetter = startsWithLetter(s);
        out += (prevNum || prevClosed) && isLetter ? s : (opts.star ? `*${s}` : ` ${s}`.replace(/^ /, '*'));
      });
      return out;
    }
    case 'div': return opts.tex ? `\\frac{${show(t.a, opts)}}{${show(t.b, opts)}}` : `${R(t.a, 3)}/${t.b.k === 'n' || t.b.k === 'v' ? show(t.b, opts) : `(${show(t.b, opts)})`}`;
    case 'pow': {
      const base = t.a.k === 'n' || t.a.k === 'v' || t.a.k === 'e' ? show(t.a, opts) : t.a.k === 'fn' ? show(t.a, opts) : `(${show(t.a, opts)})`;
      if (opts.tex) return `${base}^{${show(t.b, opts)}}`;
      return t.b.k === 'n' && t.b.v >= 0 && Number.isInteger(t.b.v) ? `${base}^${t.b.v}` : `${base}^(${show(t.b, opts)})`;
    }
    case 'fn': return opts.tex ? (t.name === 'sqrt' ? `\\sqrt{${show(t.a, opts)}}` : `\\${t.name}(${show(t.a, opts)})`) : `${t.name}(${show(t.a, opts)})`;
    default: return '?';
  }
}

// ── probes (independent of the product engine) ────────────────────────────────────
const POS = [0.31, 0.57, 0.83, 1.12, 1.47, 1.9, 2.35, 2.8, 3.3, 4.1];
const ALL = [-2.7, -1.9, -1.3, -0.62, -0.28, 0.19, 0.44, 0.9, 1.6, 2.4];
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
export function probe(a, b) {
  const vs = [...new Set([...varsOf(a), ...varsOf(b)])];
  let both = 0, differ = 0, agree = 0;
  const pts = vs.length <= 1 ? [...POS, ...ALL] : Array.from({ length: 16 }, (_, i) => i);
  for (const p of pts) {
    const env = {};
    vs.forEach((v, k) => { env[v] = vs.length <= 1 ? p : POS[(p * 3 + k * 5 + 1) % POS.length] * (k % 2 ? -1 : 1) + k * 0.07; });
    const x = ev(a, env), y = ev(b, env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    both++; if (near(x, y)) agree++; else differ++;
  }
  return { both, differ, agree };
}
export const isEqual = (a, b) => { const p = probe(a, b); return p.both >= 5 && p.differ === 0; };
export const isClearlyDifferent = (a, b) => { const p = probe(a, b); return p.both >= 5 && p.differ >= Math.ceil(p.both * 0.8); };

// ── mutations: the typed slips ─────────────────────────────────────────────────────
const clone = t => JSON.parse(JSON.stringify(t));
const walk = (t, f, path = []) => { f(t, path); for (const key of ['a', 'b']) if (t[key]) walk(t[key], f, [...path, key]); (t.ts || []).forEach((x, i) => walk(x.t, f, [...path, 'ts', i])); (t.fs || []).forEach((x, i) => walk(x, f, [...path, 'fs', i])); };
const nodes = t => { const out = []; walk(t, n => out.push(n)); return out; };
/** One typed slip of tree `t`, or null. kind: sign | coefficient | exponent | dropped | function | constant | arithmetic */
export function mutate(t, kind, r) {
  const c = clone(t);
  const all = nodes(c);
  const pickNode = pred => { const xs = all.filter(pred); return xs.length ? r.pick(xs) : null; };
  switch (kind) {
    case 'sign': { const a = pickNode(n => n.k === 'add' && n.ts.length >= 2); if (!a) return null; const x = a.ts[r.int(1, a.ts.length - 1)]; x.s = -x.s; return c; }
    case 'coefficient': { const m = pickNode(n => n.k === 'mul' && n.fs.some(f => f.k === 'n' && Math.abs(f.v) >= 2)); if (m) { const f = m.fs.find(g => g.k === 'n' && Math.abs(g.v) >= 2); f.v += r.pick([1, -1, 2]) * Math.sign(f.v); return f.v ? c : null; } const n = pickNode(x => x.k === 'n' && Math.abs(x.v) >= 2); if (!n) return null; n.v += r.pick([1, -1, 2]); return n.v ? c : null; }
    case 'exponent': { const p = pickNode(n => n.k === 'pow' && n.b.k === 'n'); if (!p) return null; p.b.v += r.pick([1, -1]); return c; }
    case 'dropped': { const a = pickNode(n => n.k === 'add' && n.ts.length >= 3); if (!a) return null; a.ts.splice(r.int(0, a.ts.length - 1), 1); if (a.ts[0].s < 0 && false) return null; return c; }
    case 'function': { const f = pickNode(n => n.k === 'fn' && (n.name === 'sin' || n.name === 'cos')); if (!f) return null; f.name = f.name === 'sin' ? 'cos' : 'sin'; return c; }
    case 'constant': { const n = pickNode(x => x.k === 'n' && x.v !== 0); if (!n) return null; n.v += r.pick([1, -1, 2, -2]); return c; }
    case 'arithmetic': { const n = pickNode(x => x.k === 'n'); if (!n) return null; n.v += r.pick([1, -1, 10, -10, 2]); return c; }
    default: return null;
  }
}
export const SLIP_KINDS = ['sign', 'coefficient', 'exponent', 'dropped', 'function', 'constant', 'arithmetic'];

// ── the families: each returns a TRUE chain of trees and the prompt ───────────────────────────────────────────────────
const X = V('x');
const lin = (c, d) => (c === 1 ? (d ? add(X, N(d)) : X) : d ? add(mul(N(c), X), N(d)) : mul(N(c), X));
const term = (c, k) => (k === 0 ? N(c) : k === 1 ? (c === 1 ? X : mul(N(c), X)) : c === 1 ? pow(X, k) : mul(N(c), pow(X, k)));
const poly = (cs, order) => {
  const ks = Object.keys(cs).map(Number).filter(k => cs[k] !== 0).sort((p, q) => q - p);
  const ts = (order === 'asc' ? ks.slice().reverse() : ks).map(k => [cs[k] < 0 ? -1 : 1, term(Math.abs(cs[k]), k)]);
  return ts.length ? add(...ts) : N(0);
};
const collectBy = terms => { const m = {}; for (const [c, k] of terms) m[k] = (m[k] || 0) + c; return m; };
const unsimp = terms => add(...terms.map(([c, k]) => [c < 0 ? -1 : 1, term(Math.abs(c), k)]));

export const FAMILIES = {
  // ordinary polynomial algebra in one letter (the rule as it stands)
  expand: { klass: 'poly-expand', prompt: r => r.pick(['Expand and simplify $(x + 2)(x - 3)$.', 'Expand and simplify the expression.', 'Expand and simplify.']), build: r => {
    const a = r.nz(1, 3), b = r.nz(-6, 6), c = r.nz(1, 3), d = r.nz(-6, 6);
    const raw = [[a * c, 2], [a * d, 1], [b * c, 1], [b * d, 0]];
    return [mul(lin(a, b), lin(c, d)), unsimp(raw), poly(collectBy(raw))];
  } },
  square: { klass: 'poly-expand', prompt: () => 'Expand and simplify.', build: r => {
    const a = r.int(1, 3), b = r.nz(-6, 6);
    const raw = [[a * a, 2], [a * b, 1], [a * b, 1], [b * b, 0]];
    return [pow(lin(a, b), 2), mul(lin(a, b), lin(a, b)), unsimp(raw), poly(collectBy(raw))];
  } },
  // equivalent forms: ascending powers, an unsimplified last line, the answer left as a product
  expandAsc: { klass: 'poly-equivalent', prompt: () => 'Expand and simplify.', build: r => {
    const a = r.nz(1, 3), b = r.nz(-6, 6), c = r.nz(1, 3), d = r.nz(-6, 6);
    const raw = [[a * c, 2], [a * d, 1], [b * c, 1], [b * d, 0]];
    return [mul(lin(a, b), lin(c, d)), unsimp(raw.slice().reverse()), poly(collectBy(raw), 'asc')];
  } },
  unsimplifiedEnd: { klass: 'poly-equivalent', prompt: () => 'Expand.', build: r => {
    const a = r.nz(1, 3), b = r.nz(-6, 6), c = r.nz(1, 3), d = r.nz(-6, 6);
    return [mul(lin(a, b), lin(c, d)), unsimp([[a * c, 2], [a * d, 1], [b * c, 1], [b * d, 0]])];
  } },
  collect: { klass: 'poly-collect', prompt: () => 'Simplify.', build: r => {
    const t = Array.from({ length: r.int(4, 5) }, () => [r.nz(-6, 6), r.pick([0, 1, 1, 2, 2, 3])]);
    return [unsimp(t), poly(collectBy(t))];
  } },
  factorise: { klass: 'poly-factorise', prompt: r => r.pick(['Factorise $x^2 + 5x + 6$.', 'Factorise fully.']), build: r => {
    const p = r.nz(-6, 6), q = r.nz(-6, 6);
    const expanded = poly(collectBy([[1, 2], [p + q, 1], [p * q, 0]]));
    return [expanded, mul(lin(1, p), lin(1, q))];
  } },
  derivPoly: { klass: 'deriv-poly', prompt: () => 'Differentiate the function.', label: 'y', dlabel: 'dy/dx', build: r => {
    const cs = { 3: r.nz(-4, 4), 2: r.nz(-5, 5), 1: r.nz(-6, 6), 0: r.nz(-5, 5) };
    const d = { 2: 3 * cs[3], 1: 2 * cs[2], 0: cs[1] };
    return [poly(cs), poly(d)];
  } },
  // algebraic fractions and indices
  fraction: { klass: 'alg-fraction', prompt: () => 'Simplify.', build: r => {
    const a = r.nz(-5, 5);
    const num = poly(collectBy([[1, 2], [0, 1], [-a * a, 0]]));
    return [div(num, lin(1, -a)), div(mul(lin(1, -a), lin(1, a)), lin(1, -a)), lin(1, a)];
  } },
  indices: { klass: 'indices', prompt: () => 'Simplify.', build: r => {
    const a = r.int(2, 6), b = r.int(2, 6), c = r.int(1, a + b - 1);
    return [div(mul(pow(X, a), pow(X, b)), pow(X, c)), pow(X, add(N(a), N(b), [-1, N(c)])), pow(X, a + b - c)];
  } },
  coeffIndices: { klass: 'indices', prompt: () => 'Simplify.', build: r => {
    const k = r.int(2, 4), a = r.int(2, 4), n = r.int(2, 3);
    return [pow(mul(N(k), pow(X, a)), n), mul(pow(N(k), n), pow(pow(X, a), n)), mul(N(k ** n), pow(X, a * n))];
  } },
  // exponentials, logarithms, trigonometry
  expLaw: { klass: 'exp', prompt: () => 'Simplify.', build: r => {
    const a = r.int(1, 4), b = r.int(1, 4);
    return [mul(pow(E(), mul(N(a), X)), pow(E(), mul(N(b), X))), pow(E(), add(mul(N(a), X), mul(N(b), X))), pow(E(), mul(N(a + b), X))];
  } },
  expPower: { klass: 'exp', prompt: () => 'Simplify.', build: r => {
    const a = r.int(2, 4), b = r.int(2, 4);
    return [pow(pow(E(), mul(N(a), X)), b), pow(E(), mul(N(a), X, N(b))), pow(E(), mul(N(a * b), X))];
  } },
  logLaw: { klass: 'log', prompt: () => 'Simplify.', build: r => {
    const a = r.int(2, 9), b = r.int(2, 9);
    return [add(fn('ln', mul(N(a), X)), fn('ln', mul(N(b), X))), fn('ln', mul(mul(N(a), X), mul(N(b), X))), fn('ln', mul(N(a * b), pow(X, 2)))];
  } },
  logPow: { klass: 'log', prompt: () => 'Simplify.', build: r => {
    const k = r.int(2, 4), a = r.int(2, 5);
    return [mul(N(k), fn('ln', mul(N(a), X))), fn('ln', pow(mul(N(a), X), k)), fn('ln', mul(N(a ** k), pow(X, k)))];
  } },
  trigId: { klass: 'trig', prompt: () => 'Simplify.', build: r => {
    const k = r.int(2, 5);
    return [add(mul(N(k), pow(fn('sin', X), 2)), mul(N(k), pow(fn('cos', X), 2)), fn('sin', X)), add(mul(N(k), add(pow(fn('sin', X), 2), pow(fn('cos', X), 2))), fn('sin', X)), add(N(k), fn('sin', X))];
  } },
  trigDouble: { klass: 'trig', prompt: () => 'Simplify.', build: r => {
    const k = r.int(2, 5);
    return [mul(N(k), fn('sin', mul(N(2), X))), mul(N(k), N(2), fn('sin', X), fn('cos', X)), mul(N(2 * k), fn('sin', X), fn('cos', X))];
  } },
  trigPyth: { klass: 'trig', prompt: () => 'Simplify.', build: r => {
    const k = r.int(2, 5);
    return [mul(N(k), sub(N(1), pow(fn('cos', X), 2))), mul(N(k), pow(fn('sin', X), 2))];
  } },
  derivTrig: { klass: 'deriv-nonpoly', prompt: () => 'Differentiate the function.', label: 'y', dlabel: 'dy/dx', build: r => {
    const a = r.int(2, 5), k = r.int(2, 4);
    return [mul(N(k), fn('sin', mul(N(a), X))), mul(N(k * a), fn('cos', mul(N(a), X)))];
  } },
  derivLog: { klass: 'deriv-nonpoly', prompt: () => 'Differentiate the function.', label: 'y', dlabel: 'dy/dx', build: r => {
    const a = r.int(2, 5), k = r.int(2, 5);
    return [mul(N(k), fn('ln', mul(N(a), X))), div(N(k), X)];
  } },
  // two letters
  twoLetter: { klass: 'two-letters', prompt: () => 'Expand and simplify.', build: r => {
    const A = V('a'), B = V('b'), k = r.int(1, 4), m = r.int(1, 4);
    return [pow(add(mul(N(k), A), mul(N(m), B)), 2), mul(add(mul(N(k), A), mul(N(m), B)), add(mul(N(k), A), mul(N(m), B))), add(mul(N(k * k), pow(A, 2)), mul(N(2 * k * m), A, B), mul(N(m * m), pow(B, 2)))];
  } },
  // closed numbers
  numeric: { klass: 'numeric', prompt: () => 'Simplify.', build: r => {
    const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9), d = r.int(2, 9);
    return [add(mul(N(a), N(b)), mul(N(c), N(d))), add(N(a * b), N(c * d)), N(a * b + c * d)];
  } },
  numericFrac: { klass: 'numeric', prompt: () => 'Simplify.', build: r => {
    const a = r.int(1, 5), b = r.pick([2, 3, 4, 5]), c = r.int(1, 5), d = r.pick([6, 7, 8, 9]);
    return [add(div(N(a), N(b)), div(N(c), N(d))), div(add(N(a * d), N(c * b)), N(b * d))];
  } },
  surd: { klass: 'numeric', prompt: () => 'Simplify.', build: r => {
    const k = r.int(2, 6), m = r.pick([2, 3, 5, 6, 7]);
    return [fn('sqrt', N(k * k * m)), mul(fn('sqrt', N(k * k)), fn('sqrt', N(m))), mul(N(k), fn('sqrt', N(m)))];
  } },
  numericPow: { klass: 'numeric', prompt: () => 'Evaluate.', build: r => {
    const a = r.int(2, 5), b = r.int(2, 4), c = r.int(2, 5);
    return [add(pow(N(a), b), mul(N(c), N(a))), add(N(a ** b), N(c * a)), N(a ** b + c * a)];
  } }
};
export const FAMILY_KEYS = Object.keys(FAMILIES);

// ── pages ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function render(chain, fam, style) {
  const T = t => show(t, style.tight ? { tight: true } : {});
  const label = fam.label || null, dlabel = fam.dlabel || null;
  if (label) return [`${label} = ${T(chain[0])}`, ...(style.chain === 'restate' ? chain.slice(1).map(t => `${dlabel} = ${T(t)}`) : chain.slice(1).map(t => `${dlabel} = ${T(t)}`))];
  if (style.chain === 'restate') return chain.map((t, i) => (i === 0 ? T(t) : `y = ${T(t)}`));
  if (style.chain === 'labelled') return [`y = ${T(chain[0])}`, ...chain.slice(1).map(t => `= ${T(t)}`)];
  return [T(chain[0]), ...chain.slice(1).map(t => `= ${T(t)}`)];
}
const STYLES = [{ chain: 'plain' }, { chain: 'labelled' }, { chain: 'plain', tight: true }];

/** The true page and (when one is produced) a slip page for the family. */
export function buildPage(famKey, seed, slipKind = null) {
  const r = rng(seed * 7919 + famKey.length * 31 + (slipKind ? slipKind.length : 0));
  const fam = FAMILIES[famKey];
  const chain = fam.build(r);
  if (!chain || chain.length < 2) return null;
  if (!fam.label) for (let i = 1; i < chain.length; i++) if (!isEqual(chain[i - 1], chain[i])) return null;   // the builder's own chain must be true (a derivative family is a different function by design)
  const style = STYLES[seed % STYLES.length];
  const verb = fam.prompt(r).replace(/\s*\$.*\$/, '').replace(/\.$/, '').replace(/ the (?:expression|function)$/, '');
  const first = show(chain[0], { tex: true });
  const prompt = fam.label ? `${verb} $${fam.label} = ${first}$.` : `${verb} $${first}$.`;
  const base = { fam: famKey, klass: fam.klass, prompt, seed, expr: show(chain[chain.length - 1], { tight: true }) };
  if (!slipKind) return { ...base, true: true, lines: render(chain, fam, style) };
  // slip: replace chain[at] (at >= 1) with a mutated copy that differs clearly from chain[at - 1]
  const at = r.int(1, chain.length - 1);
  for (let tries = 0; tries < 12; tries++) {
    const m = mutate(chain[at], slipKind, r);
    if (!m || !isClearlyDifferent(chain[at - 1], m) || !isClearlyDifferent(chain[at], m) || show(m) === show(chain[at])) continue;   // wrong against the line above AND against the true line (cos(-5x) is cos(5x))
    const withTail = seed % 2 === 0 && at < chain.length - 1;   // half the slips are followed by the rest of the original working
    const slipped = chain.slice(0, at).concat([m], withTail ? chain.slice(at + 1) : []);
    const lines = render(slipped, fam, style);
    return { ...base, true: false, slipKind, at, lines, tail: withTail, answer: show(slipped[slipped.length - 1], { tight: true }), slipLine: lines[at], aboveLine: render(chain, fam, style)[at - 1] };
  }
  return null;
}
