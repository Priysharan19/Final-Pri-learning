// The interpreter runs AFTER the engine's step check, rules only: the engine's verdict on a line stands,
// the model arm is unreachable from the marking path, and the feature is dark unless the flag is on.
import { readFileSync } from 'node:fs';
import { interpretAfterStepCheck, engineDecided } from '../platform/lineInterpreter/overlay.js';

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
if (fail.length) { console.error(fail.join('\n')); console.error(`LINE INTERPRETER OVERLAY: FAIL (${fail.length})`); process.exit(1); }
console.log(`LINE INTERPRETER OVERLAY: PASS — ${pass} checks`);
