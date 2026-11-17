// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · functions and graphs slips (both editions)
//
// Evaluating and composing functions, inverses and their domains, the vertex and
// where a quadratic stops being one-to-one, the discriminant and the roots, and
// exponential and quadratic models. Each entry reads the issued question's prompt,
// works out the wrong answers a NAMED slip gives, and says which slip it was in a
// sentence made of the question's own numbers. Deterministic; marks are never
// read or changed (see slipKit.js).
// ─────────────────────────────────────────────────────────────────────────────
import { n4 } from '../slipKit.js';

const s = (en, hi) => ({ en, hi, 'en-AU': en });
const N = '-?\\d+(?:\\.\\d+)?';
const num = m => Number(m);

/** "3x + 5", "-2x - 8", "x + 9", "x - 5" → { m, c } for mx + c. */
function linear(text) {
  const t = String(text).replace(/\s+/g, '').replace(/−/g, '-');
  const m = t.match(/^(-?\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?$/);
  if (!m) return null;
  const k = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  return { m: k, c: m[2] ? Number(m[2]) : 0 };
}
const lin = ({ m, c }) => (x => m * x + c);
const term = (m, c) => `${m === 1 ? '' : m === -1 ? '-' : n4(m)}x ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))}`;

// ── f(x) = ax² + c: evaluate f(p) ──
const quadEval = {
  id: 'fn-eval-quadratic',
  read(q) {
    const m = String(q.prompt).match(new RegExp(`^\\$f\\(x\\) = (${N})?x\\^2 ([+-]) (\\d+)\\$\\. Find \\$f\\((${N})\\)\\$\\.$`));
    if (!m) return null;
    return { a: m[1] === undefined ? 1 : num(m[1]), c: (m[2] === '-' ? -1 : 1) * num(m[3]), p: num(m[4]) };
  },
  slips({ a, c, p }) {
    return [
      { id: 'fn-eval-bracket-first', value: (a * p) * (a * p) + c, say: s(
        `Only x is squared: f(${n4(p)}) = ${n4(a)} × ${n4(p)}² ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))}. Squaring ${n4(a)}×${n4(p)} as one number gives ${n4((a * p) * (a * p) + c)}.`,
        `केवल x का वर्ग होता है: f(${n4(p)}) = ${n4(a)} × ${n4(p)}² ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))}। ${n4(a)}×${n4(p)} का पूरा वर्ग करने से ${n4((a * p) * (a * p) + c)} मिलता है।`) },
      { id: 'fn-eval-square-skipped', value: a * p + c, say: s(
        `The x is squared first: ${n4(p)}² = ${n4(p * p)}, then × ${n4(a)}, then ${c < 0 ? 'subtract' : 'add'} ${n4(Math.abs(c))}. Here the squaring was skipped.`,
        `पहले x का वर्ग: ${n4(p)}² = ${n4(p * p)}, फिर × ${n4(a)}, फिर ${n4(Math.abs(c))} ${c < 0 ? 'घटाएँ' : 'जोड़ें'}। यहाँ वर्ग करना छूट गया।`) },
      { id: 'fn-eval-sign-of-constant', value: a * p * p - c, say: s(
        `The constant is ${c < 0 ? '−' : '+'}${n4(Math.abs(c))}: f(${n4(p)}) = ${n4(a * p * p)} ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))} = ${n4(a * p * p + c)}. The sign of the constant was reversed.`,
        `अचर ${c < 0 ? '−' : '+'}${n4(Math.abs(c))} है: f(${n4(p)}) = ${n4(a * p * p)} ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))} = ${n4(a * p * p + c)}। अचर का चिह्न उलट गया।`) }
    ];
  }
};

// ── f(x) = mx + c: for what x is f(x) = k? ──
const solveForInput = {
  id: 'fn-solve-for-input',
  read(q) {
    const m = String(q.prompt).match(new RegExp(`^\\$f\\(x\\) = ([^$]+)\\$\\. For what value of \\$x\\$ is \\$f\\(x\\) = (${N})\\$\\?$`));
    const f = m && linear(m[1]);
    return f ? { ...f, k: num(m[2]), text: m[1] } : null;
  },
  slips({ m, c, k }) {
    return [
      { id: 'fn-output-as-input', value: k, say: s(
        `${n4(k)} is the output f(x), not the input x: solve ${term(m, c)} = ${n4(k)} for x, which gives x = ${n4((k - c) / m)}.`,
        `${n4(k)} आउटपुट f(x) है, इनपुट x नहीं: ${term(m, c)} = ${n4(k)} को x के लिए हल करें, तो x = ${n4((k - c) / m)} मिलता है।`) },
      { id: 'fn-inverse-constant-sign', value: (k + c) / m, say: s(
        `To undo the ${c < 0 ? '−' : '+'}${n4(Math.abs(c))} you ${c < 0 ? 'add' : 'subtract'} ${n4(Math.abs(c))} from ${n4(k)}: (${n4(k)} ${c < 0 ? '+' : '−'} ${n4(Math.abs(c))}) ÷ ${n4(m)} = ${n4((k - c) / m)}.`,
        `${c < 0 ? '−' : '+'}${n4(Math.abs(c))} को पलटने के लिए ${n4(k)} में ${n4(Math.abs(c))} ${c < 0 ? 'जोड़ें' : 'घटाएँ'}: (${n4(k)} ${c < 0 ? '+' : '−'} ${n4(Math.abs(c))}) ÷ ${n4(m)} = ${n4((k - c) / m)}।`) },
      { id: 'fn-inverse-order', value: k / m - c, say: s(
        `Undo the steps in reverse order: subtract ${n4(c)} first, THEN divide by ${n4(m)}: (${n4(k)} − ${n4(c)}) ÷ ${n4(m)} = ${n4((k - c) / m)}.`,
        `चरणों को उल्टे क्रम में पलटें: पहले ${n4(c)} घटाएँ, फिर ${n4(m)} से भाग दें: (${n4(k)} − ${n4(c)}) ÷ ${n4(m)} = ${n4((k - c) / m)}।`) },
      { id: 'fn-inverse-multiplied', value: (k - c) * m, say: s(
        `f multiplies by ${n4(m)}, so undoing it divides by ${n4(m)}: x = (${n4(k)} − ${n4(c)}) ÷ ${n4(m)} = ${n4((k - c) / m)}.`,
        `f ${n4(m)} से गुणा करता है, इसलिए उसे पलटने पर ${n4(m)} से भाग देते हैं: x = (${n4(k)} − ${n4(c)}) ÷ ${n4(m)} = ${n4((k - c) / m)}।`) },
      { id: 'fn-inverse-no-divide', value: k - c, say: s(
        `${n4(k - c)} is mx = ${n4(k - c)}: now divide by ${n4(m)} to get x = ${n4((k - c) / m)}.`,
        `${n4(k - c)} है mx = ${n4(k - c)}: अब ${n4(m)} से भाग देकर x = ${n4((k - c) / m)} पाएँ।`) }
    ];
  }
};

// ── f(g(p)): composition of two linear functions ──
const composition = {
  id: 'fn-composition',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/\$f\(x\) = ([^$]+)\$ and \$g\(x\) = ([^$]+)\$\. Find \$f\(g\((-?\d+)\)\)\$/) || t.match(/\$f\(x\) = ([^$]+)\$ and \$g\(x\) = ([^$]+)\$, evaluate \$f\(g\((-?\d+)\)\)\$/);
    if (!m) m = t.match(/If \$f\(x\) = ([^$]+)\$ and \$g\(x\) = ([^$]+)\$, evaluate \$f\(g\((-?\d+)\)\)\$/);
    if (!m) return null;
    const f = linear(m[1]), g = linear(m[2]);
    return f && g ? { f, g, p: num(m[3]) } : null;
  },
  slips({ f, g, p }) {
    const F = lin(f), G = lin(g);
    return [
      { id: 'fn-composition-order', value: G(F(p)), say: s(
        `f(g(${n4(p)})) means g first: g(${n4(p)}) = ${n4(G(p))}, then f(${n4(G(p))}) = ${n4(F(G(p)))}. Doing f first gives g(f(${n4(p)})) = ${n4(G(F(p)))}.`,
        `f(g(${n4(p)})) का अर्थ पहले g: g(${n4(p)}) = ${n4(G(p))}, फिर f(${n4(G(p))}) = ${n4(F(G(p)))}। पहले f करने पर g(f(${n4(p)})) = ${n4(G(F(p)))} मिलता है।`) },
      { id: 'fn-composition-product', value: F(p) * G(p), say: s(
        `f(g(${n4(p)})) is not f(${n4(p)}) × g(${n4(p)}): put g(${n4(p)}) = ${n4(G(p))} INTO f to get ${n4(F(G(p)))}.`,
        `f(g(${n4(p)})) का अर्थ f(${n4(p)}) × g(${n4(p)}) नहीं: g(${n4(p)}) = ${n4(G(p))} को f में डालें, ${n4(F(G(p)))} मिलेगा।`) },
      { id: 'fn-composition-sum', value: F(p) + G(p), say: s(
        `f(g(${n4(p)})) is not f(${n4(p)}) + g(${n4(p)}): put g(${n4(p)}) = ${n4(G(p))} INTO f to get ${n4(F(G(p)))}.`,
        `f(g(${n4(p)})) का अर्थ f(${n4(p)}) + g(${n4(p)}) नहीं: g(${n4(p)}) = ${n4(G(p))} को f में डालें, ${n4(F(G(p)))} मिलेगा।`) }
    ];
  }
};

