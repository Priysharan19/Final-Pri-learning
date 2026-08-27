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
assert.match(ink, /strokes\.length > 24 \? 1600 : 1000/, 'native real pages need a quiet recognition window');
assert.match(native, /pri-foundation.*timeout/s, 'foundation timeout must remain visible evidence');
assert.match(native, /native-rescue.*timeout/s, 'native rescue timeout must remain visible evidence');
assert.match(bridge, /strokeRevision/, 'native queue must invalidate stale page jobs');
assert.match(bridge, /pri-foundation-stale/, 'stale Foundation jobs must answer without doing expensive work');
assert.doesNotMatch(bridge, /let rescue = self\.recognizer\.readWithGlyphConsensus[\s\S]{0,300}native-rescue-debug/, 'Foundation DEBUG path must not secretly run rescue twice');

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
