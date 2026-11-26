// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher-marked page, as plain data (Prithagoras edition)
//
// The student's own page is marked the way a teacher marks it by hand: a tick at the end of each line the engine proved correct, a cross
// on the first wrong line, and a small boxed mark in the right margin ONLY on the line where the server awarded that mark. Everything here
// reads results the server's deterministic engine already produced (the marked page model and the approved criteria table). Nothing is
// decided here: no tick, cross or mark is created, and a line the engine could not verify gets neither a tick nor a cross.
//
//   classOf(card)            the proof class the engine emitted for a ticked line, or null
//   PHRASES / phraseOf(cls)  one fixed English phrase per class (unknown class: no phrase, the tick stays)
//   buildTeacherMarks(...)   the ticks, the cross and the margin marks of a page
//   placeMarks(...)          where each tick sits: at the end of its line when that space is free, else in the right gutter with a leader
//   groupPhrases(marks)      the short words shown in the gutter: one per run of lines that share a phrase
//   buildAssessment(...)     the examiner's workspace: the server's marks, one row per real criterion, the footer
//
// English only: this is the Prithagoras edition's surface. The India edition never reaches this module.
// ─────────────────────────────────────────────────────────────────────────────

/** Every fixed phrase, by proof class. No em dashes. A class not listed here has no phrase. */
export const PHRASES = Object.freeze({
  differentiation: 'Correct differentiation',
  substitution: 'Correct substitution',
  solutionList: 'Correct solutions',
  rounding: 'Correct rounding',
  restated: 'Question restated',
  given: 'Given in the question',
  identity: 'True identity',
  one: 'Multiplies by 1',
  expansion: 'Correct expansion',
  collecting: 'Like terms collected',
  factorisation: 'Correct factorisation',
  cancelling: 'Correct cancelling',
  arithmetic: 'Correct arithmetic',
  equal: 'Equal to the line above',
  ruleStatement: 'Correct statement of the rule',
  solutionStep: 'Matches a step of the worked solution',
  factors: 'Good choice of factors',
  differenceOfSquares: 'Difference of squares',
  indexLaw: 'Correct index law',
  logLaw: 'Correct log law',
  trigIdentity: 'Correct trig identity',
  fractions: 'Correct fraction work',
  // classes the line-coverage work may emit; unknown to main today, so nothing maps to them unless the engine names them
  conclusion: 'Correct answer',
  heading: 'Heading',
  question: 'Question restated'
});

export const TEXT = Object.freeze({
  noReason: 'This line does not follow from the one above.',
  noReasonFirst: 'This line is not correct.',
  assessment: 'Assessment',
  attempt: 'Attempt',
  marked: 'Marked',
  fully: 'Fully correct',
  partly: 'Partly correct',
  not: 'Not yet correct',
  allocation: 'Mark allocation',
  note: 'Examiner’s note',
  views: 'View',
  original: 'Original',
  markedView: 'Marked',
  detailed: 'Detailed feedback',
  steps: 'Steps',
  enlarge: 'Enlarge page',
  fit: 'Fit to screen',
  markAwarded: 'Mark awarded here:',
  corrected: 'Corrected line:',
  provedTrue: 'The engine proved this line true.',
  enlargedLabel: 'Enlarged page, scroll to move',
  heading: 'Heading',
  question: 'Question restated',
  step: 'Step',
  marksOnPage: 'Marks on the page',
  listLabel: 'Marks, line by line',
  correct: 'Correct',
  wrong: 'Wrong',
  unreadLine: 'Pri could not read this line.',
  typeIt: 'Tap to type it.'
});

