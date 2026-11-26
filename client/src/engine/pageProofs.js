// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · true lines of a worked page, ticked from what the question and the page already established (feedback only)
//
// 26 November 2026. A fully correct page on a curve question came back "5 lines checked and correct. 13 lines not checked": the lines that
// SUBSTITUTE a value (`At x = 6: y = 4(6)^3 - 36(6)^2 = 4(216) - 36(36)`), continue a chain (`= 864 - 1296 = -432 => (6,-432)`), take the second
// derivative, state its sign and the nature of the point, name the stationary points, or name the larger x-coordinate, were not tied to anything.
// This pass proves those, line by line, and nothing else. It runs from provedLines (the display layer), so it can only turn a note into a tick.
//
// Everything is anchored to the FUNCTION THE QUESTION DEFINES (questionFacts: a definition in the prompt, never the answer, the worked solution,
// the traps or the hints), not to the student's own lines:
//   a. substitution   `At x = a: <label or expr> = <expr> = ... = <number>`   every expression comes to the same number, and a label
//                     (y, f(x), dy/dx, d2y/dx2) comes to what the question's function really takes there
//   b. continuation   `= <expr> = ...` continues the line above (which this pass proved) and every value equals the one above
//   c. point claim    `=> (a, b)` after a y value: b is the function at a
//   d. second derivative   `d2y/dx2 = 24x - 72` is the real second derivative; `... = -72 < 0` states a true sign; `(local maximum)`
//                     is said of an x where the derivative is 0, the second derivative has the matching sign and x is a root the page established
//   e. conclusions    `The stationary points are (0,0) and (6,-432)` (every point on the curve, a root the page established, and no root missing);
//                     `The larger x-coordinate is 6` (a root the page established, the largest of a complete set)
//   f. condition      `Stationary points when dy/dx = 0:`
//   g. restated question / headings (never a tick for a heading: it is context, not a failure to check)
//
// Hard rules. Nothing is ever crossed. A line it cannot prove stays exactly as it was. A wrong value, a wrong sign, max and min swapped, a point
// off the curve, a smaller root named larger, or a value no earlier line established is never ticked. Pure, deterministic, no model.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf } from './expr.js';
import { texToPlain } from './texToPlain.js';
import { questionFacts } from './questionFacts.js';
import { newState as recogniserState, observe as recogniserObserve, recognise } from './lineRecognisers.js';

const MINUS = /[−–—]/g;
const SUP = { '²': '^2', '³': '^3', '⁴': '^4' };
export const clean = t => String(t ?? '').replace(/(?<!\^)\{([^{},;]*)\}/g, '($1)').replace(MINUS, '-').replace(/[²³⁴]/g, c => SUP[c]).replace(/[×·]/g, '*').replace(/\*\*/g, '').replace(/\[\s*(-?\d+(?:\.\d+)?)\s*\]/g, '$1').replace(/\\boxed\{([^}]*)\}/g, '$1').replace(/\s+/g, ' ').trim();
const close = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
export const lead = t => clean(t).replace(/^(?:∴|so|hence|then|therefore|thus)\s*:?\s*/i, '');
const NUMRE = String.raw`-?\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?`;
const ARROW = /\s*(?:⇒|⟹|=>|⟶|→|->)\s*/;

export function astOf(s) { try { const a = parse(normalize(clean(s))); return a; } catch { return null; } }
/** A constant (no letters) written as text, or null. */
export function constOf(s) {
  const t = clean(s).replace(/^\(\s*(.*)\s*\)$/, '$1');
  if (!t || /[A-Za-z]/.test(t.replace(/\b(?:sqrt|pi)\b|π|√/g, ''))) return null;
  const a = astOf(t);
  if (!a || a.t === 'equation' || variablesOf(a).size) return null;
  try { const v = evaluate(a, {}); return Number.isFinite(v) ? v : null; } catch { return null; }
}

