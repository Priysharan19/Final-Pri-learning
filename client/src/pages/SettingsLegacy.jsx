import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { downloadJSON, readJSONFile, dateStamp } from '../lib/files.js';
import Calibrate from '../ink/Calibrate.jsx';
import { personalStats, clearPersonal, ensurePersonalLoaded } from '../ink/personal.js';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { MIN_PASSWORD, PasswordMeter, passwordVerdict } from './Login.jsx';
import { LANGUAGES, useLanguage, useT } from '../i18n/index.js';
import { loadGlossary } from '../i18n/glossary.js';

const AVATARS = ['🚀', '🦊', '🐨', '🦉', '🌟', '🐯', '🍀', '🎧', '🦄', '⚡', '🌊', '🧠'];
const COURSES = [['nsw', 'NSW · HSC'], ['vic', 'VIC · VCE'], ['qld', 'QLD · QCE'], ['wa', 'WA · WACE'], ['sa', 'SA · SACE'], ['ib', 'IB'], ['in', 'India · CBSE / JEE / Olympiad']];
const INDIA_TRACKS = [['cbse', 'CBSE / NCERT', 'Classes 7–12 school syllabus'], ['jee-main', 'JEE Main', 'Classes 11–12 objective depth'], ['jee-advanced', 'JEE Advanced', 'Classes 11–12 multi-concept depth'], ['olympiad', 'Olympiad', 'PRMO → RMO → INMO']];
export const PATHWAY_OPTS = [
  ['standard', 'Standard', 'Everyday maths — finance, measurement, networks'],
  ['advanced', 'Advanced', 'Functions, calculus and statistics — the classic HSC course'],
  ['ext1', 'Extension 1', 'Advanced plus vectors, induction, further calculus'],
  ['ext2', 'Extension 2', 'Year 12 only — proof, complex numbers, mechanics']
];

const askHandwritingStatus = () => cloud.handwritingStatus();
const askWorkingStatus = () => cloud.workingStatus();

