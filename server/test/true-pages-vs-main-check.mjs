// Pri Learning · the authored TRUE pages of y12-diff, y12-appdiff, y12-integration and y12-integral-calc: the step-mark stack changes nothing
// for the worse on them (24 Nov 2026, independent review of 36515b48f).
//
// Against a committed snapshot of origin/main (server/test/fixtures/true-pages-main-2026-11-24.json, written by tools/true-pages-sweep.mjs from a
// checkout of main), every page that exists on both sides:
//   · a line crossed on this head was crossed on main (0 new crosses; main's own crosses are not this branch's);
//   · a line main TICKED is still ticked, except the one class listed and justified below;
// every page only this head has (a new bank form) has 0 crossed lines. Then the reviewer's repros and area mutants, never ticked.
//
//   node server/test/true-pages-vs-main-check.mjs
import './support/hermetic.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sweep } from '../../tools/true-pages-sweep.mjs';
import { assessAreaLine } from '../../client/src/engine/reason-area.js';
import { stepEvidence } from '../platform/markerOps.js';
import * as C from '../../tools/understanding-audit/corpus.mjs';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const base = JSON.parse(readFileSync(new URL('./fixtures/true-pages-main-2026-11-24.json', import.meta.url), 'utf8'));
const head = await sweep({ withTexts: true });

let both = 0, headOnly = 0, newCross = 0, lostTick = 0, allowedLost = 0, gainedTick = 0, headOnlyCrossed = 0, mainCrossed = 0, headCrossed = 0;
const bad = [];
for (const [key, h] of Object.entries(head)) {
  const b = base[key];
  headCrossed += [...h.statuses].filter(c => c === 'b').length;
  if (!b) { headOnly++; const n = [...h.statuses].filter(c => c === 'b').length; headOnlyCrossed += n; if (n && bad.length < 4) bad.push(`new form crossed: ${h.prompt.slice(0, 80)} ${JSON.stringify(h.texts)}`); continue; }
  both++;
  const bs = b.slice(b.indexOf(':') + 1);
  if (bs.length !== h.statuses.length) { bad.push(`page length changed: ${h.prompt.slice(0, 60)}`); continue; }
  mainCrossed += [...bs].filter(c => c === 'b').length;
  for (let i = 0; i < bs.length; i++) {
    if (h.statuses[i] === 'b' && bs[i] !== 'b') { newCross++; if (bad.length < 6) bad.push(`new cross: ${h.prompt.slice(0, 70)} line ${i + 1} ${JSON.stringify(h.texts[i])}`); }
    if (bs[i] === 'o' && h.statuses[i] !== 'o') {
      // The one listed class: the LAST line of a tangent / normal page or an exact-integral page, which restates the final answer (`2x + -5`,
      // `ans = 12`). On main those questions had no step plan, so the whole page was judged by the answer's expression-equivalence; the derived plan
      // is now the page's topic check and does not carry that equivalence over, so the restatement stays a note (never a cross, and no mark reads it:
      // every scheme these plans serve is a draft that pays nothing).
      const listed = (h.family === 'y12-appdiff' || h.family === 'y12-integral-calc') && i === bs.length - 1 && h.statuses[i] === 'n';
      if (listed) allowedLost++; else { lostTick++; if (bad.length < 8) bad.push(`lost tick: ${h.prompt.slice(0, 70)} line ${i + 1} ${JSON.stringify(h.texts[i])} ${bs[i]}->${h.statuses[i]}`); }
    }
    if (bs[i] !== 'o' && h.statuses[i] === 'o') gainedTick++;
  }
}
ok(both >= 2600, `the sweep covers the pages main also has: ${both}`);
ok(newCross === 0, `0 lines crossed on this head that main did not cross: ${newCross} ${bad.join(' | ')}`);
ok(headOnlyCrossed === 0, `pages only this head has (new bank forms) are never crossed: ${headOnlyCrossed} of ${headOnly}`);
ok(lostTick === 0, `no tick main gave is lost outside the listed class: ${lostTick} ${bad.join(' | ')}`);
ok(headCrossed <= mainCrossed, `crossed lines on this head (${headCrossed}) are no more than on main (${mainCrossed})`);
ok(allowedLost <= 40, `the listed class (a restated final answer on a tangent / normal / exact-integral page) stays small: ${allowedLost}`);

