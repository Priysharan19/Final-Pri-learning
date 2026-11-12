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
