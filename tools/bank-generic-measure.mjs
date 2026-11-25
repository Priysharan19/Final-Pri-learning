// Pri Learning · measuring the approved generic rule applied to the author's own bank (server/platform/bankGenericSteps.js)
//
//   node tools/bank-generic-measure.mjs     eligibility, the two rules side by side, and the lines the deterministic report does not tick
//   node tools/bank-generic-measure.mjs --tex [--dump out.json]   per step: is his TeX read (and if not, which construct), is the line ticked (and if not, the note),
//                                                                  and the eligibility with its reason; the ranked tables; the before/after numbers by course
//
// Every figure is produced by running the rules on the committed pack. Nothing is approved in the repository; the rules are approved in this process only.
import { qbankEntries, qbankEntryQuestion, ensureQbank } from '../server/platform/qbankPack.js';
import { genericEligible, genericPlan, authoredLines } from '../server/platform/genericSteps.js';
import { bankGenericEligible } from '../server/platform/bankGenericSteps.js';
import { bankPlan, bankAuthoredLines, texToPlain } from '../server/platform/bankSteps.js';
import { marksPossibleFor, stepEvidence, isSchemeStep } from '../server/platform/markerOps.js';
import { markPage } from './bank-steps-sweep.mjs';
import { BANK_ID } from '../server/platform/bankSteps.js';
import { BANK_GENERIC_ID } from '../server/platform/bankGenericSteps.js';
import { falsify, stillTrue } from './generic-steps-sweep.mjs';
import { trapInput } from './qbank-import.mjs';
import { texToPlainWhy, EXTENDED_TEX } from '../client/src/engine/texToPlain.js';
import { _internals } from '../client/src/engine/solutionMatch.js';
import fs from 'node:fs';

const WRONG = '99991';
const groupOf = family => { const [c, t] = family.replace(/^qb-/, '').split('-'); return `${c.startsWith('a') ? 'Advanced' : 'Extension 1'} Y${c.slice(1)} ${t}`; };

/** Eligibility of every served part worth 2+ marks: { rows, summary }. Pure of any student. */
export function eligibility() { return inBankScope(eligibilityIn); }
function eligibilityIn() {
  const rows = [];
  for (const { entry, family } of qbankEntries()) {
    if (entry.marks < 2) continue;
    const q = qbankEntryQuestion(entry.id, 17);
    const N = marksPossibleFor(q);
    let why = null, keys = 0;
    const schemeSteps = (q.steps || []).filter(isSchemeStep).length;
    if (!genericEligible(q)) why = schemeSteps < 2 ? 'one-step-solution' : 'not-eligible';
    else {
      const plan = genericPlan(q);
      keys = plan.keySteps.length;
      if (!keys) why = plan.why;
    }
    if (why === 'no-usable-step') {
      // split by whether the engine ticks ANY of his own lines (the generic self-test), and whether he wrote readable lines at all
      const lines = authoredLines(q).map(l => l.text);
      const rep = lines.length ? stepEvidence(q, WRONG, lines.join('\n'), { correct: false }, { slipWarnings: true }).stepReport : null;
      const ok = (rep?.lines || []).filter(l => l.status === 'ok').length;
      why = !ok ? 'no-usable-step:engine-ticks-none-of-his-lines' : 'no-usable-step:lines-ticked-but-no-step-is-real-progress-or-reached';
    }
    rows.push({ id: entry.id, family, group: groupOf(family), N, steps: schemeSteps, keys, eligible: keys >= 1, all: keys === N - 1 && keys >= 1, why, prompt: String(q.prompt).slice(0, 90) });
  }
  const by = {}, reasons = {}, examples = {};
  for (const r of rows) {
    const o = by[r.group] || (by[r.group] = { parts: 0, eligible: 0, all: 0 });
    o.parts++; if (r.eligible) o.eligible++; if (r.all) o.all++;
    if (!r.eligible) { reasons[r.why] = (reasons[r.why] || 0) + 1; (examples[r.why] ||= []).length < 3 && examples[r.why].push(`${r.id}: ${r.prompt}`); }
  }
  return { rows, summary: { parts: rows.length, eligible: rows.filter(r => r.eligible).length, all: rows.filter(r => r.all).length, reasons, examples, by } };
}

