import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateRequest } from '../src/local/gateway.js';
import { chooseNativeConsensus } from '../src/ink/nativeConsensus.js';

const question = fs.readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
const ink = fs.readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
const native = fs.readFileSync(new URL('../src/ink/native.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../../ios/PriLearning.swiftpm/Ink/InkBridge.swift', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../src/local/backend.js', import.meta.url), 'utf8');

assert.match(question, /compactInkStrokes\(inkResult\.strokes\)/, 'submit must use compact ink transport');
assert.match(question, /points: .*\.map\(p => \[/s, 'transport points must be arrays, not {x,y} objects');
assert.match(backend, /Array\.isArray\(pt\) \? pt\[0\]/, 'backend must decode compact point tuples');
// Owner decision (read on request): a page is sent to the reader only when the
// student presses "Read my answer" (or "Try again" after a refusal). No settle
// timer exists any more, and a page that is being read is never sent again.
assert.doesNotMatch(ink, /SETTLE_MS/, 'no settle window may send a page to the reader');
assert.doesNotMatch(ink, /setTimeout\([^;]*readNow/, 'no timer may send a page to the reader');
assert.equal((ink.match(/\breadNow\(\)/g) || []).length, 1, 'the only call of readNow outside the Read button is the explicit Try again');
assert.match(ink, /data-ink-read=\{[^}]+\} onClick=\{readNow\}/, 'a read is sent by the student pressing Read my answer');
assert.match(ink, /if \(flyingRef\.current === signature\) return;/, 'a page that is being read is never sent again');
assert.match(ink, /readRef\.current === nowSignature && recRef\.current\.lines\.length/, 'a late reading of other ink never replaces the transcript of the page as it stands');
// D16 (V1_DECISIONS_2026-11-01.md): the shell no longer reads ink, so the
// on-device job queue these lines once pinned (foundation/rescue timeouts,
// strokeRevision, stale Foundation jobs) is gone from both sides. What must
// hold instead: no read op survives on either side, and a late SERVER reading
// can never land on changed ink (the read sequence guard in InkAnswer, beside
// the readRef/flyingRef checks above; tour-stale-cloud.js drives it).
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
assert.doesNotMatch(code(native), /foundationRecognize|op:\s*['"]recognize['"]|type === 'reading'/, 'the web side of the bridge asks the shell to read nothing');
assert.doesNotMatch(code(bridge), /case "recognize"|case "foundationRecognize"|"reading"/, 'the shell answers no read op');
assert.match(ink, /const seq = \+\+readSeqRef\.current;/, 'every server read takes a sequence number');
assert.match(ink, /if \(seq !== readSeqRef\.current \|\| disabledRef\.current\) return;/, 'a reply to an older read is dropped');

// Reproduce the gateway failure class from the real iPad page: 3,000 points as
// {x,y} exceeds MAX_KEYS, while the compact tuple transport remains legal.
const objectPoints = Array.from({ length: 3000 }, (_, i) => ({ x: i, y: i % 700 }));
assert.throws(() => validateRequest('POST', '/practice/test/submit', {
  answer: '24/7', viaInk: true, ink: { strokes: [{ points: objectPoints }], recognized: '24/7' }
}), /too many object keys/i);
const tuplePoints = objectPoints.map(p => [p.x, p.y]);
assert.doesNotThrow(() => validateRequest('POST', '/practice/test/submit', {
  answer: '24/7', viaInk: true, ink: { strokes: [{ points: tuplePoints }], recognized: '24/7' }
}));

const js = { engine: 'pri-js-v3', text: 'garbage', lines: [{ text: 'garbage' }], minConf: .99, margin: .9 };
const foundationTimeout = { engine: 'pri-foundation-timeout', failure: 'timeout', text: '', lines: [], minConf: 0, margin: 0 };
const rescueTimeout = { engine: 'native-rescue-timeout', failure: 'timeout', text: '', lines: [], minConf: 0, margin: 0 };
const choice = chooseNativeConsensus([foundationTimeout, js, rescueTimeout]);
assert.equal(choice.disagreement, true);
assert.equal(choice.minConf, .54, 'lone JS must be forced below auto-mark confidence');
assert.equal(choice.candidateReadings.length, 3, 'timed out native engines must remain visible evidence');
assert.match(choice.engine, /pri-foundation-timeout\|pri-js-v3\|native-rescue-timeout/);

console.log('REAL PAGE INK STABILITY: PASS');
