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


// ── The escapes a question is written with (Extension 1 and Financial maths prompts, 20 Nov 2026) ──
eq(plainPromptText('Prove $5 + 9 + \\cdots + (2n - 1)$ for all $n$.'), 'Prove 5 + 9 + … + (2n - 1) for all n.', 'an induction series keeps its ellipsis (it read "5 + + (2n - 1)")');
eq(plainMath('1 + 2 + \\ldots + n'), '1 + 2 + … + n', '\\ldots is an ellipsis');
eq(plainMath('a_1, a_2, \\dots, a_n'), 'a1, a2, …, an', '\\dots is an ellipsis');
eq(plainPromptText('A fund pays $3\\%$ p.a. and a fee of \\$10 is taken.'), 'A fund pays 3% p.a. and a fee of $10 is taken.', 'a percent in a formula reads %, and an escaped dollar in the prose is a dollar');
eq(plainPromptText('Interest is 1.5\\% a month on \\$20,700 and $18\\%$ a year.'), 'Interest is 1.5% a month on $20,700 and 18% a year.', 'a percent in the prose reads %, and an escaped dollar does not pair with a real one');
eq(plainPromptText('Hire costs \\$55 plus \\$11 per hour. Find $h$ when $55 + 11h = 61 + 8h$.'), 'Hire costs $55 plus $11 per hour. Find h when 55 + 11h = 61 + 8h.', 'two escaped amounts never become a formula between them');
eq(plainPromptText('Prices (in \\$10\\,000s) rise.'), 'Prices (in $10 000s) rise.', 'a TeX thin space in the prose is a space');
eq(plainMath('\\{S\\} \\cup \\{A, B\\}'), '{S} ∪ {A, B}', 'escaped braces are braces; grouping braces are not');
eq(plainMath('x \\pm 2 \\mid y'), 'x ± 2 | y', '\\pm and \\mid');
eq(plainMath('\\left( \\frac{1}{2} \\right)^3'), '( (1)/(2) )³', '\\left and \\right go and the bracket stays');
eq(plainMath('\\left[ x \\right)'), '[ x )', '\\left[ and \\right) keep their bracket');
eq(plainMath('\\left. \\frac{dy}{dx} \\right|_{x=1}'), '(dy)/(dx) |x=1', '\\left. and \\right. are no bracket');
eq(plainMath('v = 5 \\text{ m/s}'), 'v = 5 m/s', '\\text keeps its content');
eq(plainMath('\\mathrm{d}x'), 'dx', '\\mathrm keeps its content');
eq(plainMath('\\text{Cost} = \\$40'), 'Cost = $40', '\\text and an escaped dollar in a formula');
eq(plainMath('\\binom{n}{2}'), '(n choose 2)', 'a binomial coefficient is read, not flattened to "n 2"');
eq(plainPromptText('**Find** the value.'), 'Find the value.', 'bold markers are dropped');

// ── Every NSW Year 11-12 generator, five seeds each: the bar's plain text is plain ──
// Display only. The prompts are exactly what the server would print; nothing here reaches marking.
{
  const SRC = new URL('../src/', import.meta.url).href;
  const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
  const { NSW_BANK_LEDGER } = await import('../../server/platform/nswBanks.js');
  await loadAllBanks();
  const rows = NSW_BANK_LEDGER.filter(e => /11-12/.test(e.syllabus));
  assert.ok(rows.length >= 60, `the sweep reaches the Year 11-12 generators (${rows.length})`); pass++;
  let prompts = 0;
  const problems = [];
  const braceOk = (plain, source) => (plain.match(/[{}]/g) || []).length <= (source.match(/\\[{}]|\\[lr]brace/g) || []).length;
  for (const entry of rows) {
    for (let difficulty = 1; difficulty <= 4; difficulty += 1) {
      for (let k = 1; k <= 5; k += 1) {
        let q = null;
        try { q = generateQuestion(entry.generator, difficulty, k * 7919 + difficulty); } catch { q = null; }
        if (!q || typeof q.prompt !== 'string') continue;
        prompts += 1;
        const plain = plainPromptText(q.prompt);
        const label = `${entry.generator} D${difficulty} #${k}: ${plain.slice(0, 80)}`;
        if (/\\/.test(plain)) problems.push(`backslash in ${label}`);
        if (!braceOk(plain, q.prompt)) problems.push(`brace in ${label}`);
        if (/(?:^|[\s(])[+\-−×÷*/=] [+×÷*/=](?=\s|$)/.test(plain) || /\+ \+|= =|× ×|÷ ÷/.test(plain)) problems.push(`doubled operator in ${label}`);
      }
    }
  }
  assert.ok(prompts >= 1000, `the sweep drew a real number of prompts (${prompts})`); pass++;
  assert.deepEqual(problems.slice(0, 12), [], `${problems.length} Year 11-12 prompts read badly on the question bar`); pass++;
  console.log(`plain-math-check: ${prompts} Year 11-12 prompts across ${rows.length} generators read plain (no backslash, no stray brace, no doubled operator)`);
}

console.log(`plain-math-check: ${pass} checks passed`);
