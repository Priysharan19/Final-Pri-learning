// Pri Learning · the written shape of a proof (marking, for items that state
// their sides).
//
// Step Check proves each line of a "prove that LHS = RHS" item equivalent to
// the left-hand side by sampling values. For an identity that test is true of
// EVERY expression equal to the left-hand side, so it cannot tell a proof
// from an assertion: "LHS = RHS" with nothing between, a jump straight to the
// right-hand side, or "= RHS" written under a line that is not yet the
// right-hand side would all hold numerically.
//
// This module checks the shape of the written proof, structurally (the same
// expression written the same way, up to the order of terms and factors and
// redundant brackets). It can only take credit away, never add it:
//
//   · a line that only states the identity (LHS = RHS, written with labels or
//     with the two expressions) is not evidence — it may head the proof ("To
//     prove: …") or close it ("Hence LHS = RHS"), but it proves nothing;
//   · "= RHS" (or "= LHS") confirms a side only directly after a line that is
//     already that side, written out;
//   · the proof needs at least one expression between the two sides;
//   · it runs from one side to the other in one chain, or one chain from each
//     side meet at the same written expression.
//
// Used by checker.js for items with `stepMeta.sides` only (identityProofs.js).
import { parse, evaluate } from './expr.js';

export const SIDE_LABEL = /^\s*(l|r)\.?\s*h\.?\s*s\.?\s*$/i;

const num = v => ({ t: 'num', v });
const bin = (op, l, r) => ({ t: 'bin', op, l, r });
const call = (fn, arg) => ({ t: 'call', fn, arg });
export { num, bin, call };

/** A copy without grouping brackets, with csc spelled cosec. */
export function strip(n) {
  if (!n || typeof n !== 'object') return n;
  switch (n.t) {
    case 'group': return strip(n.v);
    case 'neg': return { t: 'neg', v: strip(n.v) };
    case 'fact': return { t: 'fact', v: strip(n.v) };
    case 'bin': return bin(n.op, strip(n.l), strip(n.r));
    case 'call':
      if (Array.isArray(n.args)) return { t: 'call', fn: n.fn, args: n.args.map(strip) };
      return call(n.fn === 'csc' ? 'cosec' : n.fn, strip(n.arg));
    default: return { ...n };
  }
}

export const fmt = v => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12))));

/** Signed terms of a sum (a − b + c → [a, −b, c]). */
export function terms(n, sign = 1, out = []) {
  if (n.t === 'bin' && (n.op === '+' || n.op === '-')) {
    terms(n.l, sign, out);
    terms(n.r, n.op === '-' ? -sign : sign, out);
  } else if (n.t === 'neg') terms(n.v, -sign, out);
  else out.push({ sign, n });
  return out;
}
/** Factors of a product chain (a·b·c). Division is kept as its own node. */
export function factors(n, out = []) {
  if (n.t === 'bin' && n.op === '*') { factors(n.l, out); factors(n.r, out); } else out.push(n);
  return out;
}

/** A canonical spelling: + and × are flattened and sorted, nothing else changes. */
export function canonicalKey(n) {
  if (!n || typeof n !== 'object') return '?';
  switch (n.t) {
    case 'num': return fmt(n.v);
    case 'const': case 'var': return n.v;
    case 'group': return canonicalKey(n.v);
    case 'fact': return `(${canonicalKey(n.v)})!`;
    case 'call':
      if (Array.isArray(n.args)) return `${n.fn}(${n.args.map(canonicalKey).join(';')})`;
      return `${n.fn === 'csc' ? 'cosec' : n.fn}(${canonicalKey(n.arg)})`;
    case 'neg': case 'bin': {
      if (n.t === 'neg' || n.op === '+' || n.op === '-') {
        const ts = terms(n).map(({ sign, n: m }) => (sign < 0 ? '-' : '+') + canonicalKey(m)).sort();
        return ts.length === 1 ? (ts[0].startsWith('+') ? ts[0].slice(1) : ts[0]) : `[${ts.join('')}]`;
      }
      if (n.op === '*') return `{${factors(n).map(canonicalKey).sort().join('·')}}`;
      if (n.op === '^' && n.l.t === 'num' && n.r.t === 'num' && Number.isInteger(n.r.v) && Math.abs(n.r.v) <= 6) return fmt(n.l.v ** n.r.v);
      if (n.op === '^' && n.r.t === 'num' && n.r.v === 1) return canonicalKey(n.l);
      return `<${canonicalKey(n.l)}${n.op}${canonicalKey(n.r)}>`;
    }
    default: return '?';
  }
}

