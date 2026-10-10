// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the one sign-in card
//
//   email → Continue with email → six-digit code, in this same card
//        → signed in                      (the address already has an account)
//        → name & age → class → signed in (a new address: the account is made
//                                          and verified by the code just typed)
//        → a parent's approval, explained where it is needed, if under 18
//
// New and returning students take the same road; nobody chooses "sign up" or
// "sign in" first, and nobody types an email twice. Below the email field the
// card offers only what the server says it can do: Google / Apple when the
// deployment configures them (/v1/account/identity/providers), a phone code
// only where an SMS provider exists (/v1/account/otp/channels), and a small
// "Sign in with password" for accounts that already have one.
//
// `allowCreate={false}` is a profile that is already linked to an account and is
// signing in again: the card signs in, and never makes a second account.
//
// Two variants, one component:
//   page    the landing screen. Ends by handing { account, name, year, track }
//           to the caller, which makes this device's profile and opens practice.
//   inline  inside a page the student is already working on (a question, the
//           account panel). The profile exists, so the class is never asked
//           again; the caller links the account and closes the card. Nothing
//           here navigates, reloads, reads handwriting or submits anything.
//
// The server decides everything that matters (server/platform/otp.js): codes
// are checked there, expire there, are single-use there; a child's account is
// created limited and only a parent's own approval lifts the limit. This file
// asks the questions and says plainly what happened.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { cloudDeviceId } from '../platform/cloudAccount.js';
import { requestIdentityToken, socialProviderConfig } from '../platform/socialSignIn.js';
import { tLater, useT, useTx } from '../i18n/index.js';
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
const CODE_LIFETIME_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Must equal CONSENT_NOTICE_VERSION in server/platform/guardianConsent.js; the
// server refuses an approval that names any other notice.
export const GUARDIAN_NOTICE_VERSION = '2026-10-02';

/** Read an SMS code through WebOTP where the browser offers it (Android Chrome). */
function listenForSmsCode(onCode) {
  if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials?.get) return () => {};
  const controller = new AbortController();
  navigator.credentials.get({ otp: { transport: ['sms'] }, signal: controller.signal })
    .then(credential => { if (credential?.code) onCode(String(credential.code)); })
    .catch(() => { /* dismissed, aborted or unsupported: the boxes still work */ });
  return () => controller.abort();
}

/**
 * True when the request never reached the server: offline, a dropped
 * connection, a timeout. fetch reports these as a bare TypeError or a
 * DOMException (whose legacy numeric `code` is not one of ours); every answer
 * the server gave, and every refusal raised in this app, carries a status or a
 * string code. Nothing was spent by a request that never arrived.
 */
export function isNetworkFailure(error) {
  if (!error || Number(error.status) > 0) return false;
  if (typeof error.code === 'string' && error.code) return false;
  return true;
}

/**
 * The words for a refused or failed request, as a catalogue key. Pure: the
 * card's whole error vocabulary is in this one table, and it is tested without
 * a browser (client/test/sign-in-card-check.mjs).
 *
 * `OTP_INVALID` is the server's single answer for a wrong, expired, spent or
 * unknown code — it deliberately does not say which. The card adds only what
 * it knows itself: the tries the server reported, and its own clock.
 */
