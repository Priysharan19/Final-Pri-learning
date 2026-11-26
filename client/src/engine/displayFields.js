// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · display-only fields on the shown report (26 November 2026)
//
// The marked page reads these from `shownReport` (server/platform/markerOps.js). NOTHING here is read by a mark, the scheme pay, the method
// marks, the stored record or the engine's own `stepReport`: this module only returns a copy of the displayed report with extra fields, and
// returns the report itself when it has nothing to add. It never changes a line's `status` or `state`, never crosses, never ticks.
//
// Report level:  answerLine        zero-based index of the line whose stated result the server's answer check accepts as the final answer (the last
//                                  value of a chain included), set only when the answer was marked correct, else absent
// Line level:    tickClass         stable id of why a tick is true (see CLASSES)
//                notRequired       true on a line Pri proved true that the question did not need: it comes after the answer-bearing line
//                reasonId          on the first wrong line only: why it is wrong, from the engine's own diagnosis (errorType) or computed
//                                  exactly here for a derivative of the question's polynomial; absent when unknown
//                correctedLine     on the first wrong line only: the engine's corrected line, when it has one
//                correctedRhs      on the first wrong line only: the right-hand side that line should have had, when computable
//                followsFromError  true on a line AFTER the first wrong line that is a correct consequence of the line above it, which is itself
//                                  the wrong line or another such line; its status stays a note (no cross repeated) and no mark changes
//                followsFrom       the 1-based number of the first wrong line, with followsFromError
//
// Reads the question's prompt for the function (pageProofs.worldOf). The answer-bearing line is decided by the server's own answer check, handed in as
// `ctx.accepts` (text -> boolean); this module never reads the key itself.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate, variablesOf } from './expr.js';
import { explainLines } from './stepExplain.js';
import { isHeading, worldOf, labelOf, clean, lead, astOf, constOf, fitPoly, polyD, rootsComplete } from './pageProofs.js';

export const CLASSES = Object.freeze(['power-rule-differentiation', 'differentiation', 'factorisation', 'roots-of-a-product', 'equation-setup', 'substitution-evaluated', 'arithmetic-chain', 'second-derivative-value', 'sign-claim', 'nature-claim', 'point-claim', 'conclusion-matches', 'condition-line', 'restated-question', 'restated-function', 'heading', 'solution-list', 'rounded-value', 'labelled-substitution', 'identity', 'derivative-rule', 'true-as-written', 'matches-worked-step', 'equal-to-line-above', 'satisfies-equation-above', 'same-equation-as-line-above', 'substitution-defined', 'substitution-consistent', 'derivative-of-substitution', 'differential-form', 'change-of-variable', 'integral-rewritten', 'antiderivative-checked', 'back-substitution', 'equivalent-expressions', 'definite-integral-evaluated', 'several-claims', 'given-data', 'method-claim', 'method-stated', 'defines', 'condition-value', 'model', 'substitution-formula', 'conclusion-sentence', 'formula-value', 'function-value', 'equation-solved', 'condition-stated', 'derivative-of-function', 'conclusion-extremum', 'check-values-list', 'figure-label', 'point-on-curve']);
const PROVED = { listed: 'solution-list', rounded: 'rounded-value', substituted: 'labelled-substitution', restated: 'restated-question', identity: 'identity', derivative: 'derivative-rule' };
const NUM = String.raw`-?\d+(?:\.\d+)?`;