// ── f(x) = x² + bx + c: where it stops being one-to-one ──
const oneToOneP = {
  id: 'fn-vertex-restriction',
  read(q) {
    const m = String(q.prompt).match(/\$f\(x\) = x\^2 ([+-]) (\d+)x ([+-]) (\d+)\$ is not one-to-one on all of \$\\mathbb\{R\}\$\. Find the \*\*(smallest|largest)\*\* value of \$p\$/);
    if (!m) {
      const k = String(q.prompt).match(/\$f\(x\) = (-?\d*)x\^2 ([+-]) (\d+)x ([+-]) (\d+)\$ (?:is not one-to-one on all of \$\\mathbb\{R\}\$|has no inverse function, because it is not one-to-one)\. Find the \*\*(smallest|largest)\*\* value of \$p\$/);
      if (!k) return null;
      const a = k[1] === '' ? 1 : k[1] === '-' ? -1 : num(k[1]);
      return { a, b: (k[2] === '-' ? -1 : 1) * num(k[3]), c: (k[4] === '-' ? -1 : 1) * num(k[5]) };
    }
    return { a: 1, b: (m[1] === '-' ? -1 : 1) * num(m[2]), c: (m[3] === '-' ? -1 : 1) * num(m[4]) };
  },
  slips({ a, b, c }) {
    const v = -b / (2 * a);
    const minVal = a * v * v + b * v + c;
    return [
      { id: 'fn-vertex-sign', value: b / (2 * a), say: s(
        `The vertex is at x = −b ÷ 2a = −(${n4(b)}) ÷ ${n4(2 * a)} = ${n4(v)}; the sign of b was not flipped.`,
        `शीर्ष x = −b ÷ 2a = −(${n4(b)}) ÷ ${n4(2 * a)} = ${n4(v)} पर है; b का चिह्न नहीं बदला गया।`) },
      { id: 'fn-vertex-y-for-x', value: minVal, say: s(
        `${n4(minVal)} is the vertex's y-value (the ${a > 0 ? 'minimum' : 'maximum'} of f). The restriction is about x: the vertex is at x = ${n4(v)}.`,
        `${n4(minVal)} शीर्ष का y-मान (f का ${a > 0 ? 'न्यूनतम' : 'अधिकतम'}) है। प्रतिबंध x के बारे में है: शीर्ष x = ${n4(v)} पर है।`) },
      { id: 'fn-vertex-y-intercept', value: c, say: s(
        `${n4(c)} is f(0), the y-intercept. The turning point is at x = −b ÷ 2a = ${n4(v)}.`,
        `${n4(c)} f(0), यानी y-अंतःखंड है। मोड़ बिंदु x = −b ÷ 2a = ${n4(v)} पर है।`) },
      { id: 'fn-vertex-no-halving', value: -b / a, say: s(
        `The axis of symmetry is x = −b ÷ 2a: ${n4(-b)} ÷ ${n4(2 * a)} = ${n4(v)}. Here b was divided by ${n4(a)} instead of 2 × ${n4(a)}.`,
        `सममिति अक्ष x = −b ÷ 2a है: ${n4(-b)} ÷ ${n4(2 * a)} = ${n4(v)}। यहाँ b को 2 × ${n4(a)} की जगह ${n4(a)} से भाग दिया गया।`) },
      { id: 'fn-vertex-b-as-x', value: b, say: s(
        `${n4(b)} is just b: the vertex is at x = −b ÷ 2a = ${n4(v)}.`,
        `${n4(b)} केवल b है: शीर्ष x = −b ÷ 2a = ${n4(v)} पर है।`) }
    ];
  }
};

