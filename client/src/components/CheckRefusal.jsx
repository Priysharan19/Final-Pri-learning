// The in-context account actions for a check that needs Pri's server: the
// sign-in a student can complete without leaving the question, and the words
// and next step for each reason a check was refused. Presentation only —
// account linking, eligibility and marking stay with the platform modules.
import React, { useEffect, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { useLanguage, useT } from '../i18n/index.js';
import { checkRefusalCopy } from './checkAccess.js';
import { completeInkOtpRecovery, inkRecoveryWords } from './signedOutInkRecovery.js';

// Fetched only when a student asks to sign in.
const SignInCard = React.lazy(() => import('./SignUpFlow.jsx'));

/**
 * The one sign-in card, on the page the work is on: an emailed six-digit code
 * (or a configured provider, or the account's password), in place. Shared by
 * every in-context sign-in (a refused check, handwriting, a photo, the exam
 * page) so each of them is the same card. It never navigates, reloads, reads
 * handwriting or submits anything: when the code is accepted the account is
 * linked to THIS profile and the card closes, leaving the page as it was.
 * `saved` is whether the work on screen is proven kept on this device;
 * linking an account to the profile is refused without it.
 */
export function SignInChoices({ user, refreshUser, saved = true, onDone = null }) {
  const t = useT();
  const { language } = useLanguage();
  const finishing = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const words = inkRecoveryWords(language);
  return (
    <React.Suspense fallback={<p role="status">{t('cloud.stateChecking')}</p>}>
      <div className="inline-sign-in" data-inline-sign-in>
        <SignInCard variant="inline" initialName={user?.name || ''} knownYear={user?.year ?? null}
          allowCreate={user?.cloudLinked !== true}
          onCancel={onDone ? () => onDone() : null}
          onFinish={async ({ account }) => {
            // A guardian-approved sign-in may finish twice while a slow
            // profile refresh runs. One verified account link is enough.
            if (!finishing.current) {
              finishing.current = (async () => {
                const { cloudAccountLink, linkSignedInAccount } = await import('../platform/cloudAccount.js');
                try {
                  await completeInkOtpRecovery({
                    localProfileId: user?.id,
                    currentProfileId: mounted.current ? user?.id : null,
                    account, verifiedSaved: saved === true,
                    getLinked: cloudAccountLink, linkAccount: linkSignedInAccount,
                    refreshProfile: refreshUser
                  });
                } catch (err) {
                  // The account that signed in is not this profile's. Its
                  // session cannot be used here, so it is ended rather than
                  // left signed in beside work that belongs to another account.
                  if (['INK_ACCOUNT_MISMATCH', 'CLOUD_LINK_CONFLICT'].includes(err?.code)) {
                    const { cloud } = await import('../platform/cloudTransport.js');
                    await cloud.logout().catch(() => {});
                  }
                  throw err;
                }
                if (mounted.current) onDone?.();
              })().finally(() => { finishing.current = null; });
            }
            return finishing.current;
          }}
        />
        <p className="muted inline-sign-in-note">{words.otpNotice}</p>
      </div>
    </React.Suspense>
  );
}

/**
 * Sign in on the page the work is on: the same sign-in card the handwriting
 * recovery uses; the profile, the question and everything typed or
 * written stay mounted around it. `ready` is false while the work on screen is
 * still being written to this device, and `waitText` says so.
 */
export function CheckSignIn({ user, refreshUser, ready = true, waitText = null, label = null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" data-check-sign-in
        disabled={!ready} aria-expanded={open && ready} onClick={() => setOpen(v => !v)}>
        {label || t('check.signInAction')}
      </button>
      {!ready && waitText && <p className="muted" role="status">{waitText}</p>}
      {open && ready && <SignInChoices user={user} refreshUser={refreshUser} saved={ready === true} onDone={() => setOpen(false)} />}
    </>
  );
}

/**
 * One refused check: what did not happen, why, and the one thing to do next.
 * Rendered inside the caller's own notice (the card's verdict, the exam page's
 * alert), so it adds no container of its own.
 */
export function CheckRefusal({
  kind, context = 'answer', user, refreshUser, signInReady = true, signInWaitText = null,
  onRetry = null, onNext = null, onRestart = null, nextLabel = null, busy = false
}) {
  const t = useT();
  const inRouter = useInRouterContext();
  const copy = checkRefusalCopy(kind, context);
  if (!copy) return null;
  const settings = { className: 'btn btn-ghost btn-sm', 'data-check-account': kind };
  // This profile is linked to a Pri account and the server still said "sign
  // in": the session ended (expired, signed out elsewhere, server restarted).
  // Said as that, not as "you need an account".
  const sessionEnded = copy.action === 'sign-in' && user?.cloudLinked === true && (!context || context === 'answer');
  return (
    <>
      <div className="verdict-title" data-check-refusal={kind}>{t(copy.titleKey)}</div>
      <div className="verdict-body">{t(copy.contextKey)} <span className="muted">{t(sessionEnded ? 'check.sessionEnded' : copy.hintKey)}</span></div>
      {copy.action === 'sign-in' && (
        <div style={{ marginTop: 10 }} data-check-session-ended={sessionEnded ? '' : undefined}>
          <CheckSignIn user={user} refreshUser={refreshUser} ready={signInReady} waitText={signInWaitText}
            label={context && context !== 'answer' ? t('check.signInActionPlain') : sessionEnded ? t('check.signInAgainAction') : null} />
        </div>
      )}
      {copy.action !== 'sign-in' && <div className="row" style={{ marginTop: 10 }}>
        {copy.action === 'account' && (inRouter
          ? <Link to="/settings" {...settings}>{t('app.accountSettings')}</Link>
          : <a href="/settings" {...settings}>{t('app.accountSettings')}</a>)}
        {onRetry && (copy.action === 'retry' || copy.action === 'account') && (
          <button type="button" className="btn btn-ghost btn-sm" data-check-retry disabled={busy} onClick={onRetry}>
            {t('common.tryAgain')}
          </button>
        )}
        {copy.action === 'restart' && onRestart && (
          <button type="button" className="btn btn-ghost btn-sm" data-check-restart disabled={busy} onClick={onRestart}>
            {t('check.restartAction')}
          </button>
        )}
        {(kind === 'question' || kind === 'new-question') && onNext && (
          <button type="button" className="btn btn-quiet btn-sm" data-check-next disabled={busy} onClick={onNext}>
            {nextLabel || t('practice.nextQuestion')}
          </button>
        )}
      </div>}
    </>
  );
}
