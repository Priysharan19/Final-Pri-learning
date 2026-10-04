import React, { useEffect, useState } from 'react';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { loadReminderSettings, saveReminderSettings } from './settings.js';
import { reminderRuntime } from './index.js';
import { loadPlanSettings, savePlanSettings } from '../plan/settings.js';

// The Reminders section of Settings. The master toggle is the one place in the
// product that asks the platform for notification permission, and it asks only
// when the student taps it: a refusal leaves the toggle off and says where the
// permission lives. Turning it off cancels everything pending on this device.
// The schedule itself follows the plan (plan/usePlan.js) and is re-synced
// whenever Home or the Plan page next builds it.
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5);
const EVENING = Array.from({ length: 12 }, (_, i) => i + 12);

export default function RemindersPanel() {
  const { user } = useApp();
  const t = useT();
  const pid = user?.id || null;
  const [settings, setSettings] = useState(() => loadReminderSettings(pid));
  const [plan, setPlan] = useState(() => loadPlanSettings(pid));
  const [surface, setSurface] = useState(() => reminderRuntime().surface());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => { setSettings(loadReminderSettings(pid)); setPlan(loadPlanSettings(pid)); setSurface(reminderRuntime().surface()); }, [pid]);

  if (!user || user.role === 'teacher') return null;
  const supported = reminderRuntime().supported();

  async function toggle() {
    if (busy || !pid) return;
    setBusy(true);
    setNote(null);
    try {
      if (settings.enabled) {
        await reminderRuntime().cancelAll(pid);
        setSettings(saveReminderSettings(pid, { enabled: false }));
        setNote('reminders.turnedOff');
      } else {
        const granted = await reminderRuntime().requestPermission();
        setSurface(reminderRuntime().surface());
        if (!granted) { setNote('reminders.denied'); return; }
        setSettings(saveReminderSettings(pid, { enabled: true }));
      }
    } finally { setBusy(false); }
  }

  const setHour = (field, value) => {
    if (field === 'sessionHour') setPlan(savePlanSettings(pid, { sessionHour: value }));
    setSettings(saveReminderSettings(pid, { [field]: value }));
  };

  return (
    <div className="card" data-reminders-panel style={{ marginTop: 18 }}>
      <h2 style={{ marginBottom: 8 }}>{t('reminders.title')}</h2>
      <p className="muted" style={{ margin: '0 0 12px', maxWidth: 560, lineHeight: 1.5 }}>{t('reminders.sub')}</p>
      <div className="set-row">
        <span className="set-k">{t('reminders.enable')}</span>
        <span className="set-v">
          <button type="button" className={`btn btn-sm ${settings.enabled ? 'btn-primary' : 'btn-quiet'}`} data-reminders-toggle
            aria-pressed={settings.enabled} disabled={busy || !supported} onClick={toggle} style={{ minHeight: 44 }}>
            {t(settings.enabled ? 'common.on' : 'common.off')}
          </button>
        </span>
      </div>
      {!supported && <p className="muted" style={{ fontSize: 12.5 }}>{t('reminders.unsupported')}</p>}
      {surface === 'denied' && <p className="muted" style={{ fontSize: 12.5 }}>{t('reminders.denied')}</p>}
      {note && <p className="muted" role="status" style={{ fontSize: 12.5 }}>{t(note)}</p>}
      {settings.enabled && (
        <>
          <div className="set-row">
            <label className="set-k" htmlFor="reminders-session-hour">{t('reminders.sessionHour')}</label>
            <span className="set-v">
              <select id="reminders-session-hour" className="input" style={{ minHeight: 44 }} value={plan.sessionHour}
                onChange={e => setHour('sessionHour', Number(e.target.value))}>
                {HOURS.map(h => <option key={h} value={h}>{t('plan.hourLabel', { hour: String(h).padStart(2, '0') })}</option>)}
              </select>
            </span>
          </div>
          <div className="set-row">
            <label className="set-k" htmlFor="reminders-streak-hour">{t('reminders.streakHour')}</label>
            <span className="set-v">
              <select id="reminders-streak-hour" className="input" style={{ minHeight: 44 }} value={settings.streakHour}
                onChange={e => setHour('streakHour', Number(e.target.value))}>
                {EVENING.map(h => <option key={h} value={h}>{t('plan.hourLabel', { hour: String(h).padStart(2, '0') })}</option>)}
              </select>
            </span>
          </div>
          {surface !== 'native' && <p className="muted" style={{ fontSize: 12.5 }}>{t('reminders.webNote')}</p>}
        </>
      )}
    </div>
  );
}
