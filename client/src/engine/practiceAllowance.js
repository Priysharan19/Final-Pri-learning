/**
 * The free plan's daily practice allowance. ONE definition: the device reads it
 * for its fast pre-check and its copy (local/entitlementGate.js), and the
 * server enforces it where a creditable question is issued
 * (server/platform/practiceAllowance.js at POST /v1/practice/issue and
 * POST /v1/practice/:id/repeat), counting its own issued questions per account.
 *
 * The server's day is the edition's calendar day (practiceDayTimeZone below):
 * for Priyabhata the Indian calendar day, Asia/Kolkata, UTC+05:30, no
 * daylight saving. The device's own pre-check uses the profile's calendar,
 * which for an India profile is Asia/Kolkata unless the student set another
 * zone — so the two agree for every India profile by default, and where they
 * differ the server's answer is the one that stands.
 *
 * It lives in the engine folder because that is the only client source the
 * production image carries; a server import from anywhere else in client/src
 * fails at boot in the container (see examAllowance.js).
 */
export const FREE_PRACTICE_ALLOWANCE = Object.freeze({ perDay: 20, timeZone: 'Asia/Kolkata' });

/**
 * The calendar each regional edition counts the free-practice day in (plan
 * H7, ADR-0002): the edition's own timezone, daylight saving included.
 * Priyabhata's is FREE_PRACTICE_ALLOWANCE.timeZone above, unchanged.
 *
 * A copy, not an import: the engine folder may not read the edition table
 * (client/test/edition-config-check.mjs §5 allows one reader under
 * client/src), so server/test/edition-ai-budgets-check.mjs holds every entry
 * here equal to client/edition.config.mjs `timezone`, and fails an edition
 * that is missing.
 */
export const PRACTICE_DAY_TIME_ZONES = Object.freeze({
  priyabhata: FREE_PRACTICE_ALLOWANCE.timeZone,
  prithagoras: 'Australia/Sydney'
});

/** The timezone an edition's practice day is counted in; throws on an unknown edition. */
export function practiceDayTimeZone(editionId) {
  if (!Object.hasOwn(PRACTICE_DAY_TIME_ZONES, editionId)) throw new Error(`No practice day for edition ${JSON.stringify(editionId)}`);
  return PRACTICE_DAY_TIME_ZONES[editionId];
}

/**
 * The issue modes the cap counts: the ones the Practice surface serves through
 * POST /practice/next (and "the same question again" from History). The free
 * plan's copy is "{limit} practice questions a day, and everything else
 * unlimited": Rush and Match are games and the placement check is onboarding
 * evidence (it writes no attempt), so neither is counted by the device or by
 * the server.
 */
export const CAPPED_PRACTICE_MODES = Object.freeze(['practice', 'review', 'task']);

/**
 * Practice content that only Premium may be issued (owner default D19:
 * "Premium: unlimited questions and papers, plus JEE Advanced, which the
 * server enforces"). ONE definition, read by the server where a question is
 * issued (server/platform/practiceAllowance.js) and available to the device.
 *
 * The JEE Advanced track serves two kinds of question. Its own generators —
 * the question department's `jee-advanced-<chapter>` items and the
 * source-cited archive's `pyq-jee-advanced-<chapter>` items — exist only for
 * that track, so the server can name them and refuses them to a free account.
 * Its ordinary chapter questions at difficulty 3–4 are the same items JEE Main
 * serves on the free plan, so they are not Premium and the server does not
 * pretend they are: the device's track gate (local/entitlementGate.js) is what
 * keeps a free student out of the JEE Advanced track as a whole.
 */
export const PREMIUM_PRACTICE_CONTENT = Object.freeze([
  Object.freeze({ capability: 'jee-advanced-content', generator: /^(?:pyq-)?jee-advanced-/ })
]);

/** The Premium capability a generator's questions need, or null when free. */
export function premiumCapabilityForGenerator(generator) {
  const id = String(generator || '');
  return PREMIUM_PRACTICE_CONTENT.find(rule => rule.generator.test(id))?.capability ?? null;
}

/**
 * Owner default D20: reads of the student's own writing (ink, or a photo of
 * written working) and "Practise this" question photos are Free 5 a day and
 * Premium 25 a day, PER KIND. ONE definition: the server's per-account
 * allowance defaults to it (server/platform/aiAllowance.js, configurable per
 * deployment) and the Premium screen states it. Modelled figures, to be
 * revisited after real cost data.
 */
export const READ_ALLOWANCE = Object.freeze({ free: 5, premium: 25 });
