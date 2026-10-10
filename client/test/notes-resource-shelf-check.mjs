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
assert.ok(view.includes('aria-label={resource.title}'), 'External links require an accessible name');
assert.ok(view.includes("t('nav.more')"), 'Resource heading must use existing localized copy');
// A figure with an authored question is visible before any solution step is revealed.
assert.ok(view.includes("import StudyDiagram from '../notes/StudyDiagram.jsx'"), 'diagram rendering module not wired');
assert.ok(view.includes('<StudyDiagram figure={ex.figure} />'), 'diagram not in the problem statement');
assert.ok(view.includes('const [shown, setShown] = useState(0)'), 'revealed solution step before student sees figure');
assert.ok(view.includes('const [visibleExamples, setVisibleExamples] = useState(6)'), 'visual examples must mount incrementally');
assert.ok(view.includes('notes.examples.slice(0, visibleExamples)'), 'unbounded SVG mount detected');
assert.ok(view.includes('Math.min(v + 6, notes.examples.length)'), 'load-more action must never overshoot lesson length');
assert.ok(view.includes('useReveal(root, [chapterId, notes, visibleExamples])'), 'newly mounted examples must be observable');
assert.ok(view.includes('setVisibleExamples(6)'), 'chapter navigation must reset visible example count');

assert.ok(!view.includes('dangerouslySetInnerHTML'), 'SVG must not permit raw HTML injection');
assert.equal(STUDY_RESOURCE_LINKS.length, 23, 'unexpected source register count');
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
console.log('Resource links PASS: 23 verified external references, grade/track isolation and safe navigation');
