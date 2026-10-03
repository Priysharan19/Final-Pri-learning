import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import TermGloss from './TermGloss.jsx';
import { BOARD_STATES, DOTPOINT_COLOUR_FLOOR } from '../engine/syllabusBoard.js';
import { indiaDotpointPracticeHref, indiaProgressPracticeHref } from '../lib/practiceLinks.js';

// The syllabus board and the Priorities list on India Progress. Both render
// models built in engine/syllabusBoard.js; nothing here decides anything.

const STATE_KEY = {
  unseen: 'progress.boardStateUnseen',
  thin: 'progress.boardStateThin',
  emerging: 'progress.boardStateEmerging',
  developing: 'progress.boardStateDeveloping',
  strong: 'progress.boardStateStrong',
  mastered: 'progress.boardStateMastered'
};

const TAG_KEY = {
  'review-due': 'verdict.spacedReview',
  'weak-spot': 'verdict.weakSpot',
  misconception: 'verdict.repeatedSlip',
  'new-ground': 'verdict.newGround'
};

function Dot({ state, title }) {
  return <span className={`sb-dot sb-${state}`} title={title} aria-hidden="true" />;
}

export function BoardLegend() {
  const t = useT();
  return (
    <ul className="sb-legend" aria-label={t('progress.boardLegend')}>
      {BOARD_STATES.map(s => (
        <li key={s}><Dot state={s} />{t(STATE_KEY[s])}</li>
      ))}
      <li><span className="sb-due-mark" aria-hidden="true" />{t('progress.boardDue')}</li>
    </ul>
  );
}

export function SyllabusBoard({ board, track }) {
  const t = useT();
  const nav = useNavigate();
  const [open, setOpen] = useState(() => new Set());
  const toggle = id => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="card" data-syllabus-board data-dotpoints={board.total} data-seen={board.seen} data-mastered={board.mastered}>
      <div className="spread" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 680 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>{t('progress.boardTitle')}</div>
          <p className="sub" style={{ margin: 0 }}>{t('progress.boardSub')}</p>
        </div>
        <div className="sb-summary">
          <div className="big">{board.seen}<span className="muted">/{board.total}</span></div>
          <div className="muted" style={{ fontSize: 12 }}>{t('progress.boardSeen', { mastered: board.mastered })}</div>
        </div>
      </div>

      {/* The board's whole proportion at a glance: every dot point on the
          syllabus as one strip, in state order, so "how much is green" is a
          length rather than a count. */}
      <div className="sb-strip" aria-hidden="true">
        {BOARD_STATES.map(s => board.counts[s] > 0 && (
          <span key={s} className={`sb-${s}`} style={{ flexGrow: board.counts[s] }} />
        ))}
      </div>
      <BoardLegend />

      {board.strands.map(strand => (
        <section key={strand.name} className="sb-strand">
          {strand.name && <h3 className="sc-label sb-strand-name" lang="en"><TermGloss text={strand.name} /></h3>}
          <ul className="sb-chapters">
            {strand.chapters.map(ch => {
              const isOpen = open.has(ch.id);
              return (
                <li key={ch.id} className={`sb-chapter ${isOpen ? 'open' : ''}`} data-board-chapter={ch.id} data-due={ch.due ? '1' : '0'}>
                  <div className="sb-row">
                    <button type="button" className="sb-name" aria-expanded={isOpen} onClick={() => toggle(ch.id)}>
                      <span className="sb-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                      <span lang="en"><TermGloss text={ch.name} /></span>
                      {ch.due && <span className="sb-due-mark" title={t('progress.boardDue')}><span className="sr-only">{t('progress.boardDue')}</span></span>}
                    </button>
                    <span className="sb-dots" aria-hidden="true">
                      {ch.dotpoints.map(dp => (
                        <Dot key={dp.key} state={dp.state} title={`${dp.text} · ${t(STATE_KEY[dp.state])}`} />
                      ))}
                    </span>
                    <span className="sr-only">{t('progress.boardChapterSr', { seen: ch.seen, total: ch.dotpoints.length, mastered: ch.counts.mastered })}</span>
                    <span className="sb-count muted" aria-hidden="true">{ch.seen}/{ch.dotpoints.length}</span>
                    <button type="button" className="btn btn-quiet btn-sm sb-go" onClick={() => nav(indiaProgressPracticeHref(ch, track))}>
                      {t('progress.practise')}<span className="sr-only"> · <span lang="en">{ch.name}</span></span>
                    </button>
                  </div>
                  {isOpen && (
                    <ol className="sb-dp-list">
                      {ch.dotpoints.map(dp => (
                        <li key={dp.key} data-dotpoint={dp.index} data-state={dp.state}>
                          <Dot state={dp.state} />
                          <span className="sb-dp-text" lang="en"><TermGloss text={dp.text} /></span>
                          <span className="sb-dp-meta muted">
                            {t(STATE_KEY[dp.state])}
                            {dp.attempts > 0 && <> · {t('progress.boardAnswers', { count: dp.attempts, n: dp.attempts })}</>}
                            {(dp.state !== 'unseen' && dp.state !== 'thin') && <> · {t('progress.boardMastery', { n: dp.mastery })}</>}
                          </span>
                          {dp.practisable
                            ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav(indiaDotpointPracticeHref(ch.id, dp.index, track))}>
                              {t('progress.practise')}<span className="sr-only"> · {t('progress.boardDotpointN', { n: dp.index + 1 })}</span>
                            </button>
                            : <span className="muted sb-dp-meta">{t('progress.boardNoForm')}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>{t('progress.boardHow', { n: DOTPOINT_COLOUR_FLOOR })}</p>
    </div>
  );
}

export function PrioritiesList({ items, track }) {
  const t = useT();
  const nav = useNavigate();
  return (
    <div className="card" data-priorities={items.length}>
      <div className="spread" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 680 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>{t('progress.prioTitle')}</div>
          <p className="sub" style={{ margin: 0 }}>{t('progress.prioSub')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/practice')}>{t('progress.prioSmart')}</button>
      </div>
      {!items.length
        ? <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>{t('progress.prioEmpty')}</p>
        : (
          <ol className="sb-prio">
            {items.map(p => (
              <li key={p.id} className="prio-item" data-priority={p.id} data-tag={p.tag}>
                <span className="prio-rank" aria-hidden="true">{p.rank}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sb-prio-head">
                    <span style={{ fontWeight: 640 }} lang="en"><TermGloss text={p.name} /></span>
                    <span className={`tag sb-tag-${p.tag}`}>{t(TAG_KEY[p.tag])}</span>
                  </div>
                  <div className="muted sb-prio-why">
                    {p.attempts === 0
                      ? t('progress.prioNotStarted')
                      : t('progress.prioMastery', { n: p.mastery })}
                    {p.misconception && <> · {p.misconception}</>}
                    {p.unit && p.unit.atStake > 0 && <> · {t('progress.prioAtStake', { stake: p.unit.atStake, unit: p.unit.name })}</>}
                  </div>
                  {p.dotpoint && (
                    <div className="sb-prio-dp">
                      <Dot state={p.dotpoint.state} />
                      <span lang="en"><TermGloss text={p.dotpoint.text} /></span>
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav(p.dotpoint
                  ? indiaDotpointPracticeHref(p.id, p.dotpoint.index, track)
                  : indiaProgressPracticeHref({ id: p.id }, track))}>
                  {t('progress.practise')}<span className="sr-only"> · <span lang="en">{p.name}</span></span>
                </button>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}
