import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { downloadJSON, readJSONFile, dateStamp } from '../lib/files.js';
import Calibrate from '../ink/Calibrate.jsx';
import { personalStats, clearPersonal, ensurePersonalLoaded } from '../ink/personal.js';
import { MIN_PASSWORD, PasswordMeter, passwordVerdict } from './Login.jsx';

const AVATARS = ['🚀', '🦊', '🐨', '🦉', '🌟', '🐯', '🍀', '🎧', '🦄', '⚡', '🌊', '🧠'];
const COURSES = [['nsw', 'NSW · HSC'], ['vic', 'VIC · VCE'], ['qld', 'QLD · QCE'], ['wa', 'WA · WACE'], ['sa', 'SA · SACE'], ['ib', 'IB']];
export const PATHWAY_OPTS = [
  ['standard', 'Standard', 'Everyday maths — finance, measurement, networks'],
  ['advanced', 'Advanced', 'Functions, calculus and statistics — the classic HSC course'],
  ['ext1', 'Extension 1', 'Advanced plus vectors, induction, further calculus'],
  ['ext2', 'Extension 2', 'Year 12 only — proof, complex numbers, mechanics']
];

const fmtBytes = (b) => b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`;

function HandwritingSection({ toast }) {
  const [teaching, setTeaching] = useState(false);
  const [, refresh] = useState(0);
  useEffect(() => { ensurePersonalLoaded().then(() => refresh(x => x + 1)); }, []);
  const stats = personalStats();

  if (teaching) {
    return <Calibrate toast={toast} onDone={() => { setTeaching(false); refresh(x => x + 1); }} />;
  }
  return (
    <div className="card">
      <h2 style={{ marginBottom: 8 }}>✒ Handwriting</h2>
      <p className="sub" style={{ marginBottom: 12 }}>
        The recogniser reads your ink with a two-model neural ensemble trained on ~142,000 handwriting
        samples, cross-checked by geometric matching, a maths-aware decoder and a grammar search — and it
        <b> learns your hand</b>: every correction becomes a personal template that outranks the built-in
        shapes, kept separately for each profile on this iPad.
      </p>
      <div className="set-row">
        <span className="set-k">Personal templates learned</span>
        <span className="set-v">{stats.total === 0 ? 'None yet' : `${stats.total} across ${Object.keys(stats.bySymbol).length} symbols`}</span>
      </div>
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setTeaching(true)}>✒ Teach it your handwriting (2 min)</button>
        {stats.total > 0 && (
          <button className="btn btn-quiet btn-sm" onClick={async () => { await clearPersonal(); refresh(x => x + 1); toast('Learned handwriting cleared'); }}>
            Reset learned handwriting
          </button>
        )}
      </div>
    </div>
  );
}

const SECTIONS = [
  ['plan', '♛', 'Plan'],
  ['profile', '☺', 'Profile'],
  ['security', '⚿', 'Account & Security'],
  ['handwriting', '✒', 'Handwriting'],
  ['appearance', '◐', 'Appearance'],
  ['courses', '📖', 'Courses'],
  ['data', '⇅', 'Data & Backup'],
  ['help', '?', 'Help & Safety'],
];

function SecuritySection({ toast }) {
  const { user, setUser } = useApp();
  const [email, setEmail] = useState(user.email || '');
  const [editEmail, setEditEmail] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', next2: '' });
  const [busy, setBusy] = useState(false);
  const pwVerdict = passwordVerdict(pw.next, { name: user.name, email: user.email || '' });

  const saveEmail = async () => {
    setBusy(true);
    try {
      const r = await api.patch('/me', { email });
      setUser(r.user); setEditEmail(false);
      toast(<span>Email updated</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  };

  const savePassword = async (remove = false) => {
    if (!remove) {
      if (!pwVerdict.ok) { toast(<span>{pwVerdict.note}</span>); return; }
      if (pw.next !== pw.next2) { toast(<span>Those passwords don’t match.</span>); return; }
    }
    setBusy(true);
    try {
      const r = await api.post('/profiles/password', { current: pw.current, next: remove ? '' : pw.next });
      setUser(r.user); setPwOpen(false); setPw({ current: '', next: '', next2: '' });
      toast(<span>{remove ? 'Password removed' : 'Password saved — you’ll need it at sign-in'}</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: 8 }}>⚿ Account & Security</h2>
      <div className="set-row">
        <span className="set-k">Account type</span>
        <span className="set-v">Private profile on this device — no sign-in service</span>
      </div>
      <div className="set-row">
        <span className="set-k">Email</span>
        {!editEmail ? (
          <span className="set-v" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {user.email || <span className="muted">not set</span>}
            <button className="btn btn-quiet btn-sm" aria-label="Edit account email"
              onClick={() => { setEmail(user.email || ''); setEditEmail(true); }}>✎</button>
          </span>
        ) : (
          <span style={{ display: 'flex', gap: 8 }}>
            <input className="input" id="set-email" type="email" value={email} placeholder="you@example.com" style={{ width: 220 }}
              aria-label="Account email" onChange={e => setEmail(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveEmail}>Save</button>
            <button className="btn btn-quiet btn-sm" onClick={() => setEditEmail(false)}>Cancel</button>
          </span>
        )}
      </div>
      <div className="set-row">
        <span className="set-k">Profile password</span>
        <span className="set-v" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {user.hasPassword ? <span style={{ color: 'var(--good)' }}>On — asked at sign-in</span> : <span className="muted">Off</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setPwOpen(o => !o)}>{user.hasPassword ? 'Change' : 'Set password'}</button>
        </span>
      </div>
      {pwOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
          <div className="grid cols-2" style={{ gap: 12 }}>
            {user.hasPassword && (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="set-pw-current">Current password</label>
                <input className="input" id="set-pw-current" type="password" value={pw.current} aria-label="Current password"
                  onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="set-pw-next">New password</label>
              <input className="input" id="set-pw-next" type="password" value={pw.next} aria-label="New password"
                onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label" htmlFor="set-pw-next2">Repeat it</label>
              <input className="input" id="set-pw-next2" type="password" value={pw.next2} aria-label="Repeat new password"
                onChange={e => setPw(p => ({ ...p, next2: e.target.value }))} />
            </div>
          </div>
          <PasswordMeter verdict={pwVerdict} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" disabled={busy || !pwVerdict.ok} onClick={() => savePassword(false)}>
              {user.hasPassword ? 'Change password' : 'Turn protection on'}
            </button>
            {user.hasPassword && (
              <button className="btn btn-quiet btn-sm" disabled={busy || !pw.current} onClick={() => savePassword(true)}>Remove password</button>
            )}
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            At least {MIN_PASSWORD} characters. Stored as a salted PBKDF2 hash in this device’s storage — it locks
            your profile on this iPad, and is never uploaded anywhere.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, setUser, toast } = useApp();
  const [storageInfo, setStorageInfo] = useState(null);
  const [active, setActive] = useState('plan');
  const importRef = useRef(null);
  const secRefs = useRef({});
  useEffect(() => { api.get('/data/storage').then(setStorageInfo).catch(() => { }); }, []);
  const [form, setForm] = useState({ name: user.name, year: user.year, dailyGoal: user.dailyGoal, course: user.course, avatar: user.avatar, pathway: user.pathway || 'advanced' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(null);   // { name, password, error, busy } while the wipe is being confirmed

  const goto = (k) => {
    setActive(k);
    secRefs.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  async function save() {
    setBusy(true);
    try {
      const r = await api.patch('/me', form);
      setUser(r.user);
      setEditing(false);
      toast(<span>Settings saved</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  }

  async function setTheme(theme) {
    setUser({ ...user, theme });
    try { await api.patch('/me', { theme }); } catch { }
  }

  async function switchProfile() {
    await api.post('/auth/logout');
    setUser(null);
  }

  // ── Deleting a profile ─────────────────────────────────────────────────────
  // The profile store turns away a protected profile that arrives without its
  // password, and any profile that arrives without an explicit confirmation.
  // Both are gathered from the person doing it rather than filled in on their
  // behalf: the password is typed, and `confirmName` carries the name they
  // typed back, so a mis-click can never satisfy either check.
  async function deleteProfile() {
    const typed = (del?.name || '').trim();
    const expected = String(user.name || '').trim();
    if (typed.toLowerCase() !== expected.toLowerCase()) {
      setDel(d => ({ ...d, error: `Type the profile name — “${expected}” — to confirm.` }));
      return;
    }
    if (user.hasPassword && !del?.password) {
      setDel(d => ({ ...d, error: 'Enter this profile’s password to delete it.' }));
      return;
    }
    setDel(d => ({ ...d, error: '', busy: true }));
    try {
      await api.post('/profiles/delete', {
        id: user.id, password: del?.password || undefined, confirm: true, confirmName: typed
      });
      setUser(null);
    } catch (e) {
      setDel(d => (d ? { ...d, error: e.message, busy: false } : d));
      toast(<span>{e.message}</span>);
    }
  }

  async function exportBackup() {
    try {
      const data = await api.get('/data/export');
      downloadJSON(data, `pri-learning-backup-${user.name.replace(/\s+/g, '-').toLowerCase()}-${dateStamp()}.json`);
      toast(<span>Backup exported — keep it somewhere safe</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
  }

  async function exportProgressFile() {
    try {
      const data = await api.get('/data/progress-file');
      downloadJSON(data, `pri-progress-${user.name.replace(/\s+/g, '-').toLowerCase()}-${dateStamp()}.json`);
      toast(<span>Progress file exported — send it to your teacher</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
  }

  async function importBackup(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = await readJSONFile(f);
      const r = await api.post('/data/import', data);
      // A restored profile has no password, so if the original had one the user
      // has just lost that protection. Saying "restored" and nothing else lets
      // them walk away believing the profile is still locked.
      toast(r.unprotected
        ? <span>Backup restored — {r.rows.toLocaleString()} records. This profile has <strong>no password</strong>; set one in Account to protect it again.</span>
        : <span>Backup restored — {r.rows.toLocaleString()} records</span>);
      setUser(r.user);
    } catch (err) { toast(<span>{err.message}</span>); }
  }

  const usagePct = storageInfo && storageInfo.quota > 0 ? Math.min(100, Math.round(100 * storageInfo.usage / storageInfo.quota)) : 0;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Settings</h1>
      <div className="settings-grid">
        <div className="set-menu no-print">
          {SECTIONS.map(([k, ico, label]) => (
            <button key={k} className={`set-menu-item ${active === k ? 'on' : ''}`} onClick={() => goto(k)}>
              <span style={{ width: 18, textAlign: 'center' }}>{ico}</span>{label}
            </button>
          ))}
        </div>

        <div className="grid" style={{ gap: 18 }}>
          {/* ── Plan ── */}
          <div className="card" ref={el => secRefs.current.plan = el}>
            <h2>Local Plan</h2>
            <p className="muted" style={{ margin: '4px 0 14px' }}>Everything unlocked — no account, no subscription, no limits</p>
            <div className="spread" style={{ fontSize: 14 }}>
              <span className="sub">Question bank</span><span>1,329,679+ distinct — measured, still growing</span>
            </div>
            <div className="meter" style={{ margin: '6px 0 14px' }}><i style={{ width: '100%' }} /></div>
            <div className="set-row"><span className="set-k">Status</span><span className="set-v" style={{ color: 'var(--good)' }}>Active</span></div>
            <div className="set-row"><span className="set-k">All difficulties (D1–D4)</span><span className="set-v">✓</span></div>
            <div className="set-row"><span className="set-k">All courses & pathways</span><span className="set-v">✓</span></div>
            <div className="set-row"><span className="set-k">Hints, exams, match, analytics</span><span className="set-v">✓</span></div>
          </div>

          {/* ── Account information ── */}
          <div className="card">
            <h2 style={{ marginBottom: 8 }}>Account Information</h2>
            <div className="set-row"><span className="set-k">⌂ Data location</span><span className="set-v">{storageInfo?.native ? 'Native app storage — this iPad' : 'This device — browser storage'}</span></div>
            <div className="set-row">
              <span className="set-k">🛡 Storage protection</span>
              <span className="set-v" style={{ color: storageInfo?.native || storageInfo?.persisted ? 'var(--good)' : 'var(--warn)' }}>
                {storageInfo?.native ? 'App sandbox — nothing can evict it' : storageInfo?.persisted ? 'Protected — browser won’t evict' : 'Pending — keep using the app'}
              </span>
            </div>
            {storageInfo && storageInfo.quota > 0 && (
              <div className="set-row"><span className="set-k"># Space used</span><span className="set-v">{fmtBytes(storageInfo.usage)} of {fmtBytes(storageInfo.quota)} ({usagePct}%)</span></div>
            )}
            <div className="set-row"><span className="set-k">✉ Accounts</span><span className="set-v">Private on-device profiles — nothing ever leaves this device</span></div>
          </div>

          {/* ── Profile ── */}
          <div className="card" ref={el => secRefs.current.profile = el}>
            <div className="spread">
              <h2>☺ Profile Information</h2>
              {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✎ Edit</button>}
            </div>
            {!editing ? (
              <div style={{ marginTop: 8 }}>
                <div className="set-row"><span className="set-k">Full name</span><span className="set-v">{user.name}</span></div>
                <div className="set-row"><span className="set-k">Avatar</span><span className="set-v" style={{ fontSize: 20 }}>{user.avatar}</span></div>
                {user.role !== 'teacher' && <div className="set-row"><span className="set-k">Year level</span><span className="set-v">Year {user.year}</span></div>}
                <div className="set-row"><span className="set-k">Course</span><span className="set-v">{user.courseLabel}</span></div>
                <div className="set-row"><span className="set-k">Daily goal</span><span className="set-v">{user.dailyGoal} questions</span></div>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div className="field">
                  <label className="label" htmlFor="set-name">Name</label>
                  <input className="input" id="set-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="field">
                  <div className="label" id="set-avatar">Avatar</div>
                  <div className="avatar-row" role="group" aria-labelledby="set-avatar">
                    {AVATARS.map(a => (
                      <button key={a} className={`avatar-pick ${form.avatar === a ? 'on' : ''}`}
                        aria-label={`Avatar ${a}`} aria-pressed={form.avatar === a}
                        onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
                    ))}
                  </div>
                </div>
                {user.role !== 'teacher' && (
                  <div className="grid cols-2" style={{ gap: 12 }}>
                    <div className="field">
                      <label className="label" htmlFor="set-year">School year</label>
                      <select className="input" id="set-year" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}>
                        {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>Year {y}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="set-course">Syllabus</label>
                      <select className="input" id="set-course" value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))}>
                        {COURSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {user.role !== 'teacher' && form.year >= 11 && (
                  <div className="field">
                    <div className="label" id="set-pathway">HSC pathway</div>
                    <div className="pathway-row" role="group" aria-labelledby="set-pathway">
                      {PATHWAY_OPTS.filter(([k]) => k !== 'ext2' || form.year === 12).map(([k, name, desc]) => (
                        <button key={k} type="button" className={`pathway-pick ${form.pathway === k ? 'on' : ''}`}
                          onClick={() => setForm(f => ({ ...f, pathway: k }))}>
                          <b>{name}</b>
                          <span>{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="field">
                  <label className="label" htmlFor="set-goal">Daily goal — {form.dailyGoal} questions</label>
                  <input type="range" id="set-goal" min="3" max="40" value={form.dailyGoal} style={{ width: '100%', accentColor: 'var(--gold)' }}
                    onChange={e => setForm(f => ({ ...f, dailyGoal: Number(e.target.value) }))} />
                </div>
                <div className="row">
                  <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                  <button className="btn btn-quiet" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Account & Security ── */}
          <div ref={el => secRefs.current.security = el}>
            <SecuritySection toast={toast} />
          </div>

          {/* ── Handwriting ── */}
          <div ref={el => secRefs.current.handwriting = el}>
            <HandwritingSection toast={toast} />
          </div>

          {/* ── Appearance ── */}
          <div className="card" ref={el => secRefs.current.appearance = el}>
            <h2 style={{ marginBottom: 12 }}>◐ Appearance</h2>
            <div className="row">
              <button className={`gen-opt ${user.theme !== 'light' ? 'on' : ''}`} aria-pressed={user.theme !== 'light'} style={{ width: 160 }} onClick={() => setTheme('dark')}>Dark — blackboard</button>
              <button className={`gen-opt ${user.theme === 'light' ? 'on' : ''}`} aria-pressed={user.theme === 'light'} style={{ width: 160 }} onClick={() => setTheme('light')}>Light — paper</button>
            </div>
          </div>

          {/* ── Courses ── */}
          <div className="card" ref={el => secRefs.current.courses = el}>
            <h2 style={{ marginBottom: 8 }}>📖 Courses</h2>
            <div className="set-row"><span className="set-k">Enrolled</span><span className="set-v">{user.courseLabel}</span></div>
            <p className="muted" style={{ marginTop: 10 }}>
              Content is generated on-device and mapped to your syllabus's naming — changing year or pathway in
              Profile re-scopes Smart Practice, exams, priorities and the mark predictor instantly.
            </p>
          </div>

          {/* ── Data ── */}
          <div className="card" ref={el => secRefs.current.data = el}>
            <h2 style={{ marginBottom: 8 }}>⇅ Data & Backup</h2>
            <p className="sub" style={{ marginBottom: 12 }}>
              One JSON file holds everything — profile, ratings, attempts, exams, handwriting. Restore it on any
              device to pick up where you left off. The file itself is <strong>not</strong> encrypted and a restored
              profile comes back <strong>without its password</strong>, because a backup carries no password
              verifier — set one again after restoring to re-protect it. Keep the file somewhere you would be happy
              to keep a notebook. Progress files are small summaries you can AirDrop to a teacher, who imports them
              into class analytics.
            </p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={exportBackup}>Export full backup</button>
              <button className="btn btn-ghost btn-sm" onClick={() => importRef.current?.click()}>Restore from backup</button>
              {user.role !== 'teacher' && <button className="btn btn-ghost btn-sm" onClick={exportProgressFile}>Progress file for my teacher</button>}
              <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importBackup} />
            </div>
            <hr className="divider" />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={switchProfile}>Switch profile</button>
              {!del && (
                <button className="btn btn-quiet btn-sm" onClick={() => setDel({ name: '', password: '', error: '', busy: false })}>
                  Delete this profile…
                </button>
              )}
            </div>
            {del && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
                <p className="sub" style={{ marginBottom: 12 }}>
                  Deleting “{user.name}” wipes its ratings, attempts, exams, favourites and learned handwriting
                  from this iPad. Nothing is held anywhere else — export a full backup first if there is any
                  chance you want it back.
                </p>
                {del.error && <div className="error-box" role="alert">{del.error}</div>}
                <div className="grid cols-2" style={{ gap: 12 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label" htmlFor="set-del-name">Type “{user.name}” to confirm</label>
                    <input className="input" id="set-del-name" value={del.name} placeholder={user.name} aria-label={`Type ${user.name} to confirm deletion`}
                      onChange={e => setDel(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  {user.hasPassword && (
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label" htmlFor="set-del-pw">Profile password</label>
                      <input className="input" id="set-del-pw" type="password" value={del.password} aria-label="Profile password"
                        onChange={e => setDel(d => ({ ...d, password: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-sm" style={{ background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)' }}
                    disabled={del.busy} onClick={deleteProfile}>
                    {del.busy ? 'Deleting…' : `Really delete “${user.name}” and all its data`}
                  </button>
                  <button className="btn btn-quiet btn-sm" disabled={del.busy} onClick={() => setDel(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Help ── */}
          <div className="card" ref={el => secRefs.current.help = el}>
            <h2 style={{ marginBottom: 8 }}>? Help & Safety</h2>
            <p className="sub">
              Every subtopic tracks a skill rating that moves with each answer — harder questions move it more.
              Smart Practice targets ~70% success, weaves in spaced reviews before topics fade, and the mark
              predictor weighs mastery across the syllabus by exam weight, calibrated to HSC bands. Handwritten
              answers are recognised entirely on-device — strokes → symbols → maths — then marked by the same
              engine as typed answers, line by line. Hints and retries still earn credit, just a little less.
              {!window.__PRI_NATIVE__ && <> For the full-screen iPad experience: <b>Share → Add to Home Screen</b>.</>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
