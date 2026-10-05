// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the public account-deletion page — /account/delete-request
//
// Apple App Store Review Guideline 5.1.1(v) and Google Play's "Delete account"
// requirement (the Data safety form asks for a public URL) both want a way for
// a person to have their account deleted without being able to open the app.
// This page is that URL. It is rendered outside the router (main.jsx), with no
// profile and no session, in English or Hindi, and it does two things:
//
//   1. tells the reader how to delete inside the app (every sign-in method), and
//      exactly what deletion removes and what it leaves (the same facts as the
//      privacy notice and docs/privacy/data-retention.md);
//   2. lets a signed-out person delete by proving they hold the account's email:
//      POST /v1/account/otp/delete-request sends a code, /delete-confirm deletes
//      through the same transaction DELETE /v1/account uses.
//
// The server answers the request step identically whether or not an account
// exists; the page's copy says so ("if there is an account…").
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { LANGUAGES, tLater, useLanguage } from '../i18n/index.js';
import OtpInput, { OTP_LENGTH } from '../components/OtpInput.jsx';
import '../components/SignUpFlow.css';

// The wordmark after the P mark (allowlisted literal, as in App.jsx's Logo).
const WORDMARK = 'ri Learning';

export default function AccountDeleteRequest() {
  const { language, setLanguage: chooseLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(null);

  async function sendCode() {
    if (busy || !email.trim()) return;
    setBusy('send'); setError(''); setNotice('');
    try {
      const sent = await cloud.deleteRequestCode({ email: email.trim() });
      setChallengeId(sent?.challengeId || null);
      setCode('');
      setInvalid(false);
      setNotice(tLater('deleteRequest.codeSent'));
    } catch (err) {
      setError(err?.code === 'OTP_RATE_LIMITED' ? tLater('deleteRequest.rateLimited') : (err?.message || tLater('deleteRequest.genericError')));
    } finally { setBusy(''); }
  }

  async function confirm(value = code) {
    if (busy || !challengeId || value.length !== OTP_LENGTH) return;
    setBusy('confirm'); setError(''); setInvalid(false);
    try {
      const result = await cloud.deleteConfirmCode({ email: email.trim(), challengeId, code: value });
      setDone(result?.deleted ? 'deleted' : 'none');
    } catch (err) {
      const wrong = err?.code === 'OTP_INVALID';
      setInvalid(wrong);
      setCode('');
      setError(wrong ? tLater('deleteRequest.codeInvalid') : (err?.message || tLater('deleteRequest.genericError')));
    } finally { setBusy(''); }
  }

  return (
    <div className="auth-wrap">
      <main className="auth-col signup-flow guardian-page" lang={language}>
        <div className="logo logo-lg" aria-label="Pri Learning">
          <span className="logo-bb" aria-hidden="true">P</span><span className="logo-name">{WORDMARK}<span className="logo-dot">.</span></span>
        </div>

        <div className="seg-tabs" role="group" aria-label={t('deleteRequest.languageLabel')} style={{ marginTop: 18 }}>
          {LANGUAGES.map(({ id, label }) => (
            <button key={id} type="button" className={`seg-tab${language === id ? ' on' : ''}`} aria-pressed={language === id}
              onClick={() => chooseLanguage(id)} data-testid={`delete-request-lang-${id}`}>{label}</button>
          ))}
        </div>

        <h1 className="signup-title" style={{ marginTop: 18 }}>{t('deleteRequest.title')}</h1>
        <p className="signup-lead">{t('deleteRequest.lead')}</p>

        <section className="signup-notice" aria-labelledby="delete-request-in-app">
          <h2 id="delete-request-in-app">{t('deleteRequest.inAppHeading')}</h2>
          <p>{t('deleteRequest.inApp')}</p>
          <h2 id="delete-request-what">{t('deleteRequest.whatHeading')}</h2>
          <p>{t('deleteRequest.what')}</p>
          <p>{t('deleteRequest.device')}</p>
          <p className="signup-notice-foot"><a href="/privacy">{t('deleteRequest.privacyLink')}</a></p>
        </section>

        <section aria-labelledby="delete-request-here" style={{ marginTop: 20 }}>
          <h2 id="delete-request-here" className="signup-sublabel" style={{ fontSize: 17 }}>{t('deleteRequest.hereHeading')}</h2>
          <p className="muted" style={{ fontSize: 14 }}>{t('deleteRequest.here')}</p>

          {done ? (
            <p role="status" className="signup-lead" data-testid="delete-request-done" data-outcome={done}>
              {done === 'deleted' ? t('deleteRequest.deleted') : t('deleteRequest.none')}
            </p>
          ) : <>
            <label className="label" htmlFor="delete-request-email">{t('deleteRequest.email')}</label>
            <input className="input" id="delete-request-email" type="email" inputMode="email" autoComplete="email" maxLength={254}
              value={email} disabled={!!busy}
              onChange={e => {
                setEmail(e.target.value); setError('');
                // A code is bound to the address it was sent to. Editing the
                // address drops the pending challenge instead of letting the
                // next code count as a failed attempt against the old one.
                if (challengeId) { setChallengeId(null); setCode(''); setNotice(''); }
              }} />
            {!challengeId && (
              <button type="button" className="btn btn-primary signup-next" data-testid="delete-request-send"
                disabled={!!busy || !email.trim()} onClick={sendCode}>
                {busy === 'send' ? t('deleteRequest.sending') : t('deleteRequest.sendCode')}
              </button>
            )}
            {challengeId && <>
              <p className="signup-sublabel" id="delete-request-code-label">{t('deleteRequest.codeLabel')}</p>
              <OtpInput value={code} onChange={value => { setCode(value); setInvalid(false); setError(''); }} onComplete={confirm}
                disabled={!!busy} invalid={invalid} idPrefix="delete-request-code" labelledBy="delete-request-code-label" />
              <div className="signup-social">
                <button type="button" className="btn btn-primary" data-testid="delete-request-confirm"
                  disabled={!!busy || code.length !== OTP_LENGTH} onClick={() => confirm()}>
                  {busy === 'confirm' ? t('deleteRequest.deleting') : t('deleteRequest.confirm')}
                </button>
                <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={sendCode} data-testid="delete-request-resend">
                  {busy === 'send' ? t('deleteRequest.sending') : t('deleteRequest.resend')}
                </button>
              </div>
            </>}
            {notice && <p role="status" className="signup-hint">{notice}</p>}
            {error && <div className="error-box signup-error" role="alert">{error}</div>}
          </>}
        </section>
      </main>
    </div>
  );
}
