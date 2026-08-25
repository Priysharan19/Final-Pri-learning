// Every piece of mathematics shown in the film, as KaTeX source, together with
// the numeric facts that make it checkable. scripts/check.ts imports VERIFICATIONS
// and fails the build if any of them is false, and fails if any TeX string does
// not compile with katex.renderToString({ throwOnError: true }).

export interface Verification {
  name: string;
  /** Returns true iff the mathematics is correct. Pure, no tolerance games. */
  check: () => boolean;
}

/** The factory's stamped formula cards — all real, all correct, deliberately lifeless. */
export const FACTORY_CARDS: string[] = [
  String.raw`\dfrac{d}{dx}\,x^{2}=2x`,
  String.raw`\sin^{2}\theta+\cos^{2}\theta=1`,
  String.raw`x=\dfrac{-b\pm\sqrt{b^{2}-4ac}}{2a}`,
  String.raw`\log ab=\log a+\log b`,
  String.raw`(a+b)^{2}=a^{2}+2ab+b^{2}`,
  String.raw`S_{n}=\dfrac{n}{2}\,(a+l)`,
  String.raw`e^{i\pi}+1=0`,
  String.raw`\displaystyle\int x^{n}\,dx=\dfrac{x^{n+1}}{n+1}+C`,
  String.raw`\tan\theta=\dfrac{\sin\theta}{\cos\theta}`,
  String.raw`a^{2}=b^{2}+c^{2}-2bc\cos A`,
  String.raw`\displaystyle\sum_{k=1}^{n}k=\dfrac{n(n+1)}{2}`,
  String.raw`|z_{1}z_{2}|=|z_{1}||z_{2}|`,
  String.raw`\dbinom{n}{r}=\dfrac{n!}{r!\,(n-r)!}`,
  String.raw`\sin 2\theta = 2\sin\theta\cos\theta`,
  String.raw`\dfrac{d}{dx}\,\sin x=\cos x`,
];

/** Index of the card the film returns to in Act II. */
export const HERO_CARD_INDEX = 0; // d/dx x² = 2x

/** The seize — the question pattern-recall cannot answer. */
export const SEIZE_QUESTION = String.raw`\text{Prove that }\; e^{x}\ge 1+x\;\text{ for every real }x.`;

/** Act II — the hinge. */
export const HINGE = {
  curve: String.raw`y=x^{2}`,
  quotient: String.raw`\dfrac{f(1+h)-f(1)}{h}`,
  limit: String.raw`\lim_{h\to 0}\dfrac{(1+h)^{2}-1}{h}=2`,
  resolved: String.raw`f'(1)=2`,
  slopeAt: (h: number, slope: string): string =>
    String.raw`h=${h}\;\Rightarrow\;\text{slope}=${slope}`,
  /** Secant slope pairs shown on screen: (h, slope of secant through x=1 and 1+h on y=x²). */
  steps: [
    { h: 1, slope: '3' },
    { h: 0.5, slope: '2.5' },
    { h: 0.1, slope: '2.1' },
  ],
  tangentLine: String.raw`y=2x-1`,
};

/** Act II — the ideal product resolves the seize. */
export const PRODUCT = {
  question: SEIZE_QUESTION,
  idea: String.raw`\text{tangent to }e^{x}\text{ at }x=0:\;\; y=1+x`,
  proofLine1: String.raw`g(x)=e^{x}-(1+x),\quad g'(x)=e^{x}-1`,
  proofLine2: String.raw`g'<0 \text{ on } x<0,\;\; g'>0 \text{ on } x>0\;\Rightarrow\; \min g=g(0)=0`,
  conclusion: String.raw`\therefore\; e^{x}\ge 1+x\quad\blacksquare`,
  /** Handwritten (Caveat) final line the marks land on. */
  handwritten: 'so eˣ − (1 + x) ≥ g(0) = 0  ∴  eˣ ≥ 1 + x  ∎',
  ticks: ['tangent at 0', 'minimum at 0', 'conclusion'],
};

/** Act III — the ladder: the same motif at five pressures. */
export const LADDER = [
  { label: 'Class 7', kicker: 'SLOPE', tex: String.raw`y=2x`, note: 'rise over run' },
  { label: 'Class 10', kicker: 'CIRCLES', tex: String.raw`OP\perp\ell`, note: 'radius ⊥ tangent at the point of contact' },
  { label: 'Class 12', kicker: 'DERIVATIVES', tex: String.raw`f'(x)=2x`, note: 'the card, finally understood' },
  { label: 'JEE', kicker: 'CONICS', tex: String.raw`x-y+1=0`, note: 'tangent to y² = 4x at (1, 2)' },
  { label: 'Olympiad', kicker: 'INEQUALITIES', tex: String.raw`e^{x}\ge 1+x`, note: 'the tangent-line trick' },
];