const PROVED = { derivative: 'differentiation', substituted: 'substitution', listed: 'solutionList', rounded: 'rounding', restated: 'restated', identity: 'identity' };
const HOW = {
  'derivative-rule': 'differentiation', derivatives: 'differentiation', substituted: 'substitution', 'substituted-at': 'substitution', one: 'one',
  expanded: 'expansion', collected: 'collecting', factorised: 'factorisation', cancelled: 'cancelling', evaluated: 'arithmetic', 'equal-above': 'equal',
  listed: 'solutionList', rounded: 'rounding'
};
const FACT = { conclusion: 'conclusion', heading: 'heading', question: 'question', 'rule-statement': 'ruleStatement', 'solution-step': 'solutionStep', 'both-sides': 'equal', 'equals-line-above': 'equal', 'factors-of-question': 'factors' };
const RULE = {
  factorise: 'factorisation', expand: 'expansion', 'difference-of-squares': 'differenceOfSquares', 'cancel-common-factor': 'cancelling',
  'index-product': 'indexLaw', 'index-power': 'indexLaw', 'index-quotient-power': 'indexLaw',
  'log-product': 'logLaw', 'log-quotient': 'logLaw', 'log-power': 'logLaw',
  'common-denominator': 'fractions', 'split-fraction': 'fractions', 'divide-fraction': 'fractions', 'multiply-fractions': 'fractions',
  reciprocal: 'trigIdentity', quotient: 'trigIdentity', pythagorean: 'trigIdentity', 'pythagorean-tan': 'trigIdentity', 'pythagorean-cot': 'trigIdentity',
  'double-angle-sin': 'trigIdentity', 'double-angle-cos': 'trigIdentity', 'double-angle-cos-cos': 'trigIdentity', 'double-angle-cos-sin': 'trigIdentity',
  'double-angle-tan': 'trigIdentity', 'compound-sin': 'trigIdentity', 'compound-cos': 'trigIdentity', 'compound-tan': 'trigIdentity'
};

/** The proof class the engine gave a ticked line (from the facts it emitted), or null. Unknown values give null, never a guess. */
export function classOf(card) {
  if (!card || card.status !== 'checked') return null;
  const f = card.fact && typeof card.fact === 'object' ? card.fact : {};
  const h = card.how && typeof card.how === 'object' ? card.how : {};
  if (h.kind === 'conclusion' || h.kind === 'heading' || h.kind === 'question') return h.kind;
  if (f.kind === 'proved') return PROVED[f.proof] || null;
  if (card.valueChain === 'given') return card.restated ? 'restated' : 'given';
  if (HOW[h.kind]) return HOW[h.kind];
  if (FACT[f.kind]) return FACT[f.kind];
  if (card.valueChain === 'arithmetic') return 'arithmetic';
  const r = Array.isArray(card.rules) && card.rules[0] ? card.rules[0].rule : null;
  return (r && RULE[r]) || null;
}
export const phraseOf = cls => (cls && Object.hasOwn(PHRASES, cls) ? PHRASES[cls] : null);

const plain = s => String(s ?? '').replace(/\$/g, '').replace(/\s+/g, ' ').trim();
const firstSentence = s => { const p = plain(s); const m = /^(.+?[.!?])(\s|$)/.exec(p); return (m ? m[1] : p).slice(0, 110); };

/** The reason shown on the cross: the engine's own, where it gave one; else one fixed sentence. */
export function reasonOf(card) {
  const f = card?.facts || {};
  const given = firstSentence(f.whyWrong || '');
  if (given) return given;
  return card && card.n > 1 ? TEXT.noReason : TEXT.noReasonFirst;
}

/**
 * The marks of a page.
 * @param {object} p  page: buildMarkedPage()'s result; table: criteriaView()'s result or null (rows carry the server's awards)
 * @returns {{ n, kind: 'right'|'wrong', cls, phrase, reason, corrected, paid: {text, marks}|null, box }[]}  one per judged line, in line order
 */
