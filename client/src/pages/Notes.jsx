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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MathText } from '../lib/latex.jsx';
import StudyDiagram from '../notes/StudyDiagram.jsx';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { IN_CURRICULUM, IN_CHAPTER_BY_ID } from '../engine/curriculum-in.js';
import { NOTES_GRADES, gradeOfChapter, loadNotesForGrade, notesPracticeHref, notesSearchText } from '../notes/notesIndex.js';
import { studyResourcesForGrade } from '../notes/data/notes-study-resources.js';
import '../notes/Notes.css';

const BOOKMARK_KEY = 'pri.notes.bookmarks.v1';

// ── Small utilities ──────────────────────────────────────────────────────────
function readBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]')); } catch { return new Set(); }
}
function useBookmarks() {
  const [marks, setMarks] = useState(readBookmarks);
  const toggle = useCallback((id) => {
    setMarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next])); } catch { /* private window: kept for this visit only */ }
      return next;
    });
  }, []);
  return [marks, toggle];
}

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Adds `is-in` to every `.nt-reveal` under `root` as it scrolls into view. */
function useReveal(rootRef, deps) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const items = [...root.querySelectorAll('.nt-reveal:not(.is-in)')];
    if (reducedMotion() || typeof IntersectionObserver !== 'function') {
      for (const el of items) el.classList.add('is-in');
      return undefined;
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (const el of items) io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
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
  return [state, () => setAttempt(a => a + 1)];
}

