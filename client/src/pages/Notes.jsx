// Pri Learning · Notes
//
// A revision notebook for every chapter the curriculum spine lists. The page is
// its own lazy route and the notes themselves are one chunk per class
// (notes/notesIndex.js), so none of this rides in the install: a student pays
// for Notes the first time they open it, and the service worker's warm pass
// keeps it offline from then on.
//
// Motion is transform and opacity only — formulas are revealed by a paper veil
// sliding off them while a pen stroke draws beneath, sections settle in as they
// scroll into view, cards unfold and flashcards flip. Every one of those is
// switched off by prefers-reduced-motion (Notes.css) and the content is fully
// present without it: the reveal classes only ever hide what is already there.
import { navigateInto } from '../instrument/viewTransition.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { MathText } from '../lib/latex.jsx';
import StudyDiagram from '../notes/StudyDiagram.jsx';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { IN_CURRICULUM, IN_CHAPTER_BY_ID } from '../engine/curriculum-in.js';
import { NOTES_GRADES, gradeOfChapter, loadNotesForGrade, notesSearchText } from '../notes/notesIndex.js';
import { studyResourcesForGrade } from '../notes/data/notes-study-resources.js';
import { studyHref, selectedStudyContext, selectedStudyPracticeHref } from '../lib/studyJourney.js';
import '../notes/Notes.css';
import { Section, Concepts, Formula, Example, Flashcards, useReveal } from '../notes/NotesParts.jsx';
import { notesBookmarkKey } from './notesBookmarkScope.js';
import { chapterNotesLink, notesIndexReturnLink } from './notesStudyLinks.js';
import { loadAllSearchNotes, keepNotesQueryForReload, readNotesQueryAfterReload, clearNotesQueryAfterReload } from './notesSearchRecovery.js';

// Official exam-track names remain visible as students move between notes,
// examples and practice; internal URL slugs are never presented as titles.
const STUDY_TRACK_LABELS = Object.freeze({
  cbse: 'CBSE / NCERT',
  'jee-main': 'JEE Main',
  'jee-advanced': 'JEE Advanced'
});

// ── Small utilities ──────────────────────────────────────────────────────────
function readBookmarks(key) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(values) ? values.filter(v => typeof v === 'string') : []);
  } catch { return new Set(); }
}
function useBookmarks() {
  const { user } = useApp() || {};
  const key = notesBookmarkKey(user?.id);
  // The outer Notes route is also keyed by the active local profile, so a
  // profile change never displays another student's in-memory bookmarks.
  const [marks, setMarks] = useState(() => readBookmarks(key));
  const toggle = useCallback((id) => {
    setMarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* private window: kept for this visit only */ }
      return next;
    });
  }, [key]);
  return [marks, toggle];
}

function useNotes(grade) {
  const [state, setState] = useState({ grade, notes: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ grade, notes: null, failed: false });
    loadNotesForGrade(grade).then(
      notes => { if (live) setState({ grade, notes, failed: false }); },
      () => { if (live) setState({ grade, notes: null, failed: true }); }
    );
    return () => { live = false; };
  }, [grade, attempt]);
  return [state, () => {
    // An explicit retry after a module import failure must make a fresh
    // document: failed ES module records can be cached for this whole page.
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') window.location.reload();
    else setAttempt(a => a + 1);
  }];
}

// ── Entry ────────────────────────────────────────────────────────────────────
export default function Notes() {
  const { chapterId } = useParams();
  const { user } = useApp() || {};
  // Same browser session can switch local profiles without leaving this URL.
  // Remount bookmark state before either student's saved preferences render.
  const identity = String(user?.id ?? 'no-profile');
  return <React.Fragment key={identity}>
    {chapterId ? <ChapterNotes chapterId={chapterId} /> : <NotesIndex />}
  </React.Fragment>;
}

