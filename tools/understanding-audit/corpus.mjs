// Corpus generator for the understanding audit.
//
// Every question family (one authored subtopic generator, both editions) is
// instantiated at several seeds and the four difficulties. For each generated
// question, 3-5 student working transcripts are built BY RULE from the
// generator's own authored solution steps (q.steps[].d, math spans). No language
// model is involved. Each transcript line carries the intended truth:
//   valid   a true line (a true statement the authored solution itself makes)
//   break   the single realistic slip (the first wrong line)
//   follows a line after the slip (judged against the student's own work, not
//           scored for correctness; only a tick on it is reported)
//   neutral prose with no mathematical claim (a verdict on it is not required)
// Truth is decided with calc.mjs, an evaluator independent of the product engine.
import * as G from '../../client/src/engine/generators/index.js';
import { texToPlain, splitSpans } from './tex.mjs';
import { calc, sameNum, fmt } from './calc.mjs';

export const SEEDS = [11, 23, 37];
export const EXTRA_SEEDS = [41, 53, 67];   // added for families that offer step checking
export const DIFFICULTIES = [1, 2, 3, 4];

export function editionOf(id) {
  return /^(y7|y8|y9|y10|y11|y12|ms11|ms12|me11|me12|mex)-/.test(id) ? 'NSW' : 'India';
}

export async function loadFamilies() {
  await G.loadAllBanks();
  return Object.keys(G.GENERATORS).sort();
}

