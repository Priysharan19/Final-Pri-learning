// Pri Learning — geometry and diagram answers: mark the measurable fact.
//
// A diagram question is marked part by part. A part whose answer is a
// measurable fact is marked by the deterministic engine:
//   angle  — a number of degrees (or radians where the part says so)
//   length — a number in the part's unit
//   point  — a coordinate pair
//   locus  — an equation in x and y, credited when it is the key's equation
//            times a non-zero constant (x² + y² = 25 ⇔ 2x² + 2y² − 50 = 0),
//            and NOT when it only describes part of the locus (y = √(25 − x²))
// A part that is a construction step (bisect, draw an arc, drop a
// perpendicular) has no deterministic check. It is `needs-review`, earns
// nothing automatically, and a person marks it. A diagram is never read for
// properties it only appears to have: lengths and angles are what the student
// states, checked against what the question gives (research: "do not infer
// mathematical properties from appearance alone").
//
// question.answer.geometry = { parts: [
//   { id, kind: 'angle', marks, value, unit?: '°' | 'rad', tol? },
//   { id, kind: 'length', marks, value, unit: 'cm', tol? },
//   { id, kind: 'point', marks, x, y, tol? },
//   { id, kind: 'locus', marks, equation: 'x^2+y^2=25' },
//   { id, kind: 'construction', marks, describe } ] }
// response = { [id]: string }
import { checkAnswer } from './checker.js';
import { parse, evaluate, exprEquivalent, variablesOf } from './expr.js';

const KINDS = new Set(['angle', 'length', 'point', 'locus', 'construction']);
const blank = v => v === undefined || v === null || String(v).trim() === '';

function sides(text) {
  const s = String(text ?? '').replace(/−/g, '-').trim();
  if (s.length > 120) return null;
  const parts = s.split('=');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
  return `(${parts[0].trim()})-(${parts[1].trim()})`;
}

// Fixed probe points: deterministic, irrational-ish so no coincidental zero.
const PROBES = [[0.37, 1.91], [-1.43, 0.58], [2.71, -0.83], [-0.66, -2.29], [1.17, 3.07], [-2.53, 1.39], [0.91, -1.61], [3.33, 0.21]];

/** Is the student's equation the key's equation times a non-zero constant? */
export function sameLocus(keyEquation, studentEquation) {
  const dk = sides(keyEquation), ds = sides(studentEquation);
  if (!dk || !ds) return { ok: false, invalid: !ds };
  let ak, as;
  try { ak = parse(dk); as = parse(ds); } catch { return { ok: false, invalid: true }; }
  const vk = variablesOf(ak), vs = variablesOf(as);
  for (const v of vs) if (!vk.has(v)) return { ok: false };
  if (![...vk].every(v => v === 'x' || v === 'y')) return { ok: false };
  const ratios = [];
  for (const [x, y] of PROBES) {
    let a, b;
    try { a = evaluate(ak, { x, y }); b = evaluate(as, { x, y }); } catch { continue; }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1e-9) return { ok: false }; continue; }
    ratios.push(b / a);
  }
  if (ratios.length < 5) return { ok: false };
  const k = ratios[0];
  if (!Number.isFinite(k) || Math.abs(k) < 1e-9) return { ok: false };
  if (!ratios.every(r => Math.abs(r - k) <= 1e-9 * Math.max(1, Math.abs(k)))) return { ok: false };
  // The engine's own equivalence check, on k·(key) against the student's form.
  let same = false;
  try { same = exprEquivalent(`(${k})*(${dk})`, ds, {}); } catch { same = false; }
  return { ok: same === true };
}

function markPart(part, raw) {
  switch (part.kind) {
    case 'angle': {
      const unit = part.unit === 'rad' ? 'rad' : '°';
      const r = checkAnswer({ answerType: 'numeric', prompt: part.prompt || `Give the angle in ${unit === '°' ? 'degrees' : 'radians'}.`, answer: { value: Number(part.value), tol: part.tol }, answerSuffix: unit }, raw);
      return r.correct === true ? 'credited' : r.invalid ? 'invalid' : 'not-credited';
    }
    case 'length': {
      const r = checkAnswer({ answerType: 'numeric', prompt: part.prompt || `Give the length in ${part.unit}.`, answer: { value: Number(part.value), tol: part.tol }, answerSuffix: part.unit || undefined }, raw);
      return r.correct === true ? 'credited' : r.invalid ? 'invalid' : 'not-credited';
    }
    case 'point': {
      const r = checkAnswer({ answerType: 'point', prompt: part.prompt || 'Give the coordinates.', answer: { x: Number(part.x), y: Number(part.y), tol: part.tol } }, raw);
      return r.correct === true ? 'credited' : r.invalid ? 'invalid' : 'not-credited';
    }
    case 'locus': {
      const r = sameLocus(part.equation, raw);
      return r.ok ? 'credited' : r.invalid ? 'invalid' : 'not-credited';
    }
    default: return 'needs-review';
  }
}

/**
 * Mark a diagram question. Returns { awarded, possible, parts: { id: { status,
 * marks } }, needsReview }. status: 'credited' | 'not-credited' | 'invalid' |
 * 'unanswered' | 'needs-review'. Only 'credited' earns marks.
 */
export function markGeometry(geometry, response) {
  const parts = Array.isArray(geometry?.parts) ? geometry.parts : [];
  const given = response && typeof response === 'object' && !Array.isArray(response) ? response : {};
  const out = {};
  let awarded = 0, possible = 0, needsReview = false;
  const ids = new Set();
  for (const part of parts) {
    const id = String(part?.id ?? '');
    const marks = Math.max(0, Number(part?.marks) || 0);
    possible += marks;
    if (!id || ids.has(id) || !KINDS.has(part?.kind)) { out[id || `#${ids.size}`] = { status: 'needs-review', marks: 0 }; needsReview = true; continue; }
    ids.add(id);
    if (part.kind === 'construction') {
      // No deterministic check exists for a construction step: a person marks it.
      out[id] = { status: blank(given[id]) ? 'unanswered' : 'needs-review', marks: 0 };
      if (!blank(given[id])) needsReview = true;
      continue;
    }
    if (blank(given[id])) { out[id] = { status: 'unanswered', marks: 0 }; continue; }
    let status;
    try { status = markPart(part, String(given[id])); } catch { status = 'invalid'; }
    out[id] = { status, marks: status === 'credited' ? marks : 0 };
    if (status === 'credited') awarded += marks;
  }
  return { awarded, possible, parts: out, needsReview };
}

/** Practice form: right only when every part is credited and nothing waits for review. */
export function checkGeometry(question, rawInput) {
  let response = rawInput;
  if (typeof rawInput === 'string') {
    if (rawInput.length > 4096) return { correct: false, invalid: true, feedback: 'That answer is too long to read.' };
    try { response = JSON.parse(rawInput); } catch { return { correct: false, invalid: true, feedback: 'Fill in each part of the diagram question.' }; }
  }
  const r = markGeometry(question.answer?.geometry, response);
  if (r.needsReview) return { correct: false, needsReview: true, parts: r.parts, feedback: 'A construction step needs a teacher to check it; it has not been marked right or wrong automatically.' };
  return { correct: r.possible > 0 && r.awarded === r.possible, parts: r.parts };
}
