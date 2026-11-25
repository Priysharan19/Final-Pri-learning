// Pri Learning · no hint rung before the solution states the answer, judged by the real marker (launch QA 26 Nov 2026, review of #1122).
// INDEPENDENT of the hint guard (engine/hintLadder.js rungGivesAnswer): this reads the served ladder, takes every value, pair, set,
// interval, point or expression a rung STATES as a result (the sides of every equality, the result of every arrow, every bracketed
// list, every whole computation, every number said after "is / gives / equals / so / answer"), and gives each one to the engine's own
// marker (checkAnswer). A rung is a leak when the marker would accept a statement of it as the answer. The number being in the prompt
// is no exemption: a rung that computes the key from numbers the prompt prints (`6 + 8 = 14`) states the answer.
// Over every issued NSW generator at every issued level and SEEDS seeds, and over the author's question bank (its own ladders).
// SYNTHETIC: generated and authored questions; no evidence about students.
// Usage: node client/test/hint-leak-marker-check.mjs [seeds] [--list]
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { NSW_ISSUED_CELLS } from '../src/engine/nswIssuedCells.js';
import { buildHintLadder } from '../src/engine/hintLadder.js';
import { checkAnswer } from '../src/engine/checker.js';
import { texToPlain } from '../src/engine/texToPlain.js';
import { evalNumeric, normalize } from '../src/engine/expr.js';

await loadAllBanks();
const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 60;
const LIST = process.argv.includes('--list');

const NUMBER = /^[-+−]?\d+(?:\.\d+)?$/;
const clean = s => String(s).replace(/\\(?:left|right|,|;|!|quad|qquad|displaystyle|\s)/g, ' ').replace(/−/g, '-').replace(/\\text\{[^{}]*\}|\\mathrm\{[^{}]*\}/g, ' ').trim();
const plain = s => { try { return texToPlain(clean(s)).replace(/\s+/g, ' ').trim(); } catch { return clean(s); } };

const FN = /(?:sqrt|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|ln|log|exp|pi|min|max|abs|frac|dfrac|left|right|cdot|times|text|mathrm|circ|theta|alpha|beta|infty|binom)/g;
const hasVariable = p => /[A-Za-z]/.test(p.replace(FN, '').replace(/\\[a-z]+/g, '').replace(/(?<![A-Za-z])[ie](?![A-Za-z])/g, ''));
const closed = p => !hasVariable(p);

/** Every statement of a result in one rung, as text the marker can be asked about. `result` marks a position that states what was found. */
export function statements(text) {
  const out = [];
  const add = (s, result) => { const p = plain(s); if (p) out.push({ p, result }); };
  const chunks = [...String(text).matchAll(/\$\$?([^$]+)\$\$?/g)].map(m => m[1]);
  for (const c of chunks) {
    // An arrow starts a new statement whose last part is what was derived.
    const parts = c.split(/\\Rightarrow|\\implies|\\Longrightarrow|\\to\b|→|\\therefore|\\rightarrow/).map(x => x.trim()).filter(Boolean);
    parts.forEach((part, pi) => {
      const sides = part.split(/(?<![<>!])=|\\approx|≈/).map(x => x.trim()).filter(Boolean);
      const first = plain(sides[0] || '');
      const computed = closed(first) || /^[A-Za-z][A-Za-z0-9]*(?:\([^()]*\))?$/.test(first);
      sides.forEach((side, i) => {
        const ps = plain(side);
        // After "a = b" with variables on the left, a plain number on the right is the equation's constant, not a result.
        const result = i > 0 && (computed || hasVariable(ps)) || (sides.length === 1 && pi > 0);
        if (i === 0 && sides.length > 1 && !closed(ps)) return;          // the left of an equation or identity is the question's own
        add(side, result);
      });
    });
    for (const m of c.matchAll(/[\(\[]\s*[^()\[\]{}]*?,[^()\[\]{}]*?[\)\]]/g)) add(m[0], true);
    for (const m of c.matchAll(/\\\{([^{}]*)\\\}/g)) add(`{${m[1]}}`, true);
  }
  const prose = String(text).replace(/\$\$?[^$]*\$\$?/g, ' ');
  for (const m of prose.matchAll(/\b(?:answer|result|gives|give|equals|is|so|therefore|hence)\s+(?:about |approximately |equal to |now )?(-?\d+(?:\.\d+)?(?:\/\d+)?)(?![\d.]\d)/gi)) add(m[1], true);
  return out;
}

const accepts = (q, input) => { try { const r = checkAnswer(q, input); return !!r && r.correct === true; } catch { return false; } };

const OPERATION = /\d\s*[-+*/^]\s*[-(\d]|sqrt|\)\s*[-+*/^]|\d\s*\(/;
const valueOf = p => { try { if (hasVariable(p) || NUMBER.test(p) || !OPERATION.test(p)) return null; const v = evalNumeric(normalize(p)); return Number.isFinite(v) ? Number(v.toPrecision(12)) : null; } catch { return null; } };

/** The statements of a rung the marker accepts as the answer. A computation the rung sets out is asked as its value (nothing left to do). */
export function markerLeaks(q, rung) {
  if (!q || q.multipart || q.placement || q.custom || ['mcq', 'working', 'graph-sketch', 'proof', 'manual', 'geometry'].includes(q.answerType)) return [];
  const hits = [];
  const seen = new Set();
  const values = [];
  for (const { p, result } of statements(rung)) {
    if (!p || seen.has(p)) continue; seen.add(p);
    const v = valueOf(p);
    if (v !== null) { values.push(v); if (accepts(q, String(v))) hits.push(`${p} = ${v}`); }
    const tuple = /^[(\[](.*)[)\]]$/.exec(p)?.[1]?.split(',').map(x => x.trim());
    if (tuple && tuple.length > 1) {
      const vs = tuple.map(x => (NUMBER.test(x) ? Number(x) : valueOf(x)));
      if (vs.every(x => x !== null) && vs.some((x, i) => String(x) !== tuple[i]) && accepts(q, `(${vs.join(', ')})`)) hits.push(`${p} = (${vs.join(', ')})`);
    }
    // A lone number is a statement of the result only in a result position; a whole computation, pair, set or expression always is.
    if (NUMBER.test(p) && !result) continue;
    // An expression with a variable that is not the result of an equality is a step, not the answer (the marker accepts equivalent forms).
    if (!result && hasVariable(p) && !/[,]/.test(p)) continue;
    if (accepts(q, p)) hits.push(p);
  }
  for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= values.length; i++) if (accepts(q, `(${values.slice(i, i + n).join(', ')})`)) hits.push(`values ${values.slice(i, i + n).join(', ')} read together`);
  return hits;
}