export function buildTeacherMarks({ page, table = null } = {}) {
  if (!page) return [];
  // A margin mark is drawn on the LAST line of a criterion the server awarded, and only there. A criterion awarded by the final answer alone has no line: no box.
  const paidAt = new Map();
  for (const row of table?.rows || []) {
    if (!row.awarded || !Array.isArray(row.lines) || !row.lines.length) continue;
    const at = Math.max(...row.lines);
    paidAt.set(at, (paidAt.get(at) || 0) + row.marks);
  }
  // The answer-bearing line is the last line of working the page judges; it is said to be the correct answer only when the server's own mark is the
  // full mark (the server marked the answer right) and the engine ticked the line.
  const judged = page.lines.filter(l => l.status !== 'condition');
  const answerN = judged.length ? judged[judged.length - 1].n : null;
  const fullMark = !!page.header?.mark && page.header.mark.awarded >= page.header.mark.possible && page.header.mark.possible > 0;
  return page.lines.filter(l => l.status === 'checked' || l.status === 'first-error').map(l => {
    const right = l.status === 'checked';
    const cls = right ? (l.n === answerN && fullMark && l.card?.valueChain !== 'given' ? 'conclusion' : classOf(l.card)) : null;
    return {
      n: l.n, kind: right ? 'right' : 'wrong', cls, phrase: right ? phraseOf(cls) : reasonOf(l.card),
      reason: right ? null : reasonOf(l.card), corrected: right ? null : (l.card.corrected || null),
      paid: paidAt.has(l.n) ? { marks: paidAt.get(l.n), text: `${paidAt.get(l.n)}/${paidAt.get(l.n)}` } : null,
      box: l.box || null
    };
  });
}

/** "9 lines correct. 0 wrong. 3 not checked." Counts the maths lines only: a stated condition is neither. */
export function tallyOf(page) {
  const lines = page?.lines || [];
  const right = lines.filter(l => l.status === 'checked').length;
  const wrong = lines.filter(l => l.status === 'first-error').length;
  const unchecked = lines.filter(l => !['checked', 'first-error', 'condition'].includes(l.status)).length;
  const s = n => (n === 1 ? '' : 's');
  return `${right} line${s(right)} correct. ${wrong} wrong. ${unchecked} not checked.`;
}

const rectsOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const WORD_FONTS = [17, 15, 13];
/** The width in px of a handwritten phrase at a font size (a fixed estimate: the face is a fixed one). */
export const wordWidth = (text, font) => Math.ceil(String(text).length * font * 0.47) + 4;

/**
 * Where each tick or cross sits, in pixels of the page, and where its few words go.
 *
 * The tick is anchored to the right end of ITS OWN line's box, vertically centred on it, and shrinks (never below `min`) to fit the free
 * space beside the line; if even the smallest does not fit clear of every other line's box and of the marks already placed, it stands in
 * the right gutter, joined to the end of its line by a thin leader that stops at the first writing in its way. The words (`words`: line
 * number to phrase) come straight after the tick on the same line when the free space holds them (the largest of three sizes that fits);
 * otherwise `word` is 'gutter'. A page whose lines have no boxes is not placed on the page at all: the marks stand in the gutter in line
 * order (`placement: 'order'`), a fallback that says so.
 * @param {{ n, box }[]} marks      the lines to mark; box in fractions of the page, or null
 * @param {{ n, box }[]} obstacles  every line of the page (default: the marks), for the writing a mark must not cover
 * @param {Object<number,string>} words  phrases to write beside ticks
 * @param {number} reserve  px kept clear after a tick for its small number
 * @returns {{ n, where: 'page'|'gutter', x, y, size, leader, placement, word: null|'gutter'|{x0,x1,y,font,text} }[]}  x, y in px (y is the line's centre)
 */
