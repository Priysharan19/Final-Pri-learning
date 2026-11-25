// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the reader's TeX, as the plain text the engine reads
//
// The handwriting reader gives each line a plain `text` and a `latex`. The plain
// text flattens structure (`e^{x}(2x-4)` becomes `ex(2x-4)`, a stacked fraction
// becomes `a/b c`); the TeX keeps it. This turns a TeX line into the text form
// the line checker reads (`e^(x)*(2x-4)`, `(a)/(b)`), so the checker can look at
// the structure the student wrote.
//
// It is a strict converter, not a TeX engine. A TeX it does not fully
// understand — an unknown command, a subscript it cannot place, a stray group,
// an index it cannot name, a mixed number — returns null, and the caller
// keeps the plain text exactly as it was. Nothing is guessed.
//
// A converted line is a second READING of the same line. It is used only to
// tick or to leave a note, never to cross (arithmeticLines.js). Pure.
//
// TWO MODES. The base mode is what the reader has always read, byte for byte; every caller that does not ask for more gets it. The EXTENDED mode
// (`texToPlain(tex, EXTENDED_TEX)`) adds, each only where the TeX is certain:
//   degrees after a number (90^\circ is 90°; the line checker reads that as radians and ticks only); counting (\binom{n}{r}, {}^nC_r, {}^nP_r);
//   powered and inverse trig (\sin^{2}x is sin(x)^(2); \sin^{-1}x is arcsin(x)); logs to a base (\log_2 x is (log(x)/log(2)));
//   whole integrals with limits and the answer after the dx, and indefinite integrals; primes (y', f''(x)); a time derivative as one named quantity
//   ((dotx), never the letters d, o, t, x); ± as the two statements; |x| as abs(x); roots of index 2 to 12; the percent sign after a number;
//   a function followed by another (\sin x\cos x); the Greek letters alpha and beta (the engine's own atoms).
// It reads NONE of: phi, lambda, mu, sigma, gamma (the engine has no atom for them, and a run of letters would be a product), \text words,
// aligned environments (texSafe.js refuses them), vectors, sums, limits, sets, a relation arrow (\to) or any TeX it is not sure of.
// The extended mode is used for the author's bank (solutionMatch.withBankReading) and for a student's reader TeX on an Australian question (opts.extendedTex).
// client/test/tex-faithful-check.mjs proves each construct, and every step of the bank it reads, by VALUE against an independent evaluator.
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log', 'exp', 'arcsin', 'arccos', 'arctan']);
const SYMBOLS = {
  cdot: '*', times: '*', div: '/', pi: 'π', theta: 'θ',
  le: '<=', leq: '<=', ge: '>=', geq: '>=', ne: '!=', neq: '!=', approx: '≈'
};
const SPACES = new Set([',', ';', '!', ' ', ':', 'quad', 'qquad', 'displaystyle']);
const MAX_OUT = 400;
const PLAIN = /^[A-Za-z0-9+\-=.()\[\]\/!−×÷·≤≥≠≈πθ√²³]$/;
const STARTS_OPERAND = /^[A-Za-z0-9(πθ√∫]/;
const STARTS_OPERAND_BASE = /^[A-Za-z0-9(πθ√]/;
// The reader has two modes. The BASE mode is what it has always read, byte for byte (every caller that does not ask for more gets it). The EXTENDED mode,
// asked for with `{ extended: true }`, adds the constructs below; it is used for a student's reader TeX on an Australian question and for the author's bank.
let EXTENDED = false;
const GREEK = { alpha: 'alpha', beta: 'beta' };   // the engine's own two atoms besides θ and π; φ, λ, μ, σ have none, so they are not read (a run of letters would be a product)
// a number that stands alone at the end (not an exponent, not part of a name)
const NUMBER_END = /(?:^|[^A-Za-z0-9.^_)])\d+(?:\.\d+)?$/;
const INVERSE = new Set(['sin', 'cos', 'tan']);
// After a bare function argument these commands only continue the line (an operator, a relation or a bracket), so the argument was not run into more maths.
const AFTER_ARG = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log', 'exp', 'cdot', 'times', 'div', 'le', 'leq', 'ge', 'geq', 'ne', 'neq', 'approx', 'quad', 'qquad', 'right', ',', ';', '!', ':']);

// A fraction's parts are bracketed, except a plain number (the whole fraction is then `(1/2)`, which no line label matches).
const wrap = x => (/^\d+(?:\.\d+)?$/.test(x) ? x : `(${x})`);

class Stop extends Error { constructor(why) { super(why); this.why = why; } }
const stop = why => { throw new Stop(why || 'layout'); };

class Reader {
  constructor(src) { this.s = src; this.i = 0; }
  done() { return this.i >= this.s.length; }
  peek() { return this.s[this.i]; }
  skipSpace() { while (this.s[this.i] === ' ') this.i += 1; }
  /** The name of the command at the cursor (cursor on the backslash), consumed. */
  command() {
    const m = /^\\([A-Za-z]+|.)/s.exec(this.s.slice(this.i));
    if (!m) stop();
    this.i += m[0].length;
    return m[1];
  }
  /** The cursor is on `{`: the source between it and its match, consumed. */
  group() {
    if (this.peek() !== '{') stop();
    let depth = 0;
    for (let k = this.i; k < this.s.length; k++) {
      const ch = this.s[k];
      if (ch === '\\') { k += 1; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}' && --depth === 0) { const body = this.s.slice(this.i + 1, k); this.i = k + 1; return body; }
    }
    return stop();
  }
  /** The cursor is on `(` or `\\left(`: the source between it and its matching `)` or `\\right)`, consumed. */
  bracket() {
    const left = this.s.startsWith('\\left(', this.i);
    const from = this.i + (left ? 6 : 1);
    let depth = 1;
    for (let k = from; k < this.s.length; k++) {
      if (this.s.startsWith('\\left(', k)) { depth += 1; k += 5; continue; }
      if (this.s.startsWith('\\right)', k)) { if (--depth === 0) { const body = this.s.slice(from, k); this.i = k + 7; return body; } k += 6; continue; }
      const ch = this.s[k];
      if (ch === '\\') { k += 1; continue; }
      if (ch === '(') depth += 1;
      else if (ch === ')' && --depth === 0) { const body = this.s.slice(from, k); this.i = k + 1; return body; }
    }
    return stop('bracket');
  }
  /** One argument: a braced group, or a single digit, letter or command. */
  argument() {
    this.skipSpace();
    if (this.peek() === '{') return this.group();
    if (this.peek() === '\\') { const at = this.i; this.command(); return this.s.slice(at, this.i); }
    const ch = this.peek();
    if (ch !== undefined && /[A-Za-z0-9]/.test(ch)) { this.i += 1; return ch; }
    return stop();
  }
}

/** Convert a run of TeX to text; throws Stop when any part is not understood. */
function convert(src, depth = 0) {
  if (depth > 6) stop();
  const r = new Reader(src);
  let out = '';
  let mul = false;   // an exponent, a fraction or a root just ended: an operand next is a product
  const emit = piece => {
    if (!piece) return;
    if (mul && (EXTENDED ? STARTS_OPERAND : STARTS_OPERAND_BASE).test(piece)) out = out.replace(/ +$/, '') + '*';
    mul = false;
    out += piece;
  };
  const prevEnd = () => out.replace(/ +$/, '').slice(-1);
  let counted = false;   // `{}` has just been read: a ^ next may open a counting form (^5C_2)
  // nCr and nPr: whole numbers are the inline form the line checker reads, (10C3); anything else is the engine's own ncr(n;r), npr(n;r)
  const counting = (f, n, k) => {
    if (!n || !k) stop('counting');
    const p = prevEnd();
    if (/[A-Za-z0-9)πθ]/.test(p)) { out = out.replace(/ +$/, '') + '*'; mul = false; }
    emit(/^\d{1,3}$/.test(n) && /^\d{1,3}$/.test(k) ? `(${n}${f}${k})` : `${f === 'C' ? 'ncr' : 'npr'}(${n};${k})`);
    mul = true;
  };
  const countingForm = () => {
    const was = counted;
    counted = false;
    const m = /^\^\s*(\{[^{}]+\}|[0-9a-z])\s*([CP])\s*_\s*(\{[^{}]+\}|[0-9a-z])/.exec(r.s.slice(r.i));
    if (!m) return false;
    const tr = out.replace(/ +$/, '');
    if (!was && tr && !/[+\-*/=(]$/.test(tr)) return false;
    const bare = x => (x[0] === '{' ? x.slice(1, -1) : x);
    r.i += m[0].length;
    counting(m[2], convert(bare(m[1]), depth + 1).trim(), convert(bare(m[3]), depth + 1).trim());
    return true;
  };
  const times = () => { const p = prevEnd(); if (/\d/.test(p)) return stop(); if (/[A-Za-z)πθ]/.test(p)) out = out.replace(/ +$/, '') + '*'; };
  while (!r.done()) {
    const ch = r.peek();
    if (ch === ' ') { r.i += 1; if (out && !out.endsWith(' ')) out += ' '; continue; }
    if (ch === '\\') {
      const name = r.command();
      if (SPACES.has(name)) { if (out && !out.endsWith(' ')) out += ' '; continue; }
      if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) {
        const s = SYMBOLS[name];
        if (s === '*' || s === '/' || s === '<=' || s === '>=' || s === '!=' || s === '≈') { mul = false; out += s; } else emit(s);
        continue;
      }
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const a = convert(r.argument(), depth + 1), b = convert(r.argument(), depth + 1);
        if (!a.trim() || !b.trim()) stop();
        times();
        mul = false;
        out += `(${wrap(a.trim())}/${wrap(b.trim())})`;   // one grouped value: 12 ÷ ¾ is 12/(3/4), (3/2)² is (3/2)^2
        mul = true;
        continue;
      }
      if (name === 'sqrt') {
        let index = null;
        r.skipSpace();
        if (r.peek() === '[') { const end = r.s.indexOf(']', r.i); if (end < 0) stop(); index = r.s.slice(r.i + 1, end).trim(); r.i = end + 1; }
        const inner = convert(r.argument(), depth + 1).trim();
        if (!inner) stop();
        if (index !== null && !(EXTENDED ? /^(?:[2-9]|1[0-2])$/ : /^3$/).test(index)) stop('root-index');
        const p = prevEnd();
        if (/[A-Za-z0-9)πθ]/.test(p)) { out = out.replace(/ +$/, '') + '*'; mul = false; }
        // a root of an index other than 2 and 3 is the power 1/n of a value that is not negative; where it is, the two agree
        emit(index === null || index === '2' ? `sqrt(${inner})` : index === '3' ? `cbrt(${inner})` : `(${inner})^(1/${index})`);
        mul = true;
        continue;
      }
      if (FUNCTIONS.has(name)) {
        if (!EXTENDED) {
          r.skipSpace();
          if (r.peek() === '^' || r.peek() === '_') stop('function-power');
          if (r.peek() === '(' || r.s.startsWith('\\left(', r.i)) { emit(name); continue; }
          // One bare argument, read only where the page can be read one way: a number and a letter (sin 2θ), a letter, a group.
          let arg0 = '';
          if (r.peek() === '{') arg0 = convert(r.group(), depth + 1).trim();
          else {
            const m = /^(?:\d+(?:\.\d+)?)?(?:[A-Za-z]|\\theta|\\pi)?/.exec(r.s.slice(r.i));
            if (!m || !m[0]) return stop('function-argument');
            r.i += m[0].length;
            arg0 = convert(m[0], depth + 1).trim();
            const after0 = r.peek();
            if (after0 !== undefined && /[A-Za-z0-9(^_\\{]/.test(after0)) return stop('function-argument');
          }
          if (!arg0) stop();
          emit(`${name}(${arg0})`);
          continue;
        }
        r.skipSpace();
        let fn = name, power = null, base = null;
        // sin^{2}x is (sin x)^2; sin^{-1}x is the inverse function (arcsin), the courses' meaning, never the reciprocal
        if (r.peek() === '^') {
          if (!/^(?:sin|cos|tan|sec|csc|cot)$/.test(name)) stop('function-power');
          r.i += 1;
          power = convert(r.argument(), depth + 1).trim();
          if (power === '-1') { if (!INVERSE.has(name)) stop('function-power'); fn = `arc${name}`; power = null; }
          else if (!/^[2-9]$|^1[0-2]$/.test(power)) stop('function-power');
          r.skipSpace();
        }
        // \log_{b}: the base is a whole number 2 to 99 or a letter; the value is log x / log b, which holds for any base of log in the ratio
        if (r.peek() === '_') {
          if (name !== 'log' || power !== null) stop('subscript');
          r.i += 1;
          base = convert(r.argument(), depth + 1).trim();
          if (!/^(?:[2-9]|[1-9]\d)$|^[a-df-z]$/.test(base)) stop('log-base');
          r.skipSpace();
        }
        if (r.peek() === '^' || r.peek() === '_') stop('function-power');
        let arg = '';
        if (r.peek() === '(' || r.s.startsWith('\\left(', r.i)) {
          if (power === null && base === null) { emit(fn); continue; }
          arg = `(${convert(r.bracket(), depth + 1).trim()})`;
          if (arg === '()') stop();
        } else if (r.peek() === '{') arg = convert(r.group(), depth + 1).trim();
        else if (r.peek() === '\\' && /^\\(?:[dt]?frac|sqrt)(?![A-Za-z])/.test(r.s.slice(r.i))) {
          // a fraction or a root straight after the function is its whole argument: tan^{-1}\tfrac{3}{4}, \log_2\sqrt8
          const at = r.i; r.command();
          if (/^\\sqrt/.test(r.s.slice(at))) { r.skipSpace(); if (r.peek() === '[') { const end = r.s.indexOf(']', r.i); if (end < 0) stop(); r.i = end + 1; } }
          r.argument(); if (!/^\\sqrt/.test(r.s.slice(at))) r.argument();
          arg = convert(r.s.slice(at, r.i), depth + 1).trim();
        } else {
          // One bare argument, read only where the page can be read one way: a number and a letter (sin 2θ), an angle in degrees (sin 30°), a letter, a group.
          const m = /^(?:\d+(?:\.\d+)?(?:\^\\circ|\^\{\\circ\})|(?:\d+(?:\.\d+)?)?(?:[A-Za-z]|\\theta|\\pi|\\alpha|\\beta)?)/.exec(r.s.slice(r.i));
          if (!m || !m[0]) return stop('function-argument');
          r.i += m[0].length;
          arg = convert(m[0], depth + 1).trim();
          // what follows must not run into the argument: a letter, digit, bracket or script after it could be part of it (sin x y, sin 2 3)
          const rest = r.s.slice(r.i).replace(/^ +/, '');
          const after = rest[0];
          if (after !== undefined && /[A-Za-z0-9(^_{]/.test(after)) return stop('function-argument');
          if (after === '\\') { const nm = /^\\([A-Za-z]+|.)/s.exec(rest); if (!nm || !AFTER_ARG.has(nm[1])) return stop('function-argument'); }
        }
        if (!arg) stop();
        if (base !== null) {
          emit(`(log(${arg})/log(${base}))`);
        } else emit(`${fn}(${arg})${power !== null ? `^(${power})` : ''}`);
        mul = true;
        continue;
      }
      if (name === 'left' || name === 'right') {
        const b = r.peek();
        if (EXTENDED && name === 'left' && b === '|') {
          // |x|: the absolute value, read to its matching \right| (a nested pair is not read)
          const from = r.i + 1, end = r.s.indexOf('\\right|', from);
          if (end < 0 || r.s.slice(from, end).includes('\\left')) stop('absolute-value');
          const inner = convert(r.s.slice(from, end), depth + 1).trim();
          if (!inner) stop();
          r.i = end + 7;
          emit(`abs(${inner})`);
          mul = true;
          continue;
        }
        if (b === undefined || !/[()\[\]]/.test(b)) stop('left-right');
        r.i += 1;
        if (b === '(' || b === '[') emit(b); else { mul = false; out += b; }
        continue;
      }
      if (name === 'mathrm') {
        const t = r.argument();
        if (!/^[A-Za-z]$/.test(t)) stop();
        emit(t);
        continue;
      }
      if (EXTENDED && Object.prototype.hasOwnProperty.call(GREEK, name)) {
        const p = prevEnd();
        if (/[A-Za-z]/.test(p)) { out = out.replace(/ +$/, '') + '*'; mul = false; }
        emit(GREEK[name]);
        mul = true;
        continue;
      }
      if (EXTENDED && name === 'prime') {
        if (!/[A-Za-z]'?$/.test(out.replace(/ +$/, ''))) stop('prime');
        out = out.replace(/ +$/, '') + "'";
        continue;
      }
      if (EXTENDED && name === '%') {
        if (!NUMBER_END.test(out.replace(/ +$/, ''))) stop('percent');
        out = out.replace(/ +$/, '') + '%';
        mul = false;
        continue;
      }
      if (EXTENDED && (name === 'dot' || name === 'ddot')) {
        // a time derivative is a quantity of its own: a letter with a dot is one named atom (dotA, ddotx), never the letters d o t and A. Checked at the end.
        const a = r.argument().trim();
        if (!/^[A-Za-z]$/.test(a) || a === 'e') stop('dot');
        const p = prevEnd();
        if (/[A-Za-z]/.test(p)) { out = out.replace(/ +$/, '') + '*'; mul = false; }
        emit(`(${name}${a})`);   // bracketed: \dot y^{2} is (dot y) squared, and a power would otherwise land on the letter y alone
        mul = true;
        continue;
      }
      if (EXTENDED && (name === 'binom' || name === 'dbinom' || name === 'tbinom')) {
        const n = convert(r.argument(), depth + 1).trim(), k = convert(r.argument(), depth + 1).trim();
        counting('C', n, k);
        continue;
      }
      if (name === 'int' && !EXTENDED) {
        // The form arithmeticLines reads: ∫_{lo}^{hi} body dx, with limits that are plain numbers, and nothing after the dx.
        r.skipSpace();
        if (r.peek() !== '_') stop('integral-limits');
        r.i += 1;
        const lo = convert(r.argument(), depth + 1).trim();
        r.skipSpace();
        if (r.peek() !== '^') stop('integral-limits');
        r.i += 1;
        const hi = convert(r.argument(), depth + 1).trim();
        const rest = r.s.slice(r.i);
        const m = /^(.*?)(?:\\[,;!]|\s)*(?:\\mathrm\{d\}|d)([a-z])\s*$/s.exec(rest);
        if (!m || !lo || !hi) stop('integral-differential');
        const body = convert(m[1], depth + 1).trim();
        if (!body) stop();
        r.i = r.s.length;
        emit(`∫_{${lo}}^{${hi}} ${body} d${m[2]}`);
        continue;
      }
      if (name === 'int') {
        // ∫_{lo}^{hi} body dx (a definite integral the line checker works out) or ∫ body dx; the integrand ends at the first dx outside any braces
        r.skipSpace();
        let lo = null, hi = null;
        if (r.peek() === '_') {
          r.i += 1;
          lo = convert(r.argument(), depth + 1).trim();
          r.skipSpace();
          if (r.peek() !== '^') stop('integral-limits');
          r.i += 1;
          hi = convert(r.argument(), depth + 1).trim();
          if (!lo || !hi) stop('integral-limits');
        } else if (r.peek() === '^') stop('integral-limits');
        const rest = r.s.slice(r.i);
        let level = 0, cut = -1, dv = null, after = 0;
        for (let k = 0; k < rest.length; k++) {
          const c = rest[k];
          if (c === '\\') {
            if (/^\\int(?![A-Za-z])/.test(rest.slice(k))) stop('nested-integral');
            const m = /^\\mathrm\{d\}([a-z])(?![A-Za-z0-9])/.exec(rest.slice(k));
            if (level === 0 && m) { cut = k; dv = m[1]; after = k + m[0].length; break; }
            k += 1; continue;
          }
          if (c === '{') level += 1; else if (c === '}') level -= 1;
          else if (c === '=' && level === 0) stop('integral-body');
          else if (level === 0 && c === 'd' && !/[A-Za-z]/.test(rest[k - 1] || ' ') && /^d[a-z](?![A-Za-z0-9])/.test(rest.slice(k))) { cut = k; dv = rest[k + 1]; after = k + 2; break; }
        }
        if (cut < 0) stop('integral-differential');
        const body = convert(rest.slice(0, cut).replace(/(?:\\[,;!]|\s)+$/, ''), depth + 1).trim();
        if (!body) stop('integral-body');
        r.i += after;
        const p = prevEnd();
        if (/[A-Za-z0-9)πθ]/.test(p)) { out = out.replace(/ +$/, '') + '*'; mul = false; }
        emit(lo === null ? `∫ ${body} d${dv}` : `∫_{${lo}}^{${hi}} ${body} d${dv}`);
        mul = false;
        continue;
      }
      return stop(`\\${name}`);   // any other command: not understood
    }
    if (EXTENDED && ch === "'") {
      // y', f'(x), f''(x): a letter with primes (a derivative label), never a quote after anything else
      if (!/[A-Za-z]'?$/.test(out.replace(/ +$/, ''))) stop('prime');
      out = out.replace(/ +$/, '') + "'";
      r.i += 1;
      continue;
    }
    if (EXTENDED && ch === '{' && r.s[r.i + 1] === '}' && r.s[r.i + 2] === '^') { r.i += 2; counted = true; continue; }
    if (ch === '^') {
      if (EXTENDED && countingForm()) continue;
      r.i += 1;
      if (!out || /[+\-*/=(\s]$/.test(out)) stop('power');
      r.skipSpace();
      // 90^\circ, 36.9^{\circ}: degrees, only straight after a number (a degree after a letter or a bracket is not read, as the line checker does)
      const deg = EXTENDED && /^(?:\\circ(?![A-Za-z])|\{\s*\\circ\s*\})/.exec(r.s.slice(r.i));
      if (deg) {
        if (!NUMBER_END.test(out.replace(/ +$/, ''))) stop('degree');
        r.i += deg[0].length;
        out += '°';
        mul = true;
        continue;
      }
      if (r.peek() === '{') { const e = convert(r.group(), depth + 1).trim(); if (!e) stop(); out += `^(${e})`; }
      else if (r.peek() === '-' ) { r.i += 1; const m = /^\d+/.exec(r.s.slice(r.i)); if (!m) stop(); r.i += m[0].length; out += `^-${m[0]}`; }
      else { const m = /^(?:\d|[A-Za-z]|\\theta|\\pi)/.exec(r.s.slice(r.i)); if (!m) stop(); r.i += m[0].length; out += `^${convert(m[0], depth + 1)}`; }
      mul = true;
      continue;
    }
    if (ch === '_') {
      // Only the limits of a bracket evaluation, [ … ]_{a}^{b}, which the checker reads.
      if (!out.endsWith(']')) stop();
      r.i += 1;
      const lo = convert(r.argument(), depth + 1).trim();
      r.skipSpace();
      if (r.peek() !== '^') stop();
      r.i += 1;
      const hi = convert(r.argument(), depth + 1).trim();
      if (!lo || !hi) stop();
      out += `_{${lo}}^{${hi}}`;
      mul = false;
      continue;
    }
    if (ch === '{' || ch === '}') stop();   // a bare group: grouping that may or may not show; not read
    if (PLAIN.test(ch)) {
      r.i += 1;
      if (/[A-Za-z0-9πθ√(]/.test(ch)) emit(ch);
      else { mul = false; out += ch; }
      continue;
    }
    return stop();
  }
  return tidy(out);
}

/** Spaces stay only between two letters (π r); two numbers apart (2 3) are not one number, and are not read. */
function tidy(out) {
  const t = out.replace(/ +/g, ' ').trim();
  if (/\d \d/.test(t)) stop();
  return t.replace(/ /g, (_, at) => (/[A-Za-zπθ]/.test(t[at - 1] || '') && /[A-Za-zπθ]/.test(t[at + 1] || '') ? ' ' : ''));
}

/** The plain text for one line of reader TeX, or null when any part of it is not fully understood. */
export function texToPlain(latex, opts) { return texToPlainWhy(latex, opts).plain; }

/** The same reading with the reason it was refused: { plain, why } (why: the first command or layout not understood). A measurement aid; the reading is the same. */
export function texToPlainWhy(latex, opts) {
  const keep = EXTENDED;
  EXTENDED = !!(opts && opts.extended === true);
  try { return readTex(latex); } finally { EXTENDED = keep; }
}
/** The options for the extended reading: degrees, counting, inverse and powered trig, logs to a base, integrals, primes, dotted quantities, ±, |x|, α and β. */
export const EXTENDED_TEX = Object.freeze({ extended: true });

function readTex(latex) {
  const none = why => ({ plain: null, why });
  if (typeof latex !== 'string') return none('not-text');
  const src = latex.trim();
  if (!src || src.length > 600) return none(src ? 'too-long' : 'empty');
  try {
    let out;
    const pm = EXTENDED ? src.split('\\pm') : [src];
    if (pm.length === 2) {
      // x = (1 ± √5)/2 and x = ±4 state two things; they are written out as a list of the two statements, only where ± follows a term or `=`
      const front = pm[0].replace(/\s+$/, '');
      if (!/(?:[A-Za-z0-9})\]]|=)$/.test(front) || src.includes('\\mp') || /(?<!\\),/.test(src)) return none('plus-minus');
      const plus = front.endsWith('=') ? '' : '+';
      out = `${convert(`${pm[0]}${plus}${pm[1]}`)}, ${convert(`${pm[0]}-${pm[1]}`)}`;
    } else if (pm.length > 2 || (EXTENDED && src.includes('\\mp'))) return none('plus-minus');
    else out = convert(src);
    if (EXTENDED) {
      const lone = /(?<![A-Za-z])[dot](?![A-Za-z(])/;
      if (/dd?ot[A-Za-z]/.test(out) && lone.test(out.replace(/dd?ot[A-Za-z]/g, ''))) return none('dot-collision');
    }
    if (!out || out.length > MAX_OUT || /[+\-*\/=^≈]$|^[*\/^]|<=$|>=$|!=$|\($/.test(out)) return none('shape');
    // 0^0 has no agreed value; a line is never ticked on it (independent review, 20 November).
    if (/(^|[^\d.])0\^\(?0(?![\d.])/.test(out)) return none('0^0');
    if (/[{}\\]/.test(out.replace(/∫_\{[^{}]*\}\^\{[^{}]*\}|\]_\{[^{}]*\}\^\{[^{}]*\}/g, ''))) return none('braces');
    return { plain: out, why: null };
  } catch (e) {
    return none(e instanceof Stop ? e.why : 'error');
  }
}
