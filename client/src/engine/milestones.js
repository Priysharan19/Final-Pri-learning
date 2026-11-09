// Pri Learning — recognising a correct intermediate line from the worked solution.
//
// Step Check ticks a line only where the question's check covers it. An
// intermediate result such as a derivative (f'(x) = 6x + 1) or a
// discriminant (Δ = 25) was ticked only where someone had authored a plan
// stage for it, so every other correct intermediate line showed "Skipped".
//
// Every generated question already carries its worked solution (`steps`).
// A step whose maths names a quantity — `LABEL = expr` with a label such as
// f'(x), f(2), Δ, D, T_n, S_n, m — is a MILESTONE. A student line that names
// the same quantity and gives an equivalent value matches that milestone.
//
// This is feedback only. It changes no mark: methodMarks runs its own Step
// Check and never sees this annotation, and the annotated report is shown
// only after the attempt is resolved, as Step Check reports already are.
import { exprEquivalent, parse, normalize, variablesOf } from './expr.js';
import { plainTex } from './checker.js';

const TEX_SPAN = /\$([^$]+)\$/g;
// A label is a named quantity, not an expression: a letter (Greek Δ allowed),
// optional primes, an optional subscript, an optional argument.
const LABEL = /^(?:Δ|[A-Za-z])(?:'{1,2})?(?:_[A-Za-z0-9]+)?(?:\(-?[A-Za-z0-9.]{1,4}(?:,-?[A-Za-z0-9.]{1,4})?\))?$/;

const tidyLabel = s => String(s).replace(/\\Delta/g, 'Δ').replace(/\\prime/g, "'").replace(/[′’]/g, "'")
  .replace(/[{}\s]/g, '').replace(/\\left|\\right/g, '');

/**
 * Words and TeX tokens that join two statements in one span: an implication,
 * a line break, a connective, a separator. A span is cut at every one of them
 * (at bracket depth 0 for , and ;) so a label never keeps another statement's value.
 */
export const JOINERS = /\\(?:Rightarrow|Longrightarrow|implies|iff|Leftrightarrow|to|therefore|because|qquad|quad|;|,|:|\s)|\\\\|\\(?:text|mathrm|textrm)\{\s*(?:so|gives|then|hence|and|or|i\.e\.|thus|therefore|which gives|giving)\s*,?\s*\}|⇒|→|∴|\b(?:so|gives|then|hence|and)\b/g;

/**
 * The statements of one span. A piece with no `=` (the "2" of `x = 1, 2`) is
 * glued to the statement before it, whose value then has a top-level comma
 * and so is dropped whole. A piece with its own `=` but no label is its own
 * statement and yields nothing; it is never glued to a label.
 */
export function statements(span) {
  const marked = String(span).replace(JOINERS, '\u0000');
  const pieces = [];
  let depth = 0, cur = '';
  for (const c of marked) {
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    if (c === '\u0000' || (depth === 0 && (c === ',' || c === ';'))) { pieces.push(cur); cur = ''; continue; }
    cur += c;
  }
  pieces.push(cur);
  const out = [];
  for (const raw of pieces) {
    const p = raw.trim();
    if (!p) continue;
    if (!p.includes('=') && out.length) { out[out.length - 1] = { text: `${out[out.length - 1].text}, ${p}`, glued: true }; continue; }
    out.push({ text: p, glued: false });
  }
  return out.filter(x => !x.glued).map(x => x.text);
}
function topLevelComma(v) {
  let depth = 0;
  for (const c of String(v)) { if ('([{'.includes(c)) depth += 1; else if (')]}'.includes(c)) depth -= 1; else if (c === ',' && depth === 0) return true; }
  return false;
}

/** The milestones of a question's worked solution: [{ step, label, values: [plain expr] }]. */
export function milestonesOf(q) {
  const out = [];
  const steps = Array.isArray(q?.steps) ? q.steps : [];
  steps.forEach((step, i) => {
    const d = String(step?.d ?? '');
    for (const m of d.matchAll(TEX_SPAN)) for (const piece of statements(m[1])) {
      const parts = piece.split(/(?<![<>!])=(?!=)/);
      if (parts.length < 2) continue;
      const label = tidyLabel(parts[0]);
      if (!LABEL.test(label)) continue;
      const values = parts.slice(1).map(p => plainTex(p)).filter(v => {
        // A top-level comma means two statements were not split apart: never a value.
        if (!v || topLevelComma(v)) return false;
        try { parse(normalize(v)); return true; } catch { return false; }
      });
      if (values.length) out.push({ step: i, heading: String(step?.h ?? '').trim(), label, values });
    }
  });
  return out;
}

/** The tick's comment: which step of the method the line matches. */
export const milestoneNote = m => `Matches step ${m.step + 1} of the method${m.heading ? ` (${m.heading.replace(/\.$/, '')})` : ''}.`;

const SAME_SIDE = /(?<![<>!])=(?!=)/;

/** The milestone a student line matches, or null. Same label, an equivalent value. */
export function matchMilestone(milestones, line) {
  const text = String(line ?? '').replace(/[−–—]/g, '-').trim();
  if (text.length > 160) return null;
  const parts = text.split(SAME_SIDE);
  if (parts.length !== 2) return null;
  const label = tidyLabel(parts[0]);
  if (!LABEL.test(label)) return null;
  let rhs;
  try { rhs = normalize(parts[1].trim()); parse(rhs); } catch { return null; }
  for (const m of milestones) {
    if (m.label !== label) continue;
    // The student's value must agree with the step's RESULT (its last form),
    // and use no letter the step does not use: "f'(x) = f'(x)" is not a step.
    const target = m.values[m.values.length - 1];
    let ok = false;
    try {
      const want = variablesOf(parse(normalize(target)));
      const got = variablesOf(parse(rhs));
      if ([...got].some(v => !want.has(v))) continue;
      ok = exprEquivalent(rhs, target, { isolatedDomain: true }) === true;
    } catch { ok = false; }
    if (ok) return m;
  }
  return null;
}

/**
 * Annotate a Step Check report: a line the check left as a note but that
 * matches a milestone becomes `ok` with `milestone: { step, heading }`. Only
 * notes change: a line the check judged (ok or break) keeps its verdict.
 */
export function annotateMilestones(q, report) {
  if (!report || !Array.isArray(report.lines)) return report;
  const milestones = milestonesOf(q);
  if (!milestones.length) return report;
  let changed = false;
  const lines = report.lines.map(l => {
    if (l?.status !== 'note') return l;
    const m = matchMilestone(milestones, l.text);
    if (!m) return l;
    changed = true;
    return { ...l, status: 'ok', note: milestoneNote(m), milestone: { step: m.step + 1, heading: m.heading, label: m.label } };
  });
  return changed ? { ...report, lines } : report;
}

export const NOT_CHECKED_NOTE = 'Not checked — this question’s check covers the lines that lead to the answer.';

/**
 * A question with no Step Check of its own but a worked solution: each line
 * that matches a milestone is ticked, every other line is "not checked".
 * Nothing here is ever a break: without a check, a line that matches no
 * milestone may still be right, so it is never called wrong.
 */
export function milestoneOnlyReport(q, workingText) {
  const milestones = milestonesOf(q);
  if (!milestones.length) return null;
  const lines = String(workingText ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 40);
  if (!lines.length) return null;
  return {
    lines: lines.map(text => {
      const m = matchMilestone(milestones, text);
      return m ? { text, status: 'ok', note: milestoneNote(m), milestone: { step: m.step + 1, heading: m.heading, label: m.label } } : { text, status: 'note', note: NOT_CHECKED_NOTE };
    }),
    firstBreak: -1, diagnosis: null, source: 'milestones'
  };
}
