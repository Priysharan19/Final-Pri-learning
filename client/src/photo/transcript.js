// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the lines of a photographed page
//
// A page out of an exercise book is not one answer. It carries yesterday's
// notes at the top, the question copied out, the working, and a last sentence.
// The reader transcribes all of it, answer-blind, and that is right: deciding
// what belongs to THIS question is not the reader's job and it is never told
// the question.
//
// That decision is made here, on the device, after the page has been read,
// from the PUBLIC question the student is already looking at — never from a
// key, a solution or a mark. Nothing is discarded: every line stays on screen,
// a line left out is shown struck through with the reason, and one tap brings
// it back. Where this cannot tell, it leaves everything in and says so.
//
// The text of a line is never rewritten here. `prettyLine` changes how a
// relation is drawn (>= as ≥); `markerText` changes how one is spelled for the
// marker (≥ as >=). Neither changes what the line says.
//
// Pure: no network, no storage, no DOM.
// ─────────────────────────────────────────────────────────────────────────────
import { stripSentence, isMarginMark, figureLabelIndexes } from './finalAnswer.js';
import { cleanLatex } from '../engine/texSafe.js';

export const MAX_LINES = 60;
export const MAX_LINE_CHARS = 400;

/** How a line is drawn for reading. Display only. */
export function prettyLine(text) {
  return String(text ?? '')
    .replace(/<=>/g, '⇔').replace(/=>/g, '⇒').replace(/->/g, '→')
    .replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/!=/g, '≠')
    .replace(/\^2(?![\d.])/g, '²').replace(/\^3(?![\d.])/g, '³');
}

/** The spelling of a relation the marker reads. Same relation, same meaning. */
export function markerText(text) {
  return String(text ?? '')
    .replace(/[≥⩾≧]/g, '>=').replace(/[≤⩽≦]/g, '<=').replace(/≠/g, '!=')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .slice(0, MAX_LINE_CHARS);
}

// ── What the public question is about ────────────────────────────────────────
function linear(latex) {
  let s = String(latex ?? '');
  for (let i = 0; i < 4; i += 1) s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  return s
    .replace(/\\(?:left|right|,|;|!|quad|qquad|displaystyle)/g, '')
    .replace(/\\(?:geq?|geqslant)(?![a-zA-Z])/g, '>=').replace(/\\(?:leq?|leqslant)(?![a-zA-Z])/g, '<=').replace(/\\neq?(?![a-zA-Z])/g, '!=')
    .replace(/\\(?:cdot|times)(?![a-zA-Z])/g, '*').replace(/\\div(?![a-zA-Z])/g, '/')
    .replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\^\s*\{([^{}]*)\}/g, '^$1').replace(/_\s*\{([^{}]*)\}/g, '_$1')
    .replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '');
}

/** Lower-case, no spaces, one spelling per sign. */
function compact(text) {
  return markerText(text).toLowerCase()
    .replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/\s+/g, '');
}

