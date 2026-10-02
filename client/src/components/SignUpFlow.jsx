// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · account sign-up and sign-in
//
//   who → age → class & track → how (phone · email · Google · Apple) → code
//       → a parent's approval if under 18 → the first question
//
// One step on screen at a time, moving forward or back with a short slide that
// collapses to nothing under prefers-reduced-motion. Each step's heading takes
// focus when it arrives, so a screen reader hears where it is.
//
// The server decides everything that matters (server/platform/otp.js): codes
// are checked there, a child's account is created limited, and only a parent's
// code or emailed link lifts the limit. This file only asks the questions.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { cloudDeviceId } from '../platform/cloudAccount.js';
import { requestIdentityToken, socialProviderConfig } from '../platform/socialSignIn.js';
import { tLater, useT } from '../i18n/index.js';
import OtpInput, { OTP_LENGTH } from './OtpInput.jsx';
import './SignUpFlow.css';

const CLASSES = [7, 8, 9, 10, 11, 12];
const AGES = [11, 12, 13, 14, 15, 16, 17];
const TRACKS = [
  // Examination names, written the same in every language (as in Login.jsx).
  { key: 'cbse', label: 'CBSE' },
  { key: 'jee-main', label: 'JEE Main' },
  { key: 'jee-advanced', label: 'JEE Advanced' }
];
const RESEND_SECONDS = 30;
// Must equal CONSENT_NOTICE_VERSION in server/platform/guardianConsent.js; the
// server refuses an approval that names any other notice.
export const GUARDIAN_NOTICE_VERSION = '2026-10-02';

function stepsFor({ mode, role, minor }) {
  if (role === 'parent') return ['role', 'parent-home'];
  if (mode === 'signin') return ['method', 'code', 'age', 'class', ...(minor ? ['parent', 'parent-wait'] : [])];
  return ['role', 'age', 'class', 'method', 'code', ...(minor ? ['parent', 'parent-wait'] : [])];
}

/** Read an SMS code through WebOTP where the browser offers it (Android Chrome). */
function listenForSmsCode(onCode) {
  if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials?.get) return () => {};
  const controller = new AbortController();
  navigator.credentials.get({ otp: { transport: ['sms'] }, signal: controller.signal })
    .then(credential => { if (credential?.code) onCode(String(credential.code)); })
    .catch(() => { /* dismissed, aborted or unsupported: the boxes still work */ });
  return () => controller.abort();
}

