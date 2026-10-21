import React from 'react';
import { useT } from '../i18n/index.js';

// One square per mark of a certified attempt: earned, or lost. Only drawn
// from the server's certified marks (history items carry them only then).
export default function MarkStrip({ earned, possible }) {
  const t = useT();
  if (!Number.isInteger(earned) || !Number.isInteger(possible) || possible < 1 || earned < 0 || earned > possible) return null;
  return (
    <span className="in-strip" data-mark-strip={`${earned}/${possible}`}>
      <span aria-hidden="true">
        {Array.from({ length: possible }, (_, i) => <i key={i} className={i < earned ? 'is-earned' : 'is-lost'} />)}
      </span>
      <b aria-hidden="true">{earned}/{possible}</b>
      <span className="sr-only">{t('verdict.rowMarks', { earned, total: possible })}</span>
    </span>
  );
}
