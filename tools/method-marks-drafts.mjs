// Draft per-criterion method-mark schemes for NSW question types, written for the author
// (the tutor who writes the papers) to review and correct.
//
//   node tools/method-marks-drafts.mjs            write owner-review/method-marks/*
//   node tools/method-marks-drafts.mjs --check    fail when the committed files differ from the generated ones
//
// Nothing here approves, signs or switches anything on. It reads the engine and the line
// interpreter; it never edits them. Deterministic: fixed seeds, no clock, no model, no network.
//
// The criteria, and the award, are the server's own (server/platform/schemeAward.js): each worked award below is produced by the same
// function that pays a student, from the same step report the marked page shows. A type gets a scheme only when, on every sample
// question, that award is the full marks for a full transcript, nothing for a zero transcript, and strictly between for a partial
// one. A type that fails that run, or that the page cannot verify line by line, is listed as "could not be given a provable scheme".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../client/src/engine/generators/index.js';
import { stepMetaFor, stepEvidence } from '../server/platform/markerOps.js';
import { checkAnswer } from '../client/src/engine/checker.js';
import { publicDescription } from '../server/platform/lineInterpreter/givens.js';
import { makeFn, polynomial, extremes } from '../server/platform/lineInterpreter/truth.js';
import { SCHEMES, UNAVAILABLE, schemeDigest, awardScheme } from '../server/platform/schemeAward.js';
import { transcriptsFor } from './understanding-audit/corpus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_DIR = path.join(ROOT, 'owner-review', 'method-marks');
// The packets the owner reads (docs/marking/method-marks-signoff/READ-ME-method-marks-signoff.md links here; the owner copies the folder into his private owner-actions): the same files, without the machine-readable types.json.
export const OWNER_DIR = path.join(ROOT, 'docs', 'marking', 'method-marks-signoff', 'method-marks');
export const ownerFiles = files => new Map([...files].filter(([name]) => name.endsWith('.md')));
export const BANNER = "DRAFT for the author's review: not approved. Nothing in this file is switched on.";
const SAMPLES_PER_TYPE = 3;
const SEED_LIMIT = 80;

// ── small helpers ───────────────────────────────────────────────────────────
const plain = s => String(s ?? '').replace(/—/g, ', ').replace(/–/g, '-');
const num = v => { const r = Math.round(v * 1e6) / 1e6; return String(Object.is(r, -0) ? 0 : r); };
const descOf = q => publicDescription(q);
const fnOf = q => { const f = descOf(q).functions; return f.length === 1 ? makeFn(f[0]) : null; };

function polyText(co, v = 'x') {
  const parts = [];
  for (let i = co.length - 1; i >= 0; i--) {
    const c = co[i];
    if (!c) continue;
    const mag = Math.abs(c);
    const body = i === 0 ? num(mag) : `${mag === 1 ? '' : num(mag)}${v}${i > 1 ? `^${i}` : ''}`;
    parts.push({ neg: c < 0, body });
  }
  if (!parts.length) return '0';
  return parts.map((p, k) => (k === 0 ? (p.neg ? '-' : '') : (p.neg ? ' - ' : ' + ')) + p.body).join('');
}
const derivCo = co => co.slice(1).map((c, i) => c * (i + 1));
const bumpTop = d => { const b = d.slice(); const k = b.findLastIndex(c => c !== 0); b[k] += 1; return b; };
const evalCo = (co, x) => co.reduce((a, c, i) => a + c * x ** i, 0);

function humanKey(q) {
  const a = q.answer || {};
  if (q.answerType === 'expression') return String(a.expr);
  if (q.answerType === 'numeric') return num(a.value);
  if (q.answerType === 'set') return (a.values || []).map(num).join(', ');
  if (q.answerType === 'point') return `(${num(a.x)}, ${num(a.y)})`;
  return JSON.stringify(a);
}

// ── judging: the step report the marked page shows, and the server's own award ─
async function judge(q, lines) {
  const working = lines.join('\n');
  const last = lines[lines.length - 1] || '';
  const given = last.includes('=') ? last.slice(last.lastIndexOf('=') + 1).trim() : last.trim();
  let finalOk = false;
  let result = { correct: false };
  try { result = checkAnswer(q, given); finalOk = result?.correct === true; } catch { finalOk = false; }
  let report = null;
  let evidence = {};
  try { evidence = stepEvidence({ ...q, _methodScheme: q._methodScheme ?? 'draft' }, given, working, result || { correct: false }); report = evidence.stepReport; } catch { report = null; }
  const shown = Array.isArray(report?.lines) && report.lines.length === lines.length ? report.lines : null;
  const rows = lines.map((text, i) => {
    const e = shown?.[i] || null;
    return { index: i, text, engine: e ? e.status : null, state: e?.state ?? null, stage: e && Number.isInteger(e.stage) ? e.stage : null, engineNote: e?.note || null };
  });
  return { rows, finalOk, report, topic: evidence.topicTicks ?? null };
}
const isBreak = r => r.engine === 'break';

/** The award, by the server's own function, on the report the page shows. */
function awardOf(type, rows, finalOk, report, topic, q) {
  const a = awardScheme(type, report, finalOk, topic, q);
  const earned = a.items.map(i => ({ key: i.key, marks: i.marks, earned: i.awarded, line: i.lines.length ? i.lines[0] - 1 : -1, verified: i.verified, basis: i.basis }));
  return { earned, total: a.total, firstBreak: rows.findIndex(isBreak) };
}

