// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Type mode — a final answer, and working that earns its marks
//
// Owner-reported: "Find the area enclosed between y = x² and y = 7x" (Class 12,
// Application of Integrals, D3 seed 4) is a three-mark question, but Type mode
// offered one field, no working, and a generic error for `∫4x+3`.
//
//   1 · the engine: every question of the family carries a self-consistent,
//       private working rubric; verified evidence earns method marks and
//       nothing else does (the device-question path uses this same meta);
//   2 · the guidance: working typed into a numeric final-answer field gets a
//       specific message and can be moved to the working, losing nothing;
//   3 · the mounted fields: a labelled Final answer, the reading preview, and
//       a working area that is open by default when method marks exist;
//   4 · typed answer and working survive a remount (draft store) and a change
//       of input mode.
//
//   node client/test/typed-answer-working-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const webStorage = new Map();
const localStorage = {
  getItem: k => (webStorage.has(String(k)) ? webStorage.get(String(k)) : null),
  setItem: (k, v) => { webStorage.set(String(k), String(v)); },
  removeItem: k => { webStorage.delete(String(k)); },
  key: i => [...webStorage.keys()][i] ?? null,
  get length() { return webStorage.size; },
  clear: () => webStorage.clear()
};
globalThis.localStorage = localStorage;
if (!globalThis.window) globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
if (!globalThis.document) globalThis.document = { documentElement: { lang: 'en' }, cookie: '', addEventListener() {}, removeEventListener() {} };

const { generateQuestion, loadAllBanks } = await import('../src/engine/generators/index.js');
const { checkAnswer, stepCheck, methodMarks } = await import('../src/engine/checker.js');
const { areaPlan, assessAreaLine } = await import('../src/engine/reason-area.js');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
await loadAllBanks();

const GENERATOR = 'c12-applications-integrals';
const keyOf = q => q.answer.simplestFraction ? `${q.answer.simplestFraction.n}/${q.answer.simplestFraction.d}` : String(q.answer.value);
// The marks a question carries, as both the server and the device count them.
const marksOf = q => Math.max(1, Math.min(Math.min(4, Math.max(1, Number(q.difficulty) || 1)),
  q.steps.filter(step => !/^(check|note|bonus)/i.test(step.h)).length || 1));
// The device and the server grade a wrong final answer the same way: the
// authored stepcheck is the meta, and methodMarks reads the working against it.
const award = (q, working, marks = marksOf(q)) =>
  methodMarks({ meta: q.stepcheck, working, marks, prompt: q.prompt })?.awarded ?? 0;

