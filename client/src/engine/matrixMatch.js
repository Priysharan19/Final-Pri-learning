// Pri Learning — matrix-match (pairing grid) marking.
//
// A matrix-match item lists rows (P, Q, R, S) and columns (1 … 5). The key
// pairs each row with one or more columns; the student's grid does the same.
// The deterministic engine marks it row by row, as the JEE scheme for these
// items does: each row whose chosen columns are EXACTLY the key's columns
// earns the row mark. A row with a missing, extra or unknown column earns the
// grid's wrong-row mark (0 unless the grid says otherwise). There is no credit
// for a "nearly right" row, and nothing here is decided by a model.
//
// Input never earns credit by being malformed: an unknown row label, a column
// that is not on the grid, or text the reader cannot parse makes the whole
// response `invalid`, which earns the unanswered mark and asks for the grid
// again. That is the conservative choice: refuse credit, never grant it.

const LABEL = /^[A-Za-z0-9]{1,3}$/;
const norm = s => String(s).trim().toUpperCase();

/** The key, checked once: { rows: [...], columns: [...], pairs: { row: [columns] } }. */
export function matrixKey(key) {
  const rows = (key?.rows || []).map(norm);
  const columns = (key?.columns || []).map(norm);
  if (!rows.length || !columns.length) throw new Error('A matrix-match key needs rows and columns.');
  if (new Set(rows).size !== rows.length || new Set(columns).size !== columns.length) throw new Error('Matrix-match labels repeat.');
  if (![...rows, ...columns].every(l => LABEL.test(l))) throw new Error('Matrix-match labels must be short letters or digits.');
  const pairs = {};
  for (const row of rows) {
    const cols = [...new Set((key.pairs?.[row] ?? key.pairs?.[row.toLowerCase()] ?? []).map(norm))];
    if (!cols.length || !cols.every(c => columns.includes(c))) throw new Error(`Matrix-match row ${row} has no valid key.`);
    pairs[row] = cols;
  }
  return { rows, columns, pairs };
}

/**
 * Read a student's grid. Accepts an object { P: ['2'], Q: '1,4' } or text such
 * as "P-2, Q-1 4; R→3". Returns { grid } or { invalid: reason }. A row left out
 * is unanswered, not wrong.
 */
export function readMatrixGrid(raw, key) {
  const k = matrixKey(key);
  const grid = Object.fromEntries(k.rows.map(r => [r, []]));
  let entries;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    entries = Object.entries(raw).map(([row, cols]) => [row, Array.isArray(cols) ? cols : String(cols ?? '').split(/[\s,]+/)]);
  } else {
    const text = String(raw ?? '').trim();
    if (!text) return { grid };
    if (text.length > 400) return { invalid: 'That grid is too long to read.' };
    entries = [];
    for (const part of text.split(/[;\n]|,(?=\s*[A-Za-z]{1,3}\s*(?:[-–:=→]|->))/)) {
      if (!part.trim()) continue;
      const m = part.match(/^\s*([A-Za-z]{1,3})\s*(?:->|[-–:=→])\s*([A-Za-z0-9,\s]*)$/);
      if (!m) return { invalid: 'Write each pairing as a row and its columns, for example P-2, Q-1 4.' };
      entries.push([m[1], m[2].split(/[\s,]+/)]);
    }
  }
  for (const [rowRaw, colsRaw] of entries) {
    const row = norm(rowRaw);
    if (!k.rows.includes(row)) return { invalid: `There is no row ${row} in this grid.` };
    const cols = colsRaw.map(c => norm(c)).filter(Boolean);
    for (const c of cols) if (!k.columns.includes(c)) return { invalid: `There is no column ${c} in this grid.` };
    grid[row] = [...new Set([...grid[row], ...cols])];
  }
  return { grid };
}

/**
 * Mark a grid. `marking` is the section's grid: { perRow, incorrectRow?,
 * unanswered?, correct? }. perRow defaults to correct ÷ rows. incorrectRow is
 * clamped to ≤ 0, so a wrong row can never add marks.
 * Returns { awarded, outcome: 'full'|'partial'|'wrong'|'unanswered'|'invalid', rows, feedback }.
 */
export function markMatrixMatch(marking, raw, key) {
  const k = matrixKey(key);
  const read = readMatrixGrid(raw, k);
  const unansweredMark = Math.min(0, Number(marking?.unanswered ?? 0)) || 0;
  if (read.invalid) return { awarded: unansweredMark, outcome: 'invalid', rows: null, feedback: read.invalid };
  const full = Number(marking?.correct ?? k.rows.length);
  const perRow = Number(marking?.perRow ?? full / k.rows.length);
  const wrongRow = Math.min(0, Number(marking?.incorrectRow ?? 0));
  const rows = {};
  let right = 0, wrong = 0, blank = 0;
  for (const row of k.rows) {
    const chosen = read.grid[row];
    if (!chosen.length) { rows[row] = 'unanswered'; blank += 1; continue; }
    const exact = chosen.length === k.pairs[row].length && chosen.every(c => k.pairs[row].includes(c));
    rows[row] = exact ? 'correct' : 'wrong';
    if (exact) right += 1; else wrong += 1;
  }
  if (blank === k.rows.length) return { awarded: unansweredMark, outcome: 'unanswered', rows, feedback: 'Not attempted.' };
  if (right === k.rows.length) return { awarded: full, outcome: 'full', rows, feedback: '' };
  const awarded = Math.min(full, right * perRow + wrong * wrongRow);
  const outcome = right ? 'partial' : 'wrong';
  return { awarded, outcome, rows, feedback: `${right} of ${k.rows.length} rows matched exactly.` };
}

/** Practice form: right only when every row matches. */
export function checkMatrixMatch(question, rawInput) {
  let r;
  try { r = markMatrixMatch({ correct: 1 }, rawInput, question.answer?.matrix); } catch { return { correct: false, invalid: true, feedback: 'This grid cannot be checked.' }; }
  if (r.outcome === 'invalid') return { correct: false, invalid: true, feedback: r.feedback };
  if (r.outcome === 'unanswered') return { correct: false };
  return { correct: r.outcome === 'full', feedback: r.outcome === 'full' ? undefined : r.feedback, rows: r.rows };
}