// ── wrong lines ──────────────────────────────────────────────────────────────
async function firstWrong(q, makeLine, candidates) {
  const tried = [];
  for (const c of candidates) {
    const line = makeLine(c);
    const { rows } = await judge(q, [line]);
    if (isBreak(rows[0])) return { text: c, line };
    tried.push({ c, line, row: rows[0] });
  }
  // No candidate was named wrong: take the first one the page does not tick (it earns nothing).
  const quiet = tried.find(t => t.row.engine !== 'ok');
  return quiet ? { text: quiet.c, line: quiet.line } : null;
}
function bumpedExprs(expr) {
  const out = [];
  const nums = [...String(expr).matchAll(/\d+/g)];
  for (const m of nums) out.push(expr.slice(0, m.index) + (Number(m[0]) + 1) + expr.slice(m.index + m[0].length));
  for (const m of nums) if (Number(m[0]) > 1) out.push(expr.slice(0, m.index) + (Number(m[0]) - 1) + expr.slice(m.index + m[0].length));
  out.push(`-(${expr})`);
  return out;
}

// ── the question types ──────────────────────────────────────────────────────
// The sample builders and the plain-language limits of each type. Its criteria, picks and marks are NOT here: they are the server's own
// (server/platform/schemeAward.js), so what a packet says is what is paid.
const EXTRAS = {
  'y12-diff-rules': {
    form: 'A function of x is given and the student is asked to differentiate it, using a named rule, and give the answer in a stated form.',
    cannot: [
      'It cannot tell which rule the student used. A correct derivative earns the first criterion however it was found.',
      'It cannot tell an unsimplified rule line from the final line. One correct line can therefore earn both criteria.',
      'It reads a derivative only when the line is labelled dy/dx, y\' or f\'(x).'
    ],
    async build(q) {
      const key = String(q.answer.expr);
      const lab = 'dy/dx';
      const w = await firstWrong(q, c => `${lab} = ${c}`, bumpedExprs(key));
      if (!w) return null;
      return { full: [`${lab} = ${key}`], partial: [`${lab} = ${key}`, `${lab} = ${w.text}`], zero: [`${lab} = ${w.text}`], slip: [`${lab} = ${w.text}`, `= ${w.text}`] };
    }
  },
  'y12-trig-extreme': {
    form: 'A model such as h(t) = 14 + 11 sin(pi t / 6) is given. The student finds its greatest or least value.',
    cannot: [
      'It cannot check a long written reason ("the sine is at most 1, so...").',
      'It reads only the labels amplitude, midline, maximum and minimum, followed by a number.',
      'A model with a domain restriction on t is not read, because the greatest value on that stretch may not be the greatest value of the curve.'
    ],
    async build(q) {
      const ex = extremes(fnOf(q)); const A = (ex.max - ex.min) / 2; const M = (ex.max + ex.min) / 2;
      const asksMax = /maximum value/i.test(q.prompt); const word = asksMax ? 'maximum' : 'minimum';
      const right = asksMax ? M + A : M - A; const other = asksMax ? M - A : M + A;
      return {
        full: [`amplitude = ${num(A)}`, `midline = ${num(M)}`, `${word} = ${num(right)}`],
        partial: [`amplitude = ${num(A)}`, `midline = ${num(M)}`, `${word} = ${num(other)}`],
        zero: [`amplitude = ${num(A + 1)}`, `midline = ${num(M + 1)}`, `${word} = ${num(other)}`],
        slip: [`amplitude = ${num(A + 1)}`, `midline = ${num(M)}`, `${word} = ${num(asksMax ? M + A + 1 : M - A - 1)}`]
      };
    }
  },
  'y12-trig-evaluate': {
    form: 'A model h(t) is given and the student finds h at a stated value of t.',
    cannot: [
      'A substitution line earns only when it is the model with the asked value put in, term by term. A sum that merely comes to the same value (a different number, or an evaluated line) does not earn; that criterion is then "not verified".',
      'It cannot judge a trigonometric value of a plain number without pi, because the angle might be in degrees or radians. Such a line is left unverified.',
      'The question may supply the exact trig value to use. The engine does not check that the student used it.'
    ],
    async build(q) {
      const f = descOf(q).functions[0]; const t0 = /find \$([a-z])\((\d+)\)\$/i.exec(q.prompt); const name = t0[1]; const at = t0[2];
      const rhs = String(f.rhs).replace(new RegExp(`(?<![A-Za-z])${f.variable}(?![A-Za-z])`, 'g'), (m, off, str) => (/[A-Za-zπ\d)]\s*$/.test(str.slice(0, off)) ? `*(${at})` : `(${at})`)).replace(/\s+\*/g, '*').replace(/\*\s+/g, '*');
      const wrong = String(f.rhs).replace(new RegExp(`(?<![A-Za-z])${f.variable}(?![A-Za-z])`, 'g'), (m, off, str) => (/[A-Za-zπ\d)]\s*$/.test(str.slice(0, off)) ? `*(${Number(at) + 1})` : `(${Number(at) + 1})`)).replace(/\s+\*/g, '*').replace(/\*\s+/g, '*');
      const v = Number(q.answer.value);
      return {
        full: [`${name}(${at}) = ${rhs}`, `${name}(${at}) = ${num(v)}`],
        partial: [`${name}(${at}) = ${rhs}`, `${name}(${at}) = ${num(v + 1)}`],
        zero: [`${name}(${at}) = ${wrong}`, `${name}(${at}) = ${num(v + 1)}`],
        slip: [`${name}(${at}) = ${wrong}`, `= ${num(v + 1)}`]
      };
    }
  },
  'y12-diff-explog': {
    form: 'A function such as 2 ln(6x + 5) or x squared times e to the 2x is given and the student differentiates it.',
    cannot: [
      'It cannot tell which rule the student used, or an unsimplified rule line from the final line. One correct line can earn both criteria.',
      'Only the step check\'s own equivalence test decides whether a line is a correct derivative.'
    ],
    async build(q) {
      const key = String(q.answer.expr); const lab = 'dy/dx';
      const w = await firstWrong(q, c => `${lab} = ${c}`, bumpedExprs(key));
      if (!w) return null;
      return { full: [`${lab} = ${key}`], partial: [`${lab} = ${key}`, `${lab} = ${w.text}`], zero: [`${lab} = ${w.text}`], slip: [`${lab} = ${w.text}`, `= ${w.text}`] };
    }
  },
  'y11-poly-evaluate': {
    form: 'A polynomial P(x) is given. The student finds P(a), or the remainder when P(x) is divided by x - a.',
    cannot: [
      'A substitution line earns only when it is P(x) with the asked value put in, term by term. A sum that merely comes to the same value (a different number, or an evaluated line) does not earn; that criterion is then "not verified".',
      'Long division is not read at all.'
    ],
    async build(q) {
      const f = descOf(q).functions[0];
      let a;
      const ev = /evaluate \$P\((-?\d+)\)\$/i.exec(q.prompt);
      if (ev) a = Number(ev[1]);
      else { const m = /divided by \$?\(x\s*([+-])\s*(\d+)\)/i.exec(q.prompt); if (!m) return null; a = m[1] === '+' ? -Number(m[2]) : Number(m[2]); }
      const sub = at => String(f.rhs).replace(/(?<![A-Za-z])x(?![A-Za-z])/g, (m, off, str) => (/[A-Za-z\d)]\s*$/.test(str.slice(0, off)) ? `*(${at})` : `(${at})`)).replace(/\^\((\d+)\)/g, '^$1').replace(/\s+/g, '');
      const v = Number(q.answer.value);
      return {
        full: [`P(${a}) = ${sub(a)}`, `P(${a}) = ${num(v)}`],
        partial: [`P(${a}) = ${sub(a)}`, `P(${a}) = ${num(v + 1)}`],
        zero: [`P(${a}) = ${sub(a + 1)}`, `P(${a}) = ${num(v + 1)}`],
        slip: [`P(${a}) = ${sub(a + 1)}`, `= ${num(evalCo(polynomial(fnOf(q)), a + 1))}`]
      };
    }
  },
  'y11-diff-gradient-plan': {
    form: 'A curve y = f(x) is given and the student finds the gradient of the tangent at a stated x. This question carries a two-stage plan the engine already knows.',
    cannot: [
      'It decides only the two stages the plan names. It cannot check any other kind of working.',
      'The plan is authored for this question form only.'
    ],
    async build(q) {
      const co = polynomial(fnOf(q)); const d = derivCo(co); const a = Number(/x = (-?\d+)/.exec(q.prompt)[1]);
      const val = evalCo(d, a); const bad = bumpTop(d);
      const subText = c => polyText(c).replace(/x(\^\d)?/g, (m, p) => `(${a})${p || ''}`).replace(/(\d)\(/g, '$1*(').replace(/\)\s*\^/g, ')^');
      void subText;
      const sub = c => c.map((k, i) => ({ k, i })).filter(t => t.k).reverse().map((t, n) => `${n === 0 ? (t.k < 0 ? '-' : '') : (t.k < 0 ? ' - ' : ' + ')}${t.i === 0 ? num(Math.abs(t.k)) : `${Math.abs(t.k) === 1 ? '' : num(Math.abs(t.k)) + '*'}(${a})${t.i > 1 ? `^${t.i}` : ''}`}`).join('');
      return {
        full: [`dy/dx = ${polyText(d)}`, `dy/dx = ${sub(d)}`, `gradient = ${num(val)}`],
        partial: [`dy/dx = ${polyText(d)}`, `gradient = ${num(val + 1)}`],
        zero: [`dy/dx = ${polyText(bad)}`, `dy/dx = ${sub(bad)}`, `gradient = ${num(evalCo(bad, a))}`],
        slip: [`dy/dx = ${polyText(bad)}`, `dy/dx = ${sub(bad)}`, `gradient = ${num(evalCo(bad, a))}`]
      };
    }
  },
  'y11-diff-power-rule': {
    form: 'A power or a polynomial is given and the student writes its derivative.',
    cannot: [
      'It cannot tell a rule line from the final line, so one correct line can earn both criteria.',
      'It does not check each term separately.'
    ],
    async build(q) {
      const key = String(q.answer.expr); const lab = /f\(x\)/.test(q.prompt) ? "f'(x)" : 'dy/dx';
      const w = await firstWrong(q, c => `${lab} = ${c}`, bumpedExprs(key));
      if (!w) return null;
      return { full: [`${lab} = ${key}`], partial: [`${lab} = ${key}`, `${lab} = ${w.text}`], zero: [`${lab} = ${w.text}`], slip: [`${lab} = ${w.text}`, `= ${w.text}`] };
    }
  }
};

