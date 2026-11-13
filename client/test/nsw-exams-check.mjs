// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW HSC-style paper blueprints (plan mission G4)
//
// The blueprints (client/src/engine/nswExams.js) as data, the release check,
// and a false-positive sweep of every question a blueprint slot can draw,
// marked the way a sealed paper is marked.
//
//   · every blueprint cites NESA's specification page and the research note,
//     and its times, marks, sections and item counts are the specification's
//     (docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §5.3);
//   · every slot is on a CURRENT outcome of the blueprint's own syllabus (the
//     G2 model), of its own course (Standard 1 never takes a Standard 2
//     outcome), and every Year 12 outcome of the examined course has a slot:
//     the design is the course's, not the content's;
//   · blueprintReleasable is false whenever any slot has fewer than three
//     distinct approved forms, a form counted twice is one form, and a form
//     off the slot's outcome never counts;
//   · the server's pool holds issued NSW forms only: no India bank, no
//     excluded cell, so no slot can ever be filled by an India generator;
//   · docs/content/nsw-papers-released.md is the release check's own output
//     (`node tools/nsw-exam-releases.mjs --write` regenerates it);
//   · SWEEP: for every approved form on any blueprint slot's outcome, over
//     several seeds, the server's exam marker (final answer only) gives the
//     question's own answer full marks and every near miss 0 — sign, ±1, ×10,
//     ÷10, a close value outside the tolerance, the wrong last digit at a
//     named precision; a dropped, extra, negated or shifted solution; swapped
//     or shifted coordinates; a non-equivalent expression; every other option.
//
// Usage: node client/test/nsw-exams-check.mjs [seeds-per-form]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();
const {
  NSW_EXAM_BLUEPRINTS, NSW_EXAM_LABEL, NSW_MIN_FORMS_PER_SLOT, NSW_RELEASE_FLOOR, DIFFICULTIES_FOR_MARKS,
  blueprintRelease, blueprintReleasable, formsForSlot, slotsOf, outcomesOf, tallyOf, nswExamBlueprint, nswPaperTitle, scaledMinutes
} = await import(`${SRC}engine/nswExams.js`);
const { NSW_OUTCOME_BY_CODE, NSW_SYLLABUS_BY_ID, outcomesOf: syllabusOutcomes } = await import(`${SRC}engine/curriculum-nsw/index.js`);
const { parse, evaluate } = await import(`${SRC}engine/expr.js`);
const { NSW_EXAM_POOL, NSW_TEST_BLUEPRINT, year12OutcomesOf, releaseOf } = await import('../../server/platform/nswExamPool.js');
const { NSW_BANK_LEDGER, nswIssuable } = await import('../../server/platform/nswBanks.js');
const { indiaBank } = await import('../../server/platform/indiaBanks.js');
const { MARKER_OPS } = await import('../../server/platform/markerOps.js');
const { FINAL_ANSWER_ONLY } = await import('../../server/platform/markingPolicy.js');
const { renderReleases } = await import('../../tools/nsw-exam-releases.mjs');

const SEEDS = Number(process.argv[2]) || 8;
let checks = 0;
const failures = [];
const check = (cond, msg) => { checks++; if (!cond) failures.push(msg); };

