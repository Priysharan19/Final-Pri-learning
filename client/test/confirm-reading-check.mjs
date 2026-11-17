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
ok(/needsConfirmation\(\{ writeMode, resolved, reading, stale: inkStale, vouched \}\)/.test(card), 'the card gates on the pure rule with the current reading and the vouched one');
ok(/if \(needsCheck && vouchedNow !== reading\) \{ setChecking\(true\); return; \}/.test(card), 'every submit path still stops on an unconfirmed reading');
ok(/confirmOnly\s*\n?\s*\? \{ label: t\('verdict.confirmAndSubmit'\), run: acceptReading/.test(card), 'the primary is the combined Confirm and submit');
ok(/confirmed: viaInk \? confirmedRef\.current : null/.test(card), 'the confirmed revision is kept with the submission record');
ok(/ink = \{ strokes: compactInkStrokes\(inkResult\.strokes\), recognized: inkResult\.text/.test(card), 'the original strokes still travel with the confirmed reading');
const exam = readFileSync(new URL('../src/pages/ExamRoom.jsx', import.meta.url), 'utf8');
ok(!/confirmGate\.js/.test(exam), 'the exam room keeps its own rules (it is not gated here)');
console.log(`CONFIRM READING: PASS — ${n}/${n} checks — a read answer is confirmed before it is sent; an edited reading is confirmed again; a stale reading is re-read; the exam room is untouched`);