// A solved-equation question: transcripts are the audit corpus's own, so nothing here knows the key. A wrong line is the same line with its last number raised by one.
const raiseLast = text => {
  const m = [...String(text).matchAll(/\d+/g)].pop();
  return m ? text.slice(0, m.index) + (Number(m[0]) + 1) + text.slice(m.index + m[0].length) : null;
};
async function equationBuild(q) {
  const bare = transcriptsFor(q).find(t => t.style === 'bare');
  if (!bare || bare.lines.length < 2) return null;
  // A chained line (5x = -31 - 4 = -35) is not read as a step by the page, so the transcripts write each equation on its own line.
  const good = bare.lines.map(l => l.text).map(t => { const p = t.split('='); return p.length > 2 ? `${p[0].trim()} = ${p.at(-1).trim()}` : t; });
  const v = q.stepcheck?.variable || 'x';
  const wrongFinal = q.answerType === 'set'
    ? `${(q.answer.values || []).map((n, i, a) => num(i === a.length - 1 ? n + 1 : n)).join(' or ')}`
    : `${v} = ${num(Number(q.answer.value) + 1)}`;
  // The wrong first line must be one the page really crosses (a line merely left unchecked, or ticked by luck, is not a known-wrong line).
  const cands = [raiseLast(good[0]), good[0].replace(/\d+(?!.*\d)/, m => String(Math.max(0, Number(m) - 1))), good[0].replace(/(\d+)\s*$/, m => String(Number(m) + 2)), good[0].replace(/=\s*(-?)(\d+)/, (m, sg, d) => `= ${sg ? '' : '-'}${d}`)].filter((c, i, a) => c && c !== good[0] && a.indexOf(c) === i);
  let bad = null;
  for (const c of cands) { const { rows } = await judge(q, [c, wrongFinal]); if (isBreak(rows[0])) { bad = c; break; } }
  if (!bad) return null;
  return {
    full: good,
    partial: [...good.slice(0, -1), wrongFinal],
    zero: [bad, wrongFinal],
    slip: [bad, ...good.slice(1, -1), wrongFinal]
  };
}
const EQUATION_CANNOT = [
  'It reads each line only as an equation with the same solutions as the question\'s. It cannot tell a worthwhile step from a trivial rewrite that gets nowhere (for example multiplying both sides by 1): both are a true equation with the same solutions, and both earn.',
  'A line with no letter in it, a solved form such as x = 7, the question\'s own equation (either way round), and a line already written earn no step.',
  'A chained line such as 5x = -31 - 4 = -35 is left unchecked by the page, so it earns no step: each equation has to be written on its own line. A line that only shows numbers being equal earns nothing either.',
  'A step the page cannot place is "not verified", never "wrong". A word problem has no equation printed in the question: the student\'s own setup equation is a step like any other.'
];

