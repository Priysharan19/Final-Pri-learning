import React, { useEffect, useState } from 'react';
import SettingsLegacy from './SettingsLegacy.jsx';
import CloudAccountPanel from '../components/CloudAccountPanel.jsx';
import ClassroomPanel from '../components/ClassroomPanel.jsx';
import AssignmentInboxPanel from '../components/AssignmentInboxPanel.jsx';
import RemindersPanel from '../reminders/RemindersPanel.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { featureEnabled } from '../platform/features.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { BrandMark } from '../components/BrandMark.jsx';
import { CUT } from '../brand/edition.js';
import { currentReleaseIdentity } from '../platform/releaseIdentity.js';
import { HANDS, readHand, writeHand } from '../lib/writingHand.js';
import { autoReadEnabled, setAutoRead } from '../lib/autoRead.js';
import { soundsEnabled, setSoundsEnabled, playSound } from '../lib/sound.js';

// The content-operations and admin console is for support and admin accounts
// only, and the server enforces that on every call it makes. A student never
// sees it, so a student's device never downloads it either: the panel is
// fetched on demand (vite.config.js names it in ON_DEMAND) and only once the
// cloud account it is signed in with reports a staff role. The panel still
// checks the role itself and still clears what it holds when the session
// changes; this gate only decides whether its code is worth asking for.
const StaffOperationsPanel = React.lazy(() => import('../components/StaffOperationsPanel.jsx'));
const STAFF_ROLES = ['support', 'admin'];

function StaffOperations() {
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    if (!cloudAvailable()) return undefined;
    let live = true;
    const check = () => {
      cloud.me().then(
        me => { if (live) setStaff(STAFF_ROLES.includes(me?.account?.role)); },
        () => { if (live) setStaff(false); }
      );
    };
    check();
    const stop = onCloudSessionChange(check);
    return () => { live = false; stop(); };
  }, []);

  if (!staff) return null;
  return (
    <React.Suspense fallback={null}>
      <StaffOperationsPanel />
    </React.Suspense>
  );
}

// Which edition this is and whose: "{brand} is an edition of {company}", and
// what the cut in its mark stands for (docs/brand/editions-decision.md). The
// mark is drawn alone here, a compact space, never beside the wordmark.
function AboutEdition() {
  const t = useT();
  return (
    <div className="card" data-about-edition style={{ marginTop: 18 }}>
      <h2 style={{ marginBottom: 8 }}>{t('about.title')}</h2>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <BrandMark size={32} />
        <p className="muted" style={{ margin: 0, maxWidth: 560, lineHeight: 1.5 }}>
          {t('about.edition')} {CUT === 'jya' ? t('about.cutJya') : t('about.cutSquare')}
        </p>
      </div>
    </div>
  );
}

// The Pencil layout's dock sits on the side of the hand that isn't writing.
// Kept on this device only.
function WritingHand() {
  const t = useT();
  const [hand, setHand] = useState(readHand);
  return (
    <div className="card" data-writing-hand style={{ marginTop: 18 }}>
      <h2 style={{ marginBottom: 8 }}>{t('hand.title')}</h2>
      <div role="radiogroup" aria-label={t('hand.title')} style={{ display: 'flex', gap: 8 }}>
        {HANDS.map(h => (
          <button key={h} type="button" role="radio" aria-checked={hand === h} className={`btn ${hand === h ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: 44 }} data-hand={h} onClick={() => setHand(writeHand(h))}>{t(h === 'left' ? 'hand.left' : 'hand.right')}</button>
        ))}
      </div>
      <p className="muted" style={{ margin: '8px 0 0' }}>{t('hand.note')}</p>
    </div>
  );
}

// Read my handwriting on its own after a pause (default on). Kept on this device.
function AutoRead() {
  const t = useT();
  const [on, setOn] = useState(autoReadEnabled);
  return (
    <div className="card" data-auto-read style={{ marginTop: 18 }}>
      <h2 style={{ marginBottom: 8 }}>{t('autoRead.title')}</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="button" role="switch" aria-checked={on} aria-label={t('autoRead.label')} className={`btn ${on ? 'btn-primary' : 'btn-ghost'}`}
          style={{ minHeight: 44, minWidth: 64 }} data-auto-read-switch onClick={() => setOn(setAutoRead(!on))}>{on ? t('autoRead.on') : t('autoRead.off')}</button>
        <span>{t('autoRead.label')}</span>
      </div>
      <p className="muted" style={{ margin: '8px 0 0' }}>{t('autoRead.note')}</p>
    </div>
  );
}

// Quiet interface sounds (off by default). Kept on this device.
function Sounds() {
  const t = useT();
  const [on, setOn] = useState(soundsEnabled);
  return (
    <div className="card" data-sounds style={{ marginTop: 18 }}>
      <h2 style={{ marginBottom: 8 }}>{t('sounds.title')}</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="button" role="switch" aria-checked={on} aria-label={t('sounds.label')} className={`btn ${on ? 'btn-primary' : 'btn-ghost'}`}
          style={{ minHeight: 44, minWidth: 64 }} data-sounds-switch onClick={() => { const next = setSoundsEnabled(!on); setOn(next); if (next) playSound('tick'); }}>{on ? t('sounds.on') : t('sounds.off')}</button>
        <span>{t('sounds.label')}</span>
      </div>
      <p className="muted" style={{ margin: '8px 0 0' }}>{t('sounds.note')}</p>
    </div>
  );
}

// Owner request, 19 Nov 2026 (both editions): the release short SHA and build date, in a quiet line at the
// very bottom, so anyone can tell which build a browser is running. Read from the baked release identity.
export function buildLine(identity) {
  const sha = /^[0-9a-f]{40}$/.test(String(identity?.releaseSha || '')) ? identity.releaseSha.slice(0, 7) : null;
  return { sha, date: String(identity?.buildTimestamp || '').slice(0, 10) || null };
}

function BuildLine() {
  const t = useT();
  const { sha, date } = buildLine(currentReleaseIdentity());
  return (
    <p className="muted" data-build-line style={{ margin: '22px 0 8px', fontSize: 12, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
      {sha ? t('about.build', { sha, date: date || '—' }) : t('about.buildDev')}
    </p>
  );
}

export default function Settings() {
  const { user } = useApp();
  // The classroom product is outside public V1 (PRI_V1_RELEASE_SCOPE §11): a
  // student sees the classroom and assignment panels only in a build that
  // enables the extended tracks. A profile that is already a teacher keeps them,
  // whatever the flag says — gating is about new exposure, not taking away.
  const classroom = user?.role === 'teacher' || featureEnabled('extendedTracks');
  return (
    <>
      <SettingsLegacy />
      <CloudAccountPanel />
      <RemindersPanel />
      {classroom && <AssignmentInboxPanel />}
      {classroom && <ClassroomPanel />}
      <WritingHand />
      <AutoRead />
      <Sounds />
      <AboutEdition />
      <StaffOperations />
      <BuildLine />
    </>
  );
}
