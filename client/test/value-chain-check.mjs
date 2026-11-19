// Pri Learning · value-chain step verdicts (engine/valueChain.js).
//
// Owner report: a Year 12 Extension 1 buoy question, "What is the maximum value
// of h?", h(t) = 22 + 5 sin(πt/6). The student wrote the function, `max = 22 + 5`
// and `= 27`; only the last line, the answer, was ticked, because the server
// held no Step Check meta for the question and never checked a line.
//
// Part 1  The rules, with adversarial lines (wrong max, compensating errors,
//         label/value mismatch, a right value by a wrong expression, degrees).
// Part 2  Zero false ticks over the generated family, against two computations
//         that never see the generator's `stepcheck`: the question's own prompt
//         parsed back to its parameters, then (a) a brute-force numeric scan and
//         (b) SymPy (function_range, periodicity, exact substitution) when
//         python3 has it (PRI_SYMPY_PATH may point at it).
// Part 3  The server's meta reaches the checker, and a value-chain report buys
//         no method mark and counts as no verified transition.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stepCheck, methodMarks } from '../src/engine/checker.js';
import { fullyVerifiedWorking } from '../src/engine/misconceptions.js';
import { year12Nsw } from '../src/engine/generators/year12-nsw.js';
import { workingEvidence, workingEvidenceCopy } from '../src/components/attemptEvidence.js';
import { stepMetaFor } from '../../server/platform/markerOps.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const verdicts = (meta, lines) => stepCheck(meta, lines.join('\n')).lines.map(l => l.status);
const META = { kind: 'value-chain', fn: { name: 'h', variable: 't', expr: '22+5*sin(pi*t/6)' },
  quantities: { max: 27, min: 17, amplitude: 5, midline: 22, period: 12 }, fullDomain: true };   // as the generator issues it (fullDomain: the prompt states the model for every time)

// ── Part 1 · the rules ───────────────────────────────────────────────────────
let r = stepCheck(META, ['22 + 5sin(πt/6)', 'max = 22 + 5', '= 27'].join('\n'));
ok(r.lines.map(l => l.status).join() === 'ok,ok,ok', `the owner's working: every line verified (${r.lines.map(l => l.status)})`);
ok(r.lines[0].restates === true, 'the restated function is marked as restating the question');
ok(r.source === 'value-chain' && r.firstBreak === -1, 'the report names its source and has no break');

// d. the mis-read line is unverified and does not block the lines after it
r = stepCheck(META, ['22+5sin((n+)/6)', 'max = 22 + 5', '= 27'].join('\n'));
ok(r.lines.map(l => l.status).join() === 'note,ok,ok', 'a mis-read first line is a note and later lines are still verified');
ok(r.lines[0].unreadable === true && r.lines[0].unverified === true, 'the unreadable line says so');
ok(r.firstBreak === -1, 'an unreadable line is never a break');

// a. restatement forms; a different function is NOT ticked and NOT a break
ok(verdicts(META, ['h(t) = 22 + 5 sin(pi t / 6)']).join() === 'ok', 'h(t) = … restates');
ok(verdicts(META, ['5 sin(pi*t/6) + 22']).join() === 'ok', 'an equivalent rearrangement of the given function restates');
ok(verdicts(META, ['22 + 5 sin(pi*t/3)']).join() === 'note', 'a different function is not ticked (and the reader may be at fault, so not a break either)');
ok(verdicts(META, ['h(t) = 22 + 5 sin(pi*t/3)']).join() === 'note', 'h(t) = a different function is a note, never a break');
ok(verdicts(META, ['22 + 5']).join() === 'note', 'a bare number is not a claim about the question');

