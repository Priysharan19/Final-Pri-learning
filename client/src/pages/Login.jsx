// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Landing + profile entry
// There is no sign-in service behind this screen, and nothing here pretends
// otherwise. A profile is a record in this iPad's own storage — created here,
// unlocked here, wiped here. No provider is contacted, no address is verified,
// no password can be reset by anyone but the person holding the device.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp, Logo } from '../App.jsx';

const AVATARS = ['🚀', '🦊', '🐨', '🦉', '🌟', '🐯', '🍀', '🎧', '🦄', '⚡', '🌊', '🧠'];
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
 */
export function passwordVerdict(raw, { name = '', email = '' } = {}) {
  const pw = String(raw || '');
  if (!pw) return { score: 0, label: '', note: `At least ${MIN_PASSWORD} characters.`, ok: false };
  if (pw.length < MIN_PASSWORD) {
    const missing = MIN_PASSWORD - pw.length;
    return { score: 0, label: 'Too short', note: `${missing} more character${missing === 1 ? '' : 's'} to go.`, ok: false };
  }
  const flat = pw.toLowerCase();
  if (OBVIOUS.has(flat)) return { score: 0, label: 'Too easy to guess', note: 'One of the first values anyone tries.', ok: false };
  if (/^(.)\1+$/.test(pw)) return { score: 0, label: 'Too easy to guess', note: 'A single character repeated is a single guess.', ok: false };
  if (isRun(flat)) return { score: 0, label: 'Too easy to guess', note: 'That is a straight run across the keyboard.', ok: false };
  const mine = [name, String(email).split('@')[0]].map(s => String(s).trim().toLowerCase()).filter(s => s.length >= 3);
  if (mine.some(s => flat.includes(s) || s.includes(flat))) {
    return { score: 0, label: 'Too easy to guess', note: 'Anyone looking at the profile list can already read this.', ok: false };
  }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length;
  const score = Math.min(3, (pw.length >= 16 ? 3 : pw.length >= 12 ? 2 : 1) + (variety >= 3 ? 1 : 0));
  return {
    score,
    label: ['', 'Fair', 'Good', 'Strong'][score],
    note: score >= 3 ? 'Long and varied — this one holds up.'
      : score === 2 ? 'Solid. A few more characters would make it stronger still.'
        : 'Past the minimum. Extra length buys more than extra symbols do.',
    ok: true
  };
}

