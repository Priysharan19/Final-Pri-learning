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
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log', 'exp', 'arcsin', 'arccos', 'arctan']);
const SYMBOLS = {
  cdot: '*', times: '*', div: '/', pi: 'π', theta: 'θ',
  le: '<=', leq: '<=', ge: '>=', geq: '>=', ne: '!=', neq: '!=', approx: '≈'
};
const SPACES = new Set([',', ';', '!', ' ', ':', 'quad', 'qquad', 'displaystyle']);
const MAX_OUT = 400;
const PLAIN = /^[A-Za-z0-9+\-=.()\[\]\/!−×÷·≤≥≠≈πθ√²³]$/;
const STARTS_OPERAND = /^[A-Za-z0-9(πθ√]/;

// A fraction's parts are bracketed, except a plain number (the whole fraction is then `(1/2)`, which no line label matches).
const wrap = x => (/^\d+(?:\.\d+)?$/.test(x) ? x : `(${x})`);

class Stop extends Error {}
const stop = () => { throw new Stop(); };

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
    if (mul && STARTS_OPERAND.test(piece)) out = out.replace(/ +$/, '') + '*';
    mul = false;
    out += piece;
  };
  const prevEnd = () => out.replace(/ +$/, '').slice(-1);
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
        if (index !== null && index !== '3') stop();
        const p = prevEnd();
        if (/[A-Za-z0-9)πθ]/.test(p)) { out = out.replace(/ +$/, '') + '*'; mul = false; }
        emit(`${index === '3' ? 'cbrt' : 'sqrt'}(${inner})`);
        mul = true;
        continue;
      }
      if (FUNCTIONS.has(name)) {
        r.skipSpace();
        if (r.peek() === '^' || r.peek() === '_') stop();
        const nextIsBracket = r.peek() === '(' || r.s.startsWith('\\left(', r.i);
        if (nextIsBracket) { emit(name); continue; }
        // One bare argument, read only where the page can be read one way: a number and a letter (sin 2θ), a letter, a group.
        let arg = '';
        if (r.peek() === '{') arg = convert(r.group(), depth + 1).trim();
        else {
          const m = /^(?:\d+(?:\.\d+)?)?(?:[A-Za-z]|\\theta|\\pi)?/.exec(r.s.slice(r.i));
          if (!m || !m[0]) return stop();
          r.i += m[0].length;
          arg = convert(m[0], depth + 1).trim();
          const after = r.peek();
          if (after !== undefined && /[A-Za-z0-9(^_\\{]/.test(after)) return stop();
        }
        if (!arg) stop();
        emit(`${name}(${arg})`);
        continue;
      }
      if (name === 'left' || name === 'right') {
        const b = r.peek();
        if (b === undefined || !/[()\[\]]/.test(b)) stop();
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
      if (name === 'int') {
        // The form arithmeticLines reads: ∫_{lo}^{hi} body dx, with limits that are plain numbers.
        r.skipSpace();
        if (r.peek() !== '_') stop();
        r.i += 1;
        const lo = convert(r.argument(), depth + 1).trim();
        r.skipSpace();
        if (r.peek() !== '^') stop();
        r.i += 1;
        const hi = convert(r.argument(), depth + 1).trim();
        const rest = r.s.slice(r.i);
        const m = /^(.*?)(?:\\[,;!]|\s)*(?:\\mathrm\{d\}|d)([a-z])\s*$/s.exec(rest);
        if (!m || !lo || !hi) stop();
        const body = convert(m[1], depth + 1).trim();
        if (!body) stop();
        r.i = r.s.length;
        emit(`∫_{${lo}}^{${hi}} ${body} d${m[2]}`);
        continue;
      }
      return stop();   // any other command: not understood
    }
    if (ch === '^') {
      r.i += 1;
      if (!out || /[+\-*/=(\s]$/.test(out)) stop();
      r.skipSpace();
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
export function texToPlain(latex) {
  if (typeof latex !== 'string') return null;
  const src = latex.trim();
  if (!src || src.length > 600) return null;
  try {
    const out = convert(src);
    if (!out || out.length > MAX_OUT || /[+\-*\/=^≈]$|^[*\/^]|<=$|>=$|!=$|\($/.test(out)) return null;
    // 0^0 has no agreed value; a line is never ticked on it (independent review, 20 November).
    if (/(^|[^\d.])0\^\(?0(?![\d.])/.test(out)) return null;
    if (/[{}\\]/.test(out.replace(/∫_\{[^{}]*\}\^\{[^{}]*\}|\]_\{[^{}]*\}\^\{[^{}]*\}/g, ''))) return null;
    return out;
  } catch (e) {
    if (e instanceof Stop) return null;
    return null;
  }
}