// ── 1 · The owner-reported question ──────────────────────────────────────────
{
  const q = generateQuestion(GENERATOR, 3, 4);
  ok(/parabola \$y = x\^2\$ and the line \$y = 7x\$/.test(q.prompt), 'D3 seed 4 is the reported question');
  eq(keyOf(q), '343/6', 'its keyed answer is 343/6');
  eq(marksOf(q), 3, 'and it carries three marks');
  eq(q.stepcheck?.kind, 'plan', 'it carries an authored working plan');
  eq(q.stepcheck.stages.map(s => s.kind), ['area-limits', 'area-integrand', 'area-antiderivative', 'area-value'], 'limits, integrand, antiderivative, value');
  ok(!String(q.inputHint || '').includes('343'), 'the public input hint is a format, not the answer');
  eq(checkAnswer(q, '343/6').correct, true, '343/6 is correct');
  eq(checkAnswer(q, '5').correct, false, '5 is incorrect');
  ok(checkAnswer(q, '5').invalid !== true, 'and 5 is a readable answer, so it is a real attempt');
  const integral = checkAnswer(q, '∫4x+3');
  eq([integral.correct, integral.invalid], [false, true], '∫4x+3 is not a final value: invalid, never a wrong attempt');
  eq(checkAnswer(q, '57.17').correct, false, 'a rounded decimal is not the exact area');

  const credit = [
    ['x = 0, x = 7\n∫_0^7 (7x - x^2) dx', 2, 'limits and integrand'],
    ['x = 0 or x = 7', 1, 'limits alone'],
    ['x^2 = 7x\nx^2 - 7x = 0\nx(x - 7) = 0\nx = 0, 7', 1, 'four lines of the limits stage are one criterion'],
    ['7x - x^2', 1, 'upper minus lower'],
    ['∫ (7x - x^2) dx', 1, 'the integrand under an integral sign'],
    ['A = ∫_0^7 (7x - x^2) dx', 1, 'a labelled integral with correct limits'],
    ['\\int_{0}^{7} (7x - x^2) dx', 1, 'LaTeX-style limits'],
    ['∫ from 0 to 7 (7x - x^2) dx', 1, 'limits written in words'],
    ['7x^2/2 - x^3/3', 1, 'an antiderivative'],
    ['[7x^2/2 - x^3/3]_0^7', 1, 'the bracket with limits'],
    ['3.5x^2 - x^3/3 + C', 1, 'an antiderivative in another form, with a constant'],
    ['7x - x^2\n7x^2/2 - x^3/3\n343/2 - 343/3', 2, 'three stages, capped one below full marks'],
    ['7x^2/2 - x^3/3\n343/6', 2, 'the exact value after verified integration']
  ];
  for (const [working, expected, label] of credit) {
    eq(award(q, working), expected, `credit · ${label}`);
    ok(award(q, working) < 3, `credit · ${label}: never full marks for a wrong final answer`);
  }
  const nothing = [
    ['y = x^2\ny = 7x', 'the question restated'],
    ['x^2\n7x', 'the curves copied out'],
    ['x^2 + 7x\n7x + x^2', 'the curves added'],
    ['x^2 - 7x', 'lower minus upper'],
    ['∫_0^7 (x^2 - 7x) dx', 'lower minus upper under the integral'],
    ['∫_0^5 (7x - x^2) dx', 'wrong upper limit'],
    ['∫_7^0 (7x - x^2) dx', 'limits reversed'],
    ['∫4x+3', 'an unrelated integral'],
    ['x = 7', 'one limit only'],
    ['x = 0', 'the other limit only'],
    ['x = 0, x = 7, x = 3', 'an extra limit'],
    ['x = x\n0 = 0\n1 + 1 = 2\n0*x = 0', 'true but empty lines'],
    ['A = 49/2\ny = 49', 'statements about other quantities'],
    ['343/6', 'the bare value before any integration'],
    ['7x^2/2 - x^3/3\n57.17', 'a rounded value (the antiderivative alone would earn 1, the decimal 0)', 1],
    ['7x^2 - x^3', 'a wrong antiderivative'],
    ['7x^2/2 + x^3/3', 'a sign error in the antiderivative'],
    ['area is the integral of top minus bottom', 'prose'],
    ['', 'no working']
  ];
  for (const [working, label, expected = 0] of nothing) eq(award(q, working), expected, `no credit · ${label}`);

  // Evidence stages abstain; they never invent a break, and their notes never
  // state the expected mathematics.
  const report = stepCheck(q.stepcheck, 'x = 7\ny = 7x\nA = 49/2\n∫_0^5 (7x - x^2) dx\n57.17\nnonsense');
  eq(report.firstBreak, -1, 'unverified area lines are notes, never a claimed error');
  ok(report.lines.every(l => l.status === 'note'), 'none of them is credited');
  ok(!/343|7x|x\^2|\b0\b.*\b7\b/.test(report.lines.map(l => l.note).join(' ')), 'and no note reveals limits, integrand or value');
}

