// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the tutor policy: the smallest next help, and why
//
// A deterministic, transparent rule table. Given what the deterministic engine
// verified about the student's working (the cause class of the first break),
// the student's own server-graded evidence on this skill, and where the
// question stands (mode, ladder rungs already opened, what was already offered
// on this item), it chooses ONE intervention from a fixed menu, smallest dose
// first, and says why in a plain sentence.
//
//   keep-going      no help                                         A0
//   confirm-reading "is this what you wrote?" — never a maths hint  A0
//   self-check      a question that sends the student back to one    A2
//                   line to test it themselves; names a line, never
//                   a value, a correction or an answer
//   mistake-graph   the "See why it's wrong" view of the broken line A2
//                   (only when the caller says that view can render)
//   nudge           the hint ladder's next rung (nudge)             A3
//   prerequisite    a pointer to the earlier chapter this step uses A3
//   method          the hint ladder's next rung (method)            A4
//   worked          the hint ladder's next rung (worked step)       A5
//
// Research route (docs/research/README.md): PRODUCTIVE_MISTAKE_REPAIR_PROTOCOL
// §4–§9 (minimum permitted intervention, escalate one controlled step, fade
// after recovery, never assert a break the engine is unsure of), METACOGNITION
// _SRL_HELP_SEEKING_DEEP_DIVE_V7 §11–§15 (strategic help before step reveal,
// never punish a help request, assessment mode changes capability) and
// RESEARCH_TO_BUILD_V7 V7-26 (deterministic policy baseline). The A-levels are
// the PMR protocol's assistance ladder, recorded as provenance; they are not a
// measured evidence weight. This is a BASELINE to be tested
// (server/platform/experiments/), not a policy known to help: nothing here is
// learned or personalised, and no claim is made that it improves learning.
//
// AUTHORITY. The policy chooses which help to OFFER. It never changes a mark, a
// credit weight or the order of the hint ladder: a rung action is always the
// server's next rung (engine/hintLadder.js), opened and charged by the server's
// hint route exactly as if the student had pressed it. It never offers the
// solution rung (that ends the question and is the student's own choice), and
// it is off in every exam or one-try mode.
// ─────────────────────────────────────────────────────────────────────────────

import { HINT_RUNGS, rungLevelOf } from './hintLadder.js';

export const TUTOR_POLICY_VERSION = 'tutor-policy-v1';

/**
 * The cause classes of a verified first break. `none` = every line sent was
 * verified and none breaks; `unseen` = no working was sent, so nothing is
 * claimed about it either way.
 */
export const CAUSE_CLASSES = Object.freeze(['concept', 'arithmetic', 'method', 'notation', 'recognition', 'unverified', 'none', 'unseen']);

/** The fixed menu, in dose order (smallest first). */
export const ACTIONS = Object.freeze(['keep-going', 'confirm-reading', 'self-check', 'mistake-graph', 'nudge', 'prerequisite', 'method', 'worked']);

/** The PMR assistance level of each action (provenance, not a weight). */
export const ASSISTANCE_LEVEL = Object.freeze({
  'keep-going': 'A0', 'confirm-reading': 'A0', 'self-check': 'A2', 'mistake-graph': 'A2',
  nudge: 'A3', prerequisite: 'A3', method: 'A4', worked: 'A5'
});

/** The actions that are hint-ladder rungs (served and charged by the server). */
export const RUNG_ACTIONS = Object.freeze(['nudge', 'method', 'worked']);

/** Modes in which the policy is off: exams and every one-try mode. */
export const POLICY_OFF_MODES = Object.freeze(['exam', 'mock', 'test', 'placement', 'diagnostic', 'rush', 'match', 'assessment']);

/** Evidence older than this does not fade support: a skill not seen for a fortnight starts fresh. */
export const FADE_FRESH_MS = 14 * 24 * 3600 * 1000;
/** Independent (no-rung) correct answers on the skill before support starts lower. */
export const FADE_AFTER_INDEPENDENT = 2;

/**
 * The engine-diagnosis category (engine/misconceptions.js) → cause class.
 * Copying slips and arithmetic are execution slips; `notation` is the
 * notation category; `unclassified` (a bare counterexample: the line is false
 * but no cause is named) is unverified. Everything else names a concept.
 */
