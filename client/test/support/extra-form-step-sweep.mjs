// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · step-level marking of the forms a pinned seed does not name
//
// The sweeps that pin a question by (skill, difficulty, seed) and design wrong
// working for it (marker-adversarial-corpus, feedback-first-error-sweep) ask for
// each skill's DIRECT form (support/direct-forms.mjs), because their designed
// slips are written against it. That leaves every other form of a question —
// the Prithagoras capacity overlays (au-forms-apply.js) and the Priyabhata
// extra structural forms (generators/forms/) — without any step-level check.
//
// This module is that check. It draws, over the same cells and seeds, every
// question that is NOT the direct form and, for each one the server would
// step-mark (stepMetaFor), holds it to the invariants that hold for any such
// question whatever its shape:
//
//   · the keyed answer is correct and a different value is not;
//   · working that is the model line is not a break;
//   · working that is the model line with a changed value IS a break, at that
//     line, and is never read as correct;
//   · nothing that is only the prompt restated is verified work.
//
// A form with no step meta (every Priyabhata extra form today) is final-answer
// only: it is counted, not skipped silently, and a form that gains a plan is
// swept from then on without any change here.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer, stepCheck } from '../../src/engine/checker.js';
import { stepMetaFor } from '../../../server/platform/markerOps.js';
import * as generators from '../../src/engine/generators/index.js';

const keyText = q => {
  const a = q?.answer || {};
  if (q.answerType === 'expression') return a.expr;
  if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
  if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
  if (typeof a.value === 'number') return String(a.value);
  return null;
};

// Doubled, not shifted: an indefinite integral is right up to a constant, so "+ 1" is no change to it.
const bump = expr => `2*(${expr})`;

/**
 * @param {object} o
 *   cells      [{ id, difficulties }]   which skills to draw
 *   seeds      number[]                  fixed seeds
 *   seedOf     (id, d, seed) => seed     optional per-cell seed mapping
 * @returns {{ checks: number, failures: string[], questions: number, stepMarked: number, byKind: object }}
 */
export function sweepStepMarkingOfOtherForms({ cells, seeds }) {
  const failures = [];
  const mode = generators.directFormsOnly(true);   // put back on return: a suite that imports another keeps its own mode
  let checks = 0, questions = 0, stepMarked = 0;
  const byKind = {};
  const ok = (cond, label) => { checks++; if (!cond && failures.length < 60) failures.push(label); };
  for (const { id, difficulties = [1, 2, 3, 4] } of cells) {
    for (const d of difficulties) {
      for (const seed of seeds) {
        let q, direct;
        try {
          generators.directFormsOnly(false);
          q = generators.generateQuestion(id, d, seed);
          generators.directFormsOnly(true);
          direct = generators.generateQuestion(id, d, seed);
        } catch { continue; } finally { generators.directFormsOnly(true); }
        if (!q || q.prompt === direct?.prompt) continue;     // the direct form: swept by the suite itself
        questions++;
        const tag = `${id} D${d} seed ${seed}${q.form ? ` (form ${q.form})` : ''}`;
        const key = keyText(q);
        if (key != null) {
          ok(checkAnswer(q, key).correct === true, `${tag}: the keyed answer is correct`);
          if (typeof q.answer?.value === 'number') ok(checkAnswer(q, String(q.answer.value + 3.5)).correct !== true, `${tag}: a different value is not correct`);
        }
        const meta = stepMetaFor(q);
        if (!meta) continue;
        stepMarked++;
        byKind[meta.kind] = (byKind[meta.kind] || 0) + 1;
        const report = line => stepCheck(meta, line, { prompt: q.prompt });
        if (meta.kind === 'expression' || meta.kind === 'derivative') {
          const expr = q.answer?.expr;
          if (typeof expr !== 'string') continue;
          const right = report(expr);
          ok(right.firstBreak === -1, `${tag}: the model line "${expr}" is not a break (${JSON.stringify(right.lines.map(l => l.status))})`);
          const changed = report(bump(expr));
          // A changed expression is never verified work. It is crossed (a break at line 1) where the engine can tell it is
          // not a true step; where an authored restatement or an unsimplified true step of the question's own function
          // could stand on that line, the engine ABSTAINS (a note) rather than cross a true line (owner decision, 18 Nov
          // 2026: false crosses are worse than a missed one; understanding audit, 0 false crosses, 0 false ticks).
          const st = changed.lines[0]?.status;
          ok(st === 'break' ? changed.firstBreak === 0 : st === 'note' && changed.firstBreak === -1, `${tag}: "${bump(expr)}" is a break at line 1, or an abstention, never a tick (${JSON.stringify(changed.lines.map(l => l.status))})`);
          ok(checkAnswer(q, bump(expr)).correct !== true, `${tag}: a changed expression is not correct`);
        } else if (meta.kind === 'equation' && Array.isArray(meta.solutions) && meta.solutions.length === 1 && meta.variable) {
          const [s] = meta.solutions;
          const right = report(`${meta.variable} = ${s}`);
          ok(right.firstBreak === -1, `${tag}: the model line ${meta.variable} = ${s} is not a break (${JSON.stringify(right.lines.map(l => l.status))})`);
          const changed = report(`${meta.variable} = ${s + 1}`);
          ok(changed.firstBreak === 0, `${tag}: ${meta.variable} = ${s + 1} is a break at line 1 (${JSON.stringify(changed.lines.map(l => l.status))})`);
        }
        // Every kind: the prompt restated, or a bare wrong value, is never verified work.
        const restated = report(String(q.prompt).replace(/\$/g, ''));
        ok(restated.lines.every(l => l.status !== 'ok'), `${tag}: the prompt restated is not verified work (${JSON.stringify(restated.lines.map(l => l.status))})`);
        if (typeof q.answer?.value === 'number') {
          const bare = report(String(q.answer.value + 3.5));
          ok(bare.lines.every(l => l.status !== 'ok'), `${tag}: a bare wrong value is not verified work (${JSON.stringify(bare.lines.map(l => l.status))})`);
        }
      }
    }
  }
  generators.directFormsOnly(mode);
  return { checks, failures, questions, stepMarked, byKind };
}