// ── Domain and range of root functions; the inverse's domain ──
const domainRoot = {
  id: 'fn-domain-root',
  read(q) {
    const m = String(q.prompt).match(/smallest value of \$x\$ in the domain of \$f\(x\) = \\sqrt\{([^$}]+)\}\$/);
    const f = m && linear(m[1]);
    return f ? f : null;
  },
  slips({ m, c }) {
    const edge = -c / m;
    return [
      { id: 'fn-domain-no-divide', value: -c, say: s(
        `${n4(m)}x ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))} ≥ 0 gives ${n4(m)}x ≥ ${n4(-c)}, and then x ≥ ${n4(edge)}: divide by ${n4(m)} too.`,
        `${n4(m)}x ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))} ≥ 0 से ${n4(m)}x ≥ ${n4(-c)} मिलता है, फिर x ≥ ${n4(edge)}: ${n4(m)} से भाग भी दें।`) },
      { id: 'fn-domain-constant-sign', value: c / m, say: s(
        `Move the constant across with its sign changed: ${n4(m)}x ≥ ${n4(-c)}, so x ≥ ${n4(edge)}.`,
        `अचर को चिह्न बदलकर दूसरी ओर ले जाएँ: ${n4(m)}x ≥ ${n4(-c)}, इसलिए x ≥ ${n4(edge)}।`) },
      { id: 'fn-domain-constant-as-edge', value: c, say: s(
        `${n4(c)} is the constant, not the edge of the domain: solve ${n4(m)}x ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))} ≥ 0 to get x ≥ ${n4(edge)}.`,
        `${n4(c)} अचर है, प्रांत का सिरा नहीं: ${n4(m)}x ${c < 0 ? '−' : '+'} ${n4(Math.abs(c))} ≥ 0 हल करें, x ≥ ${n4(edge)}।`) }
    ];
  }
};

