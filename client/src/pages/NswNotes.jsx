// Pri Learning · NSW Notes (the Prithagoras edition's notes page)
//
// The same notebook as the India notes — ideas in plain words, formulas, what
// markers look for, the usual traps, engine-checked worked examples — but built
// from the NSW curriculum model, with Year tabs (Year 7 … Year 12) and, for
// Years 11–12, the course. It imports NO India curriculum or India notes
// (client/test/nsw-notes-no-india-check.mjs holds that), and where NSW notes are
// not written yet it says so: "coming soon", never another curriculum's content.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import '../notes/Notes.css';
import { NotOffered } from '../components/NotOffered.jsx';
import { offeredYears, pathwayOffered, yearOffered, defaultOffering } from '../platform/edition.js';
import { Flashcards, NextPractice, useReveal } from '../notes/NotesParts.jsx';
import { ChapterSheet } from '../notes/nsw/NswParts.jsx';
import { nswPracticeSubtopic, nswPracticeHref } from '../notes/nsw/nswPractice.js';
import {
  NSW_NOTES_COURSES, NSW_NOTES_TOPIC_BY_ID, NSW_NOTES_YEARS, loadNswNotesForStage, topicSearchText, topicsFor, yearOfTopic
} from '../notes/nsw/nswNotesIndex.js';

const COURSE_IDS = NSW_NOTES_COURSES.map(c => c.id);
const yearOf = value => (NSW_NOTES_YEARS.includes(Number(value)) ? Number(value) : null);
// Owner decision, 19 Nov 2026: only the years and courses the edition offers are shown (the rest stay in the catalogue).
const SHOWN_YEARS = offeredYears(NSW_NOTES_YEARS);
const SHOWN_COURSES = NSW_NOTES_COURSES.filter(c => pathwayOffered(c.id));
const topicOffered = tp => tp.years.some(yearOffered) && (!tp.course || pathwayOffered(tp.course));

// The student's own year, from the profile (the year field holds 7–12 for an NSW student).
function ownYear(user) {
  const own = yearOf(user?.year) || 7;
  return yearOffered(own) ? own : (defaultOffering()?.year ?? own);
}

function useStageNotes(stage, course = null) {
  const [state, setState] = useState({ notes: null, failed: false, done: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ notes: null, failed: false, done: false });
    loadNswNotesForStage(stage, course)
      .then(notes => { if (live) setState({ notes, failed: false, done: true }); })
      .catch(() => { if (live) setState({ notes: null, failed: true, done: true }); });
    return () => { live = false; };
  }, [stage, course, attempt]);
  return [state, () => setAttempt(a => a + 1)];
}

export default function NswNotes() {
  // The route param is :chapterId (the same route the India notes use).
  const { chapterId: topicId } = useParams();
  const { user } = useApp() || {};
  const identity = String(user?.id ?? 'no-profile');
  return <React.Fragment key={identity}>{topicId ? <TopicNotes topicId={topicId} /> : <NotesIndex />}</React.Fragment>;
}

function LoadFailed({ retry, t }) {
  return (
    <div className="nt-failed" role="alert">
      <p>{t('notes.loadFailed')}</p>
      <button type="button" className="btn btn-secondary" onClick={retry}>{t('notes.retry')}</button>
    </div>
  );
}

