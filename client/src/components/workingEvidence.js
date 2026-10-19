// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a marked attempt may truthfully say about its working
//
// The card once said "every line of your handwritten working was checked and
// verified" whenever the answer was right and more than one line had been
// read — when nothing had established that (#448). The server's step report
// is the only evidence there is about the lines, and it is evidence about the
// lines it was given: the non-blank lines of the submitted working, in order,
// each echoed back with its own text.
//
// These rules are pure and have no React in them (test/working-evidence-check.mjs):
//
//   · a report is used only when it is a report of exactly these lines;
//   · "every line verified" is said only when every line of such a report is
//     `ok` — a `note` is a line the engine did not judge, and a line carried
//     forward (`ecf`) is true of the student's slip, not of the question;
//   · the first mistake is pinned to a line only through such a report, so a
//     ✗ never lands on a line that was not the one judged.
// ─────────────────────────────────────────────────────────────────────────────

const clean = value => String(value ?? '').trim();

/** The non-blank lines of a working, as the engine reads them. */
export function writtenLines(lines) {
  const list = Array.isArray(lines) ? lines : String(lines ?? '').split('\n');
  return list.map(clean).filter(Boolean);
}

/**
 * The server's step report, only if it is a report of exactly these lines
 * (same count, same text, same order); otherwise null.
 */
export function reportForLines(report, lines) {
  if (!report || !Array.isArray(report.lines)) return null;
  const written = writtenLines(lines);
  if (!written.length || report.lines.length !== written.length) return null;
  if (!report.lines.every((line, i) => clean(line?.text) === written[i])) return null;
  return report;
}

/** True only when a report of exactly these lines verifies every one of them, none carried forward. */
export function everyLineVerified(report, lines) {
  const matched = reportForLines(report, lines);
  return !!matched && matched.lines.every(line => line?.status === 'ok' && line?.ecf !== true);
}

/**
 * Per-line marks for a page of lines the student sees — `ok`, `break`
 * (the first mistake, with its note), `ecf` (true of an earlier slip) or null
 * (not judged) — or null when the report is not of these lines. `indexOf`
 * maps an index into the written (non-blank, included) lines to the index of
 * the line on screen; by default they are the same.
 */
export function lineMarks(report, lines, { count = null, indexOf = i => i } = {}) {
  const matched = reportForLines(report, lines);
  if (!matched) return null;
  const n = Number.isInteger(count) ? count : matched.lines.length;
  const marks = Array.from({ length: n }, () => null);
  const first = matched.lines.findIndex(line => line?.status === 'break');
  matched.lines.forEach((line, i) => {
    const at = indexOf(i);
    if (!Number.isInteger(at) || at < 0 || at >= n) return;
    if (line.status === 'break') marks[at] = { kind: i === first ? 'break' : 'also', note: clean(line.note) || null };
    else if (line.status === 'ok') marks[at] = { kind: line.ecf === true ? 'ecf' : 'ok', note: line.ecf === true ? clean(line.note) || null : null };
  });
  return marks;
}
