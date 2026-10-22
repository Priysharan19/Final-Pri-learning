// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a student sees when a free-plan limit is reached
//
// Practice is unlimited on every plan. What the free plan rations is examiner
// marking — FREE_MARKING_ALLOWANCE.scriptsPerDay marked answers a day, counted
// and refused by the server (402 FREE_CAP_REACHED) — and mock papers are
// Premium (402 PREMIUM_REQUIRED, capability premium-exams). Without this the
// student would meet that refusal as raw text, which reads like a fault in the
// app. So it is said plainly: what ran out, when it comes back, and what
// Premium changes — with no countdown pressure and no dark pattern.
//
// It never invents a price. Prices come from the deployment's billing
// configuration, and where none is configured it simply does not mention one.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import PageLink from './PageLink.jsx';
import { useT, useTx } from '../i18n/index.js';
import { FREE_MARKING_ALLOWANCE } from '../engine/practiceAllowance.js';
import { PAYWALL_ROUTE } from '../paywall/route.js';

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
  // Mock papers have no free allowance to come back; marking returns at midnight.
  const resets = isExam ? null : whenItResets(gate.resetsAt ?? gate.nextAt, gate.timeZone);
  const limit = Number.isFinite(gate.limit) && gate.limit > 0 ? gate.limit : FREE_MARKING_ALLOWANCE.scriptsPerDay;

  return (
    <div className="qpage">
      <section className="card" role="status" aria-live="polite" style={{ maxWidth: 560 }}>
        <div className="sc-label" style={{ marginBottom: 8 }}>
          {isExam ? t('freeCap.examTitle') : t('freeCap.questionsTitle')}
        </div>

        <p style={{ marginTop: 0 }}>
          {isExam
            ? t('freeCap.examUsed', { n: FREE_MARKING_ALLOWANCE.scriptsPerDay, count: FREE_MARKING_ALLOWANCE.scriptsPerDay })
            : t('freeCap.questionsUsed', { count: limit, n: limit })}
        </p>

        {resets && (
          <p className="muted">
            {tx('freeCap.questionsReturn', {
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
          {gate.refreshRequired
            ? <PageLink className="btn btn-primary" to="/settings#cloud-account-title">{t('freeCap.reconnect')}</PageLink>
            : <PageLink className="btn btn-primary" data-free-cap-premium to={PAYWALL_ROUTE} state={{ from: isExam ? 'exams' : 'marking' }}>{t('freeCap.seePremium')}</PageLink>}
          {onRetry && (
            <button className="btn btn-quiet" onClick={onRetry}>{t('common.tryAgain')}</button>
          )}
          <PageLink className="btn btn-quiet" to="/review">{t('freeCap.reviewDone')}</PageLink>
        </div>
      </section>
    </div>
  );
}