const isLatin = ch => /[a-z]/.test(ch || '');
/** Positions of single-letter names (a letter with no letter on either side). */
function singleLetters(s) {
  const at = [];
  for (let i = 0; i < s.length; i += 1) if (isLatin(s[i]) && !isLatin(s[i - 1]) && !isLatin(s[i + 1])) at.push(i);
  return at;
}
/** The same string with every single-letter name blanked: x and n look alike on paper. */
function skeleton(s) {
  const out = s.split('');
  for (const i of singleLetters(s)) out[i] = '?';
  return out.join('');
}
const names = s => new Set(singleLetters(s).map(i => s[i]));
const hasMaths = s => /\d/.test(s) || singleLetters(s).length > 0;
const isLabel = raw => /^[\p{L}\s.'’-]{2,40}:\s*$/u.test(String(raw).trim()) && !/\d/.test(raw);

/** What can be said about the question from its public prompt alone. */
export function questionSignature(prompt) {
  const segments = [...String(prompt ?? '').matchAll(/\$\$?([^$]+)\$\$?/g)].map(m => compact(linear(m[1]))).filter(Boolean);
  const ids = new Set();
  for (const seg of segments) for (const n of names(seg)) ids.add(n);
  // The expressions a student restates when they copy the question out: each
  // piece of mathematics, and each side of its equals sign, when it is long
  // enough to be recognisable (a bare "x" or "6" restates nothing).
  const anchors = [];
  for (const seg of segments) {
    for (const piece of [seg, ...seg.split('=')]) {
      if (piece.length >= 5 && /\d/.test(piece) && /[+\-*/^(]/.test(piece)) anchors.push(piece);
    }
  }
  anchors.sort((a, b) => b.length - a.length);
  return { ids, anchors: [...new Set(anchors)] };
}

/** Where a line restates one of the question's expressions, or null. */
function restates(lineCompact, signature) {
  const lineSkeleton = skeleton(lineCompact);
  for (const anchor of signature.anchors) {
    const at = lineSkeleton.indexOf(skeleton(anchor));
    if (at < 0) continue;
    // Letter for letter: what the reader read where the question has a name.
    const letters = {};
    let consistent = true;
    for (const i of singleLetters(anchor)) {
      const read = lineCompact[at + i];
      if (!isLatin(read)) { consistent = false; break; }
      if (read !== anchor[i]) {
        if (letters[read] && letters[read] !== anchor[i]) { consistent = false; break; }
        letters[read] = anchor[i];
      }
    }
    if (consistent) return { letters };
  }
  return null;
}

/**
 * Which lines of a page belong to this question — a proposal, never a decision.
 *
 * `lines` is [{ text, gapBefore? }] in page order; `prompt` is the public
 * question text. Returns:
 *
 *   excluded     [{ index, why }]  why ∈ 'before-question' | 'after-break'
 *   anchor       index of the line that restates the question, or null
 *   undecided    true when some lines look like other work but this cannot be
 *                sure: everything is left in and the student is asked
 *   letterDoubts [{ index, read, question }]  a name the reader read differently
 *                from the question's own (x read as n): a doubt about the
 *                READING, shown for the student to check, never corrected here
 */
export function proposeRelevance(lines, prompt) {
  const rows = (Array.isArray(lines) ? lines : []).map((line, index) => {
    const raw = typeof line === 'string' ? line : String(line?.text ?? '');
    const text = compact(stripSentence(raw));
    return { index, raw, text, gapBefore: typeof line === 'object' && line?.gapBefore === true, label: isLabel(raw), maths: hasMaths(text) && !isLabel(raw) };
  });
  const none = { excluded: [], anchor: null, undecided: false, letterDoubts: [] };
  const signature = questionSignature(prompt);
  if (!rows.length || !signature.ids.size) return none;

  let anchor = null, letters = {};
  for (const row of rows) {
    const hit = restates(row.text, signature);
    if (hit) { anchor = row.index; letters = hit.letters; break; }
  }
  // A name the reader read as another letter still counts as the question's.
  const own = new Set([...signature.ids, ...Object.keys(letters)]);
  const shares = row => [...names(row.text)].some(n => own.has(n));
  // Positively other work: it has names of its own and none of the question's.
  const foreign = row => row.maths && names(row.text).size > 0 && !shares(row);
  const otherWork = block => block.some(r => r.maths) && block.filter(r => r.maths).every(foreign);

  const letterDoubts = [];
  for (const [read, question] of Object.entries(letters)) {
    for (const row of rows) if (row.index >= (anchor ?? 0) && names(row.text).has(read)) letterDoubts.push({ index: row.index, read, question });
  }

  const excluded = [];
  let undecided = false;
  if (anchor === null) {
    // No line restates the question. Other work may still be on the page, but
    // there is nothing to say where this answer starts: leave it all in, ask.
    undecided = rows.some(foreign) && rows.some(r => r.maths && !foreign(r));
    return { excluded, anchor, undecided, letterDoubts };
  }
  const before = rows.slice(0, anchor);
  if (before.some(r => r.maths)) {
    if (otherWork(before)) for (const r of before) excluded.push({ index: r.index, why: 'before-question' });
    else undecided = true;
  }
  // After the working: a label ("final:") or a clear gap, followed to the end
  // of the page by nothing but other work.
  for (let j = anchor + 1; j < rows.length; j += 1) {
    if (!(rows[j].label || rows[j].gapBefore)) continue;
    const tail = rows.slice(j);
    if (otherWork(tail) && !tail.some(r => restates(r.text, signature))) {
      for (const r of tail) excluded.push({ index: r.index, why: 'after-break' });
      break;
    }
  }
  return { excluded, anchor, undecided, letterDoubts };
}

/**
 * A reading that is not a reading: nothing came back, every line is the
 * reader saying it could not make the page out, or the reader's own confidence
 * in the whole page is near zero (a blurred or badly cropped photo). The card
 * says "that photo could not be read" with a retry — an explicit reading
 * problem, never lines of "[illegible]" to mark and never a verdict.
 */
export function unreadablePage(transcription) {
  const lines = (Array.isArray(transcription?.lines) ? transcription.lines : []).map(l => String(l?.text ?? '').trim()).filter(Boolean);
  if (!lines.length) return true;
  if (lines.every(text => /^[\[(<]?\s*(illegible|unreadable|unclear|not legible|cannot read|can't read)[\s\w]*[\])>]?\.?$/i.test(text))) return true;
  const confidence = Number(transcription?.confidence);
  return Number.isFinite(confidence) && confidence < 0.2;
}

/**
 * The transcript the card holds: the reader's lines, each with what the
 * reader doubted, and the proposal of which lines belong.
 *
 * `transcription` is the server's reply ({ lines: [{ text, confidence,
 * uncertain, doubt, gapBefore }], confidenceFloor }); `question` is public.
 */
/**
 * The reader's own split of a line into words ("text") and maths ("math"), kept
 * for display only. Anything that is not a short list of well-formed pieces is
 * dropped, and the line is then set by the heuristic split instead.
 */
export function cleanSegments(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 24) return null;
  const out = [];
  for (const piece of raw) {
    if (!piece || (piece.kind !== 'text' && piece.kind !== 'math') || typeof piece.value !== 'string') return null;
    const value = piece.value.trim().slice(0, 200);
    if (value) out.push({ kind: piece.kind, value });
  }
  return out.length ? out : null;
}

/** A line's rectangle on the photo as fractions of its width and height, or null. Layout only. */
export function cleanBox(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const [x, y, w, h] = [raw.x, raw.y, raw.w, raw.h].map(Number);
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

/** The pieces to set a line in: the reader's, when they still restate the line as shown; else null. */
export function segmentsFor(line) {
  const segs = cleanSegments(line?.segments);
  if (!segs || line?.edited) return null;
  const flat = s => String(s ?? '').replace(/\s+/g, '');
  return flat(segs.map(p => p.value).join('')) === flat(line.text) ? segs : null;
}

export function buildTranscript(transcription, question = {}) {
  const floor = Number(transcription?.confidenceFloor);
  const source = Array.isArray(transcription?.lines) && transcription.lines.length
    ? transcription.lines
    : String(transcription?.text ?? '').split('\n').map(text => ({ text }));
  const read = source
    .map(line => ({
      text: markerText(String(line?.text ?? '').trim()),
      confidence: Number.isFinite(Number(line?.confidence)) ? Number(line.confidence) : null,
      uncertain: line?.uncertain === true,
      doubt: typeof line?.doubt === 'string' && line.doubt.trim() ? line.doubt.trim().slice(0, 120) : null,
      gapBefore: line?.gapBefore === true,
      segments: cleanSegments(line?.segments),
      latex: cleanLatex(line?.latex),          // the reader's own TeX, display only, when it passes texSafe
      box: cleanBox(line?.box)
    }))
    .filter(line => line.text)
    .slice(0, MAX_LINES);
  const relevance = proposeRelevance(read, question?.prompt);
  // Marks on a graph and marks someone else wrote in the margin are not working: left out here (the student can bring either back).
  const figures = figureLabelIndexes(read.map(l => l.text));
  const lines = read.map((line, index) => {
    const out = (isMarginMark(line.text) ? { index, why: 'margin' } : null) || excludedAt(relevance, index) || (figures.has(index) ? { index, why: 'figure' } : null);
    const letter = relevance.letterDoubts.find(d => d.index === index) || null;
    const below = line.confidence !== null && Number.isFinite(floor) && line.confidence < floor;
    return {
      text: line.text,
      read: line.text,                       // what the reader returned; kept beside every edit
      // Every one of these is a doubt about the READING of the page.
      check: line.uncertain || below || !!letter,
      doubt: line.doubt || (letter ? `${letter.question} or ${letter.read}` : null),
      gapBefore: line.gapBefore,
      ...(line.segments ? { segments: line.segments } : {}),
      ...(line.latex ? { latex: line.latex } : {}),
      ...(line.box ? { box: line.box } : {}),
      excluded: !!out,
      why: out ? out.why : null,
      edited: false
    };
  });
  return { lines, undecided: relevance.undecided, anchor: relevance.anchor };
}
const excludedAt = (relevance, index) => relevance.excluded.find(e => e.index === index) || null;

/** The lines that go to the marker as working, in page order. */
export function includedLines(transcript) {
  return (transcript?.lines || []).filter(l => !l.excluded && String(l.text).trim()).map(l => markerText(l.text).trim());
}
/**
 * The reader's TeX for each included line, in the order of `includedLines` (null where there is none). Only for a line
 * the student has not changed, and only TeX with no words in it (it is set as maths alone).
 */
export function includedLatex(transcript) {
  return (transcript?.lines || []).filter(l => !l.excluded && String(l.text).trim())
    .map(l => (!l.edited && typeof l.latex === 'string' && cleanLatex(l.latex) && !/\\(?:text|mathrm|mathbf|operatorname)(?![A-Za-z])/.test(l.latex) ? l.latex : null));
}
export function workingOf(transcript) { return includedLines(transcript).join('\n'); }

/** The student's own edit of one line. The reader's text stays in `read`. */
export function editLine(transcript, index, text) {
  const value = markerText(String(text ?? '').replace(/\n/g, ' '));
  // The reader's TeX describes the reader's text: once the student has changed the line it describes nothing.
  return { ...transcript, lines: transcript.lines.map((l, i) => {
    if (i !== index) return l;
    const { latex, ...rest } = l;
    const edited = value.trim() !== String(l.read).trim();
    return { ...rest, ...(latex && !edited ? { latex } : {}), text: value, edited, confirmed: false };
  }) };
}
/** The student says the reader's text for this line is what they wrote (nothing changed). */
export function confirmLine(transcript, index) {
  return { ...transcript, lines: transcript.lines.map((l, i) => (i === index ? { ...l, confirmed: true } : l)) };
}
/** Leave one line out of the answer, or bring it back. Chosen by the student from here on. */
export function setLineExcluded(transcript, index, excluded) {
  return { ...transcript, lines: transcript.lines.map((l, i) => (i === index ? { ...l, excluded: !!excluded, why: excluded ? 'student' : null } : l)) };
}
/** Bring back every line this module left out by default. */
export function includeAll(transcript) {
  return { ...transcript, undecided: false, lines: transcript.lines.map(l => (l.excluded && l.why !== 'student' ? { ...l, excluded: false, why: null } : l)) };
}
export const defaultExclusions = transcript => (transcript?.lines || []).filter(l => l.excluded && l.why !== 'student').length;
/** Lines that still ask to be checked: doubted by the reader and neither edited nor left out. */
export const linesToCheck = transcript => (transcript?.lines || []).filter(l => l.check && !l.edited && !l.confirmed && !l.excluded).length;

/** A stored transcript is data from disk: keep only what this module wrote. */
export function reviveTranscript(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.lines)) return null;
  const lines = value.lines.slice(0, MAX_LINES).map(l => ({
    text: markerText(String(l?.text ?? '')),
    read: markerText(String(l?.read ?? l?.text ?? '')),
    check: l?.check === true,
    doubt: typeof l?.doubt === 'string' ? l.doubt.slice(0, 120) : null,
    gapBefore: l?.gapBefore === true,
    ...(cleanSegments(l?.segments) ? { segments: cleanSegments(l.segments) } : {}),
    ...(cleanLatex(l?.latex) ? { latex: cleanLatex(l.latex) } : {}),
    ...(cleanBox(l?.box) ? { box: cleanBox(l.box) } : {}),
    excluded: l?.excluded === true,
    why: ['before-question', 'after-break', 'margin', 'figure', 'student'].includes(l?.why) ? l.why : null,
    edited: l?.edited === true,
    confirmed: l?.confirmed === true
  }));
  return lines.length ? { lines, undecided: value.undecided === true, anchor: Number.isInteger(value.anchor) ? value.anchor : null } : null;
}
