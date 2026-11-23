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
//   · a cross that continues the line above names the value the working reached; a cross between two sides never says what a side
//     "should" be (either may be the slip); a value-only solution tick is never said to BE the step
//   · a rule is named only when the engine named it for that line
//   · the wording varies by a stable hash of the line's number and text, so the same line always reads the same
//
// New templates (a value-only tick, a cross between sides) are written in English only: in any other language they give null and the
// engine's own sentence stays.
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
  stepValue: {
    en: ['This line comes to {value}, the value at step {step} of the worked solution.', 'The value at step {step} of the worked solution is {value}, and so is the value of this line.', 'This is the value at step {step} of the worked solution: {value}.']
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
  crossAbove: {
    en: ['The working above reaches {expected}, but this line has {written}.', 'Check this line: the working above reaches {expected}, not {written}.'],
    hi: ['ऊपर का हल {expected} तक पहुँचता है, पर इस पंक्ति में {written} है।']
  },
  crossComputed: {
    en: ['{expr} comes to {expected}, but this line gives {written}.', 'Check this line: {expr} comes to {expected}, not {written}.', 'This line gives {written}, but {expr} comes to {expected}.']
  },
  crossSidesDiffer: {
    en: ['The two sides do not match: {left} comes to {leftValue}, and {right} comes to {rightValue}.', 'The two sides are not equal: {left} comes to {leftValue}, but {right} comes to {rightValue}.', 'The two sides differ: {left} comes to {leftValue} and {right} comes to {rightValue}.']
  }
});
/** Every template kind, grouped by polarity, for the tests. */
export const TEMPLATE_KINDS = Object.freeze(Object.keys(CATALOGUE));
export const POSITIVE_KINDS = Object.freeze(['restates', 'stepHeading', 'step', 'stepValue', 'ruleResult', 'rule']);
export const EQUALITY_KINDS = Object.freeze(['bothSides', 'equalsAbove']);
export const CROSS_KINDS = Object.freeze(['crossAbove', 'crossComputed', 'crossSidesDiffer']);

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
    // a template with no wording in this language gives nothing: the engine's own sentence stays (new templates are English only)
    if (!CATALOGUE[kind][lang]?.length) return null;
    return { text: fill(pick(CATALOGUE[kind][lang], key), slots), kind, facts };
  };
  // a cross: the engine's structured diagnosis only
  if (card.status === 'first-error') {
    const d = card.diagnosis;
    if (!d || typeof d !== 'object') return null;
    // only a cause the engine named, with the facts that cause needs; anything else (a log line false under both readings, an
    // unknown cause) keeps the engine's own sentence
    // (no "should" sentence exists: when two sides disagree, either may be the slip, so only a cross that continues the line
    // above, where the working above is the established value, says what it "reaches")
    if (d.expectedFrom === 'line-above') {
      const expected = fromTex(d.expectedTex, d.expected), written = fromTex(d.writtenTex, d.written);
      if (expected === null || written === null || expected === written) return null;
      return done('crossAbove', { expected, written }, { expected, written });
    }
    if (d.expectedFrom === 'sides') {
      // the first two sides that disagree. A bare number against a computed expression: the expression is named, with its value.
      // Two computed expressions: either may be the slip, so neither is "expected". Three or more sides: only a computed
      // expression against a bare number is said, never "both"; two computed expressions among many is left to the old sentence.
      const count = d.sides?.count;
      // a side's value is the engine's TeX, or the number the engine evaluated (formatted by exactForm)
      const norm = x => { if (!x || typeof x.text !== 'string' || !x.text.trim() || typeof x.bare !== 'boolean') return null;
        const tex = typeof x.tex === 'string' ? x.tex : (typeof x.value === 'number' && Number.isFinite(x.value) ? exactForm(x.value).tex : null);
        return tex && tex.length <= 120 && !tex.includes('$') ? { text: x.text, tex, bare: x.bare } : null; };
      const L = norm(d.sides?.left), R = norm(d.sides?.right);
      if (!L || !R || L.tex === R.tex) return null;
      if (L.bare !== R.bare) {
        const [comp, bare] = L.bare ? [R, L] : [L, R];
        const expr = mathSpan(comp.text), expected = `$${comp.tex}$`, written = `$${bare.tex}$`;
        return done('crossComputed', { expr, expected, written }, { expr, expected, written });
      }
      if (!L.bare && count === 2) {
        const left = mathSpan(L.text), right = mathSpan(R.text), leftValue = `$${L.tex}$`, rightValue = `$${R.tex}$`;
        return done('crossSidesDiffer', { left, leftValue, right, rightValue }, { left, leftValue, right, rightValue });
      }
      return null;
    }
    return null;
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
    // a line ticked only because its VALUE is a value at that step is never said to be that step
    if (f.valueOnly === true) {
      const value = fromTex(f.tex, null);
      return value === null ? null : done('stepValue', { step: String(f.step), value }, { step: f.step, value });
    }
    // a step heading is the worked solution's own English text: a Hindi sentence never embeds it (the engine's sentence stays)
    const heading = typeof f.heading === 'string' ? f.heading.replace(/\s+/g, ' ').trim().replace(/\.$/, '') : '';
    if (heading && lang !== 'en') return null;
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
