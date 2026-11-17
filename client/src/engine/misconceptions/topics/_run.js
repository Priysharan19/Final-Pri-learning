// Runs a topic's slips over two lines of numeric working. The hypotheses say
// how a wrong line would be made from the line above; a slip is named only when
// the student's line equals what that slip would produce (and is not equal to
// the line above). Deterministic, no model, never decides a mark.
import { normalize, parse, evaluate } from '../../expr.js';

const readLine = text => { try { return parse(normalize(String(text || '').replace(/^∴\s*/, ''))); } catch { return null; } };
const valueOf = ast => { try { const v = evaluate(ast, {}); return Number.isFinite(v) ? v : null; } catch { return null; } };
const same = (a, b) => a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** { code, detail, copy } for the slip that makes `brokenText` from `prevText`, or null. */
export function detectSlip(slips, prevText, brokenText) {
  const A = readLine(prevText), B = readLine(brokenText);
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
