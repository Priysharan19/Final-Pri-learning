// Pri Learning · the second page-proof pass (client/src/engine/pageProofs2.js): function values, implications, conditions, derivatives, the closed-interval
// extreme, check lists and the labels of a sketch. Deterministic. Per prover: the true line is proved, and the adversarial twins are not (a wrong value, a wrong
// link in a chain, a wrong root, a missing root, a maximum that is at an endpoint, a minimum asked and a maximum given, a value outside the domain, a point off
// the curve, the function set again on the page). Then the owner's real photo page (the reader's own lines) through the real marker.
//
//   node server/test/page-proofs2-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_QBANK_DIR;
const P = await import('../../client/src/engine/pageProofs2.js');
let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const V = 'The velocity of a car is $v=12t-3t^{2}$ m/s for $0\\le t\\le4$. Find the maximum velocity.';
const mark = (prompt, lines) => { const L = lines.map(t => ({ text: t, status: 'note', state: 'unverified', unverified: true })); return P.pageProofs2({ prompt }, L, L.length, () => true).lines; };
const kind = l => (l.status === 'ok' ? `tick:${l.tickClass}` : l.context ? `neutral:${l.tickClass}` : 'note');
const one = (prompt, text) => kind(mark(prompt, [text])[0]);
const wit = (prompt, text) => P.witnessOf({ prompt }, [text]);

// 1. function values
ok(one(V, 'v(2) = 12(2) - 3(2)^2 = 24 - 12 = 12') === 'tick:function-value', 'v(2) chain is ticked');
ok(one(V, 'v(0) = 12(0) - 3(0)^2 = 0') === 'tick:function-value', 'v(0) ticked');
ok(one(V, "v'(2) = 0") === 'tick:function-value', "v'(2) = 0 ticked");
for (const bad of ['v(2) = 12(2) - 3(2)^2 = 24 - 12 = 13', 'v(2) = 12(2) - 3(2)^2 = 24 - 13 = 11', 'v(2) = 12(2) - 3(2)^3 = 24 - 24 = 0', 'v(2) = 5', 'v(2) = 12(3) - 3(2)^2 = 36 - 12 = 24']) {
  ok(one(V, bad) === 'note', `wrong value never ticked: ${bad}`);
  const w = wit(V, bad); ok(w && w.index === 0 && w.rule === 'function-value', `wrong value is crossed: ${bad}`);
}
{ const w = wit(V, 'v(2) = 12(2) - 3(2)^2 = 24 - 12 = 13'); ok(/\$12\$/.test(w.message) && /\$13\$/.test(w.message), 'the cross names the computed value and the written one'); }
ok(wit(V, 'v(5) = 12(5) - 3(5)^2 = 60 - 75 = -15') === null && one(V, 'v(5) = 12(5) - 3(5)^2 = 60 - 75 = -15') === 'note', 'a value outside the domain is neither ticked nor crossed by this pass');
ok(one(V, 'v(1.5) = 11.3') === 'note' && wit(V, 'v(1.5) = 11.3') === null, 'an exact value written as another decimal one place off is a note, not a tick and not a cross');
{ const lines = ['v(t) = 5t', 'v(2) = 10', 'v(2) = 12(2) - 3(2)^2 = 12']; ok(mark(V, lines).every(l => kind(l) === 'note') && P.witnessOf({ prompt: V }, lines) === null, 'a page that sets the function again is no longer judged by the question\'s function'); }
{ const lines = ['v(t) = 12t - 3t^2', 'v(2) = 12']; ok(kind(mark(V, lines)[1]) === 'tick:function-value', 'a page that restates the same function keeps it'); }
ok(one('For $f(x)=\\sin x$, find $f(30)$.', 'f(30) = 0.5') === 'note', 'trig of a plain number: degrees or radians unknown, a note');
ok(one('Let $P(t)=100e^{0.05t}$ for $0\\le t\\le 10$.', 'P(10) = 100e^(0.5) = 164.87') === 'tick:function-value', 'an irrational value written rounded is ticked as rounded');

