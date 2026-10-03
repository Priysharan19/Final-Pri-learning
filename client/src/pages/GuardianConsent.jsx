// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the parent's own consent page — /guardian/consent
//
// A parent approves here, on their own phone or computer, never inside the
// child's signed-in app. They arrive either from the emailed link (the token is
// in the URL fragment and is stripped before render, as on /account-action) or
// by typing the address from the SMS and entering the code they were sent.
// No child session is used or needed. The page shows the plain-language notice
// first; the code box opens only after they say they agree.
//
// What this establishes is a parent-controlled channel: someone holding that
// phone or inbox approved. It is not identity verification (no DigiLocker);
// see docs/release/otp-sign-in.md.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { tLater, useT } from '../i18n/index.js';
import OtpInput, { OTP_LENGTH } from '../components/OtpInput.jsx';
import { GUARDIAN_NOTICE_VERSION } from '../components/SignUpFlow.jsx';
import '../components/SignUpFlow.css';

// The wordmark after the P mark (allowlisted literal, as in App.jsx's Logo).
const WORDMARK = 'ri Learning';

function Notice({ t }) {
  return (
    <section className="signup-notice" aria-labelledby="guardian-notice-title">
      <h2 id="guardian-notice-title">{t('signup.noticeHeading')}</h2>
      <ul>
        <li>{t('signup.noticeWhat')}</li>
        <li>{t('signup.noticeWhy')}</li>
        <li>{t('signup.noticeNot')}</li>
        <li>{t('signup.noticeWithdraw')}</li>
      </ul>
      <p className="signup-notice-foot">{t('signup.noticeVersion', { v: GUARDIAN_NOTICE_VERSION })}</p>
    </section>
  );
}

function Page({ children }) {
  return (
    <div className="auth-wrap">
      <main className="auth-col signup-flow guardian-page">
        <div className="logo logo-lg" aria-label="Pri Learning">
          <span className="logo-bb" aria-hidden="true">P</span><span className="logo-name">{WORDMARK}<span className="logo-dot">.</span></span>
        </div>
        <div style={{ marginTop: 24 }}>{children}</div>
      </main>
    </div>
  );
}

export default function GuardianConsent({ linkToken = null }) {
  const t = useT();
  const [channel, setChannel] = useState('sms');
  const [destination, setDestination] = useState('');
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);

  async function approveWithCode(value = code) {
    if (busy || !agree || value.length !== OTP_LENGTH || !destination.trim()) return;
    setBusy(true); setError(''); setInvalid(false);
    try {
      const result = await cloud.guardianOtpApprove({ channel, destination, code: value, approve: true, noticeVersion: GUARDIAN_NOTICE_VERSION });
      setDone(result.childName ? tLater('guardianPage.approvedNamed', { name: result.childName }) : tLater('guardianPage.approved'));
    } catch (err) {
      setInvalid(err?.code === 'OTP_INVALID');
      setCode('');
      setError(err?.code === 'OTP_INVALID' ? tLater('guardianPage.codeInvalid') : (err?.message || tLater('signup.genericError')));
    } finally { setBusy(false); }
  }

  async function answerLink(choice) {
    setBusy(true); setError('');
    try {
      if (choice === 'confirm') await cloud.guardianConfirm(linkToken);
      else await cloud.guardianWithdraw(linkToken);
      setDone(choice === 'confirm' ? tLater('guardianPage.approved') : tLater('guardianPage.declined'));
    } catch (err) {
      setError(err?.code === 'TOKEN_INVALID' ? tLater('accountAction.guardianInvalid') : tLater('accountAction.guardianFailed'));
    } finally { setBusy(false); }
  }

  if (done) {
    return <Page><h1 className="signup-title">{t('guardianPage.title')}</h1><p role="status" className="signup-lead">{done}</p></Page>;
  }

  if (linkToken) {
    return (
      <Page>
        <h1 className="signup-title">{t('guardianPage.title')}</h1>
        <p className="signup-lead">{t('guardianPage.lead')}</p>
        <Notice t={t} />
        <div className="signup-social">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => answerLink('confirm')} data-testid="guardian-link-approve">{t('signup.consentApprove')}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => answerLink('withdraw')}>{t('accountAction.keepOnDevice')}</button>
        </div>
        {error && <div className="error-box signup-error" role="alert">{error}</div>}
      </Page>
    );
  }

  const isSms = channel === 'sms';
  return (
    <Page>
      <h1 className="signup-title">{t('guardianPage.title')}</h1>
      <p className="signup-lead">{t('guardianPage.lead')}</p>
      <Notice t={t} />
      <div className="signup-segment signup-channel" role="radiogroup" aria-label={t('guardianPage.channelLabel')}>
        <button type="button" role="radio" aria-checked={isSms} className={`signup-seg${isSms ? ' is-selected' : ''}`}
          onClick={() => { setChannel('sms'); setDestination(''); }}>{t('signup.channelPhone')}</button>
        <button type="button" role="radio" aria-checked={!isSms} className={`signup-seg${!isSms ? ' is-selected' : ''}`}
          onClick={() => { setChannel('email'); setDestination(''); }}>{t('signup.channelEmail')}</button>
      </div>
      <label className="label" htmlFor="guardian-destination">{isSms ? t('guardianPage.yourPhone') : t('guardianPage.yourEmail')}</label>
      <div className={isSms ? 'signup-phone' : ''}>
        {isSms && <span className="signup-cc" aria-hidden="true">+91</span>}
        <input className="input" id="guardian-destination" value={destination} type={isSms ? 'tel' : 'email'}
          inputMode={isSms ? 'tel' : 'email'} autoComplete={isSms ? 'tel-national' : 'email'} maxLength={isSms ? 16 : 254}
          onChange={e => { setDestination(e.target.value); setError(''); }} />
      </div>
      <label className="signup-agree" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} data-testid="guardian-agree" />
        <span>{t('signup.consentAgree')}</span>
      </label>
      <p className="signup-sublabel" id="guardian-code-label">{t('guardianPage.codeLabel')}</p>
      <OtpInput value={code} onChange={c => { setCode(c); setInvalid(false); setError(''); }} autoFocus={false}
        disabled={!agree || busy} invalid={invalid} idPrefix="guardian-code" labelledBy="guardian-code-label" />
      <button type="button" className="btn btn-primary btn-lg signup-next" data-testid="guardian-approve"
        disabled={!agree || busy || code.length !== OTP_LENGTH || !destination.trim()} onClick={() => approveWithCode()}>
        {busy ? t('signup.checking') : t('signup.consentApprove')}
      </button>
      {error && <div className="error-box signup-error" role="alert">{error}</div>}
      <p className="signup-hint">{t('guardianPage.withdrawHint')}</p>
    </Page>
  );
}
