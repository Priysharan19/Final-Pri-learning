// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · History
// Every answered question, forever: filter it, bookmark it, replay your
// handwriting, and re-attempt any question — same numbers or fresh ones.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { dayKey, formatDate, formatNumber, timezoneOf } from '../lib/locale.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';
import Icon from '../components/Icon.jsx';
import ErrorNotebook from '../components/ErrorNotebook.jsx';
import { createHistoryLoadGate } from './historyLoadLifecycle.js';
import { transcriptIsAnswer } from '../components/attemptEvidence.js';
import { featureEnabled } from '../platform/features.js';
import MarkStrip from '../instrument/MarkStrip.jsx';
import { colourFor, scopeFor } from '../instrument/chapters.js';
import Glyph from '../instrument/Glyph.jsx';

// v1.1 instrument: each row carries its certified mark as a strip.
const INSTRUMENT_STRIP = featureEnabled('instrument');

const FILTERS = [
  ['all', 'history.filterAll'],
  ['wrong', 'history.filterWrong'],
  ['correct', 'history.filterCorrect'],
  ['bookmarked', 'history.filterBookmarked'],
  ['ink', 'history.filterInk']
];

// The instrument's Scripts filters (design s8), each with its count from the
// server. "Needs another look" is a slip not yet correctly redone
// (engine/reportSeries.js needsAnotherLookIds). There is no "not read" filter:
// nothing records an unread reading, so it would have no honest count.
const INSTRUMENT_FILTERS = [
  ['all', 'history.filterAll'],
  ['needsLook', 'history.filterNeedsLook'],
  ['wrong', 'history.filterWrong'],
  ['correct', 'history.filterCorrect'],
  ['ink', 'history.filterInk'],
  ['bookmarked', 'history.filterBookmarked']
];
const SORTS = [['newest', 'history.sortNewest'], ['oldest', 'history.sortOldest'], ['marks', 'history.sortMarks']];
// Search runs over every row of the current filter, fetched in one page, so it
// never silently misses rows on a later page.
const SEARCH_PAGE = 5000;
const normal = s => String(s || '').toLowerCase().replace(/[\\${}^_]/g, ' ').replace(/\s+/g, ' ');

const MODE_KEY = {
  practice: 'history.modePractice', review: 'history.modeReview', exam: 'history.modeExam',
  rush: 'history.modeRush', match: 'history.modeMatch', task: 'history.modeTask'
};

