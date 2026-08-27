import assert from 'node:assert/strict';

import {
  inferTrigContextFromPrompt,
  repairTrigNotationResult,
  trigReadingCompatibility
} from '../src/ink/trigNotation.js';
import { chooseNativeConsensus } from '../src/ink/nativeConsensus.js';

const ctx = inferTrigContextFromPrompt(
  'Given cos θ = 60/61 with θ acute, use a double-angle formula to find cos 2θ as a fraction in simplest form.',
  ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '=', '/', 'theta']
);
assert.equal(ctx?.trigNotation, true);
assert.ok(ctx.alphabet.includes('sin'));
assert.ok(ctx.alphabet.includes('cos'));
assert.ok(ctx.alphabet.includes('tan'));

function symbol(sym, id, conf = 0.82, alts = []) {
  return { sym, id, conf, alts, strokeIdxs: [Number(id.replace(/\D/g, '')) || 0] };
}

function glyphLine(tokens, text, y, h = 22, conf = 0.82) {
  return {
    text,
    box: { x: 20, y, w: 280, h },
    symbols: tokens.map((token, i) => symbol(token, `s${y}_${i}`, conf))
  };
}

const twinReading = {
  engine: 'pri-js-v3',
  minConf: 0.81,
  margin: 0.23,
  lines: [
    glyphLine(['c', '0', '5', 'theta', '=', '6', '0', '/', '6', '1'], 'c05theta=60/61', 10),
    glyphLine(['5', 'i', 'u', 'theta', '=', '1', '1', '/', '6', '1'], '5iutheta=11/61', 50),
    glyphLine(['=', '5', '0', '5', '/', '6', '1', '1'], '=505/611', 90)
  ],
  text: 'c05theta=60/61\n5iutheta=11/61\n=505/611'
};

const repaired = repairTrigNotationResult(twinReading, ctx);
assert.equal(repaired.lines[0].text, 'costheta=60/61');
assert.equal(repaired.lines[1].text, 'sintheta=11/61');
assert.equal(repaired.lines[0].symbols.slice(0, 3).map(s => s.sym).join(''), 'cos');
assert.equal(repaired.lines[1].symbols.slice(0, 3).map(s => s.sym).join(''), 'sin');
assert.equal(repaired.lines[2].text, '=505/611', 'numeric identity outside a trig-word slot must not change');
assert.equal(repaired.trigContextRepair, 'answer-blind-trig-notation-v1');
assert.ok(trigReadingCompatibility(repaired, ctx).bonus > 0);

function textLine(text, y, h = 22, conf = 0.82) {
  const chars = [...text.replace(/theta/g, 'θ')];
  return {
    text,
    box: { x: 20, y, w: Math.max(80, chars.length * 10), h },
    symbols: chars.map((ch, i) => symbol(ch, `t${y}_${i}`, conf))
  };
}

const foundation = {
  engine: 'pri-foundation-debug', minConf: 0.68, margin: 0.18,
  lines: [
    glyphLine(['c', '0', '5', 'theta', '=', '6', '0', '/', '6', '1'], 'c05theta=60/61', 10),
    textLine('pi/6011', 58, 92, 0.61), // triangle + side labels, not a written equation
    glyphLine(['5', 'i', 'u', 'theta', '=', '1', '1', '/', '6', '1'], '5iutheta=11/61', 150),
    textLine('cos2theta=cos^(2)theta-sin^(2)theta', 210, 25, 0.77),
    textLine('=3479/3721', 270, 24, 0.74)
  ]
};
foundation.text = foundation.lines.map(l => l.text).join('\n');

const js = {
  engine: 'pri-js-v3', minConf: 0.79, margin: 0.22,
  lines: [
    textLine('costheta=60/61', 12, 22, 0.84),
    textLine('sintheta=11/61', 151, 22, 0.81),
    textLine('c057theta==7%-6012r/2', 211, 25, 0.83),
    textLine('=34729/372', 271, 24, 0.80)
  ]
};
js.text = js.lines.map(l => l.text).join('\n');

const native = {
  engine: 'native-rescue+line-stroke-fusion', minConf: 0.72, margin: 0.20,
  lines: [
    textLine('costheta=60/61', 11, 23, 0.79),
    textLine('sintheta=11/61', 149, 23, 0.78),
    textLine('cos2theta=cos^(2)theta-sin^(2)theta', 209, 25, 0.76),
    textLine('=3479/3721', 269, 24, 0.75)
  ]
};
native.text = native.lines.map(l => l.text).join('\n');

const fused = chooseNativeConsensus([foundation, js, native], ctx);
assert.ok(fused, 'expected a fused reading');
assert.equal(fused.disagreement, false, fused.engine);
assert.match(fused.engine, /^pri-(?:line-)?consensus:/);
assert.ok(!fused.lines.some(line => /pi\/6011|π\/6011/.test(line.text)), 'triangle/labels must not survive as a text row');
assert.deepEqual(
  fused.lines.map(line => line.text),
  [
    'costheta=60/61',
    'sintheta=11/61',
    'cos2theta=cos^(2)theta-sin^(2)theta',
    '=3479/3721'
  ]
);

// When a final numeric line genuinely has no agreement, the grammar may not
// calculate or invent the answer. It must preserve one observed candidate and
// keep the confirmation gate active.
const a = {
  engine: 'pri-foundation-debug', minConf: 0.7, margin: 0.2,
  lines: [textLine('costheta=60/61', 10), textLine('=3479/3721', 80)]
};
a.text = a.lines.map(l => l.text).join('\n');
const b = {
  engine: 'pri-js-v3', minConf: 0.8, margin: 0.2,
  lines: [textLine('costheta=60/61', 10), textLine('=34729/372', 80)]
};
b.text = b.lines.map(l => l.text).join('\n');
const c = {
  engine: 'native-rescue', minConf: 0.72, margin: 0.18,
  lines: [textLine('costheta=60/61', 10), textLine('=3479/372', 80)]
};
c.text = c.lines.map(l => l.text).join('\n');
const uncertain = chooseNativeConsensus([a, b, c], ctx);
assert.equal(uncertain.disagreement, true);
assert.ok(['=3479/3721', '=34729/372', '=3479/372'].includes(uncertain.lines.at(-1).text));
assert.ok(uncertain.minConf <= 0.54);
assert.ok(uncertain.margin <= 0.08);

console.log('Pri Ink V18 real-page trig context/line-consensus regression: PASS');
