// Pri Learning · the sweep of the bank rule (server/platform/bankSteps.js), approved in THIS PROCESS ONLY
//
//   node tools/bank-steps-sweep.mjs                 every eligible bank part of the committed pack: print the numbers and every exception
//   BANK_LIMIT=40 node tools/bank-steps-sweep.mjs   the first 40 eligible parts only
//
// The rule is never approved in the repository. This passes an approved list to the pay function (the author-approved tier, Prithagoras,
// PRI_METHOD_MARKS=on, as a plain object: no environment is touched), over pages made from each eligible part's own worked steps:
//   a  only the final line wrong (his lines, the last one made wrong, a wrong typed answer): the marks
//   b  his lines in full: the right answer earns N, a wrong typed answer never does
//   c  ONE MIDDLE LINE made wrong, then his lines (every line before the last, in turn): nothing at or after the wrong line
//   d  gaming, each of which must earn 0: the question restated; its given numbers; a plain-word false claim then his lines; a digit-free claim
//      then his lines; the same lines under a different question (the next eligible part of the topic: a coincidence is listed, not hidden)
//   e  bare intermediate values: alone (0) and after his lines before them (only the criterion that value is)
//   f  a trap answer with his working up to the trap (every prefix of his lines, typed the trap)
//   g  invariants on every page: never N on a wrong or blank answer, never above N, nothing on an unticked line or at or after a crossed line,
//      the answer criterion never earned by working, the table equals the marks
// A VIOLATION is any breach of g, or a mark in c (at or after the wrong line), or in a gaming class that must earn 0.
import { stepEvidence, marksPossibleFor, practiceMarksEarned } from '../server/platform/markerOps.js';
import { schemePay } from '../server/platform/schemeAward.js';
import { BANK_ID, bankDigest, bankPlan, bankAuthoredLines } from '../server/platform/bankSteps.js';
import { checkBankAnswer } from '../server/platform/qbankMarking.js';
import { qbankEntries, qbankEntryQuestion } from '../server/platform/qbankPack.js';
import { falsify, stillTrue } from './generic-steps-sweep.mjs';
import { acceptedInput, trapInput } from './qbank-import.mjs';
import { _internals } from '../client/src/engine/solutionMatch.js';

export const LIST = [{ typeId: BANK_ID, digest: bankDigest() }];
export const ENV = { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' };
const WRONG = '99991';

/** Mark one page the way the server does for a stamped bank part (practice.js): the rule's partial only when it paid and the answer is wrong. */
export function markPage(q, lines, typed) {
  const N = marksPossibleFor(q);
  const result = checkBankAnswer(q, typed);
  const ev = stepEvidence(q, typed, lines.join('\n'), result, { slipWarnings: true });
  const correct = result.correct === true;
  const pay = schemePay({ q, report: ev.stepReport || null, topic: ev.topicTicks ?? null, correct, marksPossible: N, env: ENV, list: LIST });
  const marks = pay.paid ? practiceMarksEarned(q, result, { ...ev, partial: !correct ? pay.partial : null }, N) : 0;
  return { N, result, correct, ev, pay, marks, lines: ev.stepReport?.lines || [] };
}

/** Every eligible bank part of the INSTALLED pack, as the practice path issues it and stamped with the rule: [{ q, id, family }]. */
export function eligibleParts({ limit = 0 } = {}) {
  const out = [];
  for (const { entry, family } of qbankEntries()) {
    if (entry.marks < 2) continue;
    const q = qbankEntryQuestion(entry.id, 17);
    if (!bankPlan(q).eligible) continue;
    out.push({ q: { ...q, _methodScheme: BANK_ID }, id: entry.id, family });
    if (limit && out.length >= limit) break;
  }
  return out;
}

const numerals = text => [...String(text).matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]);
const promptLines = q => [...String(q.prompt).replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)].map(m => { try { return _internals.spanToPlain(m[1]); } catch { return null; } }).filter(Boolean);
const DIGIT_FREE_CLAIMS = ['x > y', 'x equals seven', 'a is greater than b', 'x ≈ y'];
const PLAIN_WORD_CLAIMS = ['the gradient is clearly negative here', 'the function is increasing everywhere', 'both roots are positive'];

