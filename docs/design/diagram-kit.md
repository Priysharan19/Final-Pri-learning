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
overflow, labels typeset inside their figures, keyboard and pointer, light/dark contrast, reduced motion, focus),
`diagram-kit-i18n-check` (the core table's Hindi parity and slots; every core kind drawn in Hindi with no English left and
the same numbers; money in `$` and `₹`).

## Languages
The core kit's words — every default title, every `<desc>` sentence, control labels, button text, group names, value
text, live-region readouts and the words typeset inside KaTeX labels (`\text{area}`, `\text{secant: }` …) — live in
`coreText.js` as `{ en, hi }` and are read with `useKitText(CORE_TEXT)` (`kitText.js`), in the language on screen. English
(en-AU) reads exactly as it always has; Hindi uses the NCERT Hindi-medium terms (प्रवणता, अंतःखंड, शीर्ष, अनंतस्पर्शी,
प्रायिकता, माध्यिका, चतुर्थक, सदिश, समांतर/गुणोत्तर अनुक्रम, चक्रवृद्धि ब्याज). Numbers are still computed and formatted by
the kit (`r3`) and arrive in `{slots}`; mathematics stays KaTeX or the plain expression the model drew. `geometry.js` builds
no reader-facing words (its only strings are authoring errors), so it stays pure and language-free. The table is kept out
of the app catalogue (`strings.*.js` is in the marker's import tree). Labels and names a spec supplies (curve labels, set
names, table headings, slider `names`) are the author's and are shown as given.

## Money
`compound`, `compoundExplorer` and `timeline` take an optional `currency`: `'$'` or `'₹'`. Without one (or with anything
else) the kit uses this build's edition: Priyabhata (INR) prints `₹`, Prithagoras (AUD) prints `$`
(`currencySymbol()` in `Diagram.jsx`, reading `platform/edition.js`). Inside KaTeX the dollar is `\$` and the rupee is
`\text{₹}`, as the app's NCERT content already writes it (KaTeX logs a font-metrics note for `₹`; the glyph comes from the
fallback font). A note meant for one edition only may still pin `currency` so a Node suite, which runs as the default
edition, draws what that edition's build draws.

## Not yet
Done (Notes E3): the kit's own strings moved out of the components into `coreText.js` with Hindi (see Languages), and money
follows the spec or the edition (see Money). Still English-only: authoring errors thrown by `geometry.js` (for the author,
never shown to a student). Digits are Western (0–9) in every language, as in the NCERT Hindi-medium books.
