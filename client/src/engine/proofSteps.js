// Pri Learning — proofs are not marked automatically.
//
// A proof earns its marks from a person. What the engine can do is check
// the steps it understands: where a line rewrites one algebraic expression
// as another ("= a² + 2ab + b²"), it tests whether the two are equivalent,
// and reports the first step it could not verify. That report is evidence
// for the teacher who marks the proof, and feedback for the student. It is
// never a mark: a proof that checks step by step still waits for review,
// because the engine's equivalence test samples values (research: numerical
// testing is not proof of symbolic equivalence) and a proof's argument —
// which steps are justified and why — is more than its algebra.
//
// question.answer.proof = { statement: 'LHS = RHS' }   (optional; lets the
// student write "LHS" / "RHS" / "L.H.S." for the statement's sides)
// response: the proof's lines, one per line (string with newlines, or array)
import { exprEquivalent, parse } from './expr.js';

export const PROOF_LINE_LIMIT = 40;
const SIDE = /^\s*(l\.?\s*h\.?\s*s\.?|r\.?\s*h\.?\s*s\.?)\s*$/i;
const isLeft = s => /^\s*l/i.test(s);

function statementSides(statement) {
  const parts = String(statement ?? '').split('=');
  return parts.length === 2 && parts[0].trim() && parts[1].trim() ? { lhs: parts[0].trim(), rhs: parts[1].trim() } : null;
}

/** Read one line into the expressions it chains with '='. Prose lines are not algebra. */
function chainOf(line, sides) {
  const text = String(line).replace(/−/g, '-').replace(/^\s*(?:=>|⇒|=|∴|therefore|hence|so)\s*/i, m => (m.trim().startsWith('=') ? '=' : ''));
  const continues = text.trim().startsWith('=');
  const parts = text.split('=').map(p => p.trim());
  if (continues) parts.shift();
  const exprs = [];
  for (const part of parts) {
    if (!part) return null;
    if (SIDE.test(part)) {
      if (!sides) return null;
      exprs.push({ text: isLeft(part) ? sides.lhs : sides.rhs, side: isLeft(part) ? 'lhs' : 'rhs' });
      continue;
    }
    try { parse(part); } catch { return null; }
    exprs.push({ text: part });
  }
  return exprs.length ? { exprs, continues } : null;
}

/**
 * Check a proof's algebraic steps. Returns
 * { steps: [{ line, from, to, status }], firstBreak, reachesStatement, verifiedSteps }
 * status: 'verified' | 'not-verified' | 'not-algebra'. firstBreak is the line
 * index of the first step that is not verified (-1 if none).
 */
export function checkProofSteps(rawLines, statement) {
  const lines = (Array.isArray(rawLines) ? rawLines : String(rawLines ?? '').split(/\r?\n/)).map(String).filter(l => l.trim()).slice(0, PROOF_LINE_LIMIT);
  const sides = statementSides(statement);
  const steps = [];
  let prev = null, firstBreak = -1, start = null, end = null;
  lines.forEach((line, i) => {
    const chain = chainOf(line, sides);
    if (!chain) { steps.push({ line: i, status: 'not-algebra' }); prev = null; return; }
    const exprs = chain.continues && prev ? [prev, ...chain.exprs] : chain.exprs;
    if (!chain.continues || !prev) start = start ?? exprs[0];
    for (let k = 0; k + 1 < exprs.length; k += 1) {
      let same = false;
      try { same = exprEquivalent(exprs[k].text, exprs[k + 1].text, { isolatedDomain: true }) === true; } catch { same = false; }
      steps.push({ line: i, from: exprs[k].text, to: exprs[k + 1].text, status: same ? 'verified' : 'not-verified' });
      if (!same && firstBreak < 0) firstBreak = i;
    }
    prev = exprs[exprs.length - 1];
    end = prev;
  });
  const algebra = steps.filter(s => s.status !== 'not-algebra');
  const reachesStatement = !!sides && !!start && !!end && algebra.length > 0 && algebra.every(s => s.status === 'verified') &&
    ((start.side === 'lhs' && end.side === 'rhs') || (start.side === 'rhs' && end.side === 'lhs'));
  return { steps, firstBreak, reachesStatement, verifiedSteps: algebra.filter(s => s.status === 'verified').length };
}

export const PROOF_REVIEW_NOTE = 'Proofs are marked by a teacher, not automatically. The algebra checks below are only a guide.';

/** The practice/exam reply for a proof: never right automatically, always waiting for review. */
export function checkProof(question, rawInput) {
  const text = Array.isArray(rawInput) ? rawInput.join('\n') : String(rawInput ?? '');
  if (!text.trim()) return { correct: false };
  if (text.length > 6000) return { correct: false, invalid: true, feedback: 'That proof is too long to read here.' };
  const report = checkProofSteps(text, question.answer?.proof?.statement);
  const broke = report.firstBreak >= 0 ? ` Line ${report.firstBreak + 1} is a step the algebra check could not confirm.` : '';
  return { correct: false, needsReview: true, proofReport: report, feedback: PROOF_REVIEW_NOTE + broke };
}
