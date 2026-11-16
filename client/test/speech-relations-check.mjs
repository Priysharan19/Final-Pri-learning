// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · every spelling of a relation is spoken
//
// Pri Explain narrates the board in words (client/src/explain/speech.js). A
// relation reaches it as a Unicode sign (≠) or as one of its LaTeX commands
// (\ne, \neq), and what the student hears must not depend on which spelling a
// generator wrote. It did: "x \ne 2", the spelling most generators use, was
// spoken "x 2" in English and in Hindi, so "Valid for $x \ne -12$" was heard
// as "Valid for x minus 12", while \neq and ≠ said "not equal to". \lt and \gt
// were dropped in English, \to, \rightarrow and \approx in both languages, and
// the \le, \pm and \cdot rules took the first letters of \left, \pmod and
// \cdots ("Simplify less than or equal to ft (…)").
//
// For every spelling, in English and in Hindi, this suite holds that:
//   1. the spoken line carries the relation's words;
//   2. every spelling of one relation is spoken exactly alike — \ne as \neq
//      and ≠ — in each context below, generator lines included, and the words
//      are there in each;
//   3. a longer command that begins with the same letters is never read as
//      the relation;
//   4. a relation inside a bracket keeps its Hindi words inside the bracket.
//
// The Hindi words await the native-speaker review (owner default D11).
//
// Usage: node client/test/speech-relations-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { speechText } from '../src/explain/speech.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(a === b, `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const LANGS = ['en', 'hi'];

// The words stand as words: at the ends of the line or between spaces and
// punctuation, never inside a longer word. \b knows nothing of Devanagari, so
// the boundary is written out.
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const says = (spoken, words) => new RegExp(`(?:^|[\\s,(])${escape(words)}(?=$|[\\s,.;)])`, 'u').test(spoken);

// ── 1 · Each spelling carries its relation's words ──────────────────────────
// [spelling, a line written with it, English words, Hindi words, English line, Hindi line]
const SPELLINGS = [
  ['\\ne', 'x \\ne 2', 'not equal to', 'के बराबर नहीं है', 'x not equal to 2', 'x, 2 के बराबर नहीं है'],
  ['\\neq', 'x \\neq 2', 'not equal to', 'के बराबर नहीं है', 'x not equal to 2', 'x, 2 के बराबर नहीं है'],
  ['\\le', 'x \\le 3', 'less than or equal to', 'से कम या बराबर है', 'x less than or equal to 3', 'x, 3 से कम या बराबर है'],
  ['\\leq', 'x \\leq 3', 'less than or equal to', 'से कम या बराबर है', 'x less than or equal to 3', 'x, 3 से कम या बराबर है'],
  ['\\ge', 'x \\ge 3', 'greater than or equal to', 'से अधिक या बराबर है', 'x greater than or equal to 3', 'x, 3 से अधिक या बराबर है'],
  ['\\geq', 'x \\geq 3', 'greater than or equal to', 'से अधिक या बराबर है', 'x greater than or equal to 3', 'x, 3 से अधिक या बराबर है'],
  ['\\lt', 'x \\lt 3', 'less than', 'से कम है', 'x less than 3', 'x, 3 से कम है'],
  ['\\gt', 'x \\gt 3', 'greater than', 'से अधिक है', 'x greater than 3', 'x, 3 से अधिक है'],
  ['\\to', 'x \\to 0', 'to', 'की ओर', 'x to 0', 'x, 0 की ओर'],
  ['\\rightarrow', 'x \\rightarrow 0', 'to', 'की ओर', 'x to 0', 'x, 0 की ओर'],
  ['\\approx', '\\pi \\approx 3.14', 'approximately equals', 'लगभग बराबर', 'pi approximately equals 3.14', 'पाई लगभग बराबर 3.14'],
  ['\\pm', 'x = \\pm 2', 'plus or minus', 'धन या ऋण', 'x equals plus or minus 2', 'x बराबर धन या ऋण 2'],
  ['\\times', '2 \\times 3', 'times', 'गुणा', '2 times 3', '2 गुणा 3'],
  ['\\div', '6 \\div 2', 'divided by', 'भाग', '6 divided by 2', '6 भाग 2'],
  ['\\cdot', '2 \\cdot 3', 'times', 'गुणा', '2 times 3', '2 गुणा 3']
];
for (const [spelling, line, en, hi, enLine, hiLine] of SPELLINGS) {
  const spokenEn = speechText(line, 'en');
  const spokenHi = speechText(line, 'hi');
  ok(says(spokenEn, en), `English says "${en}" for ${spelling} — got ${JSON.stringify(spokenEn)}`);
  ok(says(spokenHi, hi), `Hindi says "${hi}" for ${spelling} — got ${JSON.stringify(spokenHi)}`);
  eq(spokenEn, enLine, `English speaks "${line}"`);
  eq(spokenHi, hiLine, `Hindi speaks "${line}"`);
}

// The generator line that was heard as "x minus 12" (generators/year9.js).
eq(speechText('Valid for $x \\ne -12$', 'en'), 'Valid for x not equal to minus 12', 'English: a restriction written with \\ne is not heard as a subtraction');
eq(speechText('Valid for $x \\ne -12$', 'hi'), 'Valid for x, ऋण 12 के बराबर नहीं है', 'Hindi: a restriction written with \\ne is not heard as a subtraction');

