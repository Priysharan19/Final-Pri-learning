// Pri Learning — step verdicts for working on column vectors.
//
// Owner report, 19 November 2026: "Given a = (-5, -1) and b = (-2, 4), find
// |4a + 3b|". The page read
//
//     |4a+3b|
//     = |4[-5,-1]+3[-2,4]|
//     = |[-20-6, -4+12]|
//     = |[14,8]| = √(14^2+8^2)        the slip: -20 - 6 is -26, not 14
//     = √260
//
// and no line was judged: the question carried no Step Check meta, so only the
// final answer was marked and the page showed "Your working was not verified".
//
// This module judges such lines from the question's own data, which the
// generator supplies as `stepcheck`:
//
//   { kind: 'vector-chain', vectors: { a: [-5, -1], b: [-2, 4] }, target: '|4a+3b|' }
//
// Every verdict is a computation or an abstention; nothing is guessed.
//   a. A segment that names a given vector (4a+3b, |a|, 2a - b) has a value
//      the question fixes. Every other segment on that line must equal it.
//   b. A line starting with `=` continues the chain above it and is compared
//      with the chain's value. An unread `=` line does not end the chain: the
//      line after it still claims to equal the same thing.
//   c. A line of numbers only is ticked when it is the target itself, and is
//      crossed only when it states two vectors equal that are not.
//      Scalar side arithmetic (196 + 64 = 260) is never judged.
//   d. Anything that cannot be read is a note. A component written with a
//      leading plus sign, [-6,+12], is how a stacked sum [-20-6; -4+12] comes
//      back when it is misread, so that line is a note, never a cross.
//
// A vector where a length is expected (the bars left off, or not read) is
// never ticked: a length is not a vector. It is crossed only when its own
// length is wrong as well. A decimal that is the true value correctly rounded
// to the places written is accepted; any other line with a decimal or an
// "about equal" sign may be a rounding and is never crossed. Nothing here
// awards a method mark.

export const VECTOR_CHAIN = 'vector-chain';

// The page limit is the working limit the checker already enforces (checker.js WORKING_LIMITS: 100 lines). It was 12, a guess made when working was a
// few typed lines; a false link far down a real page of 20 to 60 lines was then left unchecked under a reason that was not true of it (27 Nov 2026: "= 864 - 1296 = -436" on line 15).
// Each line costs one parse and one evaluation of a one-variable function, so the cost grows with the line count and nothing else. A line longer than `chars` is still left.
const LIMITS = { lines: 100, chars: 160 };
const GENERIC_NOTE = 'Not verified: Pri cannot check this line against the question.';
const UNREAD_NOTE = 'This line could not be read as maths, so it is not checked.';
const SUSPECT_NOTE = 'Not verified: a vector on this line may have been misread, so the line is not marked.';

const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const isVec = v => Array.isArray(v);
const vecClose = (a, b) => a.length === b.length && a.every((x, i) => close(x, b[i]));
const norm = v => Math.hypot(...v);
const shownNum = v => { const r = Math.round(v * 1e6) / 1e6; return String(Object.is(r, -0) ? 0 : r); };
// A value or a vector in a comment is a `$…$` span the client typesets.
const shown = v => `$${isVec(v) ? `(${v.map(shownNum).join(',\\ ')})` : shownNum(v)}$`;

class Unreadable extends Error {}

function tokenize(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = text.slice(i).match(/^(?:\d+\.?\d*|\.\d+)/);
      if (!m) throw new Unreadable();
      out.push({ t: 'num', v: Number(m[0]), raw: m[0] }); i += m[0].length; continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const m = text.slice(i).match(/^[A-Za-z]+/)[0];
      if (m.toLowerCase() === 'sqrt') { out.push({ t: 'sqrt' }); i += m.length; continue; }
      // Letters written together are a product of single-letter names (ab is not read: a vector times a vector).
      for (const ch of m) out.push({ t: 'id', v: ch });
      i += m.length; continue;
    }
    if ('+-*/^()[],;|'.includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Unreadable();
  }
  return out;
}

/**
 * Evaluate one side of a line. Returns { value, symbolic, suspect, inner, decimals }:
 * `symbolic` when it names a given vector, `inner` the vector inside the bars
 * when the whole segment is one magnitude, `decimals` the places written when
 * the whole segment is one plain decimal. Throws Unreadable when it is not
 * vector arithmetic this module can prove things about.
 */
