import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { dotpointAvailable, practiceTargetAvailable, topicAvailability } from '../engine/curriculumAvailability.js';
import { dayKey, formatWeekday } from '../lib/locale.js';
import { useT, useTx } from '../i18n/index.js';
import { textMatches, useGlossary } from '../i18n/glossary.js';
import TermGloss from '../components/TermGloss.jsx';

// Deliberately English in every language. These are jokes that live entirely
// in the English idiom of a maths classroom — "The proof is left as an exercise
// for you", "Integrate practice. Differentiate yourself." A translated pun is
// not the same joke, and a limp one on the home screen is worse than an English
// one a Hindi-medium student will read perfectly well. If they are ever
// rewritten for Hindi it should be as new jokes, not as translations of these.
const TAGLINES = [
  'The rest is algebra.',
  'The proof is left as an exercise for you.',
  'This should simplify nicely.',
  'Assume nothing. Prove everything.',
  'Every mark is one dot point away.',
  'Integrate practice. Differentiate yourself.',
  'Q.E.D. before dinner.',
];

const DIFF_KEYS = { 1: 'difficulty.1', 2: 'difficulty.2', 3: 'difficulty.3', 4: 'difficulty.4' };

function loadSaved() {
  try { return JSON.parse(localStorage.getItem('pri-gen-filters')) || {}; } catch { return {}; }
}