EXTRAS['y12-trig-extreme-2'] = { ...EXTRAS['y12-trig-extreme'], form: 'A model such as h(t) = 14 + 11 sin(pi t / 6) is given. The student finds its greatest or least value. This version is for questions worth two marks.', cannot: [...EXTRAS['y12-trig-extreme'].cannot, 'It does not require both the amplitude and the midline: either one, correctly stated, earns the working mark.'] };
for (const id of ['y7-equation-solve-2', 'y7-equation-solve-3', 'y10-quadratic-solve-2', 'y10-quadratic-solve-3']) EXTRAS[id] = { form: '' + (id.startsWith('y10') ? 'A quadratic equation is given and the student finds all its solutions.' : 'An equation in one letter is given, or arises from a short word problem, and the student finds the value of the letter.') + ' This version is for ' + (id.endsWith('2') ? 'two' : 'three') + '-mark questions.', cannot: EQUATION_CANNOT, build: equationBuild };

export const TYPES = SCHEMES.map(s => ({ ...s, ...EXTRAS[s.id] }));

// ── types the marked page cannot verify line by line (server/platform/schemeAward.js UNAVAILABLE) ─
const UNAVAILABLE_PROBES = {
  'y12-diff-gradient': { family: 'y12-diff', d: 1, seed: 29, lines: ['dy/dx = 24x^2 + 72x + 54', 'dy/dx = 150'], unverified: [1] },
  'y12-stationary-x': { family: 'y12-appdiff', d: 1, seed: 7, lines: ['dy/dx = 6x^2 - 294', 'Let dy/dx = 0', '6x^2 - 294 = 0', 'x = -7 or x = 7'], unverified: [1, 2] },
  'y12-tangent': { family: 'y12-appdiff', d: 3, seed: 7, lines: ['dy/dx = 2x - 5', 'y(1) = 2', 'y = -3x + 5'], unverified: [1] }
};
const UNAVAILABLE_PROBED = UNAVAILABLE.map(u => ({ ...u, probe: UNAVAILABLE_PROBES[u.id] }));