function evaluateSegment(text, vectors) {
  const toks = tokenize(text);
  let p = 0, symbolic = false, suspect = false, bars = 0;
  const peek = () => toks[p];
  const take = t => { if (toks[p]?.t !== t) throw new Unreadable(); return toks[p++]; };
  const startsPrimary = tok => !!tok && (tok.t === 'num' || tok.t === 'id' || tok.t === 'sqrt' || tok.t === '(' || tok.t === '[' || (tok.t === '|' && bars === 0));

  const add = (a, b, sign) => {
    if (isVec(a) !== isVec(b)) throw new Unreadable();
    if (!isVec(a)) return a + sign * b;
    if (a.length !== b.length) throw new Unreadable();
    return a.map((x, i) => x + sign * b[i]);
  };
  const mul = (a, b) => {
    if (isVec(a) && isVec(b)) throw new Unreadable();          // a product of two vectors is not read here
    if (isVec(a)) return a.map(x => x * b);
    if (isVec(b)) return b.map(x => a * x);
    return a * b;
  };
  const div = (a, b) => {
    if (isVec(b) || b === 0) throw new Unreadable();
    return isVec(a) ? a.map(x => x / b) : a / b;
  };
  function expr() {
    let v = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) { const s = toks[p++].t === '+' ? 1 : -1; v = add(v, term(), s); }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const tok = peek();
      if (tok?.t === '*') { p++; v = mul(v, unary()); }
      else if (tok?.t === '/') { p++; v = div(v, unary()); }
      else if (startsPrimary(tok)) v = mul(v, power());
      else return v;
    }
  }
  function unary() {
    if (peek()?.t === '-') { p++; const v = unary(); return isVec(v) ? v.map(x => -x) : -v; }
    if (peek()?.t === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const base = primary();
    if (peek()?.t !== '^') return base;
    p++;
    const e = unary();
    if (isVec(base) || isVec(e)) throw new Unreadable();
    const v = Math.pow(base, e);
    if (!Number.isFinite(v)) throw new Unreadable();
    return v;
  }
  function component() {
    if (peek()?.t === '+') suspect = true;                       // rule d
    return expr();
  }
  function primary() {
    const tok = peek();
    if (!tok) throw new Unreadable();
    if (tok.t === 'num') { p++; return tok.v; }
    if (tok.t === 'id') {
      p++;
      if (!Object.prototype.hasOwnProperty.call(vectors, tok.v)) throw new Unreadable();
      symbolic = true;
      return vectors[tok.v].slice();
    }
    if (tok.t === 'sqrt') {
      p++;
      const v = primary();
      if (isVec(v) || v < 0) throw new Unreadable();
      return Math.sqrt(v);
    }
    if (tok.t === '(' || tok.t === '[') {
      const closer = tok.t === '(' ? ')' : ']';
      p++;
      const outer = bars; bars = 0;
      const items = [component()];
      while (peek()?.t === ',' || peek()?.t === ';') { p++; items.push(component()); }
      take(closer);
      bars = outer;
      if (items.length === 1) { if (tok.t === '[' && !isVec(items[0])) throw new Unreadable(); return items[0]; }
      if (items.length > 3 || items.some(isVec)) throw new Unreadable();
      return items;
    }
    if (tok.t === '|' && bars === 0) {
      p++; bars++;
      const v = expr();
      take('|'); bars--;
      return isVec(v) ? norm(v) : Math.abs(v);
    }
    throw new Unreadable();
  }

  const value = expr();
  if (p !== toks.length) throw new Unreadable();
  if (isVec(value) ? value.some(x => !Number.isFinite(x)) : !Number.isFinite(value)) throw new Unreadable();
  // The vector inside the bars, when the whole segment is one magnitude: |…|.
  let inner = null;
  if (toks[0]?.t === '|' && toks[toks.length - 1]?.t === '|' && toks.filter(t => t.t === '|').length === 2) {
    try { const got = evaluateSegment(text.trim().slice(1, -1), vectors); if (isVec(got.value)) inner = got.value; } catch { inner = null; }
  }
  const dec = toks.length <= 2 && toks[toks.length - 1]?.t === 'num' && (toks.length === 1 || toks[0].t === '-') ? toks[toks.length - 1].raw.match(/\.(\d+)$/) : null;
  return { value, symbolic, suspect, inner, decimals: dec ? dec[1].length : null, hasDecimal: toks.some(t => t.t === 'num' && t.raw.includes('.')) };
}