export default function Home() {
  const { user, dueCount } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  const [stats, setStats] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('year');
  const saved = useRef(loadSaved());
  const [year, setYear] = useState(saved.current.year ?? user.year);
  const [sectionKey, setSectionKey] = useState(saved.current.sectionKey ?? null);
  const [subtopic, setSubtopic] = useState(saved.current.subtopic ?? null);
  const [dotpoint, setDotpoint] = useState(saved.current.dotpoint ?? null);
  const [difficulty, setDifficulty] = useState(saved.current.difficulty ?? null);
  const [promoGone, setPromoGone] = useState(localStorage.getItem('pri-home-promo') === 'off');
  // Typed into the topic filter. Kept out of the saved filter set on purpose:
  // it is how you find a topic, not part of what you asked for.
  const [topicQuery, setTopicQuery] = useState('');
  // The glossary is what lets the filter answer Hinglish. Loading it here means
  // a student with the bridge on can type "trikonmiti"; one without it still
  // gets a working English filter, because textMatches falls back to the label.
  useGlossary(user?.mathsGloss === true);

  useEffect(() => { api.get('/stats').then(setStats).catch(() => { }); }, []);
  useEffect(() => { api.get('/curriculum').then(setCurriculum).catch(() => { }); }, []);
  useEffect(() => {
    localStorage.setItem('pri-gen-filters', JSON.stringify({ year, sectionKey, subtopic, dotpoint, difficulty }));
  }, [year, sectionKey, subtopic, dotpoint, difficulty]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.goodMorning') : hour < 18 ? t('home.goodAfternoon') : t('home.goodEvening');
  const firstName = user.name.split(' ')[0];

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

  const selSub = useMemo(() => {
    if (!subtopic || !curriculum) return null;
    for (const sec of [...(curriculum.years || []), ...(curriculum.streams || [])]) {
      const hit = sec.subtopics.find(s => s.id === subtopic);
      if (hit) return hit;
    }
    return null;
  }, [subtopic, curriculum]);

  const selectedDotpoint = dotpoint != null ? selSub?.dotpoints?.[dotpoint] || null : null;
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

  const india = curriculum?.country === 'in';
  const chips = [];
  if (year != null) chips.push({ k: 'year', label: t(india ? 'common.classNumber' : 'common.yearNumber', { n: year }), clear: () => { setYear(user.year); setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (section) chips.push({ k: 'course', label: section.label, clear: () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (selSub) chips.push({ k: 'topic', label: selSub.name, clear: () => { setSubtopic(null); setDotpoint(null); } });
  if (dotpoint != null && selSub) chips.push({ k: 'dp', label: t('home.dotpointChip', { n: dotpoint + 1 }), clear: () => setDotpoint(null) });
  if (difficulty != null) chips.push({ k: 'diff', label: t('home.difficultyChip', { n: difficulty, label: t(DIFF_KEYS[difficulty]) }), clear: () => setDifficulty(null) });

  const generate = () => {
    if (impossibleTarget) return;
    const p = new URLSearchParams();
    if (subtopic) p.set('subtopic', subtopic);
    if (subtopic && dotpoint != null) p.set('dotpoint', String(dotpoint));
    if (difficulty != null) p.set('difficulty', String(difficulty));
    if (section?.track) p.set('track', section.track);
    nav(`/practice${p.toString() ? `?${p}` : ''}`);
  };

  const resetAll = () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); setDifficulty(null); setYear(user.year); };

  return (
    <div className="home-wrap">
      <h1 className="home-greet">{tx('home.greeting', { greeting, name: <b>{firstName}</b> })}</h1>
      <Tagline />

      {/* ── The question generator ── */}
      <div className="genbar">
        <div className={`genbar-head ${open ? 'open' : ''}`}>
          <button className="genbar-toggle" onClick={() => setOpen(o => !o)}
            aria-label={open ? t('home.hideFilters') : t('home.showFilters')}
            aria-expanded={open} aria-controls="gen-panel">{open ? '⌄' : '⌃'}</button>
          {chips.length === 0 ? (
            <button className="genbar-empty" onClick={() => setOpen(true)}>
              {open ? t('home.noFilters') : t('home.configureFilters')}
            </button>
          ) : (
            <div className="genbar-chips">
              {chips.map(c => (
                <span className="chip" key={c.k}>{c.label}
                  <button className="chip-x" aria-label={t('home.removeFilter', { filter: c.label })}
                    onClick={e => { e.stopPropagation(); c.clear(); }}>✕</button>
                </span>
              ))}
            </div>
          )}
          {chips.length > 0 && (
            <button className="editor-tool" title={t('home.clearFilters')} aria-label={t('home.clearFilters')} onClick={resetAll}>↺</button>
          )}
          <button className="btn btn-primary" style={{ padding: '7px 18px' }} onClick={generate} disabled={impossibleTarget}>{t('home.generate')}</button>
        </div>

        {open && (
          <div className="gen-panel" id="gen-panel">
            <div className="gen-cats">
              {[
                ['year', t(india ? 'home.catClass' : 'home.catYear')], ['course', t(india ? 'home.catTrack' : 'home.catCourse')], ['topics', t('home.catTopics')],
                ['dots', t('home.catDots')], ['difficulty', t('home.catDifficulty')],
              ].map(([k, label]) => (
                <button
                  key={k}
                  className={`gen-cat ${cat === k ? 'on' : ''}`}
                  disabled={(k === 'topics' && !section) || (k === 'dots' && !selSub)}
                  onClick={() => setCat(k)}
                >
                  {label}
                  {((k === 'year') || (k === 'course' && section) || (k === 'topics' && selSub) || (k === 'dots' && dotpoint != null) || (k === 'difficulty' && difficulty != null)) && <span className="gen-cat-dot" />}
                </button>
              ))}
            </div>

            <div className="gen-pane">
              {cat === 'year' && (
                <>
                  <div className="gen-pane-title">{t(india ? 'home.pickClass' : 'home.pickYear')}</div>
                  <div className="gen-opts">
                    {[7, 8, 9, 10, 11, 12].map(y => (
                      <button key={y} className={`gen-opt ${year === y ? 'on' : ''}`}
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
                      <button key={s.key} className={`gen-opt ${sectionKey === s.key ? 'on' : ''}`}
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
                            <button key={s.id} className={`gen-opt ${subtopic === s.id ? 'on' : ''}`} style={{ textAlign: 'left' }}
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
                        <button key={i} className={`gen-opt ${dotpoint === i ? 'on' : ''}`} style={{ textAlign: 'left' }}
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
                    {[1, 2, 3, 4].filter(d => !section?.difficultyCeiling || d <= section.difficultyCeiling).map(d => (
                      <button key={d} className={`gen-opt ${difficulty === d ? 'on' : ''}`}
                        onClick={() => setDifficulty(difficulty === d ? null : d)}>
                        D{d} · {t(DIFF_KEYS[d])}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom cards ── */}
      <div className="home-cards">
        <GoalCard user={user} activity={stats?.activity || []} onGo={() => nav('/practice')} />
        <div className="home-card" style={{ maxWidth: 380 }}>
          <div className="spread">
            <span className="sc-label" style={{ margin: 0 }}>{t('home.questionsCompleted')}</span>
            {stats && stats.recent?.some(a => a.correct) && <span className="sc-label" style={{ margin: 0, color: 'var(--good)' }}>{t('home.gettingStronger')}</span>}
          </div>
          <DiamondTrack recent={stats?.recent || []} />
        </div>
        {!promoGone && (
          <div className="home-card">
            <button className="home-card-x" aria-label={t('home.dismissAdaptive')}
              onClick={() => { setPromoGone(true); localStorage.setItem('pri-home-promo', 'off'); }}>✕</button>
            <span className="sc-label" style={{ margin: 0 }}>{t('home.adaptiveEngine')}</span>
            <div className="spread" style={{ marginTop: 8, flexWrap: 'wrap', gap: 14 }}>
              <div style={{ fontSize: 21, lineHeight: 1.35, maxWidth: 300 }}>
                {dueCount > 0
                  ? tx('home.reviewDue', { count: dueCount, n: <b>{dueCount}</b> })
                  : t('home.adaptiveOn')}
              </div>
              <button className="btn btn-primary" onClick={() => nav('/practice')}>
                {dueCount > 0 ? t('home.startReviewing') : t('home.smartPractice')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tagline() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * TAGLINES.length));
  const [len, setLen] = useState(0);
  const [phase, setPhase] = useState('typing'); // typing | holding | deleting

  useEffect(() => {
    const text = TAGLINES[idx];
    let t;
    if (phase === 'typing') {
      if (len < text.length) t = setTimeout(() => setLen(l => l + 1), 34);
      else t = setTimeout(() => setPhase('holding'), 4200);
    } else if (phase === 'holding') {
      t = setTimeout(() => setPhase('deleting'), 2600);
    } else {
      if (len > 0) t = setTimeout(() => setLen(l => l - 1), 13);
      else { setIdx(i => (i + 1) % TAGLINES.length); setPhase('typing'); }
    }
    return () => clearTimeout(t);
  }, [phase, len, idx]);

  return (
    <div className="home-tagline">
      {TAGLINES[idx].slice(0, len)}
      <span className="type-caret" />
    </div>
  );
}

function GoalCard({ user, activity, onGo }) {
  const t = useT();
  const done = user.today?.questions || 0;
  const goal = user.dailyGoal || 10;
  const frac = Math.min(1, done / goal);
  const R = 38, C = 2 * Math.PI * R;
  const byDate = Object.fromEntries(activity.map(d => [d.date, d]));
  // The week is the student's week: each day is keyed and labelled in the
  // profile's own timezone, the same boundary the backend files activity under.
  const days = Array.from({ length: 7 }, (_, i) => {
    const ms = Date.now() - (6 - i) * 86400000;
    const date = dayKey(ms, user.timezone);
    const row = byDate[date];
    return {
      date, lbl: formatWeekday(ms, user),
      hit: (row?.questions || 0) > 0, today: i === 6
    };
  });
  return (
    <div className="home-card goal-card" style={{ maxWidth: 420 }}>
      <div className="goal-ring" role="img" aria-label={t('home.goalRing', { done, goal })}>
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle className="goal-ring-track" cx="46" cy="46" r={R} fill="none" strokeWidth="7" />
          <circle className={`goal-ring-fill ${frac >= 1 ? 'done' : ''}`} cx="46" cy="46" r={R} fill="none" strokeWidth="7"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <div className="goal-ring-num">
          <div style={{ textAlign: 'center' }}>
            {done}<span style={{ color: 'var(--ink-3)', fontSize: 13 }}>/{goal}</span>
            <small>{t('home.today')}</small>
          </div>
        </div>
      </div>
      <div className="goal-copy">
        <div className="goal-title">
          {frac >= 1 ? t('home.goalComplete')
            : done > 0 ? t('home.goalRemaining', { count: goal - done, n: goal - done })
              : t('home.goalTarget', { count: goal, n: goal })}
        </div>
        <div className="goal-sub">
          {user.streak > 0
            ? <><span className="streak-flame">▲</span> {t(frac >= 1 ? 'home.streakExtended' : 'home.streakOnTheLine', { count: user.streak, n: user.streak })}</>
            : t('home.startStreak')}
        </div>
        <div className="week-strip" aria-hidden="true">
          {days.map(d => (
            <div key={d.date} className="week-day">
              <div className={`week-dot ${d.hit ? 'hit' : ''} ${d.today ? 'today' : ''}`}>{d.hit ? '✓' : ''}</div>
              <div className="week-lbl">{d.lbl}</div>
            </div>
          ))}
        </div>
        {frac < 1 && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onGo}>
            {done > 0 ? t('home.keepGoing') : t('home.startNow')}
          </button>
        )}
      </div>
    </div>
  );
}

function DiamondTrack({ recent }) {
  const t = useT();
  const items = recent.slice(0, 7).reverse();
  if (!items.length) {
    return <div className="muted" style={{ marginTop: 20 }}>{t('home.firstQuestions')}</div>;
  }
  const color = a => a.correct ? 'var(--m5)' : 'var(--m1)';
  // Right and wrong were a red diamond and a green one, and a tooltip: nothing
  // a screen reader or a colour-blind student could read. The verdict is spelled
  // out beside each mark, off-screen, and the joining bars are decoration.
  return (
    <div className="diamond-track" role="group" aria-label={t('home.recentQuestions')}>
      {items.map((a, i) => {
        const verdict = t('home.recentVerdict', { topic: a.name, verdict: t(a.correct ? 'app.correct' : 'app.incorrect') });
        return (
        <React.Fragment key={i}>
          {i > 0 && <span className="diamond-link" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${color(items[i - 1])}, ${color(a)})` }} />}
          <span className="diamond" style={{ background: color(a) }} title={verdict}>
            <span className="sr-only">{verdict}</span>
          </span>
        </React.Fragment>
        );
      })}
    </div>
  );
}