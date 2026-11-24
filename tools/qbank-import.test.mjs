// tools/qbank-import.mjs on a tiny archive written here. The owner's bank is not in the repository; this fixture is.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ROOT, loadArchive, validateArchive, checkPart, schemaProblems, acceptedInput, trapInput, engineTrap, engineQuestion, latexProblems, main,
  hintLeaks, compilePack, familyOf
} from './qbank-import.mjs';
import { loadPack, directorySource } from '../server/platform/qbankPack.js';
import { leakReason, bankLadder, texToPlain } from './qbank-leak.mjs';
import { FIXTURE_PARTS, fixtureArchive } from '../server/test/support/qbank-fixture.mjs';

let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const hints = ['Read the question.', 'Pick the operation.', 'Compute.'];
const part = (over = {}) => ({
  question: 'T-A-001', label: null, marks: 2, course: 'ADV', year: 11, topic: 'MA-T', difficulty: 2,
  prompt: 'Simplify $2x+3x$.', answerType: 'expression', answer: { expr: '5*x' },
  steps: [{ h: 'Collect like terms', d: '$2x+3x = 5x$' }],
  criteria: [{ marks: 1, point: 'Combines the terms', line: '2*x+3*x = 5*x' }, { marks: 1, point: 'Correct answer', answer: true }],
  traps: [{ expr: '6*x', why: 'Added the coefficients wrongly.' }], hints, ...over
});
const qrec = (id, over = {}) => ({ id, course: 'ADV', year: 11, topic: 'MA-T', title: id, diff: 2, q: 'q', marks: 2, ans: 'a', ...over });

// ── the parts ────────────────────────────────────────────────────────────────
const parts = [
  part(),                                                                                    // 001 sound expression part
  part({ question: 'T-A-002', marks: 1, prompt: 'Evaluate $3\\times 4$.', answerType: 'numeric', answer: { value: 12 },
    steps: [{ h: 'Multiply', d: '$3\\times 4 = 12$' }], criteria: [{ marks: 1, point: 'Correct answer', answer: true }], traps: [{ value: 7, why: 'Added instead of multiplied.' }] }),
  part({ question: 'T-A-003', marks: 1, prompt: 'Evaluate $3\\times 4$.', answerType: 'numeric', answer: { value: 12 },   // a trap equal to the answer
    steps: [{ h: 'Multiply', d: '$3\\times 4 = 12$' }], criteria: [{ marks: 1, point: 'Correct answer', answer: true }], traps: [{ value: 12, why: 'Wrongly listed.' }] }),
  part({ question: 'T-A-004', marks: 2, prompt: 'Prove that $\\foo{x}=1$.', answerType: 'manual', answer: undefined,   // a macro KaTeX does not know
    steps: [{ h: 'Idea', d: '$x=1$' }], criteria: [{ marks: 1, point: 'Starts', manual: true }, { marks: 1, point: 'Finishes', manual: true }], traps: [] }),
  part({ question: 'T-A-005', criteria: [{ marks: 1, point: 'Combines', line: '5*x' }, { marks: 2, point: 'Correct answer', answer: true }] }),   // criteria add to 3, marks are 2
  part({ question: 'T-A-006', criteria: [{ marks: 1, point: 'Combines the terms', line: '7*x' }, { marks: 1, point: 'Correct answer', answer: true }] }),   // a line the solution never writes
  part({ question: 'T-A-007', prompt: 'Simplify $2x+3x$, as shown.', figureTikz: '\\begin{tikzpicture}\\end{tikzpicture}' }),                    // a diagram
  part({ question: 'T-A-008', answerType: 'expression', answer: { expr: '((' } }),                                                              // a key nobody can read
  part({ question: 'T-A-009', prompt: '\\leavevmode\n\nSimplify $2x+3x$.' }),                                                                    // a TeX command outside math
  part({ question: 'T-X-001', prompt: 'Simplify $2x+3x$.', steps: [{ h: 'Collect', d: '$2x+3x = 5x$' }] })                                       // a part with no question record
];
const questions = [
  ...['T-A-001', 'T-A-002', 'T-A-003', 'T-A-004', 'T-A-005', 'T-A-006', 'T-A-007', 'T-A-008', 'T-A-009'].map(id => qrec(id, {
    marks: { 'T-A-002': 1, 'T-A-003': 1, 'T-A-005': 2 }[id] ?? 2, ...(id === 'T-A-007' ? { tikz: '\\begin{tikzpicture}\\end{tikzpicture}' } : {}) })),
  qrec('T-A-010')                                                                                                                                 // a question with no marking
];
const tags = Object.fromEntries(questions.map(q => [q.id, 'T1.1a']));
delete tags['T-A-009'];

