// Landing + sign-in — multi-profile on-device accounts with Apple/Google/email
// style flows. 100% local: the provider buttons create private profiles on this
// iPad (no Apple/Google servers are contacted; nothing ever leaves the device).
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

/* ── provider marks (drawn in-house, monochrome, no third-party assets) ── */
const Marks = {
  apple: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M17.05 12.9c-.02-2.05 1.67-3.03 1.75-3.08-.96-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.03-1.43 2.48-.37 6.16 1.03 8.18.68.99 1.49 2.1 2.55 2.06 1.02-.04 1.41-.66 2.65-.66 1.24 0 1.59.66 2.67.64 1.1-.02 1.8-1 2.47-2 .78-1.14 1.1-2.25 1.12-2.31-.02-.01-2.14-.82-2.13-3.29Z" /><path d="M15.02 6.88c.56-.68.94-1.63.84-2.58-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.57-.86 2.5.9.07 1.83-.46 2.39-1.14Z" /></svg>,
  google: <span className="mark-g" aria-hidden="true">G</span>,
  email: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg>,
  lock: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1.8" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></svg>,
};
const PROVIDER_LABEL = { apple: 'Apple', google: 'Google', email: 'Email' };

export default function Login() {
  const { setUser, refreshDue } = useApp();
  const [profiles, setProfiles] = useState(null);
  const [stage, setStage] = useState('hero');   // hero | pick | method | create
  const [provider, setProvider] = useState('email');
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '', year: 12, avatar: '🚀', role: 'student', course: 'nsw', pathway: 'advanced', protect: false });
  const [unlockId, setUnlockId] = useState(null);   // profile awaiting its password
  const [unlockPw, setUnlockPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/profiles').then(r => setProfiles(r.profiles)).catch(() => setProfiles([]));
  useEffect(() => { load(); }, []);

  // Returning users skip the hero
  useEffect(() => {
    if (profiles && profiles.length && stage === 'hero' && localStorage.getItem('pri-seen-hero')) setStage('pick');
  }, [profiles, stage]);

  async function go(path, body) {
    setBusy(true); setError('');
    try {
      const r = await api.post(path, body);
      setUser(r.user); refreshDue();
    } catch (e) {
      setError(e.message);
      if (e.needsPassword && body?.id) setUnlockId(body.id);
    }
    finally { setBusy(false); }
  }

  const enter = () => { localStorage.setItem('pri-seen-hero', '1'); setStage(profiles?.length ? 'pick' : 'method'); };

  const pickProfile = (p) => {
    setError('');
    if (p.hasPassword) { setUnlockId(unlockId === p.id ? null : p.id); setUnlockPw(''); }
    else go('/profiles/select', { id: p.id });
  };

  const startProvider = (prov) => {
    setProvider(prov); setError('');
    setForm(f => ({ ...f, password: '', password2: '', protect: false }));
    setStage('create');
  };

  const create = () => {
    if (form.protect && form.password !== form.password2) { setError('Those passwords don’t match.'); return; }
    go('/profiles', {
      name: form.name, year: form.year, avatar: form.avatar, role: form.role,
      course: form.course, pathway: form.pathway,
      email: form.email || undefined, provider,
      password: form.protect && form.password ? form.password : undefined
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
                {(profiles || []).map(p => (
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
                      {p.provider && <span className={`prov-badge prov-${p.provider}`} title={`${PROVIDER_LABEL[p.provider]} profile`}>{Marks[p.provider]}</span>}
                      {p.hasPassword && <span className="acct-lock" title="Password protected">{Marks.lock}</span>}
                      <span className="acct-go">→</span>
                    </button>
                    {unlockId === p.id && p.hasPassword && (
                      <form className="acct-unlock" onSubmit={e => { e.preventDefault(); go('/profiles/select', { id: p.id, password: unlockPw }); }}>
                        <input className="input" type="password" placeholder="Password" autoFocus value={unlockPw}
                          onChange={e => setUnlockPw(e.target.value)} />
                        <button className="btn btn-primary btn-sm" disabled={busy || !unlockPw} type="submit">Unlock</button>
                      </form>
                    )}
                  </div>
                ))}
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
              <h2 style={{ marginBottom: 4 }}>Create your account</h2>
              <p className="sub" style={{ marginBottom: 18 }}>Choose how you’d like to sign in.</p>
              {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
              <button className="sso-btn sso-apple" disabled={busy} onClick={() => startProvider('apple')}>
                {Marks.apple}<span>Continue with Apple</span>
              </button>
              <button className="sso-btn sso-google" disabled={busy} onClick={() => startProvider('google')}>
                {Marks.google}<span>Continue with Google</span>
              </button>
              <div className="sso-or"><i />or<i /></div>
              <button className="sso-btn sso-email" disabled={busy} onClick={() => startProvider('email')}>
                {Marks.email}<span>Continue with email</span>
              </button>
              <p className="auth-note">
                Pri Learning is fully private: these create <b>on-device</b> profiles linked to your name and email.
                No Apple or Google servers are contacted — nothing leaves this iPad.
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
                <span className={`prov-badge lg prov-${provider}`}>{Marks[provider]}</span>
                <h2 style={{ margin: 0 }}>
                  {provider === 'apple' ? 'Continue with Apple' : provider === 'google' ? 'Continue with Google' : 'Continue with email'}
                </h2>
              </div>
              <p className="sub" style={{ marginBottom: 14 }}>
                {provider === 'email'
                  ? 'Your details stay in this iPad’s storage — never uploaded.'
                  : `A private on-device profile with your ${PROVIDER_LABEL[provider]} name and email — no servers involved.`}
              </p>
              {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="field">
                <label className="label">Name</label>
                <input className="input" value={form.name} autoFocus placeholder="e.g. Priysharan"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Email <span className="muted">(optional)</span></label>
                <input className="input" type="email" value={form.email} placeholder={provider === 'apple' ? 'you@icloud.com' : provider === 'google' ? 'you@gmail.com' : 'you@example.com'}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>

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
                    <button key={a} className={`avatar-pick ${form.avatar === a ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="check-row">
                  <input type="checkbox" checked={form.protect} onChange={e => setForm(f => ({ ...f, protect: e.target.checked }))} />
                  <span>Protect this profile with a password</span>
                </label>
                {form.protect && (
                  <div className="grid cols-2" style={{ gap: 12, marginTop: 10 }}>
                    <input className="input" type="password" placeholder="Password" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    <input className="input" type="password" placeholder="Repeat password" value={form.password2}
                      onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} />
                  </div>
                )}
              </div>

              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
                  disabled={busy || !form.name.trim() || (form.protect && form.password.length < 4)}
                  onClick={create}>
                  {busy ? 'One moment…' : 'Start learning'}
                </button>
                <button className="btn btn-quiet" onClick={() => { setError(''); setStage('method'); }}>Back</button>
              </div>
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
