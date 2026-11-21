// Pri Learning — the lines the first passes leave: chains, integrals, vectors, a value the worked solution reaches, and a warning for a slip.
//
// Runs LAST, after the topic Step Check, the marks, the true-as-written fold and solutionMatch.js (so after every mark, `correct`,
// method mark, board tick and milestone is computed; nothing reads its result but the result card). Two jobs, both feedback only:
//
//   1  TICK a line still left a note, only by one of these rules (never a cross, never at or after the report's first break):
//      a  restates the question or copies a statement of the worked solution (`sinθ = -1/2`, `S = P + QR`), read structurally
//      b  an integral the question or the solution states, with the same limits and the same integrand (`∫_0^2(3x^2 - 2x)dx`)
//      c  `[F]_0^b = 144` with the bracket worked out at its limits, then matched like any equation of the solution
//      d  a derivative label (`d′ = …` for the solution's dd/dt), a discriminant label (`Δ = …`), `P(1) = 0: …` for a stated condition
//      e  a value the worked solution reaches, in order (a substitution, `hyp = √(8^2 + 15^2)`, a first expression of the first step)
//      f  a rounding of the line above to the places the solution gives (`= 6.8`)
//      g  a continuation `= …` that equals the line above: the same function of the same letters (identity, proved by sampling at points
//         of both signs and by the engine), or the same number when the line above has no letters (even if its label was not judged)
//      h  vectors: points and vectors the question gives, a vector between two points, a sum of vectors, each COMPUTED from the
//         numbers the question gives (never the typed answer), a chain of equal vectors, a statement of the solution
//   2  WARN (a note, never a cross, never a mark): a continuation `= expr` or `label = expr` of the same label with letters that is provably
//      NOT equal to the line above (see slipWarning). It is used to tick nothing below it.
import { _forChains as FC, _internals as SM, noteStep, noteValue, NOTE_GIVEN } from './solutionMatch.js';
import { infoOf, cleanStatement, exactForm } from './arithmeticLines.js';
import { evaluate, parse, normalize, withEvaluationBudget } from './expr.js';

