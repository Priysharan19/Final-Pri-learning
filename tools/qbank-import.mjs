#!/usr/bin/env node
// Author question bank importer, VALIDATION ONLY (Prithagoras, NSW Years 11-12).
//
//   node tools/qbank-import.mjs <archive-dir> <report.json> [--ids A11-F1-001,X12-V1-200] [--limit N] [--no-steps] [--quiet]
//   node tools/qbank-import.mjs --pack <archive-dir> --out <pack-dir>        compile the content pack (see PACK below)
//
// Reads the owner's authored archive (data/pritagoras_qbank.json, data/pritagoras_marking.json, data/dotpoint_tags.json) as DATA.
// It never runs anything in the archive, never writes into the archive and never writes into this repository: the report goes to the
// path given (refused when that path is inside the repository). Nothing is imported into the product by this tool; it measures what
// the product's own engine says about every authored part, so a later import step can rely on the numbers.
//
// For each marking part it checks, with THIS repository's engine and not the author's:
//   schema    the shape of the record, and that its criteria add up to its marks
//   answer    the accepted answer is accepted by checkAnswer (auto-markable types only)
//   traps     each trap answer is refused by checkAnswer, and whether the engine can name the slip (diagnosed)
//   criteria  each `line` parses, is a line of the authored solution (writtenAsLine), and does not just restate the final answer
//   steps     the authored worked steps, written as a student's page, through the deterministic step report (markerOps.stepEvidence):
//             every line ticked, none crossed
//   scheme    whether the criteria are a sound boardScheme (boardScheme.js) that the authored page earns in full
//   latex     every math span of the prompt, steps, hints, trap reasons and criterion text renders under the client's KaTeX settings
//   marks     whether the product's marksPossibleFor() would give the question the marks the author set
// Failures block a part ("usable" in the report); notes (an undiagnosed trap, an unjudged line) do not.
//
// PACK. `--pack` compiles the questions that pass EVERY check into a content pack (format pri-qbank-pack-v1, read by
// server/platform/qbankPack.js) written to a directory: the committed pack (server/content/qbank, the owner allowed it to be public on
// 24 November 2026) or any directory outside this repository:
// manifest.json (sha256 and size of every file, pack version), index.json, shards/<family>.json (one per course and topic),
// rejects.json (ids and reasons only, no content) and NOTICE. A question goes in only when: it is auto-markable (not manual, not a working proof),
// its key is accepted and every trap refused by the engine, its text renders, it has no diagram (phase A), the engine crosses no line of
// its authored steps, and none of its hints (or the hint ladder's rungs) is a correct answer. Step marks are not paid in this phase;
// the criteria travel in the pack. Deterministic: the same archive gives the same bytes.
//
// Pure and deterministic: no clock, no network, no model, no randomness.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { exprEquivalent, parse, normalize, evaluate } from '../client/src/engine/expr.js';
import { writtenAsLine, statesOnlyFinalAnswer } from '../client/src/engine/checker.js';
import { boardSchemeProblems, matchBoardPoints, awardBoardScheme } from '../client/src/engine/boardScheme.js';
import { stepEvidence, stepMetaFor, marksPossibleFor } from '../server/platform/markerOps.js';
import { authoredLines } from '../server/platform/genericSteps.js';
import { checkBankAnswer } from '../server/platform/qbankMarking.js';
import { rungDropReason, bankLadder } from './qbank-leak.mjs';
import { PACK_FORMAT, DEFAULT_PACK_DIR, buildFamily, indexOf, loadPack, sha256, installPack, resetQbank, qbankEntries, qbankEntryQuestion } from '../server/platform/qbankPack.js';
import { bankProof } from '../server/platform/bankSteps.js';
import { loadFigureResults, packableFigure, figureRef, figureFiles, figureLeaks, figureAlt } from './qbank-diagrams.mjs';
import { classifyManual, deriveKey, asDerivedPart, plausibleWrongs, naturalForms, stepResultLeak, stepResults } from './qbank-manual.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const katex = createRequire(path.join(ROOT, 'client', 'package.json'))('katex');

export const AUTO_TYPES = Object.freeze(['numeric', 'expression', 'set', 'interval', 'equation', 'point']);
const KNOWN_TYPES = new Set([...AUTO_TYPES, 'manual', 'working']);
const COURSES = new Set(['ADV', 'EXT1']);

// ── reading the archive ──────────────────────────────────────────────────────
const DATA_FILES = ['pritagoras_qbank.json', 'pritagoras_marking.json', 'dotpoint_tags.json'];

