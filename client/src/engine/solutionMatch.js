// Pri Learning — recognising a correct line from the question's own worked solution.
//
// A measured battery (30 exact questions, 145 lines of correct handwritten working, real reader) ticked only 46% of the
// true lines: restating the question, rearranging, a derivative or integral step, a substitution, a chain with π or √,
// a numeric continuation after a line no check could read. Every generated question carries its worked solution
// (`steps`, maths in `$…$`), and marking runs only AFTER the answer is submitted, so the solution is the evidence for
// what a correct line looks like.
//
// FEEDBACK ONLY. Run after every mark, `correct`, method mark, board tick and milestone is computed; nothing reads its
// result but the result card. It changes a line the report left a NOTE (never one it ticked or crossed), never at or
// after the report's first break, and it never produces a cross. The typed final answer is not read here: the worked
// solution and the prompt are used only to RECOGNISE a line, never to decide a mark.
//
// A line is ticked only by one of four rules, in this order:
//   a  restates the question: the same expression, or exactly the prompt's own equation (state "given")
//   b  an equation whose label and result agree with a step of the worked solution, or an equation that is the same
//      condition as a step equation (an exact rational multiple of it, proved at independent points and by the engine)
//   c  a continuation or bare number whose value is a value the solution reaches, in order (the same step as the last
//      matched line, or the next), and never a bare small number unless it continues a matched line or ends the page
//   d  a substitution (`x = 4: 6(16) + 8(4)`) whose value is the one the solution reaches
// Anything else stays exactly as it was.
import { texToPlain } from './texToPlain.js';
import { plainTex } from './checker.js';
import { evaluate, exprEquivalent, withEvaluationBudget } from './expr.js';
import { infoOf, cleanStatement, exactForm } from './arithmeticLines.js';
import { isWorkedSum } from './milestones.js';

const PAGE_BUDGET = 120000;
const MAX_LINES = 20;
const MAX_STATEMENTS = 80;
const WINDOW = 1;               // a value is matched at the last matched step or the next one
const TEX_SPAN = /\$([^$]+)\$/g;
const NOTE_STATES = new Set([undefined, 'unverified']);
const CLAIM = /\b(?:show|prove|verify|test|check|whether|disprove|explain|claim|claims|student writes|is it true|if possible|not an identity|justify|true or false|identity|error|mistake|correct)\b/i;

