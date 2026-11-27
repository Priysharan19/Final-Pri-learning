// Founder regression: exact issued question, server practice marker and teacher page.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { loadBanksFor, generateQuestion } from '../../client/src/engine/generators/index.js';
import { MARKER_OPS, marksPossibleFor, practiceMarksEarned } from '../platform/markerOps.js';
import { buildAnnotatedWorking } from '../../client/src/components/annotatedWorkingModel.js';
import { buildMarkedPage } from '../../client/src/components/markedPageModel.js';
import { classOf, phraseOf } from '../../client/src/components/markedPageTeacher.js';
await loadBanksFor(['y12-random-var']);
const q = { ...generateQuestion('y12-random-var', 1, 29731), _marking: 'final-answer-only' };
assert.equal(q.prompt, '$X$ is a random variable with $E(X) = 2$. Find $E(2X + 25)$.');
const working = ['E(X)=2','E(2X+25)=2E(X)+25','=2(2)+25','=4+25','=29'];
const grade = MARKER_OPS.practice({ q, answer:'29', working:working.join('\n'), evidenceIfWrong:true, policy:{methodMarks:false} }, () => {});
const report = grade.evidence.shownReport || grade.evidence.stepReport;
const model = buildAnnotatedWorking({ lines:working, stepReport:report, page:true });
const page = buildMarkedPage({ model });
console.log('actual statuses:', report.lines.map(l=>l.status).join(', '), 'page:', page.lines.map(l=>l.status).join(', '));
assert.equal(practiceMarksEarned(q, grade.result, grade.evidence, marksPossibleFor(q)), 1);
assert.equal(grade.evidence.partial, null);
assert.deepEqual(report.lines.map(l=>l.status), Array(5).fill('ok'));
assert.equal(report.firstBreak, -1);
assert.equal(report.answerLine, 4);
assert.deepEqual(page.lines.map(l=>l.status), Array(5).fill('checked'));
assert.ok(page.lines.every(l=>phraseOf(classOf(l.card))));
console.log('EXPECTATION FOUNDER REGRESSION: PASS');

const verify = (rows, answer='29', extras={}) => {
  const g=MARKER_OPS.practice({q, answer, working:rows.join('\n'), evidenceIfWrong:true, policy:{methodMarks:false}, ...extras},()=>{});
  assert.equal(g.evidence.partial,null);
  assert.equal(practiceMarksEarned(q,g.result,g.evidence,marksPossibleFor(q)),answer==='29'?1:0);
  return g.evidence.shownReport||g.evidence.stepReport;
};
const statuses=r=>r.lines.map(l=>l.status);
const alternative=verify(['E(25+X+X)=E(X)+E(X)+25','=2+2+25','=29']);
assert.deepEqual(statuses(alternative),['ok','ok','ok']);
assert.equal(alternative.lines[0].tickClass,'expectation-linearity');
const misconception=verify(['E(X)=2','E(2X+25)=2(E(X)+25)','=54']);
assert.deepEqual(statuses(misconception),['ok','break','ok']);
assert.equal(misconception.firstBreak,1);
assert.equal(misconception.lines[2].followsFromError,true);
const arithmetic=verify(['E(2X+25)=2E(X)+25','=2(2)+25','=5+25','=30','=31'],'31');
assert.deepEqual(statuses(arithmetic),['ok','ok','break','ok','break']);
assert.equal(arithmetic.lines[3].followsFrom,3);
assert.equal(arithmetic.firstBreak,2);
assert.deepEqual(statuses(verify(['E(X^2)=4','=4'])),['note','note']);
assert.deepEqual(statuses(verify(['E(X)=2','','=29'])),['ok','note']);
const identity=verify(['E(2X+25)=E(2X+25)']);
assert.notEqual(identity.lines[0].tickClass,'expectation-linearity');
const recovered=verify(['E(X)=3','2+2=4','=4']);
assert.equal(recovered.lines[2].followsFromError,undefined);
const {stepCheckExpectation}=await import('../../client/src/engine/expectationLines.js');
assert.deepEqual(stepCheckExpectation(q,working.join('\n')),stepCheckExpectation({...q,answer:{value:999},steps:[]},working.join('\n')));
assert.equal(stepCheckExpectation({...q,subtopic:'y12-algebra'},working.join('\n')),null);
assert.deepEqual(statuses(stepCheckExpectation(q,'E(X)=3',{latex:[{text:'E(X)=3',latex:'E(X)=2'}]})),['note']);
console.log('EXPECTATION SAFETY REGRESSIONS: PASS (9 additional cases)');

// Dual recognition readings: consistent TeX may be judged; contradictory
// readings may not become a tick OR a cross, and break the continuation chain.
const fullTex=working.map(text=>({text,latex:text}));
assert.deepEqual(statuses(verify(working,'29',{workingLatex:fullTex})),Array(5).fill('ok'));
const badRows=['E(X)=2','E(2X+25)=2(E(X)+25)','=54'];
assert.deepEqual(statuses(verify(badRows,'54',{workingLatex:badRows.map(text=>({text,latex:text}))})),['ok','break','ok']);
assert.deepEqual(statuses(verify(['E(X)=2','=2'],'29',{workingLatex:[{text:'E(X)=2',latex:'E(X)=3'}]})),['note','note']);
assert.deepEqual(statuses(verify(['E(X)=3'],'29',{workingLatex:[{text:'E(X)=3',latex:'E(X)=2'}]})),['note']);
console.log('EXPECTATION DUAL-READ SAFETY: PASS (4 cases)');

// Synthetic deterministic property sweep: integer arithmetic supplies the
// oracle independently of the verifier. Not independently moderated.
let count=0;
for(let mean=-5;mean<5;mean++) {
  for(let coefficient=-5;coefficient<5;coefficient++) {
    for(let shift=-2;shift<=2;shift++) {
      const value=coefficient*mean+shift;
      const constant=shift>=0?'+'+shift:String(shift);
      const left='E('+coefficient+'X'+constant+')';
      const variant={...q,prompt:'$X$ is a random variable with $E(X) = '+mean+'$. Find $'+left+'$.',answer:{value}};
      const good=left+'='+coefficient+'E(X)'+constant+'='+value;
      const bad=left+'='+(value+1);
      assert.deepEqual(statuses(stepCheckExpectation(variant,good)),['ok'],good);
      assert.deepEqual(statuses(stepCheckExpectation(variant,bad)),['break'],bad);
      count+=2;
    }
  }
}
console.log('EXPECTATION SYNTHETIC INTEGER ORACLE: PASS ('+count+' cases; not independently moderated)');
