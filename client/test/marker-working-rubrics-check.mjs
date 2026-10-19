// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Step-checkable working rubrics: the adversarial corpus
//
// Every question a generator issues with a chained step-check plan (#430
// engine, workingRubrics.js) is put through the same page of attacks, through
// the server's own marking operation (markerOps.stepEvidence):
//
//   · the model page — every formula, substitution and value — is verified
//     line by line, and the right answer is correct;
//   · ADVERSARIAL, the primary risk — no wrong answer or wrong working is ever
//     marked correct or "every line verified":
//       - each value line falsified (off by one, ten times, sign flipped) is
//         the first break, at that line;
//       - each given substituted wrongly is never a plain verified line;
//       - a recognised wrong formula (the plan's traps) is a break, and the
//         substitution into it never earns;
//       - a wrong final answer is never correct and earns at most marks − 1;
//       - a bare answer, a copied question, prose, and padding by repetition
//         earn nothing they did not show;
//       - a sweep of candidate values earns nothing.
//
// Deterministic: fixed seeds, no model, no clock.
// ─────────────────────────────────────────────────────────────────────────────
import { GENERATORS, loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { checkAnswer, stepCheck } from '../src/engine/checker.js';
import { marksPossibleFor, stepEvidence } from '../../server/platform/markerOps.js';
import { everyLineVerified } from '../src/components/workingEvidence.js';

await loadAllBanks();

let pass = 0;
const failures = [];
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

function judge(q, lines, answer) {
  const working = lines.join('\n');
  const report = stepCheck(q.stepcheck, working, { prompt: q.prompt });
  const result = checkAnswer(q, String(answer));
  const evidence = stepEvidence(q, String(answer), working, result);
  const marks = marksPossibleFor(q);
  const awarded = evidence.partial?.awarded ?? 0;
  const earned = result.correct ? marks : Math.max(0, Math.min(marks - 1, awarded));
  return { report, result, marks, awarded, earned, verified: everyLineVerified(report, lines) };
}

// ── Writing a page the way a student writes it ───────────────────────────────
function frac(v) {
  if (Number.isInteger(v)) return String(v);
  for (let d = 2; d <= 2000; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-9) return `${n}/${d}`;
  }
  return String(Number(v.toFixed(6)));
}
const pretty = (expr, plan) => {
  let s = String(expr);
  for (const [letter, names] of Object.entries(plan.aliases || {})) {
    if (names.includes('θ') && /^[a-z]$/.test(letter)) s = s.replace(new RegExp(`\\b${letter}\\b`, 'g'), 'θ');
  }
  return s.replace(/\bpi\b/g, 'π').replace(/\*/g, ' × ');
};
function substitute(source, values) {
  return String(source).replace(/\b[a-zA-Z]\b/g, l => (l in values ? `(${frac(values[l])})` : l)).replace(/\*/g, ' × ');
}
const labelOf = stage => (stage.labels || [])[0] || 'A';

/** The model page and, for each line, what it is. */
function modelPage(q, slip = null) {
  const plan = q.stepcheck;
  const values = { ...plan.givens, ...(plan.derived || {}) };
  // slip: { stage, value } — that stage's value written wrongly and carried
  // into every later line that uses the letter it yields.
  const lines = [];
  const roles = [];
  lines.push(Object.entries(plan.givens).map(([k, v]) => {
    const theta = (plan.aliases?.[k] || []).includes('θ');
    return `${theta ? 'θ' : k} = ${frac(v)}`;
  }).join(', '));
  roles.push({ kind: 'givens' });
  // A part (a formula and the evaluation after it) is written after the parts
  // whose values it uses: the plan may list them in any order (anyOrder).
  const units = [];
  plan.stages.forEach((stage, i) => {
    if (stage.kind === 'formula' || !units.length || units.at(-1).done) units.push({ idx: [], done: false });
    units.at(-1).idx.push(i);
    if (stage.kind !== 'formula') units.at(-1).done = true;
  });
  const yieldsOf = u => u.idx.flatMap(i => plan.stages[i].yields || []);
  const order = [...units.filter(u => yieldsOf(u).length), ...units.filter(u => !yieldsOf(u).length)];
  order.flatMap(u => u.idx).forEach(i => { const stage = plan.stages[i];
    if (stage.kind === 'formula') {
      lines.push(`${labelOf(stage)} = ${pretty(stage.forms[0].expr, plan)}`);
      roles.push({ kind: 'formula', stage: i });
    } else if (stage.kind === 'evaluation') {
      const subs = { ...values, ...stage.substitutions };
      for (const l of stage.ecf?.bind || []) subs[l] = values[l];
      const carried = (stage.ecf?.bind || []).some(l => values[l] !== plan.derived?.[l]);
      // A carried letter is written into the form that uses it (n/2 (a + l)).
      const src = carried ? stage.ecf.source : stage.source;
      lines.push(`${labelOf(stage)} = ${substitute(src, subs)}`);
      roles.push({ kind: 'substitution', stage: i, carried });
      let v = stage.expected;
      if (carried) {
        const f = new Function(...Object.keys(subs), `return ${src.replace(/\^/g, '**')};`);
        v = f(...Object.values(subs));
      }
      if (slip && slip.stage === i) v = slip.value;
      for (const l of stage.yields || []) values[l] = v;
      lines.push(`= ${frac(v)}`);
      roles.push({ kind: 'value', stage: i, value: v, carried: carried || (slip && slip.stage === i) });
    }
  });
  return { lines, roles };
}

