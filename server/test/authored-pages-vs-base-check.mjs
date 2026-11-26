// Pri Learning · authored true pages against the base: no new cross, no lost tick (the reviewer's method of 26 Nov 2026, kept as a permanent check).
//
// tools/authored-pages-sweep.mjs marks every authored page of every Years 11-12 generator (seeds 1-8, four difficulties, every transcript style but
// the deliberate slip) with the real marker. server/test/fixtures/authored-pages-base.json is the same sweep taken from the base the branch merges
// into (origin/task/coverage-classes-answerline at 90f18510a). Every page on both sides: a line crossed here was crossed there (0 new crosses) and a line
// the base ticked is still ticked (0 lost ticks). Every page only this head has: 0 crossed lines. A page of the base is an authored TRUE page, so a
// cross on it is a true line crossed.
//
//   node server/test/authored-pages-vs-base-check.mjs
import './support/hermetic.mjs';
import { readFileSync } from 'node:fs';
import { sweep } from '../../tools/authored-pages-sweep.mjs';

const base = JSON.parse(readFileSync(new URL('./fixtures/authored-pages-base.json', import.meta.url), 'utf8'));
const head = await sweep({ withTexts: true });
let both = 0, headOnly = 0, newCross = 0, lostTick = 0, gained = 0, headOnlyCrossed = 0; const bad = [];
for (const [key, h] of Object.entries(head)) {
  const b = base[key];
  if (b === undefined) { headOnly++; const n = [...h.statuses].filter(c => c === 'b').length; headOnlyCrossed += n; if (n && bad.length < 6) bad.push(`new page crossed: ${h.prompt.slice(0, 60)} ${JSON.stringify(h.texts)} ${h.statuses}`); continue; }
  both++;
  for (let k = 0; k < Math.max(b.length, h.statuses.length); k++) {
    if (h.statuses[k] === 'b' && b[k] !== 'b') { newCross++; if (bad.length < 6) bad.push(`new cross: ${h.prompt.slice(0, 60)} line ${k + 1} ${JSON.stringify(h.texts)} base ${b} head ${h.statuses}`); }
    if (b[k] === 'o' && h.statuses[k] !== 'o') { lostTick++; if (bad.length < 6) bad.push(`lost tick: ${h.prompt.slice(0, 60)} line ${k + 1} ${JSON.stringify(h.texts)} base ${b} head ${h.statuses}`); }
    if (h.statuses[k] === 'o' && b[k] !== 'o') gained++;
  }
}
console.log(`authored pages: ${both} on both sides, ${headOnly} only on this head; new crosses ${newCross}, lost ticks ${lostTick}, ticks gained ${gained}, crossed lines on head-only pages ${headOnlyCrossed}`);
for (const l of bad) console.log(l);
const failed = newCross + lostTick + headOnlyCrossed;
console.log(failed ? `AUTHORED PAGES VS BASE: FAIL ${failed}` : `AUTHORED PAGES VS BASE: PASS: ${both} pages, 0 new crosses, 0 lost ticks`);
process.exit(failed ? 1 : 0);
