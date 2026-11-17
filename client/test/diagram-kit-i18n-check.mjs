// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the core diagram kit in English and Hindi, and its money
//
// The core kit (Diagram.jsx, Interactive.jsx) speaks through coreText.js. This holds:
//   TABLE     every English key has a Hindi entry with exactly the same {slots}, no
//             Hindi key is orphaned, and every Hindi entry is written in Devanagari;
//   HINDI     every core kind, static and interactive, drawn with the language set to
//             Hindi: its title, text alternative, control labels, button text, group
//             names, value text and live-region readout carry no English sentence
//             (KaTeX and the plain expressions a model drew are mathematics, not
//             English), the words typeset inside KaTeX labels (\text{…}) are Hindi,
//             every label still typesets, and no NaN, undefined or Infinity appears;
//   NUMBERS   the Hindi text alternative states the same computed numbers as the
//             English one (the kit formats numbers, the table only words them);
//   MONEY     compound, compoundExplorer and timeline print money with the spec's
//             `currency` ('$' or '₹'), else the edition's (INR → ₹, AUD → $); the
//             rupee typesets in KaTeX as \text{₹}.
// The English wording itself is held by diagram-render-check.mjs.
//
//   node client/test/diagram-kit-i18n-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';

// KaTeX has no font metrics for ₹ and says so on every render (the app's own NCERT content typesets
// \text{₹} the same way); that note is not a failure, so it is kept out of this suite's output.
const warn = console.warn;
console.warn = (...a) => { if (!/No character metrics for '₹'/.test(String(a[0]))) warn(...a); };

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));

// ── TABLE (pure: no React) ───────────────────────────────────────────────────
const { CORE_TEXT } = await import('../src/diagrams/coreText.js');
const slots = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const enKeys = Object.keys(CORE_TEXT.en); const hiKeys = Object.keys(CORE_TEXT.hi);
ok(enKeys.length > 150, `the core table has its strings (${enKeys.length})`);
const missing = enKeys.filter(k => typeof CORE_TEXT.hi[k] !== 'string' || !CORE_TEXT.hi[k].trim());
ok(missing.length === 0, `every English key has Hindi (${missing.join(', ')})`);
const orphan = hiKeys.filter(k => !Object.hasOwn(CORE_TEXT.en, k));
ok(orphan.length === 0, `no Hindi key without English (${orphan.join(', ')})`);
const slotDiff = enKeys.filter(k => CORE_TEXT.hi[k] !== undefined && slots(CORE_TEXT.en[k]) !== slots(CORE_TEXT.hi[k]));
ok(slotDiff.length === 0, `every Hindi entry has its English entry's {slots} (${slotDiff.map(k => `${k}: ${slots(CORE_TEXT.en[k])} vs ${slots(CORE_TEXT.hi[k])}`).join('; ')})`);
const notDevanagari = hiKeys.filter(k => CORE_TEXT.hi[k].replace(/\{\w+\}/g, '').trim() && !/[ऀ-ॿ]/.test(CORE_TEXT.hi[k]));
ok(notDevanagari.length === 0, `every Hindi entry that has words is in Devanagari (${notDevanagari.join(', ')})`);

// ── Rendering through the app's pipeline ─────────────────────────────────────
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});

