// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason V4 — domain-aware solution regions
//
// V4 closes two precision gaps left deliberately open by V3:
//   • rational equations retain every independent denominator exclusion while
//     quotients are inverted/cancelled;
//   • chained/modulus inequalities are verified as conjunctions of already-safe
//     relation proofs rather than flattened into heuristic text matching.
//
// The contract remains prove / disprove / abstain. A result is certified only
// when the complete relevant solution set can be represented deterministically.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, numsClose, variablesOf } from './expr.js';
import { assessRelationLine } from './reason-v2.js';

const EPS = 1e-9;
const MAX_DEGREE = 6;

function cleanText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/\\leq?/g, '<=')
    .replace(/\\geq?/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '');
}

function unwrap(node) {
  let out = node;
  while (out?.t === 'group') out = out.v;
  return out;
}

function constantNumber(node) {
  try {
    const value = evaluate(node, {});
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

function inferSingleVariable(a, b, preferred = null) {
  if (preferred) return preferred;
  const names = new Set([...variablesOf(a || {}), ...variablesOf(b || {})]);
  return names.size === 1 ? [...names][0] : null;
}

function nearZero(value) { return Math.abs(value) <= EPS; }
function trimPoly(poly) {
  if (!poly) return null;
  const out = poly.slice();
  while (out.length > 1 && nearZero(out[out.length - 1])) out.pop();
  for (let i = 0; i < out.length; i++) if (nearZero(out[i])) out[i] = 0;
  return out;
}
function addPoly(a, b, sign = 1) {
  if (!a || !b) return null;
  const n = Math.max(a.length, b.length);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] || 0) + sign * (b[i] || 0);
  return trimPoly(out);
}
function scalePoly(a, scalar) {
  return a && Number.isFinite(scalar) ? trimPoly(a.map(v => v * scalar)) : null;
}
function mulPoly(a, b) {
  if (!a || !b || a.length + b.length - 2 > MAX_DEGREE) return null;
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return trimPoly(out);
}
function powPoly(a, exponent) {
  if (!a || !Number.isInteger(exponent) || exponent < 0 || exponent > MAX_DEGREE) return null;
  let out = [1], factor = a, n = exponent;
  while (n > 0) {
    if (n & 1) { out = mulPoly(out, factor); if (!out) return null; }
    n >>= 1;
    if (n) { factor = mulPoly(factor, factor); if (!factor) return null; }
  }
  return trimPoly(out);
}
function polyKey(poly) {
  const p = trimPoly(poly);
  if (!p) return null;
  const scale = [...p].reverse().find(v => !nearZero(v));
  if (scale === undefined) return 'zero';
  return p.map(v => Number((v / scale).toPrecision(12))).join(',');
}
function mergeExclusions(...lists) {
  const out = [], seen = new Set();
  for (const list of lists) {
    for (const poly of list || []) {
      const p = trimPoly(poly), key = polyKey(p);
      if (!p || key === null || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

// Rational form n(x)/d(x), plus every independent polynomial that must remain
// non-zero for the original syntax to be defined. Crucially, dividing by B/C
// adds B != 0 while retaining C != 0 from the divisor's own domain.
function rationalForm(node, variable) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return null;
  const c = constantNumber(node);
  if (c !== null) return { n: [c], d: [1], exclusions: [] };
  if (node.t === 'var' || node.t === 'const') {
    if (node.v === variable) return { n: [0, 1], d: [1], exclusions: [] };
    return null;
  }
  if (node.t === 'neg') {
    const inner = rationalForm(node.v, variable);
    return inner ? { ...inner, n: scalePoly(inner.n, -1) } : null;
  }
  if (node.t !== 'bin') return null;

  if (node.op === '^') {
    const base = rationalForm(node.l, variable);
    const exponent = constantNumber(node.r);
    if (!base || !Number.isInteger(exponent) || Math.abs(exponent) > MAX_DEGREE) return null;
    if (exponent === 0) {
      if (trimPoly(base.n)?.every(nearZero)) return null; // refuse 0^0
      return { n: [1], d: [1], exclusions: base.exclusions };
    }
    if (exponent > 0) {
      const n = powPoly(base.n, exponent), d = powPoly(base.d, exponent);
      return n && d ? { n, d, exclusions: base.exclusions } : null;
    }
    const k = -exponent;
    if (trimPoly(base.n)?.every(nearZero)) return null;
    const n = powPoly(base.d, k), d = powPoly(base.n, k);
    return n && d ? { n, d, exclusions: mergeExclusions(base.exclusions, [base.n]) } : null;
  }

  const left = rationalForm(node.l, variable), right = rationalForm(node.r, variable);
  if (!left || !right) return null;
  if (node.op === '+' || node.op === '-') {
    const n = addPoly(mulPoly(left.n, right.d), mulPoly(right.n, left.d), node.op === '+' ? 1 : -1);
    const d = mulPoly(left.d, right.d);
    return n && d ? { n, d, exclusions: mergeExclusions(left.exclusions, right.exclusions) } : null;
  }
  if (node.op === '*') {
    const n = mulPoly(left.n, right.n), d = mulPoly(left.d, right.d);
    return n && d ? { n, d, exclusions: mergeExclusions(left.exclusions, right.exclusions) } : null;
  }
  if (node.op === '/') {
    const divisorNumerator = trimPoly(right.n);
    if (!divisorNumerator || divisorNumerator.every(nearZero)) return null;
    const n = mulPoly(left.n, right.d), d = mulPoly(left.d, right.n);
    return n && d ? {
      n,
      d,
      exclusions: mergeExclusions(left.exclusions, right.exclusions, [right.n])
    } : null;
  }
  return null;
}

function rationalResidual(eq, variable) {
  if (!eq || eq.t !== 'equation') return null;
  const left = rationalForm(eq.l, variable), right = rationalForm(eq.r, variable);
  if (!left || !right) return null;
  const n = addPoly(mulPoly(left.n, right.d), mulPoly(right.n, left.d), -1);
  const d = mulPoly(left.d, right.d);
  return n && d ? { n, d, exclusions: mergeExclusions(left.exclusions, right.exclusions) } : null;
}

function realRoots(poly) {
  poly = trimPoly(poly);
  if (!poly) return null;
  const degree = poly.length - 1;
  if (degree < 0 || degree > 2) return null;
  if (degree === 0) return nearZero(poly[0]) ? null : [];
  if (degree === 1) return [-poly[0] / poly[1]];
  const [c, b, a] = poly;
  const disc = b * b - 4 * a * c;
  if (disc < -EPS) return [];
  if (nearZero(disc)) return [-b / (2 * a)];
  const s = Math.sqrt(Math.max(0, disc));
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
}

function uniqueNumbers(values) {
  const out = [];
  for (const value of values || []) {
    if (!Number.isFinite(value)) continue;
    if (!out.some(v => numsClose(v, value, 1e-7))) out.push(value);
  }
  return out.sort((a, b) => a - b);
}

function exclusionRoots(exclusions) {
  const roots = [];
  for (const poly of exclusions || []) {
    const p = trimPoly(poly);
    if (!p) return null;
    if (p.every(nearZero)) return { emptyDomain: true, roots: [] };
    const r = realRoots(p);
    if (r === null) return null;
    roots.push(...r);
  }
  return { emptyDomain: false, roots: uniqueNumbers(roots) };
}

/**
 * Complete low-degree real solution signature for a rational equation.
 * finite: exactly these roots; cofinite: all reals except these exclusions.
 */
export function rationalEquationSignature(eq, variable = null) {
  if (!eq || eq.t !== 'equation') return null;
  const v = inferSingleVariable(eq, null, variable);
  if (!v) return null;
  const residual = rationalResidual(eq, v);
  if (!residual) return null;
  const excluded = exclusionRoots(residual.exclusions);
  if (!excluded) return null;
  if (excluded.emptyDomain) return { kind: 'finite', variable: v, roots: [], excluded: [] };

  const numerator = trimPoly(residual.n);
  if (!numerator) return null;
  if (numerator.every(nearZero)) {
    return { kind: 'cofinite', variable: v, excluded: excluded.roots };
  }
  const roots = realRoots(numerator);
  if (roots === null) return null;
  const kept = uniqueNumbers(roots).filter(x => !excluded.roots.some(e => numsClose(x, e, 1e-7)));
  return { kind: 'finite', variable: v, roots: kept, excluded: excluded.roots };
}

function signatureEqual(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  const av = a.kind === 'finite' ? a.roots : a.excluded;
  const bv = b.kind === 'finite' ? b.roots : b.excluded;
  return av.length === bv.length && av.every((x, i) => numsClose(x, bv[i], 1e-7));
}

const DOMAIN_CALLS = new Set(['ln', 'log', 'log10', 'log2', 'sqrt']);
function functionPair(eq) {
  if (!eq || eq.t !== 'equation') return null;
  const left = unwrap(eq.l), right = unwrap(eq.r);
  if (left?.t !== 'call' || right?.t !== 'call' || left.fn !== right.fn || !DOMAIN_CALLS.has(left.fn)) return null;
  return { fn: left.fn, leftArg: left.arg, rightArg: right.arg };
}
function functionDomainAllows(fn, value) {
  if (!Number.isFinite(value)) return false;
  return fn === 'sqrt' ? value >= -1e-10 : value > 1e-10;
}

/** Finite solution signature for f(g(x)) = f(h(x)) on an injective domain. */
export function domainFunctionEquationSignature(eq, variable = null) {
  const pair = functionPair(eq);
  if (!pair) return null;
  const v = inferSingleVariable(pair.leftArg, pair.rightArg, variable);
  if (!v) return null;
  const argEq = { t: 'equation', l: pair.leftArg, r: pair.rightArg };
  const base = rationalEquationSignature(argEq, v);
  if (!base || base.kind !== 'finite') return null;
  const roots = base.roots.filter(x => {
    const env = { [v]: x };
    try {
      const lv = evaluate(pair.leftArg, env), rv = evaluate(pair.rightArg, env);
      return functionDomainAllows(pair.fn, lv) && functionDomainAllows(pair.fn, rv);
    } catch { return false; }
  });
  return { kind: 'finite', variable: v, roots: uniqueNumbers(roots), excluded: [] };
}

function equationSignature(eq, variable = null) {
  return rationalEquationSignature(eq, variable) || domainFunctionEquationSignature(eq, variable);
}

/**
 * Compare complete supported solution sets. `decidable:false` means abstain;
 * `decidable:true,same:false` is a mathematical disproof, not a heuristic.
 */
export function compareDomainAwareEquationClaims(a, b, variable = null) {
  if (!a || !b || a.t !== 'equation' || b.t !== 'equation') return { decidable: false, same: false };
  const v = inferSingleVariable(a, b, variable);
  if (!v) return { decidable: false, same: false };
  const sa = equationSignature(a, v), sb = equationSignature(b, v);
  if (!sa || !sb) return { decidable: false, same: false };
  return { decidable: true, same: signatureEqual(sa, sb), variable: v, a: sa, b: sb };
}

export function domainSolutionDiagnosis(comparison) {
  const variable = comparison?.variable || 'x';
  const a = comparison?.a, b = comparison?.b;
  let detail = 'This step changes the exact allowed solution set or domain.';
  if (a?.kind === 'finite' && b?.kind === 'finite') {
    const added = b.roots.filter(x => !a.roots.some(y => numsClose(x, y, 1e-7)));
    const lost = a.roots.filter(x => !b.roots.some(y => numsClose(x, y, 1e-7)));
    if (added.length) detail = `${variable} = ${added.map(v => Number(v.toPrecision(10))).join(', ')} is introduced by this step but is not allowed by the previous claim.`;
    else if (lost.length) detail = `${variable} = ${lost.map(v => Number(v.toPrecision(10))).join(', ')} is lost by this step even though it satisfies the previous claim.`;
  } else if (a?.kind === 'cofinite' || b?.kind === 'cofinite') {
    detail = 'This step changes an excluded domain value, so the two equations are not equivalent on the real numbers.';
  }
  return {
    code: 'domain-solution-set-changed',
    title: 'The domain or solution set changed',
    message: detail,
    fix: 'Carry every denominator/log/root restriction through the transformation and keep exactly the same allowed solutions.',
    confidence: 'high'
  };
}

// ── Chained inequalities ─────────────────────────────────────────────────────

function relationPair(op, l, r) { return { t: 'relation', op, l, r }; }

export function parseRelationChain(text) {
  const src = cleanText(text);
  const matches = [...src.matchAll(/<=|>=|<|>/g)];
  if (matches.length < 2) return null;
  const terms = [];
  let cursor = 0;
  for (const match of matches) {
    terms.push(src.slice(cursor, match.index).trim());
    cursor = match.index + match[0].length;
  }
  terms.push(src.slice(cursor).trim());
  if (terms.some(term => !term)) return null;
  try {
    const asts = terms.map(term => parse(normalize(term)));
    if (asts.some(ast => ast?.t === 'equation')) return null;
    return {
      t: 'relation-chain',
      text: src,
      ops: matches.map(match => match[0]),
      terms: asts,
      pairs: matches.map((match, i) => relationPair(match[0], asts[i], asts[i + 1]))
    };
  } catch { return null; }
}

function compactChainText(text) { return cleanText(text).replace(/\s+/g, ''); }

function flipRelation(op) {
  return op === '<' ? '>' : op === '>' ? '<' : op === '<=' ? '>=' : '<=';
}

function relationTruth(value, op) {
  if (op === '<') return value < -EPS;
  if (op === '<=') return value <= EPS;
  if (op === '>') return value > EPS;
  if (op === '>=') return value >= -EPS;
  return false;
}

function allRegion(variable) {
  return { kind: 'interval', variable, empty: false, lower: -Infinity, lowerClosed: false, upper: Infinity, upperClosed: false };
}

function emptyRegion(variable) {
  return { kind: 'interval', variable, empty: true, lower: Infinity, lowerClosed: false, upper: -Infinity, upperClosed: false };
}

function affineRelationRegion(rel, variable) {
  if (!rel || rel.t !== 'relation' || !variable) return null;
  const residual = rationalForm({ t: 'bin', op: '-', l: rel.l, r: rel.r }, variable);
  if (!residual || residual.exclusions.length) return null;
  const den = trimPoly(residual.d), num = trimPoly(residual.n);
  if (!den || den.length !== 1 || nearZero(den[0]) || !num || num.length > 2) return null;

  let op = den[0] < 0 ? flipRelation(rel.op) : rel.op;
  const b = num[0] || 0;
  const a = num[1] || 0;
  if (nearZero(a)) return relationTruth(b, op) ? allRegion(variable) : emptyRegion(variable);

  const bound = -b / a;
  if (!Number.isFinite(bound)) return null;
  if (a < 0) op = flipRelation(op);
  if (op === '<') return { ...allRegion(variable), upper: bound, upperClosed: false };
  if (op === '<=') return { ...allRegion(variable), upper: bound, upperClosed: true };
  if (op === '>') return { ...allRegion(variable), lower: bound, lowerClosed: false };
  if (op === '>=') return { ...allRegion(variable), lower: bound, lowerClosed: true };
  return null;
}

function tighterLower(a, b) {
  if (a.lower > b.lower + EPS) return { value: a.lower, closed: a.lowerClosed };
  if (b.lower > a.lower + EPS) return { value: b.lower, closed: b.lowerClosed };
  return { value: Math.max(a.lower, b.lower), closed: a.lowerClosed && b.lowerClosed };
}

function tighterUpper(a, b) {
  if (a.upper < b.upper - EPS) return { value: a.upper, closed: a.upperClosed };
  if (b.upper < a.upper - EPS) return { value: b.upper, closed: b.upperClosed };
  return { value: Math.min(a.upper, b.upper), closed: a.upperClosed && b.upperClosed };
}

function intersectRegions(a, b) {
  if (!a || !b || a.variable !== b.variable) return null;
  if (a.empty || b.empty) return emptyRegion(a.variable);
  const lower = tighterLower(a, b), upper = tighterUpper(a, b);
  if (lower.value > upper.value + EPS) return emptyRegion(a.variable);
  if (numsClose(lower.value, upper.value, 1e-9) && !(lower.closed && upper.closed)) return emptyRegion(a.variable);
  return {
    kind: 'interval', variable: a.variable, empty: false,
    lower: lower.value, lowerClosed: lower.closed,
    upper: upper.value, upperClosed: upper.closed
  };
}

export function affineChainRegion(chain, preferredVariable = null) {
  if (!chain || chain.t !== 'relation-chain' || !chain.pairs?.length) return null;
  const names = new Set();
  for (const term of chain.terms || []) for (const name of variablesOf(term || {})) names.add(name);
  const variable = preferredVariable || (names.size === 1 ? [...names][0] : null);
  if (!variable || (names.size && [...names].some(name => name !== variable))) return null;
  let region = allRegion(variable);
  for (const pair of chain.pairs) {
    const next = affineRelationRegion(pair, variable);
    if (!next) return null;
    region = intersectRegions(region, next);
    if (!region) return null;
    if (region.empty) break;
  }
  return region;
}

function intervalBoundEqual(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return numsClose(a, b, 1e-8);
}

function sameAffineRegion(a, b) {
  if (!a || !b || a.variable !== b.variable || a.empty !== b.empty) return false;
  if (a.empty) return true;
  return intervalBoundEqual(a.lower, b.lower)
    && intervalBoundEqual(a.upper, b.upper)
    && a.lowerClosed === b.lowerClosed
    && a.upperClosed === b.upperClosed;
}

function intervalDiagnosis(source, candidate) {
  const fmt = region => {
    if (region.empty) return 'no real values';
    const left = region.lowerClosed ? '[' : '(';
    const right = region.upperClosed ? ']' : ')';
    const lo = region.lower === -Infinity ? '-∞' : Number(region.lower.toPrecision(10));
    const hi = region.upper === Infinity ? '∞' : Number(region.upper.toPrecision(10));
    return `${left}${lo}, ${hi}${right}`;
  };
  return {
    code: 'inequality-region-changed',
    title: 'The solution interval changed',
    message: `The verified chain describes ${fmt(source)}, but this line describes ${fmt(candidate)}.`,
    fix: 'Apply each operation throughout the full chain and preserve both boundary directions and whether each endpoint is included.',
    confidence: 'high'
  };
}

export function assessRelationChainLine({ text, meta = null } = {}) {
  const candidate = typeof text === 'string' ? parseRelationChain(text) : text;
  if (!candidate) return { status: 'note', trusted: false, chain: null, note: 'Skipped — I couldn’t parse this chained inequality safely.' };
  const sourceText = meta?.source || meta?.canonical;
  const source = sourceText ? parseRelationChain(sourceText) : null;
  if (!source || source.pairs.length !== candidate.pairs.length) {
    return { status: 'note', trusted: false, chain: candidate, note: 'Pri needs an authored chained inequality with the same number of comparisons before it can verify this line.' };
  }
  if (meta?.requireProgress && compactChainText(text) === compactChainText(sourceText)) {
    return { status: 'note', trusted: false, chain: candidate, note: 'Starting inequality recognised — make a valid transformation throughout the chain.' };
  }

  let allPairwise = true;
  for (let i = 0; i < source.pairs.length; i++) {
    const assessed = assessRelationLine({
      text: candidate.pairs[i],
      previous: source.pairs[i],
      previousTrusted: true,
      meta: null
    });
    if (assessed.status === 'break') {
      return { status: 'break', trusted: false, chain: candidate, note: assessed.note, diagnosis: assessed.diagnosis || null };
    }
    if (assessed.status !== 'ok') allPairwise = false;
  }
  if (allPairwise) return { status: 'ok', trusted: true, chain: candidate };

  const sourceRegion = affineChainRegion(source);
  const candidateRegion = sourceRegion ? affineChainRegion(candidate, sourceRegion.variable) : null;
  if (sourceRegion && candidateRegion) {
    if (sameAffineRegion(sourceRegion, candidateRegion)) return { status: 'ok', trusted: true, chain: candidate, region: candidateRegion };
    const diagnosis = intervalDiagnosis(sourceRegion, candidateRegion);
    return { status: 'break', trusted: false, chain: candidate, region: candidateRegion, note: diagnosis.message, diagnosis };
  }

  return { status: 'note', trusted: false, chain: candidate, note: 'Pri cannot prove that every comparison in this chain preserves exactly the same interval.' };
}

/** Verify the exact equivalence |u| < r ↔ -r < u < r (and <= analogue). */
export function assessModulusInequalityLine({ text, meta = null } = {}) {
  const radius = Number(meta?.radius);
  const op = meta?.op === '<=' ? '<=' : meta?.op === '<' ? '<' : null;
  if (!meta?.expression || !Number.isFinite(radius) || !(radius >= 0) || !op) {
    return { status: 'note', trusted: false, note: 'Pri needs an authored modulus expression, non-negative radius and < or <= boundary.' };
  }
  const expected = `${-radius} ${op} ${meta.expression} ${op} ${radius}`;
  return assessRelationChainLine({ text, meta: { source: expected } });
}
