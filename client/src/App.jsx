import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { api } from './api.js';
import { requestPersistentStorage } from './local/idb.js';
import { setPersonalProfile } from './ink/personal.js';
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

  useEffect(() => { refreshUser().then(u => { if (u) { refreshDue(); refreshRecent(); } }); }, [refreshUser, refreshDue, refreshRecent]);

  // Guard months of practice from storage eviction — ask the browser once per boot.
  useEffect(() => { requestPersistentStorage(); }, []);

  // Each profile keeps its OWN learned handwriting — retarget the bank on switch.
  useEffect(() => { setPersonalProfile(user?.id || null); }, [user?.id]);

  useEffect(() => {
    document.documentElement.dataset.theme = user?.theme === 'light' ? 'light' : 'dark';
  }, [user?.theme]);

  useEffect(() => {
    const t = TITLES[loc.pathname] || (loc.pathname.startsWith('/exams') ? 'Exam' : null);
    document.title = t ? `${t} · Pri Learning` : 'Pri Learning';
  }, [loc.pathname]);

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
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
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
            <main className="content fade-in" key={loc.pathname}>
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

const ProviderMini = {
  apple: <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M17.05 12.9c-.02-2.05 1.67-3.03 1.75-3.08-.96-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.03-1.43 2.48-.37 6.16 1.03 8.18.68.99 1.49 2.1 2.55 2.06 1.02-.04 1.41-.66 2.65-.66 1.24 0 1.59.66 2.67.64 1.1-.02 1.8-1 2.47-2 .78-1.14 1.1-2.25 1.12-2.31-.02-.01-2.14-.82-2.13-3.29Z" /><path d="M15.02 6.88c.56-.68.94-1.63.84-2.58-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.57-.86 2.5.9.07 1.83-.46 2.39-1.14Z" /></svg>,
  google: <span style={{ fontWeight: 700, fontSize: 10.5, border: '1.4px solid currentColor', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>G</span>,
  email: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg>,
};

function AccountMenu({ user, onSwitch }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="acct-menu-wrap" ref={ref}>
      <button className="user-chip" onClick={() => setOpen(o => !o)} title="Account"
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
                {user.provider && <span style={{ color: 'var(--ink-3)', display: 'inline-flex' }}>{ProviderMini[user.provider]}</span>}
              </span>
              <span className="acct-sub">{user.email || user.courseLabel}</span>
            </span>
          </div>
          <button className="acct-menu-item" onClick={() => { setOpen(false); nav('/settings'); }}>
            Account settings
          </button>
          <button className="acct-menu-item" onClick={() => { setOpen(false); nav('/progress'); }}>
            My progress
          </button>
          <div className="acct-menu-foot">
            <button className="acct-menu-item" onClick={() => { setOpen(false); onSwitch(); }}>
              Switch profile <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>→</span>
            </button>
            <div style={{ padding: '7px 10px 4px', fontSize: 11.5, color: 'var(--ink-3)' }}>
              All data stays on this iPad — private by design.
            </div>
          </div>
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
