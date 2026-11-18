// Pri Learning · algebra slips: expanding, factorising, solving linear equations.
//
// Every detector answers one question: "is this broken line exactly what the
// line above becomes when the student makes slip X?" Equality is exact
// (poly.js), so a slip is named only when it explains the line. The numbers in
// the message are the question's own. Feedback only: the checker has already
// decided the line is a break; nothing here changes a status, a mark or the
// first break, and no model is involved.
import { registerTopic } from './registry.js';
import { parse, normalize } from '../../expr.js';
import { resetPolyBudget, sameAsPrevious, coeffOf, degreeIn, fmt, fmtPoly, polyAdd, polyConst, polyEqual, polyFromAst, polyMul, polyOfExpression, polyOfText, polyVar, productFactors, sumTerms, unwrap } from './poly.js';

const astOf = text => {
  const s = String(text ?? '').replace(/[−–—]/g, '-').trim();
  const body = s.includes('=') ? s.split('=').pop() : s;
  try { return parse(normalize(body)); } catch { return null; }
};
const soleVariable = p => { const vs = new Set(); for (const m of p.values()) for (const v of Object.keys(m.e)) if (m.e[v]) vs.add(v); return vs.size === 1 ? [...vs][0] : null; };
const isExpression = meta => meta?.kind !== 'equation' && meta?.kind !== 'plan';
const co = a => (a === 1 ? '' : a === -1 ? '−' : fmt(a));
const signed = (v, first = false) => (first ? fmt(v) : v < 0 ? `− ${fmt(-v)}` : `+ ${fmt(v)}`);

/** A top-level (a·v + b) group as { a, b }, or null. */
function linearGroup(node, v) {
  const p = polyFromAst(node);
  if (!p || degreeIn(p, v) !== 1) return null;
  for (const m of p.values()) if (!(m.e[v] === 1 && Object.keys(m.e).length === 1) && Object.keys(m.e).length) return null;
  return { a: coeffOf(p, v, 1), b: p.get('')?.c || 0 };
}
const bracketText = (g, v) => `(${g.a === 1 ? '' : g.a === -1 ? '−' : fmt(g.a)}${v} ${signed(g.b)})`;

