// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter · the deterministic RULE interpreter
//
// Reads a line into a claim by fixed patterns. It never evaluates, simplifies
// or checks anything: it only says what shape the line has and which pieces of
// it are the parts. Every piece is a substring of the line as written (the
// guard in claims.js confirms it). A line the patterns do not cover is
// `unparseable` (or `prose` when it carries no mathematics): that is the
// model interpreter's turn, or coverage lost; never a guess.
// ─────────────────────────────────────────────────────────────────────────────
import { foldText, guardClaim, unparseable } from './claims.js';
import { labelConcept } from './verifier.js';

const LEAD = /^(?:(?:so|hence|therefore|thus|then|now|and)\b[,:]?\s*|[∴∵]\s*)+/i;
const UNIT_TAIL = /\s*(?:sq\.?\s*)?(?:cm|km|mm|kg|ml|units?|degrees?|metres|meters|litres|liters|seconds|minutes|hours|dollars)\s*[²³]?\s*$/i;
const MATH_SIGNAL = /[0-9=+\-*/^×÷√π]/;
const NAME = /^[A-Za-z]$/;

const mk = (kind, fields) => ({ kind, quantity: 'none', subject: '', label: '', at: '', parts: [], ...fields });

function splitEquals(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === '=' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}

const stripUnit = piece => piece.replace(UNIT_TAIL, '').trim();
const isDerivativeName = piece => labelConcept(piece) === 'derivative';

/** "maximum value of h": the label and (when the line says one) the object it names. */
function labelParts(piece) {
  const m = /^(.*?)\s+of\s+([A-Za-z])(?:\s*\([^)]*\))?$/.exec(piece);
  if (m && labelConcept(m[1])) return { label: m[1].trim(), subject: m[2] };
  return labelConcept(piece) ? { label: piece, subject: '' } : null;
}

export function interpretLineByRules(rawText, description = { functions: [], equations: [] }) {
  const original = String(rawText ?? '');
  let t = foldText(original).trim().replace(LEAD, '').trim();
  if (!t) return unparseable('empty');
  const words = (t.match(/[A-Za-z]{3,}/g) || []).filter(w => !/^(sin|cos|tan|sec|csc|cot|log|max|min|cosec|sqrt|exp|ln|and|cm|km|mm|kg|ml)$/i.test(w));
  if (!MATH_SIGNAL.test(t)) return mk('prose');
  if (/[<>≤≥≠≈]/.test(t)) {
    // an inequality is never evaluated here; it can only restate one the question gave
    const one = (t.match(/[<>≤≥≠≈]/g) || []).length === 1 && !t.includes('=');
    return one ? mk('expression', { parts: [stripUnit(t)] }) : unparseable('relation-not-equals');
  }
  if (words.length >= 4) return unparseable('sentence-with-maths');

  // let / set / put / when NAME = value
  const lead = /^(let|set|put|when|where|given|suppose|take)\s+(.*)$/i.exec(t);
  if (lead) {
    const body = lead[2].trim();
    const pieces = splitEquals(body);
    if (pieces.length === 2 && pieces[0] && pieces[1]) {
      const [l, r] = [pieces[0], stripUnit(pieces[1])];
      if (isDerivativeName(l) || NAME.test(l) || /^[A-Za-z]\s*\(\s*[A-Za-z]\s*\)$/.test(l)) {
        if (/^0$/.test(r) && (isDerivativeName(l) || description.functions.some(f => l === f.name || l.startsWith(`${f.name}(`)))) return mk('condition', { parts: [l, r] });
        return mk('defines', { subject: l, parts: [r] });
      }
    }
    return unparseable('definition-shape');
  }

  // a list of solutions: x = 0 or x = -3 ; x = 0, -3 ; x = 0, x = -3
  const listed = t.split(/\s*(?:\bor\b|\band\b|,|;)\s*/i).map(x => x.trim()).filter(Boolean);
  if (listed.length > 1) {
    const m0 = /^([A-Za-z])\s*=\s*(.+)$/.exec(listed[0]);
    if (m0) {
      const variable = m0[1];
      const vals = listed.map((p, i) => { const m = /^([A-Za-z])\s*=\s*(.+)$/.exec(p); if (m) return m[1] === variable ? stripUnit(m[2]) : null; return i > 0 && /^[-+]?[\d./]+(?:\s*[√π][\d./]*)?$/.test(p) ? p : null; });
      if (vals.every(v => v !== null)) return mk('solution-set', { subject: variable, parts: vals });
    }
    return unparseable('list-shape');
  }

  // a continuation: "= 27"
  if (t.startsWith('=')) {
    const pieces = splitEquals(t.slice(1).trim()).map(stripUnit);
    if (!pieces.length || pieces.some(p => !p)) return unparseable('empty-continuation');
    return mk('continues', { parts: pieces });
  }

  // "the maximum height is 22 + 5 = 27 metres": a quantity named in words, then "is", then the value (or a chain)
  const isForm = /^(.*?)\s+is\s+(.+)$/i.exec(t);
  if (isForm && labelParts(isForm[1].trim()) && !/=/.test(isForm[1])) {
    const lp2 = labelParts(isForm[1].trim());
    const chain = splitEquals(isForm[2]).map(stripUnit);
    if (chain.length && chain.every(Boolean)) return mk('quantity', { quantity: labelConcept(lp2.label), label: lp2.label, subject: lp2.subject, parts: chain });
  }

  const pieces = splitEquals(t);
  if (pieces.length === 1) {
    const e = stripUnit(pieces[0]);
    return e ? mk('expression', { parts: [e] }) : unparseable('empty');
  }
  if (pieces.some(p => !p)) return unparseable('empty-side');
  const [head, ...rest] = pieces;
  const values = rest.map(stripUnit);

  const lp = labelParts(head);
  if (lp) return mk('quantity', { quantity: labelConcept(lp.label), label: lp.label, subject: lp.subject, parts: values });
  // "x = 4": a value asserted for the unknown
  if (NAME.test(head) && values.length === 1 && /^[-+]?(?:\d+(?:\.\d+)?|\d+\/\d+)$/.test(values[0])) return mk('solution-set', { subject: head, parts: [values[0]] });
  return mk('equation', { parts: [stripUnit(head), ...values] });
}

/** A rule reading, guarded. `source` marks it as the only kind that may cross a line. */
export function ruleInterpretation(text, description) {
  const claim = guardClaim(interpretLineByRules(text, description), text);
  return { claim, source: 'rule' };
}
