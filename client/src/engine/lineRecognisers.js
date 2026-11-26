// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · lines of a worked page that say what the question says, set up the method, or carry a proved value (feedback only)
//
// 26 November 2026. A fully correct page of words and numbers came back "2 lines correct. 7 not checked": the page restated the question's data,
// named its method, defined a letter, gave the model, substituted a value and wrote the conclusion in a sentence. This pass reads those lines
// against the QUESTION'S OWN PROMPT (never the answer, the worked solution, the traps or the hints) and the lines the page has already proved.
//
//   a. data restated       every fact the line states (a start value, a ratio, a step, a period, a count) is a fact the prompt states, every number of
//                          the line is part of such a fact, and "doubles" is "multiplied by 2" (a fixed table). Altered number: not recognised.
//   b. sentence restated   the line is the prompt's own words and maths, clause by clause, each maths part the same expression as the prompt's.
//   c. method statement    a fixed verb ("Method: Substitute n = 20 into the given formula."): neutral. A claim in it ("common ratio r = 2") must be a
//                          fact of the prompt, and then it is ticked; any other claim leaves the line a note.
//   d. definition          `Let U_n be the number of users after n weeks.` neutral: no number but the prompt's.
//   e. condition           `After 4 weeks (n = 4),`: the 4 is the prompt's own "after 4 weeks".
//   f. model               `U_n = 815 x 2^n`: equal to the sequence the prompt's start value and ratio (or first term and step) define, at n = 0 to 6.
//   g. substitution        the line is the formula (the prompt's, or a model this page proved) with the letter replaced by a value the page or the
//                          prompt gives for it.
//   h. conclusion          a sentence whose only numbers are the value the working above reached and the prompt's own, each beside the same words as in the
//                          prompt (so "20 seats in the first 960 rows" is never read as "960 seats in the first 20 rows").
//
// Hard rules. Nothing is ever crossed; a line it cannot prove stays exactly as it was. Every number it relies on is read as the engine reads it (a
// thousands space is one number). Pure, deterministic, no model.
// ─────────────────────────────────────────────────────────────────────────────
import { texToPlain } from './texToPlain.js';
import { variablesOf, evaluate } from './expr.js';
import { astOf, unwrap, closed, valueOf, same, polyOf, equalByEngine, findSubstitution, printPlain, printTex, printCanon } from './stepExplain.js';

