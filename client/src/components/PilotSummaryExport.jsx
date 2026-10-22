import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { downloadJSON } from '../lib/files.js';
import { useT } from '../i18n/index.js';

// A study programme's anonymous summary (#141, local/pilotSummary.js). Closed
// until asked for; the person sees every number before the file is saved, and
// the file names only the participant code and the dates, never the student.
// The refusals local/pilotSummary.js can give, by code, in the person's language.
const ERROR_KEYS = {
  PILOT_PARTICIPANT: 'pilot.errParticipant', PILOT_DATES: 'pilot.errDates', PILOT_ORDER: 'pilot.errOrder',
  PILOT_SPAN: 'pilot.errSpan', PILOT_SCORE: 'pilot.errScore', PILOT_UNKNOWN: 'pilot.errUnknown'
};

export default function PilotSummaryExport() {
  const t = useT();
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const opener = useRef(null);
  const heading = useRef(null);
  const wasOpen = useRef(false);

  // Focus follows the form: to its heading when it opens, back to the button
  // that opened it when it closes.
  useEffect(() => {
    if (form && !wasOpen.current) heading.current?.focus();
    if (!form && wasOpen.current) opener.current?.focus();
    wasOpen.current = !!form;
  }, [form]);

  if (!form) {
    return (
      <button ref={opener} className="btn btn-ghost btn-sm" onClick={() => setForm({ participant: '', from: '', to: '', baseline: '', post: '' })}>
        {t('pilot.open')}
      </button>
    );
  }

  const field = key => e => { setForm({ ...form, [key]: e.target.value }); setPreview(null); setError(''); setSaved(false); };
  async function prepare(e) {
    e.preventDefault();
    setBusy(true); setError(''); setSaved(false);
    try { setPreview(await api.post('/data/pilot-summary', form)); }
    catch (err) { setPreview(null); setError(ERROR_KEYS[err.code] ? { key: ERROR_KEYS[err.code] } : err.message); }
    finally { setBusy(false); }
  }
  async function save() {
    try {
      await downloadJSON(preview, `pri-study-summary-${preview.participant}-${preview.period.from}-to-${preview.period.to}.json`);
      setSaved(true);
    } catch (err) { setError(err.message); }
  }
  const close = () => { setForm(null); setPreview(null); setError(''); setSaved(false); };

  const rows = preview ? [
    ['pilot.activeDays', preview.activeDays],
    ['pilot.questions', preview.questionsAttempted],
    ['pilot.repeats', preview.repeatAttempts],
    ['pilot.correct', preview.correctAttempts],
    ['pilot.accuracy', preview.accuracy === null ? '—' : `${Math.round(preview.accuracy * 1000) / 10}%`],
    ['pilot.minutes', Math.round(preview.practiceMs / 60000)],
    ['pilot.hints', preview.hintsUsed],
    ['pilot.topics', preview.topicsTouched]
  ] : [];

  return (
    <form className="card" style={{ flexBasis: '100%', marginTop: 8 }} onSubmit={prepare} aria-labelledby="pilot-title">
      <h3 id="pilot-title" ref={heading} tabIndex={-1} style={{ marginBottom: 6 }}>{t('pilot.title')}</h3>
      <p className="muted" style={{ marginBottom: 10 }}>{t('pilot.note')}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <label className="label" htmlFor="pilot-participant">{t('pilot.participant')}</label>
          <input className="input" id="pilot-participant" value={form.participant} onChange={field('participant')}
            autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} placeholder="S042" style={{ width: 120 }} required />
        </div>
        <div>
          <label className="label" htmlFor="pilot-from">{t('pilot.from')}</label>
          <input className="input" id="pilot-from" type="date" value={form.from} onChange={field('from')} required />
        </div>
        <div>
          <label className="label" htmlFor="pilot-to">{t('pilot.to')}</label>
          <input className="input" id="pilot-to" type="date" value={form.to} onChange={field('to')} required />
        </div>
        <div>
          <label className="label" htmlFor="pilot-baseline">{t('pilot.baseline')}</label>
          <input className="input" id="pilot-baseline" type="number" inputMode="decimal" min="0" max="100" step="any" value={form.baseline} onChange={field('baseline')} style={{ width: 110 }} />
        </div>
        <div>
          <label className="label" htmlFor="pilot-post">{t('pilot.post')}</label>
          <input className="input" id="pilot-post" type="number" inputMode="decimal" min="0" max="100" step="any" value={form.post} onChange={field('post')} style={{ width: 110 }} />
        </div>
      </div>
      {error && <div className="error-box" role="alert" style={{ marginTop: 10 }}>{error.key ? t(error.key) : error}</div>}
      {preview && (
        <div role="status" style={{ marginTop: 12 }}>
          {rows.map(([key, value]) => (
            <div className="set-row" key={key}><span className="set-k">{t(key)}</span><span className="set-v">{value}</span></div>
          ))}
          <p className="muted" style={{ marginTop: 8 }}>{t('pilot.boundary')}</p>
          {saved && <p style={{ marginTop: 8 }}>{t('pilot.saved')}</p>}
        </div>
      )}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {preview
          ? <button type="button" className="btn btn-primary btn-sm" onClick={save}>{t('pilot.save')}</button>
          : <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{t('pilot.prepare')}</button>}
        <button type="button" className="btn btn-quiet btn-sm" onClick={close}>{t('pilot.cancel')}</button>
      </div>
    </form>
  );
}
