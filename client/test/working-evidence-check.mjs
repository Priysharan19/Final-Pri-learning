// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "every line verified" is said only when it was (#448, #430)
//
// The rules in components/workingEvidence.js, checked without React: a step
// report counts only when it is a report of exactly the submitted lines; every
// line is called verified only when every line of it is `ok` and none is
// carried forward; the first mistake is pinned only through such a report.
// ─────────────────────────────────────────────────────────────────────────────
import { reportForLines, everyLineVerified, lineMarks, writtenLines } from '../src/components/workingEvidence.js';

let pass = 0;
const failures = [];
function ok(cond, label) { if (cond) pass++; else failures.push(label); }
function eq(actual, expected, label) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const LINES = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '= 9 + 24', '= 35'];
const report = statuses => ({ firstBreak: statuses.indexOf('break'), lines: LINES.map((text, i) => ({ text, status: statuses[i] })) });

// ── The report must be of exactly these lines ────────────────────────────────
const allOk = report(['ok', 'ok', 'ok', 'ok', 'ok']);
ok(reportForLines(allOk, LINES) === allOk, 'a report of the same lines is used');
ok(reportForLines(allOk, LINES.join('\n')) === allOk, 'the working as one string is read as its non-blank lines');
ok(reportForLines(allOk, ['', ...LINES.slice(0, 2), '  ', ...LINES.slice(2), '']) === allOk, 'blank lines are not lines');
eq(reportForLines(allOk, LINES.slice(0, 4)), null, 'fewer lines on screen: not this report');
eq(reportForLines(allOk, [...LINES, '= 33']), null, 'more lines on screen: not this report');
eq(reportForLines(allOk, [...LINES.slice(0, 4), '= 33']), null, 'a line changed since: not this report');
eq(reportForLines(allOk, [LINES[1], LINES[0], ...LINES.slice(2)]), null, 'lines reordered: not this report');
eq(reportForLines(null, LINES), null, 'no report: nothing');
eq(reportForLines({ lines: [] }, LINES), null, 'an empty report: nothing');
eq(reportForLines(allOk, []), null, 'no lines: nothing');
eq(writtenLines(' a \n\n b '), ['a', 'b'], 'written lines are trimmed and non-blank');

// ── "Every line verified" ────────────────────────────────────────────────────
eq(everyLineVerified(allOk, LINES), true, 'every line ok, same lines: verified');
eq(everyLineVerified(report(['ok', 'ok', 'ok', 'ok', 'break']), LINES), false, 'a break: not every line');
eq(everyLineVerified(report(['ok', 'note', 'ok', 'ok', 'ok']), LINES), false, 'a note is a line not judged: not every line');
eq(everyLineVerified({ ...allOk, lines: allOk.lines.map((l, i) => (i === 2 ? { ...l, ecf: true } : l)) }, LINES), false, 'a line carried forward is true of a slip: not every line');
eq(everyLineVerified(allOk, [...LINES.slice(0, 4), '= 33']), false, 'the lines changed since: nothing is claimed');
eq(everyLineVerified(null, LINES), false, 'no report (the working was not read, or the answer alone was marked): nothing is claimed');
eq(everyLineVerified(allOk, ['= 35']), false, 'one line on screen, five in the report: nothing is claimed');

// ── Pinning the first mistake ────────────────────────────────────────────────
const owner = { firstBreak: 4, lines: LINES.map((text, i) => ({ text, status: i === 4 ? 'break' : 'ok', note: i === 4 ? 'Check the addition: 9 + 24 equals 33, not 35.' : undefined })) };
eq(lineMarks(owner, LINES), [{ kind: 'ok', note: null }, { kind: 'ok', note: null }, { kind: 'ok', note: null }, { kind: 'ok', note: null }, { kind: 'break', note: 'Check the addition: 9 + 24 equals 33, not 35.' }],
  'the owner page: four ticks and the first mistake on the fifth line, with its note');
eq(lineMarks(owner, [...LINES.slice(0, 4), '= 33']), null, 'a changed line: no marks at all, rather than a ✗ on the wrong line');
const twice = { lines: LINES.map((text, i) => ({ text, status: i === 0 || i === 4 ? 'break' : 'ok', ecf: i === 2 || i === 3, note: i === 2 ? 'Correct, carrying the earlier slip forward.' : i === 4 ? 'second' : undefined })) };
eq(lineMarks(twice, LINES).map(m => m.kind), ['break', 'ok', 'ecf', 'ecf', 'also'], 'the first break is the mistake; a later one is "also"; carried lines are ecf');
eq(lineMarks(twice, LINES)[2].note, 'Correct, carrying the earlier slip forward.', 'a carried line keeps its note');
const notes = { lines: LINES.map((text, i) => ({ text, status: i === 1 ? 'note' : 'ok' })) };
eq(lineMarks(notes, LINES)[1], null, 'a line not judged has no mark');
// A photo page with excluded lines: the report indexes the kept lines; the
// screen indexes every line.
const page = ['Q.4', ...LINES.slice(0, 2), 'rough', ...LINES.slice(2)];
const kept = [1, 2, 4, 5, 6];
const marks = lineMarks(owner, LINES, { count: page.length, indexOf: i => kept[i] });
eq(marks.map(m => m?.kind ?? null), [null, 'ok', 'ok', null, 'ok', 'ok', 'break'], 'marks land on the kept lines of the page, excluded lines stay unmarked');
eq(lineMarks(owner, LINES, { count: 3, indexOf: i => kept[i] }).map(m => m?.kind ?? null), [null, 'ok', 'ok'], 'an index off the page is dropped, never wrapped');

if (failures.length) {
  console.error(`WORKING EVIDENCE: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`WORKING EVIDENCE: PASS — ${pass}/${pass} checks — a step report is used only for exactly the lines it judged, "every line verified" needs every line ok and none carried forward, and the first mistake is pinned only through such a report.`);
