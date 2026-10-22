import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Atom, BookOpen, BrainCircuit, ChevronDown, CircleHelp, Command, Compass,
  FlaskConical, Home, Menu, Search, Sparkles } from 'lucide-react';
import { useAtlasNavigation } from '../lib/navigation.jsx';
import { demoData, SUBJECT_META } from '../lib/demoData.js';
import { SUBJECTS } from '../lib/contract.js';
import SearchOverlay from './SearchOverlay.jsx';

const ITEMS = [
  { id: 'command', label: 'Command', icon: Home, number: '01' },
  { id: 'atlas', label: 'Atlas', icon: Compass, number: '02' },
  { id: 'laboratory', label: 'Laboratory', icon: FlaskConical, number: '03' },
  { id: 'paper', label: 'Paper', icon: BookOpen, number: '04' },
  { id: 'insight', label: 'Insight', icon: BrainCircuit, number: '05' }
];

const inEditable = target => !!target?.closest?.('input,textarea,select,[contenteditable="true"],[data-ink-surface]');

export default function Shell({ children }) {
  const { context, destination, go } = useAtlasNavigation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [subjectMenu, setSubjectMenu] = useState(false);
  const meta = SUBJECT_META[context.subject];

  const dismissSearch = useCallback(() => setSearchOpen(false), []);
  useEffect(() => { setMobileMenu(false); setSubjectMenu(false); }, [destination, context.subject]);

  useEffect(() => {
    const handler = event => {
      const modK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey;
      if (modK) {
        if (inEditable(event.target) && !event.target.closest('.search-dialog')) return;
        event.preventDefault(); setSearchOpen(value => !value); return;
      }
      if (searchOpen || inEditable(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === '/') { event.preventDefault(); setSearchOpen(true); return; }
      if (/^[1-5]$/.test(event.key)) { event.preventDefault(); go(ITEMS[Number(event.key) - 1].id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, searchOpen]);

  const navigation = (kind = 'desktop') => ITEMS.map(({ id, label, icon: Icon, number }) => (
    <button type="button" className={'nav-link ' + (destination === id ? 'nav-link-active' : '')}
      aria-current={destination === id ? 'page' : undefined} onClick={() => go(id)}
      key={id} title={kind === 'tablet' ? label : undefined}>
      <Icon size={18} strokeWidth={1.65} aria-hidden="true" /><span>{label}</span><small>{number}</small>
    </button>
  ));

  return <div className={'atlas-app ' + meta.className}>
    <aside className="sidebar" aria-label="Primary navigation">
      <button type="button" className="brand" onClick={() => go('command')} aria-label="PRI ATLAS — return to Command">
        <span className="brand-symbol" aria-hidden="true"><span className="brand-p">P</span><span className="brand-star">✳</span></span>
        <span className="brand-word"><strong>PRI</strong><span>ATLAS</span></span>
      </button>
      <span className="sidebar-section-label">YOUR WORKSPACE</span>
      <nav className="side-nav" aria-label="Destinations">{navigation()}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><Sparkles size={15} aria-hidden="true" /><span>Designed for curiosity.</span></div>
        <div className="sidebar-bottom-line" />
        <div className="demo-avatar" aria-hidden="true">D</div>
        <span className="sidebar-person"><strong>{demoData.student.label}</strong><small>Preview workspace</small></span>
        <CircleHelp size={17} className="sidebar-help-icon" aria-hidden="true" />
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-left">
          <button className="menu-toggle icon-button" type="button" aria-label="Open navigation menu" aria-expanded={mobileMenu} onClick={() => setMobileMenu(value => !value)}><Menu size={20} /></button>
          <span className="topbar-path">WORKSPACE</span><span className="path-sep">/</span><span className="path-current">{destination.charAt(0).toUpperCase() + destination.slice(1)}</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="search-opener" onClick={() => setSearchOpen(true)}>
            <Search size={16} strokeWidth={1.8} aria-hidden="true" /><span>Search anything</span><kbd>⌘ K</kbd>
          </button>
          <div className="topbar-divider" />
          <div className="subject-picker">
            <button className="subject-toggle" type="button" aria-expanded={subjectMenu} aria-haspopup="true"
              onClick={() => setSubjectMenu(value => !value)}>
              <span className="subject-light" /><span>{meta.title}</span><ChevronDown size={14} aria-hidden="true" />
            </button>
            {subjectMenu && <div className="subject-options" aria-label="Choose subject">
              {SUBJECTS.map(subject => <button key={subject} type="button"
                aria-current={context.subject === subject ? 'true' : undefined}
                onClick={() => { go(destination, { subject, concept: null }); setSubjectMenu(false); }}>
                <span className={'small-subject-light subject-' + subject} />{SUBJECT_META[subject].title}
              </button>)}
            </div>}
          </div>
          <span className="topbar-avatar" title="Demo learner" aria-label="Demo learner">D</span>
        </div>
      </header>
      {mobileMenu && <nav className="mobile-menu-panel" aria-label="Mobile destinations">{navigation()}</nav>}
      <div className="demo-banner"><span className="banner-pulse" /> INTERACTIVE DESIGN PROTOTYPE <span className="banner-slash">/</span> ALL LEARNER DATA IS SYNTHETIC <span className="banner-desktop">— NOTHING HERE IS GRADED OR SAVED</span></div>
      <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Mobile destinations">{navigation('mobile')}</nav>
    <SearchOverlay open={searchOpen} onClose={dismissSearch} />
    <a className="skip-link" href="#main-content">Skip to content</a>
  </div>;
}