export function signInErrorCopy(error, { expired = false } = {}) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const status = Number(error?.status) || 0;
  if (isNetworkFailure(error)) return { key: 'signup.offlineError', kind: 'network' };
  if (code === 'OTP_INVALID') {
    if (expired) return { key: 'signup.codeExpired', kind: 'expired' };
    const left = Number.isFinite(error?.attemptsRemaining) ? Number(error.attemptsRemaining) : null;
    if (left === 0) return { key: 'signup.codeLocked', kind: 'locked' };
    if (left !== null) return { key: 'signup.codeWrongLeft', vars: { count: left, n: left }, kind: 'wrong' };
    return { key: 'signup.codeWrongOrExpired', kind: 'wrong' };
  }
  if (code === 'OTP_RATE_LIMITED' || status === 429) {
    if (code === 'ACCOUNT_LOCKED') return { key: 'signup.passwordLocked', kind: 'locked' };
    const seconds = Number.isFinite(error?.retryAfterMs) ? Math.max(1, Math.ceil(error.retryAfterMs / 1000)) : null;
    return seconds && seconds <= 120
      ? { key: 'signup.rateLimited', vars: { n: seconds }, kind: 'rate' }
      : { key: 'signup.rateLimitedPlain', kind: 'rate' };
  }
  if (code === 'OTP_DESTINATION_INVALID') return { key: 'signup.emailInvalid', kind: 'input' };
  if (code === 'OTP_EMAIL_NOT_CONFIGURED' || code === 'OTP_SMS_NOT_CONFIGURED') return { key: 'signup.codesOff', kind: 'outage' };
  if (code === 'OTP_DELIVERY_FAILED') return { key: 'signup.deliveryFailed', kind: 'outage' };
  if (code === 'BAD_CREDENTIALS') return { key: 'signup.passwordWrong', kind: 'wrong' };
  if (code === 'PROFILE_NAME_REQUIRED') return { key: 'signup.nameRequired', kind: 'input' };
  if (code === 'AGE_DECLARATION_REQUIRED' || code === 'CONSENT_DECLARATION_REQUIRED') return { key: 'signup.ageRequired', kind: 'input' };
  if (code === 'GUARDIAN_SAME_AS_STUDENT' || code === 'GUARDIAN_EMAIL_SAME_AS_STUDENT') return { key: 'signup.parentNotYou', kind: 'input' };
  if (code === 'GUARDIAN_CONSENT_WITHDRAWN') return { key: 'cloud.guardianDeclined', kind: 'blocked' };
  if (code === 'IDENTITY_LINK_REQUIRED') return { key: 'signup.socialUseEmail', kind: 'blocked' };
  if (code === 'OIDC_NONCE_INVALID') return { key: 'signup.socialStartAgain', kind: 'expired' };
  if (code === 'OIDC_PROVIDER_NOT_CONFIGURED' || code === 'SOCIAL_PROVIDER_ERROR') return { key: 'signup.socialFailed', kind: 'outage' };
  if (code === 'SOCIAL_POPUP_BLOCKED') return { key: 'cloud.socialPopupBlocked', kind: 'blocked' };
  if (code === 'SOCIAL_TIMEOUT') return { key: 'cloud.socialTimedOut', kind: 'expired' };
  if (code === 'CLOUD_LINK_CONFLICT' || code === 'INK_ACCOUNT_MISMATCH') return { key: 'signup.otherAccount', kind: 'blocked' };
  if (code === 'INK_PROFILE_CHANGED') return { key: 'signup.profileChanged', kind: 'blocked' };
  if (code === 'INK_DRAFT_NOT_SAVED') return { key: 'signup.saveFirst', kind: 'blocked' };
  if (status >= 500 || code === 'CLOUD_DISABLED') return { key: 'signup.serverDown', kind: 'outage' };
  return { key: 'signup.genericError', kind: 'unknown' };
}

