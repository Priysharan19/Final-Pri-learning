// Pri Learning · the annotated-working panel's content, as plain data.
//
// Built from what the attempt already holds after it was marked:
//   · stepReport — Step Check's verdict on every line (the server's, for a
//     signed-in attempt; it is the same deterministic engine);
//   · lines — the lines that were checked (for handwriting, the reading the
//     student confirmed);
//   · receipt — the marks the server committed (attestedGrade), or null;
//   · solution — the released worked solution, after resolution only.
//
// It names the rule each checked step used (engine/stepJustify.js), but it
// never decides a mark: `marks` is the receipt copied as-is, and the criteria
// rows carry evidence (which lines show a method), never a mark. Every
// sentence is a fact the engine established; nothing is praise.
import { annotateWorking } from '../engine/stepJustify.js';

const MAX_LINES = 40;

/** 'LHS = RHS' of a released "prove that" solution, or null. */
export function proofStatementOf(solution) {
  const steps = Array.isArray(solution?.steps) ? solution.steps : [];
  if (!steps.some(s => Array.isArray(s?.rules))) return null;
  const lines = String(solution?.answerText || '').split('\n').map(s => s.trim()).filter(Boolean);
  return lines.length >= 2 ? `${lines[0]} = ${lines[lines.length - 1]}` : null;
}

function mergeRules(steps) {
  const rules = [];
  let more = false, same = false, unnamed = false;
  for (const s of steps) {
    const j = s.justification;
    if (!j?.valid) continue;
    if (j.same) same = true;
    if (j.more) more = true;
    if (!j.rules.length && !j.same) unnamed = true;
    for (const r of j.rules) if (!rules.some(x => x.rule === r.rule)) rules.push(r);
  }
  return { rules: rules.slice(0, 2), more: more || rules.length > 2, same: same && !rules.length, unnamed: unnamed && !rules.length };
}

/**
 * @param {object} input { lines: string[], stepReport, receipt: { awarded, possible } | null,
 *   solution, readStates?: ('read'|'check'|'cant')[], source?: 'handwriting'|'typed' }
 * @returns {null | { cards, proof, summary, marks, criteria, jumps, source }}
 */
export function buildAnnotatedWorking({ lines, stepReport, receipt = null, solution = null, readStates = null, source = 'typed' } = {}) {
  const report = Array.isArray(stepReport?.lines) ? stepReport.lines.slice(0, MAX_LINES) : null;
  if (!report || report.length < 2) return null;
  const texts = report.map((l, i) => String(l?.text ?? lines?.[i] ?? ''));
  const statement = proofStatementOf(solution);
  let ann;
  try { ann = annotateWorking(texts, statement ? { statement } : {}); } catch { return null; }
  // Only working whose lines are expressions is annotated: an equation or a
  // relation on any line is Step Check's other kinds, and stays with its report.
  if (ann.lines.filter(l => l.readable).length < 2) return null;
  // A line Step Check accepted whose '=' does not join equal expressions is an
  // equation (2x + 3 = 7), not a chain of equal expressions: not this panel's.
  if (ann.lines.some((a, i) => report[i]?.status === 'ok' && a.steps.some(s => report[s.fromLine]?.status === 'ok' && s.justification && s.justification.valid === false))) return null;

  const firstBreak = report.findIndex(l => l?.status === 'break');
  const cards = report.map((l, i) => {
    const a = ann.lines[i] || { steps: [] };
    const merged = mergeRules(a.steps);
    const prevValid = a.steps.length > 0 && a.steps.every(s => s.justification?.valid);
    let status;
    if (readStates?.[i] === 'cant') status = 'unread';
    else if (l?.status === 'break' && i === firstBreak) status = 'first-error';
    else if (firstBreak >= 0 && i > firstBreak) status = prevValid ? 'follows' : 'not-verified';
    else if (l?.status === 'ok') status = 'checked';
    else status = 'not-verified';
    const from = a.steps[0]?.fromLine;
    return {
      n: i + 1, line: i, status,
      start: status === 'checked' && a.steps.length === 0,
      rules: status === 'checked' || status === 'follows' ? merged.rules : [],
      more: status === 'checked' && merged.more,
      same: status === 'checked' && merged.same,
      unnamed: status === 'checked' && merged.unnamed,
      followsFrom: status === 'follows' && Number.isInteger(from) ? from + 1 : null,
      diagnosis: status === 'first-error' ? (l.diagnosis || null) : null,
      note: status === 'first-error' ? (l.note || null) : null,
      previousText: status === 'first-error' && i > 0 && report[i - 1]?.status === 'ok' ? texts[i - 1] : null,
      text: texts[i]
    };
  });

  const checked = cards.filter(c => c.status === 'checked').length;
  const jumps = cards.filter(c => c.unnamed && c.more).map(c => c.n);
  const named = new Set(cards.flatMap(c => c.rules.map(r => r.rule)));
  const proof = statement ? ann.proof : null;
  let summary;
  if (firstBreak >= 0) summary = { key: 'aw.summary.breaks', vars: { n: firstBreak + 1, checked } };
  else if (proof?.complete && proof.mode === 'meet') summary = { key: 'aw.summary.proofMeet', vars: { checked, rules: named.size } };
  else if (proof?.complete) summary = { key: 'aw.summary.proofDirect', vars: { checked, rules: named.size } };
  else if (proof) summary = { key: 'aw.summary.proofOpen', vars: { checked } };
  else summary = { key: 'aw.summary.allChecked', vars: { checked, rules: named.size } };

  // Evidence rows: the worked solution's steps that name the rule they use.
  const evidenceSteps = (Array.isArray(solution?.steps) ? solution.steps : []).filter(s => Array.isArray(s?.rules) && s.rules.length);
  const before = c => firstBreak < 0 || c.line < firstBreak;
  const criteria = evidenceSteps.map(s => {
    const linesSeen = cards.filter(c => before(c) && c.status === 'checked' && c.rules.some(r => s.rules.includes(r.rule))).map(c => c.n);
    return { text: s.h, lines: linesSeen };
  });
  if (proof) criteria.push({ text: null, kind: 'reaches-rhs', lines: proof.complete ? (proof.meetLines || [cards.length - 1]).map(i => i + 1) : [] });

  const marks = receipt && Number.isFinite(Number(receipt.awarded)) && Number(receipt.possible) > 0
    ? { awarded: Number(receipt.awarded), possible: Number(receipt.possible), receiptId: typeof receipt.id === 'string' && receipt.id ? receipt.id.slice(-8) : null } : null;
  return { cards, proof, summary, marks, criteria, jumps, source };
}
