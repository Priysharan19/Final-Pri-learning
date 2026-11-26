// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line classes, the answer-bearing line and the line report (display fields; Prithagoras, owner rule 26 Nov 2026)
//
// Every question must support full step-by-step annotated marking. This holds the report layer that the marked page reads, and only that layer:
//   1. `answerLine` (engine/displayFields.js): the line whose stated result the server's own answer check accepts (the last value of a chain included),
//      only when the answer was marked correct, never on a line the page contradicts later, never on a crossed or unticked line. Adversarial cases.
//   2. `tickClass` on the author bank (bankDisplayFields): a class id read from the proof that ticked each line, never a more specific reason than the
//      proof gives, and nothing else about a line moves (text, status, state, note).
//   3. On real pages (300 bank parts, 300 generated forms, true, wrong-answer and one-line-mutant pages): the marker's `stepReport` carries none of the
//      display fields; the displayed report is the same lines with display fields added; every tick on it has a class with a phrase; the marked-page
//      model reads the same page.
//   4. A question the marker judged to nothing now returns the arithmetic reading's all-notes report (no tick, no cross); one it cannot line-mark
//      returns a reason code.
//
//   node server/test/line-classes-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_QBANK_DIR;
const { displayFields, bankDisplayFields, CLASSES } = await import('../../client/src/engine/displayFields.js');
const { classOf, phraseOf, PHRASES } = await import('../../client/src/components/markedPageTeacher.js');
const { stepEvidence, MARKER_OPS } = await import('../platform/markerOps.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { openNote } = await import('../../client/src/engine/provedLines.js');

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

// ── 1. the answer-bearing line ───────────────────────────────────────────────
const line = (text, extra = {}) => ({ text, status: 'ok', state: 'verified', ...extra });
const rep = (...lines) => ({ lines });
const numeric = (value, extra = {}) => ({ answerType: 'numeric', answer: { value }, prompt: 'Find the value.', ...extra });
const accepting = (...texts) => t => texts.includes(String(t).trim());
const al = (q, report, correct, accepts) => displayFields(q, report, { correct, accepts }).answerLine;

{
  const q = numeric(3);
  // the owner's example: the final value of a chain whose first side is arithmetic
  ok(al(q, rep(line('1(16)+(-20)+(7)=3')), true, accepting('3')) === 0, 'the last value of a chain is the answer line (1(16)+(-20)+(7)=3)');
  ok(al(q, rep(line('x = 3')), true, accepting('3')) === 0, 'x = 3 names its value');
  ok(al(q, rep(line('= 5*4*3*2 = 3')), true, accepting('3')) === 0, 'a continuation line (a leading =) names its last value');
  ok(al(q, rep(line('so x = (3)')), true, accepting('3')) === 0, 'so/hence and one bracket pair are read through');
  ok(al(numeric(1.5), rep(line('x = (3/2)')), true, accepting('3/2')) === 0, 'a bracketed fraction is written the way the answer box takes it');
  ok(al(numeric(-4), rep(line('=-(4/1)')), true, accepting('-4/1', '-4')) === 0, 'a bracketed value behind a minus is read');
  ok(al(q, rep(line('f(x) = 2x => x = 3')), true, accepting('3')) === 0, 'the tail after an arrow is the line\'s result');
  // only when the answer was marked correct
  ok(al(q, rep(line('x = 3')), false, accepting('3')) === undefined, 'no answer line when the answer was not marked correct');
  ok(al(q, rep(line('x = 3')), undefined, accepting('3')) === undefined, 'no answer line when correctness is not stated');
  ok(displayFields(q, rep(line('x = 3'))).answerLine === undefined, 'no answer line without the answer check');
  // the answer check decides, not the line's own arithmetic
  ok(al(q, rep(line('0.2(0.5)+0.8(0.5)')), true, accepting('3')) === undefined, 'an unevaluated expression that is not accepted is no answer line');
  ok(al(q, rep(line('x = 4')), true, accepting('3')) === undefined, 'a different value is no answer line');
  ok(al(q, rep(line('x = 3 + 1')), true, accepting('3')) === undefined, 'a chain that ends at another value is no answer line');
  // the last accepted line, not the first
  ok(al(q, rep(line('x = 3'), line('so x = 3')), true, accepting('3')) === 1, 'the last accepted line is the answer line');
  ok(al(q, rep(line('2 + 1 = 3'), line('so 3 + 4 - 4 = 3')), true, accepting('3')) === 1, 'a repeated value later on is the answer line (the earlier one is not)');
  // contradiction: the key met earlier by coincidence, the page then states a different value of the same quantity
  ok(al(q, rep(line('x = 3'), line('x = 5')), true, accepting('3')) === undefined, 'x = 3 by coincidence then x = 5: no line is named');
  ok(al(numeric(6, { answerPrefix: 'x =' }), rep(line('2*3 = 6'), line('x = 8')), true, accepting('6')) === undefined, 'a value met by coincidence, then the answer box\'s own quantity given another value: no line is named');
  ok(al(numeric(6, { answerPrefix: 'x =' }), rep(line('k = -2*-3 = 6'), line('x = 6')), true, accepting('6')) === 1, 'a different quantity earlier does not matter: the last accepted line is named');
  // a later line that states another value withdraws the answer line, ticked or not, whatever its form or label (when unsure, no line)
  {
    const a3 = (...later) => al(q, { lines: [line('x = 3'), ...later] }, true, accepting('3'));
    ok(a3(line('x = 5')) === undefined, 'later x = 5 (same label)');
    ok(a3(line('y = 5')) === undefined, 'later y = 5 (another label)');
    ok(a3(line('= 5')) === undefined, 'later bare = 5');
    ok(a3(line('x ≈ 5')) === undefined, 'later x ≈ 5');
    ok(a3(line('so x ≈ 5.0')) === undefined, 'later so x ≈ 5.0');
    ok(a3(line('Hence 5')) === undefined, 'later Hence 5');
    ok(a3(line('5')) === undefined, 'later bare number 5');
    ok(a3(line('2 + 3 = 5')) === undefined, 'later chain ending at another number');
    ok(a3(line('(2/2)*(10 + 3) = 13')) === undefined, 'later check ending at another number');
    ok(a3({ text: 'x = 5', status: 'note', state: 'unverified' }) === undefined, 'later x = 5 that is only a note (unticked)');
    ok(a3({ text: '= 5', status: 'break', state: 'wrong' }) === undefined, 'later = 5 that is crossed');
    ok(al(q, { lines: [line('x = 3'), { text: 'x = 9', status: 'break', state: 'wrong' }, { text: 'Hence 5', status: 'note' }] }, true, accepting('3')) === undefined, 'a later value after a cross still withdraws it');
    ok(al(numeric(3, { answerPrefix: 'x =' }), { lines: [line('2 + 1 = 3'), { text: 'x = 7', status: 'note' }] }, true, accepting('3')) === undefined, 'the answer box\'s own label, unticked');
    ok(a3(line('x = 3')) === 1, 'the same value again does not withdraw it (the later line is the answer line)');
    ok(a3(line('At x = 2: y = 7')) === 0, 'a substitution under At x = a: is set aside');
    ok(a3(line('Solution:', { context: true, status: 'note' })) === 0, 'a heading is not a value');
    ok(a3({ text: 'so x is the root', status: 'note' }) === 0, 'prose with no value does not withdraw it');
    ok(a3(line('x + 1 = 4')) === undefined, 'a later line ending at another constant (4)');
  }
  ok(displayFields(numeric(29), rep(line('c = 34 - 5 = 29'), line('17 + 22 = 39')), { correct: true, accepts: accepting('29') }).answerLine === undefined, 'a check ending at 39 after c = 29 withdraws it (unsure: none)');
  ok(al(numeric(6), rep(line('k = -2*-3 = 6'), line('18 != -3*-5')), true, accepting('6')) === 0, 'a not-equal check line does not contradict it');
    ok(al(q, rep(line('At x = 2: y = 7'), line('x = 3')), true, accepting('3')) === 1, 'a line under At x = a: names a value of y and is not the answer');
  // only a ticked, judged line, before the first cross
  ok(al(q, { lines: [{ text: 'x = 3', status: 'note', state: 'unverified' }] }, true, accepting('3')) === undefined, 'an unticked line is never the answer line');
  ok(al(q, { lines: [line('x = 2'), { text: 'x = 3 - 1', status: 'break', state: 'wrong' }, line('x = 3')] }, true, accepting('3')) === undefined, 'a line after the first cross is never the answer line');
  ok(al(q, { lines: [line('x = 3'), { text: 'x + 0', status: 'break', state: 'wrong' }] }, true, accepting('3')) === 0, 'a line before the first cross can be');
  ok(al(q, { lines: [{ text: 'x = 3', status: 'note', context: true, state: 'condition' }] }, true, accepting('3')) === undefined, 'a stated condition is never the answer line');
  // types
  ok(al({ answerType: 'set', answer: { values: [0, 6] }, prompt: 'Solve.' }, rep(line('x = 0 or x = 6')), true, accepting('x = 0 or x = 6')) === 0, 'a set answer is named by the line that states the whole set');
  ok(al({ answerType: 'set', answer: { values: [0, 6] }, prompt: 'Solve.' }, rep(line('x = 0'), line('x = 6')), true, accepting('x = 0 or x = 6')) === undefined, 'one root of a set is not the set');
  ok(al({ answerType: 'expression', answer: { expr: '2x' }, prompt: 'Simplify.' }, rep(line('x + x = 2x')), true, accepting('2x')) === 0, 'an expression answer: the end of the chain');
  ok(al({ answerType: 'mcq', prompt: 'Choose.' }, rep(line('x = 3')), true, accepting('3')) === undefined, 'a multiple-choice question has no answer line');
  ok(al(q, rep(line('x = 3')), true, () => { throw new Error('boom'); }) === undefined, 'an answer check that throws names no line');
  ok(al(q, rep(line('x = ' + '3'.repeat(300))), true, () => true) === undefined, 'a very long line is not read');
  // with the real answer check: a list of roots is not the single value that happens to be one of them
  {
    const q6 = { answerType: 'numeric', answer: { value: 6, simplestFraction: { n: 6, d: 1 } }, prompt: 'Find the larger $x$-coordinate.' };
    const real = t => checkAnswer(q6, t).correct === true;
    ok(real('6') && real('6'), 'the real answer check takes 6');
    ok(al(q6, rep(line('x = 0 or x = 6')), true, real) === undefined, 'a line that lists x = 0 or x = 6 is not the answer to "find the larger x" (numeric key 6)');
    ok(al(q6, rep(line('x = 0 or x = 6'), line('The larger x-coordinate is 6')), true, real) === 1, 'the sentence that states the single value is');
    ok(al(q6, rep(line('The two stationary points are (0,0) and (6,-432).')), true, real) === undefined, 'a sentence naming points is not');
  }
  // the bank gets the same rule
  ok(bankDisplayFields(numeric(3), rep(line('1(16)+(-20)+(7)=3')), { correct: true, accepts: accepting('3') }).answerLine === 0, 'the bank: the last value of a chain is the answer line');
  ok(bankDisplayFields(numeric(3), rep(line('x = 3')), { correct: false, accepts: accepting('3') }).answerLine === undefined, 'the bank: no answer line when the answer was not correct');
  ok(bankDisplayFields(numeric(3), rep(line('x = 3'), line('x = 5')), { correct: true, accepts: accepting('3') }).answerLine === undefined, 'the bank: x = 3 then x = 5 names no line');
}

// ── 2. the class of a bank tick ──────────────────────────────────────────────
{
  const q = numeric(1);
  const cls = l => bankDisplayFields(q, rep(l)).lines[0].tickClass;
  ok(cls(line('x', { solutionMatch: true, note: 'Matches step 2 of the worked solution (Expand).' })) === 'matches-worked-step', 'a line that only equals a step of the worked solution is matches-worked-step');
  ok(cls({ text: 'a', status: 'ok', state: 'given', solutionMatch: true }) === 'restated-question', 'a restated question is restated-question');
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'continuation' } })) === 'equal-to-line-above', 'a continuation equals the line above');
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'arithmetic' }, fact: { kind: 'both-sides' } })) === 'arithmetic-chain', 'both sides coming to one value is arithmetic');
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'true-as-written' } })) === 'true-as-written', 'a true-as-written line stays true-as-written');
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'question-given' } })) === 'restated-function', 'a given of the question is named so');
  ok(cls(line('x', { fact: { kind: 'proved', proof: 'listed' } })) === 'solution-list', 'a proved list is a solution list');
  ok(cls(line('x', { coversAll: true })) === 'solution-list', 'a line that covers every solution is a solution list');
  ok(cls(line('x', { how: { kind: 'equal-above' } })) === 'equal-to-line-above', 'a line equal to the one above says so');
  ok(cls(line('x')) === 'true-as-written', 'a tick with no proof field is true-as-written, the generated path\'s own fallback (never a more specific reason)');
  ok(cls(line('x', { tickClass: 'factorisation' })) === 'factorisation', 'a class the engine already gave is kept');
  // `page-definitions` is one rule with several proofs: the class follows the engine's sentence, never the rule's name
  const pd = note => cls(line('x', { state: 'arithmetic', valueChain: { rule: 'page-definitions' }, note }));
  ok(pd('$x = -2$, $x = 1$ each satisfy the equation above. This does not say these are all the solutions.') === 'satisfies-equation-above', 'A12-C4-016 x=-2,1: each satisfies the equation above');
  ok(pd('$y = 3$, $y = -4$ each satisfy the equation above. This does not say these are all the solutions.') === 'satisfies-equation-above', 'A11-F1-180 y=3,-4: each satisfies the equation above');
  ok(pd('The same equation as the one before it, rearranged.') === 'same-equation-as-line-above', 'A12-F2-070 y^2+y-2=0: the same equation, rearranged');
  ok(pd('$x = 1$ satisfies the equation before it.') === 'satisfies-equation-above', 'A12-C3-087 x=1: satisfies the equation before it');
  ok(pd('Each side comes to $2$.') === 'arithmetic-chain' && pd('With $r = 3$ from the question, each side comes to $36\\pi$.') === 'arithmetic-chain', 'a real numeric chain is arithmetic');
  ok(pd('This is the derivative of $x^2$, by the product rule.') === 'derivative-rule', 'a derivative is a derivative');
  ok(pd('something the engine says that is not listed') === 'true-as-written' && pd(undefined) === 'true-as-written', 'an unknown proof is true-as-written');
  // every (rule, how, fact) shape the engine emits on a bank page, sampled from the real pack: the class is one the proof guarantees
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'arithmetic' }, fact: { kind: 'both-sides' }, note: 'Both sides come to $5$.' })) === 'arithmetic-chain', 'both sides come to a number: arithmetic');
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'arithmetic' }, note: 'something else' })) === 'true-as-written', 'rule arithmetic without both sides: no specific reason');
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'true-as-written' }, fact: { kind: 'both-sides' } })) === 'true-as-written', 'true-as-written with both sides stays so');
  ok(cls(line('x', { state: 'arithmetic', valueChain: { rule: 'arithmetic' }, fact: { kind: 'equals-line-above' }, note: 'This equals the line above: $5$.' })) === 'equal-to-line-above', 'this equals the line above');
  ok(cls(line('x', { state: 'incomplete', note: 'x = 2 is also a solution' })) === 'true-as-written', 'an incomplete-solution tick has no specific reason');
  const src = rep(line('a', { solutionMatch: true }), { text: 'b', status: 'note', state: 'unverified', note: 'n' }, { text: 'c', status: 'break', state: 'wrong', note: 'w' });
  const out = bankDisplayFields(q, src);
  ok(out.lines.every((l, i) => ['text', 'status', 'state', 'note', 'solutionMatch'].every(k => l[k] === src.lines[i][k])), 'no text, status, state or note moves');
  ok(out.lines[1].tickClass === undefined && out.lines[2].tickClass === undefined, 'a note and a cross get no class');
  ok(bankDisplayFields(q, { lines: [{ text: 'b', status: 'note' }] }) .lines[0].tickClass === undefined, 'a report with no tick is not given one');
  const again = bankDisplayFields(q, out);
  ok(again === out || JSON.stringify(again) === JSON.stringify(out), 'applying it twice changes nothing');
  ok(bankDisplayFields(q, null) === null, 'no report, no change');
  ok(['matches-worked-step', 'equal-to-line-above'].every(c => CLASSES.includes(c)), 'the two new ids are in CLASSES');
  // every class id the engine can emit reaches a phrase on the page
  for (const c of CLASSES) {
    const card = { status: 'checked', tickClass: c };
    ok(!!phraseOf(classOf(card)), `class ${c} has a phrase`);
  }
  ok(PHRASES.solutionStep === 'Matches a step of the worked solution', 'the phrase of matches-worked-step is the owner\'s wording');
  ok(classOf({ status: 'checked', tickClass: 'true-as-written', rules: [{ rule: 'expand' }] }) === 'expansion' && classOf({ status: 'checked', tickClass: 'true-as-written' }) === 'trueAsWritten', 'a rule the page itself read between two lines is shown instead of the fallback id');
  ok(classOf({ status: 'checked', tickClass: 'factorisation', rules: [{ rule: 'expand' }] }) === 'factorisation', 'a proved class is never replaced by the page\'s own reading');
  ok(classOf({ status: 'checked', tickClass: 'matches-worked-step' }) === 'solutionStep', 'matches-worked-step reads "Matches a step of the worked solution"');
}

