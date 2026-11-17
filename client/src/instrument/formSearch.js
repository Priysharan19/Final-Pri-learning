// Palette search by form (UI8). Typing mathematics such as x^2-2x finds the
// syllabus topics whose questions have that structure. Pure and deterministic,
// matched on the device, no network and no AI.
//
// It reads two things only: the bundled notation parser (engine/expr.js,
// read-only) and the syllabus index the palette already holds (chapter and
// dot-point names). It never imports a generator, checker or marker, so no
// answer, seed or solution can be reached from a result: a result is a
// syllabus pointer, "practise a question of this form", never a stored question.
import { parse } from '../engine/expr.js';

const FUNCTIONS = ['sin', 'cos', 'tan', 'sec', 'cosec', 'cot', 'log', 'ln', 'sqrt', 'cbrt', 'abs', 'exp', 'arcsin', 'arccos', 'arctan'];
const TRIG = new Set(['sin', 'cos', 'tan', 'sec', 'cosec', 'cot', 'arcsin', 'arccos', 'arctan']);

/** Whether the text looks like mathematics rather than a word. */
function looksLikeMaths(q) {
  const text = q.trim();
  if (!text || text.length > 80) return false;
  if (!/[\d^+\-−*/()=√²³·]/.test(text)) return false;
  let rest = text.toLowerCase();
  for (const f of FUNCTIONS) rest = rest.split(f).join(' ');
  return !/[a-z]{2,}/.test(rest);
}

const terms = (ast, sign = 1, out = []) => {
  if (ast.t === 'bin' && (ast.op === '+' || ast.op === '-')) { terms(ast.l, sign, out); terms(ast.r, ast.op === '-' ? -sign : sign, out); }
  else if (ast.t === 'group' && ast.v?.t === 'bin' && (ast.v.op === '+' || ast.v.op === '-')) terms(ast.v, sign, out);
  else out.push(ast);
  return out;
};

/** The highest power of a variable in a polynomial-looking node, or null if it is not one. */
function degreeOf(node) {
  switch (node.t) {
    case 'num': return 0;
    case 'var': return 1;
    case 'group': return degreeOf(node.v);
    case 'neg': case 'unary': return degreeOf(node.v ?? node.arg ?? node.e);
    case 'bin': {
      const l = degreeOf(node.l); const r = degreeOf(node.r);
      if (l === null || r === null) return null;
      if (node.op === '+' || node.op === '-') return Math.max(l, r);
      if (node.op === '*') return l + r;
      if (node.op === '/') return r === 0 ? l : null;
      if (node.op === '^') return node.r.t === 'num' && Number.isInteger(node.r.v) && node.r.v >= 0 && r === 0 ? l * node.r.v : null;
      return null;
    }
    default: return null;
  }
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const k of ['l', 'r', 'v', 'arg', 'e']) if (node[k] && typeof node[k] === 'object') walk(node[k], visit);
}

/**
 * The structure of a query, or null when it is not mathematics. The key is the
 * operator tree with coefficients abstracted, for example "poly(2) · 2 terms".
 */
