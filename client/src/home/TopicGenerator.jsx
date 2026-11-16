// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the exact-topic generator: class, course or track, topic,
// dot point and difficulty, then Generate. It was the lower half of the v1.0
// Home page; the Index (the instrument build's home) offers the same control,
// so the chooser lives here once and both homes render it. Everything about
// what may be asked for — the levels a chapter really has, a dot point that is
// not yet available, a saved filter that outlived a syllabus update — is
// decided here from the curriculum the server returned, never guessed.
//
// Filters are saved under the class/track they were chosen in (homeCache.js),
// so the two homes also agree on what was last asked for.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSavedFilters, saveFilters } from './homeCache.js';
import Icon from '../components/Icon.jsx';
import TermGloss from '../components/TermGloss.jsx';
import { dotpointAvailable, practiceTargetAvailable, selectableDifficulties, topicAvailability } from '../engine/curriculumAvailability.js';
import { useT } from '../i18n/index.js';
import { textMatches, useGlossary } from '../i18n/glossary.js';
import { practiceDifficulties, practiceHref } from '../lib/practiceLinks.js';
import { studyHref } from '../lib/studyJourney.js';

const DIFF_KEYS = { 1: 'difficulty.1', 2: 'difficulty.2', 3: 'difficulty.3', 4: 'difficulty.4' };

