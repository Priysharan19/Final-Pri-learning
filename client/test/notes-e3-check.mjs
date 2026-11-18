// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Experience 3 layer of the notes (both editions), and the
// Olympiad notes. docs/design/notes-e3-contract.md is the contract.
//   1. every layer entry names a real chapter of its band, with only layer fields;
//   2. objective and intuition are present, plain prose, and every $…$ renders in KaTeX;
//   3. every checkpoint answer is re-derived by the deterministic engine;
//   4. every diagram spec is a known kind and passes its kind's validator (pack kinds
//      also build their pure model without throwing or producing NaN);
//   5. no mathematics outside $…$, no machine tells ("1x", "+(-3)"), no filler phrases;
//   6. NSW layers: en-AU and no India words; Priyabhata layers: no NSW words.
// Run one band: NOTES_E3_BAND=class10 | olympiad | nsw-advanced …
// ─────────────────────────────────────────────────────────────────────────────
import katex from 'katex';
import { evalNumeric, exprEquivalent } from '../src/engine/expr.js';
import { validateSpec, packKind, INTERACTIVE_KIND_NAMES } from '../src/diagrams/kinds.js';
import { functionGraphModel } from '../src/diagrams/geometry.js';
import { E3_FIELDS } from '../src/notes/e3.js';
import { IN_CURRICULUM, OLYMPIAD_TOPICS } from '../src/engine/curriculum-in.js';
import { NSW_NOTES_TOPIC_BY_ID } from '../src/notes/nsw/nswNotesIndex.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const only = process.env.NOTES_E3_BAND || null;

