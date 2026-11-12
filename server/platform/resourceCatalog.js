// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the resource library's catalogue rules and seed (plan F1)
//
// What a library resource is, what it may claim, and the one real resource the
// library starts with. No imports beyond the edition table, so the SQLite
// schema builder (db.js) can seed without importing the router. The router and
// its access rules are in resources.js.
// ─────────────────────────────────────────────────────────────────────────────
import { EDITION_IDS } from '../../client/edition.config.mjs';

export const RESOURCE_TYPES = Object.freeze(['paper', 'solutions', 'notes']);
export const RESOURCE_COURSES = Object.freeze(['in', 'nsw']);
// ADR-0002 §7, in order: each state allows what the one before it does, and more.
export const CERTIFICATION_STATES = Object.freeze(['uploaded', 'structured', 'verified', 'issued', 'certified']);
export const AVAILABILITIES = Object.freeze(['external', 'hosted']);
export const REVIEW_STATES = Object.freeze(['draft', 'published', 'withdrawn']);
// A section of a paper (plan F4's Exam Desk reads them): the question numbers
// it spans and its format. Only the formats a recorded paper actually uses.
export const SECTION_KINDS = Object.freeze(['multiple-choice', 'extended-response']);
const MAX_SECTIONS = 20;

/**
 * Every way a resource's sections break the contract, as strings. Empty is
 * allowed (a resource with no recorded sections). Otherwise each section has a
 * label, whole question numbers first ≤ last and a known kind; consecutive
 * sections are contiguous (no gap, no overlap); every bound lies within
 * 1..questionCount; and where every section carries marks and the resource has
 * a total, the sections' marks add up to it.
 */
export function sectionProblems(sections, { questionCount = null, marks = null } = {}) {
  if (sections === undefined || sections === null) return [];
  if (!Array.isArray(sections) || sections.length > MAX_SECTIONS) return [`sections must be a list of at most ${MAX_SECTIONS}`];
  if (!sections.length) return [];
  const p = [];
  if (!Number.isInteger(questionCount) || questionCount < 1) p.push('sections need the resource question count');
  sections.forEach((s, i) => {
    const at = `section ${i + 1}`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) { p.push(`${at} must be an object`); return; }
    const unknown = Object.keys(s).filter(k => !['label', 'firstQuestion', 'lastQuestion', 'kind', 'marks'].includes(k));
    if (unknown.length) p.push(`${at} has unknown fields ${unknown.join(', ')}`);
    if (!text(s.label, 60)) p.push(`${at} needs a label (≤60)`);
    if (!Number.isInteger(s.firstQuestion) || !Number.isInteger(s.lastQuestion) || s.firstQuestion < 1 || s.lastQuestion < s.firstQuestion) {
      p.push(`${at} needs whole question numbers with firstQuestion ≤ lastQuestion`);
    } else if (Number.isInteger(questionCount) && s.lastQuestion > questionCount) {
      p.push(`${at} ends at question ${s.lastQuestion}, beyond the ${questionCount} questions`);
    }
    if (!SECTION_KINDS.includes(s.kind)) p.push(`${at} kind must be one of ${SECTION_KINDS.join(', ')}`);
    if (!optionalCount(s.marks, 1000)) p.push(`${at} marks must be a whole number`);
    const prev = sections[i - 1];
    if (i > 0 && Number.isInteger(prev?.lastQuestion) && Number.isInteger(s.firstQuestion) && s.firstQuestion !== prev.lastQuestion + 1) {
      p.push(`${at} must start at question ${prev.lastQuestion + 1} (sections are contiguous)`);
    }
  });
  if (Number.isInteger(marks)) {
    const marked = sections.filter(s => Number.isInteger(s?.marks));
    const sum = marked.reduce((n, s) => n + s.marks, 0);
    if (marked.length === sections.length && sum !== marks) p.push(`section marks add up to ${sum}, not the resource's ${marks}`);
    else if (marked.length < sections.length && sum > marks) p.push(`section marks already add up to ${sum}, more than the resource's ${marks}`);
  }
  return p;
}

const ID = /^[a-z0-9][a-z0-9-]{2,119}$/;
const SUBJECT_MAX = 120;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const optionalText = (v, max) => v === null || v === undefined || (typeof v === 'string' && v.length <= max);
const optionalCount = (v, max) => v === null || v === undefined || (Number.isInteger(v) && v >= 0 && v <= max);

/** Is this an absolute https URL with a host (no credentials)? */
export function httpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password;
  } catch { return false; }
}

/**
 * Every way a resource record breaks the F1 contract, as strings; empty when it
 * is acceptable. The seed is held to it here, and F3's publishing will be.
 */
