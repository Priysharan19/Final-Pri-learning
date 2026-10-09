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
const AccountPanel = React.lazy(() => import('./CloudAccountPanel.jsx'));
const CodeSignIn = React.lazy(() => import('./SignUpFlow.jsx'));

/**
 * Sign in on the page the work is on. The same account panel and code flow the
 * handwriting recovery uses; the profile, the question and everything typed or
 * written stay mounted around it. `ready` is false while the work on screen is
 * still being written to this device, and `waitText` says so.
 */
export function CheckSignIn({ user, refreshUser, ready = true, waitText = null, label = null }) {
  const t = useT();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [byCode, setByCode] = useState(false);
  const finishing = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const words = inkRecoveryWords(language);
  return (
    <>
      <button type="button" className="btn btn-primary" data-check-sign-in
        disabled={!ready} aria-expanded={open && ready} onClick={() => setOpen(v => !v)}>
        {label || t('check.signInAction')}
      </button>
      {!ready && waitText && <p className="muted" role="status">{waitText}</p>}
      {open && ready && (
        <React.Suspense fallback={<p role="status">{t('cloud.stateChecking')}</p>}>
          {byCode ? (
            <CodeSignIn initialMode="signin" initialName={user?.name || ''}
              onCancel={() => setByCode(false)}
              onFinish={async ({ account }) => {
                // A guardian-approved sign-in may finish twice while a slow
                // profile refresh runs. One verified account link is enough.
                if (!finishing.current) {
                  finishing.current = (async () => {
                    const { cloudAccountLink, linkSignedInAccount } = await import('../platform/cloudAccount.js');
                    await completeInkOtpRecovery({
                      localProfileId: user?.id,
                      currentProfileId: mounted.current ? user?.id : null,
                      account, verifiedSaved: ready === true,
                      getLinked: cloudAccountLink, linkAccount: linkSignedInAccount,
                      refreshProfile: refreshUser
                    });
                    if (mounted.current) { setByCode(false); setOpen(false); }
                  })().finally(() => { finishing.current = null; });
                }
                return finishing.current;
              }}
            />
          ) : (
            <>
              <AccountPanel />
              <p className="muted" style={{ marginTop: 8 }}>{words.otpNotice}</p>
              <button type="button" className="btn btn-secondary" data-check-code-sign-in
                onClick={() => setByCode(true)}>{words.otpAction}</button>
            </>
          )}
        </React.Suspense>
      )}
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
  return (
    <>
      <div className="verdict-title" data-check-refusal={kind}>{t(copy.titleKey)}</div>
      <div className="verdict-body">{t(copy.contextKey)} <span className="muted">{t(copy.hintKey)}</span></div>
      {copy.action === 'sign-in' && (
        <div style={{ marginTop: 10 }}>
          <CheckSignIn user={user} refreshUser={refreshUser} ready={signInReady} waitText={signInWaitText}
            label={context && context !== 'answer' ? t('check.signInActionPlain') : null} />
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
