// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · typeset working (a typed or printed page) is read like handwriting, line by line
//
// Owner's photographed page, 23 November 2026: the compound-interest working below came back as sixteen notes, because the arithmetic
// checker did not read `$`, a thousands comma, a bracketed gloss, or a letter on the left of `=` ("A = …" then "A = …").
//
//   · the true calculation lines of that page are ticked, with no cross anywhere; headings and definitions stay notes
//   · the same page with one wrong line (A = 9216 after A = 8000(1.157625)) does not tick that line, and nothing after it is ticked
//     as a consequence of it; a wrong final value (1216) is not ticked either
//   · currency signs and thousands separators are read as numbers; a trailing bracketed gloss is ignored
//   · tick only: nothing here ever sets a cross, a mark or `correct`
//
//   node server/test/typed-working-ticks-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { stepEvidence } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { stepCheckArithmetic } from '../../client/src/engine/arithmeticLines.js';
import * as G from '../../client/src/engine/generators/index.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

await G.loadAllBanks();
// y12-fin-exact, difficulty 1, seed 270: "A school building fund invests \$8,000 at 5% per annum ... How much interest ... after 3 years" = 1261
const q = G.generateQuestion('y12-fin-exact', 1, 270);
ok(/8,000/.test(q.prompt) && /5%/.test(q.prompt) && /3 years/.test(q.prompt) && /interest/i.test(q.prompt) && q.answer?.value === 1261, 'the fixture is the $8000, 5%, 3 years interest question');

const PAGE = [
  'We use the compound interest formula:', 'A = P(1 + r)^n', 'Where:', 'P = 8000 (principal)', 'r = 0.05 (annual interest rate)', 'n = 3 (number of years)',
  'Step 1: Substitute the values', 'A = 8000(1 + 0.05)^3', 'A = 8000(1.05)^3', 'A = 8000(1.157625)', 'A = $9261',
  'Step 2: Calculate the interest earned', 'Interest = A - P', '= 9261 - 8000', '$1261', 'Final answer: $1,261'
];
const TICKED = new Set([8, 9, 10, 13, 14, 15]);   // zero-based: the true calculation lines after the first step of each chain

// through the server's practice-submit marking path (no network): the typed answer and the working
const mark = (lines, answer = '1261') => {
  const res = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), res);
  return { res, report: ev.stepReport };
};
const states = r => (r.report?.lines || []).map(l => l.status);

{
  const { res, report } = mark(PAGE);
  ok(res.correct === true, 'the right answer is correct');
  ok(report && report.lines.length === 16, 'a report of sixteen lines');
  const st = states({ report });
  PAGE.forEach((_, i) => ok(st[i] === (TICKED.has(i) ? 'ok' : 'note'), `line ${i + 1} (${PAGE[i]}) is ${TICKED.has(i) ? 'ticked' : 'a note'}, got ${st[i]}`));
  ok(!st.includes('break'), 'no cross on the true page');
  ok(report.lines.every((l, i) => l.text === PAGE[i]), 'the lines shown are the student\'s text, unchanged');
}

// one wrong line: A = 8000(1.157625) then A = 9216
{
  const wrong = PAGE.map(l => (l === 'A = $9261' ? 'A = $9216' : l));
  const { report } = mark(wrong);
  const st = states({ report });
  ok(st[10] !== 'ok', 'the wrong A = $9216 is not ticked');
  ok(!st.slice(10).includes('ok'), 'nothing after the wrong value is ticked as following from it');
  ok(st[8] === 'ok' && st[9] === 'ok', 'the true lines above it stay ticked');
}
// a wrong final value
{
  const wrong = PAGE.map(l => (l === '$1261' ? '$1216' : l === 'Final answer: $1,261' ? 'Final answer: $1,216' : l));
  const { report } = mark(wrong, '1216');
  const st = states({ report });
  ok(st[14] !== 'ok' && st[15] !== 'ok', 'the wrong final value (1216) is not ticked');
}
// the right page with a wrong final line only
{
  const wrong = PAGE.map(l => (l === 'Final answer: $1,261' ? 'Final answer: $1,216' : l));
  const st = states(mark(wrong, '1216'));
  ok(st[15] !== 'ok', 'a final answer of $1,216 under 1261 is not ticked');
}

// with the reader's TeX alongside, as the server passes it: the same verdicts
{
  const latex = PAGE.map(t => ({ text: t, latex: t.replace(/\$/g, '\\$').replace(/\^(\d|n)/g, '^{$1}') }));
  const res = checkAnswer(q, '1261');
  const st = states({ report: stepEvidence(q, '1261', PAGE.join('\n'), res, { latex }).stepReport });
  PAGE.forEach((_, i) => ok(st[i] === (TICKED.has(i) ? 'ok' : 'note'), `with latex: line ${i + 1} is ${TICKED.has(i) ? 'ticked' : 'a note'}, got ${st[i]}`));
}

// currency, thousands, gloss: read as numbers by the plain checker
const one = (text) => stepCheckArithmetic(text).lines.map(l => l.status);
ok(one('9261 - 8000 = 1261')[0] === 'ok', 'plain: 9261 - 8000 = 1261 ticks');
ok(one('$9261 - $8000 = $1,261')[0] === 'ok', 'dollar signs and a thousands comma are read');
ok(one('A$9,261 - A$8,000 = A$1,261')[0] === 'ok', 'A$ is read');
ok(one('$9261 - $8000 = $1,216')[0] !== 'ok', 'a wrong value with currency is not ticked');
ok(one('1,000 + 2,500 = 3,500')[0] === 'ok', 'thousands in a sum');
ok(one('1,000 + 2,500 = 3,400')[0] === 'break', 'a false sum with thousands is crossed by the existing rule');
ok(one('x = 5 (given)\nx = 5')[1] === 'ok', 'a gloss in brackets is ignored: x = 5 again is the same value');
ok(one('(2,100)')[0] !== 'ok', 'a point (2,100) is not read as 2100');

// named quantity carried down the page: tick only, never a cross
ok(JSON.stringify(one('x = 3 + 4\nx = 7')) === '["note","ok"]', 'x = 3 + 4 then x = 7: the second is ticked');
ok(JSON.stringify(one('x = 3 + 4\nx = 8')) === '["note","note"]', 'x = 3 + 4 then x = 8: a note, never a cross, never a tick');
ok(JSON.stringify(one('x = 3 + 4\nx = 8\nx = 8')) === '["note","note","note"]', 'a wrong value repeated is still not ticked');
ok(JSON.stringify(one('A = 8000(1.157625) = 9261')) === '["ok"]', 'a chain under one name is ticked when every side agrees');
ok(JSON.stringify(one('A = 8000(1.157625) = 9216')) === '["note"]', 'a chain under one name that disagrees is a note');
ok(one('P = 8000\nr = 0.05')[0] === 'note' && one('P = 8000\nr = 0.05')[1] === 'note', 'definitions stay notes');
ok(one('Where:\nP = 8000 (principal)').every(s => s === 'note'), 'a heading and a definition stay notes');
ok(JSON.stringify(one('x = 3 + 4\ny = 7')) === '["note","note"]', 'a different name does not carry');
ok(JSON.stringify(one('x = 3 + 4\nWhere:\nx = 7')) === '["note","note","note"]', 'a line in between breaks the chain');

if (failures.length) { console.error(`typed-working-ticks-check: ${failures.length} FAILED of ${pass + failures.length}`); for (const f of failures) console.error('  FAIL: ' + f); process.exit(1); }
console.log(`typed-working-ticks-check: ${pass} passed`);
