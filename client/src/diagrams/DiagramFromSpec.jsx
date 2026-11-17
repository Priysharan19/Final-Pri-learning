// A diagram from a plain, serialisable spec: { kind, ...params }. This is how a
// note or a question names the picture it needs, with the SAME numbers its text
// uses. Interactive kinds render only where `interactive` is allowed (Notes);
// a question's figure is always static, so an interactive spec in a question
// draws its static counterpart instead (or nothing, when it has none).
import React from 'react';
import {
  FunctionGraph, TrigGraph, UnitCircle, Triangle, RegularPolygon, CircleTheorem, NumberLine, TreeDiagram, VennDiagram, ProbabilityTable,
  Histogram, BoxPlot, NormalCurve, VectorDiagram, SequenceDiagram, CompoundGrowth, Timeline, SecantTangent, RiemannRectangles,
  Network, Scatter, Solid
} from './Diagram.jsx';
import { TransformSliders, UnitCircleDrag, SecantToTangent, RiemannSlider, NormalAreaByZ, CompoundInterestExplorer } from './Interactive.jsx';
import * as planePack from './packs/plane.jsx';
import * as algebraPack from './packs/algebra.jsx';
import * as statsPack from './packs/stats.jsx';
import * as spacePack from './packs/space.jsx';
import { PACK_COUNTERPARTS } from './kinds.js';

const PACK_COMPONENTS = [planePack, algebraPack, statsPack, spacePack];

export const STATIC_KINDS = Object.freeze({
  function: FunctionGraph, trig: TrigGraph, unitCircle: UnitCircle, triangle: Triangle, polygon: RegularPolygon, circleTheorem: CircleTheorem,
  numberLine: NumberLine, tree: TreeDiagram, venn: VennDiagram, table: ProbabilityTable, histogram: Histogram, boxPlot: BoxPlot, normal: NormalCurve,
  vector: VectorDiagram, sequence: SequenceDiagram, compound: CompoundGrowth, timeline: Timeline, secantTangent: SecantTangent, riemann: RiemannRectangles, network: Network, scatter: Scatter, solid: Solid,
  ...Object.assign({}, ...PACK_COMPONENTS.map(p => p.STATIC_COMPONENTS))
});
export const INTERACTIVE_KINDS = Object.freeze({
  transform: TransformSliders, unitCircleDrag: UnitCircleDrag, secantToTangent: SecantToTangent, riemannSlider: RiemannSlider, normalZ: NormalAreaByZ, compoundExplorer: CompoundInterestExplorer,
  ...Object.assign({}, ...PACK_COMPONENTS.map(p => p.INTERACTIVE_COMPONENTS))
});
// What a question shows when a spec asks for an interactive kind.
const STATIC_COUNTERPART = Object.freeze({ unitCircleDrag: 'unitCircle', secantToTangent: 'secantTangent', riemannSlider: 'riemann', normalZ: 'normal', compoundExplorer: 'compound', ...PACK_COUNTERPARTS });

export const DIAGRAM_KINDS = Object.freeze([...Object.keys(STATIC_KINDS), ...Object.keys(INTERACTIVE_KINDS)]);

export default function DiagramFromSpec({ spec, interactive = false }) {
  if (!spec || typeof spec !== 'object') return null;
  const { kind, ...params } = spec;
  if (Object.hasOwn(INTERACTIVE_KINDS, kind)) {
    if (interactive) { const C = INTERACTIVE_KINDS[kind]; return <C {...params} />; }
    // A counterpart is a static kind with the same params, or (for a pack kind whose static
    // picture takes other params) a function from the interactive params to a static spec.
    const counterpart = STATIC_COUNTERPART[kind];
    if (!counterpart) return null;
    if (typeof counterpart === 'function') return <DiagramFromSpec spec={counterpart(params)} />;
    const S = STATIC_KINDS[counterpart];
    return <S {...params} />;
  }
  if (!Object.hasOwn(STATIC_KINDS, kind)) return null;
  const C = STATIC_KINDS[kind];
  return <C {...params} />;
}
