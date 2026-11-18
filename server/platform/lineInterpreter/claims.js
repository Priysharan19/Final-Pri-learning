// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter · the CLAIM vocabulary and the verbatim guard
//
// An interpreter (rule-based or model-based) reads a student's confirmed line
// and states what the line CLAIMS, in this small closed vocabulary. It does not
// decide whether the claim is true: the verifier (verifier.js) does that,
// from the question's own data, with the engine's arithmetic.
//
// The one hard rule on this side: every expression inside a claim is copied
// verbatim from the line. The interpreter may not rewrite, repair, simplify or
// complete the student's mathematics. `guardClaim` enforces it by token
// comparison, and a claim that fails it is replaced by `unparseable`.
// ─────────────────────────────────────────────────────────────────────────────

export const CLAIM_KINDS = Object.freeze([
  'restates-given', 'expression', 'equation', 'continues', 'defines', 'evaluates',
  'quantity', 'condition', 'solution-set', 'prose', 'unparseable'
]);

/** The quantities a `quantity` claim may name, of a NAMED given object. */
export const QUANTITIES = Object.freeze([
  'maximum', 'minimum', 'amplitude', 'period', 'midline', 'gradient', 'x-intercept',
  'y-intercept', 'stationary-point-x', 'derivative', 'antiderivative', 'discriminant', 'root-set', 'area', 'perimeter', 'volume', 'mean', 'median', 'answer', 'none'
]);

import { labelConcept } from './labels.js';

export const MAX_PARTS = 8;
export const MAX_FIELD_CHARS = 240;

/**
 * The strict JSON schema the model must answer in, one object per line. Flat on
 * purpose: a schema the model cannot wander outside. Every text field is either
 * empty or a verbatim piece of the line (the guard checks it).
 */
export const CLAIM_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'quantity', 'subject', 'label', 'at', 'parts'],
  properties: {
    kind: { type: 'string', enum: CLAIM_KINDS },
    quantity: { type: 'string', enum: QUANTITIES },
    subject: { type: 'string', maxLength: 60 },
    label: { type: 'string', maxLength: 60 },
    at: { type: 'string', maxLength: 60 },
    parts: { type: 'array', maxItems: MAX_PARTS, items: { type: 'string', maxLength: MAX_FIELD_CHARS } }
  }
});

export const CLAIMS_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['lines'],
  properties: {
    lines: { type: 'array', maxItems: 40, items: Object.freeze({
      type: 'object', additionalProperties: false, required: ['index', 'claim'],
      properties: { index: { type: 'integer', minimum: 0, maximum: 39 }, claim: CLAIM_SCHEMA }
    }) }
  }
});

