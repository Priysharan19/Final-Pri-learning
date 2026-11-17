// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · where the marks were lost, by cause and by topic
//
// Renders analysis.causes from local/examAnalysis.js — arithmetic over marks
// the marker already awarded. Every figure is a number in words, never colour
// alone. It says where marks were lost; it predicts no band and no rank.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useT } from '../i18n/index.js';
import { LOSS_CAUSES } from '../local/examAnalysis.js';

const CAUSE_KEY = { method: 'lossBreakdown.cause.method', slip: 'lossBreakdown.cause.slip', blank: 'lossBreakdown.cause.blank', time: 'lossBreakdown.cause.time' };
const COL_KEY = { method: 'lossBreakdown.col.method', slip: 'lossBreakdown.col.slip', blank: 'lossBreakdown.col.blank', time: 'lossBreakdown.col.time' };

export default function LossBreakdown({ causes }) {
  const t = useT();
  if (!causes || !(causes.total > 0)) return null;
  const present = LOSS_CAUSES.filter(k => causes[k] > 0);
  return (
    <section className="card loss-breakdown" aria-labelledby="loss-breakdown-title" data-loss-breakdown>
      <h2 className="card-title" id="loss-breakdown-title">{t('lossBreakdown.title')}</h2>
      <p className="sub" style={{ marginBottom: 8 }}>{t('lossBreakdown.summary', { count: causes.total, n: causes.total })}</p>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6, fontSize: 14 }}>
        {present.map(k => (
          <li key={k} data-loss-cause={k}>
            <strong>{t('lossBreakdown.marks', { count: causes[k], n: causes[k] })}</strong>{' '}
            <span>{t(CAUSE_KEY[k])}</span>
          </li>
        ))}
      </ul>
      {causes.topics.length > 0 && (
        <>
          <h3 className="sc-label" style={{ fontSize: 13, margin: '12px 0 6px' }}>{t('lossBreakdown.topics')}</h3>
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">{t('lossBreakdown.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('lossBreakdown.colTopic')}</th>
                  <th scope="col">{t('lossBreakdown.colLost')}</th>
                  {present.map(k => <th scope="col" key={k}>{t(COL_KEY[k])}</th>)}
                </tr>
              </thead>
              <tbody>
                {causes.topics.map(c => (
                  <tr key={c.id}>
                    <th scope="row" lang="en" style={{ fontWeight: 600, textAlign: 'left' }}>{c.label}</th>
                    <td>{c.lost}</td>
                    {present.map(k => <td key={k}>{c[k]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>{t('lossBreakdown.note')}</p>
    </section>
  );
}
