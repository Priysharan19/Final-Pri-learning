const G = await import('./client/src/engine/generators/index.js');
const { questionFacts } = await import('./client/src/engine/questionFacts.js');
await G.loadAllBanks();
const q=G.generateQuestion('y11-functions',4,1);
console.log(JSON.stringify(questionFacts(q)).slice(0,600));
