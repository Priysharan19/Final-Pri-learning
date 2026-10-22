import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { colourFor, practiceTrack, scopeFor } from './chapters.js';
import { MathText } from '../lib/latex.jsx';
import Glyph from './Glyph.jsx';

const dayOf = at => { const d = new Date(at); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat(document.documentElement.lang || undefined, { day: 'numeric', month: 'short' }).format(d) : ''; };
const PAGE_GLYPH = { '/': 'index', '/practice': 'pen', '/map': 'map', '/progress': 'chart', '/review': 'doc', '/history': 'doc' };

// ⌘K / Ctrl+K anywhere, or the field in the bar: one list for chapters (in
// their colours), pages and actions. Keyboard: ↑ ↓ move, ↵ opens, esc closes;
// focus returns to whatever opened it. A modal dialog, so the page behind is
// inert to assistive tech while it is open.

// The last lists, kept for the next opening, so the sheet draws complete on
// its first frame. They are filled from the Index's own /curriculum read
// (noteCurriculum) or an idle prewarm, and refreshed only once they are older
// than STALE_MS: opening the sheet does not refetch warm lists.
const STALE_MS = 5 * 60 * 1000;
const memo = { key: '', chapters: [], at: 0, scriptsKey: '', scripts: [], scriptsAt: 0 };
const sameIds = (a, b) => a.length === b.length && a.every((x, i) => (x.row?.id ?? x.id) === (b[i].row?.id ?? b[i].id));
const fresh = at => Date.now() - at < STALE_MS;

const scopeKeyOf = user => `${user?.id}|${user?.year}|${user?.indiaTrack}|${user?.country}|${user?.course}`;
const chapterRows = (c, user) => { const scope = scopeFor(c, user); return (scope?.chapters || scope?.subtopics || []).map((row, i) => ({ row, index: i, colour: colourFor(i) })); };

/** The Index hands over the /curriculum it already read. */
export function noteCurriculum(curriculum, user) {
  if (!curriculum || !user) return;
  memo.key = scopeKeyOf(user); memo.chapters = chapterRows(curriculum, user); memo.at = Date.now();
}

// One request in flight per list: the prewarm, an opening and the Index share it.
const pending = {};
const once = (key, run) => (pending[key] ||= run().finally(() => { delete pending[key]; }));
const loadChapters = user => once(`c:${scopeKeyOf(user)}`, () => api.get('/curriculum').then(c => { noteCurriculum(c, user); return memo.chapters; }));
const loadScripts = user => once(`s:${user?.id}`, () => api.post('/history/list', { page: 0, pageSize: 5 }).then(r => {
  memo.scriptsKey = String(user?.id); memo.scripts = r?.items || []; memo.scriptsAt = Date.now(); return memo.scripts;
}));

/** Fill whatever is missing or stale, in idle time (the shell decides when). */
export function prewarmCommandBar(user) {
  if (!user) return;
  if (!(memo.key === scopeKeyOf(user) && fresh(memo.at))) loadChapters(user).catch(() => { });
  if (!(memo.scriptsKey === String(user.id) && fresh(memo.scriptsAt))) loadScripts(user).catch(() => { });
}

