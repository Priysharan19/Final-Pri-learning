import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { colourFor, practiceTrack, scopeFor } from './chapters.js';

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
  const input = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQ(''); setSel(0);
    const id = requestAnimationFrame(() => input.current?.focus());
    let live = true;
    api.get('/curriculum').then(c => {
      if (!live) return;
      const scope = scopeFor(c, user);
      setChapters((scope?.chapters || scope?.subtopics || []).map((row, i) => ({ row, colour: colourFor(i) })));
    }).catch(() => { });
    // Focus goes back to whatever opened the bar (recorded by the opener,
    // since the field has already taken focus by the time this runs).
    return () => { live = false; cancelAnimationFrame(id); returnFocus?.current?.focus?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.year, user?.indiaTrack, user?.country, user?.course]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = s => !needle || String(s).toLowerCase().includes(needle);
    const track = practiceTrack(user);
    const groups = [
      { key: 'chapters', label: t('inst.cmdChapters'), rows: chapters.filter(c => match(c.row.name)).slice(0, 6).map(c => ({
        id: `ch-${c.row.id}`, label: c.row.name, hint: t('inst.cmdPractise'), colour: c.colour,
        run: () => nav(practiceHref({ subtopic: c.row.id, track }))
      })) },
      { key: 'pages', label: t('inst.cmdPages'), rows: pages.filter(p => match(p.label)).map(p => ({ id: `pg-${p.to}`, label: p.label, run: () => nav(p.to) })) },
      { key: 'actions', label: t('inst.cmdActions'), rows: actions.filter(a => match(a.label)).map(a => ({ id: `ac-${a.id}`, label: a.label, run: a.run })) }
    ];
    return groups.filter(g => g.rows.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, chapters, pages, actions, nav, t, user?.indiaTrack, user?.country, user?.course]);

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
                    {row.colour && <i className="in-pal-swatch" aria-hidden="true" />}
                    <b lang={row.colour ? 'en' : undefined}>{row.label}</b>
                    {row.hint && <small>{row.hint}</small>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="in-pal-foot" aria-hidden="true"><span>↑ ↓ {t('inst.cmdMove')}</span><span>↵ {t('inst.cmdOpen')}</span><span>esc {t('inst.cmdClose')}</span></div>
      </div>
    </div>
  );
}
