// A page is read for a sketched graph only when its question declares a graph
// answer: a graph-sketch item, or a prompt that asks for a graph to be drawn.
// Anywhere else a short stroke (a written "4") is writing, never a sketch (#793).
const DRAW_A_GRAPH = /\b(?:sketch|draw|plot)\b[^.?]*\b(?:graph|curve|parabola|hyperbola)\b/i;
// It takes the answer TYPE and the VISIBLE prompt only — never a question
// object, an expected answer, a solution or marks (ink-answer-blind-static).
export function questionAsksForGraph(answerType, prompt) {
  if (answerType === 'graph-sketch') return true;
  return DRAW_A_GRAPH.test(String(prompt || ''));
}
