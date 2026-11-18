// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the marked page, as plain data
//
// The student's own page (their ink or their photo) is the main object. Each judged
// line is outlined where it sits on the page and has ONE short comment beside it,
// level with the line. Everything here comes from results the engine and the line
// interpreter already produced; nothing is decided here and nothing is a mark.
//
//   buildMarkedPage({ model, boxes })   what to draw: header, outlined lines, the one
//                                       collapsed "not checked" card, the aligned list
//   boxesFromInk(strokes, readLines)    line rectangles from the strokes (or null)
//   boxesFromPhoto(lines)               line rectangles from the reader's boxes (or null)
//   alignCards(cards, height)           where each comment sits so it is level with its
//                                       line and never overlaps the one above
//
// Boxes are fractions (0 to 1) of the page, so the same arithmetic serves ink and photo.
// When no geometry is trustworthy the page is not outlined and the comments are an
// ordinary list: nothing is guessed.
// ─────────────────────────────────────────────────────────────────────────────
import { inkBounds } from '../ink/cloudRaster.js';
import { segmentInkLines, plausibleLineMatch } from '../ink/inkLines.js';

/** A card status the page speaks about, with the icon that carries it besides colour. */
export const STATE = Object.freeze({
  checked: { word: 'aw.status.checked', icon: 'check', tone: 'good' },
  condition: { word: 'aw.status.condition', icon: 'check', tone: 'good' },
  'first-error': { word: 'aw.status.firstError', icon: 'alert', tone: 'error' },
  follows: { word: 'aw.status.follows', icon: 'arrowRight', tone: 'partial' },
  incomplete: { word: 'aw.status.incomplete', icon: 'uncertain', tone: 'partial' },
  'not-verified': { word: 'aw.status.notVerified', icon: 'uncertain', tone: 'quiet' },
  unread: { word: 'aw.status.unread', icon: 'uncertain', tone: 'quiet' }
});
export const isQuiet = status => status === 'not-verified' || status === 'unread';

const clamp01 = v => Math.min(1, Math.max(0, v));
const finite = v => Number.isFinite(Number(v));
const validBox = b => !!b && ['x', 'y', 'w', 'h'].every(k => finite(b[k])) && b.w > 0 && b.h > 0;

/** "6, 7, 8" as "6 to 8" is the card's business; a plain, comma-separated list of line numbers. */
export const listOf = ns => ns.join(', ');

/**
 * Line rectangles on the student's ink, as fractions of the page the strokes span.
 * Only when the written lines can honestly be matched to the lines the reader returned
 * (same count, proportionate widths): otherwise null and the page is not outlined.
 * @returns {null | { view: {x,y,w,h}, boxes: {x,y,w,h}[] }}  (`view` is in stroke units)
 */
export function boxesFromInk(strokes, readLines) {
  const list = Array.isArray(strokes) ? strokes : [];
  if (!list.length) return null;
  const bounds = inkBounds(list);
  if (!bounds) return null;
  const segs = segmentInkLines(list);
  if (!plausibleLineMatch(readLines, segs)) return null;
  const pad = Math.max(12, 0.04 * Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY));
  const view = { x: bounds.minX - pad, y: bounds.minY - pad, w: bounds.maxX - bounds.minX + 2 * pad, h: bounds.maxY - bounds.minY + 2 * pad };
  const gap = Math.max(2, 0.01 * view.h);
  const boxes = segs.map(s => ({
    x: clamp01((s.box.x - gap - view.x) / view.w), y: clamp01((s.box.y - gap - view.y) / view.h),
    w: Math.min(1, (s.box.w + 2 * gap) / view.w), h: Math.min(1, (s.box.h + 2 * gap) / view.h)
  }));
  return { view, boxes };
}

/**
 * Line rectangles on a photo, from the reader's own `box` per line. Used only when every
 * line has one and they run top to bottom in reading order; otherwise null (a list).
 */
export function boxesFromPhoto(lines) {
  const list = Array.isArray(lines) ? lines : [];
  if (!list.length) return null;
  const boxes = list.map(l => (validBox(l?.box) ? { x: clamp01(l.box.x), y: clamp01(l.box.y), w: Math.min(1 - clamp01(l.box.x), l.box.w), h: Math.min(1 - clamp01(l.box.y), l.box.h) } : null));
  if (boxes.some(b => !b)) return null;
  for (let i = 1; i < boxes.length; i += 1) if (boxes[i].y + boxes[i].h / 2 < boxes[i - 1].y + boxes[i - 1].h / 2) return null;
  return { view: null, boxes };
}

