// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a guest sees when the free sample is used up
//
// The local backend refuses the sixth question with GUEST_CAP_REACHED. This
// says plainly what happened, what making an account changes (the five
// answers come along; nothing is lost) and what it costs (nothing, and no
// card). No countdown, no false scarcity.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { GUEST_ACCOUNT_ROUTE } from './GuestBanner.jsx';

export default function GuestCapNotice({ gate }) {
  const t = useT();
  if (!gate) return null;
  const limit = Number(gate.limit) || 5;
  return (
    <div className="qpage" data-guest-cap>
      <section className="card" role="status" aria-live="polite" style={{ maxWidth: 560 }}>
        <div className="sc-label" style={{ marginBottom: 8 }}>{t('guest.capTitle')}</div>
        <p style={{ marginTop: 0 }}>{t('guest.capUsed', { count: limit, n: limit })}</p>
        <p className="muted">{t('guest.capCarry')}</p>
        <p className="muted">{t('guest.capHonest')}</p>
        <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to={GUEST_ACCOUNT_ROUTE} data-testid="guest-cap-create-account">
            {t('guest.createAccount')}
          </Link>
        </div>
      </section>
    </div>
  );
}
