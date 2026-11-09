// Pri Learning — board mock papers ("Pri mock in board format").
//
// Owner default D22: "Board mock papers ship as typed timed papers."
//
// A board mock is a full-length, timed CBSE Class X (Standard) or Class XII
// Mathematics paper built on the existing reference blueprints in
// indiaExams.js — the section structure, marks per question and internal
// choice of CBSE's published 2025-26 sample question papers — and issued,
// timed and marked by the server-authoritative exam router
// (server/platform/exams.js) exactly as any India paper is. Two things set it
// apart:
//   · it is TYPED: every written answer is typed, on every device and
//     whatever the exam-handwriting flag says, and the server refuses
//     handwriting on it (no ink mode, no unread page);
//   · it is labelled. It is NOT an official CBSE paper and is never called
//     one: every surface says MOCK_LABEL. Provenance:
//     docs/content/board-mock-papers.md.
// It is a timed paper like any other for the plan (D19): the free plan's one
// timed paper in 30 days, Premium unlimited.
//
// Shared by the server (which imports only client/src/engine) and the device.
export const MOCK_LABEL = 'Pri mock in board format';

/** The blueprints a board mock may be built on: full papers CBSE sets at the board. */
export const BOARD_MOCK_BLUEPRINTS = Object.freeze([
  Object.freeze({ id: 'cbse-x-standard', track: 'cbse', grade: 10, variant: 'standard', name: 'Class X Mathematics (Standard, 041)' }),
  Object.freeze({ id: 'cbse-xii', track: 'cbse', grade: 12, variant: 'standard', name: 'Class XII Mathematics (041)' })
]);

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
