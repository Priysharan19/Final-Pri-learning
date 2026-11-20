// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the graph-sketch answer form, as drawn
//
// components/SketchAnswer.jsx rendered in Node (server rendering, no browser):
//
//   1 · every field is labelled, in English and Hindi, and only the features the
//       question asks for are offered;
//   2 · BEFORE the question is resolved the preview draws the student's own
//       points on axes and nothing else: no curve, no feature they have not
//       entered, and nothing read from the question's private fields;
//   3 · AFTER it is resolved the form is read-only, the true curve is drawn with
//       the student's points over it, and each asked feature carries the
//       marker's verdict;
//   4 · QuestionCard routes a graph-sketch question to this form and to no other
//       answer surface (no handwriting or photo tabs, no generic answer line).
//
//   node client/test/graph-sketch-ui-check.mjs
// SYNTHETIC: rendered markup only. No physical-device or human-review evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
// Every regular-expression metacharacter of a label is escaped.
const rx = s => s.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const h = React.createElement;
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
const draw = el => renderToStaticMarkup(el);

try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const Sketch = (await server.ssrLoadModule('/src/components/SketchAnswer.jsx')).default;
  const model = await server.ssrLoadModule('/src/components/sketchAnswerModel.js');
  const en = (await server.ssrLoadModule('/src/i18n/strings.en.js')).default;
  const hi = (await server.ssrLoadModule('/src/i18n/strings.hi.js')).default;
  const { generateQuestion, loadAllBanks } = await server.ssrLoadModule('/src/engine/generators/index.js');
  await loadAllBanks();

  // A real question the generators issue, with its PUBLIC shape (the fields the server sends).
  let q = null;
  for (let i = 1; i < 200 && !q; i++) {
    const cand = generateQuestion('y12-appdiff', 3, i * 7919);
    if (cand.answerType === 'graph-sketch' && cand.sketchAsk.includes('xIntercepts')) q = cand;
  }
  ok(!!q, 'a sketch question that asks for x-intercepts, the y-intercept and turning points can be drawn');
  const publicQ = { id: 'q1', answerType: 'graph-sketch', prompt: q.prompt, sketchAsk: q.sketchAsk };
  const key = q.answer.key;
  const text = JSON.stringify(key);
  const noop = () => {};
  const props = extra => ({ question: publicQ, value: '', onChange: noop, onSubmit: noop, ...extra });

  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const t = (k, v) => i18n.translate(k, v);
    const html = draw(h(Sketch, props()));
    for (const k of ['sketch.xIntercepts', 'sketch.yIntercept', 'sketch.turning']) {
      const label = t(k);
      ok(new RegExp(`<label[^>]*for="[^"]+"[^>]*>${rx(label)}</label>|<legend[^>]*>${rx(label)}</legend>`).test(html), `${lang}: the "${label}" field has its label`);
    }
    ok(/<input[^>]*data-sketch-xs/.test(html) && /<input[^>]*data-sketch-y\b/.test(html) && /<select[^>]*data-sketch-tk/.test(html), `${lang}: a field for each asked feature, and a type choice for the turning point`);
    ok(html.includes(`aria-label="${t('sketch.turning.row', { n: 1 })}"`), `${lang}: each turning point row is a named group`);
    ok(html.includes(t('sketch.preview.empty')) && html.includes(t('sketch.preview.note')), `${lang}: the preview says it shows only the student's points`);
    ok(/aria-describedby="[^"]+-xs-help"/.test(html), `${lang}: the hint under a field is tied to it`);
  }
  await i18n.setLanguage('en');

  // 1 · only what is asked
  const onlyY = draw(h(Sketch, props({ question: { ...publicQ, sketchAsk: ['yIntercept', 'turning'] } })));
  ok(!onlyY.includes('data-sketch-xs') && onlyY.includes('data-sketch-y') && onlyY.includes('data-sketch-tk'), 'a question that does not ask for x-intercepts is not given that field');
  const unknown = draw(h(Sketch, props({ question: { ...publicQ, sketchAsk: ['yIntercept', 'oblique', 'vertical'] } })));
  ok(unknown.includes('data-sketch-y') && !unknown.includes('data-sketch-xs') && !unknown.includes('data-sketch-tk'), 'a feature the form cannot take is not offered');

  // 2 · before resolution: the student's own points, no curve, no private data
  const empty = draw(h(Sketch, props()));
  ok(empty.includes('data-sketch-preview') && !empty.includes('sk-curve') && !empty.includes('data-sketch-result'), 'with nothing entered: axes, no curve, no result');
  ok(!/<circle[^>]*r="3\.8"/.test(empty), 'with nothing entered no point is drawn');
  const spy = { ...publicQ, answer: { key, text: q.answer.text, graph: q.answer.graph }, steps: q.steps, spec: q.answer.graph.spec, solution: { answerText: q.answer.text } };
  const spied = draw(h(Sketch, props({ question: spy })));
  ok(spied === empty, 'the form draws the same page whatever private fields the question object carries');
  ok(!spied.includes(q.answer.text) && !spied.includes(q.answer.graph.spec.expression), 'the answer sentence and the marker expression are nowhere in it');
  const part = draw(h(Sketch, props({ value: JSON.stringify({ intercepts: { y: key.intercepts.y } }) })));
  const circles = (part.match(/<circle[^>]*r="3\.8"/g) || []).length;
  ok(circles === 1 && part.includes(`(0, ${String(key.intercepts.y).replace('-', '\u2212')})`), 'one entered point gives one drawn point, labelled with its coordinates');
  ok(!part.includes('sk-curve') && !/class="sk-rings"><circle/.test(part), 'a partly entered answer still shows no curve');
  const full = draw(h(Sketch, props({ value: text })));
  const expected = model.pointsOfSet(key).length;
  ok((full.match(/<circle[^>]*r="3\.8"/g) || []).length === expected, `every entered point is drawn (${expected})`);
  ok(!full.includes('sk-curve') && !full.includes('data-sketch-result') && full.includes('data-sketch-preview'), 'a complete answer is still only points, until the question is resolved');
  ok(/value="[^"]*"/.test(full) && !/disabled=""/.test(full), 'before resolution the fields are editable');
  ok(!/disabled=""[^>]*data-sketch-xs|data-sketch-xs[^>]*disabled=""/.test(full), 'the x-intercept field is not disabled before resolution');

  // 3 · after resolution
  const verdicts = [
    { feature: 'xIntercepts', verdict: 'ok' },
    { feature: 'yIntercept', verdict: 'wrong', detail: 'wrong', wentWrong: 'Check the y-intercept.', correct: `y = ${key.intercepts.y}` },
    { feature: 'turning', verdict: 'wrong', detail: 'wrong-kind' }
  ];
  const resolved = draw(h(Sketch, props({ value: text, disabled: true, result: { spec: q.answer.graph.spec, awarded: 1, possible: 3, verdicts } })));
  ok(resolved.includes('data-sketch-result') && resolved.includes('sk-curve') && !resolved.includes('data-sketch-preview'), 'resolved: the marked view with the true curve replaces the preview');
  ok(resolved.includes('data-sketch-summary') && resolved.includes('1 of 3 features right'), 'resolved: the per-feature panel says how many features were right, as feedback beside the marks');
  ok(/data-sketch-feature="xIntercepts" data-verdict="ok"/.test(resolved) && /data-sketch-feature="yIntercept" data-verdict="wrong"/.test(resolved), 'resolved: each asked feature carries the marker\'s verdict');
  ok(resolved.includes(en['sketch.detail.wrongKind']) && resolved.includes(en['sketch.result.ok']), 'resolved: the verdict is said in words');
  ok(resolved.includes(en['sketch.result.should'].replace('{value}', '')) || /It should be/.test(resolved), 'resolved: a feature that is not right says what it should be');
  ok(/class="sk-rings"><circle/.test(resolved) && resolved.includes(en['sketch.legend.yours']), 'resolved: the student\'s points are drawn over the curve and named in the legend');
  ok(!/<input(?![^>]*type="checkbox")[^>]*data-sketch-xs[^>]*>/.test(resolved) || /<input[^>]*data-sketch-xs[^>]*disabled/.test(resolved), 'resolved: the fields are read-only');
  ok(!resolved.includes('Add a turning point') && !resolved.includes(en['sketch.lede']), 'resolved: no editing controls and no instructions');
  const revealed = draw(h(Sketch, props({ value: '', disabled: true, result: { spec: q.answer.graph.spec } })));
  ok(revealed.includes('data-sketch-result') && revealed.includes('sk-curve') && !/class="sk-rings"><circle/.test(revealed) && !/data-verdict="(?:ok|wrong|missing)"/.test(revealed), 'revealed without an answer: the curve and its features, and no verdict');
  await i18n.setLanguage('hi');
  const hindi = draw(h(Sketch, props({ value: text, disabled: true, result: { spec: q.answer.graph.spec, verdicts } })));
  ok(hindi.includes(hi['sketch.result.title']) && hindi.includes(hi['sketch.detail.wrongKind']), 'resolved, in Hindi: the title and the verdict are in Hindi');
  await i18n.setLanguage('en');

  // 4 · the card
  const card = read('src/components/QuestionCard.jsx');
  ok(/import SketchAnswer from '\.\/SketchAnswer\.jsx'/.test(card), 'QuestionCard imports the sketch form');
  ok(/question\.answerType === 'graph-sketch' \? 'type' : preferMode\(\)/.test(card), 'a sketch question always opens on the typed surface');
  ok(/\{!isMcq && !isSketch && \(\s*<div className="mode-tabs seg"/.test(card), 'a sketch question has no handwriting or photo tab');
  ok(/\) : isSketch \? \(\s*<div[^>]*data-sketch-shell>\s*<SketchAnswer question=\{question\} value=\{answer\} onChange=\{editAnswer\}/.test(card), 'a sketch question is answered in the sketch form, through the card\'s ordinary answer');
  ok(/result=\{resolved \? res\?\.solution\?\.sketch \|\| null : null\}/.test(card), 'the form is given the marker\'s result only once the question is resolved');
  ok(/res\.solution\.answerText && !isSketch/.test(card) && /!verdictGood && res\.solution && !isSketch/.test(card), 'the generic "final answer" and "expected" lines are not drawn for a sketch');
  ok(/question\.answerType === 'graph-sketch'\) return null;/.test(card), 'a sketch question draws no second, generic graph');
  const css = read('src/components/SketchAnswer.css');
  ok(!/gradient|#[0-9a-f]{3,8}\b|rgba?\(/i.test(css), 'the sketch form\'s styles use the design tokens only: no gradient and no raw colour');
  const source = read('src/components/SketchAnswer.jsx');
  ok(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(source + css), 'no emoji in the form');
} finally {
  await server.close();
}

const total = pass + failures.length;
if (failures.length) {
  console.log(`GRAPH SKETCH UI: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`);
  process.exit(1);
}
console.log(`GRAPH SKETCH UI: PASS — ${pass}/${total} checks`);