// ── Expanding two brackets ───────────────────────────────────────────────────
function twoBrackets(prev) {
  const f = productFactors(prev);
  if (f.length === 2) return f;
  const n = unwrap(prev);
  if (n?.t === 'bin' && n.op === '^') {
    const k = unwrap(n.r);
    if (k?.t === 'num' && k.v === 2) return [unwrap(n.l), unwrap(n.l)];
  }
  return null;
}
function expandSlips(ctx) {
  const prevAst = astOf(ctx.previous);
  const line = polyOfText(ctx.line);
  if (!prevAst || !line) return null;
  const fs = twoBrackets(prevAst);
  if (!fs) return null;
  const pv = polyFromAst(prevAst);
  const v = pv && soleVariable(pv);
  if (!v) return null;
  const g1 = linearGroup(fs[0], v), g2 = linearGroup(fs[1], v);
  if (!g1 || !g2) return null;
  const { a, b } = g1, { a: c, b: d } = g2;
  const same = a === c && b === d;
  const X2 = polyVar(v, 2), X1 = polyVar(v, 1);
  const q = (x2, x1, k) => polyAdd(polyAdd(polyMul(polyConst(x2), X2), polyMul(polyConst(x1), X1)), polyConst(k));
  const written = same ? `${bracketText(g1, v)}²` : `${bracketText(g1, v)}${bracketText(g2, v)}`;
  if (same && polyEqual(line, q(a * a, 0, b * b))) {
    return {
      message: `${written} means ${bracketText(g1, v)} times itself, so it has four products, not two. Squaring each term misses the middle term, 2 × ${a === 1 ? '' : `${fmt(a)}`}${v} × ${fmt(b)}.`,
      messages: { hi: `${written} का अर्थ है ${bracketText(g1, v)} को स्वयं से गुणा करना, इसमें चार गुणनफल होते हैं, दो नहीं। हर पद का अलग वर्ग लेने से बीच का पद छूट जाता है: 2 × ${a === 1 ? '' : fmt(a)}${v} × ${fmt(b)}।` },
      code: 'power-of-sum'
    };
  }
  if (!same && polyEqual(line, q(a * c, 0, b * d))) {
    return {
      message: `You multiplied the first terms (${co(a)}${v} × ${co(c)}${v}) and the last terms (${fmt(b)} × ${fmt(d)}) only. Every term in ${bracketText(g1, v)} multiplies every term in ${bracketText(g2, v)}: that is four products, and the two middle ones are ${v} terms.`,
      messages: { hi: `आपने केवल पहले पदों (${co(a)}${v} × ${co(c)}${v}) और अंतिम पदों (${fmt(b)} × ${fmt(d)}) को गुणा किया। ${bracketText(g1, v)} का हर पद ${bracketText(g2, v)} के हर पद से गुणा होता है: चार गुणनफल, जिनमें बीच के दो ${v} वाले पद हैं।` },
      code: 'expand-first-and-last-only'
    };
  }
  if (!same && a === 1 && c === 1 && polyEqual(line, q(1, b + d, b + d))) {
    return {
      message: `The last term is the two numbers multiplied: ${fmt(b)} × ${fmt(d)}, not added (${fmt(b)} + ${fmt(d)}). The ${v} term is the sum of the two middle products, and it is not the last term.`,
      messages: { hi: `अंतिम पद दोनों संख्याओं का गुणनफल है: ${fmt(b)} × ${fmt(d)}, जोड़ ${fmt(b)} + ${fmt(d)} नहीं। ${v} वाला पद बीच के दो गुणनफलों का योग है।` },
      code: 'expand-last-term-added'
    };
  }
  if (d === -b && a === c && polyEqual(line, q(a * a, 0, b * b))) {
    return {
      message: `The last term is ${fmt(b)} × ${fmt(d)} = ${fmt(b * d)}: one bracket has a plus and the other a minus, so the product is negative, not positive.`,
      messages: { hi: `अंतिम पद ${fmt(b)} × ${fmt(d)} = ${fmt(b * d)} है: एक कोष्ठक में धन और दूसरे में ऋण चिह्न है, इसलिए गुणनफल ऋणात्मक है।` },
      code: 'expand-difference-of-squares-sign'
    };
  }
  if (d === -b && a === c && polyEqual(line, q(a * a, -2 * a * b, -b * b))) {
    return {
      message: `The two middle products, ${fmt(a * d)}${v} and ${fmt(b * c)}${v}, are opposites, so they cancel to 0${v}. They do not both count as the same sign.`,
      messages: { hi: `बीच के दो गुणनफल, ${fmt(a * d)}${v} और ${fmt(b * c)}${v}, विपरीत चिह्न के हैं, इसलिए कटकर 0${v} हो जाते हैं।` },
      code: 'expand-middle-terms-cancel'
    };
  }
  return null;
}