const tidy = s => String(s ?? '').replace(/[−–—]/g, '-').replace(/[′’`]/g, "'").replace(/[×·]/g, '*').replace(/÷/g, '/').trim();
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const closeLoose = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const SPLIT_EQ = /(?<![<>!])=(?!=)/;

// ── a label is a named quantity, not an expression ───────────────────────────
const LABEL = /^(Δ|θ|α|β|γ|φ|[A-Za-z]|[A-Z]{2})('{0,2})(_[A-Za-z0-9]+)?(?:\(([^()]{1,8})\))?$/;
const DERIV = /^d\^?2?[a-z]\/d[a-z]\^?2?$/;
function labelOf(side) {
  const t = tidy(side).replace(/\s+/g, '').replace(/[{}]/g, '');
  if (DERIV.test(t)) return { name: t, arg: null };
  const m = LABEL.exec(t);
  return m ? { name: m[1] + m[2] + (m[3] || ''), arg: m[4] ?? null } : null;
}
function argEqual(a, b) {
  if (a === b) return true;
  const x = infoOf(cleanStatement(a)), y = infoOf(cleanStatement(b));
  return !!(x && y && x.value !== undefined && y.value !== undefined && close(x.value, y.value));
}
const sameLabel = (a, b) => a.name === b.name && ((a.arg === null && b.arg === null) || (a.arg !== null && b.arg !== null && argEqual(a.arg, b.arg)));

// ── reading maths from the worked solution ───────────────────────────────────
function spanToPlain(span) {
  let t = String(span);
  for (let g = 0; g < 4 && !/\\int/.test(t) && /\^\s*\{[^{}]*\}/.test(t); g++) t = t.replace(/\^\s*\{([^{}]*)\}/g, '^($1)');
  t = t.replace(/_\{\\text\{([A-Za-z0-9]+)\}\}/g, '_$1').replace(/\\[dt]frac/g, '\\frac').replace(/\\(?:displaystyle|,|;|!|quad|qquad| )/g, ' ').replace(/\\prime/g, "'").replace(/\\Delta/g, 'Δ');
  // a rounded value is not a statement of equality: keep what comes before it
  t = t.replace(/\\(?:big|Big|bigg|Bigg)[lr]?/g, '').replace(/\\(arcsin|arccos|arctan|sin|cos|tan|sec|csc|cosec|cot|ln|log|exp)(?![A-Za-z])/g, '$1').replace(/\\theta/g, 'θ');
  t = t.split(/\\approx|\\simeq|\\Rightarrow|\\therefore|\\text|\\mathrm|\\mid/)[0];
  if (!t.trim()) return null;
  let p = null;
  try { p = texToPlain(t); } catch { p = null; }
  if (!p) { try { p = plainTex(t); } catch { p = null; } }
  if (!p || /[^\x20-\x7EΔπ√θ∫′’−–²³]/.test(p) || /\\/.test(p) || p.length > 200) return null;
  return p;
}
/** The rounded value a span ends with (`… \\approx 6.8`), as plain text, or null. */
function roundedTail(span) {
  const m = /\\approx|\\simeq/.exec(String(span));
  if (!m) return null;
  const tail = String(span).slice(m.index + m[0].length).split(/\\text|\\mathrm|\\,|\\ /)[0].trim().replace(/^\\\$/, '');
  const p = tail ? spanToPlain(tail) : null;
  return p && /^-?\d+(?:\.\d+)?$/.test(p) ? p : null;
}
function topLevelPieces(plain) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of plain) {
    if ('([{'.includes(c)) depth += 1; else if (')]}'.includes(c)) depth -= 1;
    if (depth === 0 && (c === ',' || c === ';')) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
// The limits of an evaluated bracket or an integral (`]_0^(2)`, `∫_0^2`) as number pairs: a line that evaluates a bracket between
// limits the question and its solution never use may happen to reach the same value (F(3) = F(0) = 0), but it is not that step.
const LIMIT_PAIR = /_\s*(\([^()]*\)|-?[A-Za-z0-9.π]+)\s*\^\s*(\([^()]*\)|-?[A-Za-z0-9.π]+)/g;
function limitKeys(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(LIMIT_PAIR)) {
    const key = x => { const v = numericOf(x); return v !== null ? String(Math.round(v * 1e9)) : canon(x); };
    out.push(`${key(m[1])}|${key(m[2])}`);
  }
  return out;
}
const sidesOf = piece => piece.split(SPLIT_EQ).map(x => x.trim());

/** Every statement of a text: [{ parts:[plain side, …] }] (one part = a bare expression). */
function statementsOfSpans(text) {
  const out = [];
  for (const m of String(text ?? '').replace(/\\\$/g, '\u0001').matchAll(TEX_SPAN)) {
    const plain = spanToPlain(m[1]);
    if (!plain) continue;
    for (const piece of topLevelPieces(plain)) {
      if (/[<>≤≥≠]/.test(piece)) continue;
      const parts = sidesOf(piece);
      if (parts.some(p => !p)) continue;
      out.push({ parts, plain: piece });
      if (out.length >= MAX_STATEMENTS) return out;
    }
  }
  return out;
}

const braces = s => s.replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{([^{}]*)\}/g, '_$1');
// A letter the question or its solution uses as a function name (f(x), S(n)): `f(x + 1)` there is an application, which the
// engine would read as the product f·(x + 1). A side that applies one is not read at all.
let FUNCS = new Set();
const DIFFERENTIAL = /(?<![A-Za-z])d[a-z]?\s*\)?\s*\/\s*\(?\s*d[a-z]\b/;
const readSide = side => {
  try {
    const t = braces(tidy(side));
    // a comma or semicolon list (a point, a vector, an interval) is never one number: it is compared component by component or not at all
    if (/[,;]/.test(t)) return null;
    // d/dx, dy/dx, ((d)/(dx)): an operator, not the letters d and x divided
    if (DIFFERENTIAL.test(t)) return null;
    // `f^(-1)(-2)` is the inverse applied to -2, not the product f^(-1)·(-2): a power sits between the name and its argument.
    for (const f of FUNCS) if (new RegExp(`(?<![A-Za-z])${f}(?:\\s*\\^\\s*(?:\\([^()]*\\)|-?\\d+))?'*\\s*\\(`).test(t)) return null;
    return infoOf(cleanStatement(t));
  } catch { return null; }
};
const numericOf = side => { const i = readSide(side); return i && i.value !== undefined ? i.value : null; };

