# Notes to Experience 3 — the contract for writers and diagram builders

Owner brief (18 Nov 2026): every chapter of every year, in both editions, finished to Experience 3 of the Learning
Experience Standard, with accurate diagrams, interactive elements where they genuinely aid understanding, KaTeX for
all mathematics, Computer Modern for reading text, and nothing that reads as machine-written.

Coverage is measured by `node tools/notes-coverage.mjs` (report: `docs/content/notes-coverage-2026-11-18.md`;
test: `client/test/notes-coverage-check.mjs`). Layer content is checked by `client/test/notes-e3-check.mjs`.

## 1. The layer files (writers)

A chapter's existing notes are not rewritten. What Experience 3 still needs is written as a **layer** merged over them
(`client/src/notes/e3.js`):

| Band | Layer file |
|---|---|
| CBSE Class 7–12 | `client/src/notes/data/notes-e3-class<N>.js` |
| Olympiad (complete new chapters) | `client/src/notes/data/notes-olympiad.js` |
| NSW Stage 4 / Stage 5 core / Stage 5 path | `client/src/notes/nsw/notes-nsw-e3-stage4.js`, `-stage5-core.js`, `-stage5-path.js` |
| NSW Standard / Advanced / Ext 1 / Ext 2 | `client/src/notes/nsw/notes-nsw-e3-standard.js`, `-advanced.js`, `-ext1.js`, `-ext2.js` |

```js
export default {
  'c10-quadratic-equations': {
    objective: 'Solve a quadratic equation by factorising, completing the square or the formula, and use $b^2-4ac$ to say how many real roots it has before solving it.',
    intuition: 'A quadratic equation asks where a parabola meets the $x$-axis. …',
    check: [ { question: '…', answer: '…', verify: { kind: 'roots', f: 'x^2-5*x+6', answers: ['2', '3'] } }, … ],   // India: at least 2. NSW already has `check`.
    diagrams: [ { title: '…', spec: { kind: 'paramGraph', … }, note: '…' }, … ],
    mistakes: [ … ],              // optional extra misconceptions
    interactiveNone: '…'          // ONLY when no interactive diagram genuinely helps this chapter; say why (≥ 40 chars)
  }
};
```

**Every chapter needs, after merging:** an `objective`; an `intuition` (≥ 80 characters); a `check` of ≥ 2 questions
whose answers the engine re-derives (`verify` kinds: `value`, `values`, `roots`, `equivalent`, as in the existing
notes); **≥ 2 teaching diagrams** in total (NSW chapters already have 0–2: add to reach ≥ 2); **≥ 1 interactive
diagram** unless `interactiveNone` says honestly why none helps; and no mathematics outside `$…$`.

### Writing rules
- Original writing. Never copy or paraphrase NCERT, CBSE, NESA or textbook text; outcome codes are references only.
- Plain, precise, warm — the way a very good teacher writes on the board. No filler or hype: never "Let's dive in",
  "In this chapter we will explore", "unlock", "journey", "master", "powerful", "crucial", "delve", "seamless",
  exclamation marks, rhetorical questions as openers, or emoji. Short sentences; one idea each.
- `objective` is one sentence of what the student can **do** (verbs: solve, sketch, prove, find, explain, decide).
- `intuition` is the picture or the reason before the formalism: why the rule is true, what it looks like, where it
  comes from. It does not restate the formula list.
- All mathematics in KaTeX `$…$` — including units with powers (`$78\text{ cm}^2$`), angles (`$60^\circ$`), negative
  numbers in expressions, fractions (`$\tfrac{2}{3}$`). No Unicode ² ³ √ × ÷ − ≤ ≥ ≠ outside `$…$`. No machine tells:
  never `1x`, `+(-3)`, `x−(3)`, `+ -4`; write the simplified form a teacher would write.
- NSW: en-AU spelling (metre, centre, colour), dollars, no India references. Priyabhata: en-IN conventions (₹, lakh are
  fine), no NSW references.
- Checkpoint questions are new (not a copy of a worked example) and test the objective.

### Diagram rules
- A diagram is a **spec** from the same numbers as the text beside it, so it cannot disagree with it. Its `note` says
  what to look at, with the numbers the picture shows.
- Accuracy: axes through the true origin when 0 is in range; choose `xmin…ymax` so every labelled point, intercept and
  asymptote is inside the frame with margin; integer or half-integer ranges; labels in KaTeX; never two labels on the
  same spot (keep labelled points ≥ 1 grid unit apart or give `pos`); values rounded sensibly (the kit rounds; do not
  type a decimal the kit computes).