// ── types that could not be given a provable scheme ─────────────────────────
// Each carries a probe: a plausible correct transcript, and the line numbers (from 1) that carry the
// criterion in question. The tool runs it and fails loudly if any of those lines turns out to be
// verified, so a reason on this list can never go out of date unnoticed.
const UNPROVABLE = [
  { id: 'y12-integrals', title: 'Definite integrals and areas under a curve', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-integration', 'y12-integral-calc'],
    reason: 'The engine cannot read an antiderivative or an integral line, so "integrates correctly" and "substitutes the limits" cannot be decided; only the final value is checked.',
    probe: { family: 'y12-integration', d: 2, seed: 11, lines: ['∫ = x^3 + x^2', '[2x^3/3 + x^2] from 0 to 2', '9.333'], unverified: [1, 2] } },
  { id: 'y12-integrals-indefinite', title: 'Indefinite integrals and the reverse chain rule', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-integration', 'y12-integral-calc', 'y12-trigcalc'],
    reason: 'The engine cannot read an antiderivative line, so no stage of the method can be decided apart from the final expression.',
    probe: { family: 'y12-integral-calc', d: 2, seed: 23, lines: ['∫(3x^2+6)dx = x^3+6x', '(2)^3 + 6(2) - 0', '20'], unverified: [1] } },
  { id: 'y12-stationary-nature', title: 'Nature of a stationary point', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-appdiff'],
    reason: 'The nature question is multiple choice, and the second derivative is not a line the page can check, so "determines the nature" cannot be decided from the lines.',
    probe: { family: 'y12-appdiff', d: 2, seed: 23, lines: ["y' = -2(x + 3)", "y'' = -2", 'maximum'], unverified: [2] } },
  { id: 'y12-optimisation', title: 'Applications of differentiation: greatest or least value (rates and optimisation)', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-appdiff'],
    reason: 'The derivative of a function named P (or any capital-letter name) is not read, and the line that sets it to zero is not recognised, so the calculus steps cannot be decided.',
    probe: { family: 'y12-appdiff', d: 4, seed: 11, lines: ['dP/dx = -10x + 130', 'Let dP/dx = 0', '-10x + 130 = 0', 'x = 13'], unverified: [1, 2, 3, 4] } },
  { id: 'y12-explog-models', title: 'Exponential growth and decay models, and logarithmic equations', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-explogcalc', 'y12-func-model', 'y11-explog'],
    reason: 'The lines that set up and solve the model equation (taking logarithms, finding k) are not read, so no method criterion can be decided.',
    probe: { family: 'y12-explogcalc', d: 3, seed: 11, lines: ['330 = 110e^(6k)', 'e^(6k) = 3', 'k = ln(3)/6'], unverified: [1, 2, 3] } },
  { id: 'y12-series', title: 'Arithmetic and geometric sequences and series', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-series'],
    reason: 'The formula line and the substitution line are not read, and the question has no engine plan, so only the final value can be checked.',
    probe: { family: 'y12-series', d: 1, seed: 23, lines: ['T19 = a + 18d', 'T19 = -4 + 18(3)'], unverified: [1, 2] } },
  { id: 'y12-financial', title: 'Financial mathematics: compound interest, annuities and loans', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-financial', 'y12-fin-exact'],
    reason: 'Only the final amount is checked. The formula and the substitution lines are not read, so no method criterion can be decided.',
    probe: { family: 'y12-financial', d: 1, seed: 11, lines: ['FV = 12000(1.05)^11', 'FV = 12000 × 1.7103'], unverified: [1, 2] } },
  { id: 'y12-probability-normal', title: 'Probability, random variables and the normal distribution', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-stats', 'y12-random-var'],
    reason: 'The formula line (z-score, E(X), Var(X)) is not read, and a substitution line is checked only as arithmetic, not as the right substitution into the right formula, so "uses the correct formula" cannot be decided.',
    probe: { family: 'y12-stats', d: 3, seed: 11, lines: ['z = (x - mean)/sd', 'z = (75 - 70)/10'], unverified: [1] } },
  { id: 'me12-trig-equations', title: 'Trigonometric equations over a stated interval (Extension 1)', course: 'Year 12 Mathematics Extension 1', level: 0, families: ['me12-trigeq'],
    reason: 'The line that reduces the equation and the lines that list the angles are not read, so "reduces to a basic equation" and "finds all the solutions in range" cannot be decided.',
    probe: { family: 'me12-trigeq', d: 2, seed: 11, lines: ['cos^2θ = 3/4', 'cosθ = √3/2 or cosθ = -√3/2', 'θ = 30, 330, 390, 690'], unverified: [1, 2, 3] } },
  { id: 'me12-binomial', title: 'Binomial probability (Extension 1)', course: 'Year 12 Mathematics Extension 1', level: 0, families: ['me12-binomial', 'me12-binomial-forms'],
    reason: 'There is no step plan for this form and the formula and substitution lines are not read, so only the final value can be checked.',
    probe: { family: 'me12-binomial', d: 2, seed: 23, lines: ['E(X) = np', 'E(X) = 9 × 0.15'], unverified: [1, 2] } },
  { id: 'me12-integration-substitution', title: 'Integration by substitution (Extension 1)', course: 'Year 12 Mathematics Extension 1', level: 0, families: ['me12-calc', 'mex-integration'],
    reason: 'A substitution line "u = ..." is a choice of notation and the transformed integral is not read, so no stage can be decided.',
    probe: { family: 'me12-calc', d: 2, seed: 11, lines: ['u = x^2 + 4', 'du = 2x dx', '∫ u^2 du from 4 to 13'], unverified: [1, 2, 3] } }
];

