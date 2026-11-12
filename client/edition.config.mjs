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
// E1 changes no behaviour: nothing in the student app reads the edition yet.
// The Priyabhata build is the build `main` made before this file existed.
// Brand text (E4), sign-up course defaults (E2/E3), billing (E5) and the
// retirement of PRI_FEATURE_AUSTRALIA (E3) read from here in later missions.
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

const pending = text => Object.freeze({ pending: text });

const NSW_CONTENT = pending('No approved NSW question banks, answer specifications or certified Australian marking guidelines yet (plan G2, G3, G6).');
// Plan G3, first slice (server/platform/nswBanks.js): a Prithagoras server now
// issues and marks NSW practice. These two stay pending until the whole
// capability works end to end for the edition; each says what is still owed.
const NSW_MARKING = pending('The server issues and marks NSW practice from generators mapped to the current syllabuses, on the final answer only; still owed: the student app asking a Prithagoras server for it, and HSC examiner certification before any method mark (plan G3, G6).');
const NSW_ADAPTIVE = pending('NSW questions are issued by outcome, but many current outcomes have no issued question yet (GET /v1/curriculum lists which) and the student app\'s adaptive selection and spaced revision are not yet driven by NSW outcomes (plan G3).');
const PUBLISHING = pending('Resource publishing with review and version history, replacing hand-committed JSON (plan F3).');
const EXAM_DESK = pending('Prithagoras\'s practice desk becomes the one examination system\'s unmarked Exam Desk, for both editions (plan F4).');

export const EDITIONS = Object.freeze({
  priyabhata: Object.freeze({
    id: 'priyabhata',
    brand: 'Priyabhata',
    region: 'IN',
    defaultCourse: 'in',
    courses: Object.freeze(['in']),
    languages: Object.freeze(['en', 'hi']),
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
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
    region: 'AU',
    defaultCourse: 'nsw',
    courses: Object.freeze(['nsw']),
    languages: Object.freeze(['en']),
    locale: 'en-AU',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    capabilities: Object.freeze({
      handwritingRecognition: true,
      photoAndPdfInput: true,
      verifiedMarking: NSW_MARKING,
      stepFeedback: NSW_CONTENT,
      notesAndWorkedExamples: pending('NSW notes and worked examples are not yet authored to the current syllabus (plan G2, G3).'),
      adaptivePractice: NSW_ADAPTIVE,
      timedExams: pending('No HSC-style blueprints built from approved NSW questions yet (plan G4).'),
      examDesk: EXAM_DESK,
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
  for (const [key, e] of Object.entries(editions)) {
    if (e.id !== key) problems.push(`${key}: id ${JSON.stringify(e.id)} does not match its key`);
    if (!e.brand || e.brand === COMPANY) problems.push(`${key}: needs its own brand, not the company name`);
    if (!/^[A-Z]{2}$/.test(e.region || '')) problems.push(`${key}: region must be an ISO 3166 alpha-2 code`);
    if (!/^[A-Z]{3}$/.test(e.currency || '')) problems.push(`${key}: currency must be an ISO 4217 code`);
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
