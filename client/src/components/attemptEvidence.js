// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a marked attempt may truthfully be said to show.
//
// Two staging defects, one cause: the card inferred things about the student's
// working that nothing had established.
//
//   A · A right final answer was presented as "every line of your working was
//       checked and verified", with a tick on the last ink line — when the
//       reader had misread the page and the server had marked only the answer
//       the student typed.
//   B · After a wrong answer, the previous attempt's markers stayed attached to
//       newly written ink that had never been submitted.
//
// The rules here are pure and have no React in them, so they are tested
// directly (test/truthful-feedback-check.mjs):
//
//   1. Three values stay separate: the reader's transcript, the answer the
//      student confirmed, and the answer the server marked (the confirmed one,
//      under a matched submission id). Nothing here ever derives one of them
//      from another.
//   2. Something positive is said about a line of working only when the
//      server's step report for THIS submission says so about THAT line.
//      A report that is absent, or is not of exactly the submitted lines, is
//      no evidence, and the card then says the working was not checked.
//   3. Every annotation belongs to one judged revision of the page: the
//      question, the submission, the ink, the transcript and the answer as
//      they stood when Submit was pressed. Once any of them changes, the
//      annotations of that submission are no longer about what is on screen.
// ─────────────────────────────────────────────────────────────────────────────

const clean = v => String(v ?? '').trim();

/** The same written lines, in the same order. */
export function sameLines(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length
    && a.every((line, i) => clean(line) === clean(b[i]));
}

/**
 * The server's step report, only if it is a report of exactly these lines.
 * The engine reports the non-blank lines of the working it was sent, in
 * order, each with its own text — so a report can be matched to the lines
 * that were submitted, and one that does not match is not used.
 */
export function reportForLines(report, lines) {
  if (!report || !Array.isArray(report.lines) || !Array.isArray(lines)) return null;
  const written = lines.map(clean).filter(Boolean);
  if (!written.length || report.lines.length !== written.length) return null;
  if (!report.lines.every((l, i) => clean(l?.text) === written[i])) return null;
  return report;
}

/**
 * What the server established about the working of a resolved attempt.
 *
 *   null                — nothing to say (no working was submitted, the answer
 *                         was revealed, or the result is not a marked one)
 *   { kind: 'none' }    — working was submitted and nothing verified it
 *   { kind: 'all', total }            — every submitted line was checked and holds
 *   { kind: 'some', ok, total }       — some lines hold, the rest were not checked
 *   { kind: 'break', line, ok, total }— a line was checked and does not hold
 *
 * `ok` means what the engine means by it: the line is consistent with the
 * solution of the question. It is not a claim that each line follows from the
 * one before, and no copy built on this may say so.
 */
export function workingEvidence({ res, submitted } = {}) {
  if (!res || res.invalid || res.revealed || !submitted?.hasWorking) return null;
  const lines = Array.isArray(submitted.lines) ? submitted.lines : null;
  if (!lines?.length) return null;
  if (res.workingNotRead === true) return { kind: 'none' };
  const report = reportForLines(res.stepReport, lines);
  if (!report) return { kind: 'none' };
  const total = report.lines.length;
  const ok = report.lines.filter(l => l.status === 'ok').length;
  const firstBreak = report.lines.findIndex(l => l.status === 'break');
  if (firstBreak >= 0) return { kind: 'break', line: firstBreak + 1, ok, total };
  if (ok === 0) return { kind: 'none' };
  if (ok === total) return { kind: 'all', total };
  return { kind: 'some', ok, total };
}

/** The i18n key and variables for the sentence about the working, or null. */
export function workingEvidenceCopy(evidence, { correct } = {}) {
  if (!evidence) return null;
  if (evidence.kind === 'none') return { key: 'verdict.workingNotChecked', vars: {} };
  if (evidence.kind === 'all') return { key: 'verdict.workingAllChecked', vars: { count: evidence.total, n: evidence.total } };
  if (evidence.kind === 'some') return { key: 'verdict.workingSomeChecked', vars: { count: evidence.total, ok: evidence.ok, total: evidence.total, n: evidence.total } };
  if (evidence.kind === 'break') return { key: correct ? 'verdict.workingBreakButCorrect' : 'verdict.workingBreak', vars: { line: evidence.line } };
  return null;
}