const STATIC = {
  function: { kind: 'function', xmin: -4, xmax: 6, ymin: -6, ymax: 8, curves: [{ type: 'quadratic', a: 1, h: 1, k: -4, intercepts: true, label: 'y=(x-1)^2-4' }], points: [{ x: 1, y: -4, label: '(1,\\,-4)' }] },
  functionAsymptote: { kind: 'function', xmin: -4, xmax: 4, ymin: -4, ymax: 4, curves: [{ type: 'reciprocal', a: 1, label: 'y=\\frac{1}{x}' }], asymptotes: [{ x: 0, label: 'x=0' }, { y: 0, label: 'y=0' }] },
  functionShade: { kind: 'function', xmin: -1, xmax: 4, ymin: -1, ymax: 10, curves: [{ expr: 'x^2', shade: { from: 0, to: 3 } }] },
  trig: { kind: 'trig', fn: 'sin', a: 2 }, trigTan: { kind: 'trig', fn: 'tan' },
  unitCircle: { kind: 'unitCircle', deg: 135, showTan: true }, unitCircleAxis: { kind: 'unitCircle', deg: 90 },
  triangle: { kind: 'triangle', a: 3, b: 4, c: 5, showArea: true }, triangleSas: { kind: 'triangle', a: 5, b: 7, C: 60 }, polygon: { kind: 'polygon', n: 6, side: 2 },
  ...Object.fromEntries(['centre', 'segment', 'semicircle', 'cyclic', 'tangent'].map(t => [`circle-${t}`, { kind: 'circleTheorem', theorem: t }])),
  numberLine: { kind: 'numberLine', min: -5, max: 5, intervals: [{ from: -2, to: null, fromOpen: true }, { from: null, to: -4 }], points: [{ value: 3, open: true, label: 'x=3' }, { value: 1 }] },
  numberLineEmpty: { kind: 'numberLine', min: 0, max: 5 },
  tree: { kind: 'tree', branches: [{ label: 'R', p: [2, 5], children: [{ label: 'R', p: [1, 4] }, { label: 'B', p: [3, 4] }] }, { label: 'B', p: [3, 5], children: [{ label: 'R', p: [2, 4] }, { label: 'B', p: [2, 4] }] }] },
  venn2: { kind: 'venn', sets: 2, counts: { A: 12, B: 7, AB: 5, none: 6 }, labels: ['A', 'B'] },
  table: { kind: 'table', rows: ['P', 'Q'], cols: ['X', 'Y'], cells: [[12, 8], [9, 11]] },
  histogram: { kind: 'histogram', data: [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 6, 7], start: 0, width: 2 }, boxPlot: { kind: 'boxPlot', data: [2, 4, 4, 5, 7, 9, 10] },
  normal: { kind: 'normal', mu: 70, sigma: 5, from: 65, to: 80, mode: 'x' },
  vector: { kind: 'vector', vectors: [{ dx: 3, dy: 1, label: '\\mathbf{a}' }, { dx: 1, dy: 3, label: '\\mathbf{b}' }], resultant: true },
  sequenceA: { kind: 'sequence', first: 2, step: 3, n: 6 }, sequenceG: { kind: 'sequence', type: 'geometric', first: 3, step: 2, n: 6 },
  compound: { kind: 'compound', principal: 1000, rate: 0.05, years: 10 }, compoundQuarterly: { kind: 'compound', principal: 500, rate: 0.04, years: 3, perYear: 4 },
  timeline: { kind: 'timeline', events: [{ t: 0, amount: -500 }, { t: 1, amount: 200 }, { t: 2, amount: 200 }, { t: 3, amount: 200 }] },
  network: { kind: 'network', nodes: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 2 }, { id: 'C', x: 4, y: -2 }, { id: 'D', x: 8, y: 0 }], edges: [{ from: 'A', to: 'B', weight: 5 }, { from: 'A', to: 'C', weight: 3 }, { from: 'B', to: 'D', weight: 4 }, { from: 'C', to: 'D', weight: 6 }], path: ['A', 'B', 'D'] },
  networkFlow: { kind: 'network', directed: true, nodes: [{ id: 'S', x: 0, y: 0 }, { id: 'T', x: 6, y: 0 }], edges: [{ from: 'S', to: 'T', label: '7/10' }] },
  scatter: { kind: 'scatter', points: [[1, 2], [2, 3], [3, 5], [4, 4], [5, 6]], line: 'fit' }, scatterLine: { kind: 'scatter', points: [[1, 2], [2, 3], [3, 5]], line: { m: 1, c: 1 } },
  ...Object.fromEntries(['rectPrism', 'cylinder', 'cone', 'sphere', 'pyramid'].map(shape => [`solid-${shape}`, { kind: 'solid', shape, l: 4, w: 3, h: 5, r: 2 }])),
  secantTangent: { kind: 'secantTangent', expr: 'x^2', x0: 1, h: 1 },
  riemann: { kind: 'riemann', expr: 'x^2', a: 0, b: 3, n: 6, mode: 'left' }, riemannMid: { kind: 'riemann', expr: 'x^2', a: 0, b: 3, n: 4, mode: 'mid' }
};
const INTERACTIVE = {
  transform: { kind: 'transform', base: 'quadratic', initial: { a: -2, b: -1, h: 1, k: 1 } }, transformLinear: { kind: 'transform', base: 'linear', initial: { a: -2, k: 1 } },
  transformSin: { kind: 'transform', base: 'sin', initial: { b: 0 } },
  unitCircleDrag: { kind: 'unitCircleDrag', initial: 30 }, unitCircleDragAxis: { kind: 'unitCircleDrag', initial: 90 },
  secantToTangent: { kind: 'secantToTangent', expr: 'x^2', x0: 1 }, riemannSlider: { kind: 'riemannSlider', expr: 'x^2', a: 0, b: 3 },
  normalZ: { kind: 'normalZ' }, compoundExplorer: { kind: 'compoundExplorer', principal: 1000 }, compoundExplorerOneYear: { kind: 'compoundExplorer', principal: 1000, initialYears: 1 }
};
const CORE_KINDS = ['function', 'trig', 'unitCircle', 'triangle', 'polygon', 'circleTheorem', 'numberLine', 'tree', 'venn', 'table', 'histogram', 'boxPlot', 'normal', 'vector', 'sequence', 'compound', 'timeline', 'secantTangent', 'riemann', 'network', 'scatter', 'solid', 'transform', 'unitCircleDrag', 'secantToTangent', 'riemannSlider', 'normalZ', 'compoundExplorer'];

