// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the misconception ontology
//
// One wrong idea, one identity. Before this file the same misconception had as
// many names as there were places that noticed it: Step Check called it by a
// diagnosis code, a designed distractor called it by a hash of its own feedback
// sentence, and the cloud working checker called it whatever the model wrote
// that day. The learner state could not tell that "you kept the sign when the
// term crossed the =" in Year 8 equations and the `sign-on-transfer` Step Check
// caught in the student's own working were one thing to fix.
//
// THE CONTRACT
//
//   · An ID is kebab-case and is NEVER renamed. A better name goes in `aliases`
//     of a new entry; `resolveMisconceptionId` reads both. Learner records are
//     written under the canonical ID only.
//   · Names and explanations are i18n keys (en + hi), never prose here, so the
//     student-facing words can change without the identity changing.
//   · `detectors` says which part of the product can name it: `step-check`
//     (engine/diagnose.js, deterministic), `authored` (a designed trap or MCQ
//     distractor whose feedback maps here through AUTHORED_TRAP_SHAPES) and
//     `cloud` (the working checker may PROPOSE it; see confirmCloudMisconception).
//   · `recordable: false` marks a verdict that is not a misconception at all
//     (a bare counterexample). It is never written into learner state and never
//     offered to the cloud checker.
//
// AUTHORED TRAPS. A designed trap keeps its own `why` sentence as the text the
// student reads. Its identity is decided by the deterministic table below,
// keyed on the sentence's SHAPE — the same number-free shape misconceptionKey()
// has hashed since the trap ledger existed — so "3x moves across" and "7x moves
// across" are one entry. A shape that is not in the table keeps the derived ID
// it always had, `<owner>.t<hash>`: nothing is lost, and nothing is guessed.
//
// AI PROPOSES, THE ENGINE DECIDES (ADR-0001). A cloud-proposed ID is recorded
// only when the deterministic diagnoser, run on the same line, names the same
// misconception. Otherwise it is shown to the student as "possibly", and the
// learner state does not move.
// ─────────────────────────────────────────────────────────────────────────────
import { misconceptionKey, misconceptionLabel } from './adaptive.js';
import { diagnoseStep } from './diagnose.js';

/** Bumped when an ID is added. IDs are never removed or renamed. */
export const ONTOLOGY_VERSION = 1;

const STEP = 'step-check';
const AUTHORED = 'authored';
const CLOUD = 'cloud';

/**
 * The ontology. `key` is the camelCase stem of the i18n entries
 * `misconception.<key>.name` and `misconception.<key>.explain`; both are
 * written out in full so the i18n suite can see every key from here.
 */