const CATEGORY_CAUSE = Object.freeze({ copying: 'arithmetic', arithmetic: 'arithmetic', notation: 'notation', unclassified: 'unverified' });

const DOSE = a => ACTIONS.indexOf(a);
const clampInt = (v, lo, hi, d) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : d);

/**
 * The cause class from what the engine and the reader reported. Pure: every
 * input is an engine output, never a model's word.
 *
 *   recognition   the reading of the student's handwriting is unconfirmed or
 *                 below its confidence floor — no maths claim can be made
 *   notation      the line parses more than one way (or did not parse)
 *   method        every line holds but the working does not reach the answer
 *   concept / arithmetic   a HIGH-confidence step diagnosis of that category
 *   unverified    anything else: a counterexample with no named cause, a
 *                 medium/low-confidence diagnosis, or a check that did not run
 *   none          every line checked holds (allLinesHold) and none breaks
 *   unseen        no working was sent: nothing is claimed about it
 */
export function causeClassOf({ recognition = null, parse = null, diagnosis = null, category = null, firstBreak = -1, allLinesHold = false, reachedAnswer = null, checked = true, seen = true } = {}) {
  const line = Number.isInteger(firstBreak) && firstBreak >= 0 ? firstBreak + 1 : null;
  if (recognition === 'unconfirmed' || recognition === 'low-confidence') return { class: 'recognition', line, confidence: 'high' };
  if (parse === 'ambiguous' || parse === 'unread') return { class: 'notation', line, confidence: 'high' };
  if (!seen) return { class: 'unseen', line: null, confidence: 'high' };
  if (!checked) return { class: 'unverified', line: null, confidence: 'low' };
  if (line === null) {
    if (allLinesHold && reachedAnswer === false) return { class: 'method', line: null, confidence: 'high' };
    // Only a check that verified every line may say the working holds.
    if (allLinesHold) return { class: 'none', line: null, confidence: 'high' };
    return { class: 'unverified', line: null, confidence: 'low' };
  }
  const confidence = diagnosis?.confidence === 'high' ? 'high' : diagnosis?.confidence === 'medium' ? 'medium' : 'low';
  if (!diagnosis || diagnosis.code === 'counterexample') return { class: 'unverified', line, confidence: 'low' };
  const cls = CATEGORY_CAUSE[category] || (category ? 'concept' : 'unverified');
  return { class: confidence === 'high' ? cls : 'unverified', line, confidence };
}

/**
 * The student's own evidence on one skill, from server-graded attempt events
 * (newest last or in any order). Independent = correct, no ladder rung opened,
 * no help from this policy above A0, not a reveal, not a repeat of content
 * already seen solved. Tutor-panel use
 * is device-observed and not on these events, so "independent" here means
 * "without the hint ladder", and is named so.
 */
export function skillEvidence(attempts = [], { skill = null, now = Date.now() } = {}) {
  const rows = (Array.isArray(attempts) ? attempts : [])
    .filter(a => a && (skill === null || skillOf(a) === skill) && Number.isFinite(Number(a.at ?? a.createdAt)))
    .sort((x, y) => Number(x.at ?? x.createdAt) - Number(y.at ?? y.createdAt));
  let independentSuccesses = 0, assistedSuccesses = 0, independentStreak = 0;
  for (const a of rows) {
    const rungs = rungLevelOf(a.hintLevel);
    // Help this policy offered on the item above A0 makes it assisted too.
    // A recorded request with no plan (level null) counts as help asked for.
    const policyHelped = Array.isArray(a.policyAssistance) && a.policyAssistance.some(x => x?.level !== 'A0');
    const independent = a.correct === true && rungs === 0 && !policyHelped && a.revealed !== true && a.repeat !== true;
    if (independent) { independentSuccesses += 1; independentStreak += 1; }
    else { if (a.correct === true && (rungs > 0 || policyHelped)) assistedSuccesses += 1; if (a.repeat !== true) independentStreak = 0; }
  }
  const last = rows[rows.length - 1] || null;
  return {
    attempts: rows.length, independentSuccesses, assistedSuccesses, independentStreak,
    lastRungs: last && Array.isArray(last.hintRungs) ? last.hintRungs.filter(r => HINT_RUNGS.includes(r)) : [],
    lastAt: last ? Number(last.at ?? last.createdAt) : null,
    ageMs: last ? Math.max(0, now - Number(last.at ?? last.createdAt)) : null
  };
}

