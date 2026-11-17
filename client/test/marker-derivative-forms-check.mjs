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
ok(sameFormalForm(p('sin(x)^2+cos(x)^2'), p('1')) === null, 'a trigonometric identity is not formal');
ok(sameFormalForm(p('x^(1/2)'), p('x^(-1/2)')) === null, 'different exponents are different');

console.log(`marker-derivative-forms-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
