// Pri Learning · the collapsed question bar keeps a power a power
// (owner walk-through, 19 Nov 2026: "9x^2" read "9x2" on the bar that recalls the question).
import assert from 'node:assert/strict';
import { plainMath, plainPromptText } from '../src/lib/plainMath.js';

let pass = 0;
const eq = (actual, expected, name) => { assert.equal(actual, expected, name); pass++; };

eq(plainPromptText('Solve $9x^2 - 4 = 0$.'), 'Solve 9x² - 4 = 0.', 'a squared term keeps its power');
eq(plainPromptText('Differentiate $x^{10}$.'), 'Differentiate x¹⁰.', 'a braced exponent keeps every digit');
eq(plainPromptText('Find $\\frac{3}{x^2}$.'), 'Find (3)/(x²).', 'a fraction keeps its two parts');
eq(plainPromptText('At $x_1$ and $a^n$.'), 'At x₁ and aⁿ.', 'a subscript and a letter power');
eq(plainMath('\\sqrt{x^2+1}'), '√(x²+1)', 'a root keeps its radicand');
eq(plainMath('e^{-2x}'), 'e⁻²ˣ', 'a signed exponent keeps its sign');
eq(plainMath('x^{a+b}'), 'x^(a+b)', 'an exponent with no superscript form falls back to ^(…), never a flattened run');
eq(plainPromptText('No maths here.'), 'No maths here.', 'plain text is untouched');
for (const flattened of ['9x2', 'x10']) assert.ok(!plainPromptText('$9x^2$ and $x^{10}$').includes(flattened), `never ${flattened}`), pass++;
console.log(`plain-math-check: ${pass} checks passed`);