export default function CommandBar({ open, onClose, user, pages, actions, returnFocus }) {
  const t = useT();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const scopeKey = scopeKeyOf(user);
  const warm = memo.key === scopeKey;
  const warmScripts = memo.scriptsKey === String(user?.id);
  const [chapters, setChapters] = useState(() => (warm ? memo.chapters : []));
  const [scripts, setScripts] = useState(() => (warmScripts ? memo.scripts : []));
  const [loaded, setLoaded] = useState(warm);
  const input = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQ(''); setSel(0);
    const id = requestAnimationFrame(() => input.current?.focus());
    let live = true;
    if (!(memo.key === scopeKey && fresh(memo.at))) {
      loadChapters(user).then(next => { if (live) { setChapters(prev => (prev.length && sameIds(prev, next) ? prev : next)); setLoaded(true); } })
        .catch(() => { if (live) setLoaded(true); });
    }
    // A cold or stale list is fetched after the 140ms arrival, so its render
    // never lands mid-animation.
    let later = 0;
    if (!(memo.scriptsKey === String(user?.id) && fresh(memo.scriptsAt))) {
      later = setTimeout(() => loadScripts(user).then(next => { if (live) setScripts(prev => (prev.length && sameIds(prev, next) ? prev : next)); }).catch(() => { }), 160);
    }
    // Focus goes back to whatever opened the bar (recorded by the opener,
    // since the field has already taken focus by the time this runs).
    return () => { live = false; clearTimeout(later); cancelAnimationFrame(id); returnFocus?.current?.focus?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.year, user?.indiaTrack, user?.country, user?.course]);

  const items = useMemo(() => {
    // A leading > narrows the bar to commands (actions) only.
    const commands = q.trimStart().startsWith('>');
    const needle = (commands ? q.trimStart().slice(1) : q).trim().toLowerCase();
    const match = s => !needle || String(s).toLowerCase().includes(needle);
    const track = practiceTrack(user);
    const groups = [
      { key: 'chapters', label: t('inst.cmdChapters'), rows: chapters.filter(c => match(c.row.name)).slice(0, 6).map(c => ({
        id: `ch-${c.row.id}`, label: c.row.name, hint: t('inst.cmdPractise'), colour: c.colour, num: String(c.index + 1).padStart(2, '0'),
        run: () => nav(practiceHref({ subtopic: c.row.id, track }))
      })) },
      { key: 'scripts', label: t('inst.cmdScripts'), rows: scripts.filter(s => match(`${s.subtopicName} ${s.prompt}`)).slice(0, 4).map(s => ({
        // What tells two scripts apart: the chapter, the day, the certified mark.
        id: `sc-${s.id}`, label: s.subtopicName || '', glyph: 'doc', meta: dayOf(s.answeredAt),
        hint: Number.isInteger(s.marksPossible) && !s.repeat ? `${s.marksEarned}/${s.marksPossible}` : '', content: true,
        run: () => nav('/review')
      })) },
      { key: 'pages', label: t('inst.cmdPages'), rows: pages.filter(p => match(p.label)).map(p => ({ id: `pg-${p.to}`, label: p.label, glyph: PAGE_GLYPH[p.to] || 'doc', run: () => nav(p.to) })) },
      { key: 'actions', label: t('inst.cmdActions'), rows: actions.filter(a => match(a.label)).map(a => ({ id: `ac-${a.id}`, label: a.label, glyph: 'gear', run: a.run })) }
    ];
    return groups.filter(g => g.rows.length && (!commands || g.key === 'actions'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, chapters, scripts, pages, actions, nav, t, user?.indiaTrack, user?.country, user?.course]);

  const flat = items.flatMap(g => g.rows);
  useEffect(() => { setSel(s => Math.min(s, Math.max(0, flat.length - 1))); }, [flat.length]);

  if (!open) return null;

  const choose = row => { onClose(); row.run(); };
  const onKey = e => {
    if (e.key === 'Tab') { e.preventDefault(); input.current?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); choose(flat[sel]); }
  };

  let index = -1;
  return (
    <div className="in-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} data-instrument-command>
      <div className="in-pal" role="dialog" aria-modal="true" aria-label={t('inst.cmdLabel')} onKeyDown={onKey}>
        <div className="in-pal-q">
          <Glyph name="search" size={20} />
          {/* autoFocus: keys typed the moment the bar opens land in the field. */}
          <input ref={input} autoFocus value={q} onChange={e => { setQ(e.target.value); setSel(0); }}
            placeholder={t('inst.cmdShort')} aria-label={t('inst.cmdPlaceholder')}
            role="combobox" aria-expanded="true" aria-controls="in-pal-list"
            aria-activedescendant={flat[sel] ? `in-pal-${flat[sel].id}` : undefined} />
          <span className="in-kbd">esc</span>
        </div>
        <div className="in-pal-list" id="in-pal-list" role="listbox" aria-label={t('inst.cmdLabel')}>
          {!loaded && !q && <div className="in-pal-empty k-wait" role="status">{t('inst.cmdLoading')}</div>}
          {!flat.length && <div className="in-pal-empty">{t('inst.cmdNone', { q })}</div>}
          {items.map(g => (
            <div key={g.key} role="group" aria-label={g.label}>
              <p className="in-pal-group" aria-hidden="true">{g.label}</p>
              {g.rows.map(row => {
                index += 1; const mine = index;
                return (
                  <button key={row.id} id={`in-pal-${row.id}`} type="button" role="option" aria-selected={sel === mine}
                    className="in-pal-item" tabIndex={-1} onMouseMove={() => setSel(mine)} onClick={() => choose(row)}
                    >
                    {row.num ? <span className="in-pal-num" aria-hidden="true">{row.num}</span> : row.glyph && <Glyph name={row.glyph} />}
                    <b lang={row.colour || row.content ? 'en' : undefined} className={row.math ? 'is-math' : undefined}>{row.math ? <MathText text={row.label} /> : row.label}</b>
                    {row.meta && <span className="in-pal-meta">· {row.meta}</span>}
                    <span className="in-pal-r">{row.hint && <small>{row.hint}</small>}<span className="in-kbd" aria-hidden="true">↵</span></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="in-pal-foot" aria-hidden="true">
          <span><span className="in-kbd">↑</span><span className="in-kbd">↓</span>{t('inst.cmdMove')}</span>
          <span><span className="in-kbd">↵</span>{t('inst.cmdOpen')}</span>
          <span><span className="in-kbd">esc</span>{t('inst.cmdClose')}</span>
          <span>{t('inst.cmdPrefixHint')}</span>
        </div>
      </div>
    </div>
  );
}
