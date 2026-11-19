// The interpreter runs AFTER the engine's step check, rules only: the engine's verdict on a line stands,
// the model arm is unreachable from the marking path, and the feature is dark unless the flag is on.
import { readFileSync } from 'node:fs';
import { interpretAfterStepCheck, engineDecided, reportWithInterpretation } from '../platform/lineInterpreter/overlay.js';

let pass = 0; const fail = [];
const ok = (c, l) => { if (c) pass++; else fail.push(l); };
const ON = { PRI_FEATURE_LINE_INTERPRETER: '1' };
const Q = { prompt: 'Solve $3x + 5 = 20$.', answerType: 'numeric', answer: { value: 5 }, answerPrefix: '$x =$' };

ok(await interpretAfterStepCheck({ question: Q, working: '3x = 15\nx = 5', stepReport: { lines: [] }, env: {} }) === null, 'dark by default');
ok(engineDecided({ status: 'ok' }) && engineDecided({ status: 'break' }) && engineDecided({ status: 'note', state: 'incomplete' }) && !engineDecided({ status: 'note' }) && !engineDecided(undefined), 'which engine lines are decided');
const stepReport = { lines: [{ status: 'ok' }, { status: 'note' }] };
const out = await interpretAfterStepCheck({ question: Q, working: '3x = 15\nx = 5', stepReport, env: ON });
ok(out && out.lines.length === 2, 'one result per working line');
ok(out.lines[0].engine === true && !('verdict' in out.lines[0]), 'an engine-judged line keeps the engine verdict; the interpreter adds nothing to it');
ok(out.lines[1].engine === false && typeof out.lines[1].verdict === 'string', 'a line the engine left open may take an interpreter verdict');
ok(await interpretAfterStepCheck({ question: Q, working: '', stepReport, env: ON }) === null, 'no working, no interpretation');
const overlay = readFileSync(new URL('../platform/lineInterpreter/overlay.js', import.meta.url), 'utf8');
ok(/useModel: false/.test(overlay) && !/fetchImpl|authorize/.test(overlay.replace(/\/\/.*$/gm, '')), 'the model arm is not reachable from the overlay');
const practice = readFileSync(new URL('../platform/practice.js', import.meta.url), 'utf8');
ok(practice.indexOf('interpretAfterStepCheck(') > practice.indexOf('const { stepReport, partial } = resolved'), 'it runs after the step report exists');

// ── The report the marked page draws (owner, 19 November 2026: step marking on every Year 11 and 12 question) ──
{
  const { stepEvidence } = await import('../platform/markerOps.js');
  const GQ = { answerType: 'numeric', answer: { value: 11 }, prompt: 'Find the gradient of $y = x^2 + 3x - 4$ at the point where $x = 4$.', steps: [] };
  const fold = async (lines, correct = true) => {
    const working = lines.join('\n');
    const ev = stepEvidence(GQ, '11', working, { correct });
    const li = await interpretAfterStepCheck({ question: GQ, working, stepReport: ev.stepReport, env: ON });
    return { ev, rep: reportWithInterpretation({ stepReport: ev.stepReport, lineInterpretation: li, working }) };
  };
  let { ev, rep } = await fold(['dy/dx = 2x + 3', 'dy/dx = 2(4) + 3', '= 11']);
  ok(rep.lines.map(l => l.status).join() === 'ok,note,ok' && rep.lines[0].state === 'verified' && rep.lines[2].state === 'arithmetic', `an interpreter tick joins the engine's ticks (${rep.lines.map(l => `${l.status}:${l.state}`)})`);
  ok(rep.source === 'value-chain' && rep.interpreted === true && rep.arithmetic === undefined && rep.firstBreak === -1, 'the folded report has the shape the marked page draws and no longer calls itself arithmetic only');
  ok(ev.partial === null, 'no partial credit exists before or after folding');
  ({ ev, rep } = await fold(['dy/dx = 2x + 4', '= 2(4) + 4 = 12'], false));
  ok(rep.lines.map(l => l.status).join() === 'break,note' && rep.firstBreak === 0 && /derivative/.test(rep.diagnosis?.message || ''), `a rule-read wrong line is the first break, with its reason (${rep.lines.map(l => l.status)} · ${rep.diagnosis?.message})`);
  ok(rep.lines[1].note === 'Follows from the earlier slip.', 'nothing after the first wrong line is ticked or crossed');
  ok(ev.partial === null, 'and a wrong answer earns nothing from it');
  const working = 'dy/dx = 2x + 3\n= 11';
  ok(reportWithInterpretation({ stepReport: null, lineInterpretation: null, working }) === null, 'feature off: nothing is added');
  const engine = { lines: [{ text: 'a', status: 'ok' }, { text: 'b', status: 'note' }] };
  ok(reportWithInterpretation({ stepReport: engine, lineInterpretation: { lines: [{ index: 0, engine: true }, { index: 1, engine: false, verdict: 'valid', ticked: true }] }, working: 'a\nb' }) === engine, 'a report in which lines follow from one another (no value-chain source) is left exactly as the engine wrote it');
  const vc = { source: 'value-chain', firstBreak: 0, diagnosis: { message: 'm' }, lines: [{ text: 'a', status: 'break', state: 'wrong' }, { text: 'b', status: 'note', state: 'unverified' }] };
  const kept = reportWithInterpretation({ stepReport: vc, lineInterpretation: { lines: [{ index: 0, engine: true }, { index: 1, engine: false, verdict: 'valid', ticked: true }] }, working: 'a\nb' });
  ok(kept === vc, 'after an engine break the interpreter adds no tick');
  const overturn = reportWithInterpretation({ stepReport: { source: 'value-chain', firstBreak: -1, lines: [{ text: 'a', status: 'ok', state: 'verified' }] }, lineInterpretation: { lines: [{ index: 0, engine: false, verdict: 'first-break', why: 'x' }] }, working: 'a' });
  ok(overturn.lines[0].status === 'ok', 'an engine verdict is never overturned, even by a malformed interpretation');
  ok(reportWithInterpretation({ stepReport: null, lineInterpretation: { lines: [{ index: 0, engine: false, verdict: 'first-break', why: 'x' }, { index: 1, engine: false, verdict: 'valid' }] }, working: '500 = 340\n2 + 2 = 4' }).lines[0].status === 'note', 'two bare numbers stated equal are never crossed');
  ok(reportWithInterpretation({ stepReport: null, lineInterpretation: { lines: [{ index: 0, engine: false, verdict: 'valid' }] }, working: 'a\nb' }) === null, 'a result that does not line up with the working is dropped');
  const practiceSrc = readFileSync(new URL('../platform/practice.js', import.meta.url), 'utf8');
  ok(/partial: invalid \? null : partial/.test(practiceSrc) && !/reportWithInterpretation\([^)]*\)[^\n]*marks/.test(practiceSrc) && practiceSrc.split('reportWithInterpretation(').length === 2, 'the folded report is used once, in the reply, and is not read by any mark');
}
if (fail.length) { console.error(fail.join('\n')); console.error(`LINE INTERPRETER OVERLAY: FAIL (${fail.length})`); process.exit(1); }
console.log(`LINE INTERPRETER OVERLAY: PASS — ${pass} checks`);