// ── One or two brackets with numbers in front ────────────────────────────────
function bracketTerms(prevAst) {
  const terms = sumTerms(prevAst);
  const out = [];
  let any = false;
  for (const t of terms) {
    const f = productFactors(t.node);
    const group = f.filter(x => x?.t === 'bin' && (x.op === '+' || x.op === '-'));
    const nums = f.filter(x => x?.t === 'num');
    if (group.length === 1 && nums.length === 1 && f.length === 2) { out.push({ kind: 'bracket', sign: t.sign, k: nums[0].v, node: group[0] }); any = true; }
    else out.push({ kind: 'plain', sign: t.sign, node: t.node });
  }
  return any ? out : null;
}
function bracketSlips(ctx) {
  const prevAst = astOf(ctx.previous);
  const line = polyOfText(ctx.line);
  if (!prevAst || !line) return null;
  const parts = bracketTerms(prevAst);
  if (!parts) return null;
  const pv = polyFromAst(prevAst);
  const v = pv && soleVariable(pv);
  if (!v) return null;
  const rows = parts.map(p => {
    if (p.kind === 'plain') { const poly = polyFromAst(p.node); return poly && { ...p, poly }; }
    const g = linearGroup(p.node, v);
    return g && { ...p, g };
  });
  if (rows.some(r => !r)) return null;
  const build = fn => rows.reduce((acc, r) => polyAdd(acc, fn(r)), polyConst(0));
  const lin = (a, b) => polyAdd(polyMul(polyConst(a), polyVar(v, 1)), polyConst(b));
  const brackets = rows.filter(r => r.kind === 'bracket');
  const first = brackets[0];
  // Only the first term of the bracket multiplied.
  if (polyEqual(line, build(r => (r.kind === 'plain' ? polyMul(polyConst(r.sign), r.poly) : polyMul(polyConst(r.sign), lin(r.k * r.g.a, r.g.b)))))) {
    return {
      message: `The ${fmt(first.k)} outside ${bracketText(first.g, v)} multiplies every term inside it, not only the first: ${fmt(first.k)} × ${fmt(first.g.b)} as well.`,
      messages: { hi: `${bracketText(first.g, v)} के बाहर का ${fmt(first.k)} कोष्ठक के अंदर के हर पद को गुणा करता है, केवल पहले को नहीं: ${fmt(first.k)} × ${fmt(first.g.b)} भी।` },
      code: 'distribute-partial'
    };
  }
  // A minus in front of the bracket treated as a plus.
  if (brackets.some(r => r.sign < 0) && polyEqual(line, build(r => (r.kind === 'plain' ? polyMul(polyConst(r.sign), r.poly) : polyMul(polyConst(r.kind === 'bracket' ? 1 : r.sign), lin(r.k * r.g.a, r.k * r.g.b)))))) {
    const neg = brackets.find(r => r.sign < 0);
    return {
      message: `The minus sign in front of ${fmt(neg.k)}${bracketText(neg.g, v)} belongs to the whole bracket: ${neg.sign < 0 ? '−' : ''}${fmt(neg.k)} multiplies ${fmt(neg.g.a)}${v} and ${fmt(neg.g.b)}, so every term in it changes sign.`,
      messages: { hi: `${fmt(neg.k)}${bracketText(neg.g, v)} के सामने का ऋण चिह्न पूरे कोष्ठक का है: −${fmt(neg.k)} से ${fmt(neg.g.a)}${v} और ${fmt(neg.g.b)} दोनों गुणा होते हैं।` },
      code: 'distribute-sign'
    };
  }
  return null;
}

