// Pri Learning · are method marks safe to switch on? A measurement, not a switch.
//
// For each question type that has a scheme (server/platform/schemeAward.js; the generic rubric is measured here, the scheme in method-marks-scheme-check) this builds many pages
// (the draft's own full / partial / zero / earlier-slip transcripts, the understanding-audit corpus transcripts, and a page
// with one line falsified at each position), marks every page through the server's own evidence path with method marks ON
// (markerOps.stepEvidence + practiceMarksEarned, exactly what MARKER_OPS.practice runs when `policy.methodMarks === true`;
// nothing here reads or sets PRI_METHOD_MARKS, and no environment is touched), and counts where the marks and the page the
// student sees disagree.
//
// Each page is marked twice over: as written (the ones the student's question is worth) and as a four-mark copy of the same
// question (`stress`), because most of these questions carry one mark, and a one-mark question pays no method mark at all
// (cap = marks - 1), which would hide every disagreement the cap makes impossible to see.
//
// The counts (a page is counted once per category):
//   disagree     a line that earned a method mark is not shown as a tick on the page the student sees
//   afterCross   a line that earned a method mark stands at or after the line the page crosses (first wrong step)
//   over         the method marks awarded exceed the number of lines that earned them AND are shown as ticks before any cross
//   correctLess  the final answer is right and the mark is below the marks possible
//   wrongPays    a line known to be wrong, or known to follow from an earlier wrong line, earned a method mark
//   afterUnseen  a line known to be wrong is not crossed (the engine cannot judge it) and a mark is paid below it
//   afterBreak   a line after the first mistake of the report that decided the marks earned a method mark (error carried forward)
//   falseTick    the first line known to be wrong (a falsified line, or the corpus's slip, whose truth is computed apart from the engine)
//                is shown as a plain tick; a constructed wrong METHOD whose statement happens to hold (P(2) = P(3)) is not a wrong line
//   heldBack     a line the page ticks that earned no method mark (it is said, below: contradicts / residual)
//   contradicts  a reason given for the marks ("where the marks went") points at a line the page shows differently
//   unflagged    ... and the reply would not tell the card so (no markingReport), so the card could not fix the sentence
//   residual     ... and the card's own wording (lostMarksForPage) still contradicts the page after it ran
//
// Deterministic: fixed seeds, no clock, no network, no model.
import * as G from '../client/src/engine/generators/index.js';
import { stepEvidence, marksPossibleFor, practiceMarksEarned } from '../server/platform/markerOps.js';
import { checkAnswer } from '../client/src/engine/checker.js';
import { transcriptsFor } from './understanding-audit/corpus.mjs';
import { TYPES } from './method-marks-drafts.mjs';
import { reconcileLostRows, displayOnlyCross } from '../client/src/engine/markExplanation.js';
import { lostMarksForPage } from '../client/src/components/attemptEvidence.js';

export const SEED_LIMIT = 60;
export const TYPE_IDS = TYPES.map(t => t.id);

const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };

/** The questions of one type: every difficulty, seeds 1..SEED_LIMIT, each distinct prompt once. */
export function questionsOfType(type, { limit = Infinity } = {}) {
  const out = []; const seen = new Set();
  for (const fam of type.families) for (let d = 1; d <= 4; d++) for (let s = 1; s <= SEED_LIMIT; s++) {
    if (out.length >= limit) return out;
    let q; try { q = G.generateQuestion(fam, d, s); } catch { continue; }
    if (!q || seen.has(q.prompt)) continue;
    let ok = false; try { ok = !!type.pick(q); } catch { ok = false; }
    if (ok) { seen.add(q.prompt); out.push(q); }
  }
  return out;
}

/** A question worth four marks, whatever it was worth: the same prompt, key and checker, a four-step rubric. */
export const asFourMarks = q => ({ ...q, difficulty: 4, steps: Array.from({ length: 4 }, (_, i) => ({ h: `Step ${i + 1}`, d: '' })) });