const MINUS = /[−–—]/g;
const NUM = String.raw`(\d{1,3}(?:[ , ]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const numOf = s => Number(String(s).replace(/[ , ]/g, ''));
const sup = { '²': '2', '³': '3' };
const lc = t => String(t ?? '').replace(MINUS, '-').replace(/[²³]/g, c => '^' + sup[c]).replace(/\\boxed\{([^}]*)\}/g, '$1').replace(/\[\s*([\d ,.]+)\s*\]/g, '$1').replace(/\s+/g, ' ').trim();
const strip = t => lc(t).replace(/[.]+$/, '').replace(/^(?:∴|so|hence|then|therefore|thus)\s*:?\s*/i, '').trim();
const FIXED = [[/\bdoubl(?:es|ed|ing)\b/g, 'multiplied by 2'], [/\btripl(?:es|ed|ing)\b/g, 'multiplied by 3'], [/\bhalv(?:es|ed|ing)\b/g, 'multiplied by 0.5']];
const synonyms = t => FIXED.reduce((s, [re, to]) => s.replace(re, to), t);
const NEGATION = /\b(?:not|no|never|cannot|can't|isn't|aren't|doesn't|don't|won't|neither|nor|about|approximately|roughly|almost|nearly|at least|at most|more than|less than|fewer|greater|smaller|larger|over|under|below|above|between|than)\b|n't|≈|≠/i;

// ── the question ─────────────────────────────────────────────────────────────
const cache = new WeakMap();
function promptSpans(prompt) {
  const text = String(prompt ?? '').replace(/\\\$/g, '\u0001');
  const spans = [];
  for (const m of text.matchAll(/\$\$?([^$]+)\$\$?/g)) { let plain = null; try { plain = texToPlain(m[1]); } catch { plain = null; } spans.push({ tex: m[1], plain: plain || null }); }
  return spans;
}
/** The prompt as plain words with each maths span in its plain form, and the facts it states. */
export function questionOf(q) {
  const prompt = String(q?.prompt ?? '');
  if (q && typeof q === 'object' && cache.has(q) && cache.get(q).prompt === prompt) return cache.get(q);
  const spans = promptSpans(prompt);
  const plain = prompt.replace(/\\\$/g, '\u0001').replace(/\$\$?([^$]+)\$\$?/g, (_, tex) => { let p = null; try { p = texToPlain(tex); } catch { p = null; } return ` ${p || tex} `; }).replace(/\*\*/g, '').replace(/\s+/g, ' ');
  const facts = factsOf(plain);
  const numbers = new Set([...plain.matchAll(new RegExp(NUM, 'g'))].map(m => numOf(m[1])));
  const formulas = [];
  for (const s of spans) {
    if (!s.plain) continue;
    const sides = lc(s.plain).split('=').map(x => x.trim());
    const rhs = astOf(sides[sides.length - 1]);
    if (!rhs || sides.length > 2) continue;
    const vars = [...variablesOf(rhs)].filter(v => v !== 'e');
    if (vars.length === 1) formulas.push({ label: sides.length === 2 ? sides[0] : null, v: vars[0], ast: rhs, text: sides[sides.length - 1], source: 'question' });
  }
  const words = new Set(wordsOf(plain));
  const slots = slotsOf(plain);
  const bound = new Map();
  for (const l of slots.filter(x => typeof x.v === 'string')) { const nums = [...new Set(slots.filter(x => typeof x.v === 'number' && x.key === l.key).map(x => x.v))]; if (nums.length === 1 && !bound.has(l.v)) bound.set(l.v, nums[0]); }
  const out = { prompt, plain, facts, numbers, formulas, spans, items: itemsOf(plain), words, slots, bound };
  if (q && typeof q === 'object') cache.set(q, out);
  return out;
}

// ── words, and the places where a letter and a number stand for the same thing ──
const singular = w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
/** The words of a text (two letters or more), as the fixed synonym table reads them, plurals made singular. */
export function wordsOf(raw) { return (synonyms(String(raw ?? '').toLowerCase()).match(/[a-z]{2,}/g) || []).map(singular); }
const SLOT = new RegExp(String.raw`\b(first|last|after|before|over|within)\s+(${NUM}|[a-z])\s+([a-z]+)`, 'g');
/** `first 20 rows`, `first n rows`, `after 4 weeks`, `after n weeks`: { key: 'first row', v: 20 | 'n' }. */
export function slotsOf(raw) {
  const t = synonyms(lc(raw).toLowerCase());
  return [...t.matchAll(SLOT)].filter(m => !/^(?:a|i)$/.test(m[2]) || /\d/.test(m[2])).map(m => ({ key: `${m[1]} ${singular(m[m.length - 1])}`, v: /\d/.test(m[2]) ? numOf(m[2]) : m[2] }));
}
/** A line that says `after n weeks` ties the letter n to the number the question puts in the same place. */
function bindFromLine(state, text) {
  for (const l of slotsOf(text).filter(x => typeof x.v === 'string')) {
    const nums = [...new Set(state.Q.slots.filter(x => typeof x.v === 'number' && x.key === l.key).map(x => x.v))];
    if (nums.length === 1 && !state.bound.has(l.v)) state.bound.set(l.v, nums[0]);
  }
}
const DATA_WORDS = new Set(['given', 'initial', 'initially', 'data', 'information', 'question', 'the', 'an', 'and', 'of', 'is', 'are', 'was', 'were', 'ha', 'have', 'there', 'that', 'with', 'at', 'in', 'for', 'to', 'by', 'on', 'from', 'then', 'so', 'each', 'every', 'per', 'number', 'start', 'begin']);
const DEF_WORDS = new Set(['let', 'be', 'denote', 'represent', 'stand', 'for', 'the', 'number', 'value', 'total', 'amount', 'after', 'at', 'in', 'of', 'an', 'after', 'and']);
const CONC_WORDS = new Set(['there', 'are', 'is', 'will', 'be', 'an', 'the', 'total', 'answer', 'conclusion', 'therefore', 'hence', 'so', 'in', 'after', 'of', 'have', 'ha']);
/** Every content word of the line is a word of the question or one of a fixed few: nothing is said about the data that the question did not say. */
function covered(Q, text, fixed) { return wordsOf(text).every(w => Q.words.has(w) || fixed.has(w)); }

// ── facts a line can state ───────────────────────────────────────────────────
const UNITS = String.raw`(?:weeks?|days?|years?|months?|hours?|minutes?|seconds?|rows?|terms?|steps?|rounds?|turns?)`;
const unitOf = u => String(u).replace(/s$/, '');
const RULES = [
  ['initial', new RegExp(String.raw`\b(?:start|starts|started|begin|begins|began)\s+(?:with|at|from)\s+(?:an?\s+)?${NUM}`, 'g'), 1],
  ['initial', new RegExp(String.raw`\binitial(?:ly)?\b[^.,;=\d]*?(?:=|is|of|:|are|were)?\s*${NUM}`, 'g'), 1],
  ['first', new RegExp(String.raw`\bfirst\s+(?:row|term|day|week|year|month|step)\s+(?:has|have|is|contains|holds|=|of|a\s*=)\s*${NUM}`, 'g'), 1],
  ['first', new RegExp(String.raw`\b${NUM}\s+[a-z]+\s+in\s+the\s+first\s+(?:row|term)\b`, 'g'), 1],
  ['ratio', new RegExp(String.raw`\bmultiplied\s+by\s+${NUM}`, 'g'), 1],
  ['ratio', new RegExp(String.raw`\bcommon\s+ratio\b[^.;\d]*?(?:r\s*=\s*|of\s+|is\s+|=\s*)?${NUM}`, 'g'), 1],
  ['ratio', new RegExp(String.raw`\br\s*=\s*${NUM}`, 'g'), 1],
  ['step', new RegExp(String.raw`\b${NUM}\s+more\b`, 'g'), 1],
  ['step', new RegExp(String.raw`\bincreases?\s+by\s+${NUM}`, 'g'), 1],
  ['step', new RegExp(String.raw`\bcommon\s+difference\b[^.;\d]*?(?:d\s*=\s*|of\s+|is\s+|=\s*)?${NUM}`, 'g'), 1],
  ['after', new RegExp(String.raw`\b(?:after|for|over)\s+${NUM}\s+(${UNITS})\b`, 'g'), 1]
];
/** The facts of a text: [{ k, v, unit?, spans: [[start, end]] }]: only what a fixed set of phrasings states. */
export function factsOf(raw) {
  const t = synonyms(strip(raw).toLowerCase());
  const out = [];
  for (const [k, re, g] of RULES) {
    for (const m of t.matchAll(re)) {
      const at = m.index + m[0].lastIndexOf(m[g]);
      out.push({ k, v: numOf(m[g]), ...(k === 'after' ? { unit: unitOf(m[2]) } : {}), span: [at, at + m[g].length] });
    }
  }
  for (const m of t.matchAll(/\b(?:every|each|per)\s+(week|day|year|month|hour|minute|second)\b/g)) out.push({ k: 'per', v: m[1], span: null });
  return out;
}
const factKey = f => `${f.k}:${f.v}${f.unit ? `:${f.unit}` : ''}`;
/** Every number of the text is part of a fact it states. */
function consumed(t, facts) {
  const text = synonyms(strip(t).toLowerCase());
  for (const m of text.matchAll(new RegExp(NUM, 'g'))) {
    const s = m.index, e = m.index + m[0].length;
    if (!facts.some(f => f.span && f.span[0] <= s && e <= f.span[1])) return false;
  }
  return true;
}

// ── a line as words and maths ────────────────────────────────────────────────
const STOP = new Set(['the', 'a', 'an']);
const wordy = t => { const r = (t.match(/[A-Za-z]{2,}/g) || []).filter(w => !['sin', 'cos', 'tan', 'ln', 'log', 'sqrt', 'exp', 'pi'].includes(w.toLowerCase())); return r.length > 0; };
/** Words and maths chunks of a text, in order: ['first', 'M:n', 'rows', 'hold', 'M:n(58+2(n-1))/2', ...]; clause breaks are '|'. */
export function itemsOf(raw) {
  const t = synonyms(lc(raw).replace(/\*\*/g, ''));
  const items = [];
  let chunk = [];
  const flush = () => {
    if (!chunk.length) return;
    const text = chunk.join('');
    chunk = [];
    const ast = astOf(text.replace(/[,;]$/, ''));
    items.push(ast ? `M:${printCanon(ast)}` : `T:${text}`);
  };
  for (let tok of t.split(' ')) {
    if (!tok) continue;
    const brk = /[.,;:]$/.test(tok) && !/\d[.,]$/.test(tok) ? tok.slice(-1) : null;
    const core = brk ? tok.slice(0, -1) : tok;
    if (core && wordy(core)) { flush(); const w = core.toLowerCase().replace(/[^a-z']/g, ''); if (w && !STOP.has(w)) items.push(w); }
    else if (core) chunk.push(core);
    if (brk) { flush(); items.push('|'); }
  }
  flush();
  return items;
}
const clausesOf = items => { const out = [[]]; for (const x of items) { if (x === '|' || x === 'and') { if (out[out.length - 1].length) out.push([]); } else out[out.length - 1].push(x); } return out.filter(c => c.length); };
const contiguous = (hay, needle) => { for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((x, j) => hay[i + j] === x)) return true; return false; };
const promptRun = Q => Q.items.filter(x => x !== '|' && x !== 'and');

// ── the pass state ───────────────────────────────────────────────────────────
/** The state a page pass carries: values the page has set (n = 4), models it proved, the value its last ticked line reached. */
export function newState(q) { const Q = questionOf(q); return { Q, bound: new Map(Q.bound), formulas: [], last: null }; }
const lastSideValue = text => {
  const t = strip(text);
  if (!t || /[<>≤≥≠,;:]|=>|⇒/.test(t) || (wordy(t) && !/^\s*=/.test(t) && !t.includes('='))) return null;
  const sides = t.replace(/^=\s*/, '').split('=').map(s => s.trim());
  const n = astOf(sides[sides.length - 1]);
  return n && closed(n) ? valueOf(n) : null;
};
/** A line that is already ticked: remember the value it reached. */
export function observe(state, l) {
  if (!state || !l || l.status !== 'ok') return;
  const v = lastSideValue(String(l.text ?? ''));
  if (v !== null) state.last = v;
}

const neutral = (l, tickClass, note) => ({ line: { text: l.text, status: 'note', state: 'unverified', unverified: true, context: true, note, tickClass } });
const tick = (l, cls, note, says, saysTex) => ({ line: { text: l.text, status: 'ok', state: 'arithmetic', note, valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: cls, says, saysTex }, tickClass: cls } });
const fmtNum = v => String(Math.round(v * 1e9) / 1e9);

// ── a. data restated ─────────────────────────────────────────────────────────
function dataRestated(Q, l, text) {
  const t = strip(text).replace(/^(?:given|data|information|we are told|the question says|question)\s*:\s*/i, '');
  if (!/\d/.test(t) || NEGATION.test(t) || /[=<>]/.test(t.replace(/\b(?:initial\s+\w+|[a-z]\s)=/gi, '').replace(/\b[a-z]\s*=\s*\d/gi, '')) && false) return null;
  if (!covered(Q, t, DATA_WORDS)) return null;
  const facts = factsOf(t);
  if (!facts.length || !consumed(t, facts)) return null;
  const have = new Set(Q.facts.map(factKey));
  if (!facts.every(f => have.has(factKey(f)))) return null;
  const said = facts.filter(f => f.k !== 'per').map(f => ({ initial: `start ${f.v}`, first: `first ${f.v}`, ratio: `ratio ${f.v}`, step: `step ${f.v}`, after: `${f.v} ${f.unit}s` }[f.k]));
  return { line: { ...tick(l, 'given-data', 'This line states what the question gives, and every number in it is the question\'s own.', 'Given in the question', null).line } };
}

// ── b. the question's own sentence ───────────────────────────────────────────
function sentenceRestated(Q, l, text) {
  const t = strip(text).replace(/^(?:given|data|question|the question|information)\s*:\s*/i, '');
  const items = itemsOf(t);
  const clauses = clausesOf(items);
  const words = items.filter(x => /^[a-z']+$/.test(x));
  if (!clauses.length || words.length < 2 || items.filter(x => x !== '|').length < 4 || NEGATION.test(t)) return null;
  const run = promptRun(Q);
  for (const c of clauses) if (c.length < 2 || !contiguous(run, c)) return null;
  return neutral(l, 'restated', 'This line repeats the question; there is no step in it to check.');
}

// a title: the question's own words (and a few fixed ones), with the question's own numbers each beside the word the question puts after it
const TITLE = new Set(['number', 'of', 'find', 'total', 'amount', 'value', 'answer', 'question', 'part', 'determine', 'calculate', 'how', 'many', 'much', 'what', 'is', 'are', 'in', 'for', 'at', 'after']);
function titleRestated(Q, l, text) {
  const t = strip(text).replace(/:$/, '');
  if (/[=<>+*^]/.test(t) || NEGATION.test(t)) return null;
  const words = (t.match(/[A-Za-z]+/g) || []).map(w => w.toLowerCase()).filter(w => !STOP.has(w));
  if (words.length < 2 || words.length > 10) return null;
  const run = Q.plain.toLowerCase();
  const known = new Set(run.match(/[a-z]+/g) || []);
  if (!words.every(w => known.has(w) || TITLE.has(w))) return null;
  for (const m of t.matchAll(new RegExp(NUM, 'g'))) {
    const digits = m[1].replace(/ /g, '[ ]?');
    const next = /^\s*([A-Za-z]+)/.exec(t.slice(m.index + m[0].length)), prev = /([A-Za-z]+)\s*$/.exec(t.slice(0, m.index));
    const ok = next ? new RegExp(String.raw`(?<![\d.])${digits}\s+${next[1].toLowerCase()}\b`).test(run) : prev ? new RegExp(String.raw`\b${prev[1].toLowerCase()}\s+${digits}(?![\d.])`).test(run) : false;
    if (!ok) return null;
  }
  return neutral(l, 'restated', 'This line repeats the question; there is no step in it to check.');
}

// ── c. method statements ─────────────────────────────────────────────────────
const VERBS = /^(?:use|using|apply|substitute|sub|put|find|calculate|evaluate|set|take|solve|differentiate|integrate|factorise|factorize|expand|simplify|rearrange|work out|write|let)\b/i;
const VOCAB = new Set(['use', 'using', 'apply', 'substitute', 'sub', 'put', 'find', 'calculate', 'evaluate', 'set', 'take', 'solve', 'differentiate', 'integrate', 'factorise', 'factorize', 'expand', 'simplify', 'rearrange', 'work', 'out', 'write', 'into', 'in', 'the', 'given', 'formula', 'equation', 'expression', 'value', 'values', 'a', 'an', 'geometric', 'arithmetic', 'sequence', 'series', 'with', 'common', 'ratio', 'difference', 'for', 'to', 'of', 'and', 'then', 'this', 'that', 'each', 'first', 'term', 'terms', 'nth', 'sum', 'model', 'exponential', 'growth', 'it', 'n', 'r', 'd', 'be', 'let', 'rule', 'quotient', 'product', 'chain', 'power', 'derivative', 'both', 'sides', 'by', 'on', 'from', 'question', 'known']);
function methodStated(state, l, text) {
  const Q = state.Q;
  const m = /^\s*(?:method|approach|plan|strategy|idea|step\s*\d*)\s*[:\-]\s*(.+)$/i.exec(strip(text));
  const body = m ? m[1] : (VERBS.test(strip(text)) && !/=/.test(strip(text).replace(/\b[a-z]\s*=\s*[\d.]+/gi, '')) ? strip(text) : null);
  if (!body || NEGATION.test(body)) return null;
  const words = (body.match(/[A-Za-z]{2,}/g) || []).map(w => w.toLowerCase());
  if (!words.length || !words.every(w => VOCAB.has(w))) return null;
  if (!VERBS.test(body)) return null;
  // every fact the line states (a ratio, a step) is a fact of the question; every other number is a value given to a letter (`n = 20`) that the question has
  const have = new Set(Q.facts.map(factKey));
  const facts = factsOf(body);
  if (!facts.every(f => have.has(factKey(f)))) return null;
  const assigns = [...body.matchAll(new RegExp(String.raw`\b([a-z])\s*=\s*${NUM}`, 'gi'))];
  for (const m of body.matchAll(new RegExp(NUM, 'g'))) {
    const at = m.index, end = m.index + m[0].length;
    if (facts.some(f => f.span && f.span[0] <= at && end <= f.span[1])) continue;
    if (!Q.numbers.has(numOf(m[1])) || !assigns.some(a => a.index <= at && at < a.index + a[0].length)) return null;
  }
  for (const a of assigns) {
    const L = a[1].toLowerCase();
    if (facts.some(f => f.span && a.index <= f.span[0] && f.span[1] <= a.index + a[0].length)) continue;
    // a value given to a letter is the value the question gives that letter, where the question's wording binds it
    if (state.bound.has(L) && state.bound.get(L) !== numOf(a[2])) return null;
  }
  const claim = facts.find(f => f.k === 'ratio' || f.k === 'step');
  if (claim) {
    const word = claim.k === 'ratio' ? 'Common ratio' : 'Common difference';
    return tick(l, 'method-claim', `This line names the method and states ${word.toLowerCase()} ${fmtNum(claim.v)}, which is the question's own.`, `${word} ${fmtNum(claim.v)}, from the question`, null);
  }
  return neutral(l, 'method-stated', 'This line states the method; there is no step in it to check.');
}