// ── The corpus ──────────────────────────────────────────────────────────────
const RUBRIC_FAMILIES = [
  'c10-arithmetic-progressions', 'c10-areas-circles', 'c10-surface-volume-combo', 'c10-sector-reasoning'
];
const SEEDS = Array.from({ length: 12 }, (_, i) => 1009 + i * 7919);
const seen = new Map();

for (const id of Object.keys(GENERATORS)) {
  for (const diff of [1, 2, 3, 4]) {
    for (const seed of SEEDS) {
      let q;
      try { q = generateQuestion(id, diff, seed); } catch { continue; }
      if (!q || q.stepcheck?.kind !== 'plan' || !q.stepcheck.chain) continue;
      if (!RUBRIC_FAMILIES.includes(id)) continue;
      seen.set(`${id}/D${diff}`, (seen.get(`${id}/D${diff}`) || 0) + 1);
      const tag = `${id} D${diff} seed ${seed}`;
      // 0. A one-letter label never folds onto a different given (`A` is read as `a`).
      const givenLetters = Object.keys(q.stepcheck.givens);
      for (const stage of q.stepcheck.stages) for (const label of stage.labels || []) {
        if (label.length !== 1) continue;
        ok(!givenLetters.some(g => g !== label && g.toLowerCase() === label.toLowerCase()), `${tag}: label ${label} folds onto a given`);
      }
      const right = String(q.answer.value);
      const wrong = frac(q.answer.value + 1);
      const { lines, roles } = modelPage(q);

      // 1. The model page is verified and the right answer is correct.
      const model = judge(q, lines, right);
      ok(model.result.correct, `${tag}: the right answer is correct`);
      ok(model.report.firstBreak === -1, `${tag}: the model page has no break (first break ${model.report.firstBreak}: ${lines[model.report.firstBreak]})`);
      ok(model.report.lines.every((l, i) => l.status === 'ok' || (i === 0 && l.status === 'note')), `${tag}: every model line is ok — ${JSON.stringify(model.report.lines.map(l => l.status))}\n${lines.join('\n')}`);

      // 2. Model working, wrong final answer: never correct, at most marks − 1.
      const wrongEnd = judge(q, lines, wrong);
      ok(!wrongEnd.result.correct, `${tag}: a wrong final answer is never correct`);
      ok(wrongEnd.earned <= wrongEnd.marks - 1, `${tag}: a wrong final answer earns at most marks − 1`);

      // 3. Each value line falsified is the first break, never verified.
      roles.forEach((role, i) => {
        if (role.kind !== 'value') return;
        for (const bad of [role.value + 1, role.value * 10 + 3, -role.value - 2]) {
          const page = lines.slice(); page[i] = `= ${frac(bad)}`;
          const j = judge(q, page, frac(bad));
          ok(j.report.firstBreak !== -1 && j.report.firstBreak <= i, `${tag}: "${page[i]}" (line ${i + 1}) is the first break — got ${j.report.firstBreak}`);
          ok(j.report.lines[i]?.status === 'break', `${tag}: the falsified line ${i + 1} is a break`);
          ok(!j.verified, `${tag}: never "every line verified" over a falsified value`);
          ok(!j.result.correct, `${tag}: a falsified value is never correct`);
          ok(j.earned <= j.marks - 1, `${tag}: a falsified page earns at most marks − 1`);
          ok(j.earned <= model.marks, `${tag}: never more than the question's marks`);
        }
      });

      // 4. A given substituted wrongly, with no wrong given line, is never a plain verified line.
      roles.forEach((role, i) => {
        if (role.kind !== 'substitution') return;
        const stage = q.stepcheck.stages[role.stage];
        for (const [letter, v] of Object.entries(stage.substitutions || {})) {
          if (!(letter in q.stepcheck.givens)) continue;
          const vals = { ...q.stepcheck.givens, ...(q.stepcheck.derived || {}), ...stage.substitutions, [letter]: v + 1 };
          const page = lines.slice(0, i); page.push(`${labelOf(stage)} = ${substitute(stage.source, vals)}`);
          const j = judge(q, page, wrong);
          const l = j.report.lines[i];
          ok(l && (l.status !== 'ok' || l.ecf === true), `${tag}: ${letter} substituted as ${v + 1} is not verified (${l?.status})`);
          ok(!j.verified, `${tag}: never "every line verified" with ${letter} substituted wrongly`);
        }
      });

      // A word problem pays a mark for reading a, d, n out of the words (an
      // `identify` stage): the givens line earns exactly that, nothing more.
      const identifyCredit = q.stepcheck.stages.some(st => st.kind === 'identify') ? 1 : 0;

      // 5. Each recognised wrong formula is a break; its substitution never earns its stage.
      q.stepcheck.stages.forEach((stage, si) => {
        if (stage.kind !== 'formula' || !stage.traps) return;
        for (const trap of stage.traps) {
          const page = [lines[0], `${labelOf(stage)} = ${pretty(trap.expr, q.stepcheck)}`];
          const j = judge(q, page, wrong);
          ok(j.report.lines[1]?.status === 'break', `${tag}: the wrong formula ${trap.expr} is a break (${j.report.lines[1]?.status})`);
          ok(j.awarded <= identifyCredit, `${tag}: the wrong formula ${trap.expr} earns nothing beyond the givens (${j.awarded})`);
        }
      });

      // 6. Nothing earns that was not shown.
      for (const page of [
        [`${labelOf(q.stepcheck.stages.at(-1))} = ${right}`],
        [right],
        [q.prompt.replace(/\$/g, '')],
        ['I used the formula and substituted the values carefully.'],
        [lines[0]],
        [lines[0], lines[0], lines[0]]
      ]) {
        const j = judge(q, page, wrong);
        const allowed = page[0] === lines[0] ? identifyCredit : 0;
        ok(j.awarded <= allowed, `${tag}: "${page.join(' / ').slice(0, 60)}" earns no method mark (${j.awarded})`);
      }
      const bareWrong = judge(q, [`= ${wrong}`], wrong);
      ok(!bareWrong.result.correct && bareWrong.awarded === 0, `${tag}: a bare wrong value earns nothing`);

      // 7. Repeating the model working earns no more than writing it once.
      const padded = judge(q, [...lines, ...lines.slice(1), ...lines.slice(1)], wrong);
      ok(padded.awarded <= wrongEnd.awarded, `${tag}: padding by repetition earns nothing more (${padded.awarded} > ${wrongEnd.awarded})`);

      // 9. Error carried forward: a part's value slipped (off by one) and then
      // used correctly below is the one first break; the lines built on it are
      // ok and carried, never a second mistake, never "every line verified".
      roles.forEach((role, i) => {
        if (role.kind !== 'value') return;
        const stage = q.stepcheck.stages[role.stage];
        if (!stage.yields?.length) return;
        const users = q.stepcheck.stages.filter(st => (st.ecf?.bind || []).some(l => stage.yields.includes(l)));
        if (!users.length) return;
        const slipped = modelPage(q, { stage: role.stage, value: role.value + 1 });
        const j = judge(q, slipped.lines, slipped.lines.at(-1).replace(/^= /, ''));
        ok(j.report.firstBreak === i, `${tag}: the slipped ${stage.yields[0]} (line ${i + 1}) is the first break — got ${j.report.firstBreak}\n${slipped.lines.join('\n')}\n${JSON.stringify(j.report.lines.map(l => l.status + (l.ecf ? '+ecf' : '')))}`);
        const later = j.report.lines.slice(i + 1);
        ok(later.every(l => l.status !== 'break'), `${tag}: nothing built on the slipped ${stage.yields[0]} is a second mistake — ${JSON.stringify(later.map(l => l.status))}`);
        ok(slipped.roles.some((r, k) => k > i && r.carried && j.report.lines[k]?.ecf === true), `${tag}: a line built on the slipped ${stage.yields[0]} is carried forward`);
        ok(!j.result.correct && !j.verified, `${tag}: a carried slip is never correct or "every line verified"`);
        ok(j.earned <= j.marks - 1, `${tag}: a carried slip earns at most marks − 1`);
        // …and the method shown around the slip still earns (ecf: 'method').
        if (j.marks >= 2) ok(j.earned >= 1, `${tag}: method marks survive a slip carried forward (${j.earned}/${j.marks})`);
      });

      // 8. A sweep of candidate values earns nothing.
      const last = q.stepcheck.stages.at(-1);
      const sweep = [1, 2, 3, 4].map(k => `${labelOf(last)} = ${frac(q.answer.value + k)}`);
      const sw = judge(q, sweep, wrong);
      ok(sw.awarded === 0 && !sw.verified, `${tag}: a sweep of candidates earns nothing (${sw.awarded})`);
    }
  }
}

// Every rubric family is exercised at every difficulty that carries a plan.
for (const id of RUBRIC_FAMILIES) {
  const levels = [1, 2, 3, 4].filter(d => seen.has(`${id}/D${d}`));
  ok(levels.length > 0, `${id}: carries a chained rubric`);
}

if (failures.length) {
  console.error(failures.slice(0, 40).join('\n\n'));
  console.error(`WORKING RUBRICS: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  process.exit(1);
}
console.log(`WORKING RUBRICS: PASS — ${pass}/${pass} checks across ${seen.size} family levels`);
