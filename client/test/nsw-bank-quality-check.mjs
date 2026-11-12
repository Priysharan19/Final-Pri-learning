// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the NSW bank quality gate (Prithagoras, plan G3)
//
// A generator is issued to an Australian student only if it survives this
// sweep. It is the NSW counterpart of the India marker suites
// (false-positive-sweep-check, correct-answer-sweep-check, tools/
// distinct-questions, mcq-distinctness-check), run over exactly the cells
// server/platform/nswBanks.js issues, and it shares no code with them or with
// the marker, so it cannot agree with either by construction.
//
// For every issued (generator, difficulty) cell, over many seeds, each question
// the server would issue (nswIssuable) must:
//
//   KEY       have its stored answer ACCEPTED by the deterministic marker, and
//             the answer the server prints after resolution accepted too (or
//             refused only by the D13 "work it out first" rule, with guidance);
//   WRONG     have every near-miss wrong answer REFUSED: sign, ±1, reciprocal,
//             ×10, ÷10, just outside the tolerance; a dropped, extra, negated
//             or shifted solution; swapped or shifted coordinates; a reversed
//             ratio; an expression negated, doubled, scaled or offset (each
//             confirmed non-equivalent by direct evaluation first); every
//             other option of a multiple-choice question;
//   OPTIONS   offer distinct, non-empty options as the student reads them, with
//             the key among them;
//   RENDERS   have a prompt, worked steps, hints and options that are real text
//             (no undefined, NaN, [object Object]), whose every $…$ segment
//             KaTeX parses without error, and a figure that is self-contained
//             SVG;
//   IDENTITY  carry its jurisdiction, syllabus id and version and at least one
//             CURRENT outcome code (ADR-0002 decision 7).
//
// and every cell must be able to produce an issuable question at all, and
// enough distinct ones (DISTINCT_FLOOR) that practice is not one item on loop.
// Every dot point the curriculum response advertises as `generated` must be
// reachable by asking for it.
//
// A cell or bank that fails is NOT patched over here: it goes into
// NSW_QUALITY_EXCLUSIONS in nswBanks.js with its reason, and is then not
// issued. This suite re-sweeps each exclusion and fails if one names something
// that no longer fails, so the record cannot go stale in either direction.
//
// Usage: node client/test/nsw-bank-quality-check.mjs [seeds-per-cell] [--ledger]
// SYNTHETIC: the deterministic checker in-process on generated questions. It is
// not evidence about real students, real examiners or NESA approval.
// ─────────────────────────────────────────────────────────────────────────────
import katex from 'katex';

const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { parse, evaluate } = await import(`${SRC}engine/expr.js`);
const { NSW_OUTCOME_BY_CODE, NSW_SYLLABUS_BY_ID, LEGACY_CROSSWALK } = await import(`${SRC}engine/curriculum-nsw/index.js`);
const {
  NSW_BANK_LEDGER, NSW_QUALITY_EXCLUSIONS, NSW_BANK_COUNT, NSW_CELL_COUNT,
  nswBank, nswCell, nswIssuable, nswCandidate, nswQuestionIdentity, nswCurriculumResponse
} = await import('../../server/platform/nswBanks.js');
const { answerTextFor } = await import('../../server/platform/practice.js');
const { figureHasExternalRef } = await import('../../server/platform/figureRefs.js');
await loadAllBanks();

const args = process.argv.slice(2);
const SEEDS = Number(args.find(a => /^\d+$/.test(a))) || 48;
const SHOW_LEDGER = args.includes('--ledger');
const DISTINCT_FLOOR = 6;
const D13 = /Work it out first/;

const fmt = x => (!Number.isFinite(x) ? String(x) : Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12))));
const differs = (a, b) => Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const verdict = (q, input) => { try { return checkAnswer(q, input); } catch (err) { return { correct: false, invalid: true, feedback: `threw ${err.message}` }; } };

