// Pri Learning · previous-year question (PYQ) provenance registry
//
// "PYQ" is the single word every JEE and CBSE student in India uses for the
// thing they practise most: an actual question from an actual past paper. That
// makes it the one place in this repository where an invented question would do
// the most damage — a student who is told "JEE Advanced 2025, Paper 1" and is
// handed something else has been lied to about the only property they asked
// for. So provenance here is not metadata hung off a question; it is the thing
// that makes a record publishable at all, and pyqSchema.js refuses any record
// that cannot name where its prompt and its answer came from.
//
// Two registries live here and nothing else:
//
//   · PYQ_SOURCES — one entry per document actually opened while transcribing,
//     with the authority that published it and the URL it was fetched from;
//   · PYQ_EXAMS   — one entry per sitting a record may claim to come from.
//
// This layer is deliberately separate from tools/jee-question-department, which
// is the review pipeline for a project-owner-provided commercial PDF and writes
// generators/jee-pyq-data/catalog.js. That catalog is generated and must not be
// hand-edited; this archive is hand-transcribed from documents anyone can fetch
// for themselves from the exam authority, and carries the URL so they can.

/**
 * How much of a record the recorded sources actually establish. A record may
 * only claim to be a past paper question at the top two rungs; `UNVERIFIED`
 * exists so an in-progress transcription can sit in the file without ever
 * reaching a student, and pyqSchema.js enforces exactly that.
 */
export const PYQ_PROVENANCE = Object.freeze({
  // The exam authority published both the question and the answer, and both
  // were read off those documents.
  OFFICIAL_PAPER_AND_KEY: 'official-paper-and-official-key',
  // The exam authority published the question; the answer was worked out here
  // and is NOT quoted from an official key.
  OFFICIAL_PAPER_DERIVED_ANSWER: 'official-paper-and-derived-answer',
  // Neither is established. Never served.
  UNVERIFIED: 'unverified'
});

/** The provenance rungs a record is allowed to be published at. */
export const PYQ_PUBLISHABLE = Object.freeze([
  PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY,
  PYQ_PROVENANCE.OFFICIAL_PAPER_DERIVED_ANSWER
]);

// ── Documents ───────────────────────────────────────────────────────────────
// `retrieved` is the day the document was fetched and transcribed, not the day
// it was published: a URL that has since been rotated (the exam boards reuse
// `documents/p1_english.pdf` for the current year) is still checkable through
// the archived copy named in `archivedAt`.

export const PYQ_SOURCES = Object.freeze({
  'jeeadv-2026-p1-questions': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2026 · Paper 1 · question paper (English)',
    kind: 'official-question-paper',
    url: 'https://jeeadv.ac.in/documents/p1_english.pdf',
    retrieved: '2026-09-07'
  }),
  'jeeadv-2026-p1-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2026 · Paper 1 · question paper with final answers',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/p1_solutions_final.pdf',
    retrieved: '2026-09-07',
    note: 'The authority publishes the questions and the final answer on the same page of this document; both were read from it.'
  }),
  'jeeadv-2025-p1-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2025 · Paper 1 · Final Answer Key (question paper with answers)',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/p1_solutions_final.pdf',
    // jeeadv.ac.in serves the current sitting at that path, so the 2025 file is
    // cited through the Internet Archive capture that still holds it.
    archivedAt: 'https://web.archive.org/web/20250702013727/https://www.jeeadv.ac.in/documents/p1_solutions_final.pdf',
    retrieved: '2026-09-07'
  }),
  'cbse-2025-xii-65-1-1-questions': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Senior School Certificate Examination 2025 · Mathematics (041) · question paper 65/1/1',
    kind: 'official-question-paper',
    url: 'https://www.cbse.gov.in/cbsenew/question-paper/2025/XII/MATHEMATICS.zip',
    file: '65-1-1_Mathematics.pdf',
    retrieved: '2026-09-07'
  }),
  'cbse-2025-xii-65-1-1-marking-scheme': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Senior School Certificate Examination 2024-25 · Mathematics (041) · Marking Scheme 65/1/1',
    kind: 'official-marking-scheme',
    url: 'https://www.cbse.gov.in/cbsenew/Marking-Scheme/2025/XII/Math.zip',
    file: 'XII_MS 041_65-1-1 Mathematics 2024-25_.pdf',
    retrieved: '2026-09-07',
    note: 'The marking scheme reprints each question above its expected answer, so prompt and answer were read from one document.'
  }),
  'cbse-2025-x-30-1-1-questions': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2025 · Mathematics Standard (041) · question paper 30/1/1',
    kind: 'official-question-paper',
    url: 'https://www.cbse.gov.in/cbsenew/question-paper/2025/X/041_Mathematics_Standard.zip',
    file: '30-1-1_Mathematics Standard.pdf',
    retrieved: '2026-09-07'
  }),
  'cbse-2025-x-30-1-1-marking-scheme': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2024-25 · Mathematics Standard (041) · Marking Scheme 30/1/1',
    kind: 'official-marking-scheme',
    url: 'https://www.cbse.gov.in/cbsenew/Marking-Scheme/2025/X/Math.zip',
    file: 'X_MS_041_Mathematics Standard_30-1-1_2024-25.pdf',
    retrieved: '2026-09-07',
    note: 'The marking scheme reprints each question above its expected answer, so prompt and answer were read from one document.'
  })
});

