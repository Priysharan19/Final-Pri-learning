// Pri Learning · the collapsed question bar keeps a power a power
// (owner walk-through, 19 Nov 2026: "9x^2" read "9x2" on the bar that recalls the question).
import assert from 'node:assert/strict';
import { plainMath, plainPromptText } from '../src/lib/plainMath.js';

let pass = 0;
const eq = (actual, expected, name) => { assert.equal(actual, expected, name); pass++; };

eq(plainPromptText('Solve $9x^2 - 4 = 0$.'), 'Solve 9x² - 4 = 0.', 'a squared term keeps its power');
eq(plainPromptText('Differentiate $x^{10}$.'), 'Differentiate x¹⁰.', 'a braced exponent keeps every digit');
eq(plainPromptText('Find $\\frac{3}{x^2}$.'), 'Find (3)/(x²).', 'a fraction keeps its two parts');
eq(plainPromptText('At $x_1$ and $a^n$.'), 'At x1 and a^(n).', 'a subscript is left as it was; a letter power keeps its ^(…)');
eq(plainMath('\\sqrt{x^2+1}'), '√(x²+1)', 'a root keeps its radicand');
eq(plainMath('e^{-2x}'), 'e^(-2x)', 'an exponent with a sign or a letter keeps its ^(…), never a flattened run');
eq(plainMath('x^{a+b}'), 'x^(a+b)', 'an exponent with no superscript form falls back to ^(…), never a flattened run');
eq(plainPromptText('No maths here.'), 'No maths here.', 'plain text is untouched');
for (const flattened of ['9x2', 'x10']) assert.ok(!plainPromptText('$9x^2$ and $x^{10}$').includes(flattened), `never ${flattened}`), pass++;
// The collapsed bar on the live site showed "Evaluate 0¹ (x² - 2x)\\,dx" for a definite integral (20 Nov 2026).
eq(plainPromptText('Evaluate $\\int_0^1 (x^2 - 2x)\\,dx$, correct to 3 decimal places where needed.'), 'Evaluate ∫ from 0 to 1 of (x² - 2x) dx, correct to 3 decimal places where needed.', 'a definite integral keeps its sign and limits; a thin space is a space');
eq(plainPromptText('Find $\\int_{-2}^{4} 12x\\,dx$.'), 'Find ∫ from -2 to 4 of 12x dx.', 'braced and negative limits');
eq(plainPromptText('Find $\\int x^2\\,dx$.'), 'Find ∫ x² dx.', 'an indefinite integral keeps its sign');
eq(plainPromptText('Solve $\\sin x = \\frac{1}{2}$ for $0 \\le x \\le 2\\pi$.'), 'Solve sin x = (1)/(2) for 0 ≤ x ≤ 2π.', 'function names and symbols are kept');
eq(plainPromptText('Simplify $\\log_2 8 \\times \\sqrt{9}$ at $90^\\circ$.'), 'Simplify log₂ 8 × √(9) at 90°.', 'a log base, a times sign and a degree sign');
eq(plainPromptText('Differentiate $e^{2x}\\ln x$.'), 'Differentiate e^(2x)ln x.', 'ln is kept');

// Two older faults of the bar (independent review, 20 November 2026): a root inside a fraction read "√(2)2", and an
// aligned block leaked the word "aligned" and a backslash.
eq(plainPromptText('Solve $\\sin\\theta = \\frac{\\sqrt{2}}{2}$.'), 'Solve sin θ = (√(2))/(2).', 'a root inside a fraction stays inside it');
eq(plainPromptText('Find $\\frac{1}{\\sqrt{3}}$.'), 'Find (1)/(√(3)).', 'a root in a denominator');
eq(plainPromptText('$\\begin{aligned} y &= 2x \\\\ x &= 3 \\end{aligned}$'), 'y = 2x ; x = 3', 'an aligned block is its rows');

console.log(`plain-math-check: ${pass} checks passed`);