// ── the question's function ──────────────────────────────────────────────────
const SAMPLE_X = [-3.1, -1.7, -0.6, 0.4, 1.3, 2.2, 3.7, 5.1, 6.3, 7.9];
/** Fit a polynomial of degree <= 7 to g (exact up to float noise) or null. Coefficients low to high. */
export function fitPoly(g) {
  const N = 9, xs = Array.from({ length: N }, (_, i) => i), ys = xs.map(g);
  if (ys.some(y => !Number.isFinite(y))) return null;
  const scale = Math.max(1, ...ys.map(Math.abs));
  let deg = -1;
  { let d = ys.slice(); for (let k = 0; k < N; k++) { if (d.every(x => Math.abs(x) <= 1e-8 * scale)) { deg = Math.max(0, k - 1); break; } d = d.slice(1).map((v, i) => v - d[i]); } }
  if (deg < 0 || deg > 6) return null;
  // solve the Vandermonde system for degree deg on x = 0..deg
  const M = Array.from({ length: deg + 1 }, (_, r) => [...Array.from({ length: deg + 1 }, (_, c) => r ** c), ys[r]]);
  for (let c = 0; c <= deg; c++) {
    let p = c; for (let r = c + 1; r <= deg; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r <= deg; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= deg + 1; k++) M[r][k] -= f * M[c][k]; }
  }
  const coef = M.map((row, i) => row[deg + 1] / row[i]);
  const at = x => coef.reduce((s, c, i) => s + c * x ** i, 0);
  for (const x of [-1.3, 2.7, 9.1, -4.4]) { const want = g(x), got = at(x); if (!close(want, got, 1e-7)) return null; }
  return coef.map(c => (Math.abs(c - Math.round(c)) < 1e-9 ? Math.round(c) : c));
}
export const polyAt = (c, x) => c.reduce((s, k, i) => s + k * x ** i, 0);
export const polyD = c => c.slice(1).map((k, i) => k * (i + 1));
/** Are the claimed distinct real roots of the polynomial ALL of its real roots (counting repeats away)? Unknown is false. */
export function rootsComplete(coef, roots) {
  let p = coef.slice();
  while (p.length > 1 && Math.abs(p[p.length - 1]) < 1e-12) p.pop();
  if (p.length < 2) return false;                                   // a constant: no roots at all, nothing to be complete about
  const mag = Math.max(1, ...p.map(Math.abs));
  for (const r of roots) {
    if (!close(polyAt(p, r), 0, 1e-7 * mag)) return false;           // not a root
    for (let guard = 0; guard < 8 && p.length > 1; guard++) {
      // synthetic division by (x - r), highest degree first
      const hi = p.slice().reverse(); const q = [hi[0]]; for (let i = 1; i < hi.length; i++) q.push(hi[i] + q[i - 1] * r);
      const rem = q.pop();
      if (Math.abs(rem) > 1e-7 * mag * Math.max(1, Math.abs(r)) ** p.length) break;
      p = q.reverse();
    }
  }
  if (p.length === 1) return true;
  if (p.length === 3) return p[1] * p[1] - 4 * p[2] * p[0] < -1e-9 * mag * mag;   // a quadratic left over with no real root
  return false;
}

export function worldOf(q) {
  const facts = (() => { try { return questionFacts(q); } catch { return null; } })();
  if (!facts) return null;
  const cands = [];
  for (const d of facts.defs) {
    const ast = astOf(d.expr);
    if (!ast || ast.t === 'equation') continue;
    const free = [...variablesOf(ast)].filter(x => x !== 'e');
    const v = d.variable || (free.length === 1 ? free[0] : null);
    if (!v || free.some(x => x !== v) || v === d.name || !free.length) continue;
    cands.push({ name: d.name, v, ast, expr: d.expr });
  }
  if (cands.length !== 1) return null;
  const w = cands[0];
  const f = x => { try { const r = evaluate(w.ast, { [w.v]: x }); return Number.isFinite(r) ? r : NaN; } catch { return NaN; } };
  const poly = fitPoly(f);
  const h0 = x => 1e-2 * Math.max(1, Math.abs(x));
  const d1 = poly ? x => polyAt(polyD(poly), x) : x => { const h = h0(x); return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h); };
  const d2 = poly ? x => polyAt(polyD(polyD(poly)), x) : x => { const h = h0(x); return (-f(x + 2 * h) + 16 * f(x + h) - 30 * f(x) + 16 * f(x - h) - f(x - 2 * h)) / (12 * h * h); };
  const restricted = /\\le|\\ge|\\lt|\\gt|≤|≥|<|>|\bdomain\b|\binterval\b|\bbetween\b|\bpositive\b|\bnegative\b|\bquadrant\b|\bfor\s+\$|\bwhen\s+\$/i.test(String(q?.prompt ?? ''));
  return { ...w, f, d1, d2, poly, dpoly: poly ? polyD(poly) : null, restricted, prompt: String(q?.prompt ?? '') };
}

