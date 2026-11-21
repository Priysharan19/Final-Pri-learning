// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · the engine's FINAL verdicts, normalised
//
// Input: the step report the engine already produced (after the interpreter's
// verdicts were folded in) and the reading's per-line states. Output: one record
// per line that carries a FINAL verdict, with a CLOSED state. Nothing here
// decides anything new; it only names what the engine said so the comment layer
// (and its constraints) can hold a model to it.
//
// A comment is only ever asked for a line the page already shows as a tick or a
// cross with a state:
//
//   verified       the engine proved the line true (named rule, or the question's own solution)
//   from-question  the line restates something the question gave
//   condition      a stated condition (nothing to check)
//   arithmetic     the line is TRUE AS WRITTEN. The engine did not say it is the right step for the question.
//   first-error    the engine's first error (exactly one per answer at most)
//
// Everything else gets no record, so it gets no comment, and the page keeps the engine's own sentence:
// a note that says Pri could not check the line, a line that follows from the first error, an
// incomplete line, a line the reading floor left out, a warning note.
// ─────────────────────────────────────────────────────────────────────────────
import { annotateWorking } from '../../../client/src/engine/stepJustify.js';

export const COMMENTED_STATES = Object.freeze(['verified', 'from-question', 'condition', 'arithmetic', 'first-error']);
export const MAX_COMMENT_LINES = 40;

const text = v => String(v ?? '');
const clip = (s, n) => text(s).replace(/\s+/g, ' ').trim().slice(0, n);

/** The final-verdict state of one report line, or null when the line has none (no comment may be asked for). */
export function finalStateOf(l, { isFirstBreak = false } = {}) {
  if (!l || typeof l !== 'object') return null;
  if (isFirstBreak && l.status === 'break') return 'first-error';
  if (l.status !== 'ok' || l.unverified === true || l.unreadable === true) return null;
  switch (l.state) {
    case 'arithmetic': return 'arithmetic';
    case 'given': return 'from-question';
    case 'condition': return 'condition';
    case 'verified': case undefined: case null: return 'verified';
    default: return null;   // incomplete, unverified, unread, wrong-without-break ...
  }
}

/**
 * @param {{ stepReport: object|null, readStates?: string[]|null }} input
 *   readStates: the reply's reading.lineStates ('judged' | 'not-read'), aligned with the lines
 * @returns {{ lines: object[], firstError: number }}
 */
export function buildLineStates({ stepReport, readStates = null } = {}) {
  const report = Array.isArray(stepReport?.lines) ? stepReport.lines.slice(0, MAX_COMMENT_LINES) : [];
  let firstBreak = report.findIndex(l => l?.status === 'break');
  const texts = report.map(l => text(l?.text));
  let rulesByLine = [];
  try {
    const ann = report.length >= 2 ? annotateWorking(texts, {}) : null;
    rulesByLine = (ann?.lines || []).map(a => {
      const rules = [];
      for (const s of a.steps || []) {
        const j = s.justification;
        if (!j?.valid) continue;
        for (const r of j.rules || []) if (!rules.some(x => x.rule === r.rule)) rules.push({ rule: String(r.rule), latex: typeof r.latex === 'string' ? r.latex.slice(0, 300) : null });
      }
      return rules.slice(0, 2);
    });
  } catch { rulesByLine = []; }
  const lines = [];
  report.forEach((l, i) => {
    if (readStates && (readStates[i] === 'not-read' || readStates[i] === 'cant')) return;
    const state = finalStateOf(l, { isFirstBreak: i === firstBreak });
    if (!state) return;
    const base = { index: i, n: i + 1, text: texts[i], rules: rulesByLine[i] || [], valueRule: l?.valueChain?.rule || null, note: clip(l?.note, 400) || null, solutionMatched: l?.solutionMatch === true };
    if (state === 'first-error') {
      const d = l.diagnosis || null;
      lines.push({
        ...base, state, reason: { code: d?.code || null, title: d?.title || null, message: text(d?.message || l.note || ''), fix: d?.fix || null, confidence: d?.confidence || null },
        previousText: i > 0 && report[i - 1]?.status === 'ok' ? texts[i - 1] : null
      });
    } else lines.push({ ...base, state, reason: base.note });
  });
  return { lines, firstError: firstBreak >= 0 ? firstBreak + 1 : 0, allTexts: texts };
}
