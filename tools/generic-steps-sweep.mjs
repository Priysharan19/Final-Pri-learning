// Pri Learning · the sweep of the generic step-mark rule (server/platform/genericSteps.js), approved in THIS PROCESS ONLY
//
//   node tools/generic-steps-sweep.mjs                 SEEDS=40 (default 40): print the numbers and every exception
//   GENERIC_SEEDS=6 node tools/generic-steps-sweep.mjs  fewer seeds
//
// The rule is never approved in the repository. This passes an approved list to the pay function (the author-approved tier, Prithagoras,
// PRI_METHOD_MARKS=on, as a plain object: no environment is touched), over generated pages of every Years 11-12 Advanced and Extension 1 topic:
//   (a) the authored solution's own working with only the final line wrong (and the typed answer wrong): the distribution of marks
//   (b) the authored working in full with the right answer: always N; and in full with a wrong typed answer: never N
//   (c) one authored line falsified at each key step: nothing for the falsified line, nothing at or after a crossed line
//   (d) gaming: the question restated, given numbers, true irrelevant arithmetic, numbers of the solution without the working that reaches them,
//       a bare intermediate value alone, naming a formula, lines no check can read, lines after the first crossed line
//   (e) invariants on every page: never N on a wrong or blank final answer, never above N, only ticked lines before the first cross earn
// A violation is any breach of (e) or of a "nothing" in (c) and (d). An EXCEPTION is a gamed page that earned a mark; each is printed with the page.
import * as G from '../client/src/engine/generators/index.js';
import { NSW_BANK_LEDGER, nswIssuable } from '../server/platform/nswBanks.js';
import { inScope, courseOf } from './scheme-coverage-y1112.mjs';
import { SUBTOPIC_BY_ID, entryIdOf } from '../client/src/engine/curriculum.js';
import { GENERIC_ID, genericDigest, genericPlan, genericEligible, authoredLines, stepFacts } from '../server/platform/genericSteps.js';
import { schemePay } from '../server/platform/schemeAward.js';
import { stepEvidence, marksPossibleFor, practiceMarksEarned } from '../server/platform/markerOps.js';
import { checkAnswer } from '../client/src/engine/checker.js';
import { _internals } from '../client/src/engine/solutionMatch.js';
import { evaluate } from '../client/src/engine/expr.js';

export const LIST = [{ typeId: GENERIC_ID, digest: genericDigest() }];
export const ENV = { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' };

const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };
/** The line with its last number raised by one: provably a different statement. */
export function falsify(text) {
  // a large change, so that the changed line cannot coincide with another statement of the solution (8001 against a rounded 0.381, x = 4 for x = 3)
  const eq0 = text.lastIndexOf('=');
  const body0 = eq0 >= 0 ? text.slice(eq0 + 1) : text;
  const m0 = [...body0.matchAll(/\d+/g)].pop();
  if (!m0) return null;
  return text.slice(0, eq0 + 1) + body0.slice(0, m0.index) + (Number(m0[0]) * 7 + 13) + body0.slice(m0.index + m0[0].length);
}
export function falsifyByOne(text) {
  const eq = text.lastIndexOf('=');
  const head = eq >= 0 ? text.slice(0, eq + 1) : '';
  const body = eq >= 0 ? text.slice(eq + 1) : text;
  const m = [...body.matchAll(/\d+/g)].pop();
  if (!m) return null;
  return head + body.slice(0, m.index) + (Number(m[0]) + 1) + body.slice(m.index + m[0].length);
}

/** Mark one page the way the server does for a stamped question (practice.js): the scheme's partial only when the scheme paid and the answer is wrong. */
export function markPage(q, lines, answer) {
  const N = marksPossibleFor(q);
  const result = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), result, { slipWarnings: true });
  const correct = result.correct === true;
  const pay = schemePay({ q, report: ev.stepReport || null, topic: ev.topicTicks ?? null, correct, marksPossible: N, env: ENV, list: LIST });
  const marks = pay.paid ? practiceMarksEarned(q, result, { ...ev, partial: !correct ? pay.partial : null }, N) : 0;
  return { N, result, correct, ev, pay, marks, lines: ev.stepReport?.lines || [] };
}