// ── d. definitions ───────────────────────────────────────────────────────────
function definition(state, l, text) {
  const Q = state.Q;
  const t = strip(text);
  const m = /^let\s+([A-Za-z](?:_\{?[A-Za-z0-9]+\}?|\([a-z]\))?)\s+(?:be|denote|represent|stand for)\s+(.+)$/i.exec(t);
  if (!m || /[=<>]/.test(t) || NEGATION.test(t)) return null;
  for (const n of t.matchAll(new RegExp(NUM, 'g'))) if (!Q.numbers.has(numOf(n[1]))) return null;
  if (!covered(Q, m[2], DEF_WORDS)) return null;
  bindFromLine(state, t);
  return neutral(l, 'defines', 'This line defines a letter; there is no step in it to check.');
}

// ── e. a condition the question gives ────────────────────────────────────────
function conditionValue(state, l, text) {
  const Q = state.Q;
  const t = strip(text).replace(/[,;]+$/, '');
  const m = new RegExp(String.raw`^(?:after|when|at|for)\s+${NUM}\s+(${UNITS})\s*[,(]?\s*\(?\s*([a-z])\s*=\s*${NUM}\s*\)?$`, 'i').exec(t);
  const alone = new RegExp(String.raw`^([a-z])\s*=\s*${NUM}$`).exec(t);
  const [letter, value, unit] = m ? [m[3], numOf(m[4]), unitOf(m[2].toLowerCase())] : alone ? [alone[1], numOf(alone[2]), null] : [null, null, null];
  if (!letter) return null;
  if (m && numOf(m[1]) !== value) return null;
  const after = Q.facts.filter(f => f.k === 'after');
  if (!after.some(f => f.v === value && (!unit || f.unit === unit))) return null;
  // `n = 4` is the question's own only where the letter is tied to the question's quantity: by the line itself (`After 4 weeks (n = 4)`) or by a definition above
  if (!m && state.bound.get(letter) !== value) return null;
  if (state.bound.has(letter) && state.bound.get(letter) !== value) return null;
  state.bound.set(letter, value);
  return tick(l, 'condition-value', `The question says after ${fmtNum(value)}, and this line sets ${letter} = ${fmtNum(value)}.`, `${letter} = ${fmtNum(value)}, from the question`, null);
}

