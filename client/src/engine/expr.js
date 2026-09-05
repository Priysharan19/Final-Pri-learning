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

export function evaluate(ast, env = {}) {
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
    case 'group': return evaluate(ast.v, env);
    case 'neg': return -evaluate(ast.v, env);
    case 'fact': return factorial(evaluate(ast.v, env));
    case 'call': {
      if (Array.isArray(ast.args)) {
        if (ast.fn === 'sum') {
          // sum(term; k; a; b): the bound variable shadows anything in env
          if (ast.args.length !== 4) return NaN;
          const bound = ast.args[1];
          const name = bound && (bound.t === 'var' || bound.t === 'const') ? bound.v : null;
          if (!name) return NaN;
          const lo = evaluate(ast.args[2], env), hi = evaluate(ast.args[3], env);
          if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi - lo > SUM_LIMIT) return NaN;
          let total = 0;
          for (let k = lo; k <= hi; k++) total += evaluate(ast.args[0], { ...env, [name]: k });
          return total;
        }
        const f = MULTI_FUNCTIONS[ast.fn];
        if (!f || ast.args.length !== f.length) return NaN;
        return f(...ast.args.map(a => evaluate(a, env)));
      }
      if (MULTI_FUNCTIONS[ast.fn] || ast.fn === 'sum') return NaN;
      const a = evaluate(ast.arg, env);
      const f = FUNCTIONS[ast.fn];
      if (!f) return NaN;
      return f(a);
    }
    case 'bin': {
      const l = evaluate(ast.l, env);
      const r = evaluate(ast.r, env);
      switch (ast.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? NaN : l / r;
        case '^': {
          if (l < 0 && !Number.isInteger(r)) return NaN; // stay real
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

/**
 * Are two expressions equivalent as functions of their variables?
 * Samples both over shared variable assignments and compares.
 */
export function exprEquivalent(a, b, opts = {}) {
  let astA, astB;
  try { astA = typeof a === 'string' ? parse(a) : a; astB = typeof b === 'string' ? parse(b) : b; }
  catch { return false; }
  if (astA.t === 'equation' || astB.t === 'equation') return false;

  const vars = new Set([...variablesOf(astA), ...variablesOf(astB)]);
  const names = [...vars];
  const domain = opts.domain || [-3.5, 3.5];
  const needed = opts.samples || 8;
  let matches = 0, valid = 0;

  for (const base of SAMPLE_SETS) {
    for (let s = 0; s < base.length && valid < needed; s++) {
      const env = {};
      names.forEach((n, idx) => {
        const raw = base[(s + idx * 3) % base.length];
        env[n] = domain[0] + ((raw + 3.5) / 7) * (domain[1] - domain[0]);
        if (opts.positiveOnly) env[n] = Math.abs(env[n]) + 0.3;
      });
      const va = evaluate(astA, env);
      const vb = evaluate(astB, env);
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      valid++;
      const scale = Math.max(1, Math.abs(va), Math.abs(vb));
      if (Math.abs(va - vb) > 1e-6 * scale) return false;
      matches++;
    }
  }
  return valid >= Math.min(3, needed) && matches === valid;
}

/** Compare two numbers with sensible tolerance. */
export function numsClose(a, b, tol) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const t = tol ?? Math.max(1e-6, Math.abs(b) * 1e-4);
  return Math.abs(a - b) <= t;
}
