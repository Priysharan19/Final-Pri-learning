// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Maths expression engine
// Tokeniser + precedence-climbing parser + evaluator for student maths input.
// Understands implicit multiplication (2x, 3(x+1), 2π), unicode maths symbols,
// functions (sin, cos, tan, sec, cosec, cot, sqrt, ln, log, …), factorials (n!),
// counting (nCr / C(n,r) / ⁿCᵣ / nPr), bounded sums (Σ_{k=1}^{n} k²) and the
// constants π and e.
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  // NCERT names the reciprocal ratios in Class 10–11; cosec is the Indian
  // spelling, csc the one an American calculator prints.
  sec: x => 1 / Math.cos(x), cosec: x => 1 / Math.sin(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil
};

// ── Factorials and counting ──────────────────────────────────────────────────
// n! is Γ(n + 1). Using the gamma function rather than an integer product keeps
// n!/(n−2)! and n(n−1) comparable by the same sampling that decides every other
// equivalence: the samples are not integers, and a product that only exists at
// integers would leave nothing to compare. Poles at the negative integers come
// back NaN and are skipped like any other invalid sample.
const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
];
function gamma(z) {
  if (!Number.isFinite(z)) return NaN;
  if (z < 0.5) {
    const s = Math.sin(Math.PI * z);
    if (Math.abs(s) < 1e-300) return NaN;            // a pole
    return Math.PI / (s * gamma(1 - z));
  }
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}
export function factorial(n) {
  if (!Number.isFinite(n)) return NaN;
  if (Number.isInteger(n)) {
    if (n < 0) return NaN;
    if (n > 170) return Infinity;
    let out = 1;
    for (let k = 2; k <= n; k++) out *= k;
    return out;
  }
  return gamma(n + 1);
}
const MULTI_FUNCTIONS = {
  ncr: (n, r) => {
    if (Number.isInteger(n) && Number.isInteger(r)) {
      if (r < 0 || r > n || n < 0) return 0;
      let out = 1;
      for (let k = 1; k <= Math.min(r, n - r); k++) out = out * (n - k + 1) / k;
      return Math.round(out);
    }
    return factorial(n) / (factorial(r) * factorial(n - r));
  },
  npr: (n, r) => {
    if (Number.isInteger(n) && Number.isInteger(r)) {
      if (r < 0 || r > n || n < 0) return 0;
      let out = 1;
      for (let k = 0; k < r; k++) out *= (n - k);
      return out;
    }
    return factorial(n) / factorial(n - r);
  }
};
const MULTI_NAMES = ['ncr', 'npr', 'sum'];
const SUM_LIMIT = 10000;

const CONSTANTS = { pi: Math.PI, e: Math.E };

const FUNC_NAMES = [...Object.keys(FUNCTIONS), ...MULTI_NAMES].sort((a, b) => b.length - a.length);
const CONST_NAMES = ['pi', 'theta', 'alpha', 'beta'];

const SUPER = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

/**
 * Commas separate the arguments of nCr(n, r), nPr(n, r) and sum(term, k, a, b),
 * and nothing else — everywhere else a comma is a thousands separator that
 * normalize() removes. Inside those calls it becomes ';' first, so the two
 * meanings never meet.
 */
function protectArguments(s) {
  const re = /\b(ncr|npr|sum)\s*\(/gi;
  let out = '';
  let cursor = 0;
  let m;
  while ((m = re.exec(s))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close === -1) break;
    let inner = '';
    depth = 0;
    for (let i = open + 1; i < close; i++) {
      const c = s[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      inner += (c === ',' && depth === 0) ? ';' : c;
    }
    out += s.slice(cursor, open + 1) + inner + ')';
    cursor = close + 1;
    re.lastIndex = cursor;
  }
  return out + s.slice(cursor);
}

/** The counting and summation notations NCERT students actually write. */
function rewriteCounting(s) {
  // ⁿCᵣ / ⁵C₂ with unicode super/subscripts
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*([CP])\s*([₀₁₂₃₄₅₆₇₈₉]+)/g, (_, n, f, r) =>
    `${f === 'C' ? 'ncr' : 'npr'}(${[...n].map(ch => SUPER[ch]).join('')};${[...r].map(ch => SUB[ch]).join('')})`);
  // \binom{n}{r}
  s = s.replace(/\\binom\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, 'ncr($1;$2)');
  // nCr(n, r) / C(n, r) / nPr(n, r) / P(n, r) as function calls. The bare
  // capital letters are only counting when they take exactly two arguments —
  // P(x) stays a product of P and x, as it always was.
  s = s.replace(/\bnCr\s*\(/g, 'ncr(').replace(/\bnPr\s*\(/g, 'npr(');
  s = s.replace(/(^|[^a-zA-Z])C\s*\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)/g, '$1ncr($2;$3)');
  s = s.replace(/(^|[^a-zA-Z])P\s*\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)/g, '$1npr($2;$3)');
  // 5C2 / 5P2 / 10C3 written inline with capital letters
  s = s.replace(/(^|[^a-zA-Z0-9.])(\d+)\s*C\s*(\d+)(?![a-zA-Z0-9.])/g, '$1ncr($2;$3)');
  s = s.replace(/(^|[^a-zA-Z0-9.])(\d+)\s*P\s*(\d+)(?![a-zA-Z0-9.])/g, '$1npr($2;$3)');
  // Σ_{k=1}^{n} term  →  sum(term; k; 1; n)
  s = s.replace(/[Σ∑]\s*_?\s*[{(]?\s*([a-zA-Z])\s*=\s*([^{}()^]+?)\s*[})]?\s*\^\s*[{(]?\s*([^{}()]+?)\s*[})]?\s*(.+)$/, 'sum($4;$1;$2;$3)');
  return protectArguments(s);
}

