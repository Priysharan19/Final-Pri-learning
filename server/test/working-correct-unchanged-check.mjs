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
for (const id of families) for (let seed = 1; seed < 150; seed++) for (const d of [1, 2, 3, 4]) {
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
// Re-pinned 2026-11-22 (Extension 1 bank variety, CONTENT_VERSION 2026.11.46): 1245 -> 1140 pages. me12-induction gained expression and
// multiple-choice forms, so 105 pages of seven seeds that used to draw a working-answer form (me12-induction D4, 15 pages a seed) now draw one of the
// new forms and are no longer pages here. Verified against the parent commit by dumping every page: the 1140 pages that remain are the same
// pages with the same verdict, none is new, and none changed verdict. The marker is untouched.
ok(sum === 'efb46183474a39a4539e231f6bb317bb4862f99c544def0ce939b631fb8d80eb', `the correctness of all ${pages} pages is the one pinned (${sum})`);
console.log(`WORKING CORRECT UNCHANGED: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — a stray definition, label or bare number never changes whether a working answer is correct`);
if (fail) process.exit(1);
