// Pri Learning — what a correct answer earned, said plainly (audit #5).
//
// Deterministic from what the attempt already records: whether hints were
// used, which try it was, which lines of working checked out, and the next
// difficulty. Returns kinds and parameters (for the interface's strings) and
// an English sentence. No praise is invented: each clause names a fact.

/**
 * @param {object} a { attempt: 1-based try, hintLevel: rungs opened, stepReport, difficulty, maxDifficulty }
 * @returns {{ kinds: string[], text: string, next: { difficulty: number } | null }}
 */
export function praiseFor(a = {}) {
  const kinds = [];
  const parts = [];
  const attempt = Number(a.attempt) || 1, hints = Number(a.hintLevel) || 0;
  if (attempt === 1 && hints === 0) { kinds.push('first-try-unaided'); parts.push('first try, with no hints'); }
  else if (hints === 0) { kinds.push('unaided'); parts.push('with no hints'); }
  else if (attempt === 1) { kinds.push('first-try'); parts.push('first try'); }
  const lines = Array.isArray(a.stepReport?.lines) ? a.stepReport.lines : [];
  const ok = lines.filter(l => l?.status === 'ok').length;
  const milestones = lines.filter(l => l?.status === 'ok' && l.milestone).length;
  if (ok && !lines.some(l => l?.status === 'break')) {
    kinds.push('working-checks-out');
    const lead = parts.length ? 'and ' : '';
    parts.push(ok === 1 ? `${lead}your working line checks out` : `${lead}all ${ok} checked lines of working hold`);
    if (milestones) kinds.push('method-steps');
  }
  const d = Number(a.difficulty), max = Number(a.maxDifficulty) || 4;
  const next = Number.isInteger(d) && hints === 0 && attempt === 1 && d < max ? { difficulty: d + 1 } : null;
  if (next) kinds.push('step-up');
  const head = parts.length ? `Correct — ${parts.join(' ')}.` : 'Correct.';
  return { kinds, text: next ? `${head} Ready for a harder one on the same idea?` : head, next };
}

/** The neutral line for a question that checks the answer only. */
export const ANSWER_ONLY_NOTE = 'Pri checked the answer; this question does not check working line by line.';
