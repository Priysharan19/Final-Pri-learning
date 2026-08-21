// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Engine self-check
//
// Every generated question is put in front of the same marker a student meets,
// and has to survive it. A question that fails here is one a student would have
// been marked wrongly on, so this suite is the last gate before the bank ships.
//
// What it asserts, and why each one is here — every check below was written
// against a defect that reached production while this suite passed 10,080/10,080:
//
//   · payload shape — prompt, answer, steps, hints, MCQ options all present;
//   · text hygiene — no unexpanded template, no NaN, no Infinity, no leaked
//     `undefined` (told apart from the ordinary English word, which a prompt
//     about domains and vertical gradients has every right to use);
//   · the answer key ROUND-TRIPS — every form the question declares its answer
//     in is fed back through the real checkAnswer and must come back correct.
//     A key the marker itself rejects is the worst defect this suite can catch,
//     because the student is right and the app says otherwise;
//   · MCQ integrity — options distinct after trimming, no option other than the
//     keyed one repeating the keyed text, a keyed index that exists, no
//     misconception note attached to the right answer, and — where the prompt
//     makes a claim this file can test against the engine's own parser — no
//     distractor that is quietly TRUE;
//   · counts are whole numbers — "How many songs are still unplayed?" has no
//     answer of 33⅓;
//   · no floating-point artefact is keyed or printed — 4.8100000000000005 and
//     3045.3333333333335 are arithmetic showing through, not answers.
//
// ── Sample size ──────────────────────────────────────────────────────────────
//
// The old fixed 30 draws a cell is why several of the defects above shipped: a
// defect firing on 0.6% of a cell's seeds survives 30 draws 83% of the time,
// and one firing on 5.76% survives 17% of the time. A gate that blind is not a
// gate, it is a coin toss.
//
//   draws a cell   a 0.6% defect is seen   a 5.76% defect is seen   runtime
//        30                 16.5%                    83.1%           0.2 s
//       200                 70.1%                   100.0%           0.7 s
//      2000  ← default     100.0%                   100.0%           6.0 s
//     10000  --thorough    100.0%                   100.0%          30.0 s
//
// The default is 2000. It was NOT split into a fast default and a slow CI mode,
// because the split would buy nothing: the rest of `npm test` runs the ink
// suites, which take minutes, so 6 seconds is a rounding error on the chain and
// a fast default would only mean CI and a developer's terminal disagreeing
// about what passing means. `--thorough` is there for a pre-release soak, where
// 10,000 draws reaches a defect firing on 3 seeds in 10,000; `--quick` is for
// the edit loop while working inside one bank. Runtime prints on every run, so
// raising N later is a decision made with the number in front of you.
//
// Usage:
//   node server/test/selfcheck.mjs [subtopicFilter] [n]
//   node server/test/selfcheck.mjs --quick | --thorough | --n=5000
//   SELFCHECK_N=5000 node server/test/selfcheck.mjs
//
// Seeds are unchanged from the 30-draw era — draw i of a cell is the seed it
// always was — so every question this suite used to sample it still samples.
// ─────────────────────────────────────────────────────────────────────────────

// The generators come from the server registry, which layers the 84 server-only
// extra forms over the client's banks; the marker comes straight from the
// client, because the client's checker IS the marker a student is graded by and
// naming it here leaves no doubt about which function the round-trip used.
import { GENERATORS, generateQuestion } from '../engine/generators/index.js';
import { MULTIPART, generateMultipart } from '../engine/generators/multipart.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { parse, evaluate } from '../../client/src/engine/expr.js';
import { pathToFileURL } from 'node:url';

// ── Command line ─────────────────────────────────────────────────────────────

const DRAWS = { quick: 200, default: 2000, thorough: 10000 };

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const positional = argv.filter(a => !a.startsWith('--'));

const mode = flags.has('--thorough') ? 'thorough' : flags.has('--quick') ? 'quick' : 'default';
const flagN = argv.map(a => a.match(/^--n=(\d+)$/)).find(Boolean)?.[1];
const asked = flagN ?? positional[1] ?? process.env.SELFCHECK_N;

