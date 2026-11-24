// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · does a hint give the answer? (the author question bank)
//
// A real leak test, not a plain-text match. The text of a hint rung is read the way a student reads it: every `$…$` span is parsed as TeX
// (\binom, \tfrac, \dfrac, \frac, \sqrt, \times, \cdot, powers, e^{…}, \pi, degrees, sets, intervals, points, \pm, chains of `=`), and
// every closed side of it is EVALUATED. The rung leaks when
//   · the engine accepts any side, any list or any whole span as the answer (checkAnswer, so rounding and equivalent forms count);
//   · a closed numeric side evaluates to the answer (so `\binom{10}{5}`, `56/8`, `10 \times 2`, `\tfrac{48}{90}` against 8/15 are caught:
//     the one missing step is arithmetic);
//   · a set answer's element, or a point's coordinates, is stated;
//   · a bare number the prose states next to a word that announces a result ("the answer is 7") is the answer;
//   · a side that has digits, no letters of its own, and cannot be parsed: unread is treated as leaking (FAIL CLOSED).
// A rung that mentions an interval's endpoints as roots is not, by itself, the interval: the whole relation is what is tested.
//
// Deterministic. No clock, no network, no model.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer } from '../client/src/engine/checker.js';
import { normalize, evalNumeric } from '../client/src/engine/expr.js';

const MATH = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;

// ── TeX → the plain text the engine reads ────────────────────────────────────
const GREEK = { theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', mu: 'μ', lambda: 'λ', sigma: 'σ', Sigma: 'Σ', delta: 'δ', phi: 'φ', omega: 'ω' };
const FUNCS = new Set(['sin', 'cos', 'tan', 'sec', 'cot', 'ln', 'log', 'exp', 'arcsin', 'arccos', 'arctan']);
const ALIASES = { csc: 'cosec' };
/** A `{…}` group starting at `i` (which holds `{`): [inner, index after the closing brace], or null. */
function group(s, i) {
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return null;
}
/** One argument at `i`: a braced group or a single character (TeX's own rule). */
function arg(s, i) {
  while (s[i] === ' ') i++;
  if (s[i] === '{') return group(s, i);
  if (s[i] === '\\') { const m = /^\\[A-Za-z]+/.exec(s.slice(i)); return m ? [m[0], i + m[0].length] : null; }
  return i < s.length ? [s[i], i + 1] : null;
}

/**
 * TeX → plain, or { plain, unread: [commands the reader has no reading of] }. Separators (`=`, \approx, \Rightarrow, …) are kept as
 * written so a caller can split on them.
 */
export function texToPlain(tex) {
  const unread = [];
  const go = (s, depth = 0) => {
    if (depth > 12) { unread.push('depth'); return ''; }
    let out = '';
    for (let i = 0; i < s.length;) {
      const ch = s[i];
      if (ch === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
        const name = m[1];
        i += m[0].length;
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
          const a = arg(s, i); const b = a && arg(s, a[1]);
          if (!a || !b) { unread.push(name); continue; }
          out += `((${go(a[0], depth + 1)})/(${go(b[0], depth + 1)}))`; i = b[1];
        } else if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
          const a = arg(s, i); const b = a && arg(s, a[1]);
          if (!a || !b) { unread.push(name); continue; }
          out += `ncr(${go(a[0], depth + 1)},${go(b[0], depth + 1)})`; i = b[1];
        } else if (name === 'sqrt') {
          let k = null;
          if (s[i] === '[') { const e = s.indexOf(']', i); if (e > 0) { k = s.slice(i + 1, e); i = e + 1; } }
          const a = arg(s, i);
          if (!a) { unread.push(name); continue; }
          const inner = go(a[0], depth + 1); i = a[1];
          out += k ? `((${inner})^(1/(${go(k, depth + 1)})))` : `sqrt(${inner})`;
        } else if (name === 'times' || name === 'cdot') out += '*';
        else if (name === 'div') out += '/';
        else if (name === 'pi') out += 'pi';
        else if (name === 'infty') out += 'inf';
        else if (name === 'circ') out += '°';
        else if (name === 'pm') out += '±';
        else if (name === 'mp') out += '∓';
        else if (name === 'le' || name === 'leq' || name === 'leqslant') out += '<=';
        else if (name === 'ge' || name === 'geq' || name === 'geqslant') out += '>=';
        else if (name === 'ne' || name === 'neq') out += '!=';
        else if (name === 'approx' || name === 'Rightarrow' || name === 'to' || name === 'iff' || name === 'mapsto' || name === 'therefore' || name === 'implies' || name === 'Leftrightarrow' || name === 'rightarrow') out += '=';
        else if (name === 'in' || name === 'sim' || name === 'propto') out += '=';
        else if (name === 'left' || name === 'right' || name === 'displaystyle' || name === 'quad' || name === 'qquad' || name === ',' || name === ';' || name === '!' || name === ' ' || name === ':' || name === '%') { if (name === '%') out += '%'; if (name === 'left' || name === 'right') { if (s[i] === '.') i++; } }
        else if (name === 'text' || name === 'mathrm' || name === 'textbf' || name === 'mbox' || name === 'operatorname') { const a = arg(s, i); if (a) i = a[1]; else unread.push(name); out += ' '; }
        else if (name === 'mathbf' || name === 'vec' || name === 'overrightarrow' || name === 'dot' || name === 'hat' || name === 'bar') { const a = arg(s, i); if (a) { out += go(a[0], depth + 1); i = a[1]; } else unread.push(name); }
        else if (name === 'prime') out += "'";
        else if (name === 'cdots' || name === 'dots' || name === 'ldots') out += '...';
        else if (GREEK[name]) out += GREEK[name];
        else if (FUNCS.has(name)) out += name;
        else if (ALIASES[name]) out += ALIASES[name];
        else if (name === '{' || name === '}') out += name;
        else if (name === '\\') out += ' ';
        else { unread.push(name); out += ' '; }
      } else if (ch === '{') {
        const g = group(s, i);
        if (!g) { out += '('; i++; continue; }
        out += `(${go(g[0], depth + 1)})`; i = g[1];
      } else if (ch === '^' || ch === '_') {
        const a = arg(s, i + 1);
        if (!a) { out += ch; i++; continue; }
        out += `${ch}(${go(a[0], depth + 1)})`; i = a[1];
      } else { out += ch; i++; }
    }
    return out;
  };
  const plain = go(String(tex ?? '')).replace(/\s+/g, ' ').trim();
  return { plain, unread: [...new Set(unread)] };
}

