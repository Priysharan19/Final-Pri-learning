// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the regional editions (ADR-0002, plan mission E1)
//
// One platform, two editions. Pri Learning is the company and the technology;
// Priyabhata (India) and Prithagoras (Australia) are the identities students
// meet. This file is the only place an edition is defined, the way
// client/interface.config.mjs is the only place the interface is chosen.
//
// EDITION vs COURSE — two different facts:
//   edition   who serves the student: brand, region, default course, offered
//             languages, locale, currency. Fixed per deployment by the build
//             and server variable PRI_EDITION (unset = DEFAULT_EDITION), and
//             reported in the build's features.json and on /v1/health.
//   course    what a student studies ('in' | 'nsw'), a per-profile field as it
//             has always been (client/src/api.js, client/src/local/backend.js).
//
// FULL PARITY, BOTH WAYS (ADR-0002 §3, owner instruction 2026-11-13: "every
// feature in Priyabhata is in Prithagoras and vice versa"). Both editions
// declare exactly the same CAPABILITIES. Each one is either `true` — the
// shared platform has it and nothing edition-specific (content, certification)
// stands in the way; every product gate, flag and certification still applies —
// or `{ pending }`: a written gap
// naming the plan mission that closes it (docs/architecture/
// regional-editions-plan.md). A pending entry is a debt with an owner, never a
// way to ship a lesser edition: client/test/edition-config-check.mjs fails a
// capability that is missing from either edition, a gap with no mission, and
// prints the open gaps of both editions on every run.
//
// E4 (brand): the student app reads the edition through one module,
// client/src/platform/edition-record.js (plan E2), which the build replaces with its own
// edition's record — the wordmark, the icon cut, and the {brand} every
// catalogue string uses. The build reads it in vite.config.js
// (index.html, the web manifest, icons). The courses sign-up offers and
// preselects (E3, client/src/pages/Login.jsx) and billing (E5) read from here.
// ─────────────────────────────────────────────────────────────────────────────

// The server imports this file at run time, and the production image admits
// only an allowlist of client files (server/test/production-runtime-image-
// check.mjs). So it imports nothing but the language table already in that
// image; the locale and timezone values below are held equal to
// client/src/lib/locale.js by client/test/edition-config-check.mjs.
import { isLanguage } from './src/i18n/languages.js';

/** The company line shown beside either edition's brand. */
export const COMPANY = 'Pri Learning';

/**
 * The company line as it is written under an edition wordmark (sign-in,
 * sign-up, About, account pages, the email footer) — never in the header bar.
 * Brand decision record: docs/brand/editions-decision.md (mission E4).
 */
export const COMPANY_LINE = 'by Pri Learning';

/** The icon counter cuts an edition's mark may carry (docs/brand/editions-decision.md §2). */
export const CUTS = Object.freeze(['jya', 'square']);

/**
 * The capabilities both editions are built to offer (ADR-0002, "Exactly what
 * both students get"). Listing one here is a requirement on the platform, not a
 * claim that any deployment supports it today.
 */
export const CAPABILITIES = Object.freeze([
  'handwritingRecognition',   // AI handwriting transcription, answer-blind
  'photoAndPdfInput',         // a photographed or PDF question becomes practice
  'verifiedMarking',          // the server's deterministic engine decides the mark
  'stepFeedback',             // step-by-step feedback on working
  'notesAndWorkedExamples',
  'adaptivePractice',         // adaptive practice and spaced revision
  'timedExams',               // sealed, server-marked papers (/v1/exams)
  'examDesk',                 // timed, unmarked attempt at any published paper
  'resourceLibrary',          // searchable papers, solutions and notes
  'resourcePublishing',       // staff publish resources with review and history
  'progressBookmarksExports',
  'aiTutor'                   // explanations and tutoring; never sets a mark
]);

/**
 * Every payment provider the platform has an adapter for (plan E5). An
 * edition's `billing.providers` lists the ones it sells through; an empty list
 * means Premium is not on sale in that edition: no price, plan or checkout is
 * shown and the server refuses every purchase route and payment event
 * (server/platform/billingProviders.js).
 */