export default function SignUpFlow({ initialMode = 'signup', onCancel, onFinish, onStartOffline }) {
  const t = useT();
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState(initialMode === 'signin' ? 'student' : '');
  const [age, setAge] = useState(null);           // number, or 18 for "18 or older"
  const [year, setYear] = useState(null);
  const [track, setTrack] = useState('cbse');
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('sms');
  const [destination, setDestination] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [account, setAccount] = useState(null);
  const [consent, setConsent] = useState(null);
  const [parentName, setParentName] = useState('');
  const [parentChannel, setParentChannel] = useState('sms');
  const [parentDestination, setParentDestination] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [providers, setProviders] = useState({ google: null, apple: null });
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState('forward');
  const headingRef = useRef(null);
  const available = cloudAvailable();

  const minor = role !== 'parent' && age !== null && age < 18;
  const steps = useMemo(() => stepsFor({ mode, role, minor }), [mode, role, minor]);
  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);
  useEffect(() => {
    if (resendAt <= now) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, now]);
  useEffect(() => {
    if (!available) return undefined;
    let live = true;
    socialProviderConfig().then(config => { if (live) setProviders(config); }).catch(() => {});
    return () => { live = false; };
  }, [available]);
  // WebOTP: on the code steps for an SMS, offer the incoming code to the boxes.
  useEffect(() => {
    if (step === 'code' && channel === 'sms') return listenForSmsCode(c => { setCode(c); void verify(c); });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, channel]);
  // Waiting for the parent: they approve on their own page, so this screen
  // only watches the account's consent state and moves on when it is given.
  useEffect(() => {
    if (step !== 'parent-wait') return undefined;
    let live = true;
    const poll = async () => {
      try {
        const state = await cloud.guardianState();
        if (live && state?.state === 'given') { setConsent({ required: true, state: 'given' }); void finish(account); }
      } catch { /* offline or signed out: keep waiting, the buttons still work */ }
    };
    const timer = setInterval(poll, 4000);
    void poll();
    return () => { live = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const go = (to) => {
    setError(''); setInvalid(false);
    const target = typeof to === 'number' ? to : steps.indexOf(to);
    setDirection(target < index ? 'back' : 'forward');
    setIndex(Math.max(0, target));
  };
  const next = () => go(index + 1);
  const back = () => {
    if (index === 0) { onCancel?.(); return; }
    // Once an account exists, going back past the code would re-ask for it.
    if (account && steps[index - 1] === 'code') { go(index - 2 >= 0 ? index - 2 : 0); return; }
    go(index - 1);
  };
  const fail = (err) => {
    setError(err?.message || tLater('signup.genericError'));
    setBusy('');
  };

  const profile = () => ({ name: name.trim(), year: year == null ? undefined : String(year), isAdult: age === null ? undefined : age >= 18, role });

  async function sendCode() {
    if (busy) return;
    if (mode === 'signup' && !name.trim()) { setError(tLater('signup.nameRequired')); return; }
    setBusy('send'); setError('');
    try {
      const sent = await cloud.otpRequest({ channel, destination });
      setChallenge(sent.challengeId);
      setCode('');
      setResendAt(Date.now() + (sent.resendAfterMs || RESEND_SECONDS * 1000));
      setNow(Date.now());
      setBusy('');
      if (step !== 'code') go('code');
    } catch (err) { fail(err); }
  }

  async function verify(submitted = code) {
    if (busy === 'verify' || submitted.length !== OTP_LENGTH) return;
    setBusy('verify'); setError(''); setInvalid(false);
    try {
      const deviceId = await cloudDeviceId();
      const body = { channel, destination, challengeId: challenge, code: submitted, deviceId };
      if (mode === 'signup') body.profile = profile();
      const result = await cloud.otpVerify(body);
      if (result.status === 'profile-required') {
        // A sign-in for an address with no account: ask the sign-up questions,
        // then finish with the ticket the code earned.
        setTicket(result.signupTicket);
        setMode('signup');
        setRole('student');
        setBusy('');
        setDirection('forward');
        setIndex(stepsFor({ mode: 'signup', role: 'student', minor: false }).indexOf('role'));
        return;
      }
      await signedIn(result);
    } catch (err) {
      setInvalid(err?.code === 'OTP_INVALID');
      setCode('');
      const left = err?.code === 'OTP_INVALID' && Number.isFinite(err?.attemptsRemaining) ? err.attemptsRemaining : null;
      fail(left === 0 ? { message: tLater('signup.codeLocked') } : err);
    }
  }

  async function completeWithTicket() {
    setBusy('verify'); setError('');
    try {
      const deviceId = await cloudDeviceId();
      const result = await cloud.otpVerify({ channel, destination, signupTicket: ticket, deviceId, profile: profile() });
      await signedIn(result);
    } catch (err) { fail(err); }
  }

  async function signedIn(result) {
    setAccount(result.account);
    setConsent(result.guardianConsent || null);
    if (!name.trim() && result.account?.name) setName(result.account.name);
    setBusy('');
    const needsParent = result.guardianConsent?.required && result.guardianConsent.state !== 'given';
    if (mode === 'signin' && !result.created) {
      // Returning learner on a new device: we still need the class to set up
      // this device's profile; age only matters if a parent is still pending.
      setAge(needsParent ? 15 : 18);
      setDirection('forward');
      setIndex(stepsFor({ mode: 'signin', role: 'student', minor: needsParent }).indexOf('class'));
      return;
    }
    if (needsParent) { go('parent'); return; }
    await finish(result.account);
  }

  async function social(provider) {
    if (!providers[provider] || busy) return;
    if (mode === 'signup' && !name.trim() && provider === 'apple') { setError(tLater('signup.nameRequired')); return; }
    setBusy(`social-${provider}`); setError('');
    try {
      const token = await requestIdentityToken(provider, providers[provider]);
      const deviceId = await cloudDeviceId();
      const p = profile();
      const body = { ...token, deviceId, createAccount: mode === 'signup' };
      if (mode === 'signup') Object.assign(body, { name: p.name, year: p.year, isAdult: p.isAdult, guardianLater: true });
      const result = await cloud.socialSignIn(provider, body);
      const state = result.created && minor ? { required: true, state: 'pending' } : null;
      await signedIn({ ...result, guardianConsent: state });
    } catch (err) { fail(err); }
  }

  async function askParent() {
    if (busy) return;
    if (!parentName.trim()) { setError(tLater('signup.parentNameRequired')); return; }
    setBusy('parent'); setError('');
    try {
      const sent = await cloud.guardianOtpRequest({ guardianName: parentName.trim(), channel: parentChannel, destination: parentDestination });
      if (sent.alreadyApproved) { setBusy(''); await finish(account); return; }
      setResendAt(Date.now() + (sent.resendAfterMs || RESEND_SECONDS * 1000));
      setNow(Date.now());
      setBusy('');
      if (step !== 'parent-wait') go('parent-wait');
    } catch (err) { fail(err); }
  }

  async function finish(signedInAccount = account) {
    setBusy('finish');
    try {
      await onFinish({ account: signedInAccount, name: name.trim() || signedInAccount?.name || '', year: year || 9, track });
    } catch (err) { fail(err); }
  }

  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const progress = Math.round(((index + 1) / steps.length) * 100);
  const heading = (key, vars) => (
    <h2 className="signup-title" tabIndex={-1} ref={headingRef} id="signup-step-title">{t(key, vars)}</h2>
  );
  const choice = (selected, label, onClick, testId, extra = '') => (
    <button type="button" className={`signup-choice${selected ? ' is-selected' : ''}${extra}`} aria-pressed={selected}
      onClick={onClick} data-testid={testId}>{label}</button>
  );

  let body = null;
  if (step === 'role') {
    body = (
      <>
        {heading('signup.roleTitle')}
        <p className="signup-lead">{t('signup.roleLead')}</p>
        <div className="signup-choices signup-choices-2">
          {choice(role === 'student', t('signup.roleStudent'), () => { setRole('student'); setDirection('forward'); setIndex(1); }, 'signup-role-student')}
          {choice(role === 'parent', t('signup.roleParent'), () => { setRole('parent'); setDirection('forward'); setIndex(1); }, 'signup-role-parent')}
        </div>
      </>
    );
  } else if (step === 'parent-home') {
    body = <ParentHome t={t} heading={heading} onStartChild={() => { setRole('student'); setDirection('forward'); setIndex(1); }} />;
  } else if (step === 'age') {
    body = (
      <>
        {heading('signup.ageTitle')}
        <p className="signup-lead">{t('signup.ageLead')}</p>
        <div className="signup-choices signup-choices-4">
          {AGES.map(a => choice(age === a, String(a), () => { setAge(a); next(); }, `signup-age-${a}`))}
          {choice(age === 18, t('signup.ageAdult'), () => { setAge(18); next(); }, 'signup-age-18', ' signup-choice-wide')}
        </div>
      </>
    );
  } else if (step === 'class') {
    const jee = track !== 'cbse';
    const ready = year && (!jee || year >= 11);
    body = (
      <>
        {heading('signup.classTitle')}
        <div className="signup-choices signup-choices-6" role="group" aria-label={t('signup.classLabel')}>
          {CLASSES.map(c => choice(year === c, String(c), () => { setYear(c); if (c < 11) setTrack('cbse'); }, `signup-class-${c}`))}
        </div>
        <p className="signup-sublabel" id="signup-track-label">{t('signup.trackLabel')}</p>
        <div className="signup-segment" role="radiogroup" aria-labelledby="signup-track-label">
          {TRACKS.map(option => {
            const disabled = option.key !== 'cbse' && year !== null && year < 11;
            return (
              <button key={option.key} type="button" role="radio" aria-checked={track === option.key} disabled={disabled}
                className={`signup-seg${track === option.key ? ' is-selected' : ''}`} data-testid={`signup-track-${option.key}`}
                onClick={() => { setTrack(option.key); if (year !== null && year < 11) setYear(11); }}>
                {option.label}
              </button>
            );
          })}
        </div>
        {jee && <p className="signup-hint">{t('signup.trackJeeHint')}</p>}
        <button type="button" className="btn btn-primary btn-lg signup-next" disabled={!ready || !!busy}
          onClick={() => (account ? (minor && consent?.state !== 'given' ? go('parent') : finish()) : ticket ? completeWithTicket() : next())}
          data-testid="signup-class-next">
          {t('signup.continue')}
        </button>
      </>
    );
  } else if (step === 'method') {
    const isSms = channel === 'sms';
    body = (
      <>
        {heading(mode === 'signin' ? 'signup.signinTitle' : 'signup.methodTitle')}
        {!available && <p className="signup-hint" role="status">{t('signup.cloudUnavailable')}</p>}
        {mode === 'signup' && (
          <>
            <label className="label" htmlFor="signup-flow-name">{t('signup.nameLabel')}</label>
            <input className="input" id="signup-flow-name" autoComplete="given-name" value={name} maxLength={80}
              onChange={e => { setName(e.target.value); setError(''); }} />
          </>
        )}
        <div className="signup-segment signup-channel" role="radiogroup" aria-label={t('signup.channelLabel')}>
          <button type="button" role="radio" aria-checked={isSms} className={`signup-seg${isSms ? ' is-selected' : ''}`}
            onClick={() => { setChannel('sms'); setDestination(''); setError(''); }} data-testid="signup-channel-sms">{t('signup.channelPhone')}</button>
          <button type="button" role="radio" aria-checked={!isSms} className={`signup-seg${!isSms ? ' is-selected' : ''}`}
            onClick={() => { setChannel('email'); setDestination(''); setError(''); }} data-testid="signup-channel-email">{t('signup.channelEmail')}</button>
        </div>
        <form className="signup-form" onSubmit={e => { e.preventDefault(); void sendCode(); }}>
          <label className="label" htmlFor="signup-destination">{isSms ? t('signup.phoneLabel') : t('signup.emailLabel')}</label>
          <div className={isSms ? 'signup-phone' : ''}>
            {isSms && <span className="signup-cc" aria-hidden="true">+91</span>}
            <input className="input" id="signup-destination" value={destination} disabled={!available}
              type={isSms ? 'tel' : 'email'} inputMode={isSms ? 'tel' : 'email'}
              autoComplete={isSms ? 'tel-national' : 'email'} maxLength={isSms ? 16 : 254}
              placeholder={isSms ? '98765 43210' : ''}
              onChange={e => { setDestination(e.target.value); setError(''); }} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg signup-next" disabled={!available || !destination.trim() || !!busy} data-testid="signup-send-code">
            {busy === 'send' ? t('signup.sending') : t('signup.sendCode')}
          </button>
        </form>
        {(providers.google || providers.apple) && (
          <>
            <div className="signup-or"><span>{t('signup.or')}</span></div>
            <div className="signup-social">
              {providers.google && <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => social('google')}>{t('signup.withGoogle')}</button>}
              {providers.apple && <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => social('apple')}>{t('signup.withApple')}</button>}
            </div>
          </>
        )}
        <div className="signup-alt">
          {mode === 'signup'
            ? <button type="button" className="linklike" onClick={() => { setMode('signin'); setRole('student'); setDirection('forward'); setIndex(0); }}>{t('signup.haveAccount')}</button>
            : <button type="button" className="linklike" onClick={() => { setMode('signup'); setRole(''); setDirection('back'); setIndex(0); }}>{t('signup.newHere')}</button>}
          {onStartOffline && <button type="button" className="linklike" onClick={onStartOffline}>{t('signup.offline')}</button>}
        </div>
      </>
    );
  } else if (step === 'code') {
    body = (
      <>
        {heading('signup.codeTitle')}
        <p className="signup-lead" id="signup-code-lead">{t(channel === 'sms' ? 'signup.codeSentPhone' : 'signup.codeSentEmail', { to: channel === 'sms' ? `+91 ${destination.trim()}` : destination.trim() })}</p>
        <OtpInput value={code} onChange={c => { setCode(c); setInvalid(false); setError(''); }} onComplete={c => verify(c)}
          disabled={busy === 'verify'} invalid={invalid} idPrefix="signup-code" labelledBy="signup-step-title signup-code-lead" />
        {busy === 'verify' && <p className="signup-hint" role="status">{t('signup.checking')}</p>}
        <div className="signup-alt">
          <button type="button" className="linklike" disabled={waitSeconds > 0 || !!busy} onClick={() => sendCode()} data-testid="signup-resend">
            {waitSeconds > 0 ? t('signup.resendIn', { n: waitSeconds }) : t('signup.resend')}
          </button>
          <button type="button" className="linklike" onClick={() => go('method')}>{t(channel === 'sms' ? 'signup.changeNumber' : 'signup.changeEmail')}</button>
        </div>
      </>
    );
  } else if (step === 'parent') {
    const isSms = parentChannel === 'sms';
    body = (
      <>
        {heading('signup.parentTitle')}
        <p className="signup-lead">{t('signup.parentLead')}</p>
        <form className="signup-form" onSubmit={e => { e.preventDefault(); void askParent(); }}>
          <label className="label" htmlFor="signup-parent-name">{t('signup.parentNameLabel')}</label>
          <input className="input" id="signup-parent-name" value={parentName} maxLength={80} autoComplete="off"
            onChange={e => { setParentName(e.target.value); setError(''); }} />
          <div className="signup-segment signup-channel" role="radiogroup" aria-label={t('signup.parentChannelLabel')}>
            <button type="button" role="radio" aria-checked={isSms} className={`signup-seg${isSms ? ' is-selected' : ''}`}
              onClick={() => { setParentChannel('sms'); setParentDestination(''); }} data-testid="signup-parent-sms">{t('signup.channelPhone')}</button>
            <button type="button" role="radio" aria-checked={!isSms} className={`signup-seg${!isSms ? ' is-selected' : ''}`}
              onClick={() => { setParentChannel('email'); setParentDestination(''); }} data-testid="signup-parent-email">{t('signup.channelEmail')}</button>
          </div>
          <label className="label" htmlFor="signup-parent-destination">{isSms ? t('signup.parentPhoneLabel') : t('signup.parentEmailLabel')}</label>
          <div className={isSms ? 'signup-phone' : ''}>
            {isSms && <span className="signup-cc" aria-hidden="true">+91</span>}
            <input className="input" id="signup-parent-destination" value={parentDestination}
              type={isSms ? 'tel' : 'email'} inputMode={isSms ? 'tel' : 'email'} autoComplete="off" maxLength={isSms ? 16 : 254}
              onChange={e => { setParentDestination(e.target.value); setError(''); }} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg signup-next" disabled={!parentDestination.trim() || !!busy} data-testid="signup-parent-send">
            {busy === 'parent' ? t('signup.sending') : t('signup.parentSend')}
          </button>
        </form>
        <div className="signup-alt">
          <button type="button" className="linklike" onClick={() => finish()} data-testid="signup-parent-later">{t('signup.parentLater')}</button>
        </div>
      </>
    );
  } else if (step === 'parent-wait') {
    const page = `${typeof window !== 'undefined' ? window.location.origin : ''}/guardian/consent`;
    body = (
      <>
        {heading('signup.waitTitle')}
        <p className="signup-lead">{t(parentChannel === 'sms' ? 'signup.waitLeadSms' : 'signup.waitLeadEmail', { name: parentName.trim() })}</p>
        <p className="signup-wait-page"><span>{t('signup.waitPageLabel')}</span> <strong>{page}</strong></p>
        <p className="signup-hint" role="status" data-testid="signup-parent-waiting">{t('signup.waitLimited')}</p>
        <div className="signup-alt">
          <button type="button" className="linklike" disabled={waitSeconds > 0 || !!busy} onClick={askParent} data-testid="signup-parent-resend">
            {waitSeconds > 0 ? t('signup.resendIn', { n: waitSeconds }) : t('signup.resend')}
          </button>
          <button type="button" className="linklike" onClick={() => finish()} data-testid="signup-parent-continue">{t('signup.parentLater')}</button>
        </div>
      </>
    );
  }

  return (
    <div className="signup-flow" data-signup-step={step}>
      <div className="signup-top">
        <button type="button" className="signup-back" onClick={back} aria-label={t('signup.back')} disabled={busy === 'verify' || busy === 'finish'}>
          <span aria-hidden="true">←</span>
        </button>
        <div className="signup-progress" role="progressbar" aria-label={t('signup.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
      </div>
      <div key={step} className={`signup-step signup-dir-${direction}`}>
        {body}
        {error && <div className="error-box signup-error" role="alert">{error}</div>}
        {busy === 'finish' && <p className="signup-hint" role="status">{t('signup.settingUp')}</p>}
      </div>
    </div>
  );
}

/** A parent's own screen: what Pri asks of them, and how to withdraw. */
function ParentHome({ t, heading, onStartChild }) {
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function request(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const sent = await cloud.guardianWithdrawRequest({ destination: phone });
      setChallenge(sent.challengeId);
      setMessage(tLater('signup.withdrawSent'));
    } catch (err) { setError(err?.message || tLater('signup.genericError')); }
    finally { setBusy(false); }
  }

  async function withdraw(value = code) {
    if (value.length !== OTP_LENGTH) return;
    setBusy(true); setError('');
    try {
      const result = await cloud.guardianWithdrawByPhone({ destination: phone, challengeId: challenge, code: value });
      setMessage(tLater('signup.withdrawDone', { n: result.withdrawn }));
      setChallenge(null);
    } catch (err) { setError(err?.message || tLater('signup.genericError')); setCode(''); }
    finally { setBusy(false); }
  }

  return (
    <>
      {heading('signup.parentHomeTitle')}
      <p className="signup-lead">{t('signup.parentHomeLead')}</p>
      <ol className="signup-parent-steps">
        <li>{t('signup.parentHome1')}</li>
        <li>{t('signup.parentHome2')}</li>
        <li>{t('signup.parentHome3')}</li>
      </ol>
      <button type="button" className="btn btn-primary btn-lg signup-next" onClick={onStartChild}>{t('signup.parentSetUpChild')}</button>
      <h3 className="signup-subhead">{t('signup.withdrawTitle')}</h3>
      {!challenge ? (
        <form className="signup-form" onSubmit={request}>
          <label className="label" htmlFor="signup-withdraw-phone">{t('signup.withdrawPhone')}</label>
          <div className="signup-phone">
            <span className="signup-cc" aria-hidden="true">+91</span>
            <input className="input" id="signup-withdraw-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} maxLength={16}
              onChange={e => setPhone(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-ghost" disabled={busy || !phone.trim()}>{t('signup.sendCode')}</button>
        </form>
      ) : (
        <OtpInput value={code} onChange={setCode} onComplete={withdraw} disabled={busy} idPrefix="signup-withdraw-code" labelledBy="signup-step-title" />
      )}
      {message && <p className="signup-hint" role="status">{message}</p>}
      {error && <div className="error-box signup-error" role="alert">{error}</div>}
    </>
  );
}