/** Fold the spellings of one symbol together; nothing else is normalised. */
const FOLD = [[/[−‒–—]/g, '-'], [/ /g, ' '], [/[′’ʹ`]/g, "'"]];
export function foldText(text) {
  let s = String(text ?? '');
  for (const [re, to] of FOLD) s = s.replace(re, to);
  return s;
}

const TOKEN = /\d+(?:\.\d+)?|[A-Za-z]+|[^\sA-Za-z\d]/gu;
/** A line as tokens: numbers, letter runs, single symbols; whitespace is not a token. */
export function tokenize(text) {
  return foldText(text).match(TOKEN) || [];
}

/** Tokens with whether whitespace precedes and follows each (a word is filler only when set apart). */
function tokenizeSpaced(text) {
  const s = foldText(text);
  const out = [];
  for (const m of s.matchAll(TOKEN)) {
    out.push({ t: m[0], before: m.index === 0 || /\s/.test(s[m.index - 1]), after: m.index + m[0].length >= s.length || /\s/.test(s[m.index + m[0].length]) });
  }
  return out;
}

/** Is `piece` a contiguous run of the line's tokens? (empty is not a claim of anything) */
export function isVerbatim(piece, lineText) {
  const p = tokenize(piece);
  if (!p.length) return false;
  const l = tokenize(lineText);
  outer: for (let i = 0; i + p.length <= l.length; i++) {
    for (let j = 0; j < p.length; j++) if (l[i + j] !== p[j]) continue outer;
    return true;
  }
  return false;
}

// Words and marks that may stand between the pieces of a claim without carrying
// mathematics. Anything else left over on the line (a digit, an operator, a
// bracket, a word such as "not") means the parts do not account for the line.
const FILLER = new Set(['=', ':', ',', ';', '.', 'so', 'hence', 'therefore', 'thus', 'then', 'let', 'set', 'put', 'when', 'where',
  'if', 'at', 'of', 'the', 'is', 'are', 'equals', 'gives', 'give', 'get', 'gets', 'we', 'have', 'this', 'now', 'since', 'because',
  'and', 'or', '\u21d2', '\u2234', '\u2235', 'value', 'to', 'be', 'find', 'for', 'with', 'using', 'by']);
const UNITS = new Set(['cm', 'km', 'mm', 'kg', 'ml', 'units', 'unit', 'degrees', 'degree', 'metres', 'meters', 'litres', 'liters',
  'seconds', 'minutes', 'hours', 'dollars', 'sq', 'square', '\u00b0', '%', '\u00b2', '\u00b3', '$', '\u20b9']);

/**
 * Do the claim's pieces account for the WHOLE line? Each piece is placed on its
 * own run of tokens (longest first, earliest unused run); what is left must be
 * filler or a unit. This is what stops a model returning only a true-looking
 * fragment of a false expression ("22 + 5" from "22 + 5 sin(0)").
 */
export function coversLine(claim, lineText) {
  const spaced = tokenizeSpaced(lineText);
  const line = spaced.map(x => x.t);
  const used = new Array(line.length).fill(false);
  const pieces = [...claim.parts, claim.subject, claim.label, claim.at].filter(Boolean)
    .map(p => tokenize(p)).sort((a, b) => b.length - a.length);
  for (const piece of pieces) {
    let placed = false;
    for (let i = 0; i + piece.length <= line.length && !placed; i++) {
      let ok = true;
      for (let j = 0; j < piece.length; j++) if (used[i + j] || line[i + j] !== piece[j]) { ok = false; break; }
      if (!ok) continue;
      for (let j = 0; j < piece.length; j++) used[i + j] = true;
      placed = true;
    }
    if (!placed) return false;
  }
  for (let i = 0; i < line.length; i++) {
    if (used[i]) continue;
    const t = line[i].toLowerCase();
    const word = /^[a-z]+$/.test(t);
    // A word is filler only when it stands apart (not "5at" or "x so"): a letter run
    // glued to maths is a product of variables, never prose.
    if (FILLER.has(t) && (!word || t.length >= 2 && spaced[i].before && spaced[i].after)) continue;
    if (UNITS.has(t) && (!word || spaced[i].after || i === line.length - 1 || /^[\u00b2\u00b3]$/.test(line[i + 1] || ''))) continue;
    // "x = 0 or x = -3": the unknown named once in `subject` is written again for each value
    if (claim.kind === 'solution-set' && claim.subject && line[i] === claim.subject && line[i + 1] === '=') continue;
    return false;
  }
  return true;
}

const UNPARSEABLE = Object.freeze({ kind: 'unparseable', quantity: 'none', subject: '', label: '', at: '', parts: Object.freeze([]) });
export const unparseable = reason => ({ ...UNPARSEABLE, parts: [], reason: reason || null });

const NEEDS_PARTS = new Set(['restates-given', 'expression', 'equation', 'continues', 'defines', 'evaluates', 'quantity', 'condition', 'solution-set']);

/**
 * The claim as the verifier may see it, or `unparseable`. A claim whose kind,
 * quantity or fields are outside the vocabulary, or whose any text field is not
 * a verbatim token run of the line, is refused here, never repaired.
 */
export function guardClaim(claim, lineText) {
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return unparseable('not-an-object');
  const kind = claim.kind;
  if (!CLAIM_KINDS.includes(kind)) return unparseable('unknown-kind');
  const quantity = claim.quantity === undefined ? 'none' : claim.quantity;
  if (!QUANTITIES.includes(quantity)) return unparseable('unknown-quantity');
  const parts = claim.parts === undefined ? [] : claim.parts;
  if (!Array.isArray(parts) || parts.length > MAX_PARTS) return unparseable('bad-parts');
  const text = String(lineText ?? '');
  for (const key of ['subject', 'label', 'at']) {
    const v = claim[key] === undefined ? '' : claim[key];
    if (typeof v !== 'string' || v.length > MAX_FIELD_CHARS) return unparseable('bad-field');
    if (v !== '' && !isVerbatim(v, text)) return unparseable(`not-verbatim:${key}`);
  }
  // The small fields cannot be a place to hide mathematics or a negation: a subject is a name (h, f(x), y'),
  // a label is a word the lexicon knows for a quantity, `at` is a plain number or expression of numbers.
  const subject = claim.subject || '', label = claim.label || '', at = claim.at || '';
  if (subject && !(/^[A-Za-z](?:\s*\([^()]{0,12}\))?['\u2032]?$/.test(subject) && ['quantity', 'defines', 'evaluates', 'solution-set', 'condition'].includes(kind))) return unparseable('bad-subject');
  if (label && !(kind === 'quantity' && labelConcept(label))) return unparseable('bad-label');
  if (at && !(['evaluates', 'quantity'].includes(kind) && /^[0-9.\s+\-*/^()\u00d7\u00f7\u03c0\u221a]+$/.test(foldText(at)))) return unparseable('bad-at');
  for (const p of parts) {
    if (typeof p !== 'string' || !p.trim() || p.length > MAX_FIELD_CHARS) return unparseable('bad-part');
    if (!isVerbatim(p, text)) return unparseable('not-verbatim:part');
  }
  if (NEEDS_PARTS.has(kind) && parts.length === 0) return unparseable('no-parts');
  if (kind === 'quantity' && quantity === 'none') return unparseable('quantity-unnamed');
  const out = {
    kind, quantity,
    subject: claim.subject || '', label: claim.label || '', at: claim.at || '',
    parts: parts.slice()
  };
  if (NEEDS_PARTS.has(kind) && !coversLine(out, text)) return unparseable('does-not-cover-line');
  return out;
}