// The line `k` of a page with its last number raised by one: provably a different statement, so the page's first wrong line.
function falsify(text) {
  const eq = text.lastIndexOf('=');
  const head = eq >= 0 ? text.slice(0, eq + 1) : '';
  const body = eq >= 0 ? text.slice(eq + 1) : text;
  const m = [...body.matchAll(/\d+/g)].pop();
  if (!m) return null;
  return head + body.slice(0, m.index) + (Number(m[0]) + 1) + body.slice(m.index + m[0].length);
}

/** The pages built for one question, each { source, lines, wrongFrom } where wrongFrom is the first line known to be wrong (null: none). */
export async function pagesFor(type, q) {
  const pages = [];
  const t = await type.build(q);
  if (t) {
    pages.push({ source: 'draft-full', lines: t.full, wrongFrom: null, wrong: [] });
    pages.push({ source: 'draft-partial', lines: t.partial, wrongFrom: t.partial.length - 1, wrong: [t.partial.length - 1] });
    pages.push({ source: 'draft-zero', lines: t.zero, wrongFrom: 0, wrong: t.zero.map((_, i) => i) });
    pages.push({ source: 'draft-slip', lines: t.slip, wrongFrom: 0, wrong: t.slip.map((_, i) => i) });
    // One line falsified at each position of the full page (the first wrong step: a crossed line and the lines after it).
    for (let k = 0; k < t.full.length; k++) {
      const bad = falsify(t.full[k]);
      if (bad && bad !== t.full[k]) pages.push({ source: 'draft-falsified', lines: t.full.map((l, i) => (i === k ? bad : l)), wrongFrom: k, wrong: [k] });
    }
  }
  let corpus = []; try { corpus = transcriptsFor(q); } catch { corpus = []; }
  for (const tr of corpus) {
    const lines = tr.lines.map(l => l.text);
    const w = tr.lines.findIndex(l => l.truth === 'break');
    pages.push({ source: `corpus-${tr.style}`, lines, wrongFrom: w >= 0 ? w : null, wrong: tr.lines.flatMap((l, i) => (l.truth === 'break' || l.truth === 'follows' ? [i] : [])) });
  }
  return pages;
}

const EMPTY = () => ({ pages: 0, withMethod: 0, creditedLines: 0, disagree: 0, afterCross: 0, over: 0, correctLess: 0, wrongPays: 0, afterBreak: 0, falseTick: 0, heldBack: 0, markingReport: 0, contradicts: 0, unflagged: 0, residual: 0, afterUnseen: 0 });

