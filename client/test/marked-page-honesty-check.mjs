// Pri Learning · the marked photo page says only what is true (owner's live page, 20 Nov 2026).
//
// Five defects were seen on a real marked photo: the outlines sat below their lines, the reason line said
// "couldn't read them as maths" for lines that WERE read, every ticked line repeated one caveat, the verdict
// and the marks printed twice, a missing-steps sentence read "steps 1. Antiderivative; 3. Subtract of the worked
// solution", and a worked solution printed 2/2 and a decimal with no exact value.
//
//   1. The drawing is exact (the tour measures it); the reader's box is its own estimate, so a photo is marked with
//      a bar at the line's left edge and vertical centre (markerOf), never a tight outline.
//   2. The reason is per line state: "couldn't read" only for lines the reader marked unreadable.
//   3. The caveat is said once; the score is not printed twice; the verdict is announced once.
//   4. The missing-steps phrase is natural, in both languages.
//   5. The worked solution's coefficients are in lowest terms with the exact value beside its rounding; the key is not touched.
import { readFileSync } from 'node:fs';
import { markerOf, MARKER_HEIGHT, boxesFromPhoto, buildMarkedPage, commentItems } from '../src/components/markedPageModel.js';
import { buildAnnotatedWorking } from '../src/components/annotatedWorkingModel.js';
import { missingStepsPhrase } from '../src/components/missingStepsCopy.js';
import { lookupString } from '../src/i18n/core.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { generateQuestion, loadAllBanks } from '../src/engine/generators/index.js';
import { r3, gcd } from '../src/engine/qhelpers.js';

let pass = 0; const fail = [];
const ok = (c, l) => { if (c) pass++; else fail.push(l); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)})`);
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const tEn = (k, v) => lookupString(en, k, v, 'en');
const tHi = (k, v) => lookupString(hi, k, v, 'hi');

// ── 1. a photo is marked at the line's left edge and vertical centre ──────────────
// The owner's page, as the production reader boxed it (fractions of the picture).
const READER = [
  { x: 0.142, y: 0.045, w: 0.309, h: 0.038 }, { x: 0.431, y: 0.112, w: 0.406, h: 0.049 }, { x: 0.508, y: 0.149, w: 0.299, h: 0.054 },
  { x: 0.488, y: 0.207, w: 0.322, h: 0.05 }, { x: 0.141, y: 0.23, w: 0.292, h: 0.06 }, { x: 0.114, y: 0.304, w: 0.616, h: 0.056 }
];
for (const b of READER) {
  const m = markerOf(b);
  ok(Math.abs(m.x - b.x) < 1e-12 && m.w === 0, 'the marker stands at the left edge of the reader\'s box');
  ok(Math.abs((m.y + m.h / 2) - (b.y + b.h / 2)) < 1e-9, 'the marker is centred on the box\'s vertical middle');
  ok(m.h === MARKER_HEIGHT && m.h < b.h + 0.001 + 0.03, 'the marker is a short bar, not the whole box');
}
const low = markerOf({ x: 0.1, y: 0.99, w: 0.3, h: 0.01 });
ok(low.y + low.h <= 1 && low.y >= 0, 'a marker never runs off the bottom of the page');
const geometry = boxesFromPhoto(READER.map((box, i) => ({ text: `line ${i}`, box })));
ok(geometry && geometry.boxes.length === READER.length, 'the reader\'s boxes still give the geometry the comments are levelled to');
{
  // the comments stay level with the reader's own centre: markers change the drawing, not the alignment
  const cards = READER.map((_, i) => ({ n: i + 1, status: 'checked', valueChain: 'arithmetic', note: null, text: `l${i}` }));
  const page = buildMarkedPage({ model: { cards, marks: null, allChecked: true }, boxes: geometry.boxes });
  const items = commentItems(page);
  ok(items.every((it, i) => Math.abs(it.y - (READER[i].y + READER[i].h / 2)) < 1e-9), 'each comment is level with the centre of its line\'s box');
}
const sheet = read('../src/components/MarkedPage.jsx');
ok(/const approx = source\.kind === 'photo'/.test(sheet) && /approx \? markerOf\(l\.box\) : l\.box/.test(sheet) && /className=\{`mp-marker is-\$\{l\.status\}/.test(sheet),
  'the sheet draws a photo with markerOf and ink with its own measured boxes');
