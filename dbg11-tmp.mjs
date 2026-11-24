const G = await import('./client/src/engine/generators/index.js');
const M = await import('./client/src/engine/milestones.js');
await G.loadAllBanks();
const q=G.generateQuestion('me12-induction',4,7);
const ms=M.milestonesOf(q); console.log(JSON.stringify(ms));
console.log(M.matchMilestone(ms,'((k(k-1))/2)+(k+1)=(k+1)(((k)/2)+1)'));