/** Everything above, checkable. */
export const VERIFICATIONS: Verification[] = [
  {
    name: 'secant slope ((1+h)² − 1)/h equals 2 + h, so 3 / 2.5 / 2.1 for h = 1 / 0.5 / 0.1',
    check: () =>
      HINGE.steps.every(({ h, slope }) => {
        const s = ((1 + h) ** 2 - 1) / h;
        return Math.abs(s - (2 + h)) < 1e-12 && Math.abs(s - Number(slope)) < 1e-12;
      }),
  },
  {
    name: 'limit of the difference quotient at x=1 for f=x² is 2 (checked at h = 1e-6 and −1e-6)',
    check: () => {
      const q = (h: number) => ((1 + h) ** 2 - 1) / h;
      return Math.abs(q(1e-6) - 2) < 1e-5 && Math.abs(q(-1e-6) - 2) < 1e-5;
    },
  },
  {
    name: 'tangent to y=x² at (1,1) is y=2x−1: touches at x=1, stays below elsewhere',
    check: () => {
      const touch = Math.abs(1 ** 2 - (2 * 1 - 1)) < 1e-12;
      const below = [-3, -1, 0, 0.5, 2, 4].every((x) => x ** 2 > 2 * x - 1);
      return touch && below;
    },
  },
  {
    name: 'tangent to eˣ at 0 is y=1+x, and eˣ ≥ 1+x with equality only at 0',
    check: () => {
      const slopeOk = Math.abs((Math.exp(1e-8) - 1) / 1e-8 - 1) < 1e-6;
      const ge = [-10, -2, -0.5, -1e-9, 1e-9, 0.5, 2, 10].every((x) => Math.exp(x) >= 1 + x);
      const strict = [-2, -0.5, 0.5, 2].every((x) => Math.exp(x) > 1 + x + 1e-9);
      const eq = Math.abs(Math.exp(0) - 1) < 1e-15;
      return slopeOk && ge && strict && eq;
    },
  },
  {
    name: 'g(x)=eˣ−(1+x): g′=eˣ−1 signs give a minimum 0 at x=0 (film proof lines)',
    check: () => {
      const gp = (x: number) => Math.exp(x) - 1;
      return gp(-1) < 0 && gp(1) > 0 && Math.abs(Math.exp(0) - (1 + 0)) < 1e-15;
    },
  },
  {
    name: 'JEE station: x−y+1=0 is tangent to y²=4x at (1,2)',
    check: () => {
      // (1,2) on the parabola, on the line; the line meets y²=4x in a double root.
      const onCurve = 2 ** 2 === 4 * 1;
      const onLine = 1 - 2 + 1 === 0;
      // substitute x = y − 1 into y² = 4x: y² − 4y + 4 = (y−2)² — discriminant 0
      const disc = (-4) ** 2 - 4 * 1 * 4;
      return onCurve && onLine && disc === 0;
    },
  },
  {
    name: 'Class 7 station: y=2x has slope 2 (rise/run between any two points)',
    check: () => {
      const m = (2 * 5 - 2 * 3) / (5 - 3);
      return m === 2;
    },
  },
  {
    name: 'factory cards spot-checks: quadratic formula root, Pythagorean identity, sum 1..n',
    check: () => {
      // x² − 5x + 6: roots 2, 3 via the formula
      const r1 = (5 + Math.sqrt(25 - 24)) / 2;
      const r2 = (5 - Math.sqrt(25 - 24)) / 2;
      const quad = Math.abs(r1 - 3) < 1e-12 && Math.abs(r2 - 2) < 1e-12;
      const pyth = [0.3, 1.1, 2.7].every((t) => Math.abs(Math.sin(t) ** 2 + Math.cos(t) ** 2 - 1) < 1e-12);
      const gauss = [1, 7, 100].every((n) => (n * (n + 1)) / 2 === Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a + b, 0));
      const cosRule = (() => {
        // triangle with b=3, c=4, A=60°: a² = 9+16−24·cos60 = 13
        const a2 = 9 + 16 - 2 * 3 * 4 * Math.cos(Math.PI / 3);
        return Math.abs(a2 - 13) < 1e-12;
      })();
      const logs = Math.abs(Math.log(6) - (Math.log(2) + Math.log(3))) < 1e-12;
      const sin2 = [0.4, 1.3].every((t) => Math.abs(Math.sin(2 * t) - 2 * Math.sin(t) * Math.cos(t)) < 1e-12);
      return quad && pyth && gauss && cosRule && logs && sin2;
    },
  },
];

/** All TeX shown anywhere in the film — compiled by check.ts with throwOnError. */
export const ALL_TEX: string[] = [
  ...FACTORY_CARDS,
  SEIZE_QUESTION,
  HINGE.curve,
  HINGE.quotient,
  HINGE.limit,
  HINGE.resolved,
  HINGE.tangentLine,
  ...HINGE.steps.map((s) => HINGE.slopeAt(s.h, s.slope)),
  PRODUCT.idea,
  PRODUCT.proofLine1,
  PRODUCT.proofLine2,
  PRODUCT.conclusion,
  ...LADDER.map((l) => l.tex),
];