// ── what the reader may call closed ──────────────────────────────────────────
const NAMES = /(?:sin|cos|tan|sec|cosec|cot|ln|log|exp|sqrt|ncr|npr|arcsin|arccos|arctan|pi|inf|e)\b/g;
const hasFreeLetters = plain => /[A-Za-zΑ-Ωα-ω]/.test(plain.replace(NAMES, ''));
const SEPARATORS = /\s*(?:<=|>=|!=|=|<|>)\s*/;

const numberOf = text => {
  const t = String(text).replace(/[−–]/g, '-').replace(/°/g, '*pi/180').replace(/(\d)\s*%/g, '($1/100)').trim();
  if (!t || !/\d/.test(t)) return null;
  try { const v = evalNumeric(normalize(t)); return Number.isFinite(v) ? v : null; } catch { return undefined; }   // undefined: could not be read
};
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The numbers the key is, for the numeric comparison. */
function keyNumbers(q) {
  const a = q?.answer || {};
  if (q?.answerType === 'numeric' && Number.isFinite(a.value)) return [a.value];
  if (q?.answerType === 'set') return (a.values || []).filter(Number.isFinite);
  if (q?.answerType === 'point') return [a.x, a.y].filter(Number.isFinite);
  return [];
}

const RESULT_WORDS = /(?:answer|result|equals?|gives?|get|so|therefore|hence|thus|is|are|=)\s*(?:then\s*)?(?:about\s*|approximately\s*)?$/i;

/** The text inside one pair of brackets that wraps all of it, else the text. */
function unwrap(s) {
  const t = s.trim();
  if (!/^[({\[]/.test(t) || !/[)}\]]$/.test(t)) return t;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if ('([{'.includes(t[i])) depth++; else if (')]}'.includes(t[i]) && --depth === 0 && i < t.length - 1) return t;
  }
  return t.slice(1, -1);
}