// ── The specification, as G1 recorded it (§5.3) ─────────────────────────────
const SPEC = {
  'nsw-hsc-standard-1-2027': { workingMin: 120, totalMarks: 80, I: 15, II: 65, items: [25, 30], course: /^MST-(11-\d\d|12-S1-\d\d)$/, year12: /^MST-12-S1-/ },
  'nsw-hsc-standard-2-2027': { workingMin: 150, totalMarks: 100, I: 15, II: 85, items: [35, 40], course: /^MST-(11-\d\d|12-S2-\d\d)$/, year12: /^MST-12-S2-/ },
  'nsw-hsc-advanced-2027': { workingMin: 180, totalMarks: 100, I: 10, II: 90, items: [37, 42], course: /^MAV-1[12]-\d\d$/, year12: /^MAV-12-/, fourOrFive: 2 },
  'nsw-hsc-extension-1-2027': { workingMin: 120, totalMarks: 70, I: 10, II: 60, items: [23, 28], course: /^ME1-1[12]-\d\d$/, year12: /^ME1-12-/ },
  'nsw-hsc-extension-2-2027': { workingMin: 180, totalMarks: 100, I: 10, II: 90, items: [37, 42], course: /^ME2-12-\d\d$/, year12: /^ME2-12-/ }
};
check(NSW_EXAM_BLUEPRINTS.length === 5 && NSW_EXAM_BLUEPRINTS.every(b => SPEC[b.id]), 'one blueprint per examined course: Standard 1, Standard 2, Advanced, Extension 1, Extension 2');
for (const b of NSW_EXAM_BLUEPRINTS) {
  const s = SPEC[b.id];
  const t = tallyOf(b);
  check(b.source.authority === 'NESA' && /^https:\/\/curriculum\.nsw\.edu\.au\/learning-areas\/mathematics\/mathematics-[a-z0-9-]+-11-12-2024\/assessment\/hsc-examinations$/.test(b.source.url)
    && b.source.accessed && b.source.research.includes('NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md'), `${b.id} cites NESA's specification page and the research note`);
  check(b.readingMin === 10 && b.workingMin === s.workingMin && b.totalMarks === s.totalMarks, `${b.id}: 10 minutes reading, ${s.workingMin} minutes working, ${s.totalMarks} marks`);
  check(t.sectionIMarks === s.I && t.sectionIItems === s.I, `${b.id}: Section I is ${s.I} one-mark questions (${t.sectionIItems}, ${t.sectionIMarks} marks)`);
  check(t.sectionIIMarks === s.II && t.sectionIIItems >= s.items[0] && t.sectionIIItems <= s.items[1], `${b.id}: Section II is ${s.II} marks in ${s.items.join('–')} questions (${t.sectionIIMarks} in ${t.sectionIIItems})`);
  check(t.totalMarks === b.totalMarks, `${b.id}: the slots sum to the paper's marks`);
  check(slotsOf(b).every(slot => Number.isInteger(slot.marks) && slot.marks >= 1 && slot.marks <= 5 && slot.difficulties === DIFFICULTIES_FOR_MARKS[slot.marks]), `${b.id}: every slot is worth 1–5 marks`);
  if (s.fourOrFive) check(b.sections[1].slots.filter(slot => slot.marks >= 4).length >= s.fourOrFive, `${b.id}: at least two Section II questions worth 4–5 marks`);
  // Current outcomes of its own syllabus and course.
  const syllabus = NSW_SYLLABUS_BY_ID[b.syllabus];
  check(syllabus?.status === 'current' && syllabus.version === b.syllabusVersion, `${b.id} is on a current syllabus, version ${b.syllabusVersion}`);
  for (const slot of slotsOf(b)) {
    check(NSW_OUTCOME_BY_CODE[slot.outcome]?.syllabus === b.syllabus, `${b.id} slot ${slot.number}: ${slot.outcome} is a current outcome of ${b.syllabus}`);
    check(s.course.test(slot.outcome), `${b.id} slot ${slot.number}: ${slot.outcome} is this course's`);
  }
  // Every Year 12 outcome of the examined course has a slot.
  const year12 = syllabusOutcomes(syllabus).map(o => o.code).filter(code => s.year12.test(code));
  check(year12.length > 0 && year12.every(code => outcomesOf(b).includes(code)), `${b.id}: every Year 12 outcome of the examined course has a slot (${year12.length})`);
  check(nswExamBlueprint(b.id) === b, `${b.id} is found by id`);
}
check(nswExamBlueprint('constructor') === null && nswExamBlueprint(NSW_TEST_BLUEPRINT.id) === null, 'no inherited or test blueprint is found by id in the engine');

