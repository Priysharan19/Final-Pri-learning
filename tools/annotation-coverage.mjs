#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pri Learning · annotation coverage (Prithagoras edition, NSW Years 11-12 Advanced and Extension 1)
//
// Owner rule (26 Nov 2026): every question must support full step-by-step annotated marking (each line of working ticked or crossed with a
// reason, as the teacher-marked page shows), and no new question may be added without it. This tool MEASURES that; it changes nothing. The gate
// (server/test/annotation-coverage-gate-check.mjs) and the importer (tools/qbank-import.mjs) read it. Marking code is never edited here.
//
// A question is COVERED when its OWN worked solution, fed line by line through the same server marking path a typed or handwritten page uses
// (server/platform/markerOps.js MARKER_OPS.practice: the report the page shows, `shownReport`), read through the same page model the marked page
// uses (client/src/components/annotatedWorkingModel.js, markedPageModel.js, markedPageTeacher.js), gives:
//   TRUE HALF   every maths line is ticked and the class the engine gave it has a phrase (PHRASES); headings and the restated question are neutral;
//               zero maths lines are left unchecked; zero lines are crossed; the key typed as the answer is correct; and the final line is the
//               report's `answerLine`.
//   WRONG HALF  for the same question, a standard one-line mutation of a middle step (provably false by tools/marking-mutation-harness.mjs's own
//               evaluator) is crossed at exactly that line: not later, not earlier, not ticked, not missed.
// FULLY COVERED needs both halves. TRUE-ONLY has the first and not the second. Everything else is UNCOVERED.
//
// Scope: every NSW generator of Years 11-12 (y11, y12, me11, me12 in the issued ledger), at each issued difficulty, over the first
// GEN_SEED_SCAN seeds, grouped into FORMS (answer type + the headings of the worked steps), GEN_SEEDS_PER_FORM seeds marked per form; and every
// part of the committed question bank (server/content/qbank), the auto-marked ones and the worked-solution ones. Deterministic: fixed seeds,
// no model, no network, no clock.
//
//   node tools/annotation-coverage.mjs [--write] [--detail <path>] [--only generated|bank] [--ids a,b] [--quiet]
//     --write          write the committed summary and baseline (server/test/fixtures/annotation-coverage/)
//     --detail <path>  write the private per-question detail (ids, lines, statuses) to that path (never into the repository)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import '../server/test/support/hermetic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_QBANK_DIR;

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE_DIR = path.join(ROOT, 'server', 'test', 'fixtures', 'annotation-coverage');
export const SUMMARY_FILE = path.join(FIXTURE_DIR, 'summary.json');
export const BASELINE_FILE = path.join(FIXTURE_DIR, 'baseline.json');
export const GEN_SEED_SCAN = 200;       // seeds 1..200 of each issued cell are drawn to find its forms
export const GEN_SEEDS_PER_FORM = 2;    // the first two seeds of each form are marked
export const WRONG_SEED_ANSWER = '99991';
export const SCOPE = /^(y11|y12|me11|me12)-/;
export const STATUS = Object.freeze({ full: 'full', trueOnly: 'true-only', uncovered: 'uncovered' });

const { MARKER_OPS, markerView } = await import('../server/platform/markerOps.js');
const H = await import('./marking-mutation-harness.mjs');
const { buildAnnotatedWorking } = await import('../client/src/components/annotatedWorkingModel.js');
const { buildMarkedPage } = await import('../client/src/components/markedPageModel.js');
const { classOf, phraseOf } = await import('../client/src/components/markedPageTeacher.js');
const SM = await import('../client/src/engine/solutionMatch.js');
const EX = await import('../client/src/engine/expr.js');

export const markerViewOf = markerView;

// ── the world: generators, ledger, bank ──────────────────────────────────────
export async function loadWorld() {
  const G = await import('../client/src/engine/generators/index.js');
  const { NSW_BANK_LEDGER } = await import('../server/platform/nswBanks.js');
  await G.loadAllBanks();
  const pack = await import('../server/platform/qbankPack.js');
  await pack.ensureQbank({ ...process.env, PRI_EDITION: 'prithagoras' }, { strict: true });
  return { G, ledger: NSW_BANK_LEDGER, pack };
}

// ── reading the authored solution as a typed page ────────────────────────────
const TEX_SPAN = /\$([^$]+)\$/g;
const bankToPlain = span => (SM._internals.withBankReading ? SM._internals.withBankReading(() => SM._internals.spanToPlain(span)) : SM._internals.spanToPlain(span));
export const genToPlain = span => SM._internals.spanToPlain(span);

/**
 * The maths lines of a question's own worked solution, in order, as plain text (what a student's true working looks like). No filter by length or
 * shape: a line the page cannot read is counted (`unreadable`), never dropped silently. At most 40 lines (the marker reads no more).
 */
