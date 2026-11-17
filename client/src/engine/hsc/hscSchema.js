// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC priorities · the record contract
//
// One record is one question part of one NESA HSC paper (or one item of NESA's
// 2024-syllabus sample examination), as METADATA: course, year, part, marks,
// NESA's own topic or outcome codes for it, a response type, and the NESA
// document it was read from. This module refuses, at load, any record that:
//
//   · does not name its sitting (course, year, question number);
//   · cites a source that is not in hscSources.js, or one of the wrong kind;
//   · carries a code that is not a 2017 topic (past papers) or a 2024 outcome
//     (sample) of its own course;
//   · has marks that are not a positive whole number, or a response type
//     outside HSC_RESPONSE_TYPES, or a Section I item that is not one mark of
//     multiple choice;
//   · carries any NESA TEXT — a question, a criterion, an answer — unless its
//     source says reproduction is permitted. None does (Crown copyright; the
//     NESA schools licence excludes tutoring companies), so in practice every
//     text field is refused. This is the rights gate, not a formality.
//
// A paper is refused unless its parts add up to the paper's total.
// ─────────────────────────────────────────────────────────────────────────────

import { HSC_REPRODUCTION, hscSource } from './hscSources.js';
import { HSC_COURSE_IDS, HSC_OUTCOME_BY_CODE, HSC_TOPIC_BY_CODE } from './hscOutcomes.js';

/** How a part asks to be answered (Pri's reading of the marking guideline's first criterion). */
export const HSC_RESPONSE_TYPES = Object.freeze(['mcq', 'short', 'extended', 'proof', 'sketch', 'explain']);

/** The total marks of each course's paper (NESA examination specifications). */
export const HSC_PAPER_MARKS = Object.freeze({ advanced: 100, extension1: 70 });

/**
 * Fields that would hold NESA wording. A record may carry one only from a
 * source whose `reproduction` is 'permitted'; no source in the registry is.
 */
export const HSC_TEXT_FIELDS = Object.freeze(['questionText', 'prompt', 'stem', 'text', 'criteria', 'criterion', 'answer', 'sampleAnswer', 'solution', 'feedback', 'options']);

const PART = /^([1-9]\d?)([a-h])?([ivx]+)?$/;

function fail(id, why) {
  throw new Error(`HSC record ${id || '<unknown>'}: ${why}`);
}

/** Splits a part id: '17c' → { question: 17, part: 'c', subpart: null }; '12bii' → … 'ii'. */
export function parsePart(part) {
  const m = PART.exec(String(part || ''));
  if (!m) return null;
  return { question: Number(m[1]), part: m[2] || null, subpart: m[3] || null };
}

/** Refuses NESA text on any record whose source does not permit reproduction. */
export function checkRights(rec, id) {
  const src = hscSource(rec.source);
  const permitted = src?.reproduction === HSC_REPRODUCTION.PERMITTED;
  for (const field of HSC_TEXT_FIELDS) {
    if (rec[field] !== undefined && rec[field] !== null && rec[field] !== '' && !permitted) {
      fail(id, `carries "${field}", but its source ${rec.source} does not permit reproduction (NESA Crown copyright). Store metadata only.`);
    }
  }
}

