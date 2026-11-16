// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk's attempt export (plan F5), exportVersion 2
//
// A superset of the public site's version 1 with the app as its source. It is
// the student's own record of an UNMARKED sitting: the time ledger, flags, done
// marks and notes. It carries `grading: "none — …"` and the fixed unmarked
// line, and no field that could hold a mark. Nothing reads version 2 as a mark;
// the import refuses it (engine/deskImport.js), because it is already in the
// account it came from.
// ─────────────────────────────────────────────────────────────────────────────
import { EDITION } from '../platform/edition.js';
import { GRADING_LINE, UNMARKED_LINE } from '../lib/exportFile.js';
import { entryOf, timeLedger } from './deskState.js';

export const DESK_EXPORT_VERSION = 2;

/** The export of one attempt: `questions` as the page shows them, `clock` its derived clock. */
export function composeDeskExport({ attempt, clock, questions, groups }) {
  const paper = attempt.paper;
  const ledger = timeLedger(paper, clock, questions, groups);
  const out = {};
  for (let q = 1; q <= paper.questionCount; q++) {
    const e = entryOf(questions, q);
    if (e.done || e.flagged || e.note || e.ms > 0) out[String(q)] = { done: e.done === true, flagged: e.flagged === true, ms: e.ms, note: e.note };
  }
  const keys = Object.keys(out);
  return {
    exportVersion: DESK_EXPORT_VERSION,
    source: 'app',
    edition: EDITION,
    grading: GRADING_LINE,
    notice: UNMARKED_LINE,
    resource: { id: attempt.resource.id, title: String(attempt.resource.title || paper.title || '') },
    paper: { questionCount: paper.questionCount, readingMinutes: paper.readingMinutes || 0, workingMinutes: paper.workingMinutes },
    state: attempt.state === 'finished' ? 'finished' : 'open',
    time: { allottedMs: ledger.allottedMs, workingMs: ledger.workingMs, readingMs: ledger.readingMs, pausedMs: ledger.pausedMs, overtimeMs: ledger.overtimeMs },
    questions: out,
    tallies: {
      done: keys.filter(k => out[k].done).length,
      flagged: keys.filter(k => out[k].flagged).length,
      notes: keys.filter(k => out[k].note).length
    }
  };
}
