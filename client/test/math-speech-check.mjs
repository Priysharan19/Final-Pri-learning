// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · spoken mathematics (client/src/lib/mathSpeech.js)
//
// A corpus of formulas, each with the sentence a person would read aloud, written by hand from the
// rules in the module header (not generated from the module). It covers numbers, operators,
// relations, powers, indices, fractions, roots, functions, sums, limits, integrals, brackets, absolute
// values, vectors, matrices, aligned working, units, Greek, sets and the formulas the notes use.
// Further checks: en-AU and Hindi lexicons, that no input throws, that the output is plain words
// (no LaTeX left over, no doubled spaces), and that the language picks the locale.
//
//   node client/test/math-speech-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { speakMath, speechLocale } from '../src/lib/mathSpeech.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (tex, want, locale = 'en') => { const got = speakMath(tex, locale); ok(got === want, `[${locale}] ${tex}  →  "${got}"  (wanted "${want}")`); };

const CORPUS = [
  // numbers and letters
  ['x', 'x'], ['12', '12'], ['3.5', '3 point 5'], ['0.25', '0 point 2 5'], ['1000', '1000'], ['72\\,000', '72000'], ['-5', 'minus 5'], ['2x', '2 x'], ['xy', 'x y'], ['abc', 'a b c'],
  ['3.14', '3 point 1 4'], ['0.5', '0 point 5'], ['100', '100'], ['-0.2', 'minus 0 point 2'], ['2ab', '2 a b'], ['5xy', '5 x y'], ['n', 'n'], ['AB', 'A B'], ['\\triangle ABC', 'triangle A B C'],
  // operators
  ['x+y', 'x plus y'], ['x-y', 'x minus y'], ['x\\times y', 'x times y'], ['x\\cdot y', 'x times y'], ['x\\div y', 'x divided by y'], ['a\\pm b', 'a plus or minus b'], ['a\\mp b', 'a minus or plus b'],
  ['3+4', '3 plus 4'], ['10-7', '10 minus 7'], ['6\\times7', '6 times 7'], ['12\\div4', '12 divided by 4'], ['a/b', 'a divided by b'], ['2x+3y-4z', '2 x plus 3 y minus 4 z'], ['1+2+3', '1 plus 2 plus 3'],
  ['20-(-6)+3\\times(-4)', '20 minus open bracket minus 6 close bracket plus 3 times open bracket minus 4 close bracket'],
  // relations
  ['x=5', 'x equals 5'], ['x\\ne3', 'x does not equal 3'], ['x\\neq 3', 'x does not equal 3'], ['x<4', 'x is less than 4'], ['x>4', 'x is greater than 4'], ['x\\le2', 'x is less than or equal to 2'],
  ['x\\leq 2', 'x is less than or equal to 2'], ['x\\ge2', 'x is greater than or equal to 2'], ['x\\geq-1', 'x is greater than or equal to minus 1'], ['x\\approx3.14', 'x is approximately 3 point 1 4'],
  ['a\\equiv b', 'a is equivalent to b'], ['a\\propto b', 'a is proportional to b'], ['p\\Rightarrow q', 'p implies q'], ['p\\Leftrightarrow q', 'p if and only if q'], ['\\triangle ABC\\sim\\triangle DEF', 'triangle A B C is similar to triangle D E F'],
  ['2x+3=11', '2 x plus 3 equals 11'], ['5x+3=2x+18', '5 x plus 3 equals 2 x plus 18'], ['-3<x\\le5', 'minus 3 is less than x is less than or equal to 5'],
  // sets and logic
  ['x\\in A', 'x is in A'], ['x\\notin B', 'x is not in B'], ['A\\subset B', 'A is a subset of B'], ['A\\cup B', 'A union B'], ['A\\cap B', 'A intersection B'], ['\\infty', 'infinity'], ['-\\infty', 'minus infinity'],
  ['\\forall x', 'for all x'], ['\\exists y', 'there exists y'], ['\\therefore x=2', 'therefore x equals 2'], ['x\\in\\mathbb{R}', 'x is in the real numbers'], ['n\\in\\mathbb{N}', 'n is in the natural numbers'],
  ['k\\in\\mathbb{Z}', 'k is in the integers'], ['\\mathbb{Q}', 'the rational numbers'], ['z\\in\\mathbb{C}', 'z is in the complex numbers'], ['\\{1,2,3\\}', 'open brace 1 comma 2 comma 3 close brace'],
  // powers and indices
  ['x^2', 'x squared'], ['x^3', 'x cubed'], ['x^4', 'x to the power 4'], ['x^{10}', 'x to the power 10'], ['x^{-1}', 'x to the power minus 1'], ['x^{n}', 'x to the power n'], ['x^{2}', 'x squared'],
  ['x^{n+1}', 'x to the power n plus 1'], ['x^{n+1}+1', 'x to the power n plus 1 end power plus 1'], ['e^x', 'e to the power x'], ['e^{2x}', 'e to the power 2 x'], ['2^n', '2 to the power n'],
  ['10^{-3}', '10 to the power minus 3'], ['(x+1)^2', 'open bracket x plus 1 close bracket squared'], ['\\left(x+1\\right)^2', 'open bracket x plus 1 close bracket squared'], ['a^2+b^2=c^2', 'a squared plus b squared equals c squared'],
  ['x^2y', 'x squared y'], ['2^{3}', '2 cubed'], ['x^{1/2}', 'x to the power 1 divided by 2'], ['x^{\\frac12}', 'x to the power 1 over 2'], ['3^4\\div3^2=3^2', '3 to the power 4 divided by 3 squared equals 3 squared'],
  ['a^m\\times a^n=a^{m+n}', 'a to the power m times a to the power n equals a to the power m plus n'], ['(2x^3)^2=4x^6', 'open bracket 2 x cubed close bracket squared equals 4 x to the power 6'],
  ['a^0=1', 'a to the power 0 equals 1'], ['5^0+2^3', '5 to the power 0 plus 2 cubed'], ['x^5\\times x^3', 'x to the power 5 times x cubed'], ['(-6)^2', 'open bracket minus 6 close bracket squared'],
  ['-6^2', 'minus 6 squared'], ['2^{x+1}-1', '2 to the power x plus 1 end power minus 1'], ['y=2^x', 'y equals 2 to the power x'],
  // subscripts, degrees, primes
  ['x_1', 'x sub 1'], ['x_{n}', 'x sub n'], ['a_{n+1}', 'a sub n plus 1'], ['x_1^2', 'x sub 1 squared'], ['30^\\circ', '30 degrees'], ['\\theta=45^{\\circ}', 'theta equals 45 degrees'],
  ['90^{\\circ}', '90 degrees'], ['180^\\circ-x', '180 degrees minus x'], ['T_1', 'T sub 1'], ['u_n=a+(n-1)d', 'u sub n equals a plus open bracket n minus 1 close bracket d'], ["f'(x)", 'f prime open bracket x close bracket'],
  ['n!', 'n factorial'], ['5!', '5 factorial'], ['y-y_1=m(x-x_1)', 'y minus y sub 1 equals m open bracket x minus x sub 1 close bracket'],
  // fractions
  ['\\frac12', '1 over 2'], ['\\frac{1}{2}', '1 over 2'], ['\\frac{3}{4}', '3 over 4'], ['\\frac{a}{b}', 'a over b'], ['\\frac{x+1}{2}', 'fraction x plus 1 over 2 end fraction'], ['\\frac{1}{x+1}', 'fraction 1 over x plus 1 end fraction'],
  ['\\frac{x^2}{2}', 'fraction x squared over 2 end fraction'], ['\\dfrac{19}{15}', '19 over 15'], ['\\tfrac{7}{10}', '7 over 10'], ['\\frac{64}{3}', '64 over 3'], ['\\frac{1}{2}+\\frac{1}{3}', '1 over 2 plus 1 over 3'],
  ['\\frac{dy}{dx}', 'fraction d y over d x end fraction'], ['\\frac{\\pi}{2}', 'pi over 2'], ['\\frac{-b}{2a}', 'fraction minus b over 2 a end fraction'], ['\\frac{a}{b}+c', 'a over b plus c'], ['\\frac{3}{4}x', '3 over 4 x'],
  ['\\frac{\\frac{1}{2}}{3}', 'fraction 1 over 2 over 3 end fraction'], ['\\frac{2}{3}+\\frac{3}{5}=\\frac{19}{15}', '2 over 3 plus 3 over 5 equals 19 over 15'], ['\\frac{p}{100}\\times A', 'p over 100 times A'],
  ['m=\\frac{y_2-y_1}{x_2-x_1}', 'm equals fraction y sub 2 minus y sub 1 over x sub 2 minus x sub 1 end fraction'], ['P(A)=\\frac{n(A)}{n(S)}', 'P open bracket A close bracket equals fraction n open bracket A close bracket over n open bracket S close bracket end fraction'],
  ['z=\\frac{x-\\mu}{\\sigma}', 'z equals fraction x minus mu over sigma end fraction'], ['x=\\frac{c-b}{a}', 'x equals fraction c minus b over a end fraction'], ['\\text{speed}=\\frac{d}{t}', 'speed equals d over t'],
  ['\\text{change}=\\frac{\\text{new}-\\text{old}}{\\text{old}}\\times100\\%', 'change equals fraction new minus old over old end fraction times 100 percent'], ['V=\\frac{4}{3}\\pi r^3', 'V equals 4 over 3 pi r cubed'],
  ['S_n=\\frac{n}{2}(a+l)', 'S sub n equals n over 2 open bracket a plus l close bracket'], ['\\frac{h}{2}', 'h over 2'], ['\\frac{b-a}{n}', 'fraction b minus a over n end fraction'],
  ['x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}', 'x equals fraction minus b plus or minus square root of b squared minus 4 a c over 2 a end fraction'],
  // roots
  ['\\sqrt{x}', 'square root of x'], ['\\sqrt{2}', 'square root of 2'], ['\\sqrt{x+1}', 'square root of x plus 1'], ['\\sqrt{x+1}+3', 'square root of x plus 1 end root plus 3'], ['\\sqrt[3]{x}', 'cube root of x'],
  ['\\sqrt[4]{16}', '4 th root of 16'], ['\\sqrt{16}=4', 'square root of 16 equals 4'], ['\\sqrt{a^2+b^2}', 'square root of a squared plus b squared'], ['2\\sqrt{3}', '2 square root of 3'],
  ['5\\sqrt{2}+\\sqrt{8}', '5 square root of 2 plus square root of 8'], ['\\sqrt{23.04}=4.8', 'square root of 23 point 0 4 equals 4 point 8'], ['\\sqrt[2]{x}', 'square root of x'],
  // functions
  ['\\sin x', 'sine x'], ['\\cos\\theta', 'cosine theta'], ['\\tan 45^\\circ', 'tangent 45 degrees'], ['\\sin^2 x', 'sine squared x'], ['\\sin^{-1}x', 'sine to the power minus 1 end power x'], ['\\ln x', 'natural log x'], ['\\log x', 'log x'],
  ['\\log_2 8', 'log base 2 of 8'], ['\\log_{10}100', 'log base 10 of 100'], ['\\log_a x=y', 'log base a of x equals y'], ['\\exp(x)', 'exp open bracket x close bracket'], ['\\sin\\left(2x\\right)', 'sine open bracket 2 x close bracket'],
  ['\\sec\\theta', 'secant theta'], ['\\csc\\theta', 'cosecant theta'], ['\\cot\\theta', 'cotangent theta'], ['\\arcsin x', 'inverse sine x'], ['\\arctan x', 'inverse tangent x'], ['\\arccos x', 'inverse cosine x'],
  ['\\sin^2\\theta+\\cos^2\\theta=1', 'sine squared theta plus cosine squared theta equals 1'], ['\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}', 'tangent theta equals fraction sine theta over cosine theta end fraction'],
  ['y=2\\sin x', 'y equals 2 sine x'], ['\\sin 30^{\\circ}=\\frac{1}{2}', 'sine 30 degrees equals 1 over 2'], ['\\log_a x+\\log_a y=\\log_a(xy)', 'log base a of x plus log base a of y equals log base a of open bracket x y close bracket'],
  ['\\max(a,b)', 'max open bracket a comma b close bracket'], ['\\det A', 'determinant A'], ['f(x)=\\ln x', 'f open bracket x close bracket equals natural log x'],
  // sums, products, limits, integrals
  ['\\sum_{i=1}^{n} i', 'sum from i equals 1 to n of i'], ['\\sum_{k=0}^{\\infty} x^k', 'sum from k equals 0 to infinity of x to the power k'], ['\\prod_{i=1}^{n} i', 'product from i equals 1 to n of i'],
  ['\\sum x', 'sum of x'], ['\\bar{x}=\\frac{\\sum x}{n}', 'x bar equals fraction sum of x over n end fraction'], ['\\int x\\,dx', 'integral of x d x'], ['\\int_0^1 x^2\\,dx', 'integral from 0 to 1 of x squared d x'],
  ['\\int_a^b f(x)\\,dx', 'integral from a to b of f open bracket x close bracket d x'], ['\\int_{-1}^{1} x\\,dx', 'integral from minus 1 to 1 of x d x'], ['\\int_1^3 (6x^2-4x+5)\\,dx', 'integral from 1 to 3 of open bracket 6 x squared minus 4 x plus 5 close bracket d x'],
  ['\\left[x^2\\right]_0^3', 'open square bracket x squared close square bracket evaluated from 0 to 3'], ['\\left.x^2\\right|_0^3', 'x squared evaluated from 0 to 3'], ['\\int e^{2x}\\,dx=\\tfrac12e^{2x}+C', 'integral of e to the power 2 x end power d x equals 1 over 2 e to the power 2 x end power plus C'],
  ['\\lim_{x\\to0}x', 'limit as x tends to 0 x'], ['\\lim_{n\\to\\infty}\\frac1n', 'limit as n tends to infinity 1 over n'], ['\\int_0^\\infty e^{-x}\\,dx', 'integral from 0 to infinity of e to the power minus x end power d x'],
  ['\\frac{h}{2}[y_0+2(y_1+y_2)+y_3]', 'h over 2 open square bracket y sub 0 plus 2 open bracket y sub 1 plus y sub 2 close bracket plus y sub 3 close square bracket'],
  // brackets and absolute value
  ['(x+1)', 'open bracket x plus 1 close bracket'], ['[1,2]', 'open square bracket 1 comma 2 close square bracket'], ['|x|', 'absolute value of x end absolute value'], ['|x-3|<2', 'absolute value of x minus 3 end absolute value is less than 2'],
  ['\\left|x\\right|', 'absolute value of x end absolute value'], ['\\left|x\\right|^2', 'absolute value of x end absolute value squared'], ['\\langle a,b\\rangle', 'open angle bracket a comma b close angle bracket'], ['f(x)', 'f open bracket x close bracket'],
  ['f(x)=2x+1', 'f open bracket x close bracket equals 2 x plus 1'], ['(1,3)', 'open bracket 1 comma 3 close bracket'], ['(-1,0)', 'open bracket minus 1 comma 0 close bracket'], ['(3,\\,-4)', 'open bracket 3 comma minus 4 close bracket'],
  ['A=P\\left(1+\\frac{r}{100}\\right)^n', 'A equals P open bracket 1 plus r over 100 close bracket to the power n'], ['\\binom{5}{2}', '5 choose 2'], ['\\binom{n}{r}', 'n choose r'],
  // Greek
  ['\\pi', 'pi'], ['2\\pi r', '2 pi r'], ['\\alpha+\\beta', 'alpha plus beta'], ['\\sigma^2', 'sigma squared'], ['\\mu=70', 'mu equals 70'], ['\\Delta x', 'capital delta x'], ['\\lambda', 'lambda'], ['\\omega t', 'omega t'], ['\\phi', 'phi'],
  ['A=\\pi r^2', 'A equals pi r squared'], ['C=2\\pi r', 'C equals 2 pi r'], ['\\mu\\pm2\\sigma', 'mu plus or minus 2 sigma'], ['\\Sigma', 'capital sigma'],
  // text, units, money, percent
  ['\\text{cm}^2', 'cm squared'], ['12\\text{ cm}', '12 cm'], ['5\\%', '5 percent'], ['\\$250', 'dollar sign 250'], ['45\\ \\text{km/h}', '45 km/h'], ['72\\,000\\ \\text{cm}^3', '72000 cm cubed'], ['\\text{if } x>0', 'if x is greater than 0'],
  ['\\text{area}=63', 'area equals 63'], ['\\text{sum}=14', 'sum equals 14'], ['P(\\text{not }A)=1-P(A)', 'P open bracket not A close bracket equals 1 minus P open bracket A close bracket'], ['15\\%\\text{ of }80', '15 percent of 80'],
  ['\\$59.50', 'dollar sign 59 point 5 0'], ['\\text{speed}=\\frac{\\text{distance}}{\\text{time}}', 'speed equals distance over time'],
  // vectors, matrices, aligned working
  ['\\mathbf{a}', 'vector a'], ['\\vec{v}', 'vector v'], ['\\overrightarrow{AB}', 'vector A B'], ['\\bar{x}', 'x bar'], ['\\hat{y}', 'y hat'], ['\\overline{AB}', 'A B bar'],
  ['\\mathbf{r}=\\begin{pmatrix}4\\\\4\\end{pmatrix}', 'vector r equals matrix, 2 rows, 1 column. row 1: 4. row 2: 4. end matrix.'],
  ['\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}', 'matrix, 2 rows, 2 columns. row 1: 1, 2. row 2: 3, 4. end matrix.'], ['\\begin{bmatrix}a&b\\end{bmatrix}', 'matrix, 1 row, 2 columns. row 1: a, b. end matrix.'],
  ['\\begin{aligned}x+1&=3\\\\x&=2\\end{aligned}', 'working, 2 lines. line 1: x plus 1 equals 3. line 2: x equals 2. end working.'], ['\\begin{aligned}4x-7&=21\\\\4x&=28\\\\x&=7\\end{aligned}', 'working, 3 lines. line 1: 4 x minus 7 equals 21. line 2: 4 x equals 28. line 3: x equals 7. end working.'],
  ['\\begin{aligned}A&=\\tfrac12bh\\end{aligned}', 'working, 1 line. line 1: A equals 1 over 2 b h. end working.'], ['\\boxed{x=2}', 'boxed x equals 2'],
  // dots, spacing, layout commands
  ['1,2,\\ldots,n', '1 comma 2 comma dot dot dot comma n'], ['1+2+\\cdots+n', '1 plus 2 plus dot dot dot plus n'], ['a\\,b', 'a b'], ['a\\quad b', 'a b'], ['\\displaystyle x', 'x'], ['a\\;b', 'a b'], ['a\\!b', 'a b'],
  ['\\displaystyle\\frac{a}{b}', 'a over b'], ['\\left(a\\right)', 'open bracket a close bracket'], ['\\Big(a\\Big)', 'open bracket a close bracket'],
  // formulas from the notes
  ['a(b+c)=ab+ac', 'a open bracket b plus c close bracket equals a b plus a c'], ['ab+ac=a(b+c)', 'a b plus a c equals a open bracket b plus c close bracket'], ['(-a)\\times(-b)=ab', 'open bracket minus a close bracket times open bracket minus b close bracket equals a b'],
  ['a-(-b)=a+b', 'a minus open bracket minus b close bracket equals a plus b'], ['y=mx+c', 'y equals m x plus c'], ['P=2(l+w)', 'P equals 2 open bracket l plus w close bracket'], ['A=\\tfrac{1}{2}bh', 'A equals 1 over 2 b h'], ['V=lwh', 'V equals l w h'],
  ['c^2=a^2+b^2', 'c squared equals a squared plus b squared'], ['x^2-2x-3', 'x squared minus 2 x minus 3'], ['x^2-3x', 'x squared minus 3 x'], ['6x^2-4x+5', '6 x squared minus 4 x plus 5'], ['y=(x-1)^2-4', 'y equals open bracket x minus 1 close bracket squared minus 4'],
  ['y=2(x-3)^2-4', 'y equals 2 open bracket x minus 3 close bracket squared minus 4'], ['y=x^2', 'y equals x squared'], ['y=\\frac{1}{x}', 'y equals 1 over x'], ['T_{20}=83', 'T sub 20 equals 83'], ['S_{\\infty}=\\frac{a}{1-r}', 'S sub infinity equals fraction a over 1 minus r end fraction'],
  ['E(X)=\\sum xP(x)', 'E open bracket X close bracket equals sum of x P open bracket x close bracket'], ['\\sigma=\\sqrt{\\frac{\\sum(x-\\bar{x})^2}{n}}', 'sigma equals square root of fraction sum of open bracket x minus x bar close bracket squared over n end fraction'],
  ['P(A\\cup B)=P(A)+P(B)-P(A\\cap B)', 'P open bracket A union B close bracket equals P open bracket A close bracket plus P open bracket B close bracket minus P open bracket A intersection B close bracket'],
  ['\\cos C=\\frac{a^2+b^2-c^2}{2ab}', 'cosine C equals fraction a squared plus b squared minus c squared over 2 a b end fraction'], ['\\frac{a}{\\sin A}=\\frac{b}{\\sin B}', 'fraction a over sine A end fraction equals fraction b over sine B end fraction'],
  ['r=\\frac{S_{xy}}{\\sqrt{S_{xx}S_{yy}}}', 'r equals fraction S sub x y over square root of S sub x x S sub y y end fraction']
];
for (const [tex, want] of CORPUS) eq(tex, want);
ok(CORPUS.length >= 200, `the corpus has at least 200 expressions (${CORPUS.length})`);
ok(new Set(CORPUS.map(c => c[0])).size === CORPUS.length, 'every corpus expression is distinct');