export function runSweep({ limit = 0 } = {}) {
  const items = eligibleParts({ limit });
  const R = {
    parts: 0, pages: 0, byClass: new Map(), a: { pages: 0, dist: new Map() }, b: { full: 0, fullPages: 0, wrongAtN: 0, wrongPages: 0 },
    c: { pages: 0, marks: 0, ideal: 0, afterWrong: 0 }, f: { pages: 0, marks: 0, atN: 0 }, e: { alone: 0, aloneEarned: 0, after: 0, afterEarned: 0, afterOwn: 0, afterOther: 0 },
    g: { pages: 0, wrongFull: 0, overN: 0, correctNotFull: 0, unticked: 0, afterCross: 0, answerByWorking: 0, tableNotMark: 0, notPaid: 0 },
    coincidences: [], exceptions: [], violations: []
  };
  const klass = name => { if (!R.byClass.has(name)) R.byClass.set(name, { pages: 0, earned: 0, exceptions: 0 }); return R.byClass.get(name); };
  const viol = (kind, q, extra = {}) => { if (R.violations.length < 40) R.violations.push({ kind, id: q._bank, ...extra }); else R.violations.push({ kind }); };
  const check = (q, page, label) => {
    R.pages++; R.g.pages++;
    const { N, correct, pay, marks, lines } = page;
    if (!pay.paid) { R.g.notPaid++; viol('not-paid', q, { label, reason: pay.reason }); return; }
    if (marks > N) { R.g.overN++; viol('over-N', q, { label }); }
    if (!correct && marks >= N) { R.g.wrongFull++; viol('wrong-answer-full', q, { label, marks }); }
    if (correct && marks !== N) { R.g.correctNotFull++; viol('correct-not-full', q, { label, marks }); }
    const cross = lines.findIndex(l => l?.status === 'break');
    let sum = 0;
    for (const it of pay.items) {
      if (it.awarded) sum += it.marks;
      if (!correct) for (const n of it.lines) {
        if (!it.awarded) continue;
        const l = lines[n - 1];
        if (!(l && l.status === 'ok' && l.ecf !== true && l.given !== true)) { R.g.unticked++; viol('earned-on-unticked-line', q, { label, n }); }
        if (cross >= 0 && n - 1 >= cross) { R.g.afterCross++; viol('earned-at-or-after-cross', q, { label, n, cross: cross + 1 }); }
      }
    }
    const answerItem = pay.items.find((it, i) => bankPlan(q).specs[i]?.kind === 'answer');
    if (!correct && answerItem && answerItem.awarded) { R.g.answerByWorking++; viol('answer-criterion-by-working', q, { label }); }
    if (!correct && sum !== marks) { R.g.tableNotMark++; viol('table-not-mark', q, { label, sum, marks }); }
  };

  const nextOf = new Map(); { const last = new Map(); for (const it of items) { if (last.has(it.family)) nextOf.set(last.get(it.family), it); last.set(it.family, it); } }
  for (const it of items) {
    const { q } = it;
    R.parts++;
    const N = marksPossibleFor(q);
    const lines0 = bankAuthoredLines(q);
    const texts = lines0.map(l => l.text);
    if (!texts.length) continue;
    const typedRight = acceptedInput({ answerType: q.answerType, answer: q.answer });
    const lastIdx = texts.length - 1;

    // b: his lines in full
    const full = markPage(q, texts, typedRight); check(q, full, 'b-full-right');
    R.b.fullPages++; if (full.correct && full.marks === N) R.b.full++; else viol('full-working-not-N', q, { marks: full.marks, correct: full.correct });
    const wrongTyped = markPage(q, texts, WRONG); check(q, wrongTyped, 'b-full-wrong-typed');
    R.b.wrongPages++; if (wrongTyped.marks >= N) { R.b.wrongAtN++; viol('wrong-typed-at-N', q); }
    check(q, markPage(q, texts, ''), 'b-full-blank-final');

    // a: only the final line wrong
    {
      const bad = falsify(texts[lastIdx]);
      const lines = bad && bad !== texts[lastIdx] ? texts.map((t, i) => (i === lastIdx ? bad : t)) : texts;
      const a = markPage(q, lines, WRONG); check(q, a, 'a-final-wrong');
      R.a.pages++; R.a.dist.set(a.marks, (R.a.dist.get(a.marks) || 0) + 1);
    }

    // c: one middle line made wrong, then his lines. Nothing at or after it. `ideal`: the criteria whose own line stands before it in his working.
    const plan = bankPlan(q);
    const ownLine = new Map();   // criterion index -> the index of his line that earns it, from the page of his full working
    for (const [i, j] of markPage(q, texts, WRONG).pay.items.map((x, i) => [i, x.lines[0] ? x.lines[0] - 1 : -1])) if (j >= 0) ownLine.set(i, j);
    for (let idx = 0; idx < lastIdx; idx++) {
      const bad = falsify(texts[idx]);
      if (!bad || bad === texts[idx] || stillTrue(texts[idx], bad)) continue;
      const lines = texts.map((t, i) => (i === idx ? bad : t));
      const c = markPage(q, lines, WRONG); check(q, c, `c-wrong-middle-line-${idx + 1}`);
      const ideal = [...ownLine].filter(([i, j]) => j < idx).reduce((n, [i]) => n + plan.specs[i].marks, 0);
      R.c.pages++; R.c.marks += c.marks; R.c.ideal += Math.min(ideal, N - 1);
      const late = c.pay.paid ? c.pay.items.filter(x => x.awarded && x.basis === 'lines' && x.lines.some(n => n - 1 >= idx)) : [];
      if (late.length) { R.c.afterWrong++; viol('earned-at-or-after-the-wrong-line', q, { idx: idx + 1, earned: late.map(x => [x.text, x.lines]) }); }
    }

    // d: gaming. Every page has a wrong typed answer, so every mark must be by lines.
    const gaming = (name, lines, { coincidence = false } = {}) => {
      if (!lines.length) return;
      const g = markPage(q, lines, WRONG); check(q, g, `d-${name}`);
      const kc = klass(name); kc.pages++;
      if (g.marks > 0) {
        kc.earned++;
        const row = { class: name, id: q._bank, prompt: q.prompt, lines, earned: g.pay.items.filter(x => x.awarded).map(x => [x.text, x.lines]), marks: g.marks };
        if (coincidence) { R.coincidences.push(row); kc.coincidences = (kc.coincidences || 0) + 1; }
        else { kc.exceptions++; R.exceptions.push(row); viol(`gaming-${name}-earned`, q, { lines, marks: g.marks }); }
      }
    };
    gaming('restate-the-question', promptLines(q));
    gaming('given-numbers', numerals(String(q.prompt)).filter((v, i, a) => a.indexOf(v) === i));
    for (const claim of PLAIN_WORD_CLAIMS) gaming('plain-word-false-claim-then-his-lines', [claim, ...texts]);
    for (const claim of DIGIT_FREE_CLAIMS) gaming('digit-free-claim-then-his-lines', [claim, ...texts]);
    {
      const other = nextOf.get(it);
      const otherTexts = other && other.q.prompt !== q.prompt ? bankAuthoredLines(other.q).map(l => l.text).filter(t => !texts.some(a => a.replace(/[\s()]/g, '') === t.replace(/[\s()]/g, ''))) : [];
      gaming('another-questions-working', otherTexts, { coincidence: true });
    }

    // e: bare intermediate values (the number at the end of each of his lines)
    {
      const vals = [...new Set(texts.slice(0, lastIdx).map(t => t.split('=').pop().trim()).filter(v => /^-?\d+(?:\.\d+)?$/.test(v)))].slice(0, 4);
      for (const v of vals) {
        const at = texts.findIndex(t => t.split('=').pop().trim() === v);
        const alone = markPage(q, [v], WRONG); check(q, alone, 'e-bare-alone'); R.e.alone++;
        if (alone.marks > 0) { R.e.aloneEarned++; R.exceptions.push({ class: 'bare-value-alone', id: q._bank, lines: [v], marks: alone.marks }); viol('bare-value-alone-earned', q, { v }); }
        const after = markPage(q, [...texts.slice(0, at), v], WRONG); check(q, after, 'e-bare-after-lines'); R.e.after++;
        if (after.marks > 0) {
          R.e.afterEarned++;
          const own = after.pay.items.some(x => x.awarded && x.lines.includes(at + 1));
          if (own) R.e.afterOwn++; else R.e.afterOther++;   // the bare line itself earned a criterion, or only the lines before it did
        }
      }
    }

    // f: a trap answer with his working up to the trap
    for (const t of q.traps || []) {
      const typed = trapInput(t);
      if (typed === null) continue;
      for (let k = 0; k <= texts.length; k++) {
        const f = markPage(q, texts.slice(0, k), typed); check(q, f, `f-trap-after-${k}-lines`);
        R.f.pages++; R.f.marks += f.marks; if (f.marks >= N) R.f.atN++;
      }
    }
  }
  return R;
}

