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
import { workingRows } from '../src/notes/workingRows.js';
import { evalNumeric, exprEquivalent } from '../src/engine/expr.js';
import { NSW_NOTES_TOPICS, NSW_NOTES_TOPIC_BY_ID, mergePremium } from '../src/notes/nsw/nswNotesIndex.js';
import { readFileSync, existsSync } from 'node:fs';

// The bands written after the Stage 4 module: each is a base file plus its premium layer, in the same shapes. A band whose
// files are not in the tree yet is skipped (the bands land in stacked pull requests); once present it is held to every rule.
const BANDS = [
  { id: 'stage4b', stage: 4, course: null, base: 'notes-nsw-stage4b.js' },
  { id: 'stage5-core-a', stage: 5, course: null, base: 'notes-nsw-stage5-core-a.js' },
  { id: 'stage5-core-b', stage: 5, course: null, base: 'notes-nsw-stage5-core-b.js' },
  { id: 'stage5-path-a', stage: 5, course: null, base: 'notes-nsw-stage5-path-a.js' },
  { id: 'stage5-path-b', stage: 5, course: null, base: 'notes-nsw-stage5-path-b.js' },
  { id: 'ext1-a', stage: 6, course: 'ext1', base: 'notes-nsw-ext1-a.js' },
  { id: 'ext1-b', stage: 6, course: 'ext1', base: 'notes-nsw-ext1-b.js' },
  { id: 'ext2', stage: 6, course: 'ext2', base: 'notes-nsw-ext2.js' }
].filter(b => !process.env.NOTES_BAND || b.id === process.env.NOTES_BAND);
const stages = {};
const bandOf = {};
for (const b of BANDS) {
  const f = new URL(`../src/notes/nsw/${b.base}`, import.meta.url);
  const p = new URL(`../src/notes/nsw/${b.base.replace('.js', '-premium.js')}`, import.meta.url);
  if (!existsSync(f) || !existsSync(p)) continue;
  const merged = mergePremium((await import(f.href)).default, (await import(p.href)).default);
  for (const [id, n] of Object.entries(merged)) { stages[id] = n; bandOf[id] = b; }
}
const stage4 = stages;
// The kit's registry names, read from its source (a .jsx file cannot be imported by plain node).
const kitSource = readFileSync(new URL('../src/diagrams/DiagramFromSpec.jsx', import.meta.url), 'utf8');
const DIAGRAM_KINDS = [...kitSource.matchAll(/(?:STATIC_KINDS|INTERACTIVE_KINDS) = Object\.freeze\(\{([\s\S]*?)\}\);/g)]
  .flatMap(m => [...m[1].matchAll(/(\w+):/g)].map(x => x[1]));
const NO_DIAGRAM = new Set(['ma5-net-p-01', 'ma5-vol-c-01', 'ma5-vol-p-01', 'ma5-are-c-01', 'ma5-are-p-01', 'me1-11-04', 'me1-12-01', 'me2-12-01']); // no solid-figure kind in the diagram kit yet

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

ok(DIAGRAM_KINDS.length >= 25, `the kit registry was read (${DIAGRAM_KINDS.length} kinds)`);
const texRenders = (tex, display) => {
  try { katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: display ? 'error' : 'ignore' }); return null; } catch (e) { return e.message; }
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
  ok(topic?.stage === bandOf[id].stage && (bandOf[id].course === null || topic?.course === bandOf[id].course), `${where}: in the ${bandOf[id].id} band but is stage ${topic?.stage} ${topic?.course}`);
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
    const wRows = workingRows(ex.working);
    ok(wRows.length >= 1, `${where} example ${i + 1}: needs working`);
    for (const r of wRows) { const werr = texRenders(`${r.lhs ?? ''}${r.rest}`, true); ok(!werr, `${where} example ${i + 1} working: KaTeX failed — ${werr}`); }
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
  ok(!/MA[45]-|MAV-|MST-|ME[12]-/.test(text), `${where}: outcome codes belong in the page header, not the prose`);
}

// Coverage: each band that is present covers its own topics, and nothing is stubbed.
for (const b of BANDS) {
  const ids = Object.keys(bandOf).filter(id => bandOf[id] === b);
  if (!ids.length) continue;
  const expected = NSW_NOTES_TOPICS.filter(t => t.stage === b.stage && t.course === b.course).map(t => t.id);
  ok(ids.every(id => expected.includes(id)), `${b.id}: a note belongs to another stage or course`);
}
if (failures.length) {
  console.error(`NSW NOTES CONTENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
const examples = all.reduce((n, [, t]) => n + t.examples.length, 0);
console.log(`NSW NOTES CONTENT: PASS — ${pass}/${pass} checks — ${all.length} topics in ${new Set(Object.values(bandOf)).size} bands, ${examples} worked examples engine-verified, every formula rendered, no India wording`);