/** The archive's three data files, parsed. `dir` may be the archive root or its data/ folder. Nothing else is read. */
export function loadArchive(dir) {
  const base = fs.existsSync(path.join(dir, 'data', DATA_FILES[0])) ? path.join(dir, 'data') : dir;
  const files = {};
  const parsed = {};
  for (const name of DATA_FILES) {
    const raw = fs.readFileSync(path.join(base, name));
    files[name] = { bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') };
    parsed[name] = JSON.parse(raw.toString('utf8'));
  }
  return { files, questions: parsed[DATA_FILES[0]], parts: parsed[DATA_FILES[1]], tags: parsed[DATA_FILES[2]] };
}

// ── schema ───────────────────────────────────────────────────────────────────
const isStr = v => typeof v === 'string' && v.trim() !== '';
const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** Problems with one marking part, as stable codes. [] when the record is well formed. */
export function schemaProblems(part) {
  const out = [];
  if (!isStr(part?.question)) out.push('schema:no-question-id');
  if (!isStr(part?.prompt)) out.push('schema:no-prompt');
  if (!KNOWN_TYPES.has(part?.answerType)) { out.push(`schema:unknown-answer-type:${part?.answerType}`); return out; }
  if (!Number.isInteger(part.marks) || part.marks < 1) out.push('schema:marks');
  if (!COURSES.has(part.course)) out.push('schema:course');
  if (!Number.isInteger(part.difficulty) || part.difficulty < 1 || part.difficulty > 6) out.push('schema:difficulty');
  if (!Array.isArray(part.steps) || !part.steps.length || !part.steps.every(s => isStr(s?.h) && isStr(s?.d))) out.push('schema:steps');
  if (!Array.isArray(part.hints) || part.hints.length < 1 || !part.hints.every(isStr)) out.push('schema:hints');
  if (!Array.isArray(part.traps)) out.push('schema:traps');
  if (!Array.isArray(part.criteria) || !part.criteria.length) out.push('schema:criteria');
  else {
    if (!part.criteria.every(c => Number.isInteger(c?.marks) && c.marks > 0 && isStr(c?.point))) out.push('schema:criterion');
    else if (part.criteria.reduce((s, c) => s + c.marks, 0) !== part.marks) out.push('schema:criteria-marks-sum');
    const answers = part.criteria.filter(c => c.answer === true).length;
    if (part.answerType === 'manual' ? answers !== 0 : answers !== 1) out.push('schema:answer-criterion-count');
  }
  const a = part.answer;
  switch (part.answerType) {
    case 'numeric': if (!isNum(a?.value) || (a.tol !== undefined && !(isNum(a.tol) && a.tol >= 0))) out.push('schema:answer'); break;
    case 'expression': if (!isStr(a?.expr)) out.push('schema:answer'); break;
    case 'set': if (!(Array.isArray(a?.values) && a.values.length && a.values.every(isNum))) out.push('schema:answer'); break;
    case 'interval': if (!(isStr(a?.region) && isStr(a?.variable))) out.push('schema:answer'); break;
    case 'equation': if (!(isStr(a?.lhs) && isStr(a?.rhs))) out.push('schema:answer'); break;
    case 'point': if (!(isNum(a?.x) && isNum(a?.y))) out.push('schema:answer'); break;
    case 'working': if (!(isStr(a?.canonicalWorking) && a.final)) out.push('schema:answer'); break;
    case 'manual': if (a !== undefined) out.push('schema:manual-has-answer'); break;
    default: break;
  }
  (part.traps || []).forEach((t, i) => {
    if (!isStr(t?.why)) out.push(`schema:trap-${i}-why`);
    if (part.answerType !== 'manual' && trapInput(t) === null) out.push(`schema:trap-${i}-no-answer`);
    if (typeof t?.value === 'string' && engineTrap(t).value === t.value) out.push(`schema:trap-${i}-value-not-a-number`);
  });
  return out;
}

// ── the answer, as a student types it ────────────────────────────────────────
/** The accepted answer as a student would type it into the answer box, or null for a part with no key. */
export function acceptedInput(part) {
  const a = part.answer;
  switch (part.answerType) {
    case 'numeric': return String(a.value);
    case 'expression': return a.expr;
    case 'set': return a.values.map(String).join(', ');
    case 'interval': return a.region;
    case 'equation': return `${a.lhs} = ${a.rhs}`;
    case 'point': return `(${a.x}, ${a.y})`;
    case 'working': return a.canonicalWorking;
    default: return null;
  }
}

/** A trap's wrong answer as a student would type it, or null when the trap carries none. */
export function trapInput(trap) {
  if (trap?.expr !== undefined) return String(trap.expr);
  if (trap?.value !== undefined) return String(trap.value);
  if (Array.isArray(trap?.values)) return trap.values.map(String).join(', ');
  if (trap?.region !== undefined) return String(trap.region);
  if (trap?.eq !== undefined) return String(trap.eq);
  if (Array.isArray(trap?.point) && trap.point.length === 2) return `(${trap.point[0]}, ${trap.point[1]})`;
  return null;
}

/**
 * A trap as the engine can match it. The author sometimes writes a numeric trap's `value` as an expression string ("8*pi"); the engine
 * compares numbers (checker-core matchTraps), so such a value is evaluated once here. A trap with no such home (`values`, `eq`, `point`)
 * is passed through unchanged: it is still refused as a wrong answer, but the engine cannot name its slip.
 */
export function engineTrap(t) {
  if (typeof t?.value !== 'string') return t;
  try { const v = evaluate(parse(normalize(t.value)), {}); if (Number.isFinite(v)) return { ...t, value: v, ...(t.expr === undefined ? { expr: t.value } : {}) }; } catch { /* kept as written */ }
  return t;
}

/** The bank family of a part: one per course and topic (`qb-a11-ma-f1`), the id the server's practice path is asked for. */
export const familyOf = part => `qb-${part.course === 'ADV' ? 'a' : 'x'}${part.year}-${String(part.topic).toLowerCase()}`;

/** The engine's question for one marking part: the shape the generators return, built from the author's record. */
export function engineQuestion(part, question = null) {
  const q = {
    id: part.label ? `${part.question}${part.label}` : part.question,
    prompt: part.prompt, answerType: part.answerType, answer: part.answer,
    steps: part.steps, traps: (part.traps || []).map(engineTrap), hints: part.hints, difficulty: part.difficulty,
    subtopic: familyOf(part),
    contentId: `qbank:${part.question}${part.label || ''}`,
    _bank: part.label ? `${part.question}${part.label}` : part.question
  };
  if (part.answerPrefix) q.answerPrefix = part.answerPrefix;
  if (part.inputHint) q.inputHint = part.inputHint;
  if (part.stepcheck) q.stepcheck = part.stepcheck;
  if (question && Number.isInteger(question.marks)) q.authoredMarks = part.marks;
  return q;
}

// ── LaTeX under the client's KaTeX settings ──────────────────────────────────
// client/src/lib/latex.jsx splits on unescaped $...$ and renders each span with { throwOnError: false, strict: false }.
// Here the same split is used with throwOnError on, so a span the client would paint as an error is reported.
const SPAN = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;

/** Problems of one text field as the client would draw it: codes only, stable. */
export function latexProblems(text) {
  const s = String(text ?? '');
  const out = [];
  const parts = s.split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g);
  const dollars = (s.replace(/\\\$/g, '').match(/\$/g) || []).length;
  if (dollars % 2 === 1) out.push('latex:unbalanced-dollar');
  parts.forEach((p, i) => {
    if (i % 2 === 1) {
      try { katex.renderToString(p, { throwOnError: true, displayMode: false, strict: false }); }
      catch (e) {
        const m = String(e?.message ?? e);
        const undef = /Undefined control sequence: (\\[A-Za-z]+|\\.)/.exec(m);
        out.push(undef ? `latex:undefined:${undef[1]}` : `latex:error:${m.replace(/^KaTeX parse error: /, '').replace(/ at position.*$/s, '').slice(0, 60)}`);
      }
    } else {
      // Text outside $...$ is drawn as written: a TeX command or a doubled backslash would show.
      const rest = p.replace(/\\[$%,]/g, '');
      const cmd = /\\[A-Za-z]+/.exec(rest);
      if (cmd) out.push(`latex:command-outside-math:${cmd[0]}`);
      else if (/\\\\/.test(rest)) out.push('latex:linebreak-outside-math');
      if (/[~]/.test(rest)) out.push('latex:tilde-outside-math');
      if (/\*/.test(rest) && !/\*\*[^*]+\*\*|\*[^*]+\*/.test(rest)) out.push('latex:lone-asterisk');
    }
  });
  return [...new Set(out)];
}

const TEXT_FIELDS = part => [
  ['prompt', part.prompt],
  ...part.steps.flatMap((s, i) => [[`steps.${i}.h`, s.h], [`steps.${i}.d`, s.d]]),
  ...part.hints.map((h, i) => [`hints.${i}`, h]),
  ...part.traps.map((t, i) => [`traps.${i}.why`, t.why]),
  ...part.criteria.map((c, i) => [`criteria.${i}.point`, c.point])
];

// ── the per-part checks ──────────────────────────────────────────────────────
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const verdict = r => (r && r.correct === true ? 'correct' : r && r.invalid === true ? 'invalid' : 'wrong');

/** answer + traps. Returns { failures, notes, trapsTested, trapsDiagnosed }. */
function answerChecks(part, q) {
  const failures = [], notes = [];
  let trapsTested = 0, trapsDiagnosed = 0, trapsUnmatchable = 0;
  if (!AUTO_TYPES.includes(part.answerType) && part.answerType !== 'working') return { failures, notes, trapsTested, trapsDiagnosed, trapsUnmatchable, accepted: null };
  const typed = acceptedInput(part);
  const got = safe(() => checkBankAnswer(q, typed), { correct: false, error: true });
  const v = got.error ? 'error' : verdict(got);
  if (v !== 'correct') failures.push(`answer:${v === 'error' ? 'error' : v === 'invalid' ? 'unreadable' : 'rejected'}`);
  if (part.answerType === 'working') return { failures, notes, trapsTested, trapsDiagnosed, trapsUnmatchable, accepted: v === 'correct' };
  // Over-wide tolerance: a clearly different number is also accepted (a note: the author may mean it).
  if (part.answerType === 'numeric' && v === 'correct') {
    const off = part.answer.value + Math.max(1, Math.abs(part.answer.value) * 0.1);
    if (safe(() => checkBankAnswer(q, String(off)), {}).correct === true) notes.push('answer:wide-tolerance');
  }
  (part.traps || []).forEach((t, i) => {
    const input = trapInput(t);
    if (input === null) return;
    trapsTested++;
    const r = safe(() => checkBankAnswer(q, input), { correct: false, error: true });
    if (r.correct === true) { failures.push(`trap:accepted:${i}`); return; }
    // A trap's reason is shown when the trap is answered: it is never one of the hints (which are shown before an answer is given).
    if (part.hints.some(h => sameText(h, t.why))) { failures.push(`trap:why-is-hint:${i}`); return; }
    if (r.invalid === true) { notes.push(`trap:unreadable:${i}`); return; }
    if (r.feedback === t.why) trapsDiagnosed++;
    else if (t.eq !== undefined || Array.isArray(t.values) || Array.isArray(t.point)) trapsUnmatchable++;
  });
  if (trapsTested && trapsDiagnosed < trapsTested) notes.push('trap:not-named-by-engine');
  return { failures, notes, trapsTested, trapsDiagnosed, trapsUnmatchable, accepted: v === 'correct' };
}