const filter = positional[0] || '';
const N = Number(asked ?? DRAWS[mode]);

if (!Number.isInteger(N) || N < 1) {
  console.log(`selfcheck: draws per cell must be a whole number of at least 1 — got "${asked}"`);
  process.exit(2);
}

// ── Text hygiene ─────────────────────────────────────────────────────────────

/** An interpolation that never ran, or a value that arrived as an object. */
const TEMPLATE_LEAK = /\$\{|\{\{|<%|\[object Object\]/;

/** Case-sensitive and word-bounded: the maths word "infinity" is fine in prose;
 *  the JavaScript value `Infinity` is not, and neither is `NaN`. */
const NUMERIC_LEAK = /\b(?:NaN|Infinity)\b/;

/**
 * `undefined` is BOTH a JavaScript leak and an ordinary English word: "the
 * gradient of a vertical line is undefined" is a sentence a maths prompt is
 * entitled to contain, and the old check failed it. The two are told apart by
 * where the word sits rather than by the word itself.
 *
 * A leak lands in a value slot — inside a $…$ maths span, or hard against an
 * interpolation neighbour: a bracket, an operator, an equals sign or a digit.
 * The English word sits in prose, between letters and sentence punctuation, so
 * "is undefined." and "is undefined, so the line is vertical" both read clean.
 */
const VALUE_SLOT = /[$={}()[\]+\-*/^]|\d/;

function leakedUndefined(text) {
  const s = String(text);
  for (const m of s.matchAll(/undefined/g)) {
    const before = s.slice(0, m.index).replace(/\s+$/, '').slice(-1);
    const after = s.slice(m.index + 'undefined'.length).replace(/^\s+/, '').slice(0, 1);
    if (VALUE_SLOT.test(before) || VALUE_SLOT.test(after)) return true;
    // Unescaped dollars before this point: an odd count means we are inside a
    // maths span, where a bare `undefined` is never prose.
    const dollars = (s.slice(0, m.index).match(/(^|[^\\])\$/g) || []).length;
    if (dollars % 2 === 1) return true;
  }
  return false;
}

/** The reason a piece of rendered text is unfit to show a student, or null. */
function textProblem(text) {
  if (typeof text !== 'string') return null;
  if (TEMPLATE_LEAK.test(text)) return 'unexpanded template';
  if (NUMERIC_LEAK.test(text)) return 'NaN/Infinity';
  if (leakedUndefined(text)) return 'leaked undefined';
  const artefact = floatArtefact(text);
  if (artefact) return `floating-point artefact ${artefact}`;
  return null;
}

// ── Floating-point artefacts ─────────────────────────────────────────────────
//
// An IEEE double carries a shade under 16 decimal digits, so a printed number
// with 15 significant digits or more is not an authored value — it is binary
// arithmetic showing through: 4.8100000000000005, 220.00000000000003,
// 118.99999999999999. The second test catches the same thing in the shape the
// eye notices first, a long run of one repeated digit inside the fraction
// (…3333333333335). Both thresholds sit well clear of legitimate output:
// 0.0000001 written out from scientific notation is one significant digit and
// six zeros, and no authored decimal repeats a digit ten times.

const DECIMAL_LITERAL = /-?\d+\.\d+/g;
const ARTEFACT_SIG_DIGITS = 15;
const REPEATED_RUN = /(\d)\1{9,}/;

function significantDigits(literal) {
  const [whole, fraction] = literal.replace('-', '').split('.');
  return (whole + fraction).replace(/^0+/, '').length;
}

/** The first decimal literal in `text` that is an artefact, or null. */
function floatArtefact(text) {
  for (const literal of String(text).match(DECIMAL_LITERAL) || []) {
    if (significantDigits(literal) >= ARTEFACT_SIG_DIGITS) return literal;
    if (REPEATED_RUN.test(literal.split('.')[1])) return literal;
  }
  return null;
}

/**
 * Does the answer declare an exact form? `value` is then only the decimal
 * shadow of something exact — 3/7 keyed as a simplest fraction is stored as
 * 0.42857142857142855, and that is correct, not an artefact. A tolerance is the
 * same declaration by another route: it says out loud that the value is an
 * approximation, so its decimal expansion is not the question's business.
 */
function declaresExactForm(answer) {
  return Boolean(
    answer.simplestFraction || answer.surdForm || answer.requireExact ||
    answer.canonicalInput !== undefined || answer.tol !== undefined
  );
}

// ── Counts are whole numbers ─────────────────────────────────────────────────
//
// "How many songs are still unplayed?" cannot be answered 33⅓ — but "How many
// litres does the tank hold?" can, and so can "the mean number of pets per
// household". Countness is therefore read off three things the question itself
// says, and a question has to clear all three before its answer is required to
// be an integer:
//
//   1. the ask — the prompt puts "how many <noun>" to the student, or tells
//      them to find the number of something. A descriptive "the histogram shows
//      the number of nights away" is not an ask and is not read as one;
//   2. the noun — a unit of measurement names a quantity, not a tally. The head
//      noun is taken after skipping qualifiers ("how many **different**
//      arrangements"), and a question whose answerSuffix is a unit is a
//      measurement whatever its noun says;
//   3. the ask is not an average, a summary statistic, a rate or an expectation
//      — "mean", "median", "expect", "per" and a request for decimal places all
//      licence a fractional answer to a whole-numbered thing. An expected number
//      of wins really is 2.1, and the median of 24 whole nights really is 8.5.
//
// An answer declaring an exact fraction or surd is left alone as well: keying
// 7/2 is a deliberate statement about the form the answer takes.

const UNITS = new Set([
  'm', 'metre', 'meter', 'cm', 'centimetre', 'mm', 'millimetre', 'km', 'kilometre', 'dm',
  'l', 'litre', 'liter', 'ml', 'millilitre', 'kl', 'kilolitre',
  'g', 'gram', 'kg', 'kilogram', 'mg', 't', 'tonne', 'ton',
  's', 'sec', 'second', 'ms', 'min', 'minute', 'h', 'hr', 'hour',
  'day', 'week', 'fortnight', 'month', 'year', 'decade',
  'degree', 'radian', 'dollar', 'cent', 'percent',
  'unit', 'square', 'cubic', 'kwh', 'joule', 'watt', 'newton', 'volt', 'amp'
]);

/** Words that stand between "how many" and the noun that is actually counted. */
const QUALIFIERS = new Set([
  'of', 'the', 'a', 'an', 'more', 'fewer', 'less', 'other', 'such', 'these', 'those',
  'different', 'distinct', 'possible', 'whole', 'total', 'extra', 'additional',
  'further', 'many', 'much', 'would', 'will', 'do', 'does', 'did', 'can', 'could'
]);

/** Phrases that make a fractional answer legitimate for a countable noun. */
const NOT_A_TALLY = new RegExp([
  '\\b(?:mean|average|averages|expect|expects|expected|per|rate|rates)\\b',
  '\\b(?:median|mode|modes|quartile|interquartile|percentile|range|deviation|variance)\\b',
  '\\b(?:decimal place|significant figure|nearest tenth|nearest hundredth)',
  '\\bapproximat'
].join('|'), 'i');

/**
 * The ask has to be put to the student. "How many …" always is; "the number of
 * …" only is when something tells the student to find it, which keeps the
 * descriptive clause of a data question out of the tally reading.
 */
const COUNT_ASK = /\bhow many\s+([^.?!,;:]{0,60})|\b(?:find|calculate|work out|determine|state|write down|give)\s+the\s+number of\s+([^.?!,;:]{0,60})/i;

const stripDecoration = s => String(s).replace(/[*_$\\]/g, ' ').replace(/[{}]/g, ' ').trim();
const singular = w => w.replace(/(?:es|s)$/, '') || w;

function isUnit(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  return UNITS.has(w) || UNITS.has(singular(w));
}

/** Does this question ask the student to count something? */
function asksForACount(q) {
  if (typeof q.prompt !== 'string') return false;
  if (NOT_A_TALLY.test(q.prompt)) return false;
  if (q.answerSuffix && isUnit(stripDecoration(q.answerSuffix).split(/[\s/]/)[0])) return false;
  const ask = q.prompt.match(COUNT_ASK);
  if (!ask) return false;
  const words = stripDecoration(ask[1] ?? ask[2]).split(/\s+/).filter(Boolean);
  const head = words.find(w => !QUALIFIERS.has(w.toLowerCase().replace(/[^a-z]/g, '')));
  if (!head) return false;
  return !isUnit(head);
}

// ── MCQ integrity ────────────────────────────────────────────────────────────

/**
 * A distractor is meant to be wrong. These checks fail a question where one is
 * not: an option repeating the keyed text renders identically to the answer and
 * is still marked wrong, and a claim-checkable option that is quietly true costs
 * the mark of any student who spots it.
 */
function mcqProblems(q) {
  const problems = [];
  const options = q.mcqOptions || [];
  const keyed = q.answer?.correctIndex;
  if (!Number.isInteger(keyed) || keyed < 0 || keyed >= options.length) {
    problems.push(`keyed index ${keyed} is not one of the ${options.length} options`);
    return problems;
  }
  // Two comparisons, because a student sees neither the trailing spaces the old
  // mcq() padded with nor the one inside "$0.6 $": whitespace is not a
  // difference between two options, it is a way of hiding that there isn't one.
  const trimmed = options.map(o => String(o).trim());
  const rendered = trimmed.map(o => o.replace(/\s+/g, ''));
  for (let i = 0; i < trimmed.length; i++) {
    for (let j = i + 1; j < trimmed.length; j++) {
      if (trimmed[i] === trimmed[j]) problems.push(`options ${i} and ${j} are the same text: "${trimmed[i]}"`);
      else if (rendered[i] === rendered[j]) problems.push(`options ${i} and ${j} differ only in whitespace, so they render identically: "${trimmed[i]}" / "${trimmed[j]}"`);
    }
  }
  for (let i = 0; i < trimmed.length; i++) {
    if (i !== keyed && rendered[i] === rendered[keyed]) {
      problems.push(`option ${i} "${trimmed[i]}" reads as the keyed answer "${trimmed[keyed]}" but is marked wrong`);
    }
  }
  if (q.answer.optionTraps && q.answer.optionTraps[keyed] !== undefined) {
    problems.push(`the keyed option ${keyed} carries a misconception note, so the right answer explains itself as a mistake`);
  }
  problems.push(...factorClaimProblems(q, options, keyed));
  return problems;
}

/**
 * "Which of these is a factor of P(x) = …?" is a claim this file can settle
 * with the engine's own parser: a linear option (x − r) is a factor exactly
 * when P(r) = 0. Every option is tested, and the keyed one must be the only
 * true one — a distractor that divides P really is an answer, and a student who
 * picks it has done the maths right.
 *
 * Deliberately narrow and silent when it cannot be sure: an option that does
 * not parse, or is not linear, is skipped rather than guessed at.
 */
function factorClaimProblems(q, options, keyed) {
  if (!/\bwhich\b/i.test(q.prompt) || !/\bfactor of\b/i.test(q.prompt)) return [];
  if (/\bnot a factor\b/i.test(q.prompt)) return [];
  const stated = q.prompt.match(/factor of \$([^$]+)\$/i);
  if (!stated) return [];
  const body = stated[1].includes('=') ? stated[1].split('=').slice(1).join('=') : stated[1];
  const P = univariate(body);
  if (!P) return [];
  const verdicts = [];
  for (const option of options) {
    const f = univariate(option);
    if (!f) return [];
    const slope = f(1) - f(0);
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) return [];
    const root = -f(0) / slope;
    if (!Number.isFinite(root) || Math.abs(f(root)) > 1e-6) return [];   // not linear
    const value = P(root);
    if (!Number.isFinite(value)) return [];
    verdicts.push({ root, isFactor: Math.abs(value) < 1e-7 });
  }
  const problems = [];
  verdicts.forEach((v, i) => {
    if (v.isFactor && i !== keyed) problems.push(`option ${i} "${String(options[i]).trim()}" is genuinely a factor — it vanishes at x = ${v.root} — but is keyed wrong`);
    if (!v.isFactor && i === keyed) problems.push(`the keyed option ${i} "${String(options[i]).trim()}" is not a factor — P(${v.root}) ≠ 0`);
  });
  return problems;
}

/** LaTeX → a function of x, or null when the engine cannot read it. */
function univariate(latex) {
  const source = String(latex)
    .replace(/\\\$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\\times|\\cdot/g, '*')
    .replace(/\\quad|\\,|\\;|\\!/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\$/g, '')
    .replace(/\{([^{}]*)\}/g, '($1)')
    .trim();
  if (!source || /\\/.test(source)) return null;
  try {
    const ast = parse(source);
    const f = x => evaluate(ast, { x });
    if (!Number.isFinite(f(0)) || !Number.isFinite(f(1))) return null;
    return f;
  } catch { return null; }
}

// ── The answer key, in every form the question declares it ───────────────────
//
// The single most valuable check in this file. Whatever a question says its
// answer is, a student typing exactly that must be marked correct — so every
// declared form goes back through the real checkAnswer and has to return
// correct === true. Testing only the preferred canonical form is what let a key
// of "2m" ship against a marker that accepted only "2m+0": the two were never
// compared with each other.
//
// `value` is offered only when no exact form is declared. A question demanding
// a simplest fraction or a surd is right to reject the decimal, and feeding it
// one would be testing the opposite of what the question asks for.

function answerForms(q) {
  const a = q.answer || {};
  const forms = [];
  const declare = (label, v) => {
    if (v === undefined || v === null) return;
    const s = String(v);
    if (s.trim() === '') return;
    if (!forms.some(f => f.input === s)) forms.push({ label, input: s });
  };
  declare('canonicalInput', a.canonicalInput);
  switch (q.answerType) {
    case 'numeric': {
      if (a.surdForm) declare('surdForm', `${a.surdForm.k === 1 ? '' : a.surdForm.k === -1 ? '-' : a.surdForm.k}sqrt(${a.surdForm.r})`);
      if (a.simplestFraction) declare('simplestFraction', `${a.simplestFraction.n}/${a.simplestFraction.d}`);
      // The plain decimal is offered only when nothing about the answer forbids
      // it. A question demanding a simplest fraction, a surd or an exact value
      // is right to reject 0.42857142857142855, and feeding it one would test
      // the opposite of what the question asks for.
      const formDemanded = a.simplestFraction || a.surdForm || a.requireExact || a.forbid;
      if (!formDemanded) declare('value', a.value);
      break;
    }
    case 'expression':
      declare('expr', a.expr);
      (a.anyOf || []).forEach((alt, i) => declare(`anyOf[${i}]`, alt));
      break;
    case 'mcq': declare('correctIndex', a.correctIndex); break;
    case 'set': declare('values', (a.values || []).join(', ')); break;
    case 'point': declare('point', `(${a.x}, ${a.y})`); break;
    case 'ratio': declare('ratio', `${a.a}:${a.b}`); break;
    case 'working': declare('canonicalWorking', a.canonicalWorking); break;
    default: break;
  }
  return forms;
}

// ── One question, every assertion ────────────────────────────────────────────

/** Everything wrong with a generated question, as sentences. Empty means good. */
function inspect(q) {
  const problems = [];
  const answer = q.answer || {};

  if (!q.prompt || typeof q.prompt !== 'string') problems.push('no prompt');
  if (!q.answerType) problems.push('no answerType');
  if (!q.answer) problems.push('no answer');
  if (!Array.isArray(q.steps) || q.steps.length === 0) problems.push('no steps');
  if (!Array.isArray(q.hints) && q.answerType !== 'mcq') problems.push('no hints');
  if (q.answerType === 'mcq' && (!q.mcqOptions || q.mcqOptions.length < 2)) problems.push('mcq without options');

  const prompt = textProblem(q.prompt);
  if (prompt) problems.push(`${prompt} in prompt: ${String(q.prompt).slice(0, 120)}`);
  (q.steps || []).forEach((s, i) => {
    for (const part of [s.h, s.d]) {
      const bad = textProblem(part);
      if (bad) problems.push(`${bad} in step ${i + 1}: ${String(part).slice(0, 120)}`);
    }
  });
  (q.hints || []).forEach((h, i) => {
    const bad = textProblem(h);
    if (bad) problems.push(`${bad} in hint ${i + 1}: ${String(h).slice(0, 120)}`);
  });
  (q.mcqOptions || []).forEach((o, i) => {
    const bad = textProblem(o);
    if (bad) problems.push(`${bad} in option ${i}: ${String(o).slice(0, 80)}`);
  });

  if (q.answerType === 'mcq' && q.mcqOptions?.length >= 2) problems.push(...mcqProblems(q));

  if (q.answerType === 'numeric' && typeof answer.value === 'number') {
    if (!Number.isFinite(answer.value)) problems.push(`keyed value is ${answer.value}`);
    else {
      if (!declaresExactForm(answer)) {
        const artefact = floatArtefact(String(answer.value));
        if (artefact) problems.push(`keyed value ${artefact} is a floating-point artefact, not a clean value`);
      }
      if (!Number.isInteger(answer.value) && !answer.simplestFraction && !answer.surdForm && asksForACount(q)) {
        problems.push(`the question counts something but the keyed answer is ${answer.value}`);
      }
    }
  }

  const forms = answerForms(q);
  if (!forms.length) problems.push('no canonical input (requireExact needs canonicalInput)');
  for (const form of forms) {
    let result;
    try { result = checkAnswer(q, form.input); }
    catch (err) { result = { correct: false, feedback: `checkAnswer threw: ${err.message}` }; }
    if (!result.correct) {
      problems.push(`the keyed answer does not round-trip: ${form.label} "${form.input}" is marked WRONG by checkAnswer${result.feedback ? ` (${result.feedback})` : ''}`);
    }
  }
  return problems;
}

// ── Failure ledger ───────────────────────────────────────────────────────────
//
// At 2000 draws a cell a single broken form produces thousands of identical
// failures, so they are grouped: the first occurrence of each distinct defect
// prints in full, in the shape this suite has always printed, and the rest are
// counted. The rate beside each one is what says how it got past 30 draws.

const MAX_REPORTED = 60;

function makeLedger() {
  const entries = new Map();
  let reported = 0;
  return {
    entries,
    get reported() { return reported; },
    record(kind, cell, seed, problems, prompt) {
      for (const problem of problems) {
        // Numbers vary from seed to seed; the sentence around them is the defect.
        const signature = `${cell} ${problem.replace(/-?\d+(\.\d+)?/g, '#').slice(0, 160)}`;
        let entry = entries.get(signature);
        if (!entry) {
          entry = { kind, cell, seed, problem, prompt, count: 0 };
          entries.set(signature, entry);
          if (reported < MAX_REPORTED) {
            reported++;
            console.log(`${kind} ${cell} seed=${seed}\n  ${problem}\n  prompt: ${String(prompt ?? '').slice(0, 140)}`);
          }
        }
        entry.count++;
      }
    }
  };
}

// ── The sweep ────────────────────────────────────────────────────────────────

/**
 * Every subtopic, every difficulty, N draws a cell; then every part of every
 * multipart exam question. Returns the exit code.
 *
 * Seeds are the ones this suite has always used — draw i of a cell is the seed
 * it was at N = 30 — so raising N only ever adds questions to the sample.
 */
function run() {
  const started = Date.now();
  const ledger = makeLedger();
  let fails = 0, total = 0;
  const subtopics = Object.keys(GENERATORS).filter(k => k.includes(filter));

  for (const st of subtopics) {
    for (let d = 1; d <= 4; d++) {
      const cell = `${st} D${d}`;
      for (let i = 0; i < N; i++) {
        total++;
        const seed = (d * 100000 + i * 977 + st.length * 13) >>> 0;
        let q;
        try {
          q = generateQuestion(st, d, seed);
        } catch (err) {
          fails++;
          ledger.record('GEN-ERROR', cell, seed, [err.message], '');
          continue;
        }
        const problems = inspect(q);
        if (problems.length) {
          fails++;
          ledger.record('FAIL', cell, seed, problems, q.prompt);
        }
      }
    }
  }

  // ── Multipart exam questions ───────────────────────────────────────────────
  // A part is marked exactly like a standalone question, so it is inspected as
  // one: the same round-trip, the same hygiene, the same MCQ rules.

  let mpTotal = 0, mpFails = 0;
  const mpIds = Object.keys(MULTIPART).filter(k => k.includes(filter));
  const mpN = Math.max(25, Math.round(N / 4));

  for (const id of mpIds) {
    for (let i = 0; i < mpN; i++) {
      const seed = (900000 + i * 1013 + id.length * 7) >>> 0;
      let q;
      try {
        q = generateMultipart(id, seed);
      } catch (err) {
        mpFails++; mpTotal++;
        ledger.record('MP-GEN-ERROR', id, seed, [err.message], '');
        continue;
      }
      const outer = [];
      if (!q.stem) outer.push('no stem');
      if (!Array.isArray(q.parts) || q.parts.length < 2) outer.push('needs 2+ parts');
      const stem = textProblem(q.stem);
      if (stem) outer.push(`${stem} in stem: ${String(q.stem).slice(0, 120)}`);
      if (outer.length) { mpFails++; ledger.record('MP-FAIL', id, seed, outer, q.stem); }

      for (const part of q.parts || []) {
        mpTotal++;
        const problems = inspect({
          prompt: part.prompt, answerType: part.answerType, answer: part.answer,
          mcqOptions: part.mcqOptions, steps: part.steps, hints: part.hints ?? [],
          answerSuffix: part.answerSuffix, answerPrefix: part.answerPrefix, traps: part.traps
        });
        if (!part.marks || part.marks < 1) problems.push('no marks');
        if (problems.length) {
          mpFails++;
          ledger.record('MP-FAIL', `${id}(${part.key})`, seed, problems, part.prompt);
        }
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (ledger.entries.size) {
    const rows = [...ledger.entries.values()].sort((a, b) => b.count - a.count);
    if (ledger.reported < rows.length) console.log(`\n…and ${rows.length - ledger.reported} further distinct defects, printed only in the roll-up below`);
    console.log(`\n${rows.length} distinct defect${rows.length === 1 ? '' : 's'}, by how often each one fires:`);
    for (const row of rows) {
      const draws = row.kind.startsWith('MP') ? mpN : N;
      console.log(`  ${String(row.count).padStart(6)} × ${row.cell}  (${(100 * row.count / draws).toFixed(2)}% of draws)  ${row.problem.slice(0, 96)}`);
    }
  }

  if (mpIds.length) {
    console.log(`\n${mpTotal - mpFails}/${mpTotal} multipart part-checks passed across ${mpIds.length} multipart questions${mpFails ? ` — ${mpFails} FAILURES` : ' ✔'}`);
  }

  // The finest defect this many draws can see: the rate r at which a cell's
  // defect would have shown up in at least one draw, 19 runs out of 20.
  const finest = 100 * (1 - 0.05 ** (1 / N));

  console.log(`\n${total - fails}/${total} self-checks passed across ${subtopics.length} subtopic${subtopics.length === 1 ? '' : 's'}${fails ? ` — ${fails} FAILURES` : ' ✔'}`);
  console.log(`${N} draws per cell in ${elapsed}s — fine enough to see a defect firing on ${finest.toFixed(2)}% of a cell's seeds, 19 runs out of 20`);

  return fails || mpFails ? 1 : 0;
}

// ── Entry point ──────────────────────────────────────────────────────────────
// The sweep runs only when this file is the one that was launched. Imported —
// to exercise the assertions above against a question built to break one — it
// defines and prints nothing.

const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === launched) process.exit(run());

export { inspect, textProblem, floatArtefact, leakedUndefined, asksForACount, answerForms, mcqProblems, run };