// ── Factorising: multiply the student's brackets back out ────────────────────
function factorSlips(ctx) {
  const lineAst = astOf(ctx.line);
  const prev = polyOfExpression(String(ctx.previous ?? '').replace(/[−–—]/g, '-').split('=').pop());
  const now = polyOfText(ctx.line);
  if (!lineAst || !prev || !now) return null;
  const fs = productFactors(lineAst);
  const brackets = fs.filter(x => x?.t === 'bin' && (x.op === '+' || x.op === '-'));
  if (fs.length < 2 || !brackets.length) return null;
  const v = soleVariable(prev) || soleVariable(now);
  if (!v) return null;
  const written = String(ctx.line).replace(/[−–—]/g, '-').split('=').pop().trim().replace(/\*/g, '').replace(/\s*\+\s*-\s*/g, ' - ');
  const back = fmtPoly(now, v);
  // Only for a line above with no brackets of its own (a polynomial to factorise): on an
  // expand question the "question's expansion" would be the answer.
  if (/[()]/.test(String(ctx.previous ?? ''))) return null;
  const want = fmtPoly(prev, v);
  const twoLinear = fs.length === 2 && brackets.length === 2 && degreeIn(prev, v) === 2 && coeffOf(prev, v, 2) === 1;
  if (twoLinear) {
    const S = coeffOf(prev, v, 1), P = prev.get('')?.c || 0;
    return {
      message: `Multiply your brackets back out to check: ${written} gives ${back}, but the line above is ${want}. You need two numbers that multiply to ${fmt(P)} and add to ${fmt(S)}.`,
      messages: { hi: `जाँचने के लिए अपने कोष्ठकों को वापस गुणा करें: ${written} से ${back} मिलता है, पर ऊपर की पंक्ति ${want} है। आपको ऐसी दो संख्याएँ चाहिए जिनका गुणनफल ${fmt(P)} और योग ${fmt(S)} हो।` },
      code: 'factorise-fails-when-expanded'
    };
  }
  const k = fs.find(x => x?.t === 'num');
  return {
    message: `Multiply your answer back out to check: ${written} gives ${back}, but the line above is ${want}. ${k ? `After taking out ${fmt(k.v)}, the bracket must hold what is left when every term is divided by ${fmt(k.v)}.` : 'The bracket must hold what is left when every term is divided by the common factor.'}`,
    messages: { hi: `जाँचने के लिए अपने उत्तर को वापस गुणा करें: ${written} से ${back} मिलता है, पर ऊपर की पंक्ति ${want} है। साझा गुणनखंड निकालने के बाद कोष्ठक में हर पद को उस गुणनखंड से भाग देने पर जो बचे, वह होना चाहिए।` },
    code: 'factorise-fails-when-expanded'
  };
}

