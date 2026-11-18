// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · nothing a student receives before Submit tells the right option
// from a wrong one, and nothing that is not an answer earns a mark
//
//   1 · every option diagram is named by its question and letter only (the author's
//       macro names ended "opt", "wra", "wrb", "wrc"), in the converter's output,
//       in the public paper, and the server refuses any other name;
//   2 · across all 130 multiple-choice items, the keyed option's PUBLIC fields differ
//       from the others only in content: the same fields, the same block kinds, no
//       id, name, class or alt text of its own; the key letters are spread over A to D
//       and the keyed option is not systematically first;
//   3 · the client puts no alt text or label on an option that says which is right;
//   4 · for every keyed part of every paper, an empty answer, whitespace and garbage
//       earn nothing; for multiple choice the sweep covers words starting A to D,
//       two letters, lower case and "(c)": only one clean letter is an answer.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { checks } from './support/app-harness.mjs';
import { checkAnswer } from '../../client/src/engine/checker-core.js';
import { engineQuestion, givenFor, leafParts, loadStructuredPapers, publicPaper, validateStructured } from '../platform/paperContent.js';
import { PAPERS_DIR } from '../platform/papers.js';

const c = checks();
const docs = loadStructuredPapers(PAPERS_DIR);
const mcqOf = doc => doc.sections[0].questions.map(q => q.parts[0]);

// ── 1 · neutral figure names ─────────────────────────────────────────────────
let figureOptions = 0;
for (const doc of docs.values()) {
  const pub = publicPaper(doc);
  for (const part of mcqOf(pub.sections[0] ? { sections: [pub.sections[0]] } : doc)) {
    for (const o of part.options) {
      for (const b of o.blocks.filter(x => x.k === 'fig')) {
        figureOptions += 1;
        if (b.name !== `fig${part.id.replace(/^q/, 'Q')}Opt${o.label}`) c.ok(false, `${doc.id} ${part.id} ${o.label}: option diagram is named ${b.name}`);
      }
    }
  }
  const hit = JSON.stringify(pub).match(/fig[A-Za-z0-9]*(?:opt|wra|wrb|wrc)(?![A-Za-z])/);
  c.ok(!hit, `${doc.id}: no public figure name ends in opt, wra, wrb or wrc (${hit?.[0] ?? ''})`);
}
c.ok(figureOptions >= 48, `${figureOptions} option diagrams, every one neutrally named`);
const bad = structuredClone(docs.get('ext1-2027-p09'));
bad.sections[0].questions[1].parts[0].options[1].blocks[0].name = 'figpfunctionsparametriccurvegraphsjefjjbebopt';
let refused = false;
try { validateStructured(bad); } catch (e) { refused = /diagram name/.test(e.message); }
c.ok(refused, 'the server refuses a paper whose option diagram carries any other name');
for (const doc of docs.values()) for (const part of mcqOf(doc)) {
  for (const o of part.options) for (const b of o.blocks.filter(x => x.k === 'fig')) {
    c.ok(readFileSync(new URL(`../content/papers/nsw-ext1/figures/${doc.id}/${b.name}.svg`, import.meta.url), 'utf8').startsWith('<svg'), `${doc.id} ${part.id} ${o.label}: its diagram file exists under the neutral name`);
  }
}

// ── 2 · the keyed option is indistinguishable by anything but content ───────
const shape = o => JSON.stringify({ keys: Object.keys(o).sort(), blocks: o.blocks.map(b => [b.k, Object.keys(b).sort()]) });
let items = 0;
const keyLetters = { A: 0, B: 0, C: 0, D: 0 };
const keyedShapes = {}; const otherShapes = {};
for (const doc of docs.values()) {
  const pubQs = publicPaper(doc).sections[0].questions;
  doc.sections[0].questions.forEach((q, i) => {
    const part = q.parts[0];
    const pubPart = pubQs[i].parts[0];
    items += 1; keyLetters[part.key.answer] += 1;
    c.deq(pubPart.options.map(o => o.label), ['A', 'B', 'C', 'D'], `${doc.id} ${part.id}: options are A, B, C, D in order`);
    c.ok(pubPart.options.every(o => Object.keys(o).sort().join() === 'blocks,label'), `${doc.id} ${part.id}: an option has only a label and its content`);
    c.ok(!('key' in pubPart) && !('correct' in pubPart), `${doc.id} ${part.id}: no key field`);
    pubPart.options.forEach(o => {
      const s = shape(o);
      const bucket = o.label === part.key.answer ? keyedShapes : otherShapes;
      bucket[s] = (bucket[s] || 0) + 1;
    });
  });
}
c.eq(items, 130, 'all 130 multiple-choice items are held to this');
c.deq(Object.keys(keyedShapes).sort(), Object.keys(otherShapes).sort(), 'the keyed option has no shape (fields, block kinds) that a wrong option never has');
for (const s of Object.keys(keyedShapes)) {
  const k = keyedShapes[s] / items, o = (otherShapes[s] || 0) / (3 * items);
  c.ok(Math.abs(k - o) < 0.12, `shape ${s.slice(0, 40)}: the keyed share (${k.toFixed(2)}) is the others' share (${o.toFixed(2)}) within sampling noise`);
}
for (const [letter, n] of Object.entries(keyLetters)) c.ok(n / items > 0.15 && n / items < 0.35, `key letter ${letter} is ${n} of ${items}: the key is spread over A to D`);
const first = keyLetters.A / items;
c.ok(first < 0.35, `the keyed option is first (A) in ${(first * 100).toFixed(0)}% of items: not systematically first`);
// the keyed option is not longer or shorter in a way that gives it away
let longer = 0, counted = 0;
for (const doc of docs.values()) for (const part of mcqOf(doc)) {
  const lens = part.options.map(o => JSON.stringify(o.blocks).length);
  if (new Set(lens).size === 1) continue;
  counted += 1;
  if (lens['ABCD'.indexOf(part.key.answer)] === Math.max(...lens)) longer += 1;
}
c.ok(counted === 0 || longer / counted < 0.5, `the keyed option is the longest in ${longer} of ${counted} items with unequal lengths: not a giveaway (below one half)`);

