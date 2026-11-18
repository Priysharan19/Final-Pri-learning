// Pri Learning · worked answer cases for the examiner packets (mission CERT).
//
// For one issued question, writes the pages a student might hand in and asks
// the engine — through the server's own marking operation, markerOps.js — what
// it does with each. Nothing here decides a mark: it reports the engine's
// verdict so a human examiner can agree or disagree with it.
//
// The model page for a chain plan is built the same way as the adversarial
// corpus (client/test/marker-working-rubrics-check.mjs) builds it. A step check
// that is not a chain plan has no page the tool can write; the case says so
// rather than inventing one.
import { checkAnswer } from '../client/src/engine/checker.js';
import { marksPossibleFor, stepEvidence } from '../server/platform/markerOps.js';

export function frac(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
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
const substitute = (source, values) => String(source).replace(/\b[a-zA-Z]\b/g, l => (l in values ? `(${frac(values[l])})` : l)).replace(/\*/g, ' × ');
const labelOf = stage => (stage.labels || [])[0] || 'A';

/** The model page of a chain plan; `slip` writes one stage's value wrongly and carries it. */
export function modelPage(q, slip = null) {
  const plan = q.stepcheck;
  const values = { ...plan.givens, ...(plan.derived || {}) };
  const lines = [Object.entries(plan.givens).map(([k, v]) => `${(plan.aliases?.[k] || []).includes('θ') ? 'θ' : k} = ${frac(v)}`).join(', ')];
  const units = [];
  plan.stages.forEach((stage, i) => {
    if (stage.kind === 'formula' || !units.length || units.at(-1).done) units.push({ idx: [], done: false });
    units.at(-1).idx.push(i);
    if (stage.kind !== 'formula') units.at(-1).done = true;
  });
  const yieldsOf = u => u.idx.flatMap(i => plan.stages[i].yields || []);
  const order = [...units.filter(u => yieldsOf(u).length), ...units.filter(u => !yieldsOf(u).length)];
  let last = null;
  for (const i of order.flatMap(u => u.idx)) {
    const stage = plan.stages[i];
    if (stage.kind === 'formula') { lines.push(`${labelOf(stage)} = ${pretty(stage.forms[0].expr, plan)}`); continue; }
    if (stage.kind !== 'evaluation') continue;
    const subs = { ...values, ...stage.substitutions };
    for (const l of stage.ecf?.bind || []) subs[l] = values[l];
    const carried = (stage.ecf?.bind || []).some(l => values[l] !== plan.derived?.[l]);
    const src = carried ? stage.ecf.source : stage.source;
    lines.push(`${labelOf(stage)} = ${substitute(src, subs)}`);
    let v = stage.expected;
    if (carried) v = new Function(...Object.keys(subs), `return ${src.replace(/\^/g, '**')};`)(...Object.values(subs));
    if (slip && slip.stage === i) v = slip.value;
    for (const l of stage.yields || []) values[l] = v;
    lines.push(`= ${frac(v)}`);
    last = v;
  }
  return { lines, final: last };
}

/** The engine's verdict on one page: correct?, method award, and the mark under each policy. */
export function verdict(q, lines, answer) {
  const working = lines.join('\n');
  const result = checkAnswer(q, String(answer));
  const marks = marksPossibleFor(q);
  let awarded = 0;
  if (q.stepcheck) {
    try { awarded = stepEvidence(q, String(answer), working, result).partial?.awarded ?? 0; } catch { awarded = 0; }
  }
  return {
    correct: !!result.correct,
    marks,
    finalAnswerOnly: result.correct ? marks : 0,
    withMethodMarks: result.correct ? marks : Math.max(0, Math.min(marks - 1, awarded))
  };
}

const firstEvaluation = plan => plan.stages.findIndex(s => s.kind === 'evaluation' && (s.yields || []).length);

/** An equivalent written form of a numeric key, or null when the tool knows none. */
export function equivalentForm(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (Number.isInteger(value)) return `${value}.0`;
  const f = frac(value);
  return f !== String(value) ? f : null;
}

/**
 * The key as a student would type it, for every answer type (the packet used to print `undefined` for a
 * multiple-choice, expression, set, point or ratio key, and the decimal value for an exact-form key).
 * Same reading of the key as client/test/nsw-bank-quality-check.mjs.
 */
export function keyText(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'numeric':
      if (a.canonicalInput) return String(a.canonicalInput);
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction && a.simplestFraction.d !== 1) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      return typeof a.value === 'number' ? frac(a.value) : String(a.value);
    case 'set': return Array.isArray(a.values) ? a.values.map(frac).join(', ') : String(a.values);
    case 'point': return `(${frac(a.x)}, ${frac(a.y)})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'expression': return String(a.expr);
    case 'mcq': return String(a.correctIndex);
    default: return String(a.value);
  }
}

/** For a multiple-choice key, the text of the option the index names (shown beside the index). */
const optionNote = (q, i) => (q.answerType === 'mcq' && Array.isArray(q.mcqOptions) && q.mcqOptions[i] != null ? ` Option ${i} is “${String(q.mcqOptions[i]).replace(/\s+/g, ' ').slice(0, 80)}”.` : '');

/** A plainly wrong final answer of the same kind as the key. */
export function wrongForm(q) {
  const a = q.answer || {};
  if (q.answerType === 'mcq' && Array.isArray(q.mcqOptions)) { const i = q.mcqOptions.findIndex((_, j) => j !== a.correctIndex); if (i >= 0) return String(i); }
  if (q.answerType === 'set' && Array.isArray(a.values) && a.values.length) return [frac(a.values[0] + 1), ...a.values.slice(1).map(frac)].join(', ');
  if (q.answerType === 'point') return `(${frac(a.x + 1)}, ${frac(a.y)})`;
  if (q.answerType === 'ratio') return `${a.a + 1}:${a.b}`;
  if (q.answerType === 'expression' && a.expr) return a.stripC || /\+\s*C\b|∫/.test(String(q.prompt)) ? `2*(${a.expr})` : `(${a.expr}) + 1`;
  if (q.answerType === 'numeric' && a.surdForm) return `${a.surdForm.k + 1}sqrt(${a.surdForm.r})`;
  if (q.answerType === 'numeric' && a.simplestFraction && a.simplestFraction.d !== 1) return `${a.simplestFraction.n + 1}/${a.simplestFraction.d}`;
  const v = q.answer?.value;
  if (typeof v === 'number' && Number.isFinite(v)) return frac(v + 1);
  if (Array.isArray(q.options) && q.options.length > 1) {
    const other = q.options.find(o => String(o?.value ?? o) !== String(v));
    if (other !== undefined) return String(other?.value ?? other);
  }
  return '0';
}

/**
 * The four cases the brief asks for: correct, alternative, common wrong,
 * partial. Each is { case, page, answer, note, ...verdict }.
 */
export function workedCases(q) {
  const key = q.answer?.value;
  const right = keyText(q);
  const cases = [];
  const chain = q.stepcheck?.kind === 'plan' && q.stepcheck.chain;
  if (chain) {
    const model = modelPage(q);
    cases.push({ case: 'correct', page: model.lines, answer: right, note: 'The model page: every formula, substitution and value, with the right answer.' });
    cases.push({ case: 'alternative', page: [], answer: right, note: 'Right answer with no working. The engine has no authored alternative method for this plan; the examiner should mark their own alternative method and record any disagreement.' });
    cases.push({ case: 'common wrong', page: model.lines, answer: wrongForm(q), note: 'The model working, then a wrong final answer (a transcription slip at the end).' });
    const i = firstEvaluation(q.stepcheck);
    if (i >= 0) {
      const good = q.stepcheck.stages[i].expected;
      const slip = modelPage(q, { stage: i, value: typeof good === 'number' ? good + 1 : good });
      cases.push({ case: 'partial', page: slip.lines, answer: frac(slip.final), note: 'One arithmetic slip in the first evaluated stage, carried forward correctly to the end.' });
    }
  } else {
    const plainNumeric = q.answerType === 'numeric' && !q.answer?.canonicalInput && !q.answer?.surdForm && !(q.answer?.simplestFraction && q.answer.simplestFraction.d !== 1);
    const alt = plainNumeric ? equivalentForm(key) : q.answerType === 'expression' && q.answer?.expr ? `(${q.answer.expr})` : null;
    cases.push({ case: 'correct', page: [], answer: right, note: `The keyed answer as the server prints it.${optionNote(q, q.answer?.correctIndex)}` });
    cases.push(alt
      ? { case: 'alternative', page: [], answer: alt, note: q.answerType === 'expression' ? 'The same expression written with brackets.' : 'The same value written in another equivalent form.' }
      : { case: 'alternative', page: [], answer: null, note: 'The tool knows no equivalent written form for this answer type; the examiner should try their own.' });
    cases.push({ case: 'common wrong', page: [], answer: wrongForm(q), note: `A plainly wrong final answer of the same kind as the key.${q.answerType === 'mcq' ? optionNote(q, Number(wrongForm(q))) : ''}` });
    cases.push({ case: 'partial', page: q.stepcheck ? ['(working with the right method, ending in a wrong value)'] : [], answer: wrongForm(q), note: q.stepcheck
      ? `The step check is an ${q.stepcheck.kind} check, not a chain plan, so the tool cannot write a model page; this is a wrong final answer with a placeholder line. The examiner should write the partial page.`
      : 'No step check: working is never marked for this question, so any wrong final answer earns nothing.' });
  }
  return cases.map(c => (c.answer === null ? { ...c, correct: null, marks: marksPossibleFor(q), finalAnswerOnly: null, withMethodMarks: null } : { ...c, ...verdict(q, c.page, c.answer) }));
}