// ── the reviewer's repros on the gradient plan ─────────────────────────────────────────────────────────────────────────
const statusesOf = (pred) => {
  const hits = Object.values(head).filter(pred);
  return hits;
};
const gradQuotient = statusesOf(h => h.family === 'y12-diff' && /dfrac\{[^}]*x [+-] \d+\}\{(?:\d*x )?[+-] \d+\}/.test(h.prompt) && h.texts.some(t => /^\(\s*(?:\d*x) [+-] \d+\) = -?\d+$/.test(t.trim())));
ok(gradQuotient.length >= 3, `pages with a bracket-equals line like "(x + 4) = 5": ${gradQuotient.length}`);
for (const h of gradQuotient) ok(!h.statuses.includes('b'), `"(x + 4) = 5" page has no cross: ${JSON.stringify(h.texts)} ${h.statuses}`);
const bareEq = statusesOf(h => h.family === 'y12-diff' && h.texts.some(t => /^=\s*-?\d+$/.test(t.trim())));
ok(bareEq.length >= 3, `pages with a bare "= 3" continuation: ${bareEq.length}`);
for (const h of bareEq) ok(!h.statuses.includes('b'), `a bare "= n" page has no cross: ${JSON.stringify(h.texts)} ${h.statuses}`);
// a wrong unlabelled value is never ticked: every slip page of the same questions that main crossed or noted is not ticked at its slipped line
{
  await C.loadFamilies();
  let n = 0, ticked = 0;
  for (const fid of ['y12-diff', 'y12-appdiff']) for (const q of C.questionsFor(fid, Array.from({ length: 40 }, (_, i) => i + 1))) {
    let ts; try { ts = C.transcriptsFor(q); } catch { continue; }
    for (const t of ts) {
      if (t.style !== 'slip' || !Number.isInteger(t.breakAt)) continue;
      let r; try { r = stepEvidence(q, '', t.lines.map(l => l.text).join('\n'), { correct: false }, { slipWarnings: true }).stepReport; } catch { continue; }
      if (!r?.lines?.[t.breakAt]) continue;
      n++; if (r.lines[t.breakAt].status === 'ok') ticked++;
    }
  }
  ok(n >= 100 && ticked === 0, `a seeded wrong line is never ticked (${ticked} of ${n} slip pages)`);
}

// ── the area stage: the reviewer's mutants ──────────────────────────────────────────────────────────────────────────────
{
  const meta = { kind: 'area-substituted', variable: 'x', lower: 1, upper: 3, expected: 2197 / 9 - 343 / 9, independent: true };
  const st = t => assessAreaLine({ text: t, meta }).status;
  ok(st('F(3) - F(1) = 2197/9 - 343/9') === 'ok', 'the right line is ticked');
  ok(st('F(3) - F(1)') === 'note' && st('2197/9 - 343/9') === 'ok', 'the numbers alone are the difference; F(3) - F(1) with no numbers earns nothing');
  for (const wrong of ['F(3) + F(1) = 2197/9 - 343/9', 'F(5) - F(1) = 2197/9 - 343/9', 'F(1) - F(3) = 2197/9 - 343/9', 'F(3) - F(2) = 2197/9 - 343/9', 'F(3) - G(1) = 2197/9 - 343/9', 'F(3) * F(1) = 2197/9 - 343/9', 'F(3) - F(1) - F(0) = 2197/9 - 343/9']) {
    ok(st(wrong) !== 'ok', `a mutant is never ticked: ${wrong} -> ${st(wrong)}`);
  }
  ok(st('F(3) - F(1) = 343/9 - 2197/9') !== 'ok', 'a wrong sign on the numbers is never ticked');
  ok(st('[F(x)]_1^5 = 2197/9 - 343/9') !== 'ok', 'a bracket with other limits is never ticked');
  ok(st('243 - (-32) = 550') !== 'ok', 'a wrong claim beside a right difference is never ticked');
}
{
  // the real page: the question the reviewer named, through the marker
  await C.loadFamilies();
  let found = null;
  for (const q of C.questionsFor('y12-integration', Array.from({ length: 200 }, (_, i) => i + 1))) if (/area under/i.test(q.prompt) && /\(3x \+ 4\)\^2|\(3x \+ 4\)\^\{2\}/.test(q.prompt) && /from \$x = 1\$ to \$x = 3\$/.test(q.prompt)) { found = q; break; }
  if (found) {
    const mk = lines => stepEvidence(found, '', lines.join('\n'), { correct: false }, { slipWarnings: true }).stepReport.lines.map(l => l.status);
    const good = mk(['F(x) = (3x + 4)^3/9', 'F(3) - F(1) = 2197/9 - 343/9']);
    ok(good[1] === 'ok', `the true page ticks its substitution line: ${good}`);
    for (const wrong of ['F(3) + F(1) = 2197/9 - 343/9', 'F(5) - F(1) = 2197/9 - 343/9']) ok(mk(['F(x) = (3x + 4)^3/9', wrong])[1] !== 'ok', `the reviewer's mutant is not ticked on the real question: ${wrong}`);
  } else ok(false, 'the reviewer\'s area question was not found in the first 200 seeds of y12-integration');
}

if (failures.length) { console.error(`TRUE PAGES VS MAIN: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + String(f).slice(0, 700)); process.exit(1); }
console.log(`true pages: ${both} pages on both sides, ${headOnly} only on this head; crossed lines ${headCrossed} (main ${mainCrossed}), new crosses ${newCross}, ticks lost ${lostTick} + ${allowedLost} listed, ticks gained ${gainedTick}`);
console.log(`TRUE PAGES VS MAIN: PASS: ${pass} checks`);
