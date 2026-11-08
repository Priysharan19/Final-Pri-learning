import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { isCurrentUrl } from '../platform/pageLink.js';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import CommandBar from './CommandBar.jsx';
import Glyph from './Glyph.jsx';
import { setBarSlot } from './BarSlot.jsx';

// The v1.1 shell bar: the mark, five tabs, the command field and the online
// state. It replaces the rail and the old top bar when the instrument flag is
// on; the account menu and theme control it is handed stay the app's own.

const TABS = [
  { to: '/', key: 'inst.tabIndex', match: p => p === '/' },
  { to: '/practice', key: 'nav.practice', match: p => p.startsWith('/practice') || p.startsWith('/practise') },
  { to: '/map', key: 'inst.tabMap', match: p => p.startsWith('/map') },
  { to: '/progress', key: 'inst.tabReport', match: p => p.startsWith('/progress') },
  { to: '/review', key: 'inst.tabScripts', match: p => p.startsWith('/review') || p.startsWith('/history') },
  { to: '/notes', key: 'nav.notes', match: p => p.startsWith('/notes') }
];
const pathOf = to => to.split(/[?#]/)[0];
const hashOf = to => (to.includes('#') ? to.slice(to.indexOf('#')) : '');
// A teacher's tabs are the workspace's own sections (App.jsx TEACHER_NAV): the
// Instrument is the only shell, so it carries the teacher's navigation too,
// rather than student tabs that would only redirect. The workspace is one page;
// a tab is current when its hash is (the bare /teach when there is none).
const teacherTabs = navItems => navItems.filter(item => pathOf(item.to) === '/teach').map(item => ({
  to: item.to, key: item.key,
  match: (p, h) => p === '/teach' && (hashOf(item.to) ? h === hashOf(item.to) : !h)
}));
const tabsFor = (user, navItems) => (user?.role === 'teacher' ? teacherTabs(navItems) : TABS);

const subscribeOnline = notify => {
  window.addEventListener('online', notify); window.addEventListener('offline', notify);
  return () => { window.removeEventListener('online', notify); window.removeEventListener('offline', notify); };
};

export default function InstrumentBar({ user, setUser, accountMenu, navItems }) {
  const t = useT();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpenState] = useState(false);
  const returnFocus = useRef(null);
  const openRef = useRef(false);
  openRef.current = open;
  // The opener is recorded before the field takes focus, so it can be handed
  // focus back when the bar closes.
  const setOpen = next => {
    const value = typeof next === 'function' ? next(openRef.current) : next;
    if (value && !openRef.current) returnFocus.current = document.activeElement;
    setOpenState(value);
  };
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const key = e => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'k' || e.isComposing) return;
      // Inside a field the student is typing or writing in, the chord belongs
      // to that field; the bar's own button stays the way in from there.
      const field = e.target?.closest?.('input, textarea, select, [contenteditable="true"], .ink-stage, [data-ink-surface]');
      // The bar's own fields (a page's search in the slot) pass it through.
      if (field && !field.closest('[data-instrument-command], .in-bar-slot')) return;
      e.preventDefault(); setOpen(o => !o);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const setTheme = async theme => {
    setUser({ ...user, theme });
    try { await api.patch('/me', { theme }); } catch { /* a display setting; the local copy stands */ }
  };
  const pages = useMemo(() => navItems.map(item => ({ to: item.to, label: t(item.key) })), [navItems, t]);
  const actions = useMemo(() => [
    { id: 'theme-dark', label: t('inst.cmdThemeDark'), run: () => setTheme('dark') },
    { id: 'theme-light', label: t('inst.cmdThemeLight'), run: () => setTheme('light') },
    { id: 'theme-system', label: t('inst.cmdThemeSystem'), run: () => setTheme('system') },
    { id: 'settings', label: t('nav.settings'), run: () => nav('/settings') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, user]);
  // Every destination the shell knows that is not a tab: Plan, Tasks, Exams,
  // the games and Settings. On a phone they are in the bottom bar's More sheet;
  // on an iPad or the web, where that sheet is not drawn, they were reachable
  // only through ⌘K search (audit-interface item 2). The More menu beside the
  // tabs is their visible entry there.
  const tabs = useMemo(() => tabsFor(user, navItems), [user, navItems]);
  const more = useMemo(() => navItems.filter(item => !tabs.some(tab => tab.to === item.to || (!hashOf(item.to) && !hashOf(tab.to) && pathOf(tab.to) === pathOf(item.to)))), [navItems, tabs]);

  return (
    <>
      <header className="in-bar no-print" data-instrument-bar>
        <button type="button" className="in-mark" onClick={() => nav('/', { replace: isCurrentUrl('/') })} aria-label={t('inst.home')}>
          <span className="in-mark-glyph" aria-hidden="true">P<em>′</em></span>Pri
        </button>
        <nav className="in-tabs" aria-label={t('nav.primary')}>
          {tabs.map(tab => (
            <PageLink key={tab.to} to={tab.to} className="in-tab" aria-current={tab.match(loc.pathname, loc.hash) ? 'page' : undefined}>{t(tab.key)}</PageLink>
          ))}
        </nav>
        {more.length > 0 && <MoreMenu items={more} />}
        <span className="in-spacer" />
        <div className="in-bar-slot" ref={setBarSlot} data-instrument-bar-slot />
        <button type="button" className="in-cmd" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t('inst.cmdOpenLabel')}>
          <Glyph name="search" /><span className="in-cmd-t">{t('inst.cmdPlaceholder')}</span><span className="in-kbd" aria-hidden="true">⌘K</span>
        </button>
        <span className={`in-status${online ? '' : ' is-off'}`} role="status"><i aria-hidden="true" /><span className="in-status-t">{online ? t('inst.online') : t('inst.offline')}</span></span>
        {accountMenu}
      </header>
      {/* Offline (audit-interface item 15, from #660 without its chronograph
          styling): one line saying what cannot happen — nothing is checked
          without a connection — and, on demand, what still works. Each item
          is served from this device: scripts and the solutions their receipts
          carried, the Report, and any notes chapter opened before. A native
          disclosure, so a keyboard and a screen reader get it for free. */}
      {!online && (
        <aside className="in-offline no-print" aria-labelledby="in-offline-h" data-offline-banner>
          <p className="in-offline-h" id="in-offline-h"><b>{t('inst.offlineTitle')}</b> {t('inst.offlineOneLine')}</p>
          <details className="in-offline-more">
            <summary>{t('inst.offlineStill')}</summary>
            <ul>
              <li>{t('inst.offlineItemHistory')}</li>
              <li>{t('inst.offlineItemProgress')}</li>
              <li>{t('inst.offlineItemNotes')}</li>
            </ul>
            <p className="in-offline-kept">{t('inst.offlineKept')}</p>
          </details>
        </aside>
      )}
      {/* Mounted only while open: every opening starts from an empty query. */}
      {open && <CommandBar open onClose={() => setOpen(false)} user={user} pages={pages} actions={actions} returnFocus={returnFocus} />}
    </>
  );
}

