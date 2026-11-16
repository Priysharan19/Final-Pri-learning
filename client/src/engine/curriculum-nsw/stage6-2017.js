// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model (Prithagoras) · Stage 6 (2017), superseded
//
// The four 2017 Stage 6 mathematics syllabuses that the 2024 syllabuses replace.
// They are kept for one reason only: provenance. The `code` labels in
// curriculum.js (MA-F1, ME-T2, MEX-N1, MS-F4, …) are 2017 topic codes, and
// learner evidence recorded against them must keep meaning what it meant
// (map forwards, never rewrite: research §3.4). Nothing here is current.
//
// Topic codes and names were read from NESA's own 2017 syllabus files, linked
// from each course's NESA page, on 2026-11-13. Each page states the final HSC
// examination for the syllabus is in 2026 and that schools must not teach it
// after Term 3, 2026. Outcome codes (MA11-1 …) are not encoded: the crosswalk
// only needs topic codes, and nothing in Pri records 2017 outcome codes.
// ─────────────────────────────────────────────────────────────────────────────

const NESA = 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/mathematics/';
const DOCX = 'https://www.nsw.gov.au/sites/default/files/noindex/2026-09/';
const ACCESSED = '2026-11-13';

const topic = (code, name) => Object.freeze({ code, name });

const superseded = ({ id, title, page, docx, topics }) => Object.freeze({
  id,
  jurisdiction: 'NSW',
  authority: 'NESA',
  title,
  version: '2017',
  status: 'superseded',
  stage: 6,
  implementation: Object.freeze({ lastTaught: '2026 Term 3', finalHscExam: 2026 }),
  sources: Object.freeze([
    Object.freeze({ url: NESA + page, accessed: ACCESSED, supports: 'Final HSC examination 2026; not to be taught after Term 3, 2026' }),
    Object.freeze({ url: DOCX + docx, accessed: ACCESSED, supports: 'Topic codes and names (NESA 2017 syllabus file, available until December 2026)' })
  ]),
  topics: Object.freeze(topics)
});

export const NSW_MATHEMATICS_ADVANCED_2017 = superseded({
  id: 'nsw-mathematics-advanced-stage6-2017',
  title: 'Mathematics Advanced Stage 6 Syllabus (2017)',
  page: 'mathematics-advanced-stage-6-2017',
  docx: 'mathematics-advanced-stage-6-syllabus-2017-updated-implementation-info.DOCX',
  topics: [
    topic('MA-F1', 'Working with Functions'),
    topic('MA-F2', 'Graphing Techniques'),
    topic('MA-T1', 'Trigonometry and Measure of Angles'),
    topic('MA-T2', 'Trigonometric Functions and Identities'),
    topic('MA-T3', 'Trigonometric Functions and Graphs'),
    topic('MA-C1', 'Introduction to Differentiation'),
    topic('MA-C2', 'Differential Calculus'),
    topic('MA-C3', 'Applications of Differentiation'),
    topic('MA-C4', 'Integral Calculus'),
    topic('MA-E1', 'Logarithms and Exponentials'),
    topic('MA-M1', 'Modelling Financial Situations'),
    topic('MA-S1', 'Probability and Discrete Probability Distributions'),
    topic('MA-S2', 'Descriptive Statistics and Bivariate Data Analysis'),
    topic('MA-S3', 'Random Variables')
  ]
});

export const NSW_MATHEMATICS_EXTENSION1_2017 = superseded({
  id: 'nsw-mathematics-extension1-stage6-2017',
  title: 'Mathematics Extension 1 Stage 6 Syllabus (2017)',
  page: 'mathematics-extension-1-stage-6-2017',
  docx: 'mathematics-extension-1-stage-6-syllabus-2017-updated-implementation-info.DOCX',
  topics: [
    topic('ME-F1', 'Further Work with Functions'),
    topic('ME-F2', 'Polynomials'),
    topic('ME-T1', 'Inverse Trigonometric Functions'),
    topic('ME-T2', 'Further Trigonometric Identities'),
    topic('ME-T3', 'Trigonometric Equations'),
    topic('ME-C1', 'Rates of Change'),
    topic('ME-C2', 'Further Calculus Skills'),
    topic('ME-C3', 'Applications of Calculus'),
    topic('ME-A1', 'Working with Combinatorics'),
    topic('ME-P1', 'Proof by Mathematical Induction'),
    topic('ME-V1', 'Introduction to Vectors'),
    topic('ME-S1', 'The Binomial Distribution')
  ]
});

export const NSW_MATHEMATICS_EXTENSION2_2017 = superseded({
  id: 'nsw-mathematics-extension2-stage6-2017',
  title: 'Mathematics Extension 2 Stage 6 Syllabus (2017)',
  page: 'mathematics-extension-2-stage-6-2017',
  docx: 'mathematics-extension-2-stage-6-syllabus-2017-updated-implementation-info.DOCX',
  topics: [
    topic('MEX-P1', 'The Nature of Proof'),
    topic('MEX-P2', 'Further Proof by Mathematical Induction'),
    topic('MEX-V1', 'Further Work with Vectors'),
    topic('MEX-N1', 'Introduction to Complex Numbers'),
    topic('MEX-N2', 'Using Complex Numbers'),
    topic('MEX-C1', 'Further Integration'),
    topic('MEX-M1', 'Applications of Calculus to Mechanics')
  ]
});

export const NSW_MATHEMATICS_STANDARD_2017 = superseded({
  id: 'nsw-mathematics-standard-stage6-2017',
  title: 'Mathematics Standard Stage 6 Syllabus (2017)',
  page: 'mathematics-standard-stage-6-2017',
  docx: 'mathematics-standard-stage-6-2017-updated-implementation-info.DOCX',
  topics: [
    topic('MS-A1', 'Formulae and Equations'),
    topic('MS-A2', 'Linear Relationships'),
    topic('MS-A3', 'Types of Relationships'),
    topic('MS-A4', 'Types of Relationships'),
    topic('MS-F1', 'Money Matters'),
    topic('MS-F2', 'Investment'),
    topic('MS-F3', 'Depreciation and Loans'),
    topic('MS-F4', 'Investments and Loans'),
    topic('MS-F5', 'Annuities'),
    topic('MS-M1', 'Applications of Measurement'),
    topic('MS-M2', 'Working with Time'),
    topic('MS-M3', 'Right-angled Triangles'),
    topic('MS-M4', 'Rates'),
    topic('MS-M5', 'Scale Drawings'),
    topic('MS-M6', 'Non-right-angled Trigonometry'),
    topic('MS-M7', 'Rates and Ratios'),
    topic('MS-N1', 'Networks and Paths'),
    topic('MS-N2', 'Network Concepts'),
    topic('MS-N3', 'Critical Path Analysis'),
    topic('MS-S1', 'Data Analysis'),
    topic('MS-S2', 'Relative Frequency and Probability'),
    topic('MS-S3', 'Further Statistical Analysis'),
    topic('MS-S4', 'Bivariate Data Analysis'),
    topic('MS-S5', 'The Normal Distribution')
  ]
});
