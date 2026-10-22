// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the mistake notebook, arranged for the screen
//
// Pure functions over the notebook the server sends (GET /v1/practice/notebook,
// built by engine/mistakeNotebook.js). Nothing here decides what is a mistake,
// what is fixed or what is due — the server does. This only orders what came:
//
//   · topics (subtopic) first, then the misconception groups inside each;
//   · anything due for review before anything that is not, then newest first;
//   · on the free plan, the count of older mistakes the server held back, so
//     the screen can say so honestly. Their content is never sent, so there is
//     nothing to blur or tease.
// ─────────────────────────────────────────────────────────────────────────────

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = v => (typeof v === 'string' ? v : null);

function normalizeItem(item) {
  const review = item?.review && typeof item.review === 'object' ? item.review : {};
  const fe = item?.firstError && typeof item.firstError === 'object' ? item.firstError : null;
  return {
    id: String(item?.id || ''),
    questionId: str(item?.questionId),
    subtopic: String(item?.subtopic || ''),
    dotpoint: str(item?.dotpoint),
    dotpointText: str(item?.dotpointText),
    difficulty: num(item?.difficulty) || 2,
    answeredAt: num(item?.answeredAt),
    marksEarned: num(item?.marksEarned),
    marksPossible: num(item?.marksPossible),
    misconception: item?.misconception && typeof item.misconception === 'object' ? item.misconception : null,
    firstError: fe && (fe.text || fe.note) ? { line: Number.isInteger(fe.line) && fe.line > 0 ? fe.line : null, text: String(fe.text || ''), note: String(fe.note || '') } : null,
    retries: num(item?.retries),
    fixed: item?.fixed === true,
    fixedAt: item?.fixedAt == null ? null : num(item.fixedAt),
    review: { stage: review.stage ?? null, dueAt: review.dueAt == null ? null : num(review.dueAt), due: review.due === true },
    prompt: str(item?.prompt),
    canTwin: item?.canTwin === true
  };
}

/**
 * The notebook response (the server's shape, as the local backend forwards it)
 * made safe to render. Unknown or missing fields fall back to empty values.
 */
export function normalizeNotebook(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const groups = (Array.isArray(src.groups) ? src.groups : []).map(g => ({
    key: String(g?.key || ''),
    subtopic: String(g?.subtopic || ''),
    chapterName: str(g?.chapterName),
    misconception: g?.misconception && typeof g.misconception === 'object' ? g.misconception : null,
    count: num(g?.count),
    open: num(g?.open),
    lastAt: num(g?.lastAt),
    items: (Array.isArray(g?.items) ? g.items : []).map(normalizeItem).filter(i => i.id)
  })).filter(g => g.key && g.items.length);
  return {
    available: src.available !== false,
    reason: str(src.reason),
    plan: src.plan === 'premium' ? 'premium' : 'free',
    preview: Number.isInteger(src.preview) ? src.preview : null,
    total: num(src.total),
    shown: num(src.shown),
    hidden: Math.max(0, num(src.hidden)),
    dueCount: Math.max(0, num(src.dueCount)),
    nextDueAt: src.nextDueAt == null ? null : num(src.nextDueAt),
    groups
  };
}

const byDueThenNewest = (a, b) => (b.review.due - a.review.due) || (a.fixed - b.fixed) || (b.answeredAt - a.answeredAt) || (a.id < b.id ? -1 : 1);

/**
 * Topics, each with its misconception groups, due-for-review first.
 * Returns [{ subtopic, chapterName, due, open, lastAt, groups:[{ ...group, due, items }] }].
 */
export function notebookSections(book) {
  const topics = new Map();
  for (const g of book?.groups || []) {
    const items = [...g.items].sort(byDueThenNewest);
    const due = items.filter(i => i.review.due).length;
    const group = { ...g, items, due };
    const t = topics.get(g.subtopic) || topics.set(g.subtopic, { subtopic: g.subtopic, chapterName: g.chapterName || null, due: 0, open: 0, lastAt: 0, groups: [] }).get(g.subtopic);
    t.groups.push(group);
    t.due += due;
    t.open += g.open;
    t.lastAt = Math.max(t.lastAt, g.lastAt);
    if (!t.chapterName && g.chapterName) t.chapterName = g.chapterName;
  }
  const order = (a, b) => (b.due - a.due) || (b.open - a.open) || (b.lastAt - a.lastAt) || (String(a.key || a.subtopic) < String(b.key || b.subtopic) ? -1 : 1);
  return [...topics.values()].map(t => ({ ...t, groups: t.groups.sort(order) })).sort(order);
}

/** The entries due for review now, in the order the screen offers them. */
export function dueEntries(book) {
  return (book?.groups || []).flatMap(g => g.items).filter(i => i.review.due).sort(byDueThenNewest);
}

/**
 * The free plan's honest line: how many older mistakes the full notebook holds.
 * Null when nothing is held back (Premium, or a short notebook).
 */
export function premiumLine(book) {
  if (!book || book.plan === 'premium' || !(book.hidden > 0)) return null;
  return { key: 'notebook.olderInPremium', vars: { n: book.hidden, count: book.hidden } };
}

/** "Line 3: x = 4" — the examiner's first broken line, or null. */
export function firstErrorLine(item) {
  const fe = item?.firstError;
  if (!fe || !fe.text) return null;
  return { line: fe.line, text: fe.text, note: fe.note || '' };
}
