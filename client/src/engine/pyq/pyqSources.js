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
  'jeeadv-2026-p2-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2026 · Paper 2 · question paper with final answers',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/p2_solutions_final.pdf',
    retrieved: '2026-11-09',
    note: 'The authority prints each question and its final answer on the same page of this document; both were read from it (sha256 1cbf4be256594129810ba247681a4b7a96df7344c428a8194c77684d98094e38 on retrieval).'
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
  'jeeadv-2025-p2-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2025 · Paper 2 · Final Answer Key (question paper with answers)',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/p2_solutions_final.pdf',
    archivedAt: 'https://web.archive.org/web/20251024035400/https://jeeadv.ac.in/documents/p2_solutions_final.pdf',
    retrieved: '2026-11-09',
    note: 'jeeadv.ac.in now serves the 2026 sitting at that path; the 2025 file was read from the Internet Archive capture (sha256 bdc7e174f608718a8e409e52bdfee43b22b74be8a01b6291761fdc0adf930bac).'
  }),
  'jeeadv-2024-p1-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2024 · Paper 1 · question paper with final answer key (English)',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/Paper1_English_2024_With_Final_Keys.pdf',
    archivedAt: 'https://web.archive.org/web/20240917002941/https://jeeadv.ac.in/documents/Paper1_English_2024_With_Final_Keys.pdf',
    retrieved: '2026-11-09',
    note: 'Read from the Internet Archive capture (sha256 3bb874b9ed6830388a5067d553c5065ef30aca51634f4092b0465757928c5572); the authority prints each question with its final answer.'
  }),
  'jeeadv-2024-p2-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2024 · Paper 2 · question paper with final answer key (English)',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/Paper2_English_2024_With_Final_Keys.pdf',
    archivedAt: 'https://web.archive.org/web/20240917002948/https://jeeadv.ac.in/documents/Paper2_English_2024_With_Final_Keys.pdf',
    retrieved: '2026-11-09',
    note: 'Read from the Internet Archive capture (sha256 05159c8d51acbfcb39d46ccb1933a7f3aa1e986c754e90231d3d76431c770767); the authority prints each question with its final answer.'
  }),
  'jeeadv-2023-p1-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2023 · Paper 1 · Final Answer Keys (question paper with answers)',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/Paper1_Final_Answer_Keys.pdf',
    archivedAt: 'https://web.archive.org/web/20230620190303/https://jeeadv.ac.in/documents/Paper1_Final_Answer_Keys.pdf',
    retrieved: '2026-11-09',
    note: 'Read from the Internet Archive capture (sha256 5d27f94c2df2fd00491ba536f47c35bf31ae9b8e95625eda05c5fe9f9f1b82d3); the authority prints each question with its final answer.'
  }),
  'jeeadv-2023-p2-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2023 · Paper 2 · Final Answer Keys (question paper with answers)',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/Paper2_Final_Answer_Keys.pdf',
    archivedAt: 'https://web.archive.org/web/20230620151251/https://jeeadv.ac.in/documents/Paper2_Final_Answer_Keys.pdf',
    retrieved: '2026-11-09',
    note: 'Read from the Internet Archive capture (sha256 3f4261ee5c514046c56b59b6b7c0ee277451d3946be6800b0a1667eb05dfbb21); the authority prints each question with its final answer.'
  }),
  'jeeadv-2022-answers': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2022 · Papers 1 and 2 · final answer keys (question papers with answers)',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/jeeadv-2022-final-answer-keys.pdf',
    archivedAt: 'https://web.archive.org/web/20220911075501/https://jeeadv.ac.in/documents/jeeadv-2022-final-answer-keys.pdf',
    retrieved: '2026-11-09',
    note: 'Read from the Internet Archive capture (sha256 c946fea3ed506f78ee6b58ae0a2a6160d1822e710c066cd6507c891b4a0164f5); one document carries both papers, each question printed with its final answer.'
  }),
  'jeeadv-2019-p1-questions': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2019 · Paper 1 · question paper (English)',
    kind: 'official-question-paper',
    url: 'https://jeeadv.ac.in/past_qps/2019_1_English.pdf',
    retrieved: '2026-11-09',
    note: 'Scanned page images, read from the rendered page (sha256 c93299dddcdb2f0d90b86888e0143cbdefbbcc5aa48caa66d8568003df499ee5, matching tools/jee-question-department/official-sources.json).'
  }),
  'jeeadv-2019-p1-key': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2019 · Paper 1 · final answer key',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/KEY-2019-Final-13.06.2019-P1.pdf',
    archivedAt: 'https://web.archive.org/web/20190713224429/https://jeeadv.ac.in/documents/KEY-2019-Final-13.06.2019-P1.pdf',
    retrieved: '2026-11-09',
    note: 'sha256 e38a64f8323d1e34d34b17ce78567c9a2c3469231bef41278ba9c71be3a8adb3, matching tools/jee-question-department/official-sources.json.'
  }),
  'jeeadv-2019-p2-questions': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2019 · Paper 2 · question paper (English)',
    kind: 'official-question-paper',
    url: 'https://jeeadv.ac.in/past_qps/2019_2_English.pdf',
    retrieved: '2026-11-09',
    note: 'Scanned page images, read from the rendered page (sha256 6082e197772b7b715c1dc7e063e8b3f23797c07f9479f9bd695bd3d31752ae16, matching tools/jee-question-department/official-sources.json).'
  }),
  'jeeadv-2019-p2-key': Object.freeze({
    authority: 'Joint Admission Board · JEE (Advanced)',
    title: 'JEE (Advanced) 2019 · Paper 2 · final answer key',
    kind: 'official-final-answer-key',
    url: 'https://jeeadv.ac.in/documents/KEY-2019-Final-13.06.2019-P2.pdf',
    archivedAt: 'https://web.archive.org/web/20190713011044/https://jeeadv.ac.in/documents/KEY-2019-Final-13.06.2019-P2.pdf',
    retrieved: '2026-11-09',
    note: 'sha256 0868049ac0ee4a8ffdd9566d75620d0cb8d0da4fe172caab84f8734bfcb493fe, matching tools/jee-question-department/official-sources.json.'
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
  'cbse-2025-x-30-1-2-questions': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2025 · Mathematics Standard (041) · question paper 30/1/2',
    kind: 'official-question-paper',
    url: 'https://www.cbse.gov.in/cbsenew/question-paper/2025/X/041_Mathematics_Standard.zip',
    file: '30-1-2_Mathematics Standard.pdf',
    retrieved: '2026-11-10',
    note: 'Zip sha256 438fc0ef5e02bbf513d0da090c7846e64bd631d595f48eb919e1ba3dcfd69ebf as retrieved.'
  }),
  'cbse-2025-x-30-1-2-marking-scheme': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2024-25 · Mathematics Standard (041) · Marking Scheme 30/1/2',
    kind: 'official-marking-scheme',
    url: 'https://www.cbse.gov.in/cbsenew/Marking-Scheme/2025/X/Math.zip',
    file: 'X_MS_041_Mathematics Standard_30-1-2_2024-25.pdf',
    retrieved: '2026-11-10',
    note: 'The marking scheme reprints each question above its expected answer, so prompt and answer were read from one document. Zip sha256 11da8f09e6594bad698f5959ed5a8faeead1630eb4569b242395825254df8248 as retrieved.'
  }),
  'cbse-2025-x-30-1-3-questions': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2025 · Mathematics Standard (041) · question paper 30/1/3',
    kind: 'official-question-paper',
    url: 'https://www.cbse.gov.in/cbsenew/question-paper/2025/X/041_Mathematics_Standard.zip',
    file: '30-1-3_Mathematics Standard.pdf',
    retrieved: '2026-11-10',
    note: 'Zip sha256 438fc0ef5e02bbf513d0da090c7846e64bd631d595f48eb919e1ba3dcfd69ebf as retrieved.'
  }),
  'cbse-2025-x-30-1-3-marking-scheme': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2024-25 · Mathematics Standard (041) · Marking Scheme 30/1/3',
    kind: 'official-marking-scheme',
    url: 'https://www.cbse.gov.in/cbsenew/Marking-Scheme/2025/X/Math.zip',
    file: 'X_MS_041_Mathematics Standard_30-1-3_2024-25.pdf',
    retrieved: '2026-11-10',
    note: 'The marking scheme reprints each question above its expected answer, so prompt and answer were read from one document. Zip sha256 11da8f09e6594bad698f5959ed5a8faeead1630eb4569b242395825254df8248 as retrieved.'
  }),
  'cbse-2025-x-30-2-1-questions': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2025 · Mathematics Standard (041) · question paper 30/2/1',
    kind: 'official-question-paper',
    url: 'https://www.cbse.gov.in/cbsenew/question-paper/2025/X/041_Mathematics_Standard.zip',
    file: '30-2-1_Mathematics Standard.pdf',
    retrieved: '2026-11-10',
    note: 'Zip sha256 438fc0ef5e02bbf513d0da090c7846e64bd631d595f48eb919e1ba3dcfd69ebf as retrieved.'
  }),
  'cbse-2025-x-30-2-1-marking-scheme': Object.freeze({
    authority: 'Central Board of Secondary Education',
    title: 'CBSE Secondary School Examination 2024-25 · Mathematics Standard (041) · Marking Scheme 30/2/1',
    kind: 'official-marking-scheme',
    url: 'https://www.cbse.gov.in/cbsenew/Marking-Scheme/2025/X/Math.zip',
    file: 'X_MS_041_Mathematics Standard_30-2-1_2024-25.pdf',
    retrieved: '2026-11-10',
    note: 'The marking scheme reprints each question above its expected answer, so prompt and answer were read from one document. Zip sha256 11da8f09e6594bad698f5959ed5a8faeead1630eb4569b242395825254df8248 as retrieved.'
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