/** The two rules page by page on the parts both can pay: marks under each, who pays more, and disagreements (one pays, the other does not). */
export function compare() { return inBankScope(compareIn); }
function compareIn() {
  const out = { parts: 0, pages: 0, criteriaMore: 0, genericMore: 0, same: 0, onlyCriteria: 0, onlyGeneric: 0, criteriaMarks: 0, genericMarks: 0, examples: [], bothOnly: 0, onlyCriteriaParts: 0, onlyGenericParts: 0 };
  for (const { entry } of qbankEntries()) {
    if (entry.marks < 2) continue;
    const q = qbankEntryQuestion(entry.id, 17);
    const c = bankPlan(q).eligible, g = bankGenericEligible(q);
    if (c && !g) out.onlyCriteriaParts++;
    if (g && !c) out.onlyGenericParts++;
    if (!(c && g)) continue;
    out.parts++;
    const texts = bankAuthoredLines(q).map(l => l.text);
    const pages = [['final-wrong', (() => { const b = falsify(texts[texts.length - 1]); return b ? texts.map((t, i) => (i === texts.length - 1 ? b : t)) : texts; })(), WRONG]];
    for (let i = 0; i < texts.length - 1; i++) { const b = falsify(texts[i]); if (b && b !== texts[i] && !stillTrue(texts[i], b)) pages.push([`middle-${i + 1}`, texts.map((t, k) => (k === i ? b : t)), WRONG]); }
    for (const t of q.traps || []) { const ty = trapInput(t); if (ty !== null && texts.length > 1) pages.push(['trap', texts.slice(0, -1), ty]); }
    for (const [name, lines, typed] of pages) {
      const a = markPage({ ...q, _methodScheme: BANK_ID }, lines, typed), b = markPage({ ...q, _methodScheme: BANK_GENERIC_ID }, lines, typed);
      out.pages++; out.criteriaMarks += a.marks; out.genericMarks += b.marks;
      if (a.marks > b.marks) out.criteriaMore++; else if (b.marks > a.marks) out.genericMore++; else out.same++;
      if (a.marks > 0 && b.marks === 0) out.onlyCriteria++;
      if (b.marks > 0 && a.marks === 0) out.onlyGeneric++;
      if ((a.marks > 0) !== (b.marks > 0) && out.examples.length < 6) out.examples.push({ id: q._bank, page: name, criteria: a.marks, generic: b.marks, lines });
    }
  }
  return out;
}

