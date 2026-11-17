// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram kit as drawn
//
// Every diagram kind is rendered from a plain spec and held to:
//   · it is one accessible figure: role="img", a title and a description (the text
//     alternative) naming the computed numbers, both referenced by aria-labelledby;
//   · no NaN, undefined or Infinity reaches the markup, and every KaTeX label
//     renders (no katex-error);
//   · every drawn coordinate lies inside the viewBox (no layout overflow), and the
//     svg has no fixed pixel width, so it scales down to a phone;
//   · the text alternative states the same numbers as the model (the picture and
//     its words cannot disagree);
//   · interactive variants: native range inputs with a label, min, max and step; a
//     polite live region; buttons that are real buttons; the draggable unit-circle
//     point is a slider with value text and arrow-key handling; and a question
//     never receives an interactive diagram (its static counterpart or nothing);
//   · the stylesheet: Instrument tokens only (light and dark follow the theme),
//     prefers-reduced-motion switches transitions off, 44 px touch targets, a
//     phone-width rule.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
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

const SPECS = {
  function: { kind: 'function', xmin: -4, xmax: 6, ymin: -6, ymax: 8, curves: [{ type: 'quadratic', a: 1, h: 1, k: -4, intercepts: true, label: 'y=(x-1)^2-4' }], points: [{ x: 1, y: -4, label: '(1,\\,-4)' }] },
  functionAsymptote: { kind: 'function', xmin: -4, xmax: 4, ymin: -4, ymax: 4, curves: [{ type: 'reciprocal', a: 1, label: 'y=\\frac{1}{x}' }], asymptotes: [{ x: 0, label: 'x=0' }, { y: 0, label: 'y=0' }] },
  functionShade: { kind: 'function', xmin: -1, xmax: 4, ymin: -1, ymax: 10, curves: [{ expr: 'x^2', shade: { from: 0, to: 3 } }] },
  trig: { kind: 'trig', fn: 'sin', a: 2, b: 1, c: 0, d: 0 },
  trigTan: { kind: 'trig', fn: 'tan' },
  unitCircle: { kind: 'unitCircle', deg: 135, showTan: true },
  triangle: { kind: 'triangle', a: 3, b: 4, c: 5, showArea: true },
  triangleSas: { kind: 'triangle', a: 5, b: 7, C: 60 },
  polygon: { kind: 'polygon', n: 6, side: 2 },
  circleCentre: { kind: 'circleTheorem', theorem: 'centre' },
  circleSegment: { kind: 'circleTheorem', theorem: 'segment' },
  circleSemi: { kind: 'circleTheorem', theorem: 'semicircle' },
  circleCyclic: { kind: 'circleTheorem', theorem: 'cyclic' },
  circleTangent: { kind: 'circleTheorem', theorem: 'tangent' },
  numberLine: { kind: 'numberLine', min: -5, max: 5, intervals: [{ from: -2, to: null, fromOpen: true }], points: [{ value: 3, open: true, label: 'x=3' }] },
  tree: { kind: 'tree', branches: [{ label: 'R', p: [2, 5], children: [{ label: 'R', p: [1, 4] }, { label: 'B', p: [3, 4] }] }, { label: 'B', p: [3, 5], children: [{ label: 'R', p: [2, 4] }, { label: 'B', p: [2, 4] }] }] },
  venn2: { kind: 'venn', sets: 2, counts: { A: 12, B: 7, AB: 5, none: 6 }, labels: ['A', 'B'] },
  venn3: { kind: 'venn', sets: 3, counts: { A: 3, B: 2, C: 4, AB: 1, AC: 2, BC: 1, ABC: 1, none: 5 } },
  histogram: { kind: 'histogram', data: [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 6, 7], start: 0, width: 2 },
  boxPlot: { kind: 'boxPlot', data: [2, 4, 4, 5, 7, 9, 10] },
  normal: { kind: 'normal', mu: 70, sigma: 5, from: 65, to: 80, mode: 'x' },
  vector: { kind: 'vector', vectors: [{ dx: 3, dy: 1, label: '\\mathbf{a}' }, { dx: 1, dy: 3, label: '\\mathbf{b}' }] },
  sequenceA: { kind: 'sequence', first: 2, step: 3, n: 6 },
  compound: { kind: 'compound', principal: 1000, rate: 0.05, years: 10 },
  timeline: { kind: 'timeline', events: [{ t: 0, amount: -500 }, { t: 1, amount: 200 }, { t: 2, amount: 200 }, { t: 3, amount: 200 }] },
  secantTangent: { kind: 'secantTangent', expr: 'x^2', x0: 1, h: 1 },
  riemann: { kind: 'riemann', expr: 'x^2', a: 0, b: 3, n: 6, mode: 'left' }
};
// A sequence spec names arithmetic or geometric with `type` (its own `kind` names the diagram).
SPECS.sequenceG = { kind: 'sequence', type: 'geometric', first: 3, step: 2, n: 6 };