export const MISCONCEPTIONS = Object.freeze([
  // ── Keeping an equation balanced ──────────────────────────────────────────
  { id: 'sign-on-transfer', category: 'equation-balance', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.signOnTransfer.name', explain: 'misconception.signOnTransfer.explain' },
  { id: 'one-side-only', category: 'equation-balance', detectors: [STEP, CLOUD],
    name: 'misconception.oneSideOnly.name', explain: 'misconception.oneSideOnly.explain' },
  { id: 'sides-mismatched', category: 'equation-balance', detectors: [STEP, CLOUD],
    name: 'misconception.sidesMismatched.name', explain: 'misconception.sidesMismatched.explain' },
  { id: 'wrong-inverse-operation', category: 'equation-balance', detectors: [AUTHORED, CLOUD],
    name: 'misconception.wrongInverseOperation.name', explain: 'misconception.wrongInverseOperation.explain' },
  { id: 'inequality-not-reversed', category: 'equation-balance', detectors: [AUTHORED, CLOUD],
    name: 'misconception.inequalityNotReversed.name', explain: 'misconception.inequalityNotReversed.explain' },

  // ── Brackets and expansion ────────────────────────────────────────────────
  { id: 'distribute-partial', category: 'expansion', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.distributePartial.name', explain: 'misconception.distributePartial.explain' },
  { id: 'distribute-sign', category: 'expansion', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.distributeSign.name', explain: 'misconception.distributeSign.explain' },
  { id: 'power-of-sum', category: 'expansion', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.powerOfSum.name', explain: 'misconception.powerOfSum.explain' },
  { id: 'combined-unlike-terms', category: 'expansion', detectors: [AUTHORED, CLOUD],
    name: 'misconception.combinedUnlikeTerms.name', explain: 'misconception.combinedUnlikeTerms.explain' },
  { id: 'juxtaposition-as-digits', category: 'notation', detectors: [AUTHORED, CLOUD],
    name: 'misconception.juxtapositionAsDigits.name', explain: 'misconception.juxtapositionAsDigits.explain' },

  // ── Indices ───────────────────────────────────────────────────────────────
  { id: 'negative-squared', category: 'indices', detectors: [STEP, CLOUD],
    name: 'misconception.negativeSquared.name', explain: 'misconception.negativeSquared.explain' },
  { id: 'power-of-power', category: 'indices', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.powerOfPower.name', explain: 'misconception.powerOfPower.explain' },
  { id: 'power-product', category: 'indices', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.powerProduct.name', explain: 'misconception.powerProduct.explain' },
  { id: 'power-as-multiplication', category: 'indices', detectors: [AUTHORED, CLOUD],
    name: 'misconception.powerAsMultiplication.name', explain: 'misconception.powerAsMultiplication.explain' },
  { id: 'negative-index-as-negative', category: 'indices', detectors: [AUTHORED, CLOUD],
    name: 'misconception.negativeIndexAsNegative.name', explain: 'misconception.negativeIndexAsNegative.explain' },

  // ── Functions, fractions and division ─────────────────────────────────────
  { id: 'function-of-sum', category: 'functions', detectors: [STEP, CLOUD],
    name: 'misconception.functionOfSum.name', explain: 'misconception.functionOfSum.explain' },
  { id: 'fraction-across', category: 'fractions', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.fractionAcross.name', explain: 'misconception.fractionAcross.explain' },
  { id: 'cancel-over-sum', category: 'fractions', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.cancelOverSum.name', explain: 'misconception.cancelOverSum.explain' },
  { id: 'reciprocal-flip', category: 'fractions', detectors: [STEP, AUTHORED, CLOUD],
    name: 'misconception.reciprocalFlip.name', explain: 'misconception.reciprocalFlip.explain' },

  // ── Solutions ─────────────────────────────────────────────────────────────
  { id: 'lost-root', category: 'solutions', detectors: [STEP, CLOUD],
    name: 'misconception.lostRoot.name', explain: 'misconception.lostRoot.explain' },
  { id: 'divided-by-variable', category: 'solutions', detectors: [STEP, CLOUD],
    name: 'misconception.dividedByVariable.name', explain: 'misconception.dividedByVariable.explain' },
  { id: 'root-sign-from-factor', category: 'solutions', detectors: [AUTHORED, CLOUD],
    name: 'misconception.rootSignFromFactor.name', explain: 'misconception.rootSignFromFactor.explain' },

  // ── Topic-specific ideas ──────────────────────────────────────────────────
  { id: 'perpendicular-gradient', category: 'coordinate-geometry', detectors: [AUTHORED, CLOUD],
    name: 'misconception.perpendicularGradient.name', explain: 'misconception.perpendicularGradient.explain' },
  { id: 'probability-wrong-total', category: 'probability', detectors: [AUTHORED, CLOUD],
    name: 'misconception.probabilityWrongTotal.name', explain: 'misconception.probabilityWrongTotal.explain' },

  // ── Copying and arithmetic ────────────────────────────────────────────────
  { id: 'sign-flipped', category: 'copying', detectors: [STEP, CLOUD],
    name: 'misconception.signFlipped.name', explain: 'misconception.signFlipped.explain' },
  { id: 'term-dropped', category: 'copying', detectors: [STEP, CLOUD],
    name: 'misconception.termDropped.name', explain: 'misconception.termDropped.explain' },
  { id: 'operator-swapped', category: 'copying', detectors: [STEP, CLOUD],
    name: 'misconception.operatorSwapped.name', explain: 'misconception.operatorSwapped.explain' },
  { id: 'variable-swapped', category: 'copying', detectors: [STEP, CLOUD],
    name: 'misconception.variableSwapped.name', explain: 'misconception.variableSwapped.explain' },
  { id: 'arithmetic-slip', category: 'arithmetic', detectors: [STEP, CLOUD],
    name: 'misconception.arithmeticSlip.name', explain: 'misconception.arithmeticSlip.explain' },

  // ── Not a misconception: the line is false and nothing more is known ──────
  { id: 'counterexample', category: 'unclassified', detectors: [STEP], recordable: false,
    name: 'misconception.counterexample.name', explain: 'misconception.counterexample.explain' }
].map(m => Object.freeze({ aliases: [], recordable: true, ...m, detectors: Object.freeze([...m.detectors]) })));

const BY_ID = new Map(MISCONCEPTIONS.map(m => [m.id, m]));
const ALIAS = new Map(MISCONCEPTIONS.flatMap(m => (m.aliases || []).map(a => [a, m.id])));

/** Every canonical ID, in ontology order. */
export const MISCONCEPTION_IDS = Object.freeze(MISCONCEPTIONS.map(m => m.id));

/**
 * The IDs the cloud working checker may propose. Mirrored on the server in
 * server/platform/misconceptionIds.js (the server image carries no client
 * source); client/test/misconception-ontology-check.mjs fails on any drift.
 */
export const CLOUD_MISCONCEPTION_IDS = Object.freeze(
  MISCONCEPTIONS.filter(m => m.recordable && m.detectors.includes(CLOUD)).map(m => m.id)
);

/** The canonical ID for an ID or an alias, or null when it names nothing. */
export function resolveMisconceptionId(value) {
  const s = String(value ?? '');
  if (BY_ID.has(s)) return s;
  return ALIAS.get(s) || null;
}

/** The ontology entry for an ID or alias, or null. */
export function misconceptionById(value) {
  const id = resolveMisconceptionId(value);
  return id ? BY_ID.get(id) : null;
}

/** The ontology ID a Step Check diagnosis code names, or null. */
export function idForDiagnosisCode(code) {
  const m = misconceptionById(code);
  return m && m.detectors.includes(STEP) ? m.id : null;
}

// ── Authored traps ───────────────────────────────────────────────────────────

/**
 * The number-free shape of a trap's feedback — exactly the string
 * misconceptionKey() hashes, so a legacy `<owner>.t<hash>` key and a shape in
 * this table meet on the same hash.
 */
export function trapShape(why) {
  return misconceptionLabel(why, 400)
    .toLowerCase()
    .replace(/[0-9]+(\.[0-9]+)?/g, '#')
    .replace(/[^a-z#]+/g, ' ')
    .trim();
}

/** The hash misconceptionKey() puts after `.t`, for a shape. */
export function shapeHash(shape) {
  let h = 2166136261;
  for (let i = 0; i < shape.length; i++) {
    h ^= shape.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Designed-trap feedback whose meaning is one ontology entry and nothing else.
 * Deterministic and reviewable: each row is the exact shape a generator emits.
 * A row is added only when the sentence names that misconception
 * unambiguously; anything vaguer stays on its derived ID. The ontology suite
 * checks every target exists, every shape is unique, and every shape is still
 * produced by a generator (a stale row would silently map nothing).
 */
export const AUTHORED_TRAP_SHAPES = Object.freeze([
  ['when #x moves across the equals sign it becomes #x the x coefficient is # # not # #', 'sign-on-transfer'],
  ['solving #x # # takes the # across by subtracting it #x #', 'sign-on-transfer'],
  ['perpendicular means a b # so # # the known part moves across and changes sign', 'sign-on-transfer'],
  ['equate the exponents x # # then move # across mind the sign', 'sign-on-transfer'],

  ['the minus sign belongs to the # it multiplies both terms in the bracket flipping their signs', 'distribute-sign'],
  ['removing a bracket after a minus sign changes the signs of the terms inside it', 'distribute-sign'],

  ['the # outside multiplies the # inside the bracket too', 'distribute-partial'],
  ['when expanding the constants get multiplied too it s # # and # # not # #', 'distribute-partial'],
  ['expanding gives #x # the # inside the bracket is multiplied by #', 'distribute-partial'],
  ['if you expand first the bracket gives #x # the # is multiplied by # too', 'distribute-partial'],
  ['the factor a must multiply both terms inside the bracket', 'distribute-partial'],

  ['squaring a sum is not squaring each part the cross term # #n # #n belongs there too', 'power-of-sum'],
  ['#x # # is a perfect square it has a middle term #x squaring doesn t distribute over addition', 'power-of-sum'],
  ['x # # is a perfect square it has a middle term #x squaring doesn t distribute over addition', 'power-of-sum'],

  ['a power of a power multiplies the indices x a b x ab', 'power-of-power'],
  ['a power of a power multiplies the indices adding is for multiplying two terms together', 'power-of-power'],

  ['multiplying powers of # adds the indices', 'power-product'],
  ['when multiplying powers of the same base add the indices don t multiply them', 'power-product'],
  ['when dividing powers of the same base subtract the indices', 'power-product'],
  ['dividing powers of the same base subtracts the indices', 'power-product'],
  ['for the same base exponents add they do not multiply', 'power-product'],
  ['same base multiplication adds exponents', 'power-product'],
  ['multiplying powers of the same base adds the indices multiplying them is the power of a power law which is not what is happening here', 'power-product'],

  ['# # means # multiplied by itself # times not # #', 'power-as-multiplication'],
  ['an exponent is repeated multiplication not multiplication by the exponent work with the powers of the base modulo the divisor', 'power-as-multiplication'],
  ['a negative index doesn t make the answer negative it means reciprocal', 'negative-index-as-negative'],

  ['you can t just add tops and bottoms first rewrite both fractions with a common denominator', 'fraction-across'],

  ['both numerator terms must be divided by gx', 'cancel-over-sum'],

  ['gradient is rise over run y# y# x# x# it looks like the fraction is upside down', 'reciprocal-flip'],
  ['the fraction is the wrong way up from mx p the root is p m', 'reciprocal-flip'],

  ['only like terms combine the plain numbers can t merge into the x terms', 'combined-unlike-terms'],
  ['b and n stand for two different prices so #b and #n are unlike terms they cannot be added into one', 'combined-unlike-terms'],
  ['p and c stand for two different prices so #p and #c are unlike terms they cannot be added into one', 'combined-unlike-terms'],
  ['f and y stand for two different prices so #f and #y are unlike terms they cannot be added into one', 'combined-unlike-terms'],
  ['the quotient terms are unlike and cannot be combined', 'combined-unlike-terms'],
  ['#a means # a not the digits written next to each other', 'juxtaposition-as-digits'],

  ['after getting #x # divide by # don t multiply', 'wrong-inverse-operation'],
  ['dividing both sides by # a negative number reverses the inequality this is the single most common slip in the chapter', 'inequality-not-reversed'],

  ['after factorising the roots have the opposite sign to the numbers in the brackets', 'root-sign-from-factor'],
  ['null factor law each bracket equals zero so flip the sign of the number in the bracket', 'root-sign-from-factor'],
  ['x intercepts occur where each factor is zero flip the sign of the numbers in the brackets', 'root-sign-from-factor'],
  ['the factors are x # and x # and a root is the value that makes a factor zero so the sign flips back when you solve', 'root-sign-from-factor'],
  ['x # # # gives x # solving a bracket flips the sign of the number inside', 'root-sign-from-factor'],

  ['perpendicular gradients are negative reciprocals flip the fraction as well as the sign', 'perpendicular-gradient'],
  ['almost reciprocal yes but you must also flip the sign m# m# #', 'perpendicular-gradient'],
  ['the normal s slope is # m both the reciprocal and the sign change', 'perpendicular-gradient'],

  ['the denominator is the total number of marbles including the red ones', 'probability-wrong-total'],
  ['the denominator is the total number of batteries', 'probability-wrong-total'],
  ['the denominator of a probability is every equally likely outcome all # cards not just the ones that fail', 'probability-wrong-total'],
  ['probability is favourable outcomes over all outcomes so the denominator is the whole bag # not the marbles of the other two colours', 'probability-wrong-total'],
  ['probability compares favourable outcomes with all outcomes not with the outcomes that fail the denominator is the whole carton', 'probability-wrong-total'],
  ['every one of the # people is equally likely so the denominator is the whole table not one of its rows or columns', 'probability-wrong-total']
].map(([shape, id]) => Object.freeze({ shape, id })));

const ID_BY_HASH = new Map(AUTHORED_TRAP_SHAPES.map(row => [shapeHash(row.shape), row.id]));

/** The ontology ID a designed trap's feedback maps to, or null when unmapped. */
export function mappedIdForTrap(why) {
  const shape = trapShape(why);
  return shape ? (ID_BY_HASH.get(shapeHash(shape)) || null) : null;
}

/**
 * The learner-state key for one designed trap: its ontology ID when the table
 * maps it, otherwise the derived ID `<owner>.t<hash>` it has always had.
 */
export function misconceptionIdForTrap(owner, why) {
  return mappedIdForTrap(why) || misconceptionKey(owner, why);
}

/** The learner-state key for a Step Check diagnosis, or null if it is not recordable. */
export function misconceptionIdForDiagnosis(diagnosis) {
  const m = misconceptionById(idForDiagnosisCode(diagnosis?.code));
  return m && m.recordable ? m.id : null;
}

// ── Learner-state migration ──────────────────────────────────────────────────

const LEGACY_STEP = /^(.+)\.step-([a-z][a-z-]*)$/;
const LEGACY_TRAP = /^(.+)\.t([0-9a-z]+)$/;

/** The canonical key one stored ledger key belongs under. Pure and idempotent. */
export function canonicalLedgerKey(key) {
  const k = String(key ?? '');
  const direct = resolveMisconceptionId(k);
  if (direct) return direct;
  const step = LEGACY_STEP.exec(k);
  if (step) {
    const m = misconceptionById(idForDiagnosisCode(step[2]));
    return m && m.recordable ? m.id : k;
  }
  const trap = LEGACY_TRAP.exec(k);
  if (trap) return ID_BY_HASH.get(trap[2]) || k;
  return k;
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Two records of one misconception folded into one: occurrences add (capped
 * where the ledger caps them), the most recent sighting wins the label and the
 * recency, the earliest wins `firstAt`, and the LOWER repair credit is kept —
 * a merge must never make a misconception look more repaired than either
 * record of it said.
 */
function mergeRecords(a, b) {
  const [older, newer] = num(a.lastAt) <= num(b.lastAt) ? [a, b] : [b, a];
  const firsts = [num(a.firstAt), num(b.firstAt)].filter(v => v > 0);
  return {
    ...older, ...newer,
    n: Math.min(9, num(a.n) + num(b.n)),
    credit: Math.min(num(a.credit), num(b.credit)),
    firstAt: firsts.length ? Math.min(...firsts) : (newer.firstAt ?? older.firstAt ?? null),
    lastAt: Math.max(num(a.lastAt), num(b.lastAt)) || (newer.lastAt ?? null),
    label: newer.label || older.label || '',
    dotpoint: newer.dotpoint || older.dotpoint || null
  };
}

/**
 * A trap ledger with every text-derived or Step Check key moved to its
 * ontology ID where one exists, and duplicates merged. Deterministic (keys are
 * visited in sorted order) and idempotent: a ledger already in canonical form
 * comes back value-for-value unchanged, with `changed: false`.
 */
export function migrateTrapLedger(traps) {
  if (!traps || typeof traps !== 'object' || Array.isArray(traps)) return { traps: traps || {}, changed: false };
  const out = {};
  let changed = false;
  for (const key of Object.keys(traps).sort()) {
    const record = traps[key];
    if (!record || typeof record !== 'object') { out[key] = record; continue; }
    const target = canonicalLedgerKey(key);
    if (target !== key) changed = true;
    out[target] = out[target] ? (changed = true, mergeRecords(out[target], record)) : record;
  }
  return { traps: changed ? out : traps, changed };
}

/** A stored rating row with its trap ledger in canonical form; the same object when nothing moved. */
export function migrateRatingRow(row) {
  if (!row || typeof row !== 'object' || !row.traps) return row;
  const { traps, changed } = migrateTrapLedger(row.traps);
  return changed ? { ...row, traps } : row;
}

// ── Cloud proposals ──────────────────────────────────────────────────────────

/**
 * Decide what a cloud-proposed misconception is worth.
 *
 *   'confirmed'  the deterministic diagnoser, on the same first-break line and
 *                the line before it, names the same ontology ID with HIGH
 *                confidence (exactly one hypothesis reproduces the line — the
 *                same bar the on-device Step Check uses before it records),
 *                the check was confident, and no on-device Step Check break
 *                sits elsewhere. Only this may be written into learner state.
 *                A 'medium' diagnosis means several slips reproduce the line;
 *                letting the model's proposal pick one of them would be the
 *                model deciding, so it stays 'possible'.
 *   'possible'   anything else that names a real ID. Shown, hedged; never
 *                recorded.
 *   null         no usable proposal (no break, "other", unknown ID).
 *
 * `lines` are the student's working lines as the cloud check indexed them.
 */
export function confirmCloudMisconception({ proposedId, firstBreak, lines, meta = null, confident = false, localFirstBreak = -1 } = {}) {
  const id = resolveMisconceptionId(proposedId);
  if (!id || !CLOUD_MISCONCEPTION_IDS.includes(id)) return null;
  if (!Number.isInteger(firstBreak) || firstBreak < 0 || !Array.isArray(lines) || firstBreak >= lines.length) return null;
  const possible = { id, line: firstBreak, status: 'possible' };
  if (!confident) return possible;
  if (Number.isInteger(localFirstBreak) && localFirstBreak >= 0 && localFirstBreak !== firstBreak) return possible;
  let diagnosis = null;
  try {
    diagnosis = diagnoseStep({
      prevText: firstBreak > 0 ? String(lines[firstBreak - 1] ?? '') : null,
      brokenText: String(lines[firstBreak] ?? ''),
      meta
    });
  } catch { diagnosis = null; }
  return diagnosis && diagnosis.confidence === 'high' && misconceptionIdForDiagnosis(diagnosis) === id
    ? { id, line: firstBreak, status: 'confirmed', title: diagnosis.title }
    : possible;
}