const KINDS = [
  ['a derivative or integral written with dy/dx, y\', f\'(x), d/dx, int', t => /dy\/dx|d\^?2?y|'|d\/dx|\bint\b/.test(t)],
  ['an inequality or an interval', t => /[<>]/.test(t)],
  ['a point or a pair of coordinates', t => /^\(.*,.*\)$/.test(t.trim())],
  ['a list of values or solutions (a comma)', t => /,/.test(t)],
  ['a trig, log or exponential statement', t => /sin|cos|tan|ln|log|exp/.test(t)],
  ['a root, a fraction of fractions or a power the page cannot read', t => /sqrt|\(\(.*\)\/\(.*\)\)/.test(t)],
  ['a bare number', t => /^-?[\d.]+$/.test(t.trim())],
  ['a bare expression with no equals sign', t => !t.includes('=')],
  ['a chain of two or more equals signs', t => (t.match(/=/g) || []).length >= 2],
  ['a single equation or statement', () => true]
];
/** The lines of his worked steps the deterministic report does not tick, by kind: counts and examples. Also steps with no readable line. */
export function unticked() { return inBankScope(untickedIn); }
function untickedIn() {
  const kinds = new Map(KINDS.map(([k]) => [k, { n: 0, ex: [] }]));
  const notes = {}, unread = {};
  let lines = 0, ticked = 0, parts = 0, stepsNoMath = 0, stepsMathUnread = 0, steps = 0;
  for (const { entry } of qbankEntries()) {
    if (entry.marks < 2) continue;
    const q = qbankEntryQuestion(entry.id, 17);
    parts++;
    for (const st of q.steps || []) {
      if (!isSchemeStep(st)) continue;
      steps++;
      const spans = [...String(st.d).replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)];
      if (!spans.length) stepsNoMath++;
      for (const m of spans) for (const piece of m[1].split(/\\Rightarrow|\\implies|\\therefore|\\text\{\s*(?:or|and)\s*\}/)) {
        if (texToPlain(piece) !== null) continue;
        const cmd = (piece.match(/\\(?!frac|dfrac|tfrac|sqrt|left|right|cdot|times|pi\b|sin\b|cos\b|tan\b|ln\b|log\b|exp\b|approx|simeq|leq?\b|geq?\b|neq?\b|div|infty|displaystyle|quad|qquad)[A-Za-z]+/) || ['(braces or layout)'])[0];
        const o = unread[cmd] || (unread[cmd] = { n: 0, ex: `${q._bank}: ${piece.slice(0, 70)}` }); o.n++;
      }
    }
    const L = bankAuthoredLines(q);
    const nSpans = (q.steps || []).filter(isSchemeStep).reduce((n, st) => n + [...String(st.d).replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)].length, 0);
    if (nSpans > L.length && L.length === 0) stepsMathUnread++;
    if (!L.length) continue;
    const rep = stepEvidence(q, WRONG, L.map(l => l.text).join('\n'), { correct: false }, { slipWarnings: true }).stepReport;
    (rep?.lines || []).forEach(l => {
      lines++;
      if (l.status === 'ok') { ticked++; return; }
      const k = KINDS.find(([, f]) => f(String(l.text)))[0];
      const o = kinds.get(k); o.n++; if (o.ex.length < 3) o.ex.push(`${q._bank}: ${l.text}`);
      const n = String(l.note || l.status).replace(/\d+(?:\.\d+)?/g, 'N').slice(0, 90);
      notes[n] = (notes[n] || 0) + 1;
    });
  }
  return { parts, lines, ticked, notTicked: lines - ticked, steps, stepsNoMath, partsWithMathNoneRead: stepsMathUnread, kinds: [...kinds].map(([k, v]) => ({ kind: k, ...v })).filter(v => v.n).sort((a, b) => b.n - a.n), unread: Object.entries(unread).sort((a, b) => b[1].n - a[1].n).slice(0, 6), notes: Object.entries(notes).sort((a, b) => b[1] - a[1]).slice(0, 6) };
}

// ── the reading of his TeX, step by step (the reader the generic rule uses: solutionMatch.spanToPlain over texToPlain, plainTex behind it) ─────────
const spanToPlain = _internals.spanToPlain;
// the bank is read in its own scope (solutionMatch.withBankReading); on a checkout that has none, this is a plain call
const inBankScope = fn => (_internals.withBankReading ? _internals.withBankReading(fn) : fn());
const WHY_OPTS = _internals.withBankReading ? EXTENDED_TEX : undefined;
const cutLikeSpan = t => String(t).split(/\\approx|\\simeq|\\Rightarrow|\\therefore|\\text|\\mathrm|\\mid/)[0];
/** Why a piece of his TeX was not read: the first command or layout the strict reader refused, or what else dropped it. */
function whyUnread(piece) {
  const r = texToPlainWhy(cutLikeSpan(piece).replace(/\\prime/g, "'"), WHY_OPTS);
  return r.plain ? 'filtered-after-reading' : r.why;
}
const NOTE = n => String(n || '').replace(/\d+(?:\.\d+)?/g, 'N').slice(0, 90);
const kindOf = text => KINDS.find(([, f]) => f(String(text)))[0];
/**
 * Every piece of every served bank part (all marks), as { id, step, tex, plain, by, why, status, note, kind } with the part's eligibility.
 * `by` is 'strict' (texToPlain), 'fallback' (plainTex) or null (not read). status/note are the deterministic report's, for the page of his own lines.
 */