- Interactive only where moving one thing teaches something (a parameter, a point, a sample size). Nothing decorative.
- Verify every equation, intercept, vertex, asymptote and discontinuity you mention against the engine
  (`client/src/engine/plot.js`, `engine/expr.js`) or SymPy; `notes-e3-check` recomputes what the kit computes.

## 2. Diagram kinds

### Existing kinds (`docs/design/diagram-kit.md`)
Static: `function`, `trig`, `unitCircle`, `triangle`, `polygon`, `circleTheorem`, `numberLine`, `tree`, `venn`, `table`,
`histogram`, `boxPlot`, `normal`, `vector`, `sequence`, `compound`, `timeline`, `secantTangent`, `riemann`, `network`,
`scatter`, `solid`. Interactive: `transform`, `unitCircleDrag`, `secantToTangent`, `riemannSlider`, `normalZ`,
`compoundExplorer`. Read their params in `client/src/diagrams/geometry.js` (the `*Model` functions) and existing uses in
`client/src/notes/nsw/notes-nsw-stage6-advanced.js`.

### New kinds (packs in `client/src/diagrams/packs/`)
Expressions use the engine syntax (`x^2-6*x+5`, `sin(x)`, `sqrt(x)`, `exp(x)`, `ln(x)`, `abs(x)`); angles in degrees
unless stated. Every interactive kind has a static counterpart for questions and print.

**plane pack** (geometry and coordinate figures)
- `plane` (static) — the general figure. `{ xmin, xmax, ymin, ymax, axes = true, grid = axes, equal = true,
  points: [{ x, y, label?, pos? ('n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw') }],
  segments: [{ from: [x,y], to: [x,y], label?, dashed?, ticks? (equal-length marks 1–3), arrow? }],
  lines: [{ through: [[x,y],[x,y]], label? }]   (infinite, clipped to the frame),
  polygons: [{ points: [[x,y],…], label?, shade? }], circles: [{ cx, cy, r, label?, dashed? }],
  arcs: [{ cx, cy, r, from, to }] (degrees), angles: [{ at: [x,y], from: [x,y], to: [x,y], label? ('auto' = computed degrees), right? }],
  curves: [{ expr, label?, domain?: [a,b] }], param: [{ x: 'expr in t', y: 'expr in t', t: [a,b], label? }] }`.
  Covers coordinate geometry, constructions, congruence and similarity (two triangles side by side), quadrilaterals,
  conics (`param`), transformations, loci. The model computes every `auto` angle and every segment length.
- `parallelLines` (static) — two parallel lines cut by a transversal. `{ angle (transversal, 20–160), mark: ['a','b',…'h'] |
  'corresponding'|'alternate'|'coInterior'|'vertical', values = true }`. Angle values computed.
- `areaModel` (static) — rectangle split into a grid of labelled parts. `{ rows: [{ size, label }], cols: [{ size, label }],
  cells?: [[tex,…],…] }` (e.g. $(x+3)(x+2)$, $(a+b)^2$, $23\times 14$).
- `fractionBar` (static) — `{ bars: [{ parts, shaded, label? }] }` one bar per fraction, same width (comparison, equivalence).
- `triangleExplorer` (interactive; counterpart `triangle`) — `{ mode: 'angleSum'|'pythagoras'|'trigRatios'|'similar'|'area',
  initial: { … } }`: sliders change the triangle; readout shows the invariant with live numbers (angle sum $180^\circ$,
  $a^2+b^2=c^2$, $\sin\theta$ … for the chosen angle, scale factor and area ratio $k^2$, $\tfrac12 ab\sin C$).
- `circleExplorer` (interactive; counterpart `circleTheorem`) — `{ theorem: 'centre'|'segment'|'semicircle'|'cyclic'|'tangent'|'chords', initial }`:
  a point moved round the circle (keyboard slider + drag); the readout shows the angles that stay equal / in ratio.

**algebra pack** (functions, sequences, calculus, inequalities)
- `paramGraph` (interactive; counterpart `function`) — `{ expr: 'a*x^2+b*x+c', params: [{ name, min, max, step, initial, label? }],
  xmin, xmax, ymin, ymax, show?: ['roots','vertex','yIntercept','asymptotes','turning'], fixed?: [{ expr, label }] }`.
  Sliders for each parameter; the readout states the current equation (simplified: no `1x`, no `+ -`) and the shown features
  computed by the engine.