// ── 3 and 4. real pages ──────────────────────────────────────────────────────
const A = await import('../../tools/annotation-coverage.mjs');
const { buildAnnotatedWorking } = await import('../../client/src/components/annotatedWorkingModel.js');
const { buildMarkedPage } = await import('../../client/src/components/markedPageModel.js');
const SM = await import('../../client/src/engine/solutionMatch.js');
const W = await A.loadWorld();
const DISPLAY = new Set(['tickClass', 'notRequired', 'reasonId', 'correctedLine', 'correctedRhs', 'followsFromError', 'followsFrom']);
const strip = l => Object.fromEntries(Object.entries(l || {}).filter(([k]) => !DISPLAY.has(k)));
const pages = [];
{
  const bank = A.bankEntriesOf(W).filter(b => b.place);
  for (let i = 0, n = 0; i < bank.length && n < 300; i += 7, n++) {
    const b = bank[i];
    const q = A.markerViewOf(b.worked ? W.pack.qbankManualQuestion(b.entry.id, 17) : W.pack.qbankEntryQuestion(b.entry.id, 17));
    const { lines } = A.authoredLines(q, s => SM._internals.withBankReading(() => SM._internals.spanToPlain(s)));
    if (lines.length) pages.push({ q: { ...q, ...(b.worked ? { _bankWorked: true } : {}) }, lines, key: b.worked ? '' : A.keyText(q), id: b.entry.id, bank: true });
  }
  const forms = A.generatedForms(W);
  for (let i = 0, n = 0; i < forms.length && n < 300; i += 4, n++) {
    const f = forms[i];
    const q = A.markerViewOf({ ...W.G.generateQuestion(f.generator, f.difficulty, f.seeds[0]), _marking: 'final-answer-only' });
    const { lines } = A.authoredLines(q, A.genToPlain);
    if (lines.length) pages.push({ q, lines, key: A.keyText(q), id: f.id, bank: false });
  }
}
ok(pages.length >= 450, `real pages: ${pages.length}`);
let noReportPage = null, ticks = 0, withoutClass = 0, withoutPhrase = 0, stepReportDirty = 0, shownMoved = 0, answerLines = 0, answerLineWrong = 0, mutants = 0, mutantTicked = 0, shownCount = 0, answerLineOnWrong = 0;
const run = (q, answer, text, opts = {}) => { try { return stepEvidence(q, answer, text, checkAnswer(q, answer), { slipWarnings: true, ...opts }); } catch { return null; } };
for (const p of pages) {
  const on = run(p.q, p.key, p.lines.join('\n'));
  if (!on) continue;
  const base = on.stepReport;
  if (base && base.lines.some(l => l && (l.tickClass !== undefined || l.notRequired !== undefined)) || (base && base.answerLine !== undefined)) stepReportDirty++;
  const shown = on.shownReport;
  if (!shown) continue;
  shownCount++;
  if (base) {
    // a line the integration layer ticked or crossed (engine/integrationLines.js, fact.proof 'integration' / 'integration-false') is held by its own check (integration-lines-check.mjs): a line is exempt only when it was an OPEN NOTE on the marker's report (the layer can never overturn a tick or a cross); every OTHER line must be the marker's, unmoved
    const byIntegration = l => !!l && l.fact && (l.fact.proof === 'integration' || l.fact.proof === 'integration-false' || l.tickClass === 'substitution-defined');
    const same = base.lines.length === shown.lines.length && base.lines.every((l, i) => (byIntegration(shown.lines[i]) && openNote(l)) || JSON.stringify(strip(l)) === JSON.stringify(strip(shown.lines[i])));
    if (!same && !p.bank) continue;      // a generated page's displayed report also carries the proved-line ticks (engine/provedLines.js): its own check holds those
    if (!same) { shownMoved++; if (process.env.DBG) console.log('MOVED', p.id, JSON.stringify(base.lines.map(strip)).slice(0, 400), JSON.stringify(shown.lines.map(strip)).slice(0, 400)); }
  } else { if (p.bank && !shown.lines.every(l => l.status === 'note')) { shownMoved++; if (process.env.DBG) console.log('NOBASE', p.id, JSON.stringify(shown.lines).slice(0, 500)); } if (p.bank || shown.lines.every(l => l.status === 'note')) noReportPage ||= p; }
  if (p.bank) {
    for (const l of shown.lines) if (l.status === 'ok') { ticks++; if (!l.tickClass) withoutClass++; else if (!CLASSES.includes(l.tickClass)) withoutClass++; }
  }
  // the page the marked page draws from it: every tick has a phrase
  try {
    const model = buildAnnotatedWorking({ lines: p.lines, stepReport: shown, page: true });
    if (model) {
      const page = buildMarkedPage({ model });
      for (const l of page.lines) if (l.status === 'checked' && !phraseOf(classOf(l.card))) withoutPhrase++;
    }
  } catch { /* no model */ }
  // an answer line, when named, is a ticked line the answer check accepts, and only for a correct answer
  if (Number.isInteger(shown.answerLine)) {
    answerLines++;
    const l = shown.lines[shown.answerLine];
    if (!l || l.status !== 'ok') answerLineWrong++;
    if (checkAnswer(p.q, p.key).correct !== true) answerLineOnWrong++;
  }
  // a wrong typed answer names no answer line
  const wrong = run(p.q, '99991', p.lines.join('\n'));
  if (wrong && wrong.shownReport && Number.isInteger(wrong.shownReport.answerLine)) answerLineOnWrong++;
}
ok(shownCount > 300, `pages with a displayed report: ${shownCount}`);
ok(stepReportDirty === 0, `the marker's stepReport (what the marks read) carries no display field: ${stepReportDirty} pages do`);
ok(shownMoved === 0, `the displayed bank report is the marker's report with display fields added, nothing else moved: ${shownMoved} pages moved`);
ok(ticks > 300 && withoutClass === 0, `every tick on the bank pages (${ticks}) carries a known class id: ${withoutClass} do not`);
ok(withoutPhrase === 0, `every tick the marked page draws has a phrase: ${withoutPhrase} do not`);
ok(answerLines > 50 && answerLineWrong === 0 && answerLineOnWrong === 0, `answer lines named (${answerLines}) are ticked lines of a correct answer: ${answerLineWrong} not ticked, ${answerLineOnWrong} on a wrong answer`);

