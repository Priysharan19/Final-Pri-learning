// Pri Learning — board mock papers ("Pri mock in board format").
//
// A board mock is a full-length CBSE Class X (Standard) or Class XII
// Mathematics paper built on the existing reference blueprints in
// indiaExams.js — the section structure, marks per question and internal
// choice of CBSE's published 2025-26 sample question papers — and issued,
// timed and marked by the server-authoritative exam router
// (server/platform/exams.js). It is NOT an official CBSE paper and is never
// called one: every surface labels it MOCK_LABEL. Provenance:
// docs/content/board-mock-papers.md.
//
// This file is shared by the server (which imports only client/src/engine)
// and the device. It holds:
//   · which blueprints a mock may be built on, and the mock's title;
//   · the free plan's sample allowance (the server enforces it);
//   · scriptLinesOf — the per-line margin marks and first-error line of one
//     response, read off the deterministic engine's own step report and
//     method-mark vector (it decides no mark: `awarded` is already final);
//   · mockScript — the returned result script, a pure view of a stored,
//     server-marked result.
import { indiaExamPaperSpec } from './indiaExams.js';

export const MOCK_LABEL = 'Pri mock in board format';

/** The blueprints a board mock may be built on: full papers CBSE sets at the board. */
export const BOARD_MOCK_BLUEPRINTS = Object.freeze([
  Object.freeze({ id: 'cbse-x-standard', track: 'cbse', grade: 10, variant: 'standard', name: 'Class X Mathematics (Standard, 041)' }),
  Object.freeze({ id: 'cbse-xii', track: 'cbse', grade: 12, variant: 'standard', name: 'Class XII Mathematics (041)' })
]);

/** The free plan's lifetime allowance of board mocks. Premium (`premium-exams`) is unlimited. */
export const FREE_SAMPLE_MOCKS = 1;

/** The board-mock entry for a blueprint selection, or null when no mock is built on it. */
export function boardMockOf(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') return null;
  const variant = blueprint.variant ?? 'standard';
  return BOARD_MOCK_BLUEPRINTS.find(m => m.track === blueprint.track && m.grade === blueprint.grade && m.variant === variant) || null;
}

/** The server's title for a board mock: the label first, never "CBSE paper". */
export function mockTitleOf(blueprint) {
  const mock = boardMockOf(blueprint);
  return mock ? `${MOCK_LABEL} · CBSE ${mock.name}` : null;
}

/** The blueprint spec a mock is sat under (sections, marks, choice, duration). */
export function mockSpecOf(blueprint) {
  const mock = boardMockOf(blueprint);
  return mock ? indiaExamPaperSpec({ track: mock.track, grade: mock.grade, variant: mock.variant }) : null;
}

const MAX_SCRIPT_LINES = 40;
const MAX_LINE_TEXT = 160;
const VERDICTS = new Set(['ok', 'break', 'note', 'unverified']);

/**
 * The margin of one written response: each line of working as the engine read
 * it, its verdict, the mark written beside it, and the first line the engine
 * refuted. `report` is stepCheck's report, `method` methodMarks' result (or
 * null), `awarded` the method marks the response was finally given. Margin
 * marks are the engine's own per-line credits, taken in order and stopped at
 * `awarded`, so they always add up to the marks given for working — never
 * more. Nothing here changes a mark.
 */