/** Live read-out for a password field: a bar, a word, and what to do next. */
export function PasswordMeter({ verdict }) {
  const pct = verdict.ok ? [0, 45, 74, 100][verdict.score] : 10;
  const tone = !verdict.ok ? 'var(--bad)'
    : verdict.score >= 3 ? 'var(--good)'
      : verdict.score === 2 ? 'var(--cream)' : 'var(--warn)';
  return (
    <div style={{ marginTop: 10 }}>
      <div className="meter"><i style={{ width: `${pct}%`, background: tone }} /></div>
      <p className="muted" role="status" style={{ marginTop: 6, fontSize: 12.5 }}>
        {verdict.label && <><b style={{ color: tone }}>{verdict.label}</b> — </>}{verdict.note}
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

function fmtWait(ms) {
  const secs = Math.max(1, Math.ceil(ms / 1000));
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'}`;
  const mins = Math.ceil(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.ceil(mins / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export default function Login() {
  const { setUser, refreshDue } = useApp();
  const [profiles, setProfiles] = useState(null);
  const [stage, setStage] = useState('hero');   // hero | pick | method | create
  const [withEmail, setWithEmail] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '', year: 12, avatar: '🚀', role: 'student', course: 'nsw', pathway: 'advanced', protect: false });
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

  const create = () => {
    if (form.protect) {
      if (!pwVerdict.ok) { setError(pwVerdict.note); return; }
      if (form.password !== form.password2) { setError('Those passwords don’t match.'); return; }
    }
    go('/profiles', {
      name: form.name, year: form.year, avatar: form.avatar, role: form.role,
      course: form.course, pathway: form.pathway,
      email: withEmail && form.email ? form.email : undefined,
      password: form.protect ? form.password : undefined
    });
  };

  /* ── hero ── */
  if (stage === 'hero') {
    return (
      <div className="auth-wrap">
        <MathField />
        <div className="auth-col fade-in">
          <Logo large />
          <div className="hero-kicker">NSW · HSC · VCE · QCE · WACE · SACE · IB</div>
          <h1 className="hero-title">The most powerful way to<br />master <span className="gold">Mathematics</span></h1>
          <p className="hero-sub">Over 1.3 million distinct exam-style questions to every dot point · line-by-line marking of handwritten working · entirely on this iPad.</p>
          <div className="row" style={{ marginTop: 34 }}>
            <button className="btn btn-primary btn-lg btn-glow" onClick={enter}>Get Started</button>
          </div>
          <p className="muted" style={{ marginTop: 26, textAlign: 'center' }}>
            100% local — private accounts on this device, no uploads, works fully offline.
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
        <div className="auth-brand" onClick={() => setStage('hero')}>
          <Logo large />
          <div className="hero-kicker" style={{ marginTop: 14 }}>Years 7–12 · HSC ready</div>
          <div className="auth-points">
            <div className="auth-point"><span className="auth-tick">✓</span>1,300,000+ distinct questions across every syllabus dot point</div>
            <div className="auth-point"><span className="auth-tick">✓</span>Handwritten working marked line by line</div>
            <div className="auth-point"><span className="auth-tick">✓</span>An engine that learns exactly how you write</div>
            <div className="auth-point"><span className="auth-tick">✓</span>Private by design — everything stays on this iPad</div>
          </div>
        </div>

        <div className="auth-panel">
          {stage === 'pick' && (
            <div className="card auth-card slide-up">
              <h2 style={{ marginBottom: 4 }}>Who’s practising?</h2>
              <p className="sub" style={{ marginBottom: 16 }}>Pick your profile to continue.</p>
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
                            {p.role === 'teacher' ? 'Teacher' : `Year ${p.year}`}
                            {p.email ? ` · ${p.email}` : ''}{p.isDemo ? ' · demo' : ''}
                          </span>
                        </span>
                        {p.hasPassword && <span className="acct-lock" role="img" aria-label="Password protected">{Marks.lock}</span>}
                        <span className="acct-go" aria-hidden="true">→</span>
                      </button>
                      {unlockId === p.id && p.hasPassword && (
                        <>
                          <form className="acct-unlock" onSubmit={e => { e.preventDefault(); if (!shut) go('/profiles/select', { id: p.id, password: unlockPw }); }}>
                            <input className="input" type="password" placeholder="Password" autoFocus value={unlockPw} disabled={shut}
                              aria-label={`Password for ${p.name}`} onChange={e => setUnlockPw(e.target.value)} />
                            <button className="btn btn-primary btn-sm" disabled={busy || shut || !unlockPw} type="submit">Unlock</button>
                          </form>
                          {shut && (
                            <p className="muted" role="status" style={{ padding: '0 13px 12px', margin: 0, fontSize: 12.5 }}>
                              Locked for another {fmtWait(lockedFor)}.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }} disabled={busy} onClick={() => { setError(''); setStage('method'); }}>
                ＋ Add another profile
              </button>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button className="linklike" disabled={busy} onClick={() => go('/profiles/demo', {})}>
                  Try the demo — six weeks of progress, ready to explore
                </button>
              </div>
            </div>
          )}

          {stage === 'method' && (
            <div className="card auth-card slide-up">
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <span className="prov-badge lg">{Marks.device}</span>
                <h2 style={{ margin: 0 }}>A private profile on this iPad</h2>
              </div>
              <p className="sub" style={{ marginBottom: 18 }}>
                No account is registered and no service is signed in to. Choose how this profile
                should be labelled — everything after that works the same either way.
              </p>
              {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
              <button className="sso-btn sso-email" disabled={busy} onClick={() => startCreate(true)}>
                <span>Continue with email</span>
              </button>
              <div className="sso-or"><i />or<i /></div>
              <button className="sso-btn sso-email" disabled={busy} onClick={() => startCreate(false)}>
                <span>Continue without an email</span>
              </button>
              <p className="auth-note">
                A profile lives on <b>this iPad</b> and nowhere else. An address, if you give one, only
                tells profiles apart here — it is never verified, never used to sign in, and never sent.
              </p>
              {profiles?.length > 0 && (
                <button className="btn btn-quiet btn-sm" style={{ width: '100%', marginTop: 6 }} onClick={() => { setError(''); setStage('pick'); }}>← Back to profiles</button>
              )}
              {!profiles?.length && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button className="linklike" disabled={busy} onClick={() => go('/profiles/demo', {})}>
                    Or try the demo first — six weeks of progress, ready to explore
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'create' && (
            <div className="card auth-card slide-up">
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <span className="prov-badge lg">{Marks.device}</span>
                <h2 style={{ margin: 0 }}>A private profile on this iPad</h2>
              </div>
              <p className="sub" style={{ marginBottom: 14 }}>
                Your name, your work and the handwriting model that learns your hand live in this device’s
                storage — and all of it runs with the Wi-Fi off.
              </p>
              {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="field">
                <label className="label">Name</label>
                <input className="input" value={form.name} autoFocus placeholder="e.g. Priysharan"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              {withEmail && (
                <div className="field">
                  <label className="label">Email <span className="muted">(optional)</span></label>
                  <input className="input" type="email" value={form.email} placeholder="you@example.com"
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
                    Only to tell profiles apart on this device — never verified, never sent.
                  </p>
                </div>
              )}

              <div className="field">
                <label className="label">I am a…</label>
                <div className="pill-select">
                  <button className={`pill-opt ${form.role === 'student' ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, role: 'student' }))}>Student</button>
                  <button className={`pill-opt ${form.role === 'teacher' ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, role: 'teacher' }))}>Teacher</button>
                </div>
              </div>
              {form.role === 'student' && (
                <div className="grid cols-2" style={{ gap: 12 }}>
                  <div className="field">
                    <label className="label">School year</label>
                    <select className="input" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}>
                      {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Syllabus</label>
                    <select className="input" value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))}>
                      <option value="nsw">NSW · HSC</option>
                      <option value="vic">VIC · VCE</option>
                      <option value="qld">QLD · QCE</option>
                      <option value="wa">WA · WACE</option>
                      <option value="sa">SA · SACE</option>
                      <option value="ib">IB</option>
                    </select>
                  </div>
                </div>
              )}
              {form.role === 'student' && form.year >= 11 && (
                <div className="field">
                  <label className="label">HSC pathway</label>
                  <div className="pathway-row">
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
              <div className="field">
                <label className="label">Avatar</label>
                <div className="avatar-row">
                  {AVATARS.map(a => (
                    <button key={a} className={`avatar-pick ${form.avatar === a ? 'on' : ''}`} aria-label={`Avatar ${a}`} onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="check-row">
                  <input type="checkbox" checked={form.protect} onChange={e => setForm(f => ({ ...f, protect: e.target.checked }))} />
                  <span>Protect this profile with a password</span>
                </label>
                {form.protect && (
                  <>
                    <div className="grid cols-2" style={{ gap: 12, marginTop: 10 }}>
                      <input className="input" type="password" placeholder="Password" value={form.password} aria-label="Password"
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                      <input className="input" type="password" placeholder="Repeat password" value={form.password2} aria-label="Repeat password"
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
                  {busy ? 'One moment…' : 'Start learning'}
                </button>
                <button className="btn btn-quiet" onClick={() => { setError(''); setStage('method'); }}>Back</button>
              </div>

              <p className="auth-note">
                No verification email, no reset link, no one to ask: a profile is a record on
                <b> this iPad</b> and nowhere else. A password keeps it to yourself — stored as a salted
                hash in the device’s own storage, never uploaded, and only you can lift it.
              </p>
            </div>
          )}

          <p className="muted auth-foot">
            100% local: profiles, progress and handwriting live in this device’s storage — nothing is uploaded, and it works fully offline.
          </p>
        </div>
      </div>
    </div>
  );
}