const minOfSquare = {
  id: 'fn-minimum-of-square',
  read(q) {
    const m = String(q.prompt).match(/Find the minimum value of the function \$f\(x\) = (-?\d*)\(x ([+-]) (\d+)\)\^2 ([+-]) (\d+)\$/);
    if (!m) return null;
    const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : num(m[1]);
    return { a, h: (m[2] === '+' ? -1 : 1) * num(m[3]), k: (m[4] === '-' ? -1 : 1) * num(m[5]) };
  },
  slips({ a, h, k }) {
    return [
      { id: 'fn-minimum-x-for-y', value: h, say: s(
        `${n4(h)} is where the minimum happens (x = ${n4(h)}); the minimum VALUE is f(${n4(h)}) = ${n4(k)}.`,
        `${n4(h)} वहाँ है जहाँ न्यूनतम होता है (x = ${n4(h)}); न्यूनतम मान f(${n4(h)}) = ${n4(k)} है।`) },
      { id: 'fn-minimum-bracket-sign', value: -h, say: s(
        `The bracket (x ${h < 0 ? '+' : '−'} ${n4(Math.abs(h))}) is zero at x = ${n4(h)}, but the question asks for the lowest value of f, which is ${n4(k)}.`,
        `कोष्ठक (x ${h < 0 ? '+' : '−'} ${n4(Math.abs(h))}) x = ${n4(h)} पर शून्य होता है, पर प्रश्न f का सबसे छोटा मान माँगता है, जो ${n4(k)} है।`) }
    ];
  }
};

// ── f⁻¹(k) for a linear and a cubic f ──
const inverseValue = {
  id: 'fn-inverse-value',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/^\$f\(x\) = ([^$]+)\$\. Find \$f\^\{-1\}\((-?\d+)\)\$, the value of \$x\$ for which \$f\(x\) = \2\$\.$/);
    if (m) { const f = linear(m[1]); return f ? { kind: 'lin', ...f, k: num(m[2]) } : null; }
    m = t.match(/^For \$f\(x\) = x\^3 ([+-]) (\d+)\$, evaluate \$f\^\{-1\}\((-?\d+)\)\$\.$/);
    return m ? { kind: 'cube', c: (m[1] === '-' ? -1 : 1) * num(m[2]), k: num(m[3]) } : null;
  },
  slips(p) {
    if (p.kind === 'lin') {
      const { m, c, k } = p;
      return [
        { id: 'fn-inverse-no-divide', value: k - c, say: s(
          `f⁻¹(${n4(k)}) solves ${term(m, c)} = ${n4(k)}: (${n4(k)} − ${n4(c)}) ÷ ${n4(m)} = ${n4((k - c) / m)}. ${n4(k - c)} still needs dividing by ${n4(m)}.`,
          `f⁻¹(${n4(k)}) का अर्थ ${term(m, c)} = ${n4(k)} हल करना: (${n4(k)} − ${n4(c)}) ÷ ${n4(m)} = ${n4((k - c) / m)}। ${n4(k - c)} को ${n4(m)} से भाग देना बाकी है।`) },
        { id: 'fn-inverse-evaluated-f', value: m * k + c, say: s(
          `f⁻¹(${n4(k)}) is not f(${n4(k)}): it asks for the x with f(x) = ${n4(k)}, which is x = ${n4((k - c) / m)}.`,
          `f⁻¹(${n4(k)}) और f(${n4(k)}) एक नहीं: यह वह x माँगता है जिसके लिए f(x) = ${n4(k)}, यानी x = ${n4((k - c) / m)}।`) },
        { id: 'fn-inverse-constant-sign', value: (k + c) / m, say: s(
          `Undo ${c < 0 ? '−' : '+'}${n4(Math.abs(c))} by ${c < 0 ? 'adding' : 'subtracting'} it: (${n4(k)} ${c < 0 ? '+' : '−'} ${n4(Math.abs(c))}) ÷ ${n4(m)} = ${n4((k - c) / m)}.`,
          `${c < 0 ? '−' : '+'}${n4(Math.abs(c))} को ${c < 0 ? 'जोड़कर' : 'घटाकर'} पलटें: (${n4(k)} ${c < 0 ? '+' : '−'} ${n4(Math.abs(c))}) ÷ ${n4(m)} = ${n4((k - c) / m)}।`) }
      ];
    }
    const { c, k } = p;
    const right = Math.cbrt(k - c);
    return [
      { id: 'fn-inverse-evaluated-f', value: k * k * k + c, say: s(
        `f⁻¹(${n4(k)}) is not f(${n4(k)}): undo f in reverse order, subtract ${n4(c)} (${n4(k - c)}), then take the cube root = ${n4(right)}.`,
        `f⁻¹(${n4(k)}) और f(${n4(k)}) एक नहीं: f को उल्टे क्रम में पलटें, ${n4(c)} घटाएँ (${n4(k - c)}), फिर घनमूल लें = ${n4(right)}।`) },
      { id: 'fn-inverse-no-root', value: k - c, say: s(
        `${n4(k - c)} is x³; take the cube root to get x = ${n4(right)}.`,
        `${n4(k - c)} x³ है; x = ${n4(right)} के लिए घनमूल लें।`) },
      { id: 'fn-inverse-order', value: Math.cbrt(k) - c, say: s(
        `Undo in reverse order: subtract ${n4(c)} FIRST (${n4(k - c)}), then cube root: ${n4(right)}.`,
        `उल्टे क्रम में पलटें: पहले ${n4(c)} घटाएँ (${n4(k - c)}), फिर घनमूल: ${n4(right)}।`) }
    ];
  }
};

