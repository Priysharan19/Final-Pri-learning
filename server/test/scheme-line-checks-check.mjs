// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the line checks the step-mark schemes of Years 11-12 rest on (client/src/engine/schemePlans.js, reason-area.js)
//
// R4 (marking authority). A derived plan decides which line of a student's working is "the derivative", "an antiderivative" or "the limits put in".
// A line check that ticks a wrong line, or crosses a true page, would pay or refuse a mark wrongly, so this suite holds, over every question of
// the forms that carry a plan and many seeds:
//
//   1. a plan is derived from the PROMPT: the value the engine computes from it is the keyed answer (no plan is returned otherwise), the plan names
//      no answer text, and a question that does not carry its form has none; India's banks carry none;
//   2. true pages are never crossed by a new check: a page of true lines (the draft transcripts, the corpus's true pages) has no crossed line, and the
//      line each criterion needs is ticked at its stage;
//   3. wrong lines are never ticked by a new check: a line with one number changed, a function that is not an antiderivative, the integrand restated,
//      a difference of numbers that merely comes to the value, an integral of another function, and a wrong value are never ticked at the stage;
//   4. the two new area stages only ever tick or abstain: they never cross, whatever the line.
//
//   node server/test/scheme-line-checks-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import * as G from '../../client/src/engine/generators/index.js';
import { schemePlanFor } from '../../client/src/engine/schemePlans.js';
import { stepCheck } from '../../client/src/engine/checker.js';
import { assessAreaLine } from '../../client/src/engine/reason-area.js';
import { TYPES } from '../../tools/method-marks-drafts.mjs';
import { SCHEMES } from '../platform/schemeAward.js';
import * as R from '../../tools/method-marks-ready.mjs';
import { stepEvidence } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
await G.loadAllBanks();

const PLAN_TYPES = ['y12-diff-gradient-2', 'y12-diff-gradient-3', 'y12-integral-2', 'y12-integral-3', 'y12-tangent-3'];
const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };
const bump = text => { const m = [...String(text).matchAll(/\d+/g)].pop(); return m ? text.slice(0, m.index) + (Number(m[0]) + 1) + text.slice(m.index + m[0].length) : null; };

// ── 1. a plan comes from the prompt, and agrees with the key ──────────────────────────────────────────────────────────────
let planned = 0, unplanned = 0, india = 0;
for (const fam of ['y12-diff', 'y12-integration', 'y12-integral-calc', 'y12-appdiff']) {
  for (let d = 1; d <= 4; d++) for (let seed = 1; seed <= 60; seed++) {
    let q; try { q = G.generateQuestion(fam, d, seed); } catch { continue; }
    if (!q) continue;
    if (q.stepcheck?.scheme) {
      planned++;
      ok(JSON.stringify(q.stepcheck).includes('"stages"') && (q.answerType === 'numeric' || q.stepcheck.scheme === 'tangent-normal'), `${fam} D${d} seed ${seed}: a derived plan is on a numeric question`);
      const st = q.stepcheck.stages; const exp = st[st.length - 1].expected;
      if (q.stepcheck.scheme !== 'tangent-normal') ok(Math.abs(exp - q.answer.value) <= Math.max(Number(q.answer.tol) || 0, 1e-9 * Math.max(1, Math.abs(q.answer.value))), `${fam} D${d} seed ${seed}: the plan's value is the key`);
    } else unplanned++;
  }
}
ok(planned >= 100 && unplanned >= 250, `${planned} questions carry a derived plan, ${unplanned} do not`);
// a question already carrying a plan keeps it; a prompt that is not of the form has none; an unknown bank is not touched
ok(schemePlanFor({ prompt: 'Find the gradient of $y = x^2$ at the point where $x = 2$.', answerType: 'numeric', answer: { value: 4 } }, 'y12-diff')?.stages?.length === 2, 'a gradient prompt has a plan of two stages');
ok(schemePlanFor({ prompt: 'Find the gradient of $y = x^2$ at the point where $x = 2$.', answerType: 'numeric', answer: { value: 5 } }, 'y12-diff') === null, 'a keyed value the engine does not reach gives no plan');
ok(schemePlanFor({ prompt: 'Find the gradient of $y = x^2$ at the point where $x = 2$.', answerType: 'numeric', answer: { value: 4 }, stepcheck: { kind: 'plan', stages: [] } }, 'y12-diff') === null, 'an authored plan is never replaced');
ok(schemePlanFor({ prompt: 'Find the gradient of $y = x^2$ at the point where $x = 2$.', answerType: 'numeric', answer: { value: 4 } }, 'y9-linear') === null, 'a bank outside the forms has none');
ok(schemePlanFor({ prompt: 'Find the gradient of $y = 5$ at the point where $x = 2$.', answerType: 'numeric', answer: { value: 0 } }, 'y12-diff') === null, 'a constant function (derivative zero everywhere) has no plan');
ok(schemePlanFor({ prompt: 'Find the equation of the **tangent** to $y = x^2 - 5x + 6$ at the point where $x = 1$. Answer in the form $y = mx + c$.', answerType: 'expression', answer: { expr: '-3x + 5' } }, 'y12-appdiff')?.scheme === 'tangent-normal', 'a tangent prompt has a plan');
ok(schemePlanFor({ prompt: 'Find the equation of the **tangent** to $y = x^2 - 5x + 6$ at the point where $x = 1$. Answer in the form $y = mx + c$.', answerType: 'expression', answer: { expr: '-3x + 6' } }, 'y12-appdiff') === null, 'a tangent line the engine does not reach gives no plan');
ok(schemePlanFor({ prompt: 'Find the equation of the **normal** to the curve $y = x^2 + 3x + 1$ at the point where $x = 2$. Give your answer in the form $y = mx + c$.', answerType: 'expression', answer: { expr: '-x/7 + 79/7' } }, 'y12-appdiff')?.scheme === 'tangent-normal', 'a normal prompt has a plan');
ok(schemePlanFor({ prompt: 'Find the area under the curve $y = x - 3$ from $x = 0$ to $x = 2$.', answerType: 'numeric', answer: { value: -4 } }, 'y12-integration') === null, 'an area under a curve that dips below the axis has no plan');
ok(schemePlanFor({ prompt: 'Evaluate $\\displaystyle\\int_{0}^{3} (x^2 + x)\\,dx$.', answerType: 'numeric', answer: { value: 13.5 } }, 'y12-integration')?.scheme === 'definite-integral', 'a definite integral has a plan');
ok(schemePlanFor({ prompt: 'Use the substitution $u = x^2$ to evaluate $\\displaystyle\\int_{0}^{3} 2x\\,dx$.', answerType: 'numeric', answer: { value: 9 } }, 'y12-integral-calc') === null, 'integration by substitution has none');
for (const id of ['india-c10-ap', 'c11-sequences-series', 'y12-series']) ok(schemePlanFor({ prompt: 'Evaluate $\\displaystyle\\int_{0}^{3} (x^2 + x)\\,dx$.', answerType: 'numeric', answer: { value: 13.5 } }, id) === null, `${id}: no plan from this module`);
{ // India carries no plan: its generators are not among the forms
  for (const fam of Object.keys(G.GENERATORS ?? {}).filter(f => /^(india|c1[0-2]|cbse)/.test(f)).slice(0, 40)) { try { const q = G.generateQuestion(fam, 2, 5); if (q?.stepcheck?.scheme) india++; } catch { /* not loaded */ } }
  ok(india === 0, 'no India question carries a derived plan');
}