// ── building ────────────────────────────────────────────────────────────────
async function findSamples(type) {
  const out = []; const seen = new Set();
  for (const fam of type.families) {
    for (let d = 1; d <= 4 && out.length < SAMPLES_PER_TYPE; d++) {
      for (let seed = 1; seed <= SEED_LIMIT && out.length < SAMPLES_PER_TYPE; seed++) {
        let q; try { q = G.generateQuestion(fam, d, seed); } catch { continue; }
        if (!q || seen.has(q.prompt)) continue;
        let ok = false; try { ok = !!type.pick(q); } catch { ok = false; }
        if (ok) { seen.add(q.prompt); out.push(q); }
      }
    }
  }
  return out;
}

const ENGINE_WORDS = { ok: 'true line', break: 'wrong here', note: 'no verdict' };
const cell = s => plain(String(s)).replace(/\bPri\b/g, 'the checker').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export async function runCase(type, q, lines) {
  const { rows, finalOk, report, topic } = await judge(q, lines);
  const award = awardOf(type, rows, finalOk, report, topic, q);
  const rowsOut = rows.map(r => ({ ...r, counts: award.earned.filter(e => e.earned && e.line === r.index).map(e => e.key) }));
  return { lines, rows: rowsOut, finalOk, award };
}

async function buildType(type) {
  const qs = await findSamples(type);
  if (qs.length < SAMPLES_PER_TYPE) return { ok: false, reason: `only ${qs.length} sample questions of this form could be generated` };
  const total = type.criteria.reduce((s, c) => s + c.marks, 0);
  const samples = [];
  for (const q of qs) {
    const lines = await type.build(q);
    if (!lines) return { ok: false, reason: 'a transcript could not be built for a sample question' };
    const cases = {};
    for (const k of ['full', 'partial', 'zero', 'slip']) cases[k] = await runCase(type, q, lines[k]);
    const a = k => cases[k].award.total;
    const problems = [];
    if (a('full') !== total) problems.push(`a full transcript earned ${a('full')} of ${total}`);
    if (!(a('partial') > 0 && a('partial') < total)) problems.push(`a partial transcript earned ${a('partial')} of ${total}`);
    if (a('zero') !== 0) problems.push(`a zero transcript earned ${a('zero')}`);
    if (a('slip') >= total) problems.push('a transcript with an earlier slip still earned full marks');
    if (problems.length) return { ok: false, reason: `On ${q.contentId || q.subtopic}, ${problems.join('; ')}.` };
    samples.push({ q, cases });
  }
  return { ok: true, total, samples };
}

function summariseKey(q) { return plain(humanKey(q)); }
const digestOf = type => schemeDigest(type);

function awardTable(type, c) {
  const head = '| # | What the student wrote | What the marked page shows | Counts toward |\n|---:|---|---|---|';
  const body = c.rows.map(r => `| ${r.index + 1} | \`${cell(r.text)}\` | ${r.engine ? (ENGINE_WORDS[r.engine] || r.engine) + (r.engineNote ? ` (${cell(r.engineNote)})` : '') : 'no line report'} | ${r.counts.length ? r.counts.join(', ') : 'nothing'} |`).join('\n');
  const total = type.criteria.reduce((s, x) => s + x.marks, 0);
  const earned = c.award.earned.filter(e => e.earned).map(e => `${e.key} (${e.marks})`).join(', ') || 'none';
  const answerLine = `\nFinal answer check: ${c.finalOk ? 'correct' : 'not correct'}.`;
  return `${head}\n${body}\n\nAward: **${c.award.total} of ${total}**. Criteria earned: ${earned}.${answerLine}`;
}

