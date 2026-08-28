// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason V3 — proof-plan primitives and domain constraints
//
// V3 does not make the verifier more permissive. It adds deterministic proof
// operations that can be composed by authored question metadata. A stage either
// proves a line, disproves it with a concrete mathematical reason, or abstains.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, numsClose, variablesOf } from './expr.js';

function cleanText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '');
}

function astFor(text) {
  try { return parse(normalize(cleanText(text))); }
  catch { return null; }
}

function finiteValue(ast, env = {}) {
  if (!ast || ast.t === 'equation') return null;
  try {
    const value = evaluate(ast, env);
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

function compactLabel(text) {
  return cleanText(text).toLowerCase().replace(/\s+/g, '');
}

function labelAllowed(text, labels = []) {
  const got = compactLabel(text);
  return (labels || []).some(label => compactLabel(label) === got);
}

function simpleIdentifier(text) {
  return /^[a-z][a-z0-9_]*$/i.test(cleanText(text));
}

function substitutionDiagnosis(expected, got) {
  return {
    code: 'substitution-error',
    title: 'The substitution evaluates incorrectly',
    message: `This substituted value is ${Number(got.toPrecision(10))}, but the verified expression evaluates to ${Number(expected.toPrecision(10))}.`,
    fix: 'Substitute the given value into the verified expression, then evaluate the arithmetic again.',
    confidence: 'high'
  };
}

/**
 * Verify a deterministic evaluation/substitution stage.
 *
 * Metadata:
 *   { kind:'evaluation', source:'2x+3', substitutions:{x:2}, expected:7,
 *     labels:['m','dy/dx'] }
 *
 * The expected value is independently recomputed from source + substitutions;
 * authored `expected` is only accepted when it agrees with that computation.
 */
export function assessEvaluationLine({ text, meta = null } = {}) {
  if (!meta?.source || !meta?.substitutions || typeof meta.substitutions !== 'object') {
    return { status: 'note', trusted: false, note: 'Pri needs an authored expression and substitution before it can verify this evaluation.' };
  }

  const sourceAst = astFor(meta.source);
  const expected = finiteValue(sourceAst, meta.substitutions);
  if (expected === null) {
    return { status: 'note', trusted: false, note: 'This substitution is outside Pri’s deterministic evaluation vocabulary.' };
  }
  if (Number.isFinite(Number(meta.expected)) && !numsClose(expected, Number(meta.expected), 1e-9)) {
    return { status: 'note', trusted: false, note: 'This question’s authored evaluation metadata is internally inconsistent, so Pri will not mark the line.' };
  }

  const clause = cleanText(text).split(/(?:=>|⇒|→)/).pop().trim();
  const parts = clause.split('=').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read this substitution safely.' };

  // An equation such as x = 2 belongs to an equation-solving stage, not a y/m
  // evaluation stage. Refuse to reinterpret its result as the next operation.
  if (parts.length > 1 && simpleIdentifier(parts[0]) && !labelAllowed(parts[0], meta.labels)) {
    return { status: 'note', trusted: false, note: 'This line belongs to a different mathematical operation, so Pri has not reclassified it as a substitution.' };
  }

  const candidateAst = astFor(parts[parts.length - 1]);
  if (!candidateAst || candidateAst.t === 'equation') {
    return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read the evaluated value safely.' };
  }
  const free = variablesOf(candidateAst);
  if (free && free.size) {
    return { status: 'note', trusted: false, note: 'The substitution has not yet produced a numerical value.' };
  }
  const got = finiteValue(candidateAst, {});
  if (got === null) return { status: 'note', trusted: false, note: 'Skipped — I couldn’t evaluate this line safely.' };

  // If an equality chain contains readable arithmetic before the final value,
  // each readable segment must agree. An unreadable prefix is only allowed when
  // it is an explicitly authored result label such as y, m, or dy/dx.
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (labelAllowed(part, meta.labels)) continue;
    const ast = astFor(part);
    if (!ast || ast.t === 'equation') {
      return { status: 'note', trusted: false, note: 'Pri could not prove every part of this substitution chain, so it is not marked correct.' };
    }
    const value = finiteValue(ast, meta.substitutions);
    if (value === null) {
      return { status: 'note', trusted: false, note: 'Pri could not prove every part of this substitution chain, so it is not marked correct.' };
    }
    if (!numsClose(value, expected, 1e-9)) {
      const diagnosis = substitutionDiagnosis(expected, value);
      return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
    }
  }

  if (numsClose(got, expected, 1e-9)) return { status: 'ok', trusted: true, value: got };
  const diagnosis = substitutionDiagnosis(expected, got);
  return { status: 'break', trusted: false, value: got, note: diagnosis.message, diagnosis };
}

function pointDiagnosis(expected, got) {
  return {
    code: 'point-error',
    title: 'The point does not match the verified coordinates',
    message: `This line gives (${Number(got.x.toPrecision(10))}, ${Number(got.y.toPrecision(10))}), but the verified coordinates are (${Number(expected.x.toPrecision(10))}, ${Number(expected.y.toPrecision(10))}).`,
    fix: 'Use the solved x-coordinate and the y-value obtained from the original curve.',
    confidence: 'high'
  };
}

/** Verify a final Cartesian point without guessing from prose. */
export function assessPointLine({ text, meta = null } = {}) {
  const ex = Number(meta?.x), ey = Number(meta?.y);
  if (!Number.isFinite(ex) || !Number.isFinite(ey)) {
    return { status: 'note', trusted: false, note: 'Pri needs exact authored coordinates before it can verify a point.' };
  }
  const matches = [...cleanText(text).matchAll(/\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g)];
  if (!matches.length) return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read a coordinate pair on this line.' };
  const [, xText, yText] = matches[matches.length - 1];
  const x = finiteValue(astFor(xText), {}), y = finiteValue(astFor(yText), {});
  if (x === null || y === null) return { status: 'note', trusted: false, note: 'Skipped — I couldn’t evaluate both coordinates safely.' };
  if (numsClose(x, ex, 1e-9) && numsClose(y, ey, 1e-9)) return { status: 'ok', trusted: true, point: { x, y } };
  const diagnosis = pointDiagnosis({ x: ex, y: ey }, { x, y });
  return { status: 'break', trusted: false, point: { x, y }, note: diagnosis.message, diagnosis };
}

// ── First-class domain constraints ───────────────────────────────────────────
// These are deliberately proof objects, not strings. V3.0 uses them to retain
// restrictions while proof plans are introduced; later rational certification
// can consume the same objects instead of reconstructing lost exclusions.

function unwrap(node) {
  let out = node;
  while (out?.t === 'group') out = out.v;
  return out;
}

function constraintKey(constraint) {
  return `${constraint.kind}:${JSON.stringify(constraint.expression)}`;
}

function collectConstraints(node, out) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return;
  if (node.t === 'bin' && node.op === '/') {
    out.push({ kind: 'nonzero', expression: node.r });
  }
  if (node.t === 'call') {
    if (['ln', 'log', 'log10', 'log2'].includes(node.fn)) out.push({ kind: 'positive', expression: node.arg });
    if (node.fn === 'sqrt') out.push({ kind: 'nonnegative', expression: node.arg });
  }
  for (const key of ['l', 'r', 'v', 'arg']) collectConstraints(node[key], out);
}

/** Extract domain restrictions that are structurally guaranteed by an AST. */
export function domainConstraintsFor(source) {
  const ast = typeof source === 'string' ? astFor(source) : source;
  if (!ast) return [];
  const found = [];
  collectConstraints(ast, found);
  const seen = new Set();
  return found.filter(item => {
    const key = constraintKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** true/false when every constraint is decidable under env; null if undecidable. */
export function domainAllows(constraints, env = {}) {
  let undecidable = false;
  for (const constraint of constraints || []) {
    const value = finiteValue(constraint?.expression, env);
    if (value === null) { undecidable = true; continue; }
    if (constraint.kind === 'nonzero' && Math.abs(value) <= 1e-12) return false;
    if (constraint.kind === 'positive' && !(value > 0)) return false;
    if (constraint.kind === 'nonnegative' && !(value >= 0)) return false;
  }
  return undecidable ? null : true;
}
