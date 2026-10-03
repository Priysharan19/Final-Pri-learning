import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import en from '../src/i18n/strings.en.js';

const component=await readFile(new URL('../src/components/Class10NCERTLibrary.jsx',import.meta.url),'utf8');
const classes=await readFile(new URL('../src/pages/Classes.jsx',import.meta.url),'utf8');
const question=await readFile(new URL('../src/components/QuestionCard.jsx',import.meta.url),'utf8');
const localBackend=await readFile(new URL('../src/local/backend.js',import.meta.url),'utf8');

assert.match(classes,/Class10NCERTLibrary/,'Classes routes Class 10 students to the NCERT library');
assert.match(classes,/Number\(user\.year\) === 10/,'library is scoped to Class 10 profiles');
assert.match(component,/class10-content\.js/,'library consumes bundled source content');
assert.doesNotMatch(component,/fetch\s*\(|https?:\/\//,'NCERT library has no network dependency');
assert.match(component,/class10LibraryPracticeHref\(chapter,d\)/,'D1-D3 buttons hand off to normal Practice through the shared link builder');
{
  // The link names the curriculum chapter (which India practice resolves), the
  // CBSE track and the difficulty — not a generator id the backend refused.
  const { class10LibraryPracticeHref } = await import('../src/lib/practiceLinks.js');
  assert.equal(class10LibraryPracticeHref({ id: 'c10-polynomials' }, 3), '/practice?subtopic=c10-polynomials&difficulty=3&track=cbse');
  // CBSE practice is held to D1–D3, so the library never builds a D4 link.
  assert.equal(class10LibraryPracticeHref({ id: 'c10-polynomials' }, 4), '/practice?subtopic=c10-polynomials&difficulty=3&track=cbse');
}
// The library's copy lives in the string catalogue, so the component must reach
// for each key and the English catalogue must still say the right thing.
const catalogue=en;
const copy=(key,re,label)=>{
  assert.match(component,new RegExp(`'${key.replace(/\./g,'\\.')}'`),`${label}: the library uses ${key}`);
  assert.match(String(catalogue[key]??''),re,`${label}: ${key} says it in English`);
};
copy('ncert.c10TabTopperNotes',/Topper Notes/,'Topper Notes tab');
copy('ncert.c10TabWorkedExamples',/Worked Examples/,'Worked Examples tab');
copy('ncert.c10TabExercises',/Exercises/,'Exercises tab');
copy('ncert.c10TabSourceCoverage',/Source Coverage/,'Source Coverage tab');
copy('ncert.c10AppendixNote',/Answers\/Hints appendix/,'appendix authority note');
copy('ncert.c10Intro',/Apple Pencil handwriting/,'handwriting promise');
copy('ncert.c10Intro',/offline/,'offline promise');
copy('ncert.c10ChapterCount',/offline/,'offline chapter badge');

// NCERT must reuse Pri's mature handwriting path instead of shipping a fork.
assert.match(question,/mode.*'type'.*'write'.*'photo'/s,'QuestionCard retains Type/Write/Photo modes');
assert.match(question,/InkAnswer\.jsx/,'Write mode reaches Pri Ink');
assert.match(question,/readPhotoWithCloud/,'Photo mode reaches the server photo reader (owner decision: server-only reading)');
assert.match(question,/CONFIRM_CONF|doubtOf/,'uncertain handwriting still requires confirmation');
assert.doesNotMatch(component,/InkAnswer|recognizer\.js|PencilKit/,'NCERT UI does not create a parallel recogniser');

assert.match(localBackend,/entire platform running on this device/i);
assert.match(localBackend,/No network required/i);

console.log('PASS — Class X NCERT library is bundled/offline, iPad-ready and routes all practice through the standard Pri handwriting + Pri Reason question experience.');