const fmtBytes = (b) => b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`;

/**
 * One opt-in row for one thing that would leave the device.
 *
 * Two separate switches rather than one, because they send different things: a
 * picture of your handwriting is not the same as the words of your working, and
 * a student may reasonably want one and not the other. Both are off until
 * turned on, and each is hidden where the deployment cannot do it, so nothing
 * is offered that would only fail.
 *
 * The copy says exactly what is sent. "A picture of your handwriting" is the
 * whole of it, and a student is owed the plain version rather than a euphemism.
 */
function CloudOptInRow({ field, user, setUser, toast, ask, label, copy, unavailable }) {
  const t = useT();
  const [status, setStatus] = useState(null);   // null = still asking, {available}
  const [busy, setBusy] = useState(false);
  const on = user?.[field] === true;

  useEffect(() => {
    let live = true;
    if (!cloudAvailable()) { setStatus({ available: false }); return () => { live = false; }; }
    ask()
      .then(r => { if (live) setStatus({ available: !!r?.available }); })
      .catch(() => { if (live) setStatus({ available: false }); });
    return () => { live = false; };
  }, [ask]);

  async function toggle(next) {
    setBusy(true);
    try {
      const r = await api.patch('/me', { [field]: next });
      setUser(r.user);
      toast(<span>{t(next ? 'settings.cloudOnFor' : 'settings.cloudOffFor', { label })}</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  }

  if (status && !status.available) {
    return <p className="sub" style={{ marginTop: 12 }}>{unavailable}</p>;
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, rgba(128,128,128,.25))' }}>
      <div className="set-row">
        <span className="set-k">
          {label}
          <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 3, maxWidth: 460 }}>{copy}</span>
        </span>
        <span className="set-v">
          <button
            type="button"
            className={`btn btn-sm ${on ? 'btn-primary' : 'btn-quiet'}`}
            aria-pressed={on}
            disabled={busy || !status}
            onClick={() => toggle(!on)}
          >
            {!status ? t('common.checking') : t(on ? 'common.on' : 'common.off')}
          </button>
        </span>
      </div>
    </div>
  );
}

/**
 * The language switch.
 *
 * It is a row of buttons rather than a <select> for one reason: a student who
 * has the app in a language they cannot read has to be able to find their way
 * back out of it, and a closed dropdown showing one word in the wrong script is
 * a worse place to be lost than two buttons showing both names at once. Each
 * button is written in its own language, so "हिन्दी" is legible to the person
 * looking for Hindi whatever the app is currently set to.
 *
 * `chosen` drives the pressed state, not the language on screen: the tap is
 * acknowledged the instant it happens, even though the Hindi strings arrive a
 * moment later over the network the first time.
 */
function LanguageSection() {
  const { user, setUser, toast } = useApp();
  const { chosen, t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function pick(id) {
    if (id === user.language) return;
    setBusy(true);
    // The profile is the authority, and App.jsx applies whatever comes back —
    // so the switch cannot end up showing a language the profile did not store.
    try {
      const r = await api.patch('/me', { language: id });
      setUser(r.user);
      toast(<span>{t('lang.changed', { language: LANGUAGES.find(l => l.id === id).label })}</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 12 }}>◍ {t('lang.label')}</h2>
      <div className="row" role="group" aria-label={t('lang.label')}>
        {LANGUAGES.map(l => (
          <button key={l.id} type="button" className={`gen-opt ${chosen === l.id ? 'on' : ''}`}
            style={{ width: 160 }} lang={l.htmlLang} disabled={busy}
            aria-pressed={chosen === l.id} aria-label={t('lang.switchTo', { language: l.english })}
            onClick={() => pick(l.id)}>{l.label}</button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 12, maxWidth: 520 }}>{t('lang.help')}</p>
      <GlossRow />
    </div>
  );
}

/**
 * The NCERT term bridge, and the reason it sits under Language but is not part
 * of the language switch above it.
 *
 * A student who studied in Hindi medium will sit JEE or NEET in English —
 * around 93% of JEE Main candidates do, and JEE Advanced is offered in English
 * and Hindi only. What they are short of is not an app in Hindi; it is the
 * pairing between the word their textbook used and the word the paper will use.
 * So this shows both, and it can be on while the interface stays in English.
 */
function GlossRow() {
  const { user, setUser, toast } = useApp();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const on = user?.mathsGloss === true;

  async function toggle() {
    setBusy(true);
    try {
      const r = await api.patch('/me', { mathsGloss: !on });
      setUser(r.user);
      if (!on) void loadGlossary();
      toast(<span>{t(!on ? 'gloss.on' : 'gloss.off')}</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
      <div className="set-row">
        <span className="set-k">
          {t('gloss.label')}
          <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 3, maxWidth: 460 }}>{t('gloss.help')}</span>
        </span>
        <span className="set-v">
          <button type="button" className={`btn btn-sm ${on ? 'btn-primary' : 'btn-quiet'}`}
            aria-pressed={on} disabled={busy} onClick={toggle}>
            {t(on ? 'common.on' : 'common.off')}
          </button>
        </span>
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12, maxWidth: 520 }}>{t('gloss.example')}</p>
    </div>
  );
}

function HandwritingSection({ toast }) {
  const { user, setUser } = useApp();
  const t = useT();
  const [teaching, setTeaching] = useState(false);
  const [, refresh] = useState(0);
  useEffect(() => { ensurePersonalLoaded().then(() => refresh(x => x + 1)); }, []);
  const stats = personalStats();

  if (teaching) {
    return <Calibrate toast={toast} onDone={() => { setTeaching(false); refresh(x => x + 1); }} />;
  }
  return (
    <div className="card">
      <h2 style={{ marginBottom: 8 }}>{t('settings.handwriting')}</h2>
      <p className="sub" style={{ marginBottom: 12 }}>
        {t(window.__PRI_NATIVE__ ? 'settings.handwritingNative' : 'settings.handwritingBrowser')}
      </p>
      <div className="set-row">
        <span className="set-k">{t('settings.templatesLearned')}</span>
        <span className="set-v" data-t="templates-learned">{stats.total === 0
          ? t('settings.templatesNone')
          : t('settings.templatesCount', { total: stats.total, symbols: Object.keys(stats.bySymbol).length })}</span>
      </div>
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setTeaching(true)}>{t('settings.teachHandwriting')}</button>
        {stats.total > 0 && (
          <button className="btn btn-quiet btn-sm" onClick={async () => { await clearPersonal(); refresh(x => x + 1); toast(t('settings.handwritingCleared')); }}>
            {t('settings.resetHandwriting')}
          </button>
        )}
      </div>
      {/* The consent copy is in the catalogue like everything else, so a Hindi
          reader is told what leaves their device in the language they read. The
          emphasis these two carried in JSX is gone: a <b> around a fragment of
          an English sentence has no home in a Hindi one, and a sentence that
          has to be broken into three pieces to be styled is a sentence that
          cannot be translated. */}
      <CloudOptInRow
        field="cloudHandwriting"
        user={user} setUser={setUser} toast={toast}
        ask={askHandwritingStatus}
        label={t('settings.cloudHandwritingLabel')}
        unavailable={t('settings.cloudHandwritingUnavailable')}
        copy={t('settings.cloudHandwritingCopy')}
      />
      <CloudOptInRow
        field="cloudMarking"
        user={user} setUser={setUser} toast={toast}
        ask={askWorkingStatus}
        label={t('settings.cloudMarkingLabel')}
        unavailable={t('settings.cloudMarkingUnavailable')}
        copy={t('settings.cloudMarkingCopy')}
      />
    </div>
  );
}

const SECTIONS = [
  ['plan', '♛', 'settings.secPlan'],
  ['profile', '☺', 'settings.secProfile'],
  ['security', '⚿', 'settings.secSecurity'],
  ['handwriting', '✒', 'settings.secHandwriting'],
  ['language', '◍', 'settings.secLanguage'],
  ['appearance', '◐', 'settings.secAppearance'],
  ['courses', '📖', 'settings.secCourses'],
  ['data', '⇅', 'settings.secData'],
  ['help', '?', 'settings.secHelp'],
];

function SecuritySection({ toast }) {
  const { user, setUser } = useApp();
  const t = useT();
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
      toast(<span>{t('settings.emailUpdated')}</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  };

  const savePassword = async (remove = false) => {
    if (!remove) {
      if (!pwVerdict.ok) { toast(<span>{pwVerdict.note}</span>); return; }
      if (pw.next !== pw.next2) { toast(<span>{t('settings.passwordsDontMatch')}</span>); return; }
    }
    setBusy(true);
    try {
      const r = await api.post('/profiles/password', { current: pw.current, next: remove ? '' : pw.next });
      setUser(r.user); setPwOpen(false); setPw({ current: '', next: '', next2: '' });
      toast(<span>{t(remove ? 'settings.passwordRemoved' : 'settings.passwordSaved')}</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: 8 }}>⚿ {t('settings.secSecurity')}</h2>
      <div className="set-row">
        <span className="set-k">{t('settings.accountType')}</span>
        <span className="set-v">{t('settings.accountTypeValue')}</span>
      </div>
      <div className="set-row">
        <span className="set-k">{t('settings.email')}</span>
        {!editEmail ? (
          <span className="set-v" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {user.email || <span className="muted">{t('settings.emailNotSet')}</span>}
            <button className="btn btn-quiet btn-sm" aria-label={t('settings.editEmail')}
              onClick={() => { setEmail(user.email || ''); setEditEmail(true); }}>✎</button>
          </span>
        ) : (
          <span style={{ display: 'flex', gap: 8 }}>
            <input className="input" id="set-email" type="email" value={email} placeholder="you@example.com" style={{ width: 220 }}
              aria-label={t('settings.accountEmail')} onChange={e => setEmail(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveEmail}>{t('common.save')}</button>
            <button className="btn btn-quiet btn-sm" onClick={() => setEditEmail(false)}>{t('common.cancel')}</button>
          </span>
        )}
      </div>
      <div className="set-row">
        <span className="set-k">{t('settings.profilePassword')}</span>
        <span className="set-v" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {user.hasPassword ? <span style={{ color: 'var(--good)' }}>{t('settings.passwordOn')}</span> : <span className="muted">{t('common.off')}</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setPwOpen(o => !o)}>{t(user.hasPassword ? 'settings.changePassword' : 'settings.setPassword')}</button>
        </span>
      </div>
      {pwOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
          <div className="grid cols-2" style={{ gap: 12 }}>
            {user.hasPassword && (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="set-pw-current">{t('settings.currentPassword')}</label>
                <input className="input" id="set-pw-current" type="password" value={pw.current} aria-label={t('settings.currentPassword')}
                  onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="set-pw-next">{t('settings.newPassword')}</label>
              <input className="input" id="set-pw-next" type="password" value={pw.next} aria-label={t('settings.newPassword')}
                onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label" htmlFor="set-pw-next2">{t('settings.repeatPassword')}</label>
              <input className="input" id="set-pw-next2" type="password" value={pw.next2} aria-label={t('settings.repeatNewPassword')}
                onChange={e => setPw(p => ({ ...p, next2: e.target.value }))} />
            </div>
          </div>
          <PasswordMeter verdict={pwVerdict} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" disabled={busy || !pwVerdict.ok} onClick={() => savePassword(false)}>
              {t(user.hasPassword ? 'settings.changePasswordAction' : 'settings.turnProtectionOn')}
            </button>
            {user.hasPassword && (
              <button className="btn btn-quiet btn-sm" disabled={busy || !pw.current} onClick={() => savePassword(true)}>{t('settings.removePassword')}</button>
            )}
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>{t('settings.passwordNote', { min: MIN_PASSWORD })}</p>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, setUser, toast } = useApp();
  const t = useT();
  const [storageInfo, setStorageInfo] = useState(null);
  const [active, setActive] = useState('plan');
  const importRef = useRef(null);
  const secRefs = useRef({});
  useEffect(() => { api.get('/data/storage').then(setStorageInfo).catch(() => { }); }, []);
  const [form, setForm] = useState({ name: user.name, year: user.year, dailyGoal: user.dailyGoal, course: user.course, avatar: user.avatar, pathway: user.pathway || 'advanced', indiaTrack: user.indiaTrack || 'cbse' });
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
      toast(<span>{t('settings.saved')}</span>);
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
      setDel(d => ({ ...d, error: t('settings.typeTheName', { name: expected }) }));
      return;
    }
    if (user.hasPassword && !del?.password) {
      setDel(d => ({ ...d, error: t('settings.enterPasswordToDelete') }));
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
      toast(<span>{t('settings.backupExported')}</span>);
    } catch (e) { toast(<span>{e.message}</span>); }
  }

  async function exportProgressFile() {
    try {
      const data = await api.get('/data/progress-file');
      downloadJSON(data, `pri-progress-${user.name.replace(/\s+/g, '-').toLowerCase()}-${dateStamp()}.json`);
      toast(<span>{t('settings.progressExported')}</span>);
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
      toast(<span>{t(r.unprotected ? 'settings.backupRestoredUnprotected' : 'settings.backupRestored',
        { rows: r.rows.toLocaleString(user.locale) })}</span>);
      setUser(r.user);
    } catch (err) { toast(<span>{err.message}</span>); }
  }

  const usagePct = storageInfo && storageInfo.quota > 0 ? Math.min(100, Math.round(100 * storageInfo.usage / storageInfo.quota)) : 0;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{t('settings.title')}</h1>
      <div className="settings-grid">
        <div className="set-menu no-print">
          {SECTIONS.map(([k, ico, key]) => (
            <button key={k} className={`set-menu-item ${active === k ? 'on' : ''}`} onClick={() => goto(k)}>
              <span style={{ width: 18, textAlign: 'center' }}>{ico}</span>{t(key)}
            </button>
          ))}
        </div>

        <div className="grid" style={{ gap: 18 }}>
          {/* ── Plan ── */}
          <div className="card" ref={el => secRefs.current.plan = el}>
            <h2>{t('settings.localPlan')}</h2>
            <p className="muted" style={{ margin: '4px 0 14px' }}>{t('settings.localPlanSub')}</p>
            <div className="spread" style={{ fontSize: 14 }}>
              <span className="sub">{t('settings.questionBank')}</span><span>{t('settings.questionBankValue')}</span>
            </div>
            <div className="meter" style={{ margin: '6px 0 14px' }}><i style={{ width: '100%' }} /></div>
            <div className="set-row"><span className="set-k">{t('settings.status')}</span><span className="set-v" style={{ color: 'var(--good)' }}>{t('settings.active')}</span></div>
            <div className="set-row"><span className="set-k">{t('settings.allDifficulties')}</span><span className="set-v">✓</span></div>
            <div className="set-row"><span className="set-k">{t('settings.allCourses')}</span><span className="set-v">✓</span></div>
            <div className="set-row"><span className="set-k">{t('settings.allFeatures')}</span><span className="set-v">✓</span></div>
          </div>

          {/* ── Account information ── */}
          <div className="card">
            <h2 style={{ marginBottom: 8 }}>{t('settings.accountInfo')}</h2>
            <div className="set-row"><span className="set-k">{t('settings.dataLocation')}</span><span className="set-v">{t(storageInfo?.native ? 'settings.dataLocationNative' : 'settings.dataLocationBrowser')}</span></div>
            <div className="set-row">
              <span className="set-k">{t('settings.storageProtection')}</span>
              <span className="set-v" style={{ color: storageInfo?.native || storageInfo?.persisted ? 'var(--good)' : 'var(--warn)' }}>
                {t(storageInfo?.native ? 'settings.storageSandbox' : storageInfo?.persisted ? 'settings.storagePersisted' : 'settings.storagePending')}
              </span>
            </div>
            {storageInfo && storageInfo.quota > 0 && (
              <div className="set-row"><span className="set-k">{t('settings.spaceUsed')}</span><span className="set-v">{t('settings.spaceOf', { used: fmtBytes(storageInfo.usage), total: fmtBytes(storageInfo.quota), percent: usagePct })}</span></div>
            )}
            <div className="set-row"><span className="set-k">{t('settings.accounts')}</span><span className="set-v">{t('settings.accountsValue')}</span></div>
          </div>

          {/* ── Profile ── */}
          <div className="card" ref={el => secRefs.current.profile = el}>
            <div className="spread">
              <h2>{t('settings.profileInfo')}</h2>
              {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✎ {t('common.edit')}</button>}
            </div>
            {!editing ? (
              <div style={{ marginTop: 8 }}>
                <div className="set-row"><span className="set-k">{t('settings.fullName')}</span><span className="set-v">{user.name}</span></div>
                <div className="set-row"><span className="set-k">{t('settings.avatar')}</span><span className="set-v" style={{ fontSize: 20 }}>{user.avatar}</span></div>
                {user.role !== 'teacher' && <div className="set-row"><span className="set-k">{t(user.course === 'in' ? 'settings.classLevel' : 'settings.yearLevel')}</span><span className="set-v">{t(user.course === 'in' ? 'common.classNumber' : 'common.yearNumber', { n: user.year })}</span></div>}
                <div className="set-row"><span className="set-k">{t('settings.course')}</span><span className="set-v">{user.courseLabel}</span></div>
                <div className="set-row"><span className="set-k">{t('settings.dailyGoal')}</span><span className="set-v">{t('settings.dailyGoalValue', { count: user.dailyGoal, n: user.dailyGoal })}</span></div>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div className="field">
                  <label className="label" htmlFor="set-name">{t('settings.name')}</label>
                  <input className="input" id="set-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="field">
                  <div className="label" id="set-avatar">{t('settings.avatar')}</div>
                  <div className="avatar-row" role="group" aria-labelledby="set-avatar">
                    {AVATARS.map(a => (
                      <button key={a} className={`avatar-pick ${form.avatar === a ? 'on' : ''}`}
                        aria-label={t('settings.avatarPick', { emoji: a })} aria-pressed={form.avatar === a}
                        onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
                    ))}
                  </div>
                </div>
                {user.role !== 'teacher' && (
                  <div className="grid cols-2" style={{ gap: 12 }}>
                    <div className="field">
                      <label className="label" htmlFor="set-year">{t(form.course === 'in' ? 'settings.schoolClass' : 'settings.schoolYear')}</label>
                      <select className="input" id="set-year" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}>
                        {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>{t(form.course === 'in' ? 'common.classNumber' : 'common.yearNumber', { n: y })}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="set-course">{t('settings.syllabus')}</label>
                      <select className="input" id="set-course" value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))}>
                        {COURSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {user.role !== 'teacher' && form.course === 'nsw' && form.year >= 11 && (
                  <div className="field">
                    <div className="label" id="set-pathway">{t('settings.hscPathway')}</div>
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
                {user.role !== 'teacher' && form.course === 'in' && (
                  <div className="field">
                    <div className="label" id="set-india-track">{t('settings.indiaTrack')}</div>
                    <div className="pathway-row" role="group" aria-labelledby="set-india-track">
                      {INDIA_TRACKS.filter(([k]) => form.year >= 11 || !k.startsWith('jee-')).map(([k, name, desc]) => (
                        <button key={k} type="button" className={`pathway-pick ${form.indiaTrack === k ? 'on' : ''}`}
                          onClick={() => setForm(f => ({ ...f, indiaTrack: k }))}><b>{name}</b><span>{desc}</span></button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="field">
                  <label className="label" htmlFor="set-goal">{t('settings.dailyGoalSlider', { count: form.dailyGoal, n: form.dailyGoal })}</label>
                  <input type="range" id="set-goal" min="3" max="40" value={form.dailyGoal} style={{ width: '100%', accentColor: 'var(--gold)' }}
                    onChange={e => setForm(f => ({ ...f, dailyGoal: Number(e.target.value) }))} />
                </div>
                <div className="row">
                  <button className="btn btn-primary" onClick={save} disabled={busy}>{t(busy ? 'common.saving' : 'common.saveChanges')}</button>
                  <button className="btn btn-quiet" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
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

          {/* ── Language ── */}
          <div ref={el => secRefs.current.language = el}>
            <LanguageSection />
          </div>

          {/* ── Appearance ── */}
          <div className="card" ref={el => secRefs.current.appearance = el}>
            <h2 style={{ marginBottom: 12 }}>{t('settings.appearance')}</h2>
            <div className="row">
              <button className={`gen-opt ${user.theme !== 'light' ? 'on' : ''}`} aria-pressed={user.theme !== 'light'} style={{ width: 160 }} onClick={() => setTheme('dark')}>{t('settings.themeDark')}</button>
              <button className={`gen-opt ${user.theme === 'light' ? 'on' : ''}`} aria-pressed={user.theme === 'light'} style={{ width: 160 }} onClick={() => setTheme('light')}>{t('settings.themeLight')}</button>
            </div>
          </div>

          {/* ── Courses ── */}
          <div className="card" ref={el => secRefs.current.courses = el}>
            <h2 style={{ marginBottom: 8 }}>{t('settings.courses')}</h2>
            <div className="set-row"><span className="set-k">{t('settings.enrolled')}</span><span className="set-v">{user.courseLabel}</span></div>
            <p className="muted" style={{ marginTop: 10 }}>{t('settings.coursesNote')}</p>
          </div>

          {/* ── Data ── */}
          <div className="card" ref={el => secRefs.current.data = el}>
            <h2 style={{ marginBottom: 8 }}>{t('settings.dataBackup')}</h2>
            <p className="sub" style={{ marginBottom: 12 }}>{t('settings.dataNote')}</p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={exportBackup}>{t('settings.exportBackup')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => importRef.current?.click()}>{t('settings.restoreBackup')}</button>
              {user.role !== 'teacher' && <button className="btn btn-ghost btn-sm" onClick={exportProgressFile}>{t('settings.progressFile')}</button>}
              <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importBackup} />
            </div>
            <hr className="divider" />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={switchProfile}>{t('app.switchProfile')}</button>
              {!del && (
                <button className="btn btn-quiet btn-sm" onClick={() => setDel({ name: '', password: '', error: '', busy: false })}>
                  {t('settings.deleteProfile')}
                </button>
              )}
            </div>
            {del && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
                <p className="sub" style={{ marginBottom: 12 }}>{t('settings.deleteWarning', { name: user.name })}</p>
                {del.error && <div className="error-box" role="alert">{del.error}</div>}
                <div className="grid cols-2" style={{ gap: 12 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label" htmlFor="set-del-name">{t('settings.typeNameToConfirm', { name: user.name })}</label>
                    <input className="input" id="set-del-name" value={del.name} placeholder={user.name} aria-label={t('settings.typeNameLabel', { name: user.name })}
                      onChange={e => setDel(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  {user.hasPassword && (
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label" htmlFor="set-del-pw">{t('settings.profilePassword')}</label>
                      <input className="input" id="set-del-pw" type="password" value={del.password} aria-label={t('settings.profilePassword')}
                        onChange={e => setDel(d => ({ ...d, password: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-sm" style={{ background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)' }}
                    disabled={del.busy} onClick={deleteProfile}>
                    {del.busy ? t('settings.deleting') : t('settings.reallyDelete', { name: user.name })}
                  </button>
                  <button className="btn btn-quiet btn-sm" disabled={del.busy} onClick={() => setDel(null)}>{t('common.cancel')}</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Help ── */}
          <div className="card" ref={el => secRefs.current.help = el}>
            <h2 style={{ marginBottom: 8 }}>{t('settings.helpSafety')}</h2>
            <p className="sub">
              {t('settings.helpBody')}
              {!window.__PRI_NATIVE__ && t('settings.addToHomeScreen')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
