// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter · the student's own words for a quantity
//
// A closed lexicon, matched deterministically on the student's own label. The
// interpreter never decides what a label means: a `quantity` claim is accepted
// only when the label the student wrote maps to the quantity claimed.
// ─────────────────────────────────────────────────────────────────────────────
import { foldText } from './claims.js';

// ── the student's own words for a quantity (closed lexicon, deterministic) ──
const LABEL_LEXICON = [
  ['maximum', /^(max|maximum|maximum value|max value|greatest value|largest value|max\.)$/],
  ['minimum', /^(min|minimum|minimum value|min value|least value|smallest value|min\.)$/],
  ['amplitude', /^(amplitude|amp)$/],
  ['period', /^(period)$/],
  ['midline', /^(midline|mid-line|mean level|centre line|equilibrium|equilibrium level|centre)$/],
  ['gradient', /^(gradient|slope)$/],
  ['y-intercept', /^(y-intercept|y intercept|yintercept|y-int)$/],
  ['x-intercept', /^(x-intercept|x intercept|xintercept|x-int|zero|zeros|roots?)$/],
  ['stationary-point-x', /^(stationary point|stationary points|turning point|turning points)$/],
  ['discriminant', /^(discriminant|delta)$/],
  ['answer', /^(ans|answer)$/],
  ['area', /^(area|a)$/], ['perimeter', /^(perimeter|p)$/], ['volume', /^(volume|v)$/], ['mean', /^(mean|average)$/], ['median', /^(median)$/]
];
const DERIVATIVE_LABEL = /^([a-z])'(?:\(([a-z])\))?$|^d([a-z])\/d([a-z])$|^derivative$/;

/** What a student's label word means, or null. The single letters (a, p, v) count only for the asked concept (see answerFacts). */
const LABEL_NOUNS = new Set(['the', 'value', 'height', 'profit', 'level', 'temperature', 'depth', 'speed', 'revenue', 'cost', 'population', 'amount', 'number', 'function']);
export function labelConcept(label) {
  let key = foldText(label).toLowerCase().replace(/\s+/g, ' ').trim().replace(/\s*-\s*/g, '-');
  // "the maximum height", "max profit": the student's own word for the quantity plus the thing it is of
  const words = key.split(' ');
  if (words.length > 1 && words.length <= 4) {
    const core = words.filter(w => !LABEL_NOUNS.has(w));
    if (core.length >= 1 && core.length < words.length && !core.some(w => /\d/.test(w))) key = core.join(' ') || key;
  }
  if (/^gradient$/.test(key) && /function/.test(label.toLowerCase())) return 'derivative';
  if (DERIVATIVE_LABEL.test(key.replace(/\s/g, ''))) return 'derivative';
  for (const [q, re] of LABEL_LEXICON) if (re.test(key)) return q;
  return null;
}

/** The name of the function whose derivative a label names (f'(x) -> f, dy/dx -> y), or ''. */
export function derivativeSubject(label) {
  const key = foldText(label).toLowerCase().replace(/\s/g, '');
  let m = /^([a-z])'/.exec(key); if (m) return m[1];
  m = /^d([a-z])\/d[a-z]$/.exec(key); if (m) return m[1];
  return '';
}