// ── sampling: the same function of the same letters, at points of both signs ─
const varsKey = i => (i.vars || []).join();
function valAt(info, env) {
  if (info.value !== undefined) return info.value;
  try { const y = evaluate(info.ast, env); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; }
}
// Independent sample points for every letter (a different offset, stride and curvature each, both signs), so two letters never
// move along one line and a difference that is constant along it cannot pass as no difference at all.
const OFFSETS = [[0.61, 0.83, 0.071], [-1.07, 0.59, 0.113], [0.37, 1.13, -0.059]];
const SAMPLES = 9;
const envAt = (vars, j) => Object.fromEntries(vars.map((v, k) => { const [a, b, c] = OFFSETS[k % 3]; return [v, (j % 2 ? -1 : 1) * (a + b * j * (1 + 0.31 * k) + c * j * j * (k + 1))]; }));

/** The module's identity test: the same letters, the same value at points of both signs, exprEquivalent, no differing domains. */
function sameSide(a, b, rawA, rawB) {
  if (!a || !b) return false;
  if (varsKey(a) !== varsKey(b)) return false;
  if (a.value !== undefined && b.value !== undefined) return closeLoose(a.value, b.value);
  if (a.value !== undefined || b.value !== undefined) return false;   // a number and a function (sin²x + cos²x = 1) are not the same side
  let agreed = 0;
  for (let j = 0; j < SAMPLES; j++) {
    const env = envAt(a.vars, j);
    const p = valAt(a, env), q = valAt(b, env);
    if ((p === null) !== (q === null)) return false;
    if (p === null) continue;
    if (!closeLoose(p, q)) return false;
    agreed++;
  }
  if (agreed < 5) return false;
  try { return exprEquivalent(cleanStatement(tidy(rawA)), cleanStatement(tidy(rawB)), { isolatedDomain: true }) === true; } catch { return false; }
}

// ── an equation as a condition: f = left - right ─────────────────────────────
function conditionOf(parts) {
  if (parts.length !== 2) return null;
  const l = readSide(parts[0]), r = readSide(parts[1]);
  if (!l || !r) return null;
  const vars = [...new Set([...(l.vars || []), ...(r.vars || [])])].sort();
  if (!vars.length || vars.length > 3) return null;
  const clean = x => cleanStatement(braces(tidy(x)));
  return { l, r, vars, rawL: clean(parts[0]), rawR: clean(parts[1]), f: env => { const a = valAt(l, env), b = valAt(r, env); return a === null || b === null ? null : a - b; } };
}
/**
 * True when the two equations are the same condition: f = left - right is an exact rational multiple c of g everywhere. c is
 * fitted at one point and must be a small rational; f - c·g must then vanish at nine independent points to an absolute residual
 * scaled to the size of the individual terms (never of the totals), and the engine's own equivalence must agree. Not proved: no tick.
 */
function proportional(f, g) {
  if (f.vars.join() !== g.vars.join()) return false;
  let c = null, used = 0;
  for (let j = 0; j < SAMPLES; j++) {
    const env = envAt(f.vars, j);
    const a = f.f(env), b = g.f(env);
    if ((a === null) !== (b === null)) return false;
    if (a === null) continue;
    if (c === null) {
      if (Math.abs(b) < 1e-9) continue;
      const r = a / b;
      let fit = null;
      for (let d = 1; d <= 12 && fit === null; d++) { const n = Math.round(r * d); if (n !== 0 && Math.abs(r * d - n) < 1e-9 * Math.max(1, Math.abs(n))) fit = [n, d]; }
      if (!fit) return false;
      c = fit;
    }
    const k = c[0] / c[1];
    const terms = [valAt(f.l, env) ?? 0, valAt(f.r, env) ?? 0, valAt(g.l, env) ?? 0, valAt(g.r, env) ?? 0].map(Math.abs);
    const scale = terms[0] + terms[1] + Math.abs(k) * (terms[2] + terms[3]);
    if (Math.abs(a - k * b) > 1e-10 * scale + 1e-12) return false;
    // A point where one side of an equation is lost beside the other (16^(3x-6) beside 27^(3x+5)) tests only the large side: it proves nothing about the rest.
    if (terms.some(t => t !== 0 && t < 1e-6 * Math.max(...terms))) continue;
    used++;
  }
  if (used < 5 || c === null) return false;
  try { return exprEquivalent(`(${f.rawL})-(${f.rawR})`, `(${c[0]}/${c[1]})*((${g.rawL})-(${g.rawR}))`, { isolatedDomain: true }) === true; } catch { return false; }
}