// ── (f∘g)⁻¹(k) ──
const compositeInverse = {
  id: 'fn-composite-inverse',
  read(q) {
    const m = String(q.prompt).match(/^For \$f\(x\) = ([^$]+)\$ and \$g\(x\) = ([^$]+)\$, evaluate \$\(f \\circ g\)\^\{-1\}\((-?\d+)\)\$\.$/);
    if (!m) return null;
    const f = linear(m[1]), g = linear(m[2]);
    return f && g ? { f, g, k: num(m[3]) } : null;
  },
  slips({ f, g, k }) {
    const F = lin(f), G = lin(g);
    const Finv = y => (y - f.c) / f.m, Ginv = y => (y - g.c) / g.m;
    return [
      { id: 'fn-composite-inverse-not-inverted', value: F(G(k)), say: s(
        `(f∘g)⁻¹(${n4(k)}) is not f(g(${n4(k)})): it asks for the x with f(g(x)) = ${n4(k)}, which is x = ${n4(Ginv(Finv(k)))}.`,
        `(f∘g)⁻¹(${n4(k)}) और f(g(${n4(k)})) एक नहीं: यह वह x माँगता है जिसके लिए f(g(x)) = ${n4(k)}, यानी x = ${n4(Ginv(Finv(k)))}।`) },
      { id: 'fn-composite-inverse-one-function', value: Finv(k), say: s(
        `That only undoes f. There is still g to undo: x = g⁻¹(f⁻¹(${n4(k)})) = ${n4(Ginv(Finv(k)))}.`,
        `इससे केवल f पलटा। g को भी पलटना बाकी है: x = g⁻¹(f⁻¹(${n4(k)})) = ${n4(Ginv(Finv(k)))}।`) },
      { id: 'fn-composite-inverse-order', value: Finv(Ginv(k)), say: s(
        `(f∘g)⁻¹ = g⁻¹∘f⁻¹: undo f FIRST, then g. Here g was undone first, giving ${n4(Finv(Ginv(k)))}; the answer is ${n4(Ginv(Finv(k)))}.`,
        `(f∘g)⁻¹ = g⁻¹∘f⁻¹: पहले f पलटें, फिर g। यहाँ पहले g पलटा गया, ${n4(Finv(Ginv(k)))} मिला; उत्तर ${n4(Ginv(Finv(k)))} है।`) },
      { id: 'fn-composite-inverse-g-only', value: Ginv(k), say: s(
        `That only undoes g. f has to be undone first: x = g⁻¹(f⁻¹(${n4(k)})) = ${n4(Ginv(Finv(k)))}.`,
        `इससे केवल g पलटा। पहले f पलटना है: x = g⁻¹(f⁻¹(${n4(k)})) = ${n4(Ginv(Finv(k)))}।`) }
    ];
  }
};

// ── the domain of f⁻¹ and an asymptote ──
const inverseDomain = {
  id: 'fn-inverse-domain',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/^\$f\(x\) = (-?\d*)\\sqrt\{x ([+-]) (\d+)\} ([+-]) (\d+)\$ has domain \$x \\ge (-?\d+)\$\. State the \*\*domain of \$f\^\{-1\}\$\*\*/);
    if (m) {
      const k = (m[4] === '-' ? -1 : 1) * num(m[5]);
      const a = m[1] === '' ? 1 : num(m[1]);
      return { kind: 'sqrt', a, b: (m[2] === '-' ? -1 : 1) * num(m[3]), k };
    }
    m = t.match(/^\$f\(x\) = \\dfrac\{(-?\d+)\}\{x ([+-]) (\d+)\} ([+-]) (\d+)\$ has domain \$x \\ne (-?\d+)\$\./);
    if (m) return { kind: 'asym', a: num(m[1]), b: (m[2] === '-' ? -1 : 1) * num(m[3]), k: (m[4] === '-' ? -1 : 1) * num(m[5]) };
    return null;
  },
  slips(p) {
    if (p.kind === 'sqrt') {
      const { a, b, k } = p;
      return [
        { id: 'fn-inverse-domain-of-f', value: -b, say: s(
          `x ≥ ${n4(-b)} is the domain of f itself. The domain of f⁻¹ is the RANGE of f: since √ ≥ 0, f(x) ≥ ${n4(k)}, so x ≥ ${n4(k)}.`,
          `x ≥ ${n4(-b)} स्वयं f का प्रांत है। f⁻¹ का प्रांत f का परिसर है: √ ≥ 0 होने से f(x) ≥ ${n4(k)}, इसलिए x ≥ ${n4(k)}।`) },
        { id: 'fn-inverse-domain-shift-sign', value: -k, say: s(
          `The least value of f is ${n4(k)} (the surd is 0 there), so the domain of f⁻¹ is x ≥ ${n4(k)}: the shift ${n4(k)} keeps its sign.`,
          `f का सबसे छोटा मान ${n4(k)} है (वहाँ करणी 0 है), इसलिए f⁻¹ का प्रांत x ≥ ${n4(k)} है: विस्थापन ${n4(k)} का चिह्न नहीं बदलता।`) }
      ];
    }
    const { a, b, k } = p;
    return [
      { id: 'fn-inverse-domain-of-f', value: -b, say: s(
        `x = ${n4(-b)} is excluded from the domain of f. The inverse's missing value is f's horizontal asymptote, y = ${n4(k)}.`,
        `x = ${n4(-b)} f के प्रांत से बाहर है। प्रतिलोम का छूटा मान f की क्षैतिज अनंतस्पर्शी y = ${n4(k)} है।`) },
      { id: 'fn-inverse-domain-numerator', value: a, say: s(
        `${n4(a)} is the numerator, not the asymptote. The horizontal asymptote is the added constant, y = ${n4(k)}.`,
        `${n4(a)} अंश है, अनंतस्पर्शी नहीं। क्षैतिज अनंतस्पर्शी जोड़ा गया अचर y = ${n4(k)} है।`) },
      { id: 'fn-inverse-domain-vertical', value: b, say: s(
        `That has the wrong sign for the vertical asymptote and is the wrong asymptote anyway: the inverse's missing value is the horizontal one, y = ${n4(k)}.`,
        `यह ऊर्ध्वाधर अनंतस्पर्शी का गलत चिह्न है और वैसे भी गलत अनंतस्पर्शी है: प्रतिलोम का छूटा मान क्षैतिज वाला y = ${n4(k)} है।`) }
    ];
  }
};