// ── helpers ──────────────────────────────────────────────────────────────────
ok(acceptedInput(part()) === '5*x', 'expression key is typed as written');
ok(acceptedInput(part({ answerType: 'set', answer: { values: [1, -2] } })) === '1, -2', 'set key is a comma list');
ok(acceptedInput(part({ answerType: 'point', answer: { x: 2, y: -3 } })) === '(2, -3)', 'point key is a pair');
ok(acceptedInput(part({ answerType: 'equation', answer: { lhs: 'y', rhs: 'x+1' } })) === 'y = x+1', 'equation key reads as an equation');
ok(acceptedInput(part({ answerType: 'interval', answer: { region: 'x > 3', variable: 'x' } })) === 'x > 3', 'interval key is its region');
ok(acceptedInput(part({ answerType: 'manual', answer: undefined })) === null, 'a manual part has no key');
ok(trapInput({ value: 7 }) === '7' && trapInput({ eq: 'y = 2x' }) === 'y = 2x' && trapInput({ point: [1, 2] }) === '(1, 2)' && trapInput({ values: [1, 2] }) === '1, 2' && trapInput({ why: 'x' }) === null, 'a trap is typed as its kind says');
const t8 = engineTrap({ value: '8*pi', why: 'w' });
ok(Math.abs(t8.value - 8 * Math.PI) < 1e-9 && t8.expr === '8*pi', 'a trap value written as an expression is evaluated, the text kept');
ok(engineTrap({ value: 5, why: 'w' }).value === 5 && engineTrap({ value: 'not a number', why: 'w' }).value === 'not a number', 'a number is left alone, an unreadable text is left as written');
ok(engineQuestion(part()).answer.expr === '5*x' && engineQuestion(part()).steps.length === 1, 'the engine question carries the key and the steps');

// ── LaTeX ────────────────────────────────────────────────────────────────────
ok(latexProblems('Find $\\dfrac{1}{2}x^2$ and $\\sqrt{3}$.').length === 0, 'plain maths renders');
ok(latexProblems('Prove $\\foo{x}$').some(p => p === 'latex:undefined:\\foo'), 'an unknown macro is named');
ok(latexProblems('\\leavevmode Simplify $x$').some(p => p.startsWith('latex:command-outside-math')), 'a TeX command outside math is reported');
ok(latexProblems('cost is \\$5 and 50\\% off').length === 0, 'escaped dollar and percent are text');
ok(latexProblems('a $b').includes('latex:unbalanced-dollar'), 'an odd dollar is reported');

// ── schema ───────────────────────────────────────────────────────────────────
ok(schemaProblems(part()).length === 0, 'a sound part has no schema problem');
ok(schemaProblems(part({ criteria: [{ marks: 1, point: 'a', line: 'x' }, { marks: 2, point: 'b', answer: true }] })).includes('schema:criteria-marks-sum'), 'criteria that do not add to the marks are reported');
ok(schemaProblems(part({ answerType: 'novel' })).some(c => c.startsWith('schema:unknown-answer-type')), 'an unknown answer type is reported');
ok(schemaProblems(part({ answer: { expr: '' } })).includes('schema:answer'), 'an empty key is reported');
ok(schemaProblems(part({ traps: [{ why: 'x' }] })).includes('schema:trap-0-no-answer'), 'a trap with no answer is reported');
ok(schemaProblems(part({ criteria: [{ marks: 2, point: 'a' }] })).includes('schema:answer-criterion-count'), 'an auto part needs exactly one answer criterion');