// ── labels ──────────────────────────────────────────────────────────────────
/** What the text before an equals sign names: 'y' (the function), 'd1', 'd2' (derivatives), with an own argument when written f(6). */
export function labelOf(raw, w) {
  const t = clean(raw).replace(/\s+/g, '');
  const n = w.name, v = w.v;
  if (t === n || t === `${n}(${v})`) return { kind: 'y' };
  if (t === `d${n}/d${v}` || t === `${n}'` || t === `${n}'(${v})` || t === `d/d${v}(${n})`) return { kind: 'd1' };
  if (new RegExp(`^d\\^?2${n}/d${v}\\^?2$`).test(t) || t === `${n}''` || t === `${n}''(${v})` || t === `d^2/d${v}^2(${n})`) return { kind: 'd2' };
  const call = new RegExp(`^${n}\\((${NUMRE}|[^()=]+)\\)$`).exec(t);
  if (call && call[1] !== v) { const a = constOf(call[1]); if (a !== null) return { kind: 'y', a }; }
  const call1 = new RegExp(`^${n}'\\(([^()=]+)\\)$`).exec(t);
  if (call1 && call1[1] !== v) { const a = constOf(call1[1]); if (a !== null) return { kind: 'd1', a }; }
  const call2 = new RegExp(`^${n}''\\(([^()=]+)\\)$`).exec(t);
  if (call2 && call2[1] !== v) { const a = constOf(call2[1]); if (a !== null) return { kind: 'd2', a }; }
  return null;
}
const truthOf = (kind, w, a) => (kind === 'y' ? w.f(a) : kind === 'd1' ? w.d1(a) : w.d2(a));
const fmt = x => { const r = Math.round(x * 1e6) / 1e6; return String(Object.is(r, -0) ? 0 : r); };