export const BILLING_PROVIDERS = Object.freeze(['razorpay', 'stripe', 'apple', 'google']);

/**
 * What the pricing page may claim as a reason to choose Pri (packaging
 * proposal docs/product/packaging-2026-11.md). Each claim names the edition
 * capability it rests on; editionCommerce() drops a claim whose capability is
 * not `true` in that edition, so a page can never claim what is still pending.
 * The wording is the i18n key `pricing.why.<id>` (en-AU overrides where the
 * edition's facts differ). No statistic and no competitor is ever named.
 */
export const DIFFERENTIATORS = Object.freeze({
  engineSteps: Object.freeze({ requires: 'stepFeedback' }),
  youConfirm: Object.freeze({ requires: 'handwritingRecognition' }),
  syllabus: Object.freeze({ requires: 'notesAndWorkedExamples' }),
  examPapers: Object.freeze({ requires: 'timedExams' })
});

const pending = text => Object.freeze({ pending: text });

const NSW_CONTENT = pending('No approved NSW question banks, answer specifications or certified Australian marking guidelines yet (plan G2, G3, G6).');
// Plan G3, first slice (server/platform/nswBanks.js): a Prithagoras server now
// issues and marks NSW practice. These two stay pending until the whole
// capability works end to end for the edition; each says what is still owed.
const NSW_MARKING = pending('The server issues and marks NSW practice from generators mapped to the current syllabuses, on the final answer only; still owed: the student app asking a Prithagoras server for it, and HSC examiner certification before any method mark (plan G3, G6).');
const NSW_ADAPTIVE = pending('NSW questions are issued by outcome, but many current outcomes have no issued question yet (GET /v1/curriculum lists which) and the student app\'s adaptive selection and spaced revision are not yet driven by NSW outcomes (plan G3).');
const PUBLISHING = pending('Resource publishing with review, version history and hosted PDFs is built (staff console, schema 17); still owed: the owner turning PRI_RESOURCE_PUBLISHING on in a deployment, and a storage bucket in the edition\'s own region (India now; Australia waits for O1) (plan F3).');
// The Exam Desk is built for both editions (server /v1/desk, interface behind
// the PRI_FEATURE_EXAM_DESK build flag; typed notes, no ink yet). It stays pending
// here until it is actually offered: that is the owner turning the flag on,
// and, for Prithagoras, its own region existing first (ADR-0002 §9).
const EXAM_DESK = pending('The unmarked Exam Desk is built and ships dark behind the PRI_FEATURE_EXAM_DESK build flag; it is offered when the owner turns the flag on (plan F4).');
const EXAM_DESK_AU = pending('The unmarked Exam Desk is built and ships dark behind the PRI_FEATURE_EXAM_DESK build flag; it is offered when the owner turns the flag on, once the Australian region exists to hold its attempts (plan F4, H1).');

/** The marking policies an edition may declare. */
export const MARKING_POLICIES = Object.freeze(['switchable', 'final-answer-only']);

/**
 * The ways the two editions are ALLOWED to differ in behaviour, each with its
 * reason. edition-parity-check.mjs measures every facet in the running server and
 * fails on a difference that is not declared here (and on a declaration that no
 * longer differs). Learning features are built once; an edition may differ only
 * in curriculum, presentation, language, commercial and legal configuration, and
 * in a certification gate that one edition has passed and the other has not.
 */
export const PARITY_DECLARED = Object.freeze({
  marking: 'Certification gate: method marks are certified for India (#499 process) and not for NSW (plan G6), so Prithagoras marks the final answer only.',
  admission: 'Curriculum: NSW questions must pass the NSW quality gate and carry an outcome code before they are issued (nswBanks.js); India issues its covers as before.',
  billingProviders: 'Commercial: each edition sells through its own providers (billingProviders.js).'
});