// ── f. the model ─────────────────────────────────────────────────────────────
const LABEL = /^([A-Za-z])(?:_\{?([a-z])\}?|\(\s*([a-z])\s*\))$/;
function modelOf(Q) {
  const f = k => Q.facts.filter(x => x.k === k);
  const initial = f('initial'), first = f('first'), ratio = f('ratio'), step = f('step');
  const per = (Q.facts.find(x => x.k === 'per') || {}).v || null;
  const one = a => (a.length === 1 || (a.length > 1 && new Set(a.map(x => x.v)).size === 1) ? a[0] : null);
  const i = one(initial), fi = one(first), r = one(ratio), d = one(step);
  const out = [];
  if (i && r && !d) out.push({ kind: 'geom', index: 0, a: i.v, r: r.v, says: `Correct model: start ${fmtNum(i.v)}, ×${fmtNum(r.v)} each ${per || 'step'}` });
  if (fi && r && !d) out.push({ kind: 'geom', index: 1, a: fi.v, r: r.v, says: `Correct model: first ${fmtNum(fi.v)}, ×${fmtNum(r.v)} each ${per || 'step'}` });
  if (i && d && !r) out.push({ kind: 'arith', index: 0, a: i.v, d: d.v, says: `Correct model: start ${fmtNum(i.v)}, +${fmtNum(d.v)} each ${per || 'step'}` });
  if (fi && d && !r) out.push({ kind: 'arith', index: 1, a: fi.v, d: d.v, says: `Correct model: first ${fmtNum(fi.v)}, +${fmtNum(d.v)} each ${per || 'step'}` });
  return out;
}
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/** The tree is exactly C * B^(n + k) (C and B numbers): { C, B, k }, or null. Proved from the tree, not from sample values. */
function geometricForm(ast, v) {
  let x = unwrap(ast);
  let C = 1, pow = null;
  if (x.t === 'bin' && x.op === '*') {
    const l = unwrap(x.l), r = unwrap(x.r);
    if (closed(l) && r.t === 'bin' && r.op === '^') { C = valueOf(l); pow = r; } else if (closed(r) && l.t === 'bin' && l.op === '^') { C = valueOf(r); pow = l; } else return null;
  } else if (x.t === 'bin' && x.op === '^') pow = x; else return null;
  if (C === null || !pow || !closed(pow.l)) return null;
  const E = polyOf(pow.r);
  if (!E) return null;
  const coef = E.get(`${v}1`), cst = E.get('');
  if (!coef || !near(coef.c, 1) || E.size > 2 || (E.size === 2 && !cst)) return null;
  if (E.size === 1 && cst) return null;
  return { C, B: valueOf(pow.l), k: cst ? cst.c : 0 };
}
function modelLine(state, l, text) {
  const t = strip(text).replace(/[,;]+$/, '');
  const parts = t.split('=').map(s => s.trim());
  if (parts.length !== 2) return null;
  const lab = LABEL.exec(parts[0]);
  if (!lab) return null;
  const v = lab[2] || lab[3];
  const rhs = astOf(parts[1]);
  if (!rhs || [...variablesOf(rhs)].some(x => x !== v) || ![...variablesOf(rhs)].length) return null;
  for (const m of modelOf(state.Q)) {
    let ok = false;
    if (m.kind === 'geom') {
      const g = geometricForm(rhs, v);
      // C * B^(n + k) with B the question's ratio, and the value at the first index the question's start value
      ok = !!g && near(g.B, m.r) && near(g.C * m.r ** (m.index + g.k), m.a);
    } else {
      const P = polyOf(rhs);
      const c1 = P && P.get(`${v}1`), c0 = P && P.get('');
      ok = !!P && P.size <= 2 && near(c1 ? c1.c : 0, m.d) && near((c0 ? c0.c : 0) + (c1 ? c1.c : 0) * m.index, m.a) && !!c1;
    }
    if (!ok) continue;
    state.formulas.push({ label: lab[1], v, ast: rhs, text: parts[1], source: 'page' });
    return tick(l, 'model', 'This model gives the start value and the change the question states, as an exact form (not only at sample values).', m.says, null);
  }
  return null;
}