/** The meta is well formed: named number vectors of one dimension and a target that evaluates. */
export function vectorChainMeta(meta) {
  if (meta?.kind !== VECTOR_CHAIN || !meta.vectors || typeof meta.vectors !== 'object' || typeof meta.target !== 'string') return null;
  const names = Object.keys(meta.vectors);
  if (!names.length || names.some(n => !/^[A-Za-z]$/.test(n))) return null;
  const vectors = {};
  for (const n of names) {
    const v = meta.vectors[n];
    if (!Array.isArray(v) || v.length < 2 || v.length > 3 || v.some(x => typeof x !== 'number' || !Number.isFinite(x))) return null;
    vectors[n] = v.slice();
  }
  if (new Set(names.map(n => vectors[n].length)).size !== 1) return null;
  let target;
  try { target = evaluateSegment(meta.target, vectors); } catch { return null; }
  if (!target.symbolic) return null;
  return { vectors, target: { value: target.value, inner: target.inner } };
}

// 'ok' the segment is the truth · 'wrong' it provably is not · 'unsure' neither can be said.
function compare(seg, truth) {
  const x = seg.value, T = truth.value;
  if (isVec(T)) {
    if (isVec(x)) return vecClose(x, T) ? 'ok' : (x.length === T.length ? 'wrong' : 'unsure');
    return 'unsure';                                             // a number in a chain of vectors: not judged
  }
  // A vector where a length is expected (the bars left off, or not read). A length is never equal to a
  // vector, so this is never ticked; it is crossed only when its own length is not the length either.
  if (isVec(x)) return close(norm(x), T) ? 'unsure' : 'wrong';
  // The same length from a different vector, |(26, 8)| for |(-26, 8)|, is not ticked.
  if (close(x, T)) return seg.inner && truth.inner && !vecClose(seg.inner, truth.inner) ? 'unsure' : 'ok';
  if (seg.decimals !== null) {
    const unit = 10 ** -seg.decimals;
    if (Math.abs(x - T) <= 0.5 * unit * (1 + 1e-9)) return 'ok';  // the true value, correctly rounded
    if (Math.abs(x - T) < unit) return 'unsure';                 // truncated: not exact, not provably wrong
  }
  return 'wrong';
}

