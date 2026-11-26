// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · display-only fields on the shown report (26 November 2026)
//
// The marked page reads these from `shownReport` (server/platform/markerOps.js). NOTHING here is read by a mark, the scheme pay, the method
// marks, the stored record or the engine's own `stepReport`: this module only returns a copy of the displayed report with extra fields, and
// returns the report itself when it has nothing to add. It never changes a line's `status` or `state`, never crosses, never ticks.
//
// Report level:  answerLine        zero-based index of the line that states the question's answer (a single value equal to the key), else absent
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
// Reads the question's prompt for the function (pageProofs.worldOf) and `answer.value` ONLY for the answer-bearing line (a numeric key).
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate, variablesOf, exprEquivalent } from './expr.js';
import { isHeading, worldOf, labelOf, clean, lead, astOf, constOf, fitPoly, polyD, rootsComplete } from './pageProofs.js';

export const CLASSES = Object.freeze(['power-rule-differentiation', 'differentiation', 'factorisation', 'roots-of-a-product', 'equation-setup', 'substitution-evaluated', 'arithmetic-chain', 'second-derivative-value', 'sign-claim', 'nature-claim', 'point-claim', 'conclusion-matches', 'condition-line', 'restated-question', 'restated-function', 'heading', 'solution-list', 'rounded-value', 'labelled-substitution', 'identity', 'derivative-rule', 'true-as-written']);
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

/** The index of the line that states the answer: a single value equal to the numeric key, never a list or a point. */
function answerLineOf(q, lines) {
  const key = q && q.answer && Number.isFinite(Number(q.answer.value)) && q.answerType === 'numeric' ? Number(q.answer.value) : null;
  if (key === null) return -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l || l.status !== 'ok') continue;
    const t = clean(l.text).replace(/[.]+$/, '');
    if (/\b(?:or|and)\b|[,;()⇒→]|=>|:/.test(t.replace(/^[^=]*?\b(?:is|are)\b/i, ''))) { if (!/^(?:so|hence|then|therefore|thus)?\s*[a-z]\s*=\s*-?\d/i.test(t)) continue; }
    const m = new RegExp(String.raw`(?:=|\bis\b|\bare\b)\s*(${NUM})$`, 'i').exec(t);
    if (!m || /\b(?:or|and)\b|,/.test(t)) continue;
    if (/[<>]/.test(t)) continue;
    if (Math.abs(Number(m[1]) - key) <= 1e-9 * Math.max(1, Math.abs(key))) return i;
  }
  return -1;
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
export function displayFields(q, report) {
  if (!report || !Array.isArray(report.lines)) return report;
  let w = null; try { w = worldOf(q); } catch { w = null; }
  const lines = report.lines;
  const brk = lines.findIndex(l => l?.status === 'break');
  const limit = brk >= 0 ? brk : lines.length;
  let answerLine = -1; try { answerLine = answerLineOf(q, lines.slice(0, limit)); } catch { answerLine = -1; }
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