// ── g. a substitution ────────────────────────────────────────────────────────
function substitutionLine(state, l, text) {
  const t = strip(text).replace(/[,;]+$/, '');
  if (wordyLine(t)) return null;
  const cont = /^=/.test(t);
  const parts = t.replace(/^=\s*/, '').split('=').map(s => s.trim());
  if (!parts.length || parts.some(p => !p) || parts.length > 3) return null;
  let label = null, exprText = parts[0];
  if (!cont && parts.length >= 2) { label = parts[0]; exprText = parts[1]; }
  const B = astOf(exprText);
  if (!B) return null;
  // the whole line must be true: every side after the substituted one is the same value (`g(3) = 2(3) + 4 = 9` is not a substitution)
  { const rest = (cont ? parts.slice(1) : parts.slice(2)).map(astOf); let prevNode = B;
    for (const r of rest) { if (!r || !equalByEngine(prevNode, r)) return null; prevNode = r; } }
  // a label names what the line is the value of (`U_4`, `f(3)`, `y`): its argument must be the value substituted, or the letter itself
  const lab = label ? /^([A-Za-z])(?:_\{?([A-Za-z0-9.]+)\}?|\(\s*([^()]+?)\s*\))?$/.exec(label) : null;
  if (label && !lab) return null;
  const arg = lab ? (lab[2] || lab[3] || null) : null;
  for (const f of [...state.formulas, ...state.Q.formulas]) {
    if (lab && f.label && f.label[0] !== lab[1]) continue;
    if (['var', 'num', 'const'].includes(unwrap(f.ast).t)) continue;
    const subs = findSubstitution(f.ast, B);
    if (!subs || subs.length !== 1 || subs[0].v !== f.v) continue;
    const c = valueOf(subs[0].node);
    if (c === null || !['num', 'neg'].includes(unwrap(subs[0].node).t)) continue;
    if (arg !== null && !(/^[A-Za-z]$/.test(arg) ? arg === f.v : near(numOf(arg), c))) continue;
    const names = `${f.v} = ${printPlain(subs[0].node)}`, namesTex = `${f.v} = ${printTex(subs[0].node)}`;
    const formula = printCanon(f.ast), formulaTex = printTex(f.ast);
    // the value is the question's own only where the question's wording binds this letter to it; otherwise the line is a true evaluation of the formula, and nothing more
    if (state.bound.get(f.v) === c) {
      const out = tick(l, 'substitution-formula', `Putting ${names} into ${formula} gives exactly this expression, and ${f.v} = ${fmtNum(c)} is the question's value.`, `Substituted ${names} into ${formula}`, null);
      out.line.fact.saysSegs = [{ t: 'text', v: 'Substituted ' }, { t: 'tex', v: namesTex }, { t: 'text', v: ' into ' }, { t: 'tex', v: formulaTex }];
      out.line.fact.sentence = `Substituted $${namesTex}$ into $${formulaTex}$.`;
      return out;
    }
    const out = tick(l, 'formula-value', `This is the formula with ${names}: a true evaluation of the formula, not checked against what the question asks.`, `Value of the formula at ${names}`, null);
    out.line.fact.saysSegs = [{ t: 'text', v: 'Value of the formula at ' }, { t: 'tex', v: namesTex }];
    return out;
  }
  return null;
}
const wordyLine = t => wordy(t.replace(/\b(?:sin|cos|tan|ln|log|sqrt|exp|pi)\b/gi, ''));