// ── Quadratics: discriminant, roots, completing the square ──
const quad = '(-?\\d*)x\\^2 ([+-]) (\\d+)x ([+-]) (\\d+)';
const coeffOf = (sign, digits) => (sign === '-' ? -1 : 1) * num(digits);
const aOf = a => (a === '' ? 1 : a === '-' ? -1 : num(a));
const discriminant = {
  id: 'fn-discriminant',
  read(q) {
    const m = String(q.prompt).match(new RegExp(`^Find the discriminant of \\$${quad} = 0\\$\\.$`));
    return m ? { a: aOf(m[1]), b: coeffOf(m[2], m[3]), c: coeffOf(m[4], m[5]) } : null;
  },
  slips({ a, b, c }) {
    const D = b * b - 4 * a * c;
    return [
      { id: 'disc-plus', value: b * b + 4 * a * c, say: s(
        `Δ = b² − 4ac = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}. The 4ac was added; it is subtracted, and a negative a or c changes its sign.`,
        `Δ = b² − 4ac = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}। 4ac जोड़ दिया गया; यह घटाया जाता है, और ऋणात्मक a या c से चिह्न बदलता है।`) },
      { id: 'disc-b-not-squared', value: b - 4 * a * c, say: s(
        `b must be squared: Δ = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}, not ${n4(b)} − 4ac.`,
        `b का वर्ग करना है: Δ = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}, ${n4(b)} − 4ac नहीं।`) },
      { id: 'disc-sign-of-c', value: b * b - 4 * a * Math.abs(c), say: s(
        `c is ${n4(c)}, with its sign: Δ = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}.`,
        `c अपने चिह्न के साथ ${n4(c)} है: Δ = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}।`) },
      { id: 'disc-sign-of-a', value: b * b - 4 * Math.abs(a) * c, say: s(
        `a is ${n4(a)}, with its sign: Δ = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}.`,
        `a अपने चिह्न के साथ ${n4(a)} है: Δ = ${n4(b)}² − 4(${n4(a)})(${n4(c)}) = ${n4(D)}।`) }
    ];
  }
};

const rootsSumProduct = {
  id: 'fn-sum-product-roots',
  read(q) {
    const m = String(q.prompt).match(new RegExp(`Without solving, find the \\*\\*(sum|product)\\*\\* of the roots of \\$${quad} = 0\\$`));
    return m ? { which: m[1], a: aOf(m[2]), b: coeffOf(m[3], m[4]), c: coeffOf(m[5], m[6]) } : null;
  },
  slips({ which, a, b, c }) {
    if (which === 'sum') return [
      { id: 'roots-sum-sign', value: b / a, say: s(
        `The sum of the roots is −b ÷ a = −(${n4(b)}) ÷ ${n4(a)} = ${n4(-b / a)}; the sign of b was not flipped.`,
        `मूलों का योग −b ÷ a = −(${n4(b)}) ÷ ${n4(a)} = ${n4(-b / a)} है; b का चिह्न नहीं बदला गया।`) },
      { id: 'roots-sum-with-product-formula', value: c / a, say: s(
        `c ÷ a = ${n4(c / a)} is the PRODUCT of the roots; the sum is −b ÷ a = ${n4(-b / a)}.`,
        `c ÷ a = ${n4(c / a)} मूलों का गुणनफल है; योग −b ÷ a = ${n4(-b / a)} है।`) }
    ];
    return [
      { id: 'roots-product-sign', value: -c / a, say: s(
        `The product of the roots is c ÷ a = ${n4(c)} ÷ ${n4(a)} = ${n4(c / a)}, with no sign flip.`,
        `मूलों का गुणनफल c ÷ a = ${n4(c)} ÷ ${n4(a)} = ${n4(c / a)} है, चिह्न बदले बिना।`) },
      { id: 'roots-product-with-sum-formula', value: -b / a, say: s(
        `−b ÷ a = ${n4(-b / a)} is the SUM of the roots; the product is c ÷ a = ${n4(c / a)}.`,
        `−b ÷ a = ${n4(-b / a)} मूलों का योग है; गुणनफल c ÷ a = ${n4(c / a)} है।`) }
    ];
  }
};