/** Validates one expanded record. Returns it frozen. */
export function validateHscRecord(rec) {
  if (!rec || typeof rec !== 'object') throw new Error('HSC record: not an object.');
  const id = rec.id;
  if (typeof id !== 'string' || !/^hsc-(advanced|extension1)-(\d{4}|2024-sample)-q\d/.test(id)) fail(id, 'has no well-formed id.');
  if (!HSC_COURSE_IDS.includes(rec.course)) fail(id, `names course ${JSON.stringify(rec.course)}.`);
  const sample = rec.kind === 'sample';
  if (!sample && rec.kind !== 'past-paper') fail(id, `has kind ${JSON.stringify(rec.kind)}.`);
  if (!sample && (!Number.isInteger(rec.year) || rec.year < 2020 || rec.year > 2100)) fail(id, `has year ${JSON.stringify(rec.year)}; only papers on the 2017 syllabus (2020 on) are tagged.`);
  const where = parsePart(rec.part);
  if (!where) fail(id, `has part ${JSON.stringify(rec.part)}.`);
  if (!Number.isInteger(rec.marks) || rec.marks < 1 || rec.marks > 8) fail(id, `has marks ${JSON.stringify(rec.marks)}.`);
  if (!HSC_RESPONSE_TYPES.includes(rec.response)) fail(id, `has response type ${JSON.stringify(rec.response)}.`);
  const sectionOne = where.question <= 10;
  if (sectionOne !== (rec.response === 'mcq')) fail(id, 'Section I (questions 1–10) is multiple choice and nothing else is.');
  if (sectionOne && rec.marks !== 1) fail(id, 'is a Section I item worth more than one mark.');

  const src = hscSource(rec.source);
  if (!src) fail(id, `cites ${JSON.stringify(rec.source)}, which is not a document in hscSources.js.`);
  const wantKind = sample ? 'sample-examination-materials' : 'marking-guidelines';
  if (src.kind !== wantKind) fail(id, `cites a ${src.kind}; its codes are read from ${wantKind}.`);
  if (!sample && !rec.source.startsWith(`nesa-${rec.course}-${rec.year}-`)) fail(id, `cites ${rec.source}, which is not its own paper's guidelines.`);
  if (!/^[0-9a-f]{64}$/.test(String(src.sha256 || ''))) fail(id, `cites ${rec.source} without the sha256 of the file read.`);
  if (!sample && !hscSource(rec.paper)) fail(id, `names paper ${JSON.stringify(rec.paper)}, which is not in hscSources.js.`);

  const codes = rec.codes;
  if (!Array.isArray(codes) || !codes.length || new Set(codes).size !== codes.length) fail(id, 'has no codes, or a repeated one.');
  for (const code of codes) {
    const known = sample ? HSC_OUTCOME_BY_CODE[code] : HSC_TOPIC_BY_CODE[code];
    if (!known) fail(id, `carries ${code}, which is not a ${sample ? '2024 outcome' : '2017 topic'} this engine maps.`);
    if (known.course !== rec.course) fail(id, `carries ${code}, which belongs to ${known.course}, not ${rec.course}.`);
  }
  checkRights(rec, id);
  return Object.freeze({ ...rec, codes: Object.freeze([...codes]), question: where.question, section: sectionOne ? 'I' : 'II' });
}

/**
 * Expands one generated paper table ({ course, year?, source, paper?, rows })
 * into validated records, and refuses the paper unless its marks add up.
 */
export function expandPaper(paper, kind) {
  const records = paper.rows.map(([part, marks, codes, response, note]) => validateHscRecord({
    id: `hsc-${paper.course}-${kind === 'sample' ? '2024-sample' : paper.year}-q${part}`,
    kind, course: paper.course, year: kind === 'sample' ? null : paper.year, part, marks,
    codes: String(codes).split(' '), response, source: paper.source,
    ...(paper.paper ? { paper: paper.paper } : {}),
    ...(note ? { note } : {})
  }));
  const ids = new Set(records.map(r => r.id));
  if (ids.size !== records.length) throw new Error(`HSC paper ${paper.source}: a question part appears twice.`);
  const total = records.reduce((s, r) => s + r.marks, 0);
  if (total !== HSC_PAPER_MARKS[paper.course]) throw new Error(`HSC paper ${paper.source}: parts add to ${total}, not ${HSC_PAPER_MARKS[paper.course]}.`);
  const mcq = records.filter(r => r.section === 'I').map(r => r.question).sort((a, b) => a - b);
  if (mcq.join() !== '1,2,3,4,5,6,7,8,9,10') throw new Error(`HSC paper ${paper.source}: Section I is not questions 1–10.`);
  return Object.freeze(records);
}
