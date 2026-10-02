// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the device's own check on a reworded walkthrough caption
//
// The same rule the server applies (server/platform/tutorGuard.js
// captionWordingOk), run again on the device that will display the caption:
// a reworded caption may change the words, never the maths. Its only
// mathematics may be whole $…$ spans copied verbatim from the deterministic
// caption it replaces, each also in the verified solution. Outside those spans
// it may hold no digit, no operator, no number word and no operation word.
// ─────────────────────────────────────────────────────────────────────────────
import { verifiedMath } from '../explain/storyboard.js';

const SPAN = /\$([^$]+)\$/g;

const FORBIDDEN_WORDS = new Set([
  // numbers and fractions
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
  'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'lakh', 'million', 'half', 'halves', 'third', 'thirds', 'quarter',
  'quarters', 'fourth', 'fourths', 'fifth', 'fifths', 'sixth', 'sixths', 'seventh', 'sevenths', 'eighth', 'eighths',
  'ninth', 'ninths', 'tenth', 'tenths', 'minus', 'negative',
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'पांच', 'छह', 'छः', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह',
  'पंद्रह', 'पन्द्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस', 'पच्चीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी',
  'नब्बे', 'सौ', 'हज़ार', 'हजार', 'लाख', 'आधा', 'आधी', 'आधे', 'डेढ़', 'डेढ', 'ढाई', 'पौना', 'पौन', 'चौथाई', 'तिहाई', 'ऋण',
  'माइनस', 'बटा', 'बटे',
  // operations
  'add', 'adds', 'adding', 'added', 'addition', 'plus', 'subtract', 'subtracts', 'subtracting', 'subtracted', 'subtraction',
  'multiply', 'multiplies', 'multiplying', 'multiplied', 'multiplication', 'times', 'divide', 'divides', 'dividing',
  'divided', 'division', 'over', 'halve', 'double', 'doubled', 'twice', 'triple', 'square', 'squared', 'squares', 'cube',
  'cubed', 'root', 'roots', 'sum', 'difference', 'product', 'quotient', 'power', 'powers', 'exponent', 'reciprocal',
  'percent', 'percentage', 'equals', 'equal', 'increase', 'decrease',
  'जोड़', 'जोड़ें', 'जोड़ो', 'जोड़कर', 'घटा', 'घटाएँ', 'घटाएं', 'घटाओ', 'घटाकर', 'गुणा', 'भाग', 'विभाजित', 'वर्ग', 'घन',
  'मूल', 'योग', 'अंतर', 'गुणनफल', 'भागफल', 'घात', 'दुगुना', 'दोगुना', 'बराबर'
]);

function spansOf(text) {
  return [...String(text ?? '').matchAll(SPAN)].map(m => m[1].trim()).filter(Boolean);
}

/** May this reworded caption replace `source` for a solution whose maths is `evidence`? */
export function captionWordingOk(proposed, source, evidence) {
  const text = String(proposed ?? '');
  if (!text.trim() || (text.match(/\$/g) || []).length % 2) return false;
  const allowed = new Set(spansOf(source).filter(s => evidence.has(s)));
  if (!spansOf(text).every(s => allowed.has(s))) return false;
  const prose = text.replace(SPAN, ' ').replace(/(?<=\p{L})[-'’](?=\p{L})/gu, '');
  if (/[0-9०-९]/.test(prose) || /[=+\-−–—×÷*/^<>≤≥√π%∫∑\\{}]/.test(prose)) return false;
  return !prose.toLowerCase().split(/[^\p{L}\p{M}]+/u).some(w => w && FORBIDDEN_WORDS.has(w));
}

/**
 * The reworded captions the device will show, by scene id. `sources` maps each
 * id to the deterministic caption the request carried.
 */
export function safeCaptions(captions, solution, sources) {
  const evidence = verifiedMath(solution);
  const out = {};
  for (const c of Array.isArray(captions) ? captions : []) {
    if (c?.source !== 'tutor' || typeof c.text !== 'string' || !c.id) continue;
    const source = sources?.get?.(c.id);
    if (typeof source === 'string' && captionWordingOk(c.text, source, evidence)) out[c.id] = c.text;
  }
  return out;
}