const equalRoots = {
  id: 'fn-equal-roots',
  read(q) {
    const m = String(q.prompt).match(/Find the value of \$k\$ for which \$(-?\d*)x\^2 ([+-]) (\d+)x \+ k = 0\$ has \*\*equal roots\*\*|Find the value of \$k\$ for which \$(-?\d*)x\^2 ([+-]) (\d+)x ([+-]) k = 0\$/);
    if (!m) return null;
    const a = aOf(m[1] ?? m[4]), b = coeffOf(m[2] ?? m[5], m[3] ?? m[6]);
    return { a, b };
  },
  slips({ a, b }) {
    const right = (b * b) / (4 * a);
    return [
      { id: 'equal-roots-sign', value: -right, say: s(
        `Equal roots need Δ = b² − 4ak = 0, so k = b² ÷ 4a = ${n4(b * b)} ÷ ${n4(4 * a)} = ${n4(right)}; the sign was changed.`,
        `समान मूलों के लिए Δ = b² − 4ak = 0, इसलिए k = b² ÷ 4a = ${n4(b * b)} ÷ ${n4(4 * a)} = ${n4(right)}; चिह्न बदल गया।`) },
      { id: 'equal-roots-divided-by-four', value: (b * b) / 4, say: s(
        `Divide by 4a = ${n4(4 * a)}, not just 4: k = ${n4(b * b)} ÷ ${n4(4 * a)} = ${n4(right)}.`,
        `4a = ${n4(4 * a)} से भाग दें, केवल 4 से नहीं: k = ${n4(b * b)} ÷ ${n4(4 * a)} = ${n4(right)}।`) },
      { id: 'equal-roots-b-squared', value: b * b, say: s(
        `b² = ${n4(b * b)} is not k: Δ = b² − 4ak = 0 gives k = b² ÷ 4a = ${n4(right)}.`,
        `b² = ${n4(b * b)} k नहीं है: Δ = b² − 4ak = 0 से k = b² ÷ 4a = ${n4(right)} मिलता है।`) },
      { id: 'equal-roots-divided-by-two-a', value: (b * b) / (2 * a), say: s(
        `4ak, not 2ak: k = b² ÷ 4a = ${n4(b * b)} ÷ ${n4(4 * a)} = ${n4(right)}.`,
        `2ak नहीं 4ak: k = b² ÷ 4a = ${n4(b * b)} ÷ ${n4(4 * a)} = ${n4(right)}।`) }
    ];
  }
};

const completeSquareValue = {
  id: 'fn-complete-square-value',
  read(q) {
    const m = String(q.prompt).match(new RegExp(`By completing the square, find the \\*\\*(minimum|maximum) value\\*\\* of \\$y = ${quad}\\$`));
    return m ? { a: aOf(m[2]), b: coeffOf(m[3], m[4]), c: coeffOf(m[5], m[6]) } : null;
  },
  slips({ a, b, c }) {
    const h = -b / (2 * a), k = c - (b * b) / (4 * a);
    return [
      { id: 'cts-x-for-y', value: h, say: s(
        `${n4(h)} is where the ${a > 0 ? 'minimum' : 'maximum'} happens (x = ${n4(h)}); the value is y = ${n4(k)}.`,
        `${n4(h)} वहाँ है जहाँ ${a > 0 ? 'न्यूनतम' : 'अधिकतम'} होता है (x = ${n4(h)}); मान y = ${n4(k)} है।`) },
      { id: 'cts-y-intercept', value: c, say: s(
        `${n4(c)} is y when x = 0, not the turning point. Complete the square: y = ${n4(a)}(x ${h < 0 ? '+' : '−'} ${n4(Math.abs(h))})² + ${n4(k)}.`,
        `${n4(c)} x = 0 पर y है, मोड़ बिंदु नहीं। वर्ग पूरा करें: y = ${n4(a)}(x ${h < 0 ? '+' : '−'} ${n4(Math.abs(h))})² + ${n4(k)}।`) },
      { id: 'cts-no-square-correction', value: c - b / 2, say: s(
        `After taking out ${n4(a)}, the number to subtract is the square of half the x-coefficient: the turning value is ${n4(k)}.`,
        `${n4(a)} बाहर निकालने के बाद, घटाई जाने वाली संख्या x के गुणांक के आधे का वर्ग है: मोड़ का मान ${n4(k)} है।`) }
    ];
  }
};

