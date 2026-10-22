import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Command, CornerDownLeft, Search, X } from 'lucide-react';
import { demoData, SUBJECT_META } from '../lib/demoData.js';
import { useAtlasNavigation } from '../lib/navigation.jsx';
import { DESTINATIONS } from '../lib/contract.js';

const LABELS = { command: 'Command', atlas: 'Atlas', laboratory: 'Laboratory', paper: 'Paper', insight: 'Insight' };

export default function SearchOverlay({ open, onClose }) {
  const { go } = useAtlasNavigation();
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pages = DESTINATIONS.map(destination => ({
      id: 'page-' + destination,
      title: LABELS[destination],
      subtitle: 'Destination',
      destination
    }));
    const concepts = demoData.concepts.map(item => ({
      id: item.id, title: item.title, subtitle: SUBJECT_META[item.subject].title + ' · Concept',
      destination: 'atlas', subject: item.subject, concept: item.id
    }));
    return [...pages, ...concepts].filter(item =>
      !term || (item.title + ' ' + item.subtitle).toLowerCase().includes(term)
    ).slice(0, 9);
  }, [query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled])');
        if (!focusables?.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const choose = item => {
    if (!item) return;
    onClose();
    go(item.destination, item.concept ? { subject: item.subject, concept: item.concept } : {});
  };

  const onSearchKey = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(n => (n + 1) % Math.max(results.length, 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(n => (n - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1)); }
    if (event.key === 'Enter') { event.preventDefault(); choose(results[active]); }
  };

  return <div className="search-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-heading" ref={dialogRef}>
      <div className="search-head">
        <Search size={20} aria-hidden="true" />
        <h2 id="search-heading" className="sr-only">Search destinations and concepts</h2>
        <input ref={inputRef} aria-label="Search concepts and destinations" placeholder="Find anything in your learning space…" value={query}
          onKeyDown={onSearchKey} onChange={event => setQuery(event.target.value)} autoComplete="off" />
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close search"><X size={18} /></button>
      </div>
      <div className="search-group-label">JUMP TO <span>{results.length} RESULT{results.length === 1 ? '' : 'S'}</span></div>
      <div className="search-results" role="listbox" aria-label="Search results" id="search-results">
        {results.length ? results.map((item, index) =>
          <button type="button" className={'search-result ' + (active === index ? 'search-result-active' : '')} role="option" aria-selected={active === index}
            key={item.id} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>
            <span className="search-result-icon">{item.concept ? '◌' : '↗'}</span>
            <span className="search-result-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
            {active === index && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        ) : <p className="search-empty">No matching concepts in the synthetic catalogue.</p>}
      </div>
      <div className="search-foot"><span><CornerDownLeft size={13} /> Select</span><span><Command size={13} /> K to open</span><span>ESC to close</span><strong>PRI ATLAS / DEMO</strong></div>
    </div>
  </div>;
}