// the same pages with one line made false: the display layer adds no tick and no cross
{
  const H = await import('../../tools/marking-mutation-harness.mjs');
  for (const p of pages.slice(0, 200)) {
    for (let i = 0; i < p.lines.length && i < 4; i++) {
      const ms = H.mutationsOf(p.lines[i]).filter(m => H.judgeMutant(p.lines[i], m.text) === 'wrong').slice(0, 1);
      for (const m of ms) {
        const page = p.lines.map((l, j) => (j === i ? m.text : l));
        const a = run(p.q, '99991', page.join('\n')); if (!a) continue;
        mutants++;
        // the integration layer may CROSS a line that is provably false (engine/integrationLines.js): a mutant here is judged wrong, so that cross is the point. It may never tick one.
        const shownLines = (a.shownReport || a.stepReport)?.lines || [];
        const mine = shownLines.map(l => (l && l.fact && l.fact.proof === 'integration-false' ? 'note' : l?.status)), theirs = a.stepReport?.lines?.map(l => l.status) || [];
        if (a.stepReport && !p.bank) continue;     // generated pages carry the proved-line ticks the other checks hold
        if (a.stepReport && mine.some((s, j) => s !== theirs[j])) mutantTicked++;
        if (!a.stepReport && mine.some(s => s !== 'note')) mutantTicked++;
      }
    }
  }
  ok(mutants > 300 && mutantTicked === 0, `one-line mutants (${mutants}) get no tick or cross from the display layer: ${mutantTicked}`);
}

