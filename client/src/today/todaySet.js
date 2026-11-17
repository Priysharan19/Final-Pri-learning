// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Today set
//
// One pure function: given what the server already derived (the mistake
// notebook's due retests and the spaced ladder's due dot points), build the
// short daily set. No model call, no randomness, no stored output: the same
// inputs and clock give the same set.
//
//   · RETEST — a mistake not yet fixed, now due on the notebook's schedule
//     (1 day after the miss, then 3: the "1 to 3 days later" retest). The
//     question is drawn fresh by the server (POST /notebook/:id/twin: a new
//     instance of the same generator, never the original's content, checked
//     against the account's seen records) and is unassisted: no hint is
//     offered before the first answer.
//   · REVIEW — a dot point due on the spaced ladder (engine/spacedReview.js).
//   · Retests come first (a recent miss is the most perishable), then the most
//     overdue review. The chosen items are INTERLEAVED so no two neighbours
//     share a chapter where another order exists.
//   · The set is sized by minutes: it stops adding items at TARGET_MINUTES and
//     never passes MAX_MINUTES.
//
// This is a product schedule. No claim about retention or learning rests on it
// (docs/research/ELEVATE_2026-11-17.md is input, not an accepted decision).
// ─────────────────────────────────────────────────────────────────────────────
export const ITEM_MINUTES = Object.freeze({ retest: 3, review: 2 });
export const TARGET_MINUTES = 12;
export const MAX_MINUTES = 15;
const DAY = 86_400_000;

const str = v => (typeof v === 'string' && v ? v : '');

/** Retest candidates from a normalized notebook (notebook/notebookView.js). */
export function retestCandidates(book, now = Date.now()) {
  const out = [];
  for (const g of book?.groups || []) {
    for (const i of g.items || []) {
      if (i.fixed || !i.review?.due || !i.canTwin || !i.id) continue;
      out.push({
        kind: 'retest', id: `retest:${i.id}`, attemptId: i.id, subtopic: str(i.subtopic || g.subtopic),
        chapterName: g.chapterName || null, misconceptionId: g.misconception?.id || null,
        dueAt: Number(i.review.dueAt) || 0, overdueDays: Math.max(0, (now - (Number(i.review.dueAt) || now)) / DAY)
      });
    }
  }
  return out;
}

/** Review candidates from GET /reviews `dotpoints.today`. */
export function reviewCandidates(queue, now = Date.now()) {
  return (Array.isArray(queue?.today) ? queue.today : []).filter(r => r && str(r.subtopic)).map(r => ({
    kind: 'review', id: `review:${r.subtopic}|${r.dotpoint || ''}`, subtopic: r.subtopic, dotpoint: r.dotpoint || null,
    chapterName: r.chapterName || null, href: r.href || null,
    dueAt: Number(r.dueAt) || 0, overdueDays: Math.max(0, Number(r.overdueDays) || (now - (Number(r.dueAt) || now)) / DAY)
  }));
}

const byPriority = (a, b) => (a.kind === b.kind ? 0 : a.kind === 'retest' ? -1 : 1)
  || (b.overdueDays - a.overdueDays) || (a.id < b.id ? -1 : 1);

/** Order so neighbours differ in chapter where possible; otherwise keep priority order. */
export function interleave(items) {
  const left = [...items];
  const out = [];
  while (left.length) {
    const prev = out[out.length - 1];
    let at = left.findIndex(x => !prev || x.subtopic !== prev.subtopic);
    if (at < 0) at = 0;
    out.push(left.splice(at, 1)[0]);
  }
  return out;
}

/**
 * → { items, minutes, retests, reviews, held } where `held` counts due items that
 * did not fit today (they stay due, nothing is dropped from the schedule).
 */
export function buildTodaySet({ notebook = null, reviews = null, now = Date.now(), targetMinutes = TARGET_MINUTES, maxMinutes = MAX_MINUTES } = {}) {
  const pool = [...retestCandidates(notebook, now), ...reviewCandidates(reviews, now)].sort(byPriority);
  // One item per chapter-and-kind first; a chapter's second retest waits for the next pass.
  const seen = new Set();
  const chosen = [];
  let minutes = 0;
  for (const c of pool) {
    const key = `${c.kind}|${c.subtopic}|${c.dotpoint || ''}`;
    if (seen.has(key)) continue;
    const cost = ITEM_MINUTES[c.kind];
    if (chosen.length && (minutes >= targetMinutes || minutes + cost > maxMinutes)) continue;
    seen.add(key);
    chosen.push(c);
    minutes += cost;
  }
  const items = interleave(chosen).map(x => ({ ...x, minutes: ITEM_MINUTES[x.kind] }));
  return { items, minutes, retests: items.filter(i => i.kind === 'retest').length, reviews: items.filter(i => i.kind === 'review').length, held: pool.length - items.length };
}
