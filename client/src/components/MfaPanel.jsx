// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a second factor for the people who can reach everyone's data
//
// The client half of server/platform/mfa.js, for admin and support accounts:
//
//   status → enrol (the secret and its otpauth:// URI, shown once, with copy
//   buttons and the instruction to paste it into an authenticator app) →
//   confirm with one six-digit code → the eight recovery codes, shown once,
//   behind an "I have saved these" acknowledgement → verify (a code, or a
//   recovery code) for this session or for a step-up action.
//
// What this panel never does: it never writes the secret, the URI or a recovery
// code anywhere but React state (no storage, no console), never draws a QR with
// a dependency the install would carry for every student, and never decides
// anything — the server accepts or refuses each code.
//
// The data steps are plain exported functions over a transport so they are
// provable with a fake one (client/test/mfa-ui-check.mjs).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { tLater, useT } from '../i18n/index.js';

export const MFA_REASONS = Object.freeze(['sign-in', 'enrol', 'step-up']);
const TOTP = /^\d{6}$/;
const RECOVERY = /^\d{5}-?\d{5}$/;

/** `{ code }` for six digits, `{ recoveryCode }` for a ten-digit recovery code, null otherwise. */
export function classifyMfaInput(text) {
  const clean = String(text || '').replace(/\s/g, '');
  if (TOTP.test(clean)) return { code: clean };
  if (RECOVERY.test(clean)) return { recoveryCode: clean };
  return null;
}

/** Which step a staff account starts on, from GET /v1/account/mfa/status. */
export function stepForStatus(status, reason = 'sign-in') {
  if (!status?.required) return 'done';
  if (!status.enrolled) return 'intro';
  if (reason === 'step-up' || !status.verified) return 'verify';
  return 'done';
}

/** POST /totp/enrol — the secret and URI, held in memory only. */
export async function startEnrolment(transport = cloud) {
  const issued = await transport.mfaEnrol();
  const secret = String(issued?.secret || '');
  const otpauthUri = String(issued?.otpauthUri || '');
  if (!secret || !otpauthUri.startsWith('otpauth://totp/')) {
    throw Object.assign(new Error('The server did not issue an authenticator secret.'), { code: 'MFA_ENROL_FAILED' });
  }
  return { secret, otpauthUri };
}

/** POST /totp/confirm — the eight recovery codes, shown once by the caller. */
export async function confirmEnrolment(code, transport = cloud) {
  const input = classifyMfaInput(code);
  if (!input?.code) throw Object.assign(new Error('Enter the six-digit code from the app.'), { code: 'MFA_CODE_FORMAT' });
  const result = await transport.mfaConfirm(input.code);
  const recoveryCodes = Array.isArray(result?.recoveryCodes) ? result.recoveryCodes.map(String) : [];
  return { enrolled: result?.enrolled === true, recoveryCodes };
}

/** POST /verify with a code or a recovery code; the server marks the session. */
export async function verifySecondFactor(text, transport = cloud) {
  const input = classifyMfaInput(text);
  if (!input) throw Object.assign(new Error('Enter a six-digit code or a recovery code.'), { code: 'MFA_CODE_FORMAT' });
  const result = await transport.mfaVerify(input);
  return { verified: result?.verified === true, method: result?.method || (input.code ? 'totp' : 'recovery-code'), recoveryCodesRemaining: result?.recoveryCodesRemaining };
}

/** The catalogue key for a refusal from the MFA routes. */
export function mfaErrorKey(error) {
  switch (error?.code) {
    case 'MFA_CODE_INVALID': return 'mfa.codeRejected';
    case 'MFA_CODE_FORMAT': return 'mfa.codeFormat';
    case 'MFA_ALREADY_ENROLLED': return 'mfa.alreadyEnrolled';
    case 'MFA_ENROLMENT_MISSING': case 'MFA_ENROLMENT_REQUIRED': return 'mfa.enrolFirst';
    case 'MFA_NOT_CONFIGURED': return 'mfa.notConfigured';
    case 'RATE_LIMITED': return 'mfa.rateLimited';
    default: return 'mfa.failed';
  }
}

function CopyButton({ text, label }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await globalThis.navigator?.clipboard?.writeText(text);
      setCopied(true);
    } catch { setCopied(false); }
  };
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={copy} aria-label={label}>
      {copied ? t('mfa.copied') : t('mfa.copy')}
    </button>
  );
}

/**
 * @param reason      'sign-in' (a verified session is needed), 'enrol' (the
 *                    account has no second factor) or 'step-up' (a fresh code
 *                    for one action).
 * @param status      an mfaStatus result already in hand, or null to fetch.
 * @param onVerified  called once the server accepted a code (or enrolment).
 * @param onCancel    for a step-up prompt the person backs out of.
 * @param initial     test-only: { step, enrolment, recoveryCodes } to render a step.
 */