// en-AU and Hindi
eq('5\\%', '5 per cent', 'en-AU'); eq('x^2', 'x squared', 'en-AU'); eq('\\frac{64}{3}', '64 over 3', 'en-AU'); eq('15\\%\\text{ of }80', '15 per cent of 80', 'en-AU');
eq('x^2-2x-3', 'x का वर्ग घटा 2 x घटा 3', 'hi'); eq('\\frac{64}{3}', '64 बटा 3', 'hi'); eq('x=5', 'x बराबर 5', 'hi'); eq('a+b', 'a जमा b', 'hi'); eq('a\\times b', 'a गुणा b', 'hi');
eq('x^3', 'x का घन', 'hi'); eq('\\sqrt{x}', 'वर्गमूल x', 'hi'); eq('5\\%', '5 प्रतिशत', 'hi'); eq('30^\\circ', '30 डिग्री', 'hi'); eq('\\infty', 'अनंत', 'hi'); eq('3.5', '3 दशमलव 5', 'hi'); eq('x<4', 'x से कम 4', 'hi');
eq('\\int_1^3 x\\,dx', 'समाकल से 1 तक 3 का x d x', 'hi'); eq('\\sin x', 'साइन x', 'hi'); eq('x^4', 'x की घात 4', 'hi'); eq('\\binom{n}{r}', 'n चुनें r', 'hi');
eq('\\begin{pmatrix}4\\\\4\\end{pmatrix}', 'आव्यूह, 2 पंक्तियाँ, 1 स्तंभ. पंक्ति 1: 4. पंक्ति 2: 4. आव्यूह समाप्त.', 'hi');

