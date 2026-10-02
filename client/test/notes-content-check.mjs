// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · chapter notes are mathematics, and are held to the marker's bar
//
// A wrong formula in a revision note is as harmful as a wrong mark: the student
// learns it. So the notes are not trusted because someone wrote them carefully.
// This suite proves, for every chapter the curriculum spine lists:
//
//   1. the chapter has notes (against a coverage floor that is only ever
//      raised — see NOTES_COVERAGE_FLOOR), and every note has the full shape:
//      summary, concepts, definitions, formulas, important points, common
//      mistakes and at least one worked example;
//   2. every piece of TeX — formulas and every $…$ span in prose — renders in
//      KaTeX with throwOnError ON, so a broken formula fails here and never
//      reaches a student as red source text;
//   3. every worked example's final answer is re-derived by the deterministic
//      engine (client/src/engine/expr.js), never by the author's say-so. The
//      `verify` block states the problem's data as an expression and the
//      answer the note prints; the engine has to agree;
//   4. a misconception a mistake cites exists in the ontology;
//   5. every prerequisite a note links to is a real curriculum chapter, and
//      every chapter's "Practise this" link is one Practice can serve.
//
// Usage: node client/test/notes-content-check.mjs [--class 10]
// ─────────────────────────────────────────────────────────────────────────────
import katex from 'katex';
import { IN_CURRICULUM, IN_CHAPTER_BY_ID } from '../src/engine/curriculum-in.js';
import { evalNumeric, exprEquivalent } from '../src/engine/expr.js';
import { MISCONCEPTION_IDS } from '../src/engine/misconceptions.js';
import { NOTES_GRADES, loadNotesForGrade, notesPracticeHref } from '../src/notes/notesIndex.js';
import { practiceRequestFromQuery } from '../src/lib/practiceLinks.js';

// The share of curriculum chapters that must have complete, verified notes.
// Raise it as chapters land; never lower it.
const NOTES_COVERAGE_FLOOR = 1.0;

const onlyClass = (() => { const i = process.argv.indexOf('--class'); return i > 0 ? Number(process.argv[i + 1]) : null; })();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// ── TeX ──────────────────────────────────────────────────────────────────────
function texRenders(tex, display) {
  try { katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: 'ignore' }); return null; }
  catch (e) { return e.message; }
}
function proseTex(text) {
  const out = [];
  String(text ?? '').split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g).forEach((p, i) => { if (i % 2) out.push(p); });
  // An odd number of unescaped $ means a span never closed.
  const dollars = (String(text ?? '').match(/(?<!\\)\$/g) || []).length;
  return { spans: out, balanced: dollars % 2 === 0 };
}
function checkProse(text, where) {
  ok(typeof text === 'string' && text.trim().length > 0, `${where}: empty text`);
  const { spans, balanced } = proseTex(text);
  ok(balanced, `${where}: unbalanced $ in ${JSON.stringify(text)}`);
  for (const s of spans) { const err = texRenders(s, false); ok(!err, `${where}: KaTeX failed on $${s}$ — ${err}`); }
}

// ── Engine verification ──────────────────────────────────────────────────────
const close = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const at = (expr, env) => evalNumeric(expr, env);
const SAMPLES = [0.37, 0.81, 1.23, 1.71, 2.29];

/** Returns null when the engine agrees with the note, or the reason it does not. */
export function verifyExample(v) {
  if (!v || typeof v !== 'object') return 'no verify block';
  const x = v.var || 'x';
  try {
    switch (v.kind) {
      case 'value': {
        const a = at(v.expr), b = at(v.answer);
        return close(a, b) ? null : `engine computes ${a}, note says ${b}`;
      }
      case 'values': {
        // A list of computed quantities, each checked like 'value'.
        for (const [expr, answer] of v.pairs) { const a = at(expr), b = at(answer); if (!close(a, b)) return `engine computes ${expr} = ${a}, note says ${b}`; }
        return null;
      }
      case 'roots': {
        if (!Array.isArray(v.answers) || !v.answers.length) return 'no roots listed';
        for (const r of v.answers) { const val = at(v.f, { [x]: at(r) }); if (!close(val, 0, 1e-7)) return `f(${r}) = ${val}, not 0`; }
        // Distinct roots, and (when the degree is given) no more than it allows.
        const nums = v.answers.map(r => at(r));
        if (new Set(nums.map(n => n.toFixed(9))).size !== nums.length) return 'repeated root listed twice';
        if (v.degree && nums.length > v.degree) return 'more roots than the degree allows';
        return null;
      }
      case 'equivalent': {
        return exprEquivalent(v.a, v.b) ? null : `${v.a} is not equivalent to ${v.b}`;
      }
      case 'system': {
        const env = Object.fromEntries(Object.entries(v.solution).map(([k, val]) => [k, at(val)]));
        for (const eq of v.equations) {
          const [l, r] = eq.split('=');
          const d = at(l, env) - at(r, env);
          if (!close(d, 0, 1e-7)) return `${eq} fails at ${JSON.stringify(v.solution)}`;
        }
        return null;
      }
      case 'derivative': {
        for (const s of v.samples || SAMPLES) {
          const h = 1e-5;
          const num = (at(v.f, { [x]: s + h }) - at(v.f, { [x]: s - h })) / (2 * h);
          const ans = at(v.answer, { [x]: s });
          if (!close(num, ans, 1e-4)) return `d/d${x} at ${s}: engine ${num}, note ${ans}`;
        }
        return null;
      }
      case 'antiderivative': {
        for (const s of v.samples || SAMPLES) {
          const h = 1e-5;
          const num = (at(v.answer, { [x]: s + h }) - at(v.answer, { [x]: s - h })) / (2 * h);
          const f = at(v.f, { [x]: s });
          if (!close(num, f, 1e-4)) return `derivative of the answer at ${s} is ${num}, integrand is ${f}`;
        }
        return null;
      }
      case 'integral': {
        const a = at(v.a), b = at(v.b), n = 2000, h = (b - a) / n;
        let sum = at(v.f, { [x]: a }) + at(v.f, { [x]: b });
        for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * at(v.f, { [x]: a + i * h });
        const num = sum * h / 3, ans = at(v.answer);
        return close(num, ans, 1e-6) ? null : `engine integrates to ${num}, note says ${ans}`;
      }
      case 'limit': {
        const c = at(v.at), ans = at(v.answer);
        for (const h of [1e-4, -1e-4]) { const val = at(v.f, { [x]: c + h }); if (!close(val, ans, 1e-3)) return `f near ${v.at} is ${val}, note says ${ans}`; }
        return null;
      }
      default: return `unknown verify kind ${v.kind}`;
    }
  } catch (e) { return `engine could not evaluate: ${e.message}`; }
}