/**
 * Whether the answer that was submitted is, itself, the last written line.
 * Only then is the server's verdict on the answer a verdict on that line.
 * A question answered BY its working has no separate answer line.
 */
export function answerIsLastLine(submitted, { answeredByWorking = false } = {}) {
  if (answeredByWorking || !submitted?.viaInk) return false;
  const lines = Array.isArray(submitted.lines) ? submitted.lines : [];
  if (!lines.length) return false;
  return clean(submitted.answer) !== '' && clean(submitted.answer) === clean(lines[lines.length - 1]);
}

/**
 * Per-line marks for the ink surface: one entry per shown line, or null.
 *
 *   outcome   'retry-wrong' | 'resolved-wrong' | 'resolved-correct' | null
 *   live      the annotations still belong to what is on screen
 *
 * A line is 'ok' or 'break' only from the server's report of the submitted
 * lines. The last line is marked 'wrong' or 'ok' from the verdict on the
 * answer only when the submitted answer IS that line. Everything else is
 * 'unknown' and draws nothing.
 */
export function inkLineVerdicts({ outcome, res, submitted, shownLines, live = true, answeredByWorking = false } = {}) {
  if (!outcome || !live || !submitted?.viaInk) return null;
  const lines = Array.isArray(submitted.lines) ? submitted.lines : null;
  // The marks are drawn on the transcript on screen: it must be the one sent.
  if (!lines?.length || !sameLines(lines, shownLines)) return null;
  const report = reportForLines(res?.stepReport, lines);
  const base = lines.map((_, i) => {
    const l = report?.lines?.[i];
    return l && (l.status === 'ok' || l.status === 'break') ? { status: l.status, note: l.note } : { status: 'unknown' };
  });
  const last = base.length - 1;
  const answerLine = answerIsLastLine(submitted, { answeredByWorking });
  const hasBreak = base.some(v => v.status === 'break');
  if ((outcome === 'retry-wrong' || outcome === 'resolved-wrong') && answerLine && !hasBreak) {
    base[last] = { status: 'wrong', noteKind: outcome === 'resolved-wrong' ? 'conclude' : 'rework' };
  }
  if (outcome === 'resolved-correct' && answerLine && base[last].status !== 'break') {
    base[last] = { status: 'ok', note: base[last].note };
  }
  return base.some(v => v.status !== 'unknown') ? base : null;
}

/**
 * The revision of the page a submission is made from. Any difference between
 * two of these is a change the student made: a stroke, an erase, a clear, a
 * new or corrected reading, a different typed answer or working, another
 * input mode, another photo.
 */
export function revisionKey({ questionId, mode, inkSignature = null, inkStale = false, transcript = '', inkAnswer = '', answer = '', working = '', choice = null, photo = null } = {}) {
  const m = String(mode || '');
  return JSON.stringify([
    String(questionId ?? ''), m,
    m === 'write' ? [String(inkSignature ?? ''), inkStale === true, String(transcript ?? ''), clean(inkAnswer)] : null,
    m === 'write' ? null : [clean(answer), clean(working)],
    choice === null || choice === undefined ? null : String(choice),
    m === 'photo' ? (photo ? `${String(photo).length}:${String(photo).slice(-24)}` : '') : null
  ]);
}

/** A judged revision no longer describes the page once the page has moved on. */
export function annotationsLive({ judged, currentKey, latched = false } = {}) {
  if (!judged) return true;
  if (latched) return false;
  return judged.revision === currentKey;
}

/**
 * History: the reader's transcript is shown beside the handwriting, labelled
 * as a transcript. It is said to be the answer only when its last line is the
 * answer that was marked (or, for a question answered by its working, when
 * its lines are the lines that were marked).
 */
export function transcriptIsAnswer(transcript, answerGiven) {
  const lines = String(transcript ?? '').split('\n').map(clean).filter(Boolean);
  if (!lines.length) return false;
  const given = String(answerGiven ?? '').split('\n').map(clean).filter(Boolean);
  if (!given.length) return false;
  // A question answered by its working: the lines themselves were the answer.
  if (given.length > 1) return given.length === lines.length && given.every((l, i) => l === lines[i]);
  return lines[lines.length - 1] === given[0];
}