/** Render saved strokes as a scaled SVG — a faithful replay of the ink. */
function InkReplay({ strokes, height = 160, label }) {
  if (!strokes?.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const pt of st.points || []) {
    x1 = Math.min(x1, pt.x); y1 = Math.min(y1, pt.y);
    x2 = Math.max(x2, pt.x); y2 = Math.max(y2, pt.y);
  }
  if (!isFinite(x1)) return null;
  const pad = 12;
  const vb = `${x1 - pad} ${y1 - pad} ${x2 - x1 + 2 * pad} ${y2 - y1 + 2 * pad}`;
  return (
    <div className="ink-replay">
      {label && <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>}
      <svg viewBox={vb} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="xMidYMid meet">
        {strokes.map((st, i) => (
          <polyline key={i}
            points={(st.points || []).map(pt => `${pt.x},${pt.y}`).join(' ')}
            fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}

export default function History() {
  const { user } = useApp();
  // Saved attempts contain private ink, transcripts and photographs. A profile
  // change discards this whole subtree before the new student sees History.
  return <HistoryForProfile key={String(user?.id ?? 'no-profile')} />;
}

function HistoryForProfile() {
  const { toast, user } = useApp();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const requestedFilter = params.get('filter');
  const filter = (INSTRUMENT_STRIP ? INSTRUMENT_FILTERS : FILTERS).some(([key]) => key === requestedFilter) ? requestedFilter : 'all';
  const [subtopic, setSubtopic] = useState('');
  const [sort, setSort] = useState('newest');
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const searching = INSTRUMENT_STRIP && query.trim() !== '';
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(null);       // {id, detail}
  const detailGate = useRef(null);
  const nav = useNavigate();

  // The ledger colours each row by its chapter's place in the syllabus.
  const [curriculum, setCurriculum] = useState(null);
  useEffect(() => {
    if (!INSTRUMENT_STRIP) return undefined;
    let live = true;
    api.get('/curriculum').then(c => live && setCurriculum(c)).catch(() => { });
    return () => { live = false; };
  }, []);
  function chapterColour(id) {
    const rows = scopeFor(curriculum, user)?.chapters || scopeFor(curriculum, user)?.subtopics || [];
    const i = rows.findIndex(r => r.id === id);
    return i >= 0 ? colourFor(i) : '--in-tx-4';
  }

  const [activeRow, setActiveRow] = useState(null);

  useEffect(() => { setPage(0); }, [filter, subtopic, sort, searching]);
  // "/" focuses the search, as the design's key hint says (not while typing).
  useEffect(() => {
    if (!INSTRUMENT_STRIP) return undefined;
    const onKey = e => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const gate = createHistoryLoadGate();
    detailGate.current?.cancel();
    setData(null); setLoadFailed(false); setOpen(null);
    const body = INSTRUMENT_STRIP
      ? { filter, sort, ...(subtopic ? { subtopic } : {}), ...(searching ? { page: 0, pageSize: SEARCH_PAGE } : { page }) }
      : { filter, page };
    api.post('/history/list', body).then(
      rows => { if (gate.current()) setData(rows); },
      () => { if (gate.current()) setLoadFailed(true); }
    );
    return () => gate.cancel();
  }, [filter, page, refresh, subtopic, sort, searching]);

  async function toggleBookmark(id) {
    try {
      const r = await api.post(`/history/${id}/bookmark`, {});
      setData(d => d?.items ? {
        ...d, items: d.items.map(x => x.id === id ? { ...x, bookmarked: r.bookmarked } : x)
      } : d);
    } catch { }
  }

  async function retry(id, variant) {
    try {
      const r = await api.post(`/history/${id}/retry`, { variant });
      nav('/practice', {
        state: {
          serve: {
            question: r.question,
            reason: 'retry',
            why: t(variant === 'same' ? 'history.whySame' : 'history.whyFresh')
          }
        }
      });
    } catch (e) { toast(<span>{e.message}</span>); }
  }

  async function openDetail(id) {
    detailGate.current?.cancel();
    if (open?.id === id) { setOpen(null); return; }
    const gate = createHistoryLoadGate();
    detailGate.current = gate;
    setOpen(null);
    try {
      const detail = await api.get(`/history/${id}/detail`);
      if (gate.current()) setOpen({ id, detail });
    } catch { /* The student's previous attempt remains available for retry. */ }
  }

  function renderActions(item) {
    return (
            <div className="hist-actions">
              {item.canRetry && (
                <>
                  <button className="btn btn-ghost btn-sm" title={t('history.retrySameTitle')}
                    onClick={() => retry(item.id, 'same')}>{t('history.retrySame')}</button>
                  <button className="btn btn-ghost btn-sm" title={t('history.retryFreshTitle')}
                    onClick={() => retry(item.id, 'fresh')}>{t('history.retryFresh')}</button>
                </>
              )}
            </div>
    );
  }

  function renderDetail(item) {
    if (open?.id !== item.id || !open.detail) return null;
    return (
              <div className="hist-detail">
                {item.answerGiven !== '' && <p style={{ marginBottom: 8 }}>{t('history.yourAnswerWas')} <b>{item.answerGiven}</b></p>}
                {open.detail.solution?.answerText !== undefined && (
                  <p style={{ marginBottom: 8 }}>{t('history.correctAnswerWas')} <b><MathText text={open.detail.solution.answerText} /></b></p>
                )}
                {open.detail.question?.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: open.detail.question.figure }} />}
                {open.detail.solution?.steps && (
                  <div className="steps" style={{ marginTop: 4 }}>
                    {open.detail.solution.steps.map((st, i) => (
                      <div className="step" key={i}>
                        <span className="step-n">{i + 1}</span>
                        <div>
                          <div className="step-h"><MathText text={st.h} /></div>
                          <div className="step-d"><MathText text={st.d} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {open.detail.ink?.strokes?.length > 0 && <InkReplay strokes={open.detail.ink.strokes}
                  label={open.detail.ink.recognized
                    ? t(item.viaInk && item.answerGiven !== '' && !transcriptIsAnswer(open.detail.ink.recognized, item.answerGiven) ? 'history.readAsNotAnswer' : 'history.readAs', { text: open.detail.ink.recognized })
                    : t('history.yourHandwriting')} />}
                {open.detail.ink?.scribble?.length > 0 && <InkReplay strokes={open.detail.ink.scribble} label={t('history.scribblePad')} height={120} />}
                {open.detail.ink?.photo && (
                  <div style={{ marginTop: 8 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t('history.attachedWorking')}</div>
                    <img src={open.detail.ink.photo} alt={t('history.paperWorking')} style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--hairline)' }} />
                  </div>
                )}
              </div>
    );
  }

  // v1.1 instrument: the attempts as a ledger, grouped by the profile's own
  // calendar day, one row per attempt (chapter colour, question, chapter, the
  // certified mark strip, time). ↑/↓, Home and End move between rows.
  function dayLabel(key) {
    const tz = timezoneOf(user);
    const today = dayKey(Date.now(), tz);
    if (key === today) return t('inst.scriptsToday');
    const [y, m, d] = today.split('-').map(Number);
    if (key === new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10)) return t('inst.scriptsYesterday');
    return formatDate(`${key}T12:00:00Z`, user, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  function onLedgerKey(e) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || !e.target.classList?.contains('in-led-main')) return;
    const rows = [...e.currentTarget.querySelectorAll('.in-led-main')];
    const at = rows.indexOf(e.target);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
    e.preventDefault();
    rows[next]?.focus();
  }

  function renderLedger(items) {
    const tz = timezoneOf(user);
    // Roving tabindex: one row button is in the Tab order; arrows move it.
    const activeId = items.some(x => x.id === activeRow) ? activeRow : items[0]?.id;
    const groups = [];
    for (const item of items) {
      const ms = new Date(item.answeredAt).getTime();
      const key = Number.isFinite(ms) ? dayKey(ms, tz) : '';
      if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
      groups[groups.length - 1].items.push(item);
    }
    return (
      <div className="in-led-list" onKeyDown={onLedgerKey}>
        {groups.map(g => (
          <section key={g.key} className="in-led-day" aria-labelledby={g.key ? `in-led-day-${g.key}` : undefined}>
            {g.key && <h3 className="in-led-dayh" id={`in-led-day-${g.key}`}>{dayLabel(g.key)}</h3>}
            {g.items.map(item => (
              <div key={item.id} className={`hist-row in-led-row${open?.id === item.id ? ' is-sel' : ''}`} data-question-id={item.id}
                style={{ '--cc': `var(${chapterColour(item.subtopic)})` }}>
                <button className="hist-main in-led-main" aria-expanded={open?.id === item.id} tabIndex={item.id === activeId ? 0 : -1}
                  onFocus={() => setActiveRow(item.id)} onClick={() => openDetail(item.id)}>
                  <i className="in-led-cc" aria-hidden="true" />
                  <span className="in-led-id">{`D${item.difficulty}`}</span>
                  <span className="in-led-q"><MathText text={item.prompt} /></span>
                  <span className="in-led-ch" lang="en"><TermGloss text={item.subtopicName} /></span>
                  <span className="in-led-res">
                    {!item.repeat && Number.isInteger(item.marksPossible) ? <MarkStrip earned={item.marksEarned} possible={item.marksPossible} /> : (
                      <span className={`hist-verdict ${item.correct ? 'good' : item.correct === false ? 'bad' : ''}`}>
                        {item.correct ? <Icon name="check" size={15} /> : item.correct === false ? <Icon name="correction" size={15} /> : '·'}
                      </span>
                    )}
                    <span className="sr-only">{item.correct ? t('app.correct') : item.correct === false ? t('app.incorrect') : t('history.notMarked')}</span>
                    {item.viaInk && <span className="in-led-ic" title={t('history.viaInk')}><Icon name="pen" size={13} /><span className="sr-only">{t('history.viaInkSpoken')}</span></span>}
                    {item.hasPhoto && <span className="in-led-ic" title={t('history.hasPhoto')}><Icon name="photo" size={13} /><span className="sr-only">{t('history.hasPhotoSpoken')}</span></span>}
                  </span>
                  <span className="in-led-tm">{formatDate(item.answeredAt, user, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span>
                </button>
                <button className={`hist-star ${item.bookmarked ? 'on' : ''}`} title={t(item.bookmarked ? 'history.removeBookmark' : 'history.addBookmark')}
                  aria-label={t(item.bookmarked ? 'history.removeBookmarkOn' : 'history.addBookmarkOn', { topic: item.subtopicName })}
                  aria-pressed={!!item.bookmarked}
                  onClick={() => toggleBookmark(item.id)}><Icon name="bookmark" size={16} /></button>
                {open?.id === item.id && <div className="in-led-open">{renderActions(item)}{renderDetail(item)}</div>}
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  }

  const pages = data && !searching ? Math.ceil(data.total / data.pageSize) : 0;
  const words = normal(query).trim().split(' ').filter(Boolean);
  const shown = !data ? [] : !searching ? data.items
    : data.items.filter(x => { const hay = normal(`${x.prompt} ${x.subtopicName} ${x.dotpointText || ''}`); return words.every(w => hay.includes(w)); });
  const scopeRows = INSTRUMENT_STRIP ? (scopeFor(curriculum, user)?.chapters || scopeFor(curriculum, user)?.subtopics || []) : [];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <h1 className="sr-only">{t('history.title')}</h1>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>{t('history.heading')}</h2>
          <p className="sub" style={{ marginTop: 3 }}>{t('history.sub')}</p>
        </div>
        <span className="chip">{data ? t('common.questionsCounted', { count: data.total, n: formatNumber(data.total, user) }) : '…'}</span>
      </div>

      {!INSTRUMENT_STRIP && <ErrorNotebook />}

      {INSTRUMENT_STRIP && (
        <div className="in-led-tools">
          <div className="in-led-bar in-hsb" role="group" aria-label={t('history.filterGroup')}>
            {INSTRUMENT_FILTERS.map(([k, key]) => (
              <button key={k} type="button" className="in-flt" aria-pressed={filter === k} data-history-filter={k}
                onClick={() => { setPage(0); setParams(k === 'all' ? {} : { filter: k }); }}>
                {t(key)} <b data-history-count={k}>{data?.counts ? formatNumber(data.counts[k] ?? 0, user) : '·'}</b>
              </button>
            ))}
          </div>
          <div className="in-hsb is-right">
            <label className="in-flt is-menu">
              <span className="sr-only">{t('history.chapterLabel')}</span>
              <select value={subtopic} onChange={e => setSubtopic(e.target.value)} data-history-chapter aria-label={t('history.chapterLabel')}>
                <option value="">{t('history.chapterAll')}</option>
                {scopeRows.map(r => <option key={r.id} value={r.id} lang="en">{r.name}</option>)}
              </select>
            </label>
            <label className="in-flt is-menu">
              <select value={sort} onChange={e => setSort(e.target.value)} data-history-sort aria-label={t('history.sortLabel')}>
                {SORTS.map(([k, key]) => <option key={k} value={k}>{t('history.sortPrefix', { sort: t(key) })}</option>)}
              </select>
            </label>
            <label className="in-led-search">
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              <input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('history.searchPlaceholder')}
                aria-label={t('history.searchPlaceholder')} aria-keyshortcuts="/" data-history-search />
              <kbd className="in-kbd" aria-hidden="true">/</kbd>
            </label>
          </div>
          {searching && data && <p className="in-note" role="status" data-history-search-count>{t('history.searchFound', { n: shown.length })}</p>}
        </div>
      )}

      {!INSTRUMENT_STRIP && <div className="row" role="group" aria-label={t('history.filterGroup')} style={{ flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([k, key]) => (
          <button key={k} className={`pill-opt ${filter === k ? 'on' : ''}`} aria-pressed={filter === k}
            onClick={() => { setPage(0); setParams(k === 'all' ? {} : { filter: k }); }}>{t(key)}</button>
        ))}
      </div>}

      <div className={`card${INSTRUMENT_STRIP ? ' in-led' : ''}`} style={INSTRUMENT_STRIP ? undefined : { padding: 10 }}>
        {!data && !loadFailed && <div className="skeleton" style={{ height: 300 }} role="status" aria-label={t('common.loading')} />}
        {loadFailed && (
          <div className="error-box" role="alert" data-history-load-error>
            <p>{t('errorScreen.title')}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setRefresh(n => n + 1)}>
              {t('common.tryAgain')}
            </button>
          </div>
        )}
        {INSTRUMENT_STRIP && data && !shown.length && (
          <div className="in-state" data-state="empty">
            <span className="in-state-orb is-good"><Glyph name="doc" size={20} /></span>
            <p className="in-state-title">{t('history.emptyTitle')}</p>
            <p className="in-state-copy">{t(searching ? 'history.searchNone' : filter === 'all' && !subtopic ? 'history.emptyAll' : 'history.emptyFiltered')}</p>
            {filter === 'all' && !subtopic && !searching && <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/practice')}>{t('history.startPractising')}</button>}
          </div>
        )}
        {!INSTRUMENT_STRIP && data && !data.items.length && (
          <p className="muted" style={{ padding: 14 }}>
            {t(filter === 'all' ? 'history.emptyAll' : 'history.emptyFiltered')}
          </p>
        )}
        {INSTRUMENT_STRIP && data && shown.length > 0 && renderLedger(shown)}
        {!INSTRUMENT_STRIP && data && data.items.map(item => (
          <div key={item.id} className="hist-row" data-question-id={item.id}>
            <button className={`hist-star ${item.bookmarked ? 'on' : ''}`} title={t(item.bookmarked ? 'history.removeBookmark' : 'history.addBookmark')}
              aria-label={t(item.bookmarked ? 'history.removeBookmarkOn' : 'history.addBookmarkOn', { topic: item.subtopicName })}
              aria-pressed={!!item.bookmarked}
              onClick={() => toggleBookmark(item.id)}><Icon name="bookmark" size={17} /></button>
            <button className="hist-main" onClick={() => openDetail(item.id)}>
              <div className="hist-top">
                <span className={`hist-verdict ${item.correct ? 'good' : item.correct === false ? 'bad' : ''}`}>
                  {item.correct ? <Icon name="check" size={15} /> : item.correct === false ? <Icon name="correction" size={15} /> : '·'}
                  <span className="sr-only">{item.correct ? t('app.correct') : item.correct === false ? t('app.incorrect') : t('history.notMarked')}</span>
                </span>
                <span className="hist-name" lang="en"><TermGloss text={item.subtopicName} /></span>
                <span className="tag">{`D${item.difficulty}`}</span>
                <span className="tag">{MODE_KEY[item.mode] ? t(MODE_KEY[item.mode]) : item.mode}</span>
                {item.viaInk && <span className="tag" title={t('history.viaInk')}><Icon name="pen" size={13} /><span className="sr-only">{t('history.viaInkSpoken')}</span></span>}
                {item.hasPhoto && <span className="tag" title={t('history.hasPhoto')}><Icon name="photo" size={13} /><span className="sr-only">{t('history.hasPhotoSpoken')}</span></span>}
                {INSTRUMENT_STRIP && !item.repeat && Number.isInteger(item.marksPossible) && <MarkStrip earned={item.marksEarned} possible={item.marksPossible} />}
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatDate(item.answeredAt, user)}
                </span>
              </div>
              <div className="hist-prompt"><MathText text={item.prompt} /></div>
            </button>
            {renderActions(item)}
            {renderDetail(item)}
          </div>
        ))}
      </div>

      {INSTRUMENT_STRIP && <ErrorNotebook />}

      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-quiet btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t('history.newer')}</button>
          <span className="muted">{t('history.pageOf', { page: page + 1, total: pages })}</span>
          <button className="btn btn-quiet btn-sm" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>{t('history.older')}</button>
        </div>
      )}
    </div>
  );
}
