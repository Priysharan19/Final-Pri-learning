// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a second read of the working
//
// The on-device step checker is exact: it knows the shapes a question's
// solution can take and verifies the student's lines against them. When it
// finds the broken line, that verdict is authoritative and this module does not
// touch it.
//
// What it cannot do is diagnose a line nobody authored. The common and
// dispiriting case is: the answer is wrong, every line looks locally fine, and
// the only thing the app can say is "that's not right — try again". A student
// staring at six lines of their own algebra does not need to be told it is
// wrong. They need to be told WHICH line and WHAT kind of mistake.
//
// That is the gap this fills, and only that gap:
//
//   · It is feedback, never marking. The mark was decided by the deterministic
//     engine and does not move afterwards. A mark that changes a second later
//     is worse than a mark with no explanation.
//   · The local verdict wins wherever it has one. Cloud verdicts fill silence.
//   · An unsure check is shown as a suggestion in words, never as ✗ on a line.
//     A confident cross on a line that was right is the worst thing this can do.
//   · Off until the student turns it on.
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';

/** How a merged verdict is labelled so History and evidence can tell them apart. */
export const CLOUD_WORKING_ENGINE = 'cloud-working';

export function workingCheckEnabled(user, { available = cloudAvailable } = {}) {
  if (user?.cloudMarking !== true) return false;
  try { return available() === true; } catch { return false; }
}

/**
 * Is there anything here worth asking about?
 *
 * Only when the student got it wrong and the local checker could not say where.
 * A correct answer needs no diagnosis, and a local break is already the answer
 * to "which line". Spending a reasoning call on either is spending a student's
 * allowance on something they already have.
 */
export function shouldCheckWorking({ correct, invalid, revealed, lines, localReport } = {}) {
  if (correct || invalid || revealed) return false;
  if (!Array.isArray(lines) || lines.filter(l => String(l || '').trim()).length < 2) return false;
  if (localReport?.lines?.some(l => l.status === 'break')) return false;
  return true;
}

/**
 * Ask the server. Resolves to null for every "carry on without it" case and
 * never throws into the marking screen.
 */
export async function checkWorkingWithCloud(lines, {
  user,
  prompt = '',
  signal = null,
  transport = cloud,
  available = cloudAvailable
} = {}) {
  if (!workingCheckEnabled(user, { available })) return null;

  // Blank lines are not sent — there is nothing to check on them — so the
  // server's indices count only the non-blank lines while the ink surface
  // indexes every line it read. Without this map a verdict lands on the wrong
  // row: a ✗ and "the mistake is here" on a line that was correct.
  const clean = [];
  const originalIndex = [];
  (lines || []).forEach((line, i) => {
    const t = String(line ?? '').trim();
    if (!t) return;
    clean.push(t);
    originalIndex.push(i);
  });
  if (clean.length < 2) return null;

  try {
    const response = await transport.checkWorking(String(prompt || ''), clean, { signal });
    const check = response?.check;
    if (!check || !Array.isArray(check.lines) || !check.lines.length) return null;
    return {
      ...check,
      lines: check.lines.map(l => ({ ...l, index: originalIndex[l.index] ?? l.index })),
      firstBreak: Number.isInteger(check.firstBreak) && check.firstBreak >= 0
        ? (originalIndex[check.firstBreak] ?? check.firstBreak)
        : -1
    };
  } catch (error) {
    return { error: { code: error?.code || 'WORKING_FAILED', message: error?.message || '' } };
  }
}

/**
 * Merge a server check into the per-line verdicts already on screen.
 *
 * Local verdicts are never overwritten — a rule that fired is worth more than a
 * judgement. Cloud verdicts land only on lines the local checker left silent,
 * and only when the check was confident. An unconfident check contributes its
 * words and none of its crosses.
 */
export function mergeVerdicts(localVerdicts, check, { lineCount } = {}) {
  const n = Number.isInteger(lineCount) ? lineCount : (localVerdicts?.length || check?.lines?.length || 0);
  if (!n || !check || check.error) return localVerdicts || null;

  const confident = check.needsConfirmation !== true;
  // When the server found no break at all, its words are useful and its ticks
  // are not: a green ✓ from a judgement renders identically to one from a
  // verified rule, and this only runs when the answer is already known to be
  // wrong. Saying "every line is fine" in ticks on a wrong answer is worse than
  // saying nothing.
  if (!Number.isInteger(check.firstBreak) || check.firstBreak < 0) return localVerdicts || null;
  const out = [];
  let changed = false;

  for (let i = 0; i < n; i += 1) {
    const local = localVerdicts?.[i] || null;
    const cloudLine = check.lines.find(l => l.index === i) || null;

    // A local verdict that actually says something stands, untouched.
    if (local && local.status && local.status !== 'unknown' && local.status !== 'note') {
      out.push(local);
      continue;
    }
    if (!cloudLine || !confident) { out.push(local); continue; }

    if (cloudLine.status === 'break') {
      out.push({ status: 'break', note: cloudLine.why || 'this is where the working breaks', source: CLOUD_WORKING_ENGINE });
      changed = true;
    } else if (cloudLine.status === 'ok') {
      out.push({
        status: 'ok',
        // Right work on their own wrong number still earns the tick, and saying
        // so is the difference between "you failed" and "you slipped once".
        note: cloudLine.carried ? (cloudLine.why || 'correct working on your earlier value') : (local?.note || undefined),
        source: CLOUD_WORKING_ENGINE
      });
      changed = true;
    } else {
      out.push(local);
    }
  }
  return changed ? out : (localVerdicts || null);
}

/**
 * The sentence shown under the working.
 *
 * Two forms, and no third: it found the line, or it did not. It never states
 * the answer, and the route it came from is instructed never to return one.
 */
export function workingNote(check) {
  if (!check || check.error) return null;
  const firstBreak = Number.isInteger(check.firstBreak) ? check.firstBreak : -1;
  if (firstBreak < 0) {
    return {
      tone: 'note',
      text: 'Each line follows from the one before it, so the slip is in how the question was set up rather than in the algebra.'
    };
  }
  const line = check.lines.find(l => l.index === firstBreak);
  const why = line?.why ? ` — ${line.why}` : '';
  const hint = check.hint ? ` ${check.hint}` : '';
  return {
    tone: check.needsConfirmation ? 'maybe' : 'break',
    text: check.needsConfirmation
      ? `This might be line ${firstBreak + 1}${why}.${hint} Check it yourself — I am not certain of this one.`
      : `Line ${firstBreak + 1} is where it goes wrong${why}.${hint}`
  };
}