/** Word for word (case, spacing, TeX markup and punctuation aside), or one whole inside the other when it is a sentence. */
const bare = t => String(t ?? '').replace(/\\(?:left|right|,|;|!|quad|displaystyle)|[$\\{}\s.,;:!]/g, '').toLowerCase();
const sameText = (a, b) => { const x = bare(a), y = bare(b); return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 25 && (x.includes(y) || y.includes(x)))); };

/** The authored steps as the student's page. */
export const authoredPage = q => authoredLines(q).map(l => l.text);

/** The ways an authored line can be quoted by a criterion: the whole line, each side of a chain, and the first side set equal to each later one. */
function candidatesOf(line) {
  const sides = String(line).split(/(?<![<>!:])=(?!=)/).map(x => x.trim()).filter(Boolean);
  const out = new Set([line, ...sides]);
  for (let k = 1; k < sides.length; k++) out.add(`${sides[0]} = ${sides[k]}`);
  if (sides.length > 2) out.add(`${sides[sides.length - 2]} = ${sides[sides.length - 1]}`);
  return [...out];
}

/** The same line, by value: both read as expressions and equivalent. */
const sameValue = (a, b) => {
  const eq = t => { const p = String(t).split(/(?<![<>!:])=(?!=)/); return p.length === 2 && !/[<>≤≥]/.test(t) ? p.map(x => x.trim()) : null; };
  const ea = eq(a), eb = eq(b);
  if (ea || eb) return !!(ea && eb) && safe(() => exprEquivalent(ea[0], eb[0]) && exprEquivalent(ea[1], eb[1]), false) === true;
  return safe(() => exprEquivalent(a, b), false) === true;
};

/** criteria lines: read by the engine, belong to the authored solution, and are not just the final answer. */
function criteriaChecks(part, q, page) {
  const failures = [], notes = [];
  let withLine = 0;
  const meta = safe(() => stepMetaFor(q));
  const pool = page.flatMap(candidatesOf);
  part.criteria.forEach((c, i) => {
    if (typeof c.line !== 'string') return;
    withLine++;
    const line = c.line;
    // The engine reads a criterion line the way it reads a student's line (the same reader writtenAsLine and the board scheme use).
    if (!safe(() => writtenAsLine(line, line), false)) { failures.push(`line:not-read:${i}`); return; }
    if (!pool.some(p => safe(() => writtenAsLine(p, line), false) || sameValue(p, line))) failures.push(`line:not-in-solution:${i}`);
    if (c.answer !== true && meta && safe(() => statesOnlyFinalAnswer(line, meta), false)) notes.push(`line:states-final-answer:${i}`);
  });
  return { failures, notes, withLine };
}

/** The deterministic step report of the authored page: every line ticked, none crossed. */
function stepChecks(part, q, page) {
  const failures = [], notes = [];
  if (!page.length) return { failures, notes, state: 'no-lines', lines: 0 };
  const typed = acceptedInput(part);
  const result = typed === null ? { correct: false } : safe(() => checkBankAnswer(q, typed), { correct: false });
  const ev = safe(() => stepEvidence(q, typed ?? '', page.join('\n'), result), null);
  const rep = ev && ev.stepReport;
  if (!rep || !Array.isArray(rep.lines) || !rep.lines.length) { notes.push('steps:no-report'); return { failures, notes, state: 'no-report', lines: page.length }; }
  const st = rep.lines.map(l => l.status);
  const crossed = st.filter(s => s === 'break').length, ok = st.filter(s => s === 'ok').length;
  let state = 'fully-ticked';
  const firstCross = crossed ? String(rep.lines.find(l => l.status === 'break')?.text ?? '').slice(0, 140) : null;
  if (crossed) { state = 'crossed'; failures.push('steps:crossed'); }
  else if (ok < st.length) { state = 'unjudged'; notes.push('steps:unjudged'); }
  return { failures, notes, state, lines: st.length, ticked: ok, crossed, firstCross };
}

/** criteria as the product's boardScheme: sound, and earned in full by the authored page. */
function schemeChecks(part, q, page) {
  if (part.answerType === 'manual') return { state: 'manual-part', problems: [] };
  const manual = part.criteria.filter(c => c.answer !== true && c.manual === true).length;
  const noLine = part.criteria.filter(c => c.answer !== true && typeof c.line !== 'string').length;
  const scheme = part.criteria.map(c => ({ marks: c.marks, point: c.point, ...(c.answer === true ? { answer: true } : { line: c.line }) }));
  const problems = safe(() => boardSchemeProblems(scheme, part.marks, stepMetaFor(q)), ['boardScheme:threw']);
  if (noLine || manual) return { state: manual ? 'has-manual-criteria' : 'criteria-without-line', problems, manual, noLine };
  if (problems.length) return { state: 'unsound', problems };
  // Earned in full: the authored page, with a WRONG final answer, must earn every working point (so the answer is the only mark left).
  const meta = safe(() => stepMetaFor(q));
  const typed = acceptedInput(part);
  const result = safe(() => checkBankAnswer(q, typed), { correct: false });
  const ev = safe(() => stepEvidence(q, typed, page.join('\n'), result), null);
  const ticked = matchBoardPoints({ scheme, lines: ev?.stepReport?.lines || [], meta });
  const award = awardBoardScheme({ scheme, ticked, correct: false });
  const answerMarks = part.criteria.filter(c => c.answer === true).reduce((s, c) => s + c.marks, 0);
  return { state: award.method === part.marks - answerMarks ? 'earned-in-full' : 'not-earned-by-authored-page', problems, method: award.method, expected: part.marks - answerMarks };
}

const gateOf = code => (code.startsWith('line:') ? 'stepMarks' : code === 'steps:crossed' ? 'feedback' : 'answer');

