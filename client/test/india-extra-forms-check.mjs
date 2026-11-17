// Every extra structural form (generators/forms/*) carries a check() that
// recomputes its key by a different route (a scan, a numeric evaluation, an
// enumeration). This proves each key on many seeds and refuses degenerate or
// ambiguous questions. Synthetic, in-process; no student evidence.
import { EXTRA_FORMS } from '../src/engine/generators/india-forms-extra.js';
import { makeRng } from '../src/engine/qhelpers.js';
import { workedStepHits } from './support/typesetting-rules.mjs';

const SEEDS = Number(process.env.SEEDS || 150);
let failures = 0, forms = 0, draws = 0;
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
const { generateQuestion, loadAllBanks } = await import('../src/engine/generators/index.js');
const { checkAnswer } = await import('../src/engine/checker.js');
await loadAllBanks();
let marked = 0, extraDraws = 0;
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
      marked += 1;
    }
  }
  for (const t of tags) if (!seen.has(t)) fail(`${skill}: form ${t} was never issued through generateQuestion`);
}
console.log(failures ? `INDIA EXTRA FORMS: FAIL — ${failures} problem(s)` : `INDIA EXTRA FORMS: PASS — ${forms} forms, ${draws} draws, every key matched its independent check; ${marked} issued questions run through the real marker (key accepted, wrong answers rejected)`);
process.exit(failures ? 1 : 0);