const mapStr = m => [...m].sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}:${v}`).join(' ');
export function report(R) {
  const L = [];
  L.push(`bank rule: ${R.parts} eligible parts swept, ${R.pages} pages marked`);
  L.push(`(a) final line wrong, ${R.a.pages} pages: marks ${mapStr(R.a.dist)}`);
  L.push(`(b) his lines in full: the right answer earned N on ${R.b.full} of ${R.b.fullPages}; a wrong typed answer at N on ${R.b.wrongAtN} of ${R.b.wrongPages}`);
  L.push(`(c) one middle line made wrong then his lines: ${R.c.pages} pages, marks ${R.c.marks} against an ideal of ${R.c.ideal}; earned by a line at or after the wrong one ${R.c.afterWrong}`);
  for (const [k, v] of R.byClass) L.push(`(d) ${k}: ${v.pages} pages, earned a mark on ${v.earned}, exceptions ${v.exceptions}${v.coincidences ? `, coincidences (his criterion line is also true for this question) ${v.coincidences}` : ''}`);
  L.push(`(e) bare intermediate values: alone ${R.e.alone} pages, earned ${R.e.aloneEarned}; after his lines before them ${R.e.after} pages, earned ${R.e.afterEarned} (the bare line itself earned a criterion on ${R.e.afterOwn}; on ${R.e.afterOther} only the true lines before it earned)`);
  L.push(`(f) a trap answer with his working up to it: ${R.f.pages} pages, marks ${R.f.marks}, at N on ${R.f.atN}`);
  L.push(`(g) ${R.g.pages} pages: wrong answer at full ${R.g.wrongFull}, over N ${R.g.overN}, correct not full ${R.g.correctNotFull}, earned on an unticked line ${R.g.unticked}, at or after a cross ${R.g.afterCross}, answer criterion by working ${R.g.answerByWorking}, table not the mark ${R.g.tableNotMark}, not paid ${R.g.notPaid}`);
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.env.PRI_EDITION = 'prithagoras';
  const qb = await import('../server/platform/qbankPack.js');
  await qb.ensureQbank(process.env, { strict: true });
  const R = runSweep({ limit: Number(process.env.BANK_LIMIT || 0) });
  console.log(report(R));
  console.log(`violations: ${R.violations.length}`);
  for (const v of R.violations.slice(0, 20)) console.log('  VIOLATION', JSON.stringify(v).slice(0, 400));
  console.log(`coincidences: ${R.coincidences.length}`);
  for (const e of R.coincidences.slice(0, 6)) console.log('  COINCIDENCE', JSON.stringify(e).slice(0, 500));
  console.log(`exceptions: ${R.exceptions.length}`);
  for (const e of R.exceptions.slice(0, 12)) console.log('  EXCEPTION', JSON.stringify(e).slice(0, 700));
}