export function parseForm(query) {
  if (!looksLikeMaths(query)) return null;
  let ast;
  try { ast = parse(query.trim()); } catch { return null; }
  const equation = ast.t === 'equation';
  const sides = equation ? [ast.l, ast.r] : [ast];
  const tags = new Set();
  const vars = new Set();
  let surd = false;
  for (const side of sides) {
    walk(side, n => {
      if (n.t === 'var') vars.add(n.v);
      if (n.t === 'call') {
        if (TRIG.has(n.fn)) tags.add('trig');
        else if (n.fn === 'log' || n.fn === 'ln') tags.add('log');
        else if (n.fn === 'sqrt' || n.fn === 'cbrt') surd = true;
        else if (n.fn === 'abs') tags.add('abs');
        else if (n.fn === 'exp') tags.add('exp');
      }
      if (n.t === 'bin' && n.op === '^' && n.r?.t !== 'num') tags.add('exp');
      if (n.t === 'bin' && n.op === '^' && n.r?.t === 'num' && !Number.isInteger(n.r.v)) surd = true;
    });
  }
  if (surd) tags.add('surd');
  if (!vars.size && !tags.size && !surd && !/[/]/.test(query)) return null;
  const degrees = sides.map(degreeOf);
  const poly = degrees.every(d => d !== null) && !tags.size && !surd;
  const degree = poly ? Math.max(...degrees) : null;
  const termCount = Math.max(...sides.map(s => terms(s).length));
  if (poly && degree >= 1) tags.add(degree === 1 ? 'linear' : degree === 2 ? 'quadratic' : degree === 3 ? 'cubic' : 'higher');
  if (!poly && vars.size && !tags.size && !surd) {
    let fraction = false;
    for (const side of sides) walk(side, n => { if (n.t === 'bin' && n.op === '/' && degreeOf(n.r) !== 0) fraction = true; });
    if (fraction) tags.add('fraction');
  }
  if (!vars.size && /[/]/.test(query)) tags.add('arith-fraction');
  if (equation) tags.add('equation');
  if (!tags.size) return null;
  const shape = poly ? `poly(${degree})` : [...tags].filter(t => t !== 'equation').sort().join('+') || 'expr';
  return { key: `${equation ? 'eq:' : ''}${shape} · ${termCount} term${termCount === 1 ? '' : 's'}`, shape, degree, terms: termCount, tags: [...tags].sort(), equation };
}

// What a tag looks like in a syllabus name. English (curriculum content stays
// in English): the index the palette already holds.
const WORDS = {
  linear: /\blinear\b|\bexpression|\balgebra|\bsimplif|\bequation/i,
  quadratic: /\bquadratic|\bfactoris|\bexpand|\bpolynomial|\bparabola|\bcompleting|\bsquare/i,
  cubic: /\bcubic|\bpolynomial|\bfactor/i,
  higher: /\bpolynomial/i,
  fraction: /\balgebraic fraction|\brational|\bfraction/i,
  'arith-fraction': /\bfraction|\bratio|\brational/i,
  surd: /\bsurd|\broot|\bradical|\bindices|\bindex|\bexponent/i,
  trig: /\btrigonomet|\bsine|\bcosine|\btangent|\btrig/i,
  log: /\blogarithm|\blog\b/i,
  exp: /\bexponent|\bexponential|\bindices|\bindex/i,
  abs: /\babsolute|\bmodulus/i,
  equation: /\bsolv|\bequation/i
};

/**
 * Ranked syllabus pointers for a form. `rows` is the palette's syllabus index:
 * [{ chapterId, chapterName, points: [text…] }]. Strongest first: the shape's
 * own words in a dot point, then in the chapter name, with "solve/equation"
 * as a small extra for equations. Each result is
 * { chapterId, chapterName, topic, point, count } and nothing else.
 */
export function matchTemplates(form, rows, limit = 6) {
  if (!form || !Array.isArray(rows)) return [];
  const shapeTags = form.tags.filter(t => t !== 'equation');
  const out = [];
  for (const row of rows) {
    const chapterHits = shapeTags.filter(t => WORDS[t]?.test(row.chapterName)).length;
    const points = Array.isArray(row.points) ? row.points : [];
    let best = null; let count = 0;
    points.forEach((text, i) => {
      const hits = shapeTags.filter(t => WORDS[t]?.test(text)).length;
      const eq = form.equation && WORDS.equation.test(text) ? 0.5 : 0;
      const score = hits * 2 + eq + (hits ? chapterHits : 0);
      if (hits) count += 1;
      if (score > 0 && (!best || score > best.score)) best = { score, point: i, topic: text };
    });
    if (!best && chapterHits) best = { score: chapterHits, point: null, topic: row.chapterName };
    if (best) out.push({ chapterId: row.chapterId, chapterName: row.chapterName, topic: String(best.topic), point: best.point, count: Math.max(1, count), score: best.score });
  }
  return out.sort((a, b) => b.score - a.score || b.count - a.count).slice(0, limit).map(({ score, ...r }) => r);
}

/** The palette's syllabus index from a /curriculum scope's rows. */
export function syllabusIndex(rows) {
  return (rows || []).map(row => ({
    chapterId: row.id,
    chapterName: String(row.name || ''),
    points: (Array.isArray(row.dotpoints) ? row.dotpoints : []).map(dp => (typeof dp === 'string' ? dp : String(dp?.text || '')))
  }));
}
