const G = await import('./client/src/engine/generators/index.js');
const { stepMetaFor } = await import('./server/platform/markerOps.js');
const { stepCheck } = await import('./client/src/engine/checker.js');
await G.loadAllBanks();
const q=G.generateQuestion('me11-poly',4,4);
const m=stepMetaFor(q); console.log(JSON.stringify(m));
const lines=process.argv.slice(2);
const r=stepCheck(m,lines.join('\n'),{prompt:q.prompt});
console.log(JSON.stringify(r.lines.map(l=>[l.status,l.state,l.note,l.branch])));
