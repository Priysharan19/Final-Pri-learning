// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · deciding when a question deserves a graph
//
// Reading a function out of a question is a guess, and a wrong graph teaches a
// wrong thing. So this is deliberately narrow: it only offers a graph when the
// text states a function outright — "y = …", "f(x) = …", "the curve …" — and it
// refuses anything it cannot evaluate. Where it declines, the lesson simply has
// no graph, which is the honest outcome.
//
// It also reads the two things a calculus question asks for: the point a
// tangent is wanted at, and the limits an area is wanted between.
// ─────────────────────────────────────────────────────────────────────────────
import { compileFunction } from './plot.js';

const FUNCTION_PATTERNS = [
  /\b(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\)|h\s*\(\s*x\s*\))\s*=\s*([^,.;]+?)(?=[,.;]|$|\s+(?:for|where|when|find|at|between|over|from|to|and|showing|hence|given|if|on|in)\b)/i,
  /\bcurve\s+(?:of\s+)?(?:y\s*=\s*)?([^,.;]+?)(?=[,.;]|$|\s+(?:for|where|when|find|at|between|over|from|to|and|showing|hence|given|if|on|in)\b)/i
];

const TANGENT_AT = /\btangent\b[^.]*?\b(?:at|where)\s+x\s*=\s*(-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)/i;
const AREA_BETWEEN = /\b(?:area|region|integrat\w*)\b[^.]*?\bfrom\s+x?\s*=?\s*(-?\d+(?:\.\d+)?)\s*(?:to|and)\s+x?\s*=?\s*(-?\d+(?:\.\d+)?)/i;
const AREA_LIMITS = /\bbetween\s+x\s*=\s*(-?\d+(?:\.\d+)?)\s+and\s+x\s*=\s*(-?\d+(?:\.\d+)?)/i;

/** Strip the LaTeX a prompt is written in down to something the parser reads. */
export function plainMath(raw) {
  return String(raw || '')
    .replace(/\$\$?([^$]*)\$\$?/g, '$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\^\s*\{([^{}]+)\}/g, '^($1)')
    .replace(/\\(sin|cos|tan|sec|csc|cot|ln|log|pi|theta)\b/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function readsAsFunction(expr) {
  const fn = compileFunction(expr);
  if (!fn) return false;
  let defined = 0;
  let varying = new Set();
  for (let i = 0; i <= 24; i += 1) {
    const value = fn(-6 + (12 * i) / 24);
    if (Number.isFinite(value)) { defined += 1; varying.add(Math.round(value * 1000)); }
  }
  // A constant is a valid function but a flat line teaches nothing here, and it
  // is the usual shape of a misread ("y = 5 marks").
  return defined >= 12 && varying.size >= 3;
}

function toNumber(raw) {
  const text = String(raw).trim();
  const frac = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * A plot spec for this question, or null when there is nothing safe to draw.
 * `sources` are searched in order, so the prompt wins over the solution text.
 */
export function plotSpecFor({ prompt = '', solutionText = '', steps = [], subtopic = '', chapterId = '' } = {}) {
  const haystacks = [prompt, solutionText, ...(steps || []).map(s => `${s?.h || ''} ${s?.d || ''}`)]
    .map(plainMath)
    .filter(Boolean);
  if (!haystacks.length) return null;

  let expr = null;
  for (const text of haystacks) {
    for (const pattern of FUNCTION_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;
      const candidate = match[1].trim().replace(/[\s.]+$/, '');
      if (candidate.length > 60) continue;
      if (readsAsFunction(candidate)) { expr = candidate; break; }
    }
    if (expr) break;
  }
  // "Solve x² − 5x + 6 = 0" is a graph question in disguise: the roots the
  // student is asked for are where the curve crosses the axis, and seeing that
  // is most of the idea. Only for a polynomial in one variable set to zero —
  // an equation with terms on both sides is a different lesson.
  if (!expr) {
    for (const text of haystacks) {
      const solve = text.match(/\b(?:solve|find the (?:roots|zero(?:e?s)?)\s+of|factorise)\b[^.]*?([-+0-9a-zA-Z^ .*/()]+?)\s*=\s*0\b/i);
      if (!solve) continue;
      const candidate = solve[1].trim();
      if (candidate.length > 60 || !/x/.test(candidate)) continue;
      if (!/[+\-]/.test(candidate) && !/\^/.test(candidate)) continue;
      if (readsAsFunction(candidate)) { expr = candidate; break; }
    }
  }
  if (!expr) return null;

  const all = haystacks.join(' ');
  const spec = { fn: expr, label: `y = ${expr}`, window: 'auto' };

  const tangent = all.match(TANGENT_AT);
  if (tangent) {
    const at = toNumber(tangent[1]);
    if (at !== null) spec.tangentAt = at;
  }

  const area = all.match(AREA_BETWEEN) || all.match(AREA_LIMITS);
  if (area) {
    const from = toNumber(area[1]);
    const to = toNumber(area[2]);
    if (from !== null && to !== null && to > from) spec.area = { from, to };
  }

  // A question about a specific window says so; otherwise the curve chooses.
  const over = all.match(/\bfor\s+(-?\d+(?:\.\d+)?)\s*(?:<|≤|<=)\s*x\s*(?:<|≤|<=)\s*(-?\d+(?:\.\d+)?)/i);
  if (over) {
    const xMin = toNumber(over[1]);
    const xMax = toNumber(over[2]);
    if (xMin !== null && xMax !== null && xMax > xMin) { spec.xMin = xMin; spec.xMax = xMax; }
  }

  spec.origin = { subtopic: subtopic || null, chapterId: chapterId || null };
  return spec;
}

/** Does this question look like one a graph would help with at all? */
export function wantsGraph({ prompt = '', subtopic = '', chapterId = '' } = {}) {
  const text = `${prompt} ${subtopic} ${chapterId}`.toLowerCase();
  return /graph|curve|sketch|parabola|plot|tangent|gradient of the curve|area under|coordinate|linear function|quadratic|trigonometric|derivative|integral/.test(text);
}