// ── 2 · The whole family, many seeds ─────────────────────────────────────────
{
  const expectStages = { 1: 3, 2: 3, 3: 4, 4: 4 };
  let seen = 0;
  for (const difficulty of [1, 2, 3, 4]) {
    for (let seed = 0; seed < 40; seed++) {
      const q = generateQuestion(GENERATOR, difficulty, seed);
      const tag = `D${difficulty} seed ${seed}`;
      const plan = q.stepcheck;
      if (plan?.kind !== 'plan' || plan.creditPerStage !== true || plan.stages.length !== expectStages[difficulty]) {
        failures.push(`${tag}: every area task carries its working plan`); continue;
      }
      seen++;
      const marks = marksOf(q), cap = marks - 1;
      const f = plan.stages.find(s => s.kind === 'area-integrand');
      const F = plan.stages.find(s => s.kind === 'area-antiderivative');
      const V = plan.stages.find(s => s.kind === 'area-value');
      const L = plan.stages.find(s => s.kind === 'area-limits');
      const key = keyOf(q);
      const bad = [];
      if (checkAnswer(q, key).correct !== true) bad.push('keyed answer correct');
      if (Math.abs(V.expected - q.answer.value) > 1e-9) bad.push('value stage is the keyed area');
      if (checkAnswer(q, '∫4x+3').invalid !== true) bad.push('working in the answer field is invalid');
      if (q.inputHint && q.answer.simplestFraction && String(q.inputHint).includes(key)) bad.push('hint is not the answer');
      const setUp = `∫_${f.lower}^${f.upper} (${f.expr}) dx`;
      const bracket = `[${F.antiderivative}]_${F.lower}^${F.upper}`;
      const lines = [...(L ? [`x = ${L.values.join(', ')}`] : []), setUp, bracket, key];
      const fullWorking = award(q, lines.join('\n'));
      if (fullWorking !== Math.min(cap, lines.length)) bad.push(`complete working earns every method mark (${fullWorking})`);
      if (fullWorking >= marks) bad.push('working alone never reaches full marks');
      if (award(q, setUp) !== Math.min(cap, 1)) bad.push('the set-up alone is one method mark');
      if (award(q, key) !== 0) bad.push('the bare answer in the working is not a method');
      if (award(q, `∫_${f.lower}^${f.upper + 1} (${f.expr}) dx`) !== 0) bad.push('a wrong limit earns nothing');
      if (award(q, `${F.antiderivative} + x`) !== 0) bad.push('a wrong antiderivative earns nothing');
      if (f.requireIntegral && award(q, f.expr) !== 0) bad.push('a function the prompt already states is not a step when merely copied');
      const restated = [...q.prompt.matchAll(/\$([^$]+)\$/g)].map(m => m[1]).filter(s => /=/.test(s)).join('\n');
      if (award(q, restated) !== 0) bad.push('restating the prompt earns nothing');
      if (bad.length) failures.push(`${tag}: ${bad.join('; ')}`); else pass++;
    }
  }
  eq(seen, 160, 'all 160 sampled questions of the family carry a working plan');

  // A plan whose own pieces disagree is refused, so supportsSteps is never
  // true without a real rubric behind it.
  eq(areaPlan({ integrand: '7x - x^2', antiderivative: '7x^2/2 - x^3/3', lower: 0, upper: 7, value: 343 / 6, limits: [0, 7] })?.stages.length, 4, 'a consistent plan is built');
  eq(areaPlan({ integrand: '7x - x^2', antiderivative: '7x^2 - x^3', lower: 0, upper: 7, value: 343 / 6 }), null, 'a wrong antiderivative refuses the plan');
  eq(areaPlan({ integrand: '7x - x^2', antiderivative: '7x^2/2 - x^3/3', lower: 0, upper: 7, value: 57 }), null, 'a value that is not the definite integral refuses the plan');
  eq(areaPlan({ integrand: 'nonsense(', antiderivative: 'x', lower: 0, upper: 1, value: 1 }), null, 'unreadable metadata refuses the plan');
  eq(assessAreaLine({ text: '343/6', meta: { kind: 'evaluation' } }).status, 'note', 'a foreign stage kind is never credited by the area verifier');
  eq(assessAreaLine({ text: 'x = 0, 7', meta: { kind: 'area-limits', variable: 'x', values: [0, 7] } }).status, 'note', 'the limits stage fails closed without the exact equation verifier');
}

