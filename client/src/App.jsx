import { featureEnabled } from './platform/features.js';
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { api } from './api.js';
import { applyTheme, cleanThemePref, followSystemTheme, resolveTheme, storedThemePref } from './lib/theme.js';
import { requestPersistentStorage } from './local/idb.js';
import { onCloudSessionChange } from './platform/cloudSession.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { setDraftProfile } from './components/drafts.js';
import { setLanguage, signInLanguage, useT } from './i18n/index.js';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Practice from './pages/Practice.jsx';
import Icon from './components/Icon.jsx';
import { BrandWordmark } from './components/BrandMark.jsx';

// ── Routes nobody has opened yet ─────────────────────────────────────────────
// Login, Home and Practice are the screens a first run reaches: the profile
// gate, the landing page behind it and the practice workspace the product is
// for. Those three are worth having in the shell (Legal: see below).
//
// The other eleven were too. Every student downloaded the exam room, the
// teacher console, the classroom panels, the progress charts and the whole
// settings surface before the profile screen could paint — 665 kB of app chunk
// on a link that delivers about 90 kB a second. They are behind a boundary now.
// The service worker still holds every one of them for offline use; the change
// is only about what has to arrive before a student can do anything.
const Progress = React.lazy(() => import('./pages/Progress.jsx'));
const Exams = React.lazy(() => import('./pages/Exams.jsx'));
const ExamRoom = React.lazy(() => import('./pages/ExamRoom.jsx'));
const Rush = React.lazy(() => import('./pages/Rush.jsx'));
const Match = React.lazy(() => import('./pages/Match.jsx'));
const Tasks = React.lazy(() => import('./pages/Tasks.jsx'));
const Teach = React.lazy(() => import('./pages/Teach.jsx'));
const History = React.lazy(() => import('./pages/History.jsx'));
const Classes = React.lazy(() => import('./pages/Classes.jsx'));
const Settings = React.lazy(() => import('./pages/Settings.jsx'));
const PlanPage = React.lazy(() => import('./plan/PlanPage.jsx'));
// The placement check is opened once or twice per student, so it — and the
// prerequisite graph and engine behind it — is an on-demand chunk (see
// ON_DEMAND in vite.config.js), not part of the install or the warm set.
const Placement = React.lazy(() => import('./pages/Placement.jsx'));
// Notes: the page and each class's notes are chunks of their own (notes/notesIndex.js).
// Legal carries the full policy documents (~19 kB). A reviewer who opens
// /privacy is online, and the warm pass keeps it for offline, so it no longer
// rides in the install every student downloads before the first screen.
const Legal = React.lazy(() => import('./pages/Legal.jsx'));
const Notes = React.lazy(() => import('./pages/Notes.jsx'));
// Outside the frozen V1 scope: the route exists only where the build flag is on.
const PLACEMENT_ON = featureEnabled('placement');
// "Practise this": an on-demand chunk (ON_DEMAND in vite.config.js) — it needs
// a connection to do anything, so it is never part of the install.
const PractisePhoto = React.lazy(() => import('./pages/PractisePhoto.jsx'));

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/* Navigation marks come from the one Pri icon family (components/Icon.jsx). */
const I = {
  home: <Icon name="home" />, tasks: <Icon name="tasks" />, match: <Icon name="match" />,
  progress: <Icon name="progress" />, exams: <Icon name="exams" />, classes: <Icon name="classes" />,
  settings: <Icon name="settings" />, practice: <Icon name="practice" />, review: <Icon name="review" />,
  rush: <Icon name="rush" />, notes: <Icon name="notes" />, teacher: <Icon name="teacher" />,
};

const STUDENT_NAV = [
  { label: 'nav.groupLearn', items: [{ to: '/', key: 'nav.home', ico: I.home }, { to: '/practice', key: 'nav.practice', ico: I.practice }, { to: '/plan', key: 'nav.plan', ico: I.tasks }, { to: '/notes', key: 'nav.notes', ico: I.notes }] },
  { label: 'nav.groupWork', items: [{ to: '/tasks', key: 'nav.tasks', ico: I.tasks }, { to: '/exams', key: 'nav.exams', ico: I.exams }, { to: '/classes', key: 'nav.classes', ico: I.classes }] },
  { label: 'nav.groupUnderstand', items: [{ to: '/progress', key: 'nav.progress', ico: I.progress }, { to: '/review?filter=wrong', key: 'nav.review', ico: I.review }] },
  { label: 'nav.groupPlay', items: [{ to: '/rush', key: 'nav.rush', ico: I.rush }, { to: '/match', key: 'nav.match', ico: I.match }] },
  { label: 'nav.groupAccount', items: [{ to: '/settings', key: 'nav.settings', ico: I.settings }] },
];

