// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the readout of a pre-registered experiment
//
// Reads graded-attempt events (the server grader's learning_events payloads)
// and a definition from server/platform/experiments/, and reports — in this
// order, each able to stop the next:
//
//   1. integrity   every logged arm equals the arm the definition's hash gives
//                  that account; a mismatch is a bug and stops interpretation
//   2. SRM         chi-square of assigned accounts against the arm weights;
//                  p < 0.001 stops interpretation (GOVERNANCE_V7 §4)
//   3. outcome observation, per arm (a missing outcome is never a failure)
//   4. guardrails  time on task and give-up rate, per arm — readable at any
//                  sample, for harm only; they never declare a winner
//   5. the primary outcome — WITHHELD until every arm has the definition's
//                  minimum sample of observed outcomes. Below it the readout
//                  shows counts and refuses to estimate: no interval, no
//                  difference, no direction. At or above it, the difference
//                  in proportions with a Newcombe hybrid score interval.
//
// The readout never says an arm "won". It reports whether the pre-registered
// decision rule is met; promotion is still an owner decision that also needs
// a recorded A/A pass. Pure: the same events give the same readout.
// ─────────────────────────────────────────────────────────────────────────────

import { assignArm } from './experiments.js';

const Z95 = 1.959963984540054;
const HOUR_MS = 3600 * 1000;
const RESOLVED_MODES = new Set(['practice', 'review', 'task']);

/** Wilson score interval for k successes in n. */
export function wilson(k, n, z = Z95) {
  if (!(n > 0)) return { lo: 0, hi: 1, p: null };
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p };
}

/** Newcombe (1998, method 10) hybrid score interval for p2 − p1. */
export function newcombeDifference(k1, n1, k2, n2, z = Z95) {
  const a = wilson(k1, n1, z), b = wilson(k2, n2, z);
  const d = b.p - a.p;
  const lo = d - Math.sqrt((b.p - b.lo) ** 2 + (a.hi - a.p) ** 2);
  const hi = d + Math.sqrt((b.hi - b.p) ** 2 + (a.p - a.lo) ** 2);
  return { difference: d, lo, hi };
}

/** Upper tail of the chi-square distribution (regularised upper incomplete gamma). */
export function chiSquareP(x, df) {
  if (!(x > 0)) return 1;
  const s = df / 2, t = x / 2;
  const lnGamma = z => {
    const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1;
    let acc = 0.99999999999980993;
    for (let i = 0; i < g.length; i++) acc += g[i] / (z + i + 1);
    const w = z + g.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(w) - w + Math.log(acc);
  };
  if (t < s + 1) {
    let sum = 1 / s, term = sum;
    for (let n = 1; n < 500; n++) { term *= t / (s + n); sum += term; if (term < sum * 1e-15) break; }
    return Math.max(0, Math.min(1, 1 - sum * Math.exp(-t + s * Math.log(t) - lnGamma(s))));
  }
  // Continued fraction for Q(s, t), modified Lentz (Numerical Recipes gcf).
  const TINY = 1e-300;
  let b = t + 1 - s, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.max(0, Math.min(1, h * Math.exp(-t + s * Math.log(t) - lnGamma(s))));
}

/** Sample-ratio check of counts per arm against the definition's weights. */
export function sampleRatio(def, counts) {
  const total = def.arms.reduce((s, a) => s + (counts[a.id] || 0), 0);
  if (!total) return { total, chi2: 0, p: 1, mismatch: false };
  const chi2 = def.arms.reduce((s, a) => { const e = total * a.weight; return s + ((counts[a.id] || 0) - e) ** 2 / e; }, 0);
  const p = chiSquareP(chi2, def.arms.length - 1);
  return { total, chi2, p, mismatch: p < 0.001 };
}

// Help the tutor policy offered on the item above A0 (helpPlan.js): such an
// attempt is assisted, whatever the ladder says.
const policyHelped = e => Array.isArray(e.policyAssistance) && e.policyAssistance.some(x => x?.level && x.level !== 'A0');
const skillOf = e => (typeof e.dotpoint === 'string' && e.dotpoint) ? e.dotpoint : (typeof e.subtopic === 'string' ? e.subtopic : null);
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Normalise one event row: an exported learning_events row ({account_id,
 * occurred_at, payload_json}) or an already-flattened payload with accountId.
 */
export function eventOf(row) {
  if (!row || typeof row !== 'object') return null;
  let payload = row;
  if (typeof row.payload_json === 'string') { try { payload = JSON.parse(row.payload_json); } catch { return null; } }
  const accountId = row.account_id ?? row.accountId ?? payload.accountId;
  const at = Number(row.occurred_at ?? payload.at ?? payload.createdAt);
  if (typeof accountId !== 'string' || !Number.isFinite(at)) return null;
  return { ...payload, accountId, at };
}

/**
 * The per-account primary outcome: the first index attempt (in time) whose
 * skill has a later qualifying outcome — another family of the same skill, at
 * least delayHours later, no rung, not a reveal, not a repeat. Returns
 * { observed, success } or { observed: false }.
 */
export function primaryOutcomeOf(events, delayHours) {
  const rows = [...events].sort((a, b) => a.at - b.at);
  for (let i = 0; i < rows.length; i++) {
    const idx = rows[i];
    const skill = skillOf(idx);
    const fam = idx.experiment?.family;
    if (!skill || !fam) continue;
    for (let j = i + 1; j < rows.length; j++) {
      const o = rows[j];
      if (o.at - idx.at < delayHours * HOUR_MS) continue;
      if (skillOf(o) !== skill || !o.experiment?.family || o.experiment.family === fam) continue;
      if (Number(o.hintLevel) > 0 || o.revealed === true || o.repeat === true || policyHelped(o)) continue;
      return { observed: true, success: o.correct === true, indexAt: idx.at, outcomeAt: o.at, skill };
    }
  }
  return { observed: false };
}

