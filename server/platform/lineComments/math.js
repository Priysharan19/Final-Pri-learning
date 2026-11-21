// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · the mathematics inside a comment
//
// Every mathematical span a comment contains is pulled out and checked by the
// product's own expression engine (client/src/engine/expr.js). A comment may
// not state a false equality, may not attribute a value to the question that
// the key does not hold, and may not call something "your line" that is not
// the student's line (constraints.js uses these).
// ─────────────────────────────────────────────────────────────────────────────
import { parse, normalize, evaluate, exprEquivalent } from '../../../client/src/engine/expr.js';
import { answerToTex } from '../../../client/src/engine/answerTex.js';

const SPAN_RE = /\$\$([^$]+)\$\$|\$([^$]+)\$|\\\(([\s\S]+?)\\\)/g;

/** `$…$` and `\(…\)` spans of a comment, with their offsets. */
export function mathSpans(comment) {
  const s = String(comment ?? '');
  const out = [];
  const re = new RegExp(SPAN_RE.source, 'g');
  let m;
  while ((m = re.exec(s))) out.push({ tex: (m[1] ?? m[2] ?? m[3]).trim(), start: m.index, end: m.index + m[0].length });
  return out;
}

/** The comment with its maths spans replaced by `⟦n⟧` placeholders (for prose-only rules). */
export function proseOf(comment) {
  let i = 0;
  return String(comment ?? '').replace(new RegExp(SPAN_RE.source, 'g'), () => ` ⟦${i++}⟧ `).replace(/\s+/g, ' ').trim();
}

function bracedArg(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j += 1) {
    if (s[j] === '{') depth += 1;
    else if (s[j] === '}') { depth -= 1; if (!depth) return [s.slice(i + 1, j), j + 1]; }
  }
  return [s.slice(i + 1), s.length];
}

/** A small, deliberately strict LaTeX → plain-expression reader. Unknown commands make it return null. */
export function latexToPlain(tex) {
  const s = String(tex ?? '').replace(/\\left|\\right|\\,|\\;|\\!|\\displaystyle/g, ' ').replace(/\\dfrac|\\tfrac/g, '\\frac');
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c !== '\\') { out += c; i += 1; continue; }
    const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
    if (!m) { out += s[i + 1] === '%' ? '%' : ' '; i += 2; continue; }
    const cmd = m[1];
    i += m[0].length;
    if (cmd === 'frac') {
      while (s[i] === ' ') i += 1;
      const [a, j] = bracedArg(s, i); let k = j; while (s[k] === ' ') k += 1;
      const [b, j2] = bracedArg(s, k);
      const A = latexToPlain(a), B = latexToPlain(b);
      if (A === null || B === null) return null;
      out += `((${A})/(${B}))`; i = j2;
    } else if (cmd === 'sqrt') {
      while (s[i] === ' ') i += 1;
      if (s[i] === '[') return null;
      const [a, j] = bracedArg(s, i); const A = latexToPlain(a); if (A === null) return null;
      out += `sqrt(${A})`; i = j;
    } else if (cmd === 'text' || cmd === 'mathrm' || cmd === 'operatorname') {
      const [a, j] = bracedArg(s, i); out += ` ${a} `; i = j;
    } else if (cmd === 'cdot' || cmd === 'times') out += '*';
    else if (cmd === 'div') out += '/';
    else if (cmd === 'pm') return null;
    else if (cmd === 'pi') out += 'pi';
    else if (cmd === 'theta') out += 'theta';
    else if (cmd === 'ne' || cmd === 'neq') out += '≠';
    else if (cmd === 'le' || cmd === 'leq') out += '≤';
    else if (cmd === 'ge' || cmd === 'geq') out += '≥';
    else if (['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log', 'exp', 'arcsin', 'arccos', 'arctan'].includes(cmd)) out += `${cmd} `;
    else if (cmd === 'quad' || cmd === 'qquad') out += ' ';
    else return null;
  }
  return out.replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{[^{}]*\}/g, '').replace(/[{}]/g, ch => (ch === '{' ? '(' : ')')).replace(/\s+/g, ' ').trim();
}