// 2. implications
ok(one(V, '12 - 6t = 0 => t = 2.') === 'tick:equation-solved', 'the owner\'s implication is ticked');
for (const s of ['12 - 6t = 0 so t = 2', '12 - 6t = 0 ∴ t = 2', '12 - 6t = 0 → t = 2', '12 - 6t = 0, t = 2', '12 - 6t = 0 ⇒ t = 2', '12 - 6t = 0 hence t = 2']) ok(one(V, s) === 'tick:equation-solved', `implication form: ${s}`);
ok(one(V, '12 - 6t = 0 => t = 3') === 'note' && wit(V, '12 - 6t = 0 => t = 3').rule === 'implication', 'a wrong root is crossed');
ok(wit(V, '12 - 6t = 0 => t = 2 or t = 3').index === 0, 'a wrong root among right ones is crossed');
ok(one('Solve $x^2-5x+6=0$.', 'x^2 - 5x + 6 = 0 => x = 2 or x = 3') === 'tick:equation-solved', 'both roots ticked');
ok(one('Solve $x^2-5x+6=0$.', 'x^2 - 5x + 6 = 0 => x = 2') === 'note' && wit('Solve $x^2-5x+6=0$.', 'x^2 - 5x + 6 = 0 => x = 2') === null, 'a missing root is a note, never a cross');
{ const lines = ['x^2 - 5x + 6 = 0 => x = 2', 'x = 3']; ok(kind(mark('Solve $x^2-5x+6=0$.', lines)[0]) === 'tick:equation-solved', 'a partial list is ticked when the page supplies the rest'); }
ok(one('Solve $x^2-5x+6=0$.', 'x^2 - 5x + 6 = 0 => x = 2 or x = 4') === 'note', 'x = 4 is no root');
ok(one(V, 't^2 - 4 = 0 => t = 2') === 'tick:equation-solved', 'inside the stated domain the one root is complete');
ok(one('Solve $x^2-4=0$.', 'x^2 - 4 = 0 => x = 2') === 'note', 'with no domain stated, x = 2 alone is partial');
ok(one('Solve $x^2-4=0$.', 'x^2 - 4 = 0 => x = ±2') === 'tick:equation-solved', 'plus or minus is both roots');
ok(one(V, "dv/dt = 12 - 6t = 0 => t = 2") === 'tick:equation-solved', 'a derivative chain then its root');
ok(wit('Solve $2^x=8$.', '2^x = 8 => x = 4') === null, 'an exponential equation is not read as a polynomial');

// 3. conditions
for (const s of ['Set dv/dt = 0:', 'Let dv/dt = 0', 'For stationary points v\'(t) = 0', 'Setting dv/dt = 0']) ok(one(V, s) === 'neutral:condition-stated', `condition: ${s}`);
ok(one('Find the area under $y=x^2$ from 0 to 3.', 'Set dy/dx = 0:') === 'note', 'a derivative condition that the task does not call for is not neutral');
ok(one('A ball has height $h(t)=20t-5t^2$. When is the ball on the ground?', 'when h = 0') === 'neutral:condition-stated', 'when h = 0 for a ground question');

// 4. derivatives
for (const s of ['dv/dt = 12 - 6t', "v'(t) = 12 - 6t", "v′(t) = 12 - 6t", 'd/dt(12t - 3t^2) = 12 - 6t', 'dv/dt = 12 - 6t.']) ok(one(V, s) === 'tick:derivative-of-function', `derivative: ${s}`);
for (const s of ['dv/dt = 12 - 5t', 'dv/dt = 6t - 12', 'd/dt(12t - 3t^2) = 12 - 5t']) ok(one(V, s) === 'note', `wrong derivative never ticked: ${s}`);
ok(wit(V, 'dv/dt = 12 - 5t').rule === 'derivative', 'a wrong derivative of the question\'s function is crossed');
ok(one(V, 'dv/dt = 12 - 6t = 0') === 'note' && one(V, 'dv/dt = 12 - 6t = 1') === 'note', 'a derivative followed by a further value is not proved as a whole, whatever the value');
ok(wit(V, 'dv/dt = 12 - 6t = 0') === null, 'a derivative then set to zero is not crossed');
ok(one('For $f(x)=e^{2x}$, find the gradient.', "f'(x) = 2e^(2x)") === 'tick:derivative-of-function', 'derivative of an exponential');