// ── 3 · Guidance for the final-answer field ──────────────────────────────────
const { finalAnswerGuidance, looksLikeWorking, moveToWorking, workingAreaMode } = await import('../src/components/typedAnswerGuide.js');
const publicQ = { id: 'q-area', answerType: 'numeric', supportsSteps: true, prompt: 'Find the area…', inputHint: 'An exact value — a fraction a/b', answerSuffix: 'square units' };
{
  eq(workingAreaMode(publicQ, 3), 'open', 'method marks + a verified rubric: the working area is open');
  eq(workingAreaMode(publicQ, 1), 'toggle', 'one mark: working stays behind one labelled control');
  eq(workingAreaMode({ ...publicQ, supportsSteps: false }, 3), 'none', 'no rubric: the screen does not ask for working it cannot mark');
  eq(workingAreaMode({ ...publicQ, supportsSteps: 'yes' }, 3), 'none', 'only a literal true opens it');
  ok(looksLikeWorking('∫4x+3') && looksLikeWorking('[x^2]_0^7') && looksLikeWorking('7x dx') && looksLikeWorking('a\nb'), 'integral signs, brackets, dx and several lines read as working');
  ok(!looksLikeWorking('343/6') && !looksLikeWorking('-2.5') && !looksLikeWorking('sqrt(2)') && !looksLikeWorking('2pi'), 'final values do not');
  eq(finalAnswerGuidance({ question: publicQ, answer: '343/6', totalMarks: 3 }), null, 'a value needs no guidance');
  eq(finalAnswerGuidance({ question: publicQ, answer: '   ', totalMarks: 3 }), null, 'an empty field needs none');
  const g = finalAnswerGuidance({ question: publicQ, answer: '∫4x+3', totalMarks: 3 });
  eq(g, { titleKey: 'verdict.finalNumberTitle', bodyKey: 'verdict.finalNumberBody', workingKey: 'verdict.finalNumberWorking', canMoveToWorking: true },
    '∫4x+3 in a numeric field: a number is wanted, and working has its own place');
  eq(finalAnswerGuidance({ question: publicQ, answer: 'abc??', totalMarks: 3 }), null, 'unrecognised text is not second-guessed before the engine has read it');
  eq(finalAnswerGuidance({ question: publicQ, answer: 'abc??', totalMarks: 3, rejected: true })?.canMoveToWorking, false, 'once the engine refuses it, the format is explained');
  eq(finalAnswerGuidance({ question: { ...publicQ, supportsSteps: false }, answer: '∫4x+3', totalMarks: 3 })?.workingKey, null, 'no working box is promised where none exists');
  eq(finalAnswerGuidance({ question: { ...publicQ, answerType: 'expression' }, answer: '∫4x+3', totalMarks: 3 }), null, 'an expression answer is not told to be a number');
  eq(moveToWorking('∫4x+3', ''), { answer: '', working: '∫4x+3' }, 'moving puts the text in the working');
  eq(moveToWorking(' ∫4x+3 ', 'x = 0, 7\n'), { answer: '', working: 'x = 0, 7\n∫4x+3' }, 'after what is already there');
  eq(moveToWorking('', 'kept'), { answer: '', working: 'kept' }, 'and an empty field moves nothing');
  for (const cat of [en, hi]) {
    for (const key of ['verdict.finalNumberTitle', 'verdict.finalNumberBody', 'verdict.finalNumberWorking', 'verdict.moveToWorking', 'verdict.workingLabel', 'verdict.workingMethodMarks', 'verdict.workingAreaPlaceholder', 'verdict.finalAnswer']) {
      ok(typeof cat[key] === 'string' && cat[key].trim(), `catalogue has ${key}`);
    }
    ok(cat['verdict.workingMethodMarks'].includes('{marks}'), 'the method-marks line names the marks');
  }
  ok(/number/.test(en['verdict.finalNumberTitle']) && /5\/8/.test(en['verdict.finalNumberBody']) && /Working/.test(en['verdict.finalNumberWorking']),
    'the message is specific: a number, a neutral format example, and where working goes');
  ok(/method marks?/.test(en['verdict.workingMethodMarks']), 'the working area says plainly that working earns method marks');
}

