// Student-facing external reference shelf contract, preserving exam-track
// boundaries and preventing embedded or insecure third-party resources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STUDY_RESOURCE_LINKS, studyResourcesForGrade } from '../src/notes/data/notes-study-resources.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const view = readFileSync(join(__dirname, '../src/pages/Notes.jsx'), 'utf8');
assert.ok(view.includes('data-testid="notes-study-resources"'), 'Study resources missing from student Notes');
assert.ok(view.includes('target="_blank" rel="noopener noreferrer"'), 'External link must be isolated from opener');
assert.ok(view.includes('external link, opens a new tab'), 'External navigation must be communicated');
assert.equal(STUDY_RESOURCE_LINKS.length, 15, 'unexpected source register count');
const ids = new Set();
for (const item of STUDY_RESOURCE_LINKS) {
  assert.ok(!ids.has(item.id), `duplicate reference ID ${item.id}`); ids.add(item.id);
  assert.ok(item.url.startsWith('https://'), `invalid source URL: ${item.id}`);
  assert.equal(item.access, 'external-link-only');
  assert.equal(item.licensedForEmbedding, false);
  assert.ok(item.lastChecked && item.issuer && item.focus && item.title);
  assert.ok(Array.isArray(item.grades) && item.grades.length);
  assert.ok(Array.isArray(item.tracks) && item.tracks.length);
}
for (const grade of [7, 8, 9, 10, 11, 12]) {
  const school = studyResourcesForGrade(grade,'cbse');
  assert.ok(school.length >= 2, `grade ${grade} lacks school references`);
  assert.ok(school.every(x => x.grades.includes(grade) && x.tracks.includes('cbse')));
}
assert.ok(!studyResourcesForGrade(10,'cbse').some(x => x.id === 'jee-advanced-papers'), 'JEE archives exposed as CBSE course');
assert.ok(studyResourcesForGrade(11,'jee-advanced').some(x => x.id === 'jee-advanced-papers'));
assert.ok(!studyResourcesForGrade(11,'jee-main').some(x => x.id === 'jee-advanced-papers'));
console.log('Resource links PASS: 15 verified external references, grade/track isolation and safe navigation');