// ── the worked solution, read once ───────────────────────────────────────────
function readSolution(q) {
  const steps = Array.isArray(q?.steps) ? q.steps : [];
  const labelled = [], conditions = [], values = [], numeric = [], verbatim = [], every = [], limits = new Set();
  for (const t of [String(q?.prompt ?? ''), ...steps.map(x => String(x?.d ?? ''))]) for (const m of t.replace(/\\\$/g, '\u0001').matchAll(TEX_SPAN)) { const pl = spanToPlain(m[1]); if (pl) for (const k of limitKeys(braces(pl))) limits.add(k); }
  steps.forEach((st, i) => {
    const heading = String(st?.h ?? '').trim();
    for (const m of String(st?.d ?? '').matchAll(TEX_SPAN)) { const r = roundedTail(m[1]); if (r !== null) values.push({ step: i, heading, v: Number(r), rounded: true }); }
    for (const s of statementsOfSpans(st?.d)) {
      s.parts.forEach(p => { const v = numericOf(p); if (v !== null) values.push({ step: i, heading, v }); });
      if (s.parts.length < 2) continue;
      // a statement with a side the engine cannot evaluate (`f^(-1)(-1)`) is recognised only as the very same text
      if (s.parts.some(p => readSide(p) === null)) verbatim.push({ step: i, heading, parts: s.parts });
      every.push({ step: i, heading, parts: s.parts });
      if (s.parts.length === 2 && s.parts.every(p => numericOf(p) !== null)) numeric.push({ step: i, heading, parts: s.parts });
      const lab = labelOf(s.parts[0]);
      const last = s.parts[s.parts.length - 1];
      if (lab) {
        // a one-letter label defined in terms of itself (i = 2i) is not a statement
        const rhs = readSide(last);
        if (rhs && !(/^[A-Za-z]$/.test(lab.name) && (rhs.vars || []).includes(lab.name))) labelled.push({ step: i, heading, label: lab, last, info: rhs });
      }
      const cond = conditionOf(s.parts.length === 2 ? s.parts : [s.parts[0], s.parts[s.parts.length - 1]]);
      if (cond && !lab) conditions.push({ step: i, heading, cond });
      else if (cond && lab && cond.vars.length >= 1 && (cond.l.vars || []).length === 0) { /* x = 25 is a label statement, not a condition */ }
    }
  });
  // A question with several solutions: a line true of only some of them is a step only when it is plainly a branch (see matchEquation).
  // Read from the worked steps ALONE (never an answer field): the solution states `x = a` and `x = b` for two different values of one letter.
  const stated = new Map();
  for (const l of labelled) {
    const v = l.info && (l.info.vars || []).length === 0 && Number.isFinite(l.info.value) ? l.info.value : null;
    if (v === null || l.label.arg !== null) continue;
    const set = stated.get(l.label.name) || new Set();
    set.add(Math.round(v * 1e9));
    stated.set(l.label.name, set);
  }
  const multiRoot = [...stated.values()].some(set => set.size > 1);
  return { steps, labelled, conditions, numeric, verbatim, every, limits, values, multiRoot, final: values.length ? values[values.length - 1] : null };
}

function readPrompt(q) {
  const prompt = typeof q?.prompt === 'string' && q.prompt.length < 2000 ? q.prompt : '';
  const claimed = CLAIM.test(prompt.replace(/\$[^$]*\$/g, ' '));
  const list = [];
  for (const s of statementsOfSpans(prompt)) {
    if (s.parts.length > 2 || (s.parts.length === 2 && claimed)) continue;
    list.push(s);
  }
  return list;
}