export default function SignUpFlow({
  variant = 'page', initialName = '', knownYear = null, knownTrack = null, allowCreate = true,
  onCancel = null, onFinish, onStartOffline = null, onStep = null
}) {
  const t = useT();
  const tx = useTx();
  const inline = variant === 'inline';
  const [step, setStep] = useState('method');
  const [direction, setDirection] = useState('forward');
  const [channel, setChannel] = useState('email');
  const [destination, setDestination] = useState('');
  const [challenge, setChallenge] = useState(null);     // { id, channel, destination, expiresAt }
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [pendingSocial, setPendingSocial] = useState(null);
  const [account, setAccount] = useState(null);
  const [consent, setConsent] = useState(null);
  const [name, setName] = useState(() => String(initialName || '').slice(0, 80));
  const [age, setAge] = useState(null);                 // number, or 18 for "18 or older"
  const [year, setYear] = useState(knownYear == null ? null : Number(knownYear));
  const [track, setTrack] = useState(knownTrack || 'cbse');
  const [password, setPassword] = useState('');
  // Asked where the account is made, as an action the student takes — never
  // assumed from pressing Continue.
  const [agreed, setAgreed] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentChannel, setParentChannel] = useState('email');
  const [parentDestination, setParentDestination] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [providers, setProviders] = useState({ google: null, apple: null });
  const [channels, setChannels] = useState({ email: true, sms: false });
  const headingRef = useRef(null);
  const firstRender = useRef(true);
  // Synchronous guards: React state is too late to stop a double tap, an
  // auto-submit racing the button, or two pastes in one tick.
  const verifying = useRef(false);
  const sending = useRef(false);
  const finishing = useRef(false);
  const available = cloudAvailable();

  const needsParent = !!consent?.required && consent.state !== 'given';
  const newAccount = !!ticket || !!pendingSocial;

  useEffect(() => { onStep?.(step); }, [step, onStep]);
  useEffect(() => {
    // The landing screen keeps its own focus on first paint; every later step
    // moves focus to its heading so a screen reader hears where it is.
    if (firstRender.current) { firstRender.current = false; if (!inline) return; }
    // The code step puts the caret in the first box instead (the keyboard and
    // the code suggestion open there); the group it belongs to is labelled by
    // this step's heading and lead, so it is announced on the way in.
    if (step === 'code') return;
    headingRef.current?.focus({ preventScroll: true });
  }, [step, inline]);
  useEffect(() => {
    if (resendAt <= now && !(step === 'code' && challenge)) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, now, step, challenge]);
  useEffect(() => {
    if (!available) return undefined;
    let live = true;
    socialProviderConfig().then(config => { if (live) setProviders(config); }).catch(() => {});
    // An older server without the route, or a moment offline: keep the email
    // default — asking for a code then says whatever is true.
    cloud.otpChannels().then(result => {
      if (!live || !result?.channels) return;
      setChannels({ email: result.channels.email !== false, sms: result.channels.sms === true });
    }).catch(() => {});
    return () => { live = false; };
  }, [available]);
  // A deployment with no email sender has only the password road.
  useEffect(() => { if (!channels.email && !channels.sms && step === 'method') setStep('password'); }, [channels, step]);
  // WebOTP: on the code step for an SMS, offer the incoming code to the boxes.
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

  const go = (to, dir = 'forward') => {
    setError(''); setInvalid(false); setNotice('');
    setDirection(dir);
    setStep(to);
  };
  const say = (copy) => setError(tLater(copy.key, copy.vars));
  const fail = (err, options) => {
    const copy = signInErrorCopy(err, options);
    say(copy);
    setBusy('');
    return copy;
  };

  const cleanDestination = () => (channel === 'email' ? destination.trim().toLowerCase() : destination.trim());
  const shownDestination = () => (channel === 'sms' ? `+91 ${destination.trim()}` : destination.trim());
  const profile = () => ({ name: name.trim(), year: year == null ? undefined : String(year), isAdult: age === null ? undefined : age >= 18, role: 'student' });
  const detailsReady = () => !!name.trim() && age !== null && (inline || year !== null);

  async function sendCode({ resend = false } = {}) {
    if (sending.current || busy) return;
    const to = cleanDestination();
    if (channel === 'email' && !EMAIL_RE.test(to)) { setError(tLater('signup.emailInvalid')); return; }
    if (!to) return;
    // The same address again while its code is still live and the cooldown has
    // not passed (back from "Change email" without changing it): the code that
    // was sent still works, so show its boxes rather than a rate-limit notice.
    if (!resend && challenge && challenge.channel === channel && challenge.destination === to
      && Date.now() < challenge.expiresAt && Date.now() < resendAt) {
      go('code');
      return;
    }
    sending.current = true;
    setBusy('send'); setError(''); setNotice('');
    try {
      const sent = await cloud.otpRequest({ channel, destination: to });
      const at = Date.now();
      setChallenge({ id: sent.challengeId, channel, destination: to, expiresAt: at + (Number(sent.expiresInMs) || CODE_LIFETIME_MS) });
      setCode(''); setInvalid(false); setTicket('');
      setResendAt(at + (Number(sent.resendAfterMs) || RESEND_SECONDS * 1000));
      setNow(at);
      setBusy('');
      if (step !== 'code') go('code');
      if (resend) setNotice(tLater('signup.codeResent', { to: shownDestination() }));
    } catch (err) {
      const copy = fail(err);
      if (copy.kind === 'rate' && Number.isFinite(err?.retryAfterMs)) { setResendAt(Date.now() + err.retryAfterMs); setNow(Date.now()); }
    } finally { sending.current = false; }
  }

  async function verify(submitted = code) {
    if (verifying.current) return;
    if (submitted.length !== OTP_LENGTH) { setError(tLater('signup.codeIncomplete')); return; }
    if (!challenge) return;
    // The card's own clock: a code past its ten minutes is said as expired,
    // with the way forward, without spending a request on it.
    if (Date.now() >= challenge.expiresAt) {
      setInvalid(true); setCode('');
      say({ key: 'signup.codeExpired' });
      return;
    }
    verifying.current = true;
    setBusy('verify'); setError(''); setNotice(''); setInvalid(false);
    try {
      const deviceId = await cloudDeviceId();
      const body = { channel: challenge.channel, destination: challenge.destination, challengeId: challenge.id, code: submitted, deviceId };
      // Details already given (a ticket ran out and a new code was needed):
      // one request finishes the account instead of asking again.
      if (detailsReady() && agreed && !account) body.profile = profile();
      const result = await cloud.otpVerify(body);
      if (result.status === 'profile-required' && !allowCreate) {
        // This profile already belongs to an account and is only signing in
        // again: an address with no account must not quietly become a second
        // one. The ticket is dropped unused; nothing was created.
        setBusy(''); setCode(''); setChallenge(null); setResendAt(0);
        setDirection('back'); setStep('method');
        setError(tLater('signup.noAccountForRelink'));
        return;
      }
      if (result.status === 'profile-required') {
        // The code is right and the address has no account yet. The ticket it
        // earned finishes sign-up once the few questions below are answered.
        setTicket(result.signupTicket);
        setBusy('');
        go('age');
        return;
      }
      await signedIn(result);
    } catch (err) {
      // A request that never reached the server spent nothing: keep the digits
      // so "Verify and continue" can send the same code again.
      if (!isNetworkFailure(err)) { setInvalid(err?.code === 'OTP_INVALID'); setCode(''); }
      fail(err, { expired: Date.now() >= (challenge?.expiresAt || 0) });
    } finally { verifying.current = false; }
  }

  /** The questions are answered: make the account with what the code (or the provider) earned. */
  async function completeDetails() {
    if (verifying.current || busy) return;
    if (!name.trim()) { setError(tLater('signup.nameRequired')); return; }
    if (age === null) { setError(tLater('signup.ageRequired')); return; }
    if (!agreed) { setError(tLater('signup.agreeRequired')); return; }
    if (!inline && year === null) { go('class'); return; }
    verifying.current = true;
    setBusy('verify'); setError('');
    try {
      const deviceId = await cloudDeviceId();
      if (pendingSocial) {
        const p = profile();
        const result = await cloud.socialSignIn(pendingSocial.provider, {
          ...pendingSocial.token, deviceId, createAccount: true, name: p.name, year: p.year, isAdult: p.isAdult, guardianLater: true
        });
        setPendingSocial(null);
        await signedIn({ ...result, guardianConsent: result.guardianConsentRequired ? { required: true, state: 'pending' } : { required: false, state: 'not-required' } });
        return;
      }
      const result = await cloud.otpVerify({ channel: challenge.channel, destination: challenge.destination, signupTicket: ticket, deviceId, profile: profile() });
      setTicket('');
      await signedIn(result);
    } catch (err) {
      if (err?.code === 'OTP_INVALID' || err?.code === 'OIDC_NONCE_INVALID') {
        // The ticket lives only as long as the code did. The answers stay in
        // this card; a fresh code finishes the account in one step.
        setTicket(''); setPendingSocial(null); setCode(''); setChallenge(null); setResendAt(0);
        setBusy('');
        setDirection('back'); setStep('method'); setInvalid(false);
        setError(tLater(err.code === 'OTP_INVALID' ? 'signup.ticketExpired' : 'signup.socialStartAgain'));
      } else fail(err);
    } finally { verifying.current = false; }
  }

  async function signedIn(result) {
    setAccount(result.account);
    const state = result.guardianConsent || null;
    setConsent(state);
    if (!name.trim() && result.account?.name) setName(result.account.name);
    setBusy('');
    const parent = !!state?.required && state.state !== 'given';
    // A returning student on a device with no profile yet: the class sets up
    // this device, and is the only thing asked. Inside a page the profile
    // exists, so nothing more is asked at all.
    if (!inline && year === null) { go('class'); return; }
    if (parent) { go('parent'); return; }
    await finish(result.account);
  }

  async function signInWithPassword() {
    if (verifying.current || busy) return;
    const to = destination.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) { setError(tLater('signup.emailInvalid')); return; }
    if (!password) { setError(tLater('signup.passwordRequired')); return; }
    verifying.current = true;
    setBusy('password'); setError(''); setNotice('');
    try {
      const deviceId = await cloudDeviceId();
      const result = await cloud.login({ email: to, password, deviceId });
      setPassword('');
      // The login answer does not carry the guardian state; the account's own
      // session can read it. A failure here only means the question is asked
      // later, where the server enforces it anyway.
      const state = await cloud.guardianState().then(s => ({ required: !!s?.required, state: s?.state || 'not-required' })).catch(() => null);
      await signedIn({ account: result.account, created: false, guardianConsent: state });
    } catch (err) { fail(err); }
    finally { verifying.current = false; }
  }

  async function requestReset() {
    if (busy) return;
    const to = destination.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) { setError(tLater('cloud.enterEmailFirst')); return; }
    setBusy('reset'); setError(''); setNotice('');
    try {
      await cloud.requestPasswordReset({ email: to });
      // The server answers the same whether or not an account exists; so does this.
      setNotice(tLater('cloud.resetQueued'));
      setBusy('');
    } catch (err) { fail(err); }
  }

  // Runs straight from the click: requestIdentityToken opens its popup before
  // anything awaits, or the browser would block it.
  async function social(provider) {
    if (!providers[provider] || busy) return;
    setBusy(`social-${provider}`); setError(''); setNotice('');
    try {
      const token = await requestIdentityToken(provider, providers[provider]);
      const deviceId = await cloudDeviceId();
      try {
        // Sign in first. A provider identity with no account is told so, and
        // never silently given one: the age question comes first, then the
        // same token (its nonce is still unspent) creates the account.
        const result = await cloud.socialSignIn(provider, { ...token, deviceId, createAccount: false });
        const state = await cloud.guardianState().then(s => ({ required: !!s?.required, state: s?.state || 'not-required' })).catch(() => null);
        await signedIn({ ...result, guardianConsent: state });
      } catch (err) {
        if (err?.code !== 'IDENTITY_NOT_REGISTERED') throw err;
        if (!allowCreate) { setBusy(''); setError(tLater('signup.noAccountForRelink')); return; }
        setPendingSocial({ provider, token });
        setBusy('');
        go('age');
      }
    } catch (err) {
      if (err?.code === 'SOCIAL_CANCELLED') { setBusy(''); setNotice(tLater('cloud.socialCancelled')); }
      else fail(err);
    }
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
    if (finishing.current) return finishing.current;
    setBusy('finish');
    finishing.current = (async () => {
      try {
        await onFinish({ account: signedInAccount, name: name.trim() || signedInAccount?.name || '', year: year || 9, track });
      } catch (err) { fail(err); }
    })().finally(() => { finishing.current = null; });
    return finishing.current;
  }

  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const codeExpired = step === 'code' && !!challenge && now >= challenge.expiresAt;
  const heading = (key, vars) => (
    <h2 className="signup-title" tabIndex={-1} ref={headingRef} id="signup-step-title">{t(key, vars)}</h2>
  );
  const choice = (selected, label, onClick, testId, extra = '') => (
    <button key={testId} type="button" className={`signup-choice${selected ? ' is-selected' : ''}${extra}`} aria-pressed={selected}
      onClick={onClick} data-testid={testId}>{label}</button>
  );
  const errorId = 'signup-error';
  const isSms = channel === 'sms';

  let body = null;
  if (step === 'method') {
    body = (
      <>
        {/* On the landing screen the page's own heading ("Welcome to Pri
            Learning") is this card's title; inside a page it names itself. */}
        {inline
          ? <>{heading('signup.signinTitle')}<p className="signup-lead">{t('signup.inlineLead')}</p></>
          : <h2 className="sr-only" tabIndex={-1} ref={headingRef} id="signup-step-title">{t('signup.signinTitle')}</h2>}
        {!available && <p className="signup-hint" role="status">{t('signup.cloudUnavailable')}</p>}
        <form className="signup-form" noValidate onSubmit={e => { e.preventDefault(); void sendCode(); }}>
          <label className="label" htmlFor="signup-destination">{isSms ? t('signup.phoneLabel') : t('signup.emailLabel')}</label>
          <div className={isSms ? 'signup-phone' : ''}>
            {isSms && <span className="signup-cc" aria-hidden="true">+91</span>}
            <input className="input" id="signup-destination" value={destination} disabled={!available}
              type={isSms ? 'tel' : 'email'} inputMode={isSms ? 'tel' : 'email'} autoCapitalize="none" autoCorrect="off" spellCheck={false}
              autoComplete={isSms ? 'tel-national' : 'email'} maxLength={isSms ? 16 : 254}
              placeholder={isSms ? '98765 43210' : 'you@example.com'}
              aria-invalid={!!error || undefined} aria-describedby={error ? errorId : undefined}
              onChange={e => { setDestination(e.target.value); setError(''); }} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg signup-next" disabled={!available || !destination.trim() || !!busy} data-testid="signup-send-code">
            {busy === 'send' ? t('signup.sending') : t(isSms ? 'signup.continuePhone' : 'signup.continueEmail')}
          </button>
        </form>
        {(providers.google || providers.apple) && (
          <>
            <div className="signup-or"><span>{t('signup.or')}</span></div>
            <div className="signup-social" data-social-sign-in>
              {providers.google && <button type="button" className="btn btn-ghost" data-provider="google" disabled={!!busy} onClick={() => social('google')}>
                {busy === 'social-google' ? t('cloud.socialWaiting') : t('signup.withGoogle')}</button>}
              {providers.apple && <button type="button" className="btn btn-ghost" data-provider="apple" disabled={!!busy} onClick={() => social('apple')}>
                {busy === 'social-apple' ? t('cloud.socialWaiting') : t('signup.withApple')}</button>}
            </div>
          </>
        )}
        <div className="signup-alt">
          <button type="button" className="linklike" data-testid="signup-use-password" disabled={!!busy}
            onClick={() => { setChannel('email'); go('password'); }}>{t('signup.withPassword')}</button>
          {channels.sms && (
            <button type="button" className="linklike" data-testid={isSms ? 'signup-channel-email' : 'signup-channel-sms'} disabled={!!busy}
              onClick={() => { setChannel(isSms ? 'email' : 'sms'); setDestination(''); setError(''); }}>
              {t(isSms ? 'signup.useEmail' : 'signup.usePhone')}
            </button>
          )}
        </div>
        <p className="signup-hint signup-agree-note">
          {tx('signup.agreeNote', {
            terms: <a href="/terms" target="_blank" rel="noreferrer">{t('cloud.terms')}</a>,
            privacy: <a href="/privacy" target="_blank" rel="noreferrer">{t('cloud.privacyNotice')}</a>
          })}
        </p>
        {!inline && (
          <div className="signup-alt signup-alt-quiet">
            <button type="button" className="linklike" data-testid="signup-parent-link" onClick={() => go('parent-home')}>{t('signup.parentLink')}</button>
          </div>
        )}
      </>
    );
  } else if (step === 'password') {
    body = (
      <>
        {heading('signup.passwordTitle')}
        <p className="signup-lead">{t('signup.passwordLead')}</p>
        <form className="signup-form" noValidate onSubmit={e => { e.preventDefault(); void signInWithPassword(); }}>
          <label className="label" htmlFor="signup-password-email">{t('signup.emailLabel')}</label>
          <input className="input" id="signup-password-email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
            maxLength={254} value={destination} aria-describedby={error ? errorId : undefined}
            onChange={e => { setDestination(e.target.value); setError(''); }} />
          <label className="label" htmlFor="signup-password">{t('login.password')}</label>
          <input className="input" id="signup-password" type="password" autoComplete="current-password" maxLength={200} value={password}
            aria-describedby={error ? errorId : undefined}
            onChange={e => { setPassword(e.target.value); setError(''); }} />
          <button type="submit" className="btn btn-primary btn-lg signup-next" disabled={!available || !!busy} data-testid="signup-password-submit">
            {busy === 'password' ? t('signup.checking') : t('signup.passwordSubmit')}
          </button>
        </form>
        <div className="signup-alt">
          {(channels.email || channels.sms) && (
            <button type="button" className="linklike" data-testid="signup-use-code" disabled={!!busy}
              onClick={() => { setPassword(''); go('method', 'back'); }}>{t('signup.useCodeInstead')}</button>
          )}
          <button type="button" className="linklike" data-testid="signup-forgot-password" disabled={!!busy} onClick={requestReset}>
            {busy === 'reset' ? t('cloud.requesting') : t('cloud.forgotPassword')}
          </button>
        </div>
      </>
    );
  } else if (step === 'code') {
    body = (
      <>
        {heading(challenge?.channel === 'sms' ? 'signup.codeTitlePhone' : 'signup.codeTitle')}
        <p className="signup-lead" id="signup-code-lead">
          {tx('signup.codeSentTo', { to: <strong className="signup-destination">{shownDestination()}</strong> })} {t('signup.codeExpiry')}
        </p>
        <form className="signup-form" noValidate onSubmit={e => { e.preventDefault(); void verify(); }}>
          <OtpInput value={code} onChange={c => { setCode(c); setInvalid(false); setError(''); }} onComplete={c => verify(c)}
            disabled={busy === 'verify'} invalid={invalid} idPrefix="signup-code" labelledBy="signup-step-title signup-code-lead"
            describedBy={error ? errorId : undefined} />
          <button type="submit" className="btn btn-primary btn-lg signup-next" data-testid="signup-verify"
            disabled={!!busy || codeExpired} aria-busy={busy === 'verify' || undefined}>
            {busy === 'verify' ? t('signup.checking') : t('signup.verify')}
          </button>
        </form>
        {codeExpired && !error && <p className="signup-hint" role="status" data-testid="signup-code-expired">{t('signup.codeExpired')}</p>}
        <div className="signup-alt">
          <button type="button" className="linklike" disabled={waitSeconds > 0 || !!busy} onClick={() => sendCode({ resend: true })} data-testid="signup-resend">
            {busy === 'send' ? t('signup.sending') : waitSeconds > 0 ? t('signup.resendIn', { n: waitSeconds }) : t('signup.resend')}
          </button>
          <button type="button" className="linklike" disabled={busy === 'verify'} data-testid="signup-change-destination"
            onClick={() => { setCode(''); go('method', 'back'); }}>{t(challenge?.channel === 'sms' ? 'signup.changeNumber' : 'signup.changeEmail')}</button>
        </div>
        <p className="signup-hint">{t(challenge?.channel === 'sms' ? 'signup.codeHelpPhone' : 'signup.codeHelp')}</p>
      </>
    );
  } else if (step === 'age') {
    body = (
      <>
        {heading('signup.aboutTitle')}
        <p className="signup-lead">{t('signup.aboutLead')}</p>
        <form className="signup-form" noValidate onSubmit={e => { e.preventDefault(); void completeDetails(); }}>
          <label className="label" htmlFor="signup-flow-name">{t('signup.nameLabel')}</label>
          <input className="input" id="signup-flow-name" autoComplete="given-name" value={name} maxLength={80}
            aria-describedby={error ? errorId : undefined}
            // Prefilled from the profile: focusing selects it, so typing a
            // name replaces it instead of being appended to it.
            onFocus={e => { if (e.target.value && e.target.value === String(initialName || '')) e.target.select(); }}
            onChange={e => { setName(e.target.value); setError(''); }} />
          <p className="signup-sublabel" id="signup-age-label">{t('signup.ageTitle')}</p>
          <div className="signup-choices signup-choices-4" role="group" aria-labelledby="signup-age-label">
            {AGES.map(a => choice(age === a, String(a), () => { setAge(a); setError(''); }, `signup-age-${a}`))}
            {choice(age === 18, t('signup.ageAdult'), () => { setAge(18); setError(''); }, 'signup-age-18', ' signup-choice-wide')}
          </div>
          <p className="signup-hint">{t('signup.ageLead')}</p>
          {/* The notice is reachable at the point consent is asked for, and
              agreeing is an action: no account is made without it. */}
          <label className="signup-agree">
            <input type="checkbox" checked={agreed} data-testid="signup-agree" onChange={e => { setAgreed(e.target.checked); setError(''); }} />
            <span>
              {tx('cloud.consent', {
                privacy: <a href="/privacy" target="_blank" rel="noreferrer">{t('cloud.privacyNotice')}</a>,
                terms: <a href="/terms" target="_blank" rel="noreferrer">{t('cloud.terms')}</a>
              })}
            </span>
          </label>
          <button type="submit" className="btn btn-primary btn-lg signup-next" disabled={!!busy} data-testid="signup-age-next">
            {busy === 'verify' ? t('signup.checking') : t('signup.continue')}
          </button>
        </form>
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
          onClick={() => (account ? (needsParent ? go('parent') : finish()) : completeDetails())}
          data-testid="signup-class-next">
          {busy === 'verify' ? t('signup.checking') : t('signup.continue')}
        </button>
      </>
    );
  } else if (step === 'parent') {
    const parentSms = parentChannel === 'sms';
    body = (
      <>
        {heading('signup.parentTitle')}
        <p className="signup-lead">{t('signup.parentLead')}</p>
        <form className="signup-form" noValidate onSubmit={e => { e.preventDefault(); void askParent(); }}>
          <label className="label" htmlFor="signup-parent-name">{t('signup.parentNameLabel')}</label>
          <input className="input" id="signup-parent-name" value={parentName} maxLength={80} autoComplete="off"
            aria-describedby={error ? errorId : undefined}
            onChange={e => { setParentName(e.target.value); setError(''); }} />
          {channels.sms && (
            <div className="signup-segment signup-channel" role="radiogroup" aria-label={t('signup.parentChannelLabel')}>
              <button type="button" role="radio" aria-checked={!parentSms} className={`signup-seg${!parentSms ? ' is-selected' : ''}`}
                onClick={() => { setParentChannel('email'); setParentDestination(''); }} data-testid="signup-parent-email">{t('signup.channelEmail')}</button>
              <button type="button" role="radio" aria-checked={parentSms} className={`signup-seg${parentSms ? ' is-selected' : ''}`}
                onClick={() => { setParentChannel('sms'); setParentDestination(''); }} data-testid="signup-parent-sms">{t('signup.channelPhone')}</button>
            </div>
          )}
          <label className="label" htmlFor="signup-parent-destination">{parentSms ? t('signup.parentPhoneLabel') : t('signup.parentEmailLabel')}</label>
          <div className={parentSms ? 'signup-phone' : ''}>
            {parentSms && <span className="signup-cc" aria-hidden="true">+91</span>}
            <input className="input" id="signup-parent-destination" value={parentDestination}
              type={parentSms ? 'tel' : 'email'} inputMode={parentSms ? 'tel' : 'email'} autoComplete="off" autoCapitalize="none" maxLength={parentSms ? 16 : 254}
              aria-describedby={error ? errorId : undefined}
              onChange={e => { setParentDestination(e.target.value); setError(''); }} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg signup-next" disabled={!parentDestination.trim() || !!busy} data-testid="signup-parent-send">
            {busy === 'parent' ? t('signup.sending') : t('signup.parentSend')}
          </button>
        </form>
        <div className="signup-alt">
          <button type="button" className="linklike" disabled={!!busy} onClick={() => finish()} data-testid="signup-parent-later">{t('signup.parentLater')}</button>
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
          <button type="button" className="linklike" disabled={busy === 'finish'} onClick={() => finish()} data-testid="signup-parent-continue">{t('signup.parentContinue')}</button>
        </div>
      </>
    );
  } else if (step === 'parent-home') {
    body = <ParentHome t={t} heading={heading} />;
  }

  // Back never crosses a verified code: once the account exists (or a ticket
  // is held) the only way back is forward, or closing the card.
  const backTarget = step === 'password' || step === 'parent-home' ? 'method'
    : step === 'class' && !account && newAccount ? 'age'
      : step === 'parent-wait' ? 'parent' : null;
  const showBack = !!backTarget || (step === 'method' && !!onCancel);

  return (
    <div className={`signup-flow signup-${variant}`} data-signup-step={step} data-signin-card={variant} data-testid="signin-card">
      {showBack && (
        <div className="signup-top">
          <button type="button" className="signup-back" aria-label={t(step === 'method' ? 'signup.close' : 'signup.back')}
            disabled={busy === 'verify' || busy === 'finish'}
            onClick={() => (backTarget ? go(backTarget, 'back') : onCancel?.())}>
            <span aria-hidden="true">{step === 'method' ? '×' : '←'}</span>
          </button>
        </div>
      )}
      <div key={step} className={`signup-step signup-dir-${direction}`}>
        {body}
        {notice && <p className="signup-hint signup-notice-line" role="status" data-testid="signup-notice">{notice}</p>}
        {error && <div className="error-box signup-error" role="alert" id={errorId} data-testid="signup-error">{error}</div>}
        {busy === 'finish' && <p className="signup-hint" role="status">{t(inline ? 'signup.signingIn' : 'signup.settingUp')}</p>}
      </div>
      {step === 'method' && onStartOffline && (
        <div className="signup-alt signup-alt-quiet">
          <button type="button" className="linklike" onClick={onStartOffline}>{t('signup.offline')}</button>
        </div>
      )}
    </div>
  );
}

/** A parent's own screen: what Pri asks of them, and how to withdraw. */
function ParentHome({ t, heading }) {
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
    } catch (err) { setError(tLater(signInErrorCopy(err).key, signInErrorCopy(err).vars)); }
    finally { setBusy(false); }
  }

  async function withdraw(value = code) {
    if (value.length !== OTP_LENGTH) return;
    setBusy(true); setError('');
    try {
      const result = await cloud.guardianWithdrawByPhone({ destination: phone, challengeId: challenge, code: value });
      setMessage(tLater('signup.withdrawDone', { n: result.withdrawn }));
      setChallenge(null);
    } catch (err) { setError(tLater(signInErrorCopy(err).key, signInErrorCopy(err).vars)); setCode(''); }
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