export function authoredLines(q, toPlain) {
  const lines = [];
  let unreadable = 0, spans = 0, firstUnreadable = null;
  for (const st of Array.isArray(q?.steps) ? q.steps : []) {
    for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(TEX_SPAN)) {
      for (const part of m[1].split(/\\(?:Rightarrow|Longrightarrow|therefore|implies)/)) {
        if (!part.trim()) continue;
        spans++;
        let plain = null;
        try { plain = toPlain(part); } catch { plain = null; }
        if (!plain || !String(plain).trim()) { unreadable++; firstUnreadable ||= part.trim(); continue; }
        plain = String(plain).trim();
        if (lines[lines.length - 1] !== plain) lines.push(plain);
      }
    }
  }
  return { lines: lines.slice(0, 40), unreadable, spans, firstUnreadable };
}

/** The key as a student types it into the answer box ('' when the question has none). */
export function keyText(q) {
  const a = q?.answer;
  if (!a) return '';
  switch (q.answerType) {
    case 'numeric': return a.simplestFraction && Number.isInteger(a.simplestFraction.n) && Number.isInteger(a.simplestFraction.d) ? `${a.simplestFraction.n}/${a.simplestFraction.d}` : a.value !== undefined ? String(a.value) : '';
    case 'expression': return a.expr !== undefined ? String(a.expr) : '';
    case 'set': return Array.isArray(a.values) ? a.values.map(String).join(', ') : '';
    case 'interval': return a.region !== undefined ? String(a.region) : '';
    case 'equation': return a.lhs !== undefined ? `${a.lhs} = ${a.rhs}` : '';
    case 'point': return a.x !== undefined ? `(${a.x}, ${a.y})` : '';
    case 'working': return a.canonicalWorking !== undefined ? String(a.canonicalWorking) : '';
    default: return '';
  }
}

// ── marking a page: the server's path, then the page's own model ─────────────
const CARD = { ok: 'checked', break: 'first-error' };
/**
 * Marks `lines` as the answer `answer` through the server's practice operation, and reads the report the page shows as the marked page does.
 * Returns { correct, cards: [{ status, cls, phrase, line }], answerLine, report } or null when the marker produced no line report.
 */
