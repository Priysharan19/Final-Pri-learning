const { stepCheck } = await import('./client/src/engine/checker.js');
const meta={kind:'equation',variable:'x',solutions:[1]};
for (const l of process.argv.slice(2)) { const r=stepCheck(meta,l,{prompt:'Find x'}); console.log(JSON.stringify(l), r.lines.map(x=>x.status+'|'+(x.note||'').slice(0,90))); }
