# The diagram kit (`client/src/diagrams/`)

One set of deterministic, parameter-driven SVG diagrams shared by Notes and questions. A diagram is drawn from a plain
**spec** with the same numbers its text or question uses, so a picture can never disagree with its words.

```jsx
<DiagramFromSpec spec={{ kind: 'triangle', a: 3, b: 4, c: 5 }} />          // static (notes and questions)
<DiagramFromSpec spec={{ kind: 'unitCircleDrag', initial: 30 }} interactive /> // Notes only
```

## How it is built
- `geometry.js` — pure functions, parameters in, coordinates and computed values out (no DOM, no clock). Everything a label
  says (an angle, an intercept, a probability, an area) is computed here from the spec, never typed. Expressions are
  evaluated by the app's engine (`engine/expr.js`). Tested against hand-worked values and pinned coordinates
  (`client/test/diagram-geometry-check.mjs`).
- `Diagram.jsx` — the static components. Each is one `<figure>` with an accessible `<svg role="img">`, a title, and a
  description that states the computed numbers (the text alternative). Labels are KaTeX (the app's `MathText`) inside the SVG.
  The two-way table is a real `<table>` with scoped headers and computed totals.
- `Interactive.jsx` — Notes-only variants that teach by changing one thing: transformation sliders (a, b, h, k; and a
  gradient/intercept explorer), a draggable unit-circle point, a secant moving to a tangent, Riemann rectangles by n,
  normal-curve area by z, compound interest by rate and time. Native range inputs (arrow, Home/End and Page keys), real
  buttons, a polite live region announcing the new numbers, 44 px targets, visible focus, `prefers-reduced-motion` honoured.
- `DiagramFromSpec.jsx` — the registry. **A question never receives an interactive diagram**: an interactive spec in a
  question draws its static counterpart (or nothing, when it has none).
- `diagrams.css` — Instrument tokens only (light and dark follow the theme); no colour scale of its own.

## Kinds (28)
Static (22): `function` (axes, ticks, asymptotes, intercepts, shading under a curve), `trig` (sin, cos, tan with
amplitude/period/shift), `unitCircle`, `triangle` (SSS or SAS, labelled sides and angles, right-angle mark), `polygon`
(regular), `circleTheorem` (`centre`, `segment`, `semicircle`, `cyclic`, `tangent`), `numberLine` (points, open/closed ends,
intervals), `tree` (exact fractions; branches must add to 1), `venn` (2 or 3 sets), `table` (two-way), `histogram`,
`boxPlot`, `normal` (shaded area by z or x), `vector` (tip to tail, resultant), `sequence` (`type`: arithmetic or
geometric), `compound`, `timeline` (cash flows), `secantTangent`, `riemann` (left, right, mid), `network` (nodes with positions, weighted or labelled edges, a highlighted `path` whose total the text states, `directed` for flow and activity networks), `scatter` (points, `line: 'fit'` for the least-squares line with its gradient, intercept and r, or `{m, c}`), `solid` (`rectPrism`, `cylinder`, `cone`, `sphere`, `pyramid` in oblique projection with hidden edges dashed and the exact volume in its description).
Interactive (6): `transform`, `unitCircleDrag`, `secantToTangent`, `riemannSlider`, `normalZ`, `compoundExplorer`.

## Tests
`diagram-geometry-check` (coordinates and invariants), `diagram-render-check` (every kind accessible, labelled, in bounds,
words state the numbers; interactive markup; stylesheet rules), `diagram-kit-browser-check` (real Chromium at 375 px: no
overflow, labels typeset inside their figures, keyboard and pointer, light/dark contrast, reduced motion, focus).

## Not yet
The kit's own English strings (default titles, descriptions, control labels) are written for the NSW edition (en-AU); they
move into the i18n catalogue when the kit is used in an edition that ships other languages.
