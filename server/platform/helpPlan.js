// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the tutor policy on the server: POST /v1/practice/:id/help-plan
//
// The practice router (practice.js) owns the IO — the escrowed question, the
// ladder level the server committed, the account's server-graded attempts and
// the guarded line check — and this module turns them into one decision of
// client/src/engine/tutorPolicy.js. Nothing here serves a rung, charges a rung,
// changes a mark or writes a receipt: a rung the plan points at is opened by
// the student through POST /:id/hint exactly as before.
//
// DARK BY DEFAULT. 404 unless the deployment sets PRI_FEATURE_TUTOR_POLICY=1.
// When the experiment tutor-first-help-v1 is active (server/platform/
// experiments.js), an account in its control arm gets `plan: null` — today's
// fixed ladder — and no line check is spent on it.
//
// What the device may say, and why it is enough: whether its handwriting
// reading is unconfirmed (only the device knows; it turns the plan into
// "confirm the reading", never into maths help), which plan actions it already
// showed on this item (to escalate one step, not repeat), whether the "See why
// it's wrong" view can render here, and the working lines. The lines are
// checked HERE by the marker pool's guarded line check, never taken on the
// device's word; the cause class comes from the deterministic engine's own
// diagnosis code. A device that lies can only change which non-charging
// suggestion it is shown.
// ─────────────────────────────────────────────────────────────────────────────

import { ACTIONS, causeClassOf, decideNextHelp, skillEvidence, skillOf, TUTOR_POLICY_VERSION } from '../../client/src/engine/tutorPolicy.js';
import { idForDiagnosisCode, misconceptionById } from '../../client/src/engine/misconceptions.js';
import { IN_CHAPTERS } from '../../client/src/engine/curriculum-in.js';
import { prerequisitesOf } from '../../client/src/engine/prerequisites.js';

export const TUTOR_POLICY_EXPERIMENT = 'tutor-first-help-v1';
export const HELP_PLAN_FIELDS = new Set(['lines', 'recognition', 'offered', 'mistakeGraph', 'helpRequested']);
export const HELP_PLAN_LIMITS = Object.freeze({ lines: 40, line: 400, offered: ACTIONS.length });
export const HELP_PLAN_ATTEMPTS = 300;

/** Is the tutor policy on in this deployment? Only an explicit 1. */
export const tutorPolicyServerEnabled = (env = process.env) => String(env?.PRI_FEATURE_TUTOR_POLICY || '').trim() === '1';

/** A closed body contract. Returns an error message or null. */
export function helpPlanBodyError(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'The request body is an object.';
  const extra = Object.keys(body).filter(k => !HELP_PLAN_FIELDS.has(k));
  if (extra.length) return `Unknown field(s): ${extra.join(', ')}.`;
  if (body.lines !== undefined && (!Array.isArray(body.lines) || body.lines.length > HELP_PLAN_LIMITS.lines
    || !body.lines.every(l => typeof l === 'string' && l.length <= HELP_PLAN_LIMITS.line))) return 'lines: at most 40 strings of 400 characters.';
  if (body.recognition !== undefined && !['confirmed', 'unconfirmed', 'low-confidence'].includes(body.recognition)) return 'recognition is confirmed, unconfirmed or low-confidence.';
  if (body.offered !== undefined && (!Array.isArray(body.offered) || body.offered.length > HELP_PLAN_LIMITS.offered || !body.offered.every(a => ACTIONS.includes(a)))) return 'offered lists plan actions.';
  for (const k of ['mistakeGraph', 'helpRequested']) if (body[k] !== undefined && typeof body[k] !== 'boolean') return `${k} is a boolean.`;
  return null;
}

/** The earlier chapter a Priyabhata question's chapter builds on (prerequisites.js), or null. */
export function prerequisiteFor(q) {
  const gen = typeof q?._generator === 'string' ? q._generator : q?.subtopic;
  if (!gen) return null;
  const chapter = IN_CHAPTERS.find(c => Array.isArray(c.covers) && c.covers.some(cv => cv?.gen === gen));
  const first = chapter ? prerequisitesOf(chapter.id)[0] : null;
  if (!first) return null;
  const target = IN_CHAPTERS.find(c => c.id === first.id);
  return { id: first.id, name: target?.name || first.id };
}

/**
 * The cause class from the server's own line check (practice.js
 * hintWorkEvidence) and the device's reading state. `work` is null when no
 * lines were sent; `checkRan` false when lines were sent but the line check is
 * switched off in this deployment.
 */
export function causeFromWork(work, { recognition = null, linesSent = false, checkRan = true } = {}) {
  if (recognition === 'unconfirmed' || recognition === 'low-confidence') return causeClassOf({ recognition });
  if (!linesSent) return causeClassOf({});
  if (!checkRan || !work) return causeClassOf({ checked: false });
  if (work.status === 'limit' || work.status === 'unchecked' || work.status === 'final' || work.status === 'unread') return causeClassOf({ checked: false });
  const reply = work.reply || {};
  if (reply.status === 'held') return causeClassOf({});
  if (reply.status === 'break' && Number.isInteger(reply.line)) {
    // The engine's diagnosis code names an ontology entry only when Step Check
    // can detect it deterministically; that is the confidence this path has.
    const id = typeof work.code === 'string' ? idForDiagnosisCode(work.code) : null;
    const entry = id ? misconceptionById(id) : null;
    return causeClassOf({ firstBreak: reply.line - 1, diagnosis: entry ? { code: work.code, confidence: 'high' } : (work.code ? { code: work.code, confidence: 'low' } : null), category: entry?.category || null });
  }
  return causeClassOf({ checked: false });
}

/**
 * One decision. `q` is the escrowed question, `hintLevel` the committed rung
 * level, `attempts` this account's server-graded attempts (any order),
 * `cause` from causeFromWork, `body` the validated request.
 */
export function buildHelpPlan({ q, hintLevel, attempts, cause, body = {}, ladder = true, oneTry = false, now = Date.now() }) {
  const skill = skillOf({ dotpoint: q?.dotpoint, subtopic: q?.subtopic });
  const evidence = skillEvidence(attempts, { skill, now });
  const prerequisite = prerequisiteFor(q);
  const plan = decideNextHelp({
    cause, evidence,
    context: {
      mode: q?._practiceMode || 'practice', oneTry, rungLevel: hintLevel, ladderAvailable: ladder,
      mistakeGraph: body.mistakeGraph === true, prerequisite, helpRequested: body.helpRequested !== false,
      offered: Array.isArray(body.offered) ? body.offered : []
    }
  });
  return { plan, evidence: { independentSuccesses: evidence.independentSuccesses, assistedSuccesses: evidence.assistedSuccesses, attempts: evidence.attempts } };
}

export { TUTOR_POLICY_VERSION };