// ── The release check ───────────────────────────────────────────────────────
check(NSW_MIN_FORMS_PER_SLOT === 3 && NSW_RELEASE_FLOOR === 0.75, 'the rule: three distinct forms per slot; a partial paper needs 75% of the course\'s Year 12 outcomes');
for (const b of NSW_EXAM_BLUEPRINTS) {
  const y12 = year12OutcomesOf(b);
  const model = syllabusOutcomes(NSW_SYLLABUS_BY_ID[b.syllabus]).filter(o => o.year === 12 && SPEC[b.id].year12.test(o.code)).map(o => o.code);
  check(y12.length > 0 && JSON.stringify(y12) === JSON.stringify(model), `${b.id}: its Year 12 outcomes come from the G2 model (${y12.length})`);
}
{
  const b = NSW_EXAM_BLUEPRINTS.find(x => x.id === 'nsw-hsc-extension-1-2027');
  const outcomes = outcomesOf(b);
  const year12Outcomes = year12OutcomesOf(b);           // ME1-12-01 … ME1-12-06
  const y12 = { year12Outcomes };
  const forms = (n, skip = new Set()) => outcomes.filter(code => !skip.has(code)).flatMap((code, i) => Array.from({ length: n }, (_, k) => ({ generator: `gen-${code}-${k}`, difficulty: 1 + (k % 4), outcomes: [code] })));
  const all = blueprintRelease(b, forms(NSW_MIN_FORMS_PER_SLOT), y12);
  check(all.released && all.full && all.included.length === all.slots.length && all.marks === b.totalMarks && all.workingMin === b.workingMin, 'three distinct forms on every outcome: the whole paper, at full marks and time');
  check(nswPaperTitle(b, all) === `${b.label} · ${NSW_EXAM_LABEL}`, 'a whole paper is an answer-checked practice paper');
  check(!blueprintReleasable(b, forms(NSW_MIN_FORMS_PER_SLOT - 1), y12), 'two forms on every outcome: refused');
  check(!blueprintReleasable(b, forms(NSW_MIN_FORMS_PER_SLOT)), 'without the course\'s Year 12 outcomes nothing is released');
  // The floor, exactly: 6 Year 12 outcomes, 75% = 4.5, so 5 covered is released and 4 is refused.
  const drop = n => new Set(year12Outcomes.slice(0, n));
  const five = blueprintRelease(b, forms(NSW_MIN_FORMS_PER_SLOT, drop(1)), y12);
  const four = blueprintRelease(b, forms(NSW_MIN_FORMS_PER_SLOT, drop(2)), y12);
  check(five.released && !five.full && five.year12.covered === 5 && five.year12.total === 6, '5 of 6 Year 12 outcomes (83%): a partial paper is released');
  check(!four.released && four.year12.covered === 4 && four.included.length === 0 && four.marks === 0, '4 of 6 (67%), below the floor: refused, nothing set');
  check(five.included.every(slot => slot.outcome !== year12Outcomes[0]) && five.omittedOutcomes.join() === year12Outcomes[0], 'a partial paper sets no slot on what it omits, and names it');
  check(five.marks === five.included.reduce((n, slot) => n + slot.marks, 0) && five.marks < b.totalMarks && five.workingMin === scaledMinutes(b.workingMin, five.marks, b.totalMarks) && five.workingMin < b.workingMin,
    `its marks (${five.marks}) and working time (${five.workingMin} min) are scaled to what it examines`);
  const title = nswPaperTitle(b, five);
  check(title === `${b.label} · Practice paper — 5 of 6 Year 12 outcomes` && !/HSC|trial/i.test(title), `a partial paper is titled by its coverage, never HSC or trial: "${title}"`);
  // An omitted Year 11 outcome lowers nothing in the floor but is still omitted.
  const y11gap = blueprintRelease(b, forms(NSW_MIN_FORMS_PER_SLOT, new Set(['ME1-11-05'])), y12);
  check(y11gap.released && !y11gap.full && y11gap.year12.covered === 6 && y11gap.omittedOutcomes.join() === 'ME1-11-05', 'a Year 11 gap leaves the Year 12 floor whole but is still omitted and named');
  const doubled = [...forms(2), ...forms(2)];
  check(!blueprintReleasable(b, doubled, y12), 'the same form listed twice is still one form');
  check(!blueprintReleasable(b, forms(NSW_MIN_FORMS_PER_SLOT).map(f => ({ ...f, outcomes: ['MAV-12-04'] })), y12), 'forms on another outcome never fill a slot');
  check(scaledMinutes(120, 30, 70) === 50 && scaledMinutes(120, 70, 70) === 120 && scaledMinutes(10, 1, 9) === 10, 'scaled minutes: whole five minutes, at least ten');
  const slot = { outcome: outcomes[0], difficulties: [3, 4] };
  const ordered = formsForSlot(slot, [{ generator: 'a', difficulty: 1, outcomes: [outcomes[0]] }, { generator: 'b', difficulty: 4, outcomes: [outcomes[0]] }]);
  check(ordered.map(f => f.generator).join() === 'b,a', 'a slot lists its preferred difficulties first, and still counts the others');
}
// On G3's pool, released exactly above the floor (no hand-entered list).
for (const b of NSW_EXAM_BLUEPRINTS) {
  const r = releaseOf(b);
  check(r.released === (r.year12.total > 0 && r.year12.covered / r.year12.total >= NSW_RELEASE_FLOOR), `${b.id}: ${r.year12.covered}/${r.year12.total} Year 12 outcomes covered → ${r.released ? (r.full ? 'released' : 'released, partial') : 'refused'}`);
}