function typeMarkdown(type, built, digest) {
  const total = built.total;
  const s0 = built.samples[0];
  const L = [];
  L.push(BANNER, '', `# ${type.title}`, '', `Course: ${type.course}. Type id: \`${type.id}\`. Total: ${total} marks.`, '');
  L.push('## Question form', '', plain(type.form), '', `Generator families: ${type.families.map(f => `\`${f}\``).join(', ')}.`, '');
  L.push('## Sample questions', '');
  built.samples.forEach((s, i) => L.push(`${i + 1}. ${cell(s.q.prompt)}`, `   Key: ${cell(summariseKey(s.q))}`, ''));
  L.push('## Criteria', '', '| Criterion | Marks | How the engine decides it |', '|---|---:|---|');
  type.criteria.forEach(c => L.push(`| ${cell(c.text)} | ${c.marks} | ${cell(c.how)} |`));
  L.push('', `Total: ${total} marks. The marks per criterion are a first guess for the author to correct.`, '');
  L.push('## What the engine can and cannot verify for this type', '', 'The page is the marked page the student sees: each line of working is ticked, crossed or left unchecked by the checker. The answer checker is the code that marks a final answer. The server pays exactly the criteria below, from exactly that page.', '');
  L.push('It can verify:', '');
  type.criteria.forEach(c => L.push(`- ${plain(c.text)}`));
  L.push('', 'It cannot verify:', '');
  type.cannot.forEach(t => L.push(`- ${plain(t)}`));
  L.push('', 'Rule used in every award below: a line earns a criterion only if the marked page ticks it. A line the page crosses, and every line after it, earns nothing. A correct final answer is the full mark, as it always was. A wrong final answer can never reach full marks.', '');
  L.push('## Worked awards', '', `These come from running the engine on built transcripts for the first sample question: ${cell(s0.q.prompt)}`, '');
  for (const [k, title] of [['full', 'Full marks'], ['partial', 'Partial marks'], ['zero', 'Zero marks']]) {
    L.push(`### ${title}`, '', awardTable(type, s0.cases[k]), '');
  }
  L.push('## Error carried forward', '');
  const slip = s0.cases.slip;
  L.push(`Transcript with an earlier slip, on the same question:`, '', awardTable(type, slip), '');
  const after = slip.rows.slice(slip.award.firstBreak + 1);
  const words = after.map(r => `line ${r.index + 1}: ${r.engine ? ENGINE_WORDS[r.engine] || r.engine : 'no line report'}`).join('; ');
  const tickedAfter = after.filter(r => r.engine === 'ok').map(r => r.index + 1);
  const carried = after.filter(r => r.engine === 'ecf' || /follows from the earlier/i.test(r.engineNote || '')).map(r => r.index + 1);
  const hasEcf = built.samples.some(x => JSON.stringify(stepMetaFor(x.q) ?? {}).includes('"ecf"'));
  if (slip.award.firstBreak >= 0) L.push(`What the engine actually did: the first wrong line was line ${slip.award.firstBreak + 1}. ${after.length ? `After it, ${words}.` : 'No line followed it.'}`);
  else L.push('What the engine actually did: it did not name any line as wrong, so the slip showed only as lines that earned no tick.');
  L.push('');
  L.push(`${carried.length ? `The engine named line(s) ${carried.join(', ')} as following from the earlier mistake, and gave them no tick. ` : 'The engine did not name any later line as following from the earlier mistake. '}${tickedAfter.length ? `Line(s) ${tickedAfter.join(', ')} were found true on their own, but they come after the first wrong line, so this draft does not count them. ` : 'No later line was found true. '}${hasEcf ? 'This question carries a plan marked for error carried forward, which the engine applies as its own rule shows above. ' : 'The engine pays nothing for a line that follows correctly from an earlier error here: the only rule that does so is a question plan marked for error carried forward, and this type has none. '}Whether a later criterion should earn after an earlier error is the author's decision, not the engine's.`, '');
  L.push('## Review record', '', 'To be filled in by the author (the tutor). Leave blank until reviewed.', '', '- Decision (approved by the author / changes needed): ', '- Note: ', '- Name: ', '- Date: ', `- Scheme digest: \`${digest}\``, '');
  return plain(L.join('\n'));
}

async function checkProbe(u) {
  const q = G.generateQuestion(u.probe.family, u.probe.d, u.probe.seed);
  const { rows } = await judge(q, u.probe.lines);
  // A true-as-written arithmetic tick says only that the numbers on the line are equal; it never decides a criterion of a method.
  // Nor does a tick that only says a line has the value of a step of the worked solution: it names no criterion.
  const ticked = r => r.engine === 'ok' && r.state !== 'arithmetic' && !/^(Matches step \d+ of the worked solution|This is the value at step)/.test(r.engineNote || '');
  const bad = u.probe.unverified.filter(n => ticked(rows[n - 1]));
  if (bad.length) throw new Error(`probe for ${u.id}: lines ${bad.join(', ')} are now verified, so its reason no longer holds`);
  return rows.map(r => ({ text: r.text, engine: r.engine }));
}