export function markPage(q, answer, lines) {
  let r;
  try { r = MARKER_OPS.practice({ q, answer, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {}); } catch { return null; }
  const rep = r?.evidence?.shownReport || r?.evidence?.stepReport || null;
  if (!rep || !Array.isArray(rep.lines)) return { correct: r?.result?.correct === true, cards: null, answerLine: -1, report: null };
  let cards = null;
  try {
    const model = buildAnnotatedWorking({ lines, stepReport: rep, page: true });
    if (model) { const page = buildMarkedPage({ model }); cards = page.lines.map(l => ({ status: l.status, cls: classOf(l.card), tick: l.card?.tickClass || null, text: l.card?.text ?? null })); }
  } catch { cards = null; }
  if (!cards) {
    // Fewer than two judged lines are not a page model: the same statuses read straight from the report line.
    cards = rep.lines.map(l => {
      const status = l.status === 'ok' ? 'checked' : l.status === 'break' ? 'first-error' : l.context === true ? 'condition' : 'not-verified';
      return { status, cls: status === 'checked' ? classOf({ ...l, status: 'checked' }) : null, tick: l.tickClass || null, text: l.text ?? null };
    });
  }
  return { correct: r.result?.correct === true, cards, answerLine: Number.isInteger(rep.answerLine) ? rep.answerLine : -1, report: rep };
}

// ── what shape a line is (for the cause of a line the page left unchecked) ───
export function shapeOf(text) {
  const t = String(text ?? '');
  const letters = (t.match(/[A-Za-z]{3,}/g) || []);
  const hasMaths = /[=+\-*/^<>≤≥∫]|\d/.test(t);
  if (/^\(?\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)?$/.test(t.replace(/\s+/g, ' ').trim())) return 'point or coordinate pair';
  if (!hasMaths || (letters.length >= 4 && !/[=<>≤≥∫]/.test(t))) return 'words-only reasoning';
  if (/∫|\bint\b|integral|\[[^\]]*\]_/.test(t)) return 'integration step';
  if (/\blim\b|→|->/.test(t)) return 'limit';
  if (/[<>≤≥]/.test(t.replace(/=>|->|<-/g, ''))) return 'inequality';
  if (/vec|\bi\b.*\bj\b|\|[a-z]\||<\s*-?\d[^>]*,[^>]*>|·|dot|cross/i.test(t)) return 'vectors';
  if (/\bP\s*\(|\bC\d|\d\s*C\s*\d|\bnCr\b|\bnPr\b|choose|binom|!|\bPr\b|E\s*\(|Var\s*\(|\bN\s*\(/.test(t)) return 'probability or counting';
  if (/\b(ln|log)\b/i.test(t)) return 'log law';
  if (/\b(sin|cos|tan|sec|cosec|csc|cot)\b|\bpi\b|π|°/i.test(t)) return 'trig step';
  if (/\be\s*\^|\bexp\b/.test(t)) return 'exponential step';
  if (/dy\s*\/\s*dx|d\^?2?y|\bf'|\by'|d\/dx|\bu'|\bv'|\bg'/.test(t)) return 'differentiation step';
  if (/Σ|\bsum\b|\bS_|\bT_|\bu_n|\bt_n|_n\b/.test(t)) return 'series or sequence';
  if (/\bsqrt\b|√/.test(t)) return 'surd step';
  if (/=/.test(t)) return 'algebra equation';
  return 'algebra expression';
}

/** Why a span of the authored solution cannot be typed as a line: the first TeX command in it that the reader does not know, or its shape. */
export function unreadableCause(tex) {
  const cmd = /\\([A-Za-z]+)/.exec(String(tex ?? ''));
  const known = new Set(['dfrac', 'frac', 'times', 'cdot', 'left', 'right', 'sqrt', 'pi', 'sin', 'cos', 'tan', 'ln', 'log', 'text', 'quad', 'qquad', 'Rightarrow', 'therefore']);
  const all = [...String(tex ?? '').matchAll(/\\([A-Za-z]+)/g)].map(m => m[1]).filter(c => !known.has(c));
  return `TeX not readable as a typed line (${all.length ? `\\${all[0]}` : cmd ? `\\${cmd[1]}` : 'plain symbols'})`;
}

const QUESTION_BUCKET = { mcq: 'multiple-choice (no working page)', 'multi-mcq': 'multiple-choice (no working page)', 'matrix-match': 'multiple-choice (no working page)' };

/**
 * The true half. `q` is the marker's view of the question, `lines` its authored lines, `answer` its key as typed.
 * Returns { ok, cause, at, text, answerHalf, linesHalf, statuses[] }.
 */
export function trueHalf(q, lines, answer, { unreadable = 0, worked = false, firstUnreadable = null } = {}) {
  const out = (cause, at = -1, extra = {}) => ({ ok: false, cause, at, text: at >= 0 ? lines[at] : null, linesHalf: false, answerHalf: false, statuses: [], ...extra });
  if (QUESTION_BUCKET[q.answerType]) return out(QUESTION_BUCKET[q.answerType]);
  if (!lines.length) return out(q.answerType === 'working' ? 'proof' : q.answerType === 'manual' ? `worked solution (${q._worked || 'find'}) with no maths lines` : 'no maths lines in the worked solution (words only)');
  if (unreadable) return out(unreadableCause(firstUnreadable), -1, { unreadable, text: firstUnreadable });
  const m = markPage(q, worked ? '' : answer, lines);
  if (!m || !m.cards) return out('no line report from the marker');
  if (m.cards.length !== lines.length) return out('report does not judge every line', -1, { judged: m.cards.length });
  const statuses = m.cards.map(c => c.status);
  const cross = statuses.indexOf('first-error');
  if (cross >= 0) return out('true line crossed', cross, { statuses, shape: shapeOf(lines[cross]) });
  const open = m.cards.findIndex(c => c.status !== 'checked' && c.status !== 'condition');
  if (open >= 0) return out(shapeOf(lines[open]), open, { statuses, unchecked: true });
  const noPhrase = m.cards.findIndex(c => c.status === 'checked' && !phraseOf(c.cls));
  if (noPhrase >= 0) return out(`tick without a phrase (${m.cards[noPhrase].tick || 'no class'})`, noPhrase, { statuses });
  const weak = m.cards.filter(c => c.status === 'checked' && c.cls === 'trueAsWritten').length;
  // the lines half is met; now the answer. A worked-solution question has no key and no mark, so there is no answer line to recognise: that half does not apply.
  if (worked) return { ok: true, cause: null, at: -1, text: null, linesHalf: true, answerHalf: true, answerNA: true, statuses, weak };
  if (m.correct !== true) return { ok: false, cause: 'the key typed is not marked correct', at: lines.length - 1, text: lines[lines.length - 1], linesHalf: true, answerHalf: false, statuses, weak };
  if (m.answerLine !== lines.length - 1) return { ok: false, cause: `answer line not recognised (${q.answerType})`, at: lines.length - 1, text: lines[lines.length - 1], linesHalf: true, answerHalf: false, statuses, weak, answerLine: m.answerLine };
  return { ok: true, cause: null, at: -1, text: null, linesHalf: true, answerHalf: true, statuses, weak };
}

const squash = s => String(s).replace(/\s+/g, '').toLowerCase();

// A mutant is PROVABLY FALSE ON ITS OWN when two neighbouring sides of one `=` chain are plain numbers (no letter, no function, no constant) that
// disagree by more than any rounding could explain: `Δ = (8)^2 - 4(-3)(3) = 49 - (-36)`. Most other mutants of a worked line (`3x - 18 = 8x - 8`
// for `4x - 18 = ...`, `x = 4` for `x = 3`, `h = 5(2)^2 + ...`) are false only against the lines around them, and the engine rightly keeps a line of
// that kind as a note: it may be a different equation (another part), a different value, or a step to another form. Such a mutant is not a test
// of the engine (it would be a test that the engine knows the question), so the wrong half is first tried on a line whose mutant is false by itself.
const NAMED_FN = /(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|sqrt|exp|arcsin|arccos|arctan|abs)(?![A-Za-z])/;
const bareNumber = x => /^-?\d+(?:\.\d+)?$/.test(String(x).replace(/\s+/g, ''));
const unitOf = x => { const t = String(x).replace(/\s+/g, '').replace(/^-/, ''); return t.includes('.') ? 10 ** -(t.split('.')[1].length) : 10 ** ((/[1-9](0+)$/.exec(t) || [0, ''])[1].length); };
export function falseOnItsOwn(text) {
  const t = String(text);
  if (/[<>≤≥≈≠,;:!]|\bpi\b|π|\be\b/.test(t.replace(/\be\^/g, '')) || NAMED_FN.test(t) || /[A-Za-z]{2,}/.test(t.replace(/\b(?:sqrt)\b/g, ''))) return false;
  let sides;
  try { sides = H.sidesOf(t); } catch { return false; }
  if (sides.length < 2 || sides.some(x => !x)) return false;
  // the first side may be the name of the chain (one letter, with a subscript): the sides after it are the claim
  const claim = sides.length >= 3 && /^[A-Za-zΔΣθαβφλμσ](?:_\{?[A-Za-z0-9]{1,3}\}?)?$/.test(sides[0]) ? sides.slice(1) : sides;
  if (claim.length < 2 || claim.some(x => H.lettersIn(x).length)) return false;
  // a bare number in front of worked sides is margin work to the engine (never a cross)
  if (bareNumber(claim[0]) && claim.slice(1).some(x => !bareNumber(x))) return false;
  const vals = claim.map(x => { const v = H.sideValues(x, []); return v && v[0] !== null ? v[0] : null; });
  if (vals.some(v => v === null)) return false;
  for (let k = 0; k + 1 < claim.length; k++) {
    if (Math.abs(vals[k] - vals[k + 1]) <= 1e-9 * Math.max(1, Math.abs(vals[k]), Math.abs(vals[k + 1]))) continue;
    const bares = [claim[k], claim[k + 1]].filter(bareNumber);
    if (bares.length === 2) continue;   // two bare numbers: words lost in reading, not a sum
    if (!/\d\.\d|^\.\d/.test(claim.join(' '))) return true;   // no decimal on the line: no rounding is in play
    const places = [...`${claim[k]} ${claim[k + 1]}`.matchAll(/\d*\.(\d+)/g)].map(m => m[1].length);
    const band = bares.length ? Math.min(...bares.map(unitOf)) : places.length ? 10 ** -Math.min(...places) : 0;
    if (Math.abs(vals[k] - vals[k + 1]) > band * (1 + 1e-9)) return true;
  }
  return false;
}

// A mutant of an equation in one letter is provably false GIVEN THE PAGE when its real solutions (found here by scanning, not by the engine's exact
// roots) are neither a part of, nor hold, the solutions of any equation of that letter in the four lines above it, and at least one of those is not a
// bare value (`x = 3`): it contradicts the line it was derived from. A mutant that keeps the same solutions (`7(x - 1)(x - 7) = 0` for `6(x - 1)(x - 7) = 0`)
// is still true, and is dropped as a tool artefact.
const oneEquation = text => {
  const t = String(text).replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/\s*[.;]\s*$/, '');
  if (/[<>≤≥≠≈,;:±%°]|[A-Za-z]{2,}/.test(t.replace(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g, '#')) || (t.match(/=/g) || []).length !== 1) return null;
  const [l, r] = t.split('=').map(x => x.trim());
  if (!l || !r) return null;
  let a, b;
  try { a = EX.parse(EX.normalize(l)); b = EX.parse(EX.normalize(r)); } catch { return null; }
  const vars = [...new Set([...EX.variablesOf(a), ...EX.variablesOf(b)])];
  if (vars.length !== 1 || vars[0] === 'e') return null;
  const v = vars[0];
  const f = x => { try { const p = EX.evaluate(a, { [v]: x }), q = EX.evaluate(b, { [v]: x }); return Number.isFinite(p) && Number.isFinite(q) ? p - q : NaN; } catch { return NaN; } };
  const roots = [];
  let prevX = -60, prevY = f(prevX);
  for (let x = -59.95; x <= 60.0001; x += 0.05) {
    const y = f(x);
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      if (Math.abs(y) < 1e-12) { if (!roots.some(z => Math.abs(z - x) < 0.02)) roots.push(x); }
      else if (prevY * y < 0) { let lo = prevX, hi = x, flo = prevY; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, fm = f(mid); if (!Number.isFinite(fm)) break; if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } } const z = (lo + hi) / 2; if (!roots.some(w => Math.abs(w - z) < 0.02)) roots.push(z); }
    }
    prevX = x; prevY = y;
  }
  if (!roots.length || roots.length > 6) return null;
  const bare = (/^[A-Za-z]$/.test(l) && !/[A-Za-z]/.test(r)) || (/^[A-Za-z]$/.test(r) && !/[A-Za-z]/.test(l));
  return { v, roots: roots.sort((x, y) => x - y), bare };
};
const rootIn = (set, x) => set.some(y => Math.abs(x - y) <= 1e-4 * Math.max(1, Math.abs(x)));
const related = (p, q) => p.every(x => rootIn(q, x)) || q.every(x => rootIn(p, x));
export function contradictsLineAbove(lines, i, text) {
  const B = oneEquation(text);
  if (!B) return false;
  const recent = [];
  for (let k = Math.max(0, i - 4); k < i; k++) { const e = oneEquation(lines[k]); if (e && e.v === B.v) recent.push(e); }
  return recent.some(r => !r.bare) && recent.every(r => !related(B.roots, r.roots));
}
/** True when the mutant is provably false given the page: false by itself, or contradicting the equation(s) above it. */
export const provableGivenPage = (lines, i, text) => falseOnItsOwn(text) || contradictsLineAbove(lines, i, text);

/** Up to two one-line mutants of the line that are provably false given the page, different kinds first. */
export function mutantsOf(lines, i) {
  const line = lines[i];
  const others = new Set(lines.filter((_, j) => j !== i).map(squash));
  const all = [];
  try { for (const m of H.mutationsOf(line)) { if (!others.has(squash(m.text)) && H.judgeMutant(line, m.text) === 'wrong' && provableGivenPage(lines, i, m.text)) all.push(m); } } catch { return []; }
  const picked = [], kinds = new Set();
  for (const m of all) if (!kinds.has(m.kind)) { picked.push(m); kinds.add(m.kind); if (picked.length === 2) return picked; }
  for (const m of all) if (!picked.includes(m)) { picked.push(m); if (picked.length === 2) break; }
  return picked;
}

/** The middle-most line that has a mutant provably false given the page: for three or more lines the interior ones (the middle first), else the lines in order. */
export function chooseMutantLine(lines) {
  const n = lines.length;
  const order = n >= 3 ? [...Array(n - 2).keys()].map(k => k + 1).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || a - b) : [...Array(n).keys()];
  for (const i of order) { const ms = mutantsOf(lines, i); if (ms.length) return { i, mutants: ms }; }
  return null;
}

