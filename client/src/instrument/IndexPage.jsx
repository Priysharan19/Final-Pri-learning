import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import PageLink from '../components/PageLink.jsx';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT, tLater } from '../i18n/index.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../engine/progressTruth.js';
import { practiceHref } from '../lib/practiceLinks.js';
import ChapterScope from './ChapterScope.jsx';
import EmptyPlot from './EmptyPlot.jsx';
import TermGloss from '../components/TermGloss.jsx';
import { chapterEvidence, colourFor, figureFor, practiceTrack, scopeFor } from './chapters.js';

// The v1.1 home: the student's syllabus as a thumb-indexed book. The list and
// the coloured tabs choose a chapter; its plate shows what the evidence says
// (answers, correct, accuracy only over enough answers) and its mathematics on
// the scope. Every figure is the server's; nothing is estimated here.


// The phone home is a different arrangement (and its own scope), so the
// phone branch is chosen by the same 760px line the stylesheet uses.
const PHONE = '(max-width: 760px)';
const subscribePhone = notify => {
  const mq = window.matchMedia?.(PHONE);
  mq?.addEventListener?.('change', notify);
  return () => mq?.removeEventListener?.('change', notify);
};
const isPhone = () => !!window.matchMedia?.(PHONE).matches;

const greetingKey = hour => (hour < 12 ? 'inst.greetMorning' : hour < 17 ? 'inst.greetAfternoon' : 'inst.greetEvening');

function Ring({ value, colourVar }) {
  const r = 10; const length = 2 * Math.PI * r;
  return (
    <svg className="in-ring" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r={r} fill="none" stroke="var(--in-l4)" strokeWidth="2.5" />
      <circle cx="13" cy="13" r={r} fill="none" stroke={`var(${colourVar})`} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={length} strokeDashoffset={length * (1 - value / 100)} transform="rotate(-90 13 13)" />
    </svg>
  );
}