function engineClass(l, w) {
  if (l.tickClass) return l.tickClass;
  if (l.fact?.kind === 'proved' && PROVED[l.fact.proof]) return PROVED[l.fact.proof];
  const rule = l.valueChain?.rule;
  if (rule === 'derivative') return w && w.poly ? 'power-rule-differentiation' : 'differentiation';
  if (rule === 'stationary-values') return 'roots-of-a-product';
  if (rule === 'stationary-equation') return /\)\s*\(|\w\s*\(/.test(String(l.text)) ? 'factorisation' : 'equation-setup';
  if (rule === 'restated') return 'restated-function';
  if (rule === 'continuation') return 'arithmetic-chain';
  if (l.state === 'given') return 'restated-function';
  return 'true-as-written';
}

const ANSWER_TYPES = new Set(['numeric', 'expression', 'set', 'interval', 'equation', 'point']);
const ARROWS = /\s*(?:⇒|⟹|=>|⟶|→|->)\s*/;
/** The texts of a line that could be the answer it states: the end of a chain, the tail after an arrow, the last equation of a chain, the whole line. */
function resultTexts(text, answerType) {
  let t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > 200) return [];
  const out = [];
  const arrow = t.split(ARROWS);
  if (arrow.length > 1) t = arrow[arrow.length - 1].trim();
  if (!t) return [];
  const relational = /[<>≤≥]/.test(t);
  // `x = 0 or x = 6` lists values: no end of it is "the" value of a number
  const listed = /\b(?:or|and)\b|[,;]/i.test(t);
  const single = answerType === 'numeric';
  if (!(single && listed)) {
    if (!relational && t.includes('=')) {
      // `= 5*4*3*2 = 120` continues the line above: its first side is that line, so it is dropped
      const sides = t.replace(/^=\s*/, '').split('=').map(x => x.trim());
      if (sides.every(Boolean)) {
        out.push(sides[sides.length - 1]);
        if (sides.length > 2) out.push(`${sides[sides.length - 2]} = ${sides[sides.length - 1]}`);
      }
    }
    // "The larger x-coordinate is 6": what follows the verb
    const tail = !t.includes('=') ? /\b(?:is|are)\s+(?:[a-z]\s*=\s*)?(-?[\d(][^A-Za-z]*)$/i.exec(t) : null;
    if (tail) out.push(tail[1].trim());
    // the line itself: always for a set, an interval, a point or an equation; for a number only when it has no words in it
    if (!single || !/[A-Za-z]{3,}/.test(t.replace(/\b(?:sqrt|cbrt|ln|log|sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|exp|pi)\b/gi, ''))) out.push(t);
  }
  for (const c of out.slice()) { const u = flatFraction(unwrap(c)); if (u !== c) out.push(u); }
  // a line that ends in arithmetic not yet carried out (`32 - 64/3`, `(1/2) + 2`, `2*1.1903`) STATES its value: that value, written the way the answer box takes it, is offered
  // to the same answer check as well. The check decides; nothing here accepts a value itself.
  if (answerType === 'numeric') for (const c of out.slice()) out.push(...valueTexts(c));
  return [...new Set(out)];
}
/** The value of a letter-free arithmetic text as a plain fraction (when it is rational with a small denominator) and as a decimal; [] for anything else, or when the text is already a plain number. */
function valueTexts(c) {
  const t = String(c).trim();
  if (!t || /^-?\d+(?:\.\d+)?$/.test(t) || /[A-Za-z]{2,}/.test(t.replace(/\b(?:sqrt|pi)\b/gi, '')) || !/[-+*/^()]/.test(t.slice(1))) return [];
  const ast = astOf(t);
  if (!ast || ast.t === 'equation') return [];
  let v; try { if ([...variablesOf(ast)].some(x => x !== 'e')) return []; v = evaluate(ast, {}); } catch { return []; }
  if (!Number.isFinite(v) || Math.abs(v) > 1e9) return [];
  const out = [];
  for (let d = 1; d <= 2000; d++) { const n = Math.round(v * d); if (Math.abs(v * d - n) <= 1e-9 * Math.max(1, Math.abs(v * d))) { out.push(d === 1 ? String(n) : `${n}/${d}`); break; } }
  out.push(String(Number(v.toPrecision(12))));
  return out;
}
/** `-(4639/6561)` as `-4639/6561`: a bracketed plain fraction written the way a numeric answer box takes it. */
const flatFraction = t => t.replace(/\(\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\)/g, '$1/$2');
/** `(5/3)` as `5/3`: one pair of brackets that encloses the whole text. */
function unwrap(t) {
  let s = String(t).trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0, whole = true;
    for (let i = 0; i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')') { depth--; if (depth === 0 && i < s.length - 1) { whole = false; break; } } }
    if (!whole) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}
