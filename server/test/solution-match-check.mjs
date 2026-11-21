// Pri Learning · recognising a correct line from the worked solution (client/src/engine/solutionMatch.js)
//
// A measured battery of correct handwritten working left 54% of its true lines as notes. The question's own worked solution
// is evidence for what a correct line looks like. This pass is FEEDBACK ONLY: it runs after every mark and may only turn a
// NOTE into a tick. These checks prove that, and prove that wrong lines are not ticked.
//   a  identity: over thousands of pages from many generators (worked steps, slips, extra lines), `correct`, the partial,
//      the board, every pre-existing line, the first break and the diagnosis are identical with the pass on and off
//   b  no false tick: wrong lines made by mutating the solution's own steps are never ticked
//   c  the battery of 30 questions: ticks before and after, never a cross, never fewer ticks
//   d  budget, answer-blindness, and the shape of a tick
import fs from 'node:fs';
import { stepEvidence } from '../platform/markerOps.js';
import * as G from '../../client/src/engine/generators/index.js';
import { evaluate } from '../../client/src/engine/expr.js';
import { solutionMatch, _internals as I, _forChains as FCH } from '../../client/src/engine/solutionMatch.js';

const OBJ = new Set(['mcq', 'multi-mcq', 'matrix-match']);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
await G.loadAllBanks();

const evidence = (q, lines, opts = {}) => {
  const w = lines.join('\n');
  const result = { correct: false };
  return { on: stepEvidence(q, '', w, result, opts), off: stepEvidence(q, '', w, { correct: false }, { ...opts, solutionMatch: false }), result };
};
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const canon0 = x => String(x).replace(/[\s{}*]/g, '').replace(/\^\(([^()]*)\)/g, '^$1');
const ids = Object.keys(G.GENERATORS).sort();

/** The lines of a worked solution as a student would write them: each `$…$` statement of each step, in order. */
function workedLines(q) {
  const out = [];
  for (const st of q.steps || []) for (const m of String(st?.d ?? '').matchAll(/\$([^$]+)\$/g)) { const p = I.spanToPlain(m[1]); if (p) out.push(p); }
  return out;
}
const generate = (id, d, seed) => { try { return G.generateQuestion(id, d, seed); } catch { return null; } };

// ── a · identity ─────────────────────────────────────────────────────────────
{
  let pages = 0, gens = new Set(), tickedNew = 0, crossed = 0;
  const diffs = [];
  const rnd = mulberry(20241121);
  outer: for (let round = 0; round < 40 && pages < 2400; round++) {
    for (const id of ids) {
      const d = 1 + (round % 4), seed = 3 + round * 7 + (id.length % 5);
      const q = generate(id, d, seed);
      if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
      let lines = workedLines(q);
      if (lines.length < 2) continue;
      const variant = round % 3;
      if (variant === 1) { const k = Math.floor(rnd() * lines.length); lines[k] = lines[k].replace(/\d/, c => String((Number(c) + 1) % 10)); }   // a slip
      if (variant === 2) { const k = Math.floor(rnd() * (lines.length + 1)); lines.splice(k, 0, ['2 + 2 = 4', '3 × 4 = 12', '= 7', 'so x = 3'][Math.floor(rnd() * 4)]); }   // an extra line
      lines = lines.slice(0, 20);
      const before = JSON.stringify(q);
      const { on, off } = evidence(q, lines);
      pages++; gens.add(id);
      if (JSON.stringify(q) !== before) diffs.push(`${id}: the question was changed`);
      if (JSON.stringify(on.partial) !== JSON.stringify(off.partial)) diffs.push(`${id}/${d}/${seed}: partial differs`);
      if (JSON.stringify(on.board ?? null) !== JSON.stringify(off.board ?? null)) diffs.push(`${id}: board differs`);
      const a = on.stepReport, b = off.stepReport;
      if (!b) { if (a && a.lines.some(l => l.status === 'break')) crossed++; if (a) tickedNew += a.lines.filter(l => l.status === 'ok').length; continue; }
      if (!a) { diffs.push(`${id}: the report disappeared`); continue; }
      if (a.firstBreak !== b.firstBreak) diffs.push(`${id}: firstBreak differs`);
      if (JSON.stringify(a.diagnosis ?? null) !== JSON.stringify(b.diagnosis ?? null)) diffs.push(`${id}: diagnosis differs`);
      if (a.lines.length !== b.lines.length) { diffs.push(`${id}: line count differs`); continue; }
      a.lines.forEach((l, i) => {
        const o = b.lines[i];
        if (l.status === 'break' && o.status !== 'break') crossed++;
        if (l.solutionMatch === true) {
          if (o.status !== 'note' || l.status !== 'ok') diffs.push(`${id}: line ${i + 1} changed from ${o.status}`);
          else tickedNew++;
        } else if (l.status !== o.status || l.state !== o.state && !(o.state === undefined) || l.note !== o.note || JSON.stringify(l.milestone ?? null) !== JSON.stringify(o.milestone ?? null)) diffs.push(`${id}: pre-existing line ${i + 1} changed`);
      });
      if (pages >= 2400) break outer;
    }
  }
  ok(diffs.length === 0, `identity: nothing but a note became a tick (${diffs.length} differences: ${diffs.slice(0, 3).join(' | ')})`);
  ok(pages >= 2000 && gens.size >= 50, `identity: ${pages} pages from ${gens.size} generators`);
  ok(crossed === 0, `identity: no cross was added (${crossed})`);
  ok(tickedNew > 0, `identity: the pass ticked ${tickedNew} lines in all`);
  console.log(`identity: ${pages} pages, ${gens.size} generators, ${tickedNew} notes became ticks, 0 else changed`);
}

