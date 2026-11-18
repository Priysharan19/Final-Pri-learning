// Pri Learning · regression for two defects the examiner pre-review found (mission examiner-prereview).
//
//   y10-simeq D1  gave two equations that are the SAME line on about 9% of seeds (infinitely many
//                 solutions, so a correct point such as (4, 1) was refused: wrong marking).
//   y11-lines D4  printed "y =  + 2" when the second gradient came out 0.
//
// Both are checked over every seed in a range by reading the printed prompt, not the generator's
// internals. SYNTHETIC: deterministic in-process checks, not an examiner review.
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();
const failures = []; let n = 0;
const N = 4000;
for (let seed = 1; seed <= N; seed++) {
  const q = generateQuestion('y10-simeq', 1, seed);
  const m = /y = (-?\d*)x ([+-]) (\d+)\$ and \$(\d+)x \+ (\d+)y = (-?\d+)\$/.exec(q.prompt.replace(/\s+/g, ' '));
  if (!m) { failures.push(`y10-simeq/1 seed ${seed}: prompt not recognised: ${q.prompt.slice(0, 80)}`); continue; }
  const g = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  const a2 = Number(m[4]), b2 = Number(m[5]);
  n++;
  if (a2 + b2 * g === 0) failures.push(`y10-simeq/1 seed ${seed}: the second equation is a multiple of the first (${q.prompt.slice(0, 90)})`);
  const x = q.answer.x, y = q.answer.y, c = (m[2] === '-' ? -1 : 1) * Number(m[3]);
  if (y !== g * x + c || a2 * x + b2 * y !== Number(m[6])) failures.push(`y10-simeq/1 seed ${seed}: the key does not satisfy both equations`);
  const l = generateQuestion('y11-lines', 4, seed);
  n++;
  if (/y = (\s|[+-] |\$)/.test(l.prompt)) failures.push(`y11-lines/4 seed ${seed}: a line lost its term: ${l.prompt.slice(0, 90)}`);
}
if (failures.length) { console.error(`LINE SYSTEM REGRESSION: FAIL — ${failures.length}\n  ${failures.slice(0, 8).join('\n  ')}`); process.exit(1); }
console.log(`LINE SYSTEM REGRESSION: PASS — ${n} prompts over ${N} seeds: no simultaneous pair is a single line, every key satisfies both equations, no line prints without its x term. [SYNTHETIC]`);
