// Every extra structural form (generators/forms/*) carries a check() that
// recomputes its key by a different route (a scan, a numeric evaluation, an
// enumeration). This proves each key on many seeds and refuses degenerate or
// ambiguous questions. Synthetic, in-process; no student evidence.
import { EXTRA_FORMS } from '../src/engine/generators/india-forms-extra.js';
import { makeRng } from '../src/engine/qhelpers.js';
import { workedStepHits } from './support/typesetting-rules.mjs';

const SEEDS = Number(process.env.SEEDS || 150);
let failures = 0, forms = 0, draws = 0, figured = 0;
const fail = (m) => { failures += 1; if (failures <= Number(process.env.SHOW || 30)) console.error('FAIL', m); };

for (const [skill, list] of Object.entries(EXTRA_FORMS)) {
  if (list.length < 4) fail(`${skill}: only ${list.length} extra forms (need ≥ 4 beyond the direct form)`);
  const tags = new Set(list.map(f => f.form));
  if (tags.size !== list.length) fail(`${skill}: duplicate form tags`);
  for (const f of list) {
    forms += 1;
    for (let d = 1; d <= 4; d++) {
      for (let i = 1; i <= SEEDS; i++) {
        const { payload, check } = f.make(makeRng(i * 7919 + d), d);
        draws += 1;
        const at = `${skill}/${f.form} d${d} seed${i}`;
        if (payload.form !== f.form) fail(`${at}: payload.form ${payload.form}`);
        if (!payload.prompt || /undefined|NaN|Infinity/.test(JSON.stringify(payload))) fail(`${at}: bad text`);
        if (!Array.isArray(payload.hints) || payload.hints.length < 3 || !Array.isArray(payload.steps) || !payload.steps.length) fail(`${at}: hints/steps missing`);
        if (payload.figure) {
          // A figure is drawn from the question's numbers and never prints the key: the unknown is '?'.
          const texts = [...payload.figure.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1].trim());
          if (!/<svg viewBox/.test(payload.figure) || /NaN|undefined/.test(payload.figure)) fail(`${at}: malformed figure`);
          const plane = /Coordinate plane|Bar chart/.test(payload.figure);   // axis ticks are not data labels
          if (payload.answerType === 'numeric' && !plane) {
            const key = String(payload.answer.value), given = (payload.prompt.match(/-?\d+(?:\.\d+)?/g) || []);
            const printed = texts.map(t => t.replace(/[^0-9.\-]/g, '')).filter(Boolean);
            if (printed.includes(key) && !given.includes(key)) fail(`${at}: the figure prints the key ${key}`);
          }
          figured += 1;
        }
        const got = check();
        const texts = [payload.prompt, ...(payload.mcqOptions || []), ...payload.hints, ...payload.steps.flatMap(x => [x.h, x.d])];
        for (const t of texts) for (const hit of workedStepHits(t)) fail(`${at}: typesetting ${hit.rule}: ${String(hit.math).slice(0, 90)}`);
        if (payload.answerType === 'numeric') {
          const v = payload.answer.value;
          if (!Number.isFinite(v) || !(Math.abs(got - v) <= 1e-6 * (1 + Math.abs(v)))) fail(`${at}: key ${v} ≠ independent ${got}`);
          for (const t of payload.traps) if (t.value === v) fail(`${at}: a trap equals the key`);
        } else {
          const o = payload.mcqOptions;
          if (got !== true) fail(`${at}: independent check false`);
          if (new Set(o.map(x => x.replace(/\s+/g, ''))).size !== o.length || o.length < 3) fail(`${at}: options not distinct/enough`);
          if (!(payload.answer.correctIndex >= 0 && payload.answer.correctIndex < o.length)) fail(`${at}: correctIndex`);
        }
      }
    }
  }
}
// ── The real marker, on real issued questions (false accept / false reject) ──
const { generateQuestion, loadAllBanks, formDrawShares } = await import('../src/engine/generators/index.js');
const { checkAnswer } = await import('../src/engine/checker.js');
await loadAllBanks();
let marked = 0, extraDraws = 0, heldBack = 0;
// What the real marker does with one question of a form: the key accepted, every wrong answer refused.
function markQuestion(q, at) {
  if (q.answerType === 'numeric') {
    const v = q.answer.value;
    const right = checkAnswer(q, String(v));
    if (!right.correct) fail(`${at}: the keyed answer ${v} was marked wrong`);
    const wrong = new Set([...q.traps.map(t => t.value), v + 1, v - 1, -v].filter(x => x !== v && Number.isFinite(x)));
    for (const w of wrong) if (checkAnswer(q, String(w)).correct) fail(`${at}: the wrong answer ${w} was marked right (key ${v})`);
  } else {
    if (!checkAnswer(q, String(q.answer.correctIndex)).correct) fail(`${at}: the keyed option was marked wrong`);
    for (let o = 0; o < q.mcqOptions.length; o++) if (o !== q.answer.correctIndex && checkAnswer(q, String(o)).correct) fail(`${at}: option ${o} marked right`);
  }
}

