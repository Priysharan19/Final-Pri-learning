// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Advanced variety forms print clean mathematics
// Every new form, every difficulty it serves, 300 seeds: nothing a student reads may carry a doubled sign
// ("+ -", "- -"), a unit or zero coefficient ("1x", "0x"), a stray double space, a coefficient glued to a
// minus sign that was meant to be a negative term ("4-\cos"), or a degenerate "0\cos". SYNTHETIC.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
const SRC = new URL('../src/', import.meta.url).href;
const { makeRng } = await import(`${SRC}engine/qhelpers.js`);
const files = ['au-forms-adv11-c-nsw.js', 'au-forms-adv11-d-nsw.js', 'au-forms-adv12-c-nsw.js', 'au-forms-adv12-d-nsw.js'];
const BAD = [
  [/\+ -/, 'plus then minus'], [/- -/, 'minus then minus'], [/\+ \+/, 'plus plus'], [/\( ?\+/, 'bracket then plus'], [/= \+/, 'equals plus'],
  [/(?<![\d.^_{(,\w])[01](?=[a-zA-Z]|\\(?:sin|cos|tan|theta|log|sqrt))/, 'unit or zero coefficient'],
  [/\d-\\(?:sin|cos|tan)/, 'coefficient glued to a minus'], [/(?<=\S) {2,}(?=\S)/, 'double space']
];
let forms = 0, draws = 0;
const bad = new Set();
for (const f of files) {
  const m = await import(`${SRC}engine/generators/${f}`);
  for (const [id, vs] of Object.entries(m.forms)) vs.forEach((v, i) => {
    forms++;
    for (const d of v.diffs) for (let s = 1; s <= 300; s++) {
      const q = v.make(makeRng(s * 7919 + d * 131 + i), d);
      draws++;
      const texts = [q.prompt, ...q.hints, ...q.steps.flatMap(t => [t.h, t.d]), ...(q.mcqOptions || [])];
      for (const t of texts) for (const [re, why] of BAD) if (re.test(t.replace(/\n+/g, " "))) bad.add(`${id} form ${i} D${d}: ${why}: ${t.slice(0, 120)}`);
    }
  });
}
assert.ok(bad.size === 0, `${bad.size} lint failures:\n  ${[...bad].slice(0, 40).join('\n  ')}`);
console.log(`ADVANCED FORMS LINT: PASS — ${forms} forms, ${draws} draws, no doubled sign, unit or zero coefficient, glued minus or stray space.`);