export function texReading() { return inBankScope(texReadingIn); }
function texReadingIn() {
  const pieces = [], parts = [], elig = {};
  for (const r of eligibility().rows) elig[r.id] = r;
  for (const { entry, family } of qbankEntries()) {
    const q = qbankEntryQuestion(entry.id, 17);
    const mine = [];
    (q.steps || []).forEach((st, i) => {
      if (!isSchemeStep(st)) return;
      for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
        const tex = m[1].replace(/\\(?:approx|simeq)/g, '=');
        for (const piece of tex.split(/\\Rightarrow|\\implies|\\therefore|\\text\{\s*(?:or|and)\s*\}/)) {
          let p = null; try { p = spanToPlain(piece); } catch { p = null; }
          const strict = p ? texToPlainWhy(cutLikeSpan(piece), WHY_OPTS).plain : null;
          mine.push({ id: q._bank, step: i, tex: piece.trim(), plain: p, by: p ? (strict ? 'strict' : 'fallback') : null, why: p ? null : whyUnread(piece) });
        }
      }
    });
    const lines = authoredLines(q);
    const rep = lines.length ? stepEvidence(q, WRONG, lines.map(l => l.text).join('\n'), { correct: false }, { slipWarnings: true }).stepReport : null;
    // authoredLines drops a piece that reads to nothing; align each read piece with its report line in order
    const read = mine.filter(x => x.plain);
    const seq = (rep?.lines || []);
    read.forEach((x, k) => { const l = seq[k]; if (l) { x.status = l.status; x.note = l.status === 'ok' ? null : NOTE(l.note || l.status); x.kind = l.status === 'ok' ? null : kindOf(l.text); x.line = l.text; } });
    pieces.push(...mine);
    parts.push({ id: q._bank, family, group: groupOf(family), marks: entry.marks, pieces: mine.length, read: read.length, ticked: read.filter(x => x.status === 'ok').length, ...(elig[q._bank] || {}) });
  }
  return { pieces, parts };
}
const rank = (arr, key, ex) => { const m = new Map(); for (const x of arr) { const k = key(x); const o = m.get(k) || { k, n: 0, ex: null }; o.n++; if (!o.ex) o.ex = ex(x); m.set(k, o); } return [...m.values()].sort((a, b) => b.n - a.n); };
/** The figures that are compared before and after, by course, and the ranked tables. */
export function texSummary({ pieces, parts }) {
  const read = pieces.filter(x => x.plain), ticked = read.filter(x => x.status === 'ok');
  const byCourse = {};
  for (const p of parts) {
    const c = byCourse[p.group] || (byCourse[p.group] = { parts2: 0, eligible: 0, all: 0, pieces: 0, read: 0, ticked: 0 });
    c.pieces += p.pieces; c.read += p.read; c.ticked += p.ticked;
    if (p.marks >= 2) { c.parts2++; if (p.eligible) c.eligible++; if (p.all) c.all++; }
  }
  return {
    pieces: pieces.length, read: read.length, strict: read.filter(x => x.by === 'strict').length, ticked: ticked.length,
    readRate: +(read.length / pieces.length).toFixed(4), tickedShareOfRead: +(ticked.length / read.length).toFixed(4), tickedShareOfAll: +(ticked.length / pieces.length).toFixed(4),
    parts2: parts.filter(p => p.marks >= 2).length, eligible: parts.filter(p => p.marks >= 2 && p.eligible).length, all: parts.filter(p => p.marks >= 2 && p.all).length,
    byCourse,
    unreadByConstruct: rank(pieces.filter(x => !x.plain), x => x.why, x => `${x.id}: ${x.tex.slice(0, 80)}`).slice(0, 25),
    unreadByCommand: rank(pieces.filter(x => !x.plain).flatMap(x => (x.tex.match(/\\[A-Za-z]+/g) || ['(no command)']).filter((c, i, a) => a.indexOf(c) === i).map(c => ({ ...x, c }))), x => x.c, x => `${x.id}: ${x.tex.slice(0, 80)}`).slice(0, 25),
    unticked: rank(read.filter(x => x.status && x.status !== 'ok'), x => x.kind, x => `${x.id}: ${x.line}`),
    unnoted: rank(read.filter(x => x.status && x.status !== 'ok'), x => x.note, x => `${x.id}: ${x.line}`).slice(0, 12),
    notEligible: rank(parts.filter(p => p.marks >= 2 && !p.eligible), p => p.why, p => p.id)
  };
}
export function printTex(S) {
  console.log(`READING: ${S.read} of ${S.pieces} pieces of his TeX are read (${(100 * S.readRate).toFixed(1)}%; ${S.strict} by the strict reader, ${S.read - S.strict} by the plainTex fallback); ${S.ticked} ticked = ${(100 * S.tickedShareOfRead).toFixed(1)}% of read, ${(100 * S.tickedShareOfAll).toFixed(1)}% of all`);
  console.log(`ELIGIBILITY (parts worth 2+): ${S.eligible} of ${S.parts2} can pay a step; ${S.all} can pay all N-1`);
  for (const [k, v] of Object.entries(S.byCourse).sort()) console.log(`    ${k}: read ${v.read}/${v.pieces}, ticked ${v.ticked}; ${v.eligible}/${v.parts2} eligible, ${v.all} all N-1`);
  console.log('UNREAD, by reason (first construct the reader refused):');
  for (const r of S.unreadByConstruct) console.log(`    ${String(r.n).padStart(4)}  ${r.k}  e.g. ${r.ex}`);
  console.log('UNREAD, by every command present:');
  for (const r of S.unreadByCommand.slice(0, 16)) console.log(`    ${String(r.n).padStart(4)}  ${r.k}  e.g. ${r.ex}`);
  console.log('READ BUT UNTICKED, by kind:');
  for (const r of S.unticked) console.log(`    ${String(r.n).padStart(4)}  ${r.k}  e.g. ${r.ex}`);
  for (const r of S.unnoted) console.log(`    note ${String(r.n).padStart(4)}  ${r.k}  e.g. ${r.ex}`);
  console.log('PARTS THAT CANNOT PAY, by reason:');
  for (const r of S.notEligible) console.log(`    ${String(r.n).padStart(4)}  ${r.k}  e.g. ${r.ex}`);
}