export const EDITIONS = Object.freeze({
  priyabhata: Object.freeze({
    id: 'priyabhata',
    brand: 'Priyabhata',
    // E4, brand Direction A "Prime" (owner, 2026-11-13). Accents are the
    // approved values; edition-config-check computes their contrast.
    identity: Object.freeze({
      brandHi: 'प्रियभट',                    // Hindi running text: one ट, following आर्यभट
      wordmark: 'priyabhata',                // key into BrandMark's WORDMARKS
      wordmarkHi: 'priyabhata-hi',           // the Devanagari lockup (About)
      cut: 'jya',                            // icon counter cut: the bow and string
      accent: Object.freeze({ light: '#0a6670', dark: '#6cc3c9' }),
      onAccent: Object.freeze({ light: '#f4f3ef', dark: '#1a1a1b' }),
      description: 'Maths practice for Indian students — NCERT Classes 7–12 and JEE Main & Advanced. Handwriting read line by line, worked solutions. Answers are checked by our server with a Priyabhata account.'
    }),
    region: 'IN',
    defaultCourse: 'in',
    courses: Object.freeze(['in']),
    // What a student of this edition may be offered inside its course. null =
    // everything the catalogue holds (India, unchanged).
    offering: null,
    // Behavioural fixes from the 19 Nov 2026 walk-through (plain server-fault wording, one error notebook
    // count, the practice cap counted on answers only). India adopts them when the owner decides.
    walkthroughFixes: false,
    // Hints cost marks in this edition (the ladder's -10/-20/-30 % weights): unchanged.
    hints: Object.freeze({ free: false }),
    // The theme a NEW device opens with: 'system' (follow the device), 'dark' or 'light'.
    themeDefault: 'system',
    // Rapid Fire and Match (with their leaderboard). Owner decision, 19 Nov 2026: Prithagoras hides them.
    games: true,
    languages: Object.freeze(['en', 'hi']),
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    billing: Object.freeze({ providers: Object.freeze(['razorpay', 'apple', 'google']), currency: 'INR' }),
    // How this edition marks (audit P0 #37). `switchable`: method marks follow the
    // process-wide switch (markingPolicy.js, D12) and are on only with an independent
    // examiner's signed result for THIS edition's rubric. Items are sealed with no
    // marking limit. edition-parity-check.mjs holds this to the server's behaviour.
    marking: Object.freeze({
      policy: 'switchable',
      reason: 'Method marks follow the process-wide switch (markingPolicy.js, D12): off until an independent examiner signs the India rubric result (#499), then switchable by the operator.'
    }),
    // listPrice null: the price shown is the store's or the server's own
    // display configuration (PRI_DISPLAY_*), never a constant here.
    commerce: Object.freeze({ listPrice: null, differentiators: Object.freeze(['engineSteps', 'youConfirm', 'syllabus', 'examPapers']) }),
    // Parent-facing features (the parent weekly report, its email links and the
    // "I'm a parent or guardian" sign-in path). Priyabhata only: owner decision
    // 2026-11-18, Prithagoras has no parent account. Legally required guardian
    // consent is a separate rule (server/platform/guardianConsent.js) and is not
    // turned off by this switch.
    family: Object.freeze({ parentFeatures: true }),
    capabilities: Object.freeze({
      handwritingRecognition: true,
      photoAndPdfInput: true,
      verifiedMarking: true,
      stepFeedback: true,
      notesAndWorkedExamples: true,
      adaptivePractice: true,
      timedExams: true,
      examDesk: EXAM_DESK,
      resourceLibrary: true,
      resourcePublishing: PUBLISHING,
      progressBookmarksExports: true,
      aiTutor: true
    })
  }),
  prithagoras: Object.freeze({
    id: 'prithagoras',
    brand: 'Prithagoras',
    identity: Object.freeze({
      brandHi: null,                         // Prithagoras offers English only
      wordmark: 'prithagoras',
      wordmarkHi: null,
      cut: 'square',                         // icon counter cut: the right-angle box
      accent: Object.freeze({ light: '#7d5a00', dark: '#e0b44a' }),
      onAccent: Object.freeze({ light: '#f4f3ef', dark: '#1a1a1b' }),
      description: 'Maths practice for NSW students, Years 11 and 12 and the HSC. Handwriting read line by line, worked solutions. Answers are checked by our server with a Prithagoras account.',
      // What a link to this edition shows when it is shared (og:/twitter: tags in
      // index.html, client/brand/edition-brand.mjs). `origin` is the edition's
      // public origin (the same one scripts/check-native-archive.mjs holds the app
      // to); `image` is client/brand/prithagoras/share.png, drawn from
      // source/share-image.svg by tools/brand/share-image.mjs. Priyabhata has none:
      // its page keeps the plain summary card it has always had.
      share: Object.freeze({
        origin: 'https://au.prilearning.com',
        image: 'share.png',
        width: 1200,
        height: 630,
        title: 'Prithagoras · HSC Mathematics Advanced and Extension 1',
        alt: 'Prithagoras. HSC Mathematics Advanced and Extension 1.'
      })
    }),
    region: 'AU',
    defaultCourse: 'nsw',
    courses: Object.freeze(['nsw']),
    // Owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12, Mathematics
    // Advanced and Mathematics Extension 1 only. Everything else stays in the
    // catalogue (hidden, not deleted). Set to null to offer the whole catalogue
    // again: this is the one switch. Pathway ids are the profile's `pathway`.
    games: false,
    walkthroughFixes: true,
    // Owner decision, 19 Nov 2026: hints are FREE in Prithagoras practice (no mark
    // deduction; the ladder stays, and the full solution still ends the attempt).
    hints: Object.freeze({ free: true }),
    // Owner decision, 19 Nov 2026: Prithagoras opens DARK on a new device (Light and
    // Match device stay in Settings); this replaces the 2026-10-20 follow-device default for it.
    themeDefault: 'dark',
    offering: Object.freeze({ years: Object.freeze([11, 12]), pathways: Object.freeze(['advanced', 'ext1']), defaultYear: 12, defaultPathway: 'advanced' }),
    languages: Object.freeze(['en']),
    locale: 'en-AU',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    // Owner decision O2 (plan H3): Stripe, in AUD. Razorpay is never accepted here,
    // and Stripe is never accepted by Priyabhata (billingProviders.js).
    billing: Object.freeze({ providers: Object.freeze(['stripe']), currency: 'AUD' }),
    // Final answer only until a human HSC examiner certifies Australian rubrics (plan G6):
    // the India examiner result certifies India's rubric only. Every issued item is sealed
    // `final-answer-only` (editionBanks.js) and the method-mark switch is refused here in
    // every environment (editionMarking.js UNCERTIFIED_EDITIONS).
    marking: Object.freeze({
      policy: 'final-answer-only',
      reason: 'No certified Australian method rubric exists (plan G6); the India examiner result says nothing about NSW marking guidelines, so only the final answer is marked until an HSC examiner certifies one.'
    }),
    // The owner's live Stripe prices (owner decision O2), as the AU refund
    // policy and terms state them (docs/legal/au/*.md; packaging-check holds
    // the three equal). Changing a price is an owner action in Stripe first.
    commerce: Object.freeze({ listPrice: Object.freeze({ monthly: 9.99, annual: 99 }), differentiators: Object.freeze(['engineSteps', 'youConfirm', 'syllabus', 'examPapers']) }),
    // No parent account, parent report or parent invite in Prithagoras (owner
    // decision 2026-11-18). Guardian CONSENT for a young student is a legal rule,
    // kept by the existing consent machinery; see Priyabhata above.
    family: Object.freeze({ parentFeatures: false }),
    capabilities: Object.freeze({
      handwritingRecognition: true,
      photoAndPdfInput: true,
      verifiedMarking: NSW_MARKING,
      stepFeedback: NSW_CONTENT,
      notesAndWorkedExamples: pending('NSW notes and worked examples are not yet authored to the current syllabus (plan G2, G3).'),
      adaptivePractice: NSW_ADAPTIVE,
      timedExams: pending('Plan G4 ships dark: only partial Extension 1 and 2 papers clear the release floor (docs/content/nsw-papers-released.md); Standard and Advanced need approved questions on more Year 12 outcomes, and method marks wait on certified rubrics (plan G6).'),
      examDesk: EXAM_DESK_AU,
      resourceLibrary: true,
      resourcePublishing: PUBLISHING,
      progressBookmarksExports: true,
      aiTutor: true
    })
  })
});

