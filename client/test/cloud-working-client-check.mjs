// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the second read of the working may and may not do
//
// The server contract is checked next door. This is the client half, and the
// promises it holds are about restraint rather than capability:
//
//   · off unless the student turned it on;
//   · asked for only when it can help — a wrong answer the on-device checker
//     could not diagnose, never a correct one and never a page of one line;
//   · a local verdict is never overwritten by a judgement;
//   · an unsure check contributes words, never a ✗ on a line;
//   · it never puts the answer on screen.
// ─────────────────────────────────────────────────────────────────────────────
import {
  checkWorkingWithCloud, mergeVerdicts, shouldCheckWorking, workingCheckEnabled, workingNote
} from '../src/ink/cloudWorking.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const there = () => true;
const WORKING = ['2x + 3 = 11', '2x = 14', 'x = 7'];

// ── 1 · Off by default ───────────────────────────────────────────────────────
ok(workingCheckEnabled({}, { available: there }) === false, 'off by default');
ok(workingCheckEnabled(null, { available: there }) === false, 'off with no profile');
ok(workingCheckEnabled({ cloudMarking: undefined }, { available: there }) === false, 'off for a profile that predates the setting');
ok(workingCheckEnabled({ cloudMarking: false }, { available: there }) === false, 'off when declined');
ok(workingCheckEnabled({ cloudMarking: true }, { available: there }) === true, 'on when the student turned it on');
ok(workingCheckEnabled({ cloudMarking: true }, { available: () => false }) === false, 'and off where the deployment cannot do it');
ok(workingCheckEnabled({ cloudHandwriting: true }, { available: there }) === false,
  'turning on server reading does not silently turn on server marking — they send different things');

// ── 2 · Asked for only where it can help ─────────────────────────────────────
const localSilent = { lines: [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }] };
ok(shouldCheckWorking({ correct: false, lines: WORKING, localReport: localSilent }),
  'a wrong answer the on-device checker could not place is exactly the case for it');
ok(!shouldCheckWorking({ correct: true, lines: WORKING, localReport: localSilent }),
  'a correct answer needs no diagnosis');
ok(!shouldCheckWorking({ correct: false, invalid: true, lines: WORKING, localReport: localSilent }),
  'an unreadable submission is not a marking question');
ok(!shouldCheckWorking({ correct: false, revealed: true, lines: WORKING, localReport: localSilent }),
  'once the answer has been revealed there is nothing to diagnose');
ok(!shouldCheckWorking({ correct: false, lines: ['x = 7'], localReport: localSilent }),
  'a single line is not working');
ok(!shouldCheckWorking({ correct: false, lines: WORKING, localReport: { lines: [{ status: 'ok' }, { status: 'break' }] } }),
  'and when the on-device checker already found the line, it is not asked — that verdict is exact and free');

// ── 3 · What is sent ─────────────────────────────────────────────────────────
let sent = null;
const spy = {
  checkWorking: async (prompt, lines, opts) => {
    sent = { prompt, lines, opts };
    return { check: { lines: [{ index: 0, status: 'ok', carried: false, why: '' }, { index: 1, status: 'break', carried: false, why: 'you added 3 to the right instead of subtracting it' }, { index: 2, status: 'ok', carried: true, why: 'correct on your own value' }], firstBreak: 1, hint: 'Look at what you did to both sides.', confidence: 0.93, needsConfirmation: false } };
  }
};

let called = 0;
const counting = { checkWorking: async () => { called += 1; return { check: { lines: [] } }; } };
await checkWorkingWithCloud(WORKING, { user: { cloudMarking: false }, transport: counting, available: there });
eq(called, 0, 'with the setting off, nothing is sent');

const check = await checkWorkingWithCloud(WORKING, { user: { cloudMarking: true }, prompt: 'Solve 2x + 3 = 11.', transport: spy, available: there });
eq(sent.lines, WORKING, 'the working is sent as the student wrote it');
eq(sent.prompt, 'Solve 2x + 3 = 11.', 'and the question, without which "does this line follow" cannot be asked');
eq(Object.keys(sent.opts || {}), ['signal'], 'and nothing travels beside them but the cancel signal');
eq(check.firstBreak, 1, 'the check comes back naming the first broken line');

const failing = { checkWorking: async () => { const e = new Error('nope'); e.code = 'WORKING_UNAVAILABLE'; throw e; } };
const failed = await checkWorkingWithCloud(WORKING, { user: { cloudMarking: true }, transport: failing, available: there });
ok(failed?.error?.code === 'WORKING_UNAVAILABLE', 'a refusal is reported, never thrown at a student reading their mark');

// ── 4 · Merging never overrules the on-device checker ────────────────────────
const localBreak = [{ status: 'ok' }, { status: 'break', note: 'the rule fired here' }, { status: 'unknown' }];
const merged = mergeVerdicts(localBreak, check, { lineCount: 3 });
eq(merged[1], { status: 'break', note: 'the rule fired here' },
  'a line the on-device checker judged keeps its own verdict and its own words');