function NotesIndex() {
  const t = useT();
  const { user } = useApp() || {};
  const [params, setParams] = useSearchParams();
  const year = yearOf(params.get('year')) || ownYear(user);
  const course = COURSE_IDS.includes(params.get('course')) ? params.get('course') : (COURSE_IDS.includes(user?.nswCourse) ? user.nswCourse : (SHOWN_COURSES.some(c => c.id === user?.pathway) ? user.pathway : 'advanced'));
  const hidden = !yearOffered(year) || (year >= 11 && !pathwayOffered(course));
  const [query, setQuery] = useState('');
  const root = useRef(null);
  const topics = useMemo(() => topicsFor(year, course), [year, course]);
  const stage = topics[0]?.stage;
  const [{ notes, failed }, retry] = useStageNotes(stage ?? 0, topics[0]?.course ?? null);
  const needle = query.trim().toLowerCase();
  const shown = needle.length >= 2 ? topics.filter(x => topicSearchText(x).includes(needle)) : topics;
  const hasNotes = topic => !!notes && Object.hasOwn(notes, topic.id);
  useReveal(root, [year, course, notes, query]);
  const ready = topics.filter(hasNotes).length;

  const set = (patch) => { const p = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) p.set(k, String(v)); setParams(p, { replace: true }); };
  const onTabKey = (e) => {
    const i = SHOWN_YEARS.indexOf(year);
    const next = e.key === 'ArrowRight' ? SHOWN_YEARS[(i + 1) % SHOWN_YEARS.length]
      : e.key === 'ArrowLeft' ? SHOWN_YEARS[(i - 1 + SHOWN_YEARS.length) % SHOWN_YEARS.length] : null;
    if (next == null) return;
    e.preventDefault();
    set({ year: next });
    requestAnimationFrame(() => root.current?.querySelector(`[data-year="${next}"]`)?.focus());
  };

  if (hidden) return <NotOffered />;
  return (
    <div className="nt" ref={root} data-nsw-notes>
      <header className="nt-head">
        <p className="nt-eyebrow">{t('notes.nsw.eyebrow')}</p>
        <h1 className="nt-title">{t('notes.title')}</h1>
        <p className="nt-lede">{t('notes.nsw.lede')}</p>
        <p className="nt-quiet">{t('notes.nsw.unofficial')}</p>
      </header>

      <div className="nt-toolbar">
        <div className="nt-classes" role="tablist" aria-label={t('notes.nsw.yearLabel')} onKeyDown={onTabKey}>
          {SHOWN_YEARS.map(y => (
            <button key={y} type="button" role="tab" data-year={y} aria-selected={y === year}
              tabIndex={y === year ? 0 : -1} className={y === year ? 'is-on' : ''} onClick={() => set({ year: y })}>
              {t('notes.nsw.yearTab', { n: y })}
            </button>
          ))}
        </div>
        <label className="nt-search">
          <span className="nt-sr">{t('notes.nsw.searchLabel')}</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('notes.nsw.searchPlaceholder')} data-testid="notes-search" />
        </label>
      </div>

      {year >= 11 && (
        <div className="nt-classes" role="group" aria-label={t('notes.nsw.courseLabel')}>
          {SHOWN_COURSES.map(c => (
            <button key={c.id} type="button" aria-pressed={c.id === course} className={c.id === course ? 'is-on' : ''} onClick={() => set({ course: c.id })}>
              {t(c.labelKey)}
            </button>
          ))}
        </div>
      )}

      {failed && <LoadFailed retry={retry} t={t} />}
      <section className="nt-index" aria-labelledby="nt-index-h">
        <div className="nt-index-head">
          <h2 id="nt-index-h">{t('notes.nsw.topics')}</h2>
          <p className="nt-quiet" role="status">{t('notes.nsw.readyCount', { count: ready, n: ready })}</p>
        </div>
        {!topics.length && <p className="nt-quiet" role="status" data-no-topics>{t('notes.nsw.noTopics', { n: year })}</p>}
        {needle.length >= 2 && topics.length > 0 && !shown.length && <p className="nt-quiet">{t('notes.nsw.searchEmpty', { q: query.trim() })}</p>}
        <ol className="nt-chapters">
          {shown.map((topic, i) => {
            const has = hasNotes(topic);
            const body = (
              <>
                <span className="nt-chapter-n">{String(topics.indexOf(topic) + 1).padStart(2, '0')}</span>
                <span className="nt-chapter-body">
                  <strong className="nt-chapter-name">{topic.name}</strong>
                  <span className="nt-chapter-meta">
                    {t('notes.nsw.stage', { n: topic.stage })}{topic.strandKey ? ` · ${t(topic.strandKey)}` : ''}{topic.path ? ` · ${t('notes.nsw.pathTag')}` : ''}
                  </span>
                </span>
                {has ? <span className="nt-chapter-go" aria-hidden="true">→</span> : <span className="nt-chapter-meta" data-coming-soon>{t('notes.nsw.comingSoon')}</span>}
              </>
            );
            return (
              <li key={topic.id} className="nt-reveal" style={{ '--i': Math.min(i, 14) }}>
                {has
                  ? <PageLink to={`/notes/${topic.id}?year=${year}${topic.course ? `&course=${topic.course}` : ''}`} className="nt-chapter" data-testid="notes-chapter">{body}</PageLink>
                  : <div className="nt-chapter" aria-disabled="true" data-testid="notes-soon">{body}</div>}
              </li>
            );
          })}
        </ol>
        {ready < topics.length && !failed && <p className="nt-quiet">{t('notes.nsw.comingSoonList')}</p>}
      </section>
    </div>
  );
}