export const EDITION_IDS = Object.freeze(Object.keys(EDITIONS));

/** The edition a deployment serves when PRI_EDITION is unset: today's India product. */
export const DEFAULT_EDITION = 'priyabhata';

/**
 * The edition named by an environment, or DEFAULT_EDITION when PRI_EDITION is
 * unset or blank. An unknown value throws: a typo must stop the build or the
 * server, never quietly ship the other edition's brand, region or currency.
 */
export function resolveEdition(env = process.env) {
  const raw = String(env?.PRI_EDITION ?? '').trim();
  if (!raw) return DEFAULT_EDITION;
  if (!Object.hasOwn(EDITIONS, raw)) {
    throw new Error(`PRI_EDITION=${JSON.stringify(raw)} is not an edition (client/edition.config.mjs knows ${EDITION_IDS.join(', ')})`);
  }
  return raw;
}

/** The full edition record for an id; throws on an unknown id. */
export function editionOf(id) {
  if (!Object.hasOwn(EDITIONS, id)) throw new Error(`Unknown edition ${JSON.stringify(id)}`);
  return EDITIONS[id];
}

/** Whether an edition offers a capability now (true) or still has it pending (false). */
export function capabilityOffered(id, capability) {
  return editionOf(id).capabilities[capability] === true;
}