/** The skill an attempt is evidence about: its syllabus dot point, else its generator. */
export const skillOf = a => (typeof a?.dotpoint === 'string' && a.dotpoint) ? a.dotpoint : (typeof a?.subtopic === 'string' ? a.subtopic : null);

/** Is support faded for this skill? Recent, repeated, unbroken independent success. */
export function supportFaded(evidence) {
  if (!evidence) return false;
  return evidence.independentStreak >= FADE_AFTER_INDEPENDENT
    && evidence.independentSuccesses >= FADE_AFTER_INDEPENDENT
    && Number.isFinite(evidence.ageMs) && evidence.ageMs <= FADE_FRESH_MS;
}

/** Did the student need the heavier rungs last time on this skill? */
const neededMethodLastTime = ev => !!ev && ev.lastRungs.some(r => r === 'method' || r === 'worked');

/** The rung action the ladder allows next, or null when only the solution (or nothing) is left. */
function nextRungAction(rungLevel, ladderAvailable) {
  if (!ladderAvailable) return null;
  const next = HINT_RUNGS[rungLevelOf(rungLevel)] || null;
  return RUNG_ACTIONS.includes(next) ? next : null;
}

/**
 * The base choice per cause class, before escalation. Returns the candidate
 * actions smallest first; the first one that is available (and above what was
 * already offered on this item) is taken.
 */
function candidates(cause, { faded, ev, hasLine, help }) {
  switch (cause.class) {
    case 'recognition': return ['confirm-reading'];
    case 'none':
    case 'unseen': return help ? (faded ? ['self-check', 'rung'] : ['rung']) : ['keep-going'];
    case 'notation': return hasLine ? ['self-check'] : ['keep-going'];
    case 'arithmetic': return hasLine ? ['self-check', 'mistake-graph', 'rung'] : ['rung'];
    case 'concept': {
      const prereq = neededMethodLastTime(ev) ? ['prerequisite'] : [];
      if (faded && hasLine) return ['self-check', 'mistake-graph', 'rung', ...prereq];
      return hasLine ? ['mistake-graph', ...prereq, 'rung'] : [...prereq, 'rung'];
    }
    case 'method': return faded ? ['self-check', 'rung'] : ['rung'];
    case 'unverified':
    default: return help ? ['rung'] : ['keep-going'];
  }
}

/**
 * Choose the smallest next intervention.
 *
 * @param {object} input
 * @param {{class:string,line?:number|null,confidence?:string}} input.cause  from causeClassOf
 * @param {object} [input.evidence]  from skillEvidence
 * @param {object} [input.context]
 *   mode             practice mode of the question ('practice', 'review', 'exam', …)
 *   examMode         true in any exam room
 *   oneTry           true in a one-try mode (the server offers no ladder there)
 *   rungLevel        ladder rungs already opened on this question (0–4)
 *   ladderAvailable  the question offers the ladder at all
 *   mistakeGraph     the "See why it's wrong" view can render this break
 *   prerequisite     { id, name } of the earlier chapter this step uses, or null
 *   helpRequested    the student asked for help (vs. a check after a try)
 *   offered          actions already offered on THIS item, oldest first
 * @returns {{ off?:string, action:string|null, level:string|null, rung:string|null, charges:boolean,
 *            reason:{key:string,params:object}, prompt:{key:string,params:object}|null,
 *            envelope:object, policyVersion:string }}
 */
