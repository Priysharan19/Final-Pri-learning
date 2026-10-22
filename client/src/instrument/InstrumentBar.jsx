import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { isCurrentUrl } from '../platform/pageLink.js';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import CommandBar, { prewarmCommandBar } from './CommandBar.jsx';
import Glyph from './Glyph.jsx';
import { setBarSlot } from './BarSlot.jsx';
import MarginIcon from './margin/MarginIcon.jsx';
import { startLight } from './margin/light.js';
import { optionalWarmAllowed, studentBusy } from '../local/offlineWarm.js';
import './margin/shell.css';

// The v1.1 shell bar: the mark, five tabs, the command field and the online
// state. It replaces the rail and the old top bar when the instrument flag is
// on; the account menu and theme control it is handed stay the app's own.

const TABS = [
  { to: '/', key: 'inst.tabIndex', icon: 'index', match: p => p === '/' },
  { to: '/practice', key: 'nav.practice', icon: 'pen', match: p => p.startsWith('/practice') || p.startsWith('/practise') },
  { to: '/map', key: 'inst.tabMap', icon: 'map', match: p => p.startsWith('/map') },
  { to: '/progress', key: 'inst.tabReport', icon: 'report', match: p => p.startsWith('/progress') },
  { to: '/review', key: 'inst.tabScripts', icon: 'scripts', match: p => p.startsWith('/review') || p.startsWith('/history') },
  { to: '/notes', key: 'nav.notes', match: p => p.startsWith('/notes') }
];

// The chord the hint shows: ⌘K on Apple platforms, Ctrl K elsewhere (the
// handler below accepts either key on every platform).
const APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '');
const CHORD = APPLE ? '⌘K' : 'Ctrl K';

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
  // A's one key light for the rim highlights, once for the whole shell.
  useEffect(() => startLight(), []);
  // The command sheet's lists, fetched in idle time so it opens complete; the
  // same rules as the offline warm: never offline, on Save-Data or a slow or
  // unknown link, and never while the student is writing or a Check runs (or
  // anywhere in Practice), where it waits for a later idle, a few times.
  useEffect(() => {
    if (navigator.onLine === false || !optionalWarmAllowed(window)) return undefined;
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
    const cancel = window.cancelIdleCallback || clearTimeout;
    let id = 0; let wait = 0;
    const attempt = left => {
      id = idle(() => {
        if (studentBusy(window) || /^\/practi[cs]e/.test(window.location.pathname)) {
          if (left > 1) wait = setTimeout(() => attempt(left - 1), 3000);
          return;
        }
        prewarmCommandBar(user);
      }, { timeout: 4000 });
    };
    attempt(5);
    return () => { cancel(id); clearTimeout(wait); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.year, user?.indiaTrack, user?.country, user?.course]);

  // The active tab's rule slides under it on the Quick spring: measured, then
  // moved by transform alone (translateX and a scaleX of a 100px rule).
  const tabsRef = useRef(null);
  const indRef = useRef(null);
  useLayoutEffect(() => {
    const place = (still = false) => {
      const ind = indRef.current; const on = tabsRef.current?.querySelector('[aria-current="page"]');
      if (!ind) return;
      if (!on || !on.offsetWidth) { ind.classList.remove('is-on'); return; }
      const first = still || !ind.classList.contains('is-on');
      if (first) ind.style.transition = 'none';
      ind.style.transform = `translateX(${on.offsetLeft}px) scaleX(${on.offsetWidth / 100})`;
      ind.classList.add('is-on');
      if (first) { void ind.offsetWidth; ind.style.transition = ''; }
    };
    place();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => place(true)) : null;
    if (ro && tabsRef.current) ro.observe(tabsRef.current);
    document.fonts?.ready?.then(() => place(true));
    return () => ro?.disconnect();
  }, [loc.pathname, t]);

  useEffect(() => {
    const key = e => {
      // ⌘K on Apple platforms (Ctrl-K stays the text fields' kill-line there), Ctrl K elsewhere.
      if (!(APPLE ? e.metaKey : e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'k' || e.isComposing) return;
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
        <nav className="in-tabs" aria-label={t('nav.primary')} ref={tabsRef}>
          {TABS.map(tab => (
            <PageLink key={tab.to} to={tab.to} className="in-tab" aria-current={tab.match(loc.pathname) ? 'page' : undefined}>{t(tab.key)}</PageLink>
          ))}
          <span className="k-tab-ind" ref={indRef} aria-hidden="true" />
        </nav>
        <span className="in-spacer" />
        <div className="in-bar-slot" ref={setBarSlot} data-instrument-bar-slot />
        <button type="button" className="in-cmd" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t('inst.cmdOpenLabel')}>
          <Glyph name="search" /><span className="in-cmd-t">{t('inst.cmdShort')}</span><span className="in-kbd" aria-hidden="true">{CHORD}</span>
        </button>
        <span className={`in-status${online ? '' : ' is-off'}`} role="status" data-live-lamp={online ? 'online' : 'offline'}><i aria-hidden="true" /><span className="in-status-t">{online ? t('inst.online') : t('inst.offline')}</span></span>
        {accountMenu}
      </header>
      {/* Phone: the floating dock replaces the bottom bar. The five tabs, and
          the command sheet, which reaches every other page and action. */}
      <nav className="k-dock c-glass no-print" aria-label={t('inst.dockLabel')} data-instrument-dock>
        {TABS.filter(tab => tab.icon).map(tab => (
          <PageLink key={tab.to} to={tab.to} aria-label={t(tab.key)} aria-current={tab.match(loc.pathname) ? 'page' : undefined}><MarginIcon name={tab.icon} size={22} /></PageLink>
        ))}
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t('inst.cmdOpenLabel')}><MarginIcon name="command" size={22} /></button>
      </nav>
      {/* Mounted only while open: every opening starts from an empty query. */}
      {open && <CommandBar open onClose={() => setOpen(false)} user={user} pages={pages} actions={actions} returnFocus={returnFocus} />}
    </>
  );
}
