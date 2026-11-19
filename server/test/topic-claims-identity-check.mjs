// Pri Learning · a definition, a label or a margin number is not a claim (client/src/engine/checker.js, notClaims)
//
// Owner, 20 November 2026: the topic checkers CROSSED `y = 2x(4 - x)` (the student's own name for the curve) and a bare margin
// number `16/3`. The rule is FEEDBACK ONLY: the DISPLAYED report shows such a CROSS as a note and judges the lines after it as if the line were
// absent; partial, board and every `correct` are computed from the topic report unchanged.
//   1  IDENTITY     over every Step Check family and every page: partial and board identical with the rule on and off (zero
//                   differences); pages WITHOUT such a line: the whole stepEvidence output is deep-equal
//   2  THE ONLY CHANGE  pages WITH such a line: the only differences are those lines going from break to note, and every other
//                   line equals the report of the same page with those lines removed (rule off), line for line
//   3  D            the question's own name and unknown stay judged; a wrong bare final value is a note and earns no method mark;
//                   a correct bare final value still ticks
//   4  THE OWNER'S PAGE on an expression-kind and an equation-kind y12-integration question
import { stepEvidence, stepMetaFor } from '../platform/markerOps.js';
import * as G from '../../client/src/engine/generators/index.js';
import { transcriptsFor } from '../../tools/understanding-audit/corpus.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
await G.loadAllBanks();
const A_NOTE = 'Not checked: this line defines or labels something; Pri did not check it against this question.';
const B_NOTE = 'Not checked: a number on its own is not a claim; Pri did not check it against this question.';
const run = (q, lines, on) => stepEvidence(q, '', lines.join('\n'), { correct: false }, { fold: false, claims: on });
const code = r => (r?.stepReport?.lines || []).map(l => (l.status === 'ok' ? 'T' : l.status === 'break' ? 'X' : '.')).join('');
// a line that could be a definition, a label or a bare number (a loose test, independent of the rule's own)
const candidate = t => { const x = String(t).trim().replace(/\s*\.\s*$/, ''); return /^-?[\d.]+(?:\s*\/\s*[\d.]+)?$/.test(x) || /^-?\d*\s*√\s*\d+$/.test(x) || /^[A-Za-z][A-Za-z ]{0,24}?(?:\(\s*[a-z]\s*\))?'{0,2}\s*=[^=]+$/.test(x); };

// every family that issues a Step Check
const ids = Object.keys(G.GENERATORS).sort();
const cases = [];
for (const id of ids) {
  let got = 0;
  for (let seed = 1; seed < 40 && got < 3; seed++) for (const d of [1, 2, 3, 4]) {
    if (got >= 3) break;
    let q; try { q = G.generateQuestion(id, d, seed); } catch { continue; }
    if (!stepMetaFor(q) || q.answerType === 'mcq' || Array.isArray(q.boardScheme)) continue;
    cases.push({ id, q }); got++;
  }
}
const families = new Set(cases.map(c => c.id));
ok(families.size >= 40, `${families.size} Step Check families enumerated`);

let moreMarks = 0, fewerMarks = 0;
let pages = 0, plainPages = 0, claimPages = 0, plainDiff = 0, changed = 0, offBreakOnNote = 0, lineDiff = 0, markedDiff = 0;
const EXTRA = [['7 + 8 = 15'], ['y = 2x(4 - x)'], ['16/3'], ['Area = ∫_0^4 2x(4 - x) dx'], ['u = 2x + 3', '12'], ['f(x) = x^2 + 1']];
for (const { id, q } of cases) {
  const ts = transcriptsFor(q).slice(0, 3);
  for (const t of ts) {
    const base = t.lines.map(l => l.text);
    const pagesFor = [base, [...base, '7 + 8 = 15']];
    for (const extra of EXTRA) { pagesFor.push([...extra, ...base]); pagesFor.push([...base.slice(0, 1), ...extra, ...base.slice(1)]); }
    for (const page of pagesFor) {
      let off, on;
      try { off = run(q, page, false); on = run(q, page, true); } catch { continue; }
      pages++;
      if (JSON.stringify(on.partial) !== JSON.stringify(off.partial) || JSON.stringify(on.board ?? null) !== JSON.stringify(off.board ?? null)) markedDiff++;
      const has = page.some(candidate);
      if (!has) {
        plainPages++;
        if (JSON.stringify(on) !== JSON.stringify(off)) { plainDiff++; if (plainDiff < 4) console.error('plain page differs', id, page); }
        continue;
      }
      claimPages++;
      if (JSON.stringify(on) === JSON.stringify(off)) continue;
      changed++;
      const A = on.stepReport, B = off.stepReport;
      if (!A || !B || A.lines.length !== B.lines.length) { lineDiff++; if (lineDiff < 4) console.error('shape differs', id, page); continue; }
      const removed = A.lines.flatMap((l, i) => ((l.note === A_NOTE || l.note === B_NOTE) && B.lines[i].status !== 'ok' && l.status === 'note' ? [i] : []));
      // lines the rule did not touch must equal the report of the page without the removed lines
      const rest = page.filter((_, i) => !removed.includes(i));
      let ref; try { ref = run(q, rest, false); } catch { ref = null; }
      const kept = A.lines.map((l, i) => i).filter(i => !removed.includes(i));
      const same = ref && ref.stepReport && ref.stepReport.lines.length === kept.length
        && kept.every((i, k) => JSON.stringify(A.lines[i]) === JSON.stringify(ref.stepReport.lines[k]))
        && removed.length > 0 && removed.some(i => B.lines[i].status === 'break');
      // a removed line may be followed by another removed line: the loop in the rule does that; accept only when equal after all
      if (!same) { lineDiff++; if (lineDiff < 6) console.error('not the page without the line', id, page, code(on), code(off), ref && code(ref)); }
    }
  }
}
console.log(`  identity: ${pages} pages over ${families.size} families; ${plainPages} without a candidate line (${plainDiff} differ); ${claimPages} with one, ${changed} changed; mark-bearing fields differ on ${markedDiff} pages)`);
ok(pages >= 800, `${pages} pages compared (at least 800)`);
ok(plainPages >= 400 && plainDiff === 0, `pages without a definition, label or bare number: the whole stepEvidence output is identical, rule on and off (${plainDiff} differ of ${plainPages})`);
ok(changed > 0 && lineDiff === 0, `pages with one: the only change is break to note on those lines, and every other line equals the report of the page without them (${lineDiff} differ of ${changed})`);
ok(markedDiff === 0, `partial credit, method marks and board ticks are identical with the rule on and off on EVERY page (${markedDiff} of ${pages} differ)`);

// a page of 20 definition lines: all are notes, within one evaluation budget
{
  const Q = { prompt: 'Find $\\displaystyle\\int 20x^4\\,dx$.', answerType: 'expression', answer: { expr: '4*x^5' }, difficulty: 2, steps: [], stepcheck: { kind: 'expression', canonical: '4*x^5' } };
  const page = Array.from({ length: 20 }, (_, i) => `${'abcdfghijklmnopqrstu'[i]} = ${i + 3}x + 1`);
  const t0 = Date.now(), r = run(Q, page, true), ms = Date.now() - t0;
  ok(!/X/.test(code(r)) && r.stepReport.firstBreak === -1, `20 definition lines: none is crossed (${code(r)})`);
  ok(ms < 3000, `...and the re-judging stays within a page budget (${ms} ms)`);
}
// D · the question's own name and unknown stay judged
const DIFF = { prompt: 'Differentiate $y = x^3$.', answerType: 'expression', answer: { expr: '3*x^2' }, difficulty: 2, steps: [], stepcheck: { kind: 'expression', canonical: '3*x^2' } };
ok(code(run(DIFF, ['y = x^3', "y' = 3x^2", 'y = 3x^4'], true)).endsWith('X') || /X/.test(code(run(DIFF, ["y' = 3x^2", 'y = 3x^4'], true))), 'a wrong line under the question\'s own name y is still judged (D)');
{
  const EQ = { prompt: 'Solve $2x + 3 = 11$.', answerType: 'numeric', answerPrefix: 'x =', answer: { value: 4 }, difficulty: 2, steps: [] };
  const wrong = run(EQ, ['2x + 3 = 11', '2x = 8', 'x = 5'], true), right = run(EQ, ['2x + 3 = 11', '2x = 8', 'x = 4'], true);
  ok(/X/.test(code(wrong)) && code(right)[2] === 'T', `x = 5 as the answer to an equation in x stays judged, x = 4 ticks (${code(wrong)} / ${code(right)})`);
  const bare = run(EQ, ['2x + 3 = 11', '2x = 8', '5'], true), bareOff = run(EQ, ['2x + 3 = 11', '2x = 8', '5'], false);
  ok(code(bareOff).slice(-1) === 'X' && code(bare).slice(-1) !== 'X' && JSON.stringify(bare.partial) === JSON.stringify(bareOff.partial), `a wrong bare final value is shown as a note, never a cross, and the method marks are exactly as before (${code(bareOff)} to ${code(bare)}, awarded ${bare.partial?.awarded ?? 0} against ${bareOff.partial?.awarded ?? 0})`);
  ok(run(EQ, ['2x + 3 = 11', '2x = 8', '4'], true).stepReport.lines[2].status === 'ok', 'a correct bare final value still ticks');
  ok(code(run(EQ, ['2x + 3 = 11', 'k = 5', '2x = 8', 'x = 4'], true)).indexOf('X') === -1, 'a definition under another letter is not crossed');
}

// the owner's page
{
  const PAGE = ['y = 2x(4 - x)', 'Area = ∫_0^4 2x(4 - x) dx', '= 2∫_0^4 4x - x^2 dx', '= 2[4x^2/2 - x^3/3]_0^4', '= 2[2x^2 - x^3/3]_0^4', '= 2[2(4)^2 - 4^3/3] = 2[32 - 64/3]', '16/3', '64/3'];
  const find = (kind, match) => { for (let seed = 1; seed < 80; seed++) for (const d of [1, 2]) { let q; try { q = G.generateQuestion('y12-integration', d, seed); } catch { continue; } if (stepMetaFor(q)?.kind === kind && match.test(q.prompt)) return q; } return null; };
  for (const [kind, match] of [['expression', /\\int \d*\(?\d*x/], ['equation', /./]]) {
    const q = find(kind, match);
    ok(!!q, `a ${kind}-kind y12-integration question`);
    if (!q) continue;
    const before = run(q, PAGE, false), after = run(q, PAGE, true);
    const withFold = stepEvidence(q, '', PAGE.join('\n'), { correct: false });
    ok(/X/.test(code(before)), `${kind}: before the rule the page was crossed (${code(before)})`);
    ok(!/X/.test(code(after)) && after.stepReport.firstBreak === -1, `${kind}: nothing is crossed (${code(after)})`);
    ok([0, 1, 6].every(i => after.stepReport.lines[i].status === 'note'), `${kind}: y = …, Area = … and 16/3 are notes`);
    ok(before.stepReport.lines.every((l, i) => l.status !== 'break' || after.stepReport.lines[i].note === A_NOTE || after.stepReport.lines[i].note === B_NOTE), `${kind}: every line that was crossed is now a note that says why`);
    ok(code(withFold) === '..TTTT.T', `${kind}: with the fold, lines 3 to 6 and 64/3 tick (${code(withFold)})`);
    ok(JSON.stringify(before.partial) === JSON.stringify(after.partial), `${kind}: no mark changes`);
  }
}
console.log(`TOPIC CLAIMS: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — a definition, a label or a bare number is never crossed by a topic check; every other page is byte-identical`);
if (fail) process.exit(1);
