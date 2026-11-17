// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Progress, drawn from evidence (both editions)
//
// One page for Priyabhata and Prithagoras. It reads engine/progressEvidence.js
// through GET /progress/evidence and the edition's own curriculum rows, and
// says, topic by topic, what the student's own record supports: how often the
// answers were right, how many were given without help, whether they held after
// a gap, whether they carried to a different kind of question, and what to look
// at first. Every dimension is a word. Where the record is too thin it says
// "not enough evidence yet". No figure stands in for a mark, and nothing here
// ranks or compares anyone.
//
// Younger students see the words. A teacher (user.role === 'teacher') also sees
// the counts behind each word.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';
import { INSTRUMENT_UI } from '../platform/features.js';

// Explicit maps (not template keys) so the catalogue check can see every string used.
const ACCURACY = { strong: 'progressEv.acc.strong', building: 'progressEv.acc.building', early: 'progressEv.acc.early', thin: 'progressEv.thin' };
const INDEPENDENCE = { own: 'progressEv.ind.own', mixed: 'progressEv.ind.mixed', helped: 'progressEv.ind.helped', thin: 'progressEv.thin' };
const RETENTION = { holding: 'progressEv.ret.holding', slipping: 'progressEv.ret.slipping', thin: 'progressEv.thin' };
const TRANSFER = { carries: 'progressEv.tr.carries', single: 'progressEv.tr.single', thin: 'progressEv.thin' };
const REASON = { slipping: 'progressEv.why.slipping', shaky: 'progressEv.why.shaky', helped: 'progressEv.why.helped', due: 'progressEv.why.due' };

function Word({ band, map, t }) {
  return <span className={band === 'thin' ? 'muted' : undefined} data-band={band}>{t(map[band] || map.thin)}</span>;
}

/**
 * @param {{ evidence: object, rows: {id:string,name:string,strand?:string}[], scope: string,
 *           practiseTo: (row) => string, teacher?: boolean, ownHeading?: boolean,
 *           children?: React.ReactNode }} props
 *   children  drawn under the headline facts (the syllabus board, when on).
 */
export default function EvidenceProgress({ evidence, rows, scope, practiseTo, teacher = false, ownHeading = false, children = null }) {
  const t = useT();
  const nav = useNavigate();
  const byId = new Map(evidence.topics.map(x => [x.id, x]));
  const nameOf = id => rows.find(r => r.id === id)?.name || id;
  const started = rows.filter(r => byId.has(r.id)).length;
  const { overall } = evidence;
  // The page's own h1 is spoken, not drawn, where no Report above carries one (ownHeading).
  const Title = INSTRUMENT_UI || ownHeading ? 'h2' : 'h1';

  return (
    <div className="pg" data-progress-evidence>
      {ownHeading && <h1 className="sr-only">{t('progressEv.title')}</h1>}
      <header className="pg-head">
        <Title className={INSTRUMENT_UI || ownHeading ? 'pg-title' : undefined}>{t('progressEv.title')}</Title>
        <p className="sub">{t('progressEv.sub')}</p>
      </header>

      <div className="grid cols-3 pg-facts">
        <div className="card" data-metric="answered">
          <div className="sc-label">{t('progressEv.answered')}</div>
          <div className="big" data-value={overall.answered}>{overall.answered.toLocaleString()}</div>
        </div>
        <div className="card" data-metric="started">
          <div className="sc-label">{t('progressEv.started')}</div>
          <div className="big" data-value={started}>{t('progressEv.startedOf', { started, total: rows.length })}</div>
        </div>
        <div className="card" data-metric="accuracy">
          <div className="sc-label">{t('progressEv.overallRight')}</div>
          <div className="big" style={{ fontSize: '1.05rem', lineHeight: 1.3 }}><Word band={overall.accuracy} map={ACCURACY} t={t} /></div>
          {overall.accuracy === 'thin' && <div className="muted">{t('progressEv.needs', { count: overall.needed, n: overall.needed })}</div>}
          {overall.accuracy !== 'thin' && <div className="muted" data-metric="independence"><Word band={overall.independence} map={INDEPENDENCE} t={t} /></div>}
        </div>
      </div>

      {children}

      <section aria-labelledby="pg-first" data-review-first>
        <h2 className="sc-label" id="pg-first">{t('progressEv.lookFirst')}</h2>
        {evidence.review.length ? evidence.review.map(item => (
          <div key={item.id} className="set-row" data-review-topic={item.id} data-review-reason={item.reason}>
            <span className="set-k">
              <span lang="en"><TermGloss text={nameOf(item.id)} /></span>
              <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{t(REASON[item.reason])}</span>
            </span>
            <button className="btn btn-quiet btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => nav(practiseTo({ id: item.id, name: nameOf(item.id) }))}>{t('progress.practise')}</button>
          </div>
        )) : <p className="muted">{t('progressEv.lookNone')}</p>}
      </section>

      <section aria-labelledby="pg-topics">
        <div className="spread pg-section-head">
          <h2 className="sc-label" id="pg-topics">{t('progressEv.topicsTitle', { scope })}</h2>
          <span className="muted">{t('progress.rowCount', { count: rows.length, n: rows.length })}</span>
        </div>
        {!rows.length ? <p className="muted" style={{ marginTop: 16 }}>{t('progress.noRows')}</p> : (
          <div className="table-scroll">
            <table className="syl-table pg-table">
              <caption className="sr-only">{t('progressEv.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('progressEv.colTopic')}</th>
                  <th scope="col">{t('progressEv.colRight')}</th>
                  <th scope="col">{t('progressEv.colOwn')}</th>
                  <th scope="col">{t('progressEv.colGap')}</th>
                  <th scope="col">{t('progressEv.colKinds')}</th>
                  {teacher && <th scope="col">{t('progressEv.colEvidence')}</th>}
                  <th scope="col"><span className="sr-only">{t('progress.colAction')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const x = byId.get(row.id);
                  return (
                    <tr key={row.id || row.name} data-chapter={row.id} data-attempts={x?.answered || 0} data-correct={x?.right || 0}>
                      <td style={{ textAlign: 'left' }}>
                        <div className="pg-chapter" lang="en"><TermGloss text={row.name} /></div>
                        {row.strand && <div className="muted" lang="en" style={{ fontSize: 12 }}><TermGloss text={row.strand} /></div>}
                      </td>
                      {x ? (
                        <>
                          <td><Word band={x.accuracy} map={ACCURACY} t={t} /></td>
                          <td><Word band={x.independence} map={INDEPENDENCE} t={t} /></td>
                          <td><Word band={x.retention} map={RETENTION} t={t} /></td>
                          <td><Word band={x.transfer} map={TRANSFER} t={t} /></td>
                          {teacher && <td>{t('progressEv.counts', { answered: x.counts.answered, right: x.counts.right, own: x.counts.independentRight })}</td>}
                        </>
                      ) : (
                        <td colSpan={teacher ? 5 : 4} className="muted">{t('progressEv.notStarted')}</td>
                      )}
                      <td>
                        <button className="btn btn-quiet btn-sm" onClick={() => nav(practiseTo(row))}>{t('progress.practise')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="pg-notes">
        <h2 className="sc-label">{t('progress.howToRead')}</h2>
        <p className="muted">{t('progressEv.how')}</p>
      </footer>
    </div>
  );
}