/** Mark one page with method marks on and compare the marks with what the student sees. */
export function judgePage(q, page, { reconcile = true } = {}) {
  const lines = page.lines;
  const answer = page.answer ?? finalOf(lines);
  const result = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), result, { slipWarnings: true, ...(reconcile ? {} : { reconcile: false }) });
  const possible = marksPossibleFor(q);
  const marks = practiceMarksEarned(q, result, ev, possible);
  const shown = ev.stepReport?.lines || [];
  const rows = ev.partial?.lines || [];
  const credited = rows.filter(r => r.mark > 0).map(r => r.index);
  const decidedLines0 = (ev.markingReport || ev.stepReport)?.lines || [];
  // A cross only the page makes (the first wrong step); a cross the deciding report also made is the rubric's own (an authored plan lets an independent stage earn).
  const shownBreak = displayOnlyCross(shown, decidedLines0);
  const tick = i => shown[i]?.status === 'ok';
  const out = { result, ev, marks, possible, credited, flags: {} };
  const f = out.flags;
  f.disagree = credited.some(i => !tick(i));
  f.afterCross = shownBreak >= 0 && credited.some(i => i >= shownBreak);
  // Error carried forward, as the policy has it: after the first mistake of the report that decided the marks, nothing earns.
  const decidedLines = (ev.markingReport || ev.stepReport)?.lines || [];
  const decidedBreak = decidedLines.findIndex(l => l?.status === 'break');
  f.afterBreak = decidedBreak >= 0 && credited.some(i => i > decidedBreak);
  const supported = credited.filter(i => tick(i) && (shownBreak < 0 || i < shownBreak)).length;
  f.over = !result.correct && (ev.partial?.awarded || 0) > supported;
  f.correctLess = result.correct === true && marks < possible;
  const wrong = page.wrong || [];
  f.wrongPays = !result.correct && credited.some(i => wrong.includes(i));
  // A known-wrong line the page does not cross (the engine cannot judge it) with a mark paid below it: said, not hidden.
  f.afterUnseen = !result.correct && page.wrongFrom !== null && shown[page.wrongFrom]?.status !== 'break' && credited.some(i => i > page.wrongFrom);
  // A mark held back from a line the page ticks must be said: the row carries a reason the page can show.
  const held = rows.filter(r => r.mark === 0 && tick(r.index) && r.reason === 'note');
  f.heldBack = held.length > 0;
  // The first line known to be wrong is never shown as a plain tick (a false tick); where the engine cannot judge it, it is a note.
  f.falseTick = page.wrongFrom !== null && shown[page.wrongFrom]?.status === 'ok' && shown[page.wrongFrom]?.ecf !== true && (page.source === 'draft-falsified' || page.source.startsWith('corpus-'));
  // The reasons given for the marks, against the page.
  const lost = ev.partial?.lost || [];
  f.contradicts = reconcileLostRows(lost, shown).rows !== lost;
  f.unflagged = f.contradicts && !ev.markingReport;
  // `reconcile: false` is the "before": the card of the day before (only a row naming a mistake the page does not show was dropped).
  const SLIP = { 'marks.lost.break': 'line', 'marks.lost.anotherBreak': 'line', 'marks.lost.afterBreak': 'breakLine', 'marks.lost.carried': 'breakLine', 'marks.lost.answerCarried': 'breakLine' };
  const cardRows = reconcile
    ? lostMarksForPage({ lost, stepReport: ev.stepReport, markingReportDiffers: !!ev.markingReport }).rows
    : (ev.markingReport ? lost.filter(l => !(SLIP[l?.key] && shown[Number(l.vars?.[SLIP[l.key]]) - 1]?.status !== 'break')) : lost);
  f.residual = reconcileLostRows(cardRows, shown).rows !== cardRows;
  return out;
}

// The owner's product-rule page (23 November 2026): the first wrong step is crossed by the page, not by the topic check.
export const OWNER_QUESTION = { id: 'owner-product-rule', answerType: 'expression', difficulty: 3, steps: [], answer: { expr: '3x^2-2x' },
  prompt: 'Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.' };
export const OWNER_HEAD = ['Differentiate y = x^2(x-1) using the product rule.', 'Let u = x^2 and v = x - 1.', "Then u' = 2x and v' = 1.", 'By the product rule,', "dy/dx = u'v + uv'", '= 2x(x-1) + x^2(1)', '= 2x(x-1) + x^2', '= 2x^2 - 2x + x^2'];
/** The page with one of lines 6..8 falsified, the lines after it true, and a wrong or a right last line, under the wrong typed answer. */
export function firstWrongStepPages() {
  const right = [...OWNER_HEAD, '= 3x^2 - 2x'];
  const out = [{ source: 'fws-owner', lines: [...OWNER_HEAD, '= 3x^2 - x'], answer: '3x^2-x', wrongFrom: 8, wrong: [8] }];
  for (let k = 5; k <= 7; k++) {
    const bad = falsify(right[k]);
    if (!bad || bad === right[k]) continue;
    out.push({ source: 'fws-falsified', lines: right.map((l, i) => (i === k ? bad : l)), answer: '3x^2-x', wrongFrom: k, wrong: [k] });
    out.push({ source: 'fws-falsified-wrong-last', lines: [...right.slice(0, 8).map((l, i) => (i === k ? bad : l)), '= 3x^2 - x'], answer: '3x^2-x', wrongFrom: k, wrong: [k, 8] });
  }
  return out;
}

