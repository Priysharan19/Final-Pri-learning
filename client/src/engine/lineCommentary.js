// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the engine's commentary on a marked line, written from the engine's OWN FACTS
//
// No model, no provider, no stored text. `commentFor(card, ctx)` turns structured data the engine produced
// (the line's state, the rule the engine itself identified, the worked-solution step it matched, the value both
// sides come to, and for a cross the value the working reached and the value the line gives) into one sentence from a
// reviewed catalogue, English and Hindi. A slot is filled ONLY from a structured field: never parsed from a note or
// message string. Where the engine has no structured fact the answer is `null` and the caller keeps the engine's
// own sentence exactly as it was.
//
//   · a tick never gets a negative sentence; a cross never gets a positive one (the template set is chosen by state)
//   · an arithmetic tick (true as written) gets EQUALITY sentences only: nothing about the line's role
//   · for a cross, {expected} is always `diagnosis.expected` and {written} always `diagnosis.written`: they cannot swap
//   · a rule is named only when the engine named it for that line
//   · the wording varies by a stable hash of the line's number and text, so the same line always reads the same
//
// Pure, deterministic, no I/O. Feedback only: it never touches a mark, a tick or a cross.
// ─────────────────────────────────────────────────────────────────────────────
import { exactForm } from './arithmeticLines.js';
import { mathSpan } from './commentTex.js';

const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const pick = (variants, key) => variants[hash(key) % variants.length];
// A slot value: the engine's own TeX string for it (engine-built, never parsed from prose), or a number formatted by exactForm.
const fromTex = (tex, num) => (typeof tex === 'string' && tex.length > 0 && tex.length <= 120 && !tex.includes('$') ? `$${tex}$` : span(num));
const span = v => { if (typeof v !== 'number' || !Number.isFinite(v)) return null; try { return `$${exactForm(v).tex}$`; } catch { return null; } };

/** The reviewed catalogue. {slots} are filled from structured facts only. No em dashes. */
export const CATALOGUE = Object.freeze({
  restates: {
    en: ['Correct. This restates the question.', 'Correct. This line is the question’s own statement.', 'Correct. This is what the question gives.'],
    hi: ['सही। यह पंक्ति प्रश्न को दोहराती है।', 'सही। यह पंक्ति प्रश्न का अपना कथन है।', 'सही। यह वही है जो प्रश्न में दिया है।']
  },
  stepHeading: {
    en: ['Correct. This matches step {step} of the worked solution ({heading}).', 'Correct. This is step {step} of the worked solution: {heading}.'],
    hi: ['सही। यह हल के चरण {step} ({heading}) से मेल खाती है।', 'सही। यह हल का चरण {step} है: {heading}।']
  },
  step: {
    en: ['Correct. This matches step {step} of the worked solution.', 'Correct. This is step {step} of the worked solution.'],
    hi: ['सही। यह हल के चरण {step} से मेल खाती है।', 'सही। यह हल का चरण {step} है।']
  },
  ruleResult: {
    en: ['Correct. {rule} gives {result}.', 'Correct. {rule}: {result}.'],
    hi: ['सही। {rule} से {result} मिलता है।', 'सही। {rule}: {result}।']
  },
  rule: {
    en: ['Correct. {rule} is used on this line.', 'Correct. This line uses {rule}.'],
    hi: ['सही। इस पंक्ति में {rule} का उपयोग हुआ है।', 'सही। यह पंक्ति {rule} का उपयोग करती है।']
  },
  bothSides: {
    en: ['Both sides come to {value}.', 'Each side comes to {value}.', 'The value of both sides is {value}.'],
    hi: ['दोनों तरफ़ {value} आता है।', 'हर तरफ़ का मान {value} है।', 'दोनों तरफ़ का मान {value} है।']
  },
  equalsAbove: {
    en: ['This equals the line above: {value}.', 'This comes to the same value as the line above, {value}.', 'Same value as the line above: {value}.'],
    hi: ['यह ऊपर वाली पंक्ति के बराबर है: {value}।', 'यह ऊपर वाली पंक्ति के समान मान देती है, {value}।', 'ऊपर वाली पंक्ति जैसा ही मान: {value}।']
  },
  crossShould: {
    en: ['This line should come to {expected}, but it has {written}.', 'Check this line: it should come to {expected}, not {written}.'],
    hi: ['इस पंक्ति का मान {expected} होना चाहिए, पर इसमें {written} है।', 'इस पंक्ति को जाँचें: मान {expected} होना चाहिए, {written} नहीं।']
  },
  crossAbove: {
    en: ['The working above reaches {expected}, but this line has {written}.', 'This line should come to {expected}, but it has {written}.', 'Check this line: it should come to {expected}, not {written}.'],
    hi: ['ऊपर का हल {expected} तक पहुँचता है, पर इस पंक्ति में {written} है।', 'इस पंक्ति का मान {expected} होना चाहिए, पर इसमें {written} है।', 'इस पंक्ति को जाँचें: मान {expected} होना चाहिए, {written} नहीं।']
  },
  crossSide: {
    en: ['Both sides should come to {expected}, but this side comes to {written}.', 'This line should come to {expected}, but it has {written}.'],
    hi: ['दोनों तरफ़ {expected} आना चाहिए, पर इस तरफ़ {written} आता है।', 'इस पंक्ति का मान {expected} होना चाहिए, पर इसमें {written} है।']
  }
});
/** Every template kind, grouped by polarity, for the tests. */
export const TEMPLATE_KINDS = Object.freeze(Object.keys(CATALOGUE));
export const POSITIVE_KINDS = Object.freeze(['restates', 'stepHeading', 'step', 'ruleResult', 'rule']);
export const EQUALITY_KINDS = Object.freeze(['bothSides', 'equalsAbove']);
export const CROSS_KINDS = Object.freeze(['crossShould', 'crossAbove', 'crossSide']);

