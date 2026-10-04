// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Landing + profile entry
// A profile is a record in this device's own storage — created here, unlocked
// here, wiped here. Nothing on this screen contacts a provider, verifies an
// address or resets a password. The optional Pri cloud account lives in
// Settings: this screen only offers the way there, and never passes a local
// profile off as a cloud sign-in.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp, Logo } from '../App.jsx';
import { LANGUAGES, rememberSignInLanguage, setLanguage, signInLanguage, useLanguage, useT, useTx } from '../i18n/index.js';
import { featureEnabled } from '../platform/features.js';
import { cloudAvailable } from '../platform/cloudTransport.js';
import { appleSignInAvailable, rememberAppleSignInIntent } from '../platform/native/appleSignIn.js';
import { flushSync } from 'react-dom';
// Lazy: the account flow is not on the offline first-run path, so it stays out
// of the install (client/test/install-budget-check.mjs).
const SignUpFlow = React.lazy(() => import('../components/SignUpFlow.jsx'));

const AVATARS = ['🚀', '🦊', '🐨', '🦉', '🌟', '🐯', '🍀', '🎧', '🦄', '⚡', '🌊', '🧠'];
// The first thing a student chooses: what they are studying. Classes 7–12 are
// the CBSE / NCERT track; JEE Main, JEE Advanced and olympiad are tracks of
// their own with a class beneath them.
// JEE Main, JEE Advanced and the olympiad names are printed in Latin on the
// Hindi-medium admit card too, so they are the label in both languages and are
// not catalogue entries. Only "Class {n}" is a phrase that has to translate.
//
// Only cbse, jee-main and jee-advanced are launch-certified
// (docs/content/certification-report.md; PRI_V1_RELEASE_SCOPE §6). The
// Olympiad track and the Teacher role are offered for NEW profiles only in a
// build made with PRI_FEATURE_EXTENDED_TRACKS=1, the Australian syllabuses
// only in one made with PRI_FEATURE_AUSTRALIA=1 (development, test builds).
// Existing profiles that already hold one keep working: the picker, the
// backend and the summary never read a flag.
const STUDY = [
  ...[7, 8, 9, 10, 11, 12].map(y => ({ key: String(y), classOf: y, year: y, track: 'cbse' })),
  { key: 'jee-main', label: 'JEE Main', year: 12, track: 'jee-main' },
  { key: 'jee-advanced', label: 'JEE Advanced', year: 12, track: 'jee-advanced' },
  { key: 'olympiad', labelKey: 'login.olympiadTrack', year: 10, track: 'olympiad', extended: true }
];
const STUDY_DEFAULT = STUDY.find(o => o.key === '10');
/** The class/track choices this build offers a new profile. */
export const studyOptions = (extended = featureEnabled('extendedTracks')) => STUDY.filter(o => !o.extended || extended);
/** The roles this build offers a new profile. */
export const roleOptions = (extended = featureEnabled('extendedTracks')) => (extended ? ['student', 'teacher'] : ['student']);
const ONBOARDING_STEPS = 5;
const LOCAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function freshProfileDraft() {
  const draft = {
    name: '', email: '', password: '', password2: '', study: '', year: STUDY_DEFAULT.year,
    avatar: '🚀', role: '', course: 'in', pathway: 'advanced', indiaTrack: STUDY_DEFAULT.track,
    protect: false
  };
  // With one role on offer the step still shows it, pressed, so the student
  // sees what they are; with two, the choice is theirs to make.
  if (roleOptions().length === 1) draft.role = roleOptions()[0];
  return draft;
}

// The Australian syllabuses stay selectable, folded away behind one link.
const AU_COURSES = [['nsw', 'NSW · HSC'], ['vic', 'VIC · VCE'], ['qld', 'QLD · QCE'], ['wa', 'WA · WACE'], ['sa', 'SA · SACE'], ['ib', 'IB']];
// Where the cloud account UI lives. The panel is Settings' own; this screen only links to it.
export const CLOUD_ACCOUNT_ROUTE = '/settings#cloud-account-title';
const GLYPHS = ['∑', '∫', '∬', 'π', 'θ', 'Ω', 'Δ', 'Γ', 'Φ', 'λ', 'ε', 'δ', 'η', 'ρ', 'ξ', 'ζ', 'χ', 'ψ', '√', '∞', '≈', '≠', '≤', '≥', '±', '÷', '∈', '∉', '∀', '∃', '⊂', '∪', '∩', 'ℵ', 'ℝ', 'ℤ', 'ℚ', 'ℂ', 'ℕ', '∂', '∇', '↦', '⇌', '∘', 'ϕ', '⊕', '≡', '⟨', '⟩', '4', '2', 'e', 'i', 'x', 'dx'];

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** The signature backdrop — a quiet field of mathematical symbols. */
export function MathField({ n = 90 }) {
  const glyphs = useMemo(() => Array.from({ length: n }, (_, i) => {
    const g = GLYPHS[Math.floor(hash01(`g${i}`) * GLYPHS.length)];
    return {
      g,
      left: hash01(`x${i}`) * 100,
      top: hash01(`y${i}`) * 100,
      size: 11 + hash01(`s${i}`) * 15,
      op: 0.05 + hash01(`o${i}`) * 0.16,
      rot: (hash01(`r${i}`) - 0.5) * 40,
    };
  }), [n]);
  return (
    <div className="mathfield" aria-hidden="true">
      {glyphs.map((s, i) => (
        <span key={i} style={{
          left: `${s.left}%`, top: `${s.top}%`, fontSize: s.size,
          opacity: s.op, transform: `rotate(${s.rot}deg)`
        }}>{s.g}</span>
      ))}
    </div>
  );
}