// ── Entry ────────────────────────────────────────────────────────────────────
export default function Notes() {
  const { chapterId } = useParams();
  return chapterId ? <ChapterNotes chapterId={chapterId} /> : <NotesIndex />;
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
  const [query, setQuery] = useState('');
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
                      <Link to={`/notes/${c.id}`} className="nt-chapter" data-testid="notes-chapter">
                        <span className="nt-chapter-n">{String(num).padStart(2, '0')}</span>
                        <span className="nt-chapter-body">
                          <span className="nt-chapter-name">{c.name}</span>
                          <span className="nt-chapter-meta">
                            {c.strand}{n ? <> · {t('notes.formulaCount', { count: n.formulas.length })}</> : null}
                          </span>
                        </span>
                        {marks.has(c.id) && <span className="nt-chapter-mark" aria-label={t('notes.bookmarked')}><BookmarkGlyph on /></span>}
                        <span className="nt-chapter-go" aria-hidden="true">→</span>
                      </Link>
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
        <div className="nt-map-canvas" style={{ aspectRatio: `${W} / ${H}` }}>
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
              onClick={() => nav(`/notes/${c.id}`)}>
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
  const [all, setAll] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all(NOTES_GRADES.map(g => loadNotesForGrade(g).then(n => [g, n])))
      .then(rows => { if (live) setAll(Object.fromEntries(rows)); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
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

  if (failed) return <LoadFailed retry={() => { setFailed(false); }} />;
  if (!all) return <p className="nt-status" role="status">{t('notes.loading')}</p>;
  return (
    <section className="nt-results" aria-live="polite">
      <p className="nt-quiet">{results.length ? t('notes.searchCount', { count: results.length }) : t('notes.searchEmpty', { q: query })}</p>
      <ol className="nt-chapters">
        {results.slice(0, 40).map(({ c, grade, snippet }) => (
          <li key={c.id}>
            <Link to={`/notes/${c.id}`} className="nt-chapter">
              <span className="nt-chapter-n">{grade}</span>
              <span className="nt-chapter-body">
                <span className="nt-chapter-name">{c.name}</span>
                {snippet && <MathText className="nt-chapter-meta" text={snippet} />}
              </span>
              <span className="nt-chapter-go" aria-hidden="true">→</span>
            </Link>
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
  const [resourceParams] = useSearchParams();
  // External references are track-specific; a CBSE visitor must not be told
  // a JEE-specific examination archive is part of the school syllabus.
  const routeTrack = resourceParams.get('track');
  const resourceTrack = routeTrack === 'jee-main' || routeTrack === 'jee-advanced' ? routeTrack : 'cbse';
  const linkedResources = studyResourcesForGrade(grade, resourceTrack);
  const [{ notes: all, failed }, retry] = useNotes(grade);
  const [marks, toggleMark] = useBookmarks();
  const [cards, setCards] = useState(false);
  const root = useRef(null);
  const notes = all?.[chapterId];
  useReveal(root, [chapterId, notes]);
  useEffect(() => { window.scrollTo?.(0, 0); }, [chapterId]);

  const group = IN_CURRICULUM.find(g => g.grade === grade);
  const number = group ? group.chapters.findIndex(c => c.id === chapterId) + 1 : 0;
  const backTo = `/notes?class=${grade}`;

  if (!chapter) {
    return <div className="nt"><p className="nt-quiet">{t('notes.notFound')}</p><Link className="nt-back" to="/notes">← {t('notes.back')}</Link></div>;
  }
  return (
    <article className="nt nt-article" ref={root} aria-labelledby="nt-ch-title">
      <Link className="nt-back" to={backTo}>← {t('notes.back')}</Link>
      <header className="nt-ch-head">
        <p className="nt-eyebrow">{t('common.classNumber', { n: grade })} · {t('notes.chapterNumber', { n: number })} · {chapter.strand}</p>
        <h1 className="nt-title" id="nt-ch-title">{chapter.name}</h1>
        {notes && <MathText block className="nt-lede" text={notes.summary} />}
        <div className="nt-actions">
          <button type="button" className="btn btn-primary" onClick={() => nav(notesPracticeHref(chapter))} data-testid="notes-practise">
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
              <Link key={p} to={`/notes/${p}`}>{IN_CHAPTER_BY_ID[p].name} <small>{t('common.classNumber', { n: gradeOfChapter(p) })}</small></Link>
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
            {notes.examples.map((ex, i) => <Example key={i} ex={ex} n={i + 1} />)}
          </Section>

          {linkedResources.length > 0 && (
            <Section id="resources" title={t('nav.more')}>
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
            <button type="button" className="btn btn-primary" onClick={() => nav(notesPracticeHref(chapter))}>{t('notes.practise')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setCards(true)}>{t('notes.revise')}</button>
          </div>
        </div>
      )}

      {cards && notes && <Flashcards chapter={chapter} points={notes.points} onClose={() => setCards(false)} />}
    </article>
  );
}

function Section({ id, title, children }) {
  return (
    <section className="nt-section" aria-labelledby={`nt-s-${id}`}>
      <h2 className="nt-section-h nt-reveal" id={`nt-s-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

function Concepts({ concepts }) {
  const t = useT();
  const [open, setOpen] = useState(() => new Set([0]));
  const allOpen = open.size === concepts.length;
  const toggle = (i) => setOpen(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <>
      <button type="button" className="nt-link-btn" onClick={() => setOpen(allOpen ? new Set() : new Set(concepts.map((_, i) => i)))}>
        {allOpen ? t('notes.foldAll') : t('notes.unfoldAll')}
      </button>
      <div className="nt-concepts">
        {concepts.map((c, i) => {
          const isOpen = open.has(i);
          return (
            <div key={i} className={`nt-concept nt-reveal${isOpen ? ' is-open' : ''}`} style={{ '--i': i }}>
              <h3>
                <button type="button" aria-expanded={isOpen} aria-controls={`nt-c-${i}`} onClick={() => toggle(i)}>
                  <span className="nt-concept-n">{i + 1}</span>
                  <MathText text={c.title} />
                  <span className="nt-fold" aria-hidden="true" />
                </button>
              </h3>
              <div id={`nt-c-${i}`} className="nt-concept-body" hidden={!isOpen}>
                <MathText block text={c.body} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Formula({ f, i }) {
  // Rendered through MathText, the one escaped KaTeX sink, in display style.
  const text = useMemo(() => `$\\displaystyle ${f.tex}$`, [f.tex]);
  return (
    <figure className="nt-formula nt-reveal" style={{ '--i': i }}>
      <figcaption><MathText text={f.label} /></figcaption>
      <div className="nt-ink">
        <MathText block className="nt-ink-tex" text={text} />
        <span className="nt-ink-veil" aria-hidden="true" />
      </div>
      <svg className="nt-ink-stroke" viewBox="0 0 300 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 6.5 C 60 3, 120 8.5, 190 5 S 270 3.5, 298 5.5" pathLength="1" />
      </svg>
      {f.note && <MathText block className="nt-formula-note" text={f.note} />}
    </figure>
  );
}

function Example({ ex, n }) {
  const t = useT();
  // Do not reveal worked steps before the learner studies the source diagram.
  const [shown, setShown] = useState(0);
  const done = shown >= ex.steps.length;
  return (
    <div className="nt-example nt-reveal">
      <p className="nt-example-n">{t('notes.exampleNumber', { n })}</p>
      <MathText block className="nt-example-q" text={ex.question} />
      {ex.figure && <StudyDiagram figure={ex.figure} />}
      <ol className="nt-steps">
        {ex.steps.slice(0, shown).map((s, i) => <li key={i} className="nt-step"><MathText text={s} /></li>)}
      </ol>
      {!done ? (
        <div className="nt-example-more">
          <button type="button" className="btn btn-secondary" onClick={() => setShown(s => s + 1)}>{t('notes.nextStep')}</button>
          <button type="button" className="nt-link-btn" onClick={() => setShown(ex.steps.length)}>{t('notes.allSteps')}</button>
        </div>
      ) : (
        <div className="nt-answer nt-step">
          <span className="nt-tag">{t('notes.answer')}</span>
          <MathText text={ex.answer} />
          <span className="nt-checked">{t('notes.engineChecked')}</span>
        </div>
      )}
    </div>
  );
}

// ── Revise in five minutes ───────────────────────────────────────────────────
function Flashcards({ chapter, points, onClose }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const dialog = useRef(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const finished = i >= points.length;

  const go = useCallback((d) => { setFlipped(false); setI(x => Math.max(0, Math.min(points.length, x + d))); }, [points.length]);

  useEffect(() => {
    dialog.current?.querySelector('.nt-card, .nt-cards-done button')?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; opener.current?.focus?.(); };
  }, []);
  // The card is re-keyed per index (so it slides in), which drops focus with the
  // old node; put it back so arrow keys keep working inside the dialog.
  useEffect(() => {
    const el = dialog.current;
    if (el && (!el.contains(document.activeElement) || document.activeElement === document.body || finished)) {
      el.querySelector('.nt-card, .nt-cards-done button')?.focus();
    }
  }, [i, finished]);

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key === 'Tab') {
      const f = [...dialog.current.querySelectorAll('button:not([disabled])')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const card = points[i];

  return (
    <div className="nt-cards-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nt-cards" role="dialog" aria-modal="true" aria-labelledby="nt-cards-h" ref={dialog} onKeyDown={onKey}>
        <div className="nt-cards-top">
          <h2 id="nt-cards-h">{t('notes.cardsTitle', { chapter: chapter.name })}</h2>
          <button type="button" className="nt-close" onClick={onClose} aria-label={t('notes.close')}>×</button>
        </div>
        <div className="nt-cards-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(i, points.length) / points.length})` }} />
        </div>
        {!finished ? (
          <>
            <p className="nt-sr" aria-live="polite">{t('notes.cardProgress', { n: i + 1, total: points.length })}</p>
            <button type="button" key={i} className={`nt-card${flipped ? ' is-flipped' : ''}`} data-testid="notes-card"
              aria-label={`${t('notes.flip')} — ${t('notes.cardProgress', { n: i + 1, total: points.length })}`}
              onClick={() => setFlipped(f => !f)}>
              <span className="nt-card-inner">
                <span className="nt-card-face nt-card-front" aria-hidden={flipped}>
                  <MathText text={card.front} />
                </span>
                <span className="nt-card-face nt-card-back" aria-hidden={!flipped}>
                  <MathText text={card.back} />
                </span>
              </span>
            </button>
            <p className="nt-quiet nt-cards-hint">{t('notes.flipHint')}</p>
            <div className="nt-cards-nav">
              <button type="button" className="btn btn-secondary" onClick={() => go(-1)} disabled={i === 0}>{t('notes.prev')}</button>
              <span className="nt-cards-count">{t('notes.cardProgress', { n: i + 1, total: points.length })}</span>
              <button type="button" className="btn btn-primary" onClick={() => go(1)} data-testid="notes-card-next">{t('notes.next')}</button>
            </div>
          </>
        ) : (
          <div className="nt-cards-done">
            <p>{t('notes.cardsDone')}</p>
            <button type="button" className="btn btn-secondary" onClick={() => { setI(0); setFlipped(false); }}>{t('notes.again')}</button>
            <button type="button" className="btn btn-primary" onClick={onClose}>{t('notes.close')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