// ── Algebra alone ────────────────────────────────────────────────────────────
// Two expressions agree "by algebra alone" when they agree with every function
// call (sin θ, sec θ, ln x) treated as an unrelated unknown. A line that agrees
// with a side by algebra alone — 1·tan³θ, tan³θ + 0, 2·LHS/2, tan²θ·tan θ —
// used no identity at all, so it is not working towards the other side.
function atomize(n, table) {
  if (!n || typeof n !== 'object') return n;
  if (n.t === 'call' && !Array.isArray(n.args)) {
    const key = `${n.fn === 'csc' ? 'cosec' : n.fn}(${canonicalKey(n.arg)})`;
    if (!table.has(key)) table.set(key, `_u${table.size}`);
    return { t: 'var', v: table.get(key) };
  }
  if (n.t === 'bin') return bin(n.op, atomize(n.l, table), atomize(n.r, table));
  if (n.t === 'neg' || n.t === 'fact' || n.t === 'group') return { t: n.t, v: atomize(n.v, table) };
  return n;
}
function namesOf(n, acc = new Set()) {
  if (!n || typeof n !== 'object') return acc;
  if ((n.t === 'var' || n.t === 'const') && n.v !== 'pi' && n.v !== 'e') acc.add(n.v);
  for (const k of ['l', 'r', 'arg']) if (n[k]) namesOf(n[k], acc);
  if (n.v && typeof n.v === 'object') namesOf(n.v, acc);
  return acc;
}
const SAMPLES = [0.613, 1.377, 0.851, 1.729, 0.437, 1.163, 0.967, 1.541];
/** Do two expression texts agree with every function call an independent unknown? */
export function sameByAlgebra(aText, bText) {
  let a, b;
  try { a = strip(parse(String(aText))); b = strip(parse(String(bText))); } catch { return false; }
  if (!a || !b || a.t === 'equation' || b.t === 'equation') return false;
  const table = new Map();
  const A = atomize(a, table), B = atomize(b, table);
  const names = [...new Set([...namesOf(A), ...namesOf(B)])];
  let compared = 0;
  for (let i = 0; i < 6; i += 1) {
    const env = {};
    names.forEach((n, j) => { env[n] = SAMPLES[(i * 3 + j * 5) % SAMPLES.length] + 0.0137 * j; });
    let va, vb;
    try { va = evaluate(A, env); vb = evaluate(B, env); } catch { return false; }
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    compared += 1;
    if (Math.abs(va - vb) > 1e-9 * Math.max(1, Math.abs(va), Math.abs(vb))) return false;
  }
  return compared >= 4;
}

/** The written-form key of an expression's text, or null when it is not one expression. */
export function writtenKey(text) {
  const src = String(text ?? '').replace(/[−–—]/g, '-').trim();
  if (!src || src.length > 300) return null;
  try {
    const ast = parse(src);
    return ast && ast.t !== 'equation' ? canonicalKey(strip(ast)) : null;
  } catch { return null; }
}

const LEAD = /^\s*(∴|so|hence|then|therefore|thus|to\s+prove\s*:?)\s*/i;

/** A line as its '='-joined parts: { label: 'lhs'|'rhs' } or { key }. */
function partsOf(text) {
  let s = String(text ?? '').replace(/[−–—]/g, '-').trim().replace(LEAD, '');
  const continues = s.startsWith('=');
  if (continues) s = s.slice(1);
  const raw = s.split('=').map(p => p.trim());
  if (raw.some(p => !p)) return null;
  const parts = raw.map(p => {
    const m = SIDE_LABEL.exec(p);
    if (m) return { label: m[1].toLowerCase() === 'l' ? 'lhs' : 'rhs' };
    const key = writtenKey(p);
    return key ? { key, text: p } : null;
  });
  return parts.some(p => !p) ? null : { continues, parts };
}

