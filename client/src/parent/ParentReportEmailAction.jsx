// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the parent's own page for the weekly report email —
// /parent/report-email
//
// Opened from the confirmation email or the "stop these reports" link, on the
// parent's own phone or computer, with no session. The token arrives in the
// URL fragment and is stripped before render (main.jsx). Nothing happens until
// the parent presses the button, so a mail scanner that opens links cannot
// confirm or stop anything by itself.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useT } from '../i18n/index.js';
import { parentReportApi } from './parentReportApi.js';
import './parent.css';

export default function ParentReportEmailAction({ data }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  async function act() {
    setBusy(true); setError('');
    try {
      if (data.action === 'confirm') { await parentReportApi.confirm(data.token); setDone('parentEmail.confirmed'); }
      else { await parentReportApi.unsubscribe(data.token); setDone('parentEmail.unsubscribed'); }
    } catch (err) {
      setError(err?.code === 'PARENT_REPORT_TOKEN_EXPIRED' || err?.code === 'PARENT_REPORT_TOKEN_INVALID'
        ? 'parentEmail.invalid' : 'parentEmail.failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <main className="auth-col parent-email-page">
        <h1>{t('parentEmail.title')}</h1>
        {!data && <p role="alert">{t('parentEmail.invalid')}</p>}
        {data && done && <p role="status">{t(done)}</p>}
        {data && !done && (
          <>
            <p>{data.action === 'confirm' ? t('parentEmail.confirmLead') : t('parentEmail.unsubscribeLead')}</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={act} data-testid="parent-email-act">
              {data.action === 'confirm' ? t('parentEmail.confirm') : t('parentEmail.unsubscribe')}
            </button>
          </>
        )}
        {error && <div className="error-box" role="alert">{t(error)}</div>}
      </main>
    </div>
  );
}