/** Splits a candidate at top-level commas (not inside brackets or braces). */
function topLevelList(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/**
 * Why a text of a hint gives the answer to question `q` (a pack question as the server issues it), or null. The string names the reason.
 */
export function leakReason(q, text) {
  const t = String(text ?? '');
  if (!t.trim()) return null;
  const keys = keyNumbers(q);
  const numericKind = keys.length > 0;
  const accepted = c => { try { return checkAnswer(q, c)?.correct === true; } catch { return false; } };
  const spans = [...t.matchAll(MATH)].map(m => m[1]);
  for (const span of spans) {
    const { plain, unread } = texToPlain(span);
    // Candidates: the span, each side of its chain, each side of every relation, and, for ± , both signs.
    const variants = plain.includes('±') || plain.includes('∓')
      ? [plain.replace(/[±∓]/g, '+'), plain.replace(/[±∓]/g, '-'), plain.replace(/∓/g, '-').replace(/±/g, '+')]
      : [plain];
    for (const v of variants) {
      const cands = new Set([v, ...v.split(SEPARATORS).filter(Boolean)]);
      for (const side of v.split(/\s*=\s*/).filter(Boolean)) cands.add(side);
      for (const c of [...cands]) for (const item of topLevelList(unwrap(c))) cands.add(item);
      for (const c of cands) {
        const s = c.trim();
        if (!s || s.length > 160) continue;
        if (accepted(s)) return `the engine accepts "${s.slice(0, 40)}" as the answer`;
        if (accepted(s.replace(/^[A-Za-z']+(\([a-z]\))?\s*=\s*/, ''))) return `the engine accepts "${s.slice(0, 40)}" as the answer`;
        if (numericKind && !hasFreeLetters(s) && !SEPARATORS.test(s)) {
          const v2 = numberOf(s);
          if (v2 === undefined) return `a closed value "${s.slice(0, 40)}" cannot be read (fail closed)`;
          if (v2 !== null && keys.some(k => near(v2, k))) return `"${s.slice(0, 40)}" evaluates to the answer`;
        }
      }
      if (q?.answerType === 'set' && accepted(topLevelList(unwrap(v)).join(', '))) return 'the whole set is stated';
      if (q?.answerType === 'point') { const m = /^\(?\s*([^,]+),\s*([^,)]+)\)?$/.exec(v); if (m && accepted(`(${m[1]}, ${m[2]})`)) return 'the point is stated'; }
    }
    // A command the reader has no reading of, in a span that is all numbers and no letters of its own, is an unread value.
    if (numericKind && unread.length && !hasFreeLetters(plain) && /\d/.test(plain)) return `unread TeX (${unread.join(' ')}) in a numeric span (fail closed)`;
  }
  // Prose written without TeX ("d/dx x^3 = 3x^2."): what follows each equals sign is read like a side of a span.
  for (const m of t.replace(MATH, ' ').matchAll(/=\s*([^=;\n]{1,80}?)(?:[.;,](?:\s|$)|$)/g)) {
    const s = m[1].trim();
    if (s && accepted(s)) return `the engine accepts "${s.slice(0, 40)}" as the answer`;
  }
  // Prose: a number the words announce as the result.
  const prose = t.replace(MATH, m => ` @@${m.length}@@ `);
  if (numericKind) {
    for (const m of prose.matchAll(/(?<![\d.@])-?\d+(?:\.\d+)?(?:\/\d+)?(?!\d|\.\d)/g)) {
      const [p, d] = m[0].split('/');
      const v = d ? Number(p) / Number(d) : Number(p);
      if (keys.some(k => near(v, k)) && RESULT_WORDS.test(prose.slice(Math.max(0, m.index - 30), m.index))) return `the prose states ${m[0]} as the result`;
    }
  }
  return null;
}

/** Every text of a pack question that gives the answer: the hints, the answer box's own hint and the rungs of its ladder. [label, reason]. */
export function leaksOf(q, texts) {
  const out = [];
  for (const [label, text] of texts) { const r = leakReason(q, text); if (r) out.push([label, r]); }
  return out;
}

// ── the ladder of one bank question ──────────────────────────────────────────
import { repeats } from '../client/src/engine/hintLadder.js';

const nonEmpty = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * The three rungs a bank question shows before the full solution, and its hints with every leaking one removed.
 *
 *   nudge   the author's first hint, else the first step's heading;
 *   method  his second hint, else the next step's heading;
 *   worked  the first step actually worked, but only a step that is NOT the last one and does not state the answer in any form the engine
 *           accepts or that is one trivial calculation from it; else his third hint, else the first step's heading alone; else none.
 *           A solution of one step has no worked step: the rung is his third hint or the heading, or it is not offered (a thin rung).
 *
 * A candidate that leaks (leakReason), or that repeats a rung already chosen, is passed over for the next; nothing is invented. Returns
 * { hints, ladder, dropped } where `dropped` lists what was set aside and why (for the importer's report).
 */
export function bankLadder(q) {
  const hints = (q.hints || []).map(nonEmpty);
  const steps = Array.isArray(q.steps) ? q.steps : [];
  const dropped = [];
  const chosen = [];
  const take = (rung, candidates) => {
    for (const [source, text] of candidates) {
      const t = nonEmpty(text);
      if (!t) continue;
      const why = leakReason(q, t);
      if (why) { dropped.push({ rung, source, why }); continue; }
      if (chosen.some(c => repeats(c, t))) continue;
      chosen.push(t);
      return t;
    }
    return null;
  };
  const head = i => nonEmpty(steps[i]?.h);
  const nudge = take('nudge', [['hint 1', hints[0]], ['step 1 heading', head(0)]]);
  const method = take('method', [['hint 2', hints[1]], ['step 2 heading', head(1)], ['step 1 heading', head(0)]]);
  const notLast = steps.length > 1 ? [['step 1', steps[0]?.d]] : [];
  const worked = take('worked', [...notLast, ['hint 3', hints[2]], ['step 1 heading', head(0)]]);
  const ladder = {};
  if (nudge) ladder.nudge = nudge;
  if (method) ladder.method = method;
  if (worked) ladder.worked = worked;
  // The hints that stay: each authored hint that does not leak and says something the ladder has not already said is kept in order.
  const kept = hints.filter(h => h && !leakReason(q, h));
  for (const [i, h] of hints.entries()) if (h && leakReason(q, h)) dropped.push({ rung: 'hint', source: `hint ${i + 1}`, why: leakReason(q, h) });
  return { hints: kept, ladder, dropped };
}