// ── The pool: issued NSW forms only ─────────────────────────────────────────
{
  const issued = new Set(NSW_BANK_LEDGER.flatMap(e => e.cells.filter(cell => cell.issued).map(cell => `${e.generator}|${cell.difficulty}`)));
  check(NSW_EXAM_POOL.every(form => issued.has(`${form.generator}|${form.difficulty}`)), 'every pool form is an issued NSW cell');
  check(NSW_EXAM_POOL.every(form => !indiaBank(form.generator)), 'no pool form is an India bank');
  check(NSW_EXAM_POOL.every(form => form.outcomes.length && form.outcomes.every(code => NSW_OUTCOME_BY_CODE[code])), 'every pool form names current outcomes only');
  // So no slot of any blueprint can be filled by an India generator.
  const reachable = new Set(NSW_EXAM_BLUEPRINTS.flatMap(b => slotsOf(b).flatMap(slot => formsForSlot(slot, NSW_EXAM_POOL).map(form => form.generator))));
  check([...reachable].every(g => !indiaBank(g)), `no blueprint slot can draw an India generator (${reachable.size} generators reachable)`);
}

// ── The released list is the release check's output ─────────────────────────
{
  const doc = readFileSync(new URL('../../docs/content/nsw-papers-released.md', import.meta.url), 'utf8');
  check(doc === renderReleases(), 'docs/content/nsw-papers-released.md is current (node tools/nsw-exam-releases.mjs --write)');
}

// ── Wording ─────────────────────────────────────────────────────────────────
check(NSW_EXAM_LABEL === 'Answer-checked practice paper', 'the papers are called answer-checked practice papers');
{
  const text = readFileSync(new URL('../src/engine/nswExams.js', import.meta.url), 'utf8');
  check(!/\bbandFor\b|predict(ed)?Band|\bATAR\b\s*[:=]/.test(text.replace(/\/\/.*$/gm, '')), 'the blueprint module computes no band, ATAR or prediction');
}