/** The wrong half. Returns { ok, cause, at, text, mutants[] }. */
export function wrongHalf(q, lines, { unreadable = 0, firstUnreadable = null } = {}) {
  const fail = (cause, at = -1, extra = {}) => ({ ok: false, cause, at, text: at >= 0 ? lines[at] : null, ...extra });
  if (QUESTION_BUCKET[q.answerType]) return fail(QUESTION_BUCKET[q.answerType]);
  if (!lines.length) return fail('no maths lines in the worked solution');
  if (unreadable) return fail(unreadableCause(firstUnreadable));
  const pick = chooseMutantLine(lines);
  if (!pick) return fail('no provable one-line mutation of any step');
  const tried = [];
  for (const m of pick.mutants) {
    const page = lines.map((l, j) => (j === pick.i ? m.text : l));
    const typed = q.answerType === 'working' ? String(page[page.length - 1]) : WRONG_SEED_ANSWER;
    const r = markPage(q, q._bankWorked ? '' : typed, page);
    const cards = r?.cards;
    const first = cards ? cards.findIndex(c => c.status === 'first-error') : -2;
    const verdict = !cards ? 'no report' : first === pick.i ? 'crossed here' : first < 0 ? (cards[pick.i]?.status === 'checked' ? 'ticked' : 'missed') : first > pick.i ? 'crossed later' : 'crossed earlier';
    tried.push({ kind: m.kind, text: m.text, verdict });
  }
  const bad = tried.find(t => t.verdict !== 'crossed here');
  if (bad) return fail(`wrong step ${bad.verdict}`, pick.i, { mutants: tried });
  return { ok: true, cause: null, at: pick.i, text: lines[pick.i], mutants: tried };
}

