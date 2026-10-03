import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/local/backend.js', import.meta.url), 'utf8');

function between(start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `missing source anchor: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `missing source anchor after ${start}: ${end}`);
  return source.slice(a, b);
}

function has(text, pattern, message) {
  assert.match(text, pattern, message);
}

function lacks(text, pattern, message) {
  assert.doesNotMatch(text, pattern, message);
}

// This suite pins the Platform side of NSW Stage 6 identity. It deliberately
// does not encode the 2017/2024 syllabus mapping: engine/nswStage6.js owns that
// decision. Platform owns only durable, explicit cohort/pathway identity.
const createProfile = between("'POST /profiles': async (body) => {", "'POST /profiles/select':");
const patchProfile = between("'PATCH /me': async (body) => {", "// ---- curriculum ----");
const exportProfile = between('const exportProfile = p => ({', 'function importProfile');
const importProfile = between('function importProfile(src, id) {', '// Question payloads');
const roster = between("'POST /classes/:id/roster':", "'GET /classes/:id/analytics':");
const progressExport = between("'GET /data/progress-file':", "'POST /classes/:id/import-progress':");
const progressImport = between('function importProgress(src) {', '// ── Route implementations');

// Creation must carry explicit cohort + pathway for an NSW senior. The old
// fallback silently manufactured Mathematics Advanced, which is false identity.
has(createProfile, /hscCohort/, 'NSW senior profile creation must persist hscCohort');
lacks(createProfile, /cleanPathway\(body\.pathway, p\.year\)\s*\|\|\s*\(p\.year\s*>=\s*11\s*\?\s*['"]advanced['"]/, 'profile creation must not default a senior pathway to Advanced');

// Editing year/course/pathway is another curriculum-identity boundary. A year
// rollover may change `year`; it must not silently rewrite cohort or pathway.
has(patchProfile, /hscCohort/, 'profile edits must explicitly preserve or repair hscCohort');
lacks(patchProfile, /cleanPathway\([^\n]+\)\s*\|\|\s*\(p\.year\s*>=\s*11\s*\?\s*['"]advanced['"]/, 'profile edits must not manufacture Advanced');

// Full backups are a supported restart/restore path. Cohort is private profile
// data and belongs in the existing profile object, not a second store.
has(exportProfile, /hscCohort\s*:/, 'backup export must carry hscCohort');
has(importProfile, /hscCohort\s*:/, 'backup restore must restore hscCohort');
lacks(importProfile, /cleanPathway\(src\.pathway, year\)\s*\|\|\s*\(year\s*>=\s*11\s*\?\s*['"]advanced['"]/, 'backup restore must not coerce missing/invalid pathway to Advanced');

// Teacher roster creation cannot invent a senior pathway either. If the row
// lacks enough identity, the profile must remain explicitly incomplete until a
// user repairs it rather than being silently filed under Advanced.
has(roster, /hscCohort/, 'rostered NSW seniors must carry explicit cohort identity when supplied');
lacks(roster, /pathway:\s*course\s*===\s*['"]nsw['"]\s*\?\s*\(year\s*>=\s*11\s*\?\s*['"]advanced['"]/, 'roster creation must not hardcode Advanced for NSW seniors');

// Progress files are teacher-facing evidence. Dropping cohort here makes a
// restored/imported senior ambiguous and lets downstream analytics label the
// wrong syllabus even if the local profile was correct.
has(progressExport, /hscCohort\s*:/, 'progress export must carry HSC cohort');
has(progressImport, /hscCohort\s*:/, 'progress import must preserve HSC cohort');

// `hscCohort` must not become picker-visible clear metadata. Protection is
// checked by the existing profile sealing tests; this source guard prevents the
// tempting but unnecessary shortcut of adding it to the profile list payload.
const profileList = between("'GET /profiles': async () => {", "'POST /profiles':");
lacks(profileList, /hscCohort/, 'profile picker must not expose HSC cohort');

console.log('NSW STAGE 6 PROFILE AUTHORITY: boundary guards passed');