export async function build() {
  await G.loadAllBanks();
  const files = new Map(); const done = []; const notProvable = [];
  for (const type of TYPES) {
    const built = await buildType(type);
    if (!built.ok) { notProvable.push({ id: type.id, title: type.title, course: type.course, level: type.level, families: type.families, reason: built.reason }); continue; }
    const digest = digestOf(type);
    files.set(`${type.id}.md`, typeMarkdown(type, built, digest));
    done.push({ type, built, digest });
  }
  for (const u of [...UNAVAILABLE_PROBED, ...UNPROVABLE]) { await checkProbe(u); notProvable.push({ id: u.id, title: u.title, course: u.course, level: u.level, families: u.families, reason: u.reason, ...(UNAVAILABLE_PROBES[u.id] ? { unavailable: true } : {}) }); }
  // index and machine-readable file
  const order = (a, b) => a.level - b.level;
  const sorted = done.map((d, i) => ({ ...d, i })).sort((a, b) => order(a.type, b.type) || a.i - b.i);
  const totalMarks = d => d.built.total;
  const awardsToRead = done.reduce((s, d) => s + 4, 0);
  const crit = done.reduce((s, d) => s + d.type.criteria.length, 0);
  const by = k => done.reduce((s, d) => s + d.type.criteria.filter(c => c.by === k).length, 0);
  const I = [BANNER, '', '# Draft method-mark schemes for NSW question types', '',
    'These are drafts for the author (the tutor who writes the papers) to read, correct and decide on. Nothing here is approved, signed or switched on. Prithagoras still marks the final answer only.', '',
    '## Types given a draft scheme, in review order', '', 'Year 12 Advanced and Extension 1 first, then Year 11.', '',
    'The Status column reads the author\'s own records (docs/marking/author-approvals) and only reports them: a type is "approved" only while its record names the digest in its packet. This tool never writes a record.', '',
    '| # | Type | Course | Criteria | Marks | Status | File |', '|---:|---|---|---:|---:|---|---|'];
  const recDir = path.join(ROOT, 'docs', 'marking', 'author-approvals');
  const recs = fs.existsSync(recDir) ? fs.readdirSync(recDir).filter(f => f.endsWith('.json') && f !== 'schema.json').map(f => JSON.parse(fs.readFileSync(path.join(recDir, f), 'utf8'))) : [];
  const status = d => (recs.some(r => r.typeId === d.type.id && r.digest === d.digest && r.verdict === 'approved') ? 'approved by the author' : 'new draft, not approved');
  sorted.forEach((d, n) => I.push(`| ${n + 1} | ${cell(d.type.title)} | ${d.type.course} | ${d.type.criteria.length} | ${totalMarks(d)} | ${status(d)} | [${d.type.id}.md](${d.type.id}.md) |`));
  I.push('', '## Counts', '',
    `- Types given a scheme: ${done.length}.`,
    `- Types where the engine awards every criterion deterministically: ${done.length} of ${done.length}. Each was run on ${SAMPLES_PER_TYPE} sample questions with a full, a partial, a zero and an earlier-slip transcript, and every run gave the expected award.`,
    `- Criteria in all: ${crit}. Earned by a ticked line of the marked page: ${by('line')}. Earned by a correct final answer (the answer checker): ${by('final')}.`,
    `- Size of the review job: ${done.length} types, about ${awardsToRead} worked awards to read (one full, one partial, one zero and one earlier-slip award for each type), and ${crit} criteria whose marks to set.`, '',
    '## Not available yet', '',
    'These three question types had a draft in an earlier version of this packet. They are NOT available now: the marked page the student sees cannot verify one of their criteria line by line, and the server pays only from that page, so nothing about them can be approved or paid. Each reason was checked by running a plausible correct transcript.', '',
    ...notProvable.filter(n => n.unavailable).map(n => `- ${plain(n.title)} (${n.course}; families ${n.families.map(f => `\`${f}\``).join(', ')}): ${plain(n.reason)}`),
    '', '## Could not be given a provable scheme', '',
    'These types were tried. A scheme is not offered because at least one criterion cannot be decided by the engine from the student\'s lines. Each reason was checked by running a plausible correct transcript.', '');
  notProvable.filter(n => !n.unavailable).sort((a, b) => a.level - b.level).forEach(n => I.push(`- ${plain(n.title)} (${n.course}; families ${n.families.map(f => `\`${f}\``).join(', ')}): ${plain(n.reason)}`));
  I.push('');
  files.set('INDEX.md', plain(I.join('\n')));
  const json = {
    status: 'draft: not approved',
    types: sorted.map(d => ({
      id: d.type.id, title: d.type.title, course: d.type.course, year: d.type.year, families: d.type.families, file: `${d.type.id}.md`,
      totalMarks: totalMarks(d),
      criteria: d.type.criteria.map(c => ({ key: c.key, text: c.text, marks: c.marks, by: c.by })),
      digest: d.digest
    })),
    notProvable: notProvable.map(n => ({ id: n.id, title: n.title, course: n.course, families: n.families, reason: n.reason, ...(n.unavailable ? { unavailable: true } : {}) }))
  };
  files.set('types.json', plain(JSON.stringify(json, null, 2)) + '\n');
  for (const [k, v] of files) if (!v.endsWith('\n')) files.set(k, v + '\n');
  return { files, summary: { schemes: done.length, criteria: crit, notProvable: notProvable.length, awardsToRead } };
}

export function writeFiles(files, dir = OUT_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (!files.has(f)) fs.rmSync(path.join(dir, f));
  for (const [name, text] of files) fs.writeFileSync(path.join(dir, name), text);
}

export function diffFiles(files, dir = OUT_DIR) {
  const bad = [];
  const have = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  for (const [name, text] of files) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) bad.push(name);
  }
  for (const f of have) if (!files.has(f)) bad.push(`${f} (not generated)`);
  return bad;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { files, summary } = await build();
  if (process.argv.includes('--check')) {
    const bad = [...diffFiles(files), ...diffFiles(ownerFiles(files), OWNER_DIR).map(f => `docs/marking/method-marks-signoff/method-marks/${f}`)];
    if (bad.length) { console.error(`owner-review/method-marks or docs/marking/method-marks-signoff/method-marks is out of date: ${bad.join(', ')}. Run: node tools/method-marks-drafts.mjs`); process.exit(1); }
    console.log(`method-marks drafts match (${summary.schemes} types).`);
  } else {
    writeFiles(files);
    writeFiles(ownerFiles(files), OWNER_DIR);
    console.log(`wrote ${files.size} files: ${summary.schemes} types with a scheme, ${summary.notProvable} not provable, ${summary.awardsToRead} awards to read.`);
  }
}
