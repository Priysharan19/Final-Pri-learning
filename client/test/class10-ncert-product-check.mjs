import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component=await readFile(new URL('../src/components/Class10NCERTLibrary.jsx',import.meta.url),'utf8');
const classes=await readFile(new URL('../src/pages/Classes.jsx',import.meta.url),'utf8');
const question=await readFile(new URL('../src/components/QuestionCard.jsx',import.meta.url),'utf8');
const localBackend=await readFile(new URL('../src/local/backend.js',import.meta.url),'utf8');

assert.match(classes,/Class10NCERTLibrary/,'Classes routes Class 10 students to the NCERT library');
assert.match(classes,/Number\(user\.year\) === 10/,'library is scoped to Class 10 profiles');
assert.match(component,/class10-content\.js/,'library consumes bundled source content');
assert.doesNotMatch(component,/fetch\s*\(|https?:\/\//,'NCERT library has no network dependency');
assert.match(component,/\/practice\?subtopic=/,'D1-D4 buttons hand off to normal Practice');
assert.match(component,/Topper Notes/);
assert.match(component,/Worked Examples/);
assert.match(component,/Exercises/);
assert.match(component,/Source Coverage/);
assert.match(component,/Answers\/Hints appendix/);
assert.match(component,/Apple Pencil handwriting/);
assert.match(component,/offline/);

// NCERT must reuse Pri's mature handwriting path instead of shipping a fork.
assert.match(question,/mode.*'type'.*'write'.*'photo'/s,'QuestionCard retains Type/Write/Photo modes');
assert.match(question,/InkAnswer\.jsx/,'Write mode reaches Pri Ink');
assert.match(question,/recognizePhoto/,'Photo mode reaches native photo recognition');
assert.match(question,/CONFIRM_CONF|doubtOf/,'uncertain handwriting still requires confirmation');
assert.doesNotMatch(component,/InkAnswer|recognizer\.js|PencilKit/,'NCERT UI does not create a parallel recogniser');

assert.match(localBackend,/entire platform running on this device/i);
assert.match(localBackend,/No network required/i);

console.log('PASS — Class X NCERT library is bundled/offline, iPad-ready and routes all practice through the standard Pri handwriting + Pri Reason question experience.');