/* ── in-house marks: this device, and the lock that keeps a profile shut ── */
const Marks = {
  device: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4.5" y="2.5" width="15" height="19" rx="2.2" /><path d="M9.6 5.1h4.8" /><path d="M9.9 18.6h4.2" /></svg>,
  lock: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1.8" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></svg>,
  // The Apple mark, drawn to the Sign in with Apple guidelines (filled glyph,
  // the button's text colour).
  apple: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M16.37 12.74c.02 2.3 2.02 3.07 2.04 3.08-.02.05-.32 1.1-1.05 2.17-.63.93-1.29 1.86-2.33 1.88-1.02.02-1.35-.6-2.51-.6-1.17 0-1.53.58-2.5.62-1 .04-1.76-1-2.4-1.93-1.3-1.89-2.3-5.34-.96-7.67.66-1.16 1.85-1.89 3.14-1.91.98-.02 1.9.66 2.5.66.6 0 1.73-.82 2.91-.7.5.02 1.88.2 2.78 1.51-.07.05-1.66.97-1.62 2.89zM14.45 7.1c.53-.64.88-1.53.79-2.42-.76.03-1.69.51-2.23 1.15-.49.57-.92 1.47-.8 2.34.85.07 1.72-.43 2.24-1.07z" /></svg>,
};

// ── Sign in with Apple ───────────────────────────────────────────────────────
// Shown only when the native shell advertises the identity capability (never on
// plain web, where no Apple client exists). The page theme decides the button
// colour as Apple's guidelines ask: black on a light page, white on a dark one.
const themeSnapshot = () => (typeof document === 'undefined' ? 'dark' : (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
function subscribeTheme(onChange) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
}
export function useDocumentTheme() {
  return useSyncExternalStore(subscribeTheme, themeSnapshot, () => 'dark');
}

/** True when this screen may offer Sign in with Apple at all. */
export const appleSignInOffered = () => appleSignInAvailable() && cloudAvailable();

export function AppleSignInButton({ onClick, disabled = false, busy = false, label, style }) {
  const t = useT();
  const theme = useDocumentTheme();
  const light = theme === 'light';
  return (
    <button type="button" className="btn btn-lg" data-testid="apple-sign-in" disabled={disabled || busy} onClick={onClick}
      aria-busy={busy || undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 44,
        fontWeight: 600, borderRadius: 10,
        background: light ? '#000' : '#fff', color: light ? '#fff' : '#000', border: `1px solid ${light ? '#000' : '#fff'}`,
        ...style
      }}>
      {Marks.apple}
      <span>{busy ? t('login.oneMoment') : (label || t('login.signInWithApple'))}</span>
    </button>
  );
}

// ── Password rules ───────────────────────────────────────────────────────────
// The client half of the on-device gate. A profile password guards a device
// somebody is already holding, so the only defences worth measuring are length
// and not being one of the handful of values that get tried first.

export const MIN_PASSWORD = 8;

const OBVIOUS = new Set([
  'password', 'password1', 'password123', 'passw0rd', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'abcd1234', 'letmein1', 'iloveyou', 'trustno1', 'changeme',
  'football', 'baseball', 'superman', 'sunshine', 'princess', 'welcome1', 'starwars',
  'prilearning', 'mathsrules', 'maths123', 'schoolwork'
]);

const RUNS = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const isRun = (s) => RUNS.some(run => run.includes(s) || [...run].reverse().join('').includes(s));

/**
 * The verdict behind the strength meter. `ok` is the same gate the submit
 * button uses, so the meter can never call something strong that the profile
 * store will turn away.
 *
 * It returns catalogue keys rather than sentences. This function is a pure
 * rule, called from two components and from a plain event handler, and it has
 * no hook to reach a translator with — so the language is decided by whoever
 * renders the verdict, which is the only place that knows.
 */
export function passwordVerdict(raw, { name = '', email = '' } = {}) {
  const pw = String(raw || '');
  const weak = (noteKey, noteVars) => ({ score: 0, labelKey: 'pw.tooEasy', noteKey, noteVars, ok: false });
  if (!pw) return { score: 0, labelKey: null, noteKey: 'pw.atLeast', noteVars: { min: MIN_PASSWORD }, ok: false };
  if (pw.length < MIN_PASSWORD) {
    const missing = MIN_PASSWORD - pw.length;
    return { score: 0, labelKey: 'pw.tooShort', noteKey: 'pw.charsToGo', noteVars: { count: missing, n: missing }, ok: false };
  }
  const flat = pw.toLowerCase();
  if (OBVIOUS.has(flat)) return weak('pw.firstTried');
  if (/^(.)\1+$/.test(pw)) return weak('pw.oneCharRepeated');
  if (isRun(flat)) return weak('pw.keyboardRun');
  const mine = [name, String(email).split('@')[0]].map(s => String(s).trim().toLowerCase()).filter(s => s.length >= 3);
  if (mine.some(s => flat.includes(s) || s.includes(flat))) return weak('pw.readableFromList');
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length;
  const score = Math.min(3, (pw.length >= 16 ? 3 : pw.length >= 12 ? 2 : 1) + (variety >= 3 ? 1 : 0));
  return {
    score,
    labelKey: [null, 'pw.fair', 'pw.good', 'pw.strong'][score],
    noteKey: score >= 3 ? 'pw.holdsUp' : score === 2 ? 'pw.solid' : 'pw.pastMinimum',
    noteVars: undefined,
    ok: true
  };
}