// ── SWEEP ───────────────────────────────────────────────────────────────────
const fmt = x => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12))));
const differs = (a, b) => Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
function bandOf(v, tol) {
  if (tol != null) return tol;
  if (Number.isInteger(v)) return Math.min(0.25, Math.max(1e-9, Math.abs(v) * 1e-9));
  const text = String(Math.abs(v));
  const places = /e/i.test(text) ? Infinity : (text.split('.')[1] || '').length;
  const cap = places <= 2 ? 0.5 * 10 ** -places : 0.05;
  return Math.min(cap, Math.max(1e-6, Math.abs(v) * 1e-4));
}
function namedPrecision(text) {
  const s = String(text || '').toLowerCase();
  const m = /(\d+|one|two|three|four)\s*(?:decimal places?|d\.?\s?p\.?)/.exec(s);
  if (m) return { one: 1, two: 2, three: 3, four: 4 }[m[1]] ?? Number(m[1]);
  if (/nearest (whole number|integer|dollar|degree|unit|metre|cent)/.test(s)) return /cent\b/.test(s) && !/per ?cent/.test(s) ? 2 : 0;
  if (/nearest tenth/.test(s)) return 1;
  if (/nearest hundredth/.test(s)) return 2;
  return null;
}
function clearlyDifferent(e1, e2) {
  let t1, t2;
  try { t1 = parse(e1); t2 = parse(e2); } catch { return false; }
  let compared = 0, diff = 0;
  for (const p of [0.37, 1.3, 2.71, -0.83, 3.9, 0.61, 5.2, -2.4]) {
    const scope = { x: p, y: p * 0.7 + 0.3, t: p, n: p, a: p + 1.1, b: p * 1.3 - 0.2, k: p, u: p, v: p, m: p, r: Math.abs(p) + 0.5, theta: p, θ: p, z: p + 0.2 };
    let v1, v2;
    try { v1 = evaluate(t1, scope); v2 = evaluate(t2, scope); } catch { continue; }
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;
    compared++;
    if (Math.abs(v1 - v2) > 1e-7 * Math.max(1, Math.abs(v1))) diff++;
  }
  return compared >= 4 && diff >= Math.ceil(compared / 2);
}
function keyInput(q) {
  const a = q.answer;
  switch (q.answerType) {
    case 'numeric':
      if (a.canonicalInput) return a.canonicalInput;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction && a.simplestFraction.d !== 1) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      return fmt(a.value);
    case 'set': return a.values.map(fmt).join(', ');
    case 'point': return `(${fmt(a.x)}, ${fmt(a.y)})`;
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    default: return null;
  }
}
function probesFor(q) {
  const a = q.answer || {};
  const out = [];
  if (q.answerType === 'numeric' && typeof a.value === 'number') {
    const v = a.value, band = bandOf(v, a.tol);
    const push = (x, why) => { if (Number.isFinite(x) && Math.abs(x - v) > band * 1.0000001 && differs(x, v)) out.push({ input: fmt(x), why }); };
    push(-v, 'sign'); push(v + 1, '+1'); push(v - 1, '-1'); push(v * 10, '×10'); push(v / 10, '÷10');
    const step = Math.max(band * 3, Math.abs(v) * 0.01, 1e-3);
    push(v + step, 'close+'); push(v - step, 'close-');
    const p = namedPrecision(`${q.prompt} ${q.answerSuffix || ''}`);
    if (p != null) for (const off of [10 ** -p, -(10 ** -p)]) {
      const x = Number((Number(v.toFixed(p)) + off).toFixed(p));
      if (Math.abs(x - v) > 0.5 * 10 ** -p * (1 + 1e-6)) out.push({ input: fmt(x), why: `wrong last digit at ${p} d.p.` });
    }
  } else if (q.answerType === 'set' && Array.isArray(a.values) && a.values.length) {
    const vals = a.values, list = arr => arr.map(fmt).join(', ');
    const has = x => vals.some(v => Math.abs(v - x) <= Math.max(a.tol ?? 1e-6, bandOf(v, a.tol)));
    if (vals.length > 1) out.push({ input: list(vals.slice(1)), why: 'a solution dropped' });
    out.push({ input: list([...vals, Math.max(...vals) + 1]), why: 'an extra solution' });
    vals.forEach((v, i) => {
      if (!has(-v)) out.push({ input: list(vals.map((w, j) => (j === i ? -v : w))), why: `solution ${i + 1} negated` });
      if (!has(v + 1)) out.push({ input: list(vals.map((w, j) => (j === i ? v + 1 : w))), why: `solution ${i + 1} shifted` });
    });
  } else if (q.answerType === 'point') {
    const pt = (x, y) => `(${fmt(x)}, ${fmt(y)})`;
    if (differs(a.x, a.y)) out.push({ input: pt(a.y, a.x), why: 'swapped' });
    if (a.x !== 0) out.push({ input: pt(-a.x, a.y), why: 'x negated' });
    out.push({ input: pt(a.x + 1, a.y), why: 'x shifted' }, { input: pt(a.x, a.y + 1), why: 'y shifted' });
  } else if (q.answerType === 'expression' && a.expr) {
    const e = a.expr;
    const anti = a.stripC || /\+\s*C\b|∫|\\int\b/.test(String(q.prompt || ''));
    const cands = [[`-(${e})`, 'negated'], [`2*(${e})`, 'doubled']];
    if (!anti) cands.push([`(${e}) + 1`, '+1']);
    if (/x/.test(e)) cands.push([e.replace(/x/g, '(x+1)'), 'variable shifted']);
    for (const [input, why] of cands) if (clearlyDifferent(input, e) && (a.anyOf || []).every(other => clearlyDifferent(input, other))) out.push({ input, why });
  } else if (q.answerType === 'mcq') {
    (q.mcqOptions || []).forEach((_, i) => { if (i !== a.correctIndex) out.push({ input: String(i), why: `option ${i}` }); });
  }
  return out;
}
const examMark = (q, given, marks) => MARKER_OPS.exam({ q, given, working: given ? 'line one\nline two' : '', grid: { correct: marks, incorrect: 0, unanswered: 0 }, policy: FINAL_ANSWER_ONLY }, () => {}).response;