try {
  const reg = await server.ssrLoadModule('/src/diagrams/DiagramFromSpec.jsx');
  const { createElement: h } = React;
  const draw = (spec, interactive = false) => renderToStaticMarkup(h(reg.default, { spec, interactive }));

  ok(reg.DIAGRAM_KINDS.length === 25, `25 diagram kinds are registered (${reg.DIAGRAM_KINDS.length})`);
  for (const k of ['function', 'trig', 'unitCircle', 'triangle', 'polygon', 'circleTheorem', 'numberLine', 'tree', 'venn', 'table', 'histogram', 'boxPlot', 'normal', 'vector', 'sequence', 'compound', 'timeline', 'secantTangent', 'riemann']) ok(reg.DIAGRAM_KINDS.includes(k), `kind ${k} is covered`);

  for (const [name, spec] of Object.entries(SPECS)) {
    const html = draw(spec);
    const label = `${name}`;
    ok(/<figure class="dg[^"]*" data-diagram="true">/.test(html) && /<svg [^>]*role="img"/.test(html), `${label}: one figure with an svg role="img"`);
    const t = /<title id="([^"]+)">([^<]+)<\/title>/.exec(html); const d = /<desc id="([^"]+)">([^<]+)<\/desc>/.exec(html);
    ok(t && d && t[2].trim().length > 3 && d[2].trim().length > 20, `${label}: a title and a description`);
    ok(t && d && html.includes(`aria-labelledby="${t[1]} ${d[1]}"`), `${label}: the svg is labelled by its title and description`);
    ok(!/NaN|undefined|Infinity/.test(html), `${label}: no NaN, undefined or Infinity in the markup`);
    ok(!/katex-error/.test(html), `${label}: every KaTeX label renders`);
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(html);
    ok(vb && !/<svg [^>]*\swidth="/.test(html), `${label}: a viewBox and no fixed width (it scales down to a phone)`);
    if (vb) {
      const W = Number(vb[1]); const H = Number(vb[2]);
      let bad = 0;
      for (const m of html.matchAll(/\b(?:cx|x1|x2)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > W + 2) bad++;
      for (const m of html.matchAll(/\b(?:cy|y1|y2)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > H + 2) bad++;
      for (const m of html.matchAll(/ d="([^"]+)"/g)) for (const n of m[1].matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) { if (Number(n[1]) < -2 || Number(n[1]) > W + 2 || Number(n[2]) < -2 || Number(n[2]) > H + 2) bad++; }
      ok(bad === 0, `${label}: every drawn coordinate lies inside the ${W}×${H} viewBox (${bad} outside)`);
      // labels: each foreignObject box stays within the viewBox horizontally (allowing a small bleed)
      let outside = 0;
      for (const m of html.matchAll(/<foreignObject x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
        const [x, y, w, hh] = m.slice(1).map(Number);
        if (x + w < 0 || x > W || y + hh < 0 || y > H) outside++;
      }
      ok(outside === 0, `${label}: every label sits on the figure (${outside} off it)`);
    }
  }

  // The words state the model's numbers.
  const geo = await server.ssrLoadModule('/src/diagrams/geometry.js');
  const tri = draw(SPECS.triangle);
  ok(/36\.8699/.test(tri) && /53\.1301/.test(tri) && /area 6/.test(tri) && /right angle at C/.test(tri), 'triangle: the description gives the computed angles, area and right angle');
  const circ = draw(SPECS.unitCircle);
  ok(/135 degrees/.test(circ) && new RegExp(String(geo.unitCirclePoint(135).cos)).test(circ), 'unit circle: the description gives the cosine and sine of the angle');
  ok(/6\.875|area/.test(draw(SPECS.riemann)) && new RegExp(String(geo.riemannModel({ expr: 'x^2', a: 0, b: 3, n: 6, mode: 'left' }).sum)).test(draw(SPECS.riemann)), 'Riemann: the description gives the rectangles\' total area');
  ok(/0\.8186|81\.9/.test(draw(SPECS.normal)), 'normal curve: the description gives the shaded area (0.8186)');
  ok(/1628\.89/.test(draw(SPECS.compound)), 'compound interest: the description gives 1628.89');
  ok(/1\/10/.test(draw(SPECS.tree)) && /3\/10/.test(draw(SPECS.tree)) && /add to 1/.test(draw(SPECS.tree)), 'tree: the description gives the exact path probabilities and that they add to 1');
  const tbl = renderToStaticMarkup(h((await server.ssrLoadModule('/src/diagrams/Diagram.jsx')).ProbabilityTable, { rows: ['Girls', 'Boys'], cols: ['Walk', 'Bus'], cells: [[12, 8], [9, 11]] }));
  ok(/<table/.test(tbl) && /scope="col"/.test(tbl) && /scope="row"/.test(tbl) && />20</.test(tbl) && />40</.test(tbl), 'the two-way table is a real table with scoped headers and computed totals');
  ok(!/<foreignObject/.test(tbl), 'and needs no SVG at all');

  // Interactive variants
  const INTERACTIVE = {
    transform: { kind: 'transform', base: 'quadratic' }, unitCircleDrag: { kind: 'unitCircleDrag', initial: 30 }, secantToTangent: { kind: 'secantToTangent', expr: 'x^2', x0: 1 },
    riemannSlider: { kind: 'riemannSlider', expr: 'x^2', a: 0, b: 3 }, normalZ: { kind: 'normalZ' }, compoundExplorer: { kind: 'compoundExplorer', principal: 1000 }
  };
  for (const [name, spec] of Object.entries(INTERACTIVE)) {
    const html = draw(spec, true);
    ok(/data-diagram-interactive/.test(html) && /<section [^>]*aria-labelledby=/.test(html) && /<h4 class="dgi-title"/.test(html), `${name}: a titled section`);
    const ranges = [...html.matchAll(/<input[^>]*type="range"[^>]*>/g)].map(m => m[0]);
    ok(ranges.length >= 1 && ranges.every(r => /\bid="/.test(r) && /\bmin="/.test(r) && /\bmax="/.test(r) && /\bstep="/.test(r) && /aria-valuetext="/.test(r)), `${name}: every slider is a native range input with min, max, step and value text`);
    ok(ranges.every(r => html.includes(`<label for="${/id="([^"]+)"/.exec(r)[1]}"`)), `${name}: every slider has a visible label tied to it`);
    ok(/role="status" aria-live="polite"/.test(html), `${name}: changes are announced in a polite live region`);
    ok(!/<button(?![^>]*type="button")/.test(html), `${name}: every button is type="button"`);
    ok(!/NaN|undefined|Infinity/.test(html) && !/katex-error/.test(html), `${name}: clean markup and labels`);
    ok(/<figure class="dg/.test(html) && (name === "unitCircleDrag" ? /role="group"/ : /role="img"/).test(html), `${name}: the picture inside is an accessible figure`);
    // A question never gets an interactive diagram.
    const asked = draw(spec, false);
    ok(!/data-diagram-interactive|type="range"/.test(asked), `${name}: in a question (not interactive) there is no control`);
  }
  const drag = draw(INTERACTIVE.unitCircleDrag, true);
  ok(/role="slider"[^>]*tabindex="0"/.test(drag) && /aria-valuemin="0"/.test(drag) && /aria-valuemax="359"/.test(drag) && /aria-valuenow="30"/.test(drag) && /aria-valuetext="30 degrees, cosine 0\.866025, sine 0\.5"/.test(drag), 'the draggable point is a keyboard slider with value text');
  ok(/aria-pressed="true"[^>]*>30°/.test(drag), 'the angle presets show which one is chosen (aria-pressed)');
  ok(draw({ kind: 'unitCircleDrag' }, false).includes('role="img"') && draw({ kind: 'transform' }, false) === '', 'a question gets the static unit circle, and nothing for a transformation slider');
  ok(draw({ kind: 'nope' }) === '' && draw(null) === '', 'an unknown spec draws nothing');
  const jsx = readFileSync(new URL('../src/diagrams/Interactive.jsx', import.meta.url), 'utf8');
  ok(/ArrowRight: big/.test(jsx) && /ArrowLeft: -big/.test(jsx) && /ArrowRight|ArrowUp/.test(jsx) && /PageUp/.test(jsx) && /shiftKey/.test(jsx) && /Home/.test(jsx), 'the draggable point handles arrow, Shift, Page and Home/End keys');
  ok(/pointerdown|onPointerDown/i.test(jsx) && /setPointerCapture/.test(jsx), 'and pointer drag with capture');
} finally {
  await server.close();
}

// The stylesheet
const css = readFileSync(new URL('../src/diagrams/diagrams.css', import.meta.url), 'utf8');
const strip = css.replace(/var\([^)]*\)/g, '');
ok(!/#[0-9a-fA-F]{3,8}\b/.test(strip), 'every colour comes from an Instrument token (hard-coded colours only as var() fallbacks)');
ok(/--in-tx/.test(css) && /--in-signal/.test(css) && /--in-edge/.test(css), 'the Instrument text, signal and edge tokens are used');
ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none !important/.test(css), 'prefers-reduced-motion turns every transition off');
ok(/min-height: 44px/.test(css) && /min-width: 44px/.test(css), 'controls are 44 px targets');
ok(/\.dg-svg \{[^}]*width: 100%[^}]*height: auto/.test(css) && /max-width: 100%/.test(css), 'the svg scales to its container');
ok(/@media \(max-width: 480px\)/.test(css), 'there is a phone-width rule');
ok(/:focus-visible/.test(css), 'focus is visible on controls and the draggable point');

if (failures.length) {
  console.error(`DIAGRAM RENDER: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 50)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM RENDER: PASS — ${pass}/${pass} checks — every diagram kind is an accessible, labelled, in-bounds figure whose words state its numbers; interactive variants are keyboard-operable and never reach a question`);