eq(merged[0].status, 'ok', 'and its other verdicts are untouched');

const localQuiet = [{ status: 'unknown' }, { status: 'unknown' }, { status: 'unknown' }];
const filled = mergeVerdicts(localQuiet, check, { lineCount: 3 });
eq(filled[1].status, 'break', 'silence is where a cloud verdict may land');
ok(/instead of subtracting/.test(filled[1].note), 'and it lands with the reason in plain words');
eq(filled[2].status, 'ok', 'a line that follows from the student’s own slip still earns its tick');
ok(/your earlier value|your own value/i.test(filled[2].note), 'and is told it is carrying the earlier mistake, not repeating it');

const unsure = { ...check, needsConfirmation: true };
const unsureMerge = mergeVerdicts(localQuiet, unsure, { lineCount: 3 });
eq(unsureMerge, localQuiet, 'an unsure check puts no mark on any line');
eq(mergeVerdicts(localQuiet, { error: { code: 'X' } }, { lineCount: 3 }), localQuiet, 'and a failed check changes nothing');
eq(mergeVerdicts(null, check, { lineCount: 3 })[1].status, 'break', 'it also works where there were no local verdicts at all');

// ── 4b · A verdict must land on the line the student actually wrote ──────────
// Blank lines are not sent, so the server counts only non-blank lines while the
// ink surface indexes every line it read. Untranslated, a ✗ and "the mistake is
// here" landed on a line that was correct.
let sentLines = null;
const blanksSpy = {
  checkWorking: async (prompt, lines) => {
    sentLines = lines;
    return { check: { lines: [{ index: 0, status: 'ok', carried: false, why: '' }, { index: 1, status: 'ok', carried: false, why: '' }, { index: 2, status: 'break', carried: false, why: 'sign error' }], firstBreak: 2, hint: 'check the sign', confidence: 0.93, needsConfirmation: false } };
  }
};
const withBlanks = ['2x+3=9', '', '2x=6', '', 'x=2'];
const translated = await checkWorkingWithCloud(withBlanks, { user: { cloudMarking: true }, transport: blanksSpy, available: there });
eq(sentLines, ['2x+3=9', '2x=6', 'x=2'], 'blank lines are not sent — there is nothing to check on them');
eq(translated.firstBreak, 4, 'and the break comes back indexed to the line the student actually wrote');
eq(translated.lines.map(l => l.index), [0, 2, 4], 'every verdict is translated back through the blanks');
const landed = mergeVerdicts(null, translated, { lineCount: 5 });
eq(landed[4].status, 'break', 'so the ✗ lands on line 5, not on the correct line 3');
ok(!landed[2] || landed[2].status !== 'break', 'and never on a line that was right');
ok(/Line 5/.test(workingNote(translated).text), 'and the sentence names the line the student sees');

// ── 4c · A confident "nothing is wrong" must not tick a wrong answer's lines ─
// This only runs when the answer is already known to be wrong, and a cloud tick
// renders identically to a rule-verified one.
const noFault = { lines: [{ index: 0, status: 'ok', carried: false, why: '' }, { index: 1, status: 'ok', carried: false, why: '' }], firstBreak: -1, hint: '', confidence: 0.95, needsConfirmation: false };
eq(mergeVerdicts(localQuiet, noFault, { lineCount: 3 }), localQuiet,
  'a check that found no break contributes its words and no ticks');
ok(workingNote(noFault).text.length > 0, 'while still telling the student the algebra held up');

// ── 5 · What the student reads ───────────────────────────────────────────────
const note = workingNote(check);
ok(/Line 2 is where it goes wrong/.test(note.text), 'the note names the line, counting from 1 as the student sees it');
ok(/instead of subtracting/.test(note.text), 'and says what happened');
ok(!/x\s*=\s*4/.test(note.text), 'and never states the answer');
eq(note.tone, 'break', 'a confident diagnosis is presented as one');

const hedged = workingNote({ ...check, needsConfirmation: true });
eq(hedged.tone, 'maybe', 'an unsure one is presented as a suggestion');
ok(/might be|not certain/i.test(hedged.text), 'in words that say so out loud');

const noBreak = workingNote({ lines: [{ index: 0, status: 'ok', carried: false, why: '' }], firstBreak: -1, hint: '', confidence: 0.9, needsConfirmation: false });
ok(/follows from the one before/.test(noBreak.text),
  'when every line follows, the student is told the algebra was sound — which is the useful thing to know');
ok(workingNote(null) === null && workingNote({ error: {} }) === null, 'nothing to say when there was no check');

console.log(failures.length
  ? `CLOUD WORKING CLIENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `CLOUD WORKING CLIENT: PASS — ${pass}/${pass} checks — off by default, asked only where it helps, never overrules the on-device checker, never states the answer.`);
process.exit(failures.length ? 1 : 0);