// the four real lines the review found with a wrong reason
for (const [id, text, want] of [['A12-C4-016', 'x=-2,1', 'satisfies-equation-above'], ['A11-F1-180', 'y=3,-4', 'satisfies-equation-above'], ['A12-F2-070', 'y^(2)+y-2=0', 'same-equation-as-line-above'], ['A12-C3-087', 'x=1', null]]) {
  let q, worked = false;
  try { q = A.markerViewOf(W.pack.qbankEntryQuestion(id, 17)); } catch { q = { ...A.markerViewOf(W.pack.qbankManualQuestion(id, 17)), _bankWorked: true }; worked = true; }
  const { lines } = A.authoredLines(q, s => SM._internals.withBankReading(() => SM._internals.spanToPlain(s)));
  const ev = run(q, worked ? '' : A.keyText(q), lines.join('\n'));
  const shown = (ev && (ev.shownReport || ev.stepReport))?.lines || [];
  const i = shown.findIndex(l => String(l.text).replace(/\s/g, '') === text);
  const l = shown[i];
  const arithmeticLabel = l && l.tickClass === 'arithmetic-chain' && !/each side comes to|Both sides come to/i.test(String(l.note));
  ok(i >= 0 && l.status === 'ok' && !arithmeticLabel && (want === null || l.tickClass === want), `${id} ${text}: class ${l && l.tickClass} (${String(l && l.note).slice(0, 50)}) is not "Correct arithmetic" unless it is a numeric chain`);
}

