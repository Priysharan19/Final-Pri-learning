// The diagram kinds by name, without the components, so node tools and tests can
// tell a static kind from an interactive one without loading React or JSX.
// DiagramFromSpec.jsx registers a component for every name here
// (client/test/diagram-packs-check.mjs fails if the two disagree).
import * as plane from './packs/plane.kinds.js';
import * as algebra from './packs/algebra.kinds.js';
import * as stats from './packs/stats.kinds.js';
import * as space from './packs/space.kinds.js';

export const PACKS = Object.freeze({ plane, algebra, stats, space });

// The original kit (Diagram.jsx, Interactive.jsx).
const CORE_STATIC = [
  'function', 'trig', 'unitCircle', 'triangle', 'polygon', 'circleTheorem', 'numberLine', 'tree', 'venn', 'table', 'histogram',
  'boxPlot', 'normal', 'vector', 'sequence', 'compound', 'timeline', 'secantTangent', 'riemann', 'network', 'scatter', 'solid'
];
const CORE_INTERACTIVE = ['transform', 'unitCircleDrag', 'secantToTangent', 'riemannSlider', 'normalZ', 'compoundExplorer'];

const packNames = part => Object.values(PACKS).flatMap(p => Object.keys(p[part]));
export const STATIC_KIND_NAMES = Object.freeze([...CORE_STATIC, ...packNames('STATIC')]);
export const INTERACTIVE_KIND_NAMES = Object.freeze([...CORE_INTERACTIVE, ...packNames('INTERACTIVE')]);
export const PACK_COUNTERPARTS = Object.freeze(Object.assign({}, ...Object.values(PACKS).map(p => p.COUNTERPART)));

/** The pack entry ({ validate, model }) of a pack kind, or null for a core kind. */
export function packKind(kind) {
  for (const p of Object.values(PACKS)) {
    if (Object.hasOwn(p.STATIC, kind)) return p.STATIC[kind];
    if (Object.hasOwn(p.INTERACTIVE, kind)) return p.INTERACTIVE[kind];
  }
  return null;
}

/** Problems with a spec: unknown kind, or what the pack's validator reports. Empty when good. */
export function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') return ['spec is not an object'];
  const { kind, ...params } = spec;
  if (!STATIC_KIND_NAMES.includes(kind) && !INTERACTIVE_KIND_NAMES.includes(kind)) return [`unknown diagram kind ${kind}`];
  const p = packKind(kind);
  return p?.validate ? p.validate(params) : [];
}
