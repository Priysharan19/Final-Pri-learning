import React from 'react';
import { useT } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';

// The server's mark, set out as CBSE-style step rows (server/platform/
// markRows.js). Display only: the rows sum to the mark the deterministic
// engine gave, and the server omits them rather than send rows that would
// not. Whole marks. Authored step headings appear only on a correct answer;
// a wrong answer's method marks are numbered, never named. Pri practice
// feedback in a board-style layout, not a CBSE marking scheme.

export default function StepMarks({ markRows }) {
  const t = useT();
  const rows = Array.isArray(markRows?.rows) ? markRows.rows : [];
  if (!rows.length) return null;
  const earned = rows.reduce((s, r) => s + (Number(r.earned) || 0), 0);
  const total = rows.reduce((s, r) => s + (Number(r.outOf) || 0), 0);
  return (
    <div className="board-award in-step-marks" data-step-marks={markRows.scheme} style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <span className="sc-label" style={{ margin: 0 }}>{t('verdict.markedStepByStep')}</span>
        {rows.length > 1 && <b style={{ fontVariantNumeric: 'tabular-nums' }}>{earned} / {total}</b>}
      </div>
      {rows.map((row, i) => {
        const full = row.earned === row.outOf;
        const label = row.kind === 'answer' ? t('board.labelAnswer') : row.label || t('inst.workingStep', { n: row.step });
        return (
          <div key={i} className="set-row" data-step-mark={row.kind} style={{ paddingTop: 5, paddingBottom: 5 }}>
            <span className="set-k" style={{ fontWeight: 400 }}>
              <span aria-hidden="true" style={{ marginRight: 7, color: full ? 'var(--good)' : 'var(--correction)' }}>
                <Icon name={full ? 'check' : 'correction'} size={14} />
              </span>
              {label}
            </span>
            <span className="set-v" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="sr-only">{t('verdict.rowMarks', { earned: row.earned, total: row.outOf })} </span>{row.earned}/{row.outOf}
            </span>
          </div>
        );
      })}
      {Number.isFinite(markRows.creditedAfterHints) && (
        <p style={{ fontSize: 13, marginTop: 8 }} data-step-marks-hints>{t('inst.stepMarksAfterHints', { credited: markRows.creditedAfterHints })}</p>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('inst.stepMarksOrder')} {t('inst.stepMarksNote')}</p>
    </div>
  );
}
