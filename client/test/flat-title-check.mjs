// Pri Learning · Scripts card titles: fractions set inline (display only).
// Usage: node client/test/flat-title-check.mjs
import { flatTitle } from '../src/instrument/flatTitle.js';

const cases = [
  ['a fraction and a dfrac', String.raw`Evaluate exactly: $5\cosec^2 \frac{\pi}{4} - \dfrac{a+1}{2}$`, String.raw`Evaluate exactly: $5\cosec^2 \pi/4 - (a+1)/2$`],
  ['nested fractions, escaped dollar kept', String.raw`Find $\frac{\frac{1}{x}}{y^2}$ and \$4`, String.raw`Find $(1/x)/(y^2)$ and \$4`],
  ['no $ is a no-op', String.raw`No maths \frac{1}{2} here`, String.raw`No maths \frac{1}{2} here`],
  ['roots are left alone', String.raw`$\sqrt{2}$`, String.raw`$\sqrt{2}$`],
  ['unbraced arguments', String.raw`$\frac 12 + \frac\pi2$`, String.raw`$1/2 + \pi/2$`],
  ['a single root needs no brackets', String.raw`$\frac{\sqrt{2}}{x+1}$`, String.raw`$\sqrt{2}/(x+1)$`],
  ['tfrac', String.raw`$\tfrac{3}{4}$`, String.raw`$3/4$`],
  ['multiple maths spans', String.raw`If $x = \frac{1}{2}$ and $y = \frac{a}{b+c}$`, String.raw`If $x = 1/2$ and $y = a/(b+c)$`],
  ['unbalanced brace returns the span unchanged', String.raw`Bad $\frac{1{2}$ ok`, String.raw`Bad $\frac{1{2}$ ok`],
  ['missing denominator returns the span unchanged', String.raw`$\frac{1}$`, String.raw`$\frac{1}$`],
  ['\\frac inside \\text{} is left alone', String.raw`$\text{see \frac{a}{b}} + \frac{1}{3}$`, String.raw`$\text{see \frac{a}{b}} + 1/3$`],
  ['\\fraction-like command is not a fraction', String.raw`$\fracture{1}{2}$`, String.raw`$\fracture{1}{2}$`],
  ['empty and null', '', ''],
];
let failed = 0;
for (const [name, input, want] of cases) {
  const got = flatTitle(input);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     got  ${got}\n     want ${want}`}`);
}
const nullOk = flatTitle(null) === '' && flatTitle(undefined) === '';
if (!nullOk) failed++;
console.log(`${nullOk ? 'ok  ' : 'FAIL'} null and undefined give ''`);
const total = cases.length + 1;
console.log(failed ? `FLAT TITLE: FAIL — ${failed} of ${total}` : `FLAT TITLE: PASS — ${total}/${total} checks`);
process.exit(failed ? 1 : 0);
