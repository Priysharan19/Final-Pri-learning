// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the answer keys of the structured practice papers, read by the
// real deterministic engine (client/src/engine/checker-core.js).
//
//   1 · every keyed part: the engine accepts the key's own spelling, in the
//       forms a student writes, and refuses a nearby wrong value;
//   2 · the exact keys are exact: a rounded decimal, the neighbouring
//       integer and a lone "2" for 2 − 1/2^51 are all refused;
//   3 · a subscripted name (x0, x_0) is one variable, never x·0;
//   4 · an equation key is the same equation up to a constant multiple.
// The keys themselves are verified by tools/papers/verify/pNN.py; this only
// proves the engine reads them as intended. No answer is ever sent anywhere.
// ─────────────────────────────────────────────────────────────────────────────
import { checks } from './support/app-harness.mjs';
import { checkAnswer } from '../../client/src/engine/checker-core.js';
import { engineQuestion, leafParts, loadStructuredPapers } from '../platform/paperContent.js';
import { PAPERS_DIR } from '../platform/papers.js';

const c = checks();
const docs = loadStructuredPapers(PAPERS_DIR);
c.eq(docs.size, 13, 'all thirteen papers are structured');
const ok = (q, given) => checkAnswer(q, given).correct === true;

// spelling of the key itself, as a student would type it
const spell = key => {
  switch (key.type) {
    case 'numeric': return String(key.value);
    case 'expression': return key.expr.replace(/\*/g, '');
    case 'exact': return `${key.n}/${key.d}`;
    case 'interval': return key.region;
    case 'point': return `(${key.x}, ${key.y})`;
    case 'set': return key.values.join(', ');
    case 'equation': return `${key.lhs} = ${key.rhs}`;
    default: return null;
  }
};
// a nearby wrong answer for each kind
const wrong = key => {
  switch (key.type) {
    case 'numeric': return String(key.value + (Math.abs(key.value) < 1 ? 0.5 : Math.abs(key.value) * 0.1 + 1));
    case 'expression': return `(${key.expr})+1`;
    case 'exact': return `${BigInt(key.n) + 1n}/${key.d}`;
    case 'interval': return 'x > 1000';
    case 'point': return `(${key.x + 1}, ${key.y})`;
    case 'set': return [...key.values.slice(0, -1), key.values[key.values.length - 1] + 1].join(', ');
    case 'equation': return `(${key.lhs}) + 1 = ${key.rhs}`;
    default: return null;
  }
};

let keyed = 0;
const refusedSpelling = [];
for (const doc of docs.values()) {
  for (const leaf of leafParts(doc)) {
    const key = leaf.part.key;
    if (!key || key.type === 'mcq') continue;
    keyed += 1;
    const q = engineQuestion(doc, leaf);
    if (!q) { refusedSpelling.push(`${doc.id} ${leaf.part.id}: no engine question`); continue; }
    const mine = spell(key);
    // an expression key may use * (explicit) where a student would not; try both
    const spellings = [mine, key.type === 'expression' ? key.expr : null, key.type === 'numeric' && leaf.part.answerSuffix ? `${key.value}` : null].filter(Boolean);
    if (!spellings.some(s => ok(q, s))) refusedSpelling.push(`${doc.id} ${leaf.part.id}: the engine refuses its own key (${spellings[0]})`);
    const bad = wrong(key);
    if (ok(q, bad)) refusedSpelling.push(`${doc.id} ${leaf.part.id}: the engine accepts a wrong answer (${bad})`);
    if (ok(q, '')) refusedSpelling.push(`${doc.id} ${leaf.part.id}: a blank is accepted`);
  }
}
c.deq(refusedSpelling, [], `every one of the ${keyed} keyed Section II parts: its own spelling is accepted, a nearby wrong answer and a blank are refused`);
c.ok(keyed >= 150, `at least 150 Section II parts carry a key (${keyed})`);

// ── Exact keys ───────────────────────────────────────────────────────────────
const p13 = docs.get('ext1-2027-p13');
const find = (doc, id) => leafParts(doc).find(l => l.part.id === id);
const e1 = engineQuestion(p13, find(p13, 'q12c-i'));
c.deq(['2-1/2^51', '(2^52-1)/2^51', '2 - 1/2^51'].map(g => ok(e1, g)), [true, true, true], '2 − 1/2^51 is accepted in its written forms');
c.deq(['2', '1.9999999999999996', '2-1/2^50', '1.99999999999999955591'].map(g => ok(e1, g)), [false, false, false, false], 'and "2", its float neighbour and 2 − 1/2^50 are refused');
const e2 = engineQuestion(p13, find(p13, 'q12c-ii'));
c.deq(['26235/2^104', '26235/20282409603651670423947251286016', '(26235)/(2^104)', 'C(55,3)/4^52'].map(g => ok(e2, g)), [true, true, true, false], 'the Paper 13 probability near 1.3e-27: the exact fraction (and its power form) is accepted');
c.deq(['0', '1.3e-27', '1.2935e-27', '26235/2^103', '26236/2^104', '1/2^104'].map(g => ok(e2, g)), [false, false, false, false, false, false], 'and zero, rounded decimals and a neighbouring fraction are refused: no float band');

// ── Subscripted names, equations ─────────────────────────────────────────────
const names = { answerType: 'expression', answer: { expr: '2*w+1', names: { x0: 'w' } } };
c.deq(['2x0+1', '2x_0+1', '2*x_{0}+1', '2x₀+1'].map(g => ok(names, g)), [true, true, true, true], 'x0, x_0, x_{0} and x₀ are one variable');
c.deq(['2x+1', '1', '2*0+1'].map(g => ok(names, g)), [false, false, false], 'x0 is not x times 0, and x is not x0');
const circle = { answerType: 'equation', answer: { lhs: 'x^2+y^2', rhs: '25' } };
c.deq(['x^2+y^2=25', '25=x^2+y^2', '2x^2+2y^2=50', 'x^2+y^2-25=0'].map(g => ok(circle, g)), [true, true, true, true], 'an equation: any equivalent arrangement or multiple');
c.deq(['x^2+y^2=26', 'y=3', 'x^2+y^2', 'x^2-y^2=25'].map(g => ok(circle, g)), [false, false, false, false], 'a different equation, a non-equation and a sign slip are refused');

// ── Given objects for a line-by-line checker ─────────────────────────────────
let withGivens = 0;
for (const doc of docs.values()) for (const leaf of leafParts(doc)) { const q = engineQuestion(doc, leaf); if (q?.givens?.length) withGivens += 1; }
c.ok(withGivens >= 20, `${withGivens} keyed parts carry the function definitions and equations their question gives`);

console.log(`PAPER KEYS: PASS — ${c.count()}/${c.count()} checks [${keyed} keyed Section II parts, 13 papers]`);