// ── 4 · The mounted fields ───────────────────────────────────────────────────
{
  const { createServer } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const server = await createServer({
    root, configFile: false, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
    plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
  });
  try {
    const i18n = await server.ssrLoadModule('/src/i18n/index.js');
    await i18n.setLanguage('en');
    const { default: TypedAnswerFields } = await server.ssrLoadModule('/src/components/TypedAnswerFields.jsx');
    const guide = await server.ssrLoadModule('/src/components/typedAnswerGuide.js');
    const noop = () => {};
    const render = (props = {}) => {
      const question = props.question || publicQ;
      const totalMarks = props.totalMarks ?? 3;
      const answer = props.answer ?? '';
      return renderToStaticMarkup(React.createElement(TypedAnswerFields, {
        question, totalMarks, answer, working: '', onAnswer: noop, onWorking: noop, onSubmit: noop, onToggleWorking: noop, onMoveToWorking: noop,
        guidance: guide.finalAnswerGuidance({ question, answer, totalMarks, rejected: props.rejected }), ...props
      }));
    };
    const tag = (html, attr, name = '[a-z]+') => new RegExp(`<${name}[^>]*${attr}[^>]*>`).exec(html)?.[0] || '';

    const fresh = render();
    const finalInput = tag(fresh, 'data-final-answer=', 'input');
    const finalId = /\sid="([^"]+)"/.exec(finalInput)?.[1];
    ok(finalInput && finalId, 'there is one final-answer input');
    ok(new RegExp(`<label[^>]*for="${finalId}"[^>]*>${en['verdict.finalAnswer']}</label>`).test(fresh), 'visibly labelled "Final answer"');
    ok(fresh.indexOf(en['verdict.finalAnswer']) < fresh.indexOf('data-final-answer='), 'with the label ahead of the field');
    const area = tag(fresh, 'data-working-area="open"', 'div');
    ok(area, 'a three-mark question with a rubric shows its working area without being asked');
    const workingBox = tag(fresh, 'data-typed-working=', 'textarea');
    const workingId = /\sid="([^"]+)"/.exec(workingBox)?.[1];
    ok(workingBox && new RegExp(`<label[^>]*for="${workingId}"[^>]*>${en['verdict.workingLabel']}</label>`).test(fresh), 'the working textarea is present and labelled "Working"');
    ok(fresh.includes(en['verdict.workingMethodMarks'].replace('{marks}', '3')), 'and states that verified steps earn method marks on this 3-mark question');
    ok(!/btn-disclose/.test(fresh), 'it is not hidden behind a disclosure');
    ok(fresh.indexOf('data-final-answer=') < fresh.indexOf('data-working-area'), 'the final answer comes first, the working below it');
    ok(!/data-final-answer-guidance/.test(fresh) && !/aria-invalid/.test(finalInput), 'an empty field shows no error');
    ok(!/343/.test(fresh), 'nothing rendered carries the answer');

    const typed = render({ answer: 'sqrt(2)/3', previewTex: '\\frac{\\sqrt{2}}{3}' });
    ok(/data-typed-preview/.test(typed) && typed.includes(en['verdict.readsAs']), 'what Pri read is shown for the final answer');
    ok(/value="sqrt\(2\)\/3"/.test(typed), 'beside exactly what was typed');

    const integral = render({ answer: '∫4x+3' });
    const note = /<div[^>]*data-final-answer-guidance[^>]*>[\s\S]*?<\/div>/.exec(integral)?.[0] || '';
    ok(/role="status"/.test(note), 'working in the final-answer field raises a status note');
    ok(integral.includes(en['verdict.finalNumberTitle']) && integral.includes(en['verdict.finalNumberBody']) && integral.includes(en['verdict.finalNumberWorking']),
      'which says the answer is a number, shows a format, and points to the working box');
    ok(!integral.includes('couldn') && !/typos/.test(integral), 'not the generic unreadable message');
    ok(/value="∫4x\+3"/.test(integral), 'what was typed is still in the field');
    ok(/aria-invalid="true"/.test(tag(integral, 'data-final-answer=', 'input')) && /aria-describedby="[^"]+"/.test(tag(integral, 'data-final-answer=', 'input')), 'and the field is tied to the note for assistive technology');
    ok(integral.includes(en['verdict.moveToWorking']) && /data-move-to-working/.test(integral), 'one control moves it to the working');
    ok(/data-working-area="open"/.test(integral), 'with the working area still on screen');

    const kept = render({ answer: '5', working: 'x = 0, x = 7\n∫_0^7 (7x - x^2) dx' });
    ok(/x = 0, x = 7\n∫_0\^7 \(7x - x\^2\) dx<\/textarea>/.test(kept), 'working passed back in is shown as written');

    const oneMark = render({ totalMarks: 1 });
    ok(/data-working-area="toggle"/.test(oneMark) && /btn-disclose/.test(oneMark) && oneMark.includes(en['verdict.showWorkingToggle']), 'a one-mark question keeps one labelled working control');
    ok(!/data-typed-working/.test(oneMark), 'closed until asked');
    ok(/data-typed-working/.test(render({ totalMarks: 1, showWorking: true })), 'and open once asked');
    const none = render({ question: { ...publicQ, supportsSteps: false } });
    ok(!/data-working-area/.test(none) && !/data-typed-working/.test(none), 'a question without a rubric offers no working box');
    ok(none.includes(en['verdict.finalAnswer']), 'but still labels its final answer');
    const photo = render({ offerWorking: false });
    ok(!/data-working-area/.test(photo), 'Photo mode keeps its own transcript and does not duplicate the working box');
    const done = render({ resolved: true, answer: '5' });
    ok(/disabled/.test(tag(done, 'data-final-answer=', 'input')) && !/data-working-area/.test(done), 'a marked answer is read-only');

    await i18n.setLanguage('hi');
    const hindi = render({ answer: '∫4x+3' });
    ok(hindi.includes(hi['verdict.finalAnswer']) && hindi.includes(hi['verdict.workingLabel']) && hindi.includes(hi['verdict.finalNumberTitle']), 'the fields and the guidance render in Hindi');
    await i18n.setLanguage('en');

    // ── 5 · Typed answer and working survive a remount ───────────────────────
    const drafts = await server.ssrLoadModule('/src/components/drafts.js');
    webStorage.clear();
    ok(drafts.saveDraft('question', 'q-area', { typed: '∫4x+3', working: 'x = 0, x = 7' }, { label: 'Application of Integrals' }), 'a typed answer and its working are written to the draft store');
    eq(drafts.readDraft('question', 'q-area'), { typed: '∫4x+3', working: 'x = 0, x = 7' }, 'and read back exactly — an unreadable final answer included');
    drafts.queueDraft('question', 'q-area', { typed: '', working: 'x = 0, x = 7\n∫4x+3' }, {});
    eq(drafts.readDraft('question', 'q-area')?.working, 'x = 0, x = 7\n∫4x+3', 'a queued edit is visible to the next read (reload, or an inline sign-in remount)');
    eq(drafts.readDraft('question', 'q-other'), null, 'drafts never cross questions');
    drafts.clearDraft('question', 'q-area');
    eq(drafts.readDraft('question', 'q-area'), null, 'and are cleared once the attempt is marked');
  } finally {
    await server.close();
  }
}

