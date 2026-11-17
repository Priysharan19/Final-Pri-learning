// Pri Learning · smart feedback · polynomial working lines (smart-feedback blitz, after #943).
//
// Names a broken line of polynomial working by comparing it with the line above it, never with the answer:
// the two lines are expanded to coefficient lists (sampled by the engine, exact to 1e-6) and the one structural
// difference that separates them is described in the student's own terms. The step checker has already decided
// the line is a break; nothing here changes a status, a mark or a first-break index, and no message states the
// answer. Covers the working in Extension 1 polynomials (factor theorem), induction and the nature of proof,
// and any other single-variable polynomial lines that break without another diagnosis.
//
// Notes links point at the NSW chapters (Extension 1 Polynomials me1-11-02, Proof by induction me1-12-01,
// The nature of proof me2-12-01, Algebraic techniques ma5-alg-c-01): section "mistakes".
import { registerTopic } from './registry.js';
import { parse, normalize, evaluate, variablesOf } from '../../expr.js';

const MAX_DEGREE = 6;
const SAMPLES = Array.from({ length: MAX_DEGREE + 1 }, (_, i) => i);
const CHECKS = [-1, 7, 0.5];
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** The right-hand side of a line like "= 4n^3 - 4n" or "y = 4n^3 - 4n", or the line itself. */
function bodyOf(text) {
  const s = String(text ?? '').trim();
  const parts = s.split('=');
  return parts.length === 1 ? s : parts[parts.length - 1].trim() || null;
}

/** { variable, coeffs[0..d] } for a single-variable polynomial line, else null. */
export function polynomialOf(text) {
  const body = bodyOf(text);
  if (!body || /[?\\]/.test(body)) return null;
  let ast;
  try { ast = parse(normalize(body)); } catch { return null; }
  const vars = [...variablesOf(ast)];
  if (vars.length !== 1) return null;
  const v = vars[0];
  const f = x => { const y = evaluate(ast, { [v]: x }); return typeof y === 'number' && Number.isFinite(y) ? y : NaN; };
  const ys = SAMPLES.map(f);
  if (ys.some(Number.isNaN)) return null;
  // Newton forward differences at 0..n give the coefficients in the binomial basis; convert to monomials.
  const n = SAMPLES.length;
  const diffs = [ys.slice()];
  for (let k = 1; k < n; k++) diffs.push(diffs[k - 1].slice(1).map((y, i) => y - diffs[k - 1][i]));
  let coeffs = new Array(n).fill(0);
  let basis = [1];                                   // x(x-1)...(x-k+1)
  for (let k = 0; k < n; k++) {
    const c = diffs[k][0] / [...Array(k).keys()].reduce((a, i) => a * (i + 1), 1);
    basis.forEach((b, i) => { coeffs[i] += c * b; });
    const next = new Array(basis.length + 1).fill(0);   // multiply basis by (x - k)
    basis.forEach((b, i) => { next[i + 1] += b; next[i] -= k * b; });
    basis = next;
  }
  coeffs = coeffs.map(c => (Math.abs(c) < 1e-9 ? 0 : c));
  const at = x => coeffs.reduce((acc, c, i) => acc + c * x ** i, 0);
  if (!CHECKS.every(x => near(at(x), f(x)))) return null;
  return { variable: v, coeffs };
}

const termName = (v, j) => (j === 0 ? 'constant term' : j === 1 ? `term in ${v}` : `term in ${v}^${j}`);
const termHi = (v, j) => (j === 0 ? 'अचर पद' : j === 1 ? `${v} वाला पद` : `${v}^${j} वाला पद`);
const NOTES = { sign: 'me1-11-02#mistakes', other: 'ma5-alg-c-01#mistakes' };
const SECTION = meta => (meta?.kind === 'equation' ? 'me1-11-02#mistakes' : null);