const BUDGET = 120000;
const MAX_LINES = 20;
const NOTE_STATES = new Set([undefined, 'unverified']);
const CLAIM = /\b(?:show|prove|verify|test|check|whether|disprove|explain|claim|claims|student writes|is it true|if possible|not an identity|justify|true or false|identity|error|mistake|correct)\b/i;
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const tidy = s => String(s ?? '').replace(/[−–—]/g, '-').replace(/[′’`]/g, "'").replace(/[×·]/g, '*').replace(/÷/g, '/').trim();
const stepOf = l => { const m = /\bstep (\d+)\b/i.exec(String(l?.note ?? '')); return m ? Number(m[1]) - 1 : null; };

// ── reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Degrees are read as radians on both sides: 210° is 210·π/180 (the solution's `210^\circ` and the student's `210°`). */
const texPre = t => String(t ?? '').replace(/\^\s*\{?\s*\\circ\s*\}?/g, '\\times\\frac{\\pi}{180}').replace(/(\d)\s*°/g, '$1\\times\\frac{\\pi}{180}');
const studentPre = t => String(t ?? '').replace(/(\d(?:\.\d+)?)\s*°/g, '$1*π/180').replace(/(\d|\)|!)\s+x\s+(?=\d|\()/gi, '$1*');
const FN_NAME = /^(?:sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt|pi|arcsin|arccos|arctan)$/i;

/** A function's bare argument bracketed, a bracketed lone number or letter dropped: the same line, spelt two ways. */
function canon2(s) {
  let t;
  try { t = cleanStatement(tidy(s)); } catch { t = tidy(s); }
  t = FC.canon(t);
  t = t.replace(/(sin|cos|tan|sec|csc|cot|ln|log)\(([A-Za-zθπ0-9]+)\)/g, '$1$2');
  return t.replace(/(?<![\dA-Za-z)])\((-?\d+(?:\.\d+)?(?:\/\d+)?)\)/g, '$1').replace(/(?<![\dA-Za-z)])\(([A-Za-zθπ])\)/g, '$1');
}
const nontrivial = parts => { const j = parts.join(''); return j.length >= 3 && !/^[-+]?\d+(?:\.\d+)?$/.test(j) && /[A-Za-zθπ]|[+\-*/^]/.test(j); };

// A vector reading of a piece of TeX or of a student's text. Components are exact numbers; names come from the question's own points.
const NUM = '-?\\d+(?:\\.\\d+)?';
function texSimple(tex) {
  return String(tex ?? '')
    .replace(/\\begin\{[pb]matrix\}([\s\S]*?)\\end\{[pb]matrix\}/g, (_, b) => `(${b.split('\\\\').map(x => x.trim()).join(',')})`)
    .replace(/\\overrightarrow\{([A-Za-z]+)\}/g, '$1').replace(/\\underset\{\\sim\}\{([A-Za-z])\}/g, '$1').replace(/\\(?:vec|mathbf|underline)\{([A-Za-z]+)\}/g, '$1')
    .replace(/\\left|\\right/g, '').replace(/\\[,;: ]|\\quad|\\qquad/g, ' ').replace(/\\times|\\cdot/g, '*');
}
function tokens(s) {
  return [...String(s).matchAll(/(\d+(?:\.\d+)?)|([A-Za-z]+)|(\S)/g)].map(m => (m[1] !== undefined ? { n: Number(m[1]) } : m[2] !== undefined ? { w: m[2] } : { c: m[3] }));
}
/** { vec } | { num } | null. env: name → vector (points and named vectors); a two-letter name of two points is the vector from the first to the second. */
function evalVec(text, env) {
  const t = tokens(tidy(text));
  let k = 0;
  const peek = () => t[k];
  const add = (a, b, s) => (a.vec && b.vec && a.vec.length === b.vec.length ? { vec: a.vec.map((x, i) => x + s * b.vec[i]) } : a.num !== undefined && b.num !== undefined ? { num: a.num + s * b.num } : null);
  const mul = (a, b) => (a.num !== undefined && b.num !== undefined ? { num: a.num * b.num } : a.num !== undefined && b.vec ? { vec: b.vec.map(x => a.num * x) } : a.vec && b.num !== undefined ? { vec: a.vec.map(x => x * b.num) } : null);
  function factor() {
    const x = peek();
    if (!x) return null;
    if (x.c === '-') { k++; const f = factor(); return f ? mul({ num: -1 }, f) : null; }
    if (x.c === '+') { k++; return factor(); }
    if (x.n !== undefined) {
      k++;
      let base = { num: x.n };
      if (peek() && peek().c === '/') { k++; const d = peek(); if (!d || d.n === undefined || d.n === 0) return null; k++; base = { num: x.n / d.n }; }
      if (peek() && peek().c === '!') { k++; if (!Number.isInteger(base.num) || base.num < 0 || base.num > 12) return null; let f = 1; for (let q = 2; q <= base.num; q++) f *= q; base = { num: f }; }
      return base;
    }
    if (x.w !== undefined) {
      k++;
      if (x.w.length <= 2 && env.has(x.w)) return { vec: env.get(x.w) };
      if (x.w.length === 2 && env.has(x.w[0]) && env.has(x.w[1])) { const a = env.get(x.w[0]), b = env.get(x.w[1]); return a.length === b.length ? { vec: b.map((v, i) => v - a[i]) } : null; }
      return null;
    }
    if (x.c === '(') {
      k++;
      const items = [];
      for (;;) {
        const e = expr();
        if (!e) return null;
        items.push(e);
        const nx = peek();
        if (nx && nx.c === ',') { k++; continue; }
        if (nx && nx.c === ')') { k++; break; }
        return null;
      }
      if (items.length === 1) return items[0];
      if (items.length > 3 || items.some(e => e.num === undefined)) return null;
      return { vec: items.map(e => e.num) };
    }
    return null;
  }
  function term() {
    let a = factor();
    while (a) {
      const nx = peek();
      if (nx && nx.c === '*') { k++; const b = factor(); a = b ? mul(a, b) : null; continue; }
      if (nx && (nx.c === '(' || nx.n !== undefined)) { const b = factor(); a = b ? mul(a, b) : null; continue; }
      break;
    }
    return a;
  }
  function expr() {
    let a = term();
    while (a) {
      const nx = peek();
      if (nx && (nx.c === '+' || nx.c === '-')) { k++; const b = term(); a = b ? add(a, b, nx.c === '-' ? -1 : 1) : null; continue; }
      break;
    }
    return a;
  }
  const r = expr();
  return r && k === t.length ? r : null;
}
const sameV = (a, b) => !!a && !!b && (a.vec && b.vec ? a.vec.length === b.vec.length && a.vec.every((x, i) => close(x, b.vec[i])) : a.num !== undefined && b.num !== undefined && close(a.num, b.num));
const showV = v => (v.vec ? `(${v.vec.map(x => String(Number(x.toPrecision(12)))).join(', ')})` : String(Number(v.num.toPrecision(12))));

/** The statements of a text, as solutionMatch reads them; an integral set equal to something is read side by side (the TeX reader cannot take both). */
function stmtsOf(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(/\$([^$]+)\$/g)) {
    const span = texPre(m[1]);
    if (/\\int/.test(span) && span.includes('=')) {
      const parts = span.split('=').map(x => SM.spanToPlain(x));
      if (parts.every(Boolean)) { out.push({ parts, plain: parts.join('=') }); continue; }
    }
    out.push(...FC.statementsOfSpans(`$${span}$`));
  }
  return out;
}

// ── what the question gives ──────────────────────────────────────────────────────────────────────────────────────────
function readWorld(q, sol) {
  const prompt = typeof q?.prompt === 'string' && q.prompt.length < 2000 ? q.prompt : '';
  const claimed = CLAIM.test(prompt.replace(/\$[^$]*\$/g, ' '));
  const promptStmts = stmtsOf(prompt).filter(s => !(s.parts.length > 2 || (s.parts.length === 2 && claimed)));
  const steps = Array.isArray(q?.steps) ? q.steps : [];
  const stepStmts = [];
  steps.forEach((st, i) => { for (const s of stmtsOf(st?.d)) stepStmts.push({ ...s, step: i, heading: String(st?.h ?? '').trim() }); });
  // vectors: points and named vectors from the prompt; every vector literal of the steps, with its step
  const env = new Map();
  const ps = texSimple(prompt);
  for (const m of ps.matchAll(new RegExp(`(?<![A-Za-z])([A-Z])\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*(?:,\\s*(${NUM})\\s*)?\\)`, 'g'))) env.set(m[1], [m[2], m[3], m[4]].filter(x => x !== undefined).map(Number));
  for (const m of ps.matchAll(new RegExp(`(?<![A-Za-z])([a-z])\\s*=\\s*\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*(?:,\\s*(${NUM})\\s*)?\\)`, 'g'))) env.set(m[1], [m[2], m[3], m[4]].filter(x => x !== undefined).map(Number));
  const vecSteps = [];
  steps.forEach((st, i) => {
    for (const m of texSimple(st?.d).matchAll(new RegExp(`\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*(?:,\\s*(${NUM})\\s*)?\\)`, 'g'))) vecSteps.push({ step: i, heading: String(st?.h ?? '').trim(), vec: [m[1], m[2], m[3]].filter(x => x !== undefined).map(Number) });
  });
  // the statements of the steps as plain chains, for a vector chain copied from them (`S = P + QR = (4, 6)`)
  const chains = [];
  steps.forEach((st, i) => {
    for (const m of String(st?.d ?? '').matchAll(/\$([^$]+)\$/g)) {
      const t = texSimple(m[1]).split(/\\Rightarrow|\\text|\\approx/)[0].replace(/\\,|\\ /g, ' ');
      if (!t.includes('=')) continue;
      chains.push({ step: i, heading: String(st?.h ?? '').trim(), parts: t.split('=').map(x => x.replace(/\s+/g, '')) });
    }
  });
  return { prompt, promptStmts, stepStmts, env, vecSteps, chains, sol };
}

// ── integrals ────────────────────────────────────────────────────────────────────────────────────────────────────────
const LIMTOK = '(\\{[^{}]*\\}|\\([^()]*\\)|-?\\d+(?:\\.\\d+)?|[a-zπ])';
const INT_RE = new RegExp(`^∫_${LIMTOK}\\^${LIMTOK}\\s*(.+?)\\s*d([a-z])$`);
function integralOf(side) {
  const m = INT_RE.exec(tidy(side).replace(/\s+/g, ' ').replace(/\\left|\\right/g, ''));
  return m ? { lo: m[1].replace(/^[{(]|[})]$/g, ''), hi: m[2].replace(/^[{(]|[})]$/g, ''), body: m[3], v: m[4] } : null;
}
function sameLimit(a, b) {
  const x = SM.readSide(a), y = SM.readSide(b);
  if (x && y && x.value !== undefined && y.value !== undefined) return close(x.value, y.value);
  return canon2(a) === canon2(b);
}
function sameIntegral(a, b) {
  if (!a || !b || a.v !== b.v || !sameLimit(a.lo, b.lo) || !sameLimit(a.hi, b.hi)) return false;
  const x = SM.readSide(a.body), y = SM.readSide(b.body);
  return !!(x && y && x.vars && y.vars && SM.sameSidePublic(x, y, a.body, b.body));
}
/** `[F]_a^b` with F's variable replaced at both limits: a plain expression, or null. */
function expandBrackets(text) {
  let bad = false;
  const out = String(text).replace(/\[([^\[\]]+)\]_(\{[^{}]*\}|\([^()]*\)|-?\d+(?:\.\d+)?|[a-zπ])\^(\{[^{}]*\}|\([^()]*\)|-?\d+(?:\.\d+)?|[a-zπ])/g, (_, body, lo, hi) => {
    const strip = x => x.replace(/^\{|\}$/g, '');
    const b = cleanStatement(tidy(body));
    const letters = [...new Set(b.match(/(?<![A-Za-z])[a-z](?![A-Za-z(])/g) || [])].filter(c => !new RegExp(`(?<![A-Za-z])${c}(?![A-Za-z])`).test(strip(lo) + ' ' + strip(hi)) && c !== 'e');
    if (letters.length !== 1) { bad = true; return _; }
    const at = lim => b.replace(new RegExp(`(?<![A-Za-z])${letters[0]}(?![A-Za-z])`, 'g'), `(${strip(lim)})`);
    return `((${at(hi)})-(${at(lo)}))`;
  });
  return bad || /\]_/.test(out) ? null : out;
}


// ── a substitution is judged by its structure ────────────────────────────────────────────────────────────────────────
// `t = 4: 6(16) + 8(4) + 5` is the substitution of 4 into `6t^2 + 8t + 5`: term by term, a sub-term may be written as its value (`6(16)`, `96`),
// in other bracket style, with × or juxtaposition, and a sum in any order. Anything else that merely reaches the same number is not a substitution.
const unwrapG = n => { while (n && n.t === 'group') n = n.v; return n; };
const hasLetter = (n, v) => !!n && typeof n === 'object' && ((n.t === 'var' && (v === undefined || n.v === v)) || ['l', 'r', 'v', 'arg'].some(k => n[k] && typeof n[k] === 'object' && hasLetter(n[k], v)));
const anyLetter = n => hasLetter(n);
function sumTermsOf(n, sign = 1, out = []) {
  n = unwrapG(n);
  if (n && n.t === 'bin' && (n.op === '+' || n.op === '-')) { sumTermsOf(n.l, sign, out); sumTermsOf(n.r, n.op === '-' ? -sign : sign, out); }
  else if (n && n.t === 'neg') sumTermsOf(n.v, -sign, out);
  else out.push({ sign, node: n });
  return out;
}
function substitutes(src, stu, name, a, depth) {
  src = unwrapG(src); stu = unwrapG(stu);
  if (!src || !stu) return false;
  const value = n => { try { const y = evaluate(n, { [name]: a }); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };
  const isSum = n => n.t === 'bin' && (n.op === '+' || n.op === '-');
  if (isSum(src)) {
    if (depth > 0 && !anyLetter(stu)) { const x = value(src), y = value(stu); if (x !== null && y !== null && close(x, y)) return true; }
    const A = sumTermsOf(src), B = sumTermsOf(stu);
    if (A.length !== B.length || A.length > 8) return false;
    const used = new Array(B.length).fill(false);
    const place = k => {
      if (k === A.length) return true;
      for (let j = 0; j < B.length; j++) {
        if (used[j] || B[j].sign !== A[k].sign) continue;
        used[j] = true;
        if (substitutes(A[k].node, B[j].node, name, a, 1) && place(k + 1)) return true;
        used[j] = false;
      }
      return false;
    };
    return place(0);
  }
  if (depth > 0 && !anyLetter(stu)) { const x = value(src), y = value(stu); return x !== null && y !== null && close(x, y); }
  if (!hasLetter(src, name)) { const x = value(src), y = value(stu); return !anyLetter(stu) && x !== null && y !== null && close(x, y); }
  if (src.t === 'var') return !anyLetter(stu) && value(stu) !== null && close(value(stu), a);
  if (src.t === 'neg' && stu.t === 'neg') return substitutes(src.v, stu.v, name, a, depth + 1);
  if (src.t === 'bin' && stu.t === 'bin' && src.op === stu.op) {
    if (substitutes(src.l, stu.l, name, a, depth + 1) && substitutes(src.r, stu.r, name, a, depth + 1)) return true;
    return src.op === '*' && substitutes(src.l, stu.r, name, a, depth + 1) && substitutes(src.r, stu.l, name, a, depth + 1);
  }
  if (src.t === 'call' && stu.t === 'call' && src.fn === stu.fn) return substitutes(src.arg, stu.arg, name, a, depth + 1);
  return false;
}
const astOf = text => { try { return parse(normalize(cleanStatement(tidy(text)))); } catch { return null; } };

// ── the pass ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const readLine = text => { try { return SM.readStudent(studentPre(text)); } catch { return null; } };
/** A line the strict reader refuses because of letters in a vector or point name (`S = P + QR`): its sides, for the line below to continue. */
function loose(text) {
  const t = tidy(studentPre(text)).replace(/^(?:∴|so\b|hence\b|thus\b|therefore\b)\s*/i, '');
  if (!t || t.length > 120 || /[;:<>]|[A-Za-z]{3,}/.test(t.replace(/[A-Z]{2}/g, '')) || (t.includes(',') && !/\(/.test(t))) return null;
  const continuation = t.startsWith('=');
  const parts = (continuation ? t.slice(1) : t).split('=').map(x => x.trim());
  return parts.length && parts.every(Boolean) ? { parts, ctx: null, continuation, raw: t, loose: true } : null;
}
const lastOf = s => (s && !s.multi ? s.parts[s.parts.length - 1] : null);
const lettersOf = info => (info && info.vars ? info.vars : []);
const showVar = v => (v === 'theta' ? 'θ' : v);

/**
 * Tick (and warn on) the lines of `report` that are still notes. Returns { report, matched, warned }; the report itself when nothing changes.
 * Pure, deterministic, inside one evaluation budget. Reads the prompt and the steps of the question and nothing else.
 */
export function lineChains(q, report, opts = null) {
  if (!q || !report || !Array.isArray(report.lines) || !report.lines.length) return { report, matched: 0, warned: 0 };
  try { return withEvaluationBudget(BUDGET, () => run(q, report, !!(opts && opts.warn))); } catch { return { report, matched: 0, warned: 0 }; }
}

function run(q, report, warn) {
  FC.setFunctions(q);
  const lines = report.lines.slice(0, MAX_LINES);
  const sol = SM.readSolution(q);
  const world = readWorld(q, sol);
  let stop = Number.isInteger(report.firstBreak) && report.firstBreak >= 0 ? report.firstBreak : Infinity;
  const brk = lines.findIndex(l => l?.status === 'break');
  if (brk >= 0) stop = Math.min(stop, brk);
  const out = report.lines.slice();
  const env = new Map(world.env);
  let cur = -1, matched = 0, warned = 0, followed = 0, above = null, bad = false;   // bad: the line above was warned or contradicted and is not ticked
  const hist = [];   // every earlier line that could be read, nearest last
  const knownSubs = FC.knownSubstitutions(q);

  const stepFor = (vec) => { const h = world.vecSteps.find(v => v.vec.length === vec.length && v.vec.every((x, i) => close(x, vec[i]))); return h ? h.step : null; };
  const verified = (note, step) => ({ state: 'verified', note, step });
  const arith = note => ({ state: 'arithmetic', note, arithmetic: true });

  for (let i = 0; i < lines.length && i < stop; i++) {
    const l = lines[i];
    const prevAbove = above;
    const prevBad = bad;
    bad = false;
    above = null;
    if (!l || typeof l.text !== 'string') continue;
    const judged = l.status === 'ok';
    const unjudged = l.status === 'note' && NOTE_STATES.has(l.state) && l.note !== 'Follows from the earlier slip.' && !/misread/i.test(String(l.note ?? '')) && l.unreadable !== true && l.vectorWarning !== true;
    const s = readLine(l.text) || loose(l.text);
    // what this line leaves for the continuation below it
    const describe = (st = l.status) => {
      if (!s || s.multi) return null;
      const last = lastOf(s);
      const info = SM.readSide(last);
      const vec = (() => { try { return evalVec(studentPre(last), env); } catch { return null; } })();
      return { s, last, info, vec, label: s.parts.length >= 2 && !s.continuation ? s.parts[0] : null, sides: s.parts, hasEq: s.parts.length >= 2, text: l.text, status: st };
    };
    if (judged && warn && prevBad && l.state === 'arithmetic' && /^\s*=/.test(l.text) && /equals the line above|line above, written another way/.test(String(l.note))) {
      followed++; bad = true;
      out[i] = { text: l.text, status: 'note', state: 'unverified', unverified: true, note: 'Follows from the line above, which Pri could not confirm.', slipFollow: true };
      continue;
    }
    if (judged) { const st = stepOf(l); if (st !== null && st > cur) cur = st; above = describe(); if (above) hist.push(above); continue; }
    if (!unjudged) continue;
    let tick = null;

    try { tick = tickLine(l, s, prevAbove); } catch { tick = null; }
    if (tick) {
      if (Number.isInteger(tick.step)) cur = Math.max(cur, tick.step);
      matched++;
      out[i] = { text: l.text, status: 'ok', state: tick.state, note: tick.note, solutionMatch: true, ...(tick.arithmetic ? { valueChain: { rule: 'true-as-written' } } : {}) };
      above = describe('ok'); if (above) hist.push(above);
      continue;
    }
    let w = null;
    if (warn) { try { w = slipWarning(l, s, prevAbove) || substitutionWarning(l, s, hist); } catch { w = null; } }
    if (w) { warned++; bad = true; out[i] = { text: l.text, status: 'note', state: 'unverified', unverified: true, note: w.note, slipWarning: true }; continue; }   // a warned line ticks nothing below it
    if (contradicted(s)) bad = true; else { above = describe(); if (above) hist.push(above); }
  }
  if (!matched && !warned && !followed) return { report, matched: 0, warned: 0 };

  function tickLine(l, s0, up) {
    const text = l.text;
    const pre = studentPre(text);
    let s = s0;
    // ── forms the line reader leaves aside ──
    const bare = tidy(pre).replace(/^(?:∴|so\b|hence\b|thus\b|therefore\b)\s*/i, '');
    // g · a continuation `= …` that equals the line above
    if (s && !s.multi && s.continuation && !s.ctx && s.parts.length === 1 && up && up.info) {
      const mine = SM.readSide(s.parts[0]);
      if (mine && mine.value !== undefined && up.info.value !== undefined && close(mine.value, up.info.value)) return arith(`This equals the line above: $${exactForm(mine.value).tex}$.`);
      if (mine && mine.vars && up.info.vars && mine.vars.length && SM.sameSidePublic(up.info, mine, up.last, s.parts[0])) {
        return arith(`Equal to the line above for every value of ${up.info.vars.map(showVar).join(', ')}.`);
      }
    }
    // h · vectors
    const v = vectorTick(bare, s, up);
    if (v) return v;
    if (!s || s.multi) {
      // `a = 4, b = -4` and the like are SM's; a line it could not read has nothing more here
      return null;
    }
    const parts = s.parts;
    // a · the question restated, or a statement of the solution copied (read structurally, a function's bracket and a bracketed number aside)
    if (!s.ctx && !s.continuation && parts.length <= 3 && nontrivial(parts)) {
      const key = parts.map(canon2);
      for (const p of world.promptStmts) if (p.parts.length === parts.length && p.parts.every((x, k) => canon2(x) === key[k])) return { state: 'given', note: NOTE_GIVEN };
      for (const st of world.stepStmts) {
        if (parts.length > st.parts.length) continue;
        for (let a = 0; a + parts.length <= st.parts.length; a++) if (parts.every((x, k) => canon2(st.parts[a + k]) === key[k])) return verified(noteStep(st), st.step);
      }
    }
    // b · an integral the question or the solution states
    if (!s.ctx && !s.continuation) {
      const mine = parts.map(integralOf);
      if (mine.some(Boolean)) {
        const same = (a, b, ia, ib) => (ia && ib ? sameIntegral(ia, ib) : !ia && !ib && (canon2(a) === canon2(b) || (SM.readSide(a) && SM.readSide(b) && SM.sameSidePublic(SM.readSide(a), SM.readSide(b), a, b))));
        const find = list => list.find(st => st.parts.length === parts.length && st.parts.every((x, k) => same(parts[k], x, mine[k], integralOf(x))));
        const p = find(world.promptStmts);
        if (p) return { state: 'given', note: NOTE_GIVEN };
        const st = find(world.stepStmts);
        if (st) return verified(noteStep(st), st.step);
      }
    }
    // c · a bracket worked out at its limits, then matched like any equation of the solution
    if (!s.ctx && !s.continuation && parts.length === 2 && parts.some(x => /\]_/.test(x))) {
      const ex = parts.map(x => (/\]_/.test(x) ? expandBrackets(x) : x));
      if (ex.every(Boolean)) { const h = SM.matchEquation(ex, sol, null); if (h) return verified(noteStep(h), h.step); }
    }
    // d · a derivative label, a discriminant label, a stated condition in front of an equation
    if (!s.ctx && !s.continuation && parts.length >= 2) {
      const lab = FC.labelOf(parts[0]);
      const m = lab && /^([A-Za-z])'$/.exec(lab.name);
      const rest = parts.slice(1).map(SM.readSide);
      if (m && rest.every(Boolean)) {
        for (const st of world.stepStmts) {
          if (st.parts.length < 2 || !new RegExp(`^\\(?\\(?d${m[1]}\\)?\\)?/\\(?d[a-z]\\)?\\)?$`).test(st.parts[0].replace(/\s+/g, ''))) continue;
          const info = SM.readSide(st.parts[st.parts.length - 1]);
          if (info && rest.every((r, k) => SM.sameSidePublic(r, info, parts[k + 1], st.parts[st.parts.length - 1]))) return verified(noteStep(st), st.step);
        }
      }
      if (parts[0] === 'Δ' && parts.length === 2 && rest[0] && rest[0].vars) {
        for (const st of world.stepStmts) for (let k = 0; k < st.parts.length; k++) { const p = SM.readSide(st.parts[k]); if (p && p.vars && SM.sameSidePublic(rest[0], p, parts[1], st.parts[k])) return verified(noteStep(st), st.step); }
      }
    }
    const pm = new RegExp(`^([A-Za-z])\\(\\s*(${NUM})\\s*\\)\\s*=\\s*(${NUM})\\s*:\\s*(.+)$`).exec(tidy(text));
    if (pm) {
      const stated = canon2(`${pm[1]}(${pm[2]})=${pm[3]}`);
      const known = [...world.promptStmts, ...world.stepStmts].some(st => st.parts.length === 2 && canon2(st.parts.join('=')) === stated);
      const body = readLine(pm[4]);
      if (known && body && !body.ctx && !body.continuation && !body.multi && body.parts.length === 2) { const h = SM.matchEquation(body.parts, sol, null); if (h) return verified(noteStep(h), h.step); }
    }
    // the line as the solution states it, with a degree sign or a times sign read (`165° = 165/180 π`, `∴ θ = 210°`)
    if (pre !== text && !s.ctx && !s.continuation && parts.length >= 2) { const h = SM.matchEquation(parts, sol, null); if (h) return verified(noteStep(h), h.step); }
    // e · a value the worked solution reaches, in order
    const ctx = s.ctx;
    let valueParts = parts, label = false;
    // only a WORD label (`hyp = √(8^2 + 15^2)`) is set aside: a one-letter label says which quantity the value belongs to, and is not read here
    if (parts.length === 2 && /^[A-Za-z]{2,6}$/.test(parts[0]) && !FN_NAME.test(parts[0])) { valueParts = [parts[1]]; label = true; }
    const nums = valueParts.map(FC.numericOf);
    if ((!ctx || (knownSubs.has(`${ctx.name}|${ctx.value}`) && structurallyASubstitution(ctx, valueParts[valueParts.length - 1]))) && nums.every(x => x !== null) && nums.every(x => close(x, nums[0])) && nontrivial([valueParts[valueParts.length - 1]]) && /[-+*/^(!]/.test(valueParts[valueParts.length - 1].replace(/^-/, '')) && (!s.continuation || (up && up.info && up.info.value !== undefined && Math.abs(up.info.value - nums[0]) <= 1e-3 * Math.max(1, Math.abs(nums[0]))))) {
      const value = nums[0];
      const hi = cur >= 0 ? cur + 1 + (ctx || label ? 1 : 0) : (label || ctx ? 0 : 1);
      const lo = cur >= 0 ? cur : 0;
      const m = sol.values.find(x => close(x.v, value) && x.step >= lo && x.step <= hi);
      if (m) return verified(noteValue(m, value), m.step);
    }
    // f · a rounding of the line above, to the places the worked solution gives
    if (s.continuation && !s.ctx && parts.length === 1 && up && up.info && up.info.value !== undefined && /^-?\d+\.\d+$/.test(parts[0])) {
      const v0 = Number(parts[0]), places = parts[0].split('.')[1].length;
      const r = Math.round(up.info.value * 10 ** places) / 10 ** places;
      if (!close(v0, up.info.value) && Math.abs(r - v0) <= 1e-12 * Math.max(1, Math.abs(v0)) && sol.values.some(x => close(x.v, v0))) return verified(`This is the line above rounded to ${places} decimal place${places === 1 ? '' : 's'}: $${parts[0]}$.`, sol.values.find(x => close(x.v, v0)).step);
    }
    return null;
  }

  /** h · vectors, each computed from the numbers the question gives. */
  function vectorTick(bare, s, up) {
    if (!/[(]\s*-?\d|[A-Z]{2}|[a-z]\s*[+-]\s*[a-z]/.test(bare) && !(up && up.vec && /^=/.test(bare))) return null;
    if (/[<>≤≥≠]|[A-Za-z]{3,}|∫|\]_/.test(bare.replace(/[A-Z]{2}/g, ''))) return null;
    // points: `P(-3,1) Q(-4,-5) R(3,0)`
    const pts = [...bare.matchAll(new RegExp(`([A-Z])\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, 'g'))];
    if (pts.length && bare.replace(new RegExp(`([A-Z])\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, 'g'), '').trim() === '') {
      if (pts.every(m => { const e = world.env.get(m[1]); return e && e.length === 2 && close(e[0], Number(m[2])) && close(e[1], Number(m[3])); })) return { state: 'given', note: NOTE_GIVEN };
      return null;
    }
    // named vectors: `a = (1,1) b = (5,-5)`
    const nv = [...bare.matchAll(new RegExp(`([a-z])\\s*=\\s*\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, 'g'))];
    if (nv.length && bare.replace(new RegExp(`([a-z])\\s*=\\s*\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, 'g'), '').trim() === '') {
      if (nv.every(m => { const e = world.env.get(m[1]); return e && e.length === 2 && close(e[0], Number(m[2])) && close(e[1], Number(m[3])); })) return { state: 'given', note: NOTE_GIVEN };
      return null;
    }
    const cont = bare.startsWith('=');
    const pieces = (cont ? bare.slice(1) : bare).split('=').map(x => x.trim());
    if (pieces.some(x => !x) || /,\s*[A-Za-z]\s*=/.test(bare)) return null;
    let ev;
    try { ev = pieces.map(p => evalVec(p, env)); } catch { return null; }
    let defined = null, rest = ev;
    if (!cont && pieces.length >= 2 && ev[0] === null && /^[A-Z]$/.test(pieces[0]) && !env.has(pieces[0])) { defined = pieces[0]; rest = ev.slice(1); }
    if (rest.some(x => !x) || !rest.length) return null;
    const first = cont ? (up && up.vec ? up.vec : null) : rest[0];
    if (cont && !first) return null;
    const chain = cont ? [first, ...rest] : rest;
    if (!chain.every(x => sameV(x, chain[0]))) return null;
    const value = chain[chain.length - 1];
    if (cont) return chain.length >= 2 && (value.vec || value.num !== undefined) ? arith(`This equals the line above: ${showV(value)}.`) : null;
    if (defined) {
      // a name the question does not give: only a chain the worked solution itself writes, in the same words
      const key = pieces.map(x => x.replace(/\s+/g, ''));
      const st = world.chains.find(c => key.length <= c.parts.length && c.parts.slice(0, key.length).every((x, k) => x === key[k]));
      if (!st) return null;
      if (value.vec) env.set(defined, value.vec);
      return verified(noteStep(st), st.step);
    }
    if (pieces.length < 2) return null;
    if (value.vec && /^[A-Z]{2}$/.test(pieces[0]) === false && /^[a-z]$/.test(pieces[0])) return null;   // a line that names a given vector alone is the question's own
    if (value.vec && /^[A-Z]{2}$/.test(pieces[0])) env.set(pieces[0], value.vec);
    const step = value.vec ? stepFor(value.vec) : null;
    return verified(`This is true of the numbers the question gives: ${showV(value)}.`, step === null ? undefined : step);
  }

  // ── Part B · a slip in symbolic working ──

  /** The written expression is the substitution of ctx.value into the page's own judged line, or into an expression of the worked solution. */
  function structurallyASubstitution(ctx, expr) {
    const stu = astOf(expr);
    if (!stu || anyLetter(stu)) return false;
    const sources = [];
    for (const h of hist) if (h.status === 'ok' && h.info && h.info.vars && h.info.vars.length === 1 && h.info.vars[0] === ctx.name) sources.push(astOf(h.last));
    for (const st of world.stepStmts) for (const part of st.parts) { const info = SM.readSide(part); if (info && info.vars && info.vars.length === 1 && info.vars[0] === ctx.name) sources.push(astOf(part)); }
    // a bare letter is a label, not an expression to substitute into
    return sources.some(src => src && !['var', 'num', 'const'].includes(unwrapG(src).t) && substitutes(src, stu, ctx.name, ctx.value, 0));
  }

  /** A line the question's facts or the worked solution contradict: the same label or the same object with another value. */
  function contradicted(s) {
    if (!s || s.multi || s.ctx || s.continuation) return false;
    if (s.parts.length >= 2) {
      const lab = FC.labelOf(s.parts[0]);
      const lastPart = s.parts[s.parts.length - 1];
      if (lab) {
        const rest = SM.readSide(lastPart);
        const sts = sol.labelled.filter(st => FC.sameLabel(lab, st.label));
        if (rest && sts.length && !sts.some(st => SM.sameSidePublic(rest, st.info, lastPart, st.last))) return true;
      }
      try {
        const ev = s.parts.map(x => evalVec(studentPre(x), env));
        if (ev.every(Boolean) && ev.some(x => !sameV(x, ev[0]))) return true;
      } catch { /* not a vector line */ }
    }
    return false;
  }

  function slipWarning(l, s, up) { return slipWarningOf(l, s, up); }

  /** A substitution `t = 4: expr` whose expression is not what ANY earlier line of the page gives at t = 4: a note, never a cross. */
  function substitutionWarning(l, s, history) {
    if (!s || s.multi || !s.ctx || s.continuation) return null;
    const text = tidy(l.text);
    if (/[≈≃~<>%°|]/.test(text) || /\d\.\d{4,}/.test(text) || /(?:^|[\s)\d])x\s+(?=[\d(a-z])|(?:[\d)])\s+x(?:\s|$)/i.test(text)) return null;
    const expr = s.parts[s.parts.length - 1];
    const written = FC.numericOf(expr);
    if (written === null || !(s.parts.length === 1 || s.parts.length === 2)) return null;
    const label = s.parts.length === 2 ? tidy(s.parts[0]).replace(/\s/g, '') : null;
    let first = null, any = false;
    for (const h of [...history].reverse()) {
      if (!h.info || !h.info.vars || h.info.vars.length !== 1 || h.info.vars[0] !== s.ctx.name || h.s.ctx || h.s.multi) continue;
      if (/[≈≃~,:;<>%°|]/.test(tidy(h.text))) continue;
      if (label && h.label && tidy(h.label).replace(/\s/g, '') !== label) continue;
      const a = val(h.info, { [s.ctx.name]: s.ctx.value });
      if (a === null) continue;
      any = true;
      if (Math.abs(a - written) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(written))) return null;
      if (!first) first = a;
    }
    if (!any) return null;
    const fmt = x => String(Number(x.toPrecision(6)));
    return { note: `This is not what the line above gives at ${s.ctx.name} = ${s.ctx.raw} (${fmt(first)} against ${fmt(written)}). Check the substitution.` };
  }


  const stated = out.map(x => ({ ...x, state: x.state || (x.status === 'ok' ? 'verified' : x.status === 'break' ? 'wrong' : x.unreadable ? 'unread' : 'unverified') }));
  const at = st => stated.flatMap((x, k) => (x.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  const { arithmetic: _a, ...rest } = report;
  const anyOk = stated.some(x => x.solutionMatch === true || x.status === 'ok');
  return {
    matched, warned: warned + followed,
    report: {
      ...(report.arithmetic === true && !anyOk ? report : rest), lines: stated, source: 'value-chain', ...(matched ? { solutionMatched: true } : {}),
      summary: {
        ...(report.summary || {}), total: stated.length, checked: stated.filter(x => x.status === 'ok').length,
        given: at('given'), verified: at('verified'), arithmetic: at('arithmetic'), conditions: at('condition'), wrong: at('wrong'), unverified, unread,
        reason: unverified.length ? (report.summary?.reason || 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.') : null
      }
    }
  };
}

// ── Part B ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// A slip WARNING: a note (never a cross, never a mark) on a continuation `= expr` (or `label = expr` of the same label as the line above)
// that has letters and is provably NOT equal to the line above. "Provably": both sides read as functions of the same letters, defined at
// the same points, and they differ at three or more independent points (each letter sampled alone, both signs). Nothing is said when:
//   · either side has anything unreadable (a lone `x` that may be a times sign, a glued number, ≈, a comma, a degree, a word);
//   · the line above is an equation being solved: any side of the line above (not only its last) equals this line, or the two lines are both `lhs = rhs`;
//   · the domains differ (defined at a point for one and not for the other), the letters differ, or only one or two points differ;
//   · this line is a derivative or an antiderivative of the line above (a calculus step, not a rewrite).
const WSAMPLES = [[0.37, -1.13, 0.71], [-0.59, 0.83, -1.7], [1.21, 0.47, 2.3], [-1.9, -0.31, 0.53], [0.83, 1.77, -0.9], [2.6, -0.77, 1.4], [-0.43, 2.1, -2.2], [1.57, -1.6, 0.29]];
const AMBIGUOUS = /(?:^|[^A-Za-z])x(?:[^A-Za-z]|$)/;   // a lone x in the text: the letter, or a times sign the reader wrote
function sampleEnv(vars, j) { const env = {}; vars.forEach((v, k) => { env[v] = WSAMPLES[(j + k * 3) % WSAMPLES.length][k % 3]; }); return env; }
function val(info, env) { if (info.value !== undefined) return info.value; try { const y = evaluate(info.ast, env); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } }

export function slipWarningOf(l, s, up) {
  if (!s || s.multi || s.ctx || !up || !up.s || up.s.multi || up.s.ctx) return null;
  const text = tidy(l.text), above = tidy(up.text);
  // a CONTINUATION only: the line starts with `=`, and the line above is itself a continuation that was ticked (a chain of at least two equal
  // expressions). Two full statements `y = 2x + 1` / `y = 3x - 4` are two equations, never a rewrite: no warning.
  let side, label = null;
  if (s.continuation && s.parts.length === 1 && up.s.continuation && up.status === 'ok') side = s.parts[0];
  else return null;
  if (/[≈≃~,:;<>%°|]|\bor\b|\band\b|\\|[°]/.test(text + above)) return null;
  if (AMBIGUOUS.test(text.replace(/\^\s*-?\d*/g, '')) || AMBIGUOUS.test(above)) { /* a bare x that is not part of a name: ambiguous */ if (/(?:^|[\s)\d])x\s+(?=[\d(a-z])|(?:[\d)])\s+x(?:\s|$)/i.test(text) || /(?:^|[\s)\d])x\s+(?=[\d(a-z])|(?:[\d)])\s+x(?:\s|$)/i.test(above)) return null; }
  if (/\d\s+\d|\.\s*\d\s+\d/.test(text + above)) return null;   // glued or spaced numbers
  const mine = SM.readSide(side);
  if (!mine || !mine.vars || !mine.vars.length) return null;
  // every side of the line above (a chain, or an equation) must be readable; this line must differ from ALL of them
  const aboveSides = up.s.parts.map((p, k) => ({ p, info: SM.readSide(p), isLabel: k === 0 && up.s.parts.length >= 2 && !up.s.continuation && !!FC.labelOf(p) }));
  if (aboveSides.some(x => !x.info && !x.isLabel)) return null;
  // a label of a name only (y, y′, d′, A) is not an expression to compare with; a label that reads as an expression of the same letters is
  const comparable = aboveSides.filter(x => x.info && x.info.vars && !(x.isLabel && x.info.vars.join() !== mine.vars.join()));
  const last = aboveSides[aboveSides.length - 1];
  if (!last.info || !last.info.vars || last.info.vars.length === 0) return null;
  if (last.info.vars.join() !== mine.vars.join()) return null;
  // an equation being solved: letters on both sides of the line above and this line is `lhs2 = rhs2` (label form)
  if (label && up.s.parts.length >= 2 && aboveSides.slice(1).some(x => x.info && x.info.vars && x.info.vars.length) && aboveSides[0].info && aboveSides[0].info.vars && aboveSides[0].info.vars.length && !aboveSides[0].isLabel) return null;
  const vars = mine.vars;
  const rawMine = side;
  // against every side: not equal anywhere, and the reference is the last side
  let differ = 0, defined = 0, shown = null;
  for (const ref of [...comparable, last]) {
    if (ref.info.vars.join() !== vars.join()) { if (ref === last) return null; continue; }
    if (SM.sameSidePublic(ref.info, mine, ref.p, rawMine)) return null;
  }
  // Domain-restricted rewrites (√(x^2) = x, arccos(cos x) = x) hold for positive letters: sample positive values only, and warn only if they differ there too.
  for (let j = 0; j < WSAMPLES.length; j++) {
    const env = sampleEnv(vars, j);
    for (const v of vars) env[v] = Math.abs(env[v]);
    const a = val(last.info, env), b = val(mine, env);
    if ((a === null) !== (b === null)) return null;   // the domains differ
    if (a === null) continue;
    defined++;
    if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) { differ++; if (!shown) shown = { env, a, b }; }
  }
  if (defined < 6 || differ < 3) return null;
  // a calculus step is not a rewrite
  for (const v of vars) {
    let deriv = true, anti = true, n = 0;
    for (let j = 0; j < 6; j++) {
      const env = sampleEnv(vars, j), h = 1e-5;
      const up1 = { ...env, [v]: env[v] + h }, dn1 = { ...env, [v]: env[v] - h };
      const d = [val(last.info, up1), val(last.info, dn1)], e = [val(mine, up1), val(mine, dn1)], m0 = val(mine, env), l0 = val(last.info, env);
      if (d.some(x => x === null) || e.some(x => x === null) || m0 === null || l0 === null) { deriv = false; anti = false; break; }
      n++;
      if (Math.abs((d[0] - d[1]) / (2 * h) - m0) > 1e-4 * Math.max(1, Math.abs(m0))) deriv = false;
      if (Math.abs((e[0] - e[1]) / (2 * h) - l0) > 1e-4 * Math.max(1, Math.abs(l0))) anti = false;
    }
    if (n && (deriv || anti)) return null;
  }
  const fmt = x => String(Number(x.toPrecision(4)));
  const at = vars.map(v => `${showVar(v)} = ${fmt(shown.env[v])}`).join(', ');
  return { note: `This is not equal to the line above for every value of ${vars.map(showVar).join(', ')} (for example at ${at}: ${fmt(shown.b)} against ${fmt(shown.a)}). Check this step.` };
}