// ── a line, taken apart ─────────────────────────────────────────────────────
const NATURE = /\b(?:(?:a|the)\s+)?(?:local\s+|relative\s+)?(?:(maxim(?:um|a)|max)|(minim(?:um|a)|min))(?:\s+(?:turning\s+)?(?:point|value))?\b/i;
const FILLER_TAIL = /(?:\b(?:so|hence|therefore|thus|giving|which\s+is|it\s+is|this\s+is|there\s+is|is|a|an|the|at)\b|[,;(⇒→])\s*$/i;
/** `(a, b)` with a and b constants. */
function pointOf(s) { const m = new RegExp(String.raw`^\(\s*(${NUMRE})\s*,\s*(${NUMRE})\s*\)$`).exec(clean(s)); if (!m) return null; const p = constOf(m[1]), q = constOf(m[2]); return p === null || q === null ? null : { p, q }; }

function takeApart(text, w) {
  let t = lead(text).replace(/[.]+$/, '').trim();
  let nature = null;
  if (/^\(.*\)$/.test(t) && !/[=<>]/.test(t)) t = t.slice(1, -1).trim();
  const nm = NATURE.exec(t);
  if (nm) {
    if (/\bvalue\b/i.test(t) || /\b(?:is|are|=)\s*-?\d/.test(t.slice(nm.index + nm[0].length))) return null;   // "the maximum value is 5": a different claim
    nature = nm[1] ? 'max' : 'min';
    t = (t.slice(0, nm.index) + ' ' + t.slice(nm.index + nm[0].length)).replace(/\s+/g, ' ').trim();
    for (let g = 0; g < 6 && FILLER_TAIL.test(t); g++) t = t.replace(FILLER_TAIL, '').trim();
    if (/^\(\s*\)$/.test(t)) t = '';
    t = t.replace(/^\(\s*/, m => (t.endsWith(')') && !t.includes('(', 1) ? '' : m)).replace(/\)\s*$/, m => (/^\s*\S*$/.test(t) && !t.includes('(') ? '' : m)).trim();
  }
  let point = null;
  const am = ARROW.exec(t);
  if (am) {
    const tail = t.slice(am.index + am[0].length).trim();
    point = pointOf(tail);
    if (!point) return null;
    t = t.slice(0, am.index).trim();
  }
  let at = null, rest = t, atVar = false;
  const atM = new RegExp(`^(?:at|when|for|if|putting|put|substituting|substitute|with)?\\s*,?\\s*(${w.v})\\s*=\\s*([^:;,=<>]+?)\\s*[:;,]\\s*(.+)$`, 'i').exec(t);
  if (atM) { at = constOf(atM[2]); if (at === null) return null; rest = atM[3].trim(); atVar = true; }
  let rel = null;
  const relM = new RegExp(String.raw`^(.*?)\s*(<|>|≤|≥)\s*(${NUMRE})\s*$`).exec(rest);
  if (relM) { const rhs = constOf(relM[3]); if (rhs === null) return null; rel = { op: relM[2], rhs }; rest = relM[1].trim(); }
  const cont = /^=/.test(rest);
  const parts = rest.split('=').map(s => s.trim());
  if (cont) parts.shift();
  if (parts.some(p => !p)) return rest === '' ? { at, atVar, point, nature, rel, cont, parts: [] } : null;
  return { at, atVar, point, nature, rel, cont, parts };
}

const holdsRel = (v, rel) => (rel.op === '<' ? v < rel.rhs - 1e-6 : rel.op === '>' ? v > rel.rhs + 1e-6 : rel.op === '≤' ? v <= rel.rhs + 1e-9 : v >= rel.rhs - 1e-9);
const elemAt = (s, w, a) => {
  const ast = astOf(s);
  if (!ast || ast.t === 'equation') return null;
  const free = [...variablesOf(ast)].filter(x => x !== 'e');
  if (free.some(x => x !== w.v)) return null;
  if (free.length && a === null) return null;
  try { const v = evaluate(ast, a === null ? {} : { [w.v]: a }); return Number.isFinite(v) ? v : null; } catch { return null; }
};

// ── the pass ─────────────────────────────────────────────────────────────────
const REASON_NOTE = 'This line states the task or names the method; there is no step in it to check.';
const tickOf = (l, cls, note, extra = {}) => ({ text: l.text, status: 'ok', state: 'arithmetic', note, valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: cls }, tickClass: cls, ...extra });
const FILLER = new Set(['for', 'the', 'so', 'hence', 'then', 'therefore', 'set', 'put', 'we', 'need', 'to', 'find', 'have', 'must', 'use', 'solve', 'stationary', 'turning', 'point', 'points', 'occur', 'occurs', 'when', 'where', 'at', 'are', 'is', 'a', 'if', 'and', 'of', 'curve', 'gradient', 'slope', 'equal', 'equals', 'zero', 'first', 'derivative']);
const NUMWORD = { one: 1, two: 2, three: 3, four: 4, 1: 1, 2: 2, 3: 3, 4: 4 };

function normQ(s) { return String(s).toLowerCase().replace(MINUS, '-').replace(/[²³⁴]/g, c => SUP[c]).replace(/(?<!\d)\.|\.(?!\d)/g, '').replace(/[^a-z0-9=+\-^/.<>()]/g, ''); }

const HEAD_WORDS = /^(?:solution|answer|working|working out|workings|method|solve|conclusion|step\s*\d+|part\s*\(?[a-z0-9]\)?|stationary points|the stationary points are|nature of (?:the )?stationary points|second derivative test|the second derivative|to find (?:the )?stationary points|finding (?:the )?stationary points)$/i;
/** A heading is one of a short fixed set of label forms: a line with a number, a relation or any assertion ("The larger root is zero:") is never one. */
export function isHeading(text) {
  const t = clean(text).replace(/[.:]+$/, '').trim();
  return HEAD_WORDS.test(t);
}

/**
 * @param q      the question (only `prompt` is read)
 * @param lines  the report's lines, in order (already passed through the per-line provers)
 * @param limit  lines at or after this index are never touched (the first cross)
 * @param open   (l, i) => may this line take a new tick? Notes only.
 * @returns the new lines (the same array when nothing changed) and a count
 */