export function decideNextHelp({ cause = null, evidence = null, context = {} } = {}) {
  const ctx = context || {};
  const mode = typeof ctx.mode === 'string' ? ctx.mode : 'practice';
  if (ctx.examMode === true || ctx.oneTry === true || POLICY_OFF_MODES.includes(mode)) {
    return off('exam', 'tutorPolicy.reason.exam');
  }
  const c = normaliseCause(cause);
  const faded = supportFaded(evidence);
  const help = ctx.helpRequested === true;
  const hasLine = Number.isInteger(c.line) && c.line >= 1;
  const rung = nextRungAction(ctx.rungLevel, ctx.ladderAvailable !== false);
  const offered = Array.isArray(ctx.offered) ? ctx.offered.filter(a => ACTIONS.includes(a)) : [];
  const floor = offered.length ? Math.max(...offered.map(DOSE)) : -1;

  const available = a => {
    if (a === 'rung') return rung;
    if (a === 'mistake-graph') return ctx.mistakeGraph === true && hasLine ? a : null;
    if (a === 'prerequisite') return ctx.prerequisite && typeof ctx.prerequisite.id === 'string' ? a : null;
    if (a === 'self-check' || a === 'confirm-reading') return a;
    if (a === 'keep-going') return a;
    return null;
  };

  // Recognition: always ask to confirm the reading. Never a maths hint, never
  // escalated into one — the maths cannot be judged until the reading is right.
  if (c.class === 'recognition') return choose('confirm-reading', c, evidence, ctx, 'tutorPolicy.reason.recognition', faded);

  const list = candidates(c, { faded, ev: evidence, hasLine, help });
  let action = null;
  // Escalate one controlled step: the first available candidate strictly
  // above what was already offered on this item. A repeated offer of the same
  // help is never the answer to "that did not help".
  for (const a of list) {
    const got = available(a);
    if (got && DOSE(got) > floor) { action = got; break; }
  }
  // Nothing in this cause's list is left above the floor: the next ladder rung
  // if there is one (a student who keeps asking is served, not lectured);
  // otherwise keep going — the only thing left is the full solution, and that
  // is the student's own choice, never offered by the policy.
  if (!action && (help || offered.length)) action = rung && DOSE(rung) > floor ? rung : null;
  if (!action) {
    const spent = (help || offered.length) && ctx.ladderAvailable !== false && !rung;
    return choose('keep-going', c, evidence, ctx, spent ? 'tutorPolicy.reason.ladderSpent' : reasonFor('keep-going', c, faded), faded);
  }
  return choose(action, c, evidence, ctx, reasonFor(action, c, faded), faded);
}

function normaliseCause(cause) {
  const cls = CAUSE_CLASSES.includes(cause?.class) ? cause.class : 'unverified';
  const line = clampInt(cause?.line, 1, 400, null);
  const confidence = ['high', 'medium', 'low'].includes(cause?.confidence) ? cause.confidence : 'low';
  // A break the engine is not sure of is never asserted (PMR §9): a concept or
  // arithmetic cause below high confidence is treated as unverified.
  if ((cls === 'concept' || cls === 'arithmetic') && confidence !== 'high') return { class: 'unverified', line, confidence };
  return { class: cls, line, confidence };
}

function reasonFor(action, c, faded) {
  if (c.class === 'unverified') return action === 'keep-going' ? 'tutorPolicy.reason.unverifiedKeepGoing' : 'tutorPolicy.reason.unverified';
  if (c.class === 'unseen' && action === 'keep-going') return 'tutorPolicy.reason.unseenKeepGoing';
  // "Nothing needs help" is said only of working that was checked and holds.
  if (action === 'keep-going') return c.class === 'none' ? 'tutorPolicy.reason.keepGoing' : 'tutorPolicy.reason.noMore';
  if (faded && (action === 'self-check')) return 'tutorPolicy.reason.faded';
  return REASON_KEY[`${c.class}:${RUNG_ACTIONS.includes(action) ? 'rung' : action}`] || 'tutorPolicy.reason.none.rung';
}

/**
 * The reason and prompt keys whose words name the kind of cause — or give a
 * verdict on the working ("nothing needs help" says every line verified).
 */
export const CAUSE_KIND_KEYS = Object.freeze(new Set([
  'tutorPolicy.reason.keepGoing', 'tutorPolicy.reason.none.rung',
  'tutorPolicy.reason.recognition', 'tutorPolicy.reason.unverified', 'tutorPolicy.reason.unverifiedKeepGoing',
  'tutorPolicy.reason.arithmetic.selfCheck', 'tutorPolicy.reason.arithmetic.mistakeGraph', 'tutorPolicy.reason.arithmetic.rung',
  'tutorPolicy.reason.concept.mistakeGraph', 'tutorPolicy.reason.concept.prerequisite', 'tutorPolicy.reason.concept.rung',
  'tutorPolicy.reason.method.rung', 'tutorPolicy.reason.notation.selfCheck', 'tutorPolicy.reason.notation.rung',
  'tutorPolicy.prompt.confirmReading', 'tutorPolicy.prompt.notation', 'tutorPolicy.prompt.arithmetic', 'tutorPolicy.prompt.concept', 'tutorPolicy.prompt.method'
]));