// b. labelled values
const T = lines => verdicts(META, lines).join();
ok(T(['max = 22 + 5']) === 'ok' && T(['maximum = 27']) === 'ok' && T(['Max value = 27']) === 'ok', 'max in its spellings');
ok(T(['min = 22 - 5']) === 'ok' && T(['min = 22 − 5']) === 'ok' && T(['minimum = 17']) === 'ok', 'min in its spellings (ASCII and U+2212 minus)');
ok(T(['amplitude = 5']) === 'ok' && T(['midline = 22']) === 'ok', 'amplitude and midline');
ok(T(['period = 2π/(π/6)']) === 'ok' && T(['period = 12']) === 'ok', 'period');
ok(T(['h(3) = 22 + 5 sin(π/2)']) === 'ok' && T(['h(3) = 22 + 5 sin(π/2) = 27']) === 'ok', 'a function evaluation, one value or a chain');
ok(T(['h(1) = 22 + 5 sin(π/6) = 24.5']) === 'ok', 'h(1) with a non-integer value');
ok(T(['h(0) = 22']) === 'ok', 'h(0)');

// adversarial: wrong value, wrong label, wrong function value
ok(T(['max = 22 - 5']) === 'break', 'max = 22 − 5 is a break');
ok(T(['max = 22 + 5 = 17']) === 'break', 'a chain whose last value is wrong is a break');
ok(T(['max = 27 = 22 + 5']) === 'ok', 'a chain of true values in either order');
ok(T(['min = 27']) === 'break', 'label/value mismatch: min = 27 is a break');
ok(T(['max = 17']) === 'break', 'label/value mismatch: max = 17 is a break');
ok(T(['amplitude = 22']) === 'break' && T(['period = 6']) === 'break', 'amplitude and period mismatches break');
ok(T(['h(3) = 22 + 5 sin(π/6)']) === 'break', 'h(3) with the wrong angle evaluates to 24.5, not h(3) = 27');
ok(T(['h(3) = 22 + 5']) === 'ok', 'h(3) = 22 + 5 is a true value (27) and is ticked');
// compensating errors: the value is true, so the line is true; the false line 20 + 8 is not ticked
ok(T(['max = 20 + 7']) === 'ok', 'a true value is never marked wrong, even by another route (20 + 7)');
ok(T(['max = 20 + 8']) === 'break', 'max = 20 + 8 is 28, not the maximum');
ok(T(['max = 22 + 5 = 28']) === 'break', 'a correct sum followed by a false value breaks');
// the final answer alone never ticks an unlabelled line
ok(T(['27']) === 'note' && T(['x = 27']) === 'note', 'a bare 27 or an unrecognised label is not ticked');
ok(T(['top = 27']) === 'note' && T(['M = 27']) === 'note' && T(['T = 12']) === 'note', 'labels off the whitelist abstain, even with a true value');
ok(T(['range = 10']) === 'note', 'range is ambiguous (the interval or its width): abstain');
ok(T(['h(t) = 27']) === 'note', 'h(t) = 27 is not the function: not ticked');
ok(T(['h(x) = 22']) === 'note' && T(['h(t+1) = 22']) === 'note', 'an argument that is not a constant abstains');
ok(T(['max = 22 + 5 sin(pi t/6)']) === 'note', 'a value line with a letter in it abstains');
ok(T(['max = 22 + 5 m']) === 'note', 'a unit or unread tail abstains');
// degrees: sin 90 might mean 90°, so a mismatch is not a break
ok(T(['h(3) = 22 + 5 sin(90)']) === 'note', 'a trigonometric value with no π that disagrees abstains (degrees)');
ok(T(['max = 22 + 5 sin pi/2']) === 'note', 'sin without brackets is ambiguous and abstains');
ok(T(['max = 22 + 5 sin(π/2)']) === 'ok', 'sin(π/2) is read in radians and agrees');
ok(T(['max ≈ 27']) === 'note' && T(['max < 28']) === 'note', 'relations other than = abstain');

// c. continuation
ok(T(['max = 22 + 5', '= 27']) === 'ok,ok', 'continuation after a verified value');
ok(T(['max = 22 + 5', '= 28']) === 'ok,break', 'a continuation that is not equal to the line above breaks');
ok(T(['max = 22 + 5', '= 27 = 27']) === 'ok,ok', 'a double continuation');
ok(T(['top = 27', '= 27']) === 'note,note', 'a continuation after an unverified line is not ticked on the final value alone');
ok(T(['22+5sin((n+)/6)', '= 27']) === 'note,note', 'a continuation after an unreadable line is not ticked');
ok(T(['= 27']) === 'note', 'a lone continuation has nothing to continue from');
ok(T(['h(t) = 22 + 5 sin(pi t/6)', '= 22 + 5 sin(pi t/6)']) === 'ok,ok', 'continuation after the restated function: the same function');
ok(T(['h(t) = 22 + 5 sin(pi t/6)', '= 27']) === 'ok,note', 'a number after the function is not provably equal to it (t is free): abstain');
ok(T(['max = 22 + 5', '= 27', '= 27']) === 'ok,ok,ok', 'the chain keeps going');

