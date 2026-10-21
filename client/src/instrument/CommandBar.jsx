import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { colourFor, practiceTrack, scopeFor } from './chapters.js';
import { MathText } from '../lib/latex.jsx';
import Glyph from './Glyph.jsx';

const PAGE_GLYPH = { '/': 'index', '/practice': 'pen', '/map': 'map', '/progress': 'chart', '/review': 'doc', '/history': 'doc' };

// ⌘K / Ctrl+K anywhere, or the field in the bar: one list for chapters (in
// their colours), pages and actions. Keyboard: ↑ ↓ move, ↵ opens, esc closes;
// focus returns to whatever opened it. A modal dialog, so the page behind is
// inert to assistive tech while it is open.

export default function CommandBar({ open, onClose, user, pages, actions, returnFocus }) {
  const t = useT();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [chapters, setChapters] = useState([]);
  const [scripts, setScripts] = useState([]);
  const input = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQ(''); setSel(0);
    const id = requestAnimationFrame(() => input.current?.focus());
    let live = true;
    api.get('/curriculum').then(c => {
      if (!live) return;
      const scope = scopeFor(c, user);
      setChapters((scope?.chapters || scope?.subtopics || []).map((row, i) => ({ row, index: i, colour: colourFor(i) })));
    }).catch(() => { });
    api.post('/history/list', { page: 0, pageSize: 5 }).then(r => { if (live) setScripts(r?.items || []); }).catch(() => { });
    // Focus goes back to whatever opened the bar (recorded by the opener,
    // since the field has already taken focus by the time this runs).
    return () => { live = false; cancelAnimationFrame(id); returnFocus?.current?.focus?.(); };
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
        id: `ch-${c.row.id}`, label: c.row.name, hint: t('inst.cmdPractise'), colour: c.colour, meta: t('inst.chapterN', { n: c.index + 1 }),
        run: () => nav(practiceHref({ subtopic: c.row.id, track }))
      })) },
      { key: 'scripts', label: t('inst.cmdScripts'), rows: scripts.filter(s => match(`${s.subtopicName} ${s.prompt}`)).slice(0, 4).map(s => ({
        id: `sc-${s.id}`, label: String(s.prompt || '').replace(/\s+/g, ' ').trim() || s.subtopicName, math: !!s.prompt, glyph: 'doc',
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
            placeholder={t('inst.cmdPlaceholder')} aria-label={t('inst.cmdPlaceholder')}
            role="combobox" aria-expanded="true" aria-controls="in-pal-list"
            aria-activedescendant={flat[sel] ? `in-pal-${flat[sel].id}` : undefined} />
          <span className="in-kbd">esc</span>
        </div>
        <div className="in-pal-list" id="in-pal-list" role="listbox" aria-label={t('inst.cmdLabel')}>
          {!flat.length && <div className="in-pal-empty">{t('inst.cmdNone', { q })}</div>}
          {items.map(g => (
            <div key={g.key} role="group" aria-label={g.label}>
              <p className="in-pal-group" aria-hidden="true">{g.label}</p>
              {g.rows.map(row => {
                index += 1; const mine = index;
                return (
                  <button key={row.id} id={`in-pal-${row.id}`} type="button" role="option" aria-selected={sel === mine}
                    className="in-pal-item" tabIndex={-1} onMouseMove={() => setSel(mine)} onClick={() => choose(row)}
                    style={row.colour ? { '--cc': `var(${row.colour})` } : undefined}>
                    {row.colour ? <i className="in-pal-swatch" aria-hidden="true" /> : row.glyph && <Glyph name={row.glyph} />}
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