/** Remove balanced <tag ...>…</tag> blocks whose opening tag matches `open`. */
function dropBlocks(html, open, tag) {
  let out = ''; let i = 0;
  while (i < html.length) {
    const m = open.exec(html.slice(i));
    if (!m) { out += html.slice(i); break; }
    out += html.slice(i, i + m.index);
    let j = i + m.index + m[0].length; let depth = 1;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g'); re.lastIndex = j;
    let t;
    while (depth > 0 && (t = re.exec(html))) { depth += t[1] ? -1 : 1; j = re.lastIndex; }
    out += ' ';
    i = j;
  }
  return out;
}
const decode = s => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** The words a reader meets outside KaTeX: text nodes, aria-label and aria-valuetext. */
function words(html) {
  const attrs = [...html.matchAll(/\saria-(?:label|valuetext)="([^"]*)"/g)].map(m => decode(m[1]));
  let body = dropBlocks(html, /<span class="katex[^"]*"[^>]*>/, 'span');
  body = dropBlocks(body, /<foreignObject\b[^>]*>/, 'foreignObject');
  const text = decode(body.replace(/<[^>]+>/g, ' '));
  return [text, ...attrs].join(' ‖ ');
}
// Mathematics a text alternative may carry: TeX command names left by a label, function names, and the plain
// expressions a model drew (abs, sqrt …).
const MATH_WORDS = new Set(['frac', 'mathbf', 'sqrt', 'sin', 'cos', 'tan', 'abs', 'log', 'exp', 'cdot', 'left', 'right', 'theta', 'circ', 'text', 'pi', 'le', 'ge']);
const ENGLISH_SHORT = /\b(the|of|at|to|and|is|in|on|with|from|by|an|it|its)\b/i;
function englishIn(text) {
  const t = text.replace(/\\[a-zA-Z]+/g, ' ');
  // A label stripped of its backslashes leaves runs such as "sinleft": all mathematics.
  const mathRun = new RegExp(`^(?:${[...MATH_WORDS].join('|')})+$`, 'i');
  const long = [...t.matchAll(/[A-Za-z]{3,}/g)].map(m => m[0]).filter(w => !mathRun.test(w) && w !== w.toUpperCase());
  const short = ENGLISH_SHORT.exec(t);
  return [...new Set(long), ...(short ? [short[0]] : [])];
}
/** Words typeset inside KaTeX labels with \text{…}, read from the TeX annotation. */
const texWords = html => [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)].flatMap(m => [...decode(m[1]).matchAll(/\\text\{([^}]*)\}/g)].map(x => x[1]));
const descOf = html => decode(/<desc id="[^"]+">([^<]*)<\/desc>/.exec(html)?.[1] ?? '');
const numbersOf = s => (s.match(/-?\d+(?:\.\d+)?/g) || []).join(' ');

