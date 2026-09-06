// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a student sees when the free tier runs out
//
// The cap is enforced in the local backend, which throws a gate error. Without
// this the student would meet that error as raw text, which reads like a fault
// in the app rather than the end of today's free questions. So it is said
// plainly: what ran out, when it comes back, and what Premium changes — with no
// countdown pressure and no dark pattern.
//
// It never invents a price. Prices come from the deployment's billing
// configuration, and where none is configured it simply does not mention one.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Link } from 'react-router-dom';

function whenItResets(resetsAt, timeZone) {
  if (!Number.isFinite(resetsAt)) return null;
  try {
    const at = new Intl.DateTimeFormat('en-IN', {
      timeZone: timeZone || undefined, hour: 'numeric', minute: '2-digit', hour12: true,
      weekday: 'short', day: 'numeric', month: 'short'
    }).format(new Date(resetsAt));
    return at;
  } catch { return null; }
}

/**
 * `gate` is the error the local backend threw: { code, message, used, limit,
 * resetsAt, nextAt, timeZone, capability, refreshRequired }.
 */
export default function FreeCapNotice({ gate, onRetry }) {
  if (!gate) return null;
  const isExam = gate.code === 'FREE_EXAM_CAP_REACHED' || gate.capability === 'premium-exams';
  const resets = whenItResets(gate.resetsAt ?? gate.nextAt, gate.timeZone);

  return (
    <div className="qpage">
      <section className="card" role="status" aria-live="polite" style={{ maxWidth: 560 }}>
        <div className="sc-label" style={{ marginBottom: 8 }}>
          {isExam ? 'Free exam simulations' : "Today's free questions"}
        </div>

        <p style={{ marginTop: 0 }}>
          {isExam
            ? 'The free plan includes one full exam simulation every 30 days, and you have used this one.'
            : `You have used all ${gate.limit ?? 20} free practice questions for today.`}
        </p>

        {resets && (
          <p className="muted">
            {isExam ? 'Your next free simulation unlocks ' : 'They come back at midnight, '}
            <b>{resets}</b>
            {gate.timeZone ? ` (${gate.timeZone.replace('_', ' ')})` : ''}.
          </p>
        )}

        {gate.refreshRequired && (
          <p className="muted">
            Your Premium access was last confirmed more than a week ago. Reconnect once and it
            continues.
          </p>
        )}

        <p className="muted">
          Everything you have already done stays available offline: your history, your worked
          solutions, your progress and your handwriting.
        </p>

        <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/settings#cloud-account-title">
            {gate.refreshRequired ? 'Reconnect my account' : 'See Premium'}
          </Link>
          {onRetry && (
            <button className="btn btn-quiet" onClick={onRetry}>Try again</button>
          )}
          <Link className="btn btn-quiet" to="/history">Review what I have done</Link>
        </div>
      </section>
    </div>
  );
}