/** The student's plain line as `$…$` TeX for a comment. */
export function lineTex(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const bare = raw.replace(/sqrt|cbrt|sin|cos|tan|ln|log|exp|arcsin|arccos|arctan|asin|acos|atan|pi|theta|sec|cosec|csc|cot/g, '');
  if (/[A-Za-z]{4,}/.test(bare)) return `$\\text{${raw.replace(/[\\${}%&#_^~]/g, ' ').replace(/\s+/g, ' ')}}$`;
  const sides = raw.split(/(=|≤|≥|<|>)/);
  const parts = sides.map((p, i) => {
    if (i % 2) return p === '≤' ? '\\le ' : p === '≥' ? '\\ge ' : p;
    const t = p.trim();
    if (!t) return '';
    const call = /^([A-Za-z])('?)\(([^()]*)\)$/.exec(t);
    if (call) {
      const inner = answerToTex(call[3]);
      return `${call[1]}${call[2]}\\left(${inner.startsWith('$') ? inner.slice(1, -1) : call[3]}\\right)`;
    }
    const label = /^(max|min|ans|answer|area|perimeter|volume|mean|median|period|amplitude|gradient)$/i.exec(t);
    if (label) return `\\text{${t}}`;
    const tx = answerToTex(t.replace(/\[/g, '(').replace(/\]/g, ')'));
    if (tx.startsWith('$') && tx.endsWith('$')) return tx.slice(1, -1);
    return t.replace(/[\\${}%&#_^~]/g, ' ').replace(/\b(sin|cos|tan|ln|log)\b/g, '\\$1 ').trim();
  });
  const body = parts.join(' ').replace(/\s+/g, ' ').replace(/(?<![A-Za-z])(or|and|so|then)(?![A-Za-z])/g, '\\text{ $1 }').trim();
  return `$${body}$`;
}

const EPS = 1e-7;
export const sameNumber = (a, b) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

function astOf(plain) {
  try { return parse(normalize(String(plain).replace(/−/g, '-').replace(/\[/g, '(').replace(/\]/g, ')'))); } catch { return null; }
}
function freeVars(ast, acc = new Set()) {
  if (!ast || typeof ast !== 'object') return acc;
  if (ast.t === 'var') acc.add(ast.name ?? ast.v);
  for (const k of ['l', 'r', 'v', 'arg']) if (ast[k] && typeof ast[k] === 'object') freeVars(ast[k], acc);
  if (Array.isArray(ast.args)) ast.args.forEach(a => freeVars(a, acc));
  return acc;
}
function constantOf(ast) {
  try { const v = evaluate(ast, {}); return typeof v === 'number' && Number.isFinite(v) ? v : null; } catch { return null; }
}

/** Squash a statement to compare quotations: no spaces, one minus, brackets alike, unicode powers. */
export function squash(s) {
  const sup = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  return String(s ?? '').toLowerCase().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => `^${sup[c]}`).replace(/[−–—]/g, '-').replace(/[×·]/g, '*')
    .replace(/\\cdot|\\times/g, '*').replace(/\\left|\\right/g, '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/[{]/g, '(').replace(/[}]/g, ')')
    .replace(/\^\(([^()]+)\)/g, '^$1').replace(/\s+/g, '').replace(/\*(?=[a-z(])/g, '');
}

/**
 * Check one maths span. status:
 *   true        a closed equality that holds, or an identity the engine proves
 *   false       a closed equality that does not hold
 *   conditional an equation in unknowns (6x²+18x = 0): a claim about a value, not an identity
 *   expression  no relation at all
 *   unparsed    the engine cannot read it
 */
function inlineFunctions(plain, fns) {
  let out = plain;
  for (const [name, { variable, expr }] of Object.entries(fns || {})) {
    if (!/^[A-Za-z]$/.test(name) || !variable || !expr) continue;
    for (let guard = 0; guard < 8; guard += 1) {
      const m = new RegExp(`(?<![A-Za-z0-9])${name}\\(`).exec(out);
      if (!m) break;
      let depth = 0, j = m.index + name.length;
      for (; j < out.length; j += 1) { if (out[j] === '(') depth += 1; else if (out[j] === ')') { depth -= 1; if (!depth) break; } }
      if (depth) break;
      const arg = out.slice(m.index + name.length + 1, j);
      out = `${out.slice(0, m.index)}(${String(expr).replace(new RegExp(`(?<![A-Za-z])${variable}(?![A-Za-z])`, 'g'), `(${arg})`)})${out.slice(j + 1)}`;
    }
  }
  return out;
}

export function checkSpan(tex, { fns = null, solutions = null } = {}) {
  const raw = latexToPlain(tex);
  const plain = raw === null ? null : inlineFunctions(raw, fns);
  if (plain === null || !plain) return { status: 'unparsed', plain: null };
  if (/[<>≤≥≠]/.test(plain)) return { status: 'unparsed', plain };
  const sides = plain.split('=').map(s => s.trim());
  if (sides.length < 2) return { status: 'expression', plain };
  if (sides.some(s => !s)) return { status: 'unparsed', plain };
  const asts = sides.map(astOf);
  if (asts.some(a => !a)) return { status: 'unparsed', plain };
  const vars = new Set(); asts.forEach(a => freeVars(a, vars));
  if (vars.size === 0) {
    const consts = asts.map(constantOf);
    if (consts.some(v => v === null)) return { status: 'unparsed', plain };
    return { status: consts.every(v => sameNumber(v, consts[0])) ? 'true' : 'false', plain, sides };
  }
  let identity = true;
  for (let i = 1; i < asts.length; i += 1) {
    let eq = false;
    try { eq = exprEquivalent(asts[0], asts[i]) === true; } catch { eq = false; }
    if (!eq) { identity = false; break; }
  }
  if (identity) return { status: 'true', plain, sides, identity: true };
  // An equation in the question's unknown: the engine's own test is whether it holds at the question's solutions
  // (holdsWithin in client/src/engine/checker.js), so that is the test here too.
  if (solutions?.variable && solutions.values?.length && vars.size === 1 && vars.has(solutions.variable)) {
    const claim = valueClaim(plain);
    if (claim && claim.name === solutions.variable) {
      return { status: solutions.values.some(v => sameNumber(v, claim.value)) ? 'true' : 'false', plain, sides, at: 'solutions' };
    }
    // holds at SOME solution: a factor ("x + 8 = 0") is true at one root and not the other
    const holds = solutions.values.map(v => {
      try { const l = evaluate(asts[0], { [solutions.variable]: v }); return asts.slice(1).every(a => { const r = evaluate(a, { [solutions.variable]: v }); return Number.isFinite(l) && Number.isFinite(r) && sameNumber(l, r); }); } catch { return null; }
    });
    if (holds.every(h => h !== null)) return { status: holds.some(Boolean) ? 'true' : 'false', plain, sides, at: 'solutions' };
  }
  return { status: 'conditional', plain, sides, vars: [...vars] };
}

/** `name = number` (a value claim) with its number, or null. */
export function valueClaim(plain) {
  const m = /^\s*([A-Za-z][A-Za-z0-9_'()]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/.exec(plain || '');
  return m ? { name: m[1], value: Number(m[2]) } : null;
}

export const numbersIn = s => (String(s ?? '').replace(/[−–]/g, '-').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

/**
 * A statement in a form that does not care about spacing, redundant brackets, × versus · or unicode powers:
 * each side's parsed structure, joined by "=". Two statements with the same key say the same thing in the same shape.
 */
const ungroup = n => (!n || typeof n !== 'object' ? n : n.t === 'group' ? ungroup(n.v) : Array.isArray(n) ? n.map(ungroup)
  : Object.fromEntries(Object.entries(n).map(([k, v]) => [k, k === 's' ? undefined : ungroup(v)])));
export function canonStmt(plain) {
  return String(plain ?? '').split('=').map(x => x.trim()).filter(Boolean).map(side => {
    const a = astOf(side);
    return a ? JSON.stringify(ungroup(a)) : `s:${squash(side)}`;
  }).join('=');
}

/** Every contiguous run of sides of a chain ("x = (-24)/3 = -8" gives three, two and one-sided runs), canonical. */
export function canonSlices(plain) {
  const sides = String(plain ?? '').split('=').map(x => x.trim()).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < sides.length; i += 1) for (let j = i; j < sides.length; j += 1) out.add(canonStmt(sides.slice(i, j + 1).join('=')));
  return out;
}
