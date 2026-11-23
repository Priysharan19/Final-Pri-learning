// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one page, one story: the marks and the lines the student sees
//
// Marks are computed from the topic check's report (the one that DECIDED them). Display-only passes then add ticks and crosses
// (the claim-free rule, the true-as-written fold, the worked-solution match, the first wrong step). This module is the join:
//
//   constrainToShown(decided, shown)
//       The marks may only rest on lines the page shows as ticks, and not after a line only the page crosses (a display-only cross). A line of the deciding report
//       that the page does not show that way is set to a note, and the marks are computed again from that report. Where the two
//       agree (every page measured so far) it returns the deciding report itself, so nothing changes.
//
//   reconcileLostRows(lost, shown)
//       The "where the marks went" rows are written from the deciding report. A row that would send the student to a line the
//       page shows differently is replaced by a sentence that is true of the page, or dropped:
//         · "could not be read as mathematics" on a line the page ticks    -> ticked, but not counted for a method mark
//         · the same on a line the page crosses                             -> crossed, so no mark
//         · the same on a line after the page's first cross                 -> comes after the mistake on line N
//         · a row that names a mistake the page does not show               -> dropped (the page's own sentence stands)
//       It never says a line was wrong when the page ticks it, and never says a line could not be read when the page crosses it.
//
// Pure, deterministic, no I/O. Nothing here sets a mark; constrainToShown only ever LOWERS what the deciding report supports.
// ─────────────────────────────────────────────────────────────────────────────

const same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

// The rows that point at a mistake, and the variable that names the line they point at.
const POINTS_AT_A_SLIP = { 'marks.lost.break': 'line', 'marks.lost.anotherBreak': 'line', 'marks.lost.afterBreak': 'breakLine', 'marks.lost.carried': 'breakLine', 'marks.lost.answerCarried': 'breakLine' };

/** Zero-based index of the first line the page crosses, or -1. */
export const shownFirstCross = shown => (Array.isArray(shown) ? shown.findIndex(l => l?.status === 'break') : -1);

/**
 * The first line the page crosses that the report which decided the marks did NOT cross (a display-only cross: the first wrong
 * step, the interpreter's), or -1. A cross the deciding report also made is the rubric's own business: an authored plan lets an
 * independent stage earn after a given copied wrongly (marker-lost-marks-check "AP two slips"), and that is not changed here.
 */
export const displayOnlyCross = (shown, decidedLines) => (Array.isArray(shown) ? shown.findIndex((l, i) => l?.status === 'break' && decidedLines?.[i]?.status !== 'break') : -1);

/** The lines (zero-based) that earned a mark in the method-marks vector but are not shown as ticks before the page's first cross. */
export function unsupportedCredit(rows, shown, decidedLines = null) {
  if (!Array.isArray(rows) || !Array.isArray(shown)) return [];
  const cross = displayOnlyCross(shown, decidedLines);
  return rows.filter(r => r && r.mark > 0 && !(shown[r.index]?.status === 'ok' && same(shown[r.index].text, r.text) && (cross < 0 || r.index < cross))).map(r => r.index);
}

/**
 * The deciding report, with every line the page does not show as a tick (before its first cross) made a note.
 * `only` limits the clipping to those line indexes (the credited ones). Returns { report, clipped }: `report` is `decided` itself when nothing is clipped.
 */
export function constrainToShown(decided, shown, only = null) {
  if (!decided || !Array.isArray(decided.lines) || !Array.isArray(shown)) return { report: decided, clipped: 0 };
  const cross = displayOnlyCross(shown, decided.lines);
  let clipped = 0;
  const lines = decided.lines.map((l, i) => {
    if (l?.status !== 'ok' || (only && !only.includes(i))) return l;
    const s = shown[i];
    const fine = s && s.status === 'ok' && same(s.text, l.text) && (cross < 0 || i < cross);
    if (fine) return l;
    clipped++;
    return { ...l, status: 'note', state: 'unverified', unverified: true, note: 'Not counted for a mark: the page does not show this line as checked.' };
  });
  return clipped ? { report: { ...decided, lines }, clipped } : { report: decided, clipped: 0 };
}

/**
 * The rows of "where the marks went", made true of the page. Returns { rows, dropped, replaced }.
 * `rows` is the input array itself when nothing needs to change.
 */
export function reconcileLostRows(lost, shown) {
  const rows = Array.isArray(lost) ? lost : [];
  const lines = Array.isArray(shown) ? shown : [];
  if (!rows.length || !lines.length) return { rows, dropped: 0, replaced: 0 };
  const cross = shownFirstCross(lines);
  const statusAt = n => lines[Number(n) - 1]?.status;
  let dropped = 0, replaced = 0;
  const out = [];
  for (const row of rows) {
    const key = String(row?.key ?? '');
    const slipVar = POINTS_AT_A_SLIP[key];
    if (slipVar) {
      // A mistake the page does not show as one is not pointed at.
      if (statusAt(row.vars?.[slipVar]) !== 'break') { dropped++; continue; }
      out.push(row);
      continue;
    }
    if (key === 'marks.lost.unverified') {
      const at = Number(row.vars?.line ?? row.line);
      const st = statusAt(at);
      const make = (k, extra = {}) => { replaced++; const { text: _english, ...rest } = row; out.push({ ...rest, key: k, vars: { line: at, ...extra }, ruleKey: null }); };
      if (st === 'break') make('marks.lost.crossedNoMark');
      else if (cross >= 0 && at - 1 > cross) make('marks.lost.afterBreak', { breakLine: cross + 1 });
      else if (st === 'ok') make('marks.lost.tickedNotCounted');
      else out.push(row);
      continue;
    }
    out.push(row);
  }
  return dropped || replaced ? { rows: out, dropped, replaced } : { rows, dropped: 0, replaced: 0 };
}
