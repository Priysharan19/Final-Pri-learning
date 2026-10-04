// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the gate in front of the staff console
//
// server/platform/security.js answers a staff request with 403 and one of:
//
//   MFA_ENROLMENT_REQUIRED  the account has no confirmed second factor — only
//                           /account/me, /logout-all and /account/mfa/* work;
//   MFA_REQUIRED            this session has not presented a code since sign-in;
//   MFA_STEP_UP_REQUIRED    the code is older than stepUpWindowMs (role change,
//                           Premium grant).
//
// The gate reads /v1/account/mfa/status before the console mounts and shows
// MfaPanel until the account is enrolled and the session verified. For the
// codes that arrive mid-action it gives the console `withMfa(fn)`: on
// MFA_REQUIRED / MFA_STEP_UP_REQUIRED it prompts for a code and retries fn
// exactly once; on MFA_ENROLMENT_REQUIRED it routes back to enrolment and lets
// the original error through. Anything else is rethrown untouched.
//
// MfaPanel is lazy so its code is fetched only when a staff member needs it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { useT } from '../i18n/index.js';

const MfaPanel = React.lazy(() => import('./MfaPanel.jsx'));

export const MFA_CHALLENGE_CODES = Object.freeze(['MFA_ENROLMENT_REQUIRED', 'MFA_REQUIRED', 'MFA_STEP_UP_REQUIRED']);
export const isMfaChallenge = error => MFA_CHALLENGE_CODES.includes(String(error?.code || ''));

/**
 * Run `fn`; on a code challenge ask for a code through `requestStepUp(code)`
 * (resolves when the server accepted one, rejects when dismissed) and retry
 * once. The retry's own refusal is not retried: a second challenge means the
 * server disagrees with this session and a loop would not change that.
 */
export async function runWithMfaRetry(fn, { requestStepUp, onEnrolmentRequired } = {}) {
  try {
    return await fn();
  } catch (error) {
    if (error?.code === 'MFA_ENROLMENT_REQUIRED') {
      onEnrolmentRequired?.(error);
      throw error;
    }
    if ((error?.code === 'MFA_REQUIRED' || error?.code === 'MFA_STEP_UP_REQUIRED') && typeof requestStepUp === 'function') {
      await requestStepUp(error.code, error);
      return fn();
    }
    throw error;
  }
}

const passThrough = fn => fn();
const StepUpContext = createContext(passThrough);

/** `withMfa(fn)` from the nearest gate, or a plain runner outside one. */
export function useMfaStepUp() {
  return useContext(StepUpContext);
}

export default function StaffMfaGate({ children, transport = cloud }) {
  const t = useT();
  const [status, setStatus] = useState(null);
  const [gate, setGate] = useState('loading'); // loading | enrol | verify | open | unavailable
  const [prompt, setPrompt] = useState(null); // { reason } while a step-up prompt is up
  const pending = useRef(null);

  const load = useCallback(() => {
    let live = true;
    transport.mfaStatus().then(
      s => {
        if (!live) return;
        setStatus(s);
        setGate(!s?.required ? 'open' : !s.enrolled ? 'enrol' : !s.verified ? 'verify' : 'open');
      },
      () => { if (live) setGate('unavailable'); }
    );
    return () => { live = false; };
  }, [transport]);

  useEffect(() => load(), [load]);

  const requestStepUp = useCallback(() => new Promise((resolve, reject) => {
    pending.current = { resolve, reject };
    setPrompt({ reason: 'step-up' });
  }), []);

  const settlePrompt = (ok) => {
    const waiting = pending.current;
    pending.current = null;
    setPrompt(null);
    if (!waiting) return;
    if (ok) waiting.resolve(true);
    else waiting.reject(Object.assign(new Error('Second factor not provided.'), { code: 'MFA_CANCELLED' }));
  };

  const withMfa = useCallback(fn => runWithMfaRetry(fn, {
    requestStepUp,
    onEnrolmentRequired: () => setGate('enrol')
  }), [requestStepUp]);

  if (gate === 'loading') return <p className="muted" role="status" style={{ marginTop: 18 }}>{t('mfa.checking')}</p>;
  if (gate === 'unavailable') return <div className="notice error" role="alert" style={{ marginTop: 18 }}>{t('mfa.statusUnavailable')}</div>;

  if (gate === 'enrol' || gate === 'verify') {
    return (
      <React.Suspense fallback={null}>
        <MfaPanel reason={gate === 'enrol' ? 'enrol' : 'sign-in'} status={gate === 'enrol' ? null : status} transport={transport}
          onVerified={() => setGate('open')} />
      </React.Suspense>
    );
  }

  return (
    <StepUpContext.Provider value={withMfa}>
      {prompt && (
        <React.Suspense fallback={null}>
          <MfaPanel reason="step-up" status={{ required: true, enrolled: true, verified: true }} transport={transport}
            onVerified={() => settlePrompt(true)} onCancel={() => settlePrompt(false)} />
        </React.Suspense>
      )}
      {children}
    </StepUpContext.Provider>
  );
}
