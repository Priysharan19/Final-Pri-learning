// The resource library's calls (server/platform/resources.js) and the pure
// helpers its page uses. The server decides which resources exist for this
// student — signed in, published, this deployment's edition — and the page
// only shows them.
//
// The cloud transport admits query-free paths only (cloudTransport.js PATH), so
// the page reads the edition's published library once and searches and filters
// it here, with the server's own rules (every word must appear; the filters
// are exact). The server's ?q=/type/subject/year/course are for callers that
// can send them (plan F2's command search).
import { cloudRequest } from '../platform/cloudTransport.js';

const ID = /^[a-z0-9][a-z0-9-]{2,119}$/;

export const libraryApi = Object.freeze({
  list: () => cloudRequest('/v1/resources'),
  read: (id) => {
    if (!ID.test(String(id || ''))) return Promise.reject(Object.assign(new Error('Unknown resource.'), { code: 'RESOURCE_NOT_FOUND' }));
    return cloudRequest(`/v1/resources/${id}`);
  }
});

export const isResourceId = (id) => ID.test(String(id || ''));

// The i18n keys, written out so client/test/i18n-check.mjs can see each one.
const TYPE_KEYS = Object.freeze({ paper: 'library.type.paper', solutions: 'library.type.solutions', notes: 'library.type.notes' });
const COURSE_KEYS = Object.freeze({ in: 'library.course.in', nsw: 'library.course.nsw' });
const CERTIFICATION_KEYS = Object.freeze({
  uploaded: 'library.cert.uploaded',
  structured: 'library.cert.structured',
  verified: 'library.cert.verified',
  issued: 'library.cert.issued',
  certified: 'library.cert.certified'
});

/** The i18n key naming a resource type, course or certification state. */
export const typeKey = (type) => (Object.hasOwn(TYPE_KEYS, type) ? TYPE_KEYS[type] : TYPE_KEYS.paper);
export const courseKey = (course) => (Object.hasOwn(COURSE_KEYS, course) ? COURSE_KEYS[course] : null);
/**
 * The plain-words line for what Pri has (and has not) done with a resource
 * (ADR-0002 §7). An unknown state reads as the lowest one: the page never
 * claims more than the server recorded.
 */
export const certificationKey = (state) => (Object.hasOwn(CERTIFICATION_KEYS, state) ? CERTIFICATION_KEYS[state] : CERTIFICATION_KEYS.uploaded);

/** { key, n } for a working time: whole hours when it is whole hours, otherwise minutes. */
export function workingTime(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) return null;
  return minutes % 60 === 0 ? { key: 'library.hours', n: minutes / 60 } : { key: 'library.minutes', n: minutes };
}

const haystack = (r) => [r.title, r.subtitle, r.description, r.subject, ...(Array.isArray(r.tags) ? r.tags : []), r.grade, r.source]
  .filter(v => typeof v === 'string').join(' ').toLowerCase();

/** The resources that match a search and filters, in the order given. */
export function filterResources(resources, { q = '', type = '', subject = '', year = '', course = '' } = {}) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  return (Array.isArray(resources) ? resources : []).filter(r => {
    if (type && r.type !== type) return false;
    if (course && r.course !== course) return false;
    if (year && String(r.year) !== String(year)) return false;
    if (subject && String(r.subject || '').toLowerCase() !== String(subject).toLowerCase()) return false;
    if (!words.length) return true;
    const text = haystack(r);
    return words.every(w => text.includes(w));
  });
}

/** An external link the page may open: https only, as the server enforces. */
export function safeExternalUrl(url) {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
