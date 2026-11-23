// Pri Learning · a stray definition, label or bare number never decides the full mark of a `working` question
//
// Review, 20 November 2026: moving "a definition or a bare number is not a claim" into stepCheck flipped 72 of 390 working pages from
// incorrect to correct (y8-equations d3 seed 1 `6x + 10 = 3x - 8 / 3x = -18 / x = -6 / 13`). The rule is now applied only to the report
// that is DISPLAYED (markerOps.stepEvidence), after every mark. checkWorking reads stepCheck, which the rule does not touch.
import { createHash } from 'node:crypto';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { stepEvidence } from '../platform/markerOps.js';
import * as G from '../../client/src/engine/generators/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
await G.loadAllBanks();

// the reviewer's two examples
{
  const q = G.generateQuestion('y8-equations', 3, 1);
  ok(q.answerType === 'working', 'y8-equations d3 seed 1 is a working question');
  ok(checkAnswer(q, '6x + 10 = 3x - 8\n3x = -18\nx = -6\n13').correct === false, 'a wrong trailing 13 after a finished solution is not correct');
  ok(checkAnswer(q, '6x + 10 = 3x - 8\n3x = -18\nx = -6').correct === true, 'the same page without it is correct');
  const t = G.generateQuestion('c10-trigonometry-current', 4, 49);
  const w = t.answer?.canonicalWorking;
  if (t.answerType === 'working' && w) ok(checkAnswer(t, `${w}\nArea = 8`).correct === checkAnswer(t, `${w}\nArea = 8`).correct && checkAnswer(t, `${w}\nArea = 8`).correct === false, 'the proof followed by Area = 8 is not correct');
  else ok(true, 'c10-trigonometry-current d4 seed 49 has no canonical working here');
}

// 390+ working pages: a wrong value as a definition, a label or a bare number, at the start, middle and end
const families = ['y8-equations', 'y9-algebra', 'me11-trigid', 'me12-induction', 'c10-trigonometry-current'];
const INSERTS = ['k = 13', 'Area = 13', 'ans = 13', 'w = 13', '13'];
let pages = 0, flips = 0, displayedOk = 0;
const digest = createHash('sha256');
for (const id of families) for (let seed = 1; seed < 160; seed++) for (const d of [1, 2, 3, 4]) {
  let q; try { q = G.generateQuestion(id, d, seed); } catch { continue; }
  if (q.answerType !== 'working' || typeof q.answer?.canonicalWorking !== 'string') continue;
  const base = q.answer.canonicalWorking.split('\n');
  const baseCorrect = checkAnswer(q, base.join('\n')).correct === true;
  for (const line of INSERTS) for (const at of [0, Math.floor(base.length / 2), base.length]) {
    const page = [...base.slice(0, at), line, ...base.slice(at)];
    const res = checkAnswer(q, page.join('\n'));
    pages++;
    digest.update(`${id}|${d}|${seed}|${line}|${at}|${res.correct === true}\n`);
    // a wrong stray value at the end of a finished page can never make an incorrect page correct
    if (!baseCorrect && res.correct === true && at === base.length) flips++;
    // the displayed report never changes the verdict the server hands back
    try { const ev = stepEvidence(q, '', page.join('\n'), res); if (ev.stepReport) displayedOk++; const off = stepEvidence(q, '', page.join('\n'), res, { claims: false }); if (JSON.stringify(ev.partial) !== JSON.stringify(off.partial)) flips++; } catch { /* no report */ }
  }
}
ok(pages >= 390, `${pages} working pages checked (at least 390)`);
ok(flips === 0, `no page flips to correct, and no partial credit changes with the displayed rule off (${flips})`);
// the correctness of every page, pinned: this is the verdict stepCheck gave before the rule existed
const sum = digest.digest('hex');
console.log(`  working pages: ${pages}, correctness digest ${sum.slice(0, 16)}`);
// Re-pinned 2026-11-22 (Extension 1 bank variety, CONTENT_VERSION 2026.11.46): the page count is NOT lowered. The seed sweep is widened from
// seeds 1-149 to 1-159 so the sweep keeps at least the 1245 pages it had: it now checks 1260. Cause of the new digest: me12-induction gained
// expression and multiple-choice forms, so the me12-induction D4 draws that used to be working-answer pages (15 pages a seed) now draw one of the
// new forms and are no longer working pages. Verified against the parent commit (main 1592b657e) by dumping every page at seeds 1-159: the parent
// has 1380 pages, this tree 1260; all 1260 are pages the parent also has, with the same verdict (0 new pages, 0 changed verdicts); the 120 that
// are gone are all me12-induction D4 (8 seeds x 15 pages). The marker is untouched.
ok(sum === 'd472eaf5f068fe7aa998b198f40f87260e7fb5c0abc63af1df09cfd490b44345', `the correctness of all ${pages} pages is the one pinned (${sum})`);
console.log(`WORKING CORRECT UNCHANGED: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — a stray definition, label or bare number never changes whether a working answer is correct`);
if (fail) process.exit(1);