// ── checks on the engine ─────────────────────────────────────────────────────
const archive = { files: {}, questions, parts, tags };
const report = validateArchive(archive);
const byId = Object.fromEntries(report.parts.map(p => [p.id, p]));
ok(byId['T-A-001'].usable && byId['T-A-001'].checks.answer === 'ok', 'a sound expression part is usable and its key is accepted');
ok(byId['T-A-001'].checks.traps.tested === 1 && byId['T-A-001'].checks.traps.diagnosed === 1, 'its trap is refused and the engine names the slip');
ok(byId['T-A-001'].checks.criteria.withLine === 1 && byId['T-A-001'].failures.every(f => !f.startsWith('line:')), 'its criterion line is a line of the solution');
ok(byId['T-A-001'].checks.steps.state === 'fully-ticked', 'its authored page is fully ticked');
ok(byId['T-A-002'].usable && byId['T-A-002'].checks.scheme.state === 'unsound', 'a one-mark part has no step scheme (a board scheme needs 2 to 6 marks)');
ok(byId['T-A-003'].failures.includes('trap:accepted:0') && !byId['T-A-003'].usable, 'a trap the engine accepts blocks the part');
ok(byId['T-A-004'].failures.some(f => f.startsWith('latex:undefined:\\foo')) && byId['T-A-004'].checks.answer === 'n/a', 'a manual part with a bad macro is reported and has no answer check');
ok(byId['T-A-004'].autoMarkable === false && byId['T-A-004'].usable === false, 'a manual part is never usable for marking');
ok(byId['T-A-005'].checks.schema === 'fail' && byId['T-A-005'].failures.includes('schema:criteria-marks-sum'), 'criteria that do not add up fail the schema, and nothing else is run');
ok(byId['T-A-006'].failures.includes('line:not-in-solution:0') && byId['T-A-006'].gates.answer && !byId['T-A-006'].gates.stepMarks, 'a line the solution never writes blocks step marks, not the answer');
ok(byId['T-A-006'].usable && !byId['T-A-006'].stepMarkReady, 'such a part stays usable for its final answer');
ok(byId['T-A-007'].diagram === true && byId['T-A-001'].diagram === false, 'a part with TikZ is marked as needing its diagram');
ok(byId['T-A-008'].failures.some(f => f.startsWith('answer:')) && !byId['T-A-008'].usable, 'a key the engine does not accept blocks the part');
ok(byId['T-A-009'].failures.some(f => f.startsWith('latex:command-outside-math')) && !byId['T-A-009'].usable, 'a TeX command in the prompt blocks the part');

const qById = Object.fromEntries(report.questions.map(q => [q.id, q]));
ok(qById['T-A-001'].status === 'usable' && qById['T-A-007'].status === 'needs-diagram' && qById['T-A-004'].status === 'manual-only', 'questions are classed from their parts');
ok(report.joinProblems.some(p => p.code === 'join:part-without-question' && p.id.startsWith('T-X-001')), 'a part without a question is a join problem');
ok(report.joinProblems.some(p => p.code === 'join:question-without-marking' && p.id === 'T-A-010'), 'a question without marking is a join problem');
ok(report.joinProblems.some(p => p.code === 'join:no-dotpoint' && p.id === 'T-A-009'), 'a question with no dot point is a join problem');
ok(report.summary.partsByCourse.A11.parts === parts.length && report.summary.partsByCourse.A11.usable >= 3, 'the summary counts by course');
ok(report.summary.failureClasses.some(c => c.kind === 'failure' && c.class === 'trap:accepted'), 'failure classes carry examples');
const again = validateArchive(archive);
ok(JSON.stringify(report) === JSON.stringify(again), 'two runs give an identical report');