export function resourceProblems(r) {
  const p = [];
  if (!r || typeof r !== 'object') return ['resource must be an object'];
  if (typeof r.id !== 'string' || !ID.test(r.id)) p.push('id must be 3–120 lowercase letters, digits or hyphens');
  if (!text(r.title, 300)) p.push('title is required (≤300)');
  if (!optionalText(r.subtitle, 300)) p.push('subtitle must be text (≤300)');
  if (!text(r.description, 4000)) p.push('description is required (≤4000)');
  if (!RESOURCE_TYPES.includes(r.type)) p.push(`type must be one of ${RESOURCE_TYPES.join(', ')}`);
  if (!text(r.subject, SUBJECT_MAX)) p.push('subject is required');
  if (!Number.isInteger(r.year) || r.year < MIN_YEAR || r.year > MAX_YEAR) p.push('year must be a whole year');
  if (!optionalText(r.grade, 60)) p.push('grade must be text');
  if (!optionalCount(r.marks, 1000)) p.push('marks must be a whole number');
  if (!optionalCount(r.durationMinutes, 1440)) p.push('durationMinutes must be whole minutes');
  if (!optionalCount(r.readingMinutes, 240)) p.push('readingMinutes must be whole minutes');
  if (!optionalCount(r.questionCount, 1000)) p.push('questionCount must be a whole number');
  p.push(...sectionProblems(r.sections, { questionCount: r.questionCount ?? null, marks: r.marks ?? null }));
  if (!Array.isArray(r.tags) || r.tags.length > 20 || !r.tags.every(t => text(t, 60))) p.push('tags must be up to 20 short texts');
  if (!Array.isArray(r.editions) || !r.editions.length || new Set(r.editions).size !== r.editions.length || !r.editions.every(e => EDITION_IDS.includes(e))) {
    p.push(`editions must be a non-empty list of ${EDITION_IDS.join(', ')}`);
  }
  if (!RESOURCE_COURSES.includes(r.course)) p.push(`course must be one of ${RESOURCE_COURSES.join(', ')}`);
  if (!optionalText(r.syllabusVersion, 160)) p.push('syllabusVersion must be text');
  if (!CERTIFICATION_STATES.includes(r.certificationState)) p.push(`certificationState must be one of ${CERTIFICATION_STATES.join(', ')}`);
  if (r.availability === 'hosted') p.push('availability hosted is reserved for plan F3 (publishing) and is refused');
  else if (r.availability !== 'external') p.push('availability must be external');
  else if (!httpsUrl(r.url)) p.push('an external resource needs an https url');
  if (!text(r.source, 200)) p.push('source is required');
  if (!text(r.attribution, 600)) p.push('attribution is required');
  if (!text(r.rightsNote, 1200)) p.push('rightsNote is required');
  if (!text(r.disclaimer, 2000)) p.push('disclaimer is required');
  if (!REVIEW_STATES.includes(r.reviewState)) p.push(`reviewState must be one of ${REVIEW_STATES.join(', ')}`);
  for (const k of ['createdAt', 'updatedAt']) if (!Number.isInteger(r[k]) || r[k] <= 0) p.push(`${k} must be epoch milliseconds`);
  if (r.reviewState === 'published' && (!Number.isInteger(r.publishedAt) || r.publishedAt <= 0)) p.push('a published resource needs publishedAt');
  return p;
}

/**
 * The library's seed (plan F1, "no fabrication"). Exactly one real resource:
 * the one item Prithagoras published in Priysharan19/prithagoras-web
 * resources.json (schema v1, updated 2026-11-12), offered to Prithagoras only,
 * at the lowest certification state. Its title, subtitle, description, subject,
 * year, grade, marks, question count, times, tags, link, source and disclaimer
 * are copied from that file unchanged; its type 'exam' is the library's
 * 'paper'. The source gives no syllabus version, so none is claimed.
 * No India resource is seeded: none exists yet as an external, attributable
 * paper, and none is invented (Priyabhata shows an honest empty library).
 *
 * supabase/migrations/20261113000000_resource_library.sql inserts the same row
 * on Postgres; server/test/resources-check.mjs holds the two equal.
 */