export function scriptLinesOf(report, method, awarded) {
  if (!report || !Array.isArray(report.lines) || !report.lines.length) return null;
  const credit = new Map();
  let left = Math.max(0, Number(awarded) || 0);
  const rows = Array.isArray(method?.lines) ? method.lines : [];
  for (const row of rows) {
    if (left <= 0) break;
    const m = Math.min(left, Math.max(0, Number(row?.mark) || 0));
    if (m > 0 && Number.isInteger(row.index)) { credit.set(row.index, m); left -= m; }
  }
  // methodMarks counts verified progress lines held back by the cap toward
  // `awarded`, but its per-row vector can leave one of them at 0 after it
  // withdraws a rewriting line (expand, then standard form, then factorise
  // under a two-mark cap). The mark is the engine's; the margin puts what is
  // left of it beside those verified progress lines, in order.
  for (const row of rows) {
    if (left <= 0) break;
    if (row?.reason === 'cap' && row.status === 'ok' && Number.isInteger(row.index) && !credit.has(row.index)) { credit.set(row.index, 1); left -= 1; }
  }
  const lines = report.lines.slice(0, MAX_SCRIPT_LINES).map((l, index) => ({
    text: String(l?.text ?? '').slice(0, MAX_LINE_TEXT),
    verdict: VERDICTS.has(l?.status) ? l.status : 'note',
    mark: credit.get(index) || 0
  }));
  const fb = Number.isInteger(report.firstBreak) ? report.firstBreak : -1;
  return { lines, firstError: fb >= 0 && fb < lines.length ? fb : -1, truncated: report.lines.length > MAX_SCRIPT_LINES };
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

function lineOf(d, extra = {}) {
  return {
    key: extra.key ?? null, marks: num(d.marks), awarded: num(d.awarded),
    outcome: d.pending ? 'pending' : d.unanswered ? 'unanswered' : d.correct ? 'correct' : num(d.awarded) > 0 ? 'part-marks' : 'wrong',
    choiceTaken: d.choiceTaken ?? null, markingScheme: d.markingScheme || null,
    note: typeof d.partial?.note === 'string' ? d.partial.note : (typeof d.feedback === 'string' && !d.correct ? d.feedback.slice(0, 400) : ''),
    margin: d.script?.lines || [],
    firstError: d.script && d.script.firstError >= 0 ? { line: d.script.firstError + 1, text: d.script.lines[d.script.firstError]?.text || '' } : null
  };
}

/**
 * The returned script of a marked board mock: the total, each section's score
 * and time, and per question the examiner's margin marks and first-error line.
 * `result` is the server's stored result (or the device's copy of its detail);
 * `sections` the blueprint's sections, for their order and full marks.
 */
export function mockScript(result, sections = []) {
  const detail = Array.isArray(result?.detail) ? result.detail : [];
  const bySection = new Map((sections || []).map(s => [String(s.id), { id: String(s.id), label: s.label || `Section ${s.id}`, marks: num(s.marks), awarded: 0, ms: 0, questions: 0, attempted: 0 }]));
  const questions = [];
  for (const d of [...detail].sort((a, b) => num(a.order) - num(b.order))) {
    const id = String(d.section ?? '');
    if (!bySection.has(id)) bySection.set(id, { id, label: d.sectionLabel || `Section ${id}`, marks: 0, awarded: 0, ms: 0, questions: 0, attempted: 0, unlisted: true });
    const s = bySection.get(id);
    s.awarded += num(d.awarded);
    if (s.unlisted) s.marks += num(d.marks);
    s.ms += Math.max(0, num(d.ms));
    s.questions += 1;
    if (!d.unanswered) s.attempted += 1;
    const parts = d.multipart ? (d.parts || []).map(p => lineOf(p, { key: String(p.key) })) : null;
    questions.push({
      order: num(d.order), section: id, item: d.item || null, chapter: d.subtopicName || d.chapterId || null,
      ms: Math.max(0, num(d.ms)), timed: d.timed === true, repeat: d.repeat === true,
      ...lineOf(d), ...(parts ? { parts, firstError: parts.find(p => p.firstError) ? { part: parts.find(p => p.firstError).key, ...parts.find(p => p.firstError).firstError } : null } : {})
    });
  }
  const list = [...bySection.values()].map(({ unlisted, ...s }) => s);
  const score = list.reduce((n, s) => n + s.awarded, 0);
  const total = list.reduce((n, s) => n + s.marks, 0);
  return {
    label: MOCK_LABEL, title: result?.title || MOCK_LABEL,
    score, total, pct: total ? Math.round(1000 * score / total) / 10 : 0,
    totalMs: list.reduce((n, s) => n + s.ms, 0),
    timed: questions.length > 0 && questions.every(q => q.timed),
    provisional: result?.provisional === true || questions.some(q => q.outcome === 'pending' || q.parts?.some(p => p.outcome === 'pending')),
    late: result?.late === true,
    sections: list, questions
  };
}