// checkPart on its own, without a question record or tags
const alone = checkPart(part(), undefined, undefined);
ok(alone.usable && alone.dotpoint === null, 'a part can be checked without its question');
ok(checkPart(part(), undefined, undefined, { steps: false }).checks.steps === undefined, '--no-steps skips the step report');

// ── files and the command line ───────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbank-import-'));
const data = path.join(tmp, 'archive', 'data');
fs.mkdirSync(data, { recursive: true });
fs.writeFileSync(path.join(data, 'pritagoras_qbank.json'), JSON.stringify(questions));
fs.writeFileSync(path.join(data, 'pritagoras_marking.json'), JSON.stringify(parts));
fs.writeFileSync(path.join(data, 'dotpoint_tags.json'), JSON.stringify(tags));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(data, f))).digest('hex');
const before = ['pritagoras_qbank.json', 'pritagoras_marking.json', 'dotpoint_tags.json'].map(sha);

const loaded = loadArchive(path.join(tmp, 'archive'));
ok(loaded.questions.length === questions.length && loaded.parts.length === parts.length && loaded.files['pritagoras_qbank.json'].sha256 === before[0], 'the archive loads from its root, with digests');
ok(loadArchive(data).parts.length === parts.length, 'the archive loads from its data folder too');

const out = path.join(tmp, 'out', 'report.json');
const code = await main([path.join(tmp, 'archive'), out, '--quiet']);
ok(code === 0 && fs.existsSync(out), 'the command writes its report to the path given');
const written = JSON.parse(fs.readFileSync(out, 'utf8'));
ok(written.mode === 'validate-only' && written.parts.length === parts.length && written.archive.files['pritagoras_marking.json'].sha256 === before[1], 'the report records what it read');
ok(['pritagoras_qbank.json', 'pritagoras_marking.json', 'dotpoint_tags.json'].every((f, i) => sha(f) === before[i]), 'the archive is not changed');
ok(JSON.stringify(fs.readdirSync(data).sort()) === JSON.stringify(['dotpoint_tags.json', 'pritagoras_marking.json', 'pritagoras_qbank.json']), 'nothing is written beside the archive data');

const limited = path.join(tmp, 'out', 'one.json');
await main([path.join(tmp, 'archive'), limited, '--ids', 'T-A-001', '--quiet']);
ok(JSON.parse(fs.readFileSync(limited, 'utf8')).parts.length === 1, '--ids checks only the named question');

const inRepo = path.join(ROOT, 'qbank-report-should-not-exist.json');
const refused = await main([path.join(tmp, 'archive'), inRepo, '--quiet']);
ok(refused === 2 && !fs.existsSync(inRepo), 'a report path inside the repository is refused and nothing is written');
ok(await main([]) === 2, 'no arguments is a usage error');
fs.rmSync(tmp, { recursive: true, force: true });


