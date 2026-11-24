import fs from 'node:fs';
const S='/private/tmp/claude-501/-Users-priysharantripathi-Developer-Final-Pri-learning/14293b2c-d711-45bd-a880-c6ba83c2bfdd/scratchpad/';
const G = await import('./client/src/engine/generators/index.js');
const { stepEvidence } = await import('./server/platform/markerOps.js');
const { checkAnswer } = await import('./client/src/engine/checker.js');
await G.loadAllBanks();
const cases=JSON.parse(fs.readFileSync(S+'main-marking-defects.json','utf8'));
const only=process.argv[2], idx=process.argv[3];
let n=0;
for (const c of cases) {
  if (only && !c.generator.includes(only)) continue;
  if (idx!==undefined && n++!=idx) continue;
  let q; try { q = G.generateQuestion(c.generator, c.difficulty, c.seed); } catch { q = null; }
  if (!q || q.prompt !== c.questionPrompt) { if(c.generator==='y12-diff'){q={prompt:c.questionPrompt,answerType:'expression',answer:{expr:'8x(2x^2-4)'},difficulty:2}} else continue; }
  if (q.stepcheck?.scheme) delete q.stepcheck;
  console.log('##',c.kind,c.generator,JSON.stringify(c.lines[c.lineIndex]), 'stepcheck:',JSON.stringify(q.stepcheck)?.slice(0,200));
  for (const o of [{}, {solutionMatch:false},{fold:false},{claims:false},{solutionMatch:false,fold:false,claims:false}]) {
    const ev = stepEvidence(q, '99991', c.lines.join('\n'), checkAnswer(q, '99991'), { slipWarnings: true, ...o });
    const l = ev.stepReport?.lines?.[c.lineIndex];
    console.log(' ',JSON.stringify(o), l?.status, l?.state, (l?.note||'').slice(0,90));
  }
}