/** A multiple-choice rung states the answer when it quotes the keyed option's text as a result. */
export function optionLeaks(q, rung) {
  if (q?.answerType !== 'mcq' || !Array.isArray(q.options)) return [];
  const key = q.options[q.answer?.index ?? q.answer?.correct];
  if (typeof key !== 'string' || key.length < 4) return [];
  return plain(rung).includes(plain(key)) && !plain(q.prompt).includes(plain(key)) ? [plain(key)] : [];
}

export function rungLeaks(q) {
  const out = [];
  for (const r of buildHintLadder(q, { withholdAnswer: true })) {
    if (r.rung === 'solution' || !r.text) continue;
    const hit = [...markerLeaks(q, r.text), ...optionLeaks(q, r.text)];
    if (hit.length) out.push({ rung: r.rung, text: r.text, hit });
  }
  return out;
}

export function selfTest() {
  const errors = [];
  const num = { prompt: 'Find $6 + 8$ ... the sum of the two flows is 14 in total? Find the value.', answerType: 'numeric', answer: { value: 14 },
    steps: [{ h: 'Add', d: '$6 + 8 = 14$' }], hints: ['Add the flows.'] };
  if (!markerLeaks(num, '$6 + 8 = 14$').length) errors.push('a computation whose result is the key, with the key in the prompt, was not caught');
  if (markerLeaks(num, 'Add the flows $6 + 3$.').length) errors.push('an unrelated computation was flagged');
  // The three the reviewer found (seeds as the review printed them): a point answer stated as a pair, a point stated by a rule, and a number the prompt prints.
  for (const [id, d, seed] of [['mex-complex', 1, 3141880], ['y11-transform', 3, 1885146], ['ms12-network-flow', 1, 19]]) {
    const q = generateQuestion(id, d, seed);
    const served = buildHintLadder(q, { withholdAnswer: true }).slice(0, 3).map(r => r.text).filter(Boolean);
    if (rungLeaks(q).length) errors.push(`${id} d${d} seed ${seed} still leaks: ${rungLeaks(q)[0].text}`);
    const raw = buildHintLadder(q).slice(0, 3).map(r => r.text).filter(Boolean);
    if (!raw.some(t => markerLeaks(q, t).length)) errors.push(`${id} d${d} seed ${seed}: the unguarded ladder no longer shows the leak this case guards (${raw.join(' | ').slice(0, 80)}); pick another case`);
    if (!served.length) errors.push(`${id} d${d} seed ${seed}: the guard emptied the whole ladder`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const bad = selfTest();
  if (bad.length) { console.log(`HINT LEAK (marker): FAIL, self-test: ${bad.join('; ')}`); process.exit(1); }
  const flagged = [];
  let questions = 0, rungs = 0;
  for (const [id, levels] of Object.entries(NSW_ISSUED_CELLS)) for (const d of levels) for (let i = 1; i <= SEEDS; i++) {
    const seed = i * 7919 + d;
    let q; try { q = generateQuestion(id, d, seed); } catch { continue; }
    if (!q) continue;
    questions++; rungs += 3;
    for (const l of rungLeaks(q)) flagged.push(`${id} d${d} seed ${seed} ${l.rung}: ${l.text.slice(0, 140)}  ⇒ ${l.hit.join(' | ')}`);
  }
  if (questions < 5000) { console.log(`HINT LEAK (marker): FAIL, the scan did not reach the generators (${questions} questions)`); process.exit(1); }
  const bankFlagged = [];
  let bank = 0;
  try {
    process.env.PRI_EDITION = 'prithagoras';
    const { ensureQbank, qbankEntries, qbankEntryQuestion } = await import('../../server/platform/qbankPack.js');
    await ensureQbank(process.env, { strict: true });
    for (const { entry, place } of qbankEntries()) { if (!place) continue; const q = qbankEntryQuestion(entry.id, 1); bank++; for (const l of rungLeaks(q)) bankFlagged.push(`bank ${q.contentId}: ${l.rung}: ${l.text.slice(0, 140)} ⇒ ${l.hit.join(' | ')}`); }
  } catch (e) { console.log(`  (bank not scanned: ${e.message})`); }
  if (LIST) console.log([...flagged, ...bankFlagged].join('\n'));
  if (flagged.length || bankFlagged.length) {
    console.log(`HINT LEAK (marker): FAIL, ${flagged.length} generated and ${bankFlagged.length} bank rungs state an answer the marker accepts (of ${rungs} generated rungs over ${questions} questions, ${bank} bank questions)`);
    for (const f of [...flagged, ...bankFlagged].slice(0, 25)) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log(`HINT LEAK (marker): PASS, ${rungs} rungs over ${questions} generated questions and ${bank} bank questions; no statement in a rung before the solution is accepted by the marker as the answer`);
}
