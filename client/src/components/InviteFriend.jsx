// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Invite a friend" (the referral-unlocked 7-day trial)
//
// Shown in the account panel on the website only, to an admitted account the
// server offers it to (GET /v1/referral answers `available: false` to a store
// app and is refused to a child whose guardian has not approved). The student
// shares their own link through the system share sheet or copies it: the app
// never asks for, keeps or contacts a friend's email or number. The words are
// neutral — what happens, for whom, and that it ends by itself — with no
// pressure, no count of friends, no streak and no leaderboard (standard #41, #42).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { inviteLink, referralState } from '../platform/referral.js';

export default function InviteFriend() {
  const t = useT();
  const [state, setState] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    referralState().then(next => { if (live) setState(next); });
    return () => { live = false; };
  }, []);
  if (!state?.available || !state.code) return null;
  const link = inviteLink(state.code);
  if (!link) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  };
  const share = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: t('invite.title'), text: t('invite.shareText'), url: link }); return; } catch { /* closed: nothing to do */ return; }
    }
    await copy();
  };
  return (
    <div style={{ marginTop: 16 }} data-invite>
      <div className="sc-label">{t('invite.title')}</div>
      <p className="muted" style={{ fontSize: 13, margin: '6px 0' }}>{t('invite.how', { days: state.trialDays })}</p>
      <p className="muted" style={{ fontSize: 13, margin: '6px 0' }}>{t('invite.privacy')}</p>
      {state.trial?.trialUsed && <p className="muted" style={{ fontSize: 13, margin: '6px 0' }} data-invite-trial-used>{t('invite.trialUsed')}</p>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <code data-invite-code aria-label={t('invite.codeLabel')}>{state.code}</code>
        <button type="button" className="btn btn-sm btn-ghost" data-invite-share onClick={share}>{t('invite.share')}</button>
        <button type="button" className="btn btn-sm btn-quiet" data-invite-copy onClick={copy}>{copied ? t('invite.copied') : t('invite.copy')}</button>
      </div>
    </div>
  );
}
