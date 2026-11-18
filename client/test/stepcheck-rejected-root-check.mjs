// Step Check for a question whose equation has a root the domain removes (me11-functions D2, the point where
// f and its inverse meet). Rejecting the root correctly must not be flagged; a real slip still must be.
// SYNTHETIC: the deterministic Step Check on worked lines; no student evidence.
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { stepCheck } = await import(`${SRC}engine/checker-core.js`);
await loadAllBanks();
const fails = [];
let n = 0;
for (let seed = 1; seed < 4000 && n < 60; seed++) {
  const q = generateQuestion('me11-functions', 2, seed * 7919 + 5);
  const m = q.prompt.match(/f\(x\) = \(x (?:- (-?\d+)|\+ (\d+))\)\^2 ([+-]) (\d+)\$, \$x \\ge/);
  if (!m || !q.stepcheck?.rejected) continue;
  n++;
  const h = m[1] !== undefined ? Number(m[1]) : -Number(m[2]), k = (m[3] === '-' ? -1 : 1) * Number(m[4]);
  const [keep] = q.stepcheck.solutions, [drop] = q.stepcheck.rejected;
  if (keep < h || drop >= h) fails.push(`seed ${seed}: kept ${keep} / rejected ${drop} are not on the right sides of the domain start ${h}`);
  // the true quadratic from f(x) = x:  x^2 - (2h+1)x + (h^2 + k) = 0
  const quad = `x^2 - ${2 * h + 1}x + ${h * h + k} = 0`.replace('- -', '+ ').replace('+ -', '- ');
  const good = [`(x - ${drop})(x - ${keep}) = 0`.replace(/- -/g, '+ '), `x = ${drop}`, `x = ${keep}`];
  const lines = [quad, ...good].join('\n');
  const r = stepCheck(q.stepcheck, lines);
  if (r.firstBreak !== -1) fails.push(`seed ${seed}: correct working with the rejected root was flagged at line ${r.firstBreak + 1}: ${r.lines[r.firstBreak]?.text}`);
  const slip = stepCheck(q.stepcheck, `${quad}\nx = ${keep + 1}`);
  if (slip.firstBreak === -1) fails.push(`seed ${seed}: a wrong root x = ${keep + 1} was not flagged`);
  const slip2 = stepCheck(q.stepcheck, `x = ${drop - 1}`);
  if (slip2.firstBreak === -1) fails.push(`seed ${seed}: x = ${drop - 1} (neither root) was not flagged`);
}
if (n < 20) fails.push(`only ${n} meeting-point questions were sampled`);
console.log(fails.length ? `STEPCHECK REJECTED ROOT: FAIL\n  ${fails.slice(0, 20).join('\n  ')}` : `STEPCHECK REJECTED ROOT: PASS — ${n} questions: the rejected root is not a slip, a wrong root still breaks. [SYNTHETIC]`);
process.exit(fails.length ? 1 : 0);