- `sequenceExplorer` (interactive; counterpart `sequence`) — `{ type: 'arithmetic'|'geometric', first, step (d or r), n, ranges? }`:
  terms as bars/points and the partial sum $S_n$; a geometric series with $|r|<1$ shows the limiting sum.
- `slopeField` (static) and `slopeFieldExplorer` (interactive) — `{ dydx: 'x*y' (in x and y), xmin…ymax, through?: [[x0,y0]] }`;
  the explorer moves the initial point and draws the solution curve (RK4).
- `region` (static) and `lpExplorer` (interactive) — `{ constraints: [{ a, b, op: '<='|'>='|'<'|'>', c }] (ax+by op c),
  xmin…ymax, objective?: { a, b, goal: 'max'|'min' } }`: feasible region shaded, vertices computed and labelled; the
  explorer slides the objective's level line and names the optimal vertex. Also 1- and 2-variable inequalities.
- `numberLineStepper` (interactive; counterpart `numberLine`) — `{ op: 'add'|'subtract'|'multiply', a, b, min, max, step,
  fractions?: denominator }`: integer or fraction arithmetic as jumps along the line.

**stats pack** (data, probability, counting)
- `barChart` (static) — `{ categories: [..], values: [..], yLabel?, horizontal?, dual?: { values, label } }`; `pieChart`
  (static) — `{ categories, values }` with computed angles.
- `pascal` (static) — `{ rows, highlight?: [[n,k],…], show?: 'values'|'binomial' }`.
- `binomial` (static) and `binomialExplorer` (interactive) — `{ n, p, highlight?: [k…] | { atLeast|atMost: k } }`; sliders for $n$ and $p$,
  readout $P$, $E(X)=np$, $\operatorname{Var}(X)=np(1-p)$.
- `probabilitySim` (interactive; counterpart `barChart`) — `{ experiment: 'coin'|'die'|'twoDiceSum'|'spinner'|'bag',
  sectors?/bag?: [{ label, weight }], event?: [outcomes], seed }`: buttons add 1/10/100/1000 trials from a seeded generator;
  bars of relative frequency beside the theoretical probability; the readout states both.
- `dataExplorer` (interactive; counterpart `boxPlot`) — `{ data: [..], editable: [indices], show: ['mean','median','mode','range','iqr','sd'] }`:
  sliders move chosen values; dot plot with the measures marked; the readout shows which measures moved (outliers vs median).

**space pack** (vectors, complex numbers, matrices, 3D, mensuration)
- `argand` (static) and `argandExplorer` (interactive) — `{ points: [{ re, im, label }], modArg?, roots?: n, multiply?: { re, im } }`;
  explorer modes `'polar'` (sliders r, θ), `'multiply'` (watch $zw$ rotate and scale), `'roots'` (slider n for the $n$th roots of unity).
- `vectorExplorer` (interactive; counterpart `vector`) — `{ a: [x,y], b: [x,y], mode: 'sum'|'difference'|'scalar'|'dot'|'projection' }`.
- `matrix2d` (static) and `matrixTransform` (interactive) — `{ m: [[a,b],[c,d]] }`: the unit square and its image; area = $|\det|$.
- `space3d` (static) — `{ points: [{ x, y, z, label }], vectors: [{ from, to, label }], lines?: [{ point, dir, label }], planes?: [{ n: [a,b,c], d }], box? }`
  in oblique projection with labelled axes. A plane `{ n: [a,b,c], d }` is $\vec n\cdot\vec r=d$, i.e. $ax+by+cz=d$ (not $+d=0$);
  it is drawn as the patch where it crosses the box of the axes, and its axis intercepts are stated in the description.
- `solidExplorer` (interactive; counterpart `solid`) — `{ shape: 'rectPrism'|'cylinder'|'cone'|'sphere'|'pyramid'|'hemisphere', dims sliders }`:
  volume and surface area with the numbers substituted.

## 3. Builders
Each pack owns only its two files (`packs/<pack>.kinds.js`: names, `validate(params)`, pure `model(params)`;
`packs/<pack>.jsx`: components) plus its tests. Same rules as the core kit: one accessible `<figure>`/`<svg role="img">`
with a computed text description, KaTeX labels (`Tex` from `Diagram.jsx`), Instrument tokens only, native range inputs
and buttons, a polite live region, 44 px targets, visible focus, `prefers-reduced-motion`, no overflow at 375 px.
Strings through `useKitText` (`client/src/diagrams/kitText.js`) with English (en-AU) and Hindi.