// after a break nothing else is ticked; an unreadable line never blocks a good one
ok(T(['max = 22 - 5', 'max = 27']) === 'break,note', 'nothing after the first break is ticked (the engine\'s convention)');
r = stepCheck(META, 'max = 22 - 5\nmax = 27');
ok(r.firstBreak === 0 && r.diagnosis?.code === 'value-not-true' && r.diagnosis.confidence === 'high', 'the break names its diagnosis');
ok(!/27/.test(r.lines[0].note), 'the break note does not give the answer away');
ok(T(['@@@', 'max = 27']) === 'note,ok' && T(['', 'max = 27']) === 'ok', 'junk before a good line does not block it');

// a degenerate or hostile meta abstains rather than ticking
const bad = { kind: 'value-chain', fn: { name: 'h', variable: 't', expr: '22+5*sin(pi*t/6)' }, quantities: { max: 30, min: 17, amplitude: 5, midline: 22, period: 6 }, fullDomain: true };
ok(verdicts(bad, ['max = 30']).join() === 'note', 'a quantity the function does not bear out (max 30) is never used, even for the line that matches it');
ok(verdicts(bad, ['period = 6']).join() === 'note', 'a period the function does not repeat at (6, half the true one) is not used');
ok(verdicts(bad, ['min = 17']).join() === 'ok', 'a quantity that is borne out still works');
ok(verdicts({ kind: 'value-chain', fn: { name: 'h', variable: 't', expr: 'q+1' } }, ['max = 1']).join() === 'note', 'a function with a foreign letter abstains');
ok(verdicts({ kind: 'value-chain' }, ['max = 1']).join() === 'note', 'a meta with no function abstains');
ok(verdicts(META, ['max = 27'.padEnd(400, ' ') + '+0']).join() === 'note', 'a very long line is not checked');

// ── Part 3 · wiring ──────────────────────────────────────────────────────────
ok(methodMarks({ meta: META, working: 'max = 22 + 5\n= 27', marks: 3 }) === null, 'no method mark is ever awarded for value-chain lines (method marks stay OFF)');
ok(fullyVerifiedWorking(stepCheck(META, 'max = 22 + 5\n= 27')) === false, 'value-chain ticks count as no verified transition (no misconception walked back)');

const ev = lines => workingEvidence({ res: { stepReport: stepCheck(META, lines.join('\n')) }, submitted: { hasWorking: true, lines } });
const say = e => { const c = workingEvidenceCopy(e, { correct: true }); return c && String(en[c.key]).replace(/\{(\w+)\}/g, (_, k) => c.vars[k]); };
const sayHi = e => { const c = workingEvidenceCopy(e, { correct: true }); return c && String(hi[c.key]).replace(/\{(\w+)\}/g, (_, k) => c.vars[k]); };
const e1 = ev(['22+5sin((n+)/6)', 'max = 22 + 5', '= 27']);
ok(e1.kind === 'some' && say(e1) === 'Lines checked: 2, 3. Could not be read as maths: 1.', `the sentence names the lines (${say(e1)})`);
ok(/2, 3/.test(sayHi(e1)) && /1/.test(sayHi(e1)), 'the Hindi sentence names them too');
ok(say(ev(['top = 27', 'max = 22 + 5', '= 27'])) === 'Lines checked: 2, 3. Not verified: 1.', 'a line that merely was not verified is not called unreadable');
ok(say(ev(['@@@', 'top = 27', 'max = 27', 'max = 22 + 5'])) === 'Lines checked: 3, 4. Could not be read as maths: 1. Not verified: 2.', 'both reasons together');
ok(workingEvidence({ res: { stepReport: stepCheck(META, 'max = 22 + 5\n= 27') }, submitted: { hasWorking: true, lines: ['max = 22 + 5', '= 27'] } }).kind === 'all', 'every line verified keeps the existing "all" sentence');
ok(workingEvidence({ res: { stepReport: stepCheck(META, 'max = 22 - 5') }, submitted: { hasWorking: true, lines: ['max = 22 - 5'] } }).kind === 'break', 'a break keeps the existing "break" sentence');