// ── Sittings ────────────────────────────────────────────────────────────────
// `track` is the Pri Learning track a record from this sitting may be served
// on, and it is exact: a JEE Advanced question is a JEE Advanced question even
// though it is good preparation for JEE Main, so it is never dealt into a JEE
// Main paper where the label would read as "JEE Main 2025".

export const PYQ_EXAMS = Object.freeze({
  'jee-advanced': Object.freeze({
    id: 'jee-advanced',
    label: 'JEE Advanced',
    authority: 'Joint Admission Board · IITs',
    track: 'jee-advanced',
    grades: Object.freeze([11, 12]),
    labelFor: rec => `JEE Advanced ${rec.year} · Paper ${rec.paper} · Q${rec.questionNumber}`
  }),
  'cbse-class-12': Object.freeze({
    id: 'cbse-class-12',
    label: 'CBSE Class 12 board',
    authority: 'Central Board of Secondary Education',
    track: 'cbse',
    grades: Object.freeze([12]),
    labelFor: rec => `CBSE Class 12 Mathematics ${rec.year} · Set ${rec.setCode} · Q${rec.questionNumber}`
  }),
  'cbse-class-10': Object.freeze({
    id: 'cbse-class-10',
    label: 'CBSE Class 10 board',
    authority: 'Central Board of Secondary Education',
    track: 'cbse',
    grades: Object.freeze([10]),
    labelFor: rec => `CBSE Class 10 Mathematics (Standard) ${rec.year} · Set ${rec.setCode} · Q${rec.questionNumber}`
  })
});

/**
 * Exams a student could reasonably expect PYQs for that this archive does NOT
 * carry, and why. The product surfaces read this so "no JEE Main PYQs" is a
 * stated fact with a reason rather than a silently empty list.
 */
export const PYQ_ABSENT_EXAMS = Object.freeze([
  Object.freeze({
    id: 'jee-main',
    label: 'JEE Main',
    track: 'jee-main',
    reason: 'The NTA publishes JEE Main final answer keys publicly, but keys the answers by internal question id and releases the question paper itself only through the candidate portal. No public document carries a JEE Main question together with its official answer, so no JEE Main question is transcribed here rather than transcribing one from a coaching-site reprint and calling it official.'
  }),
  Object.freeze({
    id: 'ioqm',
    label: 'IOQM',
    track: 'olympiad',
    reason: 'IOQM past papers were not sourced for this archive.'
  })
]);

/** The document record for a source id, or null. */
export function pyqSource(id) {
  return PYQ_SOURCES[String(id || '')] || null;
}

/** The sitting record for an exam id, or null. */
export function pyqExam(id) {
  return PYQ_EXAMS[String(id || '')] || null;
}
