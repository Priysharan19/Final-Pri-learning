// Hand-built transcripts from live owner testing (2026-11-18). Truth is the human's reading of each line:
// 'valid' = a true line, 'slip' = the line that is wrong. They ride in the audit beside the synthetic corpus.
const STATIONARY = {
  prompt: 'The curve $y = 2x^3 + 9x^2$ has two stationary points. Find the $y$-coordinate of the one with the smaller $x$-coordinate.',
  answerType: 'numeric', answer: { value: 27 }, answerPrefix: 'y =',
  stepcheck: { kind: 'value-chain', fn: { name: 'y', variable: 'x', expr: '(2)*x^3+(9)*x^2' }, curve: { derivative: '(6)*x^2+(18)*x', stationary: [-3, 0], choose: 'smaller' } }
};
const BUOY = {
  prompt: 'The height of a buoy above the seabed, in metres, $t$ seconds after a reading starts, is modelled by $h(t) = 22 + 5\\sin\\left(\\dfrac{\\pi t}{6}\\right)$. What is the maximum value of $h$?',
  answerType: 'numeric', answer: { value: 27 },
  stepcheck: { kind: 'value-chain', fn: { name: 'h', variable: 't', expr: '22+5*sin(pi*t/6)' }, quantities: { max: 27, min: 17, amplitude: 5, midline: 22, period: 12 }, fullDomain: true }
};
const T = (style, rows) => ({ style, lines: rows.map(([text, truth]) => ({ text, truth })) });
const OWNER = ['y=2x³+9x²', "y'=6x²+18x", "for stat points y'=0", '0=6x²+18x', '0=6x[x+3]', 'x=0 or x=-3'];

export const HAND_BUILT = [
  { family: 'hand:owner-stationary', edition: 'NSW', q: STATIONARY, transcripts: [
    T('owner-wrong-choice', [...OWNER.map(t => [t, 'valid']), ['y(0)=0', 'valid'], ['smallest: (0,0)', 'slip']]),
    T('owner-right-choice', [...OWNER.map(t => [t, 'valid']), ['y(-3)=27', 'valid'], ['smallest: (-3,27)', 'valid']])
  ] },
  { family: 'hand:owner-buoy', edition: 'NSW', q: BUOY, transcripts: [
    T('owner-misread', [['22+5sin((n+)/6)', 'valid'], ['max = 22 + 5', 'valid'], ['= 27', 'valid']]),
    T('owner-clean', [['22+5sin(pi*t/6)', 'valid'], ['max = 22 + 5', 'valid'], ['= 27', 'valid']])
  ] }
];