/** Live read-out for a password field: a bar, a word, and what to do next. */
export function PasswordMeter({ verdict }) {
  const t = useT();
  const pct = verdict.ok ? [0, 45, 74, 100][verdict.score] : 10;
  const tone = !verdict.ok ? 'var(--bad)'
    : verdict.score >= 3 ? 'var(--good)'
      : verdict.score === 2 ? 'var(--cream)' : 'var(--warn)';
  return (
    <div style={{ marginTop: 10 }}>
      <div className="meter" aria-hidden="true"><i style={{ width: `${pct}%`, background: tone }} /></div>
      <p className="muted" role="status" style={{ marginTop: 6, fontSize: 12.5 }}>
        {verdict.labelKey && <><b style={{ color: tone }}>{t(verdict.labelKey)}</b> — </>}{t(verdict.noteKey, verdict.noteVars)}
      </p>
    </div>
  );
}

// ── Sign-in lockout ──────────────────────────────────────────────────────────
// After repeated wrong passwords the profile store refuses for a while. The
// deadline arrives either as an instant or as the time left, so both are read.
// When neither is given the store's own words are shown and the field stays
// live: inventing a countdown would be a guess dressed up as a fact.

const REMAINING_KEYS = [['retryAfterMs', 1], ['lockedMs', 1], ['remainingMs', 1], ['retryAfter', 1000], ['lockedFor', 1000], ['lockedSeconds', 1000]];
const SPOKEN_WAIT = /(\d+)\s*(second|minute|hour)/i;
const WAIT_UNIT = { second: 1000, minute: 60000, hour: 3600000 };

const isLockout = (err) =>
  err?.status === 429 || err?.locked === true || err?.lockedOut === true ||
  /too many|locked out|try again in/i.test(String(err?.message || ''));

function lockDeadline(err) {
  for (const key of ['lockedUntil', 'lockUntil', 'until']) {
    const n = Number(err?.[key]);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  }
  for (const [key, unit] of REMAINING_KEYS) {
    const n = Number(err?.[key]);
    if (Number.isFinite(n) && n > 0) return Date.now() + n * unit;
  }
  const spoken = SPOKEN_WAIT.exec(String(err?.message || ''));
  return spoken ? Date.now() + Number(spoken[1]) * WAIT_UNIT[spoken[2].toLowerCase()] : 0;
}

// Takes the translator rather than reaching for one: it is a plain function,
// and a plain function that reads a language it did not receive is a plain
// function that goes stale the moment the language changes.
function fmtWait(ms, t) {
  const secs = Math.max(1, Math.ceil(ms / 1000));
  if (secs < 60) return t('time.seconds', { count: secs, n: secs });
  const mins = Math.ceil(secs / 60);
  if (mins < 60) return t('time.minutes', { count: mins, n: mins });
  const hours = Math.ceil(mins / 60);
  return t('time.hours', { count: hours, n: hours });
}

/**
 * The one language control that exists before a profile does.
 *
 * Without it a Hindi-medium student meets this product in English every single
 * time they open it, because the only other switch lives on a profile they have
 * not made yet. The choice made here is remembered for the device and governs
 * this screen only — the moment a profile is opened, that profile's own
 * language takes over, so nothing here leaks between two students sharing an
 * iPad. Each name is written in its own script, so a Hindi reader can find
 * Hindi whatever the screen currently says.
 */