// 5. closed-interval extreme
ok(one(V, 'Conclusion: The maximum velocity is 12 m s^-1, obtained at t = 2.') === 'tick:conclusion-extremum', 'the owner\'s conclusion');
ok(one(V, 'Conclusion: The maximum velocity is 12 ms^-1, obtained at t:') === 'tick:conclusion-extremum', 'the reader\'s truncated conclusion');
ok(one(V, 'Conclusion: The maximum velocity is 12 m s^-1, obtained at t =') === 'tick:conclusion-extremum', 'the reader\'s other truncated conclusion');
ok(one(V, 'The maximum velocity is 12 m/s') === 'tick:conclusion-extremum', 'a value with no place is ticked when right');
ok(one(V, 'The maximum velocity is 14 m/s at t = 2') === 'note' && wit(V, 'The maximum velocity is 14 m/s at t = 2').rule === 'extremum', 'a wrong maximum is crossed');
ok(wit(V, 'The maximum velocity is 12 m/s at t = 3').rule === 'extremum', 'a right maximum at the wrong place is crossed');
ok(one(V, 'The minimum velocity is 0 m/s') === 'note', 'the minimum is not what is asked: a note');
ok(wit(V, 'The minimum velocity is 7') === null, 'a minimum when a maximum is asked is never crossed');
ok(one('A particle has speed $v=12t-3t^{2}$ for $0\\le t\\le1$. Find the maximum speed.', 'The maximum speed is 9 at t = 1') === 'tick:conclusion-extremum', 'a maximum at an endpoint');
ok(wit('A particle has speed $v=12t-3t^{2}$ for $0\\le t\\le1$. Find the maximum speed.', 'The maximum speed is 12 at t = 2').rule === 'extremum', 'the stationary value outside the interval is not the maximum');
ok(one('The height is $h = 12t - 3t^{2}$ for $0\\le t\\le4$. Find the minimum height.', 'The minimum height is 0 at t = 0 and t = 4') === 'tick:conclusion-extremum', 'a minimum at both endpoints');
ok(one(V, 'The maximum is 12') === 'note' && one(V, 'max = 12') === 'note', 'a conclusion that names no quantity is not read');
ok(one('Let $f(x)=\\sin x$ for $0\\le x\\le 360$. Find the maximum value of $f$.', 'The maximum value of f is 1') === 'note', 'trig on a numeric interval: degrees or radians unknown, a note');
ok(one('Let $P(t)=100e^{0.05t}$ for $0\\le t\\le 10$. Find the maximum value of $P$.', 'The maximum value of P is 164.87 at t = 10') === 'tick:conclusion-extremum', 'an irrational maximum written rounded');
{ const n = mark(V, ['v(0) = 12(0) - 3(0)^2 = 0', 'v(4) = 12(4) - 3(4)^2 = 48 - 48 = 0', 'The maximum velocity is 12 m/s at t = 2'])[2].note; ok(/endpoints give v\(0\) = 0, v\(4\) = 0/.test(n), 'the endpoint facts are named when the student wrote them'); }
{ const n = mark(V, ['The maximum velocity is 12 m/s at t = 2'])[0].note; ok(!/endpoints give/.test(n), 'the endpoint facts are not named when the student did not write them'); }

// 6. check lists
ok(one(V, 'Check values of v at t = 0, 2, 4:') === 'neutral:check-values-list', 'the owner\'s check list');
ok(one(V, 'Check values of v at t = 0, 4:') === 'note' && one(V, 'Check values of v at t = 0, 2, 3, 4:') === 'note', 'a list missing the stationary point, or with an extra value, is a note');
ok(one('A particle has speed $v=12t-3t^{2}$ for $0\\le t\\le1$. Find the maximum speed.', 'Check values of v at t = 0, 1:') === 'neutral:check-values-list', 'a stationary point outside the interval is not listed');

