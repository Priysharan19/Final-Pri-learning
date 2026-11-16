// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · spaced review: each dot point's next review, from its history
//
// A simple, bounded ladder (docs/product/spaced-review.md). It is a product
// schedule, not a research-claimed optimum: no retention or learning claim
// rests on it.
//
//   · Each item is one dot point (subtopic + dot point). Its state is replayed
//     from the server-marked attempts on it, oldest first, so the record is the
//     server's and every device reads the same schedule.
//   · A correct, unassisted recall made once at least half the current interval
//     has passed moves one rung UP the ladder. A correct answer sooner than that
//     (the same sitting, say) holds the rung: it is not a test of memory.
//   · A correct answer with hints holds the rung.
//   · A miss, or a revealed answer, moves DOWN by MISS_DROP rungs (never below 0).
//   · The next review is due `LADDER_DAYS[rung]` days after the last attempt.
// ─────────────────────────────────────────────────────────────────────────────
export const LADDER_DAYS = Object.freeze([1, 2, 4, 7, 14, 30, 60]);
export const MISS_DROP = 2;
export const EARLY_SHARE = 0.5;
const DAY = 86_400_000;

const keyOf = a => `${a.subtopic}|${typeof a.dotpoint === 'string' && a.dotpoint ? a.dotpoint : ''}`;

/** One item's rung after one attempt. Pure. */
export function nextRung(rung, { correct, revealed = false, hintsUsed = 0, elapsedMs = Infinity }) {
  if (!correct || revealed) return Math.max(0, rung - MISS_DROP);
  if (hintsUsed > 0) return rung;
  if (elapsedMs < EARLY_SHARE * LADDER_DAYS[rung] * DAY) return rung;
  return Math.min(LADDER_DAYS.length - 1, rung + 1);
}

/**
 * attempts: [{ subtopic, dotpoint?, correct, revealed?, hintsUsed?, at }]
 * → { items: [{ subtopic, dotpoint, rung, intervalDays, lastAt, dueAt, due }], today: [...due, most overdue first] }
 */
export function spacedSchedule(attempts = [], now = Date.now()) {
  const items = new Map();
  const rows = attempts.filter(a => a && typeof a.subtopic === 'string' && a.subtopic && Number.isFinite(a.at) && typeof a.correct === 'boolean')
    .sort((x, y) => x.at - y.at);
  for (const a of rows) {
    const k = keyOf(a);
    const it = items.get(k);
    if (!it) {
      // The first sight of an item places it: right starts at rung 0 (1 day), wrong too.
      items.set(k, { subtopic: a.subtopic, dotpoint: a.dotpoint || null, rung: 0, lastAt: a.at });
      continue;
    }
    it.rung = nextRung(it.rung, { correct: a.correct, revealed: a.revealed === true, hintsUsed: Number(a.hintsUsed) || 0, elapsedMs: a.at - it.lastAt });
    it.lastAt = a.at;
  }
  const out = [...items.values()].map(it => {
    const intervalDays = LADDER_DAYS[it.rung];
    const dueAt = it.lastAt + intervalDays * DAY;
    return { ...it, intervalDays, dueAt, due: dueAt <= now };
  }).sort((a, b) => a.dueAt - b.dueAt || `${a.subtopic}|${a.dotpoint}`.localeCompare(`${b.subtopic}|${b.dotpoint}`));
  return { items: out, today: out.filter(r => r.due) };
}
