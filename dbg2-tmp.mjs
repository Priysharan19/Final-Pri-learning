const { stepEvidence } = await import('./server/platform/markerOps.js');
const { checkAnswer } = await import('./client/src/engine/checker.js');
const q={prompt:'Use the chain rule to differentiate $y = (2x^2 - 4)^{2}$.',answerType:'expression',answer:{expr:'8x(2x^2-4)'},difficulty:2};
const lines=['u = 2x^2 - 4, ((du)/(dx)) = 4x','((dy)/(du))=2u','((dy)/(dx))=3(2x^2-4)*4x=8x(2x^2-4)'];
for (const o of [{}, {solutionMatch:false},{solutionMatch:false,fold:false}]) {
 const ev=stepEvidence(q,'99991',lines.join('\n'),checkAnswer(q,'99991'),{slipWarnings:true,...o});
 console.log(JSON.stringify(ev.stepReport.lines[2]));
}
