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
import { solutionMatch, _internals as I } from '../../client/src/engine/solutionMatch.js';

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
  const byTopic = {};
  for (const p of per) { byTopic[p.g] ??= { before: 0, after: 0, n: 0 }; byTopic[p.g].before += p.before; byTopic[p.g].after += p.after; byTopic[p.g].n += p.n; }
  const weakest = Object.entries(byTopic).sort((x, y) => x[1].after / x[1].n - y[1].after / y[1].n).slice(0, 5).map(([g, v]) => `${g} ${v.before}->${v.after}/${v.n}`);
  console.log(`battery: ${total} lines, ticks ${before} -> ${after} (${(100 * before / total).toFixed(0)}% -> ${(100 * after / total).toFixed(0)}%), pages with no report ${noReport} -> ${noReportNow}; weakest: ${weakest.join(', ')}`);
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
