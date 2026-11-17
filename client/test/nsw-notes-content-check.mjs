// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the NSW notes are mathematics, held to the same bar as the
// India notes (client/test/notes-content-check.mjs), plus NSW rules:
//   1. every topic with notes has the full shape (summary, ≥3 ideas, ≥2
//      definitions, ≥1 formula, ≥4 points, ≥2 mistakes, ≥2 worked examples);
//   2. every piece of TeX renders in KaTeX with throwOnError ON;
//   3. every worked example's answer is re-derived by the deterministic engine,
//      never by the author's say-so;
//   4. every topic id is a real focus area of the NSW curriculum model, and every
//      prerequisite is a real topic;
//   5. no India curriculum word, unit or institution appears anywhere in a note
//      (NCERT, CBSE, JEE, Class N, rupees, lakh/crore), and the spelling is en-AU;
//   6. the coverage: at least 14 of the 16 Stage 4 focus areas have notes (a
//      floor that is only ever raised), and the others are honestly absent, not
//      stubbed.
// ─────────────────────────────────────────────────────────────────────────────
import katex from 'katex';
import { evalNumeric, exprEquivalent } from '../src/engine/expr.js';
import { NSW_NOTES_TOPICS, NSW_NOTES_TOPIC_BY_ID, mergePremium } from '../src/notes/nsw/nswNotesIndex.js';
import base4 from '../src/notes/nsw/notes-nsw-stage4.js';
import premium4 from '../src/notes/nsw/notes-nsw-stage4-premium.js';
import { readFileSync } from 'node:fs';

const stage4 = mergePremium(base4, premium4);
// The kit's registry names, read from its source (a .jsx file cannot be imported by plain node).
const kitSource = readFileSync(new URL('../src/diagrams/DiagramFromSpec.jsx', import.meta.url), 'utf8');
const DIAGRAM_KINDS = [...kitSource.matchAll(/(?:STATIC_KINDS|INTERACTIVE_KINDS) = Object\.freeze\(\{([\s\S]*?)\}\);/g)]
  .flatMap(m => [...m[1].matchAll(/(\w+):/g)].map(x => x[1]));
const NO_DIAGRAM = new Set(['ma4-vol-c-01']); // no solid-figure kind in the diagram kit yet

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

ok(DIAGRAM_KINDS.length >= 25, `the kit registry was read (${DIAGRAM_KINDS.length} kinds)`);
const texRenders = (tex, display) => {
  try { katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: 'ignore' }); return null; } catch (e) { return e.message; }
};
function spansOf(text) {
  const out = [];
  String(text ?? '').split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g).forEach((p, i) => { if (i % 2) out.push(p); });
  const dollars = (String(text ?? '').match(/(?<!\\)\$/g) || []).length;
  return { spans: out, balanced: dollars % 2 === 0 };
}
function checkProse(text, where) {
  ok(typeof text === 'string' && text.trim().length > 0, `${where}: empty text`);
  const { spans, balanced } = spansOf(text);
  ok(balanced, `${where}: unbalanced $`);
  for (const s of spans) { const err = texRenders(s, false); ok(!err, `${where}: KaTeX failed on $${s}$ — ${err}`); }
}

const close = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
function verifyExample(v) {
  if (!v || typeof v !== 'object') return 'no verify block';
  const x = v.var || 'x';
  try {
    switch (v.kind) {
      case 'value': { const a = evalNumeric(v.expr); const b = evalNumeric(v.answer); return close(a, b) ? null : `engine computes ${a}, note says ${b}`; }
      case 'values': {
        for (const [e, ans] of v.pairs) { const a = evalNumeric(e); const b = evalNumeric(ans); if (!close(a, b)) return `engine computes ${e} = ${a}, note says ${b}`; }
        return null;
      }
      case 'roots': {
        for (const r of v.answers) { const val = evalNumeric(v.f, { [x]: evalNumeric(r) }); if (!close(val, 0, 1e-7)) return `f(${r}) = ${val}, not 0`; }
        return null;
      }
      case 'equivalent': return exprEquivalent(v.a, v.b) ? null : `${v.a} is not equivalent to ${v.b}`;
      default: return `unknown verify kind ${v.kind}`;
    }
  } catch (e) { return `engine error: ${e.message}`; }
}

const INDIA = /NCERT|CBSE|\bJEE\b|\bClass\s*\d|\bIndian?\b|rupee|₹|\bRs\.?\s*\d|lakh|crore|\bIIT\b|\bboard exam/i;
// en-AU: a few spellings that differ from en-US in maths writing.
const NOT_AU = /\b(meter|meters|liter|liters|center|color|favorite|gray|neighbor)s?\b/i;

