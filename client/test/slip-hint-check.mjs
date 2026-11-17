// A Socratic nudge that knows the first error must never state or imply an answer.
import assert from 'node:assert/strict';
import { SLIP_HINTS, slipHint } from '../src/engine/slipHint.js';
import { MISCONCEPTION_IDS } from '../src/engine/misconceptions.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const ids = Object.keys(SLIP_HINTS);
ok(ids.length >= 30, `${ids.length} moves carry a nudge`);
for (const id of ids) {
  ok(MISCONCEPTION_IDS.includes(id), `${id} is an ontology move`);
  for (const lang of ['en', 'hi']) {
    const text = slipHint(id, lang);
    ok(typeof text === 'string' && text.length > 20 && text.length < 220, `${id}/${lang} is one short sentence`);
    ok(!/[0-9०-९]/.test(text), `${id}/${lang} holds no digit, so no value`);
    ok(!/[=+×÷*^<>≤≥√π$∫∑%\\]/.test(text), `${id}/${lang} holds no operator, relation or maths span`);
    ok(/[?？]/.test(text) && (text.match(/[?？]/g) || []).length === 1, `${id}/${lang} asks one question`);
    ok(!/\b(the answer is|is equal to|you should write|correct (answer|line))\b/i.test(text) && !/उत्तर है|के बराबर है/.test(text), `${id}/${lang} states no result`);
    ok(lang === 'en' ? !/[ऀ-ॿ]/.test(text) : /[ऀ-ॿ]/.test(text), `${id}/${lang} is in its own language`);
  }
}
ok(slipHint('counterexample') === null && slipHint('not-a-move') === null && slipHint(undefined) === null && slipHint('__proto__') === null && slipHint('constructor') === null, 'an unknown id keeps the existing hint');
ok(slipHint('int-sign', 'fr') === SLIP_HINTS['int-sign'].en, 'an unknown language falls back to English');

// Topic catalogues (misconceptions/topics): every registered slip's own nudge obeys the same rules,
// and a slip with none borrows the nudge of the ontology move it names. Registered here as a fixture.
const { registerTopic, registeredTopics } = await import('../src/engine/misconceptions/topics/index.js');
registerTopic({ topic: 'slip-hint-fixture', appliesTo: () => false, slips: [
  { code: 'fixture-own-nudge', socratic: { en: 'Which angle does that ratio belong to in this triangle?', hi: 'यह अनुपात इस त्रिभुज के किस कोण का है?' }, detect: () => null },
  { code: 'fixture-borrowed', misconceptionId: 'int-sign', detect: () => null },
  { code: 'fixture-silent', detect: () => null }
] });
ok(slipHint('fixture-own-nudge', 'en').startsWith('Which angle') && /[ऀ-ॿ]/.test(slipHint('fixture-own-nudge', 'hi')), 'a topic slip carries its own nudge');
ok(slipHint('fixture-borrowed', 'en') === SLIP_HINTS['int-sign'].en, 'a topic slip naming an ontology move borrows its nudge');
ok(slipHint('fixture-silent') === null, 'a topic slip with none keeps the existing hint');
for (const t of registeredTopics()) for (const sl of t.slips) {
  if (!sl.socratic) continue;
  for (const lang of ['en', 'hi']) {
    const text = sl.socratic[lang];
    ok(typeof text === 'string' && text.length > 15 && text.length < 220, `${sl.code}/${lang} socratic is one short sentence`);
    ok(!/[0-9०-९]/.test(text) && !/[=+×÷*^<>≤≥√π$∫∑%\\]/.test(text), `${sl.code}/${lang} socratic holds no value, operator or maths span`);
    ok((text.match(/[?？]/g) || []).length === 1, `${sl.code}/${lang} socratic asks one question`);
  }
}

// The same text is returned whatever the student wrote: it depends on the id alone.
ok(slipHint('int-sign', 'en') === slipHint('int-sign', 'en'), 'deterministic');

// The server's answer guard finds nothing in any nudge, for a question that prints numbers and steps.
const { buildGuard, leakedExpressions } = await import('../../server/platform/tutorGuard.js');
const question = { prompt: 'Find the integral of 3x^2 + 4x.', steps: [{ h: 'Raise each power', d: 'x^3 + 2x^2 + c' }], answer: 'x^3 + 2x^2 + c', hints: [] };
const guard = buildGuard(question, { studentLines: ['3x^3 + 4x^2'], verifiedLines: 0 });
for (const id of ids) for (const lang of ['en', 'hi']) ok(leakedExpressions(slipHint(id, lang), guard, { prompt: question.prompt }).length === 0, `${id}/${lang} passes the answer guard`);
console.log(`SLIP HINT: PASS — ${n}/${n} checks — ${ids.length} moves, two languages, questions only, no value, answer guard silent`);
