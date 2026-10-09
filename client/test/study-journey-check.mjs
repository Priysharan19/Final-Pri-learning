// Real URL contract plus source assertions (not an actual grader/provider).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { practiceRequestFromQuery } from '../src/lib/practiceLinks.js';
import { studyHref, selectedStudyContext, selectedStudyPracticeHref } from '../src/lib/studyJourney.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../src');
const read=path=>readFileSync(resolve(root,path),'utf8');
let n=0;
function check(label,predicate) { assert.ok(predicate,label); n++; }
const chapter={id:'c11-complex-numbers',grade:11,dotpoints:['Algebra','Argand plane','Polar form']};
for (const view of ['notes','examples']) for (const track of ['cbse','jee-main','jee-advanced']) {
  for (const dotpoint of [0,1,2]) for (const difficulty of (track==='cbse'?[1,2,3]:[1,2,3,4])) {
    const study=studyHref({subtopic:chapter.id,dotpoint,difficulty,track,view});
    check('chapter preserved',study.startsWith('/notes/c11-complex-numbers?'));
    check('mode preserved',new URL(study,'https://test.invalid').searchParams.get('view')===view);
    const ctx=selectedStudyContext(chapter,new URL(study,'https://test.invalid').searchParams);
    check('outcome,difficulty,track preserved',ctx.dotpoint===dotpoint && ctx.difficulty===difficulty && ctx.track===track);
    const practice=selectedStudyPracticeHref(chapter,new URL(study,'https://test.invalid').searchParams);
    const actual=practiceRequestFromQuery(new URL(practice,'https://test.invalid').searchParams);
    check('server request receives exact selection',actual.mode==='topic' && actual.subtopic===chapter.id && actual.dotpoint===dotpoint && actual.difficulty===difficulty && actual.track===track);
  }
}
check('unknown chapter not accepted',studyHref({subtopic:'../../foo'})===null);
check('unexpected learning mode not accepted',studyHref({subtopic:chapter.id,view:'unsafe'})===null);
check('CBSE D4 not silently preserved',selectedStudyContext(chapter,new URLSearchParams('track=cbse&difficulty=4')).difficulty===null);
check('invalid dotpoint not silently selected',selectedStudyContext(chapter,new URLSearchParams('dotpoint=999')).dotpoint===null);
const home=read('pages/Home.jsx'), notes=read('pages/Notes.jsx'), content=read('notes/data/notes-class11.js');
check('Home exposes all three choices', ['data-study-notes','data-study-examples','data-study-practice'].every(s=>home.includes(s)));
check('Home checks verified availability', home.includes('notes?.[selSub.id]?.examples?.length'));
check('Home preserves chosen difficulty and dotpoint',home.includes('dotpoint, difficulty: chosenDifficulty'));
check('Notes offers all three routes', ['data-study-notes','data-study-examples','data-study-practice'].every(s=>notes.includes(s)));
check('Notes preserves query in Practice',notes.includes('selectedStudyPracticeHref(chapter, params)'));
check('Example starts closed so student can try',notes.includes('useState(0)'));
check('Reasons/alternative are content-backed',notes.includes('ex.reasons?.[i]') && notes.includes('ex.alternative'));
check('Argand illustration is true SVG',notes.includes('ComplexArgandFigure') && notes.includes('nt-argand-radius'));
check('Complex Numbers has reviewed reasons and alternative',content.includes('reasons:') && content.includes('alternative:'));
console.log(`STUDY JOURNEY: PASS ${n}/${n} — exact URL roundtrips and source contracts; not a live-provider proof`);