// ── Walk the spine ───────────────────────────────────────────────────────────
const SHAPE = ['summary', 'concepts', 'definitions', 'formulas', 'points', 'mistakes', 'examples'];
let total = 0, complete = 0;
const missing = [];
let formulas = 0, examples = 0, cards = 0;

for (const group of IN_CURRICULUM) {
  if (onlyClass && group.grade !== onlyClass) continue;
  ok(NOTES_GRADES.includes(group.grade), `Class ${group.grade} has no notes module`);
  const notes = NOTES_GRADES.includes(group.grade) ? await loadNotesForGrade(group.grade) : {};
  for (const ch of group.chapters) {
    total++;
    const n = notes[ch.id];
    if (!n) { missing.push(ch.id); continue; }
    const where = ch.id;
    const shaped = SHAPE.every(k => k === 'summary' ? typeof n.summary === 'string' : Array.isArray(n[k]) && n[k].length > 0);
    ok(shaped, `${where}: missing one of ${SHAPE.join(', ')}`);
    if (shaped) complete++;
    checkProse(n.summary, `${where} summary`);
    for (const [i, c] of (n.concepts || []).entries()) { checkProse(c.title, `${where} concept ${i} title`); checkProse(c.body, `${where} concept ${i}`); }
    for (const [i, d] of (n.definitions || []).entries()) { checkProse(d.term, `${where} definition ${i} term`); checkProse(d.meaning, `${where} definition ${i}`); }
    for (const [i, f] of (n.formulas || []).entries()) {
      formulas++;
      checkProse(f.label, `${where} formula ${i} label`);
      ok(typeof f.tex === 'string' && f.tex.trim() && !f.tex.includes('$'), `${where} formula ${i}: tex must be bare TeX`);
      const err = texRenders(f.tex, true);
      ok(!err, `${where} formula ${i}: KaTeX failed on ${f.tex} — ${err}`);
      if (f.note) checkProse(f.note, `${where} formula ${i} note`);
    }
    for (const [i, p] of (n.points || []).entries()) { cards++; checkProse(p.front, `${where} point ${i} front`); checkProse(p.back, `${where} point ${i} back`); }
    for (const [i, m] of (n.mistakes || []).entries()) {
      checkProse(m.wrong, `${where} mistake ${i} wrong`); checkProse(m.right, `${where} mistake ${i} right`);
      if (m.misconception) ok(MISCONCEPTION_IDS.includes(m.misconception), `${where} mistake ${i}: unknown misconception ${m.misconception}`);
    }
    for (const [i, ex] of (n.examples || []).entries()) {
      examples++;
      checkProse(ex.question, `${where} example ${i} question`);
      ok(Array.isArray(ex.steps) && ex.steps.length > 0, `${where} example ${i}: no steps`);
      for (const [j, s] of (ex.steps || []).entries()) checkProse(s, `${where} example ${i} step ${j}`);
      checkProse(ex.answer, `${where} example ${i} answer`);
      const why = verifyExample(ex.verify);
      ok(!why, `${where} example ${i}: answer not engine-verified — ${why}`);
    }
    for (const p of n.prereqs || []) ok(!!IN_CHAPTER_BY_ID[p], `${where}: prerequisite ${p} is not a curriculum chapter`);
    const req = practiceRequestFromQuery(new URL(notesPracticeHref(ch), 'https://pri.local').searchParams);
    ok(req.mode === 'topic' && req.subtopic === ch.id, `${where}: Practise link does not open this chapter`);
  }
  // A note keyed to a chapter the spine does not list would never be shown.
  for (const id of Object.keys(notes)) ok(group.chapters.some(c => c.id === id), `Class ${group.grade}: notes for unknown chapter ${id}`);
}

const coverage = total ? complete / total : 0;
if (!onlyClass) ok(coverage >= NOTES_COVERAGE_FLOOR, `coverage ${complete}/${total} is below the floor ${NOTES_COVERAGE_FLOOR}`);

if (missing.length) console.log(`  chapters without notes (${missing.length}): ${missing.join(', ')}`);
if (failures.length) {
  for (const f of failures.slice(0, 80)) console.error(`  ✖ ${f}`);
  console.error(`\n✖ NOTES CONTENT CHECK FAILED — ${failures.length} failure(s), ${pass} passed`);
  process.exit(1);
}
console.log(`✔ NOTES CONTENT CHECK PASSED — ${complete}/${total} chapters, ${formulas} formulas rendered, ${examples} worked examples engine-verified, ${cards} flashcards (${pass} checks)`);
