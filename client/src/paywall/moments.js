// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · when an upgrade may be offered (packaging proposal, standard #42)
//
// An upgrade is offered only at a natural value moment (engine/packaging.js
// UPGRADE_MOMENTS): today's marked-work allowance is used, the student opens
// priorities or papers, or a paper has just been finished. It is NEVER offered
// while any forbidden context holds (FORBIDDEN_UPGRADE_CONTEXTS): sign-up
// consent, a guardian flow, an error, an account restriction, a distress
// response, or an exam in progress. It is never offered to a Premium account,
// and never where Premium is not on sale.
//
// Every surface that links to the Premium screen at one of these moments asks
// upgradeOffer() first (client/test/paywall-moments-check.mjs holds the list);
// the offer itself is UpgradeNote.jsx: what you get, the price where one is
// known, "cancel anytime", and nothing that pressures — no timer, no scarcity.
// ─────────────────────────────────────────────────────────────────────────────
import { FORBIDDEN_UPGRADE_CONTEXTS, UPGRADE_MOMENTS } from '../engine/packaging.js';

/** Route prefixes that are a forbidden context by themselves. */
export const SIGN_UP_ROUTES = Object.freeze(['/signup', '/sign-up', '/consent', '/onboarding', '/welcome', '/login']);
export const GUARDIAN_ROUTES = Object.freeze(['/guardian', '/parent-consent']);

// The exam room is /exams/:id; the exam list (/exams) is not a paper in progress.
const EXAM_ROOM = /^\/exams\/[^/]+\/?$/;
const DESK_ROOM = /^\/desk\/(?!import)[^/]+\/?$/;

/** The forbidden contexts that hold for `context`, in a stable order. */
export function forbiddenContexts(context = {}) {
  const route = typeof context.route === 'string' ? context.route : '';
  const held = new Set();
  const under = list => list.some(p => route === p || route.startsWith(`${p}/`) || route.startsWith(`${p}?`) || route.startsWith(`${p}#`));
  if (context.consentPending || context.signUp || under(SIGN_UP_ROUTES)) held.add('sign-up-consent');
  if (context.guardianFlow || context.guardianConsentRequired || under(GUARDIAN_ROUTES)) held.add('guardian');
  if (context.error) held.add('error');
  if (context.restricted || context.accountRestricted || context.locked) held.add('account-restricted');
  if (context.distress || context.wellbeing) held.add('distress');
  if (context.examInProgress || ((EXAM_ROOM.test(route) || DESK_ROOM.test(route)) && !context.examFinished)) held.add('exam-in-progress');
  return FORBIDDEN_UPGRADE_CONTEXTS.filter(c => held.has(c));
}

/**
 * Whether an upgrade may be offered at `moment` in `context`.
 * context: { route, premium, onSale, consentPending, signUp, guardianFlow,
 *   guardianConsentRequired, error, restricted, accountRestricted, locked,
 *   distress, wellbeing, examInProgress, examFinished }
 * Returns { show, reason } — reason names why not (for tests and logs only).
 */
export function upgradeOffer(moment, context = {}) {
  if (!UPGRADE_MOMENTS.includes(moment)) return { show: false, reason: 'not-a-value-moment' };
  const held = forbiddenContexts(context);
  if (held.length) return { show: false, reason: held[0] };
  if (context.premium === true) return { show: false, reason: 'already-premium' };
  if (context.onSale === false) return { show: false, reason: 'not-on-sale' };
  return { show: true, reason: null };
}

/** Where the Premium screen says the student came from, per moment. */
export const MOMENT_ARRIVAL = Object.freeze({
  'practice-cap': 'practice',
  'marked-work-allowance': 'reads',
  'exams-cap': 'exams',
  priorities: 'priorities',
  papers: 'papers',
  'paper-completed': 'time-report',
  'jee-advanced': 'jee-advanced',
  insights: 'insights'
});

/** The one-line "what Premium adds here" for each moment (i18n keys). */
export const MOMENT_KEYS = Object.freeze({
  'practice-cap': 'upgrade.practiceCap',
  'marked-work-allowance': 'upgrade.markedWork',
  'exams-cap': 'upgrade.examsCap',
  priorities: 'upgrade.priorities',
  papers: 'upgrade.papers',
  'paper-completed': 'upgrade.paperCompleted',
  'jee-advanced': 'upgrade.jeeAdvanced',
  insights: 'upgrade.insights'
});
