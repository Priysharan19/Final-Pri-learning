import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

const TAGLINES = [
  'The rest is algebra.',
  'The proof is left as an exercise for you.',
  'This should simplify nicely.',
  'Assume nothing. Prove everything.',
  'Every mark is one dot point away.',
  'Integrate practice. Differentiate yourself.',
  'Q.E.D. before dinner.',
];

const DIFF_LABELS = { 1: 'Foundation', 2: 'Intermediate', 3: 'Advanced', 4: 'Extension' };

function loadSaved() {
  try { return JSON.parse(localStorage.getItem('pri-gen-filters')) || {}; } catch { return {}; }
}

const topicAvailable = topic => (topic?.dotpoints || []).some(dp => dp?.generated !== false);
const dotpointAvailable = dotpoint => !!dotpoint && dotpoint.generated !== false;

export default function Home() {
  const { user, dueCount } = useApp();
  const nav = useNavigate();
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

  useEffect(() => { api.get('/stats').then(setStats).catch(() => { }); }, []);
  useEffect(() => { api.get('/curriculum').then(setCurriculum).catch(() => { }); }, []);
  useEffect(() => {
    localStorage.setItem('pri-gen-filters', JSON.stringify({ year, sectionKey, subtopic, dotpoint, difficulty }));
  }, [year, sectionKey, subtopic, dotpoint, difficulty]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
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

  const byStrand = useMemo(() => {
    if (!section) return [];
    const m = new Map();
    for (const s of section.subtopics) {
      if (!m.has(s.strand)) m.set(s.strand, []);
      m.get(s.strand).push(s);
    }
    return [...m.entries()];
  }, [section]);

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
    (selSub && !topicAvailable(selSub)) ||
    (selectedDotpoint && !dotpointAvailable(selectedDotpoint))
  );

  // A saved filter can outlive a curriculum rationalisation. Do not keep a
  // stale target selected after a source update has made that exact outcome
  // unavailable in production.
  useEffect(() => {
    if (!selSub) return;
    if (!topicAvailable(selSub)) {
      setSubtopic(null);
      setDotpoint(null);
      return;
    }
    if (selectedDotpoint && !dotpointAvailable(selectedDotpoint)) setDotpoint(null);
  }, [selSub, selectedDotpoint]);

  const chips = [];
  if (year != null) chips.push({ k: 'year', label: `${curriculum?.country === 'in' ? 'Class' : 'Year'} ${year}`, clear: () => { setYear(user.year); setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (section) chips.push({ k: 'course', label: section.label, clear: () => { setSectionKey(null); setSubtopic(null); setDotpoint(null); } });
  if (selSub) chips.push({ k: 'topic', label: selSub.name, clear: () => { setSubtopic(null); setDotpoint(null); } });
  if (dotpoint != null && selSub) chips.push({ k: 'dp', label: `Dot point ${dotpoint + 1}`, clear: () => setDotpoint(null) });
  if (difficulty != null) chips.push({ k: 'diff', label: `D${difficulty} ${DIFF_LABELS[difficulty]}`, clear: () => setDifficulty(null) });

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
      <h1 className="home-greet">{greeting}, <b>{firstName}</b>.</h1>
      <Tagline />

      {/* ── The question generator ── */}
      <div className="genbar">
        <div className={`genbar-head ${open ? 'open' : ''}`}>
          <button className="genbar-toggle" onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Hide the question filters' : 'Show the question filters'}
            aria-expanded={open} aria-controls="gen-panel">{open ? '⌄' : '⌃'}</button>
          {chips.length === 0 ? (
            <button className="genbar-empty" onClick={() => setOpen(true)}>
              {open ? 'No filters applied' : 'Click to configure filters'}
            </button>
          ) : (
            <div className="genbar-chips">
              {chips.map(c => (
                <span className="chip" key={c.k}>{c.label}
                  <button className="chip-x" aria-label={`Remove the ${c.label} filter`}
                    onClick={e => { e.stopPropagation(); c.clear(); }}>✕</button>
                </span>
              ))}
            </div>
          )}
          {chips.length > 0 && (
            <button className="editor-tool" title="Clear all filters" aria-label="Clear all filters" onClick={resetAll}>↺</button>
          )}
          <button className="btn btn-primary" style={{ padding: '7px 18px' }} onClick={generate} disabled={impossibleTarget}>Generate</button>
        </div>

        {open && (
          <div className="gen-panel" id="gen-panel">
            <div className="gen-cats">
              {[
                ['year', curriculum?.country === 'in' ? 'Class' : 'Year'], ['course', curriculum?.country === 'in' ? 'Track' : 'Course'], ['topics', 'Topics'],
                ['dots', 'Dot Points'], ['difficulty', 'Difficulty'],
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
                  <div className="gen-pane-title">Select the {curriculum?.country === 'in' ? 'class' : 'year level'} to target</div>
                  <div className="gen-opts">
                    {[7, 8, 9, 10, 11, 12].map(y => (
                      <button key={y} className={`gen-opt ${year === y ? 'on' : ''}`}
                        onClick={() => { setYear(y); setSectionKey(null); setSubtopic(null); setDotpoint(null); setCat('course'); }}>
                        {curriculum?.country === 'in' ? 'Class' : 'Year'} {y}{y === user.year ? <small> · yours</small> : null}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {cat === 'course' && (
                <>
                  <div className="gen-pane-title">Now select the {curriculum?.country === 'in' ? 'India maths track' : 'maths course'}</div>
                  <div className="gen-opts">
                    {sections.map(s => (
                      <button key={s.key} className={`gen-opt ${sectionKey === s.key ? 'on' : ''}`}
                        onClick={() => { setSectionKey(s.key); setSubtopic(null); setDotpoint(null); setCat('topics'); }}>
                        {s.label}
                      </button>
                    ))}
                    {!sections.length && <div className="muted">Loading syllabus…</div>}
                  </div>
                </>
              )}

              {cat === 'topics' && section && (
                <>
                  <div className="gen-pane-note">(optional)</div>
                  <div className="gen-pane-title">Pick a topic for your question</div>
                  {byStrand.map(([strand, subs]) => (
                    <div key={strand} style={{ marginBottom: 14 }}>
                      <div className="gen-sub-head">{strand}</div>
                      <div className="gen-opts">
                        {subs.map(s => {
                          const available = topicAvailable(s);
                          return (
                            <button key={s.id} className={`gen-opt ${subtopic === s.id ? 'on' : ''}`} style={{ textAlign: 'left' }}
                              disabled={!available}
                              aria-label={available ? s.name : `${s.name}, coming soon`}
                              onClick={() => { if (!available) return; setSubtopic(subtopic === s.id ? null : s.id); setDotpoint(null); }}>
                              {s.name}{!available ? <small> · Coming soon</small> : null}
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
                  <div className="gen-pane-note">(optional)</div>
                  <div className="gen-pane-title">{selSub.name} — target a single syllabus dot point</div>
                  <div className="gen-opts narrow">
                    {selSub.dotpoints.map((dp, i) => {
                      const text = typeof dp === 'string' ? dp : dp.text;
                      const available = typeof dp === 'string' ? true : dotpointAvailable(dp);
                      return (
                        <button key={i} className={`gen-opt ${dotpoint === i ? 'on' : ''}`} style={{ textAlign: 'left' }}
                          disabled={!available}
                          aria-label={available ? text : `${text}, question forms coming soon`}
                          onClick={() => { if (available) setDotpoint(dotpoint === i ? null : i); }}>
                          {text}{!available ? <small> · Question forms coming soon</small> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {cat === 'difficulty' && (
                <>
                  <div className="gen-pane-note">(optional)</div>
                  <div className="gen-pane-title">Fix the difficulty — or leave it to the adaptive engine</div>
                  <div className="gen-opts">
                    {[1, 2, 3, 4].filter(d => !section?.difficultyCeiling || d <= section.difficultyCeiling).map(d => (
                      <button key={d} className={`gen-opt ${difficulty === d ? 'on' : ''}`}
                        onClick={() => setDifficulty(difficulty === d ? null : d)}>
                        D{d} · {DIFF_LABELS[d]}
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
            <span className="sc-label" style={{ margin: 0 }}>Questions completed</span>
            {stats && stats.recent?.some(a => a.correct) && <span className="sc-label" style={{ margin: 0, color: 'var(--good)' }}>Getting stronger</span>}
          </div>
          <DiamondTrack recent={stats?.recent || []} />
        </div>
        {!promoGone && (
          <div className="home-card">
            <button className="home-card-x" aria-label="Dismiss the adaptive engine card"
              onClick={() => { setPromoGone(true); localStorage.setItem('pri-home-promo', 'off'); }}>✕</button>
            <span className="sc-label" style={{ margin: 0 }}>Adaptive engine</span>
            <div className="spread" style={{ marginTop: 8, flexWrap: 'wrap', gap: 14 }}>
              <div style={{ fontSize: 21, lineHeight: 1.35, maxWidth: 300 }}>
                {dueCount > 0
                  ? <>You have <b>{dueCount} topic{dueCount === 1 ? '' : 's'}</b> due for spaced review.</>
                  : <>The full adaptive potential is on.</>}
              </div>
              <button className="btn btn-primary" onClick={() => nav('/practice')}>
                {dueCount > 0 ? 'Start reviewing' : 'Smart practice'} →
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

function sydneyDate(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function GoalCard({ user, activity, onGo }) {
  const done = user.today?.questions || 0;
  const goal = user.dailyGoal || 10;
  const frac = Math.min(1, done / goal);
  const R = 38, C = 2 * Math.PI * R;
  const byDate = Object.fromEntries(activity.map(d => [d.date, d]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const ms = Date.now() - (6 - i) * 86400000;
    const date = sydneyDate(ms);
    const row = byDate[date];
    return {
      date, lbl: new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'narrow' }).format(new Date(ms)),
      hit: (row?.questions || 0) > 0, today: i === 6
    };
  });
  return (
    <div className="home-card goal-card" style={{ maxWidth: 420 }}>
      <div className="goal-ring" role="img" aria-label={`Daily goal: ${done} of ${goal} questions`}>
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle className="goal-ring-track" cx="46" cy="46" r={R} fill="none" strokeWidth="7" />
          <circle className={`goal-ring-fill ${frac >= 1 ? 'done' : ''}`} cx="46" cy="46" r={R} fill="none" strokeWidth="7"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <div className="goal-ring-num">
          <div style={{ textAlign: 'center' }}>
            {done}<span style={{ color: 'var(--ink-3)', fontSize: 13 }}>/{goal}</span>
            <small>TODAY</small>
          </div>
        </div>
      </div>
      <div className="goal-copy">
        <div className="goal-title">
          {frac >= 1 ? <>Daily goal complete — nice work.</> :
            done > 0 ? <>{goal - done} more to hit today’s goal.</> : <>Daily goal: {goal} questions.</>}
        </div>
        <div className="goal-sub">
          {user.streak > 0
            ? <><span className="streak-flame">▲</span> {user.streak}-day streak{frac >= 1 ? ' — extended today' : ' on the line'}</>
            : 'Answer one question to start a streak.'}
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
            {done > 0 ? 'Keep going →' : 'Start now →'}
          </button>
        )}
      </div>
    </div>
  );
}

function DiamondTrack({ recent }) {
  const items = recent.slice(0, 7).reverse();
  if (!items.length) {
    return <div className="muted" style={{ marginTop: 20 }}>Your first questions will appear here.</div>;
  }
  const color = a => a.correct ? 'var(--m5)' : 'var(--m1)';
  // Right and wrong were a red diamond and a green one, and a tooltip: nothing
  // a screen reader or a colour-blind student could read. The verdict is spelled
  // out beside each mark, off-screen, and the joining bars are decoration.
  return (
    <div className="diamond-track" role="group" aria-label="Your most recent questions, oldest first">
      {items.map((a, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="diamond-link" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${color(items[i - 1])}, ${color(a)})` }} />}
          <span className="diamond" style={{ background: color(a) }} title={`${a.name} — ${a.correct ? 'correct' : 'incorrect'}`}>
            <span className="sr-only">{a.name} — {a.correct ? 'correct' : 'incorrect'}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}