const blueprints = [...NSW_EXAM_BLUEPRINTS, NSW_TEST_BLUEPRINT];
const sweepForms = new Map();
for (const b of blueprints) for (const slot of slotsOf(b)) for (const form of formsForSlot(slot, NSW_EXAM_POOL)) {
  const key = `${form.generator}|${form.difficulty}`;
  const marks = sweepForms.get(key)?.marks || new Set();
  marks.add(slot.marks);
  sweepForms.set(key, { form, marks });
}
const sweep = { forms: sweepForms.size, questions: 0, keys: 0, probes: 0 };
const falseCorrect = [], keyRefused = [], partial = [];
for (const { form, marks } of sweepForms.values()) {
  const top = Math.max(...marks);
  for (let s = 1; s <= SEEDS; s++) {
    let q;
    try { q = generateQuestion(form.generator, form.difficulty, s * 7919 + form.difficulty * 31); } catch { continue; }
    if (!nswIssuable(q, form.generator)) continue;
    sweep.questions++;
    const key = keyInput(q);
    const id = `${form.generator}|${form.difficulty} seed ${s * 7919 + form.difficulty * 31}`;
    if (key == null) { keyRefused.push(`${id}: no key input for ${q.answerType}`); continue; }
    const k = examMark(q, key, top);
    sweep.keys++;
    if (!(k.correct === true && k.awarded === top)) keyRefused.push(`${id}: its own answer ${JSON.stringify(key)} earned ${k.awarded}/${top}`);
    for (const probe of probesFor(q)) {
      sweep.probes++;
      const r = examMark(q, probe.input, top);
      if (r.correct || r.awarded > 0) (r.correct ? falseCorrect : partial).push(`${id}: ${probe.why} ${JSON.stringify(probe.input)} for key ${JSON.stringify(key)} earned ${r.awarded}/${top}`);
    }
  }
}
check(sweep.questions > sweep.forms * Math.min(SEEDS, 4), `the sweep drew ${sweep.questions} questions from ${sweep.forms} forms`);
check(keyRefused.length === 0, `every question's own answer earns full marks (${keyRefused.length} refused)`);
check(falseCorrect.length === 0, `no near miss is marked correct (${falseCorrect.length} found)`);
check(partial.length === 0, `no near miss earns any mark: final answer only (${partial.length} found)`);

for (const f of [...keyRefused, ...falseCorrect, ...partial].slice(0, 25)) console.error(`  · ${f}`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`NSW EXAM BLUEPRINTS (G4): FAIL — ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
const releasedCount = NSW_EXAM_BLUEPRINTS.filter(b => releaseOf(b).released).length;
console.log(`NSW EXAM BLUEPRINTS (G4): PASS — ${checks} checks — ${NSW_EXAM_BLUEPRINTS.length} blueprints cited and held to NESA's specification, ${releasedCount} released on ${NSW_EXAM_POOL.length} approved forms; sweep: ${sweep.questions} questions from ${sweep.forms} forms, ${sweep.keys} keys accepted at full marks, ${sweep.probes} near misses all 0. [SYNTHETIC]`);