/** Every check for one part. `question` is the qbank record (for the diagram), `tags` the dot-point map. */
export function checkPart(part, question, tags, opts = {}) {
  const failures = [], notes = [];
  const schema = schemaProblems(part);
  const id = part.label ? `${part.question}${part.label}` : part.question;
  const rec = {
    id, question: part.question, label: part.label ?? null, course: part.course, year: part.year, topic: part.topic,
    dotpoint: tags?.[part.question] ?? null, difficulty: part.difficulty, answerType: part.answerType, marks: part.marks,
    diagram: !!(question?.tikz || part.figureTikz), autoMarkable: AUTO_TYPES.includes(part.answerType), checks: {}
  };
  if (schema.length) { rec.failures = schema; rec.notes = []; rec.usable = false; rec.feedbackSafe = false; rec.stepMarkReady = false; rec.checks.schema = 'fail'; return rec; }
  rec.checks.schema = 'ok';
  const q = engineQuestion(part, question);

  const ans = answerChecks(part, q);
  failures.push(...ans.failures); notes.push(...ans.notes);
  rec.checks.answer = ans.accepted === null ? 'n/a' : ans.accepted ? 'ok' : 'fail';
  rec.checks.traps = { tested: ans.trapsTested, diagnosed: ans.trapsDiagnosed, unmatchable: ans.trapsUnmatchable, refused: ans.trapsTested - ans.failures.filter(f => f.startsWith('trap:accepted')).length };

  const page = safe(() => authoredPage(q), []);
  const crit = criteriaChecks(part, q, page);
  failures.push(...crit.failures); notes.push(...crit.notes);
  rec.checks.criteria = { withLine: crit.withLine, total: part.criteria.length, failed: crit.failures.length };

  if (opts.steps !== false) {
    const st = stepChecks(part, q, page);
    failures.push(...st.failures); notes.push(...st.notes);
    rec.checks.steps = { state: st.state, lines: st.lines, ticked: st.ticked ?? 0, crossed: st.crossed ?? 0, ...(st.firstCross ? { firstCross: st.firstCross } : {}) };
  }

  const sc = schemeChecks(part, q, page);
  rec.checks.scheme = { state: sc.state, ...(sc.problems?.length ? { problems: sc.problems.slice(0, 3) } : {}), ...(sc.method !== undefined ? { method: sc.method, expected: sc.expected } : {}) };

  const lx = [];
  for (const [field, text] of TEXT_FIELDS(part)) for (const p of latexProblems(text)) lx.push(`${p}@${field.split('.')[0]}`);
  failures.push(...lx.filter(x => !x.startsWith('latex:lone-asterisk') && !x.startsWith('latex:tilde')));
  notes.push(...lx.filter(x => x.startsWith('latex:lone-asterisk') || x.startsWith('latex:tilde')));
  rec.checks.latex = lx.length ? 'fail' : 'ok';

  const product = safe(() => marksPossibleFor(q), null);
  rec.checks.marks = { authored: part.marks, product, same: product === part.marks };
  if (product !== part.marks) notes.push('marks:product-differs');

  rec.failures = failures; rec.notes = notes;
  // Three gates, so one number never hides another. ANSWER: the part can be issued and its final answer marked. FEEDBACK: the authored page is
  // never crossed by the step report (a cross on a correct line is a false error shown to a student). STEP MARKS: the criteria are sound
  // lines of the solution that the authored page earns in full.
  rec.gates = {
    answer: failures.every(f => gateOf(f) !== 'answer'),
    feedback: failures.every(f => gateOf(f) !== 'feedback'),
    stepMarks: rec.checks.scheme.state === 'earned-in-full' && failures.every(f => gateOf(f) !== 'stepMarks')
  };
  rec.usable = rec.autoMarkable && rec.gates.answer;
  rec.feedbackSafe = rec.usable && rec.gates.feedback;
  rec.stepMarkReady = rec.usable && rec.gates.stepMarks;
  return rec;
}

// ── the whole archive ────────────────────────────────────────────────────────
/** The four courses of the bank: A11, A12, X11, X12. */
export const groupOf = r => `${r.course === 'ADV' ? 'A' : 'X'}${r.year}`;
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Joins, then checks every part. Returns the report object (plain data). */
export function validateArchive(archive, opts = {}) {
  const { questions, parts, tags, files } = archive;
  const problems = [];
  const byId = new Map();
  for (const q of questions) {
    if (byId.has(q.id)) problems.push({ code: 'join:duplicate-question-id', id: q.id });
    byId.set(q.id, q);
  }
  const only = opts.ids ? new Set(opts.ids) : null;
  const seen = new Set();
  const partRows = [];
  let n = 0;
  for (const part of parts) {
    if (only && !only.has(part.question) && !only.has(`${part.question}${part.label || ''}`)) continue;
    if (opts.limit && n >= opts.limit) break;
    n++;
    const key = `${part.question}|${part.label ?? ''}`;
    if (seen.has(key)) problems.push({ code: 'join:duplicate-part', id: key });
    seen.add(key);
    const question = byId.get(part.question);
    if (!question) problems.push({ code: 'join:part-without-question', id: key });
    else if (question.course !== part.course || question.year !== part.year) problems.push({ code: 'join:course-differs', id: key });
    if (!tags?.[part.question]) problems.push({ code: 'join:no-dotpoint', id: part.question });
    partRows.push(checkPart(part, question, tags, opts));
  }
  if (!only && !opts.limit) {
    const partIds = new Set(parts.map(p => p.question));
    for (const q of questions) if (!partIds.has(q.id)) problems.push({ code: 'join:question-without-marking', id: q.id });
    // A question's authored marks equal the sum of its parts' marks.
    const sum = new Map();
    for (const p of parts) sum.set(p.question, (sum.get(p.question) || 0) + p.marks);
    for (const q of questions) if (Number.isInteger(q.marks) && sum.has(q.id) && sum.get(q.id) !== q.marks) problems.push({ code: 'join:marks-differ', id: q.id });
  }

  // Questions: usable only when every part is.
  const qRows = new Map();
  for (const r of partRows) {
    const e = qRows.get(r.question) || { id: r.question, course: r.course, year: r.year, topic: r.topic, dotpoint: r.dotpoint, difficulty: r.difficulty, parts: 0, usableParts: 0, diagram: false, types: [], failures: [] };
    e.parts++; if (r.usable) e.usableParts++; if (r.feedbackSafe) e.feedbackSafeParts = (e.feedbackSafeParts || 0) + 1; if (r.stepMarkReady) e.stepMarkReadyParts = (e.stepMarkReadyParts || 0) + 1; e.diagram = e.diagram || r.diagram; e.types.push(r.answerType);
    for (const f of r.failures) e.failures.push(r.label ? `${r.label}:${f}` : f);
    qRows.set(r.question, e);
  }
  const questionsOut = [...qRows.values()].map(e => ({ ...e, feedbackSafe: e.feedbackSafeParts === e.parts, stepMarkReady: e.stepMarkReadyParts === e.parts, status: e.usableParts === e.parts ? (e.diagram ? 'needs-diagram' : 'usable') : (e.types.every(t => !AUTO_TYPES.includes(t)) ? 'manual-only' : (e.types.some(t => !AUTO_TYPES.includes(t)) ? 'part-manual' : 'blocked')) }));

  // Within-bank duplicates, on the full prompt of each part (stem plus part), since a multi-part question's own stem may be empty:
  // exact prompt text, and the same prompt with its numbers removed.
  const exact = new Map(), skeleton = new Map();
  for (const part of parts) {
    const id = `${part.question}${part.label || ''}`;
    const t = norm(part.prompt);
    exact.set(t, [...(exact.get(t) || []), id]);
    const sk = t.replace(/[0-9]+(\.[0-9]+)?/g, '#');
    skeleton.set(sk, [...(skeleton.get(sk) || []), id]);
  }
  const dupExact = [...exact.values()].filter(v => v.length > 1);
  const dupSkeleton = [...skeleton.values()].filter(v => v.length > 1);

  return summarise({ files, problems, partRows, questionsOut, dupExact, dupSkeleton, questionCount: questions.length, partCount: parts.length, opts });
}

