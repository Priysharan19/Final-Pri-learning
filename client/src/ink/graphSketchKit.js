// The graph sketch reader, as one lazily loaded chunk (InkAnswer imports it on
// a read): it stays out of the install and the warm pass (first-visit budget,
// client/test/install-budget-check.mjs) and is fetched with the first read.
export { splitSketchRegion } from './graphSketch.js';
export { proposeSketch } from './graphLabels.js';
export { default as GraphSketchConfirm } from './GraphSketchConfirm.jsx';