export function placeMarks({ marks, obstacles = null, words = {}, reserve = 0, width, height, size = 24, min = 16, gap = 4 }) {
  const W = Math.max(1, Number(width) || 1), H = Math.max(1, Number(height) || 1);
  const all = (obstacles || marks).filter(m => m.box).map(m => ({ n: m.n, x0: m.box.x * W, x1: (m.box.x + m.box.w) * W, y0: m.box.y * H, y1: (m.box.y + m.box.h) * H }));
  const placed = [];
  const out = [];
  const boxed = marks.every(m => m.box);
  const clearOf = (r, n) => !all.some(b => b.n !== n && rectsOverlap(r, { x0: b.x0 - 2, x1: b.x1 + 2, y0: b.y0, y1: b.y1 })) && !placed.some(p => rectsOverlap(r, p));
  marks.forEach((m, i) => {
    const wanted = Object.hasOwn(words, m.n) ? String(words[m.n]) : null;
    if (!m.box || !boxed) { out.push({ n: m.n, where: 'gutter', x: W, y: ((i + 0.5) / Math.max(1, marks.length)) * H, size, leader: null, placement: 'order', word: wanted ? 'gutter' : null, num: false }); return; }
    const own = all.find(b => b.n === m.n);
    const cy = (own.y0 + own.y1) / 2;
    let tick = null, tsize = size;
    for (const k of [1, 0.85, 0.7]) {
      const sz = Math.round(size * k);
      if (sz < Math.min(min, size)) break;
      const r = { x0: own.x1 + gap, y0: cy - sz / 2, x1: own.x1 + gap + sz, y1: cy + sz / 2 };
      if (r.x1 <= W - 1 && r.y0 >= 0 && clearOf(r, m.n)) { tick = r; tsize = sz; break; }
    }
    if (tick) {
      // the small number stands right after the tick when that space is clear of writing; otherwise it is left off (the label still names the line)
      const nw = reserve ? String(m.n).length * 6.5 + 4 : 0;
      const numRect = nw ? { x0: tick.x1, y0: cy - 6, x1: tick.x1 + nw, y1: cy + 6 } : null;
      const num = !!numRect && numRect.x1 <= W - 1 && clearOf(numRect, m.n) && tsize >= 18;
      placed.push(tick);
      if (num) placed.push(numRect);
      let word = null;
      if (wanted) {
        const x0 = tick.x1 + (num ? nw : 0) + 3;
        for (const font of WORD_FONTS) {
          const w = wordWidth(wanted, font);
          const r = { x0, y0: cy - font * 0.62, x1: x0 + w, y1: cy + font * 0.62 };
          if (r.x1 <= W - 2 && clearOf(r, m.n)) { word = { x0, x1: r.x1, y: cy, font, text: wanted }; placed.push(r); break; }
        }
        if (!word) word = 'gutter';
      }
      // a phrase that cannot stand beside its tick goes to the gutter, joined by a thin leader along the free part of the line's level
      let leader = null;
      if (word === 'gutter') {
        const lx0 = tick.x1 + (num ? nw : 0) + 2;
        const stop = Math.min(W, ...all.filter(b => b.n !== m.n && b.x0 > lx0 && b.y0 <= cy && b.y1 >= cy).map(b => b.x0 - 2));
        if (stop - lx0 >= 10) leader = { x0: lx0, x1: stop, y: cy };
      }
      out.push({ n: m.n, where: 'page', x: tick.x0 + tsize / 2, y: cy, size: tsize, leader, placement: 'box', word, num });
      return;
    }
    // the gutter: the leader runs along the foot of the line and stops where other writing begins
    const ly = own.y1 + 1;
    const blockers = all.filter(b => b.n !== m.n && b.x0 > own.x1 && b.y0 <= ly && b.y1 >= ly).map(b => b.x0 - 2);
    const x1 = Math.min(W, ...blockers);
    const x0 = own.x1 + gap;
    out.push({ n: m.n, where: 'gutter', x: W, y: cy, size, leader: x1 - x0 >= 10 ? { x0, x1, y: ly } : null, placement: 'box', word: wanted ? 'gutter' : null, num: false });
  });
  return out;
}

/**
 * The few words written in the gutter: one per run of consecutive ticked lines that share a phrase (so a run of arithmetic is said once,
 * with the lines it covers), and one per cross. Ticks with no phrase say nothing.
 * @returns {{ id, from, to, kind, text, y }[]}  y is the first line's centre as a fraction (0..1) of the page height, or null
 */
export function groupPhrases(marks, placements) {
  const yOf = n => { const p = placements.find(q => q.n === n); return p ? p.y : null; };
  const out = [];
  for (const m of marks) {
    if (!m.phrase) continue;
    const prev = out[out.length - 1];
    if (m.kind === 'right' && prev && prev.kind === 'right' && prev.text === m.phrase && prev.to === m.n - 1) { prev.to = m.n; continue; }
    out.push({ id: `p${m.n}`, from: m.n, to: m.n, kind: m.kind, text: m.phrase, y: yOf(m.n) });
  }
  return out;
}