/** Both halves of one question, as a record. */
export function measureQuestion(q, { toPlain, worked = false } = {}) {
  const { lines, unreadable, firstUnreadable } = authoredLines(q, toPlain);
  const answer = worked ? '' : keyText(q);
  let t, w;
  try { t = trueHalf(q, lines, answer, { unreadable, worked, firstUnreadable }); } catch (e) { t = { ok: false, cause: 'marker error', at: -1, text: null, linesHalf: false, answerHalf: false, statuses: [] }; }
  try { w = wrongHalf(q, lines, { unreadable, firstUnreadable }); } catch (e) { w = { ok: false, cause: 'marker error', at: -1, text: null }; }
  return { lines, t, w };
}

const statusOf = (t, w) => (t.ok && w.ok ? STATUS.full : t.ok ? STATUS.trueOnly : STATUS.uncovered);

// ── the generated side ───────────────────────────────────────────────────────
const formKeyOf = q => `${q.answerType}|${(q.steps || []).map(s => String(s?.h ?? '').replace(/\d+(?:\.\d+)?/g, 'N')).join('>')}`;
const shortHash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 7);

/** [{ generator, difficulty, key, hash, seeds[] }] over the issued Years 11-12 cells. */
export function generatedForms(W, { generators = null } = {}) {
  const out = [];
  for (const e of W.ledger) {
    if (!SCOPE.test(e.generator) || (generators && !generators.includes(e.generator))) continue;
    for (const c of e.cells) {
      if (!c.issued) continue;
      const forms = new Map();
      for (let s = 1; s <= GEN_SEED_SCAN; s++) {
        let q; try { q = W.G.generateQuestion(e.generator, c.difficulty, s); } catch { continue; }
        if (!q || typeof q.prompt !== 'string') continue;
        const key = formKeyOf(q);
        const f = forms.get(key) || forms.set(key, { generator: e.generator, difficulty: c.difficulty, key, hash: shortHash(key), seeds: [] }).get(key);
        if (f.seeds.length < GEN_SEEDS_PER_FORM) f.seeds.push(s);
      }
      // two different keys could share a hash prefix; they are told apart by an ordinal
      const used = new Map();
      for (const f of forms.values()) { const n = used.get(f.hash) || 0; used.set(f.hash, n + 1); f.id = `gen:${f.generator}:d${f.difficulty}:${f.hash}${n ? `-${n}` : ''}`; out.push(f); }
    }
  }
  return out;
}

