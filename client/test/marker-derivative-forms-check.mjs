// Pri Learning · derivative lines in unsimplified forms are PROVED, never guessed.
// Marking benchmark gap 3 (calculus): quotient-rule, product-rule with e^x,
// chain-rule roots and second derivatives used to abstain. A line is credited
// only when it is the SAME formal form as the derivative (a proof) or it stays
// a note; a counterexample still decides every break.
import { stepCheck } from '../src/engine/checker.js';
import { sameFormalForm } from '../src/engine/reason-forms.js';
import { parse, normalize } from '../src/engine/expr.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const p = s => parse(normalize(s));
const line = (source, text) => stepCheck({ kind: 'derivative', variable: 'x', source }, text).lines[0];

const credited = [
  ['x/(x^2+1)', '((x^2+1) - x*2x)/((x^2+1)^2)'],
  ['x/(x^2+1)', '(1 - x^2)/((x^2+1)^2)'],
  ['x^2/(x+1)', '2x (x+1)^(-1) - x^2 (x+1)^(-2)'],
  ['x^2/(x+1)', '(x^2 + 2x)/((x+1)^2)'],
  ['e^x cos(x)', 'e^x cos(x) - e^x sin(x)'],
  ['e^x cos(x)', 'e^x (cos(x) - sin(x))'],
  ['x^2 e^x', '2x e^x + x^2 e^x'],
  ['sqrt(x^2+9)', '(1/2)(x^2+9)^(-1/2) * 2x'],
  ['sqrt(x^2+9)', 'x/sqrt(x^2+9)'],
  ['e^(2x) sin(x)', '2e^(2x) sin(x) + e^(2x) cos(x)'],
  ['tan(x)', 'sec(x)^2'],
  ['ln(sin(x))', 'cot(x)'],
];
for (const [src, text] of credited) ok(line(src, text).status === 'ok', `credited: d/dx ${src} = ${text}`);

const refused = [
  ['x/(x^2+1)', '(1 + x^2)/((x^2+1)^2)'],
  ['x/(x^2+1)', '(x^2+1 - x)/((x^2+1)^2)'],
  ['e^x cos(x)', 'e^x cos(x) + e^x sin(x)'],
  ['x^2 e^x', '2x e^x + x^3 e^(x-1)'],
  ['e^(2x) sin(x)', 'e^(2x)(2sin(x) + 2cos(x))'],
  ['sqrt(x^2+9)', '2x/sqrt(x^2+9)'],
  ['tan(x)', 'sec(x)'],
];
for (const [src, text] of refused) ok(line(src, text).status !== 'ok', `never credited: d/dx ${src} = ${text}`);
ok(line('e^x cos(x)', 'e^x cos(x) + e^x sin(x)').status === 'break', 'a wrong product-rule line is still a break');

// The prover never disproves and never over-proves.
ok(sameFormalForm(p('(x^2-1)/(x-1)'), p('x+1')) === true, 'equal over a common denominator (everywhere both are defined)');
ok(sameFormalForm(p('1/(x+1)'), p('1/(x+2)')) === null, 'different many-term bases are different');
ok(sameFormalForm(p('(x+1)^2'), p('x^2+2x+1')) === true, 'a squared sum is expanded');
ok(sameFormalForm(p('sin(x)^2+cos(x)^2'), p('1')) === true, 'sin^2 + cos^2 = 1 is the one identity the prover knows');
ok(sameFormalForm(p('sin(x)^2+cos(x)^2'), p('2')) === null, 'sin^2 + cos^2 is not 2');
ok(sameFormalForm(p('sin(x)^2'), p('cos(x)^2')) === null, 'sin^2 is not cos^2');
ok(sameFormalForm(p('sin(x)^2+cos(2x)^2'), p('1')) === null, 'the identity needs the same argument');
ok(sameFormalForm(p('1+tan(x)^2'), p('sec(x)^2')) === true, '1 + tan^2 = sec^2');
ok(line('tan(x)', '1 + tan(x)^2').status === 'ok', 'd/dx tan x = 1 + tan^2 x is credited');
ok(line('tan(x)', '1 + tan(x)^3').status === 'break', 'd/dx tan x = 1 + tan^3 x is a break');
ok(sameFormalForm(p('x^(1/2)'), p('x^(-1/2)')) === null, 'different exponents are different');
ok(sameFormalForm(p('sqrt(x^2)'), p('x')) === null, 'sqrt(x^2) is |x|, not x');
ok(sameFormalForm(p('(x^4)^(1/4)'), p('x')) === null, '(x^4)^(1/4) is |x|, not x');
ok(sameFormalForm(p('sqrt(4x^2)'), p('2x')) === null, 'sqrt(4x^2) is not 2x');
ok(sameFormalForm(p('sqrt(x)*sqrt(x)'), p('x')) === true, 'sqrt(x)^2 is x where defined');
// b^v derivatives.
ok(line('2^x', '2^x * ln(2)').status === 'ok', 'd/dx 2^x = 2^x ln 2');
ok(line('2^x', '2^x').status !== 'ok', 'd/dx 2^x is not 2^x');
ok(line('x^x', 'x^x').status !== 'ok', 'x^x is outside the verified vocabulary and is never credited');
ok(line('e^(3x)', '3e^(3x)').status === 'ok', 'd/dx e^(3x) = 3e^(3x)');
ok(line('e^(3x)', 'e^(3x)').status !== 'ok', 'd/dx e^(3x) is not e^(3x)');

console.log(`marker-derivative-forms-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