export function stepCheckVectorChain(meta, workingText) {
  const m = vectorChainMeta(meta);
  const raw = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let diagnosis = null;
  let chain = null;    // { value, inner } the value the chain above is known to have
  // A sum worked in the margin (196, +64, 260) is read in among the lines of the chain. The chain it
  // interrupted is held, and only a `=` line with a vector in it, which cannot continue a sum of plain
  // numbers, is checked against it.
  let held = null;
  let sideValue = null;   // what the margin sum itself came to, when it can be read
  const SIDE_SUM = /^[\d\s+\-*/().^=]+$/;

  const note = (text, why, { keep = false, ...extra } = {}) => { out.push({ text, status: 'note', note: why, unverified: true, ...extra }); if (!keep) chain = null; };
  const tick = (text, rule, extra = {}) => out.push({ text, status: 'ok', valueChain: { rule }, ...extra });
  const cross = (text, i, message) => {
    diagnosis = { code: 'vector-chain-not-equal', title: 'This line does not equal the line it follows from', message, fix: 'Work each component again, one row at a time.', confidence: 'high' };
    firstBreak = i;
    out.push({ text, status: 'break', note: message, diagnosis });
    chain = null;
  };
  const mismatch = (seg, truth) => (!isVec(truth.value) && isVec(seg.value) && truth.inner
    ? `The vector here should be ${shown(truth.inner)}, but this line has ${shown(seg.value)}.`
    : `This should come to ${shown(truth.value)}, but this line gives ${shown(seg.value)}.`);

  raw.forEach((line, i) => {
    if (!m) return note(line, GENERIC_NOTE);
    if (i >= LIMITS.lines) return note(line, 'Not verified: this is past the first 100 lines of the working, which is as far as a page is checked.');
    if (line.length > LIMITS.chars) return note(line, 'Not verified: this line is too long to check. Write one step per line.');
    if (firstBreak !== -1) return note(line, 'Follows from the earlier slip.');
    const text = line.replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/≈/g, '=').replace(/√/g, ' sqrt ').replace(/²/g, '^2').replace(/³/g, '^3').replace(/([A-Za-z])[~̰]/g, '$1')
      .replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, '');
    const continuation = /^\s*=/.test(text);
    if (!continuation) { held = SIDE_SUM.test(text) ? (chain || held) : null; sideValue = null; }
    // "about equal", or a decimal inside a line, may be a rounded value: such a line is never crossed.
    const approx = /≈/.test(line);
    const soft = seg => approx || seg.hasDecimal;
    // `+ 3b` under `4a` carries a sum over two lines; that layout is not read.
    if (/^\+/.test(text)) return note(line, GENERIC_NOTE);
    if (/[<>≤≥≠]|==|!=/.test(text)) return note(line, GENERIC_NOTE, { keep: continuation });
    const parts = text.split('=').map(s => s.trim());
    const sides = continuation ? parts.slice(1) : parts;
    if (!sides.length || sides.some(s => !s)) return note(line, UNREAD_NOTE, { unreadable: true, keep: continuation });
    let segs;
    try { segs = sides.map(s => evaluateSegment(s, m.vectors)); } catch { return note(line, UNREAD_NOTE, { unreadable: true, keep: continuation }); }
    if (segs.some(s => s.suspect)) return note(line, SUSPECT_NOTE, { keep: continuation });

    const first = segs.find(s => s.symbolic);
    // a. the question fixes this line's value; b. or the chain above does
    if (!continuation && held) { const lastSide = segs[segs.length - 1]; sideValue = isVec(lastSide.value) ? null : lastSide.value; }
    if (continuation && !chain && held) {
      // A `=` line of plain numbers continues the margin sum, and so may the lines after it: the held chain is dropped.
      // A vector line whose value is what the margin sum came to (`2 + 3 = 5`, `= |[3,4]|`) continues the sum too.
      const hasVector = segs.some(s => isVec(s.value) || s.inner);
      const continuesSum = sideValue !== null && segs.some(s => !isVec(s.value) && close(s.value, sideValue));
      if (hasVector && !continuesSum) chain = held; else held = null;
    }
    // A continuation is held to the chain even when it names a vector itself: `= |a| + |b|` is not |4a+3b|.
    // A `=` line with no chain above it claims to equal something Pri does not know: it is never ticked, whatever it names.
    const truth = continuation ? chain : first ? { value: first.value, inner: first.inner } : null;
    if (truth) {
      const results = segs.map(s => { const got = compare(s, truth); return got === 'wrong' && soft(s) ? 'unsure' : got; });
      const bad = results.indexOf('wrong');
      if (bad !== -1) return cross(line, i, mismatch(segs[bad], truth));
      chain = truth;
      if (results.some(r => r === 'unsure')) return note(line, GENERIC_NOTE, { keep: true });
      if (first && segs.length === 1 && !continuation) return tick(line, 'restated', { restates: true, note: 'Restates what the question asks for.' });
      return tick(line, continuation ? 'continuation' : 'given-vector');
    }
    if (continuation) return note(line, 'Not verified: the line above was not verified, so this line has nothing to be checked against.');

    // c. numbers only
    const vecs = segs.filter(s => isVec(s.value));
    for (let k = 1; k < vecs.length; k++) {
      if (vecs[k].value.length === vecs[0].value.length && !vecClose(vecs[k].value, vecs[0].value) && !segs.some(soft)) {
        return cross(line, i, `This line says ${shown(vecs[0].value)} equals ${shown(vecs[k].value)}, and it does not.`);
      }
    }
    if (segs.every(s => compare(s, m.target) === 'ok')) { chain = m.target; return tick(line, 'target'); }
    // Sides that agree with one another start a chain the next `=` line can be held to.
    const self = { value: segs[0].value, inner: segs[0].inner };
    const agree = segs.every(s => compare(s, self) === 'ok');
    note(line, GENERIC_NOTE);
    if (agree && vecs.length) chain = self;
  });

  const state = l => (l.status === 'ok' ? (l.restates ? 'given' : 'verified') : l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified');
  const lines = out.map(l => ({ ...l, state: state(l) }));
  const at = st => lines.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  const summary = {
    total: lines.length,
    checked: lines.filter(l => l.status === 'ok').length,
    given: at('given'), verified: at('verified'), conditions: [], wrong: at('wrong'), unverified, unread,
    reason: unverified.length ? 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.' : null
  };
  // The report has the value-chain shape: each line judged on its own, no method mark.
  return { lines, firstBreak, diagnosis, source: 'value-chain', summary };
}