// 4. the report where there were none, and the reason where there cannot be one
{
  ok(!!noReportPage, 'the sample holds a page the marker judged to nothing');
  const { q, lines, key } = noReportPage;
  const r = MARKER_OPS.practice({ q, answer: key, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  const ev = r.evidence;
  ok(!ev.stepReport && ev.shownReport && ev.shownReport.lines.length === lines.length && ev.shownReport.lines.every(l => l.status === 'note'), 'a page the marker judged to nothing returns its all-notes report (no tick, no cross), not nothing');
  ok(ev.partial === null && !ev.noLineReport, 'and the partial and the reason code are absent');
  const g = { answerType: 'graph-sketch', prompt: 'Sketch.', answer: {}, contentId: 'gen:y12-sketch:d1:s1' };
  const e1 = stepEvidence(g, 'x', 'y = x^2\ny = 2x', { correct: false });
  ok(e1.noLineReport && e1.noLineReport.reason === 'graph-sketch' && !e1.shownReport, 'a graph sketch returns the reason code "graph-sketch"');
  const e2 = stepEvidence({ answerType: 'mcq', prompt: 'Choose.', answer: { index: 0 }, options: ['a', 'b'] }, 'a', 'x = 1\nx = 2', { correct: false });
  ok(e2.noLineReport && e2.noLineReport.reason === 'multiple-choice', 'a multiple-choice question returns the reason code "multiple-choice"');
  const e3 = stepEvidence(numeric(3), '3', '', { correct: true });
  ok(e3.noLineReport && e3.noLineReport.reason === 'no-working', 'blank working returns the reason code "no-working"');
  const e4 = stepEvidence(numeric(3), '3', 'x = 3\nso x = 3', { correct: true });
  ok(!e4.noLineReport, 'a question that has a report returns no reason code');
}

if (failures.length) { console.error(`LINE CLASSES: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`line classes: ${pages.length} real pages (${shownCount} displayed), ${ticks} bank ticks with a class, ${answerLines} answer lines, ${mutants} one-line mutants, ${stepReportDirty} display fields on stepReport`);
console.log(`LINE CLASSES: PASS: ${pass} checks`);