export function pageProofs(q, lines, limit, open) {
  const w = worldOf(q);
  const out = lines.slice();
  let n = 0;
  const roots = new Set();                       // x values an earlier ticked line of the page stated as solutions, each checked against the question's own derivative
  let ctx = null;                                // what the line above (proved here) said: { a, kind, value }
  const stationary = a => Math.abs(w.d1(a)) <= 1e-7 * Math.max(1, Math.abs(w.d2(a)), Math.abs(a));
  const readRoots = text => {
    if (!w) return;
    const t = lead(text).replace(/[.]+$/, '');
    if (!new RegExp(`^${w.v}\\s*=`, 'i').test(t) || /[()<>:]/.test(t)) return;
    for (const part of t.split(/\s*(?:\bor\b|\band\b|,|;)\s*/i)) {
      const m = new RegExp(`^(?:${w.v}\\s*=\\s*)?(${NUMRE})$`).exec(part.trim());
      if (!m) return;
      const a = constOf(m[1]);
      if (a !== null && stationary(a)) roots.add(a);
    }
  };
  const knownRoots = () => [...roots];
  const rs = recogniserState(q);                 // lineRecognisers.js: the question's own facts, the values and models this page has set
  const completeRoots = () => !!(w && w.dpoly && roots.size && rootsComplete(w.dpoly, knownRoots()));

  for (let i = 0; i < Math.min(limit, lines.length); i++) {
    const l = lines[i];
    if (!l) { ctx = null; continue; }
    if (l.status === 'ok') { readRoots(String(l.text ?? '')); recogniserObserve(rs, l); ctx = null; continue; }
    if (!open(l, i)) { ctx = null; continue; }
    const text = String(l.text ?? '');
    let res = null;
    const prevCtx = ctx; ctx = null;
    try {
      const tries = [() => restatedQuestion(q, l, text), () => headingLine(l, text), () => recognise(rs, l, text)];
      if (w) tries.push(() => conditionLine(w, l, text), () => derivativeLine(w, l, text), () => conclusionLine(w, l, text, roots, completeRoots, knownRoots), () => chainLine(w, l, text, prevCtx, roots, stationary));
      for (const tr of tries) { try { res = tr(); } catch (e) { if (process.env.DBGP) console.log(e); res = null; } if (res) break; }
    } catch (e) { if (process.env.DBGP) console.log(e); res = null; }
    if (!res) continue;
    out[i] = res.line;
    if (res.ctx) ctx = res.ctx;
    if (res.line.status === 'ok') { n++; readRoots(text); recogniserObserve(rs, res.line); if (res.addRoot !== undefined) roots.add(res.addRoot); }
  }
  return { lines: out, n };
}

/** The prompt as masked text plus its maths spans (plain, normalised): `The curve § has two stationary points. Find the larger §-coordinate.` */
function promptMask(prompt) {
  const text = String(prompt ?? '').replace(/\\\$/g, '\u0001');
  const spans = []; let masked = '', last = 0;
  for (const m of text.matchAll(/\$\$?([^$]+)\$\$?/g)) {
    let plain = m[1]; try { plain = texToPlain(m[1]) || m[1]; } catch { /* the TeX as written */ }
    const n = normQ(plain);
    masked += normQ(text.slice(last, m.index).replace(/\*\*/g, '')); last = m.index + m[0].length;
    if (n.length >= 3) { spans.push(n); masked += '§'; } else masked += n;
  }
  masked += normQ(text.slice(last).replace(/\*\*/g, ''));
  return { masked, spans: [...new Set(spans)].sort((x, y) => y.length - x.length) };
}
/**
 * A restated question proves nothing, so it is NEVER a tick: it is context (neutral, not "not checked"). It is only recognised when the line's maths
 * is the prompt's maths exactly: every expression of the line is a whole, token-bounded expression of the prompt, the line holds the prompt's main
 * (longest) expression in full, and its words are the prompt's words. A line with any coefficient changed, or cut so that it holds only part of the
 * main expression, is ordinary maths and is judged as such.
 */
