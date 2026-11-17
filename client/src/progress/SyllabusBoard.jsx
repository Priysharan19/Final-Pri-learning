// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the syllabus board, priorities and timed-paper readiness
//
// Three sections on Progress, both editions (engine/syllabusBoard.js):
//   · the BOARD — every unit of the student's course (Prithagoras: each outcome
//     code of the NSW 2024 Stage 6 or K–10 2022 syllabus; Priyabhata: each
//     chapter learning outcome), in one of six evidence states. Each state is a
//     distinct SHAPE and a WORD (never colour alone); the tiles are buttons in a
//     list grouped by topic, each topic with a sentence saying what it holds,
//     so the board is the same information to a keyboard or a screen reader;
//   · PRIORITIES — an ordered list (not competing cards): what to do, how many
//     questions, about how long, and the marks of the paper that sit where the
//     student has not shown independent work yet, as a range;
//   · READINESS — the raw results of the student's own server-marked timed
//     papers. No predicted mark, band or rank anywhere: practice questions
//     cannot honestly predict an exam mark.
// Plain SVG and CSS grid: no canvas, no WebGL, no animation loop.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { tLater, useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';
import PageLink from '../components/PageLink.jsx';
import { dotpointById } from '../engine/curriculum.js';
import { nswExamBlueprint } from '../engine/nswExams.js';
import { indiaExamBlueprint } from '../engine/indiaExams.js';
import { NSW_BOARD_COURSES, NSW_DOTPOINT_OUTCOMES } from '../engine/nswBoardCatalogue.js';
import {
  NODE_STATES, boardPriorities, indiaAreas, indiaBoardGroups, nswAreas, nswBoardGroups, paperReadiness, syllabusBoard
} from '../engine/syllabusBoard.js';
import { practiceHref } from '../lib/practiceLinks.js';

// Explicit maps (not template keys) so the catalogue check sees every string.
const STATE_WORD = {
  'not-started': 'board.state.notStarted', seen: 'board.state.seen', assisted: 'board.state.assisted',
  thin: 'board.state.thin', independent: 'board.state.independent', retained: 'board.state.retained'
};
const STATE_HELP = {
  'not-started': 'board.stateHelp.notStarted', seen: 'board.stateHelp.seen', assisted: 'board.stateHelp.assisted',
  thin: 'board.stateHelp.thin', independent: 'board.stateHelp.independent', retained: 'board.stateHelp.retained'
};
const ACTION_WORD = { learn: 'board.action.learn', consolidate: 'board.action.consolidate', retain: 'board.action.retain', extend: 'board.action.extend' };
const TREND_WORD = { up: 'board.ready.trendUp', down: 'board.ready.trendDown', level: 'board.ready.trendLevel' };

/** The NSW courses a student is on, the one to show first first. */
export function nswCoursesFor(user) {
  const y = Number(user?.year);
  if (y <= 8) return ['k10-stage4'];
  if (y <= 10) return ['k10-stage5'];
  const pw = user?.pathway;
  if (pw === 'standard') return ['standard-2', 'standard-1'];
  if (pw === 'ext1') return ['extension-1', 'advanced'];
  if (pw === 'ext2') return ['extension-2', 'extension-1'];
  return ['advanced'];
}

/** Each state's glyph: a distinct shape, so the state never rests on colour. */
export function StateGlyph({ state, size = 18 }) {
  const s = size, i = 2.5, w = s - 2 * i;
  const box = { x: i, y: i, width: w, height: w, rx: 2 };
  let mark = null;
  if (state === 'not-started') return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" data-glyph={state}><rect {...box} className="sb-g-line" strokeDasharray="2.5 2" /></svg>;
  if (state === 'seen') mark = <circle cx={s / 2} cy={s / 2} r={s / 9} className="sb-g-fill" />;
  if (state === 'thin') mark = <line x1={i + 2} y1={s - i - 2} x2={s - i - 2} y2={i + 2} className="sb-g-line" />;
  if (state === 'assisted') mark = <rect x={i} y={s / 2} width={w} height={w / 2} className="sb-g-fill" />;
  if (state === 'independent' || state === 'retained') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" data-glyph={state}>
        <rect {...box} className="sb-g-solid" />
        {state === 'retained' && <path d={`M${s * 0.3} ${s * 0.52} L${s * 0.45} ${s * 0.67} L${s * 0.72} ${s * 0.36}`} className="sb-g-tick" />}
      </svg>
    );
  }
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" data-glyph={state}><rect {...box} className="sb-g-line" />{mark}</svg>;
}