function LanguagePicker() {
  const { chosen, t } = useLanguage();
  const pick = (id) => { rememberSignInLanguage(id); setLanguage(id); };
  return (
    <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 18 }}
      role="group" aria-label={t('login.chooseLanguage')}>
      {LANGUAGES.map(l => (
        <button key={l.id} type="button" className={`pill-opt ${chosen === l.id ? 'on' : ''}`}
          lang={l.htmlLang} aria-pressed={chosen === l.id}
          aria-label={t('lang.switchTo', { language: l.english })}
          onClick={() => pick(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}

export default function Login({ initialStage = 'hero', initialStep = 0 } = {}) {
  const { setUser, refreshDue } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  // Resolved per render, not at module load, so a development override of the
  // flag (features.js) is honoured; a production build compiles it to a constant.
  const extended = featureEnabled('extendedTracks');
  const study = useMemo(() => studyOptions(extended), [extended]);
  const roles = useMemo(() => roleOptions(extended), [extended]);
  const appleOffered = appleSignInOffered();
  const [profiles, setProfiles] = useState(null);
  const [stage, setStage] = useState(initialStage);   // hero | pick | create | account
  const [accountMode, setAccountMode] = useState('signup');
  const [createStep, setCreateStep] = useState(initialStep);
  const [form, setForm] = useState(freshProfileDraft);
  const [australia, setAustralia] = useState(false);
  const [cloudIntent, setCloudIntent] = useState(false);
  const [unlockId, setUnlockId] = useState(null);
  const [unlockPw, setUnlockPw] = useState('');
  const [lock, setLock] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stepHeadingRef = useRef(null);
  const createPendingRef = useRef(false);

  const load = () => api.get('/profiles').then(r => setProfiles(r.profiles)).catch(() => setProfiles([]));
  useEffect(() => { load(); }, []);

  // Returning users skip the hero
  useEffect(() => {
    if (profiles && profiles.length && stage === 'hero' && localStorage.getItem('pri-seen-hero')) setStage('pick');
  }, [profiles, stage]);

  useEffect(() => {
    if (!lock) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lock]);

  useEffect(() => { if (lock && lock.until <= now) { setLock(null); setError(''); } }, [lock, now]);

  useEffect(() => {
    if (stage !== 'create') return;
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [stage, createStep]);

  const lockedFor = lock && lock.until > now ? lock.until - now : 0;
  const pwVerdict = useMemo(
    () => passwordVerdict(form.password, { name: form.name, email: form.email }),
    [form.password, form.name, form.email]
  );
  const selectedStudy = STUDY.find(o => o.key === form.study) || null;
  const selectedLanguage = LANGUAGES.find(l => l.id === signInLanguage()) || LANGUAGES[0];
  const selectedCourse = AU_COURSES.find(([id]) => id === form.course);
  const studyLabel = form.course === 'in'
    ? (selectedStudy?.track === 'cbse'
        ? t('common.classNumber', { n: form.year })
        : selectedStudy
          ? (selectedStudy.labelKey ? t(selectedStudy.labelKey) : selectedStudy.label) + ' · ' + t('common.classNumber', { n: form.year })
          : t('login.notChosen'))
    : (selectedCourse?.[1] || form.course.toUpperCase()) + ' · ' + t('common.yearNumber', { n: form.year });

  async function go(path, body, { cloud = cloudIntent } = {}) {
    setBusy(true); setError('');
    try {
      const r = await api.post(path, body);
      // Login owns this navigation hook and unmounts as soon as setUser exposes
      // the authenticated shell. Move the cloud handoff first so the destination
      // cannot be lost during that identity transition. The local profile is
      // already authoritative here because the POST completed successfully.
      if (cloud) nav(CLOUD_ACCOUNT_ROUTE, { replace: true, flushSync: true });
      setUser(r.user);
      refreshDue();
      return r;
    } catch (e) {
      setError(e.message);
      if (e.needsPassword && body?.id) setUnlockId(body.id);
      if (path === '/profiles/select' && body?.id && isLockout(e)) {
        const until = lockDeadline(e);
        setUnlockId(body.id);
        if (until > Date.now()) { setLock({ id: body.id, until }); setNow(Date.now()); }
      }
    }
    finally { setBusy(false); }
  }

  const beginCreate = (wantCloud = false) => {
    setForm(freshProfileDraft());
    setAustralia(false);
    setCreateStep(0);
    setCloudIntent(!!wantCloud);
    setUnlockId(null);
    setUnlockPw('');
    setError('');
    setStage('create');
  };

  const enter = () => {
    localStorage.setItem('pri-seen-hero', '1');
    if (profiles?.length) setStage('pick');
    else beginCreate(false);
  };

  /** The README's "Try the demo": one tap from the welcome screen to a seeded
      Class 10 student, without first creating a profile of your own. */
  const tryDemo = () => {
    localStorage.setItem('pri-seen-hero', '1');
    // A cloud sign-in started earlier and backed out of must not send the
    // demo student to the account page.
    setCloudIntent(false);
    void go('/profiles/demo', {}, { cloud: false });
  };

  /** Open/select the local profile first, then hand it to the real cloud account panel. */
  const cloudSignIn = () => {
    localStorage.setItem('pri-seen-hero', '1');
    setCloudIntent(true);
    setError('');
    if (profiles?.length) setStage('pick');
    else beginCreate(true);
  };

  /** Sign in with Apple: the same road — a local profile first — with the
      account panel told to open the Apple sheet as soon as the profile is open.
      The sheet itself is never shown from this screen: the identity it returns
      has to be linked to a profile that exists. */
  const appleSignIn = () => {
    rememberAppleSignInIntent();
    cloudSignIn();
  };

  const pickProfile = (p) => {
    setError('');
    if (p.hasPassword) {
      setUnlockId(unlockId === p.id ? null : p.id);
      setUnlockPw('');
    } else {
      void go('/profiles/select', { id: p.id });
    }
  };

  /** What this local profile studies or teaches: an India class/track or an Australian syllabus. */
  const chooseStudy = (key) => {
    const opt = study.find(o => o.key === key);
    if (!opt) {
      setForm(f => ({ ...f, study: '', course: 'in', indiaTrack: 'cbse', year: STUDY_DEFAULT.year }));
      return;
    }
    setForm(f => ({
      ...f, study: opt.key, course: 'in', indiaTrack: opt.track,
      year: opt.track === 'cbse'
        ? opt.year
        : opt.track === 'olympiad'
          ? Math.min(12, Math.max(7, f.year || opt.year))
          : (f.year >= 11 ? f.year : opt.year)
    }));
  };

  const openAustralia = () => {
    setAustralia(true);
    setForm(f => ({ ...f, study: '', course: 'nsw', year: 10, pathway: 'advanced', indiaTrack: 'cbse' }));
    setError('');
  };

  const closeAustralia = () => {
    setAustralia(false);
    setForm(f => ({ ...f, study: '', course: 'in', year: STUDY_DEFAULT.year, pathway: 'advanced', indiaTrack: 'cbse' }));
    setError('');
  };

  const courseChoiceValid = () => {
    if (form.course === 'in') {
      if (!selectedStudy) return false;
      if ((form.indiaTrack === 'jee-main' || form.indiaTrack === 'jee-advanced') && ![11, 12].includes(Number(form.year))) return false;
      return Number(form.year) >= 7 && Number(form.year) <= 12;
    }
    if (!AU_COURSES.some(([id]) => id === form.course)) return false;
    if (Number(form.year) < 7 || Number(form.year) > 12) return false;
    return !(form.course === 'nsw' && form.pathway === 'ext2' && Number(form.year) !== 12);
  };

  const validateStep = (step = createStep) => {
    let message = '';
    if (step === 0 && !roles.includes(form.role)) message = t('login.roleRequired');
    if (step === 1 && !courseChoiceValid()) message = t('login.courseRequired');
    if (step === 2 && !form.name.trim()) message = t('login.nameRequired');
    if (step === 3) {
      if (form.email && !LOCAL_EMAIL_RE.test(form.email.trim())) message = t('login.emailInvalid');
      else if (form.protect && !pwVerdict.ok) message = t(pwVerdict.noteKey, pwVerdict.noteVars);
      else if (form.protect && form.password !== form.password2) message = t('settings.passwordsDontMatch');
    }
    setError(message);
    return !message;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setError('');
    setCreateStep(step => Math.min(ONBOARDING_STEPS - 1, step + 1));
  };

  const previousStep = () => {
    setError('');
    if (createStep > 0) setCreateStep(step => step - 1);
    else setStage(profiles?.length ? 'pick' : 'hero');
  };

  const create = async () => {
    if (createPendingRef.current || busy) return;
    if (!validateStep(3)) {
      setCreateStep(3);
      return;
    }
    createPendingRef.current = true;
    try {
      const created = await go('/profiles', {
        name: form.name.trim(), year: Number(form.year), avatar: form.avatar, role: form.role,
        language: signInLanguage(),
        course: form.course,
        pathway: form.course === 'nsw' ? form.pathway : undefined,
        indiaTrack: form.course === 'in' ? form.indiaTrack : undefined,
        email: form.email.trim() || undefined,
        password: form.protect ? form.password : undefined
      });
      // A brand-new profile must not inherit the route of whoever opened the
      // picker. Start the new identity at its role-safe product landing.
      if (created && !cloudIntent) nav(form.role === 'teacher' ? '/teach' : '/', { replace: true });
    } finally {
      createPendingRef.current = false;
    }
  };

  /** The account flow is done: make this device's profile, link it, and open the first question. */
  const finishAccount = async ({ account, name, year, track }) => {
    const r = await api.post('/profiles', {
      name: name || account?.name || 'Pri', year: Number(year), avatar: '🚀', role: 'student',
      language: signInLanguage(), course: 'in', indiaTrack: track || 'cbse'
    });
    if (account?.id) {
      const { linkSignedInAccount } = await import('../platform/cloudAccount.js');
      await linkSignedInAccount(r.user.id, account).catch(() => {});
    }
    localStorage.setItem('pri-seen-hero', '1');
    nav('/practice', { replace: true, flushSync: true });
    flushSync(() => setUser(r.user));
    refreshDue();
  };

  const openAccount = (mode) => {
    localStorage.setItem('pri-seen-hero', '1');
    setAccountMode(mode);
    setError('');
    setStage('account');
  };

  const cloudNote = cloudIntent && (
    <p className="muted cloud-intent" role="status" style={{ fontSize: 12.5, marginBottom: 12 }}>
      {t('login.cloudIntent')}
    </p>
  );
  const cloudLink = !cloudIntent && (
    <div style={{ textAlign: 'center', marginTop: 10 }}>
      <button className="linklike" disabled={busy} onClick={cloudSignIn}>{t('login.cloudSignIn')}</button>
    </div>
  );
  const appleEntry = appleOffered && !cloudIntent && (
    <div style={{ marginTop: 12 }}>
      <AppleSignInButton onClick={appleSignIn} disabled={busy} />
      <p className="muted" style={{ fontSize: 12.5, marginTop: 6, textAlign: 'center' }}>{t('login.appleSignInNote')}</p>
    </div>
  );

  /* ── hero ── */
  if (stage === 'hero') {
    return (
      <div className="auth-wrap">
        <MathField />
        <div className="auth-col fade-in">
          <Logo large />
          <div className="hero-kicker">{featureEnabled('extendedTracks') ? 'CBSE · NCERT · JEE MAIN · JEE ADVANCED · OLYMPIAD' : 'CBSE · NCERT · JEE MAIN · JEE ADVANCED'}</div>
          {/* The gold word is a slot, not a tail fragment: Hindi puts the verb
              last, so "marked" cannot be the last word of the sentence there. */}
          <h1 className="hero-title">{tx('login.heroTitle', {
            br: <br />,
            marked: <span className="gold">{t('login.heroMarked')}</span>
          })}</h1>
          <p className="hero-sub">{t('login.heroSub')}</p>
          <div className="row" style={{ marginTop: 34 }}>
            <button className="btn btn-primary btn-lg" data-testid="hero-create-account" onClick={() => openAccount('signup')}>{t('login.createAccount')}</button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-lg" onClick={enter}>{t('login.getStarted')}</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="linklike" type="button" data-testid="hero-sign-in-code" onClick={() => openAccount('signin')}>{t('login.signInWithCode')}</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="linklike" type="button" data-testid="hero-try-demo" disabled={busy} onClick={tryDemo}>
              {t('login.tryDemoIndia')}
            </button>
          </div>
          {error && <div className="error-box" role="alert" style={{ marginTop: 12 }}>{error}</div>}
          <p className="muted" style={{ marginTop: 26, textAlign: 'center' }}>{t('login.heroPrivacy')}</p>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button className="linklike" onClick={cloudSignIn}>{t('login.cloudSignIn')}</button>
          </div>
          {appleEntry}
          <LanguagePicker />
          {/* A store reviewer, a payment provider and a parent all look for
              these, and each is required of us before the app can be sold. */}
          <p className="muted" style={{ marginTop: 22, textAlign: 'center', fontSize: 12.5 }}>
            <Link to="/privacy">{t('login.privacy')}</Link> · <Link to="/terms">{t('login.terms')}</Link> ·{' '}
            <Link to="/refund-policy">{t('login.refunds')}</Link> · <Link to="/grievance">{t('login.grievances')}</Link>
          </p>
        </div>
      </div>
    );
  }

  /* ── account: phone / email / Google / Apple, then a parent if needed ── */
  if (stage === 'account') {
    return (
      <div className="auth-wrap">
        <div className="auth-col">
          <React.Suspense fallback={<p className="muted" role="status">{t('common.loading')}</p>}>
          <SignUpFlow
            key={accountMode}
            initialMode={accountMode}
            onCancel={() => setStage('hero')}
            onStartOffline={() => beginCreate(false)}
            onFinish={finishAccount}
          />
          </React.Suspense>
        </div>
      </div>
    );
  }

  /* ── split layout: brand panel + auth panel ── */
  return (
    <div className="auth-wrap">
      <MathField n={70} />
      <div className="auth-split fade-in">
        <div className="auth-brand">
          {/* The whole panel used to navigate from an onClick on a <div>: a
              mouse-only route back to the welcome screen. It is a real button
              on the wordmark now, drawn with no chrome of its own. */}
          <button type="button" onClick={() => setStage('hero')}
            aria-label={t('login.backToWelcome')}
            style={{ display: 'block', background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
            <Logo large />
          </button>
          <div className="hero-kicker" style={{ marginTop: 14 }}>{t('login.brandKicker')}</div>
          <div className="auth-points">
            <div className="auth-point"><span className="auth-tick">✓</span>{t('login.point1')}</div>
            <div className="auth-point"><span className="auth-tick">✓</span>{t('login.point2')}</div>
            <div className="auth-point"><span className="auth-tick">✓</span>{t('login.point3')}</div>
            <div className="auth-point"><span className="auth-tick">✓</span>{t('login.point4')}</div>
          </div>
          {stage !== 'create' && <LanguagePicker />}
        </div>

        <div className="auth-panel">
          {stage === 'pick' && (
            <div className="card auth-card slide-up">
              <h1 style={{ marginBottom: 4 }}>{t('login.whosPractising')}</h1>
              <p className="sub" style={{ marginBottom: 16 }}>{t('login.pickToContinue')}</p>
              {cloudNote}
              {error && <div className="error-box" id="profile-picker-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
              <div className="acct-list">
                {(profiles || []).map(p => {
                  const shut = lock?.id === p.id && lockedFor > 0;
                  return (
                    <div key={p.id} className={`acct-row-wrap ${unlockId === p.id ? 'open' : ''}`}>
                      <button className="acct-row" disabled={busy} onClick={() => pickProfile(p)}>
                        <span className="acct-avatar">{p.avatar || '🙂'}</span>
                        <span className="acct-main">
                          <span className="acct-name">{p.name}</span>
                          <span className="acct-sub">
                            {p.role === 'teacher' ? t('login.teacher') : t(p.course === 'in' ? 'common.classNumber' : 'common.yearNumber', { n: p.year })}
                            {p.email ? ` · ${p.email}` : ''}{p.isDemo ? t('login.demoSuffix') : ''}
                          </span>
                        </span>
                        {p.hasPassword && <span className="acct-lock" role="img" aria-label={t('login.passwordProtected')}>{Marks.lock}</span>}
                        <span className="acct-go" aria-hidden="true">→</span>
                      </button>
                      {unlockId === p.id && p.hasPassword && (
                        <>
                          <form className="acct-unlock" onSubmit={e => { e.preventDefault(); if (!shut) void go('/profiles/select', { id: p.id, password: unlockPw }); }}>
                            <input className="input" type="password" placeholder={t('login.password')} autoFocus value={unlockPw} disabled={shut}
                              aria-label={t('login.passwordFor', { name: p.name })} aria-describedby={error ? 'profile-picker-error' : undefined}
                              onChange={e => setUnlockPw(e.target.value)} />
                            <button className="btn btn-primary btn-sm" disabled={busy || shut || !unlockPw} type="submit">{t('login.unlock')}</button>
                          </form>
                          {shut && (
                            <p className="muted" role="status" style={{ padding: '0 13px 12px', margin: 0, fontSize: 12.5 }}>
                              {t('login.lockedForAnother', { wait: fmtWait(lockedFor, t) })}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-ghost" type="button" style={{ width: '100%', marginTop: 14 }} disabled={busy}
                onClick={() => beginCreate(cloudIntent)}>
                {t('login.addAnother')}
              </button>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button className="linklike" type="button" disabled={busy} onClick={() => void go('/profiles/demo', {})}>
                  {t('login.tryDemoIndia')}
                </button>
              </div>
              {cloudLink}
              {appleEntry}
            </div>
          )}

          {stage === 'create' && (
            <div className="card auth-card slide-up" data-onboarding-step={createStep + 1}>
              <div className="spread" style={{ alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span className="prov-badge lg">{Marks.device}</span>
                <span className="sc-label" role="status" aria-live="polite">
                  {t('login.stepOf', { current: createStep + 1, total: ONBOARDING_STEPS })}
                </span>
              </div>
              <div className="goalbar" aria-hidden="true" style={{ marginBottom: 18 }}>
                <i style={{ width: `${((createStep + 1) / ONBOARDING_STEPS) * 100}%` }} />
              </div>
              <h1 ref={stepHeadingRef} tabIndex={-1} style={{ marginBottom: 6 }}>
                {t(['login.stepRoleTitle', 'login.stepCourseTitle', 'login.stepPersonalTitle', 'login.stepProtectTitle', 'login.stepReadyTitle'][createStep])}
              </h1>
              <p className="sub" style={{ marginBottom: 16 }}>
                {t(['login.stepRoleSub', 'login.stepCourseSub', 'login.stepPersonalSub', 'login.stepProtectSub', 'login.stepReadySub'][createStep])}
              </p>
              {error && <div className="error-box" id="onboarding-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}

              {createStep === 0 && (
                <>
                  <div className="field">
                    <div className="label" id="signup-role">{t('login.iAmA')}</div>
                    <div className="pill-select" role="group" aria-labelledby="signup-role">
                      <button type="button" className={`pill-opt ${form.role === 'student' ? 'on' : ''}`}
                        aria-pressed={form.role === 'student'}
                        onClick={() => { setForm(f => ({ ...f, role: 'student' })); setError(''); }}>
                        {t('login.student')}
                      </button>
                      {roles.includes('teacher') && (
                        <button type="button" className={`pill-opt ${form.role === 'teacher' ? 'on' : ''}`}
                          aria-pressed={form.role === 'teacher'}
                          onClick={() => { setForm(f => ({ ...f, role: 'teacher' })); setError(''); }}>
                          {t('login.teacher')}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
                    {t(form.role === 'teacher' ? 'login.teacherRoleNote' : 'login.studentRoleNote')}
                  </p>
                </>
              )}

              {createStep === 1 && !australia && (
                <>
                  <div className="field">
                    <label className="label" htmlFor="signup-track">
                      {t(form.role === 'teacher' ? 'login.imTeaching' : 'login.imStudying')}
                    </label>
                    <select className="input" id="signup-track" value={form.study}
                      aria-describedby={error ? 'onboarding-error' : undefined}
                      onChange={e => { chooseStudy(e.target.value); setError(''); }}>
                      <option value="">{t('login.chooseClassTrack')}</option>
                      {study.map(o => <option key={o.key} value={o.key}>{o.labelKey ? t(o.labelKey) : (o.label || t('common.classNumber', { n: o.classOf }))}</option>)}
                    </select>
                    {selectedStudy && form.indiaTrack !== 'cbse' && (
                      <div style={{ marginTop: 10 }}>
                        <label className="label" htmlFor="signup-year">{t('common.class')}</label>
                        <select className="input" id="signup-year" value={form.year}
                          onChange={e => { setForm(f => ({ ...f, year: Number(e.target.value) })); setError(''); }}>
                          {(form.indiaTrack === 'olympiad' ? [7, 8, 9, 10, 11, 12] : [11, 12])
                            .map(y => <option key={y} value={y}>{t('common.classNumber', { n: y })}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {/* V1 is India-only (frozen scope): the Australian syllabuses are
                      offered only in a build with PRI_FEATURE_AUSTRALIA=1. */}
                  {featureEnabled('australia') && (
                    <div className="field" style={{ marginTop: -4 }}>
                      <button type="button" className="linklike" onClick={openAustralia}>
                        {t(form.role === 'teacher' ? 'login.teachingInAustralia' : 'login.studyingInAustralia')}
                      </button>
                    </div>
                  )}
                </>
              )}

              {createStep === 1 && australia && (
                <>
                  <div className="grid cols-2" style={{ gap: 12 }}>
                    <div className="field">
                      <label className="label" htmlFor="signup-year">{t('settings.schoolYear')}</label>
                      <select className="input" id="signup-year" value={form.year}
                        onChange={e => { setForm(f => ({ ...f, year: Number(e.target.value) })); setError(''); }}>
                        {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>{t('common.yearNumber', { n: y })}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="signup-course">{t('settings.syllabus')}</label>
                      <select className="input" id="signup-course" value={form.course}
                        onChange={e => { setForm(f => ({ ...f, course: e.target.value })); setError(''); }}>
                        {AU_COURSES.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
                      </select>
                    </div>
                  </div>
                  {form.course === 'nsw' && form.year >= 11 && (
                    <div className="field">
                      <div className="label" id="signup-pathway">{t('settings.hscPathway')}</div>
                      <div className="pathway-row" role="group" aria-labelledby="signup-pathway">
                        {[['standard', 'Standard'], ['advanced', 'Advanced'], ['ext1', 'Extension 1'], ['ext2', 'Extension 2']]
                          .filter(([k]) => k !== 'ext2' || form.year === 12)
                          .map(([k, name]) => (
                            <button key={k} type="button" className={`pathway-pick ${form.pathway === k ? 'on' : ''}`}
                              aria-pressed={form.pathway === k}
                              onClick={() => { setForm(f => ({ ...f, pathway: k })); setError(''); }}>
                              <b>{name}</b>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="field" style={{ marginTop: -4 }}>
                    <button type="button" className="linklike" onClick={closeAustralia}>{t('login.backToIndian')}</button>
                  </div>
                </>
              )}

              {createStep === 2 && (
                <>
                  <div className="field">
                    <label className="label" htmlFor="signup-name">{t('settings.name')}</label>
                    <input className="input" id="signup-name" value={form.name} autoComplete="name"
                      placeholder={t('login.namePlaceholder')} aria-invalid={!!error && !form.name.trim()}
                      aria-describedby={error ? 'onboarding-error' : undefined}
                      onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }} />
                  </div>
                  <div className="field">
                    <div className="label">{t('login.chooseLanguage')}</div>
                    <LanguagePicker />
                  </div>
                  <div className="field">
                    <div className="label" id="signup-avatar">{t('settings.avatar')}</div>
                    <div className="avatar-row" role="group" aria-labelledby="signup-avatar">
                      {AVATARS.map(a => (
                        <button key={a} type="button" className={`avatar-pick ${form.avatar === a ? 'on' : ''}`}
                          aria-pressed={form.avatar === a} aria-label={t('settings.avatarPick', { emoji: a })}
                          onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {createStep === 3 && (
                <>
                  <div className="field">
                    <label className="label" htmlFor="signup-email">
                      {t('settings.email')} <span className="muted">{t('login.optional')}</span>
                    </label>
                    <input className="input" id="signup-email" type="email" autoComplete="email" value={form.email}
                      placeholder="you@example.com" aria-invalid={!!error && !!form.email && !LOCAL_EMAIL_RE.test(form.email.trim())}
                      aria-describedby={error ? 'onboarding-error' : 'local-email-note'}
                      onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setError(''); }} />
                    <p className="muted" id="local-email-note" style={{ marginTop: 6, fontSize: 12.5 }}>
                      {t('login.emailNote')}
                    </p>
                  </div>

                  <div className="field">
                    <label className="check-row">
                      <input type="checkbox" checked={form.protect}
                        onChange={e => { setForm(f => ({ ...f, protect: e.target.checked })); setError(''); }} />
                      <span>{t('login.protectWithPassword')}</span>
                    </label>
                    {form.protect && (
                      <>
                        <div className="grid cols-2" style={{ gap: 12, marginTop: 10 }}>
                          <input className="input" id="signup-password" type="password" autoComplete="new-password"
                            placeholder={t('login.password')} value={form.password} aria-label={t('login.password')}
                            aria-describedby={error ? 'onboarding-error' : undefined}
                            onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }} />
                          <input className="input" id="signup-password2" type="password" autoComplete="new-password"
                            placeholder={t('login.repeatPassword')} value={form.password2} aria-label={t('login.repeatPassword')}
                            aria-describedby={error ? 'onboarding-error' : undefined}
                            onChange={e => { setForm(f => ({ ...f, password2: e.target.value })); setError(''); }} />
                        </div>
                        <PasswordMeter verdict={pwVerdict} />
                      </>
                    )}
                  </div>

                  <div className="field">
                    <div className="label" id="signup-cloud-choice">{t('login.cloudChoice')}</div>
                    <div className="pathway-row" role="group" aria-labelledby="signup-cloud-choice">
                      <button type="button" className={`pathway-pick ${!cloudIntent ? 'on' : ''}`}
                        aria-pressed={!cloudIntent} onClick={() => setCloudIntent(false)}>
                        <b>{t('login.localOnly')}</b><span>{t('login.localOnlySub')}</span>
                      </button>
                      <button type="button" className={`pathway-pick ${cloudIntent ? 'on' : ''}`}
                        aria-pressed={cloudIntent} onClick={() => setCloudIntent(true)}>
                        <b>{t('login.connectCloudNext')}</b><span>{t('login.connectCloudNextSub')}</span>
                      </button>
                    </div>
                  </div>
                  <p className="auth-note">{t('login.localCloudHonesty')}</p>
                </>
              )}

              {createStep === 4 && (
                <>
                  <div className="card" style={{ boxShadow: 'none', padding: 16 }}>
                    <div className="spread" style={{ gap: 12 }}><span className="muted">{t('login.summaryRole')}</span><b>{t(form.role === 'teacher' ? 'login.teacher' : 'login.student')}</b></div>
                    <div className="spread" style={{ gap: 12, marginTop: 8 }}><span className="muted">{t('login.summaryCourse')}</span><b>{studyLabel}</b></div>
                    <div className="spread" style={{ gap: 12, marginTop: 8 }}><span className="muted">{t('login.summaryLanguage')}</span><b>{selectedLanguage.label}</b></div>
                    <div className="spread" style={{ gap: 12, marginTop: 8 }}><span className="muted">{t('login.summaryProtection')}</span><b>{t(form.protect ? 'login.protectionOn' : 'login.protectionOff')}</b></div>
                    <div className="spread" style={{ gap: 12, marginTop: 8 }}><span className="muted">{t('login.summaryCloud')}</span><b>{t(cloudIntent ? 'login.cloudNext' : 'login.cloudLater')}</b></div>
                  </div>
                  <p className="sub" style={{ marginTop: 14 }}>
                    {t(form.role === 'teacher' ? 'login.readyTeacher' : 'login.readyStudent')}
                  </p>
                  <p className="muted" style={{ fontSize: 12.5 }}>{t(featureEnabled('placement') ? 'login.placementOffer' : 'login.noFakeDiagnostic')}</p>
                </>
              )}

              <div className="row" style={{ marginTop: 18, gap: 10 }}>
                <button className="btn btn-quiet" type="button" disabled={busy} onClick={previousStep}>
                  {t('login.back')}
                </button>
                {createStep < ONBOARDING_STEPS - 1 ? (
                  <button className="btn btn-primary btn-lg" type="button" style={{ flex: 1 }} disabled={busy} onClick={nextStep}>
                    {t('login.continue')}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-lg" type="button" style={{ flex: 1 }} disabled={busy} onClick={create}>
                    {t(busy ? 'login.oneMoment'
                      : cloudIntent ? 'login.createAndOpenCloud'
                        : form.role === 'teacher' ? 'login.openTeacherWorkspace'
                          : 'login.startLearning')}
                  </button>
                )}
              </div>
              <p className="auth-note" style={{ marginTop: 14 }}>{t('login.createNote')}</p>
            </div>
          )}

          <p className="muted auth-foot">{t('login.authFoot')}</p>
        </div>
      </div>
    </div>
  );
}