// ── 3 · nothing on an option's markup names the right one ───────────────────
const answerJsx = readFileSync(new URL('../../client/src/paper/PaperAnswer.jsx', import.meta.url), 'utf8');
const choice = answerJsx.slice(answerJsx.indexOf('export function PaperChoice'), answerJsx.indexOf('// ── Write and Photo'));
c.ok(!/\balt=|correct|isKey|answer/i.test(choice.replace(/value\?\.text|part\.options|answerType/g, '')), 'PaperChoice puts no alt text or "correct" on an option');
c.ok(/aria-label=\{o\.blocks\.some\(b => b\.k === 'fig'\) \? t\('paper\.option', \{ letter: o\.label \}\) : undefined\}/.test(choice), 'a diagram option is labelled by its letter only');
const blocksJsx = readFileSync(new URL('../../client/src/paper/PaperBlocks.jsx', import.meta.url), 'utf8');
c.ok(!/alt=\{(?!t\()/.test(blocksJsx) || /alt=""/.test(blocksJsx) || !/alt=/.test(blocksJsx), 'a diagram carries no descriptive alt text taken from the content');

// ── 4 · what is not an answer earns nothing ─────────────────────────────────
const SWEEP = ['', ' ', '   ', '\n', 'Banana', 'Apple', 'Cat', 'Dog', 'AB', 'A B', 'ab', 'abcd', 'a', 'b', 'c', 'd', '(c)', '(C)', 'C.', 'E', 'AA', '0', '1', 'None', 'A)B'];
const CLEAN = { A: '0', B: '1', C: '2', D: '3', a: '0', b: '1', c: '2', d: '3', '(a)': '0', '(B)': '1', 'c.': '2', ' D ': '3', '(c)': '2', '(C)': '2', 'C.': '2' };
const mcqPart = { key: { type: 'mcq' } };
for (const [t, want] of Object.entries(CLEAN)) c.eq(givenFor(mcqPart, t), want, `multiple choice: ${JSON.stringify(t)} is one letter`);
const NOT_AN_ANSWER = SWEEP.filter(t => !/^\(?[abcd]\)?\.?$/i.test(t.trim()));
for (const t of NOT_AN_ANSWER) c.eq(givenFor(mcqPart, t), '', `multiple choice: ${JSON.stringify(t)} is not an answer`);
let parts = 0;
const earned = [];
for (const doc of docs.values()) for (const leaf of leafParts(doc)) {
  const key = leaf.part.key;
  if (!key) continue;
  parts += 1;
  const q = engineQuestion(doc, leaf);
  const nonsense = key.type === 'mcq' ? NOT_AN_ANSWER : ['', ' ', '\n', 'banana', 'qwerty ??', '!!!', '0/0', '()', 'x', '999999999', '-', ',', 'A', 'sqrt(', '1e999999'];
  for (const t of nonsense) {
    let r; try { r = checkAnswer(q, givenFor(leaf.part, t)); } catch { r = { correct: false }; }
    if (r.correct === true) earned.push(`${doc.id} ${leaf.part.id} ${key.type}: ${JSON.stringify(t)} earned a mark`);
  }
}
c.deq(earned, [], `for each of ${parts} keyed parts in 13 papers, an empty, blank or garbage answer earns nothing`);
console.log(`PAPER SECRECY: PASS — ${c.count()}/${c.count()} checks`);
