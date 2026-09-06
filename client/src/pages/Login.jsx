// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Landing + profile entry
// A profile is a record in this device's own storage — created here, unlocked
// here, wiped here. Nothing on this screen contacts a provider, verifies an
// address or resets a password. The optional Pri cloud account lives in
// Settings: this screen only offers the way there, and never passes a local
// profile off as a cloud sign-in.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp, Logo } from '../App.jsx';
import { LANGUAGES, rememberSignInLanguage, setLanguage, signInLanguage, useLanguage, useT, useTx } from '../i18n/index.js';

const AVATARS = ['🚀', '🦊', '🐨', '🦉', '🌟', '🐯', '🍀', '🎧', '🦄', '⚡', '🌊', '🧠'];
// The first thing a student chooses: what they are studying. Classes 7–12 are
// the CBSE / NCERT track; JEE Main, JEE Advanced and olympiad are tracks of
// their own with a class beneath them.
// JEE Main, JEE Advanced and the olympiad names are printed in Latin on the
// Hindi-medium admit card too, so they are the label in both languages and are
// not catalogue entries. Only "Class {n}" is a phrase that has to translate.
const STUDY = [
  ...[7, 8, 9, 10, 11, 12].map(y => ({ key: String(y), classOf: y, year: y, track: 'cbse' })),
  { key: 'jee-main', label: 'JEE Main', year: 12, track: 'jee-main' },
  { key: 'jee-advanced', label: 'JEE Advanced', year: 12, track: 'jee-advanced' },
  { key: 'olympiad', label: 'Olympiad (IOQM · RMO · INMO)', year: 10, track: 'olympiad' }
];
const STUDY_DEFAULT = STUDY.find(o => o.key === '10');
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
};

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

