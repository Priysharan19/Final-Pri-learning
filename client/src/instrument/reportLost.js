// The Report's "Where marks were lost" panel, decided from the figures only
// (display logic, no marking). Rows are the chapters on this syllabus with
// server-certified marks lost (GET /marks/by-chapter), most lost first. The
// panel may only say "none lost" when the period's own certified figures
// agree; if the period lost marks that no chapter row here accounts for, it
// says so with the number, so it never contradicts the figures beside it.

/**
 * @param marksByChapter { [id]: { earned, possible } }
 * @param nameOf id → chapter name on this syllabus, or null
 * @param cur the period's certified figures ({ marksEarned, marksPossible }) or null
 * @returns {{ rows: Array, state: 'rows'|'none'|'unplaced', unplaced: number, possible: number }}
 */
export function lostPanel(marksByChapter, nameOf, cur, top = 3) {
  const rows = Object.entries(marksByChapter || {})
    .map(([id, m]) => ({ id, name: nameOf(id), earned: Number(m?.earned) || 0, possible: Number(m?.possible) || 0 }))
    .map(c => ({ ...c, lost: c.possible - c.earned }))
    .filter(c => c.name && c.lost > 0)
    .sort((a, b) => b.lost - a.lost || a.name.localeCompare(b.name))
    .slice(0, top);
  const periodLost = cur && Number(cur.marksPossible) > 0 ? Math.max(0, Number(cur.marksPossible) - Number(cur.marksEarned || 0)) : 0;
  if (rows.length) return { rows, state: 'rows', unplaced: 0, possible: 0 };
  if (periodLost > 0) return { rows, state: 'unplaced', unplaced: periodLost, possible: Number(cur.marksPossible) };
  return { rows, state: 'none', unplaced: 0, possible: 0 };
}