function summarise({ files, problems, partRows, questionsOut, dupExact, dupSkeleton, questionCount, partCount, opts }) {
  const byCourse = {}, byType = {}, classes = new Map();
  const cell = (course, f) => { const c = byCourse[course] || (byCourse[course] = { parts: 0, auto: 0, usable: 0, answerOk: 0, answerTested: 0, trapsTested: 0, trapsRefused: 0, trapsDiagnosed: 0, stepsFully: 0, stepsCrossed: 0, stepsUnjudged: 0, stepsNoReport: 0, stepsTested: 0, latexOk: 0, schemeEarned: 0, scheme: {}, marksSame: 0, diagram: 0 }); f(c); };
  const byTopic = {};
  for (const r of partRows) {
    const grp = groupOf(r);
    cell(grp, c => {
      c.parts++; bump(byType, r.answerType); if (r.diagram) c.diagram++;
      if (r.autoMarkable) c.auto++;
      if (r.usable) c.usable++;
      if (r.feedbackSafe) c.feedbackSafe = (c.feedbackSafe || 0) + 1;
      if (r.stepMarkReady) c.stepMarkReady = (c.stepMarkReady || 0) + 1;
      if (r.checks.answer && r.checks.answer !== 'n/a') { c.answerTested++; if (r.checks.answer === 'ok') c.answerOk++; }
      if (r.checks.traps) { c.trapsTested += r.checks.traps.tested; c.trapsRefused += r.checks.traps.refused; c.trapsDiagnosed += r.checks.traps.diagnosed; }
      if (r.checks.steps) { c.stepsTested++; const s = r.checks.steps.state; if (s === 'fully-ticked') c.stepsFully++; else if (s === 'crossed') c.stepsCrossed++; else if (s === 'unjudged') c.stepsUnjudged++; else c.stepsNoReport++; }
      if (r.checks.latex === 'ok') c.latexOk++;
      if (r.checks.scheme) { bump(c.scheme, r.checks.scheme.state); if (r.checks.scheme.state === 'earned-in-full') c.schemeEarned++; }
      if (r.checks.marks?.same) c.marksSame++;
    });
    const t = byTopic[`${grp}|${r.topic}`] || (byTopic[`${grp}|${r.topic}`] = { parts: 0, auto: 0, usable: 0, stepsTested: 0, stepsFully: 0, stepsCrossed: 0 });
    t.parts++; if (r.autoMarkable) t.auto++; if (r.usable) t.usable++;
    if (r.checks.steps) { t.stepsTested++; if (r.checks.steps.state === 'fully-ticked') t.stepsFully++; if (r.checks.steps.state === 'crossed') t.stepsCrossed++; }
    for (const code of [...r.failures.map(f => ['failure', f]), ...r.notes.map(f => ['note', f])]) {
      const cls = code[1].replace(/:\d+$/, '').replace(/@.*$/, '').replace(/:\d+(?=:|$)/g, '');
      const k = `${code[0]}|${cls}`;
      const e = classes.get(k) || { kind: code[0], class: cls, count: 0, parts: new Set(), examples: [] };
      e.count++; e.parts.add(r.id);
      if (e.examples.length < 5 && !e.examples.includes(r.id)) e.examples.push(r.id);
      classes.set(k, e);
    }
  }
  const qByCourse = {};
  for (const e of questionsOut) {
    const c = qByCourse[groupOf(e)] || (qByCourse[groupOf(e)] = { questions: 0, usable: 0, needsDiagram: 0, partManual: 0, manualOnly: 0, blocked: 0 });
    c.questions++;
    if (e.status === 'usable') { c.usable++; if (e.feedbackSafe) c.usableFeedbackSafe = (c.usableFeedbackSafe || 0) + 1; if (e.stepMarkReady) c.usableStepMarkReady = (c.usableStepMarkReady || 0) + 1; } else if (e.status === 'needs-diagram') c.needsDiagram++; else if (e.status === 'part-manual') c.partManual++; else if (e.status === 'manual-only') c.manualOnly++; else c.blocked++;
  }
  const failureClasses = [...classes.values()].map(e => ({ kind: e.kind, class: e.class, count: e.count, parts: e.parts.size, examples: e.examples }))
    .sort((a, b) => (a.kind === b.kind ? b.parts - a.parts : a.kind === 'failure' ? -1 : 1) || a.class.localeCompare(b.class));
  return {
    tool: 'tools/qbank-import.mjs',
    mode: 'validate-only',
    archive: { files, questions: questionCount, parts: partCount },
    checked: { parts: partRows.length, steps: opts.steps !== false },
    joinProblems: problems,
    summary: { byType, partsByCourse: byCourse, questionsByCourse: qByCourse, byTopic, failureClasses,
      duplicates: { exactPromptGroups: dupExact.length, exactPromptParts: dupExact.reduce((s, g) => s + g.length, 0), numberlessPromptGroups: dupSkeleton.length, examples: dupExact.slice(0, 5) } },
    parts: partRows,
    questions: questionsOut
  };
}


// ── hints that give the answer ───────────────────────────────────────────────
/**
 * The labels of the texts a student is shown BEFORE the question resolves that state the answer: the authored hints, the answer box's own
 * hint, and the rungs of the ladder as the server will build them. A real test (tools/qbank-leak.mjs): TeX is parsed and every side
 * evaluated, so a binomial written out with its value and 56/8 are found; what cannot be read is treated as leaking.
 */
export function hintLeaks(q, ctx = {}) {
  const texts = [...(q.hints || []).map((t, i) => [`hint ${i + 1}`, t])];
  if (typeof q.inputHint === 'string') texts.push(['inputHint', q.inputHint.replace(/^\s*e\.g\.?\s*/i, '')]);
  // The rungs are the author's hints and nothing else (bankLadder); nothing is derived from a step.
  for (const [rung, text] of Object.entries(q.ladder || {})) texts.push([`rung ${rung}`, text]);
  const out = [];
  for (const [label, text] of texts) {
    // The answer box's form hint is a form to write in, not a hint: it leaks only when it is itself the answer.
    if (label === 'inputHint') { if (safe(() => checkBankAnswer(q, String(text).trim()), {}).correct === true) out.push(label); continue; }
    if (rungDropReason(q, text, ctx)) out.push(label);
  }
  return [...new Set(out)];
}

// ── the pack ─────────────────────────────────────────────────────────────────
const LEVEL_OF = d => Math.min(4, Math.max(1, d));
const ordered = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
const json = v => JSON.stringify(v) + '\n';

// Why a part with a diagram has no figure to go with: none supplied, none that rendered and verified, or one that shows an answer.
const figureReject = (figures, id) => { const r = figures?.results.get(id); return !r ? 'diagram' : !r.ok ? 'diagram:render' : r.leaks?.length ? 'diagram:answer-in-figure' : 'diagram'; };

/** The reasons a part is not in the pack (empty when it is). Stable codes, no content. */
export function rejectReasons(rec, part, q, ctx = {}) {
  const figures = ctx.figures ?? null;
  const out = [];
  if (part.answerType === 'manual') out.push('manual');
  else if (part.answerType === 'working') out.push('working-proof');
  if (rec.diagram && !packableFigure(figures, part.question)) out.push(figureReject(figures, part.question));   // a diagram is packed only with a verified figure (qbank-diagrams.mjs)
  for (const f of rec.failures) {
    if (f.startsWith('line:')) continue;                 // criteria lines matter for step marks, not for a final-answer pack
    out.push(f.replace(/:\d+$/, '').replace(/@.*$/, '').replace(/(trap:accepted):\d+/, '$1'));
  }
  if (rec.autoMarkable && !out.length) { const leaks = hintLeaks(q, ctx); if (leaks.length) out.push('hint:leak'); }
  return [...new Set(out)];
}

/**
 * Compile the pack for an archive. Returns { files: Map(name -> string), rejects, summary }. Nothing is written here.
 */
/**
 * Questions held back for the owner's own re-reading, with why. Not a validation failure the importer can find: a person read the
 * question against its trap and found them out of step. They stay out of the pack and in rejects.json until he decides.
 */
export const HELD_FOR_OWNER = Object.freeze({
  'X11-C1-041': 'held:trap-does-not-match-its-reason',      // the trap value is 1/(10 pi); its reason says "used pi r instead of 2 pi r"
  'A11-T2-092': 'held:trap-reason-is-a-hint'                // the trap reason is word for word the third hint, so it is sent at issue
});

/**
 * Dot points the author's tag puts a question under that its own text is not about. Corrected here, at the pack, so the product's
 * dot point table (server/platform/qbankDotpoints.js) stays one table per author dot point.
 */
export const TAG_CORRECTIONS = Object.freeze({
  'A11-T1-074': 'T1.2b',   // the fraction of a circle's area a sector is: arc length, sector and segment area, not the area of a triangle
  'X12-V1-116': 'V1.1c'    // a point dividing a line in a ratio, by vectors: geometric work with vectors, not component form
});

/** His printed answer for each marking part: the question's `ans`, or, on a multi-part question, the part's own (by order). */
export function printedAnswers(archive) {
  const byId = new Map(archive.questions.map(q => [q.id, q]));
  const seen = new Map();
  const out = new Map();
  for (const part of archive.parts) {
    const n = seen.get(part.question) || 0;
    seen.set(part.question, n + 1);
    const q = byId.get(part.question);
    out.set(part, Array.isArray(q?.parts) ? q.parts[n]?.ans : q?.ans);
  }
  return out;
}