export default function Login() {
  const { setUser, refreshDue } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  const [profiles, setProfiles] = useState(null);
  const [stage, setStage] = useState('hero');   // hero | pick | method | create
  const [withEmail, setWithEmail] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '', study: STUDY_DEFAULT.key, year: STUDY_DEFAULT.year, avatar: '🚀', role: 'student', course: 'in', pathway: 'advanced', indiaTrack: STUDY_DEFAULT.track, protect: false });
  const [australia, setAustralia] = useState(false);     // the secondary, collapsed Australian option
  const [cloudIntent, setCloudIntent] = useState(false); // came here to sign in to a Pri cloud account
  const [unlockId, setUnlockId] = useState(null);   // profile awaiting its password
  const [unlockPw, setUnlockPw] = useState('');
  const [lock, setLock] = useState(null);           // { id, until } while a profile is shut out
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  const lockedFor = lock && lock.until > now ? lock.until - now : 0;
  const pwVerdict = useMemo(
    () => passwordVerdict(form.password, { name: form.name, email: withEmail ? form.email : '' }),
    [form.password, form.name, form.email, withEmail]
  );

  async function go(path, body) {
    setBusy(true); setError('');
    try {
      const r = await api.post(path, body);
      // Somebody who came for the cloud account is taken straight to it. The
      // panel itself lives in Settings and is the only cloud sign-in there is —
      // a local profile is never passed off as one.
      if (cloudIntent) nav(CLOUD_ACCOUNT_ROUTE);
      setUser(r.user); refreshDue();
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

  const enter = () => { localStorage.setItem('pri-seen-hero', '1'); setStage(profiles?.length ? 'pick' : 'method'); };

  /** The way to the cloud account: open (or make) the device profile it will sync, then land in Settings. */
  const cloudSignIn = () => {
    localStorage.setItem('pri-seen-hero', '1');
    setCloudIntent(true); setError('');
    setStage(profiles?.length ? 'pick' : 'method');
  };

  const pickProfile = (p) => {
    setError('');
    if (p.hasPassword) { setUnlockId(unlockId === p.id ? null : p.id); setUnlockPw(''); }
    else go('/profiles/select', { id: p.id });
  };

  const startCreate = (useEmail) => {
    setWithEmail(useEmail); setError('');
    setForm(f => ({ ...f, password: '', password2: '', protect: false }));
    setStage('create');
  };

  /** What the student is studying: a class on the CBSE / NCERT track, or a JEE / olympiad track with its own class. */
  const chooseStudy = (key) => {
    const opt = STUDY.find(o => o.key === key) || STUDY_DEFAULT;
    setForm(f => ({
      ...f, study: opt.key, course: 'in', indiaTrack: opt.track,
      year: opt.track === 'cbse' ? opt.year : opt.track === 'olympiad' ? f.year : (f.year >= 11 ? f.year : opt.year)
    }));
  };
  const openAustralia = () => { setAustralia(true); setForm(f => ({ ...f, course: 'nsw', indiaTrack: 'cbse' })); };
  const closeAustralia = () => { setAustralia(false); chooseStudy(form.study); };

  const create = () => {
    if (form.protect) {
      if (!pwVerdict.ok) { setError(t(pwVerdict.noteKey, pwVerdict.noteVars)); return; }
      if (form.password !== form.password2) { setError(t('settings.passwordsDontMatch')); return; }
    }
    go('/profiles', {
      name: form.name, year: form.year, avatar: form.avatar, role: form.role,
      // The new profile keeps the language this screen was read in, so a
      // student who chose Hindi to sign up does not land on a Home in English.
      language: signInLanguage(),
      course: form.course, pathway: form.course === 'nsw' ? form.pathway : undefined, indiaTrack: form.course === 'in' ? form.indiaTrack : undefined,
      email: withEmail && form.email ? form.email : undefined,
      password: form.protect ? form.password : undefined
    });
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

  /* ── hero ── */
  if (stage === 'hero') {
    return (
      <div className="auth-wrap">
        <MathField />
        <div className="auth-col fade-in">
          <Logo large />
          <div className="hero-kicker">CBSE · NCERT · JEE MAIN · JEE ADVANCED · OLYMPIAD</div>
          {/* The gold word is a slot, not a tail fragment: Hindi puts the verb
              last, so "marked" cannot be the last word of the sentence there. */}
          <h1 className="hero-title">{tx('login.heroTitle', {
            br: <br />,
            marked: <span className="gold">{t('login.heroMarked')}</span>
          })}</h1>
          <p className="hero-sub">{t('login.heroSub')}</p>
          <div className="row" style={{ marginTop: 34 }}>
            <button className="btn btn-primary btn-lg btn-glow" onClick={enter}>{t('login.getStarted')}</button>
          </div>
          <p className="muted" style={{ marginTop: 26, textAlign: 'center' }}>{t('login.heroPrivacy')}</p>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button className="linklike" onClick={cloudSignIn}>{t('login.cloudSignIn')}</button>
          </div>
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
          <LanguagePicker />
        </div>

        <div className="auth-panel">
          {/* Each stage draws its own title as an <h2> sized for its card, so the
              page's one heading is spoken rather than drawn. */}
          <h1 className="sr-only">
            {t(stage === 'pick' ? 'login.h1Pick' : stage === 'method' ? 'login.h1Method' : 'login.h1Create')}
          </h1>
          {stage === 'pick' && (
            <div className="card auth-card slide-up">
              <h2 style={{ marginBottom: 4 }}>{t('login.whosPractising')}</h2>
              <p className="sub" style={{ marginBottom: 16 }}>{t('login.pickToContinue')}</p>
              {cloudNote}
              {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
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
                          <form className="acct-unlock" onSubmit={e => { e.preventDefault(); if (!shut) go('/profiles/select', { id: p.id, password: unlockPw }); }}>
                            <input className="input" type="password" placeholder={t('login.password')} autoFocus value={unlockPw} disabled={shut}
                              aria-label={t('login.passwordFor', { name: p.name })} onChange={e => setUnlockPw(e.target.value)} />
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
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }} disabled={busy} onClick={() => { setError(''); setStage('method'); }}>
                {t('login.addAnother')}
              </button>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button className="linklike" disabled={busy} onClick={() => go('/profiles/demo', {})}>
                  {t('login.tryDemoIndia')}
                </button>
              </div>
              {cloudLink}
            </div>
          )}

          {stage === 'method' && (
            <div className="card auth-card slide-up">
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <span className="prov-badge lg">{Marks.device}</span>
                <h2 style={{ margin: 0 }}>{t('login.privateProfile')}</h2>
              </div>
              <p className="sub" style={{ marginBottom: 18 }}>{t('login.methodSub')}</p>
              {cloudNote}
              {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
              <button className="sso-btn sso-email" disabled={busy} onClick={() => startCreate(true)}>
                <span>{t('login.continueWithEmail')}</span>
              </button>
              <div className="sso-or"><i />{t('login.or')}<i /></div>
              <button className="sso-btn sso-email" disabled={busy} onClick={() => startCreate(false)}>
                <span>{t('login.continueWithoutEmail')}</span>
              </button>
              <p className="auth-note">{t('login.methodNote')}</p>
              {profiles?.length > 0 && (
                <button className="btn btn-quiet btn-sm" style={{ width: '100%', marginTop: 6 }} onClick={() => { setError(''); setStage('pick'); }}>{t('login.backToProfiles')}</button>
              )}
              {!profiles?.length && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  {/* A visitor who has opened the Australian syllabuses should
                      see the Australian demo, not an NCERT one. */}
                  <button className="linklike" disabled={busy} onClick={() => go('/profiles/demo', australia ? { course: 'nsw' } : {})}>
                    {t(australia ? 'login.orTryDemoAustralia' : 'login.orTryDemoIndia')}
                  </button>
                </div>
              )}
              {cloudLink}
            </div>
          )}

          {stage === 'create' && (
            <div className="card auth-card slide-up">
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <span className="prov-badge lg">{Marks.device}</span>
                <h2 style={{ margin: 0 }}>{t('login.privateProfile')}</h2>
              </div>
              <p className="sub" style={{ marginBottom: 14 }}>{t('login.createSub')}</p>
              {cloudNote}
              {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="field">
                <label className="label" htmlFor="signup-name">{t('settings.name')}</label>
                <input className="input" id="signup-name" value={form.name} autoFocus placeholder={t('login.namePlaceholder')}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              {withEmail && (
                <div className="field">
                  <label className="label" htmlFor="signup-email">{t('settings.email')} <span className="muted">{t('login.optional')}</span></label>
                  <input className="input" id="signup-email" type="email" value={form.email} placeholder="you@example.com"
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
                    {t('login.emailNote')}
                  </p>
                </div>
              )}

              <div className="field">
                <div className="label" id="signup-role">{t('login.iAmA')}</div>
                <div className="pill-select" role="group" aria-labelledby="signup-role">
                  <button className={`pill-opt ${form.role === 'student' ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, role: 'student' }))}>{t('login.student')}</button>
                  <button className={`pill-opt ${form.role === 'teacher' ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, role: 'teacher' }))}>{t('login.teacher')}</button>
                </div>
              </div>

              {/* The first thing a student chooses is what they are studying:
                  a class on the CBSE / NCERT track, or JEE / olympiad. The
                  Australian syllabuses are a step away, folded up. */}
              {form.role === 'student' && !australia && (
                <div className="field">
                  <label className="label" htmlFor="signup-track">{t('login.imStudying')}</label>
                  <select className="input" id="signup-track" value={form.study} onChange={e => chooseStudy(e.target.value)}>
                    {STUDY.map(o => <option key={o.key} value={o.key}>{o.label || t('common.classNumber', { n: o.classOf })}</option>)}
                  </select>
                  {form.indiaTrack !== 'cbse' && (
                    <div style={{ marginTop: 10 }}>
                      <label className="label" htmlFor="signup-year">{t('common.class')}</label>
                      <select className="input" id="signup-year" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}>
                        {(form.indiaTrack === 'olympiad' ? [7, 8, 9, 10, 11, 12] : [11, 12]).map(y => <option key={y} value={y}>{t('common.classNumber', { n: y })}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {form.role === 'student' && !australia && (
                <div className="field" style={{ marginTop: -4 }}>
                  <button type="button" className="linklike" onClick={openAustralia}>{t('login.studyingInAustralia')}</button>
                </div>
              )}
              {form.role === 'student' && australia && (
                <>
                  <div className="grid cols-2" style={{ gap: 12 }}>
                    <div className="field">
                      <label className="label" htmlFor="signup-year">{t('settings.schoolYear')}</label>
                      <select className="input" id="signup-year" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}>
                        {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>{t('common.yearNumber', { n: y })}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="signup-course">{t('settings.syllabus')}</label>
                      <select className="input" id="signup-course" value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))}>
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
                              onClick={() => setForm(f => ({ ...f, pathway: k }))}>
                              <b>{name}</b>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="field" style={{ marginTop: -4 }}>
                    <button type="button" className="linklike" onClick={closeAustralia}>{t('login.backToIndian')}</button>
                    {/* A visitor who has chosen an Australian syllabus should be
                        able to try the Australian demo, not an NCERT one. */}
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="linklike" disabled={busy} onClick={() => go('/profiles/demo', { course: 'nsw' })}>
                        {t('login.tryAustralianDemo')}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="field">
                <div className="label" id="signup-avatar">{t('settings.avatar')}</div>
                <div className="avatar-row" role="group" aria-labelledby="signup-avatar">
                  {AVATARS.map(a => (
                    <button key={a} className={`avatar-pick ${form.avatar === a ? 'on' : ''}`} aria-label={t('settings.avatarPick', { emoji: a })} onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="check-row">
                  <input type="checkbox" checked={form.protect} onChange={e => setForm(f => ({ ...f, protect: e.target.checked }))} />
                  <span>{t('login.protectWithPassword')}</span>
                </label>
                {form.protect && (
                  <>
                    <div className="grid cols-2" style={{ gap: 12, marginTop: 10 }}>
                      <input className="input" id="signup-password" type="password" placeholder={t('login.password')} value={form.password} aria-label={t('login.password')}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                      <input className="input" id="signup-password2" type="password" placeholder={t('login.repeatPassword')} value={form.password2} aria-label={t('login.repeatPassword')}
                        onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} />
                    </div>
                    <PasswordMeter verdict={pwVerdict} />
                  </>
                )}
              </div>

              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
                  disabled={busy || !form.name.trim() || (form.protect && !pwVerdict.ok)}
                  onClick={create}>
                  {t(busy ? 'login.oneMoment' : 'login.startLearning')}
                </button>
                <button className="btn btn-quiet" onClick={() => { setError(''); setStage('method'); }}>{t('login.back')}</button>
              </div>

              <p className="auth-note">{t('login.createNote')}</p>
            </div>
          )}

          <p className="muted auth-foot">{t('login.authFoot')}</p>
        </div>
      </div>
    </div>
  );
}