/** The name a line gives to its value (`x`, `y`, `f(2)`, `dy/dx`), '' for a line that starts with an expression. */
function labelOfLine(text) {
  const t = lead(String(text ?? '')).split(ARROWS)[0];
  if (!t.includes('=') || /[<>≤≥]/.test(t)) return '';
  const head = t.split('=')[0].trim().replace(/\s+/g, '');
  return /^(?:[A-Za-z][A-Za-z0-9_']*(?:\([^()=]*\))?|d\^?2?[A-Za-z]+\/d[A-Za-z]+\^?2?)$/.test(head) ? head : '';
}
/** What a line states as its value, for the contradiction rule: { label, last } from the end of an `=` / `≈` chain, the tail after an arrow, or the bare line (`Hence 5`, `5`). */
function statedValue(text) {
  let t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  const arrow = t.split(ARROWS);
  if (arrow.length > 1) t = arrow[arrow.length - 1].trim();
  if (!t || t.length > 200 || /[<>≤≥≠]|!=/.test(t)) return null;
  const head = t.split(/[=≈]/)[0];
  // a substitution under `At x = 2:` / `When ...:` states a value of another quantity at another point, never the answer
  if (/:/.test(head) || /^\s*(?:at|when|for|if|check|put|substituting)\b/i.test(t)) return null;
  const sides = t.replace(/^[=≈]\s*/, '').split(/[=≈]/).map(x => x.trim());
  if (sides.some(x => !x)) return null;
  const label = sides.length > 1 ? labelOfLine(t.replace(/≈/g, '=')) : '';
  return { label, last: sides[sides.length - 1] };
}
/**
 * The index of the line that states the answer: the LAST line before the first cross, ticked, one of whose results (end of a chain, tail after an arrow, the line
 * itself) the server's answer check accepts, and only when the answer was marked correct.
 * It is withdrawn (no line is named) whenever a LATER line, ticked or not, before or after a cross, states another value for the answer: a constant that the
 * answer check does not accept (`x = 5`, `= 5`, `≈ 5`, `Hence 5`, a bare `5`, a chain ending at another number, whatever its label), or any value under the answer's
 * own name or the answer box's label. When it is unsure it names no line. Only a line under `At x = a:` / `When ...:` and a not-equal line are set aside.
 */
function answerLineOf(q, lines, accepts, correct, limit = lines.length) {
  if (correct !== true || typeof accepts !== 'function' || !ANSWER_TYPES.has(q?.answerType)) return -1;
  const ok = c => { try { return accepts(c) === true; } catch { return false; } };
  let at = -1;
  for (let i = 0; i < Math.min(limit, lines.length); i++) {
    const l = lines[i];
    if (!l || l.status !== 'ok' || l.context === true) continue;
    // a conclusion the second page pass (pageProofs2.js) proved carries the value it states (`statedAnswer`), because its words hide the value from the plain reading above
    const texts = l.fact && l.fact.proof === 'conclusion-sentence' && typeof l.fact.valueText === 'string' ? [l.fact.valueText] : resultTexts(l.text, q.answerType);
    if (texts.some(ok) || (typeof l.statedAnswer === 'string' && l.tickClass === 'conclusion-extremum' && ok(l.statedAnswer))) at = i;
  }
  if (at < 0) return -1;
  const names = new Set([labelOfLine(lines[at].text)]);
  const box = /^([A-Za-z][A-Za-z0-9_']*(?:\([^()]*\))?)\s*=$/.exec(String(q?.answerPrefix ?? '').trim());
  if (box) names.add(box[1]);
  names.delete('');
  for (let j = at + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l || l.context === true || typeof l.text !== 'string' || isHeading(l.text)) continue;
    const v = statedValue(l.text);
    if (!v) continue;
    let accepted = ok(v.last);
    if (!accepted) for (const c of resultTexts(l.text, q.answerType)) if (ok(c)) { accepted = true; break; }
    if (accepted) continue;
    if (constOf(v.last) !== null || (v.label !== '' && names.has(v.label))) return -1;
  }
  return at;
}

const termText = (c, k, v) => { const a = Math.abs(c); const body = k === 0 ? String(a) : `${a === 1 ? '' : a}${v}${k === 1 ? '' : `^${k}`}`; return body; };
function polyText(co, v) {
  const parts = [];
  for (let k = co.length - 1; k >= 0; k--) { const c = co[k]; if (Math.abs(c) < 1e-12) continue; parts.push({ neg: c < 0, body: termText(Math.round(c * 1e9) / 1e9, k, v) }); }
  if (!parts.length) return '0';
  return parts.map((p, i) => (i === 0 ? (p.neg ? '-' : '') + p.body : `${p.neg ? '-' : '+'} ${p.body}`)).join(' ').replace(/ ([+-]) /g, ' $1 ');
}

/** Why a written derivative differs from the real one, for a polynomial question: exactly one reason id, or 'derivative-differs'. */
function derivativeReason(P, D, W) {
  const n = Math.max(P.length, D.length, W.length);
  const reasons = new Set();
  const tol = 1e-9, skip = new Set();
  // every term of the derivative written one power too high: the exponent was never reduced
  if (Math.abs(W[0] ?? 0) < tol && D.some(x => Math.abs(x) > tol) && D.every((d, k) => Math.abs((W[k + 1] ?? 0) - d) < tol) && W.length <= D.length + 1) return 'exponent-not-reduced';
  for (let j = 0; j < n; j++) {
    const d = D[j] ?? 0, wv = W[j] ?? 0;
    if (skip.has(j) || Math.abs(d - wv) < tol) continue;
    const k = j + 1, c = P[k] ?? 0;                       // the term of the curve this derivative term came from
    if (k > 1 && Math.abs(c) > tol && Math.abs(wv - c) < tol) reasons.add('coefficient-not-multiplied-by-exponent');
    else if (Math.abs(d) > tol && Math.abs(wv + d) < tol) reasons.add('sign-error');
    else reasons.add('derivative-differs');
  }
  if (!reasons.size) return null;
  return reasons.size === 1 ? [...reasons][0] : 'derivative-differs';
}

function wrongLineFields(w, l, firstIdx) {
  const out = {};
  const dg = l.diagnosis || {};
  if (typeof dg.errorType === 'string' && dg.errorType) out.reasonId = dg.errorType;
  if (typeof dg.corrected === 'string' && dg.corrected) { out.correctedLine = dg.corrected; const r = dg.corrected.split('=').slice(1).join('=').trim(); if (r) out.correctedRhs = r; }
  if (w && w.dpoly && out.correctedRhs === undefined) {
    const t = lead(String(l.text ?? '')).replace(/[.]+$/, '');
    const parts = t.split('=').map(s => s.trim());
    const label = parts.length >= 2 ? labelOf(parts[0], w) : null;
    if (label && label.a === undefined && (label.kind === 'd1' || label.kind === 'd2') && !/[<>:⇒→]/.test(t)) {
      const D = label.kind === 'd1' ? w.dpoly : polyD(w.dpoly);
      out.correctedRhs = polyText(D, w.v);
      if (out.reasonId === undefined && parts.length === 2) {
        const ast = astOf(parts[1]);
        let W = null;
        if (ast && ast.t !== 'equation' && ![...variablesOf(ast)].some(x => x !== w.v)) W = fitPoly(x => { try { return evaluate(ast, { [w.v]: x }); } catch { return NaN; } });
        if (W && label.kind === 'd1') { const why = derivativeReason(w.poly, D, W); if (why) out.reasonId = why; }
      }
    }
  }
  return out;
}

// ── a correct consequence of the line above ─────────────────────────────────
const SAMP = [-3.1, -1.7, -0.6, 0.4, 1.3, 2.2, 3.7, 5.1];
const neutral = t => isHeading(t) || (/:\s*$/.test(clean(t)) && /\b(?:when|set|stationary|solve)\b/i.test(t));
function sidesOf(text) {
  const t = lead(text).replace(/[.]+$/, '');
  if (/[<>:⇒→]|=>/.test(t)) return null;
  const parts = t.split('=').map(s => s.trim());
  if (parts.some(p => !p)) return null;
  return parts;
}
const evalAt = (ast, v, x) => { try { const r = evaluate(ast, { [v]: x }); return Number.isFinite(r) ? r : NaN; } catch { return NaN; } };
const closeTo = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
function equivalentExprs(a, b, v) {
  const A = astOf(a), B = astOf(b);
  if (!A || !B || A.t === 'equation' || B.t === 'equation') return false;
  const vars = new Set([...variablesOf(A), ...variablesOf(B)]); vars.delete('e');
  if (vars.size > 1 || (vars.size === 1 && !vars.has(v))) return false;
  if (!vars.size) { try { return closeTo(evaluate(A, {}), evaluate(B, {})); } catch { return false; } }
  return SAMP.every(x => closeTo(evalAt(A, v, x), evalAt(B, v, x)));
}
/** Is `cur` a correct consequence of `prev` (whatever `prev` says), by the line alone? Returns true or false; never guesses. */
export function followsFrom(prev, cur, v) {
  const P = sidesOf(prev), C = sidesOf(cur);
  if (!P || !C) return false;
  const prevLast = P[P.length - 1];
  // `= expr = expr`: continues the line above
  if (/^\s*=/.test(lead(cur))) { const vals = C.slice(1).length ? C.slice(1) : []; return vals.length > 0 && !lead(cur).slice(1).includes('<') && vals.every(x => equivalentExprs(prevLast, x, v)); }
  // an equation A = B equivalent to the line above (a constant multiple of its difference), or to its right side set to 0
  if (C.length === 2) {
    const A = astOf(C[0]), B = astOf(C[1]);
    if (!A || !B || A.t === 'equation' || B.t === 'equation') return false;
    const free = new Set([...variablesOf(A), ...variablesOf(B)]); free.delete('e');
    if (free.size !== 1 || !free.has(v)) {
      return false;
    }
    const g = x => evalAt(A, v, x) - evalAt(B, v, x);
    let h = null;
    if (P.length === 2) {
      const A2 = astOf(P[0]), B2 = astOf(P[1]);
      if (A2 && B2 && A2.t !== 'equation' && B2.t !== 'equation' && [...variablesOf(A2), ...variablesOf(B2)].every(x => x === v || x === 'e')) h = x => evalAt(A2, v, x) - evalAt(B2, v, x);
    }
    // the line above names a function (`dy/dx = E`): the line sets that E to a value: A - B = c (E - k) is not read, only E = 0
    const E = astOf(prevLast);
    const zero = constOf(C[1]) === 0 || constOf(C[0]) === 0;
    const sameFamily = (f1, f2) => { const r = SAMP.map(x => { const b = f2(x); return Math.abs(b) < 1e-9 ? NaN : f1(x) / b; }); return r.every(Number.isFinite) && Math.abs(r[0]) > 1e-9 && r.every(q => Math.abs(q - r[0]) <= 1e-7 * Math.max(1, Math.abs(r[0]))); };
    if (h && sameFamily(g, h)) return true;
    if (!h && P.length >= 2 && E && E.t !== 'equation' && zero && [...variablesOf(E)].every(x => x === v) && sameFamily(g, x => evalAt(E, v, x))) return true;
    return false;
  }
  return false;
}
/** `x = 0 or x = 6` below an equation: every value solves it, and no root is missing. */
function rootsFollow(prev, cur, v) {
  const P = sidesOf(prev); if (!P || P.length !== 2) return false;
  const t = lead(cur).replace(/[.]+$/, '');
  if (!new RegExp(`^${v}\\s*=`).test(t) || /[(<>:]/.test(t)) return false;
  const vals = [];
  for (const part of t.split(/\s*(?:\bor\b|\band\b|,|;)\s*/i)) { const m = new RegExp(`^(?:${v}\\s*=\\s*)?(${NUM})$`).exec(part.trim()); if (!m) return false; vals.push(Number(m[1])); }
  const A = astOf(P[0]), B = astOf(P[1]);
  if (!A || !B || A.t === 'equation' || B.t === 'equation') return false;
  const g = x => evalAt(A, v, x) - evalAt(B, v, x);
  if (!vals.every(r => Math.abs(g(r)) <= 1e-7 * Math.max(1, Math.abs(r)) ** 6)) return false;
  const co = fitPoly(g);
  return !!co && rootsComplete(co, [...new Set(vals)]);
}

/**
 * @param q       the question
 * @param report  the report the page shows (shownReport, or the engine's report when nothing was proved)
 * @returns the same report with the display fields added, or `report` itself when there is nothing to add
 */
export function displayFields(q, report, ctx = null) {
  if (!report || !Array.isArray(report.lines)) return report;
  let w = null; try { w = worldOf(q); } catch { w = null; }
  const lines = report.lines;
  const brk = lines.findIndex(l => l?.status === 'break');
  const limit = brk >= 0 ? brk : lines.length;
  let answerLine = -1; try { answerLine = answerLineOf(q, lines, ctx && ctx.accepts, ctx && ctx.correct, limit); } catch { answerLine = -1; }
  let explained = []; try { explained = explainLines(lines, limit, answerLine); } catch { explained = []; }
  let changed = false;
  const v = w ? w.v : (/^[a-z]$/.test(String(q?.variable ?? '')) ? q.variable : 'x');
  const out = [];
  lines.forEach((l, i) => {
    if (!l) { out.push(l); return; }
    const add = {};
    if (l.status === 'ok') {
      const cls = engineClass(l, w);
      if (cls && l.tickClass !== cls) add.tickClass = cls;
      if (answerLine >= 0 && i > answerLine && i < limit) add.notRequired = true;
      if (explained[i]) add.explain = explained[i];
    }
    if (i === brk) Object.assign(add, (() => { try { return wrongLineFields(w, l, i); } catch { return {}; } })());
    if (brk >= 0 && i > brk && l.status === 'note' && !l.candidate) {
      let pj = i - 1; while (pj > brk && neutral(String(lines[pj]?.text ?? ''))) pj--;
      const prev = lines[pj];
      const prevOk = pj === brk || out[pj]?.followsFromError === true;
      if (neutral(String(l.text ?? ''))) { out.push(l); return; }
      if (prevOk && pj >= 0) {
        let yes = false; try { yes = followsFrom(String(prev.text ?? ''), String(l.text ?? ''), v) || rootsFollow(String(prev.text ?? ''), String(l.text ?? ''), v); } catch { yes = false; }
        if (yes) { add.followsFromError = true; add.followsFrom = brk + 1; }
      }
    }
    if (!Object.keys(add).length) { out.push(l); return; }
    changed = true;
    out.push({ ...l, ...add });
  });
  if (!changed && answerLine < 0) return report;
  return { ...report, lines: out, ...(answerLine >= 0 ? { answerLine } : {}) };
}

// ── the author bank ──────────────────────────────────────────────────────────
// A bank line is ticked by the deterministic report (the topic check, the arithmetic reading, a match to a step of the worked solution), and each of
// those leaves its proof in the line's own fields. The class below is read from THAT proof and claims no more than it: a line ticked only because it
// equals a step of the author's worked solution is `matches-worked-step`; a line ticked with no proof field at all is `true-as-written`, the same
// fallback the generated path uses. DISPLAY ONLY: no status, state, note or text is changed, so no tick, cross or mark moves.
function bankClass(l) {
  if (l.tickClass) return l.tickClass;
  const note = String(l.note ?? '');
  if (l.state === 'given' && (l.solutionMatch === true || l.restates === true)) return 'restated-question';
  const rule = l.valueChain && typeof l.valueChain === 'object' ? l.valueChain.rule : null;
  if (l.fact?.kind === 'proved' && PROVED[l.fact.proof]) return PROVED[l.fact.proof];
  if (rule === 'question-given') return 'restated-function';
  if (l.how?.kind === 'equal-above' || l.fact?.kind === 'equal-above' || l.fact?.kind === 'equals-line-above' || rule === 'continuation' || /^This equals the line above/.test(note)) return 'equal-to-line-above';
  if (l.solutionMatch === true) return 'matches-worked-step';
  if (rule === 'derivative') return 'differentiation';
  if (rule === 'stationary-values') return 'roots-of-a-product';
  if (l.coversAll === true) return 'solution-list';
  // `page-definitions` is one rule for several different proofs: the class follows what the engine's own sentence says it proved, never the rule's name
  if (rule === 'page-definitions') {
    if (/\b(?:satisfies|each satisfy) .*(?:equation|above)|satisfies the equation before it/.test(note)) return 'satisfies-equation-above';
    if (/^The same equation as the one before it/.test(note)) return 'same-equation-as-line-above';
    if (/^This is the (?:value of the )?derivative\b/.test(note)) return 'derivative-rule';
    if (/\beach side comes to\b/i.test(note)) return 'arithmetic-chain';
    return 'true-as-written';
  }
  // a numeric chain: both sides evaluate to one value
  if (rule === 'arithmetic' && l.fact?.kind === 'both-sides') return 'arithmetic-chain';
  return 'true-as-written';
}

/**
 * The display fields of a question of the author's bank: `tickClass` on every tick, `answerLine`, and `notRequired` after it. Nothing else (no reason id and no
 * corrected line on a cross: the bank's crosses are shown as the report made them). Returns the report itself when there is nothing to add.
 * @param ctx  { correct: the answer was marked correct, accepts: text -> boolean, the server's answer check }
 */
export function bankDisplayFields(q, report, ctx = null) {
  if (!report || !Array.isArray(report.lines)) return report;
  const lines = report.lines;
  const brk = lines.findIndex(l => l?.status === 'break');
  const limit = brk >= 0 ? brk : lines.length;
  let answerLine = -1; try { answerLine = answerLineOf(q, lines, ctx && ctx.accepts, ctx && ctx.correct, limit); } catch { answerLine = -1; }
  let explained = []; try { explained = explainLines(lines, limit, answerLine); } catch { explained = []; }
  let changed = false;
  const out = lines.map((l, i) => {
    if (!l || l.status !== 'ok') return l;
    const add = {};
    if (explained[i]) add.explain = explained[i];
    const cls = bankClass(l);
    if (cls && l.tickClass !== cls) add.tickClass = cls;
    if (answerLine >= 0 && i > answerLine && i < limit) add.notRequired = true;
    if (!Object.keys(add).length) return l;
    changed = true;
    return { ...l, ...add };
  });
  if (!changed && answerLine < 0) return report;
  return { ...report, lines: out, ...(answerLine >= 0 ? { answerLine } : {}) };
}