const all = Object.entries(stage4);
for (const [id, n] of all) {
  const where = `topic ${id}`;
  const topic = NSW_NOTES_TOPIC_BY_ID[id];
  ok(!!topic, `${where}: not a focus area of the NSW curriculum model`);
  ok(topic?.stage === 4, `${where}: the stage 4 module holds a stage ${topic?.stage} topic`);
  checkProse(n.summary, `${where} summary`);
  ok(Array.isArray(n.prereqs) && n.prereqs.every(p => NSW_NOTES_TOPIC_BY_ID[p]), `${where}: a prerequisite is not a topic`);
  ok(n.concepts?.length >= 3, `${where}: needs at least 3 ideas`);
  ok(n.definitions?.length >= 2, `${where}: needs at least 2 definitions`);
  ok(n.formulas?.length >= 1, `${where}: needs a formula`);
  ok(n.points?.length >= 4, `${where}: needs at least 4 important points`);
  ok(n.mistakes?.length >= 2, `${where}: needs at least 2 common mistakes`);
  ok(n.examples?.length >= 2, `${where}: needs at least 2 worked examples`);
  n.concepts.forEach((c, i) => { checkProse(c.title, `${where} idea ${i} title`); checkProse(c.body, `${where} idea ${i}`); });
  n.definitions.forEach((d, i) => { checkProse(d.term, `${where} definition ${i} term`); checkProse(d.meaning, `${where} definition ${i}`); });
  n.formulas.forEach((f, i) => { checkProse(f.label, `${where} formula ${i} label`); const err = texRenders(f.tex, true); ok(!err, `${where} formula ${i}: KaTeX failed — ${err}`); });
  n.points.forEach((p, i) => { checkProse(p.front, `${where} point ${i} front`); checkProse(p.back, `${where} point ${i} back`); });
  n.mistakes.forEach((m, i) => { checkProse(m.wrong, `${where} mistake ${i} wrong`); checkProse(m.right, `${where} mistake ${i} right`); });
  n.examples.forEach((ex, i) => {
    const w = `${where} example ${i + 1}`;
    checkProse(ex.question, `${w} question`);
    ok(Array.isArray(ex.steps) && ex.steps.length >= 2, `${w}: needs at least 2 steps`);
    (ex.steps || []).forEach((s, j) => checkProse(s, `${w} step ${j + 1}`));
    checkProse(ex.answer, `${w} answer`);
    const why = verifyExample(ex.verify);
    ok(why === null, `${w}: the engine disagrees — ${why}`);
  });
  // The premium layer: the same section order on every chapter.
  ok(n.examiners?.length >= 3, `${where}: needs at least 3 things examiners look for`);
  (n.examiners || []).forEach((e, i) => checkProse(e, `${where} examiners ${i}`));
  ok(n.check?.length >= 2, `${where}: needs at least 2 self-check questions`);
  (n.check || []).forEach((c, i) => {
    checkProse(c.question, `${where} check ${i} question`); checkProse(c.answer, `${where} check ${i} answer`);
    const why = verifyExample(c.verify); ok(why === null, `${where} check ${i}: the engine disagrees — ${why}`);
  });
  n.examples.forEach((ex, i) => {
    ok(typeof ex.working === 'string' && /\\begin\{aligned\}/.test(ex.working), `${where} example ${i + 1}: needs aligned working`);
    const err = texRenders(ex.working || '', true); ok(!err, `${where} example ${i + 1} working: KaTeX failed — ${err}`);
  });
  if (!NO_DIAGRAM.has(id)) ok(n.diagrams?.length >= 1, `${where}: needs a diagram`);
  (n.diagrams || []).forEach((d, i) => {
    ok(DIAGRAM_KINDS.includes(d.spec?.kind), `${where} diagram ${i}: unknown kind ${d.spec?.kind}`);
    if (d.title) checkProse(d.title, `${where} diagram ${i} title`);
    if (d.note) checkProse(d.note, `${where} diagram ${i} note`);
  });
  const text = JSON.stringify(n);
  // Formatting rules: maths is KaTeX, never Unicode super/subscripts; no emoji or glyph ticks; no filler.
  ok(!/[\u00B2\u00B3\u00B9\u2070-\u209F]/.test(text), `${where}: a Unicode superscript or subscript (use KaTeX)`);
  ok(!/[\u2713\u2714\u2715\u2716\u2717\u2718\u2705\u274C\u2728]|\p{Extended_Pictographic}/u.test(text), `${where}: an emoji or glyph tick (use the stroke icons)`);
  ok(!/let['\u2019]s dive|in this section we|in this chapter we|welcome to|\bsimply\b|\bobviously\b/i.test(text), `${where}: filler phrasing`);
  ok(!INDIA.test(text), `${where}: India curriculum wording found (${(text.match(INDIA) || [])[0]})`);
  ok(!NOT_AU.test(text), `${where}: non-Australian spelling (${(text.match(NOT_AU) || [])[0]})`);
  ok(!/official NESA|NESA (?:publication|material)|syllabus (?:states|says|requires)/i.test(text), `${where}: claims an official NESA source`);
  ok(!/MA4-|MAV-|MST-|ME[12]-/.test(text), `${where}: outcome codes belong in the page header, not the prose`);
}

// Coverage: a floor that is only ever raised.
const stage4Topics = NSW_NOTES_TOPICS.filter(t => t.stage === 4);
const covered = stage4Topics.filter(t => Object.hasOwn(stage4, t.id));
ok(stage4Topics.length === 16, 'the model lists 16 Stage 4 focus areas');
ok(covered.length >= 14, `at least 14 of 16 Stage 4 focus areas have notes (${covered.length})`);
ok(Object.keys(stage4).every(id => stage4Topics.some(t => t.id === id)), 'every note belongs to a Stage 4 focus area');

if (failures.length) {
  console.error(`NSW NOTES CONTENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
const examples = all.reduce((n, [, t]) => n + t.examples.length, 0);
console.log(`NSW NOTES CONTENT: PASS — ${pass}/${pass} checks — ${all.length} Stage 4 topics, ${examples} worked examples engine-verified, every formula rendered, no India wording`);