const TEACHER_NAV = [
  { label: 'nav.groupTeach', items: [
    { to: '/teach', key: 'nav.teacherWorkspace', ico: I.teacher },
    { to: '/teach#teacher-classes', key: 'nav.teacherClasses', ico: I.classes },
    { to: '/teach#teacher-assignments', key: 'nav.teacherAssignments', ico: I.tasks },
    { to: '/teach#teacher-analytics', key: 'nav.teacherAnalytics', ico: I.progress },
    { to: '/teach#teacher-questions', key: 'nav.teacherQuestions', ico: I.review },
  ] },
  { label: 'nav.groupAccount', items: [{ to: '/settings', key: 'nav.settings', ico: I.settings }] },
];

const STUDENT_MOBILE_PRIMARY = new Set(['/', '/practice', '/tasks', '/progress']);
const TEACHER_MOBILE_PRIMARY = new Set(['/teach', '/teach#teacher-classes', '/teach#teacher-assignments', '/teach#teacher-analytics']);

function targetParts(to) {
  const u = new URL(to, 'https://pri.local');
  return { pathname: u.pathname, hash: u.hash };
}

function isDestinationActive(location, to) {
  const target = targetParts(to);
  if (location.pathname !== target.pathname) return false;
  if (target.hash) return location.hash === target.hash;
  if (target.pathname === '/teach') return !location.hash;
  return true;
}

const TITLE_KEYS = {
  '/': 'nav.home', '/practice': 'nav.practice', '/progress': 'nav.progress', '/tasks': 'nav.tasks',
  '/exams': 'nav.exams', '/rush': 'nav.rush', '/match': 'nav.match', '/teach': 'nav.teacherWorkspace',
  '/notes': 'nav.notes', '/review': 'nav.review', '/history': 'nav.review', '/favorites': 'nav.review', '/classes': 'nav.classes', '/settings': 'nav.settings'
};

// Shown for the moment a route's own chunk is arriving. It is announced rather
// than silent because on a slow connection that moment is long enough for a
// student to wonder whether the tap registered.
function RouteLoading() {
  const t = useT();
  return <p className="muted" role="status" aria-live="polite">{t('common.loading')}</p>;
}