/** How the line differs from the one above: { degree, from, to } when exactly one coefficient differs. */
function singleDifference(line, previous) {
  const a = polynomialOf(previous); const b = polynomialOf(line);
  if (!a || !b || a.variable !== b.variable) return null;
  const diffs = [];
  for (let j = 0; j < Math.max(a.coeffs.length, b.coeffs.length); j++) {
    const x = a.coeffs[j] ?? 0, y = b.coeffs[j] ?? 0;
    if (!near(x, y)) diffs.push({ degree: j, from: x, to: y });
  }
  return diffs.length === 1 ? { variable: a.variable, ...diffs[0] } : null;
}

const fix = n => String(Math.round(n * 1e6) / 1e6);

registerTopic({
  topic: 'polynomial-lines',
  appliesTo: meta => meta?.kind === 'expression' || meta?.kind === 'equation',
  slips: [
    {
      code: 'poly-term-sign', misconceptionId: 'sign-flipped',
      detect: ({ line, previous }) => {
        const d = previous != null ? singleDifference(line, previous) : null;
        if (!d || d.from === 0 || !near(d.to, -d.from)) return null;
        const t = termName(d.variable, d.degree);
        return {
          message: `Your ${t} has the opposite sign to the same ${t} in the line above, and nothing else changed. Check the sign where it came from: a bracket, or a term moved across.`,
          messages: {
            hi: `आपके ${termHi(d.variable, d.degree)} का चिह्न ऊपर वाली पंक्ति के उसी पद से उलटा है, और कुछ और नहीं बदला। देखिए कि चिह्न कहाँ से आया: कोष्ठक से, या पद इधर-उधर करने से।`,
            'en-AU': `Your ${t} has the opposite sign to the same ${t} in the line above, and nothing else changed. Check the sign where it came from: a bracket, or a term moved across.`
          },
          notesSectionId: 'ma5-alg-c-01#mistakes'
        };
      }
    },
    {
      code: 'poly-term-missing', misconceptionId: 'term-dropped',
      detect: ({ line, previous }) => {
        const d = previous != null ? singleDifference(line, previous) : null;
        if (!d || d.from === 0 || d.to !== 0) return null;
        const t = termName(d.variable, d.degree);
        return {
          message: `The line above has a ${t} and your line has none. Terms are not allowed to disappear: check whether a cross term or a product was left out.`,
          messages: {
            hi: `ऊपर वाली पंक्ति में ${termHi(d.variable, d.degree)} है और आपकी पंक्ति में नहीं है। पद ऐसे ही गायब नहीं होते: देखिए कि कहीं कोई क्रॉस पद या गुणनफल छूट तो नहीं गया।`,
            'en-AU': `The line above has a ${t} and your line has none. Terms are not allowed to disappear: check whether a cross term or a product was left out.`
          },
          notesSectionId: 'me2-12-01#mistakes'
        };
      }
    },
    {
      code: 'poly-constant-off',
      detect: ({ line, previous }) => {
        const d = previous != null ? singleDifference(line, previous) : null;
        if (!d || d.degree !== 0 || d.from === 0 || d.to === 0) return null;
        return {
          message: `Only the constant term changed between the line above and yours, so it is out by ${fix(Math.abs(d.to - d.from))}. Recheck the constants: the amount left over when a common factor is taken out folds into the bracket.`,
          messages: {
            hi: `ऊपर वाली पंक्ति और आपकी पंक्ति में केवल अचर पद बदला है, इसलिए वह ${fix(Math.abs(d.to - d.from))} से ग़लत है। अचरों को दोबारा जाँचिए: उभयनिष्ठ गुणनखंड निकालने पर बचा हुआ भाग कोष्ठक में जुड़ जाता है।`,
            'en-AU': `Only the constant term changed between the line above and yours, so it is out by ${fix(Math.abs(d.to - d.from))}. Recheck the constants: the amount left over when a common factor is taken out folds into the bracket.`
          },
          notesSectionId: 'me1-12-01#mistakes'
        };
      }
    },
    {
      code: 'poly-coefficient-off',
      detect: ({ line, previous }) => {
        const d = previous != null ? singleDifference(line, previous) : null;
        if (!d || d.degree === 0 || d.from === 0 || d.to === 0 || near(d.to, -d.from)) return null;
        const t = termName(d.variable, d.degree);
        return {
          message: `Your ${t} has coefficient ${fix(d.to)}, but the line above gives ${fix(d.from)}, and every other term agrees. Recompute that one coefficient.`,
          messages: {
            hi: `आपके ${termHi(d.variable, d.degree)} का गुणांक ${fix(d.to)} है, पर ऊपर वाली पंक्ति में ${fix(d.from)} है, जबकि बाकी सभी पद मेल खाते हैं। उसी एक गुणांक को दोबारा निकालिए।`,
            'en-AU': `Your ${t} has coefficient ${fix(d.to)}, but the line above gives ${fix(d.from)}, and every other term agrees. Recompute that one coefficient.`
          },
          notesSectionId: 'ma5-alg-c-01#mistakes'
        };
      }
    },
    {
      code: 'poly-scaled',
      detect: ({ line, previous }) => {
        const a = previous != null ? polynomialOf(previous) : null; const b = polynomialOf(line);
        if (!a || !b || a.variable !== b.variable) return null;
        let m = null;
        for (let j = 0; j < Math.max(a.coeffs.length, b.coeffs.length); j++) {
          const x = a.coeffs[j] ?? 0, y = b.coeffs[j] ?? 0;
          if (x === 0 && y === 0) continue;
          if (x === 0 || y === 0) return null;
          const r = y / x;
          if (m === null) m = r; else if (!near(m, r)) return null;
        }
        if (m === null || near(m, 1)) return null;
        return {
          message: `Every term in your line is ${fix(m)} times the matching term in the line above. A constant factor was gained or lost on the way: check what you took out or multiplied by.`,
          messages: {
            hi: `आपकी पंक्ति का हर पद ऊपर वाली पंक्ति के संगत पद का ${fix(m)} गुना है। रास्ते में कोई अचर गुणनखंड जुड़ गया या छूट गया: देखिए कि आपने क्या निकाला या किससे गुणा किया।`,
            'en-AU': `Every term in your line is ${fix(m)} times the matching term in the line above. A constant factor was gained or lost on the way: check what you took out or multiplied by.`
          },
          notesSectionId: 'me2-12-01#mistakes'
        };
      }
    },
    {
      // (n + c)^e written from an expansion whose constant term is c itself: the root of the constant was not taken.
      code: 'binomial-power-constant',
      detect: ({ line, previous }) => {
        const m = String(line ?? '').replace(/\s+/g, '').match(/^(?:[a-zA-Z]*=)?\(([a-zA-Z])([+-])(\d+(?:\.\d+)?)\)\^\(?(\d)\)?$/);
        const a = previous != null ? polynomialOf(previous) : null;
        if (!m || !a || a.variable !== m[1]) return null;
        const e = Number(m[4]), c = Number(m[3]) * (m[2] === '-' ? -1 : 1);
        if (!(e === 2 || e === 3) || a.coeffs.length < 1 || !near(a.coeffs[0], c) || near(c ** e, c)) return null;
        const shown = fix(c ** e);
        return {
          message: `In (${m[1]} ${m[2]} ${m[3]})^${e} the constant term of the expansion is ${m[3]}^${e}, which is ${shown} and not ${fix(a.coeffs[0])}. The number inside the bracket is the ${e === 2 ? 'square' : 'cube'} root of the constant term of the line above.`,
          messages: {
            hi: `(${m[1]} ${m[2]} ${m[3]})^${e} के प्रसार का अचर पद ${m[3]}^${e} होता है, जो ${shown} है, ${fix(a.coeffs[0])} नहीं। कोष्ठक के भीतर की संख्या ऊपर वाली पंक्ति के अचर पद का ${e === 2 ? 'वर्गमूल' : 'घनमूल'} होती है।`,
            'en-AU': `In (${m[1]} ${m[2]} ${m[3]})^${e} the constant term of the expansion is ${m[3]}^${e}, which is ${shown} and not ${fix(a.coeffs[0])}. The number inside the bracket is the ${e === 2 ? 'square' : 'cube'} root of the constant term of the line above.`
          },
          notesSectionId: 'me2-12-01#mistakes'
        };
      }
    },
    // The first line of a working with nothing above it: compared with the form the check holds, but only ever
    // described by which term is out and how, never by a number the answer would give away.
    ...[
      ['poly-final-term-sign', 'sign-flipped', 'sign', d => `A term in your line has the wrong sign: it is the ${termName(d.variable, d.degree)}. Check the sign where it came from.`, d => `आपकी पंक्ति के एक पद का चिह्न ग़लत है: वह ${termHi(d.variable, d.degree)} है। देखिए कि चिह्न कहाँ से आया।`],
      ['poly-final-term-missing', 'term-dropped', 'missing', d => `Your line has no ${termName(d.variable, d.degree)}, and it should have one. Check whether a cross term or a product was left out.`, d => `आपकी पंक्ति में ${termHi(d.variable, d.degree)} नहीं है, जबकि होना चाहिए। देखिए कि कहीं कोई क्रॉस पद या गुणनफल छूट तो नहीं गया।`],
      ['poly-final-constant', null, 'constant', () => 'Your constant term is not right. Recheck the constants: the amount left over when a common factor is taken out folds into the bracket.', () => 'आपका अचर पद सही नहीं है। अचरों को दोबारा जाँचिए: उभयनिष्ठ गुणनखंड निकालने पर बचा हुआ भाग कोष्ठक में जुड़ जाता है।'],
      ['poly-final-coefficient', null, 'coefficient', d => `The coefficient of your ${termName(d.variable, d.degree)} is not right and every other term is. Recompute that one coefficient.`, d => `आपके ${termHi(d.variable, d.degree)} का गुणांक सही नहीं है, जबकि बाकी सभी पद सही हैं। उसी एक गुणांक को दोबारा निकालिए।`]
    ].map(([code, misconceptionId, kind, en, hi]) => ({
      code, ...(misconceptionId ? { misconceptionId } : {}),
      detect: ({ line, previous, meta }) => {
        if (meta?.kind !== 'expression' || typeof meta.canonical !== 'string') return null;
        if (previous != null && polynomialOf(previous)) return null;          // a line above exists: the slips above handle it
        const d = singleDifference(line, meta.canonical);
        if (!d) return null;
        const got = d.to, want = d.from;                                      // from = the held form, to = the student's line
        const type = want !== 0 && near(got, -want) ? 'sign' : want !== 0 && got === 0 ? 'missing' : d.degree === 0 ? 'constant' : 'coefficient';
        if (type !== kind) return null;
        const msg = en(d);
        return { message: msg, messages: { hi: hi(d), 'en-AU': msg }, notesSectionId: kind === 'missing' ? 'me2-12-01#mistakes' : kind === 'constant' ? 'me1-12-01#mistakes' : 'ma5-alg-c-01#mistakes' };
      }
    })),
    {
      // An equation for one unknown whose solution the check holds: the line gives the opposite sign.
      code: 'solution-sign-flipped', misconceptionId: 'sign-flipped',
      detect: ({ line, meta }) => {
        if (meta?.kind !== 'equation' || !Array.isArray(meta.solutions) || meta.solutions.length !== 1) return null;
        const s = meta.solutions[0];
        const m = String(line ?? '').match(/^\s*([a-zA-Z])\s*=\s*(.+?)\s*$/);
        if (!m || m[1] !== meta.variable || s === 0) return null;
        let c; try { c = evaluate(parse(normalize(m[2])), {}); } catch { return null; }
        if (typeof c !== 'number' || !near(c, -s)) return null;
        return {
          message: `You have ${m[1]} = ${fix(c)}. Check the sign when you isolate ${m[1]}: put your value back into the original and see whether the remainder really is zero.`,
          messages: {
            hi: `आपने ${m[1]} = ${fix(c)} लिखा है। ${m[1]} को अकेला करते समय चिह्न जाँचिए: अपना मान मूल व्यंजक में वापस रखकर देखिए कि शेषफल सचमुच शून्य आता है या नहीं।`,
            'en-AU': `You have ${m[1]} = ${fix(c)}. Check the sign when you isolate ${m[1]}: put your value back into the original and see whether the remainder really is zero.`
          },
          notesSectionId: NOTES.sign
        };
      }
    }
  ]
});