// ── 2 · Every spelling of a relation is spoken alike, words included ────────
// '#' marks the relation. The contexts are written the way generators write
// them: spaced and unspaced, after a power, a fraction or a bracket, inside
// $…$, and with prose on either side.
const ALIKE = [
  [['≠', '\\ne', '\\neq'], 'not equal to', 'के बराबर नहीं है'],
  [['≤', '\\le', '\\leq'], 'less than or equal to', 'से कम या बराबर है'],
  [['≥', '\\ge', '\\geq'], 'greater than or equal to', 'से अधिक या बराबर है'],
  [['<', '\\lt'], 'less than', 'से कम है'],
  [['>', '\\gt'], 'greater than', 'से अधिक है'],
  [['\\to', '\\rightarrow'], 'to', 'की ओर'],
  [['≈', '\\approx'], 'approximately equals', 'लगभग बराबर'],
  [['±', '\\pm'], 'plus or minus', 'धन या ऋण'],
  [['×', '\\times', '\\cdot'], 'times', 'गुणा'],
  [['÷', '\\div'], 'divided by', 'भाग']
];
const CONTEXTS = [
  'x # 2',
  'q#0', // class8-rational-numbers.js: $q\ne0$
  'x^2 # 4',
  '\\frac{1}{x} # 0',
  'Valid for $x # -12$', // year9.js
  '$P(A) # P(B)$', // year10.js
  '$P(2) = 5 # 0$', // year11.js
  '$2-5#5-2$', // class8-rational-numbers.js
  'so x − 3 # 0, hence'
];
for (const [[canonical, ...others], en, hi] of ALIKE) {
  for (const context of CONTEXTS) {
    for (const lang of LANGS) {
      const words = lang === 'en' ? en : hi;
      const want = speechText(context.replaceAll('#', canonical), lang);
      ok(says(want, words), `${lang}: ${canonical} in "${context}" says "${words}" — got ${JSON.stringify(want)}`);
      for (const other of others) {
        eq(speechText(context.replaceAll('#', other), lang), want, `${lang}: ${other} is spoken as ${canonical} in "${context}"`);
      }
    }
  }
}

// ── 3 · A longer command is not the relation it begins with ────────────────
// [line, the shorter command it begins with, words that must not be heard]
const LONGER = [
  ['Simplify $\\left(4x^{2}y^{3}\\right)^{2}$.', '\\le', /less than|से कम/],
  ['$\\theta = \\tan^{-1}\\left(\\dfrac{15}{16}\\right)$', '\\le', /less than|से कम/],
  ['$6 \\times 5 \\times 4 \\times \\cdots \\times 1$', '\\cdot', /times times s|गुणा गुणा s|(?:^|\s)s(?:\s|$)/],
  ['$1 + 2 + \\cdots + n$', '\\cdot', /times|गुणा/],
  ['Compute $7^k \\pmod{9}$', '\\pm', /plus or minus|धन या ऋण/],
  ['$\\neg p$', '\\ne', /not equal|बराबर नहीं/],
  ['$\\top$', '\\to', /(?:^|\s)to(?:\s|$)|की ओर/],
  ['$a \\gets b$', '\\ge', /greater than|से अधिक/]
];
for (const [line, shorter, heard] of LONGER) {
  for (const lang of LANGS) {
    const spoken = speechText(line, lang);
    ok(!heard.test(spoken), `${lang}: "${line}" is not read as ${shorter} — got ${JSON.stringify(spoken)}`);
  }
}

// ── 4 · Inside a bracket, the words stay inside it ──────────────────────────
// Hindi puts a relation's words after its right-hand side. Inside a bracket
// that side ends at the bracket: the words for "\lim_{x \to 0} f(x)" belong
// to "0", and must not drift past f(x), which would say that x tends to f(x).
ok(/x, 0 की ओर f\(x\)/.test(speechText('\\lim_{x \\to 0} f(x)', 'hi')), `Hindi: a limit's arrow is said before the function — got ${JSON.stringify(speechText('\\lim_{x \\to 0} f(x)', 'hi'))}`);
ok(/P\(X, 2 से कम या बराबर है\s*\)/.test(speechText('$P(X \\le 2)$', 'hi')), `Hindi: a probability's relation stays inside its bracket — got ${JSON.stringify(speechText('$P(X \\le 2)$', 'hi'))}`);
eq(speechText('$P(X \\le 2)$', 'en'), 'P(X less than or equal to 2)', 'English: unchanged, the relation read in place');
ok(/x, 0 की ओर/.test(speechText('$\\displaystyle\\lim_{x \\to 0} \\dfrac{\\sin kx}{kx} = 1$', 'hi')) && !/sin की ओर/.test(speechText('$\\displaystyle\\lim_{x \\to 0} \\dfrac{\\sin kx}{kx} = 1$', 'hi')),
  'Hindi: the standard limit keeps its arrow on x and 0, not on the fraction');

const total = pass + failures.length;
if (failures.length) {
  console.error(`SPEECH RELATIONS: FAIL — ${failures.length}/${total} checks failed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`SPEECH RELATIONS: PASS — ${pass}/${total} checks — ${SPELLINGS.length} spellings carry their words in English and Hindi, ${ALIKE.length} relations spoken alike in every spelling across ${CONTEXTS.length} contexts, ${LONGER.length} longer commands never read as a shorter relation, relations inside brackets keep their Hindi words there.`);