function restatedQuestion(q, l, text) {
  const line = normQ(clean(text));
  if (line.length < 12) return null;
  const { masked, spans } = promptMask(q?.prompt);
  if (!spans.length || !masked) return null;
  let lineMasked = line, mainSeen = false;
  for (const sp of spans) {
    const esc = sp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![0-9^+\\-=/.])${esc}(?![0-9^+\\-=/.(])`, 'g');
    if (re.test(lineMasked)) { if (sp === spans[0]) mainSeen = true; lineMasked = lineMasked.replace(re, '§'); }
  }
  if (!mainSeen || !masked.includes(lineMasked) || /[0-9=^+]/.test(lineMasked.replace(/§/g, ''))) return null;
  return { line: { text: l.text, status: 'note', state: 'unverified', unverified: true, context: true, note: 'This line repeats the question; there is no step in it to check.', tickClass: 'restated' } };
}
function headingLine(l, text) {
  if (!isHeading(text)) return null;
  return { line: { text: l.text, status: 'note', state: 'unverified', unverified: true, context: true, note: REASON_NOTE, tickClass: 'heading' } };
}

function conditionLine(w, l, text) {
  const t = clean(text).toLowerCase().replace(/[.:]+$/, '').trim();
  const nm = w.name.toLowerCase();
  const d1 = String.raw`(?:d${nm}\/d${w.v}|d\/d${w.v}|${nm}'(?:\(${w.v}\))?|derivative(?: of ${nm})?|gradient|slope)`;
  const m = new RegExp(String.raw`^(.*?)\b(${d1})\s*(?:=|is|equals)\s*(?:0|zero)$`).exec(t);
  if (m) {
    const words = m[1].replace(/[,:;]/g, ' ').split(/\s+/).filter(Boolean);
    if (words.every(x => FILLER.has(x))) {
      const prefixSays = /stationary|turning/.test(m[1]);
      if (prefixSays || /\b(?:stationary|turning|maximum|minimum|maxima|minima|optimis|extrem)/i.test(w.prompt)) {
        return { line: tickOf(l, 'condition-line', 'Correct: stationary points are where the derivative is 0, so this is the right condition to set.') };
      }
    }
  }
  // `maximum when d2y/dx2 < 0`, `minimum when d2y/dx2 > 0`
  const s = new RegExp(String.raw`^(?:for\s+a\s+|a\s+)?(?:local\s+)?(maximum|max|minimum|min)\s+(?:when|if|where|at)\s+(?:d\^?2${nm}\/d${w.v}\^?2|${nm}'')(?:\(${w.v}\))?\s*(<|>)\s*0$`).exec(t);
  if (s) {
    const isMax = /^max/.test(s[1]);
    if ((isMax && s[2] === '<') || (!isMax && s[2] === '>')) return { line: tickOf(l, 'condition-line', `Correct: where the derivative is 0, a negative second derivative gives a local maximum and a positive one a local minimum.`) };
  }
  return null;
}

/** `dy/dx = 12x^2 - 72x`, `d2y/dx2 = 24x - 72`: the real derivative (every expression on the line, at many x). */
function derivativeLine(w, l, text) {
  const t = lead(text).replace(/[.]+$/, '');
  if (/[<>:]|⇒|=>|→/.test(t)) return null;
  const parts = t.split('=').map(s => s.trim());
  if (parts.length < 2 || parts.some(p => !p)) return null;
  const label = labelOf(parts[0], w);
  if (!label || label.a !== undefined || (label.kind !== 'd1' && label.kind !== 'd2')) return null;
  const asts = parts.slice(1).map(astOf);
  if (asts.some(a => !a || a.t === 'equation' || [...variablesOf(a)].some(x => x !== w.v))) return null;
  let seen = 0;
  for (const x of SAMPLE_X) {
    const want = label.kind === 'd1' ? w.d1(x) : w.d2(x);
    for (const a of asts) { let got; try { got = evaluate(a, { [w.v]: x }); } catch { got = NaN; } if (!Number.isFinite(got) || !Number.isFinite(want)) { seen = -1e9; break; } if (!close(want, got, w.poly ? 1e-9 : 1e-6)) return null; }
    seen++;
  }
  if (seen < 8) return null;
  if (label.kind === 'd2') return { line: tickOf(l, 'second-derivative-value', 'Correct: this is the second derivative of the function in the question, and it agrees at every value tried.') };
  return { line: tickOf(l, w.poly ? 'power-rule-differentiation' : 'differentiation', 'Correct: this is the derivative of the function in the question, and it agrees at every value tried.') };
}

function chainLine(w, l, text, prev, roots, stationary) {
  const p = takeApart(text, w);
  if (!p) return null;
  // a standalone nature line: `(local maximum)`, `local minimum at x = 6`
  if (p.nature && !p.parts.length && !p.point && !p.rel && !p.cont) {
    let a = p.at;
    if (a === null) { a = prev && prev.a !== undefined ? prev.a : null; }
    if (a === null) return null;
    return natureTick(w, l, a, p.nature, roots, stationary, null);
  }
  if (!p.parts.length) return null;
  // the value base
  let a = p.at, kind = null, value = null, items = p.parts;
  if (p.cont) {
    if (!prev || prev.value === undefined) return null;
    a = prev.a ?? null; kind = prev.kind; value = prev.value;
  } else {
    const label = p.parts.length >= 2 ? labelOf(p.parts[0], w) : null;
    if (label) {
      if (label.a !== undefined) { if (a !== null && !close(a, label.a)) return null; a = label.a; }
      if (a === null) return null;
      kind = label.kind; value = truthOf(kind, w, a); items = p.parts.slice(1);
      if (!Number.isFinite(value)) return null;
    } else if (p.parts.length < 2) {
      if (!(p.point || p.rel || p.nature) || a === null && !p.rel) return null;
      // a single expression with a claim after it: `At x = 0: d2y/dx2 = -72 < 0` always has a label, so a bare one is not read
      return null;
    }
  }
  const vals = items.map(s => elemAt(s, w, a));
  if (vals.some(v => v === null)) return null;
  if (value === null) { if (vals.length < 2) return null; value = vals[0]; }
  // exact arithmetic is compared exactly: a rounded decimal is never the value it was rounded from (only a derivative taken numerically, for a function that is not a polynomial, is held to 1e-6)
  const tol = (kind === 'd1' || kind === 'd2') && !w.poly ? 1e-6 : 1e-9;
  if (!vals.every(v => close(v, value, tol))) return null;
  const V = value;
  if (p.rel && !holdsRel(V, p.rel)) return null;
  if (p.point) {
    if (kind !== 'y' || a === null || !close(p.point.p, a, 1e-9) || !close(p.point.q, V, tol)) return null;
  }
  let cls = p.cont ? 'arithmetic-chain' : 'substitution-evaluated', note;
  const where = a !== null ? ` at ${w.v} = ${fmt(a)}` : '';
  const what = kind === 'y' ? `${w.name} = ${fmt(V)}` : kind === 'd1' ? `the derivative is ${fmt(V)}` : kind === 'd2' ? `the second derivative is ${fmt(V)}` : `the value is ${fmt(V)}`;
  note = p.cont ? `Correct: every value on this line equals the one before it, ${fmt(V)}.` : kind ? `Correct: for the function in the question${where}, ${what}, and every expression on this line comes to ${fmt(V)}.` : `Correct: every expression on this line comes to ${fmt(V)}${where}.`;
  let addRoot;
  if (p.rel) { cls = 'sign-claim'; note = `Correct: ${what}${where}, and ${fmt(V)} ${p.rel.op === '<' ? 'is below' : p.rel.op === '>' ? 'is above' : p.rel.op === '≤' ? 'is at most' : 'is at least'} ${fmt(p.rel.rhs)}.`; }
  if (p.point) { cls = 'point-claim'; note = `Correct: at ${w.v} = ${fmt(a)} the function in the question gives ${w.name} = ${fmt(V)}, so (${fmt(a)}, ${fmt(V)}) is on the curve.`; }
  if (p.nature) {
    if (kind !== 'd2' || a === null) return null;
    const nt = natureTick(w, l, a, p.nature, roots, stationary, V);
    if (!nt) return null;
    return { line: tickOf(l, 'nature-claim', nt.line.note), ctx: { a, kind, value: V } };
  }
  if (kind === 'd1' && close(V, 0, 1e-9) && a !== null && stationary(a)) addRoot = a;
  const res = { line: tickOf(l, cls, note), ctx: { a, kind, value: V } };
  if (addRoot !== undefined) res.addRoot = addRoot;
  return res;
}

function natureTick(w, l, a, nature, roots, stationary, knownSecond) {
  if (!roots.has(a) && ![...roots].some(r => close(r, a, 1e-9))) return null;           // the page must have established this x as a stationary point
  if (!stationary(a)) return null;
  const s = w.d2(a);
  if (!Number.isFinite(s) || Math.abs(s) < 1e-6) return null;
  if (knownSecond !== null && !close(s, knownSecond, w.poly ? 1e-9 : 1e-6)) return null;
  if ((nature === 'max') !== (s < 0)) return null;                                      // max and min swapped
  const word = nature === 'max' ? 'local maximum' : 'local minimum';
  return { line: tickOf(l, 'nature-claim', `Correct: the derivative is 0 at ${w.v} = ${fmt(a)} and the second derivative there is ${s < 0 ? 'negative' : 'positive'}, so it is a ${word}.`) , ctx: { a, kind: 'd2', value: s } };
}

const ORD = { larger: 'max', largest: 'max', greater: 'max', greatest: 'max', bigger: 'max', higher: 'max', smaller: 'min', smallest: 'min', lower: 'min', least: 'min', lowest: 'min' };
function conclusionLine(w, l, text, roots, completeRoots, knownRoots) {
  const t = lead(text).replace(/[.]+$/, '').trim();
  // The stationary points are (0, 0) and (6, -432).
  const pts = [...t.matchAll(new RegExp(String.raw`\(\s*(${NUMRE})\s*,\s*(${NUMRE})\s*\)`, 'g'))];
  if (pts.length) {
    const shell = t.replace(/\(\s*[^()]*,[^()]*\)/g, '§').toLowerCase();
    const m = /^(?:the\s+)?(?:(one|two|three|four|1|2|3|4)\s+)?(?:stationary|turning)\s+points?(?:\s+of\s+the\s+(?:curve|graph|function))?\s*(?:are|is|at|occur\s+at|:)?\s*:?\s*§(?:\s*(?:,|and|&|or)\s*§)*$/.exec(shell);
    if (!m || !w.dpoly || w.restricted) return null;
    if (m[1] !== undefined && NUMWORD[m[1]] !== pts.length) return null;
    const xs = [];
    for (const pt of pts) {
      const a = constOf(pt[1]), b = constOf(pt[2]);
      if (a === null || b === null || !close(b, w.f(a), 1e-9)) return null;
      if (![...roots].some(r => close(r, a, 1e-9))) return null;
      if (!xs.some(x => close(x, a, 1e-9))) xs.push(a);
    }
    if (!xs.length || xs.length !== pts.length || !rootsComplete(w.dpoly, xs)) return null;
    return { line: tickOf(l, 'conclusion-matches', `Correct: each of these points is on the curve, the derivative is 0 at each, and there is no other stationary point.`) };
  }
  // The larger x-coordinate is 6.
  const m = new RegExp(String.raw`^(?:the\s+)?(larger|largest|greater|greatest|bigger|higher|smaller|smallest|lower|least|lowest)(?:\s+of\s+the)?\s+(?:x[- ]?coordinate|x[- ]?value|value\s+of\s+${w.v})(?:\s+of\s+the\s+stationary\s+points?)?\s*(?:is|=|:)\s*(?:${w.v}\s*=\s*)?(${NUMRE})$`, 'i').exec(t);
  if (!m || !w.dpoly || w.restricted) return null;
  const v = constOf(m[2]);
  const all = knownRoots();
  if (v === null || all.length < 2 || !completeRoots() || !all.some(r => close(r, v, 1e-9))) return null;
  const want = ORD[m[1].toLowerCase()] === 'max' ? Math.max(...all) : Math.min(...all);
  if (!close(want, v, 1e-9)) return null;
  return { line: tickOf(l, 'conclusion-matches', `Correct: the stationary points are at ${all.slice().sort((p, q) => p - q).map(x => `${w.v} = ${fmt(x)}`).join(' and ')}, so the ${ORD[m[1].toLowerCase()] === 'max' ? 'larger' : 'smaller'} x-coordinate is ${fmt(v)}.`) };
}
