import assert from 'node:assert/strict';
import { inferHscYear, nswMathsSyllabusFor } from '../src/engine/nswSyllabus.js';

let checks = 0;
const eq = (actual, expected, message) => {
  checks += 1;
  assert.deepEqual(actual, expected, message);
};
const throws = (fn, pattern, message) => {
  checks += 1;
  assert.throws(fn, pattern, message);
};

// The release-critical 2026 split: same calendar year, different Stage 6 syllabus.
eq(inferHscYear({ year: 11, calendarYear: 2026 }), 2027, '2026 Year 11 is the 2027 HSC cohort');
eq(inferHscYear({ year: 12, calendarYear: 2026 }), 2026, '2026 Year 12 is the 2026 HSC cohort');
eq(nswMathsSyllabusFor({ year: 11, pathway: 'advanced', hscYear: 2027 }).version, 2024, '2026 Year 11 Advanced must use the 2024 syllabus');
eq(nswMathsSyllabusFor({ year: 12, pathway: 'advanced', hscYear: 2026 }).version, 2017, '2026 Year 12 Advanced must remain on the 2017 syllabus');
eq(nswMathsSyllabusFor({ year: 11, pathway: 'standard', hscYear: 2027 }).outcomePrefix, 'MST', 'new Standard uses MST outcomes');
eq(nswMathsSyllabusFor({ year: 11, pathway: 'ext1', hscYear: 2027 }).outcomePrefix, 'ME1', 'new Extension 1 uses ME1 outcomes');
eq(nswMathsSyllabusFor({ year: 12, pathway: 'ext2', hscYear: 2027 }).outcomePrefix, 'ME2', 'new Extension 2 uses ME2 outcomes');

// Future Year 12 cohorts stay on the 2024 syllabus; pre-2027 HSC cohorts do not.
eq(nswMathsSyllabusFor({ year: 12, pathway: 'standard', hscYear: 2027 }).version, 2024, '2027 HSC Standard is on the 2024 syllabus');
eq(nswMathsSyllabusFor({ year: 12, pathway: 'ext1', hscYear: 2025 }).version, 2017, 'pre-2027 HSC Extension 1 stays on 2017');

// Junior mathematics is versioned separately and never depends on HSC cohort.
eq(nswMathsSyllabusFor({ year: 10 }).version, 2022, 'Years 7–10 use Mathematics K–10 (2022)');

// Never guess a Stage 6 syllabus from the wall clock or accept impossible pathways.
throws(() => nswMathsSyllabusFor({ year: 11, pathway: 'advanced' }), /explicit HSC cohort year/i, 'Stage 6 requires a persisted cohort identity');
throws(() => nswMathsSyllabusFor({ year: 11, pathway: 'ext2', hscYear: 2027 }), /Year 12 pathway/i, 'Extension 2 cannot be attached to Year 11');
throws(() => nswMathsSyllabusFor({ year: 12, pathway: 'mystery', hscYear: 2026 }), /Unknown NSW Stage 6/i, 'unknown pathway must fail closed');

console.log(`NSW SYLLABUS CHECK — PASS: ${checks}/${checks}`);