// the server derives the meta from the issued question, and the question now supports step checks
function rngOf(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const issued = [];
for (let seed = 1; seed <= 900; seed++) for (const diff of [1, 2, 3, 4]) {
  const q = year12Nsw['y12-trig-model'](rngOf(seed * 7 + diff), diff);
  issued.push(q);
}
const withMeta = issued.filter(q => q.stepcheck?.kind === 'value-chain');
ok(withMeta.length > 400, `the trig-model family carries the value-chain meta (${withMeta.length} of ${issued.length})`);
ok(withMeta.every(q => stepMetaFor(q) === q.stepcheck), 'the server uses it as the question\'s step meta');

// a restricted domain: the max / min / amplitude / midline are checked against the whole function, so a true restricted extreme must never be crossed
{
  const run = (prompt, lines) => stepCheck(META, lines.join('\n'), { prompt }).lines.map(l => l.status).join();
  const RP = 'A buoy rises and falls with $h(t) = 22 + 5\\sin\\left(\\dfrac{\\pi t}{6}\\right)$ for $0 \\le t \\le 2$. Find the maximum value of $h$.';
  ok(run(RP, ['max = 22 + 5\\sin(\\pi/3)']) !== 'break' && run(RP, ['max = 26.33']) !== 'break', 'a restricted-domain maximum is never crossed');
  ok(run(RP, ['max = 22 + 5 sin(pi/3)']) === 'note', 'on a restricted domain the true restricted maximum abstains (note)');
  ok(run(RP, ['max = 27']) === 'note' && run(RP, ['min = 17']) === 'note', 'the global value is not ticked on a restricted domain either');
  ok(run('Find the maximum of $h(t)$ for $t$ in the interval $[0, 2]$.', ['max = 26.5']) === 'note', 'an interval in words or brackets abstains');
  ok(run('Find the minimum of $h$ between $t = 0$ and $t = 2$.', ['min = 22']) === 'note', '"between" abstains');
  ok(stepCheck({ ...META, domain: [0, 2] }, 'max = 22').lines[0].status === 'note', 'a meta that carries a domain abstains with no prompt');
  const GP = 'A buoy is modelled by $h(t) = 22 + 5\\sin\\left(\\dfrac{\\pi t}{6}\\right)$ for $t \\ge 0$. What is the maximum value of $h$?';
  ok(run(GP, ['max = 22 + 5', '= 27']) === 'ok,ok', 'a half-line "t ≥ 0" leaves the periodic maximum global: still ticked');
  ok(run(GP, ['max = 28']) === 'break', '...and a false global maximum is still crossed');
  ok(run(RP, ['period = 12']) === 'ok', 'the period is not changed by a restricted domain');
}

// safe by default: the extremes are held to a line only when the question is KNOWN to be unrestricted
{
  const { fullDomain, ...unknown } = META;
  const run2 = (meta, prompt, lines) => stepCheck(meta, lines.join('\n'), { prompt }).lines.map(l => l.status).join();
  ok(run2(unknown, '', ['max = 28']) === 'note' && run2(unknown, '', ['max = 22 + 5']) === 'note', 'a meta that does not say the domain is full never crosses (or ticks) an extreme');
  ok(run2(unknown, '', ['period = 12']) === 'ok' && run2(unknown, '', ['h(3) = 27']) === 'ok', '...but the period and a value at a point are still checked');
  const MAXQ = '$h(t) = 22 + 5\\sin\\left(\\dfrac{\\pi t}{6}\\right)$. What is the maximum value of $h$?';
  for (const when of ['Over the first two hours,', 'Over the first 2 hours,', 'For 0 to 2 hours,', 'For $t$ in $[0, 2]$,', 'In the first hour,', 'For $t = 0, 1, 2$,', 'During the first minute,', 'For $0 \\le t \\le 2$,', 'On the interval $[0,2]$,', 'Between $t=0$ and $t=2$,']) {
    ok(run2(META, `${when} ${MAXQ}`, ['max = 22 + 5\\sin(\\pi/3)']) === 'note', `a restricted prompt never crosses a true restricted maximum: ${when}`);
    ok(run2(META, `${when} ${MAXQ}`, ['max = 28']) === 'note', `...and a restricted prompt does not cross a different value either: ${when}`);
  }
  ok(run2(META, MAXQ, ['max = 28']) === 'break', 'a false max = 28 on a known-unrestricted question is still crossed');
  ok(run2(META, MAXQ, ['min = 17']) === 'ok', 'and a true min is ticked there');
  const generated = issuedForSafe();
  ok(generated.checked >= generated.total * 0.9 && generated.total > 400, `the generated trig-model prompts are still checked: ${generated.checked} of ${generated.total} carry fullDomain and no restriction in the prompt`);
  function issuedForSafe() {
    let total = 0, checked = 0;
    for (let seed = 1; seed <= 300; seed++) for (const diff of [1, 2, 3, 4]) {
      let s = (seed * 7 + diff) | 0; const rng = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const q = year12Nsw['y12-trig-model'](rng, diff);
      if (q.stepcheck?.kind !== 'value-chain') continue;
      total++;
      const r = stepCheck(q.stepcheck, `max = ${q.stepcheck.quantities.max}`, { prompt: q.prompt }).lines[0];
      if (r.status === 'ok') checked++;
    }
    return { total, checked };
  }
}

// ── Part 2 · the sweep against independent computation ───────────────────────
const TEX = /h\(t\) = (\d+) \+ (\d+)\\(sin|cos)\\left\(\\dfrac\{\\pi t\}\{(\d+)\}\\right\)/;
const params = withMeta.map(q => { const m = TEX.exec(q.prompt); return m ? { c: +m[1], a: +m[2], fn: m[3], m: +m[4], expr: q.stepcheck.fn.expr, q } : null; });
ok(params.every(Boolean), 'every question with the meta states its function in the prompt in the form the independent reader parses');
const cases = [...new Map(params.filter(Boolean).map(p => [`${p.c}|${p.a}|${p.fn}|${p.m}`, p])).values()];
ok(cases.length >= 40, `distinct (c, a, fn, m) cases swept: ${cases.length}`);

// (a) brute force, with Math.sin/Math.cos, nothing from the engine
function brute(p) {
  const f = x => p.c + p.a * (p.fn === 'sin' ? Math.sin : Math.cos)(Math.PI * x / p.m);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 200000; i++) { const v = f(-p.m + (4 * p.m * i) / 200000); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return { max: Math.round(hi * 1e4) / 1e4, min: Math.round(lo * 1e4) / 1e4, amplitude: Math.round((hi - lo) / 2 * 1e4) / 1e4, midline: Math.round((hi + lo) / 2 * 1e4) / 1e4, period: 2 * p.m, f };
}
// (b) SymPy
const ARGS = ['0', '1', '2', '3', '5', '7', '1/2'];
let sym = null;
const py = spawnSync('python3', [fileURLToPath(new URL('./value-chain-sympy.py', import.meta.url))], {
  input: JSON.stringify(cases.map(p => ({ c: p.c, a: p.a, fn: p.fn, m: p.m, args: ARGS, expr: p.expr }))), encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 26
});
if (py.status === 0) { try { sym = JSON.parse(py.stdout); } catch { sym = null; } }
console.log(sym ? `SymPy differential: on (${cases.length} functions)` : 'SymPy not available: brute-force differential only');
if (sym) ok(sym.every(s => s.same === '0'), 'SymPy: the generator\'s stepcheck function equals the prompt\'s function for every case');

let candidates = 0, falseTicks = 0, falseBreaks = 0, trueTicks = 0, trueBreaks = 0, abstained = 0;
cases.forEach((p, idx) => {
  const b = brute(p);
  const truth = { ...b };
  if (sym) {
    const s = sym[idx];
    for (const k of ['max', 'min', 'amplitude', 'midline', 'period']) ok(Math.abs(s[k] - b[k]) < 1e-3, `SymPy and brute force agree on ${k} for ${JSON.stringify([p.c, p.a, p.fn, p.m])}`);
    Object.assign(truth, { max: s.max, min: s.min, amplitude: s.amplitude, midline: s.midline, period: s.period });
  }
  const meta = p.q.stepcheck;
  const labels = ['max', 'min', 'amplitude', 'midline', 'period'];
  const offsets = [0, 0, 1, -1, 2, 0.5];
  for (const label of labels) for (const [oi, off] of offsets.entries()) {
    // the first two offsets are the true value written two ways
    const value = truth[label] + off;
    const text = oi === 1 ? `${label} = ${truth[label] - 3} + 3` : `${label} = ${value}`;
    const expectedTrue = Math.abs(value - truth[label]) < 1e-9 || oi === 1;
    const got = stepCheck(meta, text).lines[0].status;
    candidates++;
    if (got === 'ok' && !expectedTrue) { falseTicks++; console.error('FALSE TICK:', JSON.stringify(p), text); }
    else if (got === 'break' && expectedTrue) { falseBreaks++; console.error('FALSE BREAK:', JSON.stringify(p), text); }
    else if (got === 'ok') trueTicks++;
    else if (got === 'break') trueBreaks++;
    else abstained++;
  }
  // wrong-quantity lines: "max = <min>" and "min = <max>" are false unless equal
  for (const [l1, l2] of [['max', 'min'], ['min', 'max'], ['amplitude', 'midline'], ['midline', 'amplitude'], ['period', 'amplitude']]) {
    if (Math.abs(truth[l1] - truth[l2]) < 1e-9) continue;
    const got = stepCheck(meta, `${l1} = ${truth[l2]}`).lines[0].status;
    candidates++;
    if (got === 'ok') { falseTicks++; console.error('FALSE TICK (swapped):', JSON.stringify(p), l1, truth[l2]); } else trueBreaks++;
  }
  // function evaluations against the engine-independent value
  for (const x of ARGS) {
    const xv = x === '1/2' ? 0.5 : Number(x);
    const exact = sym ? sym[idx].at[x] : b.f(xv);
    for (const off of [0, 1, -2]) {
      const text = `h(${x}) = ${exact + off}`;
      const got = stepCheck(meta, text).lines[0].status;
      candidates++;
      if (got === 'ok' && off !== 0) { falseTicks++; console.error('FALSE TICK (h):', JSON.stringify(p), text); }
      else if (off === 0 && got === 'break') { falseBreaks++; console.error('FALSE BREAK (h):', JSON.stringify(p), text); }
      else if (got === 'ok') trueTicks++;
      else if (got === 'break') trueBreaks++;
      else abstained++;
    }
  }
});
console.log(`sweep: ${candidates} candidate lines · true ticked ${trueTicks} · false ticked ${falseTicks} · false broken ${falseBreaks} · wrong broken ${trueBreaks} · abstained ${abstained}`);
ok(falseTicks === 0, 'zero false ticks over the swept family');
ok(falseBreaks === 0, 'zero true values marked wrong over the swept family');
ok(trueTicks > 1000, 'the sweep ticks the true lines it can verify');

// the worked solution of every swept question is itself ticked by the engine (nothing the generator teaches is refused)
let steps = 0, stepOk = 0;
for (const p of cases) for (const d of [1]) {
  const q = p.q;
  if (!/What is the (maximum|minimum) value of/.test(q.prompt)) continue;
  steps++;
  const mx = /What is the maximum/.test(q.prompt);
  const line = `${mx ? 'max' : 'min'} = ${p.c} ${mx ? '+' : '-'} ${p.a}\n= ${q.answer.value}`;
  if (stepCheck(q.stepcheck, line).lines.every(l => l.status === 'ok')) stepOk++;
}
ok(steps > 0 && stepOk === steps, `the natural working of every max/min question is fully ticked (${stepOk}/${steps})`);

console.log(`value-chain-check: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
console.log('PASS value-chain-check');