export function Logo({ large = false, onClick }) {
  const t = useT();
  // With an onClick this is a control, so it has to be one: a bare <span> takes
  // the click and gives a keyboard no way to follow it.
  const Tag = onClick ? 'button' : 'span';
  const controlProps = onClick
    ? { type: 'button', onClick, 'aria-label': t('app.logoHome') }
    : {};
  return (
    <Tag className={`logo ${large ? 'logo-lg' : ''}${onClick ? ' logo-btn' : ''}`} {...controlProps}>
      <BrandWordmark height={large ? 44 : 22} />
    </Tag>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  // Declared with the other top-level state: the app returns early for the
  // boot screen and the profile gate, and a hook after those would not run on
  // every render.
  const [moreOpen, setMoreOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [dueCount, setDueCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const moreButtonRef = useRef(null);
  const moreSheetRef = useRef(null);
  const loc = useLocation();
  const nav = useNavigate();
  const t = useT();

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

  // Signing in or out of a cloud account changes what the profile view reports
  // (cloudLinked, which decides default server reading). A failed re-read here
  // keeps the current profile rather than signing the student out.
  useEffect(() => {
    let stop = () => {};
    try {
      stop = onCloudSessionChange(() => {
        api.get('/me').then(r => { if (r?.user) setUser(r.user); }).catch(() => { });
      });
    } catch { /* non-browser runtimes */ }
    return () => { try { stop(); } catch { /* already gone */ } };
  }, []);

  // Guard months of practice from storage eviction — ask the browser once per boot.
  useEffect(() => { requestPersistentStorage(); }, []);

  // Cloud sync without a button: on start, on reconnect, on return to the
  // foreground, shortly after an answer and every 15 minutes while visible —
  // for the signed-in profile only, and a no-op offline or unlinked. When a
  // pull restored work done on another device, the screens reading it refresh.
  //
  // The scheduler is reached through import() rather than named at the top of
  // this file: it pulls the sync worker and the cloud-restore path with it, and
  // a static import here put 53 kB of them in the shell's own preload list —
  // paid for on every cold open, by every student, before the first screen.
  // Nothing about sync is needed before first paint: it is network-dependent
  // and a no-op offline, so it is installed once the module arrives. The
  // cleanup covers both orders — the effect torn down before the module lands
  // (nothing to uninstall, and the late arrival installs nothing) and after.
  useEffect(() => {
    if (!user?.id) return undefined;
    const pid = user.id;
    let uninstall = null;
    let torn = false;
    void import('./platform/cloudSyncScheduler.js').then(({ installAutoSync }) => {
      if (torn) return;
      uninstall = installAutoSync(pid, {
        onSynced: result => { if (result?.restoredEvents > 0) { refreshUser(); refreshDue(); refreshRecent(); } }
      });
    }).catch(() => { });
    return () => { torn = true; if (uninstall) uninstall(); };
  }, [user?.id, refreshUser, refreshDue, refreshRecent]);

  // The interface follows the profile's own language. Before a profile is
  // chosen there is nothing to follow, so the sign-in screen falls back to the
  // language last picked on this device — otherwise a Hindi-medium student
  // would meet the product in English every single time they opened it.
  useEffect(() => { setLanguage(user ? user.language : signInLanguage()); }, [user]);

  // Each profile keeps its OWN learned handwriting and its OWN unsent drafts —
  // retarget both banks on switch so nobody inherits another student's work.
  //
  // The handwriting bank is reached through import() rather than named at the
  // top of this file. ink/personal.js shares a chunk with the recogniser, so a
  // static import here put 102 kB of it in the shell's own preload list — paid
  // for on every cold open, by every student, including the ones on a phone who
  // will never write a stroke. Nothing here needs it synchronously: the bank is
  // read when a canvas asks, which is always later than this.
  useEffect(() => {
    const id = user?.id || null;
    void import('./ink/personal.js').then(m => m.setPersonalProfile(id)).catch(() => { });
    setDraftProfile(id);
  }, [user?.id]);

  // The profile's preference is the authority once a profile is open. Before
  // that (sign-in, onboarding) the screen keeps whatever theme-boot.js painted
  // from the last preference used on this device.
  useEffect(() => {
    const pref = user ? cleanThemePref(user.theme) : (storedThemePref() || 'light');
    applyTheme(pref);
    return followSystemTheme(pref, () => applyTheme(pref));
  }, [user?.id, user?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageTitle = useMemo(
    () => (TITLE_KEYS[loc.pathname] ? t(TITLE_KEYS[loc.pathname]) : loc.pathname.startsWith('/exams') ? t('nav.exam') : loc.pathname.startsWith('/notes/') ? t('nav.notes') : null),
    [loc.pathname, t]
  );

  useEffect(() => {
    // Before a profile is chosen the route is still "/", but the screen is the
    // welcome and sign-in page, not Home. Naming the tab after a page the
    // visitor cannot see yet is worse than naming the product.
    document.title = user && pageTitle ? `${pageTitle} · Pri Learning` : 'Pri Learning';
  }, [pageTitle, user]);

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

  // A link into a section of a page — Login's "Sign in to your Pri cloud
  // account" lands on /settings#cloud-account-title — only scrolls by itself
  // on a full document load. After a client-side navigation the section is
  // rendered a moment later, so it is looked up until it is there.
  useEffect(() => {
    if (!loc.hash) return;
    const id = decodeURIComponent(loc.hash.slice(1));
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        if (el.matches('[tabindex]')) el.focus({ preventScroll: true });
        clearInterval(timer);
      } else if (++tries > 20) clearInterval(timer);
    }, 80);
    return () => clearInterval(timer);
  }, [loc.pathname, loc.hash]);

  const closeMore = useCallback((restoreFocus = false) => {
    if (restoreFocus) moreButtonRef.current?.focus();
    setMoreOpen(false);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const first = moreSheetRef.current?.querySelector('a, button:not([disabled])');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMore(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen, closeMore]);

  useEffect(() => { setMoreOpen(false); }, [loc.pathname, loc.hash]);

  const toast = useCallback((content, ms = 3800, kind = '') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, content, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms);
  }, []);

  // Badges are still earned and kept on Progress, but they never interrupt a
  // student mid-question: no pop-ups, no emoji, nothing between them and the maths.
  const celebrate = useCallback(() => { }, []);

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
        <React.Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* A store reviewer and a payment provider open these without an
                account, so they are reachable before the profile gate. */}
            <Route path="/privacy" element={<Legal />} />
            <Route path="/terms" element={<Legal />} />
            <Route path="/refund-policy" element={<Legal />} />
            <Route path="/grievance" element={<Legal />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </React.Suspense>
        <ToastLayer toasts={toasts} />
      </AppCtx.Provider>
    );
  }

  const navSections = user.role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;
  const navItems = navSections.flatMap(section => section.items);
  const primarySet = user.role === 'teacher' ? TEACHER_MOBILE_PRIMARY : STUDENT_MOBILE_PRIMARY;
  const mobilePrimary = navItems.filter(item => primarySet.has(item.to));
  const mobileMore = navItems.filter(item => !primarySet.has(item.to));
  const roleLanding = user.role === 'teacher' ? '/teach' : '/';

  const studentOnly = (element, teacherTarget = '/teach') =>
    user.role === 'teacher' ? <Navigate to={teacherTarget} replace /> : element;
  const teacherOnly = (element) =>
    user.role === 'teacher' ? element : <Navigate to="/" replace />;

  const destinationLink = (item, className, onClick) => {
    const active = isDestinationActive(loc, item.to);
    return (
      <Link key={item.to} to={item.to} className={`${className}${active ? ' active' : ''}`}
        aria-current={active ? 'page' : undefined} onClick={onClick}>
        <span className="nav-ico" aria-hidden="true">{item.ico}</span>
        <span className="nav-label">{t(item.key)}</span>
        {item.to === '/' && dueCount > 0 && <span className="nav-badge">{t('nav.due', { count: dueCount, n: dueCount })}</span>}
      </Link>
    );
  };

  const switchProfile = async () => {
    // The reminders runtime is loaded here, on the way out, rather than named
    // at the top of this file: a static import carried the study planner it
    // depends on into the shell's preload list for every student at every boot.
    try { const { cancelRemindersOnSignOut } = await import('./reminders/index.js'); await cancelRemindersOnSignOut(user?.id); } catch { }
    try { await api.post('/auth/logout'); } catch { }
    // A role-specific route belongs to the profile that just signed out.
    // Neutralise it before showing the picker so selecting a different role
    // cannot inherit a stale /teach (or other guarded) redirect.
    nav('/', { replace: true });
    setUser(null);
  };

  // Thinking mode: while a question or a paper is open the shell steps back —
  // no rail, no bottom bar, no account furniture. The page keeps its own way out.
  const focusMode = user.role !== 'teacher'
    && (loc.pathname === '/practice' || /^\/exams\/[^/]+/.test(loc.pathname));

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`shell${focusMode ? ' is-focus' : ''}`}>
        <a className="skip-link" href="#main" onClick={skipToMain}>{t('app.skipToMain')}</a>
        <header className="topbar">
          <Logo onClick={() => nav('/')} />
          <div className="top-stats">
            <ThemeToggle />
            <AccountMenu user={user} onSwitch={switchProfile} />
          </div>
        </header>

        <div className="body-row">
          <aside className="sidebar no-print">
            <div className="sidebar-inner">
              {navSections.map(section => (
                <div className="nav-section" key={section.label}>
                  <div className="nav-section-label">{t(section.label)}</div>
                  {section.items.map(item => destinationLink(item, 'nav-item'))}
                </div>
              ))}
              <div className="nav-spacer" />
              {user.role !== 'teacher' && <SidebarHistory recent={recent} />}
            </div>
          </aside>

          <div className="main">
            <main className="content fade-in" id="main" tabIndex={-1} ref={mainRef}
              aria-label={pageTitle || 'Pri Learning'} key={loc.pathname}>
              <ErrorBoundary scope="route" resetKey={loc.pathname} onHome={() => nav('/')}>
                {/* Inside the boundary, so a route chunk that will not load is
                    reported as a broken route rather than blanking the shell. */}
                <React.Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route path="/" element={user.role === 'teacher' ? <Navigate to="/teach" replace /> : <Home />} />
                    <Route path="/practice" element={studentOnly(<Practice />)} />
                    <Route path="/practise-photo" element={studentOnly(<PractisePhoto />)} />
                    <Route path="/progress" element={studentOnly(<Progress />, '/teach#teacher-analytics')} />
                    <Route path="/plan" element={studentOnly(<PlanPage />)} />
                    {PLACEMENT_ON && <Route path="/placement" element={studentOnly(<Placement />)} />}
                    <Route path="/map" element={<Navigate to="/progress?tab=map" replace />} />
                    <Route path="/stats" element={<Navigate to="/progress" replace />} />
                    <Route path="/badges" element={<Navigate to="/progress" replace />} />
                    <Route path="/tasks" element={studentOnly(<Tasks />, '/teach#teacher-assignments')} />
                    <Route path="/teach" element={teacherOnly(<Teach />)} />
                    <Route path="/exams" element={studentOnly(<Exams />)} />
                    <Route path="/exams/:id" element={studentOnly(<ExamRoom />)} />
                    <Route path="/notes" element={studentOnly(<Notes />)} />
                    <Route path="/notes/:chapterId" element={studentOnly(<Notes />)} />
                    <Route path="/rush" element={studentOnly(<Rush />)} />
                    <Route path="/match" element={studentOnly(<Match />)} />
                    <Route path="/review" element={studentOnly(<History />)} />
                    <Route path="/history" element={<Navigate to="/review" replace />} />
                    <Route path="/favorites" element={<Navigate to="/review?filter=bookmarked" replace />} />
                    <Route path="/mistakes" element={<Navigate to="/review?filter=wrong" replace />} />
                    <Route path="/classes" element={studentOnly(<Classes />, '/teach#teacher-classes')} />
                    <Route path="/privacy" element={<Legal />} />
                    <Route path="/terms" element={<Legal />} />
                    <Route path="/refund-policy" element={<Legal />} />
                    <Route path="/grievance" element={<Legal />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to={roleLanding} replace />} />
                  </Routes>
                </React.Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </div>

      {/* The bar holds five destinations; the rest live behind More. Before
          this, Exams, Favorites and Classes had no entry point at all on a
          phone — an Indian student on a phone could not reach an exam. */}
      <nav className="mobilenav no-print" aria-label={t('nav.primary')}>
        {mobilePrimary.map(item => {
          const active = isDestinationActive(loc, item.to);
          return (
            <Link key={item.to} to={item.to} className={`mnav-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}>
              <span className="nav-ico" aria-hidden="true">{item.ico}</span><span>{t(item.key)}</span>
            </Link>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          className={'mnav-item' + (moreOpen ? ' active' : '')}
          aria-expanded={moreOpen}
          aria-controls="mobile-more"
          onClick={() => (moreOpen ? closeMore(false) : setMoreOpen(true))}
        >
          <span className="nav-ico" aria-hidden="true"><Icon name="more" /></span><span>{t('nav.more')}</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button type="button" className="mnav-sheet-scrim" aria-label={t('nav.close')} onClick={() => closeMore(true)} />
          <div className="mnav-sheet" id="mobile-more" ref={moreSheetRef} role="dialog" aria-modal="true" aria-label={t('nav.morePlaces')}>
            <div className="mnav-sheet-title">{user.role === 'teacher' ? t('nav.teacherWorkspace') : t('nav.morePlaces')}</div>
            {mobileMore.map(item => {
              const active = isDestinationActive(loc, item.to);
              return (
                <Link key={item.to} to={item.to} className={`mnav-sheet-item${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined} onClick={() => closeMore(false)}>
                  <span className="nav-ico" aria-hidden="true">{item.ico}</span><span>{t(item.key)}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
      <ToastLayer toasts={toasts} />
    </AppCtx.Provider>
  );
}

function SidebarHistory({ recent }) {
  const nav = useNavigate();
  const t = useT();
  if (!recent.length) {
    return (
      <div className="nav-hist">
        <div className="nav-hist-title">{t('app.questionHistory')}</div>
        <div className="muted" style={{ fontSize: 12 }}>{t('app.noQuestionsYet')}</div>
      </div>
    );
  }
  return (
    <div className="nav-hist">
      <div className="nav-hist-title">{t('app.questionHistory')}</div>
      {recent.slice(0, 3).map(it => {
        const cls = it.correct === true ? 'g' : it.correct === false ? 'b' : 'w';
        return (
          <button key={it.id} className="hist-mini" onClick={() => nav('/review')}>
            <div className="hist-mini-top">
              <span className="hist-mini-name">{it.subtopicName}</span>
              <span className={`hist-mini-pct ${cls}`}
                aria-label={it.correct === true ? t('app.correct') : it.correct === false ? t('app.incorrect') : t('app.notMarkedYet')}>
                {it.correct === true ? <Icon name="check" size={14} /> : it.correct === false ? <Icon name="correction" size={14} /> : '—'}
              </span>
            </div>
            <div className="hist-mini-preview">{stripTex(it.prompt)}</div>
            <div className="hist-mini-tags">
              <span className="tag" style={{ fontSize: 10.5 }}>{it.mode === 'practice' ? t('history.modePractice') : it.mode}</span>
              <span className="tag" style={{ fontSize: 10.5 }}>{t('app.difficultyIs', { level: it.difficulty })}</span>
            </div>
          </button>
        );
      })}
      <button className="btn btn-quiet btn-sm" style={{ width: '100%' }} onClick={() => nav('/review')}>{t('app.viewAll')}</button>
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
  const t = useT();
  const ref = useRef(null);
  const btnRef = useRef(null);
  const itemRefs = useRef([]);

  const items = user.role === 'teacher'
    ? [
        { key: 'workspace', label: t('nav.teacherWorkspace'), run: () => nav('/teach') },
        { key: 'settings', label: t('app.accountSettings'), run: () => nav('/settings') },
        { key: 'switch', label: t('app.switchProfile'), run: onSwitch, sep: true },
      ]
    : [
        { key: 'settings', label: t('app.accountSettings'), run: () => nav('/settings') },
        { key: 'progress', label: t('app.myProgress'), run: () => nav('/progress') },
        { key: 'switch', label: t('app.switchProfile'), run: onSwitch, sep: true },
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
      <button className="user-chip" id="acct-menu-btn" ref={btnRef} title={t('app.account')}
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => (open ? shut(false) : openAt(0))} onKeyDown={onButtonKey}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span className="user-avatar" aria-hidden="true">{initials(user.name)}</span>
        {user.name.split(' ')[0]}
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="acct-menu">
          <div className="acct-menu-head">
            <span className="acct-avatar" aria-hidden="true">{initials(user.name)}</span>
            <span style={{ minWidth: 0 }}>
              <span className="acct-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {user.name}
                <span className="acct-local-mark" role="img" aria-label={t('app.profileOnDevice')}>{DeviceMark}</span>
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
          <div className="acct-menu-note">{t('app.dataStaysHere')}</div>
        </div>
      )}
    </div>
  );
}

function stripTex(s = '') {
  return s.replace(/\$[^$]*\$/g, m => m.slice(1, -1).replace(/\\[a-zA-Z]+/g, '').replace(/[{}^_]/g, '')).slice(0, 80);
}

/** The theme actually on screen for a preference; re-renders when the device flips. */
function useResolvedTheme(pref) {
  return useSyncExternalStore(
    notify => followSystemTheme(pref, notify),
    () => resolveTheme(pref),
    () => (cleanThemePref(pref) === 'dark' ? 'dark' : 'light')
  );
}

function ThemeToggle() {
  const { user, setUser } = useApp();
  const t = useT();
  // What is on screen decides the direction, so a profile following the device
  // still flips to the other paper in one press (and then stops following).
  const shown = useResolvedTheme(user.theme);
  const flip = async () => {
    const theme = shown === 'dark' ? 'light' : 'dark';
    setUser({ ...user, theme });
    try { await api.patch('/me', { theme }); } catch { }
  };
  return (
    <button className="btn btn-quiet btn-sm" onClick={flip}
      aria-label={shown === 'dark' ? t('app.themeToLight') : t('app.themeToDark')}
      style={{ minWidth: 44, minHeight: 44, padding: 0 }}>
      <Icon name={shown === 'dark' ? 'sun' : 'moon'} size={17} />
    </button>
  );
}

function ToastLayer({ toasts }) {
  // Always mounted, so a screen reader hears each toast as it arrives.
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.content}</div>)}
    </div>
  );
}
