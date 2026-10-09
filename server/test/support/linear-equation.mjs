// The test's own solver for an issued `c8-linear-equations-both-sides` prompt,
// e.g. `$6m + 15=7m + 29$`. A suite reads the PUBLIC prompt, solves it here,
// and so knows the root without the server ever sending an answer key.
import assert from 'node:assert/strict';

function side(text) {
  let coefficient = 0;
  let constant = 0;
  let variable = null;
  const terms = text.match(/[+-]?[^+-]+/g) || [];
  for (const term of terms) {
    const m = term.match(/^([+-]?)(\d*)([a-z]?)$/);
    assert.ok(m && (m[2] || m[3]), `unreadable term "${term}" in "${text}"`);
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) {
      variable = m[3];
      coefficient += sign * (m[2] === '' ? 1 : Number(m[2]));
    } else constant += sign * Number(m[2]);
  }
  return { coefficient, constant, variable };
}

/** { variable, lhs, rhs, root, bare } for a prompt that holds one linear equation in one letter. */
export function solveLinearPrompt(prompt) {
  const spans = String(prompt).match(/\$[^$]+\$/g) || [];
  assert.equal(spans.length, 1, `the prompt holds one $…$ equation: ${prompt}`);
  // `bare`: the whole prompt is the equation (the generated form), not an
  // authored exercise that words around it.
  const bare = String(prompt).trim() === spans[0];
  const equation = spans[0].slice(1, -1).replace(/\s+/g, '').replace(/−/g, '-');
  const sides = equation.split('=');
  assert.equal(sides.length, 2, `one equals sign: ${equation}`);
  const [l, r] = sides.map(side);
  const variable = l.variable || r.variable;
  assert.ok(variable && (!l.variable || !r.variable || l.variable === r.variable), `one variable: ${equation}`);
  const a = l.coefficient - r.coefficient;
  assert.notEqual(a, 0, `a unique root: ${equation}`);
  const root = (r.constant - l.constant) / a;
  return { variable, lhs: sides[0], rhs: sides[1], root, left: l, right: r, bare };
}
