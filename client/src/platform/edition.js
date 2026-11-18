// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · which edition is this app? (ADR-0002, plan E2)
//
// The one place client code asks "which edition am I, and what are its
// defaults?". The answer is fixed by the build (PRI_EDITION → the record
// edition-record.js carries); nothing here touches the network, storage or the
// profile, and nothing a server says can change it. An edition is who serves
// the student (brand, region, default course, languages, locale, currency); a
// COURSE is what a profile studies, and stays a per-profile field.
//
//   EDITION            'priyabhata' | 'prithagoras'
//   edition()          the frozen record: id, brand, region, defaultCourse,
//                      courses, languages, currency
//   defaultCourse()    the course a new profile starts on
//   offersCourse(c)    whether this edition offers course c
//
// The server is a different deployment per edition. editionConflict() compares
// what a server says it is with this build; a difference is a blocking state
// (components/EditionMismatch.jsx), never something to adapt to.
// ─────────────────────────────────────────────────────────────────────────────
import { EDITION_RECORD } from './edition-record.js';

export const EDITION = EDITION_RECORD.id;

/** The request header this build declares its edition in (the server only ever refuses on it). */
export const EDITION_HEADER = 'X-Pri-Edition';

export const edition = () => EDITION_RECORD;
export const defaultCourse = () => EDITION_RECORD.defaultCourse;
export const offersCourse = course => EDITION_RECORD.courses.includes(course);
/**
 * What this edition offers inside its course (owner decision, 19 Nov 2026):
 * null offers the whole catalogue (India); Prithagoras offers Years 11 and 12,
 * Advanced and Extension 1. Hidden content stays in the catalogue.
 */
/** Whether this edition offers Rapid Fire and Match (owner decision, 19 Nov 2026: not Prithagoras). */
/** The theme preference a new device opens with in this edition. */
export const themeDefault = () => EDITION_RECORD.themeDefault || 'system';
/** Whether hints are free of mark deductions in this edition (owner decision, 19 Nov 2026: Prithagoras). */
export const hintsFree = () => EDITION_RECORD.hints?.free === true;
/** Whether this edition carries the 19 Nov 2026 walk-through behaviour fixes (Prithagoras first). */
export const walkthroughFixes = () => EDITION_RECORD.walkthroughFixes === true;
export const gamesOffered = () => EDITION_RECORD.games !== false;
export const offering = () => EDITION_RECORD.offering ?? null;
export const yearOffered = year => { const o = offering(); return !o || o.years.includes(Number(year)); };
export const pathwayOffered = pathway => { const o = offering(); return !o || o.pathways.includes(pathway || 'advanced'); };
/** Whether a (year, pathway) a profile holds is one this edition offers; Years 7–10 have no pathway. */
export const courseOffered = (year, pathway) => yearOffered(year) && (Number(year) < 11 || pathwayOffered(pathway));
export const offeredYears = (years = [7, 8, 9, 10, 11, 12]) => years.filter(yearOffered);
export const offeredPathways = (list) => list.filter(p => pathwayOffered(typeof p === 'string' ? p : p.key ?? p[0]));
/** The year and pathway a new student starts on in this edition, or null when it has no preference. */
export const defaultOffering = () => { const o = offering(); return o ? { year: o.defaultYear, pathway: o.defaultPathway } : null; };
/** Whether this edition has parent-facing features (the parent report, its email links, the parent sign-in path). Priyabhata only. */
/** Whether this edition offers interface language `id` (its record's `languages`). */
export const offersLanguage = id => EDITION_RECORD.languages.includes(id);
/** The languages of `all` ({ id }) this edition offers, in their order. */
export const offeredLanguages = all => all.filter(l => offersLanguage(l.id));
/** Whether this edition reaches a person by phone (SMS). The SMS provider is India-only: Priyabhata yes, Prithagoras email only. */
export const smsOffered = () => EDITION_RECORD.region === 'IN';
/** The country calling code a phone number is typed under in this edition, or null when it offers no phone channel. */
export const phoneDialCode = () => (smsOffered() ? '+91' : null);
export const parentFeaturesOffered = () => EDITION_RECORD.family.parentFeatures === true;

const EDITION_ID = /^[a-z]{3,24}$/;

/**
 * A readable name for an edition id this build does not carry: the id with a
 * capital letter. Both brands are exactly that (client/test/edition-client-
 * check.mjs holds it), so the other edition's name never has to be bundled.
 * Null for anything that is not a plain id (editionConflict never carries one).
 */
export function editionDisplayName(id) {
  return typeof id === 'string' && EDITION_ID.test(id) ? id[0].toUpperCase() + id.slice(1) : null;
}

/**
 * The blocking state when a server says it is another edition: { service },
 * the server's edition id. Null when it is this build's edition, when the
 * server named none (one from before editions), and when what it sent is not
 * a plain edition id: the app blocks only when it can say whose service it
 * reached, and a reply it cannot read is treated as no statement at all.
 */
export function editionConflict(serverEdition) {
  return typeof serverEdition === 'string' && EDITION_ID.test(serverEdition) && serverEdition !== EDITION ? Object.freeze({ service: serverEdition }) : null;
}