function TopicNotes({ topicId }) {
  const t = useT();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const topic = NSW_NOTES_TOPIC_BY_ID[topicId] || null;
  const year = topic ? yearOfTopic(topic, yearOf(params.get('year'))) : null;
  const [{ notes: all, failed, done }, retry] = useStageNotes(topic?.stage ?? 0, topic?.course ?? null);
  const [cards, setCards] = useState(false);
  const notes = all && topic ? all[topic.id] : null;
  const root = useRef(null);
  useEffect(() => { window.scrollTo?.(0, 0); }, [topicId]);
  useReveal(root, [topicId, notes]);
  const back = `/notes?year=${year ?? ''}${topic?.course ? `&course=${topic.course}` : ''}`;
  // The next step into Practice: the topic's own practice where an issued subtopic teaches it,
  // otherwise Practice for the student's own year and course, and the page says which.
  const practiceExact = topic ? !!nswPracticeSubtopic(topic) : false;
  const practiceHref = topic ? nswPracticeHref(topic) : '/practice';
  const courseLabel = topic?.course ? t(NSW_NOTES_COURSES.find(c => c.id === topic.course).labelKey) : null;
  const scope = `${t('notes.nsw.yearTab', { n: year })}${courseLabel ? ` · ${courseLabel}` : ''}`;
  const practiseLabel = practiceExact ? t('notes.practise') : t('notes.nsw.openPractice');
  const buildsOn = (notes?.prereqs || []).filter(p => NSW_NOTES_TOPIC_BY_ID[p])
    .map(p => ({ to: `/notes/${p}?year=${yearOfTopic(NSW_NOTES_TOPIC_BY_ID[p], year)}`, label: NSW_NOTES_TOPIC_BY_ID[p].name }));

  if (!topic) {
    return <div className="nt"><p className="nt-quiet">{t('notes.nsw.notFound')}</p><PageLink className="nt-back" to="/notes">← {t('notes.nsw.back')}</PageLink></div>;
  }
  if (!topicOffered(topic)) return <NotOffered />;
  return (
    <article className="nt nt-article" ref={root} aria-labelledby="nt-ch-title" data-nsw-notes>
      <PageLink className="nt-back" to={back}>← {t('notes.nsw.back')}</PageLink>
      <header className="nt-ch-head">
        <p className="nt-eyebrow">{scope} · {t('notes.nsw.stage', { n: topic.stage })}{topic.strandKey ? ` · ${t(topic.strandKey)}` : ''}</p>
        <h1 className="nt-title" id="nt-ch-title">{topic.name}</h1>
        <p className="nt-quiet">{t('notes.nsw.outcomes', { codes: topic.outcomes.join(', ') })}</p>
        {notes && <MathText block className="nt-lede" text={notes.summary} />}
        <div className="nt-actions">
          <button type="button" className="btn btn-primary" onClick={() => nav(practiceHref)} data-testid="notes-practise">{practiseLabel}</button>
          {notes && <button type="button" className="btn btn-secondary" onClick={() => setCards(true)} data-testid="notes-revise">{t('notes.revise')}</button>}
        </div>
      </header>

      {failed && <LoadFailed retry={retry} t={t} />}
      {!failed && !done && <p className="nt-status" role="status">{t('notes.loading')}</p>}
      {done && !failed && !notes && (
        <p className="nt-quiet" role="status" data-coming-soon>{t('notes.nsw.comingSoonYear', { topic: topic.name, n: year })}</p>
      )}

      {notes && (
        <ChapterSheet notes={notes} topicId={topicId} buildsOn={buildsOn} next={(
          <NextPractice what={t('notes.nextWhat', { chapter: topic.name, scope })}
            note={practiceExact ? null : t('notes.nsw.nextNone', { topic: topic.name })}>
            <button type="button" className="btn btn-primary" onClick={() => nav(practiceHref)} data-testid="notes-next-practise">{practiseLabel}</button>
          </NextPractice>
        )} />
      )}
      {cards && notes && <Flashcards chapter={{ name: topic.name }} points={notes.points} onClose={() => setCards(false)} />}
    </article>
  );
}