/** Every issued, eligible, payable Years 11-12 question: [{ q, generator, strand, course }]. */
export async function payableQuestions({ seeds = 40 } = {}) {
  await G.loadAllBanks();
  const out = [];
  for (const entry of NSW_BANK_LEDGER) {
    if (!inScope(entry.generator)) continue;
    const sub = SUBTOPIC_BY_ID[entryIdOf(entry.generator)] || SUBTOPIC_BY_ID[entry.generator] || {};
    for (const cell of entry.cells) {
      if (!cell.issued) continue;
      for (let seed = 1; seed <= seeds; seed++) {
        let q; try { q = G.generateQuestion(entry.generator, cell.difficulty, seed); } catch { continue; }
        if (!q) continue;
        q._generator = entry.generator;
        let issuable = false; try { issuable = nswIssuable(q, entry.generator); } catch { issuable = false; }
        if (!issuable || !genericEligible(q)) continue;
        out.push({ q: { ...q, _methodScheme: GENERIC_ID }, generator: entry.generator, strand: sub.strand || '?', course: courseOf(entry.generator), difficulty: cell.difficulty, seed });
      }
    }
  }
  return out;
}

/** A falsified line that is nevertheless still true (value-equal to the authored one: a degenerate question, a rounding) is no wrong line, so it is not tested as one. */
const sampleEnv = (vars, j) => Object.fromEntries(vars.map((v, k) => [v, [0.61, -1.07, 0.37, 1.9, -0.43][(j + 2 * k) % 5]]));
export function stillTrue(a, b) {
  try {
    const ra = _internals.readSide(a.split('=').pop()), rb = _internals.readSide(b.split('=').pop());
    if (!ra || !rb) return false;
    if (ra.value !== undefined || rb.value !== undefined) return ra.value !== undefined && rb.value !== undefined && Math.abs(ra.value - rb.value) < 1e-9 * Math.max(1, Math.abs(ra.value));
    const vars = [...new Set([...(ra.vars || []), ...(rb.vars || [])])];
    for (let j = 0; j < 5; j++) { const e = sampleEnv(vars, j); const x = evaluate(ra.ast, e), y = evaluate(rb.ast, e); if (!(Math.abs(x - y) < 1e-9 * Math.max(1, Math.abs(x)))) return false; }
    return true;
  } catch { return false; }
}
const WORDS = ['so the answer is clear', 'by the formula', 'using the method above', 'we continue as before'];
const NAMING = ['A = integral of f(x) dx', 'y = mx + c', 'dy/dx = gradient', 'a^2 + b^2 = c^2', 'the area is found by integrating'];
const OUTSIDE = ['211 + 307 = 518', '401 * 3 = 1203', '997 - 13 = 984', '631 + 2 = 633', '17 * 19 = 323'];
const IRRELEVANT = ['2 + 2 = 4', '3 * 5 = 15', '10 / 2 = 5', '7 - 3 = 4', '6 * 7 = 42', '12 - 5 = 7', '9 / 3 = 3', '1 + 1 = 2', '5 + 5 = 10', '4 * 4 = 16'];

const promptLines = q => [...String(q.prompt).matchAll(/\$([^$]+)\$/g)].map(m => { try { return _internals.spanToPlain(m[1]); } catch { return null; } }).filter(Boolean);
const numerals = text => [...String(text).matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]);

