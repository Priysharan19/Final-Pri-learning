// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one-tap fixes for a misread relation sign on a read line
//
// A reader that confuses ≥ with > or ≠ should not make the student retype a
// whole line. These are pure helpers over the TEXT of the reading: find the
// relation signs, offer the others in its family, and swap one in place. The
// student's tap is a correction of the reading (applyLineCorrection), exactly
// like retyping it; nothing here knows the question's answer.
// ─────────────────────────────────────────────────────────────────────────────

/** The relation signs a student can swap between, and their ASCII spellings. */
export const RELATIONS = Object.freeze(['≥', '>', '≠', '≤', '<']);
const ASCII = { '>=': '≥', '<=': '≤', '!=': '≠', '=>': '≥', '=<': '≤' };
const TOKEN = />=|<=|!=|=>|=<|[≥≤≠<>]/g;
const canonical = s => ASCII[s] || s;

/** Every relation sign in a line: [{ index, length, sign }] with sign in RELATIONS. */
export function relationsIn(text) {
  const out = [];
  for (const m of String(text || '').matchAll(TOKEN)) out.push({ index: m.index, length: m[0].length, sign: canonical(m[0]) });
  return out;
}

/** The text with the relation at `at` (one of relationsIn) replaced by `to`. */
export function swapRelation(text, at, to) {
  if (!RELATIONS.includes(to) || !at) return text;
  const s = String(text);
  return s.slice(0, at.index) + to + s.slice(at.index + at.length);
}

/**
 * The reader's doubt ("≥ or ≠", ">= or >") as its two signs, when both are
 * relation signs; otherwise null (a doubt about letters is not a sign swap).
 */
export function doubtSigns(doubt) {
  const m = String(doubt || '').match(/^\s*(\S+)\s+or\s+(\S+)\s*$/i);
  if (!m) return null;
  const a = canonical(m[1]), b = canonical(m[2]);
  return RELATIONS.includes(a) && RELATIONS.includes(b) && a !== b ? [a, b] : null;
}

/**
 * The swap offered on a line: its first relation sign (or the one the reader
 * doubted), and the other signs, the doubted alternative first.
 */
export function relationChoices(line) {
  const found = relationsIn(line?.text);
  if (!found.length) return null;
  const pair = doubtSigns(line?.doubt);
  const at = (pair && found.find(r => pair.includes(r.sign))) || found[0];
  const rival = pair ? pair.find(s => s !== at.sign) : null;
  const others = RELATIONS.filter(s => s !== at.sign);
  return { at, current: at.sign, options: rival ? [rival, ...others.filter(s => s !== rival)] : others };
}

/**
 * The question asks for an inequality (its public wording, never its answer),
 * and the line was read with ≠: that is rarely what a student writes there,
 * so it is worth a look. Says nothing about whether the line is right.
 */
export function asksForInequality(prompt) {
  return /\binequalit|\b(solve|find)\b[^.]*[<>≤≥]|\bintervals?\b[^.]*\bwhere\b/i.test(String(prompt || ''));
}
export const neqWorthCheck = (text, expectsInequality) => !!expectsInequality && relationsIn(text).some(r => r.sign === '≠');