/**
 * Every way the editions break ADR-0002's "no inferior edition" rule, as
 * strings; empty when they keep it. Exported so the check suite and any later
 * build gate share one definition.
 */
const MISSION = /\(plan [EFGH]\d+(?:, [EFGH]\d+)*\)\.?$/;

/** The open gaps, edition by edition: what each still owes to reach full parity. */
export function parityGaps(editions = EDITIONS) {
  return Object.fromEntries(Object.entries(editions).map(([key, e]) => [
    key,
    CAPABILITIES.filter(c => e.capabilities[c] !== true).map(c => ({ capability: c, pending: e.capabilities[c]?.pending ?? null }))
  ]));
}

export function editionProblems(editions = EDITIONS) {
  const problems = [];
  const courses = new Set();
  const cuts = new Set();
  for (const [key, e] of Object.entries(editions)) {
    if (e.identity?.cut) {
      if (cuts.has(e.identity.cut)) problems.push(`${key}: identity.cut ${e.identity.cut} is already another edition's`);
      cuts.add(e.identity.cut);
    }
    if (e.id !== key) problems.push(`${key}: id ${JSON.stringify(e.id)} does not match its key`);
    if (!e.brand || e.brand === COMPANY) problems.push(`${key}: needs its own brand, not the company name`);
    const id = e.identity;
    if (!id || typeof id !== 'object') problems.push(`${key}: needs an identity record (brand mark, accent, wordmark)`);
    else {
      if (!CUTS.includes(id.cut)) problems.push(`${key}: identity.cut must be one of ${CUTS.join(', ')}`);
      if (!id.wordmark) problems.push(`${key}: identity.wordmark is required`);
      if (Boolean(id.brandHi) !== Boolean(e.languages?.includes('hi'))) problems.push(`${key}: identity.brandHi is required exactly when the edition offers Hindi`);
      if (Boolean(id.wordmarkHi) !== Boolean(id.brandHi)) problems.push(`${key}: identity.wordmarkHi goes with identity.brandHi`);
      for (const field of ['accent', 'onAccent']) {
        for (const mode of ['light', 'dark']) {
          if (!/^#[0-9a-f]{6}$/.test(id[field]?.[mode] || '')) problems.push(`${key}: identity.${field}.${mode} must be a lower-case #rrggbb colour`);
        }
      }
      if (!id.description || id.description.includes(COMPANY)) problems.push(`${key}: identity.description must describe the edition by its own brand`);
    }
    if (!/^[A-Z]{2}$/.test(e.region || '')) problems.push(`${key}: region must be an ISO 3166 alpha-2 code`);
    if (!/^[A-Z]{3}$/.test(e.currency || '')) problems.push(`${key}: currency must be an ISO 4217 code`);
    const providers = e.billing?.providers;
    if (!Array.isArray(providers)) problems.push(`${key}: billing.providers must be a list (empty when Premium is not on sale)`);
    else {
      for (const p of providers) if (!BILLING_PROVIDERS.includes(p)) problems.push(`${key}: billing provider ${JSON.stringify(p)} is not one the platform has an adapter for`);
      if (new Set(providers).size !== providers.length) problems.push(`${key}: billing.providers lists a provider twice`);
    }
    if (!MARKING_POLICIES.includes(e.marking?.policy)) problems.push(`${key}: marking.policy must be one of ${MARKING_POLICIES.join(', ')}`);
    if (typeof e.marking?.reason !== 'string' || e.marking.reason.trim().length < 40) problems.push(`${key}: marking.reason must say why this edition marks as it does`);
    if (e.billing?.currency !== e.currency) problems.push(`${key}: billing.currency must be the edition's currency`);
    const list = e.commerce?.listPrice;
    if (list !== null && !(list && ['monthly', 'annual'].every(k => Number.isFinite(list[k]) && list[k] > 0))) problems.push(`${key}: commerce.listPrice must be null or { monthly, annual } positive amounts`);
    if (list && !e.billing?.providers?.length) problems.push(`${key}: commerce.listPrice is set but the edition sells through no provider`);
    for (const d of e.commerce?.differentiators || []) if (!Object.hasOwn(DIFFERENTIATORS, d)) problems.push(`${key}: unknown differentiator ${JSON.stringify(d)}`);
    const off = e.offering;
    if (off !== null && off !== undefined) {
      if (!off.years?.length || !off.pathways?.length) problems.push(`${key}: offering needs years and pathways, or null`);
      else if (!off.years.includes(off.defaultYear) || !off.pathways.includes(off.defaultPathway)) problems.push(`${key}: offering default year and pathway must be offered`);
    } else if (off === undefined) problems.push(`${key}: offering must be declared (null offers everything)`);
    if (!e.courses?.includes(e.defaultCourse)) problems.push(`${key}: default course ${JSON.stringify(e.defaultCourse)} is not one of its courses`);
    for (const c of e.courses || []) courses.add(c);
    if (!e.languages?.length || !e.languages.every(isLanguage)) problems.push(`${key}: every language must be one the app is translated into`);
    for (const cap of CAPABILITIES) {
      const v = e.capabilities?.[cap];
      if (v === true) continue;
      if (v && typeof v === 'object' && typeof v.pending === 'string' && MISSION.test(v.pending)) continue;
      problems.push(`${key}: capability ${cap} must be true, or pending with a reason naming its plan mission`);
    }
    for (const cap of Object.keys(e.capabilities || {})) {
      if (!CAPABILITIES.includes(cap)) problems.push(`${key}: declares unknown capability ${cap}`);
    }
  }
  return problems;
}

/**
 * The commercial facts a build of edition `id` may show: its list price (or
 * null) and the differentiators whose capability is live in that edition.
 */
export function editionCommerce(id) {
  const e = editionOf(id);
  const live = d => { const need = DIFFERENTIATORS[d].requires; return !need || e.capabilities[need] === true; };
  return Object.freeze({
    currency: e.currency,
    listPrice: e.commerce.listPrice ? Object.freeze({ ...e.commerce.listPrice }) : null,
    differentiators: Object.freeze(e.commerce.differentiators.filter(live))
  });
}
