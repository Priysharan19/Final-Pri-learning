import { classifySystem, determinants, equationText, lineNature, MAX_ABS_COEFFICIENT } from './lineMath.js';
import { chapterSelection } from './identity.js';

// Local, synthetic display contract; never a server-issued or graded question.
export const LAB_HANDOFF_VERSION = 1;
export const LAB_CONCEPT_ID = 'c10-pair-linear-equations';
export const LAB_QUESTION_PROVENANCE = 'Pri Atlas synthetic laboratory example; not an official CBSE examination question';
const copy = line => Object.freeze({a:line.a,b:line.b,c:line.c});
export function createLaboratoryHandoff(lines) {
  if (!Array.isArray(lines) || lines.length !== 2) throw new TypeError('Two equations required');
  const first = copy(lines[0]), second = copy(lines[1]);
  const eq1 = equationText(first), eq2 = equationText(second);
  const result = classifySystem(first, second);
  const {D,Dx,Dy} = determinants(first,second);
  const nature1 = lineNature(first), nature2 = lineNature(second);
  const question = 'Consider the system ' + eq1 + ' and ' + eq2 + '. ' +
    (result.kind === 'unique' ? 'Solve the system exactly and explain why the solution is unique.' :
      'Classify its solution set: no solutions, infinitely many solutions on a line, or all ordered pairs. Justify your answer including any degenerate equations.');
  const steps = ['Equation 1: ' + eq1 + '.', 'Equation 2: ' + eq2 + '.'];
  if (nature1 !== 'line' || nature2 !== 'line') {
    if (nature1 === 'plane' || nature2 === 'plane')
      steps.push('The equation 0 = 0 is an identity and imposes no restriction.');
    if (nature1 === 'empty' || nature2 === 'empty')
      steps.push('An equation 0 = c with c nonzero is a contradiction.');
  } else {
    steps.push('D = a₁b₂ − a₂b₁ = ' + D + '.');
    steps.push('Dₓ = c₁b₂ − c₂b₁ = ' + Dx + '; Dᵧ = a₁c₂ − a₂c₁ = ' + Dy + '.');
  }
  let conclusion;
  if (result.kind === 'unique') {
    steps.push('Since D ≠ 0, Cramer’s rule gives x = Dₓ/D = ' + result.exactPoint.x.text +
      ' and y = Dᵧ/D = ' + result.exactPoint.y.text + '.');
    steps.push('Substitution into both original equations verifies these exact rational values.');
    conclusion = 'Unique solution: (' + result.exactPoint.x.text + ', ' + result.exactPoint.y.text + ').';
  } else if (result.kind === 'parallel') {
    steps.push('D = 0 but at least one augmented determinant is nonzero: the proper lines are distinct and parallel.');
    conclusion = 'Solution set: ∅ (no solutions).';
  } else if (result.kind === 'coincident') {
    steps.push('Both equations define proper lines; D = Dₓ = Dᵧ = 0, so both describe the same line.');
    conclusion = 'Solution set: every (x,y) satisfying ' + eq1 + '.';
  } else if (result.kind === 'unconstrained') {
    steps.push('One equation is 0 = 0; only the non-degenerate proper line constrains (x,y).');
    conclusion = 'Solution set: every (x,y) satisfying ' + equationText(nature1 === 'line' ? first : second) + '.';
  } else if (result.kind === 'all-plane') {
    steps.push('Both equations are identities; neither places a restriction on x or y.');
    conclusion = 'Solution set: ℝ² (all real ordered pairs).';
  } else {
    steps.push('At least one equation is contradictory; no ordered pair satisfies both.');
    conclusion = 'Solution set: ∅ (no solutions).';
  }
  return Object.freeze({
    version: LAB_HANDOFF_VERSION, kind: 'generated-experiment', synthetic: true, ungraded: true,
    source: 'atlas-agent2-laboratory', chapterId: LAB_CONCEPT_ID,
    conceptId: null, selection: chapterSelection(LAB_CONCEPT_ID),
    experiment: Object.freeze({coefficients:Object.freeze([first,second]),
      coefficientDomain: 'safe integers in [-' + MAX_ABS_COEFFICIENT + ', ' + MAX_ABS_COEFFICIENT + ']'}),
    question: Object.freeze({type:result.kind === 'unique' ? 'solve-and-explain':'classify-solution-set',
      text:question, provenance:LAB_QUESTION_PROVENANCE}),
    workedExplanation:Object.freeze({steps:Object.freeze(steps),conclusion,classification:result.kind}),
    exactPoint:result.exactPoint
  });
}
// Reconstruct, rather than trusting cached strings. This is not origin authentication.
export function validateLaboratoryHandoff(payload) {
  if (!payload || payload.version !== LAB_HANDOFF_VERSION || payload.synthetic !== true ||
      payload.ungraded !== true || payload.source !== 'atlas-agent2-laboratory' ||
      payload.kind !== 'generated-experiment' || payload.conceptId !== null ||
      payload.chapterId !== LAB_CONCEPT_ID) throw new TypeError('Invalid synthetic Laboratory handoff');
  const rebuilt = createLaboratoryHandoff(payload.experiment?.coefficients);
  if (JSON.stringify(payload) !== JSON.stringify(rebuilt)) throw new TypeError('Modified or stale coefficient-specific handoff');
  return rebuilt;
}