// ── The index: classes, search, map, chapters ────────────────────────────────
function NotesIndex() {
  const t = useT();
  const { user } = useApp() || {};
  const [params, setParams] = useSearchParams();
  const ownGrade = user?.course === 'in' && NOTES_GRADES.includes(Number(user?.year)) ? Number(user.year) : 10;
  const grade = NOTES_GRADES.includes(Number(params.get('class'))) ? Number(params.get('class')) : ownGrade;
  const group = IN_CURRICULUM.find(g => g.grade === grade);
  const [{ notes, failed }, retry] = useNotes(grade);
  const [marks, toggleMark] = useBookmarks();
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [query, setQuery] = useState(() =>
    readNotesQueryAfterReload(user?.id, typeof window === 'undefined' ? null : window.sessionStorage));
  useEffect(() => {
    // StrictMode may run the lazy initializer twice. Erase the profile-scoped
    // restoration only after the query was captured in committed state.
    clearNotesQueryAfterReload(user?.id, typeof window === 'undefined' ? null : window.sessionStorage);
  }, [user?.id]);
  const root = useRef(null);

  const chapters = useMemo(() => (group?.chapters || []).filter(c => !onlyMarked || marks.has(c.id)), [group, onlyMarked, marks]);
  useReveal(root, [grade, notes, onlyMarked, query]);

  const setGrade = (g) => { const p = new URLSearchParams(params); p.set('class', String(g)); setParams(p, { replace: true }); };
  const onTabKey = (e) => {
    const i = NOTES_GRADES.indexOf(grade);
    const next = e.key === 'ArrowRight' ? NOTES_GRADES[(i + 1) % NOTES_GRADES.length]
      : e.key === 'ArrowLeft' ? NOTES_GRADES[(i - 1 + NOTES_GRADES.length) % NOTES_GRADES.length] : null;
    if (next == null) return;
    e.preventDefault();
    setGrade(next);
    requestAnimationFrame(() => root.current?.querySelector(`[data-grade="${next}"]`)?.focus());
  };

  return (
    <div className="nt" ref={root}>
      <header className="nt-head">
        <p className="nt-eyebrow">{t('notes.eyebrow')}</p>
        <h1 className="nt-title">{t('notes.title')}</h1>
        <p className="nt-lede">{t('notes.lede')}</p>
      </header>

      <div className="nt-toolbar">
        <div className="nt-classes" role="tablist" aria-label={t('notes.classLabel')} onKeyDown={onTabKey}>
          {NOTES_GRADES.map(g => (
            <button key={g} type="button" role="tab" data-grade={g} aria-selected={g === grade}
              tabIndex={g === grade ? 0 : -1} className={g === grade ? 'is-on' : ''} onClick={() => setGrade(g)}>
              {t('common.classNumber', { n: g })}
            </button>
          ))}
        </div>
        <label className="nt-search">
          <span className="nt-sr">{t('notes.searchLabel')}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t('notes.searchPlaceholder')} data-testid="notes-search" />
        </label>
      </div>

      {query.trim().length >= 2
        ? <SearchResults query={query.trim()} />
        : (
          <>
            {failed && <LoadFailed retry={retry} />}
            {!failed && !notes && <p className="nt-status" role="status">{t('notes.loading')}</p>}
            {notes && group && <ChapterMap group={group} notes={notes} key={grade} />}
            <section className="nt-index" aria-labelledby="nt-index-h">
              <div className="nt-index-head">
                <h2 id="nt-index-h">{t('notes.chapters')}</h2>
                <label className="nt-check">
                  <input type="checkbox" checked={onlyMarked} onChange={e => setOnlyMarked(e.target.checked)} />
                  <span>{t('notes.bookmarkedOnly')}</span>
                </label>
              </div>
              {onlyMarked && !chapters.length && <p className="nt-quiet">{t('notes.noBookmarks')}</p>}
              <ol className="nt-chapters">
                {chapters.map((c) => {
                  const n = notes?.[c.id];
                  const num = (group.chapters.indexOf(c) + 1);
                  return (
                    <li key={c.id} className="nt-reveal" style={{ '--i': Math.min(num, 14) }}>
                      <PageLink to={chapterNotesLink(c, params)} className="nt-chapter" data-testid="notes-chapter">
                        <span className="nt-chapter-n">{String(num).padStart(2, '0')}</span>
                        <span className="nt-chapter-body">
                          <span className="nt-chapter-name">{c.name}</span>
                          <span className="nt-chapter-meta">
                            {c.strand}{n ? <> · {t('notes.formulaCount', { count: n.formulas.length })}</> : null}
                          </span>
                        </span>
                        {marks.has(c.id) && <span className="nt-chapter-mark" aria-label={t('notes.bookmarked')}><BookmarkGlyph on /></span>}
                        <span className="nt-chapter-go" aria-hidden="true">→</span>
                      </PageLink>
                      <button type="button" className="nt-mark-btn" aria-pressed={marks.has(c.id)}
                        aria-label={t('notes.bookmarkChapter', { chapter: c.name })} onClick={() => toggleMark(c.id)}>
                        <BookmarkGlyph on={marks.has(c.id)} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}
    </div>
  );
}

function LoadFailed({ retry }) {
  const t = useT();
  return (
    <div className="nt-failed" role="alert">
      <p>{t('notes.loadFailed')}</p>
      <button type="button" className="btn btn-secondary" onClick={retry}>{t('notes.retry')}</button>
    </div>
  );
}

function BookmarkGlyph({ on }) {
  return (
    <svg viewBox="0 0 24 24" className={`nt-glyph${on ? ' is-on' : ''}`} aria-hidden="true">
      <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" />
    </svg>
  );
}

// ── The chapter map ──────────────────────────────────────────────────────────
// Chapters sit in book order along the x-axis and in their strand's row; a line
// joins a chapter to every chapter in the same class it builds on. The lines are
// drawn in with stroke-dashoffset once, when the map first enters the screen.
function ChapterMap({ group, notes }) {
  const t = useT();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [focus, setFocus] = useState(null);
  const strands = useMemo(() => [...new Set(group.chapters.map(c => c.strand))], [group]);
  const W = 1000, rowH = 54, padX = 40, top = 30;
  const H = top * 2 + rowH * (strands.length - 1);
  const pos = useMemo(() => {
    const out = {};
    const n = group.chapters.length;
    group.chapters.forEach((c, i) => {
      out[c.id] = { x: padX + (n === 1 ? 0 : i * (W - padX * 2) / (n - 1)), y: top + strands.indexOf(c.strand) * rowH, i };
    });
    return out;
  }, [group, strands, H]);
  const edges = [];
  for (const c of group.chapters) {
    for (const p of notes[c.id]?.prereqs || []) if (pos[p]) edges.push([p, c.id]);
  }
  // Consecutive chapters are joined by a faint thread so the book order reads.
  const thread = group.chapters.map(c => `${pos[c.id].x},${pos[c.id].y}`).join(' ');
  const focused = group.chapters.find(c => c.id === focus);

  return (
    <section className="nt-map nt-reveal" aria-labelledby="nt-map-h">
      <div className="nt-map-head">
        <h2 id="nt-map-h">{t('notes.mapTitle')}</h2>
        <p className="nt-quiet">{t('notes.mapHint')}</p>
      </div>
      <div className="nt-map-frame">
        <ul className="nt-map-strands" aria-hidden="true">
          {strands.map((s, i) => <li key={s} style={{ top: `${((top + i * rowH) / H) * 100}%` }}>{s}</li>)}
        </ul>
        <div className="nt-map-canvas" style={{ aspectRatio: `${W} / ${H}`, '--n': group.chapters.length }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            {strands.map((s, i) => <line key={s} className="nt-map-row" x1="0" x2={W} y1={top + i * rowH} y2={top + i * rowH} />)}
            <polyline className="nt-map-thread" points={thread} pathLength="1" />
            {edges.map(([a, b], k) => {
              const A = pos[a], B = pos[b];
              const mx = (A.x + B.x) / 2, my = Math.min(A.y, B.y) - 18 - Math.abs(B.i - A.i) * 2;
              const lit = focus && (focus === a || focus === b);
              return <path key={k} className={`nt-map-edge${lit ? ' is-lit' : ''}`} pathLength="1"
                style={{ '--d': `${k * 60}ms` }} d={`M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`} />;
            })}
          </svg>
          {group.chapters.map((c, i) => (
            <button key={c.id} type="button" className={`nt-map-node${focus === c.id ? ' is-focus' : ''}`}
              style={{ left: `${(pos[c.id].x / W) * 100}%`, top: `${(pos[c.id].y / H) * 100}%`, '--i': i }}
              aria-label={`${t('notes.chapterNumber', { n: i + 1 })}: ${c.name}`}
              onMouseEnter={() => setFocus(c.id)} onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(c.id)} onBlur={() => setFocus(null)}
              onClick={() => navigateInto(nav, chapterNotesLink(c, params))}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <p className="nt-map-caption" aria-live="polite">{focused ? focused.name : ' '}</p>
    </section>
  );
}

// ── Search across every class ────────────────────────────────────────────────
function SearchResults({ query }) {
  const t = useT();
  const { user } = useApp() || {};
  const [params] = useSearchParams();
  const [all, setAll] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    // Retry must invoke the real dynamic grade loaders again. Clearing only
    // the failed flag used to strand the learner on a permanent Loading message.
    setAll(null); setFailed(false);
    loadAllSearchNotes(NOTES_GRADES, loadNotesForGrade).then(
      notes => { if (live) setAll(notes); },
      () => { if (live) setFailed(true); }
    );
    return () => { live = false; };
  }, [attempt]);
  const results = useMemo(() => {
    if (!all) return [];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const group of IN_CURRICULUM) {
      const notes = all[group.grade] || {};
      for (const c of group.chapters) {
        const hay = notesSearchText(c, notes[c.id]);
        if (terms.every(w => hay.includes(w))) out.push({ c, grade: group.grade, snippet: snippetFor(notes[c.id], terms) });
      }
    }
    return out;
  }, [all, query]);

  if (failed) return <LoadFailed retry={() => {
    // Browser modules that failed to download may not be importable again
    // until a new document is created. A same-document retry stays red.
    const kept = keepNotesQueryForReload(user?.id, query,
      typeof window === 'undefined' ? null : window.sessionStorage);
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
    } else if (!kept) setAttempt(n => n + 1);
  }} />;
  if (!all) return <p className="nt-status" role="status">{t('notes.loading')}</p>;
  return (
    <section className="nt-results" aria-live="polite">
      <p className="nt-quiet">{results.length ? t('notes.searchCount', { count: results.length }) : t('notes.searchEmpty', { q: query })}</p>
      <ol className="nt-chapters">
        {results.slice(0, 40).map(({ c, grade, snippet }) => (
          <li key={c.id}>
            <PageLink to={chapterNotesLink(c, params)} className="nt-chapter">
              <span className="nt-chapter-n">{grade}</span>
              <span className="nt-chapter-body">
                <span className="nt-chapter-name">{c.name}</span>
                {snippet && <MathText className="nt-chapter-meta" text={snippet} />}
              </span>
              <span className="nt-chapter-go" aria-hidden="true">→</span>
            </PageLink>
          </li>
        ))}
      </ol>
    </section>
  );
}

function snippetFor(notes, terms) {
  if (!notes) return '';
  const fields = [
    ...(notes.definitions || []).map(d => `${d.term} — ${d.meaning}`),
    ...(notes.formulas || []).map(f => f.label),
    ...(notes.points || []).map(p => p.back),
    ...(notes.concepts || []).map(c => c.body),
    notes.summary
  ];
  const hit = fields.find(f => terms.some(w => String(f).toLowerCase().includes(w)));
  return hit ? String(hit).slice(0, 200) : '';
}

// ── One chapter ──────────────────────────────────────────────────────────────
function ChapterNotes({ chapterId }) {
  const t = useT();
  const nav = useNavigate();
  const chapter = IN_CHAPTER_BY_ID[chapterId];
  const grade = gradeOfChapter(chapterId);
  const [{ notes: all, failed }, retry] = useNotes(grade);
  const [marks, toggleMark] = useBookmarks();
  const [cards, setCards] = useState(false);
  // Limit initial SVG mounting on tablets; reveal more without discarding solved steps.
  const [visibleExamples, setVisibleExamples] = useState(6);
  const [visualOnly, setVisualOnly] = useState(false);
  const notes = all?.[chapterId];
  const selectedExamples = visualOnly ? (notes?.examples || []).filter(ex => ex.figure) : (notes?.examples || []);
  const [params] = useSearchParams();
  const selected = selectedStudyContext(chapter, params);
  const linkedResources = studyResourcesForGrade(grade, selected?.track || 'cbse');
  const practiceLink = selectedStudyPracticeHref(chapter, params);
  const mode = params.get('view') === 'examples' ? 'examples' : 'notes';
  const changeMode = next => {
    const href = studyHref({ ...selected, view: next });
    if (href) nav(href);
  };
  useEffect(() => {
    if (mode !== 'examples' || !notes) return;
    // Let the lazy-loaded chapter render its verified examples before focus.
    requestAnimationFrame(() => document.getElementById('examples')?.scrollIntoView({ block: 'start' }));
  }, [mode, notes, chapterId]);

  const root = useRef(null);
  useReveal(root, [chapterId, notes, visibleExamples, visualOnly]);
  useEffect(() => { setVisibleExamples(6); setVisualOnly(false); window.scrollTo?.(0, 0); }, [chapterId]);

  const group = IN_CURRICULUM.find(g => g.grade === grade);
  const number = group ? group.chapters.findIndex(c => c.id === chapterId) + 1 : 0;
  const backTo = notesIndexReturnLink(chapter, params);

  if (!chapter) {
    return <div className="nt"><p className="nt-quiet">{t('notes.notFound')}</p><PageLink className="nt-back" to="/notes">← {t('notes.back')}</PageLink></div>;
  }
  return (
    <article className="nt nt-article" ref={root} aria-labelledby="nt-ch-title">
      <PageLink className="nt-back" to={backTo}>← {t('notes.back')}</PageLink>
      <header className="nt-ch-head">
        <p className="nt-eyebrow">{t('common.classNumber', { n: grade })} · {t('notes.chapterNumber', { n: number })} · {chapter.strand}</p>
        <h1 className="nt-title" id="nt-ch-title">{chapter.name}</h1>
        <nav className="nt-path" aria-label={t('study.path')} data-study-path>
          <PageLink to="/">{t('study.curriculum')}</PageLink>
          <span>{t('common.classNumber', { n: grade })}</span>
          <span data-study-track>{STUDY_TRACK_LABELS[selected.track]}</span>
          <span>{t('study.subject')}</span>
          <span aria-current="page">{chapter.name}</span>
        </nav>
        {selected.difficulty != null && (
          <p className="nt-selected-difficulty" data-study-difficulty>
            {t('home.difficultyChip', { n: selected.difficulty, label: t(`difficulty.${selected.difficulty}`) })}
          </p>
        )}
        {selected.dotpoint != null && (
          <p className="nt-selected-outcome">{t('study.selectedOutcome')}: {typeof chapter.dotpoints[selected.dotpoint] === 'string'
            ? chapter.dotpoints[selected.dotpoint] : chapter.dotpoints[selected.dotpoint]?.text}</p>
        )}
        <div className="nt-journey-tabs" role="group" aria-label={t('study.choosePath')} data-study-journey>
          <button type="button" className={mode === 'notes' ? 'on' : ''} aria-pressed={mode === 'notes'} data-study-notes onClick={() => changeMode('notes')}>{t('study.notes')}</button>
          <button type="button" className={mode === 'examples' ? 'on' : ''} aria-pressed={mode === 'examples'} data-study-examples onClick={() => changeMode('examples')}>{t('study.examples')}</button>
          <button type="button" data-study-practice onClick={() => nav(practiceLink)}>{t('study.practice')}</button>
        </div>
        {notes && <MathText block className="nt-lede" text={notes.summary} />}
        <div className="nt-actions">
          <button type="button" className="btn btn-primary" onClick={() => nav(practiceLink)} data-testid="notes-practise">
            {t('notes.practise')}
          </button>
          {notes && (
            <button type="button" className="btn btn-secondary" onClick={() => setCards(true)} data-testid="notes-revise">
              {t('notes.revise')}
            </button>
          )}
          <button type="button" className="nt-mark-toggle" aria-pressed={marks.has(chapterId)} onClick={() => toggleMark(chapterId)}>
            <BookmarkGlyph on={marks.has(chapterId)} />
            <span>{marks.has(chapterId) ? t('notes.bookmarked') : t('notes.bookmark')}</span>
          </button>
        </div>
        {notes?.prereqs?.length > 0 && (
          <p className="nt-builds">
            <span>{t('notes.buildsOn')}</span>
            {notes.prereqs.filter(p => IN_CHAPTER_BY_ID[p]).map(p => (
              <PageLink key={p} to={chapterNotesLink(IN_CHAPTER_BY_ID[p], params)}>{IN_CHAPTER_BY_ID[p].name} <small>{t('common.classNumber', { n: gradeOfChapter(p) })}</small></PageLink>
            ))}
          </p>
        )}
      </header>

      {failed && <LoadFailed retry={retry} />}
      {!failed && !all && <p className="nt-status" role="status">{t('notes.loading')}</p>}
      {all && !notes && <p className="nt-quiet">{t('notes.notFound')}</p>}

      {notes && (
        <div className="nt-sheet">
          <Section id="ideas" title={t('notes.sectionIdeas')}>
            <Concepts concepts={notes.concepts} />
          </Section>

          {chapter.id === 'c11-complex-numbers' && <ComplexArgandFigure />}
          <Section id="definitions" title={t('notes.sectionDefinitions')}>
            <dl className="nt-defs">
              {notes.definitions.map((d, i) => (
                <div key={i} className="nt-reveal" style={{ '--i': i }}>
                  <dt><MathText text={d.term} /></dt>
                  <dd><MathText text={d.meaning} /></dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="formulas" title={t('notes.sectionFormulas')}>
            <div className="nt-formulas">
              {notes.formulas.map((f, i) => <Formula key={i} f={f} i={i} />)}
            </div>
          </Section>

          <Section id="points" title={t('notes.sectionPoints')}>
            <ol className="nt-points">
              {notes.points.map((p, i) => (
                <li key={i} className="nt-reveal" style={{ '--i': i }}>
                  <MathText className="nt-point-front" text={p.front} />
                  <MathText className="nt-point-back" text={p.back} />
                </li>
              ))}
            </ol>
          </Section>

          <Section id="mistakes" title={t('notes.sectionMistakes')}>
            <ul className="nt-mistakes">
              {notes.mistakes.map((m, i) => (
                <li key={i} className="nt-reveal" style={{ '--i': i }}>
                  <div className="nt-wrong"><span className="nt-tag">{t('notes.mistakeWrong')}</span><MathText text={m.wrong} /></div>
                  <div className="nt-right"><span className="nt-tag">{t('notes.mistakeRight')}</span><MathText text={m.right} /></div>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="examples" title={t('notes.sectionExamples')}>
            {notes.examples.some(ex => ex.figure) && (
              <div className="nt-example-more">
                <button type="button" className="btn btn-secondary"
                  aria-pressed={visualOnly}
                  onClick={() => { setVisualOnly(v => !v); setVisibleExamples(6); }}>
                  {visualOnly ? t('notes.showAllExamples') : t('notes.visualExamplesOnly')}
                </button>
              </div>
            )}
            {selectedExamples.slice(0, visibleExamples).map((ex, i) => <Example key={chapterId + ':' + ex.question} ex={ex} n={i + 1} />)}
            {selectedExamples.length > visibleExamples && (
              <div className="nt-example-more">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setVisibleExamples(v => Math.min(v + 6, selectedExamples.length))}
                  aria-label={t('notes.showMoreExamples')}>
                  {t('nav.more')} ({Math.min(visibleExamples + 6, selectedExamples.length)}/{selectedExamples.length})
                </button>
              </div>
            )}
          </Section>

          {linkedResources.length > 0 && (
            <Section id="resources" title={t('notes.sectionResources')}>
              <ul className="nt-chapters" data-testid="notes-study-resources">
                {linkedResources.map(resource => (
                  <li key={resource.id}>
                    <a className="nt-chapter" href={resource.url} target="_blank" rel="noopener noreferrer"
                      aria-label={resource.title}>
                      <span className="nt-chapter-n" aria-hidden="true">↗</span>
                      <span className="nt-chapter-body">
                        <strong className="nt-chapter-name">{resource.title}</strong>
                        <span className="nt-chapter-meta">{resource.issuer} · {resource.focus}</span>
                      </span>
                      <span className="nt-chapter-go" aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="nt-end nt-reveal">
            <button type="button" className="btn btn-primary" onClick={() => nav(practiceLink)}>{t('notes.practise')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setCards(true)}>{t('notes.revise')}</button>
          </div>
        </div>
      )}

      {cards && notes && <Flashcards chapter={chapter} points={notes.points} onClose={() => setCards(false)} />}
    </article>
  );
}

// Exact vector geometry for z = -1 + i√3: scale=75 px/unit and the
// example's 120° principal argument. No generated bitmap or decorative plot.
function ComplexArgandFigure() {
  const t = useT();
  return (
    <figure className="nt-argand nt-reveal" aria-label={t('study.argandAlt')}>
      <svg role="img" aria-labelledby="nt-argand-title nt-argand-desc" viewBox="0 0 520 336" preserveAspectRatio="xMidYMid meet">
        <title id="nt-argand-title">{t('study.argandTitle')}</title>
        <desc id="nt-argand-desc">{t('study.argandAlt')}</desc>
        <defs><marker id="nt-argand-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" strokeWidth="1.3" /></marker></defs>
        <g className="nt-argand-grid">
          {[110,185,335,410].map(x => <line key={x} x1={x} y1="22" x2={x} y2="314" />)}
          {[35,110,260].map(y => <line key={y} x1="36" y1={y} x2="484" y2={y} />)}
        </g>
        <line className="nt-argand-axis" x1="36" y1="185" x2="478" y2="185" markerEnd="url(#nt-argand-arrow)" />
        <line className="nt-argand-axis" x1="260" y1="314" x2="260" y2="22" markerEnd="url(#nt-argand-arrow)" />
        <line className="nt-argand-radius" x1="260" y1="185" x2="185" y2="55.096" />
        <path className="nt-argand-angle" d="M318 185 A58 58 0 0 0 231 134.77" fill="none" />
        <line className="nt-argand-guide" x1="185" y1="55.096" x2="185" y2="185" />
        <line className="nt-argand-guide" x1="185" y1="55.096" x2="260" y2="55.096" />
        <circle className="nt-argand-point" cx="185" cy="55.096" r="5.5" />
        <g className="nt-argand-label">
          <text x="484" y="204">{t('study.axisReal')}</text><text x="275" y="24">{t('study.axisImaginary')}</text>
          <text x="248" y="204">0</text><text x="176" y="205">−1</text>
          <text x="269" y="61">√3</text><text x="109" y="42">−1 + i√3</text>
          <text x="305" y="135">2π/3</text><text x="204" y="111">{t('study.radiusTwo')}</text>
        </g>
      </svg>
      <figcaption>{t('study.argandCaption')}</figcaption>
    </figure>
  );
}