/**
 * Is "= RHS" (or "= LHS") on this line a confirmation? Only when the
 * expression written just before it — earlier on the same line, or the last
 * expression of the line above — is already that side, written out.
 */
export function labelConfirms(lineText, previousText, sides) {
  const sideKey = { lhs: writtenKey(sides?.lhs), rhs: writtenKey(sides?.rhs) };
  const here = partsOf(lineText);
  if (!here) return false;
  const last = here.parts[here.parts.length - 1];
  if (!last.label || !sideKey[last.label]) return false;
  let before = here.parts.length >= 2 ? here.parts[here.parts.length - 2] : null;
  if (!before) {
    const prev = partsOf(previousText);
    before = prev ? prev.parts[prev.parts.length - 1] : null;
  }
  return !!before?.key && before.key === sideKey[last.label];
}

/**
 * The shape verdict for a proof whose every line Step Check accepted.
 * lines: the checked lines (status 'ok' lines only should be passed; notes
 * such as prose are skipped by the caller). Returns { ok: true } or
 * { ok: false, reason } with reason one of 'start', 'no-steps', 'end',
 * 'no-meet', 'unread'.
 */
export function proofVerdict(lines, sides) {
  const lhs = writtenKey(sides?.lhs), rhs = writtenKey(sides?.rhs);
  if (!lhs || !rhs) return { ok: false, reason: 'unread' };
  const resolve = p => (p.label ? (p.label === 'lhs' ? lhs : rhs) : p.key);
  const chains = [];
  const written = [];
  let chain = null;
  for (const text of lines) {
    const read = partsOf(text);
    if (!read) return { ok: false, reason: 'unread' };
    const keys = read.parts.map(resolve);
    // A statement of the identity (LHS = RHS) is not evidence.
    if (keys.length === 2 && new Set(keys).size === 2 && keys.includes(lhs) && keys.includes(rhs) && !read.continues) continue;
    // Only an explicit "LHS = …" / "RHS = …" opens a second chain; an unlabelled
    // line continues the one above (a line that equals a side ends it there).
    const opensNew = !chain || (!read.continues && !!read.parts[0].label);
    if (opensNew) { chain = { start: keys[0], keys: [] }; chains.push(chain); }
    for (let k = 0; k < read.parts.length; k += 1) {
      const p = read.parts[k];
      if (p.label && chain.keys.length) {
        // "= RHS": confirms only directly after that side, written out.
        if (chain.keys[chain.keys.length - 1] !== resolve(p)) return { ok: false, reason: 'end' };
        continue;
      }
      chain.keys.push(resolve(p));
      if (p.text) written.push(p);
    }
  }
  const sideOf = k => (k === lhs ? 'lhs' : k === rhs ? 'rhs' : null);
  // Working: an expression between the sides that is not one of them rewritten
  // by algebra alone (1·tan³θ, tan³θ + 0, 2·LHS/2 are not working).
  const between = new Set(written.filter(p => p.key !== lhs && p.key !== rhs
    && !sameByAlgebra(p.text, sides.lhs) && !sameByAlgebra(p.text, sides.rhs)).map(p => p.key));
  if (!chains.length || !chains.every(c => sideOf(c.start))) return { ok: false, reason: 'start' };
  if (between.size === 0) return { ok: false, reason: 'no-steps' };
  const end = c => c.keys[c.keys.length - 1];
  // One chain that, through checked steps, reaches the other side.
  const across = chains.find(c => sideOf(c.start) && c.keys.slice(1).some(k => sideOf(k) && sideOf(k) !== sideOf(c.start)));
  if (across) return { ok: true, mode: 'direct' };
  const fromL = chains.filter(c => c.start === lhs), fromR = chains.filter(c => c.start === rhs);
  if (fromL.length && fromR.length) {
    return fromL.some(a => fromR.some(b => end(a) === end(b))) ? { ok: true, mode: 'meet' } : { ok: false, reason: 'no-meet' };
  }
  return { ok: false, reason: 'end' };
}