/** The sweep: counts per type and in all, for the marks as written and as a four-mark copy. */
export async function runSweep({ reconcile = true, perType = Infinity, onlyTypes = null } = {}) {
  await G.loadAllBanks();
  const total = { asWritten: EMPTY(), stress: EMPTY() };
  const byType = {};
  const examples = [];
  for (const type of TYPES) {
    if (onlyTypes && !onlyTypes.includes(type.id)) continue;
    const row = { asWritten: EMPTY(), stress: EMPTY(), questions: 0 };
    for (const q of questionsOfType(type, { limit: perType })) {
      row.questions++;
      const pages = await pagesFor(type, q);
      for (const page of pages) for (const [mode, qq] of [['asWritten', q], ['stress', asFourMarks(q)]]) {
        let j; try { j = judgePage(qq, page, { reconcile }); } catch (e) { throw new Error(`${type.id} ${page.source}: ${e.message}`); }
        for (const acc of [row[mode], total[mode]]) {
          acc.pages++;
          if (j.ev.partial) acc.withMethod++;
          acc.creditedLines += j.credited.length;
          if (j.ev.markingReport) acc.markingReport++;
          for (const k of ['disagree', 'afterCross', 'over', 'correctLess', 'wrongPays', 'afterBreak', 'heldBack', 'falseTick', 'contradicts', 'unflagged', 'residual', 'afterUnseen']) if (j.flags[k]) acc[k]++;
        }
        for (const k of ['disagree', 'afterCross', 'over', 'correctLess', 'wrongPays', 'afterBreak', 'falseTick', 'contradicts', 'residual', 'afterUnseen']) if (j.flags[k] && examples.filter(x => x.kind === k).length < 4) examples.push({ type: type.id, mode, kind: k, source: page.source, lines: page.lines, marks: j.marks, awarded: j.ev.partial?.awarded, credited: j.credited, shown: (j.ev.stepReport?.lines || []).map(l => l.status) });
      }
    }
    byType[type.id] = row;
  }
  if (!onlyTypes) {
    const row = { asWritten: EMPTY(), stress: EMPTY(), questions: 1 };
    for (const page of firstWrongStepPages()) for (const [mode, qq] of [['asWritten', OWNER_QUESTION], ['stress', asFourMarks(OWNER_QUESTION)]]) {
      const j = judgePage(qq, page, { reconcile });
      for (const acc of [row[mode], total[mode]]) {
        acc.pages++; if (j.ev.partial) acc.withMethod++; acc.creditedLines += j.credited.length; if (j.ev.markingReport) acc.markingReport++;
        for (const k of ['disagree', 'afterCross', 'over', 'correctLess', 'wrongPays', 'afterBreak', 'heldBack', 'falseTick', 'contradicts', 'unflagged', 'residual', 'afterUnseen']) if (j.flags[k]) acc[k]++;
      }
    }
    byType['first-wrong-step'] = row;
  }
  return { total, byType, examples };
}

export const CATEGORIES = ['disagree', 'afterCross', 'over', 'correctLess', 'wrongPays', 'afterBreak', 'falseTick', 'contradicts', 'unflagged', 'residual', 'afterUnseen'];
export const printCounts = (label, r) => {
  const line = (name, a) => `  ${name.padEnd(10)} pages ${String(a.pages).padStart(6)}  paying ${String(a.withMethod).padStart(5)}  credited lines ${String(a.creditedLines).padStart(5)}  ` + CATEGORIES.map(k => `${k} ${a[k]}`).join('  ') + `  heldBack ${a.heldBack}  markingReport ${a.markingReport}`;
  console.log(`${label}\n${line('as written', r.total.asWritten)}\n${line('4-mark', r.total.stress)}`);
};