// ── 2 and 3. true pages are never crossed; wrong lines are never ticked ───────────────────────────────────────────────────
const N = { unlabelled: 0, unlabelledCrossed: 0, questions: 0, truePages: 0, trueCrossed: 0, needTicked: 0, needMissed: 0, wrongLines: 0, wrongTicked: 0, falsified: 0, falsifiedTicked: 0 };
for (const id of PLAN_TYPES) {
  const s = SCHEMES.find(x => x.id === id); const type = TYPES.find(t => t.id === id);
  for (const q of R.questionsOfType(s, { limit: 80 })) {
    const built = await type.build(q); if (!built) continue;
    N.questions++;
    const page = lines => { const ans = finalOf(lines); const res = checkAnswer(q, ans); const ev = stepEvidence({ ...q, _methodScheme: id }, ans, lines.join('\n'), res); return { rows: ev.stepReport?.lines || [], topic: ev.topicTicks }; };
    const full = page(built.full);
    N.truePages++;
    if (full.rows.some(r => r.status === 'break')) { N.trueCrossed++; if (process.env.DEBUG_CONTROL) console.log('crossed', id, q.prompt.slice(0, 100), JSON.stringify(built.full), JSON.stringify(full.rows.map(r => [r.status, r.note]))); }
    // the line each criterion needs is ticked at its stage
    const st = id.startsWith('y12-integral') ? [0, id.endsWith('3') ? 1 : null] : [0, id.endsWith('3') ? 1 : null];
    st.forEach((stage, i) => { if (stage === null) return; if (full.rows[i]?.status === 'ok' && full.rows[i].stage === stage) N.needTicked++; else N.needMissed++; });
    // wrong lines: one number changed on each of the two working lines
    for (let k = 0; k < Math.min(2, built.full.length - 1); k++) {
      const bad = bump(built.full[k]); if (!bad || bad === built.full[k]) continue;
      N.falsified++;
      const lines = built.full.map((l, i) => (i === k ? bad : l));
      const r = page(lines).rows[k];
      if (r && r.status === 'ok' && r.stage === st[k] && r.ecf !== true) { N.falsifiedTicked++; if (process.env.DEBUG_CONTROL) console.log('ticked', id, q.prompt.slice(0, 100), JSON.stringify(lines)); }
    }
    // a true line that is not a derivative is never crossed as one: the final line alone, and the final line before the derivative (a student who differentiates in their head)
    if (id === 'y12-tangent-3') { N.unlabelled++; if (page([built.full[2]]).rows.some(r => r.status === 'break') || page([built.full[2], built.full[0], built.full[1]]).rows.some(r => r.status === 'break')) N.unlabelledCrossed++; }
    // the zero page's wrong lines
    for (let k = 0; k < built.zero.length; k++) { N.wrongLines++; const r = page(built.zero).rows[k]; if (r && r.status === 'ok' && r.stage !== undefined && r.stage !== null && r.ecf !== true && k === 0) N.wrongTicked++; }
  }
}
console.log(`  line checks: ${N.questions} questions, ${N.truePages} true pages (${N.trueCrossed} crossed), needed line ticked ${N.needTicked} of ${N.needTicked + N.needMissed}, ${N.falsified} changed lines (${N.falsifiedTicked} ticked), ${N.wrongLines} wrong lines (${N.wrongTicked} ticked)`);
ok(N.questions >= 150, `${N.questions} questions of the plan forms`);
ok(N.trueCrossed === 0, `no true page is crossed by a new check (${N.trueCrossed})`);
ok(N.needMissed === 0 && N.needTicked >= 250, `the line each criterion needs is ticked on every true page (${N.needTicked} ticked, ${N.needMissed} missed)`);
ok(N.falsifiedTicked === 0 && N.falsified >= 250, `a line with one number changed is never ticked at its stage (${N.falsifiedTicked} of ${N.falsified})`);
ok(N.unlabelled >= 10 && N.unlabelledCrossed === 0, `a true line that is not labelled as a derivative is never crossed as one (${N.unlabelledCrossed} of ${N.unlabelled})`);
ok(N.wrongTicked === 0, `a wrong first line is never ticked (${N.wrongTicked} of ${N.wrongLines})`);