/**
 * Where each comment sits. `cards` are { id, y (the line's centre, 0 to 1 of the page), h (px) }.
 * A card is level with its line and never closer than `gap` to the card above; a run of
 * cards that would run off the bottom is pulled up together, but never above its own line's
 * neighbour. Pure and deterministic.
 * @returns {{ id, top }[]}  top in px, in the order given
 */
export function alignCards(cards, height, { gap = 8 } = {}) {
  const H = Math.max(1, Number(height) || 1);
  const order = cards.map((c, i) => ({ ...c, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const tops = new Array(cards.length).fill(0);
  let floor = 0;
  for (const c of order) {
    const want = clamp01(c.y) * H - c.h / 2;
    const top = Math.max(want, floor, 0);
    tops[c.i] = Math.round(top);
    floor = top + c.h + gap;
  }
  return cards.map((c, i) => ({ id: c.id, top: tops[i] }));
}

/**
 * Everything the marked page draws.
 * @param {object} input
 *   model  buildAnnotatedWorking()'s result: cards[{ n, status, ... }], marks, allChecked, summary
 *   boxes  null, or one { x, y, w, h } (fractions) per card, in card order
 *   markReady  false when the page is not a marked result: no mark is shown (never a zero)
 */
export function buildMarkedPage({ model, boxes = null, markReady = true } = {}) {
  const cards = Array.isArray(model?.cards) ? model.cards : [];
  if (!cards.length) return null;
  const aligned = Array.isArray(boxes) && boxes.length === cards.length && boxes.every(validBox);
  const total = cards.length;
  const checked = cards.filter(c => c.status === 'checked' || c.status === 'condition').length;
  const first = cards.find(c => c.status === 'first-error') || null;
  const notFinished = cards.filter(c => c.status === 'incomplete').map(c => c.n);
  const quiet = cards.filter(c => isQuiet(c.status)).map(c => c.n);
  const everyLine = !first && !quiet.length && !notFinished.length && cards.every(c => c.status === 'checked' || c.status === 'condition') && model.allChecked !== false;

  const parts = [];
  if (everyLine) parts.push({ key: 'mp.head.every', vars: { total } });
  else {
    parts.push({ key: 'mp.head.checked', vars: { checked, total } });
    if (first) parts.push({ key: 'mp.head.firstError', vars: { n: first.n } });
    if (notFinished.length) parts.push({ key: 'mp.head.notFinished', vars: { count: notFinished.length, list: listOf(notFinished) } });
  }
  // The mark is the server's, copied as it is; a page that is not a marked result shows none.
  const mark = markReady && model.marks && Number.isFinite(Number(model.marks.awarded)) && Number(model.marks.possible) > 0
    ? { awarded: Number(model.marks.awarded), possible: Number(model.marks.possible) } : null;

  const judged = cards.map((card, i) => ({ n: card.n, index: i, card, status: card.status, box: aligned ? boxes[i] : null, collapsed: isQuiet(card.status) }));
  return {
    header: { parts, mark, everyLine },
    lines: judged,
    // Lines Pri could not read as maths are ONE card, not one each.
    collapsed: quiet.length ? { lines: quiet, count: quiet.length, list: listOf(quiet), reason: model.unverified?.reason || null } : null,
    aligned,
    firstError: first ? first.n : null
  };
}

/** The cards the comments column lists: every judged line that speaks, and the one collapsed card. */
export function commentItems(page) {
  if (!page) return [];
  const out = [];
  let collapsedAt = -1;
  page.lines.forEach((l, i) => {
    if (!l.collapsed) { out.push({ id: `l${l.n}`, kind: 'line', line: l, y: l.box ? l.box.y + l.box.h / 2 : null }); return; }
    if (collapsedAt < 0) {
      collapsedAt = out.length;
      out.push({ id: 'collapsed', kind: 'collapsed', lines: page.collapsed.lines, y: null, boxes: [] });
    }
    const item = out[collapsedAt];
    if (l.box) item.boxes.push(l.box);
  });
  // the collapsed card sits level with the first line it speaks about
  for (const item of out) {
    if (item.kind === 'collapsed' && item.boxes.length) item.y = Math.min(...item.boxes.map(b => b.y + b.h / 2));
  }
  return out;
}
