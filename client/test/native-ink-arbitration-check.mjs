import assert from 'node:assert/strict';
import { chooseNativeConsensus } from '../src/ink/nativeConsensus.js';

const line = text => [{ text, symbols: [] }];
const r = (engine, text, minConf, margin) => ({ engine, text, lines: line(text), minConf, margin });

// Two independent engines agreeing is the only fast native acceptance path.
{
  const out = chooseNativeConsensus([
    r('pri-foundation-debug', 'x=3', 0.72, 0.18),
    r('pri-js-v3', 'x=3', 0.91, 0.24)
  ]);
  assert.equal(out.disagreement, false);
  assert.match(out.engine, /^pri-consensus:/);
  assert.equal(out.text, 'x=3');
}

// Real-Pencil regression: high self-confidence from JS V3 must not beat a
// reasonable native rescue reading on a complex multi-line page.
{
  const jsGarbage = r('pri-js-v3', '05theta=63/65\n1--c(cos(6)3^2)/(65)', 0.97, 0.32);
  const native = r('native-rescue+line-stroke-fusion', 'cos(theta)=63/65\nsin(theta)=16/65', 0.73, 0.16);
  const out = chooseNativeConsensus([jsGarbage, native]);
  assert.match(out.engine, /->native-rescue\+line-stroke-fusion$/);
  assert.equal(out.text, native.text);
  assert.equal(out.disagreement, true);
  assert.ok(out.minConf <= 0.54);
  assert.ok(out.margin <= 0.08);
}

// A lone JS reading on native may be displayed for correction, never trusted.
{
  const out = chooseNativeConsensus([r('pri-js-v3', 'garbage=22%', 0.99, 0.40)]);
  assert.equal(out.disagreement, true);
  assert.ok(out.minConf <= 0.54);
  assert.ok(out.margin <= 0.08);
}

// If Foundation and native independently agree, their consensus beats JS.
{
  const out = chooseNativeConsensus([
    r('pri-foundation-debug', 'sin(theta)=16/65', 0.66, 0.12),
    r('native-rescue+line-stroke-fusion', 'sin(theta)=16/65', 0.70, 0.14),
    r('pri-js-v3', '7ln(theta)=16b95', 0.98, 0.30)
  ]);
  assert.equal(out.disagreement, false);
  assert.equal(out.text, 'sin(theta)=16/65');
  assert.match(out.engine, /^pri-consensus:/);
}

// Two out-of-domain calculus readers must not outvote one set-capable reader.
{
  const setCtx = { answerType: 'set', setNotation: true, setElementKind: 'integer', setIdentifiers: ['A', 'B'] };
  const foundationLeak = r('pri-foundation-debug', "y'=6x=6x+6x-6x-180", 0.91, 0.25);
  const nativeLeak = r('native-rescue+line-stroke-fusion', "y'=dx=6x^6-6x-180", 0.84, 0.18);
  const setVote = r('pri-js-v3', 'A∪B={1,2,3,4,5,6,7,8,12}', 0.64, 0.10);
  const out = chooseNativeConsensus([foundationLeak, nativeLeak, setVote], setCtx);
  assert.equal(out.text, setVote.text);
  assert.equal(out.disagreement, true);
  assert.ok(out.minConf <= 0.54);
  assert.ok(out.candidateReadings.some(x => x.contextReason === 'set-context-calculus-leak'));
}

// Arbitration must remain answer-blind.
{
  const source = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/ink/nativeConsensus.js', import.meta.url), 'utf8'));
  assert.ok(!/ctx\.expected|expectedAnswer|answerText|markScheme/.test(source), 'native arbitration must not inspect expected-answer data');
}

console.log('NATIVE INK ARBITRATION — PASS');
