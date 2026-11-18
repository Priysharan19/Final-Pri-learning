// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter · the stage between a confirmed reading and the engine
//
//   confirmed lines ──▶ interpret (rules, then the model for what rules cannot
//   read) ──▶ typed claims ──▶ VERIFY (deterministic) ──▶ per-line result
//
// DARK BY DEFAULT. Nothing runs and nothing is returned unless the deployment
// sets PRI_FEATURE_LINE_INTERPRETER=1 (the server never reads it from a client).
// The result is a structure only; no student surface reads it yet.
//
// The per-line result a client would show:
//   verdict "valid"               "Checked" (a tick: the line is true)
//   verdict "given"               "From the question"
//   verdict "first-break"         "Wrong here" (only ever from a rule reading)
//   verdict "follows-from-error"  "Follows from the earlier mistake"
//   verdict "unverifiable"        "Couldn't verify", with `why`
// ─────────────────────────────────────────────────────────────────────────────
import { publicDescription } from './givens.js';
import { ruleInterpretation } from './rules.js';
import { interpretWithModel } from './model.js';
import { guardClaim } from './claims.js';
import { verifyLines, TICKED } from './verifier.js';

export const lineInterpreterEnabled = (env = process.env) => String(env?.PRI_FEATURE_LINE_INTERPRETER || '').trim() === '1';

const HAS_MATHS = /[0-9=+\-*/^×÷√π]/;

/**
 * Per-line results for a question's confirmed lines, or null when the feature is off.
 * `question` is the issued question (server side); only its public fields feed the
 * interpreters. `facts.answer` stays on this side of the line and is used only by the verifier.
 */
export async function interpretWorking({ question, lines, env = process.env, fetchImpl, authorize, useModel = true, engineVerdicts = null }) {
  if (!lineInterpreterEnabled(env)) return null;
  const texts = (Array.isArray(lines) ? lines : []).map(l => String(l ?? ''));
  const description = publicDescription(question);
  const items = texts.map(t => ruleInterpretation(t, description));
  const wantModel = [];
  texts.forEach((t, i) => {
    const k = items[i].claim.kind;
    if ((k === 'unparseable' || k === 'prose') && HAS_MATHS.test(t) && !engineVerdicts?.[i]) wantModel.push(i);
  });
  let model = { used: false, status: 'not-needed', latencyMs: 0, usage: null, asked: 0 };
  if (useModel && wantModel.length) {
    const res = await interpretWithModel({ description, lines: texts, indices: wantModel, env, fetchImpl, authorize });
    model = { used: res.status === 'ok', status: res.status, latencyMs: res.latencyMs, usage: res.usage, asked: wantModel.length };
    for (const [i, claim] of res.claims) if (claim.kind !== 'unparseable' && claim.kind !== 'prose') items[i] = { claim, source: 'model' };
  }
  const answer = question?.answerType === 'numeric' && Number.isFinite(Number(question?.answer?.value))
    ? { kind: 'numeric', value: Number(question.answer.value) } : null;
  const results = verifyLines(items.map((it, i) => ({ ...it, text: texts[i] })), description, { answer });
  return {
    version: 1,
    lines: results.map((r, i) => ({ ...r, text: texts[i], ticked: TICKED.has(r.verdict) })),
    model
  };
}
export { guardClaim, publicDescription, ruleInterpretation, verifyLines };