export async function runSweep({ seeds = 40 } = {}) {
  const items = await payableQuestions({ seeds });
  const R = {
    questions: 0, payable: 0, byTopic: new Map(),
    a: { pages: 0, dist: new Map(), byN: new Map(), skippedCorrect: 0 },
    b: { pages: 0, full: 0, notFull: 0, skipped: 0, wrongTyped: 0, wrongTypedAtN: 0 },
    c: { pages: 0, crossedFalsified: 0, falsifiedEarned: 0, atOrAfterCross: 0, laterThanFalsified: 0, uncrossedFalsified: 0, fromPages: 0, fromEarnedAtOrAfter: 0, fromMarksOverBefore: 0, fromFalsifiedEarned: 0 },
    d: { classes: new Map() }, e: { pages: 0, wrongFull: 0, overN: 0, unticked: 0, afterCross: 0, tableNotMark: 0, correctNotFull: 0, notPaid: 0, finalByLines: 0 },
    f: { pages: 0, marks: 0, ideal: 0, overPages: 0, afterWrong: 0 }, g: { pages: 0, earned: 0, overCredit: 0, singleResult: 0 },
    i: { pages: 0, earned: 0, firstSolutionStep: 0, derived: 0, bareFirst: 0 },
    h: { route: { pages: 0, marks: 0 }, swap: { pages: 0, marks: 0 }, onesided: { pages: 0, marks: 0 } },
    exceptions: [], coincidences: [], violations: []
  };
  const klass = name => { if (!R.d.classes.has(name)) R.d.classes.set(name, { pages: 0, earned: 0, exceptions: 0 }); return R.d.classes.get(name); };
  const viol = (kind, q, extra) => { if (R.violations.length < 40) R.violations.push({ kind, prompt: q.prompt, ...extra }); else R.violations.push({ kind }); };
  const check = (q, page, label) => {
    // (e) the invariants, on every page marked
    R.e.pages++;
    const { N, correct, pay, marks, lines } = page;
    if (!pay.paid) { R.e.notPaid++; return; }
    if (marks > N) { R.e.overN++; viol('over-N', q, { label }); }
    if (!correct && marks >= N) { R.e.wrongFull++; viol('wrong-answer-full', q, { label, marks }); }
    if (correct && marks !== N) { R.e.correctNotFull++; viol('correct-not-full', q, { label, marks }); }
    const cross = lines.findIndex(l => l?.status === 'break');
    let sum = 0;
    for (const it of pay.items) {
      if (it.awarded) sum += it.marks;
      if (it.basis === 'answer' && it.awarded && !correct) { R.e.finalByLines++; viol('answer-criterion-by-working', q, { label }); }
      if (!correct) for (const n of it.lines) {
        const l = lines[n - 1];
        if (!(l && l.status === 'ok' && l.ecf !== true && l.given !== true)) { R.e.unticked++; viol('earned-on-unticked-line', q, { label, n }); }
        if (cross >= 0 && n - 1 >= cross) { R.e.afterCross++; viol('earned-at-or-after-cross', q, { label, n, cross: cross + 1 }); }
      }
    }
    if (!correct && sum !== marks) { R.e.tableNotMark++; viol('table-not-mark', q, { label, sum, marks }); }
  };

  // the next question of the same generator, for the class "another question's working"
  const nextOf = new Map(); { const last = new Map(); for (const it of items) { if (last.has(it.generator)) nextOf.set(last.get(it.generator), it); last.set(it.generator, it); } }
  for (const it of items) {
    const { q } = it;
    R.questions++;
    const plan = genericPlan(q);
    const topic = `${it.course} · ${it.strand}`;
    const T = R.byTopic.get(topic) || R.byTopic.set(topic, { questions: 0, payable: 0, marksSum: 0, nm1: 0 }).get(topic);
    T.questions++;
    if (!plan.keySteps.length) continue;
    R.payable++; T.payable++; T.marksSum += plan.keySteps.length; T.nm1 += plan.marks - 1;
    const N = plan.marks;
    const lines0 = authoredLines(q);
    const texts = lines0.map(l => l.text);
    if (texts.length < 2) continue;

    // (b) the authored working in full, with the right answer
    const trueAnswer = finalOf(texts);
    const full = markPage(q, texts, trueAnswer);
    check(q, full, 'b-full');
    if (full.correct) { R.b.pages++; if (full.marks === N) R.b.full++; else { R.b.notFull++; viol('full-working-not-N', q, { marks: full.marks }); } } else R.b.skipped++;
    // ... and in full with a wrong typed answer: never N, and the key steps it reaches
    const wrongTyped = markPage(q, texts, '99991');
    check(q, wrongTyped, 'b-wrong-typed');
    R.b.wrongTyped++; if (wrongTyped.marks >= N) { R.b.wrongTypedAtN++; viol('wrong-typed-at-N', q, {}); }
    const blank = markPage(q, texts, '');
    check(q, blank, 'b-blank-final');
    if (blank.pay.paid && blank.marks >= N) viol('blank-final-at-N', q, {});

    // (a) only the final line wrong (and the typed answer wrong)
    // the answer step's own lines (the last step): the last of them falsified; when it has none the page just ends with a wrong typed answer
    const ansStep = Math.max(...q.steps.map((s, i) => (/^(check|note|bonus)/i.test(s?.h) ? -1 : i)));
    const lastAns = lines0.reduce((m, l, i) => (l.step === ansStep ? i : m), -1);
    {
      const bad = lastAns >= 0 ? falsify(texts[lastAns]) : null;
      const lines = lastAns >= 0 ? (bad && bad !== texts[lastAns] ? texts.map((t, i) => (i === lastAns ? bad : t)) : null) : texts;
      if (lines) {
      const a = markPage(q, lines, lastAns >= 0 ? finalOf(lines.slice(0, lastAns + 1)) : '99991');
      if (a.correct) R.a.skippedCorrect++;
      else {
        check(q, a, 'a-final-wrong');
        R.a.pages++;
        R.a.dist.set(a.marks, (R.a.dist.get(a.marks) || 0) + 1);
        const key = `${a.N}m`; const row = R.a.byN.get(key) || R.a.byN.set(key, new Map()).get(key);
        row.set(a.marks, (row.get(a.marks) || 0) + 1);
      }
      }
    }

    // (c) one authored line falsified at each key step: the first authored line of that step
    for (const k of plan.keySteps) {
      const at = lines0.findIndex(l => l.step === k.step);
      if (at < 0) continue;
      const badk = falsify(texts[at]);
      if (!badk || badk === texts[at] || stillTrue(texts[at], badk)) continue;
      const lines = texts.map((t, i) => (i === at ? badk : t));
      const wrongFinal = falsify(texts[texts.length - 1]) ?? '99991';
      const c = markPage(q, lines, finalOf(lines.slice(0, -1).concat(wrongFinal)));
      if (c.correct) continue;
      check(q, c, `c-wrong-at-step-${k.number}`);
      R.c.pages++;
      const cross = c.lines.findIndex(l => l?.status === 'break');
      if (cross >= 0) R.c.crossedFalsified++; else R.c.uncrossedFalsified++;
      if (c.pay.paid) for (const itm of c.pay.items) for (const n of itm.lines) {
        if (n - 1 === at) { R.c.falsifiedEarned++; viol('falsified-line-earned', q, { step: k.number, n }); }
        if (cross >= 0 && n - 1 >= cross) { R.c.atOrAfterCross++; viol('earned-after-cross', q, { step: k.number, n }); }
        if (n - 1 > at) R.c.laterThanFalsified++;
      }
    }

    // (c, from step k) the page is wrong from the key step on: that line and every later line falsified (a student whose later lines follow from the
    // wrong one). Only lines before k may earn, and never more marks than the key steps whose authored line comes before k.
    for (const k of plan.keySteps) {
      const at = lines0.findIndex(l => l.step === k.step);
      if (at < 0) continue;
      const lines = texts.map((t, i) => (i >= at ? (falsify(t) ?? t) : t));
      const stillTrueLines = new Set(texts.flatMap((t, i) => (i >= at && (falsify(t) === null || stillTrue(t, falsify(t))) ? [i] : [])));
      const wrongFinal = '99991';
      const c = markPage(q, lines, wrongFinal);
      if (c.correct || !c.pay.paid) continue;
      check(q, c, `c-wrong-from-step-${k.number}`);
      R.c.fromPages++;
      let earnedBefore = 0;
      for (const itm of c.pay.items) {
        if (itm.key === 'answer' || !itm.awarded) continue;
        for (const n of itm.lines) {
          if (n - 1 >= at && !stillTrueLines.has(n - 1)) { R.c.fromEarnedAtOrAfter++; viol('earned-on-or-after-the-wrong-step', q, { step: k.number, n, at: at + 1 }); }
        }
        earnedBefore++;
      }
      const possibleBefore = plan.keySteps.filter(x => lines0.findIndex(l => l.step === x.step) < at).length;
      if (earnedBefore > possibleBefore + stillTrueLines.size) { R.c.fromMarksOverBefore++; viol('more-marks-than-steps-before-the-wrong-step', q, { step: k.number, earnedBefore, possibleBefore }); }
    }

    // (f) ONE WRONG MIDDLE LINE, then the authored lines. Every authored line before the answer step is falsified in turn. Nothing may be earned by the
    // wrong line or by any line after it, whether the page crosses it or only notes it. Tolerance: 0 pages. `ideal` = key steps whose authored line stands before it.
    {
      const facts = stepFacts(q);
      lines0.forEach((al, idx) => {
        if (lastAns >= 0 && al.step === ansStep) return;
        const bad = falsify(texts[idx]);
        if (!bad || bad === texts[idx] || stillTrue(texts[idx], bad)) return;
        const lines = texts.map((t, i) => (i === idx ? bad : t));
        const f = markPage(q, lines, '99991');
        if (f.correct || !f.pay.paid) return;
        check(q, f, `f-wrong-middle-line-${idx + 1}`);
        const ideal = plan.keySteps.filter(k => lines0.findIndex(l => l.step === k.step) < idx).length;
        R.f.pages++; R.f.marks += f.marks; R.f.ideal += ideal;
        const late = f.pay.items.filter(i => i.awarded && i.key !== 'answer' && i.lines.some(n => n - 1 >= idx));
        if (f.marks > ideal) R.f.overPages++;
        if (late.length) { R.f.afterWrong++; viol('earned-after-an-unverified-wrong-line', q, { idx: idx + 1, lines, earned: late.map(i => [i.key, i.lines]) }); }
      });
      // (g) A SINGLE BARE LINE alone: a letter equal to a number, or a bare number. It may earn only a step whose one result it is (nonzero, not a given).
      const seenBare = new Set();
      for (const al of lines0) {
        const m = /^\s*(?:[A-Za-z][A-Za-z0-9_']*(?:\([^()]*\))?\s*=\s*)?(-?\d+(?:\.\d+)?)\s*$/.exec(al.text);
        if (!m || seenBare.has(al.text)) continue;
        seenBare.add(al.text);
        const g = markPage(q, [al.text], '99991'); check(q, g, 'g-single-bare-line');
        R.g.pages++;
        if (g.pay.paid && g.marks > 0) {
          R.g.earned++;
          const earnedItem = g.pay.items.find(i => i.awarded && i.key !== 'answer');
          const f = facts.get(Number(earnedItem.key.replace('step-', '')) - 1);
          if (f && f.results === 1 && Number(m[1]) !== 0) R.g.singleResult++;
          else { R.g.overCredit++; viol('bare-line-alone-earned', q, { line: al.text, key: earnedItem.key, results: f?.results }); R.exceptions.push({ class: 'single-bare-line', prompt: q.prompt, lines: [al.text], earned: [earnedItem.key], marks: g.marks }); }
        }
      }
    }
    // (i) A TRUE FIRST LINE, THEN WORDS. The first authored line alone followed by lines nothing can read. It may earn only a key step, and a key step is a
    // result, not set-up: counted by whether the step is the first step of the solution and whether its result is an expression (derived) or a bare value.
    {
      const first = lines0[0];
      if (first) {
        const g = markPage(q, [first.text, ...WORDS], '99991'); check(q, g, 'i-first-line-then-words');
        R.i.pages++;
        const item = g.pay.paid ? g.pay.items.find(x => x.awarded && x.key !== 'answer') : null;
        if (item) {
          R.i.earned++;
          const stepIdx = Number(item.key.replace('step-', '')) - 1;
          const firstStepIdx = Math.min(...q.steps.map((st, i) => (/^(check|note|bonus)/i.test(st?.h) ? 1e9 : i)));
          if (stepIdx === firstStepIdx) R.i.firstSolutionStep++;
          if (/^\s*(?:[A-Za-z][A-Za-z0-9_']*(?:\([^()]*\))?\s*=\s*)?-?\d+(?:\.\d+)?\s*$/.test(first.text)) R.i.bareFirst++; else R.i.derived++;
          if (R.i.bareFirst && /^\s*[A-Za-z][A-Za-z0-9_']*\s*=\s*-?\d+(?:\.\d+)?\s*$/.test(first.text) && stepFacts(q).get(stepIdx)?.results !== 1) viol('bare-first-line-earned-a-multi-result-step', q, { line: first.text });
        }
      }
    }
    // (h) THE SAME CORRECT ROUTE, written three ways, with a wrong last line: as authored, the sides of every equation swapped, and every equation of
    // letters moved to one side (a = b becomes a - (b) = 0). Equivalent lines; the page can tick them less often. Informational: the mean marks of each.
    {
      const bad = lastAns >= 0 ? falsify(texts[lastAns]) : null;
      if (bad && bad !== texts[lastAns]) {
        const base = texts.map((t, i) => (i === lastAns ? bad : t));
        const swap = base.map((t, i) => { const parts = t.split('='); return i === lastAns || parts.length !== 2 ? t : `${parts[1].trim()} = ${parts[0].trim()}`; });
        const one = base.map((t, i) => { const parts = t.split('='); return i === lastAns || parts.length !== 2 || !/[a-z]/.test(parts[0]) || /^[A-Za-z][A-Za-z0-9_']*(\([^()]*\))?$/.test(parts[0].trim()) ? t : `${parts[0].trim()} - (${parts[1].trim()}) = 0`; });
        for (const [k, lines] of [['route', base], ['swap', swap], ['onesided', one]]) { const h = markPage(q, lines, '99991'); if (h.pay.paid) { R.h[k].pages++; R.h[k].marks += h.marks; } }
      }
    }

    // (d) gaming. Every page has a wrong typed answer, so nothing may be earned for the final answer, and every mark is by lines.
    const gaming = (name, lines, { allowed = () => false, coincidence = false } = {}) => {
      const g = markPage(q, lines, '99991');
      check(q, g, `d-${name}`);
      const kc = klass(name); kc.pages++;
      if (g.pay.paid && g.marks > 0) {
        const earnedSteps = g.pay.items.filter(i => i.awarded && i.basis === 'lines' && i.key !== 'answer');
        const legit = earnedSteps.every(i => allowed(i, g));
        kc.earned++;
        // a COINCIDENCE: the other question's line is, by chance, a true statement of this question's own solution (the same root, the same equation)
        if (!legit && coincidence) { kc.coincidences = (kc.coincidences || 0) + 1; R.coincidences.push({ class: name, prompt: q.prompt, steps: q.steps.map(s => `${s.h}: ${s.d}`), lines, earned: earnedSteps.map(i => ({ key: i.key, lines: i.lines })), marks: g.marks }); }
        else if (!legit) { kc.exceptions++; R.exceptions.push({ class: name, prompt: q.prompt, steps: q.steps.map(s => `${s.h}: ${s.d}`), lines, earned: earnedSteps.map(i => ({ key: i.key, lines: i.lines })), marks: g.marks }); }
      }
    };
    gaming('restate-the-question', promptLines(q));
    {
      // the complete, correct working of ANOTHER question of the same kind: right maths, wrong question
      const other = nextOf.get(it);
      const otherTexts = other && other.q.prompt !== q.prompt ? authoredLines(other.q).map(l => l.text).filter(t => !texts.some(a => a.replace(/[\s()]/g, '') === t.replace(/[\s()]/g, ''))) : [];
      if (otherTexts.length) gaming('another-questions-working', otherTexts, { coincidence: true });
    }
    gaming('given-numbers', numerals(String(q.prompt).replace(/\$[^$]*\$/g, m => m)).filter((v, i, a) => a.indexOf(v) === i));
    gaming('irrelevant-true-arithmetic', IRRELEVANT.filter(t => !texts.some(a => a.replace(/\s+/g, '').replace(/[()]/g, '') === t.replace(/\s+/g, '').replace(/[()]/g, '').replace(/\*/g, '*'))));
    gaming('irrelevant-true-arithmetic-outside-the-question', OUTSIDE);
    gaming('lines-no-check-can-read', WORDS);
    gaming('naming-a-formula', NAMING);
    // numbers of a derived step written without the working that reaches them: must earn nothing FOR THAT STEP
    {
      const derived = plan.keySteps.filter(k => !/^(?:[-\d.]+)$/.test(String(authoredLines(q).filter(l => l.step === k.step).map(l => l.text.split('=').pop().trim()).join('')).replace(/\s/g, '')));
      const nums = [...new Set(derived.flatMap(k => numerals(String(q.steps[k.step]?.d ?? '').replace(/\\[a-z]+/g, ' '))))];
      if (nums.length) {
        const g = markPage(q, nums, '99991'); check(q, g, 'd-solution-numbers');
        const kc = klass('numbers-of-the-solution-without-working'); kc.pages++;
        const stepOfItem = key => Number(key.replace('step-', '')) - 1;
        const valueStep = k => lines0.filter(l => l.step === k.step).some(l => /^[-+]?[\d.]+$/.test(l.text.replace(/\s/g, '').split('=').pop()));
        if (g.pay.paid && g.marks > 0) {
          kc.earned++;
          for (const itm of g.pay.items.filter(i => i.awarded && i.key !== 'answer')) {
            const k = plan.keySteps.find(x => x.step === stepOfItem(itm.key));
            if (k && !valueStep(k)) { kc.exceptions++; R.exceptions.push({ class: 'numbers-of-the-solution-without-working', prompt: q.prompt, steps: q.steps.map(s => `${s.h}: ${s.d}`), lines: nums, earned: [{ key: itm.key, lines: itm.lines }], marks: g.marks }); }
          }
        }
      }
    }
    // the value of a numeric step reached by other operations (a sum that comes to it, a product with 1): the value is right, the working is not the step's
    {
      const vs = [...new Set(plan.keySteps.flatMap(k => lines0.filter(l => l.step === k.step).map(l => l.text.split('=').pop().trim()).filter(v => /^-?\d+(?:\.\d+)?$/.test(v))))].slice(0, 4);
      if (vs.length) gaming('same-value-other-operations', vs.flatMap(v => [`${Number(v) - 1} + 1 = ${v}`, `${Number(v) + 1} - 1 = ${v}`, `${v} * 1 = ${v}`, `${v} + 0 = ${v}`]).filter(t => !texts.some(a => a.replace(/[\s()]/g, '') === t.replace(/[\s()]/g, ''))));
    }
    // a bare intermediate value (BARE_VALUE_EVIDENCE). Alone it is never ticked by the page (solutionMatch ticks a value only in order, after a line it
    // recognised), so it earns nothing. After the authored lines of the steps before it, the page may tick it, and then it may earn ONLY the step it is
    // the value of, and only a step whose result is a number.
    for (const k of plan.keySteps) {
      const at = lines0.findIndex(l => l.step === k.step);
      const own = lines0.filter(l => l.step === k.step).map(l => l.text);
      const vals = own.map(t => t.split('=').pop().trim()).filter(v => /^-?\d+(?:\.\d+)?$/.test(v));
      if (!vals.length || at < 0) continue;
      const alone = markPage(q, [vals[0]], '99991'); check(q, alone, 'd-bare-value-alone');
      const ka = klass('bare-intermediate-value-alone'); ka.pages++;
      if (alone.pay.paid && alone.marks > 0) { ka.earned++; ka.exceptions++; R.exceptions.push({ class: 'bare-value-alone-earned', prompt: q.prompt, lines: [vals[0]], earned: alone.pay.items.filter(i => i.awarded).map(i => i.key), marks: alone.marks }); }
      const after = markPage(q, [...texts.slice(0, at), vals[0]], '99991'); check(q, after, 'd-bare-value-after-lines');
      const kb = klass('bare-intermediate-value-after-earlier-lines'); kb.pages++;
      if (after.pay.paid && after.marks > 0) {
        kb.earned++;
        // the bare line is line at+1: it may be credited only to this key step
        const wrongStep = after.pay.items.some(i => i.awarded && i.key !== 'answer' && i.lines.includes(at + 1) && i.key !== `step-${k.number}`);
        if (wrongStep) { kb.exceptions++; R.exceptions.push({ class: 'bare-value-earned-another-step', prompt: q.prompt, lines: [...texts.slice(0, at), vals[0]], earned: after.pay.items.filter(i => i.awarded).map(i => [i.key, i.lines]), marks: after.marks }); }
        if (after.pay.items.some(i => i.awarded && i.key === `step-${k.number}` && i.lines.includes(at + 1))) kb.bareEarnedItsOwnStep = (kb.bareEarnedItsOwnStep || 0) + 1;
      }
    }
    // lines after the first crossed line: the first authored line falsified (crossed where the engine can judge it), the rest authored and true
    {
      const badFirst = falsify(texts[0]);
      if (badFirst && badFirst !== texts[0]) {
        const lines = [badFirst, ...texts.slice(1)];
        const g = markPage(q, lines, '99991'); check(q, g, 'd-after-first-cross');
        const kc = klass('lines-after-the-first-crossed-line'); kc.pages++;
        const cross = g.lines.findIndex(l => l?.status === 'break');
        if (cross === 0) { kc.crossedAtFirst = (kc.crossedAtFirst || 0) + 1; if (g.marks > 0) { kc.exceptions++; viol('mark-after-first-cross', q, { marks: g.marks }); } }
        else kc.uncrossed = (kc.uncrossed || 0) + 1;
        if (g.marks > 0) kc.earned++;
      }
    }
  }
  return R;
}

const mapStr = m => [...m].sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}:${v}`).join(' ');
export function report(R) {
  const L = [];
  L.push(`generic rule: ${R.questions} eligible questions swept, ${R.payable} can pay a wrong-answer mark (${(100 * R.payable / Math.max(1, R.questions)).toFixed(1)}%)`);
  L.push(`(a) final line wrong, ${R.a.pages} pages (+${R.a.skippedCorrect} where the wrong line happened to be right, skipped): marks ${mapStr(R.a.dist)}; by question marks: ${[...R.a.byN].map(([n, m]) => `${n} {${mapStr(m)}}`).join('; ')}`);
  L.push(`(b) full working, right answer: ${R.b.full}/${R.b.pages} earned N (${R.b.skipped} skipped: the authored last line is not typed as the answer); wrong typed answer at N: ${R.b.wrongTypedAtN}/${R.b.wrongTyped}`);
  L.push(`(c, from step k) every line from a key step on falsified: ${R.c.fromPages} pages; earned on or after the wrong step ${R.c.fromEarnedAtOrAfter}, more marks than steps before it ${R.c.fromMarksOverBefore}`);
  L.push(`(c, one line) wrong at a key step: ${R.c.pages} pages; falsified line crossed ${R.c.crossedFalsified}, not crossed ${R.c.uncrossedFalsified}; the falsified line earned ${R.c.falsifiedEarned}; earned at or after a cross ${R.c.atOrAfterCross}; a later line than the falsified one earned (uncrossed wrong line) ${R.c.laterThanFalsified}`);
  for (const [k, v] of R.d.classes) L.push(`(d) ${k}: ${v.pages} pages, earned a mark on ${v.earned}, exceptions ${v.exceptions}${v.crossedAtFirst !== undefined ? `, crossed at line 1 on ${v.crossedAtFirst}` : ''}${v.coincidences ? `, coincidences (the other question's line is also true here) ${v.coincidences}` : ''}${v.bareEarnedItsOwnStep !== undefined ? `, the bare value earned its own step on ${v.bareEarnedItsOwnStep}` : ''}`);
  L.push(`(f) one wrong middle line then the authored lines: ${R.f.pages} pages, marks ${R.f.marks} against an ideal of ${R.f.ideal}; pages above the ideal ${R.f.overPages}; earned by a line at or after the wrong one ${R.f.afterWrong}`);
  L.push(`(g) a single bare line alone: ${R.g.pages} pages, earned a mark on ${R.g.earned} (a step whose one result it is: ${R.g.singleResult}); over-credit ${R.g.overCredit}`);
  L.push(`(i) a true first line then words: ${R.i.pages} pages, earned a mark on ${R.i.earned}; the step is the first step of the solution on ${R.i.firstSolutionStep}; its line is a derived expression on ${R.i.derived} and a bare value on ${R.i.bareFirst}`);
  const mean = o => (o.pages ? (o.marks / o.pages).toFixed(2) : '-');
  L.push(`(h) same route, wrong last line, mean marks: as authored ${mean(R.h.route)} (${R.h.route.pages} pages), sides swapped ${mean(R.h.swap)}, moved to one side ${mean(R.h.onesided)}`);
  L.push(`(e) ${R.e.pages} pages: wrong answer at full ${R.e.wrongFull}, over N ${R.e.overN}, correct not full ${R.e.correctNotFull}, earned on an unticked line ${R.e.unticked}, at or after a cross ${R.e.afterCross}, answer criterion earned by working ${R.e.finalByLines}, table not the mark ${R.e.tableNotMark}, not paid ${R.e.notPaid}`);
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const R = await runSweep({ seeds: Number(process.env.GENERIC_SEEDS || 40) });
  console.log(report(R));
  console.log(`violations: ${R.violations.length}`);
  for (const v of R.violations.slice(0, 15)) console.log('  VIOLATION', JSON.stringify(v).slice(0, 400));
  console.log(`coincidences: ${R.coincidences.length}`);
  for (const e of R.coincidences.slice(0, 6)) console.log('  COINCIDENCE', JSON.stringify(e).slice(0, 500));
  console.log(`exceptions: ${R.exceptions.length}`);
  for (const e of R.exceptions.slice(0, 12)) console.log('  EXCEPTION', JSON.stringify(e).slice(0, 700));
  console.log('\nby topic: payable questions, marks the rule can pay on a wrong answer (u) against N - 1');
  for (const [k, v] of [...R.byTopic].sort()) console.log(`  ${k.padEnd(44)} ${String(v.questions).padStart(5)} questions, ${String(v.payable).padStart(5)} payable, u ${v.marksSum} of N-1 ${v.nm1}`);
}