/** A rough height in px for text of `chars` characters in a column `width` px wide (the layout only needs to keep neighbours apart). */
export function textHeight(chars, width, font = 16, lineHeight = 1.15, maxLines = 3) {
  const per = Math.max(4, Math.floor(width / (font * 0.46)));
  return Math.min(maxLines, Math.max(1, Math.ceil(chars / per))) * font * lineHeight + 4;
}

/**
 * The examiner's workspace, from the server's own marks and criteria. No percentage, no invented criterion: with no approved criteria
 * table there are no rows (the marks and the state still show).
 */
export function buildAssessment({ page, table = null, attempt = null } = {}) {
  if (!page) return null;
  const mark = page.header.mark;
  const state = !mark ? null : mark.awarded >= mark.possible ? 'fully' : mark.awarded === 0 ? 'not' : 'partly';
  const rows = (table?.rows || []).map((r, i) => ({
    i: i + 1, key: r.key || `r${i + 1}`, name: r.text, marks: r.marks, awarded: r.awarded, lines: r.lines,
    evidence: r.reason || (r.awarded && r.lines.length ? `Line ${r.lines.join(', ')}.` : r.awarded ? 'Awarded by the final answer.' : 'Not awarded.')
  }));
  const corrections = page.header.counts.wrong;
  const satisfied = rows.filter(r => r.awarded).length;
  const s = n => (n === 1 ? '' : 's');
  const footer = [`${corrections} correction${s(corrections)}`, ...(rows.length ? [`${satisfied} criteri${satisfied === 1 ? 'on' : 'a'} satisfied`] : [])].join(' · ');
  return { attempt: Number.isInteger(attempt) && attempt >= 1 ? attempt : 1, mark, state, rows, footer, corrections, satisfied };
}

/** What a screen reader hears for a mark: "Line 4: correct. Correct differentiation." */
export const markLabel = m => (m.kind === 'right'
  ? `Line ${m.n}: correct.${m.phrase ? ` ${m.phrase}.` : ''}${m.paid ? ` ${m.paid.text} mark.` : ''}`
  : `Line ${m.n}: wrong. ${m.reason}`);
export const markBoxLabel = m => `Line ${m.n}: ${m.paid.marks} ${m.paid.marks === 1 ? 'mark' : 'marks'} awarded`;
export const figureLabel = mark => `${mark.awarded} of ${mark.possible} marks`;
export const stepMarkText = r => `${r.awarded ? r.marks : 0}/${r.marks} ${r.marks === 1 ? 'mark' : 'marks'}.`;
/** One entry of the Detailed feedback list: the words, the corrected line the engine gave, the mark. */
export const listWords = m => ({
  head: m.kind === 'right' ? (m.phrase || TEXT.correct) : TEXT.wrong,
  tail: m.kind === 'wrong' && m.phrase ? m.phrase : null,
  corrected: m.kind === 'wrong' && m.corrected ? `Corrected line: ${m.corrected}` : null,
  mark: m.paid ? `Mark ${m.paid.text}.` : null
});

/** The one word the detail panel opens with for a line that is a heading or the restated question; null leaves the usual word. */
export function lineWord(card) {
  if (!card) return null;
  const kinds = [card.fact?.kind, card.how?.kind];
  if (kinds.includes('heading')) return TEXT.heading;
  if (kinds.includes('question') || (card.valueChain === 'given' && card.restated)) return TEXT.question;
  return null;
}

// ── the popover: the fuller detail behind a tick or a cross ─────────────────