/** The reason sentence per (cause class, action), written out so the i18n suite can see every key. */
export const REASON_KEY = Object.freeze({
  'arithmetic:self-check': 'tutorPolicy.reason.arithmetic.selfCheck',
  'arithmetic:mistake-graph': 'tutorPolicy.reason.arithmetic.mistakeGraph',
  'arithmetic:rung': 'tutorPolicy.reason.arithmetic.rung',
  'concept:mistake-graph': 'tutorPolicy.reason.concept.mistakeGraph',
  'concept:prerequisite': 'tutorPolicy.reason.concept.prerequisite',
  'concept:rung': 'tutorPolicy.reason.concept.rung',
  'method:rung': 'tutorPolicy.reason.method.rung',
  'none:rung': 'tutorPolicy.reason.none.rung',
  'unseen:rung': 'tutorPolicy.reason.unseen.rung',
  'notation:self-check': 'tutorPolicy.reason.notation.selfCheck',
  'notation:rung': 'tutorPolicy.reason.notation.rung'
});

/** The self-check question per cause class. A line number only: never a value. */
function promptFor(action, c) {
  if (action === 'confirm-reading') return { key: 'tutorPolicy.prompt.confirmReading', params: c.line ? { line: c.line } : {} };
  if (action !== 'self-check') return null;
  const line = c.line;
  if (c.class === 'notation') return { key: 'tutorPolicy.prompt.notation', params: { line } };
  if (c.class === 'arithmetic') return { key: 'tutorPolicy.prompt.arithmetic', params: { line } };
  if (c.class === 'concept') return { key: 'tutorPolicy.prompt.concept', params: { line } };
  if (c.class === 'method') return { key: 'tutorPolicy.prompt.method', params: {} };
  return { key: 'tutorPolicy.prompt.general', params: {} };
}

function choose(action, c, evidence, ctx, reasonKey, faded) {
  const rung = RUNG_ACTIONS.includes(action) ? action : null;
  const params = {};
  if (c.line) params.line = c.line;
  if (action === 'prerequisite' && ctx.prerequisite) params.name = String(ctx.prerequisite.name || ctx.prerequisite.id);
  return {
    action, level: ASSISTANCE_LEVEL[action], rung,
    // A rung is charged by the server's hint route when the student opens it,
    // exactly as the ladder always charged. Nothing else here costs anything.
    charges: !!rung,
    reason: { key: reasonKey, params },
    prompt: promptFor(action, c),
    prerequisite: action === 'prerequisite' ? { id: ctx.prerequisite.id, name: params.name } : null,
    // Does the wording name the KIND of cause (slip, rule, method, notation,
    // reading, not verified)? Shown before resolution in practice only (CTO
    // decision 2026-11-18, docs/product/tutor-policy.md); recorded on the
    // attempt as light assistance, never charged.
    causeShown: CAUSE_KIND_KEYS.has(reasonKey) || CAUSE_KIND_KEYS.has(promptFor(action, c)?.key),
    envelope: envelopeFor(action, c, ctx, faded),
    policyVersion: TUTOR_POLICY_VERSION
  };
}

function off(why, key) {
  return { off: why, action: null, level: null, rung: null, charges: false, causeShown: false, reason: { key, params: {} }, prompt: null, prerequisite: null,
    envelope: null, policyVersion: TUTOR_POLICY_VERSION };
}

/**
 * The AssistanceEnvelope fields this decision fixes (PMR §6), for the event
 * that records the help. Reveal flags are structural: no policy action reveals
 * the next step of THIS item except `worked`, and none reveals the answer.
 */
function envelopeFor(action, c, ctx, faded) {
  return {
    policyVersion: TUTOR_POLICY_VERSION,
    level: ASSISTANCE_LEVEL[action],
    interventionType: action,
    initiator: ctx.helpRequested === true ? 'learner' : 'system',
    causeClass: c.class,
    targetLine: c.line || null,
    revealsNextStep: action === 'worked',
    revealsFinalAnswer: false,
    prerequisiteTaught: false,
    faded: !!faded
  };
}
