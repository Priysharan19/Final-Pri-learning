// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a PAPER assignment (teacher workspace)
//
// A teacher assigns a paper the server already knows how to issue and mark
// (/v1/exams): an NSW blueprint paper or an NSW practice paper on Prithagoras,
// a CBSE/JEE blueprint paper on Priyabhata. The assignment stores a TEMPLATE —
// which paper, never which questions. Every student who sits it gets the
// server's own sealed paper with the server's own seeds, marked by the same
// deterministic engine as any other paper; nothing about marking changes.
//
// The student then HANDS IN a finished paper (classroom.js). The template is
// how the server checks that the paper handed in is the one that was set:
// same kind, same blueprint (or year/length/pathway), started after the
// assignment was created.
//
// Timed only: a server paper always runs to its own clock. An untimed task is
// the existing practice assignment (assignmentTargets.js), said so in the UI.
// ─────────────────────────────────────────────────────────────────────────────
import { bankPolicy } from './editionBanks.js';
import { practicePapersAllowed } from './indiaBanks.js';
import { nswRelease, nswExamPool } from './nswExamPool.js';

const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const unknownKeys = (obj, allowed) => Object.keys(obj).filter(k => !allowed.has(k));
const invalid = message => ({ ok: false, code: 'ASSIGNMENT_INVALID', message });

export const PAPER_KINDS = Object.freeze(['nsw', 'practice-paper', 'india']);
const MAX_INSTRUCTIONS = 1000;

/** The paper kinds this edition's server issues. */
export function paperKindsForEdition(policy = bankPolicy()) {
  if (policy.curriculum === 'nsw') return ['nsw', 'practice-paper'];
  return practicePapersAllowed() ? ['india', 'practice-paper'] : ['india'];
}

function readTemplate(p, kinds, env) {
  if (!plain(p) || typeof p.kind !== 'string' || !kinds.includes(p.kind)) {
    return invalid(`Choose a paper this edition sets (${kinds.join(', ')}).`);
  }
  if (p.kind === 'nsw') {
    if (unknownKeys(p, new Set(['kind', 'blueprint'])).length || typeof p.blueprint !== 'string' || !/^[a-z0-9-]{1,64}$/.test(p.blueprint)) {
      return invalid('Name the NSW paper.');
    }
    const named = nswRelease(p.blueprint, nswExamPool(), env);
    if (!named || !named.release?.released) return invalid('That NSW paper is not available to set yet.');
    return { ok: true, template: { kind: 'nsw', blueprint: p.blueprint } };
  }
  if (p.kind === 'practice-paper') {
    if (unknownKeys(p, new Set(['kind', 'year', 'minutes', 'pathway'])).length) return invalid('Name the year and length of the paper.');
    if (!Number.isInteger(p.year) || p.year < 7 || p.year > 12 || !Number.isInteger(p.minutes) || p.minutes < 10 || p.minutes > 90) {
      return invalid('A practice paper is for Years 7–12 and runs 10–90 minutes.');
    }
    const pathway = p.pathway ?? null;
    if (pathway !== null && (typeof pathway !== 'string' || !/^[a-z0-9-]{1,24}$/.test(pathway))) return invalid('That pathway is not recognised.');
    return { ok: true, template: { kind: 'practice-paper', year: p.year, minutes: p.minutes, pathway } };
  }
  // india: the blueprint fields /v1/exams reads (track, grade, variant).
  if (unknownKeys(p, new Set(['kind', 'track', 'grade', 'variant'])).length || typeof p.track !== 'string' || !/^[a-z0-9-]{1,24}$/.test(p.track)
      || !Number.isInteger(p.grade) || p.grade < 6 || p.grade > 12 || !['standard', 'basic', undefined].includes(p.variant)) {
    return invalid('Name the track, class and variant of the paper.');
  }
  return { ok: true, template: { kind: 'india', track: p.track, grade: p.grade, variant: p.variant ?? 'standard' } };
}

/**
 * Validates `{ kind: 'paper', paper, timed?, instructions? }` from a teacher.
 * Unknown keys are refused. Returns { ok, spec } | { ok: false, code, message }.
 */
export function validatePaperAssignment(input, { policy = bankPolicy(), env = process.env } = {}) {
  if (!plain(input)) return invalid('Assignment specification must be an object.');
  if (unknownKeys(input, new Set(['kind', 'paper', 'timed', 'instructions'])).length) return invalid('A paper assignment names its paper and nothing else.');
  if (input.timed !== undefined && input.timed !== true) {
    return invalid('A paper is always sat to its own time. For untimed work, set a practice assignment.');
  }
  const read = readTemplate(input.paper, paperKindsForEdition(policy), env);
  if (!read.ok) return read;
  const spec = { kind: 'paper', paper: read.template, timed: true };
  if (input.instructions !== undefined && input.instructions !== null) {
    if (typeof input.instructions !== 'string') return invalid('Instructions must be text.');
    const text = input.instructions.trim();
    if (text.length > MAX_INSTRUCTIONS) return invalid(`Instructions must be ${MAX_INSTRUCTIONS} characters or fewer.`);
    if (text) spec.instructions = text;
  }
  return { ok: true, spec };
}

/**
 * Does a stored exam result answer this template? Compared on the server's
 * own record of the paper (its kind and blueprint as sealed), never on
 * anything a device sends.
 */
export function resultMatchesTemplate(result, template) {
  if (!plain(result) || !plain(template) || result.kind !== template.kind) return false;
  if (template.kind === 'nsw') return result.blueprint?.id === template.blueprint;
  if (template.kind === 'practice-paper') {
    const p = result.paper || {};
    return p.year === template.year && p.minutes === template.minutes && (p.pathway ?? null) === (template.pathway ?? null);
  }
  if (template.kind === 'india') {
    const b = result.blueprint || {};
    return b.track === template.track && b.grade === template.grade && (b.variant ?? 'standard') === template.variant;
  }
  return false;
}
