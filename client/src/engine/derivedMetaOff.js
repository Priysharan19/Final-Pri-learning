// Families whose step check would be DERIVED from the answer alone (an equation pinned by its
// solution) but whose working is not an equation chain in that one letter: the derived meta
// mis-models their steps and crossed true lines in the understanding audit (18 Nov 2026).
// Until each gets a structured, authored step meta, these are ANSWER ONLY: the final answer is
// marked as before and no line of working is judged.
//   y10-nonlinear   : working states each root of several; a true root is not a step of one equation
//   mex-vectors     : component and scalar lines are not roots of one equation
//   y9-indices-sci  : working moves between index and scientific forms, not an equation in one letter
//   y11-explog      : a rounded-root line (ln(2^x) = ln(258)) is a true step the derived meta cannot follow
//   c11-straight-lines : the same slope/intercept chain mis-modelled as one equation
//   (y12-integration is back ON: the every-reading rule, calculusSteps.lineProvenFalse, never crosses the integrand restated as a line)
// An authored `q.stepcheck` is never affected. Used by the server's and the device's stepMetaFor.
export const DERIVED_META_OFF = Object.freeze(['y10-nonlinear', 'mex-vectors', 'y9-indices-sci', 'y11-explog', 'c11-straight-lines']);
const OFF = new Set(DERIVED_META_OFF);
export const derivedMetaOff = q => OFF.has(String(q?.subtopic ?? ''));