// a function applied to a bare argument that is then raised to a power: `ln e^3`, `sin x^2`, `cos 2^x`
const AMBIGUOUS_FUNCTION_POWER = /(?<![A-Za-z])(?:sin|cos|tan|sec|csc|cosec|cot|ln|log|exp)\s*[A-Za-z0-9]+\s*\^/;

// ── a student line ───────────────────────────────────────────────────────────
const FN_WORDS = /(?<![A-Za-z])(?:arcsin|arccos|arctan|cosec|sin|cos|tan|sec|csc|cot|ln|log|sqrt|exp|pi|e)(?![A-Za-z])/gi;
function readStudent(text) {
  let t = tidy(text);
  t = t.replace(/^(?:∴|so\b|hence\b|thus\b|therefore\b|ans(?:wer)?\b\.?:?)\s*/i, '').trim();
  if (!t || t.length > 160 || t.endsWith(':')) return null;
  if (/[^\x20-\x7E'Δ√π²³θ∫]/.test(t)) return null;
  if (/[<>;]|\bor\b|\band\b/i.test(t)) return null;
  if (t.includes(',')) {
    // `a = 21, d = 3, n = 25`: several equations on one line, each read alone (a comma inside a bracket is a point or a pair, not a break)
    const pieces = topLevelPieces(t);
    if (pieces.length < 2 || pieces.some(x => !x.includes('=') || x.startsWith('=') || x.includes(':'))) return null;
    const multi = pieces.map(x => x.split(SPLIT_EQ).map(y => y.trim()));
    if (multi.some(ps => ps.length < 2 || ps.some(y => !y))) return null;
    return { multi, parts: multi[0], ctx: null, continuation: false, raw: t };
  }
  const words = t.replace(/_\{?[A-Za-z0-9]+\}?/g, '').replace(FN_WORDS, '').replace(/\bd[xyt]\b/g, '').replace(/^[A-Z]{2}(?=\s*[(=])/, '');
  if (/[A-Za-z]{2,}/.test(words)) return null;
  let ctx = null, body = t;
  const colon = t.indexOf(':');
  if (colon > 0) {
    const m = /^([A-Za-z])\s*=\s*(.+)$/.exec(t.slice(0, colon).trim());
    const cv = m ? numericOf(m[2]) : null;
    if (!m || cv === null) return null;
    ctx = { name: m[1], value: cv, raw: m[2].trim() };
    body = t.slice(colon + 1).trim();
    if (!body) return null;
  }
  let continuation = false;
  if (body.startsWith('=') || body.startsWith('≈')) { continuation = true; body = body.slice(1).trim(); }
  if (!body) return null;
  const parts = body.split(SPLIT_EQ).map(x => x.trim());
  if (parts.some(p => !p)) return null;
  return { parts, ctx, continuation, raw: t };
}

// Restating the question is STRUCTURAL: the same tokens, differing only in spaces, bracket style, `*` and a unicode minus. Two
// things that merely evaluate alike (f^(-2)(0) and f^(-1)(0) when f is read as a product) are never the same statement.
const canon = s => tidy(s).replace(/\s+/g, '').replace(/[{}]/g, '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\^\(([^()]*)\)/g, '^$1').replace(/\*/g, '');
function sameAsPromptStatement(parts, prompt) {
  for (const s of prompt) {
    if (s.parts.length !== parts.length) continue;
    if (parts.every((p, k) => canon(p) === canon(s.parts[k]))) return true;
  }
  return false;
}

/** A step of the worked solution an equation (or chain) of the student matches: { step, heading } or null. */
function matchEquation(parts, sol, ctx) {
  // a limit pair the question and its solution never use: not a step of this working, whatever value it reaches
  if (!limitsKnown(parts, sol)) return null;
  // `ln e^3` is ln(e^3) or (ln e)^3: the engine reads one, so a value it reaches says nothing about the other. Such a line is the solution's own statement
  // (the same text) or it is not matched.
  if (parts.some(p => AMBIGUOUS_FUNCTION_POWER.test(p))) {
    for (const st of sol.every) if (st.parts.length === parts.length && parts.every((p, k) => canon(p) === canon(st.parts[k]))) return st;
    return null;
  }
  // The very same statement as one of the solution (canon: spaces, bracket style and `*` only), where a side cannot be evaluated.
  if (!ctx && parts.some(p => readSide(p) === null)) {
    for (const st of sol.verbatim) if (st.parts.length === parts.length && parts.every((p, k) => canon(p) === canon(st.parts[k]))) return st;
  }
  const lab = labelOf(parts[0]);
  if (lab) {
    const rest = parts.slice(1).map(readSide);
    if (rest.every(Boolean) && !(/^[A-Za-z]$/.test(lab.name) && rest.some(i => (i.vars || []).includes(lab.name)))) {
      for (const st of sol.labelled) {
        // a substitution fixes the argument: `x = 4: y' = …` is the statement about y'(4)
        const label = ctx && (lab.arg === null || lab.arg === ctx.name) ? { name: lab.name, arg: ctx.raw } : lab;
        if (!sameLabel(label, st.label)) continue;
        // worked-out working (`-((-4)^3 + …)`) is matched as the same working, never by the number it reaches
        if (rest.every((info, k) => sameSide(info, st.info, parts[k + 1], st.last) && (!isWorkedSum(parts[k + 1]) || canon(parts[k + 1]) === canon(st.last)))) return st;
      }
    }
  }
  if (parts.length === 2) {
    // (1.09)^19 = 5.142: a statement about numbers only, both sides as the solution has them
    const a = readSide(parts[0]), b = readSide(parts[1]);
    if (a && b && a.value !== undefined && b.value !== undefined) {
      for (const st of sol.numeric) {
        const x = readSide(st.parts[0]), y = readSide(st.parts[1]);
        if (x && y && closeLoose(a.value, x.value) && closeLoose(b.value, y.value)) return st;
      }
    }
  }
  if (!ctx && parts.length === 2) {
    const cond = conditionOf(parts);
    // Where the question has several solutions, an equation that is only "the same condition" as one factor (x - 5 = 1 beside x - 6 = 0)
    // is true of one root and says nothing about the working: it is a branch only as a factor set equal to zero, either way round, or
    // a value (x = 6). Such a line stays a note.
    const plainBranch = !sol.multiRoot || parts.some(p => numericOf(p) === 0) || (/^[A-Za-z]$/.test(tidy(parts[0])) && numericOf(parts[1]) !== null) || (/^[A-Za-z]$/.test(tidy(parts[1])) && numericOf(parts[0]) !== null);
    if (cond && plainBranch) {
      for (const st of sol.conditions) {
        if (proportional(cond, st.cond)) return st;
      }
    }
  }
  return null;
}

// ── notes ────────────────────────────────────────────────────────────────────
export const NOTE_GIVEN = 'This restates the question.';
export const noteStep = (st) => `Matches step ${st.step + 1} of the worked solution${st.heading ? ` (${st.heading.replace(/\.$/, '')})` : ''}.`;
export const noteValue = (m, v) => `This is the value at step ${m.step + 1} of the worked solution: $${exactForm(v).tex}$.`;

/**
 * Tick the lines of `report` that are still notes and that the worked solution recognises. Returns
 * { report, matched } (report unchanged and matched 0 when nothing is recognised). `report.lines[i].text` is the
 * student's line i. Pure, deterministic, inside one evaluation budget.
 */
export function solutionMatch(q, report) {
  if (!q || !report || !Array.isArray(report.lines) || !report.lines.length) return { report, matched: 0 };
  try { return withEvaluationBudget(PAGE_BUDGET, () => run(q, report)); } catch { return { report, matched: 0 }; }
}

function functionNames(q) {
  const out = new Set();
  const texts = [String(q?.prompt ?? ''), ...(Array.isArray(q?.steps) ? q.steps.map(x => String(x?.d ?? '')) : [])];
  for (const t of texts) for (const m of t.matchAll(/(?<![A-Za-z\\])([A-Za-z])\s*(?:'|\\prime)*\s*\(\s*[A-Za-z0-9\\.,+\- ]{1,12}\)\s*=/g)) out.add(m[1]);
  return out;
}

/** Every `name = value` the question or its worked solution states: the substitutions a line `name = value: …` may follow. */
function knownSubstitutions(q) {
  const out = new Set();
  const texts = [String(q?.prompt ?? ''), ...(Array.isArray(q?.steps) ? q.steps.map(x => String(x?.d ?? '')) : [])];
  for (const t of texts) for (const st of statementsOfSpans(t)) {
    if (st.parts.length !== 2 || !/^[A-Za-z]$/.test(st.parts[0].trim())) continue;
    const v = numericOf(st.parts[1]);
    if (v !== null) out.add(`${st.parts[0].trim()}|${v}`);
  }
  return out;
}

function run(q, report) {
  FUNCS = functionNames(q);
  const lines = report.lines.slice(0, MAX_LINES);
  const sol = readSolution(q);
  const prompt = readPrompt(q);
  let stop = Number.isInteger(report.firstBreak) && report.firstBreak >= 0 ? report.firstBreak : Infinity;
  const brk = lines.findIndex(l => l?.status === 'break');
  if (brk >= 0) stop = Math.min(stop, brk);
  const out = report.lines.slice();
  const matched = new Set();     // lines recognised by the solution (ticked here, or already ticked and recognised)
  let cur = -1, matchedCount = 0, prevLabel = null, prevAbove = null;
  const lastIdx = lines.length - 1;

  for (let i = 0; i < lines.length && i < stop; i++) {
    const l = lines[i];
    if (!l || typeof l.text !== 'string') continue;
    const judged = l.status === 'ok';
    const unjudged = l.status === 'note' && NOTE_STATES.has(l.state) && l.note !== 'Follows from the earlier slip.' && !/misread/i.test(String(l.note ?? '')) && l.unreadable !== true;
    if (!judged && !unjudged) continue;
    const s = readStudent(l.text);
    // what the line above says, for a continuation `= …` under it
    const carried = prevLabel, above = prevAbove;
    prevLabel = s && !s.multi && !s.ctx && (s.continuation ? carried : (s.parts.length >= 2 && labelOf(s.parts[0]) ? { raw: s.parts[0] } : null));
    prevAbove = { value: s && !s.multi ? numericOf(s.parts[s.parts.length - 1]) : null, hit: s && s.continuation && above ? above.hit : null };
    if (!s) continue;
    let tick = null;
    let hit = null;

    // a · the question restated
    if (unjudged && !s.ctx && !s.continuation && !s.multi && s.parts.length <= 2) {
      const flat = s.parts.join('');
      if (flat.length >= 3 && !/^[-+]?\d+(?:\.\d+)?$/.test(flat) && /[A-Za-z]|[+\-*/^]/.test(flat) && sameAsPromptStatement(s.parts, prompt)) tick = { state: 'given', note: NOTE_GIVEN };
    }
    // b · an equation of the worked solution
    // `= 1300 × 46.018` under `FV = …`: the line above's label, when the line above was recognised
    if (!tick && s.continuation && !s.ctx && s.parts.length === 1 && carried && matched.has(i - 1) && numericOf(s.parts[0]) === null) {
      const h = matchEquation([carried.raw, s.parts[0]], sol, null);
      // the same statement the line above matched, so the two are one chain
      if (h && above && above.hit && above.hit.step === h.step) { tick = { state: 'verified', note: noteStep(h), step: h.step, heading: h.heading }; hit = h; }
    }
    if (!tick && s.multi) {
      // several statements on one line: the line is ticked only when EVERY one qualifies (restates the question, or matches a step)
      // statements that give one name two different values contradict each other: the line is not ticked
      const seen = new Map();
      let clash = false;
      for (const ps of s.multi) { const key = canon(ps[0]), v = ps.slice(1).map(x => numericOf(x) ?? canon(x)).join('|'); const was = seen.get(key); if (was !== undefined && was !== v) clash = true; seen.set(key, v); }
      const each = clash ? [{ hit: null, given: false }] : s.multi.map(ps => ({ hit: matchEquation(ps, sol, null), given: unjudged && sameAsPromptStatement(ps, prompt) }));
      if (each.every(x => x.hit || x.given)) {
        const first = each.find(x => x.hit);
        if (first) hit = first.hit; else tick = { state: 'given', note: NOTE_GIVEN };
      }
    } else if (!tick && s.parts.length >= 2 && !s.continuation && !s.ctx) hit = matchEquation(s.parts, sol, s.ctx);   // a substitution line is judged structurally by engine/lineChains.js
    if (hit) { tick = tick || { state: 'verified', note: noteStep(hit), step: hit.step, heading: hit.heading }; prevAbove.hit = hit; }
    // c / d · a value the solution reaches, in order
    // a substitution `name = a:` counts only where the question or its solution substitutes that name at that value
    if (!tick && !s.multi && !s.ctx) {   // a line `name = a: …` is judged structurally by engine/lineChains.js
      const nums = s.parts.map(numericOf);
      const value = nums.every(v => v !== null) && nums.every(v => close(v, nums[0])) ? nums[0] : null;
      // a numeric continuation must agree with the line above (ln1 = 0, then `= 1`, is not one chain)
      const consistent = !s.continuation || (above && above.value !== null && close(above.value, value));
      if (value !== null && consistent) {
        // a bare small number counts only as the continuation of a line the solution recognised (`= 12` under it)
        const bareSmall = s.parts.length === 1 && /^-?\d+(?:\.\d+)?$/.test(s.parts[0]) && (Math.abs(value) <= 12 || /^-?\d$/.test(s.parts[0]));
        const prevOk = i > 0 && out[i - 1]?.status === 'ok';
        const isFinal = i === lastIdx && sol.final && close(sol.final.v, value);
        let m = null;
        if (cur >= 0) m = sol.values.find(x => close(x.v, value) && x.step >= cur && x.step <= cur + WINDOW) || null;
        // (in order, never anywhere: the step must be the one the last recognised line reached, or the next)
        if (m && (!s.continuation || prevOk) && (!bareSmall || (s.continuation && matched.has(i - 1)) || (isFinal && m.step === sol.final.step))) tick = { state: 'verified', note: noteValue(m, value), step: m.step, valueOnly: true, tex: exactForm(value).tex };
      }
    }
    if (!tick) continue;
    if (judged) {
      // already ticked by another check: it only fixes the order of the page
      if (Number.isInteger(tick.step)) { matched.add(i); cur = Math.max(cur, tick.step); }
      continue;
    }
    matched.add(i);
    if (Number.isInteger(tick.step)) cur = Math.max(cur, tick.step);
    matchedCount++;
    out[i] = { text: l.text, status: 'ok', state: tick.state, note: tick.note, solutionMatch: true, ...(Number.isInteger(tick.step)
      // A value-only tick (the line's value coincides with a value at that step; no statement matched) is marked as such:
      // it is never said to BE that step, only to come to that step's value. A statement match carries the step's heading.
      ? { fact: tick.valueOnly ? { kind: 'solution-step', step: tick.step + 1, valueOnly: true, tex: tick.tex } : { kind: 'solution-step', step: tick.step + 1, heading: typeof tick.heading === 'string' ? tick.heading : null } } : {}) };
  }
  if (!matchedCount) return { report, matched: 0, step: cur };
  const stated = out.map(l => ({ ...l, state: l.state || (l.status === 'ok' ? 'verified' : l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified') }));
  const at = st => stated.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  // A page that mixes true-as-written ticks with ticks the worked solution recognises is no longer "an arithmetic report":
  // each line carries its own state, so the card says which lines are which (attemptEvidence, annotatedWorkingModel).
  const { arithmetic: _arithmetic, ...rest } = report;
  return {
    matched: matchedCount, step: cur,
    report: {
      ...rest, lines: stated, source: 'value-chain', solutionMatched: true,
      summary: {
        ...(report.summary || {}), total: stated.length, checked: stated.filter(l => l.status === 'ok').length,
        given: at('given'), verified: at('verified'), arithmetic: at('arithmetic'), conditions: at('condition'), wrong: at('wrong'), unverified, unread,
        reason: unverified.length ? (report.summary?.reason || 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.') : null
      }
    }
  };
}
export const _setFunctionsUnused = q => { FUNCS = functionNames(q); };
/** True when every limit pair written in `parts` is one the question or its solution uses (a line with no limits is true of this). */
const limitsKnown = (parts, sol) => !parts.some(p => limitKeys(braces(tidy(p))).some(k => !sol.limits.has(k)));
export const _internals = { limitsKnown, readSolution, readStudent, matchEquation, spanToPlain, conditionOf, readSide, sameSidePublic: sameSide };
// For engine/lineChains.js (the pass that runs after this one).
export const _forChains = { knownSubstitutions, statementsOfSpans, numericOf, canon, labelOf, topLevelPieces, sameLabel, setFunctions: q => { FUNCS = functionNames(q); } };