// ── The key, as the answer box takes it ─────────────────────────────────────
function keyOf(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'numeric':
      if (a.canonicalInput) return a.canonicalInput;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction && a.simplestFraction.d !== 1) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      return Number.isFinite(a.value) ? fmt(a.value) : null;
    case 'set': return Array.isArray(a.values) && a.values.length ? a.values.map(fmt).join(', ') : null;
    case 'point': return `(${fmt(a.x)}, ${fmt(a.y)})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'expression': return a.expr ?? null;
    case 'mcq': return Number.isInteger(a.correctIndex) ? String(a.correctIndex) : null;
    default: return null;
  }
}

// ── Wrong answers (this suite's own; never read from the marker) ────────────
/** The widest band a numeric key could be accepted in, from the question alone. */
function bandOf(v, tol) {
  if (tol != null) return tol;
  if (Number.isInteger(v)) return Math.min(0.25, Math.max(1e-9, Math.abs(v) * 1e-9));
  const text = String(Math.abs(v));
  const places = /e/i.test(text) ? Infinity : (text.split('.')[1] || '').length;
  const cap = places <= 2 ? 0.5 * 10 ** -places : 0.05;
  return Math.min(cap, Math.max(1e-6, Math.abs(v) * 1e-4));
}
function numericWrongs(a) {
  const v = a.value, band = bandOf(v, a.tol), out = [];
  const push = (x, why) => { if (Number.isFinite(x) && Math.abs(x - v) > band * 1.0000001 && differs(x, v)) out.push({ input: fmt(x), why }); };
  push(-v, 'sign'); push(v + 1, '+1'); push(v - 1, '-1');
  if (v !== 0 && Math.abs(v) !== 1) push(1 / v, 'reciprocal');
  push(v * 10, '×10'); push(v / 10, '÷10');
  const step = Math.max(band * 3, Math.abs(v) * 0.01, 1e-3);
  push(v + step, 'close above'); push(v - step, 'close below');
  if (a.simplestFraction && a.simplestFraction.d !== 1) {
    const { n, d } = a.simplestFraction;
    push((n + 1) / d, 'numerator+1'); push(n / (d + 1), 'denominator+1');
    if (n !== 0) push(d / n, 'flipped fraction');
  }
  return out;
}
function setWrongs(a) {
  const vals = a.values, out = [], tol = a.tol ?? 1e-6;
  const has = x => vals.some(v => Math.abs(v - x) <= Math.max(tol, bandOf(v, a.tol)));
  const list = arr => arr.map(fmt).join(', ');
  if (vals.length > 1) out.push({ input: list(vals.slice(1)), why: 'a solution dropped' });
  out.push({ input: list([...vals, Math.max(...vals) + 1]), why: 'an extra solution' });
  vals.forEach((value, i) => {
    if (!has(-value)) out.push({ input: list(vals.map((v, j) => (j === i ? -value : v))), why: `solution ${i + 1} negated` });
    if (!has(value + 1)) out.push({ input: list(vals.map((v, j) => (j === i ? value + 1 : v))), why: `solution ${i + 1} shifted` });
  });
  return out;
}
function pointWrongs(a) {
  const pt = (x, y) => `(${fmt(x)}, ${fmt(y)})`, out = [];
  if (differs(a.x, a.y)) out.push({ input: pt(a.y, a.x), why: 'coordinates swapped' });
  if (a.x !== 0) out.push({ input: pt(-a.x, a.y), why: 'x negated' });
  if (a.y !== 0) out.push({ input: pt(a.x, -a.y), why: 'y negated' });
  out.push({ input: pt(a.x + 1, a.y), why: 'x shifted' }, { input: pt(a.x, a.y + 1), why: 'y shifted' });
  return out;
}
function ratioWrongs(a) {
  const out = [{ input: `${a.a + 1}:${a.b}`, why: 'first part shifted' }];
  if (a.a !== a.b) out.push({ input: `${a.b}:${a.a}`, why: 'ratio reversed' });
  return out;
}
/** Independent non-equivalence: both evaluated where both are defined. */
function clearlyDifferent(e1, e2) {
  let t1, t2;
  try { t1 = parse(e1); t2 = parse(e2); } catch { return false; }
  let compared = 0, diff = 0;
  for (const p of [0.37, 1.3, 2.71, -0.83, 3.9, 0.61, 5.2, -2.4]) {
    // Every single-letter name gets its own value (e stays Euler's number).
    const scope = { theta: p, θ: p };
    for (const [i, letter] of [...'abcdfghjklmnpqrstuvwxyz'].entries()) scope[letter] = p * (1 + 0.13 * i) + 0.07 * i;
    scope.r = Math.abs(scope.r) + 0.5;
    let v1, v2;
    try { v1 = evaluate(t1, scope); v2 = evaluate(t2, scope); } catch { continue; }
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;
    compared++;
    if (Math.abs(v1 - v2) > 1e-7 * Math.max(1, Math.abs(v1))) diff++;
  }
  return compared >= 4 && diff >= Math.ceil(compared / 2);
}
function expressionWrongs(q, a) {
  const e = a.expr;
  // An antiderivative is any one of a family: a constant added to it is still right.
  const antiderivative = a.stripC || /\+\s*C\b|∫|\\int\b/.test(String(q.prompt || ''));
  const cands = [[`-(${e})`, 'negated'], [`2*(${e})`, 'doubled'], [`1.001*(${e})`, '0.1% scale']];
  if (!antiderivative) cands.push([`(${e}) + 1`, '+1'], [`(${e}) + 0.001`, 'tiny offset']);
  if (/x/.test(e)) cands.push([e.replace(/x/g, '(x+1)'), 'variable shifted']);
  return cands.filter(([input]) => input.length <= 118 && [e, ...(a.anyOf || [])].every(c => clearlyDifferent(input, c)))
    .map(([input, why]) => ({ input, why }));
}
function wrongsFor(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'numeric': return typeof a.value === 'number' ? numericWrongs(a) : [];
    case 'set': return Array.isArray(a.values) && a.values.length ? setWrongs(a) : [];
    case 'point': return pointWrongs(a);
    case 'ratio': return ratioWrongs(a);
    case 'expression': return a.expr ? expressionWrongs(q, a) : [];
    case 'mcq': return (q.mcqOptions || []).map((_, i) => i).filter(i => i !== a.correctIndex).map(i => ({ input: String(i), why: `option ${i}` }));
    default: return [];
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────
const BROKEN_TEXT = /\bundefined\b|\bNaN\b|\[object |\bInfinity\b/;
const COMMANDS = /\\(?:text|mathrm|textbf|operatorname|mathbf)\{[^}]*\}|\\[A-Za-z]+/g;
/**
 * Why this text would not render as written, or null. The split is MathText's
 * (client/src/lib/latex.jsx): $…$ is maths, \$ is a dollar sign, and a `$`
 * left unpaired is shown as a dollar sign too. So an unpaired `$` is sound
 * only where it reads as money (before a digit, or alone as an answer-box
 * prefix), and a maths segment that holds a run of ordinary words is a money
 * `$` that paired with a maths `$` and swallowed the sentence between them.
 */
function renderFault(text) {
  if (typeof text !== 'string') return 'is not text';
  const parts = text.split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const bare = parts[i].replace(COMMANDS, ' ');
      if (BROKEN_TEXT.test(bare)) return `maths holds a broken value: ${parts[i].slice(0, 60)}`;
      if (/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(bare)) return `words inside maths (a money $ paired with a maths $?): ${parts[i].slice(0, 60)}`;
      try { katex.renderToString(parts[i], { throwOnError: true, strict: false }); } catch (err) { return `KaTeX: ${String(err.message).slice(0, 90)}`; }
      totals.mathSegments++;
    } else {
      const lone = [...parts[i].matchAll(/(?<!\\)\$/g)];
      if (lone.some(m => !/^\$\s?\d/.test(parts[i].slice(m.index)) && parts[i].trim() !== '$')) return 'an unpaired $ that is not a money sign';
      if (BROKEN_TEXT.test(parts[i])) return `text holds a broken value: ${parts[i].trim().slice(0, 60)}`;
    }
  }
  return null;
}
function renderFaults(q) {
  const faults = [];
  const say = (where, text) => { const fault = renderFault(text); if (fault) faults.push(`${where} ${fault}`); };
  if (typeof q.prompt !== 'string' || !q.prompt.trim()) faults.push('prompt is empty');
  else say('prompt', q.prompt);
  if (!Array.isArray(q.steps) || !q.steps.length) faults.push('no worked steps');
  for (const [i, step] of (q.steps || []).entries()) {
    say(`step ${i + 1} heading`, String(step?.h ?? ''));
    say(`step ${i + 1}`, String(step?.d ?? ''));
  }
  for (const [i, hint] of (q.hints || []).entries()) say(`hint ${i + 1}`, hint);
  for (const [i, option] of (q.mcqOptions || []).entries()) say(`option ${i}`, String(option));
  for (const key of ['answerPrefix', 'answerSuffix']) if (q[key] != null && q[key] !== '') say(key, String(q[key]));
  if (q.figure != null) {
    if (typeof q.figure !== 'string' || !/^\s*<svg[\s>]/.test(q.figure) || !/<\/svg>\s*$/.test(q.figure)) faults.push('figure is not one SVG element');
    else if (figureHasExternalRef(q.figure)) faults.push('figure references something outside itself');
    else if (BROKEN_TEXT.test(q.figure)) faults.push('figure holds a broken value');
  }
  const printed = answerTextFor(q);
  if (q.answerType !== 'mcq' && (typeof printed !== 'string' || !printed.trim() || BROKEN_TEXT.test(printed))) faults.push(`the printed answer is ${JSON.stringify(printed)}`);
  return faults;
}
function optionFaults(q) {
  if (q.answerType !== 'mcq') return [];
  const options = Array.isArray(q.mcqOptions) ? q.mcqOptions.map(o => String(o ?? '').replace(/\s+/g, ' ').trim()) : [];
  const faults = [];
  if (options.length < 3) faults.push(`only ${options.length} options`);
  if (options.some(o => !o)) faults.push('a blank option');
  if (new Set(options).size !== options.length) faults.push(`repeated options ${JSON.stringify(options)}`);
  if (!Number.isInteger(q.answer?.correctIndex) || q.answer.correctIndex < 0 || q.answer.correctIndex >= options.length) faults.push('the key is not one of the options');
  return faults;
}
function identityFaults(q, generator) {
  const id = nswQuestionIdentity(q, generator);
  if (!id) return ['no curriculum identity'];
  const faults = [];
  if (id.jurisdiction !== 'NSW' || id.authority !== 'NESA') faults.push('wrong jurisdiction');
  if (NSW_SYLLABUS_BY_ID[id.syllabus]?.status !== 'current' || id.syllabusVersion !== NSW_SYLLABUS_BY_ID[id.syllabus].version) faults.push('syllabus is not a current one with its version');
  if (!id.outcomes.length) faults.push('no outcome code');
  for (const o of id.outcomes) {
    const known = NSW_OUTCOME_BY_CODE[o.code];
    if (!known || known.syllabus !== o.syllabus || NSW_SYLLABUS_BY_ID[o.syllabus].version !== o.syllabusVersion) faults.push(`outcome ${o.code} is not a current outcome of ${o.syllabus}`);
  }
  return faults;
}

// ── One cell ────────────────────────────────────────────────────────────────
const totals = { cells: 0, questions: 0, issuable: 0, notIssuable: 0, keys: 0, printed: 0, d13: 0, wrongs: 0, mcq: 0, mathSegments: 0 };
const byType = {};
/** Sweep one cell. Returns { faults: Map<kind, string[]>, issuable, distinct }. */
function sweepCell(generator, difficulty, count = true, admitted = nswIssuable) {
  const faults = new Map();
  const add = (kind, text) => { if (!faults.has(kind)) faults.set(kind, []); faults.get(kind).push(text); };
  const seen = new Set();
  let issuable = 0, generated = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = ((i + 1) * 2654435761 + difficulty * 40503 + generator.length * 97) >>> 0 & 0x7fffffff;
    let q;
    try { q = generateQuestion(generator, difficulty, seed); } catch (err) { add('THROWS', `seed ${seed}: ${String(err.message).slice(0, 100)}`); continue; }
    generated++;
    if (count) totals.questions++;
    if (!admitted(q, generator)) { if (count) totals.notIssuable++; continue; }
    issuable++;
    seen.add(q.contentHash);
    if (count) { totals.issuable++; byType[q.answerType] = (byType[q.answerType] || 0) + 1; }
    const where = `seed ${seed}`;
    if (q.difficulty !== difficulty || q.subtopic !== generator) add('IDENTITY', `${where}: generated as ${q.subtopic} D${q.difficulty}`);
    if (admitted === nswIssuable) for (const fault of identityFaults(q, generator)) add('IDENTITY', `${where}: ${fault}`);
    for (const fault of renderFaults(q)) add('RENDERS', `${where}: ${fault}`);
    for (const fault of optionFaults(q)) add('OPTIONS', `${where}: ${fault}`);
    const key = keyOf(q);
    if (key == null) { add('KEY', `${where}: no key can be written for answer type ${q.answerType}`); continue; }
    if (count) totals.keys++;
    const own = verdict(q, key);
    if (own.correct !== true) add('KEY', `${where}: the stored answer ${JSON.stringify(key)} is ${own.invalid ? 'unread' : 'marked wrong'} (${String(own.feedback || '').slice(0, 80)})`);
    if (q.answerType !== 'mcq') {
      const printed = String(answerTextFor(q) ?? '');
      if (printed && printed !== key) {
        if (count) totals.printed++;
        const shown = verdict(q, printed);
        if (shown.correct !== true) {
          if (shown.invalid === true && D13.test(shown.feedback || '')) { if (count) totals.d13++; }
          else add('KEY', `${where}: the printed answer ${JSON.stringify(printed)} is ${shown.invalid ? 'unread' : 'marked wrong'} (${String(shown.feedback || '').slice(0, 80)})`);
        }
      }
    } else if (count) totals.mcq++;
    const wrongs = wrongsFor(q);
    if (!wrongs.length) add('WRONG', `${where}: no wrong answer could be built for ${q.answerType} key ${JSON.stringify(key)}`);
    for (const wrong of wrongs) {
      if (count) totals.wrongs++;
      if (verdict(q, wrong.input).correct === true) add('WRONG', `${where}: ${JSON.stringify(wrong.input)} (${wrong.why}) is marked correct; key ${JSON.stringify(key)}`);
    }
  }
  if (generated && !issuable) add('EMPTY', 'no question this cell generates has a final answer to mark');
  else if (issuable && seen.size < Math.min(DISTINCT_FLOOR, SEEDS)) add('DISTINCT', `only ${seen.size} distinct questions in ${issuable} draws`);
  return { faults, issuable, distinct: seen.size };
}
const describe = faults => [...faults].map(([kind, list]) => `${kind} ×${list.length} — ${list[0]}`).join('; ');

// ── 1 · The ledger is consistent with the crosswalk and the engine ──────────
const problems = [];
const fail = text => problems.push(text);
if (NSW_BANK_LEDGER.length !== LEGACY_CROSSWALK.length) fail('the ledger does not have one entry per crosswalk row');
for (const entry of NSW_BANK_LEDGER) {
  if (typeof GENERATORS[entry.generator] !== 'function') fail(`${entry.generator}: the ledger names a generator the engine does not have`);
  if (entry.issued !== nswBank(entry.generator)) fail(`${entry.generator}: ledger and nswBank() disagree`);
  if (entry.status !== 'mapped' && entry.issued) fail(`${entry.generator}: a ${entry.status} row is issued`);
  if (!entry.issued && !entry.reason) fail(`${entry.generator}: not issued, and no reason is recorded`);
  for (const cell of entry.cells) {
    if (cell.issued !== nswCell(entry.generator, cell.difficulty)) fail(`${entry.generator} D${cell.difficulty}: ledger and nswCell() disagree`);
    if (!cell.issued && !cell.reason) fail(`${entry.generator} D${cell.difficulty}: not issued, and no reason is recorded`);
  }
}
for (const key of Object.keys(NSW_QUALITY_EXCLUSIONS)) {
  const [generator, d] = key.split('|');
  const entry = NSW_BANK_LEDGER.find(e => e.generator === generator);
  if (!entry) { fail(`exclusion ${key} names no crosswalk generator`); continue; }
  if (entry.status !== 'mapped') fail(`exclusion ${key} is redundant: the row is ${entry.status} and never issued`);
  if (d !== undefined && !entry.cells.some(cell => String(cell.difficulty) === d)) fail(`exclusion ${key} names no difficulty`);
  if (!String(NSW_QUALITY_EXCLUSIONS[key] || '').trim()) fail(`exclusion ${key} has no reason`);
}
for (const id of Object.keys(GENERATORS)) {
  if (nswBank(id) && !NSW_BANK_LEDGER.some(e => e.generator === id)) fail(`${id} is issued without a ledger entry`);
}
// An India generator is never an NSW bank.
for (const id of Object.keys(GENERATORS)) if (/^(?:c\d|olymp|jee|pyq)/.test(id) && nswBank(id)) fail(`${id}: an India bank is issued as NSW`);

// ── 2 · Every issued cell passes ────────────────────────────────────────────
const cellFailures = [];
for (const entry of NSW_BANK_LEDGER) for (const cell of entry.cells) {
  if (!cell.issued) continue;
  totals.cells++;
  const { faults } = sweepCell(entry.generator, cell.difficulty);
  if (faults.size) cellFailures.push(`${entry.generator} D${cell.difficulty}: ${describe(faults)}`);
}

// ── 3 · Every quality exclusion still fails (the record is not stale) ───────
const exclusionNotes = [];
for (const [key, reason] of Object.entries(NSW_QUALITY_EXCLUSIONS)) {
  const [generator, d] = key.split('|');
  const entry = NSW_BANK_LEDGER.find(e => e.generator === generator);
  if (!entry || typeof GENERATORS[generator] !== 'function') continue;
  const levels = d !== undefined ? [Number(d)] : entry.cells.map(cell => cell.difficulty);
  const found = levels.map(level => ({ level, ...sweepCell(generator, level, false, nswCandidate) })).filter(r => r.faults.size);
  if (!found.length) fail(`exclusion ${key} ("${reason}") no longer fails the sweep: issue it, or record a reason the sweep can see`);
  else exclusionNotes.push(`${key}: ${found.map(r => `D${r.level} ${describe(r.faults)}`).join(' | ').slice(0, 300)}`);
}

// ── 4 · Every advertised dot point can be asked for ─────────────────────────
const curriculum = nswCurriculumResponse();
let advertised = 0, targetsChecked = 0;
for (const syllabus of curriculum.syllabuses) for (const subtopic of syllabus.subtopics) for (const dp of subtopic.dotpoints) {
  if (dp.generated !== (dp.practice.length > 0)) fail(`${dp.code}: generated does not match its practice targets`);
  if (!dp.generated) continue;
  advertised++;
  for (const target of dp.practice) {
    for (const difficulty of target.difficulties) {
      targetsChecked++;
      if (!nswCell(target.generator, difficulty)) { fail(`${dp.code}: advertises ${target.generator} D${difficulty}, which is not issued`); continue; }
      let hit = 0;
      for (let i = 0; i < 24 && !hit; i++) {
        let q;
        try { q = generateQuestion(target.generator, difficulty, 1000003 * (i + 1), target.dotpoint); } catch { continue; }
        if (q.difficulty !== difficulty || !nswIssuable(q, target.generator)) continue;
        const id = nswQuestionIdentity(q, target.generator);
        if (id.dotpoints.includes(target.dotpoint) && id.outcomes.some(o => o.code === dp.code)) hit++;
      }
      if (!hit) fail(`${dp.code}: asking ${target.generator} D${difficulty} for ${target.dotpoint} never yields an issuable question carrying it`);
    }
  }
}
if (curriculum.outcomes.generated !== advertised) fail('the curriculum response miscounts its generated outcomes');

// ── Report ──────────────────────────────────────────────────────────────────
if (SHOW_LEDGER) {
  for (const entry of NSW_BANK_LEDGER) {
    const levels = entry.cells.map(cell => (cell.issued ? `D${cell.difficulty}` : `(D${cell.difficulty})`)).join(' ');
    console.log(`${entry.issued ? 'ISSUED  ' : 'EXCLUDED'} ${entry.generator.padEnd(22)} ${entry.syllabus.padEnd(40)} ${levels}${entry.issued ? '' : `  — ${entry.reason}`}`);
    for (const cell of entry.cells) if (entry.issued && !cell.issued) console.log(`           · D${cell.difficulty} not issued — ${cell.reason}`);
  }
}
const perSyllabus = new Map();
for (const entry of NSW_BANK_LEDGER) {
  const row = perSyllabus.get(entry.syllabus) || { issued: 0, excluded: 0, cells: 0 };
  if (entry.issued) row.issued++; else row.excluded++;
  row.cells += entry.cells.filter(cell => cell.issued).length;
  perSyllabus.set(entry.syllabus, row);
}
for (const [id, row] of perSyllabus) console.log(`${id}: ${row.issued} generators issued (${row.cells} cells), ${row.excluded} excluded`);
for (const s of curriculum.syllabuses) console.log(`${s.id}: ${s.outcomes.generated} of ${s.outcomes.total} outcomes have an issued question behind them`);
for (const note of exclusionNotes) console.log(`excluded, still failing — ${note}`);
console.log(`${totals.issuable} issuable questions over ${totals.cells} cells × ${SEEDS} seeds (${totals.notIssuable} generated forms have no final answer and are never issued); ` +
  `${totals.keys} keys and ${totals.printed} printed answers accepted (${totals.d13} of the printed refused only by D13), ${totals.wrongs} wrong answers refused, ${totals.mcq} multiple-choice items with distinct options; ` +
  `${advertised} outcomes advertised, ${targetsChecked} advertised targets reachable; by type ${JSON.stringify(byType)}`);
const all = [...problems, ...cellFailures];
console.log(all.length
  ? `NSW BANK QUALITY: FAIL — ${all.length} problems\n  · ${all.slice(0, Number(process.env.SWEEP_SHOW) || 80).join('\n  · ')}`
  : `NSW BANK QUALITY: PASS — ${NSW_BANK_COUNT} generators, ${NSW_CELL_COUNT} cells issued; every stored answer accepted, every wrong answer refused, options distinct, prompts render, identity carried. [SYNTHETIC]`);
process.exit(all.length ? 1 : 0);
