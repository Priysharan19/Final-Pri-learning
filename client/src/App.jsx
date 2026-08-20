import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { api } from './api.js';
import { requestPersistentStorage } from './local/idb.js';
import { setPersonalProfile } from './ink/personal.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { setDraftProfile } from './components/drafts.js';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Practice from './pages/Practice.jsx';
import Progress from './pages/Progress.jsx';
import Exams from './pages/Exams.jsx';
import ExamRoom from './pages/ExamRoom.jsx';
import Rush from './pages/Rush.jsx';
import Match from './pages/Match.jsx';
import Tasks from './pages/Tasks.jsx';
import Teach from './pages/Teach.jsx';
import History from './pages/History.jsx';
import Favorites from './pages/Favorites.jsx';
import Classes from './pages/Classes.jsx';
import Settings from './pages/Settings.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/* Thin-line icons, drawn to match the reference's icon rail */
const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></svg>,
  tasks: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5.5C10 4 7.5 3.5 4 3.8V19c3.5-.3 6 .3 8 1.7 2-1.4 4.5-2 8-1.7V3.8c-3.5-.3-6 .2-8 1.7Z" /><path d="M12 5.5v15.2" /></svg>,
  match: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 3.5h3.2L19 15.8v3.2h-3.2L3.5 6.7V3.5Z" /><path d="M20.5 3.5h-3.2L13 7.8m-2 8.4-4.3 4.3H3.5v-3.2L7.8 13" /><path d="m16 16 3 3M8 16l-3 3" /></svg>,
  progress: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.5 2.5L16 9.5" /></svg>,
  fav: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z" /></svg>,
  exams: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="13" r="8" /><path d="M12 9v4.5l3 1.8" /><path d="M9.5 2.5h5" /></svg>,
  classes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z" /><path d="M6.5 11.5V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.5" /><path d="M21.5 9v5" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3.2" /><path d="M19 12a7 7 0 0 0-.15-1.4l2.1-1.6-2-3.4-2.45 1a7 7 0 0 0-2.4-1.4L13.7 2.6h-3.9l-.4 2.6a7 7 0 0 0-2.4 1.4l-2.45-1-2 3.4 2.1 1.6A7 7 0 0 0 4.5 12c0 .5.05.9.15 1.4l-2.1 1.6 2 3.4 2.45-1a7 7 0 0 0 2.4 1.4l.4 2.6h3.9l.4-2.6a7 7 0 0 0 2.4-1.4l2.45 1 2-3.4-2.1-1.6c.1-.5.15-.9.15-1.4Z" /></svg>,
};

const NAV = [
  { to: '/', label: 'Home', ico: I.home },
  { to: '/tasks', label: 'Tasks', ico: I.tasks },
  { to: '/match', label: 'Match', ico: I.match },
  { to: '/progress', label: 'Progress', ico: I.progress },
  { to: '/favorites', label: 'Favorites', ico: I.fav },
  { to: '/exams', label: 'Exams', ico: I.exams },
  { to: '/classes', label: 'Classes', ico: I.classes },
  { to: '/settings', label: 'Settings', ico: I.settings },
];

const TITLES = {
  '/': 'Home', '/practice': 'Practice', '/progress': 'Progress', '/tasks': 'Tasks',
  '/exams': 'Exams', '/rush': 'Rapid Fire', '/match': 'Match', '/teach': 'Classes',
  '/history': 'History', '/favorites': 'Favorites', '/classes': 'Classes', '/settings': 'Settings'
};