// ── b · no false tick ────────────────────────────────────────────────────────
const MUTATIONS = {
  signFlip: p => p.replace(/([+\-])(?=\s*[\dA-Za-z(])/, m => (m === '+' ? '-' : '+')),
  coefficient: p => p.replace(/(?<![\d.^_])(\d+)(?=[A-Za-z(])/, (m, n) => String(Number(n) + 1)),
  wrongPower: p => p.replace(/\^\(?(\d)\)?/, (m, n) => `^${Number(n) === 9 ? 2 : Number(n) + 1}`),
  offByOne: p => p.replace(/(\d+(?:\.\d+)?)(?!.*\d)/, (m, n) => String(Number(n) + 1)),
  droppedTerm: p => p.replace(/\s*[+\-]\s*[^+\-=()]+$/, ''),
  swappedLimits: p => p.replace(/_\{?([^{}^_]+?)\}?\^\{?([^{}^_]+?)\}?(?=\W|$)/, (m, a, b) => `_${b}^${a}`),
  wrongLabel: p => p.replace(/^([A-Za-z])(?=\W)/, c => (c === 'z' ? 'w' : c === 'x' ? 'z' : 'x'))
};
{
  let built = 0, exercised = 0, ticked = 0, tickedExamples = [];
  const kinds = {};
  const test = (kind, q, lines, i) => {
    built++;
    const { on, off } = evidence(q, lines);
    const o = off.stepReport?.lines[i], l = on.stepReport?.lines[i];
    if (!o || o.status !== 'note') return;     // a mutant the arithmetic check already judged is not what this tests
    exercised++; kinds[kind] = (kinds[kind] || 0) + 1;
    if (l && l.status === 'ok') { ticked++; if (tickedExamples.length < 70) tickedExamples.push(`${kind}: ${JSON.stringify(lines)} ${l.note}`); }
  };
  const canon = x => String(x).replace(/[\s{}*]/g, '').replace(/(^|=)\+/g, '$1');
  const equivalentToOriginal = (a, b) => {
    const pa = I.readStudent(a), pb = I.readStudent(b);
    if (!pa || !pb || pa.parts.length !== pb.parts.length) return a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
    return pa.parts.every((x, k) => { const u = I.readSide(x), v = I.readSide(pb.parts[k]); if (!u || !v) return x === pb.parts[k]; if (u.value !== undefined && v.value !== undefined) return Math.abs(u.value - v.value) < 1e-7; if (u.value !== undefined || v.value !== undefined) return false; try { return I.sameSidePublic(u, v, x, pb.parts[k]); } catch { return false; } });
  };
  for (let round = 0; round < 60 && exercised < 2400; round++) {
    for (const id of ids) {
      const d = 1 + (round % 4), seed = 5 + round * 11 + (id.length % 7);
      const q = generate(id, d, seed);
      if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
      const lines = workedLines(q);
      if (lines.length < 2) continue;
      const k = 1 + (round % (lines.length - 1));        // the mutant takes the place of a later line; the true lines before it stay
      const prefix = lines.slice(0, k);
      for (const [kind, f] of Object.entries(MUTATIONS)) {
        let m;
        try { m = f(lines[k]); } catch { continue; }
        if (!m || m === lines[k] || equivalentToOriginal(m, lines[k]) || lines.some(x => canon(x) === canon(m))) continue;   // (a mutant that is another true line of the solution is not wrong)
        test(kind, q, [...prefix, m], k);
        // the same wrong value written as a continuation `= …` under the true line
        const tailOf = x => x.split(/(?<![<>!])=(?!=)/).pop().trim();
        if (m.includes('=') && lines[k].includes('=') && canon(tailOf(m)) !== canon(tailOf(lines[k])) && !lines.some(x => canon(tailOf(x)) === canon(tailOf(m)))) test(`${kind}Continued`, q, [...prefix, lines[k], `= ${tailOf(m)}`], k + 1);
      }
      // a value from a LATER step written in the place of this line (never the value of this step or an earlier one)
      // (later than the step the true lines before it reached, by two or more: not the step it is on, and not the next)
      const reached = solutionMatch(q, (evidence(q, prefix).off.stepReport) || { lines: [], firstBreak: -1 }).step;
      const later = I.readSolution(q).values.filter(v => v.step >= Math.max(reached, 0) + 3);
      const here = I.readSolution(q).values.filter(v => v.step <= Math.max(reached, 0) + 2);
      for (const v of later.slice(0, 2)) {
        if (here.some(h => Math.abs(h.v - v.v) < 1e-9)) continue;
        test('laterValueFirst', q, [...prefix, `= ${String(Number(v.v.toPrecision(10)))}`], k);
      }
      // the final answer of a different seed, as a continuation and as a labelled line
      const other = generate(id, d, seed + 1000);
      if (other) {
        const v = I.readSolution(other).final, mine = I.readSolution(q).values;
        if (v && !mine.some(h => Math.abs(h.v - v.v) < 1e-9)) {
          test('otherSeedAnswer', q, [...prefix, `= ${String(Number(v.v.toPrecision(10)))}`], k);
          test('otherSeedAnswer', q, [...prefix, `x = ${String(Number(v.v.toPrecision(10)))}`], k);
        }
      }
    }
  }
  ok(ticked === 0, `no false tick: ${ticked} of ${exercised} wrong lines ticked (${tickedExamples.join(' || ')})`);
  ok(exercised >= 1500 && Object.keys(kinds).length >= 7, `no false tick: ${exercised} wrong lines reached the pass (${built} built), kinds ${JSON.stringify(kinds)}`);
  console.log(`no false tick: ${built} wrong lines built, ${exercised} left unjudged by the arithmetic check and handed to the pass, ${ticked} ticked; ${JSON.stringify(kinds)}`);
}

// ── b2 · adversarial: wrong lines NOT made by mutating a step into something near it, but built to look like a step ──────────
{
  let built = 0, exercised = 0, ticked = 0, gens = new Set(); const ex = []; const kinds = {};
  const canon = x => String(x).replace(/[\s{}*]/g, '');
  const SPLIT = /(?<![<>!])=(?!=)/;
  // an independent check (random points, a fitted constant) that a built line is not secretly the same condition as the original
  const sameCondition = (a, b) => {
    const pa = a.split(SPLIT).map(x => x.trim()), pb = b.split(SPLIT).map(x => x.trim());
    if (pa.length !== 2 || pb.length !== 2) return false;
    const A = pa.map(x => I.readSide(x)), B = pb.map(x => I.readSide(x));
    if (A.some(x => !x) || B.some(x => !x)) return false;
    const vars = [...new Set([...A, ...B].flatMap(x => x.vars || []))];
    const rnd = mulberry(99);
    const val = (info, env) => (info.value !== undefined ? info.value : (() => { try { return evaluate(info.ast, env); } catch { return NaN; } })());
    let ratio = null;
    for (let j = 0; j < 14; j++) {
      const env = Object.fromEntries(vars.map(v => [v, (rnd() - 0.5) * 9]));
      const fa = val(A[0], env) - val(A[1], env), fb = val(B[0], env) - val(B[1], env);
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
      if (Math.abs(fa) < 1e-9) { if (Math.abs(fb) > 1e-6) return false; continue; }
      const r = fb / fa;
      if (ratio === null) ratio = r; else if (Math.abs(r - ratio) > 1e-9 * Math.max(1, Math.abs(r))) return false;
    }
    return ratio !== null && Math.abs(ratio) > 1e-9;
  };
  const readTail = l => l.split(SPLIT).pop().trim();
  const solValues = q => I.readSolution(q).values.map(x => x.v);
  for (let round = 0; round < 6; round++) for (const id of ids) {
    const d = 1 + (round % 4), seed = 11 + round * 13 + (id.length % 9);
    const q = generate(id, d, seed);
    if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
    const worked = workedLines(q);
    const variants = [];
    for (const line of worked) {
      const parts = line.split(SPLIT).map(x => x.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1] || /[,<>]/.test(line)) continue;
      const [L, R] = parts;
      if (/^[A-Za-z]'*(?:\([^()]*\))?$/.test(L)) continue;   // a label: shifting it gives another true statement of the solution (r + 1 = 5 for r = 4)
      const bigs = line.match(/\d{3,}/g) || [];
      variants.push(['constAddedLeft', `${L} + 1 = ${R}`], ['constAddedRight', `${L} = ${R} + 1`], ['oneSideScaled', `2(${L}) = ${R}`],
        ['extraTerm', `${L} + 1 = ${R} + 2`], ...(/[A-Za-z]/.test(R) ? [['sharedRoots', `(${L})^2 = (${R})^2`]] : []), ['sharedRoots', `(${L} - (${R}))^2 = 0`]);
      if (bigs.length) variants.push(['largeNearMiss', line.replace(/\d{3,}/, n => String(Number(n) + 1))]);
      const letters = [...new Set(line.match(/(?<![A-Za-z])[A-Za-z](?![A-Za-z(])/g) || [])].filter(c => c !== 'e');
      if (letters.length) variants.push(['lettersShifted', letters.reduce((t, v) => t.replace(new RegExp(`(?<![A-Za-z])${v}(?![A-Za-z])`, 'g'), `(${v}+1)`), line)]);
      if (letters.length >= 2) variants.push(['twoLettersShifted', `${L.replace(new RegExp(`(?<![A-Za-z])${letters[0]}(?![A-Za-z])`, 'g'), `(${letters[0]}+1)`)} = ${R}`]);
    }
    // a true restatement of the question followed by a false statement on the same line
    for (const m of String(q.prompt).matchAll(/\$([^$]+)\$/g)) { const p = I.spanToPlain(m[1]); if (p && p.includes('=') && !/,/.test(p)) variants.push(['restateThenFalse', `${p}, 1 = 2`], ...(/\d/.test(p) && !canon(String(q.prompt)).includes(canon(p.replace(/\d+(?!.*\d)/, n => String(Number(n) + 1)))) ? [['restateThenShifted', `${p}, ${p.replace(/\d+(?!.*\d)/, n => String(Number(n) + 1))}`]] : [])); }
    for (const [kind, line] of variants.slice(0, 40)) {
      if (worked.some(w => canon(w) === canon(line))) continue;
      // a variant that is itself a true statement of the solution (k = 1 + 1 when the solution has k = 2) is not wrong
      { const tail = readTail(line); const v = tail !== null ? I.readSide(tail) : null; if (v && v.value !== undefined && solValues(q).some(x => Math.abs(x - v.value) < 1e-9) && !/[A-Za-z]/.test(tail)) continue; }
      if (kind !== 'restateThenFalse' && kind !== 'restateThenShifted' && worked.some(w => sameCondition(w, line))) continue;
      built++;
      const pages = [[line], worked.length ? [worked[0], line] : [line]];
      for (const lines of pages) {
        const { on, off } = evidence(q, lines);
        const i = lines.length - 1;
        if (!off.stepReport || off.stepReport.lines[i]?.status !== 'note') { if (off.stepReport) continue; }
        exercised++; gens.add(id); kinds[kind] = (kinds[kind] || 0) + 1;
        if (on.stepReport?.lines[i]?.status === 'ok') { ticked++; if (ex.length < 8) ex.push(`${kind}: ${line} / ${(on.stepReport.lines[i].note || '').slice(0, 40)} [${q.prompt.slice(0, 30)}]`); }
      }
    }
  }
  ok(ticked === 0, `adversarial: ${ticked} of ${exercised} look-alike wrong lines ticked (${ex.join(' || ')})`);
  ok(exercised >= 1500 && gens.size >= 150, `adversarial: ${exercised} lines from ${gens.size} generators`);
  console.log(`adversarial: ${built} look-alike wrong lines built, ${exercised} pages reached the pass from ${gens.size} generators, ${ticked} ticked; ${JSON.stringify(kinds)}`);
}

// ── a report exists only when a line was matched ────────────────────────────────────────────────────────────────────────
{
  const q = generate('y12-appdiff', 3, 7);
  const none = stepEvidence(q, '', ['hello world', '7 = 8'].join('\n'), { correct: false });
  const noMatch = stepEvidence(q, '', ['z = 4', 'p + q'].join('\n'), { correct: false });
  const withMatch = stepEvidence(q, '', ['y - 2 = -3(x - 1)'].join('\n'), { correct: false });
  const without = stepEvidence(q, '', ['y - 2 = -3(x - 1)'].join('\n'), { correct: false }, { solutionMatch: false });
  const offNo = stepEvidence(q, '', ['z = 4', 'p + q'].join('\n'), { correct: false }, { solutionMatch: false });
  ok(JSON.stringify(noMatch) === JSON.stringify(offNo), 'a page nothing on which is recognised gets exactly the reply it got before');
  ok(withMatch.stepReport && withMatch.stepReport.firstBreak === -1 && !withMatch.stepReport.diagnosis && withMatch.stepReport.lines.every(l => l.status !== 'break'), 'a page with a recognised line gets a report with no break and no diagnosis');
  ok(JSON.stringify(withMatch.partial) === JSON.stringify(without.partial) && JSON.stringify(withMatch.board ?? null) === JSON.stringify(without.board ?? null), 'the partial and the board are those of the same page without the pass');
  ok(JSON.stringify(none) === JSON.stringify(stepEvidence(q, '', ['hello world', '7 = 8'].join('\n'), { correct: false }, { solutionMatch: false })), 'a page with nothing recognised is exactly as it was without the pass');
}

// ── the reviewer's own look-alikes ──────────────────────────────────────────────────────────────────────────────────────
{
  const R = [['c11-straight-lines', 2, 11, ['y-(7) + 1 = 1(x-(2))']], ['c10-trig-standard-reasoning', 1, 3, ['2(sin(A-B)) = (1/2)', 'sin(A-B) + 1 = (1/2)']], ['c11-3d-section-jee-reasoning', 1, 3, ['2(-y+z) = 7']],
    ['c10-quadratic-context', 2, 29, ['x(x+1) + 1 = 29412']], ['c10-linear-pair-methods', 3, 3, ['8x-13y=787, 1 = 2', '8x-13y=787, 8x-13y=788']], ['c10-ap-daily-life-reasoning', 1, 29, ['(S(n))^2 = 5850^2']]];
  let n = 0, bad = [];
  for (const [id, d, seed, pageLines] of R) {
    const q = generate(id, d, seed); if (!q) continue;
    for (const line of pageLines) { n++; const r = evidence(q, [line]).on.stepReport; if (r && r.lines[0].status === 'ok' && r.lines[0].solutionMatch) bad.push(`${id}: ${line}`); }
  }
  ok(n >= 8 && bad.length === 0, `the reviewer's look-alikes are not ticked (${n} lines; ${bad.join(' | ')})`);
}

// ── restating is structural; contradictory statements on one line ─────────────────────────────────────────────────────────
{
  const q = generate('me11-functions', 2, 17);
  const rep = lines => solutionMatch(q, { lines: lines.map(text => ({ text, status: 'note', state: 'unverified', note: 'n' })), firstBreak: -1 }).report.lines;
  ok(q && rep(['f^(-2)(0)'])[0].status === 'note', 'f^(-2)(0) is not a restatement of f^(-1)(0)');
  ok(rep(['f^(-1)(0)'])[0].status === 'ok' && rep(['f^(-1)(0)'])[0].state === 'given' && rep(['f^{-1}(0)'])[0].state === 'given', 'f^(-1)(0) restates the question, in either bracket style');
  const q2 = generate('c11-inequality-region-jee-reasoning', 1, 29);
  const two = q2 ? solutionMatch(q2, { lines: [{ text: 'x=4, x = 4 + 3', status: 'note', state: 'unverified', note: 'n' }], firstBreak: -1 }) : { matched: 0 };
  ok(two.matched === 0, 'two statements giving x two values are not ticked');
  // 200 generated prompts, one digit, one exponent or one sign changed
  let n = 0, bad = [], gens = new Set();
  for (let round = 0; round < 8 && n < 400; round++) for (const id of ids) {
    const qq = generate(id, 1 + round % 4, 3 + round * 17); if (!qq) continue;
    const spans = [...String(qq.prompt).matchAll(/\$([^$]+)\$/g)].map(m => I.spanToPlain(m[1])).filter(p => p && !/,/.test(p));
    for (const p of spans) {
      const muts = [p.replace(/\d(?!.*\d)/, c => String((Number(c) + 1) % 10)), p.replace(/\^\(?(\d)\)?/, (m, c) => `^${(Number(c) + 1) % 10}`), p.replace(/([+\-])(?=\s*[\dA-Za-z(])/, m => (m === '+' ? '-' : '+'))];
      for (const m of muts) {
        if (m === p || spans.some(x => canon0(x) === canon0(m))) continue;
        n++; gens.add(id);
        const r = solutionMatch(qq, { lines: [{ text: m, status: 'note', state: 'unverified', note: 'n' }], firstBreak: -1 }).report.lines[0];
        if (r.state === 'given') bad.push(`${id}: ${m}`);
      }
    }
  }
  ok(n >= 200 && gens.size >= 40 && bad.length === 0, `changed prompt expressions never restate the question (${n} cases, ${gens.size} generators, ${bad.length} ticked: ${bad.slice(0, 3).join(' | ')})`);
  console.log(`restatement: ${n} changed-prompt cases from ${gens.size} generators, ${bad.length} ticked`);
}

// ── c · the battery ──────────────────────────────────────────────────────────
{
  const cases = JSON.parse(fs.readFileSync(new URL('./fixtures/solution-match-battery.json', import.meta.url), 'utf8'));
  let before = 0, after = 0, crossed = 0, fewer = 0, noReport = 0, noReportNow = 0, total = 0;
  const per = [];
  for (const c of cases) {
    const q = generate(c.generator, c.d, c.seed);
    const { on, off } = evidence(q, c.lines);
    const t = r => (r ? r.lines.filter(l => l.status === 'ok').length : 0);
    const b = t(off.stepReport), a = t(on.stepReport);
    before += b; after += a; total += c.lines.length;
    if (on.stepReport?.lines.some(l => l.status === 'break')) crossed++;
    if (a < b) fewer++;
    if (!off.stepReport) { noReport++; if (!on.stepReport) noReportNow++; }
    per.push({ g: c.generator, before: b, after: a, n: c.lines.length });
  }
  ok(cases.length === 30, 'the battery fixture has 30 questions');
  ok(crossed === 0, `battery: no cross (${crossed})`);
  ok(fewer === 0, `battery: never fewer ticks than before (${fewer})`);
  ok(after > before, `battery: more ticks than before (${before} -> ${after})`);
  ok(after >= 110, `battery: at least 110 of 145 lines ticked (${after})`);
  ok(noReportNow === 0, `battery: every page has a report now (${noReportNow} without)`);
  const byTopic = {};
  for (const p of per) { byTopic[p.g] ??= { before: 0, after: 0, n: 0 }; byTopic[p.g].before += p.before; byTopic[p.g].after += p.after; byTopic[p.g].n += p.n; }
  const weakest = Object.entries(byTopic).sort((x, y) => x[1].after / x[1].n - y[1].after / y[1].n).slice(0, 5).map(([g, v]) => `${g} ${v.before}->${v.after}/${v.n}`);
  console.log(`battery: ${total} lines, ticks ${before} -> ${after} (${(100 * before / total).toFixed(0)}% -> ${(100 * after / total).toFixed(0)}%), pages with no report ${noReport} -> ${noReportNow}; weakest: ${weakest.join(', ')}`);
}

// ── e · a slip warning never lands on a true line (Part B) ───────────────────
//   the battery's 145 correct lines, and thousands of correct continuation lines built from the worked solutions of many generators: every
//   identity the solution itself writes (expansions, factorisations, common denominators) and each side rewritten in equivalent forms
{
  const warnOf = (q, lines) => { const r = stepEvidence(q, '', lines.join('\n'), { correct: false }, { slipWarnings: true }).stepReport; return (r?.lines || []).filter(l => l.slipWarning === true).length; };
  // the battery, correct by construction
  const cases = JSON.parse(fs.readFileSync(new URL('./fixtures/solution-match-battery.json', import.meta.url), 'utf8'));
  let batteryWarnings = 0, batteryLines = 0;
  for (const c of cases) { const q = generate(c.generator, c.d, c.seed); if (!q) continue; batteryLines += c.lines.length; batteryWarnings += warnOf(q, c.lines); }
  ok(batteryLines === 145 && batteryWarnings === 0, `slip warning: 0 warnings on the battery's ${batteryLines} correct lines (${batteryWarnings})`);
  // equivalent forms: each is the same function of the same letters by construction
  const forms = e => {
    const out = [`1*(${e})`, `(${e})/1`, `2*(${e})/2`, `-(-(${e}))`, `(${e})+0`, `0+(${e})`, `(${e})*(1)`];
    if (/(?<![A-Za-z])x(?![A-Za-z])/.test(e)) out.push(`(${e})+x-x`, `(${e})*(x+1)/(x+1)`);
    if (/tan\(([^()]+)\)/.test(e)) out.push(e.replace(/tan\(([^()]+)\)/, 'sin($1)/cos($1)'));
    if (/sec\(([^()]+)\)/.test(e)) out.push(e.replace(/sec\(([^()]+)\)/, '1/cos($1)'));
    if (/cos\(([^()]+)\)\^2/.test(e)) out.push(e.replace(/cos\(([^()]+)\)\^2/, '(1-sin($1)^2)'));
    return out;
  };
  const sidesOfPlain = p => p.split(/(?<![<>!])=(?!=)/).map(x => x.trim()).filter(Boolean);
  let lines = 0, pagesBuilt = 0, warnings = 0, solutionChains = 0;
  const gensSeen = new Set(), bad = [];
  for (let round = 0; round < 6 && lines < 4500; round++) {
    for (const id of ids) {
      const q = generate(id, 1 + (round % 4), 5 + round * 11 + (id.length % 7));
      if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
      const page = [], truth = [];   // page lines; every `= …` continuation is equal to the line above
      for (const w of workedLines(q)) {
        const sides = sidesOfPlain(w);
        if (sides.length < 2) continue;
        const infos = sides.map(x => I.readSide(x));
        const exprs = sides.map((x, k) => ({ x, info: infos[k] })).filter(t => t.info && t.info.vars && t.info.vars.length && !/[<>≈]|,/.test(t.x));
        for (let k = 1; k < exprs.length; k++) {
          if (!I.sameSidePublic(exprs[k - 1].info, exprs[k].info, exprs[k - 1].x, exprs[k].x)) continue;
          // a chain the solution writes itself: the first side, then each equal side
          page.push(k === 1 ? exprs[0].x : null);
          page.push(`= ${exprs[k].x}`); truth.push(exprs[k].x); solutionChains++;
        }
        const base = exprs.length ? exprs[exprs.length - 1].x : null;
        if (base) { page.push(base); let prevLine = base; for (const f of forms(base)) { page.push(`= ${f}`); prevLine = f; } void prevLine; }
      }
      const clean = page.filter(Boolean).slice(0, 20);
      if (clean.length < 2) continue;
      const n = clean.filter(x => x.startsWith('=') && /[A-Za-zθπ]/.test(x)).length;
      lines += n; pagesBuilt++; gensSeen.add(id);
      const w = warnOf(q, clean);
      if (w) { warnings += w; if (bad.length < 3) bad.push(`${id}: ${clean.slice(0, 4).join(' / ')}`); }
    }
  }
  ok(lines >= 3000 && gensSeen.size >= 150, `slip warning proof: ${lines} correct continuation lines in ${pagesBuilt} pages from ${gensSeen.size} generators`);
  ok(warnings === 0, `slip warning: 0 warnings on correct continuation lines (${warnings}: ${bad.join(' | ')})`);
  console.log(`slip warning: ${batteryLines} battery lines and ${lines} correct continuation lines (${solutionChains} identities the solutions write) from ${gensSeen.size} generators, ${batteryWarnings + warnings} warnings`);
  // and it does fire on a real slip, and says what it should
  const q = generate('y12-diff', 3, 7);
  const r = stepEvidence(q, '', ['A = (4t+2)(4t+1)', '= 16t^2 + 12t + 2', '= 16t^2 + 13t + 2'].join('\n'), { correct: false }, { slipWarnings: true }).stepReport;
  const L = r.lines;
  ok(L[2].status === 'note' && L[2].slipWarning === true && /^This is not equal to the line above for every value of t \(for example at t = [-\d.]+: [-\d.]+ against [-\d.]+\)\. Check this step\.$/.test(L[2].note), `a slip line warns, as a note (${L[2].status}: ${L[2].note})`);
  ok(L.every(l => l.status !== 'break'), 'a warning is never a cross');
  const none = ['x^2 - 4 = 0', '= (x-2)(x+2)'], eqn = ['2x + 3 = 11', '2x = 8'], ambig = ['y = 3/tan x', "y' = -3[tan x]^-2 x sec^2 x", '= -3sin x/cos^2 x x 1/cos^2 x'], deriv = ['y = x^2', '= 2x'];
  for (const [name, pg] of [['an equation then its factorised side', none], ['two equation steps', eqn], ['a lone x that may be a times sign', ambig], ['a derivative under its function', deriv]]) ok(warnOf(q, pg) === 0, `no warning: ${name}`);
  const off = stepEvidence(q, '', ['A = (4t+2)(4t+1)', '= 16t^2 + 12t + 2', '= 16t^2 + 13t + 2'].join('\n'), { correct: false }).stepReport;
  ok(!off.lines.some(l => l.slipWarning), 'the warning is a switch of its own: not part of the default pass');
}

// ── f · review round: tuples are never numbers, a substitution is checked, a warning needs a chain ────────────
{
  const tick = (q, lines, k, o = {}) => { const r = stepEvidence(q, '', lines.join('\n'), { correct: false }, o).stepReport; return r?.lines?.[k] ?? null; };
  const noTick = (l, why) => ok(!l || l.status !== 'ok' || !/value at step|Matches step|restates/.test(String(l.note)), why);
  // a comma list is read component by component, never as its sum
  const circle = generate('c11-circle-jee-reasoning', 1, 7);
  noTick(tick(circle, ['(x-3)^2+(y+3)^2=1', '(4, -3)'], 1), `a wrong centre (4, -3) is not ticked as the value 1 (${tick(circle, ['(x-3)^2+(y+3)^2=1', '(4, -3)'], 1)?.note})`);
  const vec = generate('me12-vectors', 1, 3);
  const v2 = tick(vec, ['P(-3,1) Q(-4,-5) R(3,0)', 'QR = (7,6)', '= (7,6)'], 2);
  ok(!v2 || !/76/.test(String(v2.note)), `= (7,6) is compared with the tuple above, never read as 76 (${v2?.note})`);
  noTick(tick(vec, ['[0, 7/4]'], 0), 'an interval [0, 7/4] is not the number 1.75');
  ok(I.readSide('(7,6)') === null && I.readSide('[0, 7/4]') === null && I.readSide('(4, -3)') === null, 'a bracketed comma list is never one number');
  // 300+ tuple lines whose components sum or concatenate to a solution value: none is ticked
  let tuples = 0, tupleTicks = 0;
  for (const id of ids) {
    const q = generate(id, 2, 9);
    if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
    const vals = I.readSolution(q).values.map(x => x.v).filter(v => Number.isInteger(v) && Math.abs(v) < 1e6).slice(0, 2);
    const worked = workedLines(q).slice(0, 1);
    for (const v of vals) for (const t of [`(${v + 3}, -3)`, `(${v - 1}, 1)`, `[${v + 2}; -2]`, `(${String(Math.abs(v))[0]}, ${String(Math.abs(v)).slice(1) || 0})`]) {
      const page = [...worked, t];
      const r = stepEvidence(q, '', page.join('\n'), { correct: false }, { slipWarnings: true }).stepReport;
      const l = r?.lines?.[page.length - 1];
      tuples++;
      if (l && l.status === 'ok' && !/equals the line above/.test(l.note) ) tupleTicks++;
    }
  }
  ok(tuples >= 300 && tupleTicks === 0, `tuple lines that sum or join to a solution value: ${tuples} built, ${tupleTicks} ticked`);
  // a substitution counts only where the solution substitutes that name at that value, and only for the expression it gives there
  const diff = generate('y11-diff', 2, 11);
  const base = ['d = 2t^3 + 4t^2 + 5t', 'd′ = 6t^2 + 8t + 5'];
  noTick(tick(diff, [...base, 't = 5: 6(16) + 8(4) + 5'], 2), 'a substitution at t = 5 is not the solution\'s value at step 2');
  noTick(tick(diff, [...base, 't = 7: 6(16) + 8(4) + 5'], 2), 'a substitution at t = 7 is not ticked');
  ok(tick(diff, [...base, 't = 4: 6(16) + 8(4) + 5'], 2)?.status === 'ok', 'the substitution t = 4 with the right expression still ticks');
  const bad = [...base, 't = 4: 6(25) + 8(4) + 5', '= 150 + 32 + 5', '= 187'];
  const lb = stepEvidence(diff, '', bad.join('\n'), { correct: false }, { slipWarnings: true }).stepReport.lines;
  ok(lb[2].status === 'note' && lb[2].slipWarning === true && /^This is not what the line above gives at t = 4 \(133 against 187\)\. Check the substitution\.$/.test(lb[2].note), `a wrong substituted expression is warned (${lb[2].note})`);
  ok(lb.every(l => l.status !== 'break') && lb.slice(3).every(l => l.status !== 'ok' || l.state === 'arithmetic'), 'a chain under it keeps the plain true-as-written tick and nothing is crossed');
  const lg = stepEvidence(diff, '', [...base, 't = 4: 6(16) + 8(4) + 5', '= 96 + 32 + 5', '= 133'].join('\n'), { correct: false }, { slipWarnings: true }).stepReport.lines;
  ok(!lg.some(l => l.slipWarning), 'a true substitution is not warned');
  // a warning needs a continuation of a chain, never two full statements with one label; a restricted-domain rewrite is not a slip
  const wq = generate('y12-diff', 3, 7);
  const warns = pg => (stepEvidence(wq, '', pg.join('\n'), { correct: false }, { slipWarnings: true }).stepReport?.lines || []).filter(l => l.slipWarning).length;
  const same = [['y = 2x + 1', 'y = 3x - 4'], ['x = 2y + 1', 'x = 3y - 1'], ['y = x^2', 'y = x^2 + 3'], ['f(x) = x^2', 'f(x) = x^3'], ['A = 3x^2', 'A = 5x'], ['d = 3t', 'd = 2t^2'], ['y = x^2', '= x^2 + 3'], ['y = x^2', '= x^2', 'y = x^2 + 3']];
  for (const pg of same) ok(warns(pg) === 0, `no warning on ${pg.join(' / ')}`);
  const dom = [['√(x^2)', '= √(x^2)', '= x'], ['(x^2)^(1/2)', '= (x^2)^(1/2)', '= x'], ['√(x^2 y^2)', '= √(x^2 y^2)', '= xy'], ['arccos(cos(x))', '= arccos(cos(x))', '= x']];
  for (const pg of dom) ok(warns(pg) === 0, `no warning on the domain rewrite ${pg.join(' / ')}`);
  ok(warns(['A = (4t+2)(4t+1)', '= 16t^2 + 12t + 2', '= 16t^2 + 13t + 2']) === 1 && warns(['y = 3x^2 + 6x', '= 3x(x+2)', '= 3x(x+3)']) === 1, 'a true slip in a chain still warns');
  // the slash column needs another vector on the page
  ok(tick(wq, ['|[3/4]| = 5'], 0)?.status !== 'ok', '|[3/4]| = 5 with no vector on the page is left as before');
  // second review: a substitution is judged by structure, a continuation of a wrong or warned line is not ticked
  const dq = generate('y11-diff', 2, 11), dbase = ['d = 2t^3 + 4t^2 + 5t', 'd′ = 6t^2 + 8t + 5'];
  const valueTick = (q, lines) => /value at step|Matches step/.test(String(tick(q, lines, lines.length - 1)?.note)) && tick(q, lines, lines.length - 1)?.status === 'ok';
  for (const bad of ['t = 4: 6(8) + 8(10) + 5', 't = 4: 3(44) + 1']) ok(!valueTick(dq, [...dbase, bad]), `a right value with the wrong structure is not a substitution: ${bad}`);
  ok(!valueTick(generate('c7-letter-pattern-reasoning', 1, 5), ['n+2', 'n = 4: (4)+7 + 1']) && !valueTick(generate('c11-ellipse-hyperbola-jee-reasoning', 1, 3), ['c = 2: 2 + 1']) && !valueTick(generate('c11-parabola-jee-reasoning', 2, 13), ['a = -1: -1 + 1']), 'the three other reviewer cases are not ticked');
  for (const good of ['t = 4: 6(4)^2 + 8(4) + 5', 't = 4: 6(16) + 8(4) + 5', 't = 4: 96 + 32 + 5', 't = 4: 5 + 8(4) + 6(4)^2']) ok(valueTick(dq, [...dbase, good]), `the substitution still ticks: ${good}`);
  let structural = 0, structuralTicks = 0;
  for (const id of ids) {
    const q = generate(id, 2, 9);
    if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
    const [name, a] = [...FCH.knownSubstitutions(q)][0]?.split('|') ?? [];
    if (!name) continue;
    const worked = workedLines(q).slice(0, 2);
    for (const v of I.readSolution(q).values.map(x => x.v).filter(Number.isInteger).slice(0, 2)) for (const e of [`${v - 1} + 1`, `${v + 3} - 3`, `2(${v}) - ${v}`, `${v + 1} - 1 + 0`]) {
      const page = [...worked, `${name} = ${a}: ${e}`];
      structural++;
      if (valueTick(q, page)) structuralTicks++;
    }
  }
  ok(structural >= 300 && structuralTicks === 0, `right value, wrong structure after a substitution prefix: ${structural} lines, ${structuralTicks} ticked`);
  const cont = pg => { const r = stepEvidence(vec, '', pg.join('\n'), { correct: false }, { slipWarnings: true }).stepReport; return r?.lines ?? []; };
  ok(cont(['P(-3,1) Q(-4,-5) R(3,0)', 'QR = (7,6)', '= (7,6)'])[2]?.status !== 'ok', 'a continuation of a contradicted vector line is not ticked');
  const wr = stepEvidence(dq, '', [...dbase, 't = 4: 6(25) + 8(4) + 5', '= 150 + 32 + 5', '= 187'].join('\n'), { correct: false }, { slipWarnings: true }).stepReport.lines;
  ok(wr[2].slipWarning === true && wr.slice(3).every(l => l.status === 'note' && l.note === 'Follows from the line above, which Pri could not confirm.'), 'the continuations of a warned line are notes that say so');
  const ay = generate('y12-appdiff', 2, 5);
  const ar = stepEvidence(ay, '', ['y = 2x^2 + 13x - 8', 'y′ = 4x + 14', '= 4x + 14'].join('\n'), { correct: false }, { slipWarnings: true }).stepReport.lines;
  ok(ar[2].status !== 'ok', `a chain after a contradicted labelled line is not ticked (${ar.map(l => l.status)})`);
  // every worked line, consecutive, with warnings on: full statements are never warned
  let consecutive = 0, cw = 0;
  for (const id of ids) {
    const q = generate(id, 2, 13);
    if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
    const wl = workedLines(q).slice(0, 20);
    if (wl.length < 2) continue;
    consecutive += wl.length - 1;
    cw += (stepEvidence(q, '', wl.join('\n'), { correct: false }, { slipWarnings: true }).stepReport?.lines || []).filter(l => l.slipWarning).length;
  }
  ok(consecutive >= 500 && cw === 0, `consecutive worked statements (${consecutive} lines): ${cw} warnings`);
  // identity with the pass ON and warnings ON: marks identical, only notes become ticks or warnings
  let pages = 0, diffs = [];
  for (let round = 0; round < 6; round++) for (const id of ids) {
    const q = generate(id, 1 + (round % 4), 3 + round * 7);
    if (!q || OBJ.has(q.answerType) || Array.isArray(q.boardScheme) || q.answerType === 'graph-sketch') continue;
    let wl = workedLines(q).slice(0, 20);
    if (wl.length < 2) continue;
    if (round % 2) wl[1] = wl[1].replace(/\d/, c => String((Number(c) + 1) % 10));
    const w = wl.join('\n');
    const a = stepEvidence(q, '', w, { correct: false }, { slipWarnings: true }), b = stepEvidence(q, '', w, { correct: false }, { solutionMatch: false });
    pages++;
    if (JSON.stringify(a.partial) !== JSON.stringify(b.partial) || JSON.stringify(a.board ?? null) !== JSON.stringify(b.board ?? null)) diffs.push(`${id}: marks`);
    const x = a.stepReport, y = b.stepReport;
    if (!y) continue;
    if (!x || x.firstBreak !== y.firstBreak || x.lines.length !== y.lines.length) { diffs.push(`${id}: shape`); continue; }
    x.lines.forEach((l, i) => { const o = y.lines[i]; if (l.status === 'break' && o.status !== 'break') diffs.push(`${id}: cross`); if (l.slipFollow === true) { if (o.status !== 'ok') diffs.push(`${id}: followed ${o.status}`); } else if (!(l.solutionMatch === true || l.slipWarning === true) && (l.status !== o.status || l.note !== o.note)) diffs.push(`${id}: line ${i + 1}`); else if (l.slipWarning === true && o.status !== 'note') diffs.push(`${id}: warned ${o.status}`); });
  }
  ok(pages >= 1000 && diffs.length === 0, `identity with the pass and warnings on: ${pages} pages, ${diffs.length} differences ${diffs.slice(0, 3).join(' | ')}`);
}

// ── d · budget, answer-blindness, the shape of a tick ────────────────────────
{
  const q = generate('y12-trigcalc', 3, 7);
  const lines = ["y' = 4cos4x", 'x = 3π/16: y\' = 4cos(3π/4)', '= 4(-√2/2)', '= -2√2'];
  while (lines.length < 20) lines.push(`sin${lines.length}x + cos${lines.length}x = ${lines.length}`);
  const report = { lines: lines.map(text => ({ text, status: 'note', state: 'unverified', note: 'n' })), firstBreak: -1 };
  const t0 = Date.now();
  let r = null;
  for (let k = 0; k < 20; k++) r = solutionMatch(q, report);
  const ms = (Date.now() - t0) / 20;
  ok(ms < 1500, `a 20-line page stays inside its budget (${ms.toFixed(0)} ms)`);
  ok(r.report.lines.length === 20, 'every line is reported');
  console.log(`budget: a 20-line page takes ${ms.toFixed(0)} ms`);
  // answer-blind: nothing but prompt and steps is read from the question
  const spy = new Proxy({ prompt: q.prompt, steps: q.steps }, { get(t, k) { if (k !== 'prompt' && k !== 'steps') throw new Error(`read ${String(k)}`); return t[k]; } });
  let threw = false, again = null;
  try { again = solutionMatch(spy, report); } catch { threw = true; }
  ok(!threw && JSON.stringify(again.report) === JSON.stringify(r.report), 'the pass reads the prompt and the steps and nothing else of the question');
  // the shape of a tick
  const t = solutionMatch(generate('y12-appdiff', 3, 7), { lines: [{ text: "y' = 2x - 5", status: 'note', state: 'unverified', note: 'n' }, { text: 'y - 2 = -3(x - 1)', status: 'note', state: 'unverified', note: 'n' }, { text: 'y = -3x + 5', status: 'note', state: 'unverified', note: 'n' }], firstBreak: -1 });
  ok(t.matched === 3 && t.report.lines[1].state === 'verified' && /^Matches step 3 of the worked solution/.test(t.report.lines[1].note) && t.report.solutionMatched === true && t.report.arithmetic !== true, `a matched line is verified and names its step (${JSON.stringify(t.report.lines.map(l => [l.status, l.state, l.note]))})`);
  ok(t.report.summary.verified.join() === '1,2,3' && t.report.summary.checked === 3 && t.report.summary.unverified.length === 0, `the summary counts follow the lines (${JSON.stringify(t.report.summary)})`);
  // nothing at or after the first break is ticked, and a cross is never made
  const broken = solutionMatch(generate('y12-appdiff', 3, 7), { lines: [{ text: 'y - 2 = -3(x - 1)', status: 'break', state: 'wrong', note: 'x' }, { text: 'y = -3x + 5', status: 'note', state: 'unverified', note: 'n' }], firstBreak: 0 });
  ok(broken.matched === 0, 'a line after the first break is not ticked');
  // a line of words is never ticked
  const words = solutionMatch(generate('y12-appdiff', 3, 7), { lines: [{ text: 'so the tangent is y = -3x + 5', status: 'note', state: 'unverified', note: 'n' }, { text: 'y = -3x + 6', status: 'note', state: 'unverified', note: 'n' }], firstBreak: -1 });
  ok(words.matched === 0, 'a line with words in it, and a wrong line, are not ticked');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
console.log('PASS solution-match-check');
