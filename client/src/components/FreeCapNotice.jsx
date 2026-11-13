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
import { PAYWALL_ROUTE } from '../paywall/route.js';
// Where and how the reset is written (plan H7): lib/locale.js capResetClock.
import { capResetClock as resetClock } from '../lib/locale.js';

function whenItResets(resetsAt, timeZone, profile = null) {
  if (!Number.isFinite(resetsAt)) return null;
  const clock = resetClock(timeZone, profile);
  try {
    const at = new Intl.DateTimeFormat(clock.locale, {
      timeZone: clock.timeZone || undefined, hour: 'numeric', minute: '2-digit', hour12: true,
      weekday: 'short', day: 'numeric', month: 'short'
    }).format(new Date(resetsAt));
    return at;
  } catch { return null; }
}

/**
 * `gate` is the error the local backend threw: { code, message, used, limit,
 * resetsAt, nextAt, timeZone, capability, refreshRequired }. `profile` is the
 * signed-in student, whose locale and timezone the reset is written in.
 */
export default function FreeCapNotice({ gate, onRetry, profile = null }) {
  const t = useT();
  const tx = useTx();
  if (!gate) return null;
  const isExam = gate.code === 'FREE_EXAM_CAP_REACHED' || gate.capability === 'premium-exams';
  const resets = whenItResets(gate.resetsAt ?? gate.nextAt, gate.timeZone, profile);
  const zone = resetClock(gate.timeZone, profile).timeZone;

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
              when: <><b>{resets}</b>{zone ? ` (${zone.replace('_', ' ')})` : ''}</>
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
          {/* A device whose Premium needs reconnecting is sent to its account;
              everyone else to the one Premium screen, which says why they came. */}
          <PageLink className="btn btn-primary" to={gate.refreshRequired ? '/settings#cloud-account-title' : PAYWALL_ROUTE}
            state={gate.refreshRequired ? undefined : { from: isExam ? 'exams' : 'practice' }}>
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