export function Logo({ large = false, onClick }) {
  return (
    <span className={`logo ${large ? 'logo-lg' : ''}`} onClick={onClick}>
      <span className="logo-bb">P</span>
      <span className="logo-name">ri Learning<span className="logo-dot">.</span></span>
    </span>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [toasts, setToasts] = useState([]);
  const [dueCount, setDueCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const loc = useLocation();
  const nav = useNavigate();

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.get('/me');
      setUser(user);
      return user;
    } catch { setUser(null); return null; }
  }, []);

  const refreshDue = useCallback(async () => {
    try { const r = await api.get('/reviews'); setDueCount(r.due.length); } catch { setDueCount(0); }
  }, []);

  const refreshRecent = useCallback(async () => {
    try { const r = await api.post('/history/list', { limit: 4 }); setRecent(r.items || []); } catch { setRecent([]); }
  }, []);

  // The refreshers swallow their own failures, but a throw anywhere else in this
  // chain would escape as an unhandled rejection, offline and unseen.
  useEffect(() => {
    refreshUser().then(u => { if (u) { refreshDue(); refreshRecent(); } }).catch(() => { });
  }, [refreshUser, refreshDue, refreshRecent]);

  // Guard months of practice from storage eviction — ask the browser once per boot.
  useEffect(() => { requestPersistentStorage(); }, []);

  // Each profile keeps its OWN learned handwriting and its OWN unsent drafts —
  // retarget both banks on switch so nobody inherits another student's work.
  useEffect(() => {
    setPersonalProfile(user?.id || null);
    setDraftProfile(user?.id || null);
  }, [user?.id]);

  useEffect(() => {
    document.documentElement.dataset.theme = user?.theme === 'light' ? 'light' : 'dark';
  }, [user?.theme]);

  const pageTitle = useMemo(
    () => TITLES[loc.pathname] || (loc.pathname.startsWith('/exams') ? 'Exam' : null),
    [loc.pathname]
  );

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · Pri Learning` : 'Pri Learning';
  }, [pageTitle]);

  // <main> is keyed on the path, so every navigation replaces the node and focus
  // drops to <body>: a keyboard or VoiceOver user is left at the top of the
  // document with no idea the page changed. Put focus on the new page instead,
  // but never on first paint — that would steal focus from the boot screen.
  const mainRef = useRef(null);
  const navigatedRef = useRef(false);
  useEffect(() => {
    if (!navigatedRef.current) { navigatedRef.current = true; return; }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [loc.pathname]);

  const skipToMain = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  };

  const toast = useCallback((content, ms = 3800, kind = '') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, content, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms);
  }, []);

  const celebrate = useCallback((res) => {
    for (const b of res?.newBadges || []) {
      toast(<><span className="badge-ico">{b.icon}</span><div><div className="badge-name">Achievement unlocked — {b.name}</div><div className="badge-desc">{b.desc}</div></div></>, 5200, 'gold');
    }
  }, [toast]);

  const ctx = useMemo(() => ({ user, setUser, refreshUser, toast, celebrate, dueCount, refreshDue, refreshRecent }),
    [user, refreshUser, toast, celebrate, dueCount, refreshDue, refreshRecent]);

  if (user === undefined) {
    return (
      <div className="auth-wrap">
        <div style={{ textAlign: 'center' }}>
          <Logo large />
          <div className="goalbar" style={{ width: 120, margin: '26px auto 0' }}><i style={{ width: '40%' }} /></div>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <AppCtx.Provider value={ctx}>
        <Login />
        <ToastLayer toasts={toasts} />
      </AppCtx.Provider>
    );
  }

  const navItems = user.role === 'teacher'
    ? NAV.map(n => n.to === '/classes' ? { ...n, to: '/teach', label: 'Classes' } : n)
    : NAV;

  const switchProfile = async () => {
    try { await api.post('/auth/logout'); } catch { }
    setUser(null);
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <a className="skip-link" href="#main" onClick={skipToMain}>Skip to main content</a>
        <header className="topbar">
          <Logo onClick={() => nav('/')} />
          <div className="top-stats">
            {user.streak > 0 && <span className="chip" title="Day streak"><span className="flame">▲</span><b>{user.streak}</b></span>}
            <ThemeToggle />
            <AccountMenu user={user} onSwitch={switchProfile} />
          </div>
        </header>

        <div className="body-row">
          <aside className="sidebar no-print">
            <div className="sidebar-inner">
              {navItems.map(n => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                  <span className="nav-ico">{n.ico}</span>
                  <span className="nav-label">{n.label}</span>
                  {n.to === '/' && dueCount > 0 && <span className="nav-badge">{dueCount} due</span>}
                </NavLink>
              ))}
              <div className="nav-spacer" />
              <SidebarHistory recent={recent} />
            </div>
          </aside>

          <div className="main">
            <main className="content fade-in" id="main" tabIndex={-1} ref={mainRef}
              aria-label={pageTitle || 'Pri Learning'} key={loc.pathname}>
              <ErrorBoundary scope="route" resetKey={loc.pathname} onHome={() => nav('/')}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/map" element={<Navigate to="/progress?tab=map" replace />} />
                  <Route path="/stats" element={<Navigate to="/progress" replace />} />
                  <Route path="/badges" element={<Navigate to="/progress" replace />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/teach" element={<Teach />} />
                  <Route path="/exams" element={<Exams />} />
                  <Route path="/exams/:id" element={<ExamRoom />} />
                  <Route path="/rush" element={<Rush />} />
                  <Route path="/match" element={<Match />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/classes" element={<Classes />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </div>

      <nav className="mobilenav no-print">
        {[navItems[0], navItems[1], navItems[2], navItems[3], navItems[7]].map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => 'mnav-item' + (isActive ? ' active' : '')}>
            <span className="nav-ico">{n.ico}</span><span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <ToastLayer toasts={toasts} />
    </AppCtx.Provider>
  );
}

function SidebarHistory({ recent }) {
  const nav = useNavigate();
  if (!recent.length) {
    return (
      <div className="nav-hist">
        <div className="nav-hist-title">Question History</div>
        <div className="muted" style={{ fontSize: 12 }}>No questions yet</div>
      </div>
    );
  }
  return (
    <div className="nav-hist">
      <div className="nav-hist-title">Question History</div>
      {recent.slice(0, 3).map(it => {
        const cls = it.correct === true ? 'g' : it.correct === false ? 'b' : 'w';
        return (
          <button key={it.id} className="hist-mini" onClick={() => nav('/history')}>
            <div className="hist-mini-top">
              <span className="hist-mini-name">{it.subtopicName}</span>
              <span className={`hist-mini-pct ${cls}`}>{it.correct === true ? '100% ✓' : it.correct === false ? '0.0% ✗' : '—'}</span>
            </div>
            <div className="hist-mini-preview">{stripTex(it.prompt)}</div>
            <div className="hist-mini-tags">
              <span className="tag" style={{ fontSize: 10.5 }}>{it.mode === 'practice' ? 'Practice' : it.mode}</span>
              <span className="tag" style={{ fontSize: 10.5 }}>Difficulty: {it.difficulty}</span>
            </div>
          </button>
        );
      })}
      <button className="btn btn-quiet btn-sm" style={{ width: '100%' }} onClick={() => nav('/history')}>View all →</button>
    </div>
  );
}

function initials(name = '') {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'PL';
}

/* One honest mark for every profile: this app has no OAuth of any kind, so an
   Apple or Google glyph here would claim a sign-in that never happened. */
const DeviceMark = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <rect x="6" y="2.5" width="12" height="19" rx="2.4" />
    <path d="M10.5 5.4h3" /><path d="M12 18.3h.01" />
  </svg>
);

function AccountMenu({ user, onSwitch }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const ref = useRef(null);
  const btnRef = useRef(null);
  const itemRefs = useRef([]);

  const items = [
    { key: 'settings', label: 'Account settings', run: () => nav('/settings') },
    { key: 'progress', label: 'My progress', run: () => nav('/progress') },
    { key: 'switch', label: 'Switch profile', run: onSwitch, sep: true },
  ];
  const last = items.length - 1;

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // The APG menu pattern in full: opening moves focus into the menu, the active
  // item is the only tab stop, and Escape hands focus back to the button.
  useEffect(() => { if (open) itemRefs.current[active]?.focus(); }, [open, active]);

  const openAt = (i) => { setActive(i); setOpen(true); };
  const shut = (toButton) => { setOpen(false); if (toButton) btnRef.current?.focus(); };

  const onButtonKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openAt(last); }
    else if (e.key === 'Escape') shut(false);
  };

  const onMenuKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i >= last ? 0 : i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i <= 0 ? last : i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Escape') { e.preventDefault(); shut(true); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="acct-menu-wrap" ref={ref}>
      <button className="user-chip" id="acct-menu-btn" ref={btnRef} title="Account"
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => (open ? shut(false) : openAt(0))} onKeyDown={onButtonKey}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span className="user-avatar">{user.avatar && user.avatar !== '🙂' ? user.avatar : initials(user.name)}</span>
        {user.name.split(' ')[0]}
        <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div className="acct-menu">
          <div className="acct-menu-head">
            <span className="acct-avatar">{user.avatar || '🙂'}</span>
            <span style={{ minWidth: 0 }}>
              <span className="acct-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {user.name}
                <span className="acct-local-mark" role="img" aria-label="Profile stored on this device">{DeviceMark}</span>
              </span>
              <span className="acct-sub">{user.email || user.courseLabel}</span>
            </span>
          </div>
          <div className="acct-menu-list" role="menu" aria-labelledby="acct-menu-btn" onKeyDown={onMenuKey}>
            {items.map((it, i) => (
              <button key={it.key} role="menuitem" className={`acct-menu-item${it.sep ? ' sep' : ''}`}
                tabIndex={i === active ? 0 : -1} ref={el => { itemRefs.current[i] = el; }}
                onClick={() => { setOpen(false); it.run(); }}>
                {it.label}
                {it.sep && <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>→</span>}
              </button>
            ))}
          </div>
          <div className="acct-menu-note">All data stays on this iPad — private by design.</div>
        </div>
      )}
    </div>
  );
}

function stripTex(s = '') {
  return s.replace(/\$[^$]*\$/g, m => m.slice(1, -1).replace(/\\[a-zA-Z]+/g, '').replace(/[{}^_]/g, '')).slice(0, 80);
}

function ThemeToggle() {
  const { user, setUser } = useApp();
  const flip = async () => {
    const theme = user.theme === 'light' ? 'dark' : 'light';
    setUser({ ...user, theme });
    try { await api.patch('/me', { theme }); } catch { }
  };
  return (
    <button className="btn btn-quiet btn-sm" onClick={flip} title="Toggle theme" style={{ padding: '6px 9px' }}>
      {user.theme === 'light' ? '☾' : '☼'}
    </button>
  );
}

function ToastLayer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.content}</div>)}
    </div>
  );
}
