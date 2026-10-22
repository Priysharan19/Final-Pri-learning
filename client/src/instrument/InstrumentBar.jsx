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

  return (
    <>
      <header className="in-bar no-print" data-instrument-bar>
        <button type="button" className="in-mark" onClick={() => nav('/', { replace: isCurrentUrl('/') })} aria-label={t('inst.home')}>
          <span className="in-mark-glyph" aria-hidden="true">P<em>′</em></span>Pri
        </button>
        <nav className="in-tabs" aria-label={t('nav.primary')}>
          {TABS.map(tab => (
            <PageLink key={tab.to} to={tab.to} className="in-tab" aria-current={tab.match(loc.pathname) ? 'page' : undefined}>{t(tab.key)}</PageLink>
          ))}
        </nav>
        <span className="in-spacer" />
        <div className="in-bar-slot" ref={setBarSlot} data-instrument-bar-slot />
        <button type="button" className="in-cmd" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t('inst.cmdOpenLabel')}>
          <Glyph name="search" /><span className="in-cmd-t">{t('inst.cmdPlaceholder')}</span><span className="in-kbd" aria-hidden="true">⌘K</span>
        </button>
        <span className={`in-status${online ? '' : ' is-off'}`} role="status"><i aria-hidden="true" /><span className="in-status-t">{online ? t('inst.online') : t('inst.offline')}</span></span>
        {accountMenu}
      </header>
      {/* Mounted only while open: every opening starts from an empty query. */}
      {open && <CommandBar open onClose={() => setOpen(false)} user={user} pages={pages} actions={actions} returnFocus={returnFocus} />}
    </>
  );
}