function nodeTitle(node, india) {
  return india ? node.label : `${node.code} · ${node.label}`;
}

function Detail({ node, group, india, track, onClose }) {
  const t = useT();
  const nav = useNavigate();
  const ev = node.evidence;
  const practised = useMemo(() => (india ? [] : Object.entries(NSW_DOTPOINT_OUTCOMES)
    .filter(([, codes]) => codes.includes(node.code)).map(([id]) => dotpointById(id)?.text).filter(Boolean)), [india, node.code]);
  return (
    <div className="sb-detail" data-board-detail={node.id}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="sb-detail-state"><StateGlyph state={node.state} /> <b>{t(STATE_WORD[node.state])}</b></div>
          <h4 className="sb-detail-title" lang="en"><TermGloss text={nodeTitle(node, india)} /></h4>
          {india
            ? <div className="muted" lang="en"><TermGloss text={group.name} /></div>
            : <div className="muted">{group.year ? t('common.yearNumber', { n: group.year }) : t('board.stage', { n: group.stage })}</div>}
        </div>
        <button className="btn btn-quiet btn-sm" onClick={onClose}>{t('board.close')}</button>
      </div>
      <p className="muted sb-detail-help">{t(STATE_HELP[node.state])}</p>
      {!india && group.contentGroups?.length > 0 && (
        <p className="sb-detail-line"><span className="sc-label">{t('board.contentGroups')}</span> <span lang="en">{group.contentGroups.join(' · ')}</span></p>
      )}
      {!india && practised.length > 0 && (
        <div className="sb-detail-line">
          <span className="sc-label">{t('board.priDotpoints')}</span>
          <ul className="sb-dp-list" lang="en">{practised.map(text => <li key={text}><TermGloss text={text} /></li>)}</ul>
        </div>
      )}
      <dl className="sb-evidence">
        <div><dt>{t('board.ev.answered')}</dt><dd>{ev ? ev.answered : 0}</dd></div>
        <div><dt>{t('board.ev.own')}</dt><dd>{ev ? ev.independentRight : 0}</dd></div>
        <div><dt>{t('board.ev.helped')}</dt><dd>{ev ? ev.helpedRight : 0}</dd></div>
        <div><dt>{t('board.ev.gap')}</dt><dd>{ev && ev.delayed ? t('board.ev.gapHeld', { kept: ev.delayedKept, n: ev.delayed }) : t('board.ev.gapNone')}</dd></div>
        <div><dt>{t('board.ev.last')}</dt><dd>{ev ? new Date(ev.lastAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : t('board.ev.never')}</dd></div>
      </dl>
      {!india && <p className="muted sb-detail-note">{t('board.nswWording')}</p>}
      {node.practise
        ? <button className="btn btn-primary btn-sm" data-board-practise onClick={() => nav(practiceHref({ subtopic: node.practise.subtopic, dotpoint: node.practise.dotpoint, track: india ? track : null }))}>{t('board.practiseThis')}</button>
        : <p className="muted">{t('board.noPractice')}</p>}
    </div>
  );
}

export function BoardView({ board, india, track, courseLabel, initialOpen = null }) {
  const t = useT();
  const [open, setOpen] = useState(initialOpen);
  const tally = board.tally;
  return (
    <section aria-labelledby="sb-title" className="sb" data-syllabus-board>
      <div className="spread pg-section-head">
        <h2 className="sc-label" id="sb-title">{t('board.title')}</h2>
        <span className="muted" data-board-course lang="en">{courseLabel}</span>
      </div>
      <p className="sb-lede">{t('board.lede', { own: tally.independent + tally.retained, total: tally.total })}</p>
      <ul className="sb-legend" aria-label={t('board.legend')}>
        {NODE_STATES.map(s => <li key={s} data-legend={s}><StateGlyph state={s} size={14} /> {t(STATE_WORD[s])} <span className="muted">({tally[s]})</span></li>)}
      </ul>
      <div className="sb-groups">
        {board.groups.map(g => (
          <section key={g.id} className="sb-group" aria-labelledby={`sb-g-${g.id}`} data-board-group={g.id}>
            <h3 className="sb-group-name" id={`sb-g-${g.id}`} lang="en"><TermGloss text={g.name} /></h3>
            <p className="muted sb-group-sum" data-group-summary>{t('board.groupSummary', {
              own: g.tally.independent + g.tally.retained, total: g.tally.total, held: g.tally.retained,
              help: g.tally.assisted, thin: g.tally.thin, seen: g.tally.seen, none: g.tally['not-started']
            })}</p>
            <ul className="sb-tiles">
              {g.nodes.map(n => {
                const word = t(STATE_WORD[n.state]);
                return (
                  <li key={n.id}>
                    <button
                      type="button" className="sb-tile" data-node={n.id} data-state={n.state}
                      aria-label={`${nodeTitle(n, india)}: ${word}`} aria-expanded={open === n.id} aria-controls="sb-detail"
                      title={`${india ? n.label : n.code} — ${word}`}
                      onClick={() => setOpen(open === n.id ? null : n.id)}
                    >
                      <StateGlyph state={n.state} size={22} />
                      {!india && <span className="sb-tile-code">{n.code.split('-').slice(-2).join('-')}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div id="sb-detail" aria-live="polite">
        {open && (() => {
          const g = board.groups.find(x => x.nodes.some(n => n.id === open));
          const n = g?.nodes.find(x => x.id === open);
          return n ? <Detail node={n} group={g} india={india} track={track} onClose={() => setOpen(null)} /> : null;
        })()}
      </div>
    </section>
  );
}

export function PrioritiesView({ priorities, india, track, paperName }) {
  const t = useT();
  const nav = useNavigate();
  const { items, stake, paperMarks } = priorities;
  return (
    <section aria-labelledby="sb-prio" className="sb-prio" data-board-priorities>
      <h2 className="sc-label" id="sb-prio">{t('board.prio.title')}</h2>
      {stake && (
        <p className="sb-lede" data-board-stake={`${stake.low}-${stake.high}`}>
          {stake.high === 0 ? t('board.prio.stakeNone', { total: paperMarks, paper: paperName })
            : stake.low === stake.high ? t('board.prio.stakeOne', { n: stake.high, total: paperMarks, paper: paperName })
              : t('board.prio.stakeRange', { low: stake.low, high: stake.high, total: paperMarks, paper: paperName })}
        </p>
      )}
      {!items.length ? <p className="muted">{t('board.prio.none')}</p> : (
        <ol className="sb-prio-list">
          {items.map(item => (
            <li key={item.id} className="set-row" data-priority={item.id} data-action={item.action}>
              <span className="set-k">
                <span className="sb-action">{t(ACTION_WORD[item.action])}</span>{' '}
                <span lang="en"><TermGloss text={item.name} /></span>
                <span className="muted sb-prio-meta">
                  {t('board.prio.size', { count: item.questions, n: item.questions, min: item.minutes })}
                  {item.stake && item.stake.high > 0 && <> · {item.stake.low === item.stake.high
                    ? t('board.prio.areaStakeOne', { n: item.stake.high, marks: item.marks })
                    : t('board.prio.areaStake', { low: item.stake.low, high: item.stake.high, marks: item.marks })}</>}
                </span>
              </span>
              {item.practise && (
                <button className="btn btn-quiet btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }}
                  onClick={() => nav(practiceHref({ subtopic: item.practise.subtopic, dotpoint: item.practise.dotpoint, track: india ? track : null }))}>
                  {t('progress.practise')}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="muted sb-note">{paperMarks == null ? t('board.prio.noWeights') : india ? t('board.prio.sourceIndia') : t('board.prio.sourceNsw')}</p>
    </section>
  );
}

export function ReadinessView({ readiness }) {
  const t = useT();
  return (
    <section aria-labelledby="sb-ready" className="sb-ready" data-board-readiness={readiness.status}>
      <h2 className="sc-label" id="sb-ready">{t('board.ready.title')}</h2>
      {readiness.status === 'too-few' ? (
        <p className="sb-lede">
          {t('board.ready.sit')}{' '}
          <span className="muted">{t('board.ready.count', { count: readiness.count, n: readiness.count, needed: readiness.needed })}</span>
        </p>
      ) : (
        <>
          <p className="sb-lede" data-ready-line>{t('board.ready.last', {
            count: readiness.papers.length, n: readiness.papers.length,
            list: readiness.papers.map(p => `${p.score}/${p.total}`).join(', ')
          })}</p>
          <ol className="sb-papers">
            {readiness.papers.map(p => (
              <li key={p.id} className="set-row" data-paper={p.id}>
                <span className="set-k">
                  <span lang="en">{p.title}</span>
                  <span className="muted sb-prio-meta">
                    {new Date(p.finishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{t(p.timed ? 'board.ready.timed' : 'board.ready.untimed')}
                    {' · '}{t(p.full ? 'board.ready.full' : 'board.ready.part')}
                  </span>
                </span>
                <span className="set-v">{p.score}/{p.total}</span>
              </li>
            ))}
          </ol>
          <p data-ready-trend={readiness.trend}>{t(TREND_WORD[readiness.trend])}</p>
          <p className="muted" data-ready-spread>{t('board.ready.spread', {
            low: `${readiness.spread.low.score}/${readiness.spread.low.total}`,
            high: `${readiness.spread.high.score}/${readiness.spread.high.total}`
          })}</p>
          {!readiness.sameConditions && <p className="muted">{t('board.ready.mixed')}</p>}
        </>
      )}
      <p className="muted sb-note">{t('board.ready.why')} <PageLink to="/exams">{t('board.ready.exams')} →</PageLink></p>
    </section>
  );
}

/**
 * The three sections, for the signed-in student's own course.
 * @param {{ user: object, india: boolean, trackName?: string }} props
 */
export default function SyllabusBoard({ user, india, trackName = '' }) {
  const t = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const courses = useMemo(() => (india ? [] : nswCoursesFor(user)), [india, user]);
  const [courseKey, setCourseKey] = useState(courses[0] || null);

  useEffect(() => {
    let live = true;
    api.get('/progress/board').then(d => live && setData(d)).catch(err => live && setError(err.message || tLater('progress.couldNotLoad')));
    return () => { live = false; };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    if (india) {
      const groups = indiaBoardGroups(data.chapters);
      const board = syllabusBoard(groups, data.attempts, { now });
      const blueprint = data.track === 'cbse' ? indiaExamBlueprint({ track: 'cbse', grade: user.year }) : null;
      return { board, priorities: boardPriorities(board, indiaAreas(board, blueprint)), readiness: paperReadiness(data.papers), label: trackName, paperName: blueprint?.label || '' };
    }
    const course = NSW_BOARD_COURSES[courseKey];
    const groups = nswBoardGroups(course);
    const board = syllabusBoard(groups, data.attempts, { located: NSW_DOTPOINT_OUTCOMES, now });
    const blueprint = course?.blueprint ? nswExamBlueprint(course.blueprint) : null;
    const label = course?.firstHsc
      ? t('board.courseLabel', { name: course.name, version: course.version, year: course.firstHsc })
      : t('board.courseLabelPlain', { name: course?.name || '', version: course?.version || '' });
    return { board, priorities: boardPriorities(board, nswAreas(board, blueprint)), readiness: paperReadiness(data.papers), label, paperName: blueprint ? t('board.prio.nswPaper', { name: course.name }) : '' };
  }, [data, india, courseKey, user.year, trackName, t]);

  if (error) return <div className="card" role="alert">{error}</div>;
  if (!view) return <div className="skeleton" style={{ height: 240 }} />;
  return (
    <div className="sb-wrap" data-board-edition={india ? 'in' : 'nsw'}>
      {courses.length > 1 && (
        <label className="sb-course">
          <span className="sc-label">{t('board.course')}</span>{' '}
          <select value={courseKey} onChange={e => setCourseKey(e.target.value)} data-board-select>
            {courses.map(k => <option key={k} value={k} lang="en">{NSW_BOARD_COURSES[k].name}</option>)}
          </select>
        </label>
      )}
      <BoardView board={view.board} india={india} track={data.track} courseLabel={view.label} />
      <PrioritiesView priorities={view.priorities} india={india} track={data.track} paperName={view.paperName} />
      <ReadinessView readiness={view.readiness} />
    </div>
  );
}