// ── h. a conclusion in a sentence ────────────────────────────────────────────
function conclusion(state, l, text) {
  const Q = state.Q;
  if (state.last === null) return null;
  let t = strip(text).replace(/^(?:conclusion|answer|ans|therefore|hence|so)\s*[:\-]?\s*/i, '');
  if (!wordy(t) || NEGATION.test(t) || /[=<>]/.test(t) || !covered(Q, t, CONC_WORDS)) return null;
  const nums = [...t.matchAll(new RegExp(NUM, 'g'))];
  if (!nums.length) return null;
  const value = state.last;
  let seen = 0;
  const run = Q.plain.toLowerCase();
  for (const m of nums) {
    const n = numOf(m[1]);
    if (Math.abs(n - value) <= 1e-9 * Math.max(1, Math.abs(value))) { seen++; continue; }
    // another number must be the question's own, beside the word the question puts after it
    if (!Q.numbers.has(n)) return null;
    const next = /^\s*([A-Za-z]+)/.exec(t.slice(m.index + m[0].length));
    const prev = /([A-Za-z]+)\s*$/.exec(t.slice(0, m.index));
    const digits = String(m[1]);
    const okNext = next && new RegExp(String.raw`(?<![\d.])${digits.replace(/[ ]/g, '[ ]?')}\s+${next[1].toLowerCase()}\b`).test(run);
    const okPrev = prev && new RegExp(String.raw`\b${prev[1].toLowerCase()}\s+${digits.replace(/[ ]/g, '[ ]?')}(?![\d.])`).test(run);
    if (!(next ? okNext : okPrev)) return null;
  }
  if (seen !== 1) return null;
  const valueText = String(nums.find(m => Math.abs(numOf(m[1]) - value) <= 1e-9 * Math.max(1, Math.abs(value)))[1]).replace(/\s+/g, ' ');
  const out = tick(l, 'conclusion-sentence', `This sentence states ${fmtNum(value)}, the value the working above reached.`, null, null);
  out.line.fact.valueText = valueText;
  return out;
}

/**
 * @returns null, or { line } : a tick (status 'ok') or a neutral line (status 'note', context) for the page pass to put in place of the note
 */
export function recognise(state, l, text) {
  if (!state) return null;
  const Q = state.Q;
  const tries = [() => definition(state, l, text), () => conditionValue(state, l, text), () => methodStated(state, l, text), () => modelLine(state, l, text), () => substitutionLine(state, l, text),
    () => dataRestated(Q, l, text), () => sentenceRestated(Q, l, text), () => titleRestated(Q, l, text), () => conclusion(state, l, text)];
  for (const f of tries) { let r = null; try { r = f(); } catch { r = null; } if (r) return r; }
  return null;
}
export { same };