/** The ladder and the reasons a part (as the pack would hold it) is not packed: the checks an authored auto-markable part passes. */
function evaluateAuto(part, question, archive, opts) {
  const rec = checkPart(part, question, archive.tags, opts);
  const q = engineQuestion(part, question);
  const ctx = { figures: opts.figures, title: question?.title, criteria: part.criteria || [], steps: part.steps || [], traps: q.traps || [] };
  const lad = bankLadder(q, ctx);
  q.hints = lad.hints;
  q.ladder = lad.ladder;
  const reasons = rec.failures.some(f => f.startsWith('schema:')) ? rec.failures.filter(f => f.startsWith('schema:')) : rejectReasons(rec, part, q, ctx);
  return { rec, q, ctx, lad, reasons };
}

/**
 * Is a derived key one the pack may carry. The engine accepts it (evaluateAuto, above) and the part passes every pack check; then, with the
 * answer type the question will have:
 *   his form    each natural way of typing his printed answer (as read, brackets taken out, pi and π, one rearrangement, a plain decimal where it is
 *               one) is marked CORRECT by the real marker. A numeric box that says "work it out first" to his own `e^2+5` fails this.
 *   wrongs      at least three plausible WRONG values (the negative, the double, one more, a swap, a dropped or added element) are refused.
 * Returns { ok, why, forms, wrongs } (forms and wrongs: how many were tried).
 */
export function derivedKeyRefusals(dpart, q, key = {}) {
  const forms = naturalForms({ answerType: dpart.answerType, answer: dpart.answer, answerPrefix: dpart.answerPrefix, shown: key.shown });
  if (forms.length < 1) return { ok: false, why: 'no-typed-form' };
  const refused = forms.find(f => safe(() => checkBankAnswer(q, f), { correct: false }).correct !== true);
  if (refused !== undefined) return { ok: false, why: 'his-form-is-not-accepted' };
  const tested = plausibleWrongs({ answerType: dpart.answerType, answer: dpart.answer }).slice(0, 6);
  if (tested.length < 3) return { ok: false, why: 'fewer-than-three-wrong-values' };
  const accepted = tested.filter(w => safe(() => checkBankAnswer(q, w), { correct: true }).correct === true);
  return accepted.length ? { ok: false, why: 'a-wrong-value-is-accepted' } : { ok: true, forms: forms.length, formList: forms, wrongs: tested.length };
}

/**
 * A manual part that stays a worked-solution question: why it is not packed (empty when it is), and the line-feedback gate.
 * Kinds: prove, explain, sketch, find. No key, no mark, ever.
 */
export function evaluateManual(part, question, archive, opts) {
  const rec = checkPart(part, question, archive.tags, opts);
  const reasons = [];
  const schema = rec.failures.filter(f => f.startsWith('schema:'));
  if (schema.length) return { rec, reasons: schema };
  // The client must be able to draw it (the same TeX rules as an auto part), and a diagram only with a verified figure that shows no worked result.
  for (const f of rec.failures) if (f.startsWith('latex:')) reasons.push(f.replace(/@.*$/, ''));
  let diagram;
  if (rec.diagram) {
    const fig = packableFigure(opts.figures, part.question);
    if (!fig) reasons.push(figureReject(opts.figures, part.question));
    else if (safe(() => figureLeaks(question.tikz, part), ['unreadable']).length) reasons.push('diagram:answer-in-figure');
    else { const alt = safe(() => figureAlt(question.tikz, [part]), null); diagram = alt ? figureRef({ ...fig, alt: alt.alt }) : null; if (!diagram) reasons.push('diagram:alt'); }
  }
  // The hints: his, each through the rung rule and the step-result rule (a hint may not state a result of his worked steps).
  const q = engineQuestion(part, question);
  const ctx = { figures: opts.figures, title: question?.title, criteria: part.criteria || [], steps: part.steps || [], traps: [] };
  const lad = bankLadder(q, ctx);
  const results = stepResults(part);
  const kept = [], dropped = [...lad.dropped];
  lad.hints.forEach(h => { const why = stepResultLeak(part, h, results); if (why) dropped.push({ index: -1, why }); else kept.push(h); });
  const ladder = {};
  ['nudge', 'method', 'worked'].forEach((rung, i) => { if (kept[i]) ladder[rung] = kept[i]; });
  // Line feedback (ticks and notes on the student's own working) only where the step report never crosses his own steps.
  const lineFeedback = rec.gates?.feedback === true && rec.checks?.steps?.state !== 'no-lines' && rec.checks?.steps?.state !== 'no-report';
  return { rec, reasons: [...new Set(reasons)], hints: kept, ladder, dropped, lineFeedback, diagram, kind: classifyManual(part.prompt) };
}

