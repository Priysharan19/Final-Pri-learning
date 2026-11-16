// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the mistake notebook, arranged for the screen
//
// Pure functions over what GET /notebook returns (the server's notebook, built
// by engine/mistakeNotebook.js and named by the local backend). Nothing here
// decides what is a mistake, what is fixed or what is due — the server does.
// This only orders what came: topics first, then the slips inside each, and
// anything due for review before anything that is not, newest first.
//
// A server older than the notebook sends only its misconception `entries`;
// they are shown as the same shape, with nothing invented for them.
// ─────────────────────────────────────────────────────────────────────────────

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = v => (typeof v === 'string' && v ? v : null);

function normalizeItem(item, subtopic = '') {
  const review = item?.review && typeof item.review === 'object' ? item.review : {};
  const fe = item?.firstError && typeof item.firstError === 'object' ? item.firstError : null;
  return {
    id: String(item?.id || ''),
    subtopic: String(item?.subtopic || subtopic || ''),
    dotpointText: str(item?.dotpointText),
    answeredAt: num(item?.answeredAt),
    marksEarned: num(item?.marksEarned),
    marksPossible: num(item?.marksPossible),
    firstError: fe && fe.text ? { line: Number.isInteger(fe.line) && fe.line > 0 ? fe.line : null, text: String(fe.text), note: String(fe.note || '') } : null,
    fixed: item?.fixed === true,
    review: { dueAt: review.dueAt == null ? null : num(review.dueAt), due: review.due === true },
    prompt: str(item?.prompt),
    canTwin: item?.canTwin === true
  };
}

function normalizeMisconception(m) {
  if (!m || typeof m !== 'object') return null;
  return { id: str(m.id), nameKey: str(m.nameKey), label: str(m.label) };
}

/** What the local backend returned, made safe to render. */
export function normalizeNotebook(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const base = { available: src.available !== false, reason: str(src.reason) };
  const book = src.notebook && typeof src.notebook === 'object' ? src.notebook : null;
  if (book) {
    const groups = (Array.isArray(book.groups) ? book.groups : []).map(g => ({
      key: String(g?.key || ''),
      subtopic: String(g?.subtopic || ''),
      chapterName: str(g?.chapterName),
      misconception: normalizeMisconception(g?.misconception),
      count: num(g?.count),
      items: (Array.isArray(g?.items) ? g.items : []).map(i => normalizeItem(i, g?.subtopic)).filter(i => i.id)
    })).filter(g => g.key && g.items.length);
    return { ...base, total: num(book.total), dueCount: Math.max(0, num(book.dueCount)), groups };
  }
  // An older server: its misconception groups, under the chapter they name.
  const groups = (Array.isArray(src.entries) ? src.entries : []).map(g => ({
    key: String(g?.key || ''),
    subtopic: String(g?.chapterNames?.[0] || ''),
    chapterName: str(g?.chapterNames?.[0]),
    misconception: normalizeMisconception(g?.misconception),
    count: num(g?.count),
    items: (Array.isArray(g?.items) ? g.items : []).map(i => normalizeItem(i)).filter(i => i.id)
  })).filter(g => g.key && g.items.length);
  return { ...base, total: groups.reduce((n, g) => n + g.count, 0), dueCount: 0, groups };
}

const byDueThenNewest = (a, b) => (b.review.due - a.review.due) || (a.fixed - b.fixed) || (b.answeredAt - a.answeredAt) || (a.id < b.id ? -1 : 1);

/**
 * Topics, each with its slips, due-for-review first.
 * Returns [{ subtopic, chapterName, due, open, lastAt, groups: [{ ...group, due, open, items }] }].
 */
export function notebookSections(book) {
  const topics = new Map();
  for (const g of book?.groups || []) {
    const items = [...g.items].sort(byDueThenNewest);
    const group = { ...g, items, due: items.filter(i => i.review.due).length, open: items.filter(i => !i.fixed).length, lastAt: Math.max(0, ...items.map(i => i.answeredAt)) };
    const key = g.subtopic || g.key;
    const t = topics.get(key) || topics.set(key, { subtopic: key, chapterName: g.chapterName || null, due: 0, open: 0, lastAt: 0, groups: [] }).get(key);
    t.groups.push(group);
    t.due += group.due;
    t.open += group.open;
    t.lastAt = Math.max(t.lastAt, group.lastAt);
    if (!t.chapterName && g.chapterName) t.chapterName = g.chapterName;
  }
  const order = (a, b) => (b.due - a.due) || (b.open - a.open) || (b.lastAt - a.lastAt) || (String(a.key || a.subtopic) < String(b.key || b.subtopic) ? -1 : 1);
  return [...topics.values()].map(t => ({ ...t, groups: t.groups.sort(order) })).sort(order);
}

/** How a slip is named: the engine's catalogued name, its authored label, or a plain fallback. */
export function slipLabel(group, t) {
  const m = group?.misconception;
  if (m?.nameKey) return t(m.nameKey);
  if (m?.label) return m.label;
  return m ? t('notebook.unnamedSlip') : t('notebook.noSlipNamed');
}
