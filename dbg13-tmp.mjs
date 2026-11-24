const G = await import('./client/src/engine/generators/index.js');
const { stepEvidence } = await import('./server/platform/markerOps.js');
const { checkAnswer } = await import('./client/src/engine/checker.js');
await G.loadAllBanks();
const q=G.generateQuestion('y11-explog',3,28);
const page=['(4^(2))^(3x - 6) = (3^(3))^(3x + 5)','6x-12=9x+15','-3x=27','x=-9'];
for (const o of [{}, {solutionMatch:false}, {fold:false}, {solutionMatch:false,fold:false}]) {
 const ev=stepEvidence({...q},'99991',page.join('\n'),checkAnswer(q,'99991'),{slipWarnings:true,...o});
 console.log(JSON.stringify(o), ev.stepReport.lines.map(l=>l.status+'/'+(l.state||'')).join(' '));
}