export function measureGeneratedForm(W, form) {
  const per = [];
  for (const seed of form.seeds) {
    const q0 = W.G.generateQuestion(form.generator, form.difficulty, seed);
    const q = markerView({ ...q0, _marking: 'final-answer-only' });
    per.push({ seed, q: q0, ...measureQuestion(q, { toPlain: genToPlain }) });
  }
  // a form is covered only when every seed marked is
  const worstT = per.find(p => !p.t.ok), worstW = per.find(p => !p.w.ok);
  const t = worstT ? worstT.t : per[0].t, w = worstW ? worstW.w : per[0].w;
  const first = worstT || worstW || per[0];
  return { id: form.id, kind: 'generated', topic: form.generator, dp: first.q.dotpoint || (first.q.dotpoints || []).join('+') || 'none', difficulty: form.difficulty, answerType: first.q.answerType, status: statusOf(t, w), t, w, seeds: form.seeds, samples: per.map(p => ({ seed: p.seed, lines: p.lines, statuses: p.t.statuses })) };
}

// ── the bank side ────────────────────────────────────────────────────────────
export function measureBankEntry(W, entry, family, { worked = false } = {}) {
  const q = markerView(worked ? W.pack.qbankManualQuestion(entry.id, 17) : W.pack.qbankEntryQuestion(entry.id, 17));
  const { t, w, lines } = measureQuestion({ ...q, ...(worked ? { _bankWorked: true } : {}) }, { toPlain: bankToPlain, worked });
  return { id: entry.id, kind: worked ? 'bank-worked' : 'bank', topic: family.replace(/^qb-/, ''), dp: entry.dp, difficulty: entry.level, answerType: q.answerType, status: statusOf(t, w), t, w, samples: [{ seed: 17, lines, statuses: t.statuses }] };
}

export function bankEntriesOf(W) {
  const out = [];
  for (const { entry, family, place } of W.pack.qbankEntries()) out.push({ entry, family, worked: false, place });
  for (const { entry, family, place } of W.pack.qbankManualEntries()) out.push({ entry, family, worked: true, place });
  return out;
}

export async function measureAll({ only = null, ids = null, onProgress = null } = {}) {
  const W = await loadWorld();
  const records = [];
  if (!only || only === 'generated') {
    const forms = generatedForms(W);
    let n = 0;
    for (const f of forms) { if (ids && !ids.includes(f.id)) continue; records.push(measureGeneratedForm(W, f)); if (onProgress && ++n % 200 === 0) onProgress('generated', n, forms.length); }
  }
  if (!only || only === 'bank') {
    const list = bankEntriesOf(W);
    let n = 0;
    for (const b of list) {
      if (ids && !ids.includes(b.entry.id)) continue;
      if (!b.place) { records.push({ id: b.entry.id, kind: b.worked ? 'bank-worked' : 'bank', topic: b.family.replace(/^qb-/, ''), dp: b.entry.dp, difficulty: b.entry.level, answerType: b.entry.answerType, status: STATUS.uncovered, t: { ok: false, cause: 'placed nowhere (not served)', at: -1, text: null, statuses: [] }, w: { ok: false, cause: 'placed nowhere (not served)', at: -1, text: null }, samples: [] }); continue; }
      records.push(measureBankEntry(W, b.entry, b.family, { worked: b.worked }));
      if (onProgress && ++n % 500 === 0) onProgress('bank', n, list.length);
    }
  }
  return records;
}

// ── the outputs ──────────────────────────────────────────────────────────────
/** The primary cause of a record that is not fully covered. */
export const causeOf = r => (r.status === STATUS.full ? null : !r.t.ok ? r.t.cause : r.w.cause);

const bump = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; };
const blank = () => ({ total: 0, full: 0, trueOnly: 0, uncovered: 0 });
const add = (o, r) => { o.total++; if (r.status === STATUS.full) o.full++; else if (r.status === STATUS.trueOnly) o.trueOnly++; else o.uncovered++; };
const pct = (n, d) => (d ? Math.round((n / d) * 10000) / 100 : 0);