export function printAll({ E, C, U }) {
  const s = E.summary;
  console.log(`(1) generic rule on the bank: ${s.eligible} of ${s.parts} parts worth 2+ marks can pay at least one step (${(100 * s.eligible / s.parts).toFixed(1)}%); ${s.all} can pay all N-1`);
  for (const [k, v] of Object.entries(s.by).sort()) console.log(`    ${k}: ${v.parts} parts, ${v.eligible} pay a step, ${v.all} all N-1`);
  for (const [k, n] of Object.entries(s.reasons).sort((a, b) => b[1] - a[1])) console.log(`    cannot pay: ${k} ${n}  e.g. ${s.examples[k].join(' | ')}`);
  console.log(`(3) both rules apply to ${C.parts} parts (${C.pages} pages): criteria rule paid more on ${C.criteriaMore}, generic more on ${C.genericMore}, same on ${C.same}; marks ${C.criteriaMarks} against ${C.genericMarks}; only the criteria rule paid on ${C.onlyCriteria}, only the generic rule on ${C.onlyGeneric}; parts only the criteria rule can pay ${C.onlyCriteriaParts}, only the generic rule ${C.onlyGenericParts}`);
  for (const e of C.examples) console.log('    DISAGREE', JSON.stringify(e).slice(0, 300));
  console.log(`(4) his ${U.lines} lines on ${U.parts} parts: ${U.ticked} ticked, ${U.notTicked} not. Steps with no $...$ line ${U.stepsNoMath} of ${U.steps}; parts whose maths I could not read at all ${U.partsWithMathNoneRead}`);
  for (const k of U.kinds) console.log(`    ${k.n}  ${k.kind}  e.g. ${k.ex.join(' | ')}`);
  for (const [k, v] of U.unread) console.log(`    TeX my reader cannot turn into a line: ${v.n}  ${k}  e.g. ${v.ex}`);
  for (const [n, c] of U.notes) console.log(`    note ${c}: ${n}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.env.PRI_EDITION = 'prithagoras';
  await ensureQbank(process.env, { strict: true });
  if (process.argv.includes('--tex')) {
    const R = texReading(), S = texSummary(R);
    printTex(S);
    const at = process.argv.indexOf('--dump');
    if (at > 0) fs.writeFileSync(process.argv[at + 1], JSON.stringify({ S, pieces: R.pieces, parts: R.parts }));
  } else printAll({ E: eligibility(), C: compare(), U: unticked() });
}
