const G = await import('./client/src/engine/generators/index.js');
const S = await import('./client/src/engine/solutionMatch.js');
await G.loadAllBanks();
const q=G.generateQuestion('me12-calc',3,3);
S._setFunctionsUnused(q);
const sol=S._internals.readSolution(q);
console.log([...sol.limits]);
for (const st of q.steps) console.log(S._internals.spanToPlain(st.d.match(/\$([^$]+)\$/)[1]));