export default function MfaPanel({ reason = 'sign-in', status = null, onVerified, onCancel, transport = cloud, initial = null }) {
  const t = useT();
  const [step, setStep] = useState(initial?.step || (status ? stepForStatus(status, reason) : 'loading'));
  const [enrolment, setEnrolment] = useState(initial?.enrolment || null);
  const [recoveryCodes, setRecoveryCodes] = useState(initial?.recoveryCodes || null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (step !== 'loading') return undefined;
    let live = true;
    transport.mfaStatus().then(
      s => { if (live) setStep(stepForStatus(s, reason)); },
      err => { if (live) { setError(tLater(mfaErrorKey(err))); setStep('intro'); } }
    );
    return () => { live = false; };
  }, [step, reason, transport]);

  useEffect(() => {
    if (step === 'done' && !recoveryCodes) onVerified?.();
  }, [step, recoveryCodes, onVerified]);

  const run = async (work) => {
    setBusy(true); setError('');
    try { await work(); } catch (err) { setError(tLater(mfaErrorKey(err))); } finally { setBusy(false); }
  };

  const enrol = () => run(async () => {
    setEnrolment(await startEnrolment(transport));
    setStep('enrol');
  });

  const confirm = (e) => {
    e.preventDefault();
    return run(async () => {
      const { recoveryCodes: codes } = await confirmEnrolment(input, transport);
      // The secret leaves memory the moment the server has confirmed it.
      setEnrolment(null);
      setInput('');
      setRecoveryCodes(codes);
      setStep('recovery');
    });
  };

  // The one place the recovery codes are shown. Acknowledging drops them from
  // memory; nothing re-renders them afterwards.
  const acknowledgeRecovery = () => {
    setRecoveryCodes(null);
    setStep('done');
  };

  const verify = (e) => {
    e.preventDefault();
    return run(async () => {
      const result = await verifySecondFactor(input, transport);
      setInput('');
      if (Number.isFinite(Number(result.recoveryCodesRemaining))) setRemaining(Number(result.recoveryCodesRemaining));
      setStep('done');
    });
  };

  if (step === 'done' && !recoveryCodes) return null;

  return (
    <section className="card" aria-labelledby="mfa-title" data-mfa-step={step} style={{ marginTop: 18 }}>
      <div className="card-title" id="mfa-title" style={{ marginBottom: 4 }}>{t('mfa.title')}</div>
      {step === 'loading' && <p className="muted" role="status">{t('mfa.checking')}</p>}

      {step === 'intro' && (
        <>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>{t(reason === 'enrol' ? 'mfa.enrolRequired' : 'mfa.enrolIntro')}</p>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={busy} onClick={enrol}>
            {busy ? t('mfa.working') : t('mfa.startEnrolment')}
          </button>
        </>
      )}

      {step === 'enrol' && enrolment && (
        <form onSubmit={confirm}>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>{t('mfa.pasteIntoApp')}</p>
          <div className="card" style={{ padding: 12, marginTop: 10 }}>
            <div className="sc-label">{t('mfa.secretLabel')}</div>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code data-mfa-secret style={{ letterSpacing: 1, wordBreak: 'break-all' }}>{enrolment.secret}</code>
              <CopyButton text={enrolment.secret} label={t('mfa.copySecret')} />
            </div>
            <div className="sc-label" style={{ marginTop: 10 }}>{t('mfa.uriLabel')}</div>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code data-mfa-uri style={{ fontSize: 12, wordBreak: 'break-all' }}>{enrolment.otpauthUri}</code>
              <CopyButton text={enrolment.otpauthUri} label={t('mfa.copyUri')} />
            </div>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>{t('mfa.codeLabel')}</span>
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
              value={input} onChange={e => setInput(e.target.value)} />
          </label>
          {error && <div className="notice error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy} style={{ marginTop: 10 }}>
            {busy ? t('mfa.working') : t('mfa.confirmEnrolment')}
          </button>
        </form>
      )}

      {step === 'recovery' && recoveryCodes && (
        <>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>{t('mfa.recoveryIntro')}</p>
          <ul data-mfa-recovery-codes style={{ columns: 2, fontFamily: 'monospace', marginTop: 10 }}>
            {recoveryCodes.map(code => <li key={code}>{code}</li>)}
          </ul>
          <button type="button" className="btn btn-primary btn-sm" data-mfa-acknowledge onClick={acknowledgeRecovery}>
            {t('mfa.savedRecovery')}
          </button>
        </>
      )}

      {step === 'verify' && (
        <form onSubmit={verify}>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>{t(reason === 'step-up' ? 'mfa.stepUpIntro' : 'mfa.verifyIntro')}</p>
          <label className="field" style={{ marginTop: 12 }}>
            <span>{t('mfa.codeOrRecoveryLabel')}</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={11} required
              value={input} onChange={e => setInput(e.target.value)} />
          </label>
          {error && <div className="notice error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{busy ? t('mfa.working') : t('mfa.verify')}</button>
            {onCancel && <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>{t('mfa.cancel')}</button>}
          </div>
        </form>
      )}

      {step !== 'enrol' && step !== 'verify' && error && <div className="notice error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
      {remaining !== null && <p className="muted" role="status" style={{ fontSize: 12.5 }}>{t('mfa.recoveryRemaining', { n: remaining, count: remaining })}</p>}
    </section>
  );
}