const SEED_AT = Date.UTC(2026, 10, 12); // resources.json releaseDate 2026-11-12
export const RESOURCE_SEED = Object.freeze([
  Object.freeze({
    id: '2027-mathematics-advanced-assessment-1',
    title: '2027 HSC Mathematics Advanced — 100-Mark Practice Examination',
    subtitle: 'Assessment Task 1 · Challenging original paper',
    description: 'An original, challenging HSC-style Mathematics Advanced practice paper designed around an early Year 12 assessment scope. Includes 10 multiple-choice questions and 17 extended-response questions.',
    type: 'paper',
    subject: 'Mathematics Advanced',
    year: 2027,
    grade: 'Year 12',
    marks: 100,
    durationMinutes: 180,
    readingMinutes: 10,
    questionCount: 27,
    // resources.json "sections": Section I 1–10 "Multiple choice" 10 marks,
    // Section II 11–27 "Extended response" 90 marks.
    sections: Object.freeze([
      Object.freeze({ label: 'Section I', firstQuestion: 1, lastQuestion: 10, kind: 'multiple-choice', marks: 10 }),
      Object.freeze({ label: 'Section II', firstQuestion: 11, lastQuestion: 27, kind: 'extended-response', marks: 90 })
    ]),
    tags: Object.freeze(['Practice examination', '2027 HSC', '100 marks']),
    editions: Object.freeze(['prithagoras']),
    course: 'nsw',
    syllabusVersion: null,
    certificationState: 'uploaded',
    availability: 'external',
    url: 'https://boredofstudies.org/resources/2027-hsc-mathematics-advanced-ultimate-100-mark-assessment-1-practice-paper.21171/',
    source: 'Bored of Studies',
    attribution: 'Published on Bored of Studies; listed in the Prithagoras library (prithagoras-web resources.json, 2026-11-12).',
    rightsNote: 'Linked, not copied: Pri Learning keeps no copy of this paper. It stays on Bored of Studies under that site\'s terms.',
    disclaimer: 'Independent practice paper; not affiliated with NESA or any school. The first uploaded version used the Pri Learning name. It is not an official examination. Access to solutions depends on the attachments currently available on Bored of Studies.',
    reviewState: 'published',
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
    publishedAt: SEED_AT
  })
]);

/** A resource record as the row values, in the resources table's column order. */
export function resourceRowValues(r) {
  return [r.id, r.title, r.subtitle ?? null, r.description, r.type, r.subject, r.year, r.grade ?? null, r.marks ?? null,
    r.durationMinutes ?? null, r.readingMinutes ?? null, r.questionCount ?? null, JSON.stringify(r.sections ?? []), JSON.stringify(r.tags), r.course,
    r.syllabusVersion ?? null, r.certificationState, r.availability, r.url ?? null, r.source, r.attribution, r.rightsNote,
    r.disclaimer, r.reviewState, r.createdAt, r.updatedAt, r.publishedAt ?? null];
}

/**
 * SQLite: insert the seed if it is not there (createPlatformDb). A row that is
 * already present is left exactly as it is. Postgres is seeded by its migration.
 */
export function seedResourcesSqlite(db) {
  const insert = db.prepare(`INSERT OR IGNORE INTO resources(id,title,subtitle,description,type,subject,year,grade,marks,
    duration_minutes,reading_minutes,question_count,sections_json,tags_json,course,syllabus_version,certification_state,availability,url,
    source,attribution,rights_note,disclaimer,review_state,created_at,updated_at,published_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const edition = db.prepare('INSERT OR IGNORE INTO resource_editions(resource_id, edition) VALUES (?, ?)');
  db.transaction(() => {
    for (const r of RESOURCE_SEED) {
      const problems = resourceProblems(r);
      if (problems.length) throw new Error(`resource seed ${r.id} is invalid: ${problems.join('; ')}`);
      insert.run(resourceRowValues(r));
      for (const e of r.editions) edition.run(r.id, e);
    }
  })();
}

function parseTags(json) {
  try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v.filter(t => typeof t === 'string') : []; } catch { return []; }
}
/**
 * Stored sections as sent. A row that reached the table without the validator
 * is held to the same rules here: sections that break any of them are not sent
 * at all (an empty list), never sent in part.
 */
function parseSections(json, row) {
  try {
    const v = JSON.parse(json || '[]');
    const context = { questionCount: num(row?.question_count), marks: num(row?.marks) };
    if (!Array.isArray(v) || sectionProblems(v, context).length) return [];
    return v.map(s => ({ label: s.label, firstQuestion: s.firstQuestion, lastQuestion: s.lastQuestion, kind: s.kind, marks: Number.isInteger(s.marks) ? s.marks : null }));
  } catch { return []; }
}
const num = v => (v === null || v === undefined ? null : Number(v));

/** What a signed-in student is sent: the published facts, never review or edition internals. */
export function resourcePublic(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? null,
    description: row.description,
    type: row.type,
    subject: row.subject,
    year: num(row.year),
    grade: row.grade ?? null,
    marks: num(row.marks),
    durationMinutes: num(row.duration_minutes),
    readingMinutes: num(row.reading_minutes),
    questionCount: num(row.question_count),
    sections: parseSections(row.sections_json, row),
    tags: parseTags(row.tags_json),
    course: row.course,
    syllabusVersion: row.syllabus_version ?? null,
    certificationState: row.certification_state,
    availability: row.availability,
    url: row.url,
    source: row.source,
    attribution: row.attribution,
    rightsNote: row.rights_note,
    disclaimer: row.disclaimer,
    publishedAt: num(row.published_at),
    updatedAt: num(row.updated_at)
  };
}