const hash = (...k) => { let h = 2166136261; for (const x of k) for (const ch of String(x)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

// ── The authored solution as plain student lines ─────────────────────────────

function splitList(piece) {
  // "a = -6, b = -1"  ->  two lines.  Only when every part states "name = value".
  const parts = []; let depth = 0, cur = '';
  for (const ch of piece) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if ((ch === ',' || ch === ';') && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  const clean = parts.filter(Boolean);
  return clean.length > 1 && clean.every(p => /^[A-Za-z][\w']*(\([^)]*\))?\s*=/.test(p)) ? clean : [piece.trim()];
}
const mathy = p => p.length <= 110 && (/[=<>≤≥]/.test(p) || (/\d/.test(p) && /[+\-×÷*/^√]/.test(p)));

function solutionOf(q) {
  const lines = [], prose = [];
  for (const st of q.steps || []) {
    const { spans, prose: pr } = splitSpans(String(st.d || ''));
    for (const sp of spans) {
      const plain = texToPlain(sp);
      if (!plain) continue;
      for (const piece of plain.split(' ⇒ ')) for (const p of splitList(piece)) if (mathy(p) && lines[lines.length - 1] !== p) lines.push(p);
    }
    const words = pr.join(' ').replace(/[*_]/g, '').replace(/\s+/g, ' ').replace(/^[\s:;,.()-]+|[\s:;,.()-]+$/g, '').trim();
    if (words.split(' ').length >= 3 && /[a-z]/.test(words)) prose.push(words);
  }
  return { lines, prose };
}

// A line using a single-letter symbol the question never introduces (e.g. the authored
// formula "f'(x) = a(cx + e) + c(ax + b)") is a TEMPLATE line: true in the generator's own
// terms, but not something a student would write. Kept in the corpus, flagged, and the
// report gives every rate both with and without such lines.
const KNOWN = new Set(['x', 'y']);
export function isTemplateLine(line, prompt) {
  const strip = t => t.replace(/\b(sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|lim|max|min|cm|km|mm|kg|or|and|when|let|LHS|RHS|adj|opp|hyp|dx|dy|du|dv)\b/g, ' ');
  const mine = new Set(strip(line).match(/(?<![A-Za-z])[a-zA-Z](?![A-Za-z])/g) || []);
  const theirs = new Set(strip(texToPlain(String(prompt || '').replace(/\$/g, '')) || '').match(/(?<![A-Za-z])[a-zA-Z](?![A-Za-z])/g) || []);
  return [...mine].some(l => !theirs.has(l) && !KNOWN.has(l));
}

// ── The final answer as a student writes it ─────────────────────────────────

function finalOf(q) {
  const a = q.answer || {};
  const prefix = q.answerPrefix ? (texToPlain(q.answerPrefix) || '').replace(/\s*=\s*$/, '').trim() : '';
  const suffix = q.answerSuffix ? (texToPlain(q.answerSuffix) || '').trim() : '';
  if (q.answerType === 'numeric' && Number.isFinite(Number(a.value))) {
    return { kind: 'numeric', value: Number(a.value), text: fmt(Number(a.value)), prefix, suffix };
  }
  if (q.answerType === 'expression' && typeof a.expr === 'string') return { kind: 'expression', text: a.expr, prefix, suffix };
  if (q.answerType === 'set' && Array.isArray(a.values) && a.values.length) {
    return { kind: 'set', text: a.values.map(v => fmt(Number(v))).join(' or '), prefix, suffix, values: a.values };
  }
  return null;
}

const LABELS = [
  [/maxim/i, 'max'], [/minim/i, 'min'], [/gradient|slope/i, 'gradient'], [/period/i, 'period'], [/amplitude/i, 'amplitude'],
  [/x-?intercept/i, 'x-int'], [/y-?intercept/i, 'y-int'], [/probabilit/i, 'P(A)'], [/\barea\b/i, 'Area'], [/perimeter/i, 'Perimeter'],
  [/volume/i, 'Volume'], [/surface area/i, 'SA'], [/\bmean\b/i, 'mean'], [/median/i, 'median'],
  [/derivative|differentiate/i, "f'(x)"], [/\bturning point\b/i, 'T.P.']
];
function labelOf(q, fin) {
  if (fin?.prefix) return fin.prefix;
  // Only the question sentence (the last one) names the asked quantity; a keyword elsewhere
  // in the prompt (e.g. "the sum of their ages is 56") would make the label a FALSE statement.
  const sentences = String(q.prompt || '').replace(/\$[^$]*\$/g, ' ').split(/(?<=[.?!])\s+/).filter(Boolean);
  const ask = sentences[sentences.length - 1] || '';
  for (const [re, l] of LABELS) if (re.test(ask)) return l;
  return 'ans';
}
function unitOf(q, fin) {
  if (fin?.suffix && fin.suffix !== '%') return fin.suffix;
  const m = /\b(cm|km|mm|m|kg|g|litres|metres|minutes|hours|seconds|degrees|dollars|units)\b|\bin\s+(cm²|m²|cm|m)\b/i.exec(String(q.prompt || '').replace(/\$[^$]*\$/g, ' '));
  if (!m) return null;
  return (m[1] || m[2]).replace('metres', 'm').replace('degrees', '°');
}

// ── Truth checks that do not touch the product engine ───────────────────────

function sidesOf(line) {
  const parts = line.split('=');
  if (parts.length < 2 || /[<>≤≥]/.test(line)) return null;
  return parts.map(s => s.trim());
}
/** A closed numeric equality (every side evaluates, all equal): the slip candidates. */
function closedEquality(line) {
  const sides = sidesOf(line);
  if (!sides || sides.some(s => !s)) return null;
  const vals = sides.map(s => (/[a-zA-Z]/.test(s.replace(/sin|cos|tan|ln|log|sqrt|exp|π/g, '')) ? null : calc(s)));
  if (vals.some(v => v === null) || !vals.every(v => sameNum(v, vals[0]))) return null;
  return { sides, value: vals[0] };
}

// ── Transcript styles ───────────────────────────────────────────────────────

const L = (text, truth = 'valid') => ({ text, truth });
const endsWithAnswer = (line, fin) => fin && new RegExp(`(^|=\\s*)${String(fin.text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[^\\d]{0,8}$`).test(line);

function withFinal(base, fin, finalText) {
  const out = base.map(l => ({ ...l }));
  if (!finalText) return out;
  const last = out[out.length - 1];
  if (last && last.text.replace(/\s/g, '') === finalText.replace(/\s/g, '')) return out;
  out.push(L(finalText));
  return out;
}

function firstPromptSpan(q) {
  const { spans } = splitSpans(String(q.prompt || ''));
  for (const sp of spans) { const p = texToPlain(sp); if (p && p.length <= 90 && /[=0-9]/.test(p) && /[+\-×÷*/^=√]/.test(p)) return p; }
  return null;
}
function definedFunction(q) {
  const p = firstPromptSpan(q);
  const m = p && /^([a-zA-Z])\(([a-zA-Z])\)\s*=\s*(.+)$/.exec(p);
  return m ? { name: m[1], v: m[2], body: m[3] } : null;
}

const STYLES = {
  bare: (c) => withFinal(c.base.map(l => L(l.text)), c.fin, c.fin ? (c.fin.prefix ? `${c.fin.prefix} = ${c.fin.text}` : (c.endsAnswer ? null : c.fin.text)) : null),
  labelled: (c) => {
    if (!c.fin || c.fin.kind === 'set') return null;
    const sep = hash(c.key, 'sep') % 2 ? ': ' : ' = ';
    return withFinal(c.base.map(l => L(l.text)), c.fin, `${c.label}${sep}${c.fin.text}`);
  },
  therefore: (c) => {
    if (!c.fin) return null;
    const pre = ['∴ ', 'so ', 'hence ', 'therefore '][hash(c.key, 'pre') % 4];
    const body = c.fin.prefix ? `${c.fin.prefix} = ${c.fin.text}` : `${c.label} = ${c.fin.text}`;
    return [...c.base.map(l => L(l.text)), L(pre + body)];
  },
  restate: (c) => {
    if (!c.restated) return null;
    return withFinal([L(c.restated), ...c.base.map(l => L(l.text))], c.fin, c.fin ? (c.fin.prefix ? `${c.fin.prefix} = ${c.fin.text}` : (c.endsAnswer ? null : c.fin.text)) : null);
  },
  continuation: (c) => {
    // "A = B" then "= value": the second line starts with "=", as students chain.
    const out = []; let used = false;
    for (let i = 0; i < c.base.length; i++) {
      const cur = c.base[i].text; const prev = out.length ? c.base[i - 1]?.text : null;
      const ce = closedEquality(cur);
      const pe = prev ? sidesOf(prev) : null;
      const curSides = sidesOf(cur);
      if (pe && curSides && curSides.length === 2 && pe[pe.length - 1].replace(/\s/g, '') === curSides[0].replace(/\s/g, '')) {
        out.push(L(`= ${curSides[1]}`)); used = true; continue;
      }
      out.push(L(cur));
      void ce;
    }
    // the evaluated value on its own continuation line: "max = 22 + 5" / "= 27"
    const lastEq = [...c.base].reverse().find(l => closedEquality(l.text));
    if (lastEq) {
      const eq = closedEquality(lastEq.text);
      const rhs = eq.sides[eq.sides.length - 1];
      if (!/^-?\d+(\.\d+)?$/.test(rhs)) {
        const idx = c.base.indexOf(lastEq);
        const clone = out.slice();
        // only when the evaluated line is the last line of the chain
        if (idx === c.base.length - 1) { clone.push(L(`= ${fmt(eq.value)}`)); return clone; }
      }
    }
    return used ? out : null;
  },
  substitution: (c) => {
    const lines = c.base.map(l => L(l.text));
    const fn = definedFunction(c.q);
    if (fn) {
      const k = [2, 3, 1, 4][hash(c.key, 'k') % 4];
      const body = fn.body.replace(new RegExp(`\\b${fn.v}\\b`, 'g'), `(${k})`);
      const v = calc(body);
      if (v !== null) return [...lines, L(`${fn.name}(${k}) = ${fmt(v)}`)];
    }
    const eqSpan = firstPromptSpan(c.q);
    if (eqSpan && c.fin?.kind === 'numeric' && /^[^=]+=[^=]+$/.test(eqSpan)) {
      const vars = [...new Set(eqSpan.replace(/sin|cos|tan|ln|log|sqrt|exp|π/g, '').match(/[a-zA-Z]/g) || [])];
      if (vars.length === 1) {
        const [l, r] = eqSpan.split('=').map(s => s.trim());
        const lv = calc(l, { [vars[0]]: c.fin.value }), rv = calc(r, { [vars[0]]: c.fin.value });
        if (lv !== null && rv !== null && sameNum(lv, rv)) return [...lines, L(`when ${vars[0]} = ${c.fin.text}, LHS = ${fmt(lv)} = RHS`)];
      }
    }
    const m = /\b(?:substitut\w*|let)\b[^$]*\$([a-z])\s*=\s*([^$]+)\$/i.exec(String(c.q.prompt || ''));
    if (m) { const p = texToPlain(`${m[1]} = ${m[2]}`); if (p) return [L(`let ${p}`), ...lines]; }
    return null;
  },
  units: (c) => {
    if (!c.fin || c.fin.kind !== 'numeric') return null;
    const u = unitOf(c.q, c.fin);
    if (!u) return null;
    const word = hash(c.key, 'u') % 2 === 0;
    const base = c.base.map(l => L(l.text));
    const answerLine = c.endsAnswer ? base.pop() : null;
    void answerLine;
    const sp = u === '°' || u === '%' ? '' : ' ';
    const tail = word ? `${c.fin.text}${sp}${u}` : `= ${c.fin.text}${sp}${u}`;
    return [...base, L(tail)];
  },
  sentence: (c) => {
    if (!c.prose.length) return null;
    const sentence = c.prose[hash(c.key, 's') % c.prose.length].replace(/^./, ch => ch.toLowerCase());
    const base = c.base.map(l => L(l.text));
    if (base.length < 1) return null;
    const at = Math.max(1, Math.floor(base.length / 2));
    const lines = [...base.slice(0, at), L(sentence, 'neutral'), ...base.slice(at)];
    return withFinal(lines, c.fin, c.fin ? (c.fin.prefix ? `${c.fin.prefix} = ${c.fin.text}` : (c.endsAnswer ? null : c.fin.text)) : null);
  }
};

function slip(c) {
  // One realistic slip. Candidate = a closed numeric equality (sides agree), so the slipped line is provably false.
  const base = c.base;
  const cands = base.map((l, i) => (closedEquality(l.text) ? i : -1)).filter(i => i >= 0);
  const kinds = ['sign', 'arithmetic', 'dropped factor'];
  const kind = kinds[hash(c.key, 'slip') % 3];
  const bad = v => {
    let w;
    if (kind === 'sign') w = v === 0 ? 1 : -v;
    else if (kind === 'arithmetic') w = v + ([1, -1, 10, -10, 2][hash(c.key, 'd') % 5]);
    else w = Number.isInteger(v) && v % 2 === 0 && v !== 0 ? v / 2 : v * 2;
    return sameNum(w, v) ? v + 1 : w;
  };
  if (cands.length) {
    const at = cands[cands.length - 1 - (hash(c.key, 'at') % Math.min(2, cands.length))];
    const eq = closedEquality(base[at].text);
    const lhs = eq.sides.slice(0, -1).join(' = ');
    const wrong = fmt(bad(eq.value));
    const lines = base.map((l, i) => (i < at ? L(l.text) : i === at ? L(`${lhs} = ${wrong}`, 'break') : L(l.text, 'follows')));
    return { kind, lines, breakAt: at };
  }
  if (c.fin?.kind === 'numeric') {
    const wrong = fmt(bad(c.fin.value));
    const lines = [...base.map(l => L(l.text)), L(c.fin.prefix ? `${c.fin.prefix} = ${wrong}` : wrong, 'break')];
    return { kind, lines, breakAt: lines.length - 1 };
  }
  return null;
}

const ORDER = ['labelled', 'therefore', 'restate', 'continuation', 'substitution', 'units', 'sentence'];

/** 3-5 transcripts for one generated question. */
export function transcriptsFor(q) {
  const { lines: sol, prose } = solutionOf(q);
  if (!sol.length) return [];
  const fin = finalOf(q);
  const key = `${q.subtopic}|${q.difficulty}|${q.seed}`;
  const base = sol.map(text => ({ ...L(text), template: isTemplateLine(text, q.prompt) }));
  const endsAnswer = fin ? endsWithAnswer(sol[sol.length - 1], fin) : false;
  const c = { q, base, fin, prose, key, endsAnswer, label: labelOf(q, fin), restated: firstPromptSpan(q) };
  const out = [];
  const add = (style, lines, extra = {}) => { if (lines && lines.length) out.push({ style, lines, ...extra }); };
  add('bare', STYLES.bare(c));
  const s = slip(c);
  if (s) add('slip', s.lines, { slipKind: s.kind, breakAt: s.breakAt });
  // 2-3 further styles, rotating by the question key so every style is exercised across the corpus
  const start = hash(key, 'rot') % ORDER.length;
  let added = 0;
  for (let i = 0; i < ORDER.length && added < 3; i++) {
    const st = ORDER[(start + i) % ORDER.length];
    const lines = STYLES[st](c);
    if (lines && lines.length) { add(st, lines); added++; }
  }
  const tmpl = new Set(base.filter(l => l.template).map(l => l.text));
  for (const t of out) for (const l of t.lines) l.template = tmpl.has(l.text);
  return out;
}

export function questionsFor(id, seeds) {
  const qs = [];
  for (const d of DIFFICULTIES) for (const seed of seeds) {
    try { qs.push(G.generateQuestion(id, d, seed)); } catch { /* a draw that throws serves nothing */ }
  }
  return qs;
}