const SEEDS_MARK = Number(process.env.SEEDS_MARK || 40);
for (const [skill, list] of Object.entries(EXTRA_FORMS)) {
  const tags = new Set(list.map(f => f.form));
  const seen = new Set();
  for (let d = 1; d <= 4; d++) {
    for (let i = 1; i <= SEEDS_MARK * list.length; i++) {
      const q = generateQuestion(skill, d, i * 104729 + d);
      // Some authored (direct) generators tag their own forms; only registered tags are extras.
      if (!q.form || !tags.has(q.form)) continue;
      extraDraws += 1; seen.add(q.form);
      const at = `${skill}/${q.form} d${d} seed${q.seed}`;
      markQuestion(q, at);
      marked += 1;
    }
  }
  // A form that generateQuestion never issued must be one it is DESIGNED not to issue: the draw is in proportion to the
  // questions a form can serve (generators/index.js), so a form with a handful of questions has a share near 0 beside a
  // form of millions. That is stated, not assumed: its largest share over the difficulties, over the draws made here, must
  // be under 12 expected draws (the threshold below). Its questions are still run through the real marker, straight from its maker.
  for (const f of list) {
    if (seen.has(f.form)) continue;
    const share = (formDrawShares(skill) || [])[1 + list.indexOf(f)] ?? 0;
    const expected = share * 4 * SEEDS_MARK * list.length;   // the draws made above, over the four difficulties
    if (!(expected < 12)) fail(`${skill}: form ${f.form} was never issued through generateQuestion although its share predicts ${expected.toFixed(1)} draws`);
    heldBack += 1;
    for (let d = 1; d <= 4; d++) for (let i = 1; i <= SEEDS_MARK; i++) {
      const payload = f.make(makeRng(i * 104729 + d), d).payload;
      markQuestion({ ...payload, seed: i * 104729 + d }, `${skill}/${f.form} d${d} seed${i} (from its maker)`);
      marked += 1;
    }
  }
}
// Some Applications of Trigonometry is the heights-and-distances chapter: every question drawn from it carries
// its figure (the practice tour, tour-v3, draws six and needs one; it once drew only expression forms).
for (let d = 1; d <= 4; d++) for (let i = 1; i <= 60; i++) {
  const q = generateQuestion('c10-trig-applications-current', d, i * 7919 + d);
  if (!/<svg/.test(JSON.stringify(q))) fail(`c10-trig-applications-current d${d} seed ${i * 7919 + d}: no figure (${String(q.prompt).slice(0, 70)})`);
}
// Chapter content mismatch (walk-through F12): "Areas Related to Circles" served the volume of a cone and a
// cylinder, and "Surface Areas and Volumes" the area of a concentric-circle path. Mensuration forms are split by
// what they ask: plane figures (area, perimeter, arc) belong to the circles chapter, solids to the solids chapter.
{
  const SOLID = /\b(?:cone|conical|cylinder|cylindrical|hemisphere|hemispherical|sphere|spherical|solid|volume|surface area|curved surface)\b/i;
  const PLANE = /\b(?:sector|arc|concentric|circular path|ring|segment|quadrant)\b/i;
  const plane = ['c10-areas-circles', 'c10-sector-reasoning'], solids = ['c10-surface-volume-combo', 'c10-surface-area-combo', 'c10-volume-combination-reasoning'];
  let mensuration = 0;
  for (const [ids, wrong, label] of [[plane, SOLID, 'a solid or volume'], [solids, /\b(?:concentric|circular path|sector|arc length|perimeter of the sector)\b/i, 'a plane-figure area']]) {
    for (const skill of ids) {
      const forms = EXTRA_FORMS[skill] || [];
      if (forms.length < 4) fail(`${skill}: only ${forms.length} extra forms after the mensuration split (need >= 4)`);
      for (const f of forms) for (let d = 1; d <= 4; d++) for (let i = 1; i <= 20; i++) {
        const payload = f.make(makeRng(i * 7919 + d), d).payload;
        mensuration += 1;
        if (wrong.test(payload.prompt)) fail(`${skill}/${f.form} d${d}: serves ${label} — ${payload.prompt.slice(0, 90)}`);
      }
    }
  }
  const areasForms = (EXTRA_FORMS['c10-areas-circles'] || []).map(f => f.form).sort().join(',');
  const solidForms = (EXTRA_FORMS['c10-surface-volume-combo'] || []).map(f => f.form).sort().join(',');
  if (areasForms !== 'arc-length,ring-area,sector-area,sector-perimeter') fail(`c10-areas-circles forms are ${areasForms}`);
  if (/ring-area|sector-area|arc-length|sector-perimeter/.test(solidForms)) fail(`c10-surface-volume-combo serves plane forms: ${solidForms}`);
  if (!PLANE.test('a sector') || !mensuration) fail('the mensuration split check drew nothing');
  console.log(`mensuration split: ${mensuration} form draws; Areas Related to Circles forms [${areasForms}]; Surface Areas and Volumes forms [${solidForms}]`);
}
console.log(failures ? `INDIA EXTRA FORMS: FAIL — ${failures} problem(s)` : `INDIA EXTRA FORMS: PASS — ${forms} forms (${heldBack} held back from the draw by their size, marked from their makers), ${draws} draws, every key matched its independent check; ${figured} figures drawn without printing a key; ${marked} issued questions run through the real marker (key accepted, wrong answers rejected)`);
process.exit(failures ? 1 : 0);