export default function TopicGenerator({ user, curriculum }) {
  const nav = useNavigate();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('year');
  // Filters are saved under the class/track they were chosen in (homeCache.js).
  const filterOwner = useRef(user);
  const saved = useRef(loadSavedFilters(user));
  const [year, setYear] = useState(saved.current.year ?? user.year);
  const [sectionKey, setSectionKey] = useState(saved.current.sectionKey ?? null);
  const [subtopic, setSubtopic] = useState(saved.current.subtopic ?? null);
  const [dotpoint, setDotpoint] = useState(saved.current.dotpoint ?? null);
  const [difficulty, setDifficulty] = useState(saved.current.difficulty ?? null);
  // Typed into the topic filter. Kept out of the saved filter set on purpose:
  // it is how you find a topic, not part of what you asked for.
  const [topicQuery, setTopicQuery] = useState('');
  // The glossary is what lets the filter answer Hinglish. Loading it here means
  // a student with the bridge on can type "trikonmiti"; one without it still
  // gets a working English filter, because textMatches falls back to the label.
  useGlossary(user?.mathsGloss === true);

  useEffect(() => {
    saveFilters(filterOwner.current, { year, sectionKey, subtopic, dotpoint, difficulty });
  }, [year, sectionKey, subtopic, dotpoint, difficulty]);

  // ── sections available for the chosen year ──
  const sections = useMemo(() => {
    if (!curriculum) return [];
    const out = [];
    const core = curriculum.years.find(y => y.year === year);
    if (core) out.push({ key: core.key || `y${year}`, label: curriculum.country === 'in' ? 'CBSE / NCERT' : (year >= 11 ? 'Advanced' : 'Core'), ...core });
    for (const g of curriculum.streams || []) {
      if (g.year === year || g.allYears) out.push({ key: g.key, label: curriculum.country === 'in' ? (g.courseLabel || g.title) : g.title.replace(/^Mathematics\s*/, ''), ...g });
    }
    return out;
  }, [curriculum, year]);

  const section = useMemo(
    () => sections.find(s => s.key === sectionKey) || null,
    [sections, sectionKey]
  );
  // The difficulty buttons this context may offer: never D4 to a CBSE student
  // (CBSE practice is held to D1–D3), and never above the section's ceiling. A
  // remembered D4 from an earlier filter is dropped rather than sent.
  const trackDifficulties = practiceDifficulties({
    course: user.course, track: section?.track || (user.course === 'in' ? user.indiaTrack || 'cbse' : null),
    grade: section?.year ?? user.year, ceiling: section?.difficultyCeiling || null
  });

  // Indian students type Hindi words in Latin letters and English words in
  // half: "trikonmiti", "trig", "quadratic", "समुच्चय". The matcher folds all
  // four onto the same topic, so the box finds what was meant rather than what
  // was spelled. An empty query matches everything, which is the old behaviour.
  const byStrand = useMemo(() => {
    if (!section) return [];
    const m = new Map();
    for (const s of section.subtopics) {
      if (topicQuery.trim() && !textMatches(s.name, topicQuery) && !textMatches(s.strand || '', topicQuery)) continue;
      if (!m.has(s.strand)) m.set(s.strand, []);
      m.get(s.strand).push(s);
    }
    return [...m.entries()];
  }, [section, topicQuery]);

  // A topic is valid only inside the class and course the student selected.
  // Previously a saved topic could be resolved from another year/track even
  // when the active section had changed, silently practising the wrong syllabus.
  const selSub = useMemo(() => {
    if (!subtopic || !section) return null;
    return section.subtopics.find(s => s.id === subtopic) || null;
  }, [subtopic, section]);

  const selectedDotpoint = dotpoint != null ? selSub?.dotpoints?.[dotpoint] || null : null;
  // Only the levels a question really exists at for THIS chapter / dot point
  // are offered (issue #408): a dot point authored only at D3 does not show a
  // D4 button, so "Extension" can never be answered with an easier question.
  // The curriculum response names those levels per selection (`requestable`);
  // a level the track allows but this selection lacks is listed as unavailable.
  const offeredDifficulties = selectableDifficulties(trackDifficulties, selectedDotpoint || selSub);
  const missingDifficulties = trackDifficulties.filter(d => !offeredDifficulties.includes(d));
  const chosenDifficulty = difficulty != null && offeredDifficulties.includes(difficulty) ? difficulty : null;
  // Notes are published only when the existing reviewed chapter actually has
  // content. The grade bundle is loaded on demand; a syllabus listing alone
  // must never become an empty or invented "Study Notes" promise.
  const [studyContent, setStudyContent] = useState({ id: null, available: false });
  useEffect(() => {
    let live = true;
    setStudyContent({ id: null, available: false });
    if (!selSub?.id || !/^c(?:7|8|9|10|11|12)-/.test(selSub.id)) return () => { live = false; };
    void import('../notes/notesIndex.js').then(({ loadNotesForGrade }) => loadNotesForGrade(year))
      .then(notes => {
        if (live) setStudyContent({ id: selSub.id, available: !!notes?.[selSub.id]?.examples?.length });
      }).catch(() => { if (live) setStudyContent({ id: selSub.id, available: false }); });
    return () => { live = false; };
  }, [selSub?.id, year]);
  const studyAvailable = !!selSub && studyContent.id === selSub.id && studyContent.available;

  const impossibleTarget = Boolean(
    (subtopic && curriculum && !selSub) ||
    (selSub && !practiceTargetAvailable(selSub, dotpoint))
  );

  // A saved filter can outlive a curriculum rationalisation. Do not keep a
  // stale target selected after a source update has removed that chapter or made
  // that exact outcome unavailable in production.
  useEffect(() => {
    if (!curriculum) return;
    if (subtopic && !selSub) {
      setSubtopic(null);
      setDotpoint(null);
      return;
    }
    if (!selSub) return;
    if (!topicAvailability(selSub).selectable) {
      setSubtopic(null);
      setDotpoint(null);
      return;
    }
    if (selectedDotpoint && !dotpointAvailable(selectedDotpoint)) setDotpoint(null);
  }, [curriculum, subtopic, selSub, selectedDotpoint]);

  // The profile is already authoritative for region; do not flash the wrong
  // course's copy while the curriculum is still loading.
  const india = user.course === 'in';
  const chips = [];
  if (year != null) chips.push({ k: 'year', label: t(india ? 'common.classNumber' : 'common.yearNumber', { n: year }), clear: () => { setYear(user.year); setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (section) chips.push({ k: 'course', label: section.label, clear: () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (selSub) chips.push({ k: 'topic', label: selSub.name, clear: () => { setSubtopic(null); setDotpoint(null); } });
  if (dotpoint != null && selSub) chips.push({ k: 'dp', label: t('home.dotpointChip', { n: dotpoint + 1 }), clear: () => setDotpoint(null) });
  if (chosenDifficulty != null) chips.push({ k: 'diff', label: t('home.difficultyChip', { n: chosenDifficulty, label: t(DIFF_KEYS[chosenDifficulty]) }), clear: () => setDifficulty(null) });

  const learn = (view) => {
    if (!studyAvailable || !selSub || impossibleTarget) return;
    const href = studyHref({
      subtopic: selSub.id, dotpoint, difficulty: chosenDifficulty,
      track: section?.track || 'cbse', view
    });
    if (href) nav(href);
  };

  const generate = () => {
    if (impossibleTarget) return;
    nav(practiceHref({ subtopic, dotpoint, difficulty: chosenDifficulty, track: section?.track || null }));
  };

  const resetAll = () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); setDifficulty(null); setYear(user.year); };


  return (
    <>
      {/* Keep smart practice as the default, but make exact-topic practice
          discoverable without guessing that the class chip is clickable. */}
      <button type="button" className="btn btn-ghost btn-sm" data-testid="choose-topic"
        onClick={() => { setOpen(true); setCat(section ? 'topics' : 'course'); }}>
        <Icon name="classes" size={16} /> {t('home.pickTopic')}
      </button>

      <div className="genbar">
        <div className={`genbar-head ${open ? 'open' : ''}`}>
          <button className="genbar-toggle" onClick={() => setOpen(o => !o)}
            aria-label={open ? t('home.hideFilters') : t('home.showFilters')}
            aria-expanded={open} aria-controls="gen-panel"><Icon name="chevronDown" size={16} /></button>
          {chips.length === 0 ? (
            <button className="genbar-empty" onClick={() => setOpen(true)}>
              {open ? t('home.noFilters') : t('home.configureFilters')}
            </button>
          ) : (
            <div className="genbar-chips">
              {chips.map(c => (
                <span className="chip" key={c.k}>{c.label}
                  <button className="chip-x" aria-label={t('home.removeFilter', { filter: c.label })}
                    onClick={e => { e.stopPropagation(); c.clear(); }}><Icon name="close" size={12} /></button>
                </span>
              ))}
            </div>
          )}
          {chips.length > 0 && (
            <button className="icon-btn" title={t('home.clearFilters')} aria-label={t('home.clearFilters')} onClick={resetAll}><Icon name="review" size={16} /></button>
          )}
          <button className="btn btn-ghost" onClick={generate} disabled={impossibleTarget}>{t('home.generate')}</button>
        </div>
        {open && (
          <div className="gen-panel" id="gen-panel">
            <div className="gen-cats" role="tablist" aria-label={t('home.showFilters')}>
              {[
                ['year', t(india ? 'home.catClass' : 'home.catYear')], ['course', t(india ? 'home.catTrack' : 'home.catCourse')], ['topics', t('home.catTopics')],
                ['dots', t('home.catDots')], ['difficulty', t('home.catDifficulty')],
              ].map(([k, label]) => (
                <button
                  key={k}
                  className={`gen-cat ${cat === k ? 'on' : ''}`}
                role="tab" aria-selected={cat === k} aria-controls="gen-pane"
                  disabled={(k === 'topics' && !section) || (k === 'dots' && !selSub)}
                  onClick={() => setCat(k)}
                >
                  {label}
                  {((k === 'year') || (k === 'course' && section) || (k === 'topics' && selSub) || (k === 'dots' && dotpoint != null) || (k === 'difficulty' && chosenDifficulty != null)) && <span className="gen-cat-dot" />}
                </button>
              ))}
            </div>

            <div className="gen-pane" id="gen-pane" role="tabpanel"
              style={{ minWidth: 0, minHeight: 0, WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
              {cat === 'year' && (
                <>
                  <div className="gen-pane-title">{t(india ? 'home.pickClass' : 'home.pickYear')}</div>
                  <div className="gen-opts">
                    {[7, 8, 9, 10, 11, 12].map(y => (
                      <button key={y} className={`gen-opt ${year === y ? 'on' : ''}`} aria-pressed={year === y}
                        onClick={() => { setYear(y); setSectionKey(null); setSubtopic(null); setDotpoint(null); setCat('course'); }}>
                        {t(india ? 'common.classNumber' : 'common.yearNumber', { n: y })}{y === user.year ? <small>{t('home.yours')}</small> : null}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {cat === 'course' && (
                <>
                  <div className="gen-pane-title">{t(india ? 'home.pickTrack' : 'home.pickCourse')}</div>
                  <div className="gen-opts">
                    {sections.map(s => (
                      <button key={s.key} className={`gen-opt ${sectionKey === s.key ? 'on' : ''}`} aria-pressed={sectionKey === s.key}
                        onClick={() => { setSectionKey(s.key); setSubtopic(null); setDotpoint(null); setCat('topics'); }}>
                        {s.label}
                      </button>
                    ))}
                    {!sections.length && <div className="muted">{t('home.loadingSyllabus')}</div>}
                  </div>
                </>
              )}

              {cat === 'topics' && section && (
                <>
                  <div className="gen-pane-note">{t('home.optional')}</div>
                  <div className="gen-pane-title">{t('home.pickTopic')}</div>
                  <input className="input" type="search" value={topicQuery} style={{ marginBottom: 12 }}
                    placeholder={t('gloss.filterTopics')} aria-label={t('gloss.filterTopics')}
                    onChange={e => setTopicQuery(e.target.value)} />
                  {!byStrand.length && <div className="muted">{t('gloss.noTopicMatch', { query: topicQuery.trim() })}</div>}
                  {byStrand.map(([strand, subs]) => (
                    <div key={strand} style={{ marginBottom: 14 }}>
                      <div className="gen-sub-head"><TermGloss text={strand} /></div>
                      <div className="gen-opts">
                        {subs.map(s => {
                          const available = topicAvailability(s).selectable;
                          return (
                            <button key={s.id} className={`gen-opt ${subtopic === s.id ? 'on' : ''}`} aria-pressed={subtopic === s.id} style={{ textAlign: 'left' }}
                              disabled={!available}
                              aria-label={available ? s.name : t('home.topicComingSoon', { topic: s.name })}
                              onClick={() => { if (!available) return; setSubtopic(subtopic === s.id ? null : s.id); setDotpoint(null); }}>
                              <TermGloss text={s.name} />{!available ? <small>{t('home.comingSoon')}</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {cat === 'dots' && selSub && (
                <>
                  <div className="gen-pane-note">{t('home.optional')}</div>
                  <div className="gen-pane-title">{t('home.pickDotpoint', { topic: selSub.name })}</div>
                  <div className="gen-opts narrow">
                    {selSub.dotpoints.map((dp, i) => {
                      const text = typeof dp === 'string' ? dp : dp.text;
                      const available = dotpointAvailable(dp);
                      return (
                        <button key={i} className={`gen-opt ${dotpoint === i ? 'on' : ''}`} aria-pressed={dotpoint === i} style={{ textAlign: 'left' }}
                          disabled={!available}
                          aria-label={available ? text : t('home.dotpointComingSoon', { dotpoint: text })}
                          onClick={() => { if (available) setDotpoint(dotpoint === i ? null : i); }}>
                          {text}{!available ? <small>{t('home.formsComingSoon')}</small> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {cat === 'difficulty' && (
                <>
                  <div className="gen-pane-note">{t('home.optional')}</div>
                  <div className="gen-pane-title">{t('home.pickDifficulty')}</div>
                  <div className="gen-opts">
                    {offeredDifficulties.map(d => (
                      <button key={d} className={`gen-opt ${chosenDifficulty === d ? 'on' : ''}`} aria-pressed={chosenDifficulty === d}
                        onClick={() => setDifficulty(chosenDifficulty === d ? null : d)}>
                        {`D${d}`} · {t(DIFF_KEYS[d])}
                      </button>
                    ))}
                  </div>
                  {selSub && missingDifficulties.length > 0 && (
                    <p className="muted" data-difficulty-unavailable style={{ margin: '10px 0 0' }}>
                      {t(selectedDotpoint ? 'home.difficultyMissingDotpoint' : 'home.difficultyMissingTopic', {
                        levels: missingDifficulties.map(d => `D${d} · ${t(DIFF_KEYS[d])}`).join(', ')
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {selSub && !impossibleTarget && (
        <div className="home-study-choices" data-study-journey>
          <h3 className="gen-pane-title">{t('study.choosePath')}</h3>
          <p className="muted" data-study-context>
            {selSub.name}{selectedDotpoint ? ` · ${typeof selectedDotpoint === 'string' ? selectedDotpoint : selectedDotpoint.text}` : ''}
            {chosenDifficulty != null ? ` · D${chosenDifficulty}` : ''}
          </p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {studyAvailable && (
              <>
                <button className="btn btn-secondary" type="button" data-study-notes onClick={() => learn('notes')}>{t('study.notes')}</button>
                <button className="btn btn-secondary" type="button" data-study-examples onClick={() => learn('examples')}>{t('study.examples')}</button>
              </>
            )}
            <button className="btn btn-ghost" type="button" data-study-practice onClick={generate}>{t('study.practice')}</button>
          </div>
          {!studyAvailable && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('study.reviewPending')}</p>}
        </div>
      )}
    </>
  );
}
