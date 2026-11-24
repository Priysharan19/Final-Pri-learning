// Pri Learning · the criteria table of a marked question, for a scheme the author approved
//
// The one table, used by the marked page and by the answer card. It draws only what criteriaView (criteriaTableModel.js) returns: a table that is
// approved for its current digest and adds up to the server's mark. It shows each criterion, earned, not earned or not verified, the lines that earned it,
// and the label saying whose marking this is. It decides nothing.
import React from 'react';
import Icon from './Icon.jsx';
import { useT } from '../i18n/index.js';
import { listOf } from './markedPageModel.js';
import { criteriaView, cardsOfReport } from './criteriaTableModel.js';
import './MarkedPage.css';

// Either a ready `view`, or the server's reply fields: `criteria` (res.methodCriteria), `mark` ({ awarded, possible }) and `report` (res.stepReport).
export default function SchemeTable({ view: given = null, criteria = null, mark = null, report = null }) {
  const t = useT();
  const view = given ?? (criteria ? criteriaView({ criteria, mark, cards: cardsOfReport(report) }) : null);
  if (!view) return null;
  return (
    <div className="mp-criteria" data-mp-criteria={view.typeId}>
      <table className="mp-table">
        <caption>{t('mp.criteria.caption')}</caption>
        <thead><tr><th scope="col">{t('mp.criteria.criterion')}</th><th scope="col">{t('mp.criteria.result')}</th></tr></thead>
        <tbody>
          {view.rows.map(r => (
            <tr key={r.key} data-mp-criterion={r.key} data-awarded={r.awarded ? 'yes' : r.verified ? 'no' : 'unverified'}>
              <td><span>{r.text}</span>{r.reason ? <span className="mp-why">{r.reason}</span> : null}</td>
              <td>
                <Icon name={r.awarded ? 'check' : 'uncertain'} size={14} />
                <span>{r.awarded ? t('mp.criteria.awarded', { marks: r.marks, count: r.marks }) : t(r.verified ? 'mp.criteria.notAwarded' : 'mp.criteria.notVerified', { marks: r.marks, count: r.marks })}</span>
                {r.lines.length > 0 && <span className="mp-why">{t('mp.criteria.onLines', { count: r.lines.length, list: listOf(r.lines) })}</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th scope="row">{t('mp.criteria.total')}</th><td>{t('mp.mark', { earned: view.earned, possible: view.possible })}</td></tr></tfoot>
      </table>
      <p className="mp-label" data-mp-approval-label>{t('mp.criteria.label')}</p>
    </div>
  );
}
