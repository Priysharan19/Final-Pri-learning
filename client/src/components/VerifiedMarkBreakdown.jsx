import React from 'react';
import { useT } from '../i18n/index.js';
import { verifiedMarkBreakdown } from './verifiedMarkRows.js';

// The eval header already states the authoritative overall mark. The server
// reports aggregate method credit, not invented "step 1 got 1 mark" rows.
export default function VerifiedMarkBreakdown({ result, grade }) {
  const t = useT();
  const evidence = verifiedMarkBreakdown(result, grade);
  if (!evidence) return null;
  return (
    <section className="board-award" data-verified-step-marks={evidence.scheme}
      aria-label={t('verifiedMarks.heading')}
      style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
      <div className="sc-label" style={{ marginBottom: 6 }}>{t('verifiedMarks.heading')}</div>
      {evidence.method && (
        <p data-method-credit="aggregate">
          {evidence.method.awarded > 0
            ? t('verifiedMarks.methodAggregate', { count: evidence.method.awarded, n: evidence.method.awarded })
            : t('verifiedMarks.methodNone')}
        </p>
      )}
      <p data-final-answer-credit={evidence.finalAnswer}>
        {t(evidence.finalAnswer === 'accepted' ? 'verifiedMarks.finalAccepted' : 'verifiedMarks.finalNotAccepted')}
      </p>
      {evidence.workingEvidence === 'not-read' && (
        <p className="muted" data-method-unread>{t('verifiedMarks.unread')}</p>
      )}
      {Number.isFinite(evidence.totals.creditedAfterHints) && (
        <p data-grade-after-hints>{t('verifiedMarks.hints', {
          before: evidence.totals.earned, after: evidence.totals.creditedAfterHints
        })}</p>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t('verifiedMarks.notOfficial')}</p>
    </section>
  );
}