/**
 * The readout. `events` are graded-attempt rows; only those stamped with this
 * experiment's id are considered (the stamp exists only while it was active).
 */
export function readout(def, rows, { now = Date.now() } = {}) {
  const events = rows.map(eventOf).filter(Boolean)
    .filter(e => RESOLVED_MODES.has(e.mode || 'practice'))
    .map(e => ({ e, a: (e.experiment?.assignments || []).find(x => x?.id === def.id && x?.version === def.version) }))
    .filter(x => x.a);
  const byAccount = new Map();
  let mismatched = 0;
  for (const { e, a } of events) {
    const expected = assignArm(def, e.accountId);
    if (a.arm !== expected) { mismatched += 1; continue; }
    if (!byAccount.has(e.accountId)) byAccount.set(e.accountId, { arm: expected, events: [] });
    byAccount.get(e.accountId).events.push(e);
  }
  const arms = Object.fromEntries(def.arms.map(a => [a.id, { assigned: 0, observed: 0, successes: 0, resolved: 0, reveals: 0, ms: [] }]));
  for (const { arm, events: evs } of byAccount.values()) {
    const s = arms[arm];
    s.assigned += 1;
    for (const e of evs) {
      s.resolved += 1;
      if (e.revealed === true) s.reveals += 1;
      if (Number.isSafeInteger(e.experiment?.ms) && e.revealed !== true) s.ms.push(e.experiment.ms);
    }
    const o = primaryOutcomeOf(evs, def.primaryOutcome.delayHours);
    if (o.observed) { s.observed += 1; if (o.success) s.successes += 1; }
  }
  const srm = sampleRatio(def, Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, v.assigned])));
  const observation = sampleRatio(def, Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, v.observed])));
  const [control, treatment] = def.arms.map(a => a.id);

  const guardrails = def.guardrails.filter(g => g.kind !== 'manual').map(g => {
    if (g.id === 'time-on-task') {
      const c = median(arms[control].ms), t = median(arms[treatment].ms);
      const ratio = c && t ? t / c : null;
      return { id: g.id, control: c, treatment: t, ratio, breached: ratio !== null && (ratio > g.threshold || (def.id.startsWith('aa-') && ratio < 1 / g.threshold)) };
    }
    if (g.id === 'give-up-rate') {
      const rate = s => (s.resolved ? s.reveals / s.resolved : null);
      const c = rate(arms[control]), t = rate(arms[treatment]);
      const diff = c !== null && t !== null ? t - c : null;
      return { id: g.id, control: c, treatment: t, difference: diff, breached: diff !== null && (def.id.startsWith('aa-') ? Math.abs(diff) > g.threshold : diff > g.threshold) };
    }
    return { id: g.id, breached: false, note: 'not computed' };
  });
  const manual = def.guardrails.filter(g => g.kind === 'manual').map(g => ({ id: g.id, instrumented: g.instrumented === true, note: 'reviewed by a person; not computed from events' }));

  const minimum = def.minimumSample.perArm;
  const short = def.arms.filter(a => arms[a.id].observed < minimum).map(a => a.id);
  const counts = Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, { assigned: v.assigned, observedOutcomes: v.observed, resolvedAttempts: v.resolved }]));
  const base = { experiment: def.id, version: def.version, generatedAt: new Date(now).toISOString(), minimumPerArm: minimum,
    integrity: { mismatchedArms: mismatched }, srm, outcomeObservation: observation, counts, guardrails, manualGuardrails: manual };

  if (mismatched > 0) return { ...base, verdict: 'stop-integrity', primary: null, message: `${mismatched} event(s) carry an arm that is not this account's assignment. Find the cause before reading anything else.` };
  if (srm.mismatch) return { ...base, verdict: 'stop-srm', primary: null, message: `Sample ratio mismatch (p = ${srm.p.toExponential(2)}). The assignment or logging is broken; no effect is interpreted.` };
  if (short.length) {
    return { ...base, verdict: 'insufficient-sample', primary: null,
      message: `Refused: ${short.join(', ')} ${short.length === 1 ? 'has' : 'have'} fewer than ${minimum} observed outcomes. No estimate, interval or direction is reported below the pre-registered minimum.` };
  }
  const c = arms[control], t = arms[treatment];
  const diff = newcombeDifference(c.successes, c.observed, t.successes, t.observed);
  const breached = guardrails.some(g => g.breached);
  const meets = def.id.startsWith('aa-') ? (diff.lo <= 0 && diff.hi >= 0 && !observation.mismatch) : (diff.lo > 0 && !breached);
  return { ...base,
    verdict: def.id.startsWith('aa-') ? (meets ? 'aa-pass' : 'aa-fail') : (meets ? 'decision-rule-met' : 'decision-rule-not-met'),
    primary: {
      [control]: { successes: c.successes, observed: c.observed, rate: c.successes / c.observed, interval: wilson(c.successes, c.observed) },
      [treatment]: { successes: t.successes, observed: t.observed, rate: t.successes / t.observed, interval: wilson(t.successes, t.observed) },
      difference: diff.difference, interval95: [diff.lo, diff.hi]
    },
    message: def.id.startsWith('aa-')
      ? (meets ? 'A/A: no sample-ratio mismatch and the outcome interval includes zero.' : 'A/A failed: investigate the assignment, logging or analysis before any experiment is read.')
      : (meets ? 'The pre-registered rule is met. Promotion still needs a recorded A/A pass and an owner decision.' : 'The pre-registered rule is not met. The fixed ladder stays.')
  };
}