export function compilePack(archive, opts = {}) {
  const byId = new Map(archive.questions.map(q => [q.id, q]));
  const printed = printedAnswers(archive);
  const shards = new Map();
  const rejects = [];
  const derived = { converted: [], byType: {}, held: {}, heldIds: {}, manualKinds: {}, manualServed: {}, manualRejected: {} };
  const ladderStats = { questions: 0, authoredHints: 0, rungsKept: 0, rungsDropped: 0, withRungs: { 0: 0, 1: 0, 2: 0, 3: 0 }, dropReasons: {} };
  const shardOf = part => shards.get(familyOf(part)) || shards.set(familyOf(part), { family: familyOf(part), course: part.course, year: part.year, topic: part.topic, questions: [], manual: [] }).get(familyOf(part));
  const stats = (lad, part) => {
    ladderStats.questions++;
    ladderStats.authoredHints += Math.min(3, (part.hints || []).length);
    ladderStats.rungsKept += lad.hints.length;
    ladderStats.rungsDropped += lad.dropped.length;
    ladderStats.withRungs[lad.hints.length]++;
    for (const d of lad.dropped) { const k = String(d.why).replace(/"[^"]*"/g, '"…"').replace(/\b\d+(?:\.\d+)?\b/g, 'N').slice(0, 60); ladderStats.dropReasons[k] = (ladderStats.dropReasons[k] || 0) + 1; }
  };
  for (const original of archive.parts) {
    const question = byId.get(original.question);
    let part = original;
    let ev = original.answerType === 'manual' ? null : evaluateAuto(part, question, archive, opts);
    let manual = null;
    if (original.answerType === 'manual') {
      const kind = classifyManual(original.prompt);
      derived.manualKinds[kind] = (derived.manualKinds[kind] || 0) + 1;
      // A "find" part may become auto-markable, only when its own printed answer is one unambiguous value that his last step reaches AND the
      // part passes every check an authored auto-markable part passes AND the engine refuses two or more plausible wrong values.
      let converted = false;
      if (kind === 'find' && opts.derive !== false) {
        const key = deriveKey(original, printed.get(original));
        if (key.no) { derived.held[key.no] = (derived.held[key.no] || 0) + 1; derived.heldIds[`${original.question}${original.label || ''}`] = key.no; }
        else {
          // The key as read, then (a numeric key whose own form is not a bare number) the same value as an exact-form expression:
          // the first the real marker accepts in his natural typed forms. Neither: the part stays a worked-solution question.
          let firstWhy = null;
          for (const cfg of [key, ...(key.alt ? [key.alt] : [])]) {
            const dpart = asDerivedPart(original, cfg);
            const dev = evaluateAuto(dpart, question, archive, opts);
            const refusals = dev.reasons.length ? { ok: false, why: `pack-check:${dev.reasons[0]}` } : derivedKeyRefusals(dpart, dev.q, cfg);
            if (refusals.ok && archive.tags?.[dpart.question]) {
              part = { ...dpart, derivedForms: refusals.formList }; ev = dev; converted = true;
              derived.converted.push({ id: dev.rec.id, answerType: dpart.answerType, shown: cfg.shown, prompt: String(original.prompt).replace(/\s+/g, ' ').slice(0, 140), key: dpart.answer, forms: refusals.forms, formList: refusals.formList, wrongs: refusals.wrongs, exactForm: cfg !== key });
              derived.byType[dpart.answerType] = (derived.byType[dpart.answerType] || 0) + 1;
              break;
            }
            firstWhy ||= refusals.why;
          }
          if (!converted) { derived.held[firstWhy] = (derived.held[firstWhy] || 0) + 1; derived.heldIds[`${original.question}${original.label || ''}`] = firstWhy; }
        }
      }
      if (!converted) manual = evaluateManual(original, question, archive, opts);
    }
    if (manual) {
      const rec = manual.rec;
      const reasons = manual.reasons;
      if (HELD_FOR_OWNER[rec.id] && !reasons.includes(HELD_FOR_OWNER[rec.id])) reasons.push(HELD_FOR_OWNER[rec.id]);
      if (reasons.length || !question || !archive.tags?.[original.question]) {
        const why = reasons.length ? reasons : [!question ? 'join:part-without-question' : 'join:no-dotpoint'];
        rejects.push({ id: rec.id, reasons: why.map(r => `manual:${r}`) });
        for (const r of why) derived.manualRejected[r] = (derived.manualRejected[r] || 0) + 1;
        continue;
      }
      const entry = ordered({
        id: rec.id, group: original.question, label: original.label ?? undefined, dp: TAG_CORRECTIONS[rec.id] ?? archive.tags[original.question], authored: original.difficulty, level: LEVEL_OF(original.difficulty),
        marks: original.marks, title: question.title, prompt: original.prompt, answerType: 'manual', kind: manual.kind, hints: manual.hints, ladder: manual.ladder, steps: original.steps, criteria: original.criteria,
        stepcheck: original.stepcheck, lineFeedback: manual.lineFeedback, diagram: manual.diagram
      }, ['id', 'group', 'label', 'dp', 'authored', 'level', 'marks', 'title', 'prompt', 'answerType', 'kind', 'hints', 'ladder', 'steps', 'criteria', 'stepcheck', 'lineFeedback', 'diagram']);
      shardOf(original).manual.push(entry);
      derived.manualServed[manual.kind] = (derived.manualServed[manual.kind] || 0) + 1;
      continue;
    }
    const { rec, q, lad } = ev;
    const reasons = ev.reasons;
    if (HELD_FOR_OWNER[rec.id] && !reasons.includes(HELD_FOR_OWNER[rec.id])) reasons.push(HELD_FOR_OWNER[rec.id]);
    if (reasons.length || !question || !archive.tags?.[part.question]) {
      rejects.push({ id: rec.id, reasons: reasons.length ? reasons : [!question ? 'join:part-without-question' : 'join:no-dotpoint'] });
      continue;
    }
    stats(lad, part);
    const entry = ordered({
      id: rec.id, group: part.question, label: part.label ?? undefined, dp: TAG_CORRECTIONS[rec.id] ?? archive.tags[part.question], authored: part.difficulty, level: LEVEL_OF(part.difficulty),
      marks: part.marks, title: question.title, prompt: part.prompt, answerType: part.answerType, answer: part.answer,
      answerPrefix: part.answerPrefix, inputHint: part.inputHint, hints: lad.hints, ladder: lad.ladder, steps: part.steps, traps: q.traps, criteria: part.criteria, stepcheck: part.stepcheck,
      derived: part.derivedKey ? true : undefined, derivedForms: part.derivedKey ? part.derivedForms : undefined,
      diagram: rec.diagram ? figureRef(packableFigure(opts.figures, part.question)) : undefined
    }, ['id', 'group', 'label', 'dp', 'authored', 'level', 'marks', 'title', 'prompt', 'answerType', 'answer', 'answerPrefix', 'inputHint', 'hints', 'ladder', 'steps', 'traps', 'criteria', 'stepcheck', 'derived', 'derivedForms', 'diagram']);
    shardOf(part).questions.push(entry);
  }
  const files = new Map();
  const entries = [];
  const families = new Map();
  for (const family of [...shards.keys()].sort()) {
    const shard = shards.get(family);
    shard.questions.sort((a, b) => (a.id < b.id ? -1 : 1));
    shard.manual.sort((a, b) => (a.id < b.id ? -1 : 1));
    // `manual` (worked-solution questions, no key, no mark) is written only when the family has some.
    const text = json(ordered({ ...shard, manual: shard.manual.length ? shard.manual : undefined }, ['family', 'course', 'year', 'topic', 'questions', 'manual']));
    const name = `shards/${family}.json`;
    files.set(name, text);
    entries.push({ name, family, course: shard.course, year: shard.year, topic: shard.topic, questions: shard.questions.length, ...(shard.manual.length ? { manualQuestions: shard.manual.length } : {}), bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text)) });
    families.set(family, buildFamily(shard));
  }
  const indexText = json({ format: PACK_FORMAT, families: indexOf(families) });
  // index.json holds `families` as loadPack compares it: the same array, in the same order.
  files.set('index.json', indexText);
  const index = { name: 'index.json', bytes: Buffer.byteLength(indexText), sha256: sha256(Buffer.from(indexText)) };
  const packVersion = sha256(Buffer.from([index.sha256, ...entries.map(e => `${e.name}:${e.sha256}`)].join('\n'))).slice(0, 12);
  const manifest = {
    format: PACK_FORMAT, packVersion, source: archive.files, index,
    totals: { questions: entries.reduce((s, e) => s + e.questions, 0), manualQuestions: entries.reduce((s, e) => s + (e.manualQuestions || 0), 0), shards: entries.length, bytes: entries.reduce((s, e) => s + e.bytes, 0) + index.bytes },
    shards: entries
  };
  files.set('manifest.json', json(manifest));
  rejects.sort((a, b) => (a.id < b.id ? -1 : 1));
  const reasonCounts = {};
  for (const r of rejects) for (const x of r.reasons) reasonCounts[x] = (reasonCounts[x] || 0) + 1;
  const byCourse = {};
  for (const e of entries) { const k = `${e.course === 'ADV' ? 'A' : 'X'}${e.year}`; byCourse[k] = (byCourse[k] || 0) + e.questions; }
  files.set('NOTICE', NOTICE);
  if (opts.figures) for (const [name, text] of figureFiles(opts.figures, [...shards.values()].flatMap(sh => [...sh.questions, ...sh.manual].filter(e => e.diagram).map(e => e.group)))) files.set(name, text);
  files.set('rejects.json', json({ note: 'ids and reasons only', parts: rejects.length, reasons: Object.fromEntries(Object.entries(reasonCounts).sort()), rejects }));
  return { files, rejects, summary: { ladder: ladderStats, manual: derived, packVersion, questions: manifest.totals.questions, manualQuestions: manifest.totals.manualQuestions, shards: entries.length, bytes: manifest.totals.bytes, byCourse, rejectedParts: rejects.length, reasons: Object.fromEntries(Object.entries(reasonCounts).sort()) } };
}