// ── the content pack (--pack) ────────────────────────────────────────────────
const fxPart = id => FIXTURE_PARTS.find(p => p.question === id && !p.label);
ok(hintLeaks(engineQuestion(fxPart('TQ-010'))).includes('hint 2'), 'a hint that states the answer is found');
ok(hintLeaks(engineQuestion(fxPart('TQ-001'))).length === 0, 'authored hints that do not state the answer pass');
ok(familyOf({ course: 'ADV', year: 11, topic: 'MA-C1' }) === 'qb-a11-ma-c1' && familyOf({ course: 'EXT1', year: 12, topic: 'ME-V1' }) === 'qb-x12-me-v1', 'a family is one course and topic');
const cp = compilePack(fixtureArchive());
ok(cp.summary.questions === 10 && cp.summary.rejectedParts === 3, 'the fixture compiles to ten questions and three rejects (a leaking hint is dropped from its question, which stays)');
ok(!cp.files.get('shards/qb-a11-ma-c1.json').includes('TQ-009') && !cp.files.get('shards/qb-a11-ma-c1.json').includes('TQ-011'), 'a rejected part is not in a shard');
ok(JSON.parse(cp.files.get('shards/qb-a11-ma-c1.json')).questions.every(q => Array.isArray(q.criteria) && q.criteria.length), 'criteria travel in the pack');
const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'qbank-pack-'));
const fx = fixtureArchive();
const fxData = path.join(t2, 'archive', 'data');
fs.mkdirSync(fxData, { recursive: true });
fs.writeFileSync(path.join(fxData, 'pritagoras_qbank.json'), JSON.stringify(fx.questions));
fs.writeFileSync(path.join(fxData, 'pritagoras_marking.json'), JSON.stringify(fx.parts));
fs.writeFileSync(path.join(fxData, 'dotpoint_tags.json'), JSON.stringify(fx.tags));
const packDir = path.join(t2, 'pack');
ok(await main(['--pack', path.join(t2, 'archive'), '--out', packDir, '--quiet']) === 0, '--pack writes a pack');
const loaded2 = await loadPack(directorySource(packDir));
ok(loaded2.questionCount === 10 && loaded2.version === cp.summary.packVersion, 'the written pack loads and is the compiled one');
ok(await main(['--pack', path.join(t2, 'archive'), '--out', packDir, '--quiet']) === 2, 'a non-empty output directory is refused without --overwrite');
ok(await main(['--pack', path.join(t2, 'archive'), '--out', packDir, '--quiet', '--overwrite']) === 0, 'and written over with it');
ok(await main(['--pack', path.join(t2, 'archive'), '--out', path.join(ROOT, 'qbank-pack-should-not-exist'), '--quiet']) === 2 && !fs.existsSync(path.join(ROOT, 'qbank-pack-should-not-exist')), 'a pack directory inside the repository is refused');
ok(await main(['--pack', path.join(t2, 'archive'), '--quiet']) === 2, '--pack without --out is a usage error');
fs.rmSync(t2, { recursive: true, force: true });