// locale choice
ok(speechLocale('hi', 'priyabhata') === 'hi' && speechLocale('hi', 'prithagoras') === 'hi', 'Hindi speech whenever the interface is Hindi');
ok(speechLocale('en', 'prithagoras') === 'en-AU' && speechLocale('en', 'priyabhata') === 'en', 'English speech is en-AU in the Prithagoras edition and en elsewhere');

// robust: nothing throws, nothing leaks LaTeX
const HOSTILE = ['', '{', '}', '{{{{x', 'x}}}}', '\\', '\\frac', '\\frac{1}', '\\sqrt', '\\sqrt[', '^', '_', 'x^', 'x_', '\\begin{pmatrix}', '\\begin{aligned}x', '\\end{aligned}', '\\left', '\\right)', '\\foo{bar}', '&&&', '\\\\\\\\', '$', '%', '#', '\\text{', '\\text{unterminated', 'x^{y^{z^{w}}}', '\\frac{\\frac{\\frac{1}{2}}{3}}{4}', '\\int_^', '\\sum_{', '\\lim', '\\mathbb', '\\boxed', '\\binom{1}', '|', '||', '\\left|', '1.2.3', '..', '\\overset{a}', '\\hat', '\\vec', '\\mathbf{', '\\unknowncommand', '\\_', '\\{', '\\}'];
for (const h of HOSTILE) {
  for (const l of ['en', 'en-AU', 'hi']) {
    let out; let threw = false;
    try { out = speakMath(h, l); } catch { threw = true; }
    ok(!threw && typeof out === 'string', `${l}: "${h}" does not throw`);
    ok(typeof out !== 'string' || !/[\\{}^_&]/.test(out.replace(/\\/g, '')) || h === '\\_' || h === '\\{' || h === '\\}', `${l}: "${h}" leaves no LaTeX markers in "${out}"`);
    ok(typeof out !== 'string' || !/\s\s/.test(out), `${l}: "${h}" has no doubled spaces`);
  }
}
for (const [tex] of CORPUS) {
  const out = speakMath(tex, 'en');
  ok(out.length > 0 && !/[\\{}^_&]/.test(out) && !/\s\s/.test(out) && out === out.trim(), `corpus output is plain words: ${tex} → "${out}"`);
}
ok(speakMath('x^2', 'no-such-locale') === 'x squared', 'an unknown locale falls back to English');
ok(speakMath(null) === '' && speakMath(undefined) === '', 'null and undefined read as nothing');
ok(speakMath('x^2-2x-3', 'en') === speakMath('x^2-2x-3', 'en'), 'the same formula is always the same sentence');

if (failures.length) {
  console.error(`MATH SPEECH: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 60)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`MATH SPEECH: PASS — ${pass}/${pass} checks — ${CORPUS.length} expressions read as people read them (en), the en-AU and Hindi lexicons, hostile input never throws, output is plain words`);