export function summarise(records) {
  const total = blank(), byKind = {}, byTopic = {}, byDotpoint = {}, causes = {}, wrongCauses = {};
  let trueOk = 0, wrongOk = 0, linesOk = 0, answerOk = 0, answerNA = 0, weakTicks = 0;
  for (const r of records) {
    add(total, r); add(byKind[r.kind] ||= blank(), r); add(byTopic[`${r.kind === 'generated' ? 'gen' : 'bank'}:${r.topic}`] ||= blank(), r); add(byDotpoint[`${r.kind === 'generated' ? 'gen' : 'bank'}:${r.dp}`] ||= blank(), r);
    if (r.t.ok) trueOk++; if (r.w.ok) wrongOk++; if (r.t.linesHalf) linesOk++; if (r.t.answerNA) answerNA++; else if (r.t.answerHalf) answerOk++;
    if (r.t.weak) weakTicks += r.t.weak;
    const c = causeOf(r);
    if (c) { const e = causes[c] || (causes[c] = { count: 0, example: null, byKind: {} }); e.count++; bump(e.byKind, r.kind); if (!e.example && (r.t.text || r.w.text)) e.example = { id: r.id, line: r.t.ok ? r.w.text : r.t.text }; }
    if (!r.w.ok) bump(wrongCauses, r.w.cause);
  }
  const rank = Object.entries(causes).sort((a, b) => b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1));
  const rate = o => ({ ...o, fullPct: pct(o.full, o.total), trueOnlyPct: pct(o.trueOnly, o.total), uncoveredPct: pct(o.uncovered, o.total) });
  const sortKeys = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, rate(o[k])]));
  return {
    format: 'pri-annotation-coverage-v1',
    scope: { edition: 'prithagoras', generated: `NSW generators y11, y12, me11, me12 (every issued difficulty), seeds 1-${GEN_SEED_SCAN} grouped into forms, the first ${GEN_SEEDS_PER_FORM} seeds of each form marked`, bank: 'every part of server/content/qbank: auto-marked parts and worked-solution parts' },
    definition: 'covered = own worked solution, line by line through the server marking path: every maths line ticked with a class that has a phrase, headings and the restated question neutral, none unchecked, none crossed, and (for a question with a key) the key marked correct and the final line the report\'s answerLine (true half); and a one-line mutation of a middle step crossed at that line (wrong half)',
    units: 'a generated unit is a form (answer type and step headings) of a generator at a difficulty; a bank unit is one part',
    total: rate(total),
    halves: { trueHalfPasses: trueOk, trueHalfPassPct: pct(trueOk, total.total), wrongHalfPasses: wrongOk, wrongHalfPassPct: pct(wrongOk, total.total), allLinesTickedAndNoneCrossed: linesOk, allLinesPct: pct(linesOk, total.total), answerLineRecognisedAndKeyCorrect: answerOk, answerLineOfKeyedUnits: total.total - answerNA, answerLinePct: pct(answerOk, total.total - answerNA), answerHalfNotApplicableNoKey: answerNA, linesTickedOnlyAsTrueAsWritten: weakTicks },
    byKind: sortKeys(byKind),
    causes: Object.fromEntries(rank.map(([k, v]) => [k, v])),
    wrongHalfFailures: Object.fromEntries(Object.entries(wrongCauses).sort((a, b) => b[1] - a[1])),
    byTopic: sortKeys(byTopic),
    byDotpoint: sortKeys(byDotpoint)
  };
}

// ── the ratchet ──────────────────────────────────────────────────────────────
export function loadBaseline(file = BASELINE_FILE) {
  const b = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (b.format !== 'pri-annotation-baseline-v1' || !Array.isArray(b.causes) || !b.ids || typeof b.ids !== 'object') throw new Error(`${file} is not an annotation baseline`);
  return b;
}
const CODE = { t: STATUS.trueOnly, u: STATUS.uncovered };
/**
 * What the measured records say against the committed baseline. Violations (each { kind, id, message }):
 *   new-uncovered   a unit not on the baseline that is not fully covered (the message carries its first unchecked line)
 *   now-covered     a baseline id that is fully covered now: it must be removed, so the ratchet is exact
 *   status-moved    a baseline id whose status is not the one recorded (it improved or worsened: refresh the baseline)
 *   gone            a baseline id the measure no longer finds (a removed question): it must leave the list
 */
export function compareToBaseline(records, baseline) {
  const violations = [];
  const seen = new Set();
  for (const r of records) {
    seen.add(r.id);
    const rec = baseline.ids[r.id];
    if (rec === undefined) {
      if (r.status !== STATUS.full) {
        const line = r.t.ok ? r.w : r.t;
        violations.push({ kind: 'new-uncovered', id: r.id, message: `${r.id} is not fully covered (${r.status}: ${causeOf(r)}); first line at issue: ${line.text === null || line.text === undefined ? '(none: the cause is not a line)' : `line ${line.at + 1}: ${String(line.text).slice(0, 120)}`}` });
      }
    } else if (r.status === STATUS.full) violations.push({ kind: 'now-covered', id: r.id, message: `${r.id} is fully covered now: remove it from the baseline (node tools/annotation-coverage.mjs --write)` });
    else if (CODE[rec[0]] !== r.status) violations.push({ kind: 'status-moved', id: r.id, message: `${r.id} is ${r.status}, the baseline says ${CODE[rec[0]]}: refresh the baseline (node tools/annotation-coverage.mjs --write)` });
  }
  for (const id of Object.keys(baseline.ids)) if (!seen.has(id)) violations.push({ kind: 'gone', id, message: `${id} is on the baseline and no longer exists: remove it` });
  return violations;
}
/** The baseline may only shrink: ids in `now` that are not in `base` (the branch it merges into). */
export function ratchetViolations(now, base) {
  return Object.keys(now.ids).filter(id => base.ids[id] === undefined).map(id => ({ kind: 'baseline-grew', id, message: `${id} was added to the annotation baseline; the baseline may only shrink` }));
}