export default function IndexPage() {
  const { user } = useApp();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [recent, setRecent] = useState(undefined);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);
  const [marks, setMarks] = useState({});

  useEffect(() => {
    let live = true;
    api.get('/curriculum').then(c => { if (live) setCurriculum(c); })
      .catch(err => { if (live) setError(err?.message || tLater('inst.indexError')); });
    api.get('/marks/by-chapter').then(r => { if (live) setMarks(r?.chapters || {}); }).catch(() => { });
    api.post('/history/list', { limit: 1 }).then(r => { if (live) setRecent(r?.items?.[0] || null); })
      .catch(() => { if (live) setRecent(null); });
    return () => { live = false; };
  }, []);

  const track = practiceTrack(user);
  const chapters = useMemo(() => {
    const scope = scopeFor(curriculum, user);
    const rows = scope?.chapters || scope?.subtopics || [];
    return rows.map((row, i) => ({
      row, index: i, colour: colourFor(i), figure: figureFor(row.name),
      evidence: chapterEvidence(row, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy)
    }));
  }, [curriculum, user]);

  // Default to the chapter the student last worked in, else the first.
  const current = useMemo(() => {
    if (!chapters.length) return null;
    const chosen = chapters.find(c => c.row.id === pick);
    if (chosen) return chosen;
    const last = recent && chapters.find(c => c.row.id === recent.subtopic);
    return last || chapters[0];
  }, [chapters, pick, recent]);

  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const name = (user.name || '').split(' ')[0];
  const markOf = id => (marks[id]?.possible ? marks[id] : null);
  const chapterSub = c => {
    const m = markOf(c.row.id);
    if (m) return `${m.earned}/${m.possible} ${t('inst.mapMarks')}`;
    return c.evidence.attempts ? t('inst.answered', { n: c.evidence.attempts }) : t('inst.notStarted');
  };
  // "Covered": the share of the chapter's dot points with at least one answer
  // — the dot point's own evidence from /curriculum (the figure its tile
  // shows), or a server-certified answer filed under exactly that dot point
  // (GET /marks/by-chapter dotpoints). A chapter with no dot point list has
  // nothing to cover against, so it says "—".
  const coveredOf = c => {
    const dps = Array.isArray(c.row.dotpoints) ? c.row.dotpoints : [];
    if (!dps.length) return '—';
    const seen = marks[c.row.id]?.dotpoints || {};
    const n = dps.filter((dp, i) => {
      const own = typeof dp === 'object' && dp ? chapterEvidence(dp, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy).attempts : 0;
      const key = typeof dp === 'object' && dp?.id ? String(dp.id) : String(i);
      return own > 0 || Number(seen[key]?.questions) > 0 || Number(seen[String(i)]?.questions) > 0;
    }).length;
    return `${Math.round((100 * n) / dps.length)}%`;
  };
  // The resume card's ten segments: the last attempt's own marks, nothing more.
  const resumeMarks = recent && Number.isInteger(recent.marksPossible) && recent.marksPossible > 0 && !recent.repeat
    ? { earned: Math.max(0, Math.min(recent.marksPossible, Number(recent.marksEarned) || 0)), possible: recent.marksPossible } : null;
  const hour = new Date().getHours();

  if (error) return <div className="card" role="alert">{t('inst.indexError')} {error}</div>;

  return (
    <div className="in-index" data-instrument-index>
      <div className="in-spine">
        <div className="in-greet">
          <small>{user.year ? t('common.classNumber', { n: user.year }) : ''}</small>
          <h1>{t(greetingKey(hour), { name })}</h1>
        </div>

        {recent && (
          <div className="in-resume" data-instrument-resume>
            <div>
              <b>{t('inst.resumePrefix')} · <span lang="en"><TermGloss text={recent.subtopicName || ''} /></span></b>
              <small>{resumeMarks ? t('inst.resumeMarks', { earned: resumeMarks.earned, possible: resumeMarks.possible }) : t('inst.resumeSub')}</small>
            </div>
            <PageLink className="in-btn is-primary" to={practiceHref({ subtopic: recent.subtopic, track })}>{t('inst.resume')} <span className="in-kbd" aria-hidden="true">↵</span></PageLink>
            {resumeMarks && resumeMarks.possible <= 10 && (
              <div className="in-seg10" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < resumeMarks.earned ? 'd' : i < resumeMarks.possible ? 'x' : undefined} />)}
              </div>
            )}
          </div>
        )}

        {phone && current && (
          <>
            <div className="in-next" style={{ '--cc': `var(${current.colour})` }} data-instrument-next={current.row.id}>
              <ChapterScope figure={current.figure} colourVar={current.colour} label={t('inst.scopeLabel', { name: current.row.name })} tracerHint={t('inst.scopeTracer')} probeHint={t('inst.scopeProbe')} />
              <span className="in-next-ghost" aria-hidden="true">{String(current.index + 1).padStart(2, '0')}</span>
              <div className="in-next-label">
                <small>{t('inst.chapterN', { n: current.index + 1 })}{markOf(current.row.id) ? ` · ${markOf(current.row.id).earned}/${markOf(current.row.id).possible}` : ''}</small>
                <b lang="en"><TermGloss text={current.row.name} /></b>
              </div>
            </div>
            <div className="in-strip" aria-hidden="true">
              {chapters.map(c => (
                <button key={c.row.id} type="button" tabIndex={-1} style={{ '--cc': `var(${c.colour})` }}
                  className={c.evidence.attempts ? undefined : 'is-new'}
                  aria-current={current.row.id === c.row.id ? 'true' : undefined} onClick={() => setPick(c.row.id)} />
              ))}
            </div>
          </>
        )}

        {!curriculum && <div className="skeleton" style={{ height: 380, marginTop: 18 }} aria-hidden="true" />}

        {curriculum && (
          <nav aria-label={t('inst.chapters')}>
            <ul className="in-chs">
              {chapters.map(c => {
                const on = current?.row.id === c.row.id;
                return (
                  <li key={c.row.id}>
                    <button type="button" className="in-ch" style={{ '--cc': `var(${c.colour})` }}
                      aria-pressed={on} data-current={on ? 'true' : undefined} data-chapter={c.row.id}
                      onClick={() => setPick(c.row.id)} onFocus={() => setPick(c.row.id)}>
                      <span className="in-ch-n">{String(c.index + 1).padStart(2, '0')}</span>
                      <span className="in-ch-t"><span lang="en"><TermGloss text={c.row.name} /></span>
                        <small>{chapterSub(c)}</small>
                      </span>
                      <Ring value={c.evidence.mastery} colourVar={c.colour} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="in-thumbs" aria-hidden="true">
              {chapters.map(c => (
                <button key={c.row.id} type="button" tabIndex={-1} className="in-thumb" style={{ '--cc': `var(${c.colour})` }}
                  aria-current={current?.row.id === c.row.id ? 'true' : undefined}
                  onMouseEnter={() => setPick(c.row.id)} onClick={() => setPick(c.row.id)}><span>{c.index + 1}</span></button>
              ))}
            </div>
          </nav>
        )}
      </div>

      {current && (
        <section className="in-plate" style={{ '--cc': `var(${current.colour})` }} aria-labelledby="in-plate-title" data-instrument-plate={current.row.id}>
          <span className="in-ghost" aria-hidden="true">{String(current.index + 1).padStart(2, '0')}</span>
          <div className="in-plate-head">
            <div>
              <small>{t('inst.chapterN', { n: current.index + 1 })}</small>
              <h2 id="in-plate-title" lang="en"><TermGloss text={current.row.name} /></h2>
              {current.row.strand && <p lang="en">{current.row.strand}</p>}
            </div>
            <div className="in-kpis">
              <div data-plate-marks><b>{marks[current.row.id]?.possible ? `${marks[current.row.id].earned}/${marks[current.row.id].possible}` : '—'}</b><small>{t('inst.mapMarks')}</small></div>
              <div data-plate-questions><b>{current.evidence.attempts}</b><small>{t('inst.kpiQuestions')}</small></div>
              <div data-plate-covered><b>{coveredOf(current)}</b><small>{t('inst.kpiCovered')}</small></div>
            </div>
          </div>
          {chapters.every(c => !c.evidence.attempts) ? <EmptyPlot /> : !phone && <ChapterScope figure={current.figure} colourVar={current.colour} label={t('inst.scopeLabel', { name: current.row.name })} tracerHint={t('inst.scopeTracer')} probeHint={t('inst.scopeProbe')} />}
          {Array.isArray(current.row.dotpoints) && current.row.dotpoints.length > 0 && (
            <ul className="in-exs" aria-label={t('inst.dotpoints')}>
              {current.row.dotpoints.slice(0, 4).map((dp, i) => {
                // A dot point is a string (India) or a row with its own evidence.
                const text = typeof dp === 'string' ? dp : String(dp?.text || '');
                const ev = typeof dp === 'object' && dp ? chapterEvidence(dp, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy) : null;
                const figure = ev?.accuracy != null ? `${ev.accuracy}%` : ev?.attempts ? t('inst.answered', { n: ev.attempts }) : '—';
                return (
                  <li key={i}>
                    <PageLink className="in-ex" to={practiceHref({ subtopic: current.row.id, dotpoint: i, track })} data-plate-dotpoint={i}>
                      <span className="in-ex-h"><span>{`${current.index + 1}.${i + 1}`}</span><span>{figure}</span></span>
                      <b lang="en"><TermGloss text={text} /></b>
                      <span className="in-ex-bar" aria-hidden="true"><i style={{ width: `${ev?.accuracy != null ? ev.mastery : 0}%` }} /></span>
                    </PageLink>
                  </li>
                );
              })}
            </ul>
          )}
          <div>
            <div className="in-plate-acts">
              <PageLink className="in-btn" to={practiceHref({ subtopic: current.row.id, track })} data-instrument-practise>{t('inst.practise')}</PageLink>
            </div>
            {current.evidence.attempts > 0 && current.evidence.accuracy == null && <p className="in-note" style={{ marginTop: 10 }}>{t('inst.accuracyHeld')}</p>}
          </div>
        </section>
      )}
      {curriculum && !chapters.length && <p className="in-empty">{t('inst.noChapters')}</p>}
    </div>
  );
}