/** 40 of the converted parts, in the order of a hash of their ids (the same 40 on every run), as markdown rows for a reader to verify. */
export function derivedSample(converted, n = 40) {
  const pick = [...converted].sort((a, b) => (sha256(Buffer.from(a.id)) < sha256(Buffer.from(b.id)) ? -1 : 1)).slice(0, n).sort((a, b) => (a.id < b.id ? -1 : 1));
  const cell = t => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return ['| Question | Prompt (start) | Box | Derived key (his printed answer, read as) | His form typed in (accepted) | Wrong values refused |', '|---|---|---|---|---|---|',
    ...pick.map(c => `| ${c.id} | ${cell(c.prompt)} | ${c.answerType}${c.exactForm ? ' (exact form)' : ''} | \`${cell(JSON.stringify(c.key))}\` (\`${cell(c.shown)}\`) | ${c.forms}: ${(c.formList || []).slice(0, 4).map(f => `\`${cell(f)}\``).join(' ')} | ${c.wrongs} |`)].join('\n') + '\n';
}

export const NOTICE = 'Question bank content \u00a9 Priysharan Tripathi trading as Pri Learning. All rights reserved.\n';

/** An in-memory pack source over compiled files, so a pack is proved loadable before it is written. */
export const memorySource = files => ({ kind: 'memory', async read(name) { return files.has(name) ? Buffer.from(files.get(name)) : null; } });

// ── step marks from his own criteria: the import-time proof (server/platform/bankSteps.js) ───────────────────────────────
/**
 * The bank rule's proof for every marked part worth two or more marks of the INSTALLED pack (qbankPack.installPack): which parts are eligible, why
 * each of the others is not, and how many of his criteria the rule can verify. Pure of any student. A part that fails a proof page (his steps
 * with a wrong last line, the question restated, the given values, a trap answer alone) is listed with the reason and stays final-answer-only.
 */
export function bankStepProofs() {
  const rows = [];
  for (const { entry, family } of qbankEntries()) {
    if (entry.marks < 2) continue;
    const q = qbankEntryQuestion(entry.id, 17);
    const p = bankProof(q);
    rows.push({ id: entry.id, family, course: family.replace(/^qb-/, '').split('-')[0], topic: family.replace(/^qb-[ax]\d\d-/, ''), marks: entry.marks, answerType: entry.answerType, eligible: p.eligible, why: p.why, verifiable: p.verifiable, notVerified: p.notVerified, criteria: p.criteria });
  }
  const by = {}, reasons = {};
  let eligible = 0, verifiable = 0, notVerified = 0, parts = 0;
  for (const r of rows) {
    const k = `${r.course} ${r.topic}`;
    const o = by[k] || (by[k] = { parts: 0, eligible: 0, criteria: 0, verifiable: 0 });
    o.parts++; parts++;
    if (r.eligible) { o.eligible++; eligible++; o.verifiable += r.verifiable; verifiable += r.verifiable; o.criteria += r.verifiable + r.notVerified; notVerified += r.notVerified; }
    else reasons[r.why] = (reasons[r.why] || 0) + 1;
  }
  return { rows, summary: { parts, eligible, verifiable, notVerified, reasons, by } };
}

// ── command line ─────────────────────────────────────────────────────────────
function insideRepo(p) { const rel = path.relative(ROOT, path.resolve(p)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }

export async function main(argv) {
  const flag = name => { const i = argv.findIndex(a => a === `--${name}`); return i >= 0 ? argv[i + 1] : null; };
  if (argv.includes('--bank-steps')) {
    // Prints the bank rule's proof over a pack (default: the committed one). Writes nothing.
    const dir = flag('bank-steps') && !flag('bank-steps').startsWith('--') ? flag('bank-steps') : DEFAULT_PACK_DIR;
    const { directorySource } = await import('../server/platform/qbankPack.js');
    installPack(await loadPack(directorySource(dir)));
    try {
      const { rows, summary } = bankStepProofs();
      console.log(`bank step marks: ${summary.eligible} of ${summary.parts} parts worth 2 or more marks are eligible; criteria verified ${summary.verifiable}, not verified ${summary.notVerified}`);
      console.log(`not eligible, by reason ${JSON.stringify(summary.reasons)}`);
      if (argv.includes('--list')) for (const r of rows.filter(x => !x.eligible)) console.log(`  ${r.id}\t${r.why}`);
    } finally { resetQbank(); }
    return 0;
  }
  if (argv.includes('--pack')) {
    const archiveDir = flag('pack'), outDir = flag('out');
    if (!archiveDir || !outDir || archiveDir.startsWith('--') || outDir.startsWith('--')) { console.error('usage: node tools/qbank-import.mjs --pack <archive-dir> --out <pack-dir> [--figures <diagrams-work-dir>] [--overwrite] [--quiet]'); return 2; }
    // The committed pack (server/content/qbank) is the one place in the repository a pack may be written.
    if (insideRepo(outDir) && path.resolve(outDir) !== path.resolve(DEFAULT_PACK_DIR)) { console.error(`refusing to write the pack inside the repository, except at ${path.relative(ROOT, DEFAULT_PACK_DIR)}: ${outDir}`); return 2; }
    if (fs.existsSync(outDir) && fs.readdirSync(outDir).length && !argv.includes('--overwrite')) { console.error(`${outDir} is not empty; pass --overwrite to write over a previous pack`); return 2; }
    const compiled = compilePack(loadArchive(archiveDir), { figures: flag('figures') ? loadFigureResults(flag('figures')) : null });
    if (flag('derived-sample')) fs.writeFileSync(flag('derived-sample'), derivedSample(compiled.summary.manual.converted));
    // The pack must load exactly as the server will load it, before a byte is written.
    await loadPack(memorySource(compiled.files));
    if (flag('figures')) fs.rmSync(path.join(path.resolve(outDir), 'figures'), { recursive: true, force: true });   // a rebuilt pack holds exactly its own figures
    for (const [name, text] of compiled.files) {
      const file = path.join(path.resolve(outDir), name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    if (!argv.includes('--quiet')) {
      const s = compiled.summary;
      console.log(`pack ${s.packVersion}: ${s.questions} questions in ${s.shards} shards, ${s.bytes} bytes; rejected parts ${s.rejectedParts}`);
      { const l = s.ladder; console.log(`hints: ${l.authoredHints} authored (at most three a question) over ${l.questions} auto-markable parts; kept ${l.rungsKept}, dropped ${l.rungsDropped}; questions with 3/2/1/0 rungs: ${l.withRungs[3]}/${l.withRungs[2]}/${l.withRungs[1]}/${l.withRungs[0]}`); console.log(`drop reasons ${JSON.stringify(Object.fromEntries(Object.entries(l.dropReasons).sort((x, y) => y[1] - x[1]).slice(0, 12)))}`); }
      { const m = s.manual; console.log(`manual parts by kind ${JSON.stringify(m.manualKinds)}; converted to auto-markable ${m.converted.length} ${JSON.stringify(m.byType)}; kept as worked-solution questions ${JSON.stringify(m.manualServed)} (${Object.values(m.manualServed).reduce((a, b) => a + b, 0)}); not served ${JSON.stringify(m.manualRejected)}`); console.log(`find parts left manual, why ${JSON.stringify(Object.fromEntries(Object.entries(m.held).sort((x, y) => y[1] - x[1])))}`); }
      console.log(`by course ${JSON.stringify(s.byCourse)}`);
      console.log(`reject reasons ${JSON.stringify(s.reasons)}`);
      console.log(`written to ${outDir}`);
    }
    return 0;
  }
  const args = argv.filter(a => !a.startsWith('--'));
  const [archiveDir, out] = args.filter(a => a !== flag('ids') && a !== flag('limit'));
  if (!archiveDir || !out) { console.error('usage: node tools/qbank-import.mjs <archive-dir> <report.json> [--ids a,b] [--limit N] [--no-steps] [--quiet]'); return 2; }
  if (insideRepo(out)) { console.error(`refusing to write the report inside the repository: ${out}`); return 2; }
  const archive = loadArchive(archiveDir);
  const report = validateArchive(archive, { ids: flag('ids') ? flag('ids').split(',') : null, limit: flag('limit') ? Number(flag('limit')) : 0, steps: !argv.includes('--no-steps') });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
  if (!argv.includes('--quiet')) {
    const s = report.summary;
    console.log(`checked ${report.checked.parts} parts of ${report.archive.parts}; join problems ${report.joinProblems.length}`);
    for (const [course, c] of Object.entries(s.partsByCourse)) console.log(`${course}: parts ${c.parts}, auto-markable ${c.auto}, usable ${c.usable}, answers ${c.answerOk}/${c.answerTested}, traps refused ${c.trapsRefused}/${c.trapsTested}, steps fully ticked ${c.stepsFully}/${c.stepsTested}, latex ok ${c.latexOk}`);
    console.log(`report: ${out}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