export const SHORT = { [STATUS.trueOnly]: 't', [STATUS.uncovered]: 'u' };
/** The compact per-id baseline: every unit that is not fully covered, with its status and primary cause. Fully covered ids are not listed. */
export function baselineOf(records) {
  const causes = [];
  const ids = {};
  for (const r of records.slice().sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (r.status === STATUS.full) continue;
    const c = causeOf(r) || '';
    let k = causes.indexOf(c); if (k < 0) { causes.push(c); k = causes.length - 1; }
    ids[r.id] = `${SHORT[r.status]}${k}`;
  }
  return { format: 'pri-annotation-baseline-v1', note: 'Units of the annotation-coverage measure that are NOT fully covered. An id may only leave this list (when it becomes covered, and then it MUST leave); none may join it. Status: t = true half only, u = uncovered; the number is the index into causes. Regenerate: node tools/annotation-coverage.mjs --write', causes, ids };
}

export function detailOf(records) {
  return { format: 'pri-annotation-detail-v1', private: true, records: records.map(r => ({ id: r.id, kind: r.kind, topic: r.topic, dp: r.dp, difficulty: r.difficulty, answerType: r.answerType, status: r.status, trueHalf: { ok: r.t.ok, linesHalf: r.t.linesHalf, answerHalf: r.t.answerHalf, cause: r.t.cause, at: r.t.at, text: r.t.text }, wrongHalf: { ok: r.w.ok, cause: r.w.cause, at: r.w.at, text: r.w.text, mutants: r.w.mutants }, seeds: r.seeds, samples: r.samples })) };
}

export const printable = s => {
  const lines = [];
  const t = s.total;
  lines.push(`units ${t.total}: fully covered ${t.full} (${t.fullPct}%), true half only ${t.trueOnly} (${t.trueOnlyPct}%), uncovered ${t.uncovered} (${t.uncoveredPct}%)`);
  for (const [k, v] of Object.entries(s.byKind)) lines.push(`  ${k}: ${v.total} units, fully covered ${v.full} (${v.fullPct}%), true half only ${v.trueOnly} (${v.trueOnlyPct}%), uncovered ${v.uncovered} (${v.uncoveredPct}%)`);
  const h = s.halves;
  lines.push(`halves: true half ${h.trueHalfPasses} (${h.trueHalfPassPct}%), wrong half ${h.wrongHalfPasses} (${h.wrongHalfPassPct}%), all lines ticked and none crossed ${h.allLinesTickedAndNoneCrossed} (${h.allLinesPct}%), answer line recognised and key correct ${h.answerLineRecognisedAndKeyCorrect} of ${h.answerLineOfKeyedUnits} keyed units (${h.answerLinePct}%; ${h.answerHalfNotApplicableNoKey} worked-solution units have no key)`);
  return lines.join('\n');
};

// ── command line ─────────────────────────────────────────────────────────────
function insideRepo(p) { const rel = path.relative(ROOT, path.resolve(p)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }

export async function main(argv) {
  const flag = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
  const only = flag('only');
  if (only && !['generated', 'bank'].includes(only)) { console.error('--only is generated or bank'); return 2; }
  if (flag('detail') && insideRepo(flag('detail'))) { console.error(`refusing to write the private detail inside the repository: ${flag('detail')}`); return 2; }
  if (argv.includes('--write') && only) { console.error('--write measures the whole scope; do not combine it with --only'); return 2; }
  const t0 = Date.now();
  const records = await measureAll({ only, ids: flag('ids') ? flag('ids').split(',') : null, onProgress: argv.includes('--quiet') ? null : (k, n, of) => process.stderr.write(`  ${k} ${n}/${of}\n`) });
  const summary = summarise(records);
  if (!argv.includes('--quiet')) {
    console.log(printable(summary));
    console.log('top causes:');
    for (const [k, v] of Object.entries(summary.causes).slice(0, 12)) console.log(`  ${String(v.count).padStart(5)}  ${k}${v.example ? `   e.g. ${v.example.id}: ${String(v.example.line).slice(0, 80)}` : ''}`);
    console.log(`measured in ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  if (flag('detail')) { fs.mkdirSync(path.dirname(path.resolve(flag('detail'))), { recursive: true }); fs.writeFileSync(flag('detail'), JSON.stringify(detailOf(records)) + '\n'); }
  if (argv.includes('--write')) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 1) + '\n');
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselineOf(records)) + '\n');
    console.log(`wrote ${path.relative(ROOT, SUMMARY_FILE)} (${fs.statSync(SUMMARY_FILE).size} bytes) and ${path.relative(ROOT, BASELINE_FILE)} (${fs.statSync(BASELINE_FILE).size} bytes)`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
