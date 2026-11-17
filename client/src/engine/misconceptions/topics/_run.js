// Runs a topic's slips over two lines of numeric working. The hypotheses say
// how a wrong line would be made from the line above; a slip is named only when
// the student's line equals what that slip would produce (and is not equal to
// the line above). Deterministic, no model, never decides a mark.
import { normalize, parse, evaluate } from '../../expr.js';

const readLine = text => { try { return parse(normalize(String(text || '').replace(/^∴\s*/, ''))); } catch { return null; } };
const valueOf = ast => { try { const v = evaluate(ast, {}); return Number.isFinite(v) ? v : null; } catch { return null; } };
const same = (a, b) => a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** { code, detail, copy } for the slip that makes `brokenText` from `prevText`, or null. */
/** The question's own numbers put into a symbolic line (a + (n − 1)d with a = 3 …). */
function substitute(ast, env) {
  if (!ast || typeof ast !== 'object') return ast;
  if (ast.t === 'var' && env && Object.prototype.hasOwnProperty.call(env, ast.v) && Number.isFinite(Number(env[ast.v]))) return { t: 'num', v: Number(env[ast.v]), s: String(env[ast.v]) };
  const out = { ...ast };
  for (const k of ['l', 'r', 'v', 'arg']) if (out[k] && typeof out[k] === 'object') out[k] = substitute(out[k], env);
  return out;
}

export function detectSlip(slips, prevText, brokenText, env = null) {
  const A0 = readLine(prevText), B = readLine(brokenText);
  const A = A0 && env ? substitute(A0, env) : A0;
  if (!A || !B) return null;
  const a = valueOf(A), b = valueOf(B);
  if (a === null || b === null || same(a, b)) return null;      // unreadable, or the step holds
  for (const slip of slips) {
    for (const h of slip.hypotheses(A)) {
      if (same(valueOf(h.ast), b) && !same(valueOf(h.ast), a)) return { code: slip.code, category: slip.category, detail: h.detail, slip };
    }
  }
  return null;
}