// 7. figure labels
ok(one(V, '(2, 12)') === 'tick:point-on-curve' && one(V, '(0, 0)') === 'tick:point-on-curve', 'a point on the curve');
ok(one(V, '(2, 13)') === 'note' && one(V, '(5, -15)') === 'note' && one(V, '(3, 10)') === 'note', 'a point off the curve, or outside the domain, is not ticked');
{ const r = mark(V, ['v', '(2, 12)', '12', '0', '2', '4', 't']).map(kind); ok(r.join() === 'neutral:figure-label,tick:point-on-curve,neutral:figure-label,neutral:figure-label,neutral:figure-label,neutral:figure-label,neutral:figure-label', 'a run of ticks and axis names is figure-label'); }
ok(kind(mark(V, ['The answer is above', '12', 'so done'])[1]) === 'note', 'a single bare number is not a label');
ok(kind(mark(V, ['7', '9'])[0]) === 'note', 'bare numbers that are not key values of the sketch are not labels');

// the owner's page, the reader's own lines, through the real marker
const { MARKER_OPS, markerView } = await import('../platform/markerOps.js');
const { adoptProved } = await import('../../client/src/engine/provedLines.js');
const qb = await import('../platform/qbankPack.js');
await qb.ensureQbank(process.env, { strict: true });
const q = markerView(qb.qbankEntryQuestion('A12-C3-093', 17));
const PAGE = ['Solution:', 'Given v = 12t - 3t^2, 0 <= t <= 4.', 'To find the maximum velocity.', 'Method: Find the stationary point(s) of v(t) using', 'dv/dt = 0, and compare with the endpoints t = 0 and t = 4.', 'Working:', 'dv/dt = 12 - 6t.', 'Set dv/dt = 0:', '12 - 6t = 0 => t = 2.', 'v', '(2, 12)', '12', 'Check values of v at t = 0, 2, 4:', '0', '2', '4', 't', 'v(0) = 12(0) - 3(0)^2 = 0', 'v(2) = 12(2) - 3(2)^2 = 24 - 12 = 12', 'v(4) = 12(4) - 3(4)^2 = 48 - 48 = 0.', 'Conclusion: The maximum velocity is 12 m s^-1, obtained at t ='];
const run = (lines, answer) => { const r = MARKER_OPS.practice({ q, answer, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: false } }, () => {}); const ev = r.evidence; const shown = ev.shownReport || ev.stepReport; return { r, ev, shown, displayed: adoptProved(ev.stepReport, shown) }; };
{
  const { r, ev, displayed } = run(PAGE, '12');
  ok(r.result.correct === true, 'the key is marked correct');
  const ticks = displayed.lines.filter(l => l.status === 'ok').length, neutral = displayed.lines.filter(l => l.context === true).length, cross = displayed.lines.filter(l => l.status === 'break').length;
  ok(ticks === 7 && neutral === 8 && cross === 0, `the owner's page: 7 ticked, 8 neutral, none crossed (got ${ticks}, ${neutral}, ${cross})`);
  ok(displayed.answerLine === 20, 'the conclusion is the answer line');
  ok(JSON.stringify(ev.stepReport.lines.map(l => l.status)) === JSON.stringify(run(PAGE, '12').ev.stepReport.lines.map(l => l.status)), 'deterministic');
}
{
  // a wrong link on the same page is crossed at that line, with the computed value, and the answer is still marked as the key says
  const bad = PAGE.map(l => (l.startsWith('v(2)') ? 'v(2) = 12(2) - 3(2)^2 = 24 - 12 = 13' : l));
  const { displayed } = run(bad, '12');
  const at = displayed.lines.findIndex(l => l.status === 'break');
  ok(at === 18 && /\$12\$/.test(displayed.lines[18].note) && /\$13\$/.test(displayed.lines[18].note), 'the wrong v(2) is crossed at line 19 naming 12 and 13');
  ok(displayed.lines.slice(0, 18).every(l => l.status !== 'break'), 'nothing before it is crossed');
  const wrongRoot = PAGE.map(l => (l.startsWith('12 - 6t') ? '12 - 6t = 0 => t = 3.' : l));
  ok(run(wrongRoot, '12').displayed.lines.findIndex(l => l.status === 'break') === 8, 'a wrong root is crossed at line 9');
}

if (failures.length) { console.error(`PAGE PROOFS 2: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`PAGE PROOFS 2: PASS: ${pass} checks`);