// ── the leak test is a real one ──────────────────────────────────────────────
// Each case is a hint that gave the answer away in the first pack and that the plain-text test let through (it read no \binom, \tfrac or
// a chain of equals signs). A case that must NOT leak is next to it.
{
  const num = (value, prompt = 'Find the value.') => ({ answerType: 'numeric', answer: { value }, prompt, steps: [], hints: [] });
  const cases = [
    [num(252), '$\\binom{10}{5}=252$', true, 'a binomial with its value'],
    [num(252), '$\\binom{10}{5}$', true, 'a binomial the engine evaluates to the answer'],
    [num(252), '$\\binom{10}{4}=210$', false, 'a different binomial'],
    [num(8 / 15), '$\\tfrac{4}{10}\\cdot\\tfrac69+\\tfrac{6}{10}\\cdot\\tfrac49=\\tfrac{48}{90}$', true, 'a fraction that reduces to the answer'],
    [num(20), '$10\\times2=20$', true, 'a product equal to the answer'],
    [num(20), '$10\\times2$', true, 'the product alone'],
    [num(7), '$\\dfrac{56}{8}$', true, 'one trivial division from the answer'],
    [num(7), '$\\dfrac{56}{9}$', false, 'a fraction that is not the answer'],
    [{ answerType: 'expression', answer: { expr: 'exp(2)' }, prompt: 'Solve $\\ln k=2$.', steps: [], hints: [] }, '$\\ln k=2\\Rightarrow k=e^{2}$', true, 'k equals e squared'],
    [{ answerType: 'expression', answer: { expr: '3*x^2' }, prompt: 'Differentiate $y=x^3$.', steps: [], hints: [] }, 'Bring the power down: $\\dfrac{dy}{dx}=3x^{2}$.', true, 'the derivative written out'],
    [{ answerType: 'expression', answer: { expr: '3*x^2' }, prompt: 'Differentiate $y=x^3$.', steps: [], hints: [] }, 'Bring the power down and reduce it by one.', false, 'the method in words'],
    [num(1), 'cot(pi/4) = 1.', true, 'a value in prose with no TeX at all'],
    [num(5), 'The answer is 5.', true, 'a number the prose announces as the result'],
    [num(5), 'Use the 5 given values.', false, 'a number that is only mentioned'],
    [{ answerType: 'set', answer: { values: [2, 3] }, prompt: 'Solve.', steps: [], hints: [] }, '$(x-2)(x-3)=0$, so $x=2$ or $x=3$.', true, 'both roots'],
    [{ answerType: 'set', answer: { values: [2, 3] }, prompt: 'Solve.', steps: [], hints: [] }, 'Factorise the quadratic.', false, 'the first move']
  ];
  for (const [q, text, leaks, what] of cases) ok(!!leakReason(q, text) === leaks, `the leak test ${leaks ? 'finds' : 'passes'}: ${what}`);
  ok(texToPlain('\\binom{10}{5}').plain === 'ncr(10,5)' && texToPlain('\\tfrac{1}{2}^{3}').plain === '((1)/(2))^(3)' && texToPlain('e^{ln 5}').plain === 'e^(ln 5)', 'TeX is read: binomials, fractions, braced powers');
  ok(texToPlain('\\weirdcommand{3}').unread.includes('weirdcommand'), 'a command the reader has no reading of is reported, not guessed');
  // fail closed: a numeric span with a command the reader cannot read is treated as leaking
  ok(!!leakReason(num(3), '$\\weirdcommand{3}$'), 'an unreadable numeric span is treated as leaking (fail closed)');
  // the ladder: the worked rung is never the last step, and a one-step solution has none of its own
  const one = { answerType: 'numeric', answer: { value: 252 }, prompt: 'Find $\\binom{10}{5}$.', hints: ['Use the formula.', 'Write it out.', 'Evaluate it.'], steps: [{ h: 'Evaluate', d: '$\\binom{10}{5}=252$' }] };
  const l1 = bankLadder(one);
  ok(!Object.values(l1.ladder).some(t => /252|binom/.test(t)) && l1.ladder.worked === 'Evaluate it.', 'a one-step solution never shows its step as the worked rung');
  const two = { ...one, steps: [{ h: 'Expand', d: '$\\dfrac{10!}{5!\\,5!}$' }, { h: 'Evaluate', d: '$252$' }], answer: { value: 252 } };
  const l2 = bankLadder(two);
  ok(l2.ladder.worked !== '$252$' && !leakReason(two, l2.ladder.worked) === true || l2.ladder.worked === 'Evaluate it.', 'the worked rung is never the last step');
  const leakyHint = { ...one, hints: ['Use the formula.', 'It is $252$.', 'Evaluate it.'] };
  const l3 = bankLadder(leakyHint);
  ok(!l3.hints.includes('It is $252$.') && l3.dropped.some(d => d.source === 'hint 2') && l3.ladder.method !== 'It is $252$.', 'a hint that states the answer is dropped, and its rung is filled from the next text or left thin');
}

const text = fs.readFileSync(new URL('./qbank-import.mjs', import.meta.url), 'utf8');
const dash = new RegExp(String.fromCharCode(0x2014));
ok(!dash.test(text) && !dash.test(fs.readFileSync(new URL('./qbank-import.test.mjs', import.meta.url), 'utf8')), 'no em dash in the tool or its test');
ok(!/child_process|execSync|spawn|fetch\(|Math\.random|Date\.now|new Date/.test(text), 'the tool runs nothing, fetches nothing and reads no clock or randomness');

if (failures.length) { console.error(`QBANK IMPORT: FAIL ${failures.length}\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`QBANK IMPORT: PASS ${pass}/${pass} checks`);