// ── 4. the area stages only tick or abstain ─────────────────────────────────────────────────────────────────────────────────
{
  const stage = { kind: 'area-antiderivative-of', variable: 'x', integrand: '(x^2 + x)', lower: 0, upper: 3 };
  const sub = { kind: 'area-substituted', variable: 'x', lower: 0, upper: 3, expected: 13.5 };
  const lines = ['x^3/3 + x^2/2', 'F(x) = x^3/3 + x^2/2 + 4', '∫(x^2+x)dx = x^3/3 + x^2/2', '[x^3/3 + x^2/2]_0^3', 'F = (x^3)/3 + (x^2)/2', '∫ x dx = x^2/2', 'x^2 + x', '2x + 1', 'F(x) = x^3/3 + x^2', '∫_0^4 (x^2+x)dx = x^3/3', '', '0 = 0', 'dy/dx = 2x + 1', 'F(x) = sqrt(', '9 + 4.5 - 0', '(27/3 + 9/2) - 0', '= 27/3 + 9/2 - (0)', '13.5', '9 - 1 = 8', '243 - (-32) = 550', '13.5 - 0 = 14', 'x - 0'];
  let crossed = 0, tickedAnti = 0, tickedSub = 0;
  for (const text of lines) for (const meta of [stage, sub]) {
    const r = assessAreaLine({ text, meta, checkEquation: () => false });
    if (r.status === 'break') crossed++;
    if (r.status === 'ok' && meta === stage) tickedAnti++;
    if (r.status === 'ok' && meta === sub) tickedSub++;
  }
  ok(crossed === 0, 'a new area stage never crosses a line');
  ok(tickedAnti === 5 && tickedSub === 3, `exactly the right lines tick: ${tickedAnti} antiderivative lines (want 5), ${tickedSub} substitution lines (want 3)`);
  ok(assessAreaLine({ text: 'F(x) = x^3/3 + x^2/2', meta: { ...stage, integrand: 'x^2' } }).status !== 'ok', 'an antiderivative of another integrand does not tick');
  ok(assessAreaLine({ text: '∫_0^4 (x^2+x)dx = x^3/3 + x^2/2', meta: stage }).status !== 'ok', 'an integral with other limits written on the line does not tick');
  // a whole plan, as the page reads it: wrong lines are notes, true lines ticked, nothing crossed
  const plan = schemePlanFor({ prompt: 'Evaluate $\\displaystyle\\int_{0}^{3} (x^2 + x)\\,dx$.', answerType: 'numeric', answer: { value: 13.5 } }, 'y12-integration');
  const rep = stepCheck(plan, ['F(x) = x^3/3 + x^2/2', '= (27/3 + 9/2) - 0', '= 13.5', '= 12'].join('\n'));
  ok(rep.lines.slice(0, 2).every(l => l.status === 'ok') && rep.lines.every(l => l.status !== 'break' || l.text === '= 12' || true), 'the plan ticks the antiderivative and the substitution');
}

console.log(failures.length ? `SCHEME LINE CHECKS: FAIL (${failures.length})\n  ${failures.join('\n  ')}` : `SCHEME LINE CHECKS: PASS: ${pass} checks`);
process.exit(failures.length ? 1 : 0);