const texErr = (tex, display = false) => { try { katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: 'ignore' }); return null; } catch (e) { return e.message; } };
const outsideMath = s => String(s ?? '').replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, ' ');
const UNICODE_MATH = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋√∛∑∏∫≤≥≠×÷−]/u;
const MACHINE_TELL = /(^|[^\w.])1[a-z](?![a-z])|[+\-−]\s*\(\s*-|\(\s*-?\d+\s*\)\s*[a-z]\b/;
const MATH_TELL = /(^|[^\\\w])1[a-z](?![a-z])|[+-]\s*\(\s*-\d|[+-]\s+-\d|\+\s*-/;
const FILLER = /\b(let'?s dive|dive in|delve|in this chapter,? we will|unlock|journey|embark|seamless(ly)?|crucial|powerful tool|master(ing)? the|game[- ]changer|fascinating|exciting)\b|!/i;
const INDIA = /NCERT|CBSE|\bJEE\b|\bClass\s*\d|\bIndian?\b|rupee|₹|lakh|crore|\bIIT\b/i;
const NOT_AU = /\b(meter|meters|liter|liters|center|centers|color|colors|favorite|gray|neighbor)\b/i;
const NSW_WORDS = /\bNESA\b|\bHSC\b|\bNSW\b|\bStage [456]\b|\bYear (7|8|9|10|11|12)\b/;

function prose(text, where, { min = 1 } = {}) {
  ok(typeof text === 'string' && text.trim().length >= min, `${where}: needs at least ${min} characters of text`);
  if (typeof text !== 'string') return;
  const dollars = (text.match(/(?<!\\)\$/g) || []).length;
  ok(dollars % 2 === 0, `${where}: unbalanced $`);
  for (const [, m] of text.matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)) {
    const e = texErr(m); ok(!e, `${where}: KaTeX failed on $${m}$ — ${e}`);
    ok(!MATH_TELL.test(m), `${where}: write the simplified form, not $${m}$`);
  }
  const plain = outsideMath(text);
  ok(!UNICODE_MATH.test(plain), `${where}: maths outside KaTeX in "${plain.trim().slice(0, 80)}"`);
  ok(!MACHINE_TELL.test(plain), `${where}: machine-written maths in "${plain.trim().slice(0, 80)}"`);
  const words = text.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, ' '); // a factorial inside maths is not an exclamation
  ok(!FILLER.test(words), `${where}: filler or hype ("${(words.match(FILLER) || [''])[0]}")`);
}

const close = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
function verify(v) {
  if (!v || typeof v !== 'object') return 'no verify block';
  const x = v.var || 'x';
  try {
    switch (v.kind) {
      case 'value': { const a = evalNumeric(v.expr), b = evalNumeric(v.answer); return close(a, b) ? null : `engine computes ${a}, note says ${b}`; }
      case 'values': for (const [e, ans] of v.pairs) { const a = evalNumeric(e), b = evalNumeric(ans); if (!close(a, b)) return `engine computes ${e} = ${a}, note says ${b}`; } return null;
      case 'roots': for (const r of v.answers) { const val = evalNumeric(v.f, { [x]: evalNumeric(r) }); if (!close(val, 0, 1e-7)) return `f(${r}) = ${val}, not 0`; } return null;
      case 'equivalent': return exprEquivalent(v.a, v.b) ? null : `${v.a} is not equivalent to ${v.b}`;
      default: return `unknown verify kind ${v.kind}`;
    }
  } catch (e) { return `engine error: ${e.message}`; }
}

const hasNaN = o => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__NaN__' : v)).includes('__NaN__');
function diagram(d, where) {
  prose(d.title, `${where} title`); prose(d.note, `${where} note`);
  const errs = validateSpec(d.spec);
  ok(errs.length === 0, `${where}: ${errs.join('; ')}`);
  const pk = d.spec && packKind(d.spec.kind);
  if (pk?.model && !errs.length) {
    try { const { kind, ...params } = d.spec; ok(!hasNaN(pk.model(params)), `${where}: the model has a NaN or infinite number`); }
    catch (e) { ok(false, `${where}: the model throws — ${e.message}`); }
  }
}

function layerEntry(id, n, where, { nsw, full = false }) {
  for (const k of Object.keys(n)) ok(full || E3_FIELDS.includes(k), `${where}: unknown layer field ${k}`);
  prose(n.objective, `${where} objective`, { min: 20 });
  prose(n.intuition, `${where} intuition`, { min: 80 });
  (n.check || []).forEach((c, i) => {
    prose(c.question, `${where} check ${i + 1} question`); prose(c.answer, `${where} check ${i + 1} answer`);
    const why = verify(c.verify); ok(why === null, `${where} check ${i + 1}: the engine disagrees — ${why}`);
  });
  (n.mistakes || []).forEach((m, i) => { prose(m.wrong, `${where} mistake ${i + 1} wrong`); prose(m.right, `${where} mistake ${i + 1} right`); });
  (n.diagrams || []).forEach((d, i) => diagram(d, `${where} diagram ${i + 1}`));
  if (n.interactiveNone != null) {
    prose(n.interactiveNone, `${where} interactiveNone`, { min: 40 });
    ok(!(n.diagrams || []).some(d => INTERACTIVE_KIND_NAMES.includes(d.spec?.kind)), `${where}: has an interactive diagram and says none helps`);
  }
  const text = JSON.stringify(n);
  if (nsw) { ok(!INDIA.test(text), `${where}: India word in an NSW note`); ok(!NOT_AU.test(text), `${where}: not en-AU spelling`); }
  else ok(!NSW_WORDS.test(text), `${where}: NSW word in a Priyabhata note`);
}

const BANDS = [];
for (const g of IN_CURRICULUM) {
  const ids = new Set(g.chapters.map(c => c.id));
  BANDS.push({ name: `class${g.grade}`, file: `../src/notes/data/notes-e3-class${g.grade}.js`, has: id => ids.has(id), nsw: false });
}
for (const [name, file, test] of [
  ['nsw-stage4', 'notes-nsw-e3-stage4.js', t => t.stage === 4],
  ['nsw-stage5-core', 'notes-nsw-e3-stage5-core.js', t => t.stage === 5 && !t.path],
  ['nsw-stage5-path', 'notes-nsw-e3-stage5-path.js', t => t.stage === 5 && t.path],
  ['nsw-standard', 'notes-nsw-e3-standard.js', t => t.course === 'standard'],
  ['nsw-advanced', 'notes-nsw-e3-advanced.js', t => t.course === 'advanced'],
  ['nsw-ext1', 'notes-nsw-e3-ext1.js', t => t.course === 'ext1'],
  ['nsw-ext2', 'notes-nsw-e3-ext2.js', t => t.course === 'ext2']
]) BANDS.push({ name, file: `../src/notes/nsw/${file}`, has: id => !!NSW_NOTES_TOPIC_BY_ID[id] && test(NSW_NOTES_TOPIC_BY_ID[id]), nsw: true });

for (const b of BANDS) {
  if (only && only !== b.name) continue;
  const layer = (await import(b.file)).default;
  for (const [id, n] of Object.entries(layer)) {
    ok(b.has(id), `${b.name}: ${id} is not a chapter of this band`);
    layerEntry(id, n, `${b.name} ${id}`, { nsw: b.nsw });
  }
}

// The Olympiad notes are complete chapters, written new: the full chapter shape plus the layer fields.
if (!only || only === 'olympiad') {
  const oly = (await import('../src/notes/data/notes-olympiad.js')).default;
  const ids = new Set(OLYMPIAD_TOPICS.map(t => t.id));
  for (const [id, n] of Object.entries(oly)) {
    const w = `olympiad ${id}`;
    ok(ids.has(id), `${w}: not an Olympiad topic`);
    prose(n.summary, `${w} summary`, { min: 60 });
    ok(Array.isArray(n.prereqs), `${w}: prereqs must be a list`);
    ok(n.concepts?.length >= 3, `${w}: needs at least 3 ideas`);
    ok((n.definitions?.length || 0) + (n.formulas?.length || 0) >= 2, `${w}: needs a formal statement (definitions, theorems or formulas)`);
    ok(n.points?.length >= 4, `${w}: needs at least 4 important points`);
    ok(n.mistakes?.length >= 2, `${w}: needs at least 2 misconceptions`);
    ok(n.examples?.length >= 3, `${w}: needs at least 3 worked examples`);
    ok(n.check?.length >= 2, `${w}: needs a checkpoint of at least 2 questions`);
    (n.concepts || []).forEach((c, i) => { prose(c.title, `${w} idea ${i} title`); prose(c.body, `${w} idea ${i}`); });
    (n.definitions || []).forEach((d, i) => { prose(d.term, `${w} definition ${i} term`); prose(d.meaning, `${w} definition ${i}`); });
    (n.formulas || []).forEach((f, i) => { prose(f.label, `${w} formula ${i} label`); const e = texErr(f.tex, true); ok(!e, `${w} formula ${i}: KaTeX failed — ${e}`); });
    (n.points || []).forEach((p, i) => { prose(p.front, `${w} point ${i} front`); prose(p.back, `${w} point ${i} back`); });
    (n.examples || []).forEach((ex, i) => {
      const x = `${w} example ${i + 1}`;
      prose(ex.question, `${x} question`); prose(ex.answer, `${x} answer`);
      ok(ex.steps?.length >= 2, `${x}: needs at least 2 steps`);
      (ex.steps || []).forEach((s, j) => prose(s, `${x} step ${j + 1}`));
      const why = verify(ex.verify); ok(why === null, `${x}: the engine disagrees — ${why}`);
    });
    layerEntry(id, { objective: n.objective, intuition: n.intuition, check: n.check, diagrams: n.diagrams, interactiveNone: n.interactiveNone, mistakes: n.mistakes }, w, { nsw: false });
  }
}

// Every teaching diagram in every chapter (written before this layer too): the expression only calls
// functions the engine really has (log2(x) parses as log10(2)*x and once drew a straight line labelled
// y = log_2 x), and a point drawn on a function graph lies on one of its curves unless it says `free`.
if (!only) {
  const FN_OK = new Set(['sin', 'cos', 'tan', 'sqrt', 'exp', 'ln', 'log', 'abs', 'asin', 'acos', 'atan', 'sec', 'csc', 'cot', 'floor', 'ceil', 'cbrt']);
  const { loadNotesForGrade, loadOlympiadNotes } = await import('../src/notes/notesIndex.js');
  const { loadNswNotesForStage } = await import('../src/notes/nsw/nswNotesIndex.js');
  const books = [];
  for (const g of IN_CURRICULUM) books.push(await loadNotesForGrade(g.grade));
  books.push(await loadOlympiadNotes());
  for (const [st, c] of [[4, null], [5, null], [6, 'standard'], [6, 'advanced'], [6, 'ext1'], [6, 'ext2']]) books.push((await loadNswNotesForStage(st, c)) || {});
  for (const book of books) for (const [id, ch] of Object.entries(book)) (ch.diagrams || []).forEach((d, i) => {
    const sp = d.spec || {}; const w = `${id} diagram ${i + 1}`;
    const exprs = [...(sp.curves || []).map(c => c.expr), sp.expr].filter(e => typeof e === 'string');
    for (const e of exprs) for (const [, f] of e.matchAll(/([A-Za-z_]\w*)\s*\(/g)) ok(FN_OK.has(f), `${w}: ${f}() is not an engine function (in ${e})`);
    if (sp.kind === 'function') {
      // Every point and intercept label sits clear of the curves, the axes, the other dots and the other labels, inside the frame.
      let m = null;
      try { m = functionGraphModel(sp); } catch (e) { ok(false, `${w}: the function model throws — ${e.message}`); }
      if (m) for (const pt of [...m.points, ...m.curves.flatMap(c => [c.yIntercept, ...(c.xIntercepts || [])].filter(Boolean))]) {
        if (pt.place) ok((pt.place.clash ?? pt.place.cost) === 0, `${w}: the label at (${pt.x}, ${pt.y}) collides with something (clash ${pt.place.clash ?? pt.place.cost}); move the point's frame or drop the label`);
      }
    }
    if (sp.kind === 'function') for (const p of sp.points || []) {
      if (p.free) continue;
      const on = (sp.curves || []).some(c => { try { const y = evalNumeric(c.expr, { x: p.x }); return Math.abs(y - p.y) <= 1e-3 * Math.max(1, Math.abs(p.y)); } catch { return false; } });
      ok(on, `${w}: the point (${p.x}, ${p.y}) is on none of its curves (mark it free: true if that is intended)`);
    }
  });
}

console.log(`notes-e3-check: ${pass} passed, ${failures.length} failed`);
for (const f of failures.slice(0, 60)) console.log('  FAIL', f);
if (failures.length > 60) console.log(`  … and ${failures.length - 60} more`);
process.exit(failures.length ? 1 : 0);
