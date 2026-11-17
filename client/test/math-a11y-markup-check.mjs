// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · accessible mathematics: the markup every formula gets (lib/latex.jsx)
//
// Rendered through the real component (server-side): every formula is a role="math" wrapper whose
// aria-label is the spoken maths; the KaTeX inside (and its MathML) is aria-hidden so nothing is
// announced twice; no role="math" is nested; notes and worked examples can make formulas focusable;
// "Read formula" is a named button with a polite live region; a formula that fails to parse is still
// named; text outside $…$ is never given a role; the speech language follows the interface.
//
//   node client/test/math-a11y-markup-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));

const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
try {
  const latex = await server.ssrLoadModule('/src/lib/latex.jsx');
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const { MathText } = latex;
  const { ReadableFormula } = await server.ssrLoadModule('/src/lib/ReadableFormula.jsx');
  const h = React.createElement;
  const render = (el) => renderToStaticMarkup(el);
  const mathNodes = html => [...html.matchAll(/<span class="pri-math[^"]*" role="math" aria-label="([^"]*)"([^>]*)>/g)].map(m => ({ name: m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'), rest: m[2] }));

  const samples = ['The roots of $x^2-2x-3=0$ are $-1$ and $3$.', 'Area $=\\int_1^3 (6x^2-4x+5)\\,dx=46$', '$\\frac{64}{3}\\approx 21.33$', 'No maths here, only *words* and **bold**.', 'Cost \\$4 and $5\\%$ off'];
  for (const text of samples) {
    const html = render(h(MathText, { text }));
    const n = mathNodes(html);
    const dollars = (text.match(/(?<!\\)\$/g) || []).length / 2;
    ok(n.length === Math.floor(dollars), `"${text.slice(0, 30)}…": ${Math.floor(dollars)} formulas, ${n.length} role="math" nodes`);
    ok(n.every(m => m.name.length > 0 && /[\p{L}\p{N}]/u.test(m.name)), `"${text.slice(0, 30)}…": every formula has a spoken name`);
    ok(n.every(m => !/\\[a-zA-Z]+|[{}^_]/.test(m.name)), `"${text.slice(0, 30)}…": no LaTeX in a spoken name`);
    // The KaTeX (with its MathML) sits inside an aria-hidden span, inside the role="math" wrapper: announced once.
    const wraps = [...html.matchAll(/<span class="pri-math[^"]*" role="math"[^>]*><span aria-hidden="true">(<span class="katex(?:-display)?">|<span class="katex-display">)/g)];
    ok(wraps.length === n.length, `"${text.slice(0, 30)}…": every formula's KaTeX is aria-hidden inside its wrapper (${wraps.length}/${n.length})`);
    ok(!/role="math"[^>]*>(?:(?!<\/span><\/span>).)*role="math"/s.test(html), `"${text.slice(0, 30)}…": no role="math" nested`);
    ok((html.match(/role="math"/g) || []).length === n.length, `"${text.slice(0, 30)}…": nothing but the formulas has role="math"`);
    ok(!/tabindex/.test(html), `"${text.slice(0, 30)}…": a formula is not a tab stop (it is not a control)`);
  }
  ok(mathNodes(render(h(MathText, { text: 'a $x^2-2x-3$ b' })))[0].name === 'x squared minus 2 x minus 3', 'the spoken name of x^2-2x-3 is "x squared minus 2 x minus 3"');
  ok(mathNodes(render(h(MathText, { text: '$\\frac{64}{3}$' })))[0].name === '64 over 3', 'the spoken name of 64/3 is "64 over 3"');
  ok(!/role="math"/.test(render(h(MathText, { text: 'plain *text*, no maths' }))), 'text with no formula carries no role="math"');

  // a formula KaTeX cannot parse is still a named math node, escaped
  const bad = render(h(MathText, { text: '$\\unknowncommand{x}^{$' }));
  ok(mathNodes(bad).length === 1 && mathNodes(bad)[0].name.length > 0, 'an unparseable formula is still named');
  ok(!/<script|onerror=/i.test(render(h(MathText, { text: '$<script>alert(1)</script>$' }))), 'a formula carrying markup is escaped');
  const q = render(h(MathText, { text: '$a"b\\text{say "hi"}$' }));
  ok(/<span class="pri-math" role="math" aria-label="[^"]*"><span aria-hidden="true">/.test(q) && /&quot;/.test(q.match(/aria-label="([^"]*)"/)[1]), 'a quote in a formula is escaped and cannot break out of the aria-label');

  // Read formula
  const rf = render(h(ReadableFormula, { tex: 'x^2-2x-3', label: 'Formula', readLabel: 'Read formula', hideLabel: 'Hide reading' }));
  ok(/<button type="button"[^>]*aria-expanded="false"[^>]*aria-label="Read formula: Formula"/.test(rf), '"Read formula" is a named button, collapsed at first');
  ok(/role="status" aria-live="polite"/.test(rf), 'the reading is announced through a polite live region');
  ok(!/tabindex/.test(rf), 'no non-interactive tab stop: the keyboard stop is the Read formula button');
  ok(/aria-label="x squared minus 2 x minus 3"/.test(rf), 'the formula carries its spoken name');

  // language follows the interface
  await i18n.setLanguage('hi');
  const hi = mathNodes(render(h(MathText, { text: '$x^2-2x-3$' })));
  ok(hi.length === 1 && hi[0].name === 'x का वर्ग घटा 2 x घटा 3', `in Hindi the formula is spoken in Hindi (${hi[0]?.name})`);
  await i18n.setLanguage('en');
  const en = mathNodes(render(h(MathText, { text: '$x^2-2x-3$' })));
  ok(en[0]?.name === 'x squared minus 2 x minus 3', 'back in English it is spoken in English');
} finally {
  await server.close();
}
if (failures.length) {
  console.error(`MATH A11Y MARKUP: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`MATH A11Y MARKUP: PASS — ${pass}/${pass} checks — every formula is a role="math" with a spoken name, announced once, never nested; Read formula is a named button with a live region; the language follows the interface`);
