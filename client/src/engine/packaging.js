/**
 * Pri Learning · what Free and Premium include, in ONE place.
 *
 * Every allowance the server enforces and the Premium screen states is read
 * from the ACTIVE packaging below: the free daily practice cap
 * (practiceAllowance.js → server/platform/practiceAllowance.js), the reads of
 * the student's own writing and of question photos (READ_ALLOWANCE →
 * server/platform/aiAllowance.js), and the free exam simulation
 * (examAllowance.js → server/platform/exams.js). Changing packaging is one
 * line: ACTIVE_PACKAGING_ID.
 *
 * Two packagings are defined:
 *   · 'value-2026-11' — ACTIVE. Owner-approved in chat on 2026-11-18 (recorded
 *                      in docs/product/packaging-2026-11.md, "Owner decision"):
 *                      practice uncapped on Free (marking work is the daily
 *                      allowance instead), 5 marked handwriting reads and 5
 *                      question photos a day on Free, 50 and 50 on Premium.
 *                      The proposal said 10 and 100; the owner lowered them
 *                      because the measured cost (US$0.0046 per read on
 *                      average, US$0.0103 for a full page, 2026-11-18,
 *                      docs/operations/recognition-cost.md) put 100 a day at
 *                      about US$62 per student per month in the worst case.
 *                      Price is unchanged.
 *   · 'd19-d20'      — owner defaults D19 / D20 (docs/release/
 *                      V1_DECISIONS_2026-11-01.md). SUPERSEDED on 2026-11-18,
 *                      kept defined so the comparison and the tests can name it.
 *
 * It lives in the engine folder because that is the only client source the
 * production server image carries (see examAllowance.js). It must not read
 * the edition table (edition-config-check §5): packaging is the same in both
 * editions (ADR-0002 — editions differ in price and currency, never in what
 * a plan includes, apart from content that exists in only one edition, like
 * JEE Advanced).
 *
 * `null` for a free daily allowance means "not capped".
 */
export const PACKAGINGS = Object.freeze({
  'd19-d20': Object.freeze({
    id: 'd19-d20',
    status: 'superseded',
    free: Object.freeze({
      practicePerDay: 20,
      readsPerDay: 5,
      examsPerWindow: 1,
      examWindowDays: 30
    }),
    premium: Object.freeze({ readsPerDay: 50 })
  }),
  'value-2026-11': Object.freeze({
    id: 'value-2026-11',
    status: 'current',
    free: Object.freeze({
      practicePerDay: null,
      readsPerDay: 5,
      examsPerWindow: 1,
      examWindowDays: 30
    }),
    premium: Object.freeze({ readsPerDay: 50 })
  })
});

/** The packaging this build and this server enforce. Owner-approved only. */
export const ACTIVE_PACKAGING_ID = 'value-2026-11';

export function packagingOf(id) {
  if (!Object.hasOwn(PACKAGINGS, id)) throw new Error(`Unknown packaging ${JSON.stringify(id)}`);
  return PACKAGINGS[id];
}

export const PACKAGING = packagingOf(ACTIVE_PACKAGING_ID);

/**
 * The plans at a glance, for the pricing comparison. `difficulties: 'all'` is
 * a promise both packagings keep: no difficulty level is ever Premium-only
 * (packaging-check holds the issue path to it).
 */
export const PLAN_PROMISES = Object.freeze({
  difficulties: 'all',
  stepChecked: 'every-plan',
  notesAndErrorLog: 'every-plan',
  spacedRetests: 'every-plan'
});

/**
 * Where an upgrade may be offered, and where it never may. The moments are the
 * natural value points named in the proposal; the forbidden contexts come from
 * docs/product/PRI_LEARNING_STANDARD.md #42 (never upsell during a consent or
 * restriction moment). client/src/paywall/moments.js applies them.
 */
export const UPGRADE_MOMENTS = Object.freeze([
  'practice-cap',          // today's free practice questions are used (d19-d20 only)
  'marked-work-allowance', // today's marked handwriting / photo answers are used
  'exams-cap',             // the free exam simulation for this window is used
  'priorities',            // opening the exam priorities layer
  'papers',                // opening targeted / generated papers
  'paper-completed',       // the result of a finished paper
  'jee-advanced',          // opening the JEE Advanced track (Priyabhata)
  'insights'               // opening the estimate / mistake patterns
]);

export const FORBIDDEN_UPGRADE_CONTEXTS = Object.freeze([
  'sign-up-consent',
  'guardian',
  'error',
  'account-restricted',
  'distress',
  'exam-in-progress'
]);