/** One general sentence per proof class: what the engine established. Nothing here says more than the class does. */
export const DETAILS = Object.freeze({
  differentiation: 'The derivative on this line is correct.',
  substitution: 'The value was substituted correctly.',
  solutionList: 'These values are exactly the solutions of the question.',
  rounding: 'The value is correct to the places written.',
  restated: 'This line restates the question.',
  given: 'This line is given by the question.',
  identity: 'Both sides are equal at every value tried, so this is a true identity.',
  one: 'Multiplying by 1 changes nothing, so this equals the line above.',
  expansion: 'The expansion is correct.',
  collecting: 'The like terms were collected correctly.',
  factorisation: 'The factorised form equals the line above.',
  cancelling: 'The common factor was cancelled correctly.',
  arithmetic: 'The arithmetic on this line is correct.',
  equal: 'This line is equal to the line above.',
  ruleStatement: 'The rule is stated correctly.',
  solutionStep: 'This line matches a step of the worked solution.',
  factors: 'The factors chosen multiply to the function in the question.',
  differenceOfSquares: 'The difference of squares is applied correctly.',
  indexLaw: 'The index law is applied correctly.',
  logLaw: 'The log law is applied correctly.',
  trigIdentity: 'The trigonometric identity is applied correctly.',
  fractions: 'The fraction work is correct.',
  conclusion: 'This is the answer the question asks for, and it is correct.',
  heading: 'A heading: nothing to check.',
  question: 'This line restates the question.'
});
const clip = (v, n = 90) => { const t = String(v ?? '').replace(/\$/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? '' : t; };

/** The one sentence the engine's own pieces allow for a class, or null (then the class's general sentence stands). */
function piecesSentence(cls, how) {
  const h = how && typeof how === 'object' ? how : {};
  if (cls === 'differentiation' && h.kind === 'derivative-rule' && clip(h.exprText) && clip(h.rhsText) && clip(h.v, 4)) return `The derivative of ${clip(h.exprText)} with respect to ${clip(h.v, 4)} is ${clip(h.rhsText)}.`;
  if (cls === 'substitution' && h.kind === 'substituted-at' && clip(h.name, 12) && clip(h.argText, 24) && clip(h.valueText, 24)) return `${clip(h.name, 12)}(${clip(h.argText, 24)}) = ${clip(h.valueText, 24)} is substituted correctly.`;
  return null;
}

/**
 * What the popover on a tick or cross says. From the deterministic class table and the engine's own fields; no model text.
 * @returns {{ title, lines: string[], mark: string|null }}
 */
export function detailFor(m, card = null) {
  if (m.kind === 'wrong') {
    const lines = [m.reason];
    const f = card?.facts || {};
    const why = firstSentence(f.whatChanged || '');
    if (why && why !== m.reason) lines.push(why);
    if (m.corrected) lines.push(`${TEXT.corrected} ${plain(m.corrected)}`);
    return { title: `Line ${m.n}: wrong`, lines, mark: null };
  }
  const general = m.cls && Object.hasOwn(DETAILS, m.cls) ? DETAILS[m.cls] : TEXT.provedTrue;
  const lines = [piecesSentence(m.cls, card?.how) || general];
  return { title: `Line ${m.n}: correct`, lines, mark: m.paid ? `${TEXT.markAwarded} ${m.paid.text}.` : null };
}

/**
 * Where the popover for a mark stands, in pixels of the page: below the line it explains, or above when there is no room below, never over
 * the line itself, and kept inside the page sideways. Pure.
 * @param line  { x0, x1, y0, y1 } the line's box in px;  tick  { x, y } its centre
 */
export function placePopover({ line, tick, width, height, w = 240, h = 80, gap = 6 }) {
  const W = Math.max(1, width), H = Math.max(1, height);
  const pw = Math.min(w, W - 8);
  const below = line.y1 + gap, above = line.y0 - gap - h;
  const fitsBelow = below + h <= H - 2, fitsAbove = above >= 2;
  const side = fitsBelow || !fitsAbove ? 'below' : 'above';
  const top = side === 'below' ? Math.min(below, Math.max(2, H - h - 2)) : above;
  // when the page is too short for either, it still never covers the line: it goes beside the page's other free side
  const left = Math.max(4, Math.min(tick.x - 16, W - pw - 4));
  return { left, top: Math.max(2, top), width: pw, side };
}