// ── Solving a linear equation ────────────────────────────────────────────────
function linearSlips(ctx) {
  const prevText = String(ctx.previous ?? '').replace(/[−–—]/g, '-');
  const lineText = String(ctx.line ?? '').replace(/[−–—]/g, '-');
  if ((prevText.match(/=/g) || []).length !== 1 || (lineText.match(/=/g) || []).length !== 1) return null;
  let L, R, lhs, rhs;
  try { [L, R] = prevText.split('=').map(s => polyFromAst(parse(normalize(s)))); [lhs, rhs] = lineText.split('=').map(s => polyFromAst(parse(normalize(s)))); } catch { return null; }
  if (!L || !R || !lhs || !rhs) return null;
  const v = soleVariable(polyAdd(L, R));
  if (!v) return null;
  // The line must be the unknown on its own: x = number.
  let got = null;
  if (polyEqual(lhs, polyVar(v, 1)) && degreeIn(rhs, v) === 0) got = rhs.get('')?.c || 0;
  else if (polyEqual(rhs, polyVar(v, 1)) && degreeIn(lhs, v) === 0) got = lhs.get('')?.c || 0;
  if (got === null) return null;
  // The line above: a·v + b = c with the unknown on one side only.
  let a, b, c;
  if (degreeIn(L, v) === 1 && degreeIn(R, v) === 0) { a = coeffOf(L, v, 1); b = L.get('')?.c || 0; c = R.get('')?.c || 0; }
  else if (degreeIn(R, v) === 1 && degreeIn(L, v) === 0) { a = coeffOf(R, v, 1); b = R.get('')?.c || 0; c = L.get('')?.c || 0; }
  else return null;
  if (!a) return null;
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  const eqn = `${a === 1 ? '' : a === -1 ? '−' : fmt(a)}${v}${b ? ` ${signed(b)}` : ''} = ${fmt(c)}`;
  if (b !== 0 && a !== 1) {
    if (near(got, c / a)) return {
      message: `The ${fmt(b)} was ignored: in ${eqn}, ${b > 0 ? 'subtract' : 'add'} ${fmt(Math.abs(b))} from both sides first, then divide by ${fmt(a)}.`,
      messages: { hi: `${fmt(b)} को छोड़ दिया गया: ${eqn} में पहले दोनों पक्षों में से ${fmt(Math.abs(b))} ${b > 0 ? 'घटाएँ' : 'जोड़ें'}, फिर ${fmt(a)} से भाग दें।` },
      code: 'solve-linear-constant-ignored'
    };
    if (near(got, c / a - b)) return {
      message: `Only the ${fmt(c)} was divided by ${fmt(a)}. Whatever is done to one side is done to every term: first take ${fmt(b)} from both sides, then divide the whole of that side by ${fmt(a)}.`,
      messages: { hi: `केवल ${fmt(c)} को ${fmt(a)} से भाग दिया गया। जो एक पक्ष पर किया जाए वह हर पद पर होता है: पहले दोनों पक्षों से ${fmt(b)} हटाएँ, फिर उस पूरे पक्ष को ${fmt(a)} से भाग दें।` },
      code: 'solve-linear-divided-one-term'
    };
    if (near(got, (c + b) / a)) return {
      message: `The ${fmt(b)} moved to the other side with the wrong sign: ${b > 0 ? `${fmt(b)} is added in ${eqn}, so subtract it` : `${fmt(-b)} is subtracted in ${eqn}, so add it`}.`,
      messages: { hi: `${fmt(b)} दूसरे पक्ष में गलत चिह्न के साथ गया: उलटी क्रिया करनी होती है।` },
      code: 'sign-on-transfer'
    };
  }
  if (b === 0 && a !== 1) {
    if (near(got, c - a)) return {
      message: `${fmt(a)}${v} means ${fmt(a)} times ${v}, so undo it by dividing by ${fmt(a)}, not by subtracting ${fmt(a)}.`,
      messages: { hi: `${fmt(a)}${v} का अर्थ ${fmt(a)} गुणा ${v} है, इसे ${fmt(a)} घटाकर नहीं, ${fmt(a)} से भाग देकर पलटें।` },
      code: 'solve-linear-subtracted-instead-of-divided'
    };
    if (near(got, c * a)) return {
      message: `${fmt(a)}${v} means ${fmt(a)} times ${v}, so undo it by dividing both sides by ${fmt(a)}, not by multiplying.`,
      messages: { hi: `${fmt(a)}${v} को पलटने के लिए दोनों पक्षों को ${fmt(a)} से भाग दें, गुणा नहीं।` },
      code: 'solve-linear-multiplied-instead-of-divided'
    };
  }
  if (a === 1 && b !== 0 && near(got, c + b)) return {
    message: `The ${fmt(b)} has to be undone, not repeated: ${b > 0 ? `subtract ${fmt(b)} from` : `add ${fmt(-b)} to`} both sides.`,
    messages: { hi: `${fmt(b)} को पलटना है, दोहराना नहीं: दोनों पक्षों पर उलटी क्रिया करें।` },
    code: 'sign-on-transfer'
  };
  return null;
}

const slip = (code, fn, misconceptionId = null) => ({ code, misconceptionId, detect: ctx => { resetPolyBudget(); if (sameAsPrevious(ctx)) return null; const r = fn(ctx); return r && r.code === code ? r : null; } });
const codes = ['power-of-sum', 'expand-first-and-last-only', 'expand-last-term-added', 'expand-difference-of-squares-sign', 'expand-middle-terms-cancel'];
registerTopic({
  topic: 'algebra',
  appliesTo: () => true,
  slips: [
    ...codes.map(c => slip(c, ctx => (isExpression(ctx.meta) ? expandSlips(ctx) : null), null)),
    ...['distribute-partial', 'distribute-sign'].map(c => slip(c, ctx => (isExpression(ctx.meta) ? bracketSlips(ctx) : null), null)),
    slip('factorise-fails-when-expanded', ctx => (isExpression(ctx.meta) ? factorSlips(ctx) : null)),
    ...['solve-linear-constant-ignored', 'solve-linear-divided-one-term', 'sign-on-transfer', 'solve-linear-subtracted-instead-of-divided', 'solve-linear-multiplied-instead-of-divided'].map(c => slip(c, ctx => (ctx.meta?.kind === 'equation' ? linearSlips(ctx) : null), null))
  ]
});