// The APG menu-button pattern, as the account menu already does it: opening
// moves focus into the menu, arrows move, Home/End jump, Escape returns focus
// to the button, Tab leaves, and a press outside closes it.
function MoreMenu({ items }) {
  const t = useT();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const itemRefs = useRef([]);
  const last = items.length - 1;

  useEffect(() => { setOpen(false); }, [loc.pathname, loc.search]);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  useEffect(() => { if (open) itemRefs.current[active]?.focus(); }, [open, active]);

  const openAt = i => { setActive(i); setOpen(true); };
  const shut = toButton => { setOpen(false); if (toButton) btnRef.current?.focus(); };
  const onButtonKey = e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openAt(last); }
    else if (e.key === 'Escape') shut(false);
  };
  const onMenuKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i >= last ? 0 : i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i <= 0 ? last : i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Escape') { e.preventDefault(); shut(true); }
    else if (e.key === 'Tab') setOpen(false);
  };
  const isHere = to => pathOf(to) === loc.pathname;

  return (
    <div className="in-more-wrap" ref={wrapRef} data-instrument-more>
      <button type="button" className="in-more" id="in-more-btn" ref={btnRef}
        aria-haspopup="menu" aria-expanded={open} aria-controls="in-more-menu"
        onClick={() => (open ? shut(false) : openAt(0))} onKeyDown={onButtonKey}>
        <Glyph name="more" />{t('nav.more')}
      </button>
      {open && (
        <div className="in-more-menu" id="in-more-menu" role="menu" aria-labelledby="in-more-btn" onKeyDown={onMenuKey}>
          {items.map((item, i) => (
            <button key={item.to} type="button" role="menuitem" className={`in-more-item${isHere(item.to) ? ' is-here' : ''}`}
              aria-current={isHere(item.to) ? 'page' : undefined}
              tabIndex={i === active ? 0 : -1} ref={el => { itemRefs.current[i] = el; }}
              onClick={() => { setOpen(false); nav(item.to); }}>
              <span className="nav-ico" aria-hidden="true">{item.ico}</span>{t(item.key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
