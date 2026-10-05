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
import PageLink from './PageLink.jsx';
import { useT, useTx } from '../i18n/index.js';

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
  const t = useT();
  const tx = useTx();
  if (!gate) return null;
  const isExam = gate.code === 'FREE_EXAM_CAP_REACHED' || gate.capability === 'premium-exams';
  const resets = whenItResets(gate.resetsAt ?? gate.nextAt, gate.timeZone);

  return (
    <div className="qpage">
      <section className="card" role="status" aria-live="polite" style={{ maxWidth: 560 }}>
        <div className="sc-label" style={{ marginBottom: 8 }}>
          {isExam ? t('freeCap.examTitle') : t('freeCap.questionsTitle')}
        </div>

        <p style={{ marginTop: 0 }}>
          {isExam
            ? t('freeCap.examUsed')
            : t('freeCap.questionsUsed', { count: gate.limit ?? 20, n: gate.limit ?? 20 })}
        </p>

        {resets && (
          <p className="muted">
            {tx(isExam ? 'freeCap.examUnlocks' : 'freeCap.questionsReturn', {
              when: <><b>{resets}</b>{gate.timeZone ? ` (${gate.timeZone.replace('_', ' ')})` : ''}</>
            })}
          </p>
        )}

        {gate.refreshRequired && (
          <p className="muted">
            {t('freeCap.refreshRequired')}
          </p>
        )}

        <p className="muted">
          {t('freeCap.offlineKept')}
        </p>

        <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <PageLink className="btn btn-primary" to="/settings#cloud-account-title">
            {gate.refreshRequired ? t('freeCap.reconnect') : t('freeCap.seePremium')}
          </PageLink>
          {onRetry && (
            <button className="btn btn-quiet" onClick={onRetry}>{t('common.tryAgain')}</button>
          )}
          <PageLink className="btn btn-quiet" to="/review">{t('freeCap.reviewDone')}</PageLink>
        </div>
      </section>
    </div>
  );
}
