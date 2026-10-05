// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the guest strip
//
// A visitor trying the app without a profile sees, at all times, how much of
// the free sample is used and the one way out of guest mode. It is a line of
// text and a link, not a campaign: the count is the truth from the local
// backend (user.guestQuestions), and nothing here contacts a server.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.js';

export const GUEST_ACCOUNT_ROUTE = '/account';

export default function GuestBanner({ user }) {
  const t = useT();
  const used = Number(user?.guestQuestions?.used) || 0;
  const limit = Number(user?.guestQuestions?.limit) || 5;
  const spent = used >= limit;
  return (
    <div className="guest-strip no-print" role="status" aria-live="polite" data-guest-strip data-guest-used={used} data-guest-limit={limit}>
      <span className="guest-strip-count">
        <b>{t('guest.countOf', { count: used, used, limit, n: used })}</b>
        {' · '}
        {t(spent ? 'guest.spent' : 'guest.keepWhatYouDo')}
      </span>
      <Link className="btn btn-sm btn-primary" to={GUEST_ACCOUNT_ROUTE} data-testid="guest-create-account">
        {t('guest.createAccount')}
      </Link>
    </div>
  );
}