// ── Exponential and quadratic models ──
const growthModel = {
  id: 'fn-growth-model',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/numbers \$(\d+)\$ and doubles every \$(\d+)\$ hours.*How many bacteria are there after \$(\d+)\$ hours/);
    if (m) return { kind: 'grow', A: num(m[1]), T: num(m[2]), t: num(m[3]) };
    m = t.match(/half-life of \$(\d+)\$ days.*M\(t\) = (\d+)\\times.*Find its mass after \$(\d+)\$ days/);
    if (m) return { kind: 'decay', T: num(m[1]), A: num(m[2]), t: num(m[3]) };
    m = t.match(/P\(t\) = (\d+)\\times 2\^\{t\/(\d+)\}\$, where \$t\$ is in years\. After how many years does the population reach \$(\d+)\$/);
    if (m) return { kind: 'time', A: num(m[1]), T: num(m[2]), P: num(m[3]) };
    m = t.match(/R\(n\) = (\d+)n\((\d+) - n\)\$ for \$0 \\le n \\le \d+\$\. Find the maximum revenue/);
    if (m) return { kind: 'rev', k: num(m[1]), top: num(m[2]) };
    return null;
  },
  slips(p) {
    if (p.kind === 'grow') {
      const { A, T, t } = p; const d = t / T;
      return [
        { id: 'exp-added-not-multiplied', value: A * (1 + d), say: s(
          `The culture doubles ${n4(d)} times, so multiply by 2 each time: ${n4(A)} × 2^${n4(d)} = ${n4(A * 2 ** d)}. Adding ${n4(d)} doubles' worth is not the same.`,
          `संस्कृति ${n4(d)} बार दुगुनी होती है, इसलिए हर बार 2 से गुणा करें: ${n4(A)} × 2^${n4(d)} = ${n4(A * 2 ** d)}। ${n4(d)} जोड़ना वही नहीं है।`) },
        { id: 'exp-exponent-not-divided', value: A * 2 ** t, say: s(
          `The exponent is t ÷ ${n4(T)} = ${n4(d)}, not ${n4(t)}: ${n4(A)} × 2^${n4(d)} = ${n4(A * 2 ** d)}.`,
          `घातांक t ÷ ${n4(T)} = ${n4(d)} है, ${n4(t)} नहीं: ${n4(A)} × 2^${n4(d)} = ${n4(A * 2 ** d)}।`) },
        { id: 'exp-linear-growth', value: A + t * (A / T), say: s(
          `Doubling is multiplying, not adding the same amount: ${n4(A)} × 2^${n4(d)} = ${n4(A * 2 ** d)}.`,
          `दुगुना होना गुणा है, हर बार समान राशि जोड़ना नहीं: ${n4(A)} × 2^${n4(d)} = ${n4(A * 2 ** d)}।`) }
      ];
    }
    if (p.kind === 'decay') {
      const { A, T, t } = p; const d = t / T;
      return [
        { id: 'exp-one-half-life', value: A / 2, say: s(
          `${n4(t)} days is ${n4(d)} half-lives, so halve ${n4(d)} times: ${n4(A)} × (½)^${n4(d)} = ${n4(A * 0.5 ** d)}. ${n4(A / 2)} is just one halving.`,
          `${n4(t)} दिन ${n4(d)} अर्ध-आयु हैं, इसलिए ${n4(d)} बार आधा करें: ${n4(A)} × (½)^${n4(d)} = ${n4(A * 0.5 ** d)}। ${n4(A / 2)} केवल एक बार आधा करना है।`) },
        { id: 'exp-exponent-not-divided', value: A * 0.5 ** t, say: s(
          `The exponent is t ÷ ${n4(T)} = ${n4(d)}, not ${n4(t)}.`,
          `घातांक t ÷ ${n4(T)} = ${n4(d)} है, ${n4(t)} नहीं।`) }
      ];
    }
    if (p.kind === 'time') {
      const { A, T, P } = p; const d = Math.log2(P / A);
      return [
        { id: 'exp-exponent-only', value: d, say: s(
          `${n4(d)} is the exponent t ÷ ${n4(T)}, not t: t = ${n4(T)} × ${n4(d)} = ${n4(T * d)}.`,
          `${n4(d)} घातांक t ÷ ${n4(T)} है, t नहीं: t = ${n4(T)} × ${n4(d)} = ${n4(T * d)}।`) },
        { id: 'exp-ratio-not-log', value: T * (P / A), say: s(
          `${n4(P)} ÷ ${n4(A)} = ${n4(P / A)} is 2^(t÷${n4(T)}): find the power of 2 (${n4(d)}), then multiply by ${n4(T)}.`,
          `${n4(P)} ÷ ${n4(A)} = ${n4(P / A)} 2^(t÷${n4(T)}) है: 2 की घात (${n4(d)}) निकालें, फिर ${n4(T)} से गुणा करें।`) }
      ];
    }
    const { k, top } = p;
    return [
      { id: 'quad-model-x-for-y', value: top / 2, say: s(
        `${n4(top / 2)} is the number of tickets that gives the maximum; the maximum revenue is R(${n4(top / 2)}) = ${n4(k * (top / 2) * (top / 2))}.`,
        `${n4(top / 2)} टिकटों की वह संख्या है जो अधिकतम देती है; अधिकतम आय R(${n4(top / 2)}) = ${n4(k * (top / 2) * (top / 2))} है।`) },
      { id: 'quad-model-half-of-top', value: k * (top / 2), say: s(
        `Put n = ${n4(top / 2)} into BOTH factors: R = ${n4(k)} × ${n4(top / 2)} × (${n4(top)} − ${n4(top / 2)}) = ${n4(k * (top / 2) * (top / 2))}.`,
        `n = ${n4(top / 2)} को दोनों गुणनखंडों में रखें: R = ${n4(k)} × ${n4(top / 2)} × (${n4(top)} − ${n4(top / 2)}) = ${n4(k * (top / 2) * (top / 2))}।`) }
    ];
  }
};

export const entries = Object.freeze([
  quadEval, solveForInput, composition, oneToOneP, domainRoot, minOfSquare, inverseValue, compositeInverse, inverseDomain,
  discriminant, rootsSumProduct, equalRoots, completeSquareValue, growthModel
]);
export default entries;