// ── 6 · QuestionCard wiring ──────────────────────────────────────────────────
{
  const card = read('src/components/QuestionCard.jsx');
  ok(/import TypedAnswerFields from '\.\/TypedAnswerFields\.jsx'/.test(card) && /<TypedAnswerFields/.test(card), 'the card renders the typed fields');
  ok(/answer=\{answer\} working=\{working\} onAnswer=\{editAnswer\} onWorking=\{editWorking\}/.test(card), 'through the draft-saving edit handlers');
  ok(/steps = \(workingOpen \|\| mode === 'photo'\) && working\.trim\(\) \? working : undefined/.test(card), 'an open working area is always part of the submission');
  ok(/const draft = readDraft\('question', question\.id\);\s*setAnswer\(draft\?\.typed \|\| ''\)/.test(card) && /setWorking\(draft\?\.working \|\| ''\)/.test(card), 'a remounted card restores the typed answer and working from the draft');
  const flip = /const flipMode = \(m\) => \{[\s\S]*?\n  \};/.exec(card)?.[0] || '';
  ok(flip && !/setAnswer\(|setWorking\(|clearDraft\(/.test(flip), 'changing between Type, Write and Photo never clears the typed answer, the working or their draft');
  ok(/stash\(moved\.answer, moved\.working\)/.test(card), 'moving text to the working is written to the draft in the same step');
  ok(/invalidRetry && answerGuidance/.test(card), 'an invalid numeric answer gets the specific message in the verdict too');
  const backend = read('src/local/backend.js');
  ok(/function stepMetaFor\(q\) \{\s*if \(q\.stepcheck\) return q\.stepcheck;/.test(backend), 'the device path marks working against the authored plan');
  // A server question (issued, prepared) and an offline draft are public
  // projections: the flag on them is the one computed where the rubric lives.
  ok(/supportsSteps: publicShaped\(row\) \? q\.supportsSteps === true : !!stepMetaFor\(q\)/.test(backend) &&
    /function draftQuestion\(q\) \{\s*return \{ \.\.\.publicQuestionFields\(q\), supportsSteps: !!stepMetaFor\(q\)/.test(backend), 'and reports supportsSteps only from a real rubric');
  const sanitize = /function sanitize\(q, row\) \{[\s\S]*?\n\}/.exec(backend)?.[0] || '';
  ok(sanitize && !/stepcheck|q\.answer\b|q\.steps\b/.test(sanitize.replace(/stepMetaFor\(q\)/g, '')), 'the device’s public question view never carries the plan, the key or the solution');
}

if (failures.length) {
  console.error(`TYPED ANSWER + WORKING: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error('  · ' + f);
  process.exit(1);
}
console.log(`TYPED ANSWER + WORKING: PASS — ${pass}/${pass} checks — a multi-mark area task has a labelled final answer, an open working area and a verified rubric behind it.`);