/** Normalise unicode / friendly maths notation into parseable ASCII. */
export function normalize(raw) {
  if (raw == null) return '';
  let s = String(raw);
  s = s.replace(/[−–—]/g, '-')     // −, –, — → -
    .replace(/[×✕✖·⋅]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[［【\[]/g, '(').replace(/[］】\]]/g, ')')
    .replace(/π/g, 'pi')
    .replace(/θ/g, 'theta')
    .replace(/√/g, 'sqrt');
  s = rewriteCounting(s);
  s = s.replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/⁻¹/g, '^(-1)')
    .replace(/,/g, '')                             // thousands separators (points use parse pair first)
    .replace(/\$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

// ── Tokeniser ────────────────────────────────────────────────────────────────

function tokenize(input) {
  const src = normalize(input).replace(/ /g, '');
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      // scientific notation 1.5e3 / 2E-4 — only when followed by a digit or sign+digit
      if ((src[j] === 'e' || src[j] === 'E') && /^[+-]?\d/.test(src.slice(j + 1))) {
        j++;
        if (src[j] === '+' || src[j] === '-') j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      const numStr = src.slice(i, j);
      if ((numStr.match(/\./g) || []).length > 1) throw new Error('Malformed number');
      tokens.push({ t: 'num', v: parseFloat(numStr) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      // Consume an alpha run, then greedily peel off function names, constants
      // and single-letter variables.
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      let run = src.slice(i, j);
      while (run.length) {
        const lower = run.toLowerCase();
        const fn = FUNC_NAMES.find(f => lower.startsWith(f));
        const cn = CONST_NAMES.find(k => lower.startsWith(k));
        if (fn && (run.length === fn.length || true)) {
          // Only treat as a function if a '(' or an atom follows at the very end of the run
          if (run.length === fn.length) {
            tokens.push({ t: 'fn', v: fn.toLowerCase() });
            run = '';
            break;
          }
        }
        if (cn) { tokens.push({ t: 'const', v: cn }); run = run.slice(cn.length); continue; }
        if (fn) { tokens.push({ t: 'fn', v: fn.toLowerCase() }); run = run.slice(fn.length); continue; }
        tokens.push({ t: 'var', v: run[0] });
        run = run.slice(1);
      }
      i = j;
      continue;
    }
    if ('+-*/^()='.includes(c)) {
      if (c === '*' && src[i + 1] === '*') { tokens.push({ t: 'op', v: '^' }); i += 2; continue; }
      tokens.push({ t: c === '(' ? 'lp' : c === ')' ? 'rp' : c === '=' ? 'eq' : 'op', v: c });
      i++;
      continue;
    }
    if (c === '%') { tokens.push({ t: 'pct' }); i++; continue; }
    if (c === '!') { tokens.push({ t: 'fact' }); i++; continue; }
    if (c === ';') { tokens.push({ t: 'sep' }); i++; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return insertImplicitMult(tokens);
}

function insertImplicitMult(tokens) {
  const out = [];
  for (let k = 0; k < tokens.length; k++) {
    const cur = tokens[k];
    if (out.length) {
      const prev = out[out.length - 1];
      const prevEnds = prev.t === 'num' || prev.t === 'var' || prev.t === 'const' || prev.t === 'rp' || prev.t === 'pct' || prev.t === 'fact';
      const curStarts = cur.t === 'num' || cur.t === 'var' || cur.t === 'const' || cur.t === 'lp' || cur.t === 'fn';
      if (prevEnds && curStarts) out.push({ t: 'op', v: '*', implicit: true });
    }
    out.push(cur);
  }
  return out;
}

// ── Parser (precedence climbing → AST) ───────────────────────────────────────

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
const RIGHT = { '^': true };

class Parser {
  constructor(tokens) { this.toks = tokens; this.pos = 0; }
  peek() { return this.toks[this.pos]; }
  next() { return this.toks[this.pos++]; }
  expect(t) {
    const tok = this.next();
    if (!tok || tok.t !== t) throw new Error(`Expected ${t}`);
    return tok;
  }

  parseExpression(minPrec = 0) {
    let left = this.parseUnary();
    while (true) {
      const tok = this.peek();
      if (!tok || tok.t !== 'op' || PREC[tok.v] === undefined || PREC[tok.v] < minPrec) break;
      const op = this.next().v;
      const nextMin = RIGHT[op] ? PREC[op] : PREC[op] + 1;
      const right = this.parseExpression(nextMin);
      left = { t: 'bin', op, l: left, r: right };
    }
    return left;
  }

  parseUnary() {
    const tok = this.peek();
    if (tok && tok.t === 'op' && (tok.v === '-' || tok.v === '+')) {
      this.next();
      const operand = this.parseExpression(3); // binds tighter than * but looser than ^
      return tok.v === '-' ? { t: 'neg', v: operand } : operand;
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let node = this.parseAtom();
    while (this.peek() && (this.peek().t === 'pct' || this.peek().t === 'fact')) {
      const tok = this.next();
      node = tok.t === 'pct'
        ? { t: 'bin', op: '/', l: node, r: { t: 'num', v: 100 } }
        : { t: 'fact', v: node };
    }
    return node;
  }

  parseAtom() {
    const tok = this.next();
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.t === 'num') return this.maybePower({ t: 'num', v: tok.v });
    if (tok.t === 'const') return this.maybePower({ t: 'const', v: tok.v });
    if (tok.t === 'var') return this.maybePower({ t: 'var', v: tok.v });
    if (tok.t === 'lp') {
      const inner = this.parseExpression(0);
      this.expect('rp');
      return this.maybePower({ t: 'group', v: inner });
    }
    if (tok.t === 'fn') {
      let arg;
      // sin^2(x), sec²θ, cos^2 x — the power written on the function name is
      // the power of the whole value: (sin x)^2. The exponent is a tight atom
      // (a number or a bracketed expression) so "^-1" still reads as a group.
      if (this.peek() && this.peek().t === 'op' && this.peek().v === '^') {
        this.next();
        const power = this.parseAtom();
        if (this.peek() && this.peek().t === 'op' && this.peek().v === '*' && this.peek().implicit) this.next();
        if (this.peek() && this.peek().t === 'lp') {
          this.next();
          arg = this.parseExpression(0);
          this.expect('rp');
        } else {
          arg = this.parseUnary();
        }
        return { t: 'bin', op: '^', l: { t: 'call', fn: tok.v, arg }, r: power };
      }
      if (this.peek() && this.peek().t === 'lp') {
        this.next();
        arg = this.parseExpression(0);
        // nCr(n; r) / sum(term; k; a; b) — commas became ';' in normalize()
        if (this.peek() && this.peek().t === 'sep') {
          const args = [arg];
          while (this.peek() && this.peek().t === 'sep') { this.next(); args.push(this.parseExpression(0)); }
          this.expect('rp');
          return this.maybePower({ t: 'call', fn: tok.v, arg, args });
        }
        this.expect('rp');
      } else if (this.peek() && this.peek().t === 'op' && this.peek().v === '*' && this.peek().implicit) {
        // "sqrt2" tokenised as fn * num — consume the implicit * then a tight atom
        this.next();
        arg = this.parseUnary();
        // keep only the tight atom: since parseUnary parses a postfix atom with powers, fine
      } else {
        arg = this.parseUnary();
      }
      return this.maybePower({ t: 'call', fn: tok.v, arg });
    }
    throw new Error(`Unexpected token ${tok.t}`);
  }

  /** allow x^2 style exponent directly after an atom (handled by climb too, kept for fn results) */
  maybePower(node) { return node; }
}

export function parse(input) {
  const tokens = tokenize(input);
  if (!tokens.length) throw new Error('Empty expression');
  const eqIdx = tokens.findIndex(t => t.t === 'eq');
  if (eqIdx !== -1) {
    const lhs = new Parser(tokens.slice(0, eqIdx)).parseExpression(0);
    const rhsToks = tokens.slice(eqIdx + 1);
    if (rhsToks.some(t => t.t === 'eq')) throw new Error('Multiple = signs');
    const p2 = new Parser(rhsToks);
    const rhs = p2.parseExpression(0);
    if (p2.pos !== rhsToks.length) throw new Error('Trailing input');
    return { t: 'equation', l: lhs, r: rhs };
  }
  const p = new Parser(tokens);
  const ast = p.parseExpression(0);
  if (p.pos !== tokens.length) throw new Error('Trailing input');
  return ast;
}

// ── Evaluator ────────────────────────────────────────────────────────────────

/**
 * The reduced odd denominator q of a rational exponent p/q (q ≤ 99), or 0 when
 * r is not such a rational. 1/3 → 3, 2/3 → 3, 0.2 → 5; 1/2 and 0.7 → 0.
 */
function oddDenominator(r) {
  for (let q = 1; q < 100; q++) {
    const pq = r * q;
    if (Math.abs(pq - Math.round(pq)) < 1e-9) return q % 2 === 1 ? q : 0;
  }
  return 0;
}

/**
 * Evaluate an AST to a real number.
 *
 * `opts.realOddRoots` reads a negative base under a rational exponent with an
 * odd denominator as the real odd root: (−8)^(1/3) = −2, as cbrt(−8) is. It is
 * off by default, so every value the marker compares is unchanged; only the
 * domain probe in exprEquivalent() turns it on, so that x^(1/3) and cbrt(x)
 * are not judged to have different domains.
 */
export function evaluate(ast, env = {}, opts) {
  switch (ast.t) {
    case 'num': return ast.v;
    case 'const':
      if (ast.v in CONSTANTS) return CONSTANTS[ast.v];
      if (ast.v in env) return env[ast.v];
      return NaN;
    case 'var':
      if (ast.v in env) return env[ast.v];
      if (ast.v === 'e') return Math.E;
      return NaN;
    case 'group': return evaluate(ast.v, env, opts);
    case 'neg': return -evaluate(ast.v, env, opts);
    case 'fact': return factorial(evaluate(ast.v, env, opts));
    case 'call': {
      if (Array.isArray(ast.args)) {
        if (ast.fn === 'sum') {
          // sum(term; k; a; b): the bound variable shadows anything in env
          if (ast.args.length !== 4) return NaN;
          const bound = ast.args[1];
          const name = bound && (bound.t === 'var' || bound.t === 'const') ? bound.v : null;
          if (!name) return NaN;
          const lo = evaluate(ast.args[2], env, opts), hi = evaluate(ast.args[3], env, opts);
          if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi - lo > SUM_LIMIT) return NaN;
          let total = 0;
          for (let k = lo; k <= hi; k++) total += evaluate(ast.args[0], { ...env, [name]: k }, opts);
          return total;
        }
        const f = MULTI_FUNCTIONS[ast.fn];
        if (!f || ast.args.length !== f.length) return NaN;
        return f(...ast.args.map(a => evaluate(a, env, opts)));
      }
      if (MULTI_FUNCTIONS[ast.fn] || ast.fn === 'sum') return NaN;
      const a = evaluate(ast.arg, env, opts);
      const f = FUNCTIONS[ast.fn];
      if (!f) return NaN;
      return f(a);
    }
    case 'bin': {
      const l = evaluate(ast.l, env, opts);
      const r = evaluate(ast.r, env, opts);
      switch (ast.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? NaN : l / r;
        case '^': {
          if (l < 0 && !Number.isInteger(r)) {
            const q = opts && opts.realOddRoots && Number.isFinite(r) ? oddDenominator(r) : 0;
            if (!q) return NaN; // stay real
            const mag = Math.pow(-l, r);
            return Math.round(r * q) % 2 === 0 ? mag : -mag;
          }
          return Math.pow(l, r);
        }
      }
      return NaN;
    }
    case 'equation': throw new Error('Cannot evaluate an equation as a value');
    default: return NaN;
  }
}

/** Collect the variable names used in an AST (excluding known constants). */
export function variablesOf(ast, acc = new Set()) {
  if (!ast || typeof ast !== 'object') return acc;
  if (ast.t === 'var') acc.add(ast.v);
  if (ast.t === 'const' && !(ast.v in CONSTANTS)) acc.add(ast.v);
  if (ast.t === 'call' && Array.isArray(ast.args)) {
    if (ast.fn === 'sum' && ast.args.length === 4) {
      // the index of a summation is bound, not free
      const bound = ast.args[1];
      const name = bound && (bound.t === 'var' || bound.t === 'const') ? bound.v : null;
      const inner = variablesOf(ast.args[0], new Set());
      for (const v of inner) if (v !== name) acc.add(v);
      variablesOf(ast.args[2], acc);
      variablesOf(ast.args[3], acc);
      return acc;
    }
    for (const a of ast.args) variablesOf(a, acc);
    return acc;
  }
  for (const key of ['l', 'r', 'v', 'arg']) {
    if (ast[key] && typeof ast[key] === 'object') variablesOf(ast[key], acc);
  }
  return acc;
}

/**
 * Variables that stand in the bounds of a summation. Σ_{k=1}^{n} k only has a
 * value at whole-number n, so an equivalence test has to sample those names
 * over the integers — a real-valued sample would make every evaluation NaN and
 * a true identity like Σ_{k=1}^{n} k = n(n+1)/2 undecidable.
 */
function integerVarsOf(ast, acc = new Set()) {
  if (!ast || typeof ast !== 'object') return acc;
  if (ast.t === 'call' && ast.fn === 'sum' && Array.isArray(ast.args) && ast.args.length === 4) {
    variablesOf(ast.args[2], acc);
    variablesOf(ast.args[3], acc);
  }
  for (const key of ['l', 'r', 'v', 'arg']) {
    if (ast[key] && typeof ast[key] === 'object') integerVarsOf(ast[key], acc);
  }
  if (Array.isArray(ast.args)) for (const a of ast.args) integerVarsOf(a, acc);
  return acc;
}

/** Parse + evaluate a variable-free expression to a number. Throws on failure. */
export function evalNumeric(input, env = {}) {
  const ast = parse(input);
  if (ast.t === 'equation') throw new Error('Expected a value, not an equation');
  const value = evaluate(ast, env);
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error('Could not evaluate');
  }
  return value;
}

// ── Equivalence testing ──────────────────────────────────────────────────────

const SAMPLE_SETS = [
  [0.7, 1.3, -0.6, 2.1, -1.7, 0.35, 3.4, -2.3],
  [1.9, -0.9, 0.15, 2.8, -3.1, 1.1, -1.35, 0.55]
];

// ── Domain probing ───────────────────────────────────────────────────────────
//
// Sampling at fixed points cannot see a removable hole: x/x and 1 agree at every
// sample, but only one of them is defined at 0. A final answer is a claim about
// a function, so where `strictDomain` is set the two sides must also agree on
// where they are defined. The points that can differ are the ones where a
// denominator vanishes or a log/root argument leaves its domain, so those
// "guard" subexpressions are collected from both sides and their real roots
// located directly rather than hoping a sample happens to land on them:
//
// · a guard that is a polynomial in the variable (x − 25, x² − 50, 0.001x − 5)
//   has its coefficients recovered exactly, linear and quadratic roots are
//   solved in closed form, and higher degrees are searched inside the Cauchy
//   bound, so a hole is found wherever on the real line it is;
// · any other guard (eˣ − e, cos x, √x − 5.5) is searched finely on [−20, 20]
//   and coarsely, by whole numbers and sign changes, on [−1000, 1000].
//
// Each root is probed at the root and just either side of it, since a sign
// guard (√(x + 30), ln(x − 30)) changes definedness across its root rather than
// at it.
//
// The probe never reads e or π as a variable (e is Euler's number here even
// though the tokenizer spells it as a one-letter name), and it reads a negative
// base under an odd-denominator power as the real odd root, so x^(1/3) and
// cbrt(x) share a domain. Residual limitation: a non-polynomial guard whose
// only roots lie beyond |x| = 20 and are not whole numbers or sign changes on
// the whole-number grid (a tangency far out) is not seen.

const LOG_FNS = new Set(['ln', 'log', 'log10', 'log2']);
const POLE_FNS = { sec: 'cos', cosec: 'sin', csc: 'sin', cot: 'sin' };
/** Names the probe treats as constants, never as variables to search over. */
const DOMAIN_CONSTANTS = new Set(['e', 'pi']);
const DOMAIN_EVAL = { realOddRoots: true };
const domainEval = (ast, env) => evaluate(ast, env, DOMAIN_EVAL);
/** The sample env as the domain probe reads it: e and π are never variables. */
function domainEnv(env) {
  const out = { ...env };
  for (const n of DOMAIN_CONSTANTS) delete out[n];
  return out;
}

/** Subexpressions whose zeros (or sign) bound where an expression is defined. */
function guardsOf(ast, acc = []) {
  if (!ast || typeof ast !== 'object') return acc;
  if (ast.t === 'bin' && ast.op === '/') acc.push({ kind: 'nonzero', g: ast.r });
  if (ast.t === 'bin' && ast.op === '^') acc.push({ kind: 'base', g: ast.l, e: ast.r });
  if (ast.t === 'call' && !Array.isArray(ast.args)) {
    if (LOG_FNS.has(ast.fn)) acc.push({ kind: 'positive', g: ast.arg });
    if (ast.fn === 'sqrt') acc.push({ kind: 'nonnegative', g: ast.arg });
    if (ast.fn === 'tan') acc.push({ kind: 'nonzero', g: { t: 'call', fn: 'cos', arg: ast.arg } });
    if (POLE_FNS[ast.fn]) acc.push({ kind: 'nonzero', g: { t: 'call', fn: POLE_FNS[ast.fn], arg: ast.arg } });
  }
  if (Array.isArray(ast.args)) { if (ast.fn !== 'sum') for (const a of ast.args) guardsOf(a, acc); return acc; }
  for (const key of ['l', 'r', 'v', 'arg']) if (ast[key] && typeof ast[key] === 'object') guardsOf(ast[key], acc);
  return acc;
}

const NEAR_ZERO = 1e-9;

/**
 * Is the expression defined at env? Exact evaluation decides wherever it can;
 * the guard tolerance only matters at a located root such as √2, where floating
 * point leaves a denominator at 1e-16 rather than 0.
 */
function definedAt(ast, guards, env) {
  if (!Number.isFinite(domainEval(ast, env))) return false;
  for (const { kind, g, e } of guards) {
    const v = domainEval(g, env);
    if (!Number.isFinite(v)) return false;
    if (kind === 'nonzero' && Math.abs(v) <= NEAR_ZERO) return false;
    if (kind === 'positive' && v <= NEAR_ZERO) return false;
    if (kind === 'nonnegative' && v < -NEAR_ZERO) return false;
    if (kind === 'base' && Math.abs(v) <= NEAR_ZERO) {
      const ev = domainEval(e, env);
      if (!(ev > 0)) return false;          // 0^0 and 0^negative are undefined
    }
  }
  return true;
}

const POLY_MAX_DEGREE = 6;

/**
 * If x ↦ g(x) is a polynomial of degree ≤ 6, its coefficients [c0, c1, …]
 * (trailing zeros trimmed); otherwise null. Fitted exactly through x = 0‥6 and
 * confirmed at off-grid points, so √x, eˣ and 1/x are rejected.
 */
function polynomialOf(at) {
  const n = POLY_MAX_DEGREE + 1;
  const A = [], y = [];
  for (let i = 0; i < n; i++) {
    const v = at(i);
    if (!Number.isFinite(v)) return null;
    A.push(Array.from({ length: n }, (_, k) => i ** k));
    y.push(v);
  }
  // Gaussian elimination with partial pivoting on the 7×7 Vandermonde system
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [y[c], y[p]] = [y[p], y[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      y[r] -= f * y[c];
    }
  }
  const coef = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = y[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * coef[k];
    coef[r] = s / A[r][r];
  }
  const scale = Math.max(1, ...coef.map(Math.abs));
  for (let k = 0; k < n; k++) {
    const nearest = Math.round(coef[k]);
    if (Math.abs(coef[k] - nearest) < 1e-9 * scale) coef[k] = nearest;
    if (Math.abs(coef[k]) < 1e-10 * scale) coef[k] = 0;
  }
  const poly = x => coef.reduce((s, c, k) => s + c * x ** k, 0);
  for (const x of [-1.37, 0.43, 2.71, -7.9, 11.3]) {
    const v = at(x), p = poly(x);
    if (!Number.isFinite(v) || Math.abs(v - p) > 1e-7 * Math.max(1, Math.abs(v), Math.abs(p))) return null;
  }
  while (coef.length > 1 && coef[coef.length - 1] === 0) coef.pop();
  return coef;
}

/** Real roots of g(name) on [lo, hi] by a grid of N steps, with the other variables fixed by env. */
function gridRoots(at, lo, hi, N, { halves = true, tangencies = true, skip = null, cap = Infinity } = {}) {
  const roots = [];
  const xs = [], ys = [];
  for (let i = 0; i <= N; i++) { const x = lo + (i / N) * (hi - lo); xs.push(x); ys.push(at(x)); }
  // whole numbers and halves are where authored questions put their holes
  if (halves && hi - lo <= 200) for (let k = Math.ceil(lo * 2); k <= hi * 2; k++) if (at(k / 2) === 0) roots.push(k / 2);
  for (let i = 0; i < N && roots.length < cap; i++) {
    const [y0, y1] = [ys[i], ys[i + 1]];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    // `skip` is an interval already searched more finely
    if (skip && xs[i] >= skip[0] && xs[i + 1] <= skip[1]) continue;
    if (y0 === 0) { roots.push(xs[i]); continue; }
    if (Math.sign(y0) !== Math.sign(y1) && y1 !== 0) {
      let a = xs[i], b = xs[i + 1], fa = y0;
      for (let k = 0; k < 80; k++) { const m = (a + b) / 2, fm = at(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
      roots.push((a + b) / 2);
    }
    // a double root (x² in a denominator) touches zero without crossing
    if (tangencies && i > 0 && Math.abs(y0) < Math.abs(ys[i - 1]) && Math.abs(y0) <= Math.abs(y1)) {
      let a = xs[i - 1], b = xs[i + 1];
      for (let k = 0; k < 100; k++) {
        const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
        if (Math.abs(at(m1)) < Math.abs(at(m2))) b = m2; else a = m1;
      }
      const m = (a + b) / 2;
      if (Math.abs(at(m)) <= 1e-7) roots.push(m);
    }
  }
  if (ys[N] === 0) roots.push(xs[N]);
  return roots;
}

const NEAR_RANGE = [-20, 20];
const FAR_RANGE = [-1000, 1000];
const FAR_ROOT_CAP = 16;

/**
 * Real roots of g as a function of `name` (other variables fixed by env),
 * within [lo, hi] — which is ±∞ when no domain was authored.
 */
function rootsOf(g, name, env, lo, hi) {
  const at = x => domainEval(g, { ...env, [name]: x });
  const inside = x => x >= lo && x <= hi;
  const coef = polynomialOf(at);
  if (coef) {
    const d = coef.length - 1;
    if (d === 0) return [];
    if (d === 1) return [-coef[0] / coef[1]].filter(inside);
    if (d === 2) {
      const [c, b, a] = coef;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return [];
      // the stable form avoids cancellation when b² ≫ 4ac
      const q = -(b + (b >= 0 ? 1 : -1) * Math.sqrt(disc)) / 2;
      const rs = [q / a];
      if (q !== 0) rs.push(c / q);
      return rs.filter(inside);
    }
    // every real root lies within the Cauchy bound
    const B = 1 + Math.max(...coef.slice(0, -1).map(c => Math.abs(c / coef[d])));
    const [a, b] = [Math.max(lo, -B), Math.min(hi, B)];
    if (!(b > a)) return [];
    return gridRoots(at, a, b, Math.min(4000, Math.max(800, Math.ceil((b - a) / 0.05))));
  }
  const roots = [];
  const [na, nb] = [Math.max(lo, NEAR_RANGE[0]), Math.min(hi, NEAR_RANGE[1])];
  if (nb > na) roots.push(...gridRoots(at, na, nb, 800));
  const [fa, fb] = [Math.max(lo, FAR_RANGE[0]), Math.min(hi, FAR_RANGE[1])];
  if (fb > fa && (fa < na || fb > nb)) {
    const a = Math.ceil(fa), b = Math.floor(fb);
    if (b > a) {
      // a periodic guard is already represented on the fine grid, so the far
      // scan stops after a few roots: it exists to catch an isolated far hole
      roots.push(...gridRoots(at, a, b, b - a, {
        halves: false, tangencies: false, skip: nb > na ? [na, nb] : null, cap: FAR_ROOT_CAP
      }));
    }
  }
  return roots;
}

/**
 * Do a and b fail to be defined at the same places? Returns true on the first
 * point where exactly one side is defined. `range` bounds where to look (the
 * whole real line when none is authored), so an authored domain that excludes
 * a hole accepts the cancelled form.
 */
function definednessDiffers(astA, astB, names, integers, baseEnvs, range, positiveOnly) {
  const guardsA = guardsOf(astA), guardsB = guardsOf(astB);
  const all = [...guardsA, ...guardsB];
  if (!all.length) return false;
  const [lo, hi] = positiveOnly ? [Math.max(range[0], 1e-6), range[1]] : range;
  if (!(hi > lo)) return false;
  for (const env of baseEnvs) {
    for (const name of names) {
      if (integers.has(name)) continue;
      const points = [];
      for (const { g } of all) points.push(...rootsOf(g, name, env, lo, hi));
      for (const p of points) {
        const delta = Math.max(1e-4, Math.abs(p) * 1e-6);
        const at = { ...env, [name]: p };
        if (definedAt(astA, guardsA, at) !== definedAt(astB, guardsB, at)) return true;
        // beside the root nothing is near zero, so exact evaluation decides
        // there; the guard tolerance would misread x³ at x = 10⁻⁴ as a pole
        for (const x of [p - delta, p + delta]) {
          if (x < lo || x > hi) continue;
          const side = { ...env, [name]: x };
          if (Number.isFinite(domainEval(astA, side)) !== Number.isFinite(domainEval(astB, side))) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Are two expressions equivalent as functions of their variables?
 * Samples both over shared variable assignments and compares.
 *
 * `strictDomain` additionally requires the two to be defined at the same
 * points (see Domain probing above). Use it where the expression is the
 * student's final answer. Leave it off for a line of working compared with the
 * expression the working started from: cancelling a common factor is a valid
 * step, and the line after it is meant to lose the hole.
 */
export function exprEquivalent(a, b, opts = {}) {
  let astA, astB;
  try { astA = typeof a === 'string' ? parse(a) : a; astB = typeof b === 'string' ? parse(b) : b; }
  catch { return false; }
  if (astA.t === 'equation' || astB.t === 'equation') return false;

  const vars = new Set([...variablesOf(astA), ...variablesOf(astB)]);
  const names = [...vars];
  const integers = new Set([...integerVarsOf(astA), ...integerVarsOf(astB)]);
  const domain = opts.domain || [-3.5, 3.5];
  const needed = opts.samples || 8;
  let matches = 0, valid = 0;
  const envs = [];

  for (const base of SAMPLE_SETS) {
    for (let s = 0; s < base.length && valid < needed; s++) {
      const env = {};
      names.forEach((n, idx) => {
        const raw = base[(s + idx * 3) % base.length];
        if (integers.has(n)) { env[n] = 1 + Math.floor(((raw + 3.5) / 7) * 8); return; }   // 1‥8
        env[n] = domain[0] + ((raw + 3.5) / 7) * (domain[1] - domain[0]);
        if (opts.positiveOnly) env[n] = Math.abs(env[n]) + 0.3;
      });
      const va = evaluate(astA, env);
      const vb = evaluate(astB, env);
      if (opts.strictDomain) {
        // definedness is judged with e as Euler's number and odd roots real
        const denv = domainEnv(env);
        const da = domainEval(astA, denv), db = domainEval(astB, denv);
        if (Number.isFinite(da) !== Number.isFinite(db)) return false;
        // where an odd root makes both sides real, they must also agree there:
        // (x²)^(1/6) is |x|^(1/3), not x^(1/3)
        if (Number.isFinite(da) && Math.abs(da - db) > 1e-6 * Math.max(1, Math.abs(da), Math.abs(db))) return false;
        envs.push(denv);
      }
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      valid++;
      const scale = Math.max(1, Math.abs(va), Math.abs(vb));
      if (Math.abs(va - vb) > 1e-6 * scale) return false;
      matches++;
    }
  }
  if (!(valid >= Math.min(3, needed) && matches === valid)) return false;
  if (opts.strictDomain) {
    // Without an authored domain, look along the whole real line: a hole at
    // x = 25 is as real as one at x = 1.
    const range = opts.domain || [-Infinity, Infinity];
    const domainNames = names.filter(n => !DOMAIN_CONSTANTS.has(n));
    const bases = envs.filter(env => domainNames.every(n => Number.isFinite(env[n]))).slice(0, 2);
    if (definednessDiffers(astA, astB, domainNames, integers, bases, range, opts.positiveOnly)) return false;
  }
  return true;
}

/**
 * Compare two numbers with sensible tolerance.
 *
 * An authored `tol` always wins — that is how a question says its answer is
 * measured or rounded. With no authored tolerance the default depends on the
 * target: a whole number is an exact answer (12 m² is 120000 cm², not 120012),
 * so it is compared to within floating-point noise only, while a target that
 * is not a whole number is the result of a real calculation and keeps the
 * relative 1e-4 band that forgives a student's rounding. The exact band is
 * capped well below a half so no other whole number can ever fall inside it.
 */
export function numsClose(a, b, tol) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const t = tol ?? (Number.isInteger(b)
    ? Math.min(0.25, Math.max(1e-9, Math.abs(b) * 1e-9))
    : Math.max(1e-6, Math.abs(b) * 1e-4));
  return Math.abs(a - b) <= t;
}
