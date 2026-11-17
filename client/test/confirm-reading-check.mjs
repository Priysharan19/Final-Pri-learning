// Explicit ambiguity resolution (standard P0 #11): the rules of the
// confirmation gate and where the card applies them. The browser behaviour
// (nothing sent before the tap, an edited reading confirmed again, a stale
// reading re-read) is pinned in tour-ink.js and tour-stale-cloud.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { needsConfirmation, confirmedRevision } from '../src/ink/confirmGate.js';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n += 1; };
const base = { writeMode: true, resolved: false, reading: '7', stale: false, vouched: null };

ok(needsConfirmation(base), 'a read, current handwriting answer needs confirming before it can be sent, however confident');
ok(!needsConfirmation({ ...base, vouched: '7' }), 'once the student has confirmed exactly this reading, it may go');
ok(needsConfirmation({ ...base, reading: '8', vouched: '7' }), 'an edited reading is a different reading: it needs its own confirmation');
ok(!needsConfirmation({ ...base, stale: true }), 'a stale reading is not confirmed — it is read again first, and the new reading is confirmed');
ok(!needsConfirmation({ ...base, reading: '' }), 'no reading, nothing to confirm (Submit asks for a read first)');
ok(!needsConfirmation({ ...base, writeMode: false }), 'typing and photo carry no handwriting reading to confirm');
ok(!needsConfirmation({ ...base, resolved: true }), 'a resolved question is not gated');

const rev = confirmedRevision({ reading: '7', signature: '3:120:abc', text: 'x=7', edited: true, now: 5 });
ok(rev.reading === '7' && rev.signature === '3:120:abc' && rev.transcript === 'x=7' && rev.edited === true && rev.at === 5, 'the confirmed revision records the reading, the page signature, the transcript and whether it was edited');
ok(Object.isFrozen(rev), 'the record is immutable');
ok(JSON.stringify(Object.keys(confirmedRevision({ reading: 'a' })).sort()) === JSON.stringify(['at', 'edited', 'reading', 'signature', 'transcript']), 'the record carries no answer, mark or expected value');

const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
ok(/needsConfirmation\(\{ writeMode: writeMode \|\| photoInUse, resolved, reading: readingId, stale: writeMode \? inkStale : false, vouched \}\)/.test(card), 'the card gates on the pure rule with the current reading and the vouched one');
ok(/if \(needsCheck && vouchedNow !== readingId\) return;/.test(card), 'every submit path still stops on an unconfirmed reading');
ok(/needsCheck\s*\n?\s*\? \{ label: t\('verdict.confirmAndSubmit'\), run: acceptReading, disabled: busy \|\| !canSubmit \|\| toConfirm > 0 \}/.test(card), 'the primary is the combined Confirm and mark, disabled until nothing is left to confirm');
ok(/data-confirm-count/.test(card) && /verdict\.confirmCount/.test(card) && /verdict\.confirmWhich/.test(card) && /verdict\.confirmBlind/.test(card), 'the panel counts what is left to confirm, asks which was written, and says Pri reads without seeing the answer');
ok(/if \(toConfirm > 0\) return;/.test(card), 'accepting is refused while any line is unresolved');
ok(/confirmed: viaInk \? confirmedRef\.current : null/.test(card), 'the confirmed revision is kept with the submission record');
ok(/ink = \{ strokes: compactInkStrokes\(inkResult\.strokes\), recognized: inkResult\.text/.test(card), 'the original strokes still travel with the confirmed reading');
ok(/needsCheck && doubt \? \(doubt\.weakest\?\.id/.test(card), 'the focused symbol is read only when there is a doubt');
ok(/setVouched\(null\); setAckedDoubt\(null\); confirmedRef\.current = null;/.test(card) && /photoKey, question\.id\]\);/.test(card) && /setAckedDoubt\(null\)/.test(card), 'a confirmation and any doubt acknowledgement are dropped when the transcript, the ink or the photo reading changes');
const css = readFileSync(new URL('../src/workspace.css', import.meta.url), 'utf8');
ok(/@media \(prefers-reduced-motion: no-preference\) \{ \.ws-confirm-line\.is-unsure \{ animation/.test(css) && /\.ws-confirm-line\.is-unsure \{ outline: 1\.5px dashed/.test(css), 'the pulse exists only when motion is allowed; the static dashed outline and the words always carry the state');
// Photo/PDF: confirming an unchanged line resolves it, and indices are the transcript's own (an excluded line before it does not shift them).
const { confirmLine, editLine, linesToCheck, reviveTranscript } = await import('../src/photo/transcript.js');
const tr = { lines: [{ text: 'a', read: 'a', check: false, excluded: true, why: 'student', edited: false }, { text: 'x+1', read: 'x+1', check: true, excluded: false, edited: false }, { text: 'y', read: 'y', check: true, excluded: false, edited: false }], undecided: false, anchor: null };
ok(linesToCheck(tr) === 2, 'two photo lines ask to be checked');
const c1 = confirmLine(tr, 1);
ok(linesToCheck(c1) === 1 && c1.lines[1].text === 'x+1' && c1.lines[0].text === 'a' && c1.lines[2].text === 'y', 'confirming photo line 1 resolves only that line and rewrites none');
ok(linesToCheck(confirmLine(c1, 2)) === 0, 'once every flagged photo line is confirmed nothing is left to check');
ok(reviveTranscript(c1).lines[1].confirmed === true, 'a confirmation survives a kept draft');
ok(editLine(c1, 1, 'x+2').lines[1].confirmed === false && editLine(c1, 1, 'x+2').lines[1].edited === true, 'an edit replaces the confirmation with the edit');
const exam = readFileSync(new URL('../src/pages/ExamRoom.jsx', import.meta.url), 'utf8');
ok(!/confirmGate\.js/.test(exam), 'the exam room keeps its own rules (it is not gated here)');
console.log(`CONFIRM READING: PASS — ${n}/${n} checks — a read answer is confirmed before it is sent; an edited reading is confirmed again; a stale reading is re-read; the exam room is untouched`);