const fill = (template, slots) => template.replace(/\{(\w+)\}/g, (_, k) => slots[k]);
const rhsOf = text => { const raw = String(text ?? '').trim(); if (!raw.includes('=')) return null; const rhs = raw.split(/(?<![<>!=≤≥≠])=(?!=)/).pop().trim(); return rhs ? mathSpan(rhs) : null; };

/**
 * @param {object} card  a marked-page / annotated-working card: { n, status, valueChain, text, fact, diagnosis, rules, restated }
 * @param {{ language?: 'en'|'hi', ruleLabel?: (rule: object) => string }} ctx
 * @returns {{ text: string, kind: string, facts: object } | null}  null: keep the engine's own sentence
 */
export function commentFor(card, ctx = {}) {
  if (!card || typeof card !== 'object') return null;
  const lang = ctx.language === 'hi' ? 'hi' : 'en';
  const key = `${card.n}|${card.text}`;
  const done = (kind, slots, facts) => {
    for (const v of Object.values(slots)) if (v === null || v === undefined || v === '') return null;
    return { text: fill(pick(CATALOGUE[kind][lang], key), slots), kind, facts };
  };
  // a cross: the engine's structured diagnosis only
  if (card.status === 'first-error') {
    const d = card.diagnosis;
    const expected = fromTex(d?.expectedTex, d?.expected), written = fromTex(d?.writtenTex, d?.written);
    if (!d || expected === null || written === null || expected === written) return null;
    const kind = d.expectedFrom === 'line-above' ? 'crossAbove' : d.expectedFrom === 'left-side' ? 'crossSide' : 'crossShould';
    return done(kind, { expected, written }, { expected, written });
  }
  if (card.status !== 'checked') return null;
  // an arithmetic tick: true as written. Equality sentences only.
  if (card.valueChain === 'arithmetic') {
    const f = card.fact;
    const value = f && (f.kind === 'both-sides' || f.kind === 'equals-line-above') ? fromTex(f.tex, f.value) : null;
    if (value === null) return null;
    return done(f.kind === 'both-sides' ? 'bothSides' : 'equalsAbove', { value }, { value });
  }
  if (card.valueChain === 'given') return card.restated ? done('restates', {}, {}) : null;
  // a line the worked solution recognised
  if (card.valueChain === 'verified') {
    const f = card.fact;
    if (!f || f.kind !== 'solution-step' || !Number.isInteger(f.step)) return null;
    const heading = typeof f.heading === 'string' ? f.heading.replace(/\s+/g, ' ').trim().replace(/\.$/, '') : '';
    return heading ? done('stepHeading', { step: String(f.step), heading }, { step: f.step, heading }) : done('step', { step: String(f.step) }, { step: f.step });
  }
  // a line whose rule the engine itself identified
  if (!card.valueChain && Array.isArray(card.rules) && card.rules.length && typeof ctx.ruleLabel === 'function') {
    const labels = card.rules.map(r => ctx.ruleLabel(r)).filter(Boolean);
    if (labels.length !== card.rules.length) return null;
    const rule = labels.join(', ');
    const result = labels.length === 1 ? rhsOf(card.text) : null;
    const rules = card.rules.map(r => r.rule);
    return result ? done('ruleResult', { rule, result }, { rules, result: card.text }) : done('rule', { rule }, { rules });
  }
  return null;
}

/** All the sentence variants of a template kind (for the tests). */
export function variantsOf(kind, lang = 'en') { return CATALOGUE[kind]?.[lang === 'hi' ? 'hi' : 'en'] || []; }