try {
  const reg = await server.ssrLoadModule('/src/diagrams/DiagramFromSpec.jsx');
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const kit = await server.ssrLoadModule('/src/diagrams/kitText.js');
  const D = await server.ssrLoadModule('/src/diagrams/Diagram.jsx');
  const { edition } = await server.ssrLoadModule('/src/platform/edition.js');
  const { createElement: h } = React;
  const draw = (spec, interactive) => renderToStaticMarkup(h(reg.default, { spec, interactive }));

  // kitText itself: pure, English when a key has no Hindi, an error for an unknown key.
  ok(kit.kitText(CORE_TEXT, 'hi', 'tex.area') === 'क्षेत्रफल' && kit.kitText(CORE_TEXT, 'en', 'polygon.title', { n: 6 }) === 'A regular polygon with 6 sides', 'kitText reads a key in a language and fills its slots');
  ok(kit.kitText({ en: { x: 'only {v}' }, hi: {} }, 'hi', 'x', { v: 2 }) === 'only 2', 'a key without Hindi falls back to English');
  let threw = false; try { kit.kitText(CORE_TEXT, 'en', 'no.such.key'); } catch { threw = true; }
  ok(threw, 'an unknown key is an error, never blank text');

  const covered = new Set([...Object.values(STATIC), ...Object.values(INTERACTIVE)].map(s => s.kind));
  ok(CORE_KINDS.every(k => covered.has(k)), `every core kind is drawn in Hindi (${CORE_KINDS.filter(k => !covered.has(k)).join(', ')})`);

  const english = {};
  for (const [name, spec] of Object.entries({ ...STATIC, ...INTERACTIVE })) english[name] = draw(spec, Object.hasOwn(INTERACTIVE, name));

  const lang = await i18n.setLanguage('hi');
  ok(lang === 'hi', `the Hindi catalogue loads (${lang})`);
  for (const [name, spec] of Object.entries({ ...STATIC, ...INTERACTIVE })) {
    const html = draw(spec, Object.hasOwn(INTERACTIVE, name));
    ok(html.length > 200, `${name}: draws in Hindi`);
    ok(!/NaN|undefined|Infinity/.test(html), `${name}: no NaN, undefined or Infinity in Hindi`);
    ok(!/katex-error/.test(html), `${name}: every KaTeX label typesets in Hindi`);
    const text = words(html);
    const found = englishIn(text);
    ok(found.length === 0, `${name}: no English left in the Hindi title, description, labels or readout (${found.join(', ')})`);
    ok(/[ऀ-ॿ]/.test(text), `${name}: the reader's words are Hindi`);
    const tw = texWords(html).filter(w => /[A-Za-z]{3,}/.test(w));
    ok(tw.length === 0, `${name}: words inside KaTeX labels are Hindi (${tw.join(', ')})`);
    if (!Object.hasOwn(INTERACTIVE, name) && spec.kind !== 'table') {
      const en = descOf(english[name]); const hi = descOf(html);
      ok(hi && hi !== en, `${name}: the Hindi text alternative is not the English one`);
      // The same computed numbers, as a multiset (word order may differ).
      const sortNums = s => numbersOf(s).split(' ').filter(Boolean).sort().join(' ');
      ok(sortNums(en) === sortNums(hi), `${name}: the Hindi text alternative states the same numbers as the English (${sortNums(en)} | ${sortNums(hi)})`);
    }
    const title = /<title id="[^"]+">([^<]*)<\/title>/.exec(html)?.[1] ?? /<h4 class="dgi-title"[^>]*>([^<]*)<\/h4>/.exec(html)?.[1] ?? '';
    if (spec.kind !== 'table') ok(/[ऀ-ॿ]/.test(title), `${name}: the default title is Hindi (${title})`);
  }
  // Spot checks of the terminology.
  const hiFn = draw(STATIC.functionAsymptote); const hiSc = draw(STATIC.scatter); const hiTree = draw(STATIC.tree); const hiBox = draw(STATIC.boxPlot);
  ok(/अनंतस्पर्शी/.test(hiFn) && /प्रवणता/.test(hiSc) && /y-अंतःखंड/.test(hiSc) && /प्रायिकता/.test(hiTree) && /माध्यिका/.test(hiBox) && /चतुर्थक/.test(hiBox), 'Hindi uses the NCERT terms (अनंतस्पर्शी, प्रवणता, अंतःखंड, प्रायिकता, माध्यिका, चतुर्थक)');
  ok(/सम्मिलित नहीं/.test(draw(STATIC.numberLine)) && /शीर्ष C पर समकोण/.test(draw(STATIC.triangle)), 'Hindi number line and right-angle wording');
  ok(/aria-valuetext="30 अंश, cos का मान 0\.866025, sin का मान 0\.5"/.test(draw(INTERACTIVE.unitCircleDrag, true)), 'the draggable point speaks Hindi with the same numbers');
  ok(/>पहले जैसा करें</.test(draw(INTERACTIVE.transform, true)) && />मध्य-बिंदु</.test(draw(INTERACTIVE.riemannSlider, true)) && />तिमाही</.test(draw(INTERACTIVE.compoundExplorer, true)), 'button text is Hindi');
  ok(/scope="col">कुल</.test(draw(STATIC.table)) && /द्वि-मार्गी सारणी/.test(draw(STATIC.table)), 'the two-way table headers are Hindi');

  // Back to English: the same component speaks English again.
  await i18n.setLanguage('en');
  ok(draw(STATIC.triangle) === english.triangle && draw(INTERACTIVE.compoundExplorer, true) === english.compoundExplorer, 'switching back to English restores the English markup exactly');

  // ── MONEY ──────────────────────────────────────────────────────────────────
  const editionSymbol = { INR: '₹', AUD: '$' }[edition().currency] ?? '$';
  ok(D.currencySymbol(undefined) === editionSymbol && D.currencySymbol('$') === '$' && D.currencySymbol('₹') === '₹' && D.currencySymbol('EUR') === editionSymbol, `currency: a spec's '$' or '₹' wins, anything else is the edition's (${edition().currency} → ${editionSymbol})`);
  ok(D.currencyTex('₹') === '\\text{₹}' && D.currencyTex('$') === '\\$', 'currency: KaTeX writes \\$ and \\text{₹}');
  const money = {
    compound: [{ kind: 'compound', principal: 1000, rate: 0.05, years: 10 }, false],
    timeline: [{ kind: 'timeline', events: [{ t: 0, amount: -500 }, { t: 1, amount: 200 }] }, false],
    compoundExplorer: [{ kind: 'compoundExplorer', principal: 1000 }, true]
  };
  for (const language of ['en', 'hi']) {
    await i18n.setLanguage(language);
    for (const [name, [spec, interactive]] of Object.entries(money)) {
      const rupee = draw({ ...spec, currency: '₹' }, interactive);
      const dollar = draw({ ...spec, currency: '$' }, interactive);
      const plain = draw(spec, interactive);
      const rupeeText = words(rupee); const dollarText = words(dollar);
      ok(/₹\d/.test(rupeeText) && !/\$\d/.test(rupeeText), `${name} (${language}): currency '₹' prints ₹ in its words and never $`);
      ok(/\$\d/.test(dollarText) && !/₹/.test(dollarText), `${name} (${language}): currency '$' prints $ and never ₹`);
      ok(/\\text\{₹\}/.test(rupee) && !/katex-error/.test(rupee) && !/\\\$/.test(rupee.replace(/<annotation[^>]*>[^<]*\\%[^<]*<\/annotation>/g, '')), `${name} (${language}): the rupee typesets in KaTeX as \\text{₹}`);
      ok(/\\\$/.test(dollar) && !/\\text\{₹\}/.test(dollar) && !/katex-error/.test(dollar), `${name} (${language}): the dollar typesets in KaTeX as \\$`);
      ok(plain === (editionSymbol === '₹' ? rupee : dollar), `${name} (${language}): with no currency it is the edition's (${editionSymbol})`);
    }
  }
  await i18n.setLanguage('en');
  const r = descOf(draw({ kind: 'compound', principal: 1000, rate: 0.05, years: 10, currency: '₹' }));
  ok(r === 'A ₹1000 investment at 5% per year compounded 1 time a year grows to ₹1628.89 after 10 years, earning ₹628.89 in interest; simple interest would give ₹1500.', `compound: the rupee description reads as the dollar one with ₹ (${r})`);
  const tl = descOf(draw({ kind: 'timeline', events: [{ t: 0, amount: -500 }, { t: 1, amount: 200 }], currency: '₹' }));
  ok(/pay ₹500 at year 0; receive ₹200 at year 1\. Net -₹300\./.test(tl), `timeline: rupee amounts and net (${tl})`);
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`DIAGRAM KIT I18N: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 60)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM KIT I18N: PASS — ${pass}/${pass} checks — every core kit string has Hindi with the same slots; every core kind draws in Hindi with no English left and the same numbers; money follows the spec's or the edition's currency`);