ok(/\.mp-marker \{ position: absolute;/.test(read('../src/components/MarkedPage.css')) && !/\.mp-box/.test(read('../src/components/MarkedPage.css')), 'the approximate marker is a small button in the margin, never an outline');
ok(tEn('mp.photoNote').length > 10 && tHi('mp.photoNote').length > 10 && !/—/.test(tEn('mp.photoNote') + tHi('mp.photoNote')), 'the page says the markers are approximate, in both languages');

// ── 2. the reason is per line state ──────────────────────────────────────────────
const card = (n, status, extra = {}) => ({ n, status, valueChain: status === 'not-verified' ? 'unverified' : status, note: null, text: `l${n}`, ...extra });
{
  // the owner's page: a definition, an equation, a bare value, and an unreadable line
  const cards = [card(1, 'not-verified'), card(2, 'not-verified'), card(3, 'checked'), card(4, 'unread'), card(5, 'not-verified')];
  const page = buildMarkedPage({ model: { cards, marks: null, allChecked: false } });
  eq(page.collapsed.lines, [1, 2, 4, 5], 'the unchecked lines are one card');
  eq(page.collapsed.unread, [4], 'only the line the reader could not read is called unread');
  const jsx = sheet;
  ok(/status === 'not-verified'\) \{[\s\S]{0,160}?t\('mp\.collapsed', \{ count: 1, list: String\(n\) \}\)/.test(jsx),
    'the "read but nothing to check" sentence names only the lines that were read');
  ok(/status === 'unread'\) \{[\s\S]{0,160}?t\('mp\.unread', \{ count: 1, list: String\(n\) \}\)/.test(jsx), 'the "could not read" sentence names only the unread lines');
}
const readButUnchecked = [tEn('mp.collapsed', { count: 1, list: '1' }), tEn('mp.collapsed', { count: 3, list: '1, 2, 7' }), tHi('mp.collapsed', { count: 1, list: '1' }), tHi('mp.collapsed', { count: 3, list: '1, 2, 7' })];
ok(readButUnchecked.every(s => !/couldn.t read|could not read|पढ़ नहीं सका/.test(s)), `a line that was read is never said to be unreadable (${readButUnchecked[1]})`);
ok(/read/i.test(tEn('mp.collapsed', { count: 3, list: '1, 2, 7' })) && /पढ़ा/.test(tHi('mp.collapsed', { count: 3, list: '1, 2, 7' })), 'it says Pri read them');
ok(/couldn.t read/.test(tEn('mp.unread', { count: 1, list: '4' })) && /पढ़ नहीं सका/.test(tHi('mp.unread', { count: 1, list: '4' })), 'the unreadable sentence still says it, for unreadable lines');
eq(tEn('mp.collapsed', { count: 3, list: '1, 2, 7' }), 'Lines 1, 2, 7 weren’t checked: Pri read them, but they state nothing Pri can check on their own.', 'the owner\'s page reads truthfully');

// ── 3. said once ────────────────────────────────────────────────────────────────
const aw = read('../src/components/AnnotatedWorking.jsx');
ok(!/valueChain === 'arithmetic'\) return <p>.*t\('aw\.body\.arithmetic'\)/.test(aw), 'a ticked line\'s card no longer repeats "true as written, not checked to be the right step"');
ok((aw.match(/data-aw-arithmetic-once/g) || []).length === 1 && /<\/ol>\s*\n?\s*\{\/\* said once for the list/.test(aw), 'where the list of cards is shown the caveat follows it once, after the last card');
const qc = read('../src/components/QuestionCard.jsx');
ok(/part=\{writeMode \|\| photoPageOn \? 'evaluation' : 'both'\}/.test(qc), 'a marked photo page does not list every line a second time as cards');
ok(/data-verdict-announcement/.test(qc) && /resolved && serverAuthoritative && statusText/.test(qc), 'the status line announces the verdict once, for a screen reader, and does not print it again');
ok((qc.match(/scoreShown=\{instrumentScore\}/g) || []).length === 2, 'both marked pages (photo and ink) are told when the score card already shows the figure');
ok(/mark && scoreShown && finalWrong/.test(sheet) && /mark && !scoreShown && full/.test(sheet) && /mark && !scoreShown && !full/.test(sheet), 'with the score card shown the marked page does not print the marks again');
ok(/mp\.mark\.finalWrongNote/.test(sheet) && !/\d|\{earned\}|\{possible\}/.test(tEn('mp.mark.finalWrongNote') + tHi('mp.mark.finalWrongNote')), 'what the card does not say (marked on the final answer) is still said, without the figure');
ok(tEn('verdict.workingArithmetic', { count: 4, checked: '3, 4, 5, 6', n: 4 }) === 'Lines 3, 4, 5, 6 of your working are true as written. Pri has not checked that your lines are the right steps for this question.', 'the page summary still carries the caveat, once');

// ── 4. the missing-steps sentence ────────────────────────────────────────────────
const M1 = [{ step: 1, heading: 'Antiderivative' }], M2 = [{ step: 1, heading: 'Antiderivative' }, { step: 3, heading: 'Subtract' }], M3 = [...M2, { step: 4, heading: 'Round' }];
const sentence = (m, t, lang, strings) => t('verdict.workingMissing', { count: m.length, n: m.length, steps: missingStepsPhrase(m, t, lang) });
eq(sentence(M2, tEn, 'en').split('. If')[0], 'Not found in your working: step 1 (Antiderivative) and step 3 (Subtract) of the worked solution', 'two steps join with "and"');
eq(sentence(M1, tEn, 'en').split('. If')[0], 'Not found in your working: step 1 (Antiderivative) of the worked solution', 'one step is singular');
eq(sentence(M3, tEn, 'en').split('. If')[0], 'Not found in your working: step 1 (Antiderivative), step 3 (Subtract), and step 4 (Round) of the worked solution', 'three steps are a list');
ok(/same values/.test(sentence(M2, tEn, 'en')) && /same value\./.test(sentence(M1, tEn, 'en')), 'the second sentence agrees in number');
ok(!/[;]|\d\. [A-Z]/.test(sentence(M2, tEn, 'en')) && !/[;]|\d\. [A-Z]/.test(sentence(M3, tHi, 'hi')), 'no "1. Heading;" fragments');
ok(/चरण 1 \(Antiderivative\) और चरण 3 \(Subtract\)/.test(sentence(M2, tHi, 'hi')), `Hindi joins with "और" (${sentence(M2, tHi, 'hi')})`);
ok(/Not found/.test(tEn('verdict.workingMissing', { count: 2, steps: 'x' })) && /another method/.test(JSON.stringify(en['verdict.workingMissing'])), 'it still allows another method');
ok(!/—/.test(JSON.stringify([en['verdict.workingMissing'], en['verdict.workingMissing.step'], hi['verdict.workingMissing'], hi['verdict.workingMissing.step'], en['mp.collapsed'], hi['mp.collapsed']])), 'no em dashes in the new copy');
eq(missingStepsPhrase([], tEn, 'en'), '', 'no missing steps, no phrase');

// ── 5. the worked solution ───────────────────────────────────────────────────────
await loadAllBanks();
let seen = 0, exactShown = 0, unsimplified = 0, keyMoved = 0;
for (let seed = 1; seed <= 400; seed++) {
  const q = generateQuestion('y12-integration', 2, seed);
  const m = q && /^Evaluate \$\\displaystyle\\int_\{0\}\^\{(\d)\} \((.+)\)\\,dx\$/.exec(q.prompt);
  if (!m) continue;
  seen++;
  // every "\dfrac{n}{d}" is in lowest terms and never an integer written as a fraction
  for (const st of q.steps) for (const f of st.d.matchAll(/\\dfrac\{(\d+)\}\{(\d+)\}/g)) if (gcd(+f[1], +f[2]) !== 1 || +f[2] === 1) unsimplified++;
  // the key is what the formula says it is, as before (steps never feed it)
  const hi_ = +m[1];
  const exactCoeffs = /^(?:(\d*)x\^2) ([+-]) (\d*)x$/.exec(m[2].replace(/\s+/g, ' '));
  if (exactCoeffs) {
    const a = +(exactCoeffs[1] || 1), b = (exactCoeffs[2] === '-' ? -1 : 1) * +(exactCoeffs[3] || 1);
    if (q.answer.value !== r3(a * hi_ ** 3 / 3 + b * hi_ ** 2 / 2) || q.answer.tol !== 0.002) keyMoved++;
  }
  if (Number.isInteger(q.answer.value) || /\\approx|=\s*-?\d+\.\d+/.test(q.steps[2].d)) exactShown++;
}
ok(seen >= 20, `the sweep reached the integral family (${seen} draws)`);
eq(unsimplified, 0, 'no printed fraction is unsimplified or a whole number (no 2/2)');
eq(keyMoved, 0, 'the answer key and tolerance are what the formula gives');
ok(exactShown === seen, 'every step line shows the exact value with its rounding');
{
  // the owner's question: the integral of x^2 - 2x from 0 to 1
  let owner = null;
  for (let seed = 1; seed <= 4000 && !owner; seed++) { const q = generateQuestion('y12-integration', 2, seed); if (q && q.prompt.includes('\\int_{0}^{1} (x^2 - 2x)')) owner = q; }
  ok(!!owner, 'the owner\'s question is drawn by some seed');
  if (owner) {
    eq(owner.answer, { value: -0.667, tol: 0.002 }, 'its key is unchanged');
    eq(owner.steps.map(s => s.d), [
      '$F(x) = \\dfrac{1}{3}x^3 - x^2$',
      '$F(1) = -\\dfrac{2}{3} \\approx -0.667, \\quad F(0) = 0$',
      '$-\\dfrac{2}{3} - 0 = -\\dfrac{2}{3} \\approx -0.667$'
    ], 'F(x) = (1/3)x^3 - x^2 and F(1) = -2/3 ≈ -0.667');
  }
}

// ── 6. the Evaluation block follows the real line states (owner's live page, 20 Nov 2026) ─────────────
// It said "Every step was checked by Pri's engine" and "Every line was checked; 0 named rules were found" over eight lines
// not one of which was checked.
{
  const L = (text, status, extra = {}) => ({ text, status, ...extra });
  const none = buildAnnotatedWorking({ lines: ['a = 1', 'b = 2', 'c = 3'], stepReport: { lines: [L('a = 1', 'note'), L('b = 2', 'note'), L('c = 3', 'note')], firstBreak: -1 } });
  ok(none && none.noneChecked === true && none.allChecked === false && none.summary.key === 'aw.summary.none', 'nothing checked: the summary says none were checked');
  const some = buildAnnotatedWorking({ lines: ['2x + 4', '2(x + 2)', 'y'], stepReport: { lines: [L('2x + 4', 'ok'), L('2(x + 2)', 'ok'), L('y', 'note')], firstBreak: -1 } });
  ok(some && some.allChecked === false && some.summary.key === 'aw.summary.some' && some.summary.vars.checked === 2 && some.summary.vars.total === 3, 'some lines checked: "N of M lines checked", never "every line"');
  const all = buildAnnotatedWorking({ lines: ['2x + 4', '2(x + 2)'], stepReport: { lines: [L('2x + 4', 'ok'), L('2(x + 2)', 'ok')], firstBreak: -1 } });
  ok(all && all.allChecked === true && !all.noneChecked, 'every line checked: allChecked');
  ok(all && (all.summary.key === 'aw.summary.allCheckedPlain' ? all.summary.vars.rules === 0 : all.summary.vars.rules > 0), 'with no named rule the sentence about named rules is dropped');
  // the value-chain model: nothing checked
  const vc = buildAnnotatedWorking({ lines: ['a', 'b'], stepReport: { source: 'value-chain', lines: [L('a', 'note', { state: 'unverified' }), L('b', 'note', { state: 'unverified' })], firstBreak: -1, summary: {} } });
  ok(vc && vc.noneChecked === true && vc.allChecked === false && vc.summary.key === 'aw.summary.none', 'a value-chain report with nothing checked says so');
  const folded = buildAnnotatedWorking({ lines: ['a', 'b'], stepReport: { source: 'value-chain', folded: true, lines: [L('a', 'note', { state: 'unverified' }), L('b', 'ok', { state: 'arithmetic' })], firstBreak: -1, summary: {} } });
  ok(folded && folded.noneChecked === false && folded.allChecked === false && folded.summary.key === 'aw.summary.some', 'a folded report with one true-as-written line: some checked');
  for (const k of ['aw.summary.none', 'aw.summary.allCheckedPlain', 'aw.summary.proofDirectPlain', 'aw.summary.proofMeetPlain', 'aw.eval.provenanceNone', 'aw.eval.provenanceNoneInk']) {
    ok(typeof en[k] === 'string' && typeof hi[k] === 'string' && hi[k] !== en[k], `${k} in English and Hindi`);
    ok(!/[—–]/.test(en[k]) && !/[—–]/.test(hi[k]) && !/\b0 named|named rules? (?:was|were) found/.test(en[k]), `${k}: no dash, no "0 named rules"`);
  }
  ok(/\{total\}/.test(en['aw.summary.none']) && /\{total\}/.test(hi['aw.summary.none']), 'the none sentence carries the line count');
  // every tick only "true as written": the headline says that, never "checked"
  const arith = buildAnnotatedWorking({ lines: ['2 + 2 = 4', '3 × 4 = 12'], stepReport: { source: 'value-chain', arithmetic: true, lines: [L('2 + 2 = 4', 'ok', { state: 'arithmetic' }), L('3 × 4 = 12', 'ok', { state: 'arithmetic' })], firstBreak: -1, summary: {} } });
  ok(arith && arith.onlyArithmetic === true && arith.summary.key === 'aw.summary.arithmeticAll', 'only true-as-written ticks: the summary says so');
  ok(folded && folded.onlyArithmetic === false, 'a mixed page is not "only true as written"');
  const given = buildAnnotatedWorking({ lines: ['a', 'b'], stepReport: { source: 'value-chain', lines: [L('a', 'ok', { state: 'given' }), L('b', 'ok', { state: 'verified' })], firstBreak: -1, summary: {} } });
  ok(given && given.onlyArithmetic === false && given.summary.key === 'aw.summary.valueAll', 'given and verified lines keep the "checked" headline');
  ok(buildMarkedPage({ model: { ...arith, marks: null } }).header.parts[0].key === 'mp.head.arithmetic' && buildMarkedPage({ model: { ...arith, marks: null } }).header.everyLine === false, 'the marked page header does not say every line was checked');
  for (const k of ['aw.summary.arithmeticAll', 'aw.eval.provenanceArithmetic', 'aw.eval.provenanceArithmeticInk', 'mp.head.arithmetic']) {
    ok(typeof en[k] === 'string' && typeof hi[k] === 'string' && hi[k] !== en[k] && !/[—–]/.test(en[k] + hi[k]) && !/every (?:step|line) was checked/i.test(en[k]), `${k} in English and Hindi, no dash, no "checked" headline`);
  }
  ok(/true as written/.test(en['aw.summary.arithmeticAll']) && /right steps/.test(en['aw.summary.arithmeticAll']), 'the headline says what is true and what was not checked');
  const comp = read('../src/components/AnnotatedWorking.jsx');
  ok(/model\.noneChecked \? \(source === 'handwriting' \? 'aw\.eval\.provenanceNoneInk' : 'aw\.eval\.provenanceNone'\)/.test(comp), 'the provenance sentence is the none sentence when nothing was checked');
  // the score card: each figure once visually, one announcement
  const card = read('../src/components/QuestionCard.jsx');
  ok(/<div className="eval-head" aria-hidden=\{instrumentScore \? 'true' : undefined\}>/.test(card), 'with the score card the head is hidden from assistive tech (the card itself is aria-hidden too)');
  ok(/data-verdict-announcement>\{statusText\}\{instrumentScore \?/.test(card) && (card.match(/data-verdict-announcement/g) || []).length === 1, 'one screen-reader announcement, with the marks');
}

if (fail.length) { console.error(fail.map(f => `  · ${f}`).join('\n')); console.error(`MARKED PAGE HONESTY: FAIL (${fail.length} of ${pass + fail.length})`); process.exit(1); }
console.log(`MARKED PAGE HONESTY: PASS — ${pass}/${pass} checks — photo markers are approximate, the reason is per line state, the caveat and the score are said once, the missing-steps sentence reads naturally (en, hi), and the worked solution prints lowest terms with its exact value`);
